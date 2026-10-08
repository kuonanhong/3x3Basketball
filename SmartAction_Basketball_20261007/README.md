# 聰動街籃 3×3｜完整原始碼與部署包

本包提供一款可玩的原創籃球遊戲，以及 20 個適合聰動「動手動腦」的遊戲構想。無付費網頁工具、外部遊戲套件、下載模型、人物貼圖或遊戲安裝程式。

**這是本機 3 對 3 電腦對戰：玩家控制藍隊一名球員，其餘五名由程式控制。多位訪客各自開啟、各自遊玩；本包不含六位真人共用房間的網路服務。未進行十萬人並發測試，不能保證十萬同時、不延遲或永不當機。**

## 最快試玩

雙擊 `SmartAction_3x3.html`，不需安裝其他附件，即可離線玩。HTML 中的教學連結會下載一份可閱讀的教學 HTML。定位與 Google Maps 需要網路、安全連線及使用者授權；直接開啟檔案時，部分瀏覽器會拒絕定位，請改用 HTTPS 網站或 localhost。

完整資料夾在終端機執行 `python3 -m http.server 8080`（Windows 可用 `py -m http.server 8080`），再開啟 `http://localhost:8080/`。本機服务器不需要上傳到 GitHub。

## 雙手控制

| 區域 | 鍵盤 | 手機／平板 |
|---|---|---|
| 左手方向 | W／A／S／D 移動 | 左側虛擬搖桿 |
| 左手動作 | Q 跳躍、E 按住蹲下 | 跳躍、蹲下按鈕 |
| 右手方向 | ↑／←／↓／→ 控制手部瞄準 | 右側虛擬搖桿 |
| 右手動作 | J 傳球、K 按住蓄力後放開投籃 | 傳球、投籃按鈕；投籃按住後放開 |
| 切換球員 | 球場取得焦點後按 Tab | 「切換球員」按鈕 |
| 暫停 | Escape 或暫停按鈕 | 暫停按鈕 |
| 重播鏡頭 | 自動 360° 環繞，可滑鼠左右拖曳調整 | 可左右拖曳調整 |

蓄力接近 62% 的白色標記時放開較準。方向鍵向籃框瞄準有加成，反方向有減分；未手動瞄準時提供辅助。傳球依手部方向選擇隊友。接近籃框時起跳出手可灌籃；稍遠為上籃；6.1 公尺外為三分。防守時接近持球者可嘗試抄截，跳起可嘗試封阻。這是容易上手的機率與幾何模擬，非專業運動訓練系統。

每場 3 分鐘，進攻時間 14 秒。採休閒版兩分／三分制，非正式 FIBA 3×3 的一分／兩分制。難度可隨時調整，畫質不改變計分規則。

## 效能與精彩重播

啟動時量測短時繪圖成本，並參考瀏覽器可提供的粗略記憶體與邏輯處理器資訊；這不是精確的剩餘 RAM／GPU 檢查。遊戲中若連續出現低 FPS，自動模式會降低畫質；亦可手動覆寫。

| 模式 | 繪圖策略 |
|---|---|
| 輕量 | 目標 30 FPS、像素上限 70 萬、DPR ≤ 1、減少背景 |
| 均衡 | 目標 60 FPS、像素上限 140 萬、DPR ≤ 1.5 |
| 完整 | 目標 60 FPS、像素上限 240 萬、DPR ≤ 2、完整程序生成背景 |

目標 FPS 不代表所有裝置都能達到。物理固定步長 1/60 秒；限制單幀補算次數，切到背景即暫停。重播只保留最近 180 份快照（每秒約 30 份）和上一段精彩球，避免隨遊玩時間無限增加記憶體。重播以 0.45 倍速播放實際快照，不修改正在進行的比賽；可略過，也可重看上一段。

## 多語與搜尋入口

