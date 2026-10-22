import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration & Persistence ──────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, "config.json");
const ALERTS_FILE = path.join(__dirname, "alerts.json");
const DEFAULT_PORT = parseInt(process.env.PORT || "3300", 10);
const INVO_BASE = "https://api.invoapp.com";

let config = {
  invoRefreshToken: "",
  pollIntervalMs: 3000,
  soundEnabled: true,
  desktopNotifications: true,
  discordWebhook: "",
  telegramBotToken: "",
  telegramChatId: "",
  watchedTrades: {},       // baseId -> { baseId, portfolioId, coin, side, addedAt }
  watchedPortfolios: {},   // portfolioId -> { portfolioId, title, trader, addedAt }
  lastActivePortfolioId: ""
};

// Load saved config if exists
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    config = { ...config, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn("[Config] Error loading config.json:", e.message);
}

// Auto-detect Invo refresh token from existing invo-sentinel installation if not configured
async function autoDetectRefreshToken() {
  if (config.invoRefreshToken && config.invoRefreshToken.trim().length > 20) {
    return config.invoRefreshToken;
  }

  // 1. Check ../invo-sentinel/bin/data/sentinel.db via better-sqlite3 or node:sqlite
  try {
    const dbPath = path.resolve(__dirname, "../invo-sentinel/bin/data/sentinel.db");
    if (fs.existsSync(dbPath)) {
      // Try better-sqlite3 from invo-sentinel
      try {
        const bsqlPath = path.resolve(__dirname, "../invo-sentinel/bin/node_modules/better-sqlite3");
        if (fs.existsSync(bsqlPath)) {
          const Database = (await import(pathToFileURL(bsqlPath).href)).default;
          const db = new Database(dbPath, { readonly: true, fileMustExist: true });
          const row = db.prepare("SELECT value FROM app_config WHERE key = 'invoRefreshToken'").get();
          if (row && row.value && row.value.length > 20) {
            console.log("[AutoDetect] Successfully imported Invo refresh token from sentinel.db");
            config.invoRefreshToken = row.value;
            saveConfig();
            return row.value;
          }
        }
      } catch (err) {
        // Fallback to binary string scan if sqlite driver not loadable directly
        const buf = fs.readFileSync(dbPath);
        const text = buf.toString("utf8");
        const match = text.match(/eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/);
        if (match && match[0]) {
          console.log("[AutoDetect] Discovered Invo token in sentinel.db stream");
          config.invoRefreshToken = match[0];
          saveConfig();
          return match[0];
        }
      }
    }
  } catch {}

  // 2. Check ../invo-sentinel/.env
  try {
    const envPath = path.resolve(__dirname, "../invo-sentinel/.env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const match = content.match(/INVO_REFRESH_TOKEN\s*=\s*(["']?)(.*?)\1(?:\r?\n|$)/);
      if (match && match[2] && match[2].length > 20) {
        console.log("[AutoDetect] Loaded Invo token from invo-sentinel/.env");
        config.invoRefreshToken = match[2].trim();
        saveConfig();
        return config.invoRefreshToken;
      }
    }
  } catch {}

  return config.invoRefreshToken || "";
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  } catch (e) {
    console.error("[Config] Failed to save config:", e.message);
  }
}

// Alerts history log
let alertsHistory = [];
try {
  if (fs.existsSync(ALERTS_FILE)) {
    alertsHistory = JSON.parse(fs.readFileSync(ALERTS_FILE, "utf8"));
  }
} catch {
  alertsHistory = [];
}

function saveAlerts() {
  try {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alertsHistory.slice(0, 500), null, 2), "utf8");
  } catch (e) {
    console.error("[Alerts] Failed to save alerts:", e.message);
  }
}

// ─── Invo API Client ──────────────────────────────────────────────────
class InvoClient {
  constructor(refreshToken) {
    this.refreshToken = refreshToken;
    this.accessToken = "";
  }

