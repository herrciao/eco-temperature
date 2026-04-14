"use client";

import { ReferenceLine } from "recharts";
import type { DashboardEvent } from "@/lib/types";

/**
 * 僅為「手動」市場事件畫垂直虛線，不在圖上寫文字（避免 Recharts label 重疊）。
 * Regime 切換以 ReferenceArea 色帶呈現即可，見下方 EventLegend 列表。
 */
export function EventMarkers({ events }: { events: DashboardEvent[] }) {
  const marketOnly = events.filter((e) => e.type === "market");
  return (
    <>
      {marketOnly.map((e) => (
        <ReferenceLine
          key={e.id}
          x={e.date}
          stroke={e.color ?? "#f8fafc"}
          strokeDasharray="5 5"
          strokeOpacity={0.65}
          strokeWidth={1}
        />
      ))}
    </>
  );
}
