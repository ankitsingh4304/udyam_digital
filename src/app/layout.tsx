import type { Metadata, Viewport } from "next";
import "@fontsource/mukta/400.css";
import "@fontsource/mukta/500.css";
import "@fontsource/mukta/700.css";
import "./globals.css";
import { LangProvider } from "@/components/LangContext";

export const metadata: Metadata = {
  title: "Accel Business Advisor",
  description: "Find the right internet, phone and digital tools for your business, with one clear monthly price.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#E40000" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
