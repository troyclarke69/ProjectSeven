import type { Metadata } from "next";
import "./globals.css";
import { AppSessionProvider } from "@/components/session-provider";

export const metadata: Metadata = {
  title: "Project Seven",
  description: "Project registry and documentation cockpit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppSessionProvider>{children}</AppSessionProvider>
      </body>
    </html>
  );
}
