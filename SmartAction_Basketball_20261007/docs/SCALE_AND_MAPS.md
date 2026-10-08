# 效能、十萬訪客與附近球場的實作範圍

## 本附件實際提供什麼

| 需求 | 本版做法 | 實際界線 |
|---|---|---|
| 很多人開網頁玩 | 靜態檔交給網站，球員、AI、物理與重播在各訪客瀏覽器運算 | 一位訪客的比賽不會建立伺服器遊戲程序；訪客之間也沒有共用一場真人比賽 |
| 依裝置自動簡化 | 啟動時短時效能測試，參考可取得的記憶體／CPU資訊，選擇低、中、高畫質 | 瀏覽器不能精確查到所有手機 RAM 或目前剩餘算力；使用者可自行調整 |
| 雙手控制 | 鍵盤雙區與手機／平板兩組觸控控制 | 手機使用畫面搖桿與動作按鈕，不必升起遮住畫面的文字鍵盤 |
| 精彩球慢動作 | 儲存短時遊戲狀態，在重播時轉動虛擬攝影機 | 是原創幾何球員的即時重播，並非生成真人影片或真實球場拍攝 |
| 目前位置 | 使用者按定位並同意後，顯示經緯度與定位精度，提供 Maps 連結 | 不自動要求定位，不將座標上傳至遊戲伺服器 |
| 附近籃球場 | 使用者自行點擊 Google Maps 搜尋附近球場 | 地點結果由 Google Maps 提供；本版未包含計費 Places 地點查詢與頁內球場列表 |
| 頁內 Google 地圖 | 可選填限制過的 Maps Embed API key 顯示定位地圖 | 零 key 狀態仍可玩與開 Maps；正式 Embed 需要 Google Cloud 設定 |

## 為什麼不能承諾十萬同時、不 delay、不當機

將比賽計算分散到訪客裝置，能顯著減少中央伺服器運算需求，但網站首次下載、各人裝置、瀏覽器、網路及外部地圖服務仍有容量限制。網站可做到減少等待與失敗，不能保證每種手機、每個網路與十萬同時連線都不延遲。

GitHub Pages 官方公開限制是：發布站點最大 1 GB、每月 100 GB 軟流量限制，且可能遇到速率限制與 HTTP 429。這是靜態網站平台，不是即時遊戲房間伺服器。官方沒有保證「十萬同時」的服務能力。

粗略估算的公式：

```text
首次傳輸量 ≈ 首次訪客數 × 每人實際下載量
流量尖峰 ≈ 首次傳輸量 ÷ 訪客進入時間
```

例子只為說明容量，非本包實測：如果每人首次下載 1 MB（十進位），十萬人首次下載約 100 GB，已相當於 Pages 每月軟限制。若這些下载集中在 10 秒，平均對外傳輸速率約 80 Gbit/s，還未計協定開銷或其他網頁。實際應以瀏覽器 Network 面板的 transferred bytes 加總，而非 ZIP 檔案大小計算。

首次成功下載後，瀏覽器／離線快取可以減少重複傳輸；首頁仍應保持精簡，地圖與影片待使用者選擇後載入。跨語言不必下載數十套大圖，重播只保留固定時間窗口，避免遊玩越久記憶體越大。

## 若目標真的有十萬同時訪客

1. 保留本遊戲的本機 AI 模式，讓每位訪客獨立運算；靜態資源移到能明確承接目標流量的 CDN／物件儲存或主機平台。確認流量費、每秒請求配額、快取與故障回退。
2. 測量首次下載量、95 百分位載入時間、錯誤率、代表性手機 FPS 與長時間記憶體變化。根據觀察調整畫質與檔案量。
3. 負載測試須針對自己有權測試的測試站，取得供應商允許並逐級提高。不要對公共 GitHub Pages 或 Google Maps 人為發送十萬請求。
4. 正式發布前，明確設定容量與錯誤告警，準備流量突增時的靜態備援及簡化版入口。

目前測試能驗證功能與本機裝置表現；沒有以十萬真實連線做生產容量測試，也沒有任何免費服務因此提供容量保證。

## 六位真人同場需要另外開發與部署

若將來要六人實時組隊，不是把 HTML 放到 GitHub 就完成。通常需要：玩家／房間分配、WebSocket 或 WebRTC 信令、可信遊戲狀態、斷線重連、伺服器節拍、限流與作弊處理。對公開競技遊戲，伺服器裁定得分和狀態較可靠；客戶端做輸入預測與狀態插值以隱藏部分網路延遲。這些是後續架構建議，並未包含在本版程式。

十萬真人同時、每房六人約是 16,667 個滿房等級的容量（最後一房可能未滿）。若每人每秒收到 10 個、每個 1 KiB 的快照，光這項示例輸出就約 1.024 GB/s；實際數字取決於協定、壓縮、更新頻率與玩家行為。應用分區伺服器、房間分片與地區就近部署，而非建立十萬人同一場。雲端免費額度通常不等於能承擔這個規模。

## 硬體偵測的可信度

