import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await pool.query(
    `SELECT tournament_id, name, start_time, is_finalized, finalized_at, tourn_id, year
     FROM tournaments ORDER BY start_time DESC LIMIT 10`
  );

  return NextResponse.json({ tournaments: result.rows });
}
