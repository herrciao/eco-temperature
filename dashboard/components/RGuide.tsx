export function RGuide() {
  const chips = [
    { r: "0.3", pct: "~60%", color: "#8b9cb3" },
    { r: "0.5", pct: "~67%", color: "#f59e0b" },
    { r: "0.6", pct: "~71%", color: "#4ade80" },
    { r: "0.7", pct: "~76%", color: "#4ade80" },
    { r: "0.8", pct: "~80%", color: "#38bdf8" },
    { r: "1.0", pct: "100%", color: "#38bdf8" },
  ];

  return (
    <div className="rounded-lg border border-sky-400/20 bg-sky-400/5 px-4 py-3 mb-5 text-sm leading-relaxed">
      <p className="font-semibold text-sky-400 mb-1.5 text-[13px]">📐 怎麼解讀 r 值？</p>
      <p className="text-slate-300 text-xs leading-relaxed">
        r 是相關係數（−1 到 +1），<strong className="text-slate-200">不能直接當成「準確率」百分比</strong>。
        但可以轉換成更直觀的 <strong className="text-slate-200">同向機率</strong>：當觀察指標往上（或往下），目標籃子在領先期後跟著同向移動的機率。
        公式：<code className="bg-slate-800 px-1 py-0.5 rounded text-[11px]">P = 50% + arcsin(r) / π × 100%</code>
      </p>
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {chips.map(({ r, pct, color }) => (
          <span
            key={r}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px]"
          >
            r = {r} →{" "}
            <span className="font-bold" style={{ color }}>{pct}</span>
            {" "}同向
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        ⚠️ 同向機率只代表方向吻合的統計機率，不代表幅度相同，實際操作請搭配其他指標判斷。
      </p>
    </div>
  );
}
