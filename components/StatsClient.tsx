"use client";

import { useEffect, useState } from "react";
import PointsChart from "@/components/PointsChart";

type User = { username: string; name: string };
type PickScore = {
  tournament_id: string;
  tournament_name: string;
  start_time: string;
  username: string;
  tier_number: number;
  player_id: string;
  player_name: string;
  points: number;
  tier_winner: boolean;
  missed_cut: boolean;
  player_score: string;
};
type WeeklyScore = {
  tournament_id: string;
  tournament_name: string;
  start_time: string;
  username: string;
  points: number;
};

const USER_COLORS = ["text-emerald-400", "text-sky-400", "text-amber-400", "text-rose-400"];
const USER_BG = ["bg-emerald-400", "bg-sky-400", "bg-amber-400", "bg-rose-400"];

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
      {title}
    </h3>
  );
}

function pointsColor(n: number): string {
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-rose-400";
  return "text-slate-400";
}

function cellBg(n: number, max: number, min: number): string {
  if (n === 0 && max === 0 && min === 0) return "";
  if (n > 0 && max > 0) {
    const intensity = n / max;
    if (intensity >= 0.75) return "bg-emerald-900/60";
    if (intensity >= 0.4) return "bg-emerald-900/35";
    return "bg-emerald-900/20";
  }
  if (n < 0 && min < 0) {
    const intensity = n / min;
    if (intensity >= 0.75) return "bg-rose-900/60";
    if (intensity >= 0.4) return "bg-rose-900/35";
    return "bg-rose-900/20";
  }
  return "";
}

