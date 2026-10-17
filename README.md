# SmartAction Sports v7.4 — 聰動運動場・世界球類

免費靜態網頁運動練習：**30 種奧運／亞運／東亞運球類練習模式**、單一畫面雙手操控、廣角全場鏡頭、**241 位真實運動明星資料**（場上每個位置對應一位明星，每位都有 3D 招牌動作）、**74 種介面語言**（依瀏覽器與所在地區自動選擇）、24 個世界場景與選配的本機 CPU 生成式 AI 教練。原創練習遊戲，不是官方聯盟遊戲，也不是網路真人同步對戰。

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

## v7.4 新增：遊戲中的 3D 招牌動作、30 種運動全部明星 3D、按鍵修正、桌球球桌

> **問：`bash Upload_SmartAction_Sports.sh --build --push`（或加 `--fetch-photos`）會把 3D 招牌動作放進遊戲嗎？**
> v7.3 的上傳只會部署 `athletes3d.html` 3D 頁面與球員卡上的連結；遊戲畫面本身還沒有 3D。**v7.4 起，上傳後遊戲內就有 3D 招牌動作**（下方第 1 點）。`--fetch-photos` 只是先擷取開放授權肖像，與 3D 無關；3D 影片若要重新輸出，加 `--render-videos`。

1. **遊戲中直接看 3D 招牌動作**：
   - HUD 新增「**3D**」鍵：暫停比賽、全畫面播放目前操控球員的 3D 招牌動作（360° 環繞、進度條），按「回到比賽」或 Esc 繼續。
   - **精彩重播時**右上角自動出現**子母畫面（PiP）**，播放做出這次精彩動作的明星 3D 招牌動作一次。
   - 先發名單每張球員卡新增「▶ 3D 招牌動作」（在遊戲中播放），原本的「🎬 3D 招牌動作 ↗」仍開啟 3D 頁面。
   - Three.js 只在第一次需要時才載入；手機與 4 核以下的裝置自動用輕量畫質（無陰影、較低解析度）。
2. **30 種運動、241 位明星全部都有 3D 招牌動作**（籃球 18、棒球 28 之外再加 28 種運動 195 位，130 種新動作、24 個 3D 場地）：足球、橄欖球、美式足球、腰旗美式足球、曲棍球、袋棍球、網球、軟式網球、羽球、桌球、壁球、排球、沙灘排球、藤球、手球、冰球、水球、板球、壘球、短跑、射箭、高爾夫、保齡球、撞球。每種運動有自己的服裝（護具、頭盔、泳帽、冰刀、遮陽帽、護目鏡…）與器材（球拍、球棒、球桿、弓箭、保齡球瓶、撞球桿…）。`athletes3d.html` 改為運動下拉選單，可看全部 30 種。
3. **場上人物縮小一半**，名牌與號碼仍清楚；**情緒表情**：得分、好球、殺球得分時頭上出現開心泡泡，失誤或揮空時出現沮喪泡泡，專注時出現專注泡泡；3D 人物準備時表情專注、完成動作後露出笑容（眉毛、嘴型）。
4. **打擊球速可調、預設慢速**：開始卡新增「球速：慢／一般／快」（棒球、壘球、板球），預設「慢」（約一般的 62%），會記住選擇。
5. **強力／穩定揮棒鍵修正**：Q（強力揮棒）與 E（穩定揮棒）改為和 K 一樣的**獨立揮棒鍵**——按住、球到本壘時放開就揮棒，不必再同時按 K。
6. **羽球、桌球、網球、排球等按鍵失靈修正**：每個鍵都會擊球——K 抽球（按住加力）、J 挑高球、Q 殺球、E 放短球；**按早一點會先記住，球到時自動擊出**；放開左搖桿時球員會**自動滑向來球**；離球太遠時畫面會提示原因。足球、手球、冰球等團隊運動：沒有球時 K＝搶斷／擒抱，J＝切換到最靠近球的隊友。
7. **桌球場景改為真正的球桌**：2.74 m × 1.525 m、高 0.76 m 的藍色球桌（白邊線、中線、15.25 cm 球網、桌腳）與場館地板；球必須彈在桌面上，掛網、出界、落地都會判定；球員站在球桌兩端後方。
8. **語言 74 種**：新增古吉拉特、卡納達、馬拉雅拉姆、普什圖、塔吉克、吉爾吉斯、喬治亞、亞美尼亞、冰島、立陶宛、拉脫維亞、愛沙尼亞、斯洛維尼亞、阿爾巴尼亞、馬其頓、索馬利、豪薩、約魯巴、祖魯、南非語（20 種）；每語 656 鍵（含全部 3D 動作名稱），依網址、曾選語言、瀏覽器語言與時區所在地區自動選擇。
9. **上傳腳本**：`--render-videos`（上傳前用無頭 Chromium＋ffmpeg 重新輸出 3D 影片，只補缺少的）、`--video-size 960x540`、`--no-videos`（不上傳影片）；照樣會沿用遠端已有的 AI 教練權重分塊，或用 `--fetch-model`／`--download-model` 上傳權重。

