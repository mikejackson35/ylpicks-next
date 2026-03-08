import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { USER_BIOS } from "./user-bios";

export async function generateRecap(
  pool: Pool,
  tournament_id: string,
  anthropicKey: string
): Promise<void> {
  // --- Query tournament name ---
  const tournRes = await pool.query<{ name: string }>(
    "SELECT name FROM tournaments WHERE tournament_id = $1",
    [tournament_id]
  );
  const tournamentName = tournRes.rows[0]?.name ?? tournament_id;

  // --- Query picks with player names and scores ---
  const picksRes = await pool.query<{
    username: string;
    display_name: string;
    tier_number: number;
    player_name: string;
    points: number;
    tier_winner: boolean;
    missed_cut: boolean;
    player_score: string;
  }>(
    `SELECT p.username, u.name as display_name, p.tier_number,
            pl.name as player_name,
            ps.points, ps.tier_winner, ps.missed_cut, ps.player_score
     FROM picks p
     JOIN users u ON u.username = p.username
     JOIN players pl ON CAST(pl.player_id AS TEXT) = CAST(p.player_id AS TEXT)
     LEFT JOIN pick_scores ps
       ON ps.tournament_id = p.tournament_id
      AND ps.username = p.username
      AND ps.tier_number = p.tier_number
     WHERE p.tournament_id = $1
     ORDER BY p.username, p.tier_number`,
    [tournament_id]
  );

  // --- Query points this tournament ---
  const weeklyRes = await pool.query<{ username: string; display_name: string; points: number }>(
    `SELECT ts.username, u.name as display_name, ts.points
     FROM tournament_scores ts
     JOIN users u ON u.username = ts.username
     WHERE ts.tournament_id = $1
     ORDER BY ts.points DESC`,
    [tournament_id]
  );

  // --- Query season standings ---
  const standingsRes = await pool.query<{ display_name: string; season_points: number }>(
    `SELECT u.name as display_name, COALESCE(SUM(ts.points), 0) as season_points
     FROM users u
     LEFT JOIN tournament_scores ts ON ts.username = u.username
     GROUP BY u.username, u.name
     ORDER BY season_points DESC`
  );

  // --- Build picks section ---
  const picksByUser: Record<string, typeof picksRes.rows> = {};
  for (const row of picksRes.rows) {
    if (!picksByUser[row.username]) picksByUser[row.username] = [];
    picksByUser[row.username].push(row);
  }

  const picksSection = Object.entries(picksByUser).map(([username, picks]) => {
    const displayName = picks[0]?.display_name ?? username;
    const pickLines = picks.map((p) => {
      const score = p.player_score || "?";
      const flags = [
        p.tier_winner ? "TIER WINNER" : null,
        p.missed_cut ? "MISSED CUT" : null,
      ].filter(Boolean).join(", ");
      return `  Tier ${p.tier_number}: ${p.player_name} (${score})${flags ? ` [${flags}]` : ""}`;
    });
    return `${displayName}:\n${pickLines.join("\n")}`;
  }).join("\n\n");

  // --- Build weekly points section ---
  const weeklySection = weeklyRes.rows
    .map((r) => `${r.display_name}: ${r.points} pts`)
    .join("\n");

  // --- Build season standings section ---
  const standingsSection = standingsRes.rows
    .map((r, i) => `${i + 1}. ${r.display_name}: ${r.season_points} pts`)
    .join("\n");

  // --- Build bios section ---
  const biosSection = Object.entries(USER_BIOS)
    .map(([username, bio]) => {
      const displayName = picksRes.rows.find((r) => r.username === username)?.display_name ?? username;
      return `${displayName}:\n${bio}`;
    })
    .join("\n\n");

  // --- Build prompt ---
  const prompt = `You are the AI commissioner of a 4-person golf picks league called "YL Picks". Write a weekly recap after the tournament results come in.

SCORING RULES:
- +1pt if your pick has the lowest score in their tier (among only the 4 picked players per tier)
- +1pt if your team has the best combined score across all 6 picks
- -1pt if any of your picks miss the cut

TOURNAMENT: ${tournamentName}

PICKS & RESULTS:
${picksSection}

POINTS THIS WEEK:
${weeklySection}

SEASON STANDINGS (after this tournament):
${standingsSection}

REAL-LIFE FACTS ABOUT EACH PLAYER (use these for jokes and light roasting):
${biosSection}

Write a 3-4 paragraph weekly recap. Requirements:
- Be funny and a little savage, but friendly — these are friends
- Reference specific picks, scores, tier winners, and missed cuts from this tournament
- Weave in season storylines and standings (who's climbing, who's fading)
- Use the real-life facts to make fun of people in a way that connects to their golf picks performance
- Fully lean into the "AI slop sports journalism" aesthetic — overwrought metaphors, unnecessary drama, fake gravitas
- Refer to players by their first name
- Do NOT use headers or bullet points — just flowing paragraphs`;

  // --- Call Claude API ---
  const client = new Anthropic({ apiKey: anthropicKey });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude API");
  const recap = content.text;

  // --- Save to blog_posts ---
  await pool.query(
    `INSERT INTO blog_posts (tournament_id, content, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (tournament_id) DO UPDATE SET content = EXCLUDED.content, created_at = NOW()`,
    [tournament_id, recap]
  );
}
