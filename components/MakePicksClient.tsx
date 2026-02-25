"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tournament = { tournament_id: string; name: string; start_time: string; locked: boolean };
type Player = { player_id: string; name: string };

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

  if (loading) return <div className="flex items-center gap-2 text-slate-500 text-sm"><div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />Loading...</div>;
  if (!tournament) return <p className="text-slate-400">No upcoming tournament available for picks.</p>;

  const missing = [1,2,3,4,5,6].filter((t) => !picks[t]);

  if (tournament.locked) return (
    <div className="max-w-md">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Make Picks</h2>
      <p className="text-sm text-slate-500 mb-4">{tournament.name}</p>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-5">
        ⏰ Picks are locked — tournament has started
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {[1,2,3,4,5,6].map((tier) => {
          const selected = (playersByTier[tier] ?? []).find((p) => p.player_id === picks[tier]);
          return (
            <div key={tier} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
              <span className="text-xs font-semibold text-slate-400 uppercase w-12">Tier {tier}</span>
              <span className={`text-sm ${selected ? "font-medium text-slate-800" : "text-amber-500"}`}>
                {selected ? selected.name : "No pick submitted"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Make Picks</h2>
      <p className="text-sm text-slate-500 mb-6">{tournament.name}</p>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
        {[1,2,3,4,5,6].map((tier) => {
          const players = playersByTier[tier] ?? [];
          const sel = picks[tier] ?? "";
          return (
            <div key={tier} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
              <label className="text-xs font-semibold text-slate-400 uppercase w-12 shrink-0">Tier {tier}</label>
              {players.length === 0 ? (
                <p className="text-sm text-slate-400">No players assigned</p>
              ) : (
                <select value={sel} onChange={(e) => setPicks((prev) => ({ ...prev, [tier]: e.target.value }))}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  <option value="">— Select player —</option>
                  {players.map((p) => <option key={p.player_id} value={p.player_id}>{p.name}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {missing.length > 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          ⚠️ Missing: Tier {missing.join(", Tier ")}
        </p>
      )}

      <p className="text-xs text-slate-400 mb-3">Remember to save your picks!</p>

      <button onClick={handleSave} disabled={saving || missing.length > 0}
        className="bg-emerald-700 text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40 transition-colors">
        {saving ? "Saving..." : "💾 Save Picks"}
      </button>

      {message && (
        <p className={`mt-3 text-sm px-3 py-2 rounded-lg border ${message.type === "success" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-600 bg-red-50 border-red-200"}`}>
          {message.type === "success" ? "✅ " : "❌ "}{message.text}
        </p>
      )}
    </div>
  );
}
