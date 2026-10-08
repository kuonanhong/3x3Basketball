# 將聰動 3×3 籃球放到現有 SmartAction GitHub Pages

`git pull` 是把 GitHub 上的更新下載到電腦；把電腦中的檔案上傳到 GitHub，使用 `git add`、`git commit`、`git push`。本遊戲是靜態 HTML／CSS／JavaScript，無需 npm、付費設計工具、GPU 伺服器或遊戲安裝程式。

本版是「每位訪客各自在自己的瀏覽器玩 3 對 3，其他球員由 AI 控制」。它可以被很多訪客同時開啟，但不包含六位真人共用同一場比賽的網路房間服務。

## 1. 先在電腦試玩

解壓完整附件包。雙擊獨立版 `SmartAction_3x3.html` 可直接試玩；獨立 HTML 已包含遊戲程式與介面，地圖仍需要網路及瀏覽器定位權限。

要測試完整資料夾版本，在含 `index.html` 的資料夾開終端機：

```bash
python3 -m http.server 8080
```

Windows 若 `python3` 不存在，使用：

```powershell
py -m http.server 8080
```

瀏覽器開啟 <http://localhost:8080/>。`localhost` 通常可測試定位權限；手機開電腦的區網 HTTP 網址時，定位可能因非安全連線而被瀏覽器停用。手機定位請以發布後的 GitHub Pages HTTPS 網址測試。按 `Ctrl+C` 可結束本機伺服器。

## 2. 準備 Git 與帳號

- macOS：安裝 Git，若尚未有開發工具，可執行 `xcode-select --install`；也可從 <https://git-scm.com/downloads> 安裝。
- Windows：安裝 Git for Windows，以下 Bash 命令可在 Git Bash 執行；後面另外提供 PowerShell 複製命令。
- Linux：用發行版的套件管理器安裝 Git。

驗證：

```bash
git --version
```

首次提交前設定自己的公開提交名稱與信箱。若不想公開私人信箱，可使用 GitHub Settings → Emails 提供的 `noreply` 信箱：

```bash
git config --global user.name "你的 GitHub 名稱"
git config --global user.email "你的 GitHub noreply 信箱"
```

透過 Git Credential Manager／系統瀏覽器登入 GitHub，或使用 SSH。GitHub Git 操作不要使用帳號密碼當作驗證密碼，也不要把 token 放到 HTML、網址或提交檔案。

## 3. 取得現有網站，保留原主頁

還沒有本機 SmartAction 專案時：

```bash
git clone https://github.com/kuonanhong/SmartAction.git
cd SmartAction
git status
git branch --show-current
```

已經有本機專案時，不需要再 clone；進入既有專案，先看狀態：

```bash
cd SmartAction
git status
git branch --show-current
git pull --ff-only
```

`git status` 若有你尚未提交的修改，先保存／提交自己的變更再拉取。若 `pull --ff-only` 顯示不能快轉，表示本機與遠端各有新提交；先檢視並合併差異，勿使用 `reset --hard` 或 `push --force` 覆蓋網站。

下文假設發布分支為 `main`。若你的 Pages 使用 `master` 或其他分支，後面的 `main` 應改成實際分支；以 Settings → Pages 的設定為準。

## 4. 新增遊戲資料夾，只複製網站必要檔

目標位置：

```text
SmartAction/
└── 動手動腦/
    └── 3x3-basketball/
        ├── index.html
        ├── styles.css
        ├── app.js
        ├── game-core.js
        ├── renderer.js
        ├── locales.js
        ├── sw.js
        ├── manifest.webmanifest
        ├── icon.svg
        └── guide.html
```

不要用附件包的 `index.html` 覆寫 SmartAction 主頁。ZIP、測試檔、開發工具、Markdown 文件與獨立 HTML 不需要放到這個公開遊戲目錄；教學用的 guide.html 請一同複製；最小 runtime 已足夠。