**界線（重要）**：遊戲中的「擬真臉蛋、身材與情緒」沒有用真人照片合成或重建明星臉部，也沒有讓真人照片做出他沒做過的表情——那屬於以真人肖像生成的合成影像，本套件不做。改為：資料卡上顯示**未經修改**的開放授權照片（標示作者與授權）、3D／2D 人物依公開身高體重體型做**風格化**身材，表情以風格化方式呈現。3D 動作是依公開打法特徵手工設計的關鍵影格動畫，不是動作捕捉，也沒有下載比賽照片或轉播影片。

## v7.3 新增：3D 明星招牌動作（籃球 18 位＋棒球 28 位）

- **新頁面 `athletes3d.html`**（導覽列「3D 明星招牌動作」，或比賽中先發名單每張球員卡的「🎬 3D 招牌動作」）：以 Three.js r170（MIT，`vendor/three/`）即時繪製的風格化 3D 球員，依 `data/catalog.json` 的身高、體重、體型、性別、慣用手（棒球另有打擊／投球左右手）、髮型、鬍子、配件與背號產生身材比例與造型；球衣、背號、姓名、頭盔（耳罩朝投手）、捕手面罩、手套、球棒皆為程式產生，不使用任何球隊標誌。
- **46 種招牌動作**（每位明星預設一種，也可套用同項目的其他動作）：賈霸天勾、喬丹後仰跳投、柯比轉身後仰、德克金雞獨立後仰、約基奇單腳後撤、柯瑞快速出手三分（命中後轉身「晚安」手勢）、柏德定點三分、陶樂西後撤步三分、八村壘急停跳投、鄧肯擦板、雷霸龍戰斧灌籃、揚尼斯歐洲步灌籃、萊斯莉快攻單手灌籃、帕克拋投、林書豪換手上籃、魔術強森不看人傳球、姚明低位勾射、賈索轉身勾射；王貞治金雞獨立打法、鈴木一朗指棒儀式＋打了就跑、貝比魯斯預告全壘打、大谷翔平單手收棒、賈吉／小葛瑞菲／松井大揮擊、王柏融／奧圖維／貝茲抬腿揮擊、普荷斯開腿站姿、曼尼／彭政閔封閉站姿、貝爾崔單膝跪地全壘打、王建民伸卡球、李維拉卡特球、克蕭抬腿停頓大曲球、達比修滑球、蘭迪強森低肩速球、陳偉殷左投速球、基特深遠跳傳、瑞普肯游擊長傳、莫里納捕手阻殺、梅斯背向接殺（帽子飛落）、楚奧特攀牆沒收全壘打、克萊門特雷射肩、傑基羅賓森盜本壘滑壘。
- **操作**：拖曳 360° 旋轉、滾輪／雙指縮放、自動環繞、0.25×／0.5× 慢動作、從頭播放、球衣四色；「錄成影片」直接在瀏覽器錄下 1280×720 環繞影片（含姓名資料字卡，支援的瀏覽器輸出 MP4，否則 WebM）。手機、平板、筆電、桌機皆可用；54 種語言（每語 505 鍵）。
- **已預先輸出的影片**：`tools/render_athlete_videos.cjs` 以無頭 Chromium 逐格（固定時間步長）繪製再交給 ffmpeg 編碼，每位明星一支 1280×720、30 fps 的 360° 環繞 MP4（另附合輯）。重新產生：`python3 -m http.server 8787` 後執行 `node tools/render_athlete_videos.cjs --out videos3d`（需 `playwright` 與 `ffmpeg`）。
- **界線**：3D 人物是依公開資料做的風格化示意，不是本人肖像，臉部不貼照片；照片只出現在資料卡並標示作者與授權。能力值為虛構遊戲參數。沒有從網路抓取比賽照片或影片，也沒有做擬真人臉重建。

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

74 種語言：繁中、簡中、英、日、韓、阿拉伯、馬來、泰、越、印尼、菲律賓、德、波蘭、捷克、葡、芬、瑞典、俄、法、西、義、印地、荷、土、希臘、烏克蘭、孟加拉、烏爾都、波斯、希伯來、泰米爾、泰盧固、馬拉地、旁遮普、緬甸、高棉、寮、尼泊爾、僧伽羅、蒙古、哈薩克、烏茲別克、亞塞拜然、斯瓦希里、阿姆哈拉、匈牙利、羅馬尼亞、丹麥、挪威、保加利亞、克羅埃西亞、塞爾維亞、斯洛伐克、加泰隆尼亞（v7 的 54 種）＋ **v7.4 新增 20 種**：古吉拉特、卡納達、馬拉雅拉姆、普什圖、塔吉克、吉爾吉斯、喬治亞、亞美尼亞、冰島、立陶宛、拉脫維亞、愛沙尼亞、斯洛維尼亞、阿爾巴尼亞、馬其頓、索馬利、豪薩、約魯巴、祖魯、南非語。阿拉伯、希伯來、波斯、烏爾都、普什圖為右至左版面。

