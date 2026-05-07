"use client";

import { useEffect, useState } from "react";
import { DemandPulse } from "@/components/DemandPulse";
import { LeadLagMatrix } from "@/components/LeadLagMatrix";
import { BasketMomentum } from "@/components/BasketMomentum";
import { SupplyChainFlow } from "@/components/SupplyChainFlow";
import { NarrativeTimeline } from "@/components/NarrativeTimeline";
import { TimeRangeSlider } from "@/components/TimeRangeSlider";
import type { SupplyChainData, LeadLagPair } from "@/lib/types";

const DEMAND_LABELS: Record<string, string> = {
  consumer_electronics: "消費電子",
  cloud_hyperscaler: "雲端超大規模",
  ai_compute: "AI 算力",
};

const DEMO_MESSAGE =
  "尚未載入 supply_chain_data.json。請執行 python main.py supply-chain all 並重整頁面。";

export default function SupplyChainPage() {
  const [data, setData] = useState<SupplyChainData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDemand, setActiveDemand] = useState<string>("ai_compute");
  const [activeBasket, setActiveBasket] = useState<string>("A_foundry");
  const [matrixMode, setMatrixMode] = useState<"lag" | "corr">("lag");

  // Time range (indices into data.weeks)
  const [rangeStart, setRangeStart] = useState<number>(0);
  const [rangeEnd, setRangeEnd] = useState<number>(0);

  useEffect(() => {
    fetch("/api/supply-chain")
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json() as Promise<SupplyChainData>;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  // Initialise range when data loads
  useEffect(() => {
    if (!data) return;
    const total = data.weeks.length;
    const defaultStart = Math.max(0, total - 1 - Math.round(3 * 52.18));
    setRangeStart(defaultStart);
    setRangeEnd(total - 1);
  }, [data]);

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-2xl border border-amber-500/40 bg-slate-900/80 p-8">
          <h1 className="text-xl font-semibold text-amber-200">供應鏈資料未就緒</h1>
          <p className="mt-3 text-slate-300">{DEMO_MESSAGE}</p>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-400">
            {`python main.py supply-chain fetch\npython main.py supply-chain export`}
          </pre>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">載入中...</p>
      </main>
    );
  }

  const demandKeys = Object.keys(data.demand_groups);
  const basketKeys = Object.keys(data.baskets);

  const activePair: LeadLagPair | null =
    data.lead_lag[`${activeDemand}_vs_${activeBasket}`] ?? null;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* Header */}
        <header>
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                US Tech Demand Pulse
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                美國科技巨頭需求 → 台灣 / 亞洲供應鏈傳導系統
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/shortage-radar"
                className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-300 hover:bg-orange-500/20 transition-colors"
              >
                Shortage Radar →
              </a>
              <a href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors self-center">
                ← 宏觀溫度看板
              </a>
            </div>
          </div>
        </header>

        {/* Sticky Time Range Slider */}
        <TimeRangeSlider
          totalWeeks={data.weeks.length}
          weeks={data.weeks}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onChange={(s, e) => { setRangeStart(s); setRangeEnd(e); }}
        />

        {/* 1. Demand Pulse */}
        <DemandPulse
          demandGroups={data.demand_groups}
          latestWeek={data.weeks[rangeEnd] ?? data.latest_week}
          rangeEnd={rangeEnd}
        />

        {/* 2. Lead-Lag Matrix + Basket Momentum */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-sky-400">
                {matrixMode === "lag" ? "最佳領先週數" : "最大相關係數"}
              </h2>
              <div className="flex gap-1">
                {(["lag", "corr"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMatrixMode(m)}
                    className={`rounded px-2 py-0.5 text-xs transition-colors ${
                      matrixMode === m
                        ? "bg-sky-500 text-slate-950 font-semibold"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {m === "lag" ? "領先週數" : "相關係數"}
                  </button>
                ))}
              </div>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              {matrixMode === "lag"
                ? "正值 = 美股需求指數領先台灣供應鏈；負值 = 台股先行"
                : "組合值越大兩者動向越趨同強"}
            </p>
            <LeadLagMatrix
              demandGroups={data.demand_groups}
              baskets={data.baskets}
              leadLag={data.lead_lag}
              mode={matrixMode}
            />
          </div>

          {/* 3. Basket Momentum */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
            <h2 className="mb-1 text-sm font-semibold text-sky-400">
              供應鏈籃子近 13 週動能
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              正值 = 向上動能，負值 = 向下動能 · 點擊{" "}
              <span className="text-sky-400">ⓘ</span> 查看指數組成
            </p>
            <BasketMomentum baskets={data.baskets} rangeEnd={rangeEnd} />
          </div>
        </div>

        {/* 4. AI Amplifier Chain */}
        {data.amplifier_chain && data.amplifier_chain.length > 0 && (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
            <h2 className="mb-2 text-sm font-semibold text-sky-400">
              AI 算力需求傳導鏈
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              從 NVDA 算力需求到電力基礎設施的完整傳導路徑。節點顏色 = 近期動能；數字 = 相對 NVDA 的平均領先/落後週數。
            </p>
            <SupplyChainFlow chain={data.amplifier_chain} />
          </div>
        )}

        {/* 5. Narrative Timeline */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold text-sky-400">人話時間線</h2>

          {/* Demand selector */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">需求主題：</span>
            {demandKeys.map((dk) => (
              <button
                key={dk}
                onClick={() => setActiveDemand(dk)}
                className={`rounded-full px-3 py-0.5 text-xs transition-colors ${
                  activeDemand === dk
                    ? "bg-sky-500 text-slate-950 font-semibold"
                    : "border border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {DEMAND_LABELS[dk] ?? dk}
              </button>
            ))}
          </div>

          {/* Basket selector */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">供應鏈籃子：</span>
            {basketKeys.map((bk) => (
              <button
                key={bk}
                onClick={() => setActiveBasket(bk)}
                className={`rounded-full px-3 py-0.5 text-xs transition-colors ${
                  activeBasket === bk
                    ? "bg-sky-500 text-slate-950 font-semibold"
                    : "border border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {data.baskets[bk]?.label ?? bk}
              </button>
            ))}
          </div>

          <NarrativeTimeline
            pair={activePair}
            demandLabel={
              data.demand_groups[activeDemand]?.label ??
              DEMAND_LABELS[activeDemand] ??
              activeDemand
            }
            basketLabel={data.baskets[activeBasket]?.label ?? activeBasket}
            weeks={data.weeks}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
          />
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-800/60 pt-6">
          <details className="group">
            <summary className="cursor-pointer select-none text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 list-none">
              <span className="inline-block transition-transform group-open:rotate-90">▶</span>
              更新資料
            </summary>
            <div className="mt-3 space-y-2 text-xs text-slate-500">
              <p>
                執行：
                <code className="rounded bg-slate-800/80 px-1 py-0.5 text-slate-400 ml-1">
                  python main.py supply-chain all
                </code>
                然後重新整理此頁面。
              </p>
              <p>資料來源：Yahoo Finance（台股 .TW、美股）；回測範圍 2016 年至今。</p>
              <p className="text-slate-600">僅供研究用途，不構成任何投資建議。</p>
            </div>
          </details>
        </footer>
      </div>
    </main>
  );
}
