import { NextResponse } from "next/server";
import { loadSupplyChainData } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export function GET() {
  const data = loadSupplyChainData();
  if (!data) {
    return NextResponse.json(
      { error: "supply_chain_data.json not found. Run: python main.py supply-chain all" },
      { status: 404 }
    );
  }
  return NextResponse.json(data);
}