export default function StatsClient() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [pickScores, setPickScores] = useState<PickScore[]>([]);
  const [weeklyScores, setWeeklyScores] = useState<WeeklyScore[]>([]);
  const [playerSortKey, setPlayerSortKey] = useState<"lastName" | "picks" | "wins" | "misses" | "score" | "ptsPer">("ptsPer");
  const [playerSortDir, setPlayerSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users ?? []);
        setPickScores(d.pickScores ?? []);
        setWeeklyScores(d.weeklyScores ?? []);
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    );

  if (!pickScores.length)
    return (
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Statistics</h2>
        <p className="text-sm text-slate-400">No finalized tournament data yet.</p>
      </div>
    );

  // ── Derived stats ──────────────────────────────────────────────

  const weekCount = new Set(weeklyScores.map((w) => w.tournament_id)).size;

  // Season totals from tournament_scores
  const seasonTotals: Record<string, number> = {};
  weeklyScores.forEach((w) => {
    seasonTotals[w.username] = (seasonTotals[w.username] ?? 0) + Number(w.points);
  });

  // Best / worst week per user
  const weeklyByUser: Record<string, number[]> = {};
  weeklyScores.forEach((w) => {
    if (!weeklyByUser[w.username]) weeklyByUser[w.username] = [];
    weeklyByUser[w.username].push(Number(w.points));
  });

  // Season score to par per user (sum of all player_score values)
  function parseScore(s?: string | null): number | null {
    if (!s || s === "-" || s === "CUT") return null;
    if (s === "E") return 0;
    try { return parseInt(s.replace("+", ""), 10); } catch { return null; }
  }
  function fmtScore(n: number): string {
    if (n === 0) return "E";
    return n > 0 ? `+${n}` : String(n);
  }
  const scoreToPar: Record<string, number> = {};
  pickScores.forEach((ps) => {
    const s = parseScore(ps.player_score);
    if (s !== null) scoreToPar[ps.username] = (scoreToPar[ps.username] ?? 0) + s;
  });

  // Tier wins & missed cuts per user
  const tierWins: Record<string, number> = {};
  const missedCuts: Record<string, number> = {};
  users.forEach((u) => { tierWins[u.username] = 0; missedCuts[u.username] = 0; });
  pickScores.forEach((ps) => {
    if (ps.tier_winner && !ps.missed_cut) tierWins[ps.username] = (tierWins[ps.username] ?? 0) + 1;
    if (ps.missed_cut) missedCuts[ps.username] = (missedCuts[ps.username] ?? 0) + 1;
  });

  // Tier points heatmap: [tier][username] = total points
  const tierPoints: Record<number, Record<string, number>> = {};
  for (let t = 1; t <= 6; t++) tierPoints[t] = {};
  pickScores.forEach((ps) => {
    const t = ps.tier_number;
    if (!tierPoints[t]) tierPoints[t] = {};
    tierPoints[t][ps.username] = (tierPoints[t][ps.username] ?? 0) + Number(ps.points);
  });

  // Tier wins by tier per user
  const tierWinsByTier: Record<number, Record<string, number>> = {};
  for (let t = 1; t <= 6; t++) tierWinsByTier[t] = {};
  pickScores.forEach((ps) => {
    if (ps.tier_winner && !ps.missed_cut) {
      const t = ps.tier_number;
      tierWinsByTier[t][ps.username] = (tierWinsByTier[t][ps.username] ?? 0) + 1;
    }
  });

  // Missed cuts by tier per user
  const missedByTier: Record<number, Record<string, number>> = {};
  for (let t = 1; t <= 6; t++) missedByTier[t] = {};
  pickScores.forEach((ps) => {
    if (ps.missed_cut) {
      const t = ps.tier_number;
      missedByTier[t][ps.username] = (missedByTier[t][ps.username] ?? 0) + 1;
    }
  });

  // Player stats
  type PlayerStat = { player_id: string; player_name: string; picks: number; wins: number; misses: number; score: number; points: number };
  const playerMap: Record<string, PlayerStat> = {};
  pickScores.forEach((ps) => {
    if (!playerMap[ps.player_id]) {
      playerMap[ps.player_id] = { player_id: ps.player_id, player_name: ps.player_name, picks: 0, wins: 0, misses: 0, score: 0, points: 0 };
    }
    playerMap[ps.player_id].picks++;
    if (ps.tier_winner && !ps.missed_cut) playerMap[ps.player_id].wins++;
    if (ps.missed_cut) playerMap[ps.player_id].misses++;
    const s = parseScore(ps.player_score);
    if (s !== null) playerMap[ps.player_id].score += s;
    playerMap[ps.player_id].points += Number(ps.points);
  });
  const playerStats = Object.values(playerMap)
    .filter((p) => p.picks >= 2)
    .sort((a, b) => {
      const aLast = a.player_name?.split(" ").slice(1).join(" ") ?? "";
      const bLast = b.player_name?.split(" ").slice(1).join(" ") ?? "";
      const aVal = playerSortKey === "lastName" ? aLast : playerSortKey === "ptsPer" ? (a.picks > 0 ? a.points / a.picks : -999) : a[playerSortKey];
      const bVal = playerSortKey === "lastName" ? bLast : playerSortKey === "ptsPer" ? (b.picks > 0 ? b.points / b.picks : -999) : b[playerSortKey];
      if (aVal < bVal) return playerSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return playerSortDir === "asc" ? 1 : -1;
      return 0;
    });

  function togglePlayerSort(key: typeof playerSortKey) {
    if (key === playerSortKey) setPlayerSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setPlayerSortKey(key); setPlayerSortDir("desc"); }
  }
  function sortIcon(key: typeof playerSortKey) {
    if (key !== playerSortKey) return <span className="text-slate-600 ml-0.5">↕</span>;
    return <span className="text-slate-300 ml-0.5">{playerSortDir === "asc" ? "↑" : "↓"}</span>;
  }

  // Heatmap cell normalization
  const allTierVals = Object.values(tierPoints).flatMap((row) => Object.values(row));
  const heatMax = Math.max(...allTierVals, 0);
  const heatMin = Math.min(...allTierVals, 0);

  return (
    <div className="max-w-3xl space-y-8">
      <h2 className="text-2xl font-bold text-white">Statistics</h2>

      {/* ── 1. User Summary Cards ── */}
      <section>
        <SectionHeader title="Season Summary" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {users.map((u, i) => {
            const total = seasonTotals[u.username] ?? 0;
            const weeks = weeklyByUser[u.username] ?? [];
            const avg = weeks.length ? (total / weeks.length).toFixed(1) : "—";
            const best = weeks.length ? Math.max(...weeks) : null;
            const worst = weeks.length ? Math.min(...weeks) : null;
            return (
              <div key={u.username} className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-2">
                <p className={`text-xs font-semibold uppercase tracking-wide ${USER_COLORS[i]}`}>{u.name}</p>
                <p className={`text-3xl font-bold tabular-nums ${USER_COLORS[i]}`}>{total > 0 ? `+${total}` : total}</p>
                <div className="text-xs text-slate-400 space-y-1 mt-1">
                  <div className="flex justify-between"><span>Avg/wk</span><span className="text-white">{avg}</span></div>
                  <div className="flex justify-between"><span>Tier wins</span><span className="text-emerald-400">{tierWins[u.username] ?? 0}</span></div>
                  <div className="flex justify-between"><span>Missed cuts</span><span className="text-rose-400">{missedCuts[u.username] ?? 0}</span></div>
                  <div className="flex justify-between"><span>Score to Par</span><span className="text-white">{scoreToPar[u.username] !== undefined ? fmtScore(scoreToPar[u.username]) : "—"}</span></div>
                  <div className="flex justify-between"><span>Best wk</span><span className="text-white">{best !== null ? (best > 0 ? `+${best}` : best) : "—"}</span></div>
                  <div className="flex justify-between"><span>Worst wk</span><span className="text-white">{worst !== null ? (worst > 0 ? `+${worst}` : worst) : "—"}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Season Line Chart ── */}
      <PointsChart
        tournaments={[...new Map(weeklyScores.map((w) => [w.tournament_id, { tournament_id: w.tournament_id, name: w.tournament_name, start_time: w.start_time }])).values()]}
        users={users}
        weeklyScores={weeklyScores}
      />

      {/* ── 2. Tier Points Heatmap ── */}
      <section>
        <SectionHeader title="Points by Tier" />
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-sm w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-semibold w-14">Tier</th>
                  {users.map((u, i) => (
                    <th key={u.username} className={`px-3 py-2.5 text-center text-xs font-semibold ${USER_COLORS[i]}`}>{u.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6].map((tier) => (
                  <tr key={tier} className="border-b border-slate-700 last:border-0">
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-semibold">T{tier}</td>
                    {users.map((u) => {
                      const val = tierPoints[tier]?.[u.username] ?? 0;
                      return (
                        <td key={u.username} className={`px-3 py-2.5 text-center text-sm font-semibold tabular-nums ${pointsColor(val)} ${cellBg(val, heatMax, heatMin)}`}>
                          {val > 0 ? `+${val}` : val === 0 ? "—" : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-slate-600 bg-slate-900/30">
                  <td className="px-4 py-2.5 text-xs text-slate-300 font-bold">Total</td>
                  {users.map((u) => {
                    const tot = Object.values(tierPoints).reduce((s, row) => s + (row[u.username] ?? 0), 0);
                    return (
                      <td key={u.username} className={`px-3 py-2.5 text-center text-sm font-bold tabular-nums ${pointsColor(tot)}`}>
                        {tot > 0 ? `+${tot}` : tot === 0 ? "0" : tot}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">Net points earned per tier (tier win +1, missed cut −1)</p>
      </section>

      {/* ── 3. Wins & Cuts by Tier ── */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tier Wins */}
          <div>
            <SectionHeader title="Tier Wins by Tier" />
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <table className="text-sm w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="px-3 py-2 text-left text-xs text-slate-400 font-semibold w-12">Tier</th>
                    {users.map((u, i) => (
                      <th key={u.username} className={`px-2 py-2 text-center text-xs font-semibold ${USER_COLORS[i]}`}>{u.name.split(" ")[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6].map((tier) => {
                    const row = tierWinsByTier[tier] ?? {};
                    const maxWins = Math.max(...users.map((u) => row[u.username] ?? 0));
                    return (
                      <tr key={tier} className="border-b border-slate-700 last:border-0">
                        <td className="px-3 py-2 text-xs text-slate-400 font-semibold">T{tier}</td>
                        {users.map((u) => {
                          const w = row[u.username] ?? 0;
                          const best = w > 0 && w === maxWins;
                          return (
                            <td key={u.username} className={`px-2 py-2 text-center text-sm tabular-nums font-semibold ${best ? "text-emerald-400" : w > 0 ? "text-slate-200" : "text-slate-600"}`}>
                              {w || "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Missed Cuts */}
          <div>
            <SectionHeader title="Missed Cuts by Tier" />
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <table className="text-sm w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="px-3 py-2 text-left text-xs text-slate-400 font-semibold w-12">Tier</th>
                    {users.map((u, i) => (
                      <th key={u.username} className={`px-2 py-2 text-center text-xs font-semibold ${USER_COLORS[i]}`}>{u.name.split(" ")[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6].map((tier) => {
                    const row = missedByTier[tier] ?? {};
                    const maxMiss = Math.max(...users.map((u) => row[u.username] ?? 0));
                    return (
                      <tr key={tier} className="border-b border-slate-700 last:border-0">
                        <td className="px-3 py-2 text-xs text-slate-400 font-semibold">T{tier}</td>
                        {users.map((u) => {
                          const m = row[u.username] ?? 0;
                          const worst = m > 0 && m === maxMiss;
                          return (
                            <td key={u.username} className={`px-2 py-2 text-center text-sm tabular-nums font-semibold ${worst ? "text-rose-400" : m > 0 ? "text-slate-200" : "text-slate-600"}`}>
                              {m || "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Player Stats ── */}
      <section>
        <SectionHeader title="Player Performance" />
        <p className="text-xs text-slate-500 mb-3">Players picked 2+ times across all users</p>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-sm w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th onClick={() => togglePlayerSort("lastName")} className="px-4 py-2.5 text-left text-xs text-slate-400 font-semibold cursor-pointer hover:text-white select-none">Player{sortIcon("lastName")}</th>
                  <th onClick={() => togglePlayerSort("picks")} className="px-3 py-2.5 text-center text-xs text-slate-400 font-semibold cursor-pointer hover:text-white select-none">Picked{sortIcon("picks")}</th>
                  <th onClick={() => togglePlayerSort("wins")} className="px-3 py-2.5 text-center text-xs text-emerald-400 font-semibold cursor-pointer hover:text-emerald-200 select-none">Wins{sortIcon("wins")}</th>
                  <th onClick={() => togglePlayerSort("misses")} className="px-3 py-2.5 text-center text-xs text-rose-400 font-semibold cursor-pointer hover:text-rose-200 select-none">Cuts{sortIcon("misses")}</th>
                  <th onClick={() => togglePlayerSort("score")} className="px-3 py-2.5 text-center text-xs text-slate-400 font-semibold cursor-pointer hover:text-white select-none">Score{sortIcon("score")}</th>
                  <th onClick={() => togglePlayerSort("ptsPer")} className="px-3 py-2.5 text-center text-xs text-slate-400 font-semibold cursor-pointer hover:text-white select-none">Pts/Pick{sortIcon("ptsPer")}</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((p) => {
                  const ptsPer = p.picks > 0 ? (p.points / p.picks).toFixed(2) : "—";
                  const lastName = p.player_name ? p.player_name.split(" ").slice(1).join(" ") || p.player_name : "—";
                  return (
                    <tr key={p.player_id} className="border-b border-slate-700 last:border-0 hover:bg-slate-700/30">
                      <td className="px-4 py-2.5 text-slate-200">{lastName}</td>
                      <td className="px-3 py-2.5 text-center text-slate-400 tabular-nums">{p.picks}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-emerald-400">{p.wins || "—"}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-rose-400">{p.misses || "—"}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-white">{fmtScore(p.score)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-slate-300">{ptsPer}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 5. Head-to-Head Weekly Record ── */}
      <section>
        <SectionHeader title="Head-to-Head Record" />
        <p className="text-xs text-slate-500 mb-3">W–L each week vs. every other user (higher score wins)</p>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-sm w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-semibold">vs.</th>
                  {users.map((u, i) => (
                    <th key={u.username} className={`px-3 py-2.5 text-center text-xs font-semibold ${USER_COLORS[i]}`}>{u.name.split(" ")[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((rowUser, ri) => {
                  // For each opponent, count weeks where rowUser beat opponent
                  const tournIds = [...new Set(weeklyScores.map((w) => w.tournament_id))];
                  return (
                    <tr key={rowUser.username} className="border-b border-slate-700 last:border-0">
                      <td className={`px-4 py-2.5 text-xs font-semibold ${USER_COLORS[ri]}`}>{rowUser.name.split(" ")[0]}</td>
                      {users.map((colUser, ci) => {
                        if (rowUser.username === colUser.username) {
                          return <td key={colUser.username} className="px-3 py-2.5 text-center text-slate-600">—</td>;
                        }
                        let wins = 0, losses = 0;
                        tournIds.forEach((tid) => {
                          const rScore = weeklyScores.find((w) => w.tournament_id === tid && w.username === rowUser.username)?.points;
                          const cScore = weeklyScores.find((w) => w.tournament_id === tid && w.username === colUser.username)?.points;
                          if (rScore !== undefined && cScore !== undefined) {
                            if (Number(rScore) > Number(cScore)) wins++;
                            else if (Number(rScore) < Number(cScore)) losses++;
                          }
                        });
                        const ahead = wins > losses;
                        return (
                          <td key={colUser.username} className={`px-3 py-2.5 text-center tabular-nums text-xs font-semibold ${ahead ? "text-emerald-400" : wins < losses ? "text-rose-400" : "text-slate-400"}`}>
                            {wins}–{losses}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
