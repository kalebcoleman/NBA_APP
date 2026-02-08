"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useUpgrade } from "@/lib/upgrade";

const links = [
  { href: "/", label: "Home" },
  { href: "/players", label: "Players" },
  { href: "/teams", label: "Teams" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/compare", label: "Compare" },
  { href: "/qa", label: "Q&A" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const { startUpgrade, error: upgradeError } = useUpgrade();

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-nba-blue">
            <span className="text-2xl">🏀</span>
            <span>NBA Analytics</span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname === link.href
                    ? "bg-nba-blue/10 text-nba-blue"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Upgrade / Premium badge */}
          {user?.plan === "premium" ? (
            <span className="rounded-full bg-nba-gold/20 px-3 py-1 text-xs font-semibold text-nba-blue">
              Premium
            </span>
          ) : (
            <button onClick={() => startUpgrade()} className="btn-gold text-xs">
              Upgrade to Premium
            </button>
          )}

          {/* Auth indicator */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-gray-500 sm:inline">
                {user?.email}
              </span>
              <button
                onClick={logout}
                className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Toast for upgrade errors */}
      {upgradeError && (
        <div className="mx-auto max-w-7xl px-4 pb-2 sm:px-6">
          <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {upgradeError}
          </div>
        </div>
      )}
    </nav>
  );
}
