import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Primitives";

export const metadata: Metadata = {
  title: "Billora — Unified Subscription, Billing & Revenue Intelligence Platform",
  description: "Every Subscription. One Intelligent Platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en">
        <body className="min-h-screen bg-bg-canvas text-text-primary antialiased">
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
      );
}
