import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatINR as formatMoneyINR } from "@/lib/money";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(value: number | string | null | undefined): string {
  return formatMoneyINR(Number(value ?? 0));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
