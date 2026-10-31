import { toNumber2 } from "@/lib/money";
import { handleApiError } from "@/server/errors";
import { requireAuth } from "@/server/middlewares/auth";
import { InvoiceService } from "@/server/services/invoice.service";
import { NextRequest, NextResponse } from "next/server";

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Generates a valid, standards-compliant `%PDF-1.4` binary tax invoice document
 * with zero external native binary dependencies.
 */
function generateInvoicePdfBuffer(lines: string[]): Buffer {
  const contentCommands: string[] = ["BT", "/F1 16 Tf", "50 790 Td"];

  lines.forEach((line, idx) => {
    if (idx === 0) {
      contentCommands.push(`(${escapePdfText(line)}) Tj`);
      contentCommands.push("/F1 10 Tf");
      contentCommands.push("0 -24 Td");
    } else {
      contentCommands.push(`(${escapePdfText(line)}) Tj`);
      contentCommands.push("0 -15 Td");
    }
  });
  contentCommands.push("ET");

  const streamContent = contentCommands.join("\n");
  const objects: string[] = [];

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, "utf8")} >>\nstream\n${streamContent}\nendstream\nendobj\n`
  );
  objects.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n"
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const invoice = await InvoiceService.getInvoiceById(session, id);

    const pdfLines: string[] = [
      `BILLORA TAX INVOICE - ${invoice.invoiceNumber}`,
      "----------------------------------------------------------------------",
      `Platform      : Billora (Every Subscription. One Intelligent Platform.)`,
      `Invoice No    : ${invoice.invoiceNumber}`,
      `Status        : ${invoice.status}${invoice.isOverdue ? " (OVERDUE)" : ""}`,
      `Issue Date    : ${invoice.invoiceDate.toISOString().slice(0, 10)}`,
      `Due Date      : ${invoice.dueDate.toISOString().slice(0, 10)}`,
      `Subscription  : ${invoice.subscription?.subscriptionNumber || "Direct Invoice"}`,
      "----------------------------------------------------------------------",
      `Billed To     : ${invoice.customer.companyName || invoice.customer.contactName}`,
      `Contact       : ${invoice.customer.contactName} (${invoice.customer.email})`,
      `Customer Code : ${invoice.customer.customerCode}`,
      `Customer GSTIN: ${invoice.customer.gstin || "Unregistered"}`,
      "----------------------------------------------------------------------",
      "ITEM DESCRIPTION                        QTY     UNIT INR     TOTAL INR",
      "----------------------------------------------------------------------",
    ];

    for (const line of invoice.lines) {
      const desc = line.description.slice(0, 38).padEnd(39, " ");
      const qty = String(line.quantity).padStart(3, " ");
      const unit = toNumber2(line.unitPrice).toFixed(2).padStart(12, " ");
      const tot = toNumber2(line.lineTotal).toFixed(2).padStart(13, " ");
      pdfLines.push(`${desc} ${qty} ${unit} ${tot}`);
    }

    pdfLines.push("----------------------------------------------------------------------");
    pdfLines.push(`Subtotal (INR)        : Rs. ${toNumber2(invoice.subtotal).toFixed(2)}`);
    pdfLines.push(`Discount (INR)        : Rs. ${toNumber2(invoice.discountAmount).toFixed(2)}`);
    pdfLines.push(`Tax / GST (INR)       : Rs. ${toNumber2(invoice.taxAmount).toFixed(2)}`);
    pdfLines.push(`Total Amount (INR)    : Rs. ${toNumber2(invoice.totalAmount).toFixed(2)}`);
    pdfLines.push(`Amount Paid (INR)     : Rs. ${toNumber2(invoice.amountPaid).toFixed(2)}`);
    pdfLines.push(`Outstanding Due (INR) : Rs. ${toNumber2(invoice.outstandingAmount).toFixed(2)}`);
    pdfLines.push("----------------------------------------------------------------------");
    pdfLines.push("Computer generated GST Tax Invoice - Verified by Billora Billing Engine");

    const pdfBuffer = generateInvoicePdfBuffer(pdfLines);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