macOS／Linux／Windows Git Bash，在 SmartAction repository 內執行，將來源路徑改成你解壓後的實際位置：

```bash
game_source="/你的解壓位置/SmartAction_Basketball_20261007"
game_target="動手動腦/3x3-basketball"
mkdir -p "$game_target"
for game_file in index.html styles.css app.js game-core.js renderer.js locales.js sw.js manifest.webmanifest icon.svg guide.html; do
  cp "$game_source/$game_file" "$game_target/$game_file"
done
```

Windows PowerShell，亦在 SmartAction repository 內執行：

```powershell
$gameSource = "C:\Users\你的帳號\Downloads\SmartAction_Basketball_20261007"
$gameTarget = "動手動腦/3x3-basketball"
New-Item -ItemType Directory -Force -Path $gameTarget | Out-Null
$gameFiles = @("index.html", "styles.css", "app.js", "game-core.js", "renderer.js", "locales.js", "sw.js", "manifest.webmanifest", "icon.svg", "guide.html")
foreach ($gameFile in $gameFiles) {
  Copy-Item -LiteralPath (Join-Path $gameSource $gameFile) -Destination (Join-Path $gameTarget $gameFile)
}
```

本版使用相對資源路徑，因此可放在 `/SmartAction/動手動腦/3x3-basketball/` 的子目錄。不要將 CSS／JS 引用改成 `/app.js` 等站點根路徑，否則專案型 Pages 會去錯誤位置取檔。

若你原本的發布來源是 `/docs`，則目標改成 `docs/動手動腦/3x3-basketball/`，且對主頁的修改也應在 `docs/index.html`。若目前使用 GitHub Actions，請確認這個資料夾會被包含在既有發布 artifact 中。

## 5. 在既有聰動主頁加入入口

在現有主頁的「動手動腦」區塊加入，保留原來其他內容：

```html
<a href="./動手動腦/3x3-basketball/">聰動 3×3 籃球：免費網頁遊戲</a>
```

如果入口位於較深層的語言頁或文章頁，可使用包含 repository 名稱的完整站內路徑：

```html
<a href="/SmartAction/動手動腦/3x3-basketball/">聰動 3×3 籃球</a>
```

本包已有 22 種實際翻譯的 HTML 搜尋入口與 hreflang。若要發布這些入口，再複製 `lang/`：Bash 用 `cp -R "$game_source/lang" "$game_target/"`；PowerShell 用 `Copy-Item -LiteralPath (Join-Path $gameSource "lang") -Destination $gameTarget -Recurse -Force`。將附件 sitemap.xml 的遊戲網址條目合併到聰動既有 sitemap，保留原條目；不要覆蓋整站 sitemap。翻譯頁與 sitemap 不保證收錄或排名。

## 6. 提交與上傳

確認只包含你的新增內容：

```bash
git status
git diff -- index.html
git add -- "動手動腦/3x3-basketball"
```

若也修改了根目錄主頁／sitemap，可逐一加入，未修改的檔案不要加入：

```bash
git add -- index.html sitemap.xml
git diff --cached --stat
git commit -m "Add SmartAction original 3x3 basketball browser game"
git push origin main
```

若網站從 `docs` 發布，將上述 add 路徑相應改為 `docs/...`。若 `push` 被拒絕，先 `git fetch origin`、查看分支差異並正常合併，勿用強制推送。

## 7. GitHub Pages 設定與驗證

現有 SmartAction 已在運作，通常沿用它的 Pages 發布設定即可。新設網站才需要 Settings → Pages → Build and deployment → Deploy from a branch → 選 `main` 與 `/ (root)`，再 Save。若已使用 Actions，沿用現有 workflow。

純靜態網站若希望略過 Jekyll，可在「發布來源根目錄」建立空白 `.nojekyll`；若現有網站依賴 Jekyll 模板，應保留原設定。

發布後開啟：

<https://kuonanhong.github.io/SmartAction/動手動腦/3x3-basketball/>

