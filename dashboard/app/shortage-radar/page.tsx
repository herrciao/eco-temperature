import Link from "next/link";
import { loadShortageData } from "@/lib/server-data";
import type { ShortageSignal } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  energy: "能源",
  semiconductor: "半導體",
  metals: "工業金屬",
  battery: "電池/轉型金屬",
  agriculture: "農產品",
  leading: "領先/總經",
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-500";
  if (score >= 70) return "text-red-400";
  if (score >= 58) return "text-orange-400";
  if (score >= 45) return "text-yellow-400";
  if (score >= 35) return "text-green-400";
  return "text-green-600";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-slate-800/40";
  if (score >= 70) return "bg-red-500/10 border-red-500/30";
  if (score >= 58) return "bg-orange-500/10 border-orange-500/30";
  if (score >= 45) return "bg-yellow-500/10 border-yellow-500/30";
  if (score >= 35) return "bg-green-500/10 border-green-500/30";
  return "bg-green-600/10 border-green-600/30";
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <div className="h-1.5 w-full rounded-full bg-slate-700/50" />;
  const pct = Math.min(100, Math.max(0, score));
  const color =
    score >= 70
      ? "bg-red-500"
      : score >= 58
        ? "bg-orange-500"
        : score >= 45
          ? "bg-yellow-500"
          : "bg-green-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-700/50">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function TrailCell({ point }: { point?: { value_fmt?: number | string | null; date?: string; fallback?: string } }) {
  if (!point || (point.value_fmt === null && point.value_fmt === undefined)) {
    return <span className="text-slate-600">—</span>;
  }
  const v = point.value_fmt;
  const txt = v === null || v === undefined ? "—" : typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v);
  const isFallback = point.fallback === "oldest_in_series";
  return (
    <span className="tabular-nums">
      {txt}
      {isFallback && <sup className="ml-0.5 text-slate-500" title="可取得之最舊觀測">*</sup>}
      {point.date && (
        <span className="block text-[10px] text-slate-600">{point.date}</span>
      )}
    </span>
  );
}

function SignalRow({ signal }: { signal: ShortageSignal }) {
  const trail = signal.quarter_trail ?? [];
  return (
    <tr className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
      <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
        {CATEGORY_LABELS[signal.category] ?? signal.category_zh}
      </td>
      <td className="py-3 px-3">
        <div className="font-medium text-slate-100 text-sm">{signal.display_zh}</div>
        <div className="text-xs text-slate-500 mt-0.5">{signal.display_en}</div>
      </td>
      <td className="py-3 px-3 w-28">
        <div className={`font-bold text-lg tabular-nums ${scoreColor(signal.score)}`}>
          {signal.score === null ? "—" : signal.score}
        </div>
        <ScoreBar score={signal.score} />
      </td>
      <td className="py-3 px-3 text-right text-xs text-slate-300 align-top">
        <TrailCell point={trail[0]} />
      </td>
      <td className="py-3 px-3 text-right text-xs text-slate-400 align-top">
        <TrailCell point={trail[1]} />
      </td>
      <td className="py-3 px-3 text-right text-xs text-slate-500 align-top">
        <TrailCell point={trail[2]} />
      </td>
      <td className="py-3 px-3 text-xs text-slate-600 max-w-xs hidden lg:table-cell">
        {signal.notes}
      </td>
    </tr>
  );
}

