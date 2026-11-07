import type { Metadata, Viewport } from "next";
import "@fontsource/mukta/400.css";
import "@fontsource/mukta/500.css";
import "@fontsource/mukta/700.css";
import "./globals.css";
import { LangProvider } from "@/components/LangContext";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Accel Business",
  description: "Internet, phones and digital tools for your business, with one clear monthly price.",
  manifest: "/manifest.webmanifest",
  applicationName: "Accel Business",
  appleWebApp: { capable: true, title: "Accel Biz", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#E40000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">
        <LangProvider>{children}</LangProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
