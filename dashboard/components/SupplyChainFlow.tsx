"use client";

import type { AmplifierNode } from "@/lib/types";

interface Props {
  chain: AmplifierNode[];
}

function nodeColor(node: AmplifierNode): string {
  if (!node.index) return "#8b9cb3";
  const arr = node.index.filter((v): v is number => v != null);
  if (arr.length < 14) return "#8b9cb3";
  const latest = arr[arr.length - 1];
  const prev = arr[arr.length - 14];
  if (!prev || prev === 0) return "#8b9cb3";
  const mom = (latest / prev - 1) * 100;
  if (mom > 5) return "#4ade80";
  if (mom > 0) return "#86efac";
  if (mom > -5) return "#f59e0b";
  return "#f87171";
}

export function SupplyChainFlow({ chain }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-stretch gap-0 min-w-[800px]">
        {chain.map((node, i) => {
          const color = nodeColor(node);
          const lagText =
            node.lag_vs_nvda != null
              ? node.lag_vs_nvda > 0
                ? `落後 ${node.lag_vs_nvda}w`
                : node.lag_vs_nvda < 0
                ? `領先 ${Math.abs(node.lag_vs_nvda)}w`
                : "同步"
              : null;

          return (
            <div key={node.id} className="flex items-center">
              <div
                className="flex-1 rounded-xl border p-3"
                style={{
                  minWidth: 120,
                  maxWidth: 160,
                  borderColor: color + "44",
                  background: "rgba(30,42,61,0.8)",
                }}
              >
                <div
                  className="mb-2 h-2 w-2 rounded-full"
                  style={{ background: color }}
                />
                <p className="text-xs font-semibold leading-snug text-slate-200">
                  {node.label}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {node.tickers.join(" · ")}
                </p>
                {lagText && (
                  <p
                    className="mt-1.5 text-[10px] tabular-nums font-semibold"
                    style={{ color }}
                  >
                    {lagText}
                  </p>
                )}
                {node.corr_vs_nvda != null && (
                  <p className="text-[10px] text-slate-500">
                    r = {node.corr_vs_nvda.toFixed(2)}
                  </p>
                )}
              </div>
              {i < chain.length - 1 && (
                <div className="shrink-0 px-2 text-sky-400 text-sm">→</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
