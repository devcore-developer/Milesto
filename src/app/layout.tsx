import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/noto-sans-arabic";
import "./globals.css";

export const metadata: Metadata = {
  title: "My List — قائمتي",
  description:
    "Personal productivity & work management: tasks, projects, calendar, invoices and documents.",
  icons: {
    icon: "/mylist-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#1E3A8A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
