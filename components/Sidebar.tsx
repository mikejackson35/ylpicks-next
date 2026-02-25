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
  { label: "This Week", href: "/", icon: "⛳" },
  { label: "Picks", href: "/picks", icon: "🎯" },
  { label: "Results", href: "/results", icon: "📊" },
  { label: "Research", href: "/research", icon: "📈" },
];

export default function Sidebar({ standings, thruText }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;

  const allNav = isAdmin
    ? [...NAV, { label: "Admin", href: "/admin", icon: "⚙️" }]
    : NAV;

  return (
    <>
      {/* ── Desktop Sidebar (md+) ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 min-h-screen bg-slate-900 border-r border-slate-800 text-white">
        {/* Title */}
        <div className="px-5 py-6 border-b border-slate-800">
          <p className="text-2xl font-bold tracking-wide text-white text-center">YL Picks</p>
        </div>

        {/* Nav links */}
        <nav className="px-3 py-5 flex flex-col gap-1">
          {allNav.map(({ label, href, icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-base transition-colors ${
                pathname === href
                  ? "bg-slate-700 text-emerald-400 font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* Season Standings — always visible */}
        <div className="px-5 py-4 border-t border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-1">Season</p>
          <p className="text-xs text-slate-500 mb-3">{thruText}</p>
          <div className="flex flex-col gap-2">
            {standings.map((row) => (
              <div key={row.name} className="flex justify-between items-center">
                <span className="text-base text-white">{row.name}</span>
                <span className="text-base font-bold tabular-nums text-white">
                  {row.points > 0 ? `+${row.points}` : row.points}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scoring guide — collapsible */}
        <div className="px-4 py-3 border-t border-slate-800">
          <details className="cursor-pointer">
            <summary className="text-xs font-semibold uppercase tracking-widest text-emerald-400 select-none">
              Scoring
            </summary>
            <div className="mt-2 space-y-1.5 text-sm text-slate-400">
              <p>+1pt · Tier winner</p>
              <p>+1pt · Best team score</p>
              <p>−1pt · Missed cut</p>
              <p className="text-slate-500 mt-1">$100 to season winner</p>
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="mt-auto px-4 py-4 border-t border-slate-800">
          {session?.user?.name && (
            <p className="text-xs text-slate-400 mb-3 truncate">{session.user.name}</p>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-xs border border-slate-700 text-slate-400 rounded-md px-3 py-1.5 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav (< md) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 flex items-center justify-around h-16">
        {[...allNav, { label: "Season", href: "/season", icon: "🏆" }].map(({ label, href, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${
                active ? "text-emerald-400" : "text-slate-500"
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className={`text-[10px] ${active ? "font-semibold" : ""}`}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
