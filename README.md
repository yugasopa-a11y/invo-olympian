# 🏛️ OLYMPIAN INVO RADAR (GitHub Pages Edition)

> **Majestic 100% Client-Side Web Application**  
> Built with Classical Olympian Greek White Marble architecture, crisp obsidian black text, and Corinthian gold accents.  
> **Deployable directly to GitHub Pages (`github.io`) — zero server required, no `start.bat` needed, runs natively in any browser on desktop or mobile!**

---

## 🏛️ What Makes This Special

- 🌐 **100% Static & Browser-Native**: Deploys straight to GitHub Pages. All polling, diffing, audio synthesis, and alert dispatches run right inside your browser.
- 🔑 **Pre-Loaded Invo Token**: Your Invo refresh token is already hardcoded as default, valid until year 2027. No manual login or copy-pasting needed.
- 🏛️ **Permanent Saved Watchlist**: Saves all your watched portfolios and pinned positions inside your browser (`localStorage`). They stay saved forever even when you close the tab or reboot.
- ⚡ **Direct Position Link Tracking**: Paste any Invo position link directly (e.g. `93fbfc8fdc0946b1a86aa1018ff6c9a3/investment/46f6ddc1961c4a09a5fe6ff81b72c2a4`) to lock onto that exact trade.
- 📊 **Real-Time PnL & TP/SL Meter**: Live PnL %, mark price position between Stop Loss (0%) and Take Profit (100%), and margin exposure.
- 📜 **Chronological Update History**: Audit trail logging every TP adjustment, SL movement, scale-in, profit trim, and trade closure.
- 📱 **Multi-Channel Alerts**:
  - Browser Web Audio tone synthesizer (zero external mp3 assets).
  - Native browser desktop notifications.
  - Direct Telegram bot alerts (sent straight from your browser).
  - Direct Discord webhook embeds (sent straight from your browser).
- 🛡️ **Built-in CORS Proxy Fallback**: Bypasses browser cross-origin blocks automatically so Invo API calls work seamlessly from `github.io`.

---

## 🚀 How to Deploy to GitHub Pages (2 Minutes)

Deploying to GitHub Pages is completely free and takes less than 2 minutes.

### Step 1: Create a Repository on GitHub
1. Go to [github.com/new](https://github.com/new).
2. Name your repository (e.g. `invo-radar` or `invo-trade-watcher`).
3. Choose **Private** (or Public; your Invo refresh token has no password/seed phrase, but Private is best for your personal use).
4. Do NOT initialize with a README (this folder already has everything).
5. Click **Create repository**.

### Step 2: Push This Folder to GitHub
Open your terminal (PowerShell or Git Bash) inside this folder (`c:\Users\yugas\Downloads\invo-sentinel-fast-v7.1\invo-trade-watcher`):

```bash
git init
git add .
git commit -m "Deploy Olympian Invo Radar to GitHub Pages"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>.git
git push -u origin main
```

*(Or drag-and-drop the files directly via the GitHub web interface if you prefer!)*

### Step 3: Enable GitHub Pages
1. In your GitHub repository, click **Settings** (tab at the top right).
2. In the left sidebar, click **Pages** (under the "Code and automation" section).
3. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: Select `main` (or `master`) and folder `/(root)`.
4. Click **Save**.

🎉 **That's it!** Within 60 seconds, GitHub will show your live website link at the top of the Pages screen:
```
https://<YOUR_GITHUB_USERNAME>.github.io/<YOUR_REPO_NAME>/
```

Bookmark that link on your phone, laptop, or desktop and use it anytime, anywhere!

---

## ⚡ How to Track a Specific Position

You can paste any Invo position / investment URL or ID straight into the search bar:

### Example Link:
```
93fbfc8fdc0946b1a86aa1018ff6c9a3/investment/46f6ddc1961c4a09a5fe6ff81b72c2a4
```
*Or full URL:*
```
https://app.invoapp.com/portfolio/93fbfc8fdc0946b1a86aa1018ff6c9a3/investment/46f6ddc1961c4a09a5fe6ff81b72c2a4
```

1. Paste the link into the search box.
2. Click **Track Position / Portfolio** (or press Enter).
3. The Oracle immediately arms:
   - **Cockpit HUD** displays the coin, direction (`LONG`/`SHORT`), leverage, live PnL %, mark price, and status (`🟢 ACTIVE POSITION`).
   - **TP/SL Visual Meter** displays where the mark price is sitting relative to Stop Loss and Take Profit.
   - **📜 Position Update History** shows the complete chronological audit trail of all changes made to this trade.
4. Click **🏛️ Pin Position** to save this position permanently to your **🏛️ Saved Watchlist** shelf.

---

## 🏛️ Managing Your Saved Watchlist

- Whenever you track a position or portfolio, click the **🏛️ Pin Position** or **🏛️ Pin Portfolio** button.
- Your pinned positions appear on the **🏛️ My Saved Watchlist** shelf at the top of the page.
- Click any chip to instantly reload and track that position.
- Click the `✕` on any chip to remove it from your watchlist.
- Everything is stored in your browser's `localStorage` so your list is preserved forever.

---

## ⚙️ Settings (⚙️)

Click **⚙️ Settings** in the topbar to configure:
1. **Invo Refresh Token**: Pre-filled with your token. If you ever generate a new token, paste it here and click **Save Settings**.
2. **CORS Proxy Mode**:
   - `Auto (Direct + Proxy fallback)` *(Recommended)*: Attempts direct connection, automatically falls back to `corsproxy.io` on GitHub Pages.
   - `corsproxy.io`: Forces proxy.
   - `Direct Invo API`: For local or extension-based usage.
3. **Telegram Bot Alerts**:
   - Enter your **Telegram Bot Token** and **Telegram Chat ID**.
   - Click **Test Telegram** to send an instant test ping to your phone.
4. **Discord Webhook Alerts**:
   - Paste your **Discord Webhook URL**.
   - Click **Test Discord** to verify live embeds.
5. **Polling Interval**: Select from 2.0s, 3.5s, 5.0s, or 10.0s.

---

## 💻 Optional: Running Locally (Offline)

If you ever want to preview it locally without GitHub:
- Simply double-click `index.html` to open it directly in Chrome, Brave, or Edge!
- Or run `start.bat` to launch the local Node server (`http://localhost:3300`).
