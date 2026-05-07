import fs from "fs";
import path from "path";
import type { CurrentRecord, DashboardData, PanelRow, ShortagePayload, SupplyChainData } from "./types";

/** Resolve `output/web` whether `npm run dev` is started from `dashboard/` or project root. */
function findWebDir(): string {
  const candidates = [
    path.join(process.cwd(), "..", "output", "web"),
    path.join(process.cwd(), "output", "web"),
    // Vercel 等僅部署 dashboard/ 時，JSON 放在此目錄（與 output/web 同步）
    path.join(process.cwd(), "data", "web"),
  ];
  for (const dir of candidates) {
    const currentPath = path.join(dir, "current.json");
    const panelPath = path.join(dir, "panel.json");
    if (fs.existsSync(currentPath) && fs.existsSync(panelPath)) {
      return dir;
    }
  }
  throw new Error(
    `找不到 JSON（已嘗試：${candidates.join("；")}）。請在專案根目錄執行：python main.py score && python main.py export`
  );
}

export function loadDashboardData(): DashboardData {
  const dir = findWebDir();
  const currentPath = path.join(dir, "current.json");
  const panelPath = path.join(dir, "panel.json");
  const raw = JSON.parse(fs.readFileSync(currentPath, "utf-8")) as CurrentRecord;
  const panel = JSON.parse(fs.readFileSync(panelPath, "utf-8")) as PanelRow[];
  return { current: raw, panel };
}

/** Load shortage_signals.json if available, returns null otherwise. */
export function loadShortageData(): ShortagePayload | null {
  const candidates = [
    path.join(process.cwd(), "..", "shortage-radar", "data", "output", "shortage_signals.json"),
    path.join(process.cwd(), "shortage-radar", "data", "output", "shortage_signals.json"),
    path.join(process.cwd(), "data", "web", "shortage_signals.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8")) as ShortagePayload;
    }
  }
  return null;
}

/** Load supply_chain_data.json if available, returns null otherwise. */
export function loadSupplyChainData(): SupplyChainData | null {
  const candidates = [
    path.join(process.cwd(), "..", "research", "output", "supply_chain_data.json"),
    path.join(process.cwd(), "research", "output", "supply_chain_data.json"),
    path.join(process.cwd(), "..", "output", "web", "supply_chain_data.json"),
    path.join(process.cwd(), "data", "web", "supply_chain_data.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8")) as SupplyChainData;
    }
  }
  return null;
}