首次部署可能需要數分鐘；到 repository 的 Actions 確認 Pages 部署成功。逐項檢查：主頁入口、遊戲開始、鍵盤／觸控、語言選擇、畫質調整、精彩重播、定位被拒絕後仍能玩、Google Maps 連結。遇到 404，先確認發布分支、folder 位置、檔名大小寫及 `index.html`。

遊戲更新若仍看到舊畫面，請重新整理並檢查離線快取；開發者可在 DevTools → Application → Service Workers／Storage 清除該遊戲快取。修改程式後先執行 `python3 tools/build_standalone.py`，它會自動依內容更新 `sw.js` 快取版本；再複製新 runtime 發布。

## 8. 檔案很大時怎麼辦

本遊戲採用程式生成圖形，沒有大型人物模型、貼圖、影片或付費素材。上傳 runtime 小檔即可，沒有必要上傳整個 ZIP 或安裝程式；完整附件包用於備份、閱讀和本機開發。

GitHub 官方限制（查核 2026-10-07）：

| 情境 | 限制／用途 |
|---|---|
| 網頁介面 Upload files | 單檔最大 25 MiB |
| 一般 Git 推送 | 單檔超過 50 MiB 會警告；超過 100 MiB 會被拒絕 |
| GitHub Pages | 發布站點最大 1 GB；來源 repository 建議不超過 1 GB |
| Pages 流量 | 每月 100 GB 軟限制，可能限流或要求移轉 |
| Git LFS | 可管理大型版本檔，但官方明示不能用於 GitHub Pages 網站 |
| GitHub Releases | 適合安裝包、下載 ZIP，不是讓大型遊戲資源自動變快的 Pages CDN |

若日後加入大型音樂、模型或影片，先壓縮、拆分、按需載入；對訪客直接播放的影片可以在使用者選擇後開啟 YouTube 或其他合適平台。大型靜態資源可另選物件儲存/CDN，並評估費用、CORS 與快取設定。Git LFS 不能替 Pages 解決讀取大型網站資源的問題。

### 尚未提交的大檔

把它移到 repository 外部備份；不要 `git add`。可在 `.gitignore` 加入本機附件檔名：

```gitignore
SmartAction_Basketball_FullPackage.zip
node_modules/
*.exe
```

如果已暫存但尚未提交，用 `git restore --staged -- "大檔案的實際路徑"` 移出暫存，不會刪除磁碟檔。

### 只在最後一個「未推送」提交加入大檔

先確認該提交尚未上傳或與他人共享，並在 repository 外備份大檔。下面只修正這個自己的未推送提交：

```bash
git rm --cached -- "大檔案的實際路徑"
git commit --amend --no-edit
git push origin main
```

只新增一個「刪除大檔」提交，無法移除更早提交中的大檔。如果大檔已在較早歷史或已分享出去，請先與協作者討論再清理歷史，不要直接執行全庫清理或強制推送。

### 只想提供下載附件

可在 GitHub Releases → Draft a new release，選版本 tag，將下載附件放進 release assets，於網頁加入下載連結。這不需要將 ZIP 提交到網站的 Git 歷史。若有安裝 GitHub CLI，可在 repository 內使用：

```bash
gh release create basketball-v1 --title "聰動 3×3 籃球 v1" --notes "原創網頁遊戲與完整來源附件。"
gh release upload basketball-v1 "/你的附件位置/SmartAction_Basketball_FullPackage.zip"
```

上面命令會建立公開版本，只在你準備好發布下載包時執行；本附件沒有替你執行任何 GitHub 上傳。

## 官方操作與限制文件

- `git pull`：<https://git-scm.com/docs/git-pull>
- `git push`：<https://git-scm.com/docs/git-push>
- GitHub Pages 建站：<https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site>
- GitHub Pages 限制：<https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>
- GitHub 大檔限制：<https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github>
- Git LFS 與 Pages 不相容：<https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage>
