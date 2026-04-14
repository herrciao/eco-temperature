# 宏觀溫度看板 (Next.js)

## 啟動（請在 `dashboard` 目錄執行）

**重要：** 先讓伺服器跑起來（終端機要一直開著、看到 `Ready`），**另一個**終端機或瀏覽器再連線。若沒有程式在跑，`curl` 會顯示 `Failed to connect`。

### macOS：可雙擊

在 Finder 進入 `dashboard` 資料夾，雙擊 **`啟動看板.command`**（若被擋，右鍵 → 打開）。視窗請勿關閉，等出現 `Ready` 後瀏覽器開 **http://127.0.0.1:3456**。

首次若無法執行，在終端機執行一次：

```bash
chmod +x "/path/to/eco temperature/dashboard/啟動看板.command"
```

### 或用指令

```bash
cd "/path/to/eco temperature/dashboard"
npm install
npm run dev
```

終端機會顯示 `Local: http://localhost:3000`（已綁定 `0.0.0.0`，同網段其他裝置也可用電腦 IP 存取）。

瀏覽器請試：**http://127.0.0.1:3000** 或 **http://localhost:3000**

### 若 3000 / 3001 都打不開：改用很少衝突的埠 3456

```bash
npm run dev:3456
```

然後只開：**http://127.0.0.1:3456**

或使用輔助腳本（預設同樣走 3456）：

```bash
bash scripts/dev-try.sh
# 自訂埠：bash scripts/dev-try.sh 4000
```

### 終端機有顯示 Ready，但瀏覽器連不上時

在**另一個**終端機執行（把埠號改成你實際用的）：

```bash
curl -I http://127.0.0.1:3456
```

若出現 `HTTP/1.1 200` 或 `307`，代表伺服器正常，問題在瀏覽器（擴充套件、代理、VPN），可換瀏覽器或關 VPN 再試。

若出現 `Connection refused`，代表該埠沒有服務在聽——請確認 `npm run dev:3456` 仍在執行、且沒被關掉。

## 先產生資料 JSON（在專案根目錄「eco temperature」，不是 dashboard 裡）

```bash
cd "/path/to/eco temperature"
python3 main.py score
python3 main.py export
```

會寫入 `output/web/current.json` 與 `output/web/panel.json`。沒有這兩個檔案，首頁會顯示「無法載入看板資料」。

## 常見問題

| 狀況 | 處理方式 |
|------|----------|
| 頁面顯示無法載入 JSON | 確認已在專案根目錄跑過 `score` + `export`，且 `output/web/` 內有兩個 json |
| `next` / `npm` 報錯找不到模組 | 在 `dashboard` 內再執行一次 `npm install` |
| 終端機要在哪一層開？ | **`npm run dev` 一定要在 `dashboard` 資料夾**；Python 管線在上一層專案根目錄 |
| 空白或圖表一直「載入圖表」 | 重新整理；若仍不行，開開發者工具 Console 看是否有錯誤 |
| 以為開了宏觀看板，其實是別的專案 | 終端機路徑必須是 `.../eco temperature/dashboard`，不是其他 repo |

頁面包含：Regime 與溫度 gauge、因子拆解卡、溫度歷史圖、Regime 時間軸色帶、SPY／四維分數圖（含事件標線）。

API：`GET /api/data` 回傳相同 JSON。
