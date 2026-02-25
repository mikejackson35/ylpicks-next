import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getStandings() {
  const [scoresRes, usersRes, countRes] = await Promise.all([
    pool.query("SELECT username, SUM(points) as total_points FROM tournament_scores GROUP BY username"),
    pool.query("SELECT username, name FROM users ORDER BY name"),
    pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_finalized = TRUE) as done FROM tournaments"),
  ]);

  const nameMap: Record<string, string> = {};
  usersRes.rows.forEach((u: { username: string; name: string }) => (nameMap[u.username] = u.name));

  const pointsMap: Record<string, number> = {};
  usersRes.rows.forEach((u: { username: string }) => (pointsMap[u.username] = 0));
  scoresRes.rows.forEach((r: { username: string; total_points: string }) => (pointsMap[r.username] = Number(r.total_points) || 0));

  const standings = Object.entries(pointsMap)
    .map(([username, points]) => ({ name: nameMap[username], points }))
    .sort((a, b) => b.points - a.points);

  const { total, done } = countRes.rows[0];
  return { standings, thruText: `thru ${done} of ${total} tournaments` };
}

const SCORING = [
  { label: "Tier winner", pts: "+1 pt" },
  { label: "Best team score", pts: "+1 pt" },
  { label: "Missed cut", pts: "−1 pt" },
];

export default async function SeasonPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { standings, thruText } = await getStandings();

  return (
    <div className="max-w-sm">
      <h2 className="text-2xl font-bold text-white mb-1 text-center">Season</h2>
      <p className="text-xs text-slate-400 mb-6 text-center">{thruText}</p>

      {/* Standings */}
      <div className="flex flex-col gap-3 mb-14">
        {standings.map((row) => (
          <div key={row.name} className="flex justify-between items-center">
            <span className="text-white text-lg font-medium">{row.name}</span>
            <span className="text-lg font-bold tabular-nums text-white">{row.points}</span>
          </div>
        ))}
      </div>

      {/* Scoring */}
      <p className="text-xs font-semibold uppercase tracking-widest text-white mb-3 text-center">Scoring</p>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {SCORING.map(({ label, pts }) => (
          <div key={label} className="flex justify-between items-center px-5 py-3.5 border-b border-slate-700 last:border-0">
            <span className="text-slate-300 text-sm">{label}</span>
            <span className="text-white font-semibold text-sm">{pts}</span>
          </div>
        ))}
        <div className="px-5 py-3.5">
          <p className="text-slate-500 text-sm">$100 to season winner</p>
        </div>
      </div>
    </div>
  );
}