function CategoryBlock({ category, signals }: { category: string; signals: ShortageSignal[] }) {
  const label = CATEGORY_LABELS[category] ?? category;
  const avgScore =
    signals.filter((s) => s.score !== null).reduce((a, s) => a + (s.score ?? 0), 0) /
    (signals.filter((s) => s.score !== null).length || 1);

  return (
    <section>
      <div className={`flex items-center gap-3 px-3 py-2 rounded-t-xl border ${scoreBg(avgScore)}`}>
        <h2 className="text-sm font-semibold text-slate-200">{label}</h2>
        <span className={`text-xs font-bold ${scoreColor(avgScore)}`}>
          均分 {isNaN(avgScore) ? "—" : avgScore.toFixed(1)}
        </span>
      </div>
      <div className="rounded-b-xl border border-t-0 border-slate-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-500">
              <th className="py-2 px-3 text-left font-normal">分類</th>
              <th className="py-2 px-3 text-left font-normal">項目</th>
              <th className="py-2 px-3 text-left font-normal">緊繃分</th>
              <th className="py-2 px-3 text-right font-normal">本期</th>
              <th className="py-2 px-3 text-right font-normal">~1季前</th>
              <th className="py-2 px-3 text-right font-normal">~2季前</th>
              <th className="py-2 px-3 text-left font-normal hidden lg:table-cell">備註</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <SignalRow key={s.id} signal={s} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ShortageRadarPage() {
  const payload = loadShortageData();

  if (!payload) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-2xl border border-amber-500/40 bg-slate-900/80 p-8">
          <h1 className="text-xl font-semibold text-amber-200">無法載入 Shortage Radar 資料</h1>
          <p className="mt-3 text-slate-300">找不到 shortage_signals.json。</p>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-400">{`cd shortage-radar
source .venv/bin/activate
PYTHONPATH=. python -m pipeline.main`}</pre>
          <Link
            href="/"
            className="mt-6 inline-block text-sm text-sky-400 hover:text-sky-300"
          >
            ← 返回宏觀溫度看板
          </Link>
        </div>
      </main>
    );
  }

  const byCategory: Record<string, ShortageSignal[]> = {};
  for (const sig of payload.signals) {
    (byCategory[sig.category] ??= []).push(sig);
  }
  const orderedCategories = payload.categories.filter((c) => byCategory[c]);

  const allScored = payload.signals.filter((s) => s.score !== null);
  const topTight = [...allScored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);
  const topLoose = [...allScored].sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 3);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* Header */}
        <header>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Shortage Radar
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                能源・半導體・金屬・農產・領先指標的緊繃分數監測（免費資料 MVP）
              </p>
              <p className="mt-1 text-xs text-slate-600">
                產生時間：{payload.generated_at}　｜　分數為價格/動能 proxy，非真實庫存模型
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/supply-chain"
                className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 hover:bg-sky-500/20 transition-colors"
              >
                供應鏈傳導 →
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-slate-600/50 bg-slate-800/40 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                ← 宏觀溫度看板
              </Link>
            </div>
          </div>
        </header>

        {/* Quick highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="text-xs font-semibold text-red-400 mb-3 uppercase tracking-wider">最緊繃 Top 3</div>
            <div className="space-y-2">
              {topTight.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{s.display_zh}</span>
                  <span className={`text-sm font-bold tabular-nums ${scoreColor(s.score)}`}>{s.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <div className="text-xs font-semibold text-green-400 mb-3 uppercase tracking-wider">最寬鬆 Top 3</div>
            <div className="space-y-2">
              {topLoose.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{s.display_zh}</span>
                  <span className={`text-sm font-bold tabular-nums ${scoreColor(s.score)}`}>{s.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Score legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          {[
            { label: "≥70 高度緊繃", color: "text-red-400" },
            { label: "58–70 偏緊", color: "text-orange-400" },
            { label: "45–58 中性偏緊", color: "text-yellow-400" },
            { label: "35–45 偏鬆", color: "text-green-400" },
            { label: "<35 寬鬆", color: "text-green-600" },
          ].map((item) => (
            <span key={item.label} className={`${item.color} font-medium`}>
              {item.label}
            </span>
          ))}
        </div>

        {/* Category blocks */}
        <div className="space-y-6">
          {orderedCategories.map((cat) => (
            <CategoryBlock key={cat} category={cat} signals={byCategory[cat]} />
          ))}
        </div>

        {/* Trail legend */}
        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
          {payload.trail_legend}
        </p>

        {/* Footer */}
        <footer className="border-t border-slate-800/60 pt-6 text-xs text-slate-600">
          <p>分數約 50 為中性；&gt;60 偏緊；&lt;40 偏鬆。請搭配 <code className="bg-slate-800/60 px-1 rounded">.cursor/rules/</code> 內 SOP 交叉驗證。僅供研究，不構成投資建議。</p>
        </footer>

      </div>
    </main>
  );
}
