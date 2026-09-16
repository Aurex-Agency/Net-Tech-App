import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterWorker } from "@/components/register-worker";
export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_APP_NAME || "Net-Tech Connect",
    template: `%s · ${process.env.NEXT_PUBLIC_APP_NAME || "Net-Tech Connect"}`,
  },
  description:
    "Your Net-Tech team, connected. Support, conversations, and service visits in one place.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Net-Tech" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0067d8",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterWorker />
      </body>
    </html>
  );
}
