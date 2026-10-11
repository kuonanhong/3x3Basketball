# SmartAction Sports v6 — 聰動運動館

免費靜態網頁運動練習：16 個簡化模式、24 個世界場景、60 位運動員資料卡、84 張授權照片、26 種介面語言，以及選配的本機 CPU 生成式 AI 教練。這是原創練習遊戲，不是官方聯盟遊戲或網路真人同步對戰。

本版以使用者上傳的 `SmartAction_Basketball_FullPackage(2).zip` 為修改依據；部分 ChatGPT 參考連結需登入或無法取得完整內容，未將未讀對話當成已驗證規格。

## 立即使用

解壓縮 `SmartAction_Sports_v6_FullPackage.zip`，進入 `SmartAction_Sports`。Mac／Linux 可執行 `bash Start_Local.sh`；Windows 可執行 `Start_Local.bat`，需要已安裝 Python。也可在含 `index.html` 的目錄直接啟動 HTTP 伺服器：

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

開啟 <http://127.0.0.1:8080/>。停止伺服器按 Control+C。GitHub Pages 使用 HTTPS 可直接開啟；不要依賴雙擊 `file://index.html` 來啟動模型 Worker 或定位。

- [完整操作說明](guide.html)
- [SSH 上傳與根目錄部署](docs/DEPLOY.html)
- [AI 模型、論文、授權與離線](docs/AI_COACH_MODEL.html)
- [全部照片來源及授權](data/ASSET_CREDITS.html)

## 本版模式與操作

包含 3×3 籃球、5×5 足球、棒球打擊、羽球單／雙打、桌球單／雙打、網球單／雙打、美式足球、冰球、橄欖球、排球、手球、短跑、射箭，共 16 個模式。團體隊友／對手由本機 AI 控制；各模式採簡化練習規則，不是完整職業聯盟或奧運規則。

| 動作 | 鍵盤 | 觸控 |
|---|---|---|
| 移動腿部 | W/A/S/D | 左搖桿 |
| 手部瞄準 | 方向鍵 | 右搖桿 |
| 跳／蹲 | Q/E | 下方動作鍵 |
| 傳球／次要動作 | J | 傳球鍵 |
| 蓄力與出手 | 按住 K 後放開 | 按住主要動作鍵後放開 |
| 切換球員 | Tab | 切換球員按鈕 |
| 棒球轉腰 | Z/C | 轉腰鍵 |
| 棒球肩部角度 | F/R | 肩部鍵 |

左右手觸控區位於球場畫面下方。提供第一人稱、近身跟隨、第三人稱、拉近／拉遠與慢速環繞精彩重播。街球／業餘、職業級、最高級代表遊戲 AI 難度，不表示官方 NBA 或其他聯盟授權。

## 場景、資料與語言

- 24 個世界場景包含高雄與臺北景點、公園、洛克公園及威尼斯海灘球場。照片是平面背景，不是當地實景 3D 重建或即時街景。
- Google Maps 使用一般地圖／搜尋連結，不需部署付費 Maps 金鑰。GPS 由使用者按鈕啟用；手動座標也可。Commons 附近照片查詢不保證全球每個地點都有結果，也不代表照片所在地可打球。
- 60 位運動員有資料卡照片，56 位有來源身高。未找到的身高或體重不補造。場內採通用幾何人物，不是授權的真實球員臉部模型。
- 遊戲速度、力量、技巧與防守值是虛構平衡參數，不是實測或官方評分。
- 照片各有 CC BY、CC BY-SA、CC0 或公有領域標示；保留作者與授權。著作權許可不包含球員肖像、人格權、代言或商標許可。本作無球員或聯盟背書。
- 26 種語言：繁中、簡中、英、日、韓、阿拉伯、馬來、泰、越南、印尼、菲律賓、德、波蘭、捷克、葡萄牙、芬蘭、瑞典、俄、法、西班牙、義大利、印地、荷蘭、土耳其、希臘、烏克蘭語。
- 語言由瀏覽器偏好／網址語言參數／手動選擇決定，不依靠 GPS 推測國籍。日光、天氣、季節、氣候是畫面效果，並非即時氣象。

## 真正的 CPU AI 教練與離線

已附 Qwen2.5-0.5B-Instruct ONNX q8 權重、分詞器、Transformers.js 與 ONNX Runtime WASM。模型本體為 512,096,557 bytes，分成 16 塊；連同分詞器和執行資源共 **546,143,152 bytes（約 546 MB）**。按「載入 AI 教練」才下載／載入，不影響先玩基本遊戲。推論在使用者 CPU 執行，GitHub Pages 不提供伺服器推論。

