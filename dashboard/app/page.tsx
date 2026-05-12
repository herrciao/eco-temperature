import { ClientOnly } from "@/components/ClientOnly";
import { EmploymentPanel } from "@/components/EmploymentPanel";
import { FactorCards } from "@/components/FactorCards";
import { PanelTimeRangeSection } from "@/components/PanelTimeRangeSection";
import { RegimeHero } from "@/components/RegimeHero";
import {
  alignEventsToPanelWeeks,
  getVisibleEvents,
  mergeEventsOnSameDate,
} from "@/lib/events";
import { compute4WeekDeltas } from "@/lib/score-deltas";
import { loadDashboardData } from "@/lib/server-data";

/** Re-read JSON on each request after `python main.py export`. */
export const dynamic = "force-dynamic";

function prepareEvents(panel: ReturnType<typeof loadDashboardData>["panel"]) {
  const raw = getVisibleEvents(panel);
  const aligned = alignEventsToPanelWeeks(panel, raw);
  return mergeEventsOnSameDate(aligned);
}

export default async function Home() {
  let data: Awaited<ReturnType<typeof loadDashboardData>> | null = null;
  let error: string | null = null;
  try {
    data = loadDashboardData();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-2xl border border-amber-500/40 bg-slate-900/80 p-8">
          <h1 className="text-xl font-semibold text-amber-200">無法載入看板資料</h1>
          <p className="mt-3 text-slate-300">{error}</p>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-400">
            {`cd ..   # project root
python main.py score
python main.py export
cd dashboard && npm run dev`}
          </pre>
        </div>
      </main>
    );
  }

  const deltas = compute4WeekDeltas(data.panel);
  const chartEvents = prepareEvents(data.panel);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <header>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                宏觀溫度看板
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                整合成長、通膨、流動性與風險偏好，提供宏觀環境的一站式概覽。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/supply-chain"
                className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 hover:bg-sky-500/20 transition-colors"
              >
                供應鏈傳導系統 →
              </a>
              <a
                href="/shortage-radar"
                className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm text-orange-300 hover:bg-orange-500/20 transition-colors"
              >
                Shortage Radar →
              </a>
            </div>
          </div>
        </header>

        <RegimeHero current={data.current} deltas={deltas} />

        <FactorCards current={data.current} deltas={deltas} panel={data.panel} />

        <EmploymentPanel rows={data.employment} />

        <ClientOnly
          fallback={
            <div className="min-h-[1200px] rounded-2xl border border-slate-700/60 bg-slate-900/30" />
          }
        >
          <PanelTimeRangeSection panel={data.panel} events={chartEvents} />
        </ClientOnly>

        {/* 開發者資訊 */}
        <footer className="border-t border-slate-800/60 pt-6">
          <details className="group">
            <summary className="cursor-pointer select-none text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 list-none">
              <span className="inline-block transition-transform group-open:rotate-90">▶</span>
              開發者資訊
            </summary>
            <div className="mt-3 space-y-2 text-xs text-slate-500">
              <p>
                更新資料：在專案根目錄執行{" "}
                <code className="rounded bg-slate-800/80 px-1 py-0.5 text-slate-400">
                  python main.py score &amp;&amp; python main.py export
                </code>
                ，完成後重新整理頁面。
              </p>
              <p>
                因子權重設定見{" "}
                <code className="rounded bg-slate-800/80 px-1 py-0.5 text-slate-400">config.py</code>
                ，Regime 門檻見{" "}
                <code className="rounded bg-slate-800/80 px-1 py-0.5 text-slate-400">config.RegimeThresholds</code>
                ，權重 JSON 見{" "}
                <code className="rounded bg-slate-800/80 px-1 py-0.5 text-slate-400">output/web/factor_weights.json</code>。
              </p>
              <p className="text-slate-600">僅供研究用途，不構成任何投資建議。</p>
            </div>
          </details>
        </footer>
      </div>
    </main>
  );
}
