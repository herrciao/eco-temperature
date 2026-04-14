import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-slate-100">
      <p className="text-4xl font-semibold tabular-nums text-slate-300">404</p>
      <h1 className="mt-4 text-lg font-medium text-white">找不到這個頁面</h1>
      <p className="mt-3 max-w-md text-center text-sm leading-relaxed text-slate-400">
        宏觀溫度看板的首頁網址是根路徑{" "}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200">
          /
        </code>
        ，請勿使用{" "}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200">
          /dashboard
        </code>{" "}
        以外的子路徑（若誤開{" "}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200">
          /dashboard
        </code>{" "}
        已會自動導回首頁）。
      </p>
      <p className="mt-4 max-w-md text-center text-xs text-slate-500">
        請在專案內的{" "}
        <code className="rounded bg-slate-800 px-1 py-0.5">dashboard</code>{" "}
        資料夾執行{" "}
        <code className="rounded bg-slate-800 px-1 py-0.5">npm run dev</code>
        ，瀏覽器開{" "}
        <code className="rounded bg-slate-800 px-1 py-0.5">
          http://localhost:3000/
        </code>
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl border border-emerald-700/50 bg-emerald-950/40 px-5 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-900/50"
      >
        回首頁看板
      </Link>
    </main>
  );
}
