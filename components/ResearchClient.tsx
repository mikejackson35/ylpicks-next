"use client";

import { useEffect, useState } from "react";

type Row = { Player: string; Events: string | number; "SG Putt": string | number; "SG ARG": string | number; "SG APP": string | number; "SG OTT": string | number; "SG T2G": string | number; "SG Total": string | number };

const SG_COLS = ["SG Putt","SG ARG","SG APP","SG OTT","SG T2G","SG Total"] as const;
const LABELS: Record<string, string> = { "SG Putt":"Putt","SG ARG":"ARG","SG APP":"APP","SG OTT":"OTT","SG T2G":"T2G","SG Total":"Total" };

function num(v: unknown): number | null { if (v === null || v === undefined || v === "") return null; const n = parseFloat(String(v)); return isNaN(n) ? null : n; }
function fmt(v: unknown, ev = false): string { const n = num(v); if (n === null) return "-"; return ev ? String(Math.round(n)) : n.toFixed(2); }

function t2gBg(v: unknown): string {
  const n = num(v); if (n === null) return "";
  const c = Math.max(-4, Math.min(4, n));
  const ratio = (c + 4) / 8;
  let r, g;
  if (ratio < 0.5) { r = 220; g = Math.round(220 * ratio * 2); }
  else { r = Math.round(220 * (1 - (ratio - 0.5) * 2)); g = 160; }
  return `rgba(${r},${g},0,0.3)`;
}

export default function ResearchClient() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => { fetch("/api/research").then((r) => r.json()).then((d) => { setRows(d.rows ?? []); setLoading(false); }); }, []);

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 text-sm">
      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Research</h2>
      <p className="text-xs text-slate-400 mb-5">Strokes gained — last 6 months</p>
      {!rows.length ? <p className="text-sm text-slate-400">No data available.</p> : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-700">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase sticky left-0 bg-slate-900">Player</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-400 uppercase">Evts</th>
                {SG_COLS.map((c) => (
                  <th key={c} className={`px-4 py-2.5 text-center text-xs font-semibold uppercase ${c === "SG T2G" ? "text-emerald-400" : "text-slate-400"}`}>
                    {LABELS[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-700 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-white sticky left-0 bg-slate-800">{row.Player}</td>
                  <td className="px-4 py-2.5 text-center text-slate-400">{fmt(row.Events, true)}</td>
                  {SG_COLS.map((c) => {
                    const n = num(row[c]);
                    return (
                      <td key={c}
                        className={`px-4 py-2.5 text-center tabular-nums ${n !== null && n < 0 ? "text-red-400" : n !== null && n > 0 ? "text-emerald-400" : "text-slate-400"}`}
                        style={c === "SG T2G" ? { backgroundColor: t2gBg(row[c]) } : {}}
                      >
                        {fmt(row[c])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
