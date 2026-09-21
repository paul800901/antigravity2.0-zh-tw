# Antigravity 2.0 繁體中文套件

將 Antigravity 2.0 的介面翻譯為台灣繁體中文。v1.2.0 已在 Windows 與 Antigravity 2.15.1 完成實機驗證，提供本機安裝、官方更新後自動重套、備份與還原功能。

Antigravity 2.0 Traditional Chinese Localization Toolkit is an open-source, community-maintained project for Taiwan Traditional Chinese. It unpacks and repacks the local Electron ASAR file without redistributing official Antigravity files. Translation is limited to recognized interface strings; user messages, assistant responses, editable values, code, terminals, and debug output are excluded. Version 1.2.0 was tested on Antigravity 2.15.1 for Windows.

---

## 簡介

**Antigravity 2.0 繁體中文套件**是一套開源的介面本地化工具，透過 ASAR 解包與重新打包機制，將 Antigravity 2.0 的英文介面翻譯為繁體中文。

目前驗證基準為 **Antigravity 2.15.1（Windows）**。Windows 可安裝背景維護器，在官方更新後自動重新套用已確認的翻譯；不認識的新英文會保留原文。

- 不修改官方核心二進位檔案
- 不散布官方 `app.asar` 或任何官方檔案
- 支援一鍵安裝與完整還原
- 所有操作在使用者本機端執行
- 僅翻譯明確的介面詞句，不對任意內容做片段取代
- 保護使用者訊息、Agent 回應、程式碼、終端機與可編輯內容

> 本專案為社群維護的非官方工具，與 Google 或 Antigravity 官方團隊無關。

---

## 畫面與驗證

v1.1.0 已完成 Windows 實機啟動、主介面及設定頁詞句讀回。`images/` 內為舊版歷史畫面，不代表目前 v1.1.0 的最終詞句。

---

## 下載方式

### 方式一：下載原始碼 ZIP

在 GitHub 專案頁按下 **Code → Download ZIP**，解壓縮後於專案目錄執行：

```bash
npm install
```

> ⚠️ 請下載完整專案，不要只下載單一 `.bat` 或 `.command` 檔。ZIP 不含 `node_modules/`，首次使用仍須執行 `npm install`。

### 方式二：Git Clone

```bash
git clone https://github.com/paul800901/antigravity2.0-zh-tw.git
cd antigravity2.0-zh-tw
npm install
```

---

## 功能特色

- 🌐 **繁體中文介面**：涵蓋主介面、設定頁、Agent 管理、MCP／知識庫頁面等多個區域
- 🖥️ **跨平台支援**：同時支援 Windows 與 macOS
- 🔧 **一鍵安裝**：雙擊腳本即可完成安裝，無需手動操作
- ♻️ **更新後自動重套**：Windows 背景維護器在官方更新後安全恢復已確認的翻譯
- 🔄 **完整還原**：隨時可還原為官方英文原版
- 🛡️ **安全備份**：首次安裝時自動備份官方 `app.asar`
- 📦 **離線運作**：使用本地 `@electron/asar`，不依賴 `npx` 動態下載
- 🎯 **精準翻譯**：採用完整詞句比對，避免誤改一般內容
- 🧱 **內容保護**：避開對話、Markdown、程式碼、終端機、編輯器與除錯輸出
- 🇹🇼 **台灣用語**：針對台灣常用介面詞句進行覆寫與自動檢查

---

## 官方更新後自動恢復繁中（Windows）

Antigravity 官方更新會重新覆蓋 `app.asar`。v1.2.0 提供 Windows 背景維護器，每分鐘及登入 Windows 時檢查一次：

- 已套用繁中：不做任何修改。
- 發現相容的官方新版：若 Antigravity 使用中則延後；程式關閉後自動備份該版官方原檔並重新套用繁中。
- 發現未知新版結構：停止修改、保留官方英文版並留下狀態紀錄，等待人工更新維護器。
- 新增但字典尚未收錄的英文：保留英文，不進行機器翻譯。

安裝背景維護器：

