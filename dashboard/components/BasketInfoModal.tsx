"use client";

import { useState, useEffect } from "react";
import { BASKET_INFO, DEMAND_INFO } from "@/lib/supply-chain-info";

interface Props {
  type: "basket" | "demand";
  basketKey: string;
  onClose: () => void;
}

export function BasketInfoModal({ type, basketKey, onClose }: Props) {
  const info = type === "basket" ? BASKET_INFO[basketKey] : DEMAND_INFO[basketKey];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!info) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-slate-900 border border-slate-700/60 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-sm"
        >
          ✕
        </button>

        {/* Header */}
        <h3 className="text-base font-bold text-white pr-8 leading-snug">{info.label}</h3>
        <p className="text-xs text-sky-400 font-semibold mt-0.5 mb-3">
          {type === "basket" ? "供應鏈籃子" : "需求指數"} · 組成說明
        </p>
        <p className="text-sm text-slate-400 leading-relaxed mb-5">{info.description}</p>

        {/* Stocks */}
        <p className="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-2">成份股 / 成份 ETF</p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700/60">
                <th className="text-left text-slate-500 font-medium py-1.5 px-2">代碼</th>
                <th className="text-left text-slate-500 font-medium py-1.5 px-2">名稱</th>
                <th className="text-left text-slate-500 font-medium py-1.5 px-2 whitespace-nowrap">權重</th>
                <th className="text-left text-slate-500 font-medium py-1.5 px-2">說明</th>
              </tr>
            </thead>
            <tbody>
              {info.stocks.map((s) => (
                <tr key={s.ticker} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                  <td className="py-1.5 px-2">
                    <span className="font-mono text-[11px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded">
                      {s.ticker}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 font-medium text-slate-200">{s.name}</td>
                  <td className="py-1.5 px-2 text-sky-400 whitespace-nowrap">{s.weight}</td>
                  <td className="py-1.5 px-2 text-slate-400 text-[11px]">{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Method */}
        <p className="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-2">加權方式</p>
        <div className="bg-black/30 border border-slate-700/40 rounded-lg px-3 py-2 text-xs text-slate-300 mb-4">
          {info.method}
        </div>

        {/* Formula */}
        <p className="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-2">指數計算公式</p>
        <div className="bg-black/30 border border-slate-700/40 rounded-lg px-3 py-2 text-xs text-slate-300 mb-4 font-mono leading-relaxed whitespace-pre-line">
          {info.formula}
        </div>

        {/* Source */}
        <p className="text-[11px] text-slate-500 border-t border-slate-800/60 pt-3">
          📂 資料來源：{info.source}
        </p>
      </div>
    </div>
  );
}

interface InfoButtonProps {
  type: "basket" | "demand";
  basketKey: string;
}

export function InfoButton({ type, basketKey }: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  const hasInfo = type === "basket" ? !!BASKET_INFO[basketKey] : !!DEMAND_INFO[basketKey];
  if (!hasInfo) return null;

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="查看指數組成說明"
        className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-sky-400/40 text-sky-400 hover:bg-sky-400/20 hover:border-sky-400 transition-all leading-none flex-shrink-0 align-middle"
      >
        ⓘ
      </button>
      {open && (
        <BasketInfoModal type={type} basketKey={basketKey} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
