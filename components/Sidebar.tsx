"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

type StandingRow = { name: string; points: number };

type Props = {
  standings: StandingRow[];
  thruText: string;
};

const NAV = [
  { label: "This Week", href: "/" },
  { label: "Make Picks", href: "/picks" },
  { label: "Results", href: "/results" },
  { label: "Research", href: "/research" },
];

export default function Sidebar({ standings, thruText }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;

  return (
    <aside className="flex flex-col w-48 shrink-0 min-h-screen bg-emerald-950 text-white">
      {/* App title */}
      <div className="px-4 py-5 border-b border-emerald-800">
        <p className="text-lg font-bold tracking-wide text-white">⛳ YL Picks</p>
      </div>

      {/* Season Standings */}
      <div className="px-4 py-4 border-b border-emerald-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-1">Season</p>
        <p className="text-xs text-emerald-500 mb-3">{thruText}</p>
        <div className="flex flex-col gap-1">
          {standings.map((row, i) => (
            <div key={row.name} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-500 w-3">{i + 1}</span>
                <span className="text-sm text-white">{row.name}</span>
              </div>
              <span className={`text-sm font-bold tabular-nums ${
                row.points > 0 ? "text-emerald-300" :
                row.points < 0 ? "text-red-400" : "text-gray-400"
              }`}>
                {row.points > 0 ? `+${row.points}` : row.points}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring guide */}
      <div className="px-4 py-4 border-b border-emerald-800">
        <details className="cursor-pointer">
          <summary className="text-xs font-semibold uppercase tracking-widest text-emerald-400 select-none">
            Scoring
          </summary>
          <div className="mt-2 space-y-1 text-xs text-emerald-300">
            <p className="font-semibold text-emerald-200">Weekly</p>
            <p>+1pt · Tier winner</p>
            <p>+1pt · Best team score</p>
            <p>−1pt · Missed cut</p>
            <p className="font-semibold text-emerald-200 mt-2">Season</p>
            <p>$100 to season winner</p>
          </div>
        </details>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-4 flex flex-col gap-0.5">
        {NAV.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              pathname === href
                ? "bg-emerald-700 text-white font-semibold"
                : "text-emerald-200 hover:bg-emerald-800 hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/admin"
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              pathname === "/admin"
                ? "bg-emerald-700 text-white font-semibold"
                : "text-emerald-200 hover:bg-emerald-800 hover:text-white"
            }`}
          >
            Admin
          </Link>
        )}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-4 py-4 border-t border-emerald-800">
        {session?.user?.name && (
          <p className="text-xs text-emerald-400 mb-3 truncate">
            {session.user.name}
          </p>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-xs border border-emerald-700 text-emerald-300 rounded-md px-3 py-1.5 hover:bg-emerald-800 hover:text-white transition-colors"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
