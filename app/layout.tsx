import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RukaPay Executive Analytics",
  description: "Internal executive dashboard — data.rukapay",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased font-sans bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