這是小模型資源折衷，不能宣稱最準。回答可能重複、混用語言或出錯。未載入模型時，基本教練是明確標示的固定多語規則提示。建議先用 RAM 16 GB 以上桌機／筆電嘗試；這是保守建議，不是實測最低需求，手機未必能執行 AI。

已完成相同 q8 權重的 Linux／Node CPU 真實生成檢查與分塊 SHA 驗證；這不能代替瀏覽器 WASM、Intel Mac、iPhone、Android 等實機相容性驗證，亦不代表已證明回答準確度。AI 詳情見 [模型說明](docs/AI_COACH_MODEL.html)。

完全離線時保留完整專案，以本機 HTTP 伺服器開啟。瀏覽器快取可能被清除，不是永久備份；地圖和附近照片查詢需要網路。「準備離線核心」不會偷偷下載大型模型，模型需另外主動載入。

## 上傳到 `kuonanhong/3x3Basketball`

使用 Git、Python 3.10+ 與現有 SSH 金鑰。腳本優先選 Python 3.11；可用 `SPORTS_PYTHON` 指定。無須 PAT。

```bash
ssh -T git@github.com
bash Upload_SmartAction_Sports.sh --dry-run
bash Upload_SmartAction_Sports.sh --push
```

若不在來源目錄，指定 `--source "/完整路徑/SmartAction_Sports"`。預設只預覽。腳本會驗證部署清單與模型分塊、備份遠端、分批推暫存分支，完成才更新 main；不修改來源的 Git 狀態。部署直接平鋪在儲存庫根目錄，保留必要的 `models/`、`assets/` 等資產階層。只清理已查核的舊包裝目錄與發行檔，不隨意刪除未知遠端內容。

GitHub → Settings → Pages → Deploy from a branch → **main → /(root)**。部署成功後開啟 <https://kuonanhong.github.io/3x3Basketball/>。

新增／修改資源後：

```bash
python3 tools/build_manifest.py
bash Upload_SmartAction_Sports.sh --dry-run
bash Upload_SmartAction_Sports.sh --push
```

只修改既有清單檔案也可執行 `bash Upload_SmartAction_Sports.sh --refresh-manifest`。模型更換需要同步更新 `.parts.json`，不能只更新外層清單。`--push --stage-only` 只上傳備份與暫存；`--batch-mib 32` 可調整批次。完整參數請用 `--help`。

`tests/`、`tools/`、預覽圖、ZIP、上傳腳本不部署到網站，但保留於完整附件供本機維護。模型分塊為真實 bytes，不是 Git LFS 指標。

## 容量、頻寬與多人使用

網站約 550 MB 等級，低於 Pages 1 GB 發布容量；腳本檢查最終保留內容。分塊只解決單檔問題，不增加總容量。GitHub Pages 每月約 100 GB 軟性頻寬限制，粗估僅約 180 次全新完整 AI 資源下載，還未計其他網站內容；快取與不使用模型會改變實際流量。

本機運算不是無限免費託管，不能保證十萬人同時下載、不延遲或永不當機。真正遠端真人對戰需另建同步服務。本版沒有聲稱已完成全部奧運／職業賽事項目或所有知名運動員。

## English quick start

Serve this folder over HTTP, then open the browser:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Open <http://127.0.0.1:8080/>. Choose a sport and click Start. Use WASD to move, arrows to aim, Q/E to jump/crouch, J to pass, and hold/release K for the main action. Baseball adds Z/C hip rotation and F/R shoulder adjustment. Touch controls sit below the canvas.

The 16 modes are simplified local practice games with local computer opponents, not online multiplayer or official league simulations. Athlete photos are reference cards; generic avatars and fictional game ratings do not represent licensed likenesses or official ability measurements. Real scene photos are not 3D geographic reconstructions.

The optional Qwen q8 coach runs on the visitor's CPU and requires approximately 546 MB of model/runtime assets. Its small-model quality is experimental. Node/Linux CPU inference has been tested; browser WASM, Intel Mac and mobile inference have not all been verified. Games work without loading the model.

Deploy with your SSH key: `bash Upload_SmartAction_Sports.sh --dry-run`, then `--push`. Set GitHub Pages to **main / (root)**. Rebuild manifests with `python3 tools/build_manifest.py` after changes. Read [guide.html](guide.html), [deployment instructions](docs/DEPLOY.html), [model details](docs/AI_COACH_MODEL.html), and [photo credits](data/ASSET_CREDITS.html).