  getUserId() {
    try {
      const raw = (this.accessToken || this.refreshToken).replace("Bearer ", "");
      const payload = JSON.parse(Buffer.from(raw.split(".")[1], "base64").toString("utf8"));
      return payload.user_id || payload.sub;
    } catch {
      return null;
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) return false;
    try {
      const resp = await fetch(`${INVO_BASE}/v1_0/auth/refresh_token`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.refreshToken}`,
          "x-app-version": "0.0.75",
          "x-platform": "web"
        }
      });
      if (resp.status !== 200) return false;
      const data = await resp.json();
      if (data.accessToken) {
        this.accessToken = `Bearer ${data.accessToken}`;
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[InvoClient] Token refresh failed:", err.message);
      return false;
    }
  }

  async ensureToken() {
    if (this.accessToken) {
      try {
        const raw = this.accessToken.replace("Bearer ", "");
        const payload = JSON.parse(Buffer.from(raw.split(".")[1], "base64").toString("utf8"));
        const remainingSec = payload.expires - Date.now() / 1000;
        if (remainingSec > 30) return;
      } catch {}
    }
    const ok = await this.refreshAccessToken();
    if (!ok && !this.accessToken) {
      throw new Error("Unable to authenticate with Invo API. Check your Invo refresh token.");
    }
  }

  async post(path, body) {
    await this.ensureToken();
    const resp = await fetch(`${INVO_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: this.accessToken,
        "Content-Type": "application/json",
        "x-app-version": "0.0.75",
        "x-platform": "web"
      },
      body: JSON.stringify(body)
    });
    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      try {
        data = JSON.parse(Buffer.from(text, "base64").toString("utf8"));
      } catch {
        data = text;
      }
    }
    if (resp.status === 401) {
      const ok = await this.refreshAccessToken();
      if (ok) return this.post(path, body);
    }
    if (resp.status >= 400) {
      throw new Error(`Invo ${path} responded with error ${resp.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }

  async getFollowedPortfolios() {
    const data = await this.post("/v1_0/portfolios/get_users_followed_portfolios", {
      context: { filter: "following" },
      userId: this.getUserId(),
      params: { sinceTimestamp: 0, size: 100 }
    });
    return (data.savedPortfolios ?? []).map((sp) => sp.portfolio);
  }

  async getPortfolioById(portfolioId) {
    const data = await this.post("/v1_0/portfolios/get_portfolio_by_id", { portfolioId });
    return data.portfolio;
  }

  async getOpenInvestments(portfolioId) {
    const data = await this.post("/v1_0/investments/get_investments", {
      portfolioId,
      isOpen: true,
      params: { page: 1, size: 50 }
    });
    return data.investmentsTicker ?? [];
  }

  async getClosedInvestments(portfolioId, page = 1, size = 15) {
    const data = await this.post("/v1_0/investments/get_investments", {
      portfolioId,
      isOpen: false,
      params: { page, size }
    });
    return data.investmentsTicker ?? [];
  }
}

let invo = new InvoClient(config.invoRefreshToken);

// ─── Real-Time Trade Diff & Alert Watcher ──────────────────────────────
// Stores state snapshots of watched trades: baseId -> parsed state
const tradeSnapshots = new Map();
// Stores update history for individual trades: baseId -> Array of alerts/updates
const tradeHistory = new Map();
// SSE connected clients
const sseClients = new Set();

function broadcastEvent(event) {
  alertsHistory.unshift(event);
  if (alertsHistory.length > 500) alertsHistory.length = 500;
  saveAlerts();

  if (event.baseId) {
    if (!tradeHistory.has(event.baseId)) tradeHistory.set(event.baseId, []);
    tradeHistory.get(event.baseId).unshift(event);
  }

  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }

  // Push to external webhooks if configured
  sendDiscordWebhook(event).catch(() => {});
  sendTelegramAlert(event).catch(() => {});
}

// Helper to extract fields reliably across Invo payload shapes
function parseTrade(inv) {
  if (!inv) return null;
  const baseId = inv.baseId || inv.id || "";
  const coin = inv.ticker || inv.coin || "UNKNOWN";
  const isBuy = inv.directionLong === true || inv.isBuy === true || inv.side === "long";
  const entryPrice = parseFloat(inv.entryPrice || inv.price || 0) || null;
  const currentPrice = parseFloat(inv.currentPrice || inv.markPrice || entryPrice || 0) || null;
  const leverage = parseFloat(inv.leverage || 1);
  const size = parseFloat(inv.entrySize ?? inv.margin ?? inv.marginUsd ?? inv.size ?? 0);
  
  // TP values: could be in takeProfitPrice, takeProfit, tpPx, tp, targetProfit
  const tp = inv.takeProfitPrice ?? inv.takeProfit ?? inv.tpPx ?? inv.tp ?? null;
  const parsedTp = tp !== null && tp !== undefined && tp !== "" ? parseFloat(tp) : null;

  // SL values: could be in stopLossPrice, stopLoss, slPx, sl
  const sl = inv.stopLossPrice ?? inv.stopLoss ?? inv.slPx ?? inv.sl ?? null;
  const parsedSl = sl !== null && sl !== undefined && sl !== "" ? parseFloat(sl) : null;

  // PnL calculation
  let pnlPercent = parseFloat(inv.pnlPercent ?? 0);
  if ((!pnlPercent || pnlPercent === 0) && entryPrice && currentPrice) {
    const move = isBuy ? (currentPrice - entryPrice) / entryPrice : (entryPrice - currentPrice) / entryPrice;
    pnlPercent = move * leverage * 100;
  }

  return {
    baseId,
    coin,
    side: isBuy ? "LONG" : "SHORT",
    isBuy,
    leverage,
    size,
    entryPrice,
    currentPrice,
    tp: parsedTp,
    sl: parsedSl,
    pnlPercent,
    createdAt: inv.createdAt || new Date().toISOString(),
    trader: inv.owner?.username || inv.trader || "Trader",
    portfolioTitle: inv.portfolio?.title || "Portfolio",
    portfolioId: inv.portfolio?.id || "",
    raw: inv
  };
}

// Compare before vs after state and generate specific alerts
function diffAndAlert(oldState, newState, traderInfo = {}) {
  const coin = newState.coin;
  const side = newState.side;
  const trader = traderInfo.trader || newState.trader || "Trader";
  const portfolioTitle = traderInfo.portfolioTitle || newState.portfolioTitle || "Portfolio";
  const baseId = newState.baseId;

  // 1. Take Profit (TP) Change
  if (oldState.tp !== newState.tp) {
    if (oldState.tp === null && newState.tp !== null) {
      const pnlPct = newState.entryPrice ? (((newState.tp - newState.entryPrice) / newState.entryPrice) * (newState.isBuy ? 1 : -1) * newState.leverage * 100).toFixed(1) : null;
      broadcastEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "TP_UPDATE",
        severity: "fire",
        badge: "🎯 TP SET",
        title: `Take Profit Added · ${coin} ${side}`,
        message: `@${trader} set Take Profit to $${newState.tp.toLocaleString()}${pnlPct ? ` (${pnlPct >= 0 ? "+" : ""}${pnlPct}% target)` : ""}`,
        coin,
        side,
        trader,
        portfolioTitle,
        baseId,
        diff: { field: "takeProfit", old: null, new: newState.tp },
        sound: "tp_chime"
      });
    } else if (oldState.tp !== null && newState.tp === null) {
      broadcastEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "TP_UPDATE",
        severity: "warning",
        badge: "⚠️ TP REMOVED",
        title: `Take Profit Removed · ${coin} ${side}`,
        message: `@${trader} cleared the Take Profit order (was $${oldState.tp.toLocaleString()})`,
        coin,
        side,
        trader,
        portfolioTitle,
        baseId,
        diff: { field: "takeProfit", old: oldState.tp, new: null },
        sound: "sl_warning"
      });
    } else if (oldState.tp !== null && newState.tp !== null) {
      const move = newState.tp > oldState.tp ? "increased" : "decreased";
      const pctDiff = (((newState.tp - oldState.tp) / oldState.tp) * 100).toFixed(2);
      broadcastEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "TP_UPDATE",
        severity: "fire",
        badge: "🎯 TP MODIFIED",
        title: `Take Profit Updated · ${coin} ${side}`,
        message: `@${trader} moved TP from $${oldState.tp.toLocaleString()} ➔ $${newState.tp.toLocaleString()} (${pctDiff >= 0 ? "+" : ""}${pctDiff}%)`,
        coin,
        side,
        trader,
        portfolioTitle,
        baseId,
        diff: { field: "takeProfit", old: oldState.tp, new: newState.tp },
        sound: "tp_chime"
      });
    }
  }

  // 2. Stop Loss (SL) Change
  if (oldState.sl !== newState.sl) {
    if (oldState.sl === null && newState.sl !== null) {
      const riskPct = newState.entryPrice ? (((newState.sl - newState.entryPrice) / newState.entryPrice) * (newState.isBuy ? 1 : -1) * newState.leverage * 100).toFixed(1) : null;
      broadcastEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "SL_UPDATE",
        severity: "warning",
        badge: "🛑 SL SET",
        title: `Stop Loss Added · ${coin} ${side}`,
        message: `@${trader} set Stop Loss to $${newState.sl.toLocaleString()}${riskPct ? ` (${riskPct}% risk)` : ""}`,
        coin,
        side,
        trader,
        portfolioTitle,
        baseId,
        diff: { field: "stopLoss", old: null, new: newState.sl },
        sound: "sl_warning"
      });
    } else if (oldState.sl !== null && newState.sl === null) {
      broadcastEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "SL_UPDATE",
        severity: "danger",
        badge: "🚨 SL REMOVED",
        title: `Stop Loss Cleared · ${coin} ${side}`,
        message: `@${trader} removed Stop Loss protection (was $${oldState.sl.toLocaleString()}) - Naked Position!`,
        coin,
        side,
        trader,
        portfolioTitle,
        baseId,
        diff: { field: "stopLoss", old: oldState.sl, new: null },
        sound: "sl_warning"
      });
    } else if (oldState.sl !== null && newState.sl !== null) {
      const isTrailedProfit = newState.entryPrice && (
        (newState.isBuy && newState.sl > newState.entryPrice) ||
        (!newState.isBuy && newState.sl < newState.entryPrice)
      );
      broadcastEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "SL_UPDATE",
        severity: isTrailedProfit ? "success" : "warning",
        badge: isTrailedProfit ? "🛡️ SL TRAILED" : "🛑 SL MOVED",
        title: `Stop Loss Adjusted · ${coin} ${side}`,
        message: `@${trader} adjusted SL from $${oldState.sl.toLocaleString()} ➔ $${newState.sl.toLocaleString()}${isTrailedProfit ? " (Trailed into profit!)" : ""}`,
        coin,
        side,
        trader,
        portfolioTitle,
        baseId,
        diff: { field: "stopLoss", old: oldState.sl, new: newState.sl },
        sound: "sl_warning"
      });
    }
  }

  // 3. Position Size Increase (Scale In / Added Margin)
  if (newState.size > oldState.size + 0.05) {
    const diffPct = (((newState.size - oldState.size) / (oldState.size || 1)) * 100).toFixed(0);
    broadcastEvent({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: "POSITION_INCREASE",
      severity: "fire",
      badge: "🔼 POSITION INCREASED",
      title: `Scaled In · ${coin} ${side}`,
      message: `@${trader} increased position size from ${oldState.size}% ➔ ${newState.size}% margin (+${diffPct}% size expansion!)`,
      coin,
      side,
      trader,
      portfolioTitle,
      baseId,
      diff: { field: "entrySize", old: oldState.size, new: newState.size },
      sound: "scale_up"
    });
  }

  // 4. Position Size Decrease (Scale Out / Partial Close)
  if (newState.size < oldState.size - 0.05 && newState.size > 0) {
    const diffPct = (((oldState.size - newState.size) / (oldState.size || 1)) * 100).toFixed(0);
    broadcastEvent({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: "POSITION_DECREASE",
      severity: "success",
      badge: "🔽 POSITION TRIMMED",
      title: `Trimmed Position · ${coin} ${side}`,
      message: `@${trader} took partials / trimmed size from ${oldState.size}% ➔ ${newState.size}% margin (-${diffPct}% reduction)`,
      coin,
      side,
      trader,
      portfolioTitle,
      baseId,
      diff: { field: "entrySize", old: oldState.size, new: newState.size },
      sound: "scale_down"
    });
  }

  // 5. Leverage change
  if (oldState.leverage !== newState.leverage) {
    broadcastEvent({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: "LEVERAGE_UPDATE",
      severity: "info",
      badge: "⚡ LEVERAGE MODIFIED",
      title: `Leverage Changed · ${coin} ${side}`,
      message: `@${trader} changed leverage from ${oldState.leverage}x ➔ ${newState.leverage}x`,
      coin,
      side,
      trader,
      portfolioTitle,
      baseId,
      diff: { field: "leverage", old: oldState.leverage, new: newState.leverage },
      sound: "notification_ping"
    });
  }
}

// Background Poller Job
let pollingTimer = null;
let isPolling = false;

async function pollWatchedTrades() {
  if (isPolling) return;
  isPolling = true;

  try {
    // Gather all portfolio IDs that need checking
    const portfolioIds = new Set();
    for (const [baseId, item] of Object.entries(config.watchedTrades)) {
      if (item.portfolioId) portfolioIds.add(item.portfolioId);
    }
    for (const portId of Object.keys(config.watchedPortfolios)) {
      portfolioIds.add(portId);
    }
    if (config.lastActivePortfolioId) {
      portfolioIds.add(config.lastActivePortfolioId);
    }

    if (portfolioIds.size === 0) {
      isPolling = false;
      return;
    }

    for (const portfolioId of portfolioIds) {
      try {
        const [openRaw, portMeta] = await Promise.allSettled([
          invo.getOpenInvestments(portfolioId),
          invo.getPortfolioById(portfolioId)
        ]);

        const openTrades = openRaw.status === "fulfilled" ? openRaw.value : [];
        const meta = portMeta.status === "fulfilled" ? portMeta.value : null;
        const traderName = meta?.owner?.username || meta?.title || "Trader";
        const portfolioTitle = meta?.title || "Invo Portfolio";

        const currentTradesByBaseId = new Map();
        for (const raw of openTrades) {
          const parsed = parseTrade(raw);
          if (parsed && parsed.baseId) {
            parsed.trader = traderName;
            parsed.portfolioTitle = portfolioTitle;
            parsed.portfolioId = portfolioId;
            currentTradesByBaseId.set(parsed.baseId, parsed);
          }
        }

        // Check watched individual trades
        for (const [baseId, watchedInfo] of Object.entries(config.watchedTrades)) {
          if (watchedInfo.portfolioId !== portfolioId) continue;

          const current = currentTradesByBaseId.get(baseId);
          const previous = tradeSnapshots.get(baseId);

          if (previous && current) {
            // Diff against previous state
            diffAndAlert(previous, current, { trader: traderName, portfolioTitle });
            tradeSnapshots.set(baseId, current);
          } else if (!previous && current) {
            // First time seeing this trade
            tradeSnapshots.set(baseId, current);
          } else if (previous && !current) {
            // TRADE WAS CLOSED!
            const finalPnl = previous.pnlPercent ? `${previous.pnlPercent >= 0 ? "+" : ""}${previous.pnlPercent.toFixed(1)}%` : "exited";
            broadcastEvent({
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              type: "TRADE_CLOSED",
              severity: (previous.pnlPercent || 0) >= 0 ? "success" : "danger",
              badge: "🏁 TRADE CLOSED",
              title: `Trade Closed · ${previous.coin} ${previous.side}`,
              message: `@${traderName} fully closed ${previous.coin} ${previous.side} (${previous.leverage}x). Final return: ${finalPnl}`,
              coin: previous.coin,
              side: previous.side,
              trader: traderName,
              portfolioTitle,
              baseId,
              diff: { field: "status", old: "OPEN", new: "CLOSED" },
              sound: "close_triumph"
            });
            tradeSnapshots.delete(baseId);
            // Optionally remove from active watch or leave as closed marker
          }
        }

        // Check if watching entire portfolio (notify on brand new trades)
        if (config.watchedPortfolios[portfolioId]) {
          for (const [baseId, current] of currentTradesByBaseId) {
            if (!tradeSnapshots.has(baseId) && !config.watchedTrades[baseId]) {
              // Brand new trade detected!
              broadcastEvent({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                type: "NEW_TRADE",
                severity: "fire",
                badge: "🟢 NEW TRADE",
                title: `New Trade Opened · ${current.coin} ${current.side}`,
                message: `@${traderName} opened new ${current.side} on ${current.coin} at ${current.leverage}x leverage (${current.size}% margin)`,
                coin: current.coin,
                side: current.side,
                trader: traderName,
                portfolioTitle,
                baseId,
                diff: { field: "status", old: "NONE", new: "OPEN" },
                sound: "tp_chime"
              });
              tradeSnapshots.set(baseId, current);
            }
          }
        }
      } catch (err) {
        console.warn(`[Watcher] Error polling portfolio ${portfolioId}:`, err.message);
      }
    }
  } finally {
    isPolling = false;
  }
}

function startPollingLoop() {
  if (pollingTimer) clearInterval(pollingTimer);
  const interval = Math.max(1000, config.pollIntervalMs || 3000);
  pollingTimer = setInterval(pollWatchedTrades, interval);
  console.log(`[Watcher] Polling loop running every ${interval}ms`);
}

// ─── External Webhooks (Discord / Telegram) ───────────────────────────
async function sendDiscordWebhook(event) {
  if (!config.discordWebhook || !config.discordWebhook.startsWith("http")) return;
  const color = event.severity === "fire" ? 0xffb020 : event.severity === "danger" ? 0xff4d5a : 0x00f59b;
  const payload = {
    embeds: [
      {
        title: `${event.badge} · ${event.title}`,
        description: event.message,
        color,
        fields: [
          { name: "Trader", value: `@${event.trader}`, inline: true },
          { name: "Portfolio", value: event.portfolioTitle || "Invo", inline: true },
          { name: "Asset", value: `${event.coin} (${event.side})`, inline: true }
        ],
        footer: { text: "Invo Trade Watcher & Live Radar" },
        timestamp: event.timestamp
      }
    ]
  };
  try {
    await fetch(config.discordWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn("[Webhook] Discord error:", err.message);
  }
}

async function sendTelegramAlert(event) {
  if (!config.telegramBotToken || !config.telegramChatId) return;
  const text = `*${event.badge}*\n*${event.title}*\n${event.message}\n\n_Trader:_ @${event.trader}\n_Portfolio:_ ${event.portfolioTitle}`;
  try {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: config.telegramChatId, text, parse_mode: "Markdown" })
    });
  } catch (err) {
    console.warn("[Webhook] Telegram error:", err.message);
  }
}

// ─── HTTP Server & Static Serving ─────────────────────────────────────
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache, no-store"
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // CORS headers for local dev flexibility
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ─── API Routes ─────────────────────────────────────────────────────
  // 1. Get Config
  if (req.method === "GET" && pathname === "/api/config") {
    const masked = config.invoRefreshToken
      ? `${config.invoRefreshToken.slice(0, 8)}...${config.invoRefreshToken.slice(-6)}`
      : "";
    return sendJson(res, 200, {
      ...config,
      hasToken: !!config.invoRefreshToken,
      maskedToken: masked
    });
  }

  // 2. Save Config
  if (req.method === "POST" && pathname === "/api/config") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const token = payload.invoRefreshToken || payload.refreshToken;
        if (token && token.trim()) {
          config.invoRefreshToken = token.trim();
          invo = new InvoClient(config.invoRefreshToken);
        }
        if (payload.pollIntervalMs) {
          config.pollIntervalMs = Math.max(1000, parseInt(payload.pollIntervalMs, 10));
          startPollingLoop();
        }
        if (typeof payload.soundEnabled === "boolean") config.soundEnabled = payload.soundEnabled;
        if (typeof payload.desktopNotifications === "boolean") config.desktopNotifications = payload.desktopNotifications;
        if (typeof payload.discordWebhook === "string") config.discordWebhook = payload.discordWebhook.trim();
        const tgToken = payload.telegramBotToken || payload.telegramToken;
        if (typeof tgToken === "string") config.telegramBotToken = tgToken.trim();
        if (typeof payload.telegramChatId === "string") config.telegramChatId = payload.telegramChatId.trim();

        saveConfig();
        return sendJson(res, 200, { success: true, message: "Settings saved successfully.", config });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    });
    return;
  }

  // 3. Get Followed Portfolios
  if (req.method === "GET" && pathname === "/api/portfolios/followed") {
    try {
      const portfolios = await invo.getFollowedPortfolios();
      return sendJson(res, 200, { portfolios });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 4a. Get Specific Investment Details & Update History
  if (req.method === "GET" && pathname.startsWith("/api/portfolio/") && pathname.includes("/investment/")) {
    const parts = pathname.split("/");
    const portfolioId = parts[3];
    const investmentId = parts[5];
    try {
      config.lastActivePortfolioId = portfolioId;
      saveConfig();

      const [openRaw, meta] = await Promise.all([
        invo.getOpenInvestments(portfolioId).catch(() => []),
        invo.getPortfolioById(portfolioId).catch(() => null)
      ]);

      const traderName = meta?.owner?.username || meta?.title || "Trader";
      const portfolioTitle = meta?.title || "Portfolio";

      // Match in open investments
      const cleanTargetId = investmentId.replace(/-/g, "").toLowerCase();
      let matchedRaw = (openRaw || []).find((r) => {
        const id = String(r.baseId || r.id || r.investmentId || "").replace(/-/g, "").toLowerCase();
        return id === cleanTargetId;
      });
      let isOpen = true;

      if (!matchedRaw) {
        // Search in closed investments
        const closedRaw = await invo.getClosedInvestments(portfolioId, 1, 30).catch(() => []);
        matchedRaw = (closedRaw || []).find((r) => {
          const id = String(r.baseId || r.id || r.investmentId || "").replace(/-/g, "").toLowerCase();
          return id === cleanTargetId;
        });
        isOpen = false;
      }

      if (matchedRaw) {
        const parsed = parseTrade(matchedRaw);
        parsed.trader = traderName;
        parsed.portfolioTitle = portfolioTitle;
        parsed.portfolioId = portfolioId;
        parsed.isOpen = isOpen;

        // Auto-arm watcher for this trade
        config.watchedTrades[parsed.baseId] = {
          baseId: parsed.baseId,
          portfolioId,
          coin: parsed.coin,
          side: parsed.side,
          addedAt: new Date().toISOString()
        };
        tradeSnapshots.set(parsed.baseId, parsed);
        saveConfig();
        pollWatchedTrades().catch(() => {});

        return sendJson(res, 200, {
          success: true,
          portfolioId,
          investmentId,
          portfolio: meta,
          trade: parsed,
          isOpen,
          history: tradeHistory.get(parsed.baseId) || []
        });
      }

      return sendJson(res, 404, {
        success: false,
        error: `Investment ${investmentId} not found in open or recent closed investments for portfolio ${portfolioId}`,
        portfolio: meta
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 4. Get Single Portfolio Details
  if (req.method === "GET" && pathname.startsWith("/api/portfolio/") && !pathname.endsWith("/trades")) {
    const portfolioId = pathname.split("/")[3];
    try {
      const portfolio = await invo.getPortfolioById(portfolioId);
      return sendJson(res, 200, { portfolio });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 5. Get Portfolio Trades (Open & Recent Closed)
  if (req.method === "GET" && pathname.startsWith("/api/portfolio/") && pathname.endsWith("/trades")) {
    const portfolioId = pathname.split("/")[3];
    try {
      config.lastActivePortfolioId = portfolioId;
      saveConfig();

      const [openRaw, closedRaw, meta] = await Promise.all([
        invo.getOpenInvestments(portfolioId),
        invo.getClosedInvestments(portfolioId, 1, 10).catch(() => []),
        invo.getPortfolioById(portfolioId).catch(() => null)
      ]);

      const openTrades = openRaw.map((raw) => {
        const parsed = parseTrade(raw);
        if (meta) {
          parsed.trader = meta.owner?.username || meta.title || "Trader";
          parsed.portfolioTitle = meta.title || "Portfolio";
        }
        // Save initial snapshot if being watched
        if (config.watchedTrades[parsed.baseId] && !tradeSnapshots.has(parsed.baseId)) {
          tradeSnapshots.set(parsed.baseId, parsed);
        }
        return parsed;
      });

      const closedTrades = closedRaw.map(parseTrade);

      return sendJson(res, 200, {
        portfolioId,
        portfolio: meta,
        openTrades,
        closedTrades,
        watchedCount: Object.keys(config.watchedTrades).length
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 6. Watch Trade / Portfolio
  if (req.method === "POST" && pathname === "/api/watch") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { baseId, portfolioId, tradeData, watchAll } = JSON.parse(body);
        if (watchAll && portfolioId) {
          config.watchedPortfolios[portfolioId] = {
            portfolioId,
            title: tradeData?.portfolioTitle || "Portfolio",
            trader: tradeData?.trader || "Trader",
            addedAt: new Date().toISOString()
          };
        } else if (baseId) {
          config.watchedTrades[baseId] = {
            baseId,
            portfolioId,
            coin: tradeData?.coin || "COIN",
            side: tradeData?.side || "LONG",
            addedAt: new Date().toISOString()
          };
          if (tradeData) {
            tradeSnapshots.set(baseId, tradeData);
          }
        }
        saveConfig();
        // Trigger immediate poll
        pollWatchedTrades().catch(() => {});
        return sendJson(res, 200, { success: true, watchedTrades: config.watchedTrades, watchedPortfolios: config.watchedPortfolios });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    });
    return;
  }

  // 7. Unwatch Trade / Portfolio
  if (req.method === "POST" && pathname === "/api/unwatch") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { baseId, portfolioId } = JSON.parse(body);
        if (baseId && config.watchedTrades[baseId]) {
          delete config.watchedTrades[baseId];
          tradeSnapshots.delete(baseId);
        }
        if (portfolioId && config.watchedPortfolios[portfolioId]) {
          delete config.watchedPortfolios[portfolioId];
        }
        saveConfig();
        return sendJson(res, 200, { success: true, watchedTrades: config.watchedTrades, watchedPortfolios: config.watchedPortfolios });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    });
    return;
  }

  // 8. Watched Status
  if (req.method === "GET" && pathname === "/api/watch/status") {
    const list = [];
    for (const [baseId, item] of Object.entries(config.watchedTrades)) {
      const snap = tradeSnapshots.get(baseId);
      list.push({ ...item, snapshot: snap || null });
    }
    return sendJson(res, 200, {
      watchedTrades: list,
      watchedPortfolios: config.watchedPortfolios
    });
  }

  // 9. Alert Feed History
  if (req.method === "GET" && pathname === "/api/feed") {
    return sendJson(res, 200, { alerts: alertsHistory });
  }

  // 10. Clear Feed History
  if (req.method === "POST" && pathname === "/api/feed/clear") {
    alertsHistory = [];
    saveAlerts();
    return sendJson(res, 200, { success: true });
  }

  // 11. Test Alert Trigger
  if (req.method === "POST" && pathname === "/api/test-alert") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const { type = "TP_UPDATE", coin = "BTC", side = "LONG" } = JSON.parse(body || "{}");
      const sampleAlerts = {
        TP_UPDATE: {
          type: "TP_UPDATE",
          severity: "fire",
          badge: "🎯 TP MODIFIED",
          title: `Take Profit Updated · ${coin} ${side}`,
          message: `@CryptoWhale moved Take Profit from $68,500 ➔ $72,200 (+5.4%)`,
          diff: { field: "takeProfit", old: 68500, new: 72200 },
          sound: "tp_chime"
        },
        SL_UPDATE: {
          type: "SL_UPDATE",
          severity: "success",
          badge: "🛡️ SL TRAILED",
          title: `Stop Loss Trailed · ${coin} ${side}`,
          message: `@CryptoWhale trailed Stop Loss from $64,000 ➔ $66,500 (Locked in profit!)`,
          diff: { field: "stopLoss", old: 64000, new: 66500 },
          sound: "sl_warning"
        },
        POSITION_INCREASE: {
          type: "POSITION_INCREASE",
          severity: "fire",
          badge: "🔼 POSITION INCREASED",
          title: `Scaled In · ${coin} ${side}`,
          message: `@CryptoWhale scaled into ${coin}: increased margin from 10% ➔ 25% (+150% size expansion)`,
          diff: { field: "entrySize", old: 10, new: 25 },
          sound: "scale_up"
        },
        POSITION_DECREASE: {
          type: "POSITION_DECREASE",
          severity: "success",
          badge: "🔽 POSITION TRIMMED",
          title: `Trimmed Position · ${coin} ${side}`,
          message: `@CryptoWhale took partial profits: trimmed margin from 25% ➔ 12% (-52% reduction)`,
          diff: { field: "entrySize", old: 25, new: 12 },
          sound: "scale_down"
        },
        TRADE_CLOSED: {
          type: "TRADE_CLOSED",
          severity: "success",
          badge: "🏁 TRADE CLOSED",
          title: `Trade Closed · ${coin} ${side}`,
          message: `@CryptoWhale fully closed ${coin} ${side}. Realized Return: +38.4% profit!`,
          diff: { field: "status", old: "OPEN", new: "CLOSED" },
          sound: "close_triumph"
        }
      };
      const alertData = sampleAlerts[type] || sampleAlerts.TP_UPDATE;
      const event = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        coin,
        side,
        trader: "CryptoWhale",
        portfolioTitle: "Alpha Momentum Desk",
        baseId: "test-trade-1",
        ...alertData
      };
      broadcastEvent(event);
      return sendJson(res, 200, { success: true, event });
    });
    return;
  }

  // 12. Test Webhook
  if (req.method === "POST" && pathname === "/api/test-webhook") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      const { url, webhookUrl } = JSON.parse(body || "{}");
      const targetUrl = url || webhookUrl || config.discordWebhook;
      if (!targetUrl) return sendJson(res, 400, { error: "No webhook URL provided" });
      try {
        const payload = {
          embeds: [{
            title: "🎯 Test Alert · Invo Trade Radar Active",
            description: "Connection verified! You will receive live alerts for TP, SL, and size updates here.",
            color: 0x00f59b,
            footer: { text: "Invo Trade Watcher & Live Feed" },
            timestamp: new Date().toISOString()
          }]
        };
        const resp = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        return sendJson(res, 200, { success: resp.ok, status: resp.status });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // 12b. Test Telegram Alert
  if (req.method === "POST" && pathname === "/api/test-telegram") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      const { botToken, chatId } = JSON.parse(body || "{}");
      const token = (botToken || config.telegramBotToken || "").trim();
      const chat = (chatId || config.telegramChatId || "").trim();
      if (!token || !chat) {
        return sendJson(res, 400, { error: "Both Telegram Bot Token and Chat ID are required." });
      }
      try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chat,
            text: "🏛️ *OLYMPIAN RADAR VERIFIED*\n\nTelegram live trade alerts are active and connected to your Invo feed.",
            parse_mode: "Markdown"
          })
        });
        const data = await resp.json();
        return sendJson(res, 200, { success: resp.ok && data.ok, data });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // 13. SSE Live Events Stream
  if (req.method === "GET" && pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    res.write(":\n\n");
    sseClients.add(res);

    req.on("close", () => {
      sseClients.delete(res);
    });
    return;
  }

  // ─── Static Files (Root for GitHub Pages compatibility, fallback to public) ───
  let filePath = path.join(__dirname, pathname === "/" ? "index.html" : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, "public", pathname === "/" ? "index.html" : pathname);
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

// Start Server
async function main() {
  await autoDetectRefreshToken();
  startPollingLoop();

  server.listen(DEFAULT_PORT, () => {
    console.log("=======================================================");
    console.log("  INVO TRADE WATCHER & LIVE FEED (v1.0)");
    console.log("  Real-time TP / SL / Scale / Close Alert Radar");
    console.log("=======================================================");
    console.log(`  Local UI:   http://localhost:${DEFAULT_PORT}`);
    console.log(`  Invo Token: ${config.invoRefreshToken ? "LOADED & ACTIVE" : "MISSING (Set in UI)"}`);
    console.log("=======================================================");
  });
}

main().catch(console.error);
