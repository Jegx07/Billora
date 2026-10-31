import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Primitives";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-bg-canvas text-text-primary antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
