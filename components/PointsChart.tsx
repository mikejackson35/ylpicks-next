"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type User = { username: string; name: string };
type WeeklyScore = { tournament_id: string; username: string; points: number };
type Tournament = { tournament_id: string; name: string; start_time: string };

const USER_COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#f87171"];

function shortName(name: string): string {
  const words = name.replace(/ Open$| Championship$| Classic$| Invitational$| Masters$| Tournament$/, "").trim();
  return words.length > 14 ? words.slice(0, 13) + "…" : words;
}

export default function PointsChart({
  tournaments,
  users,
  weeklyScores,
}: {
  tournaments: Tournament[];
  users: User[];
  weeklyScores: WeeklyScore[];
}) {
  if (!tournaments.length || !users.length) return null;

  // Tournaments in chronological order (API returns DESC)
  const sorted = [...tournaments].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const weeklyMap: Record<string, Record<string, number>> = {};
  weeklyScores.forEach(({ tournament_id, username, points }) => {
    if (!weeklyMap[tournament_id]) weeklyMap[tournament_id] = {};
    weeklyMap[tournament_id][username] = Number(points);
  });

  // Build cumulative data points
  const cumulative: Record<string, number> = {};
  users.forEach((u) => (cumulative[u.username] = 0));

  const chartData = sorted.map((t) => {
    const entry: Record<string, string | number> = { week: shortName(t.name) };
    users.forEach((u) => {
      const pts = weeklyMap[t.tournament_id]?.[u.username] ?? 0;
      cumulative[u.username] += pts;
      entry[u.username] = cumulative[u.username];
    });
    return entry;
  });

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="week"
            interval={0}
            height={48}
            tick={(props: { x: number | string; y: number | string; index: number; payload: { value: string } }) => {
              const { x, y, index, payload } = props;
              const isFirst = index === 0;
              const isLast = index === chartData.length - 1;
              if (!isFirst && !isLast) return <g />;
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0} y={0} dy={12}
                    textAnchor={isFirst ? "start" : "end"}
                    fill="#94a3b8"
                    fontSize={10}
                  >
                    {payload.value}
                  </text>
                </g>
              );
            }}
          />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
            labelStyle={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: "#cbd5e1" }}
          />
          <Legend
            verticalAlign="top"
            align="center"
            formatter={(value) => {
              const u = users.find((u) => u.username === value);
              return <span style={{ color: "#cbd5e1", fontSize: 12 }}>{u?.name ?? value}</span>;
            }}
          />
          {users.map((u, i) => (
            <Line
              key={u.username}
              type="stepAfter"
              dataKey={u.username}
              stroke={USER_COLORS[i % USER_COLORS.length]}
              strokeWidth={1.5}
              dot={{ r: 2, fill: USER_COLORS[i % USER_COLORS.length] }}
              activeDot={{ r: 3.5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