```powershell
powershell -ExecutionPolicy Bypass -File .\install-auto-maintainer.ps1
```

狀態與紀錄位於 `%LOCALAPPDATA%\AntigravityZhTW\`。移除背景維護器（不會還原或刪除現有繁中）：

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall-auto-maintainer.ps1
```

macOS 或未安裝背景維護器時，官方更新後仍可重新執行 `install-win.bat` 或 `install-macos.command`。

---

## 支援狀態

| 平台 | 安裝 | 還原 | UI 驗證 | 備註 |
|------|------|------|---------|------|
| macOS | ⚠️ 未重測 | ⚠️ 未重測 | ⚠️ 未重測 | v1.1.0 尚未重新進行 macOS 實機驗證 |
| Windows | ✅ 已通過 | ✅ 備份可用 | ✅ 已通過 | Antigravity 2.15.1 實機驗證完成，支援背景維護器 |

> 翻譯範圍持續補齊中。若在使用過程中發現未翻譯的文字，歡迎回報。

---

## 使用前需求

使用本套件前，請確認已安裝以下工具：

| 需求項目 | 說明 |
|----------|------|
| **Antigravity 2.0** | 本套件的翻譯對象，需先安裝 Antigravity |
| **Node.js LTS** | 前往 [nodejs.org](https://nodejs.org/) 下載安裝（安裝時會一併安裝 npm） |
| **npm** | 隨 Node.js 一同安裝，用於安裝本地依賴 |

### 首次使用前

在專案根目錄執行一次：

```bash
npm install
```

此步驟會安裝本地 `@electron/asar` 套件，用於 ASAR 解包與重新打包。本套件使用本地安裝的 `@electron/asar`，不依賴 `npx` 動態下載，確保離線環境也能正常運作。

---

## 快速開始

```bash
# 1. 確認已安裝 Node.js 與 npm
node -v
npm -v

# 2. 安裝依賴（僅首次需要）
npm install

# 3. 完全退出 Antigravity，然後執行安裝腳本
#    Windows：雙擊 install-win.bat
#    macOS：雙擊 install-macos.command

# 4. 重新啟動 Antigravity，即可看到繁體中文介面
```

---

## Windows 安裝

### 前置確認

開啟**命令提示字元**或 **PowerShell**，確認 Node.js 與 npm 已可使用：

```cmd
node -v
npm -v
```

若上述指令能正確輸出版本號，接著在專案目錄執行：

```cmd
npm install
```

### 安裝繁體中文

1. **完全退出** Antigravity 軟體。
2. 在本套件資料夾中，**雙擊執行 `install-win.bat`**。
3. 執行完成後，重新啟動 Antigravity，即可看到繁體中文介面。

### 手動指定安裝路徑

若 Antigravity 的安裝位置與預設不同，可使用以下方式手動指定：

```cmd
node localization_engine.js --install-dir "C:\Users\<你的使用者名稱>\AppData\Local\Programs\antigravity"
```

### Windows 常見問題

<details>
<summary><strong>node.exe 存取被拒（Access Denied）</strong></summary>

若執行 `node -v` 時出現「存取被拒」，通常代表系統 PATH 上的 `node.exe` 指向異常位置（例如 Windows App 安裝目錄）。解決方式：

1. 移除現有 Node.js 安裝
2. 從 [nodejs.org](https://nodejs.org/) 重新下載 LTS 版本安裝
3. 安裝完成後重新開啟終端機，確認 `node -v` 正常輸出版本號
</details>

<details>
<summary><strong>npm 不存在</strong></summary>

npm 隨 Node.js 一併安裝。若 `npm -v` 無法使用，請重新安裝 Node.js LTS 版本。安裝時確認勾選 npm 相關選項。
</details>

<details>
<summary><strong>Antigravity 安裝路徑不同</strong></summary>

引擎預設搜尋 `%LOCALAPPDATA%\Programs\antigravity`。若你的 Antigravity 安裝在其他位置，請使用 `--install-dir` 參數手動指定。
</details>

---

## macOS 安裝

### 前置確認

開啟 **Terminal**，確認 Node.js 與 npm 已可使用：

```bash
node -v
npm -v
```

若上述指令能正確輸出版本號，接著在專案目錄執行：

```bash
npm install
```

### 安裝繁體中文

1. **完全退出** Antigravity 軟體（選單列 → Antigravity → Quit，或 `Cmd+Q`）。
2. 在 Finder 中找到本套件資料夾，**雙擊執行 `install-macos.command`**。
   - 若系統提示「無法驗證開發者」，請在 Finder 中對檔案按右鍵 → **開啟**。
3. 執行完成後，重新啟動 Antigravity，即可看到繁體中文介面。

### .command 無法執行

若 `.command` 檔案雙擊無反應，請先在 Terminal 中授予執行權限：

```bash
chmod +x install-macos.command restore-macos.command
```

### 手動指定安裝路徑

若 Antigravity 的安裝位置與預設不同，可使用以下方式手動指定：

```bash
node localization_engine.js --install-dir "/Applications/Antigravity.app"
```

### macOS EPERM/EACCES 備份說明

首次安裝時，引擎會建立 `app.asar.bak` 備份檔。在某些 macOS 環境下可能遇到權限問題：

1. 引擎會先嘗試 `fs.copyFileSync` 建立備份
2. 若遇到 **EPERM** 或 **EACCES** 錯誤，會自動 fallback 到 `/bin/cp -p` 作為備援
3. 本套件**不會自動執行 `sudo`**

若 fallback 仍失敗，可手動建立備份後再執行安裝：

```bash
cp "/Applications/Antigravity.app/Contents/Resources/app.asar" \
   "/Applications/Antigravity.app/Contents/Resources/app.asar.bak"
```

---

## 還原官方原版

### Windows

雙擊執行 `restore-win.bat`，或在命令列執行：

```cmd
node localization_engine.js --restore
```

### macOS

雙擊執行 `restore-macos.command`，或在 Terminal 執行：

```bash
node localization_engine.js --restore
```

### 通用方式

任何平台均可使用以下指令還原：

```bash
node localization_engine.js --restore
```

> 還原時，引擎會使用首次安裝時建立的 `app.asar.bak` 回復官方原版。還原完成後，備份檔會被移除。

---

## 翻譯範圍

### 已翻譯區域

| 區域 | 說明 |
|------|------|
| 主介面文字 | 側邊欄、頂部導覽、一般按鈕與標籤 |
| 設定頁 | 完整設定面板、權限控制、子選單 |
| Agent / Workspace | Agent 管理頁面、工作區頁面 |
| MCP / Knowledge | MCP 伺服器與知識庫管理頁面 |
| 系統選單 | 標題列選單（檔案、編輯、檢視、視窗、說明） |
| 工作列 / 選單文字 | 工作列右鍵選單、Agent 狀態顯示 |
| 啟動畫面文字 | 載入動畫文字 |
| 鍵盤快捷鍵頁 | 快捷鍵描述與分類 |

> 目前共 **617 個翻譯詞彙**。

### 不翻譯區域

以下區域會自動避開翻譯，以確保使用體驗不受影響：

- 程式碼區（Monaco Editor）
- Terminal / 終端機
- 輸入框（`<input>`、`<textarea>`、`contenteditable`）
- `<code>`、`<pre>` 區塊
- SVG / Canvas 圖形元素
- Debug Console
- Suggest Widget（自動完成選單）

---

## 常見問題

<details>
<summary><strong>為什麼需要 npm install？</strong></summary>

本套件使用 `@electron/asar` 進行 ASAR 解包與重新打包。`npm install` 會將此工具安裝到本地 `node_modules/` 目錄，使安裝腳本能夠正常運作。只需在首次使用時執行一次。
</details>

<details>
<summary><strong>沒有 Node.js 可以用嗎？</strong></summary>

目前不行。本地化引擎以 Node.js 撰寫，需要 Node.js 執行 ASAR 解包、注入與重新打包。請前往 [nodejs.org](https://nodejs.org/) 安裝 LTS 版本。
</details>

<details>
<summary><strong>npx is not recognized 怎麼辦？</strong></summary>

本套件已改用本地 `@electron/asar`，不再依賴 `npx`。請確認已在專案根目錄執行 `npm install`，即可正常運作。
</details>

<details>
<summary><strong>node.exe 存取被拒怎麼辦？</strong></summary>

此問題通常出現在 Windows，代表系統 PATH 上的 `node.exe` 指向異常位置。請移除現有 Node.js，從 [nodejs.org](https://nodejs.org/) 重新下載 LTS 版本安裝，然後重新開啟終端機確認。
</details>

<details>
<summary><strong>Antigravity 更新後翻譯不見了怎麼辦？</strong></summary>

Antigravity 官方更新時，會重新覆蓋 `app.asar` 檔案，導致先前注入的繁體中文本地化內容被移除。這是正常現象，並非套件故障。

解決方式：

1. Windows 已安裝背景維護器：完全退出 Antigravity，維護器會在一分鐘內自動重新套用；下次開啟即恢復繁中。
2. Windows 未安裝背景維護器：執行 `install-auto-maintainer.ps1`，或手動執行 `install-win.bat`。
3. macOS：完全退出 Antigravity，再執行 `install-macos.command`。

如果 `%LOCALAPPDATA%\AntigravityZhTW\state.json` 顯示 `blocked_incompatible`，代表官方改變了程式結構。維護器會保留英文版而不強行修改，需先更新本專案。
</details>

<details>
<summary><strong>如何還原官方原版？</strong></summary>

Windows 執行 `restore-win.bat`、macOS 執行 `restore-macos.command`，或使用 `node localization_engine.js --restore`。還原時會使用 `app.asar.bak` 回復官方原版。
</details>

<details>
<summary><strong>是否會修改官方 app.asar？</strong></summary>

是的，安裝過程會解包 `app.asar`、注入翻譯程式碼後重新打包。但首次安裝時會自動建立 `app.asar.bak` 備份，可隨時還原為官方原版。
</details>

<details>
<summary><strong>是否會散布官方 app.asar？</strong></summary>

不會。本專案不包含、不散布 Antigravity 官方 `app.asar` 或任何官方二進位檔案。所有操作均在使用者本機端執行。
</details>

<details>
<summary><strong>為什麼 PROJECT_ID / SIGNATURE 還是 zh-hant-tw？</strong></summary>

`PROJECT_ID`（`antigravity2-zh-hant-tw`）與 `SIGNATURE`（`ZH-HANT-TW`）作為內部技術識別碼，用於套件名稱與注入區塊的清理邏輯。若變更這些識別碼，會導致舊版注入區塊無法被正確清理。因此保留原有識別碼以維持向下相容。
</details>

---

## 注意事項

1. **請先退出 Antigravity 再操作**：執行安裝或還原腳本前，請確認已完全退出 Antigravity，避免檔案被占用。
2. **官方更新後的處理**：已安裝 Windows 背景維護器時，關閉 Antigravity 後會自動重套；否則需手動執行安裝腳本。
3. **macOS Gatekeeper**：首次執行 `.command` 檔案時，若系統提示「無法驗證開發者」，請在 Finder 中對檔案按右鍵 → 開啟。
4. **Windows 權限**：若出現「存取被拒」，請對 `.bat` 檔案按右鍵 → **以系統管理員身份執行**。
5. **不要以 sudo 執行**：本套件不會自動使用 `sudo`，也不建議以 root 身份執行腳本。

---

## 授權

本專案採用 [Apache License 2.0](LICENSE) 授權。

---

## 免責聲明

- 本專案為非官方社群工具，與 Antigravity 官方無關。
- 本專案**不包含、不散布** Antigravity 官方 `app.asar` 或任何官方二進位檔案。
- 使用者應自行承擔修改本機應用程式資源的風險。
- 所有注入操作均在使用者本機端執行，並提供完整還原機制。
- 本專案依據 Apache License 2.0 以「現狀」（AS IS）提供，不附帶任何明示或暗示的保證。
