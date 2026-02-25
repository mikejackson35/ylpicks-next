import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await pool.query(
    `SELECT "Player", "Events", "SG Putt", "SG ARG", "SG APP", "SG OTT", "SG T2G", "SG Total"
     FROM research ORDER BY "SG T2G" DESC NULLS LAST`
  );

  return NextResponse.json({ rows: res.rows });
}
