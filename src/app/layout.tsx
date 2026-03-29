import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mawthook - WhatsApp Webhook Middleware",
  description: "WhatsApp webhook middleware with multi-number routing and dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50">{children}</body>
    </html>
  );
}
