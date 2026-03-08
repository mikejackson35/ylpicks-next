import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await pool.query<{
    tournament_id: string;
    content: string;
    created_at: string;
    tournament_name: string;
  }>(
    `SELECT bp.tournament_id, bp.content, bp.created_at, t.name as tournament_name
     FROM blog_posts bp
     JOIN tournaments t ON t.tournament_id = bp.tournament_id
     ORDER BY bp.created_at DESC`
  );

  return NextResponse.json({ posts: res.rows });
}
