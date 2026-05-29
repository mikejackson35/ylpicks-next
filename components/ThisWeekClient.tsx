"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Tournament = {
  tournament_id: string; name: string; start_time: string;
  org_id: string; tourn_id: string; year: string; locked: boolean;
};
type User = { username: string; name: string };
type Pick = { username: string; tier_number: number; player_id: string };
type TierPlayer = { tier_number: number; player_id: string; name_last: string; name: string };
type CacheRow = { player_id: string; score_to_par: string; status: string };
type LeaderboardRow = { playerId: string; player: string; score: string; pos: string; status: string; thru?: string };

const TIER_DOT: Record<number, string> = {
  1: "bg-fuchsia-400 ring-1 ring-slate-200", 2: "bg-black ring-1 ring-slate-200", 3: "bg-blue-500 ring-1 ring-slate-200",
  4: "bg-slate-300 ring-1 ring-slate-200", 5: "bg-violet-500 ring-1 ring-slate-200", 6: "bg-orange-400 ring-1 ring-slate-200",
};
const TIER_RIBBON: Record<number, string> = {
  1: "bg-fuchsia-700", 2: "bg-zinc-600", 3: "bg-blue-700",
  4: "bg-slate-500", 5: "bg-violet-700", 6: "bg-orange-700",
};

function parseScore(s?: string | null): number {
  if (!s || s === "-") return 999;
  if (s === "E") return 0;
  try { return parseInt(s.replace("+", ""), 10); } catch { return 999; }
}
function fmtScore(n: number): string {
  if (n === 0) return "E"; if (n === 999) return "-";
  return n > 0 ? `+${n}` : String(n);
}