介面有 22 種語言：繁中、簡中、英、日、韓、阿拉伯、馬來、泰、越南、印尼、菲律賓、德、波蘭、捷克、葡萄牙、芬蘭、瑞典、俄、法、西班牙、義大利、印地語。每種介面有完整 75 個文字鍵；阿拉伯語介面使用 RTL，球場方向及雙手操作區固定。

預設依使用者的瀏覽器語言設定顯示，並保留其手動選擇。**不是依 IP 或地理位置推斷國籍**。語言網址 `?lang=ja` 可指定；另有 `lang/ja/` 等 22 個含實際翻譯 HTML 的搜尋入口、`lang`／`hreflang`、描述與遊戲結構化資料。發布 `lang/` 和合併 sitemap 才能讓這些入口上網；不保證搜尋排名。

## Google Maps 設定

基本版無需 key：按「附近籃球場」→「定位目前位置」→授權；可查看經緯度與定位誤差，點選「目前位置」或「尋找附近球場」開啟 Google Maps。定位不會改變遊戲虛擬球場，也沒有背景定位或遊戲伺服器座標儲存。地點搜尋完整性與現況由 Google Maps 決定。

如需頁內 Google 地圖：

1. 依 `docs/SCALE_AND_MAPS.md` 建立 Maps Embed API key，限制網站來源與 API。
2. 將 `config.example.js` 複製為 `config.js`，填入 `mapsEmbedApiKey`。
3. 在 `index.html` 的 `app.js` 前加入 `<script src="config.js"></script>`。
4. 將 `config.js` 和更新的 HTML 一同發布；本包預設 `.gitignore` 排除 `config.js`，確認為受限制的公開瀏覽器 key 後可個別加入，不應上傳其他私密密鑰。語言入口若也要使用，新增 `<script src="../../config.js"></script>`。
5. 使用者授權定位後載入頁內 Embed 地圖，座標會傳送給 Google。Maps Embed 的免費與 API 設定限制見官方文件；Places 球場列表是另一種計費功能，本包未啟用。

獨立 HTML 預設不用任何 key。如需嵌入地圖，在其 `app.js` 內嵌腳本之前加入同一 `window.SAHoopsConfig` 物件即可。不得將伺服器私密 key 放入公開 HTML。

## 附件內容與部署

開啟 `guide.html` 可閱讀 20 款構想、完整 Git 指令、大檔處理、十萬訪客容量與地圖教學。原始 Markdown 也保留於 `docs/`。

上線必需的 10 個 runtime 檔：`index.html`、`styles.css`、`app.js`、`game-core.js`、`renderer.js`、`locales.js`、`sw.js`、`manifest.webmanifest`、`icon.svg`、`guide.html`。若需多語搜尋入口，另複製 `lang/` 並合併 `sitemap.xml`。不需要上傳 ZIP、測試輸出或獨立 HTML。

放入現有 SmartAction 的 `動手動腦/3x3-basketball/`，在主頁新增入口，保留原主頁。發布之後的預計網址：`https://kuonanhong.github.io/SmartAction/動手動腦/3x3-basketball/`。本包沒有代替你推送或修改已上線網站。

## 開發與重新打包

修改 HTML／CSS／JavaScript 後，在本包根目錄執行：

```bash
python3 tools/build_standalone.py
node tests/core.test.cjs
```

建置工具只用 Python 標準庫，會重建独立 HTML、22 種語言入口、教學、sitemap 及依內容指紋更新的 service worker；無需 npm。若換網站網址，可加 `--base-url "https://你的網址/遊戲路徑/"`。

`tests/browser-smoke.cjs` 是實際瀏覽器驗證工具，開發者另需 Playwright／Chromium；這些是測試工具，不是遊戲訪客的依賴。需要重跑時可在專案根目錄依序執行 `npm install --no-save playwright`、`npx playwright install chromium`、`node tests/browser-smoke.cjs`。驗證結果與實測限制見 `docs/QA_REPORT.md`。

原創程式採 MIT 授權，見 `LICENSE`。遊戲橘子只作遊戲類型研究參考，未使用它的角色、音樂、美術或遊戲程式。
