# SmartAction Sports v7.2 — 聰動運動場・世界球類

免費靜態網頁運動練習：**30 種奧運／亞運／東亞運球類練習模式**、單一畫面雙手操控、廣角全場鏡頭、**225 位真實運動明星資料**（場上每個位置對應一位明星）、**54 種介面語言**（依瀏覽器與所在地區自動選擇）、24 個世界場景與選配的本機 CPU 生成式 AI 教練。原創練習遊戲，不是官方聯盟遊戲，也不是網路真人同步對戰。

本版以 v6 套件為基礎重構。v6 README 中提及的 ChatGPT 參考連結在本次製作時無法讀取（需登入或分享頁無內容），未將未讀對話當成已驗證規格；所有需求以使用者說明（2.1–2.4 與第三項）為準。

## 立即使用

解壓縮後進入 `SmartAction_Sports`，以本機 HTTP 伺服器開啟（不要用 `file://` 雙擊）：

```bash
bash Start_Local.sh          # Mac / Linux；Windows 用 Start_Local.bat（需 Python 3）
# 或 python3 -m http.server 8080 --bind 127.0.0.1
```

開啟 <http://127.0.0.1:8080/>。GitHub Pages 版本：<https://kuonanhong.github.io/3x3Basketball/>。

- [完整操作說明](guide.html)
- [SSH 上傳與根目錄部署](docs/DEPLOY.html)
- [AI 模型、論文、授權與離線](docs/AI_COACH_MODEL.html)
- [全部照片來源、授權與運動員資料來源](data/ASSET_CREDITS.html)

## v7.2 補強（第三輪需求，依截圖修正）

> **為何截圖中仍是舊畫面？** 截圖裡出現 `lineup`、`autoPick`、`backToPicker` 等原始鍵名、深色按鍵與只有兩張球員卡，是瀏覽器把**新的 index.html 與舊快取的 JS/CSS/語言檔混在一起**執行。v7.2 已根治：所有程式與樣式網址加上版本號（`?v=7.2.0`），Service Worker 對程式檔一律向伺服器確認（`cache: no-cache`），新版接管時自動重新整理一次。上傳後若仍見舊畫面，按一次 Shift+重新整理即可。

1. **電腦版控制鍵更大更清楚**：寬度 ≥1001 px 時搖桿 170 px（淺色放射漸層、白框）、Q/E/J/K 鍵 86 px 高、20 px 粗體字、鍵名 14 px，淺底深字；主要鍵萊姆綠、按下變琥珀色；以高優先權樣式確保不被舊樣式蓋掉。
2. **兩個出口（電腦／手機）**：右上角固定兩顆鍵——白色「⏹ 結束本場」（只結束這場、回到運動選單，網頁不關）與紅色「✕ 關閉程式」（關閉整個應用程式與網頁）。任一鍵都會先出現選擇卡（結束本場／關閉整個程式／繼續遊玩），被按的那一項會被標示。手機只顯示 ✕ 圖示以節省空間。
3. **電腦版首畫面先選運動**：與手機相同，開啟即為 30 種運動選單（截圖中直接進 3×3 是舊快取所致，見上方說明）。
4. **棒球打擊姿勢與名單**：打者改為**側身站在打擊區、胸口朝本壘、頭轉向投手**，從捕手後方看到的是打擊頭盔背面與背號（不再「面對鏡頭、背對投手」）；球棒由雙手伸向好球帶擊球點。棒球改為**完整 9 人守備**（投、捕、一壘、二壘、游擊、三壘、左外、中外、右外），擊球後只由最近的兩名野手追球。畫面左上新增「打擊對決」卡：目前打者（第幾棒、位置、左右手、身高體重、照片）vs 對方投手，展開「對方守備（9 人）」可看全部 9 個位置的姓名與資料。我方 9 人打線依序輪替（每個打席結束換下一棒）。
5. **場上全部球員卡＋下拉選單**：3×3 顯示 6 張、5×5 顯示 10 張、棒球顯示 9 名打者＋9 名守備，每張卡上方有位置與下拉選單，換人時該卡的照片、身高體重、位置、左右手、成名事蹟與能力值立即跟著改變；選到已在場上的球員會自動對調，不會重複。先發名單面板改為全寬，每隊一列。
6. **新增 16 位 MLB 明星**（共 241 位）：Aaron Judge、Mike Trout、松井秀喜、Mike Piazza、Yadier Molina、Albert Pujols、Jackie Robinson、José Altuve、Cal Ripken Jr.、Adrián Beltré、Willie Mays、Roberto Clemente、Mookie Betts、達比修有、Clayton Kershaw、Randy Johnson（身高體重為常見公開資料；能力值為虛構遊戲參數；新增者暫無照片，可用 `tools/fetch_athlete_photos.py` 補授權肖像）。王建民補上身高體重。預設打線：鈴木一朗、Derek Jeter、大谷翔平、Babe Ruth、Aaron Judge、Ken Griffey Jr.、Mike Trout、松井秀喜、Mookie Betts；對方守備：王建民（投）、Piazza（捕）、Pujols（一壘）、Jackie Robinson（二壘）、Cal Ripken Jr.（游擊）、Beltré（三壘）、Manny Ramírez（左外）、Willie Mays（中外）、Roberto Clemente（右外）。
7. **語言**：54 種語言各新增 16 鍵（共 442 鍵），場上名牌也改用觀看者語言（中文介面顯示中文姓名）。

