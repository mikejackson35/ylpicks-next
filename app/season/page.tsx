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
    <div className="flex flex-col justify-center min-h-[calc(100svh-6rem)] max-w-sm">
      <h2 className="text-4xl font-bold text-white mb-1 text-center">Season</h2>
      <p className="text-xs text-slate-400 mb-6 text-center">{thruText}</p>

      {/* Season-end note — remove next season and restore the Scoring dropdown below */}
      <div className="md:hidden bg-slate-800 rounded-xl border border-slate-700 px-5 py-4 mx-6 mb-10">
        <p className="text-white text-sm text-center leading-relaxed">
          Congrats to Phil. Everyone is impressed. Next season starts October 1st.
        </p>
      </div>

      {/* Standings */}
      <div className="flex flex-col gap-5 mb-14 px-8">
        {standings.map((row, i) => (
          <div key={row.name} className="flex justify-between items-center">
            <span className="text-white text-3xl font-medium">
              {row.name}
              {["🥇", "🥈", "🥉", "💩"][i] && (
                <span className="ml-2">{["🥇", "🥈", "🥉", "💩"][i]}</span>
              )}
            </span>
            <span className="text-3xl font-bold tabular-nums text-white">{row.points}</span>
          </div>
        ))}
      </div>

      {/* Scoring — hidden during the season-end note; restore next season */}
      <details className="hidden md:block bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mx-10">
        <summary className="px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-white cursor-pointer select-none list-none flex justify-between items-center">
          Scoring
          <span className="text-slate-400 text-base">›</span>
        </summary>
        <div className="border-t border-slate-700">
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
      </details>
    </div>
  );
}
