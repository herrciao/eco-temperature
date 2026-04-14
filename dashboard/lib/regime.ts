export const REGIME_COLORS: Record<string, string> = {
  expansion: "#2ecc71",
  recovery: "#27ae60",
  overheating: "#e74c3c",
  stagflation_risk: "#e67e22",
  contraction: "#c0392b",
  neutral: "#95a5a6",
};

export const REGIME_LABEL_ZH: Record<string, string> = {
  expansion: "擴張",
  recovery: "復甦早期",
  overheating: "過熱",
  stagflation_risk: "滯脹風險",
  contraction: "收縮",
  neutral: "中性震盪",
};

export function regimeColor(regime: string): string {
  return REGIME_COLORS[regime] ?? "#64748b";
}

export function regimeLabelZh(regime: string): string {
  return REGIME_LABEL_ZH[regime] ?? regime;
}
