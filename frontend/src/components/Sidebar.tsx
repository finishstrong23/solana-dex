"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const navItems = [
  { href: "/", label: "Swap", icon: SwapIcon },
  { href: "/pools", label: "Pools", icon: PoolsIcon },
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-dark-900 border-r border-dark-700 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-dark-700">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
          SolanaDEX
        </h1>
        <p className="text-xs text-dark-400 mt-1">Constant Product AMM</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-primary-600/20 text-primary-400 border border-primary-600/30"
                  : "text-dark-300 hover:bg-dark-800 hover:text-white"
              }`}
            >
              <item.icon active={isActive} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Wallet Connection */}
      <div className="p-4 border-t border-dark-700">
        <WalletMultiButton className="w-full !justify-center" />
      </div>

      {/* Network Badge */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 text-xs text-dark-400">
          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
          Devnet
        </div>
      </div>
    </div>
  );
}

function SwapIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-5 h-5 ${active ? "text-primary-400" : "text-dark-400"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
      />
    </svg>
  );
}

function PoolsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-5 h-5 ${active ? "text-primary-400" : "text-dark-400"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-5 h-5 ${active ? "text-primary-400" : "text-dark-400"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}
