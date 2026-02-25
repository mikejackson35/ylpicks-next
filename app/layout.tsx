import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "YL Picks",
  description: "Golf picks game",
};

async function getSeasonStandings() {
  try {
    const [scoresRes, usersRes, countRes] = await Promise.all([
      pool.query<{ username: string; total_points: number }>(
        "SELECT username, SUM(points) as total_points FROM tournament_scores GROUP BY username"
      ),
      pool.query<{ username: string; name: string }>(
        "SELECT username, name FROM users ORDER BY name"
      ),
      pool.query<{ total: string; done: string }>(
        "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_finalized = TRUE) as done FROM tournaments"
      ),
    ]);

    const nameMap: Record<string, string> = {};
    usersRes.rows.forEach((u) => (nameMap[u.username] = u.name));

    const pointsMap: Record<string, number> = {};
    usersRes.rows.forEach((u) => (pointsMap[u.username] = 0));
    scoresRes.rows.forEach(
      (r) => (pointsMap[r.username] = Number(r.total_points) || 0)
    );

    const standings = Object.entries(pointsMap)
      .map(([username, points]) => ({ name: nameMap[username], points }))
      .sort((a, b) => b.points - a.points);

    const { total, done } = countRes.rows[0];
    const thruText = `(thru ${done} of ${total})`;

    return { standings, thruText };
  } catch {
    return { standings: [], thruText: "" };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const { standings, thruText } = session
    ? await getSeasonStandings()
    : { standings: [], thruText: "" };

  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-white">
        <SessionProvider>
          {session ? (
            <div className="md:flex min-h-screen">
              <Sidebar standings={standings} thruText={thruText} />
              <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">{children}</main>
            </div>
          ) : (
            <main className="flex-1">{children}</main>
          )}
        </SessionProvider>
      </body>
    </html>
  );
}