export default function ThisWeekClient() {
  const searchParams = useSearchParams();
  const previewLocked = searchParams.get("preview") === "true";

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [tiers, setTiers] = useState<TierPlayer[]>([]);
  const [cached, setCached] = useState<CacheRow[]>([]);
  const [lbRows, setLbRows] = useState<LeaderboardRow[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [autoPickedUsernames, setAutoPickedUsernames] = useState<Set<string>>(new Set());
  const [autoPickCounts, setAutoPickCounts] = useState<Record<string, number>>({});
  const [lbOpen, setLbOpen] = useState(false);
  const [lbView, setLbView] = useState<"score" | "tier">("score");

  useEffect(() => {
    const url = previewLocked ? "/api/this-week?preview=true" : "/api/this-week";
    fetch(url).then((r) => r.json()).then((data) => {
      setTournament(data.tournament); setUsers(data.users ?? []);
      setPicks(data.picks ?? []); setTiers(data.tiers ?? []);
      setCached(data.cached ?? []); setAutoPickedUsernames(new Set(data.autoPickedUsernames ?? []));
      setAutoPickCounts(data.autoPickCounts ?? {});
      setLoading(false);
      if (data.tournament?.tourn_id) loadLb(data.tournament);
    });
  }, []);

  function loadLb(t: Tournament) {
    setLbLoading(true);
    fetch(`/api/leaderboard?orgId=${t.org_id ?? "1"}&tournId=${t.tourn_id}&year=${t.year ?? "2026"}`)
      .then((r) => r.json()).then((d) => { setLbRows(d.rows ?? []); setLbLoading(false); })
      .catch(() => setLbLoading(false));
  }

  // Apply preview override after data loads
  if (tournament && previewLocked) tournament.locked = true;

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 text-sm">
      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );
  if (!tournament) return <p className="text-slate-400">Season complete — check Results for final standings.</p>;

  const lastNames: Record<string, string> = {};
  tiers.forEach((t) => { lastNames[t.player_id] = t.name_last; });

  const pickMap: Record<string, Record<number, string | null>> = {};
  users.forEach((u) => { pickMap[u.username] = {}; for (let i = 1; i <= 6; i++) pickMap[u.username][i] = null; });
  picks.forEach((p) => { pickMap[p.username][p.tier_number] = p.player_id; });

  const scores: Record<string, number> = {};
  const cut: Record<string, boolean> = {};
  const src = cached.length > 0 ? cached : lbRows.map((r) => ({ player_id: r.playerId, score_to_par: String(r.score), status: r.status }));
  src.forEach((r) => { scores[r.player_id] = parseScore(r.score_to_par); cut[r.player_id] = r.status?.toLowerCase() === "cut"; });
  lbRows.forEach((r) => { scores[r.playerId] = parseScore(String(r.score)); cut[r.playerId] = r.status === "cut"; });

  const teamTotals: Record<string, number> = {};
  users.forEach((u) => {
    const vals = Object.values(pickMap[u.username]).map((p) => p ? scores[p] ?? 999 : 999).filter((s) => s !== 999);
    teamTotals[u.name] = vals.length ? vals.reduce((a, b) => a + b, 0) : 999;
  });
  const validTotals = Object.values(teamTotals).filter((s) => s !== 999);
  const bestTotal = validTotals.length ? Math.min(...validTotals) : 999;
  const teamLeaders = new Set(Object.entries(teamTotals).filter(([, s]) => s === bestTotal && s !== 999).map(([n]) => n));

  const tierWin: Record<number, Set<string>> = {};
  for (let t = 1; t <= 6; t++) {
    const pids = users.map((u) => pickMap[u.username][t]).filter(Boolean) as string[];
    const activePids = pids.filter((p) => !cut[p]);
    const best = Math.min(...activePids.map((p) => scores[p] ?? 999));
    if (best !== 999) tierWin[t] = new Set(activePids.filter((p) => (scores[p] ?? 999) === best));
  }

  const wkPts: Record<string, number> = {};
  users.forEach((u) => {
    let pts = 0;
    for (let t = 1; t <= 6; t++) {
      const p = pickMap[u.username][t];
      if (!p) continue;
      if (tierWin[t]?.has(p)) pts++;
      if (cut[p]) pts--;
    }
    if (teamLeaders.has(u.name)) pts++;
    wkPts[u.name] = pts;
  });

  const pickedIds = new Set(picks.map((p) => String(p.player_id)));
  const tierOf: Record<string, number> = {};
  tiers.forEach((t) => { tierOf[String(t.player_id)] = t.tier_number; });
  // Build tier lookup from picks — guaranteed to match lb's playerId values
  const pickTierMap: Record<string, number> = {};
  picks.forEach((p) => { pickTierMap[String(p.player_id)] = p.tier_number; });
  const lb = lbRows.filter((r) => pickedIds.has(String(r.playerId))).sort((a, b) => parseScore(String(a.score)) - parseScore(String(b.score)));
  const hasLb = lb.some((r) => r.score && r.score !== "-");


  return (
    <div className="max-w-3xl">

      {/* Tournament header */}
      <div className="mb-5 md:mb-8 text-center">
        <h2 className="text-lg md:text-3xl font-bold text-white">{tournament.name}</h2>
      </div>

      {/* Picks grid — score cards in header, aligned to columns */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-2 md:mb-4">
        <table className="text-sm w-full border-collapse table-fixed">
          <thead>
            {/* Score cards row */}
            <tr className="border-b border-slate-700">
              <th className="w-16 hidden md:table-cell" />
              {users.map((u) => {
                const pts = wkPts[u.name] ?? 0;
                const isAutoPicked = autoPickedUsernames.has(u.username);
                const autoCount = autoPickCounts[u.username] ?? 0;
                return (
                  <th key={u.username} className="px-1 py-2 md:px-3 md:py-4">
                    <div className="rounded-xl px-1 py-3 md:px-3 md:py-5 text-center border bg-slate-900 border-slate-700">
                      <p className="text-[10px] md:text-sm text-slate-400 font-medium mb-1 uppercase tracking-wide inline-flex items-center gap-1 justify-center">
                        {u.name}
                        {isAutoPicked && (
                          <span className="inline-flex items-center gap-0.5">
                            <span>*</span>
                            {autoCount >= 1 && (
                              <span className="inline-flex items-center justify-center w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-red-600 text-white text-[8px] md:text-[9px] font-bold leading-none">
                                {autoCount}
                              </span>
                            )}
                          </span>
                        )}
                      </p>
                      <p className="text-lg md:text-3xl font-bold tabular-nums text-white">
                        {pts}
                      </p>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Team total row */}
            <tr className="border-b border-slate-700 bg-slate-900/50">
              <td className="px-4 py-2.5 md:py-3 text-xs md:text-sm font-semibold text-slate-500 uppercase hidden md:table-cell">Team</td>
              {users.map((u) => {
                const s = teamTotals[u.name];
                const lead = teamLeaders.has(u.name);
                const disp = !tournament.locked ? "—" : s === 999 ? "E" : fmtScore(s);
                return (
                  <td key={u.username} className={`px-2 py-2 md:px-4 md:py-3 text-center text-xs md:text-base font-semibold ${
                    lead && tournament.locked && s !== 999 ? "font-bold text-emerald-400" : "text-slate-400"
                  }`}>
                    {disp}
                  </td>
                );
              })}
            </tr>
            {/* Tier rows */}
            {[1,2,3,4,5,6].map((tier) => (
              <tr key={tier} className="border-b border-slate-700 last:border-0">
                <td className="px-4 py-2 md:py-3 hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full shrink-0 ${TIER_DOT[tier]}`} />
                    <span className="text-xs font-medium text-slate-400">T{tier}</span>
                  </div>
                </td>
                {users.map((u) => {
                  const pid = pickMap[u.username][tier];
                  const win = pid ? tierWin[tier]?.has(pid) : false;
                  const mc = pid ? cut[pid] : false;
                  const name = lastNames[pid ?? ""] ?? "?";
                  const txt = !tournament.locked ? "🔒"
                    : !pid ? "—"
                    : name;
                  const scoreNum = pid ? scores[pid] : undefined;
                  const scoreTxt = tournament.locked && pid && scoreNum !== undefined
                    ? fmtScore(scoreNum)
                    : null;
                  return (
                    <td key={u.username} className={`px-2 py-2 md:px-4 md:py-3 text-center text-xs md:text-base ${
                      !tournament.locked ? "text-slate-600"
                      : win && !mc ? "font-bold text-emerald-400"
                      : !win && mc ? "text-red-400"
                      : "text-slate-200"
                    }`}>
                      {txt}
                      {scoreTxt && (
                        <p className="text-[9px] md:text-xs text-slate-400 font-normal mt-1">{scoreTxt}</p>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Auto-picks footnote */}
      {autoPickedUsernames.size > 0 && (
        <p className="text-[10px] md:text-xs text-slate-500 italic mt-2 mb-4 md:mb-6 text-right">* denotes lazy player using auto-picks this week</p>
      )}

      {/* Leaderboard dropdown */}
      {tournament.locked && (
        <div className="mt-4 md:mt-6">
          <button
            onClick={() => setLbOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <span>Live Leaderboard</span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${lbOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {lbOpen && (
            <div className="mt-2">
              {lbLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm px-1 py-4">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  Loading leaderboard...
                </div>
              ) : hasLb ? (
                <>
                  {/* View toggle */}
                  <div className="flex gap-1 mb-2 bg-slate-800 border border-slate-700 rounded-lg p-1">
                    <button
                      onClick={() => setLbView("score")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        lbView === "score" ? "bg-slate-600 text-slate-100" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      By Score
                    </button>
                    <button
                      onClick={() => setLbView("tier")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        lbView === "tier" ? "bg-slate-600 text-slate-100" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      By Tier
                    </button>
                  </div>

                  {lbView === "score" ? (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                      <table className="text-sm w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-900 border-b border-slate-700">
                            <th className="w-8 py-2 pl-3" />
                            <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase">Pos</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Player</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">Thru</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lb.map((row) => (
                            <tr key={row.playerId} className="border-b border-slate-700 last:border-0">
                              <td className="pl-3 py-2">
                                <div className={`w-4 h-4 rounded-full shrink-0 ${TIER_DOT[tierOf[row.playerId]] ?? "bg-slate-600"}`} />
                              </td>
                              <td className="px-2 py-2 text-center text-slate-400 text-xs">{row.pos}</td>
                              <td className="px-4 py-2 font-medium text-slate-100">{row.player}</td>
                              <td className="px-4 py-2 text-center tabular-nums text-slate-400 text-xs">{row.thru ?? "-"}</td>
                              <td className="px-4 py-2 text-center font-bold tabular-nums text-white">{row.score}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[1,2,3,4,5,6].map((tier) => {
                        const tierPlayers = tiers.filter((t) => Number(t.tier_number) === tier);
                        if (tierPlayers.length === 0) return null;
                        const tierRows = tierPlayers
                          .map((t) => {
                            const lbRow = lbRows.find((r) => String(r.playerId) === String(t.player_id));
                            return {
                              playerId: String(t.player_id),
                              player: lbRow?.player ?? t.name,
                              score: lbRow ? String(lbRow.score) : "-",
                              pos: lbRow?.pos ?? "-",
                              status: lbRow?.status ?? "active",
                              thru: lbRow?.thru ?? "-",
                              isPicked: pickedIds.has(String(t.player_id)),
                            };
                          })
                          .sort((a, b) => parseScore(a.score) - parseScore(b.score));
                        return (
                          <div key={tier} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                            <div className={`h-1.5 ${TIER_RIBBON[tier]}`} />
                            <table className="text-sm w-full border-collapse">
                              <tbody>
                                {tierRows.map((row) => {
                                  const isCut = row.status === "cut";
                                  return (
                                    <tr key={row.playerId} className="border-b border-slate-700 last:border-0">
                                      <td className="px-3 py-2 text-center text-xs w-10 text-slate-500">{row.pos}</td>
                                      <td className={`px-4 py-2 font-medium ${isCut ? "text-red-400" : row.isPicked ? "text-slate-100" : "text-slate-500"}`}>
                                        {row.player}
                                      </td>
                                      <td className="px-3 py-2 text-center tabular-nums text-xs text-slate-500 w-10">
                                        {row.thru}
                                      </td>
                                      <td className={`px-4 py-2 text-center font-bold tabular-nums w-16 ${isCut ? "text-red-400" : row.isPicked ? "text-white" : "text-slate-500"}`}>
                                        {row.score}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center text-slate-500 text-sm">
                  🏌️ Live leaderboard will appear once play begins
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
