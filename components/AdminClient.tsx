"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tournament = { tournament_id: string; name: string; start_time: string };
type Player = { player_id: string; name: string };

export default function AdminClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tiersByTournament, setTiersByTournament] = useState<
    Record<string, Record<number, string[]>>
  >({});
  const [selectedTid, setSelectedTid] = useState<string>("");
  const [tierSelections, setTierSelections] = useState<Record<number, Set<string>>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/tiers")
      .then((r) => r.json())
      .then((data) => {
        const tourns: Tournament[] = data.tournaments ?? [];
        setTournaments(tourns);
        setPlayers(data.players ?? []);
        setTiersByTournament(data.tiersByTournament ?? {});

        // Default to current/upcoming tournament
        const now = new Date();
        const current = tourns.find(
          (t) => new Date(t.start_time).getTime() + 4 * 86400000 > now.getTime()
        );
        const defaultTid = current?.tournament_id ?? tourns[tourns.length - 1]?.tournament_id ?? "";
        setSelectedTid(defaultTid);
        loadTierSelectionsForTournament(defaultTid, data.tiersByTournament ?? {});
        setLoading(false);
      });
  }, []);

  function loadTierSelectionsForTournament(
    tid: string,
    tbt: Record<string, Record<number, string[]>>
  ) {
    const existing = tbt[tid] ?? {};
    const sels: Record<number, Set<string>> = {};
    for (let i = 1; i <= 6; i++) {
      sels[i] = new Set(existing[i] ?? []);
    }
    setTierSelections(sels);
  }

  function handleTournamentChange(tid: string) {
    setSelectedTid(tid);
    loadTierSelectionsForTournament(tid, tiersByTournament);
    setMessage(null);
  }

  function togglePlayer(tier: number, playerId: string) {
    setTierSelections((prev) => {
      const next = { ...prev };
      const tierSet = new Set(prev[tier]);
      tierSet.has(playerId) ? tierSet.delete(playerId) : tierSet.add(playerId);
      next[tier] = tierSet;
      return next;
    });
  }

  async function handleSaveTiers() {
    setSaving(true);
    setMessage(null);

    const tiers: Record<string, string[]> = {};
    for (let i = 1; i <= 6; i++) {
      tiers[i] = [...(tierSelections[i] ?? [])];
    }

    const res = await fetch("/api/admin/tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: selectedTid, tiers }),
    });

    setSaving(false);
    if (res.ok) {
      setMessage({ type: "success", text: "✅ Tiers saved!" });
      // Refresh local cache
      setTiersByTournament((prev) => ({ ...prev, [selectedTid]: tiers as unknown as Record<number, string[]> }));
      router.refresh();
    } else {
      const err = await res.json();
      setMessage({ type: "error", text: err.error ?? "Failed to save" });
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    setMessage(null);

    const res = await fetch("/api/admin/finalize", { method: "POST" });
    const data = await res.json();
    setFinalizing(false);

    if (data.ok) {
      setMessage({ type: "success", text: `✅ ${data.message}` });
      router.refresh();
    } else {
      setMessage({ type: "error", text: data.message ?? "Finalization failed" });
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">Admin</h2>

      {/* Finalize button */}
      <div className="mb-6">
        <button
          onClick={handleFinalize}
          disabled={finalizing}
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
        >
          {finalizing ? "Finalizing…" : "🔄 Finalize Last Tournament"}
        </button>
      </div>

      <h3 className="font-semibold text-sm mb-3">Set Up Tiers</h3>

      {/* Tournament selector */}
      <div className="mb-4">
        <select
          value={selectedTid}
          onChange={(e) => handleTournamentChange(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          {tournaments.map((t) => (
            <option key={t.tournament_id} value={t.tournament_id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tier multiselect */}
      <div className="flex flex-col gap-4">
        {[1, 2, 3, 4, 5, 6].map((tier) => {
          const selected = tierSelections[tier] ?? new Set();
          const selectedCount = selected.size;

          return (
            <div key={tier}>
              <p className="text-sm font-medium mb-1">
                Tier {tier}{" "}
                <span className="text-gray-400 font-normal">({selectedCount} players)</span>
              </p>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded p-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                {players.map((p) => (
                  <label
                    key={p.player_id}
                    className="flex items-center gap-1.5 cursor-pointer text-xs py-0.5 hover:text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.player_id)}
                      onChange={() => togglePlayer(tier, p.player_id)}
                      className="rounded"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSaveTiers}
        disabled={saving}
        className="mt-5 bg-gray-900 text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-40"
      >
        {saving ? "Saving…" : "💾 Save Tiers"}
      </button>

      {message && (
        <p
          className={`mt-3 text-sm ${
            message.type === "success" ? "text-green-600" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
