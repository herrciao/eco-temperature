import { NextResponse } from "next/server";
import { loadShortageData } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export function GET() {
  const data = loadShortageData();
  if (!data) {
    return NextResponse.json(
      {
        error:
          "shortage_signals.json not found. Run: cd shortage-radar && PYTHONPATH=. python -m pipeline.main",
      },
      { status: 404 }
    );
  }
  return NextResponse.json(data);
}
