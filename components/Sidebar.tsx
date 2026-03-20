"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";


type StandingRow = { name: string; points: number };

type Props = {
  standings: StandingRow[];
  thruText: string;
};

const DESKTOP_NAV = [
  { label: "This Week", href: "/", icon: "⛳" },
  { label: "Picks", href: "/picks", icon: "🎯" },
  { label: "Results", href: "/results", icon: "📊" },
  { label: "Research", href: "/research", icon: "📈" },
  { label: "The Raw Room", href: "/blog", icon: "📰" },
];

const MOBILE_NAV = [
  { label: "This Week", href: "/", icon: "⛳" },
  { label: "Picks", href: "/picks", icon: "🎯" },
  { label: "Results", href: "/results", icon: "📊" },
  { label: "Raw Room", href: "/blog", icon: "📰" },
  { label: "Season", href: "/season", icon: "🏆" },
];

export default function Sidebar({ standings, thruText }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;

  const allNav = isAdmin
    ? [...DESKTOP_NAV, { label: "Admin", href: "/admin", icon: "⚙️" }]
    : DESKTOP_NAV;

  return (
    <>
      {/* ── Desktop Sidebar (md+) ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 min-h-screen bg-slate-100 border-r border-slate-200 text-slate-900">
        {/* Title — logo placeholder */}
        <div className="px-5 py-6 border-b border-slate-200">
          <p className="text-2xl font-bold tracking-wide text-transparent select-none">YL Picks</p>
        </div>

        {/* Nav links */}
        <nav className="px-3 py-5 flex flex-col gap-1">
          {allNav.map(({ label, href, icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-base transition-colors ${
                pathname === href
                  ? "bg-slate-200 text-emerald-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* Season Standings — always visible */}
        <div className="px-5 py-4 border-t border-slate-200">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-900 mb-1 text-center">Season</p>
          <p className="text-xs text-slate-400 mb-3 text-center">{thruText}</p>
          <div className="flex flex-col gap-2">
            {standings.map((row) => (
              <div key={row.name} className="flex items-center">
                <span className="text-base text-slate-900 flex-1">{row.name}</span>
                <span className="text-base font-bold tabular-nums text-slate-900 w-8 text-center">
                  {row.points}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scoring guide — collapsible */}
        <div className="px-4 py-3 border-t border-slate-200">
          <details className="cursor-pointer">
            <summary className="text-xs font-semibold uppercase tracking-widest text-slate-600 select-none">
              Scoring
            </summary>
            <div className="mt-2 space-y-1.5 text-sm text-slate-500">
              <p>+1pt · Tier winner</p>
              <p>+1pt · Best team score</p>
              <p>−1pt · Missed cut</p>
              <p className="text-slate-400 mt-1">$100 to season winner</p>
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="mt-auto px-4 py-4 border-t border-slate-200">
          {session?.user?.name && (
            <p className="text-xs text-slate-500 mb-3 truncate">{session.user.name}</p>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-xs border border-slate-200 text-slate-500 rounded-md px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav (< md) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex items-center justify-around h-16">
        {MOBILE_NAV.map(({ label, href, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${
                active ? "text-emerald-700" : "text-slate-400"
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
