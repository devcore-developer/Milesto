import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotesProvider } from "@/lib/notes-context";
import { FinanceProvider } from "@/lib/finance-context";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Milesto — Project execution workspace",
    template: "%s · Milesto",
  },
  description:
    "Milesto is a premium project execution and analytics workspace for managing projects, milestones, tasks, testing, notes, deadlines, and project finances.",
  applicationName: "Milesto",
  authors: [{ name: "Milesto" }],
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <NotesProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </NotesProvider>
        <FinanceProvider>
          <NotesProvider>
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          </NotesProvider>
        </FinanceProvider>
      </body>
    </html>
  );
}