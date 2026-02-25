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
      if (data.tournaments?.length) setOpen(new Set([data.tournaments[0].tournament_id]));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center gap-2 text-slate-500 text-sm"><div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />Loading...</div>;
  if (!tournaments.length) return <div><h2 className="text-xl font-bold text-slate-800 mb-4">Past Results</h2><p className="text-sm text-slate-400">No completed tournaments yet.</p></div>;

  const weeklyMap: Record<string, Record<string, number>> = {};
  weeklyScores.forEach((r) => { if (!weeklyMap[r.tournament_id]) weeklyMap[r.tournament_id] = {}; weeklyMap[r.tournament_id][r.username] = Number(r.points); });

  const pickMap: Record<string, PickScore[]> = {};
  pickScores.forEach((r) => { if (!pickMap[r.tournament_id]) pickMap[r.tournament_id] = []; pickMap[r.tournament_id].push(r); });

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold text-slate-800 mb-5">Past Results</h2>
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
            <div key={t.tournament_id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <button onClick={() => setOpen((p) => { const n = new Set(p); n.has(t.tournament_id) ? n.delete(t.tournament_id) : n.add(t.tournament_id); return n; })}
                className="w-full flex justify-between items-center px-5 py-4 text-left hover:bg-slate-50 transition-colors">
                <span className="font-semibold text-slate-800">{t.name}</span>
                <span className="text-slate-400 text-xs">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  {/* Weekly pts */}
                  <div className="grid grid-cols-4 gap-3 my-4">
                    {users.map((u) => {
                      const pts = tWeekly[u.username];
                      const display = pts === undefined ? "-" : pts > 0 ? `+${pts}` : String(pts);
                      return (
                        <div key={u.username} className="text-center rounded-lg p-2 bg-slate-50 border border-slate-100">
                          <p className="text-xs text-slate-400 mb-0.5">{u.name}</p>
                          <p className={`text-lg font-bold tabular-nums ${pts > 0 ? "text-emerald-600" : pts < 0 ? "text-red-500" : "text-slate-400"}`}>{display}</p>
                        </div>
                      );
                    })}
                  </div>
                  {!tPicks.length ? <p className="text-sm text-slate-400">No pick data.</p> : (
                    <div className="overflow-x-auto">
                      <table className="text-sm w-full border-collapse">
                        <thead><tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase w-14"></th>
                          {users.map((u) => <th key={u.username} className="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">{u.name}</th>)}
                        </tr></thead>
                        <tbody>
                          {tiers.map((tier) => (
                            <tr key={tier} className="border-b border-slate-100">
                              <td className="px-3 py-2 text-xs text-slate-400 font-medium">T{tier}</td>
                              {users.map((u) => {
                                const ps = tierData[tier]?.[u.username];
                                if (!ps) return <td key={u.username} className="px-3 py-2"></td>;
                                const ln = ps.player_name ? ps.player_name.split(" ").pop() : "?";
                                const bg = ps.tier_winner && !ps.missed_cut ? "bg-emerald-50 text-emerald-700 font-bold" : ps.missed_cut && !ps.tier_winner ? "bg-red-50 text-red-400 line-through" : "text-slate-700";
                                return <td key={u.username} className={`px-3 py-2 text-center text-sm ${bg}`}>{ln}</td>;
                              })}
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-200">
                            <td className="px-3 py-2 text-xs text-slate-400 font-semibold uppercase">Team</td>
                            {users.map((u) => {
                              const tot = teamTotals[u.username];
                              const best = tot !== null && tot === bestTotal;
                              return <td key={u.username} className={`px-3 py-2 text-center text-sm font-semibold ${best ? "text-emerald-600" : "text-slate-500"}`}>
                                {tot === null ? "-" : fmtScore(tot)}
                              </td>;
                            })}
                          </tr>
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