## v7.1 補強（依第二輪需求）

1. **✕ 關閉鍵**：畫面右上角白色圓形「✕」。按下先顯示確認卡（比賽會結束、設定會保留），確認後結束比賽並嘗試關閉分頁；瀏覽器不允許腳本關閉由使用者自行開啟的分頁時，會改顯示「已關閉」畫面並導向空白頁，分頁本身請再手動關閉。
2. **首畫面先選運動**：載入後先出現 30 種運動的選單（含圖示與賽事標籤），選好後才進入該運動的開始卡；開始卡與結束卡都有「更換運動」。網址 `?sport=` 仍可直接開啟某一運動。
3. **畫面高度 100%、控制鍵更亮更大**：主畫面改為完整視窗高度（`100svh`），導覽列移到畫面下方。左右搖桿改為淺色放射漸層（138 px，手機 112 px），Q/E/J/K 四鍵改為淺底深字（桌機 66 px 高、15 px 粗體；手機 56 px／14 px，2×2 排列），主要鍵為萊姆綠，按下時變為琥珀色。
4. **3×3 籃球 NBA 先發名單**：我方預設中鋒姚明、前鋒 LeBron James、後衛 Stephen Curry；電腦對手預設中鋒 Kareem Abdul-Jabbar、前鋒 Larry Bird、後衛 Michael Jordan。開始卡的「先發名單」可用下拉選單依位置更換（兩隊共 6 位不得重複，選到已在場上的明星會自動對調）；每位明星顯示身高／體重、位置、能力值與成名事蹟。5×5 全場為 C/PF/SF/SG/PG 五個位置。名單儲存在瀏覽器。
5. **場上辨識度**：每位球員有本人照片頭像（授權肖像）、全名名牌、依資料畫出的身材、髮型、鬍子與配件，球衣加陰影與條紋、短褲、球襪與球鞋。
6. **精彩時刻聚焦**：灌籃／精彩上籃／遠投等事件觸發慢動作重播時，鏡頭先**拉近放大做動作的明星**（約 2.1 倍、人物放大 1.25 倍），再逐漸拉遠繞行 360°；明星腳下有聚光燈、球帶拖尾，畫面下方顯示「明星資料」卡（照片、姓名、位置、成名事蹟）。籃板改為透明強化玻璃，環繞時不會擋住明星。灌籃時機：跑到籃下按 Q 起跳、最高點放開 K。
7. **棒球打擊修正**：球棒直接畫到好球帶上方的擊球點（細握把＋粗棒身），不再對不到本壘；**可直接點擊或拖曳好球帶**把球棒移到該點（也可用 W/A/S/D／左搖桿）。我方打線預設大谷翔平、鈴木一朗、Babe Ruth、Ken Griffey Jr.、Derek Jeter，對方投手王建民、捕手 Manny Ramírez、游擊王貞治、二壘彭政閔、中外野王柏融；全部可依位置更換，場上以照片頭像與名牌辨識。
8. **跨平台**：桌機、筆電、平板、手機直向／橫向皆以單一畫面操作；手機的工具列改為可橫向捲動的一列，✕ 固定在角落；54 種語言仍依網址、曾選語言、瀏覽器語言與時區所在地區自動選擇。

