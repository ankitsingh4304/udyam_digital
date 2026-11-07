import type { Metadata, Viewport } from "next";
import "@fontsource/mukta/400.css";
import "@fontsource/mukta/500.css";
import "@fontsource/mukta/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Accel Business Advisor",
  description: "Find the right internet, phone and digital tools for your business, with one clear monthly price.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1B2A4A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
