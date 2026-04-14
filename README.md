# 宏觀 Regime 研究工具 (Macro Regime Research)

追蹤少量宏觀指標、產生週頻 Regime 分數，並回測各資產類別在未來 1/3/6 個月（週近似）的表現。

## 需求

- Python 3.11+
- [FRED API key](https://fred.stlouisfed.org/docs/api/api_key.html)（免費）

## 安裝

```bash
cd "eco temperature"
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# 若 matplotlib 無法建立快取目錄，可設定：
# export MPLCONFIGDIR="$PWD/.mplconfig"
```

建立 `.env`：

```
FRED_API_KEY=your_key_here
```

## 使用

```bash
# 下載並寫入 SQLite
python main.py fetch --start 2015-01-01

# 對齊週頻、特徵、分數、regime（寫入 artifacts）
python main.py score

# 回測
python main.py backtest

# 圖表 + 文字摘要
python main.py report

# 匯出 JSON 給 Next.js 看板（output/web/）
python main.py export
```

### Next.js 看板

```bash
python main.py score && python main.py export
cd dashboard && npm install && npm run dev
# 瀏覽 http://localhost:3000
```

一次執行完整管線：

```bash
python main.py all --start 2015-01-01
```

## 指標與資料來源

| 指標 | 來源 |
|------|------|
| 銅（期貨） | Yahoo `HG=F` |
| WTI | Yahoo `CL=F` |
| BDI 代理 | Yahoo `BDRY` |
| 非農 | FRED `PAYEMS`（差分為月增） |
| 失業率 | FRED `UNRATE` |
| Fed 有效利率 | FRED `DFF` |
| 10Y-2Y | FRED `T10Y2Y` |
| 美元 | FRED `DTWEXBGS`（廣義指數，非 ICE DXY） |

回測 ETF：`SPY`, `QQQ`, `XLI`, `XLE`, `IWM`, `TLT`。

## 免責聲明

本專案僅供研究與教育用途，不構成投資建議。