## v7 的四項主要改進

### 2.1 更多奧運／亞運／東亞運球類（30 種模式）

| 類型 | 模式 | 賽事標籤 |
|---|---|---|
| 籃球 | 3×3 半場、**5×5 全場** | 奧運・亞運・東亞運 |
| 足球系 | 5 人制足球 | 奧運・亞運・東亞運 |
| 打擊系（全新引擎） | 棒球打擊、**壘球打擊**、**板球打擊** | 奧運・亞運 |
| 網類 | 羽球單／雙、桌球單／雙、網球單／雙、**軟式網球雙打** | 奧運・亞運・東亞運 |
| 排球系 | 排球、**沙灘排球 2×2**、**藤球** | 奧運・亞運 |
| 球門系 | 手球、**曲棍球**、冰球、**水球**、**袖棍球** | 奧運・亞運・冬奧 |
| 持球前進 | 七人制橄欖球、美式足球、**腰旗美式足球** | 奧運（2028）・亞運 |
| 個人技術 | **壁球**、**高爾夫**、**保齡球**、**撞球**、短跑、射箭 | 奧運・亞運・東亞運 |

粗體為本版新增（14 項）。每個模式都有多語規則說明與賽事標籤；各模式為簡化練習規則。

### 2.2 單一畫面：全寬、85–95% 高、控制鍵固定在畫面正下方

- 主畫面 `#stage` 佔滿瀏覽器寬度，高度為視窗高度減去導覽列（桌機約 93%，手機直向約 90%，手機橫向約 90%），`min-height` 保證小螢幕可玩。
- 計分板、運動／視角快速切換、暫停、重播、切換球員、音效、全螢幕、說明全部疊在畫面上方；左右搖桿與 Q/E/J/K 四鍵固定在畫面最下方的透明控制列（可用 ☷ 鍵隱藏／顯示）。鍵盤操作不變。
- 新增預設「廣角（全場）」鏡頭：鏡頭拉高拉遠並加上輕微廣角鏡頭變形，整個場地與四周（看台、樹木、建築、場景照片）都在畫面內；人物比例放大 1.18 倍。打擊類自動使用「打者視角」（投手在遠方、好球帶在眼前）；高爾夫／保齡球使用跟球鏡頭。第三人稱、近身、第一人稱仍可選。

### 2.3 場上人物對應真實運動明星

- `data/catalog.json` 共 225 位運動員（v6 60 位 + 新增 165 位），每個模式先發名單由該運動的明星名單排出，**同一場不重複**（名單不足時才輪用）。
- 每位明星含：身高／體重（僅收錄公開常見數字，查不到者為 null，不補造）、慣用手、遊戲能力值（速度、技巧、力量、防守、準確度；虛構平衡參數）、技術特徵標籤、以及**外觀描述**（膚色、髮色、髮型、鬍子、體格、著名配件、球衣號碼）。
- 渲染器依身高體重體格畫出不同身材，依描述畫髮型／鬍子／髮帶／帽子／頭盔／護目鏡，胸前顯示號碼；**有授權照片的 60 位以照片作為臉部**，其餘以風格化五官呈現。這是風格化近似，不是官方肖像授權；詳見 `data/ASSET_CREDITS.html`。
- 新增明星可用 `python3 tools/fetch_athlete_photos.py`（需網路）從 Wikimedia Commons 擷取 CC BY／CC BY-SA／CC0／公有領域肖像並自動寫入授權資訊；查不到合格授權的會保持無照片。

### 2.4 全新打擊引擎（棒球／壘球／板球）

