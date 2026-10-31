import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Primitives";

export const metadata: Metadata = {
  title: "Billora — Unified Subscription, Billing & Revenue Intelligence Platform",
  description: "Every Subscription. One Intelligent Platform.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/brand/billora-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/billora-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/billora-icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
