"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tournament = { tournament_id: string; name: string; start_time: string; locked: boolean };
type Player = { player_id: string; name: string };

const TIER_DOT: Record<number, string> = {
  1: "bg-slate-300", 2: "bg-black ring-1 ring-slate-500", 3: "bg-blue-500",
  4: "bg-fuchsia-400", 5: "bg-violet-500", 6: "bg-orange-400",
};

export default function MakePicksClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [playersByTier, setPlayersByTier] = useState<Record<number, Player[]>>({});
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/picks").then((r) => r.json()).then((data) => {
      setTournament(data.tournament);
      setPlayersByTier(data.playersByTier ?? {});
      const ep: Record<number, string> = {};
      Object.entries(data.existingPicks ?? {}).forEach(([k, v]) => { ep[parseInt(k, 10)] = v as string; });
      setPicks(ep);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    if (!tournament) return;
    setSaving(true); setMessage(null);
    const res = await fetch("/api/picks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: tournament.tournament_id, picks }),
    });
    setSaving(false);
    if (res.ok) { setMessage({ type: "success", text: "All picks saved!" }); router.refresh(); }
    else { const e = await res.json(); setMessage({ type: "error", text: e.error ?? "Failed to save" }); }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 text-sm">
      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );
  if (!tournament) return <p className="text-slate-400">No upcoming tournament available for picks.</p>;

  const missing = [1,2,3,4,5,6].filter((t) => !picks[t]);

  // Locked view
  if (tournament.locked) return (
    <div className="max-w-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Make Picks</h2>
        <p className="text-sm text-slate-400 mt-1">{tournament.name}</p>
      </div>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {[1,2,3,4,5,6].map((tier) => {
          const selected = (playersByTier[tier] ?? []).find((p) => p.player_id === picks[tier]);
          return (
            <div key={tier} className="flex items-center gap-4 px-4 py-4 border-b border-slate-700 last:border-0">
              <div className="flex items-center gap-2.5 w-14 shrink-0">
                <div className={`w-4 h-4 rounded-full ${TIER_DOT[tier]}`} />
                <span className="text-sm font-medium text-slate-400">T{tier}</span>
              </div>
              <span className={`text-sm ${selected ? "font-medium text-white" : "text-amber-400"}`}>
                {selected ? selected.name : "No pick submitted"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Open picks view
  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center justify-between md:block">
        <div>
          <h2 className="text-2xl font-bold text-white">Make Picks</h2>
          <p className="text-sm text-slate-400 mt-1">{tournament.name}</p>
        </div>
        {/* Save button in header — mobile only */}
        <button
          onClick={handleSave}
          disabled={saving || missing.length > 0}
          className="md:hidden bg-emerald-600 text-white rounded-xl px-5 py-2.5 text-base font-semibold hover:bg-emerald-500 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-5">
        {[1,2,3,4,5,6].map((tier) => {
          const players = playersByTier[tier] ?? [];
          const sel = picks[tier] ?? "";
          return (
            <div key={tier} className="flex items-center gap-4 px-4 py-4 border-b border-slate-700 last:border-0">
              <div className="flex items-center gap-2.5 w-14 shrink-0">
                <div className={`w-4 h-4 rounded-full ${TIER_DOT[tier]}`} />
                <span className="text-sm font-medium text-slate-400">T{tier}</span>
              </div>
              {players.length === 0 ? (
                <p className="text-sm text-slate-500">No players assigned</p>
              ) : (
                <select
                  value={sel}
                  onChange={(e) => setPicks((prev) => ({ ...prev, [tier]: e.target.value }))}
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— Select player —</option>
                  {players.map((p) => <option key={p.player_id} value={p.player_id}>{p.name}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {missing.length > 0 && (
        <p className="text-sm text-amber-400 bg-amber-950/50 border border-amber-800 rounded-lg px-3 py-2 mb-4">
          Missing: Tier {missing.join(", Tier ")}
        </p>
      )}

      {/* Save button below — desktop only */}
      <button
        onClick={handleSave}
        disabled={saving || missing.length > 0}
        className="hidden md:block bg-emerald-600 text-white rounded-lg px-6 py-2.5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40 transition-colors"
      >
        {saving ? "Saving..." : "Save Picks"}
      </button>

      {message && (
        <p className={`mt-3 text-sm px-3 py-2 rounded-lg border ${
          message.type === "success"
            ? "text-emerald-400 bg-emerald-950/50 border-emerald-800"
            : "text-red-400 bg-red-950/50 border-red-800"
        }`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