- 投手會投出**快速球、曲球、滑球、變速球**（壘球：上飄、下墜、變速；板球：快球、彈跳快球、腳邊低球、旋轉球），球路在後段才變化，並依難度決定好球率與球速。
- 畫面有**好球帶**、**球棒擊球點游標**（左手 W/A/S/D 或左搖桿移動）、**來球落點預測圈**（輕鬆全程顯示、一般中段顯示、挑戰只在最後顯示）與**縮小的時機環**。
- 按住 K（或主要鍵）準備、球越過本壘時放開揮棒；**時機誤差 × 位置誤差** 決定擊球品質 → 擊球初速、仰角（右手方向鍵／右搖桿調整仰角與推拉）、方向（太早拉打、太晚推打）。Q = 強力揮棒（窗口較小、距離更遠）、E = 穩定揮棒（窗口較大）、J = 觸擊。
- 球飛行含空氣阻力；守備員有反應時間並依難度決定接殺機率；結果為一壘／二壘／三壘安打、全壘打（越過全壘打牆）、飛球／平飛／滾地出局、界外、好球、壞球、四壞保送、三振；三出局換局。板球以距離計分（邊界 4 分、飛越 6 分），揮空擊中三柱門或被接殺即出局，每 6 球一輪。
- 畫面上方顯示壞球／好球／出局／局（板球：得分／三柱門／輪／球數）與球種球速，擊球後顯示初速、仰角、距離與時機判定。

## 操作

| 動作 | 鍵盤 | 觸控 |
|---|---|---|
| 移動（打擊：球棒擊球點） | W/A/S/D | 左搖桿，或直接點擊／拖曳好球帶 |
| 瞄準（打擊：仰角與推拉） | 方向鍵 | 右搖桿 |
| 跳／蹲（打擊：強力／穩定揮棒） | Q / E | 左側兩鍵 |
| 傳球／次要動作（打擊：觸擊；高爾夫等：重設瞄準） | J | J 鍵 |
| 蓄力與出手／揮棒 | 按住 K 後放開 | 按住主要鍵後放開 |
| 切換球員 | Tab | 切換球員鍵 |
| 暫停 | Esc | 暫停鍵 |

## 語言

54 種語言：繁中、簡中、英、日、韓、阿拉伯、馬來、泰、越、印尼、菲律賓、德、波蘭、捷克、葡、芬、瑞典、俄、法、西、義、印地、荷、土、希臘、烏克蘭（v6 26 種）+ 孟加拉、烏爾都、波斯、希伯來、泰米爾、泰盧固、馬拉地、旁遮普、緬甸、高棉、寮、尼泊爾、僧伽羅、蒙古、哈薩克、烏茲別克、亞塞拜然、斯瓦希里、阿姆哈拉、匈牙利、羅馬尼亞、丹麥、挪威、保加利亞、克羅埃西亞、塞爾維亞、斯洛伐克、加泰隆尼亞（新增 28 種）。阿拉伯、希伯來、波斯、烏爾都為右至左版面。

- 來源：`i18n/<code>.json`（每語 442 鍵，英文為主鍵集）；`tools/build_i18n.cjs` 產生 `locales.js`（內嵌繁中與英文，其餘語言按需載入並由 Service Worker 快取）；`tools/build_languages.cjs` 產生 54 個 `lang/<code>/index.html` 可被搜尋引擎索引的預翻譯入口頁。
- 選擇順序：網址 `?lang=` → 預翻譯入口頁 → 使用者曾選過的語言 → 瀏覽器語言清單 → **IANA 時區推測所在地區的主要語言** → 英文。不使用 GPS 推測國籍。
- 翻譯由生成式模型依英文主鍵產生並做鍵值完整性驗證；棒球／板球等術語在部分語言以慣用外來語呈現，歡迎母語者修正 JSON 後重新建置。

## 檔案結構

