import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const RAPIDAPI_HOST = "live-golf-data.p.rapidapi.com";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const orgId = searchParams.get("orgId") ?? "1";
  const tournId = searchParams.get("tournId") ?? "";
  const year = searchParams.get("year") ?? "2026";

  if (!tournId) {
    return NextResponse.json({ rows: [] });
  }

  try {
    const res = await fetch(
      `https://${RAPIDAPI_HOST}/leaderboard?orgId=${orgId}&tournId=${tournId}&year=${year}`,
      {
        headers: {
          "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "",
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
        next: { revalidate: 120 }, // cache 2 minutes
      }
    );

    const data = await res.json();

    if (!data.leaderboardRows) {
      return NextResponse.json({ rows: [] });
    }

    const rows = (data.leaderboardRows as Record<string, unknown>[]).map((p) => ({
      playerId: String(p.playerId ?? ""),
      player: `${p.firstName} ${p.lastName}`,
      score: p.total ?? "-",
      pos: p.position ?? "",
      status: String(p.status ?? "active").toLowerCase(),
    }));

    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
