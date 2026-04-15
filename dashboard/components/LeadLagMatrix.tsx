"use client";

import type { BasketGroup, DemandGroup, LeadLagPair } from "@/lib/types";

interface Props {
  demandGroups: Record<string, DemandGroup>;
  baskets: Record<string, BasketGroup>;
  leadLag: Record<string, LeadLagPair>;
  mode: "lag" | "corr";
}

const DEMAND_SHORT: Record<string, string> = {
  consumer_electronics: "消費電子",
  cloud_hyperscaler: "雲端",
  ai_compute: "AI 算力",
};

function lagCellStyle(v: number): { bg: string; text: string } {
  if (v > 6)  return { bg: "rgba(74,222,128,.2)",  text: "#4ade80" };
  if (v > 2)  return { bg: "rgba(74,222,128,.1)",  text: "#86efac" };
  if (v >= -2) return { bg: "rgba(139,92,246,.15)", text: "#a78bfa" };
  if (v >= -6) return { bg: "rgba(245,158,11,.12)", text: "#fbbf24" };
  return         { bg: "rgba(245,158,11,.22)",  text: "#f59e0b" };
}

function corrCellStyle(v: number): { bg: string; text: string } {
  if (v > 0.6)  return { bg: "rgba(74,222,128,.2)",  text: "#4ade80" };
  if (v > 0.4)  return { bg: "rgba(74,222,128,.1)",  text: "#86efac" };
  if (v > 0.25) return { bg: "rgba(56,189,248,.12)", text: "#7dd3fc" };
  return          { bg: "rgba(71,85,105,.2)",   text: "#94a3b8" };
}

export function LeadLagMatrix({ demandGroups, baskets, leadLag, mode }: Props) {
  const demandKeys = Object.keys(demandGroups);
  const basketKeys = Object.keys(baskets);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border-b border-slate-700/60 pb-2 text-left text-slate-500 font-medium pr-3">
              供應鏈籃子
            </th>
            {demandKeys.map((dk) => (
              <th
                key={dk}
                className="border-b border-slate-700/60 pb-2 text-center text-slate-400 font-medium px-2"
              >
                {DEMAND_SHORT[dk] ?? dk}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {basketKeys.map((bk) => (
            <tr key={bk} className="hover:bg-slate-800/30">
              <td className="py-2 pr-3 text-slate-400 text-xs whitespace-nowrap">
                {baskets[bk].label}
              </td>
              {demandKeys.map((dk) => {
                const pair = leadLag[`${dk}_vs_${bk}`];
                if (!pair?.summary) {
                  return <td key={dk} className="py-2 px-2 text-center text-slate-600">—</td>;
                }
                const v = mode === "lag" ? pair.summary.avg_lag : pair.summary.avg_corr;
                const style = mode === "lag" ? lagCellStyle(v) : corrCellStyle(v);
                const label =
                  mode === "lag"
                    ? v > 0 ? `+${v.toFixed(0)}w` : v < 0 ? `${v.toFixed(0)}w` : "0w"
                    : v.toFixed(2);
                return (
                  <td key={dk} className="py-2 px-2 text-center">
                    <span
                      className="inline-block rounded px-1.5 py-0.5 font-semibold tabular-nums"
                      style={{ background: style.bg, color: style.text }}
                    >
                      {label}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
