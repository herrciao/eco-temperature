import { NextResponse } from "next/server";
import { loadDashboardData } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = loadDashboardData();
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load dashboard data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
