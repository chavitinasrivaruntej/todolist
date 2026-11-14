import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/components/providers/trpc-provider";

export const metadata: Metadata = {
  title: "Caize Todo Application",
  description: "Minimalist task management with clean modular monolith architecture",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="min-h-full antialiased">
      <body className="min-h-full bg-neutral-50/50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50 font-sans">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