- 來源：`i18n/<code>.json`（每語 656 鍵，英文為主鍵集，含 172 種 3D 動作名稱）；`tools/build_i18n.cjs` 產生 `locales.js`（內嵌繁中與英文，其餘語言按需載入並由 Service Worker 快取）；`tools/build_languages.cjs` 產生 74 個 `lang/<code>/index.html` 可被搜尋引擎索引的預翻譯入口頁。
- 選擇順序：網址 `?lang=` → 預翻譯入口頁 → 使用者曾選過的語言 → 瀏覽器語言清單 → **IANA 時區推測所在地區的主要語言**（例：Asia/Tbilisi → 喬治亞語、Europe/Vilnius → 立陶宛語、Africa/Mogadishu → 索馬利語）→ 英文。不使用 GPS 推測國籍。
- 翻譯由生成式模型依英文主鍵產生，並做鍵值完整性、按鍵字母（W/A/S/D、K、J、Q、E）、佔位符與文字系統混用檢查；未經母語者審閱，棒球／板球等術語在部分語言以慣用外來語呈現，歡迎修正 JSON 後重新建置。

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
locales.js i18n/      74 語字典與語言註冊表（含時區提示）
data/catalog.json     場景與 241 位運動員（editable source）→ tools/build_catalog.cjs → data/catalog.js
coach.js coach-worker.js vendor/ models/   選配 CPU 生成式 AI 教練（Qwen2.5-0.5B-Instruct ONNX q8）
athletes3d/           3D 明星（rig 人物、motion 動作工具、stage3d 舞台、ingame 遊戲內子母畫面、sports/ 28 種運動動作庫、studio 3D 頁面、capture 影片輸出）
videos3d/             預先輸出的 241 支 360° 環繞 MP4＋index.json
vendor/three/         Three.js r170（MIT）
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

其他選項：`--render-videos`（重新輸出缺少的 3D 影片，需 Node＋playwright＋ffmpeg）、`--video-size`、`--no-videos`、`--fetch-photos`（先擷取開放授權肖像）、`--fetch-model --models-from DIR` 或 `--download-model`（準備權重）、`--stage-only`、`--batch-mib`、`--no-keep-remote-models`。完整說明見 `--help` 與 [docs/DEPLOY.html](docs/DEPLOY.html)。GitHub → Settings → Pages → Deploy from a branch → **main → /(root)**。

## 測試

```bash
for f in tests/*.cjs; do node --test "$f"; done; node --test tests/athletes3d.test.mjs; node tests/core.test.cjs
python3 -m unittest tests.test_build_manifest tests.test_deploy
```

## English quick start

Serve the folder over HTTP (`python3 -m http.server 8080 --bind 127.0.0.1`) and open <http://127.0.0.1:8080/>. Pick any of the 30 Olympic / Asian Games ball-sport practice modes from the picker on the stage; the whole arena and both-hand controls fit on one screen (keyboard: WASD move, arrows aim, Q/E, J, hold-and-release K). Batting modes (baseball, softball, cricket) use a new pitch/zone/timing engine. Every on-field figure is built from a real athlete's catalogue entry (height, build, stylized look, licensed portrait where available); ratings are fictional presets. 54 interface languages are picked from the browser language or the device's region. Deploy with `bash Upload_SmartAction_Sports.sh --build --push`; the optional 546 MB on-device coach model is kept on GitHub from v6 or fetched with `tools/fetch_model.py`.

**v7.4 (English summary).** The 3D signature moves now play *inside the game*: a "3D" HUD button pauses the match and shows the controlled player's move full-stage (Esc / "Back to the match" resumes), highlight replays open a picture-in-picture clip of the star who made the play, and every line-up card has "▶ 3D". All 241 catalogue stars across the 30 sports have a stylized 3D signature move (172 moves, 26 venues), with pre-rendered 360° MP4s in `videos3d/`. On-field figures are half the previous size and show stylized emotion bubbles; racket-sport buttons all hit (drive / lob / smash / drop, buffered early presses, auto-positioning), Q/E are standalone power / contact swings, practice pitches default to a slower pace (selectable), and table tennis is played on a real 2.74 m table. 74 interface languages (20 added). Faces are never photo-reconstructed or synthesized: licensed, unaltered portraits appear only on data cards; bodies and expressions are stylized.
