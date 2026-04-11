import { Pool, PoolClient } from "pg";
import { generateRecap } from "./generate-recap";

const RAPIDAPI_HOST = "live-golf-data.p.rapidapi.com";

function parseScore(s: string | null | undefined): number {
  if (!s || s === "-") return 999;
  if (s === "E") return 0;
  try { return parseInt(s.replace("+", ""), 10); } catch { return 999; }
}

type Tournament = {
  tournament_id: string;
  name: string;
  org_id?: string;
  tourn_id?: string;
  year?: string;
};

async function fetchLeaderboard(
  apiKey: string,
  orgId: string,
  tournId: string,
  year: string
): Promise<{ playerId: string; player: string; score: string; position: string; status: string }[]> {
  const res = await fetch(
    `https://${RAPIDAPI_HOST}/leaderboard?orgId=${orgId}&tournId=${tournId}&year=${year}`,
    {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    }
  );
  const data = await res.json();
  if (!data.leaderboardRows) throw new Error("No leaderboardRows in API response");

  return (data.leaderboardRows as Record<string, unknown>[]).map((p) => ({
    playerId: String(p.playerId ?? ""),
    player: `${p.firstName} ${p.lastName}`,
    score: String(p.total ?? "-"),
    position: String(p.position ?? ""),
    status: String(p.status ?? "active").toLowerCase(),
  }));
}