```
index.html            單一畫面主頁（stage + 設定、世界場景、球員比較、AI 教練）
stage.css             主畫面版面（全寬、高度、HUD、控制列、手機直橫向）
styles.css sports.css 其餘樣式
app.js                應用殼層：輸入、迴圈、重播、語言載入、HUD
sports-ui.js          運動選單、名單、頭像、控制標籤、世界場景、教練 UI
game-core.js          籃球 3×3 半場 / 5×5 全場模擬
sports-engine.js      其餘 28 種模式（球門／網類／持球／打擊 v2／壁球／高爾夫／保齡球／撞球／短跑／射箭）
renderer.js           Canvas 2D 渲染：廣角鏡頭、場地、器材、人物外觀、打擊 HUD
locales.js i18n/      54 語字典與語言註冊表（含時區提示）
data/catalog.json     場景與 225 位運動員（editable source）→ tools/build_catalog.cjs → data/catalog.js
coach.js coach-worker.js vendor/ models/   選配 CPU 生成式 AI 教練（Qwen2.5-0.5B-Instruct ONNX q8）
tools/                build_catalog / build_i18n / build_languages / build_credits / build_manifest / fetch_athlete_photos / fetch_model
tests/                Node 與 Python 測試（引擎、渲染、整合契約、離線、部署）
Upload_SmartAction_Sports.sh   一鍵重建＋驗證＋備份＋上傳到 kuonanhong/3x3Basketball
```

## 生成式 AI 教練（回覆學徒問題）

已附 Transformers.js 與 ONNX Runtime WASM；Qwen2.5-0.5B-Instruct q8 權重（512,096,557 bytes，16 塊）**不含在本 zip**，以縮小附件：

- 若 GitHub 上已有 v6 的 `models/`，上傳腳本會自動沿用遠端既有且 SHA-256 驗證通過的分塊（不重傳、不刪除）。
- 本機要離線測試 AI 時：`python3 tools/fetch_model.py --from "/路徑/v6/SmartAction_Sports"`（複製 v6 分塊）或 `--download`（從 Hugging Face 固定版本下載並分塊驗證）。

教練提示詞已涵蓋 30 種模式的練習要點與本場數據，以學徒（初學者）問答為框架；未載入模型時顯示固定多語提示並明確標示「非生成式 AI」。小模型回答可能重複或出錯，不應視為專業訓練評估。

## 上傳到 `kuonanhong/3x3Basketball`

需要 Git、Python 3.10+、Node.js 18+ 與可用的 SSH 金鑰（`ssh -T git@github.com`）。

```bash
bash Upload_SmartAction_Sports.sh --build --dry-run     # 重建資料／字典／語言頁／清單並預覽
bash Upload_SmartAction_Sports.sh --build --push        # 備份遠端 main → 分批上傳 → 驗證 → fast-forward main
```

其他選項：`--fetch-photos`（先擷取開放授權肖像）、`--fetch-model --models-from DIR` 或 `--download-model`（準備權重）、`--stage-only`、`--batch-mib`、`--no-keep-remote-models`。完整說明見 `--help` 與 [docs/DEPLOY.html](docs/DEPLOY.html)。GitHub → Settings → Pages → Deploy from a branch → **main → /(root)**。

## 測試

```bash
for f in tests/*.cjs; do node --test "$f"; done; node tests/core.test.cjs
python3 -m unittest tests.test_build_manifest tests.test_deploy
```

## English quick start

Serve the folder over HTTP (`python3 -m http.server 8080 --bind 127.0.0.1`) and open <http://127.0.0.1:8080/>. Pick any of the 30 Olympic / Asian Games ball-sport practice modes from the picker on the stage; the whole arena and both-hand controls fit on one screen (keyboard: WASD move, arrows aim, Q/E, J, hold-and-release K). Batting modes (baseball, softball, cricket) use a new pitch/zone/timing engine. Every on-field figure is built from a real athlete's catalogue entry (height, build, stylized look, licensed portrait where available); ratings are fictional presets. 54 interface languages are picked from the browser language or the device's region. Deploy with `bash Upload_SmartAction_Sports.sh --build --push`; the optional 546 MB on-device coach model is kept on GitHub from v6 or fetched with `tools/fetch_model.py`.