`navigator.deviceMemory` 只返回為保護隱私而粗化的記憶體估計，不代表可供本網頁使用的剩餘 RAM，部分瀏覽器不支援。`navigator.hardwareConcurrency` 是瀏覽器願意提供的邏輯處理器數，不是 CPU 跑分或完整的物理核心數。把「手機」一律視為弱機、「桌機」一律視為強機也不準確。

較務實的流程是：先採保守設定，跑短時場景／幾何測試，綜合實際 frame time 決定畫質；持續觀察掉幀時降低像素密度、特效與場景裝飾；並保留手動畫質選項。偵測應保持簡短，避免為了測試效能先把裝置弄得很忙。此類測試是調整依據，不是對將來絕不耗盡資源的保證。

## 定位與 Google Maps：預設免費路徑

使用者選擇定位後，瀏覽器 Geolocation API 要求權限，回傳座標與 accuracy。高精度請求也不保證位置完全正確；室內、弱訊號及定位來源都可能造成誤差。定位失敗、拒絕或超時時，遊戲仍繼續，訪客可自行以城市名稱找球場。

正式部署使用 GitHub Pages 的 HTTPS；網頁不應偷偷蒐集位置。使用者點開 Google Maps 連結時，會將查詢文字／位置參數交給 Google，這與本機遊戲的計算分開。

Google 官方 Maps URLs 不需要 API key，且可跨 Android、iOS 及桌機。兩種用途分開：

```js
// 目前定位點：Google 地圖顯示座標 pin，不宣稱是某球場。
const currentLocation = new URL('https://www.google.com/maps/search/');
currentLocation.searchParams.set('api', '1');
currentLocation.searchParams.set('query', `${latitude},${longitude}`);

// 類別搜尋：座標作為查詢位置提示，實際結果由 Google Maps 決定。
const nearbyCourts = new URL('https://www.google.com/maps/search/');
nearbyCourts.searchParams.set('api', '1');
nearbyCourts.searchParams.set('query', `basketball courts near ${latitude},${longitude}`);
```

不要將搜尋結果當作完備、即時或核實可使用的球場名單，也不要因為座標 pin 靠近某球場就宣稱使用者「現在在該球場」。一個精確球場的詳細連結最好使用經核實的名稱與地址，或 Google Place ID。

## 可選：在頁內顯示官方 Google Maps Embed

本版可配置 `mapsEmbedApiKey`；具體設定位置見根目錄 README。預設留空，不影響遊戲與免費外開 Maps 連結。

1. 建立 Google Cloud 專案與計費帳戶，啟用 Maps Embed API。
2. 建立只用於該站 Embed 的 API key，限制 API 為 **Maps Embed API**。
3. 應用程式限制設為 Websites，允許正式網站，例如 `https://kuonanhong.github.io/*`。如果測試本機，再額外設定自己的 localhost 測試來源。
4. 將此受限的瀏覽器 key 填入 `mapsEmbedApiKey`；瀏覽器 key 本來就能被看見，安全性依賴網站／API限制。勿在 HTML 填入其他未受限密鑰或伺服器私密憑證。
5. 正式測試定位地圖；地圖失敗時保留一般 Maps 連結，不阻擋遊戲。

官方說明 Maps Embed API 的使用不收費、沒有每日或短期請求上限，但仍需要 API key／Cloud 計費設定並遵守服務條款。其他 Google Maps API 不應一併宣稱免費。

## 未來若要「頁內附近球場列表」

需要另外接 Places API，例如 Text Search (New) 用「籃球場／basketball court」與定位偏向條件，再顯示球場名稱、距離與 Google Maps 詳細連結。官方目前的 Place Types 表未列 `basketball_court`，不可憑空寫這個類型給 Nearby Search。

Places 查詢屬獨立計費功能，應設定最少所需欄位、API限制、配額與費用監控，並遵守地點資料顯示及保存規則。不要把需伺服器限制的 REST 私鑰直接放在靜態網頁，也不要從 Google 搜尋結果或 Google 地圖頁面抓取資料來冒充正式 API。

本版不把 Google 航照、Street View 或地圖瓦片拿來重建場景；遊戲球場是原創模型。若未來希望整合真實地圖為遊戲材質，需要另外核對產品許可與技術範圍。

## 官方參考文件

查核日期：2026-10-07。

- GitHub Pages 靜態網站說明：<https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages>
- GitHub Pages 限制：<https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>
- Google Maps URLs：<https://developers.google.com/maps/documentation/urls/get-started>
- Maps Embed 使用與計費：<https://developers.google.com/maps/documentation/embed/usage-and-billing>
- Maps Embed 建立設定：<https://developers.google.com/maps/documentation/embed/get-api-key>
- Google Maps key 安全設定：<https://developers.google.com/maps/api-security-best-practices>
- Places 使用與計費：<https://developers.google.com/maps/documentation/places/web-service/usage-and-billing>
- Places 地點類型：<https://developers.google.com/maps/documentation/places/web-service/place-types>
- Geolocation：<https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition>
- deviceMemory：<https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory>
- hardwareConcurrency：<https://developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency>
