"use client";

import { useEffect, useState } from "react";

type Tournament = {
  tournament_id: string; name: string; start_time: string;
  org_id: string; tourn_id: string; year: string; locked: boolean;
};
type User = { username: string; name: string };
type Pick = { username: string; tier_number: number; player_id: string };
type TierPlayer = { tier_number: number; player_id: string; name_last: string; name: string };
type CacheRow = { player_id: string; score_to_par: string; status: string };
type LeaderboardRow = { playerId: string; player: string; score: string; pos: string; status: string };

const TIER_BG: Record<number, string> = {
  1: "bg-rose-50", 2: "bg-slate-50", 3: "bg-amber-50",
  4: "bg-emerald-50", 5: "bg-sky-50", 6: "bg-violet-50",
};
const TIER_DOT: Record<number, string> = {
  1: "bg-rose-400", 2: "bg-slate-400", 3: "bg-amber-400",
  4: "bg-emerald-500", 5: "bg-sky-400", 6: "bg-violet-400",
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
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [tiers, setTiers] = useState<TierPlayer[]>([]);
  const [cached, setCached] = useState<CacheRow[]>([]);
  const [lbRows, setLbRows] = useState<LeaderboardRow[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  useEffect(() => {
    fetch("/api/this-week").then((r) => r.json()).then((data) => {
      setTournament(data.tournament); setUsers(data.users ?? []);
      setPicks(data.picks ?? []); setTiers(data.tiers ?? []);
      setCached(data.cached ?? []); setLoading(false);
      if (data.tournament?.locked && data.tournament?.tourn_id) loadLb(data.tournament);
    });
  }, []);

  function loadLb(t: Tournament) {
    setLbLoading(true);
    fetch(`/api/leaderboard?orgId=${t.org_id ?? "1"}&tournId=${t.tourn_id}&year=${t.year ?? "2026"}`)
      .then((r) => r.json()).then((d) => { setLbRows(d.rows ?? []); setLbLoading(false); })
      .catch(() => setLbLoading(false));
  }

  if (loading) return <div className="flex items-center gap-2 text-slate-500 text-sm"><div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />Loading...</div>;
  if (!tournament) return <p className="text-slate-500">Season complete — check Results for final standings.</p>;

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
    const best = Math.min(...pids.map((p) => scores[p] ?? 999));
    if (best !== 999) tierWin[t] = new Set(pids.filter((p) => (scores[p] ?? 999) === best));
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

  const pickedIds = new Set(picks.map((p) => p.player_id));
  const tierOf: Record<string, number> = {};
  tiers.forEach((t) => { tierOf[t.player_id] = t.tier_number; });
  const lb = lbRows.filter((r) => pickedIds.has(r.playerId)).sort((a, b) => parseScore(String(a.score)) - parseScore(String(b.score)));
  const hasLb = lb.some((r) => r.score && r.score !== "-");

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">{tournament.name}</h2>
        {!tournament.locked && <p className="text-sm text-amber-600 mt-1">⏰ Tournament has not started — picks are hidden</p>}
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {users.map((u) => {
          const pts = wkPts[u.name] ?? 0;
          const lead = teamLeaders.has(u.name) && tournament.locked;
          return (
            <div key={u.username} className={`rounded-xl p-3 text-center border ${lead ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200"}`}>
              <p className="text-xs text-slate-500 font-medium mb-1">{u.name}</p>
              <p className={`text-2xl font-bold tabular-nums ${pts > 0 ? "text-emerald-600" : pts < 0 ? "text-red-500" : "text-slate-400"}`}>
                {pts > 0 ? `+${pts}` : pts}
              </p>
            </div>
          );
        })}
      </div>

      {/* Picks grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <table className="text-sm w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-400 w-16"></th>
              {users.map((u) => <th key={u.username} className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">{u.name}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 bg-slate-50">
              <td className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Team</td>
              {users.map((u) => {
                const s = teamTotals[u.name]; const lead = teamLeaders.has(u.name);
                const disp = !tournament.locked ? "—" : s === 999 ? "E" : fmtScore(s);
                return <td key={u.username} className={`px-4 py-2 text-center text-sm font-semibold ${lead && tournament.locked && s !== 999 ? "text-emerald-600" : "text-slate-500"}`}>
                  {lead && tournament.locked && s !== 999 ? `🏆 ${disp}` : disp}
                </td>;
              })}
            </tr>
            {[1,2,3,4,5,6].map((tier) => (
              <tr key={tier} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${TIER_DOT[tier]}`} />
                    <span className="text-xs font-medium text-slate-500">T{tier}</span>
                  </div>
                </td>
                {users.map((u) => {
                  const pid = pickMap[u.username][tier];
                  const win = pid ? tierWin[tier]?.has(pid) : false;
                  const mc = pid ? cut[pid] : false;
                  const txt = !pid || !tournament.locked ? "—" : mc && !win ? `❌ ${lastNames[pid] ?? "?"}` : (lastNames[pid] ?? "?");
                  return <td key={u.username} className={`px-4 py-2.5 text-center text-sm ${win && !mc ? "font-bold text-emerald-700" : mc && !win ? "text-red-400 line-through" : "text-slate-700"}`}>{txt}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leaderboard */}
      {tournament.locked ? (
        lbLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm"><div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />Loading leaderboard...</div>
        ) : hasLb ? (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Live Leaderboard</p>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="text-sm w-full border-collapse">
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Pos</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Player</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-400 uppercase">Score</th>
                </tr></thead>
                <tbody>
                  {lb.map((row) => {
                    const s = parseScore(String(row.score));
                    return <tr key={row.playerId} className={`border-b border-slate-100 last:border-0 ${TIER_BG[tierOf[row.playerId]] ?? ""}`}>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{row.pos}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{row.player}</td>
                      <td className={`px-4 py-2.5 text-center font-bold tabular-nums ${s < 0 ? "text-red-600" : s > 0 ? "text-slate-500" : "text-slate-800"}`}>{row.score}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">🏌️ Live leaderboard will appear once play begins</div>
      ) : <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">🏌️ Live leaderboard will appear when the tournament begins</div>}
    </div>
  );
}
