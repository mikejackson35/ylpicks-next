import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

const INIT = `CREATE TABLE IF NOT EXISTS desktop_visits (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  visited_at TIMESTAMPTZ DEFAULT NOW()
)`;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) return NextResponse.json({ ok: false }, { status: 401 });

  await pool.query(INIT);
  await pool.query(`INSERT INTO desktop_visits (username) VALUES ($1)`, [session.user.username]);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ ok: false }, { status: 403 });

  await pool.query(INIT);
  const res = await pool.query<{ username: string; visited_at: string }>(
    `SELECT username, visited_at FROM desktop_visits ORDER BY visited_at DESC`
  );

  return NextResponse.json({ visits: res.rows });
}
