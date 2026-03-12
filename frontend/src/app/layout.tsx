"use client";

import "./globals.css";
import { WalletProviders } from "@/components/WalletProvider";
import { Sidebar } from "@/components/Sidebar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-dark-950 text-white">
        <WalletProviders>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">{children}</main>
          </div>
        </WalletProviders>
      </body>
    </html>
  );
}
