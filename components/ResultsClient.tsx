"use client";

import { useEffect, useState } from "react";

type Tournament = { tournament_id: string; name: string; start_time: string };
type User = { username: string; name: string };
type WeeklyScore = { tournament_id: string; username: string; points: number };
type PickScore = { tournament_id: string; username: string; tier_number: number; player_name: string; player_score: string; tier_winner: boolean; missed_cut: boolean; points: number };


function parseScore(s?: string | null): number | null {
  if (!s || s === "-") return null;
  if (s === "E") return 0;
  try { return parseInt(s.replace("+", ""), 10); } catch { return null; }
}
function fmtScore(n: number): string {
  if (n === 0) return "E"; return n > 0 ? `+${n}` : String(n);
}

export default function ResultsClient() {
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [weeklyScores, setWeeklyScores] = useState<WeeklyScore[]>([]);
  const [pickScores, setPickScores] = useState<PickScore[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/results").then((r) => r.json()).then((data) => {
      setTournaments(data.tournaments ?? []); setUsers(data.users ?? []);
      setWeeklyScores(data.weeklyScores ?? []); setPickScores(data.pickScores ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 text-sm">
      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );
  if (!tournaments.length) return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-4">Results</h2>
      <p className="text-sm text-slate-400">No completed tournaments yet.</p>
    </div>
  );

  const weeklyMap: Record<string, Record<string, number>> = {};
  weeklyScores.forEach((r) => { if (!weeklyMap[r.tournament_id]) weeklyMap[r.tournament_id] = {}; weeklyMap[r.tournament_id][r.username] = Number(r.points); });

  const pickMap: Record<string, PickScore[]> = {};
  pickScores.forEach((r) => { if (!pickMap[r.tournament_id]) pickMap[r.tournament_id] = []; pickMap[r.tournament_id].push(r); });

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-white mb-6">Results</h2>
      <div className="flex flex-col gap-3">
        {tournaments.map((t) => {
          const isOpen = open.has(t.tournament_id);
          const tPicks = pickMap[t.tournament_id] ?? [];
          const tWeekly = weeklyMap[t.tournament_id] ?? {};
          const tierData: Record<number, Record<string, PickScore>> = {};
          tPicks.forEach((ps) => { if (!tierData[ps.tier_number]) tierData[ps.tier_number] = {}; tierData[ps.tier_number][ps.username] = ps; });
          const tiers = Object.keys(tierData).map(Number).sort((a, b) => a - b);
          const teamTotals: Record<string, number | null> = {};
          users.forEach((u) => {
            const vals = tPicks.filter((ps) => ps.username === u.username).map((ps) => parseScore(ps.player_score)).filter((s): s is number => s !== null);
            teamTotals[u.username] = vals.length ? vals.reduce((a, b) => a + b, 0) : null;
          });
          const validTotals = Object.values(teamTotals).filter((v): v is number => v !== null);
          const bestTotal = validTotals.length ? Math.min(...validTotals) : null;

          return (
            <div key={t.tournament_id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => setOpen((p) => { const n = new Set(p); n.has(t.tournament_id) ? n.delete(t.tournament_id) : n.add(t.tournament_id); return n; })}
                className="w-full flex justify-between items-center px-5 py-4 text-left hover:bg-slate-700/50 transition-colors"
              >
                <span className="font-semibold text-white">{t.name}</span>
                <span className="text-slate-400 text-xs">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="px-2 md:px-5 pb-4 md:pb-5 border-t border-slate-700">
                  {/* Weekly points score cards */}
                  <div className="grid grid-cols-4 gap-1 md:gap-3 my-4">
                    {users.map((u) => {
                      const pts = tWeekly[u.username];
                      const display = pts === undefined ? "-" : pts > 0 ? `+${pts}` : String(pts);
                      return (
                        <div key={u.username} className="text-center rounded-xl p-1 md:p-2 bg-slate-900 border border-slate-700">
                          <p className="text-[10px] md:text-xs text-slate-400 mb-0.5 uppercase tracking-wide truncate">{u.name}</p>
                          <p className="text-base md:text-lg font-bold tabular-nums text-white">{display}</p>
                        </div>
                      );
                    })}
                  </div>

                  {!tPicks.length ? <p className="text-sm text-slate-400">No pick data.</p> : (
                    <div className="overflow-x-auto">
                      <table className="text-sm w-full border-collapse table-fixed">
                        <thead>
                          <tr className="bg-slate-900/50 border-b border-slate-700">
                            {users.map((u) => {
                              const tot = teamTotals[u.username];
                              const best = tot !== null && tot === bestTotal;
                              return (
                                <th key={u.username} className={`px-1 py-2 md:px-3 text-center text-xs md:text-sm font-semibold ${best ? "text-emerald-400" : "text-slate-400"}`}>
                                  {tot === null ? "-" : fmtScore(tot)}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {tiers.map((tier) => (
                            <tr key={tier} className="border-b border-slate-700 last:border-0">
                              {users.map((u) => {
                                const ps = tierData[tier]?.[u.username];
                                if (!ps) return <td key={u.username} className="px-3 py-2.5" />;
                                const ln = ps.player_name ? ps.player_name.split(" ").pop() : "?";
                                const win = ps.tier_winner;
                                const mc = ps.missed_cut;
                                const cls = win && !mc ? "font-bold text-emerald-400"
                                  : !win && mc ? "text-red-400"
                                  : "text-slate-200";
                                return <td key={u.username} className={`px-1 py-2 md:px-3 md:py-2.5 text-center text-xs md:text-sm truncate max-w-0 ${cls}`}>{ln}</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