export async function finalizeTournament(
  pool: Pool,
  tournament: Tournament,
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  const { tournament_id, name, org_id, tourn_id, year } = tournament;
  const orgId = org_id ?? "1";
  const tournYear = year ?? "2026";

  if (!tourn_id) {
    return { ok: false, message: `No tourn_id set for ${tournament_id} — update tournaments first.` };
  }

  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- Step 1: Fetch & cache leaderboard if not cached ---
    const cacheRes = await client.query<{
      player_id: string; player_name: string; score_to_par: string; status: string;
    }>(
      "SELECT player_id, player_name, score_to_par, status FROM player_score_cache WHERE tournament_id = $1",
      [tournament_id]
    );

    let cachedRows = cacheRes.rows;

    if (cachedRows.length === 0) {
      const lb = await fetchLeaderboard(apiKey, orgId, tourn_id, tournYear);
      if (lb.length === 0) {
        await client.query("ROLLBACK");
        return { ok: false, message: `API returned empty leaderboard for ${tournament_id}.` };
      }

      for (const row of lb) {
        await client.query(
          `INSERT INTO player_score_cache
             (tournament_id, player_id, player_name, position, score_to_par, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tournament_id, player_id) DO NOTHING`,
          [tournament_id, row.playerId, row.player, row.position, row.score, row.status]
        );
      }

      const refreshed = await client.query<{
        player_id: string; player_name: string; score_to_par: string; status: string;
      }>(
        "SELECT player_id, player_name, score_to_par, status FROM player_score_cache WHERE tournament_id = $1",
        [tournament_id]
      );
      cachedRows = refreshed.rows;
    }

    // --- Step 2: Build score & cut lookups ---
    const scoreLookup: Record<string, number> = {};
    const cutStatus: Record<string, boolean> = {};
    const scoreText: Record<string, string> = {};

    for (const row of cachedRows) {
      const pid = String(row.player_id);
      scoreLookup[pid] = parseScore(row.score_to_par);
      cutStatus[pid] = String(row.status).toLowerCase() === "cut";
      scoreText[pid] = row.score_to_par ?? "";
    }

    // --- Step 3: Get users and their picks ---
    const usersRes = await client.query<{ username: string }>("SELECT username FROM users");
    const allUsers = usersRes.rows.map((r) => r.username);

    const picksRes = await client.query<{ username: string; tier_number: number; player_id: string }>(
      "SELECT username, tier_number, player_id FROM picks WHERE tournament_id = $1",
      [tournament_id]
    );
    const allPicks = picksRes.rows;

    // --- Step 4: Find tier winners among picked players ---
    const pickedByTier: Record<number, Set<string>> = {};
    for (const pick of allPicks) {
      const t = Number(pick.tier_number);
      const pid = String(pick.player_id);
      if (!pickedByTier[t]) pickedByTier[t] = new Set();
      pickedByTier[t].add(pid);
    }

    const tierWinners: Record<number, Set<string>> = {};
    for (const [tierStr, pids] of Object.entries(pickedByTier)) {
      const tier = Number(tierStr);
      const activePids = [...pids].filter((pid) => !cutStatus[pid]);
      const scores = activePids.map((pid) => scoreLookup[pid] ?? 999);
      const best = Math.min(...scores);
      if (best !== 999) {
        tierWinners[tier] = new Set(activePids.filter((pid) => (scoreLookup[pid] ?? 999) === best));
      }
    }

    // --- Step 5: Calculate team scores ---
    const userTeamScores: Record<string, number> = {};
    for (const uname of allUsers) {
      const userPicks = allPicks.filter((p) => p.username === uname);
      if (userPicks.length === 0) { userTeamScores[uname] = 999; continue; }
      const validScores = userPicks
        .map((p) => scoreLookup[String(p.player_id)] ?? 999)
        .filter((s) => s !== 999);
      userTeamScores[uname] = validScores.length > 0
        ? validScores.reduce((a, b) => a + b, 0)
        : 999;
    }

    const validTeamScores = Object.values(userTeamScores).filter((s) => s !== 999);
    const bestTeamScore = validTeamScores.length > 0 ? Math.min(...validTeamScores) : 999;

    // --- Step 6: Score each pick ---
    for (const pick of allPicks) {
      const uname = pick.username;
      const tierNumber = Number(pick.tier_number);
      const playerId = String(pick.player_id);

      const isTierWinner = tierWinners[tierNumber]?.has(playerId) ?? false;
      const isMissedCut = cutStatus[playerId] ?? false;

      let points = 0;
      if (isTierWinner) points += 1;
      if (isMissedCut) points -= 1;

      const pickScoresId = `${tournament_id}_${uname}_${tierNumber}`;
      await client.query(
        `INSERT INTO pick_scores
           (tiers_results_id, pick_scores_id, tournament_id, username, tier_number, player_id, points, tier_winner, missed_cut, player_score)
         VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (tiers_results_id) DO UPDATE SET
           pick_scores_id = EXCLUDED.pick_scores_id,
           points = EXCLUDED.points,
           tier_winner = EXCLUDED.tier_winner,
           missed_cut = EXCLUDED.missed_cut,
           player_score = EXCLUDED.player_score`,
        [pickScoresId, tournament_id, uname, tierNumber, playerId, points, isTierWinner, isMissedCut, scoreText[playerId] ?? ""]
      );
    }

    // --- Step 7: Write tournament_scores ---
    for (const uname of allUsers) {
      const totalRes = await client.query<{ total_points: number }>(
        "SELECT COALESCE(SUM(points), 0) as total_points FROM pick_scores WHERE tournament_id=$1 AND username=$2",
        [tournament_id, uname]
      );
      let totalPoints = Number(totalRes.rows[0]?.total_points ?? 0);

      if (userTeamScores[uname] === bestTeamScore && bestTeamScore !== 999) {
        totalPoints += 1;
      }

      const tournScoresId = `${tournament_id}_${uname}`;
      await client.query(
        `INSERT INTO tournament_scores (weekly_results_id, tournament_id, username, points, tournament_scores_id)
         VALUES ($4,$1,$2,$3,$4)
         ON CONFLICT (weekly_results_id) DO UPDATE SET points = EXCLUDED.points`,
        [tournament_id, uname, totalPoints, tournScoresId]
      );
    }

    // --- Step 8: Mark finalized ---
    await client.query(
      "UPDATE tournaments SET is_finalized = TRUE, finalized_at = NOW() WHERE tournament_id = $1",
      [tournament_id]
    );

    await client.query("COMMIT");

    // --- Step 9: Generate AI recap (outside transaction — failure won't roll back finalization) ---
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      generateRecap(pool, tournament_id, anthropicKey).catch((err) => {
        console.error("Blog recap generation failed (non-fatal):", err);
      });
    }

    return { ok: true, message: `${name} finalized successfully.` };
  } catch (err) {
    await client.query("ROLLBACK");
    return { ok: false, message: `Error finalizing ${tournament_id}: ${err}` };
  } finally {
    client.release();
  }
}
