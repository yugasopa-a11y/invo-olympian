/**
 * OLYMPIAN INVO RADAR — Classical Greek Marble Architecture Edition
 * 100% Client-Side Static Web Application (GitHub Pages Compatible)
 * Direct Invo API Client + CORS Proxy Fallback + LocalStorage + Telegram/Discord Webhooks
 */

(function () {
  'use strict';

  // ───────────────────────────────────────────────────────────────────────────
  // Hardcoded Invo Refresh Token & Configuration Defaults
  // ───────────────────────────────────────────────────────────────────────────
  const HARDCODED_INVO_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZDA4ZjFkM2MtOGYxYi00YTEyLThkYTktYzcxNzRhOTE1NWFlIiwiZXhwaXJlcyI6MTgyMTY0ODExMC4yMjA4MDI4LCJkZXZpY2VfaWQiOiIxYTlhZjkzMC1mMTFhLTQyMmItOGZkNy05OTViMDc1OGYwZmYiLCJ0cmFkaW5nX2FjY291bnQiOnsiaWQiOiIyYjBkZWI2ZS04MDY2LTQwMjYtYTRiMC01ZjU3ZDJiNTA1ZjkiLCJwcm92aWRlciI6InR1cm5rZXkiLCJvcmdhbml6YXRpb25faWQiOiJhYTJkZmZkMi1kZDQxLTQ1NjMtYTEyZi02YTA0OWQxZjcyOWMiLCJ3YWxsZXRfYWRkcmVzcyI6IjB4RTM5YmM2MTlDOWQ5MjVBMzBiYzY3OTFDREFGMDlDN2UxQWRhRDdiNyIsInByaW1hcnkiOnRydWUsIndhbGxldCI6eyJldm1fYWRkcmVzcyI6IjB4RTM5YmM2MTlDOWQ5MjVBMzBiYzY3OTFDREFGMDlDN2UxQWRhRDdiNyIsInN2bV9hZGRyZXNzIjoiOTczU1VpaDFZTndVajdidXp5aUx1VDJ4NUxVU2ZVQjR4dnV6ejZIajNCWDQifX0sInJlZnJlc2hhYmxlIjp0cnVlfQ.n0CrSgLQvLFrM39DUxfRQXtmwV8IL-a2ZDqu5cvyO58";

  // App State
  const state = {
    invoToken: localStorage.getItem('olympian_invo_token') || HARDCODED_INVO_TOKEN,
    corsProxyMode: localStorage.getItem('olympian_cors_proxy') || 'auto',
    pollIntervalMs: parseInt(localStorage.getItem('olympian_poll_interval') || '3500', 10),
    discordWebhook: localStorage.getItem('olympian_discord_webhook') || '',
    telegramBotToken: localStorage.getItem('olympian_telegram_token') || '',
    telegramChatId: localStorage.getItem('olympian_telegram_chat') || '',
    soundEnabled: localStorage.getItem('olympian_sound_enabled') !== 'false',
    notifEnabled: localStorage.getItem('olympian_notif_enabled') === 'true',

    // Active tracking
    currentPortfolioId: '',
    currentInvestmentId: null,
    portfolioDetails: null,
    trades: [],
    watchedStatus: {
      active: false,
      baseId: null,
      portfolioId: null,
      traderName: null,
      tradeSnapshot: null,
      polledCount: 0,
      history: [],
    },

    // Persistent Watchlist (Saved Portfolios & Positions)
    savedWatchlist: JSON.parse(localStorage.getItem('olympian_saved_watchlist') || '[]'),
    // Trade Diff Snapshots (baseId -> parsed trade)
    tradeSnapshots: new Map(),
    // Live Feed Events
    feedEvents: JSON.parse(localStorage.getItem('olympian_feed_events') || '[]'),
    // Trade History (baseId -> Array of alerts)
    tradeHistory: JSON.parse(localStorage.getItem('olympian_trade_history') || '{}'),
    activeFilter: 'all',
  };

  // DOM Elements Map
  const el = {
    // Topbar
    connectionStatus: document.getElementById('connectionStatus'),
    beaconPill: document.getElementById('beaconPill'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    notifToggleBtn: document.getElementById('notifToggleBtn'),
    testAlertBtn: document.getElementById('testAlertBtn'),
    settingsBtn: document.getElementById('settingsBtn'),

    // Search Deck
    portfolioInput: document.getElementById('portfolioInput'),
    loadPortfolioBtn: document.getElementById('loadPortfolioBtn'),
    watchlistShelf: document.getElementById('watchlistShelf'),
    watchlistCount: document.getElementById('watchlistCount'),
    watchlistChips: document.getElementById('watchlistChips'),
    followedRow: document.getElementById('followedRow'),

    // Trader Dossier
    dossierSection: document.getElementById('dossierSection'),
    dossierAvatar: document.getElementById('dossierAvatar'),
    dossierName: document.getElementById('dossierName'),
    dossierBadge: document.getElementById('dossierBadge'),
    dossierId: document.getElementById('dossierId'),
    dossierFollowers: document.getElementById('dossierFollowers'),
    dossierDesc: document.getElementById('dossierDesc'),
    dossierOpenTrades: document.getElementById('dossierOpenTrades'),
    dossierWinRate: document.getElementById('dossierWinRate'),
    dossierReturn: document.getElementById('dossierReturn'),

    // Watched Position Cockpit HUD
    watchedHud: document.getElementById('watchedHud'),
    hudCoin: document.getElementById('hudCoin'),
    hudSideBadge: document.getElementById('hudSideBadge'),
    hudLevTag: document.getElementById('hudLevTag'),
    hudStatusBadge: document.getElementById('hudStatusBadge'),
    hudTraderTag: document.getElementById('hudTraderTag'),
    hudPnl: document.getElementById('hudPnl'),
    pinPositionBtn: document.getElementById('pinPositionBtn'),
    hudInvoLink: document.getElementById('hudInvoLink'),
    hudSlPrice: document.getElementById('hudSlPrice'),
    hudSlDiff: document.getElementById('hudSlDiff'),
    hudEntryPrice: document.getElementById('hudEntryPrice'),
    hudMarkPrice: document.getElementById('hudMarkPrice'),
    hudTpPrice: document.getElementById('hudTpPrice'),
    hudTpDiff: document.getElementById('hudTpDiff'),
    meterFill: document.getElementById('meterFill'),
    meterThumb: document.getElementById('meterThumb'),
    hudMargin: document.getElementById('hudMargin'),
    hudOpenedAt: document.getElementById('hudOpenedAt'),
    hudLastAction: document.getElementById('hudLastAction'),
    hudWatcherStatus: document.getElementById('hudWatcherStatus'),
    hudHistoryCount: document.getElementById('hudHistoryCount'),
    hudHistoryList: document.getElementById('hudHistoryList'),
    hudInvestmentIdTag: document.getElementById('hudInvestmentIdTag'),
    unwatchBtn: document.getElementById('unwatchBtn'),

    // Trades Deck
    tradesList: document.getElementById('tradesList'),
    openTradesCount: document.getElementById('openTradesCount'),
    refreshTradesBtn: document.getElementById('refreshTradesBtn'),

    // Feed
    feedContainer: document.getElementById('feedContainer'),
    feedCount: document.getElementById('feedCount'),
    clearFeedBtn: document.getElementById('clearFeedBtn'),
    filterBtns: document.querySelectorAll('.feed-filter-btn'),

    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    cfgRefreshToken: document.getElementById('cfgRefreshToken'),
    cfgCorsProxy: document.getElementById('cfgCorsProxy'),
    cfgPollInterval: document.getElementById('cfgPollInterval'),
    cfgDiscordWebhook: document.getElementById('cfgDiscordWebhook'),
    cfgTelegramToken: document.getElementById('cfgTelegramToken'),
    cfgTelegramChatId: document.getElementById('cfgTelegramChatId'),
    testDiscordBtn: document.getElementById('testDiscordBtn'),
    testTelegramBtn: document.getElementById('testTelegramBtn'),
    tokenHint: document.getElementById('tokenHint'),
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Browser-Native Invo API Client with CORS Proxy Fallback
  // ───────────────────────────────────────────────────────────────────────────
  class InvoClient {
    constructor(refreshToken, proxyMode = 'auto') {
      this.refreshToken = refreshToken;
      this.accessToken = '';
      this.proxyMode = proxyMode; // 'auto', 'corsproxy', 'allorigins', 'direct'
      this.activeProxy = null;
    }

    getUserId() {
      try {
        const raw = (this.accessToken || this.refreshToken).replace('Bearer ', '');
        const payload = JSON.parse(atob(raw.split('.')[1]));
        return payload.user_id;
      } catch {
        return '';
      }
    }

    // Build URL with optional CORS proxy wrapping
    formatUrl(targetUrl) {
      const mode = this.activeProxy || this.proxyMode;
      if (mode === 'corsproxy') {
        return `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
      }
      if (mode === 'allorigins') {
        return `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      }
      return targetUrl;
    }

    async refreshAccessToken() {
      const targetUrl = 'https://api.invoapp.com/v1_0/auth/refresh_token';
      const headers = {
        Authorization: `Bearer ${this.refreshToken}`,
        'x-app-version': '0.0.75',
        'x-platform': 'web',
      };

      try {
        // Try direct or configured proxy
        let resp = null;
        try {
          resp = await fetch(this.formatUrl(targetUrl), { method: 'GET', headers });
        } catch (directErr) {
          if (this.proxyMode === 'auto') {
            console.log('[InvoClient] Direct fetch failed (CORS), switching to corsproxy.io');
            this.activeProxy = 'corsproxy';
            resp = await fetch(this.formatUrl(targetUrl), { method: 'GET', headers });
          } else {
            throw directErr;
          }
        }

        if (!resp || !resp.ok) return false;
        const data = await resp.json();
        if (data && data.accessToken) {
          this.accessToken = `Bearer ${data.accessToken}`;
          return true;
        }
        return false;
      } catch (err) {
        console.warn('[InvoClient] refreshAccessToken error:', err.message);
        return false;
      }
    }

    async ensureToken() {
      if (this.accessToken) {
        try {
          const raw = this.accessToken.replace('Bearer ', '');
          const payload = JSON.parse(atob(raw.split('.')[1]));
          const remainingSec = payload.expires - Date.now() / 1000;
          if (remainingSec > 30) return;
        } catch {}
      }
      await this.refreshAccessToken();
    }

    async post(path, body) {
      await this.ensureToken();
      const targetUrl = `https://api.invoapp.com${path}`;
      const headers = {
        Authorization: this.accessToken,
        'Content-Type': 'application/json',
        'x-app-version': '0.0.75',
        'x-platform': 'web',
      };

      try {
        let resp = null;
        try {
          resp = await fetch(this.formatUrl(targetUrl), {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });
        } catch (err) {
          if (this.proxyMode === 'auto' && !this.activeProxy) {
            this.activeProxy = 'corsproxy';
            resp = await fetch(this.formatUrl(targetUrl), {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
            });
          } else {
            throw err;
          }
        }

        const text = await resp.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          try {
            data = JSON.parse(atob(text));
          } catch {
            data = text;
          }
        }

        if (resp.status === 401) {
          const ok = await this.refreshAccessToken();
          if (ok) return this.post(path, body);
        }

        if (!resp.ok) {
          throw new Error(`Invo ${path} responded with status ${resp.status}`);
        }

        return data;
      } catch (err) {
        throw err;
      }
    }

    async getFollowedPortfolios() {
      const data = await this.post('/v1_0/portfolios/get_users_followed_portfolios', {
        context: { filter: 'following' },
        userId: this.getUserId(),
        params: { sinceTimestamp: 0, size: 100 },
      });
      return (data.savedPortfolios ?? []).map((sp) => sp.portfolio);
    }

    async getPortfolioById(portfolioId) {
      const data = await this.post('/v1_0/portfolios/get_portfolio_by_id', { portfolioId });
      return data.portfolio;
    }

    async getOpenInvestments(portfolioId) {
      const data = await this.post('/v1_0/investments/get_investments', {
        portfolioId,
        isOpen: true,
        params: { page: 1, size: 50 },
      });
      return data.investmentsTicker ?? [];
    }

    async getClosedInvestments(portfolioId, page = 1, size = 20) {
      const data = await this.post('/v1_0/investments/get_investments', {
        portfolioId,
        isOpen: false,
        params: { page, size },
      });
      return data.investmentsTicker ?? [];
    }
  }

  let invo = new InvoClient(state.invoToken, state.corsProxyMode);

  // ───────────────────────────────────────────────────────────────────────────
  // Smart Link Parser: Supports Direct Position Links & Portfolio Links
  // ───────────────────────────────────────────────────────────────────────────
  function parseInvoLink(input) {
    if (!input) return { portfolioId: '', investmentId: null };
    let str = input.trim();
    str = str.split('?')[0].split('#')[0];

    // Pattern: ...portfolio/<portfolioId>/investment/<investmentId> or <portfolioId>/investment/<investmentId>
    const investMatch = str.match(/(?:portfolio\/)?([a-zA-Z0-9_-]{10,50})\/investment\/([a-zA-Z0-9_-]{10,50})/i);
    if (investMatch) {
      return {
        portfolioId: investMatch[1].trim(),
        investmentId: investMatch[2].trim(),
      };
    }

    // Pattern: ...portfolio/<portfolioId>
    const portMatch = str.match(/(?:portfolio\/)([a-zA-Z0-9_-]{10,50})/i);
    if (portMatch) {
      return {
        portfolioId: portMatch[1].trim(),
        investmentId: null,
      };
    }

    // Fallback: strip slashes
    const parts = str.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    return {
      portfolioId: last.trim(),
      investmentId: null,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Initialization
  // ───────────────────────────────────────────────────────────────────────────
  async function init() {
    setupEventListeners();
    updateAudioBtnUI();
    updateNotifBtnUI();
    renderWatchlist();
    renderFeed();

    // Fill settings inputs
    el.cfgRefreshToken.value = state.invoToken;
    el.cfgCorsProxy.value = state.corsProxyMode;
    el.cfgPollInterval.value = String(state.pollIntervalMs);
    el.cfgDiscordWebhook.value = state.discordWebhook;
    el.cfgTelegramToken.value = state.telegramBotToken;
    el.cfgTelegramChatId.value = state.telegramChatId;

    // Start in-browser polling loop
    startPollingLoop();

    // Check query params
    const urlParams = new URLSearchParams(window.location.search);
    const inputParam = urlParams.get('url') || urlParams.get('link') || urlParams.get('portfolio') || urlParams.get('id');
    if (inputParam) {
      el.portfolioInput.value = inputParam;
      await handleInputSubmission(inputParam);
    } else if (state.savedWatchlist.length > 0) {
      // Auto-load first item from saved watchlist
      const first = state.savedWatchlist[0];
      if (first.investmentId) {
        await loadSpecificInvestment(first.portfolioId, first.investmentId);
      } else {
        await loadPortfolio(first.portfolioId);
      }
    }

    // Load followed traders
    loadFollowedTraders().catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Handle Input Submission: Direct Investment Link OR Portfolio
  // ───────────────────────────────────────────────────────────────────────────
  async function handleInputSubmission(rawInput) {
    if (!rawInput) rawInput = el.portfolioInput.value.trim();
    if (!rawInput) return;

    const { portfolioId, investmentId } = parseInvoLink(rawInput);
    if (!portfolioId) {
      alert('Could not parse portfolio ID from input. Please enter a valid Invo link or ID.');
      return;
    }

    state.currentPortfolioId = portfolioId;
    state.currentInvestmentId = investmentId;

    el.loadPortfolioBtn.disabled = true;
    el.loadPortfolioBtn.textContent = 'Tracking Oracle...';

    try {
      if (investmentId) {
        await loadSpecificInvestment(portfolioId, investmentId);
      } else {
        await loadPortfolio(portfolioId);
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('Failed to load: ' + err.message);
    } finally {
      el.loadPortfolioBtn.disabled = false;
      el.loadPortfolioBtn.textContent = 'Track Position / Portfolio';
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Load Specific Single Investment (e.g. 93fbfc.../investment/46f6dd...)
  // ───────────────────────────────────────────────────────────────────────────
  async function loadSpecificInvestment(portfolioId, investmentId) {
    try {
      const [openRaw, meta] = await Promise.all([
        invo.getOpenInvestments(portfolioId).catch(() => []),
        invo.getPortfolioById(portfolioId).catch(() => null),
      ]);

      const traderName = meta?.owner?.username || meta?.title || 'Trader';
      const portfolioTitle = meta?.title || 'Portfolio';

      const cleanTargetId = investmentId.replace(/-/g, '').toLowerCase();
      let matchedRaw = (openRaw || []).find((r) => {
        const id = String(r.baseId || r.id || r.investmentId || '').replace(/-/g, '').toLowerCase();
        return id === cleanTargetId;
      });
      let isOpen = true;

      if (!matchedRaw) {
        const closedRaw = await invo.getClosedInvestments(portfolioId, 1, 30).catch(() => []);
        matchedRaw = (closedRaw || []).find((r) => {
          const id = String(r.baseId || r.id || r.investmentId || '').replace(/-/g, '').toLowerCase();
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

        state.portfolioDetails = meta;
        renderDossier(meta || { id: portfolioId, title: `Portfolio #${portfolioId}` });

        state.watchedStatus = {
          active: true,
          baseId: parsed.baseId,
          portfolioId: portfolioId,
          traderName: traderName,
          tradeSnapshot: parsed,
          polledCount: 1,
          history: state.tradeHistory[parsed.baseId] || [],
        };

        state.tradeSnapshots.set(parsed.baseId, parsed);
        renderWatchedHud();
        renderPositionHistory(state.watchedStatus.history);
        updatePinButtonUI();

        // Also populate left column with active portfolio trades
        state.trades = (openRaw || []).map(parseTrade);
        renderTradesList();

        if (state.soundEnabled && window.soundAlerts) {
          window.soundAlerts.trigger('notification_ping');
        }
      } else {
        // Fallback: load portfolio trades
        await loadPortfolio(portfolioId);
        alert(`Position ${investmentId} was not found among open or recent closed investments for portfolio ${portfolioId}.`);
      }
    } catch (err) {
      console.error('Error loading investment:', err);
      alert('Failed to load investment: ' + err.message);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Followed Traders Carousel
  // ───────────────────────────────────────────────────────────────────────────
  async function loadFollowedTraders() {
    try {
      const list = await invo.getFollowedPortfolios();
      el.followedRow.innerHTML = '<span style="font-size: 11.5px; font-weight: 700; color: var(--gold); padding-right: 4px;">Followed Traders:</span>';

      if (!Array.isArray(list) || list.length === 0) {
        el.followedRow.innerHTML += '<span style="font-size: 12px; color: var(--ink-muted); font-style: italic;">Enter portfolio or position link above.</span>';
        return;
      }

      list.forEach((p) => {
        if (!p) return;
        const id = p.id || p.portfolioId || p._id;
        const name = p.name || p.username || p.nickname || p.title || `Trader #${id}`;
        const initial = (name[0] || 'T').toUpperCase();

        const chip = document.createElement('div');
        chip.className = 'followed-chip';
        chip.dataset.portfolioId = id;
        chip.innerHTML = `
          <span class="chip-avatar">${initial}</span>
          <span>${escapeHtml(name)}</span>
          <span style="font-size: 9.5px; opacity: 0.65;">#${String(id).slice(-4)}</span>
        `;

        chip.addEventListener('click', () => {
          document.querySelectorAll('.followed-chip').forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          el.portfolioInput.value = id;
          loadPortfolio(id);
        });

        el.followedRow.appendChild(chip);
      });
    } catch (err) {
      console.warn('Failed to load followed portfolios:', err);
      el.followedRow.innerHTML = '<span style="font-size: 11.5px; font-weight: 700; color: var(--gold); padding-right: 4px;">Followed Traders:</span><span style="font-size: 12px; color: var(--ink-muted); font-style: italic;">Enter portfolio or position link above.</span>';
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Load Portfolio & Trades
  // ───────────────────────────────────────────────────────────────────────────
  async function loadPortfolio(portfolioId) {
    state.currentPortfolioId = portfolioId;

    try {
      const [meta, openRaw] = await Promise.all([
        invo.getPortfolioById(portfolioId).catch(() => ({ id: portfolioId, title: `Portfolio #${portfolioId}` })),
        invo.getOpenInvestments(portfolioId).catch(() => []),
      ]);

      state.portfolioDetails = meta;
      renderDossier(meta);

      const openTrades = (openRaw || []).map((raw) => {
        const parsed = parseTrade(raw);
        if (meta) {
          parsed.trader = meta.owner?.username || meta.title || 'Trader';
          parsed.portfolioTitle = meta.title || 'Portfolio';
        }
        return parsed;
      });

      state.trades = openTrades;
      renderTradesList();

      if (openTrades.length === 1 && !state.watchedStatus.active) {
        toggleWatchTrade(openTrades[0]);
      }
    } catch (err) {
      console.error('Error loading portfolio:', err);
      alert('Error fetching portfolio: ' + err.message);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Trader Dossier Rendering
  // ───────────────────────────────────────────────────────────────────────────
  function renderDossier(p) {
    el.dossierSection.style.display = 'grid';

    const name = p.name || p.username || p.nickname || p.title || p.owner?.username || `Portfolio #${p.id || state.currentPortfolioId}`;
    const initial = (name[0] || 'T').toUpperCase();
    el.dossierAvatar.textContent = initial;
    el.dossierName.innerHTML = `${escapeHtml(name)} <span class="lev-tag">ORACLE ACTIVE</span>`;
    el.dossierId.textContent = `ID: ${p.id || state.currentPortfolioId}`;
    el.dossierFollowers.textContent = p.followersCount ? `👥 ${p.followersCount} followers` : (p.savedCount ? `👥 ${p.savedCount} saves` : '👥 Invo Trader');
    el.dossierDesc.textContent = p.description ? `“${p.description.slice(0, 50)}”` : '';

    const openCount = p.openPositionsCount || (state.trades ? state.trades.length : 0);
    el.dossierOpenTrades.textContent = openCount;

    const winRate = p.winRate != null ? Number(p.winRate).toFixed(1) : (p.stats?.winRate ? Number(p.stats.winRate).toFixed(1) : '--');
    el.dossierWinRate.textContent = winRate !== '--' ? `${winRate}%` : '--%';

    const totalReturn = p.totalReturn != null ? Number(p.totalReturn).toFixed(1) : (p.stats?.roi ? Number(p.stats.roi).toFixed(1) : (p.roi != null ? Number(p.roi).toFixed(1) : '--'));
    el.dossierReturn.textContent = totalReturn !== '--' ? `${Number(totalReturn) >= 0 ? '+' : ''}${totalReturn}%` : '--%';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Open Trades Deck Rendering
  // ───────────────────────────────────────────────────────────────────────────
  function renderTradesList() {
    el.openTradesCount.textContent = state.trades.length;

    if (state.trades.length === 0) {
      el.tradesList.innerHTML = `
        <div class="feed-empty">
          No open positions detected on this portfolio currently.
          <br><span style="font-size: 11px; color: var(--ink-muted);">The Oracle will instantly alert you the moment this trader opens an entry.</span>
        </div>
      `;
      return;
    }

    el.tradesList.innerHTML = '';

    state.trades.forEach((trade) => {
      const baseId = String(trade.baseId || trade.id || trade._id);
      const isWatching =
        state.watchedStatus.active &&
        String(state.watchedStatus.baseId) === baseId;

      const coin = (trade.coin || trade.ticker || 'ASSET').toUpperCase().replace('USDT', '');
      const isLong = trade.side ? trade.side === 'LONG' : (trade.directionLong !== false && trade.isBuy !== false);
      const sideClass = isLong ? 'long' : 'short';
      const sideText = isLong ? 'LONG' : 'SHORT';
      const leverage = trade.leverage ? `${trade.leverage}x` : '10x';

      const entryPrice = trade.entryPrice ? formatPrice(trade.entryPrice) : '--';
      const markPrice = trade.currentPrice || trade.markPrice ? formatPrice(trade.currentPrice || trade.markPrice) : entryPrice;

      // PnL calculation
      let pnlText = '--';
      let pnlClass = '';
      if (trade.pnlPercent != null) {
        const val = Number(trade.pnlPercent);
        pnlText = `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
        pnlClass = val >= 0 ? 'color: var(--laurel-green)' : 'color: var(--spartan-red)';
      }

      // Size / Margin
      const sizeVal = trade.size ?? trade.entrySize;
      const sizeText = sizeVal != null ? `${sizeVal}%` : '--';

      // TP & SL
      const tp = trade.tp != null ? trade.tp : (trade.takeProfitPrice || trade.takeProfit);
      const sl = trade.sl != null ? trade.sl : (trade.stopLossPrice || trade.stopLoss);

      const card = document.createElement('div');
      card.className = `trade-card ${isWatching ? 'watching' : ''}`;
      card.innerHTML = `
        <div class="trade-card-top">
          <div class="trade-card-coin">
            <span>${coin}</span>
            <span class="side-badge ${sideClass}">${sideText}</span>
            <span class="lev-tag">${leverage}</span>
          </div>
          <div style="font: 800 13.5px var(--font-mono); ${pnlClass}">
            ${pnlText}
          </div>
        </div>

        <div class="trade-card-mid">
          <div>
            Entry
            <strong>$${entryPrice}</strong>
          </div>
          <div>
            Mark
            <strong>$${markPrice}</strong>
          </div>
          <div>
            Margin Size
            <strong>${sizeText}</strong>
          </div>
        </div>

        <div class="tpsl-pills">
          <span class="tpsl-pill tp">🎯 TP: ${tp ? '$' + formatPrice(tp) : 'None'}</span>
          <span class="tpsl-pill sl">🛡️ SL: ${sl ? '$' + formatPrice(sl) : 'None'}</span>
        </div>

        <div class="trade-card-actions">
          <button class="watch-toggle-btn ${isWatching ? 'active' : ''}" data-base-id="${baseId}">
            ${isWatching ? '◉ WATCHING THIS TRADE' : '⊕ WATCH THIS TRADE'}
          </button>
        </div>
      `;

      const watchBtn = card.querySelector('.watch-toggle-btn');
      watchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleWatchTrade(trade);
      });

      card.addEventListener('click', () => {
        toggleWatchTrade(trade);
      });

      el.tradesList.appendChild(card);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Watch / Unwatch Actions
  // ───────────────────────────────────────────────────────────────────────────
  function toggleWatchTrade(trade) {
    const baseId = String(trade.baseId || trade.id || trade._id);
    const isCurrentlyWatched =
      state.watchedStatus.active &&
      String(state.watchedStatus.baseId) === baseId;

    if (isCurrentlyWatched) {
      unwatchCurrent();
    } else {
      state.watchedStatus = {
        active: true,
        baseId,
        portfolioId: state.currentPortfolioId,
        traderName: trade.trader || state.portfolioDetails?.name || 'Trader',
        tradeSnapshot: trade,
        polledCount: 1,
        history: state.tradeHistory[baseId] || [],
      };
      state.tradeSnapshots.set(baseId, trade);
      renderWatchedHud();
      renderTradesList();
      renderPositionHistory(state.watchedStatus.history);
      updatePinButtonUI();

      if (state.soundEnabled && window.soundAlerts) {
        window.soundAlerts.trigger('notification_ping');
      }
    }
  }

  function unwatchCurrent() {
    state.watchedStatus = {
      active: false,
      baseId: null,
      portfolioId: null,
      traderName: null,
      tradeSnapshot: null,
      polledCount: 0,
      history: [],
    };
    renderWatchedHud();
    renderTradesList();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Saved Watchlist Shelf (Persistent via LocalStorage)
  // ───────────────────────────────────────────────────────────────────────────
  function renderWatchlist() {
    el.watchlistCount.textContent = state.savedWatchlist.length;

    if (state.savedWatchlist.length === 0) {
      el.watchlistChips.innerHTML = `
        <span style="font-size: 12px; color: var(--ink-muted); font-style: italic;">
          No positions saved yet. Click "⭐ Pin" on any position to keep it saved permanently.
        </span>
      `;
      return;
    }

    el.watchlistChips.innerHTML = '';

    state.savedWatchlist.forEach((item, index) => {
      const chip = document.createElement('div');
      const isCurrent = state.watchedStatus.active && state.watchedStatus.baseId === item.baseId;
      chip.className = `watchlist-chip ${isCurrent ? 'active' : ''}`;

      const title = item.coin ? `${item.coin} ${item.side || ''}` : (item.trader || `Port #${item.portfolioId.slice(0, 6)}`);

      chip.innerHTML = `
        <span>🏛️ ${escapeHtml(title)}</span>
        <span style="font-size: 10px; opacity: 0.7;">@${escapeHtml(item.trader || 'Trader')}</span>
        <span class="watchlist-chip-remove" title="Remove from watchlist">&times;</span>
      `;

      chip.querySelector('.watchlist-chip-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromWatchlist(index);
      });

      chip.addEventListener('click', () => {
        if (item.investmentId) {
          loadSpecificInvestment(item.portfolioId, item.investmentId);
        } else {
          loadPortfolio(item.portfolioId);
        }
      });

      el.watchlistChips.appendChild(chip);
    });
  }

  function togglePinCurrentPosition() {
    if (!state.watchedStatus.active || !state.watchedStatus.tradeSnapshot) return;
    const trade = state.watchedStatus.tradeSnapshot;
    const baseId = state.watchedStatus.baseId;
    const portfolioId = state.watchedStatus.portfolioId;

    const existingIdx = state.savedWatchlist.findIndex((w) => w.baseId === baseId);
    if (existingIdx >= 0) {
      // Remove
      state.savedWatchlist.splice(existingIdx, 1);
    } else {
      // Add
      state.savedWatchlist.unshift({
        baseId,
        portfolioId,
        investmentId: baseId,
        coin: trade.coin,
        side: trade.side,
        trader: state.watchedStatus.traderName,
        addedAt: new Date().toISOString(),
      });
    }

    localStorage.setItem('olympian_saved_watchlist', JSON.stringify(state.savedWatchlist));
    renderWatchlist();
    updatePinButtonUI();
  }

  function updatePinButtonUI() {
    if (!state.watchedStatus.active) return;
    const baseId = state.watchedStatus.baseId;
    const isPinned = state.savedWatchlist.some((w) => w.baseId === baseId);
    if (isPinned) {
      el.pinPositionBtn.textContent = '★ Pinned';
      el.pinPositionBtn.style.background = 'var(--gold)';
      el.pinPositionBtn.style.color = '#ffffff';
    } else {
      el.pinPositionBtn.textContent = '⭐ Pin';
      el.pinPositionBtn.style.background = '#ffffff';
      el.pinPositionBtn.style.color = 'var(--gold)';
    }
  }

  function removeFromWatchlist(index) {
    state.savedWatchlist.splice(index, 1);
    localStorage.setItem('olympian_saved_watchlist', JSON.stringify(state.savedWatchlist));
    renderWatchlist();
    updatePinButtonUI();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Cockpit HUD (Watched Trade Range Meter & Real-time Stats)
  // ───────────────────────────────────────────────────────────────────────────
  function renderWatchedHud() {
    if (!state.watchedStatus.active || !state.watchedStatus.tradeSnapshot) {
      el.watchedHud.style.display = 'none';
      return;
    }

    el.watchedHud.style.display = 'block';

    const trade = state.watchedStatus.tradeSnapshot;
    const coin = (trade.coin || trade.ticker || 'ASSET').toUpperCase().replace('USDT', '');
    const isLong = trade.side ? trade.side === 'LONG' : (trade.directionLong !== false && trade.isBuy !== false);
    const leverage = trade.leverage ? `${trade.leverage}x` : '10x';

    el.hudCoin.textContent = `${coin} / USDT`;
    el.hudSideBadge.className = `side-badge ${isLong ? 'long' : 'short'}`;
    el.hudSideBadge.textContent = isLong ? 'LONG' : 'SHORT';
    el.hudLevTag.textContent = leverage;
    el.hudTraderTag.textContent = `Trader: @${state.watchedStatus.traderName || state.watchedStatus.portfolioId}`;

    const isOpen = trade.isOpen !== false;
    el.hudStatusBadge.className = `status-badge ${isOpen ? 'open' : 'closed'}`;
    el.hudStatusBadge.textContent = isOpen ? 'ACTIVE POSITION' : 'CLOSED POSITION';

    const pid = state.watchedStatus.portfolioId || state.currentPortfolioId;
    const bid = state.watchedStatus.baseId;
    if (pid && bid) {
      el.hudInvoLink.href = `https://app.invoapp.com/portfolio/${pid}/investment/${bid}`;
      el.hudInvoLink.style.display = 'inline-flex';
      el.hudInvestmentIdTag.textContent = `Investment ID: ${bid}`;
    } else {
      el.hudInvoLink.style.display = 'none';
      el.hudInvestmentIdTag.textContent = '';
    }

    const entry = Number(trade.entryPrice || 0);
    const mark = Number(trade.currentPrice || trade.markPrice || entry);
    const tp = trade.tp != null ? Number(trade.tp) : (trade.takeProfitPrice ? Number(trade.takeProfitPrice) : null);
    const sl = trade.sl != null ? Number(trade.sl) : (trade.stopLossPrice ? Number(trade.stopLossPrice) : null);

    el.hudEntryPrice.textContent = `$${formatPrice(entry)}`;
    el.hudMarkPrice.textContent = `Mark: $${formatPrice(mark)}`;
    el.hudTpPrice.textContent = tp ? `$${formatPrice(tp)}` : 'Not Set';
    el.hudSlPrice.textContent = sl ? `$${formatPrice(sl)}` : 'Not Set';

    let pnlVal = 0;
    if (trade.pnlPercent != null) {
      pnlVal = Number(trade.pnlPercent);
    } else if (entry > 0 && mark > 0) {
      const levNum = parseFloat(leverage) || 1;
      pnlVal = isLong ? ((mark - entry) / entry) * 100 * levNum : ((entry - mark) / entry) * 100 * levNum;
    }

    el.hudPnl.className = `hud-pnl ${pnlVal >= 0 ? 'positive' : 'negative'}`;
    el.hudPnl.textContent = `${pnlVal >= 0 ? '+' : ''}${pnlVal.toFixed(2)}%`;

    if (tp && sl && tp !== sl) {
      let pct = 50;
      if (isLong) {
        pct = ((mark - sl) / (tp - sl)) * 100;
      } else {
        pct = ((sl - mark) / (sl - tp)) * 100;
      }
      pct = Math.max(0, Math.min(100, pct));
      el.meterThumb.style.left = `${pct.toFixed(1)}%`;
      el.meterFill.style.width = `${pct.toFixed(1)}%`;

      const tpDiff = isLong ? ((tp - mark) / mark) * 100 : ((mark - tp) / mark) * 100;
      const slDiff = isLong ? ((mark - sl) / mark) * 100 : ((sl - mark) / mark) * 100;

      el.hudTpDiff.textContent = tpDiff > 0 ? `+${tpDiff.toFixed(2)}% away` : 'Target Reached!';
      el.hudSlDiff.textContent = slDiff > 0 ? `-${slDiff.toFixed(2)}% buffer` : 'SL Breached!';
    } else {
      el.meterThumb.style.left = '50%';
      el.meterFill.style.width = '50%';
      el.hudTpDiff.textContent = tp ? 'Watching' : 'No target';
      el.hudSlDiff.textContent = sl ? 'Watching' : 'No stop';
    }

    const sizeVal = trade.size ?? trade.entrySize;
    el.hudMargin.textContent = sizeVal != null ? `${sizeVal}% Portfolio Margin` : '--';
    el.hudOpenedAt.textContent = trade.createdAt ? formatTimestamp(trade.createdAt) : 'Active';
    el.hudWatcherStatus.textContent = isOpen ? 'ORACLE MONITORING' : 'POSITION CLOSED';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Position Update History Timeline
  // ───────────────────────────────────────────────────────────────────────────
  function renderPositionHistory(historyList) {
    const list = Array.isArray(historyList) ? historyList : [];
    el.hudHistoryCount.textContent = list.length;

    if (list.length === 0) {
      el.hudHistoryList.innerHTML = `
        <div style="font-size: 12px; color: var(--ink-muted); font-style: italic; padding: 6px 0;">
          No updates recorded yet. Any TP, SL, size changes or exits will be cataloged here in real time.
        </div>
      `;
      return;
    }

    el.hudHistoryList.innerHTML = '';

    list.forEach((event) => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: var(--panel-warm); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 12px;';

      const timeStr = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
      const badge = event.badge || event.type || 'UPDATE';
      const desc = event.message || event.title || 'Position update';

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font: 800 10.5px var(--font-mono); color: var(--gold); background: var(--gold-dim); padding: 2px 6px; border-radius: 4px;">${escapeHtml(badge)}</span>
          <span style="font-weight: 600; color: var(--ink-primary);">${escapeHtml(desc)}</span>
        </div>
        <span style="font: 600 11px var(--font-mono); color: var(--ink-muted); white-space: nowrap;">${timeStr}</span>
      `;

      el.hudHistoryList.appendChild(item);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // In-Browser Trade Diff Poller Engine
  // ───────────────────────────────────────────────────────────────────────────
  let pollingTimer = null;
  let isPolling = false;

  function startPollingLoop() {
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(pollCycle, Math.max(1500, state.pollIntervalMs));
  }

  async function pollCycle() {
    if (isPolling) return;
    isPolling = true;

    try {
      // Gather portfolio IDs to scan
      const portfolioIds = new Set();
      if (state.currentPortfolioId) portfolioIds.add(state.currentPortfolioId);
      state.savedWatchlist.forEach((w) => {
        if (w.portfolioId) portfolioIds.add(w.portfolioId);
      });

      if (portfolioIds.size === 0) return;

      for (const portfolioId of portfolioIds) {
        try {
          const [openRaw, meta] = await Promise.all([
            invo.getOpenInvestments(portfolioId).catch(() => []),
            invo.getPortfolioById(portfolioId).catch(() => null),
          ]);

          const traderName = meta?.owner?.username || meta?.title || 'Trader';
          const portfolioTitle = meta?.title || 'Portfolio';

          const currentTradesByBaseId = new Map();
          for (const raw of openRaw || []) {
            const parsed = parseTrade(raw);
            if (parsed && parsed.baseId) {
              parsed.trader = traderName;
              parsed.portfolioTitle = portfolioTitle;
              parsed.portfolioId = portfolioId;
              currentTradesByBaseId.set(parsed.baseId, parsed);
            }
          }

          // If current portfolio, refresh active trades list
          if (portfolioId === state.currentPortfolioId) {
            state.trades = Array.from(currentTradesByBaseId.values());
            renderTradesList();
          }

          // Check watched trade if on this portfolio
          if (state.watchedStatus.active && state.watchedStatus.portfolioId === portfolioId) {
            const baseId = state.watchedStatus.baseId;
            const current = currentTradesByBaseId.get(baseId);
            const previous = state.tradeSnapshots.get(baseId);

            if (previous && current) {
              diffAndAlert(previous, current, { trader: traderName, portfolioTitle });
              state.tradeSnapshots.set(baseId, current);
              state.watchedStatus.tradeSnapshot = current;
              renderWatchedHud();
            } else if (!previous && current) {
              state.tradeSnapshots.set(baseId, current);
              state.watchedStatus.tradeSnapshot = current;
              renderWatchedHud();
            } else if (previous && !current) {
              // Trade was closed!
              const finalPnl = previous.pnlPercent ? `${previous.pnlPercent >= 0 ? '+' : ''}${previous.pnlPercent.toFixed(1)}%` : 'exited';
              triggerAlert({
                type: 'TRADE_CLOSED',
                severity: (previous.pnlPercent || 0) >= 0 ? 'success' : 'danger',
                badge: '🏁 TRADE CLOSED',
                title: `Trade Closed · ${previous.coin} ${previous.side}`,
                message: `@${traderName} closed position on ${previous.coin} (${previous.leverage}x). Final PnL: ${finalPnl}`,
                coin: previous.coin,
                side: previous.side,
                trader: traderName,
                portfolioTitle,
                baseId,
                sound: 'close_triumph',
                diff: { field: 'status', old: 'OPEN', new: 'CLOSED' },
              });
              previous.isOpen = false;
              renderWatchedHud();
            }
          }
        } catch (portErr) {
          console.warn(`[Poll] Error on portfolio ${portfolioId}:`, portErr.message);
        }
      }
    } finally {
      isPolling = false;
    }
  }

  // Deep Diff & Alert Engine
  function diffAndAlert(oldState, newState, traderInfo = {}) {
    const coin = newState.coin;
    const side = newState.side;
    const trader = traderInfo.trader || newState.trader || 'Trader';
    const portfolioTitle = traderInfo.portfolioTitle || newState.portfolioTitle || 'Portfolio';
    const baseId = newState.baseId;

    // 1. Take Profit (TP) Change
    if (oldState.tp !== newState.tp) {
      if (oldState.tp === null && newState.tp !== null) {
        triggerAlert({
          type: 'TP_UPDATE',
          severity: 'fire',
          badge: '🎯 TP SET',
          title: `Take Profit Added · ${coin} ${side}`,
          message: `@${trader} set Take Profit to $${newState.tp.toLocaleString()}`,
          coin, side, trader, portfolioTitle, baseId,
          diff: { field: 'takeProfit', old: null, new: newState.tp },
          sound: 'tp_chime',
        });
      } else if (oldState.tp !== null && newState.tp === null) {
        triggerAlert({
          type: 'TP_UPDATE',
          severity: 'warning',
          badge: '⚠️ TP REMOVED',
          title: `Take Profit Removed · ${coin} ${side}`,
          message: `@${trader} removed Take Profit (was $${oldState.tp.toLocaleString()})`,
          coin, side, trader, portfolioTitle, baseId,
          diff: { field: 'takeProfit', old: oldState.tp, new: null },
          sound: 'sl_warning',
        });
      } else if (oldState.tp !== null && newState.tp !== null) {
        const pctDiff = (((newState.tp - oldState.tp) / oldState.tp) * 100).toFixed(2);
        triggerAlert({
          type: 'TP_UPDATE',
          severity: 'fire',
          badge: '🎯 TP MODIFIED',
          title: `Take Profit Updated · ${coin} ${side}`,
          message: `@${trader} moved TP from $${oldState.tp.toLocaleString()} ➔ $${newState.tp.toLocaleString()} (${pctDiff >= 0 ? '+' : ''}${pctDiff}%)`,
          coin, side, trader, portfolioTitle, baseId,
          diff: { field: 'takeProfit', old: oldState.tp, new: newState.tp },
          sound: 'tp_chime',
        });
      }
    }

    // 2. Stop Loss (SL) Change
    if (oldState.sl !== newState.sl) {
      if (oldState.sl === null && newState.sl !== null) {
        triggerAlert({
          type: 'SL_UPDATE',
          severity: 'warning',
          badge: '🛑 SL SET',
          title: `Stop Loss Added · ${coin} ${side}`,
          message: `@${trader} set Stop Loss to $${newState.sl.toLocaleString()}`,
          coin, side, trader, portfolioTitle, baseId,
          diff: { field: 'stopLoss', old: null, new: newState.sl },
          sound: 'sl_warning',
        });
      } else if (oldState.sl !== null && newState.sl === null) {
        triggerAlert({
          type: 'SL_UPDATE',
          severity: 'danger',
          badge: '🚨 SL REMOVED',
          title: `Stop Loss Removed · ${coin} ${side}`,
          message: `@${trader} removed Stop Loss protection!`,
          coin, side, trader, portfolioTitle, baseId,
          diff: { field: 'stopLoss', old: oldState.sl, new: null },
          sound: 'sl_warning',
        });
      } else if (oldState.sl !== null && newState.sl !== null) {
        const isTrailedProfit = newState.entryPrice && (
          (newState.isBuy && newState.sl > newState.entryPrice) ||
          (!newState.isBuy && newState.sl < newState.entryPrice)
        );
        triggerAlert({
          type: 'SL_UPDATE',
          severity: isTrailedProfit ? 'success' : 'warning',
          badge: isTrailedProfit ? '🛡️ SL TRAILED' : '🛑 SL MOVED',
          title: `Stop Loss Adjusted · ${coin} ${side}`,
          message: `@${trader} adjusted SL from $${oldState.sl.toLocaleString()} ➔ $${newState.sl.toLocaleString()}${isTrailedProfit ? ' (Trailed into profit!)' : ''}`,
          coin, side, trader, portfolioTitle, baseId,
          diff: { field: 'stopLoss', old: oldState.sl, new: newState.sl },
          sound: 'sl_warning',
        });
      }
    }

    // 3. Position Size Increase (Scale In)
    if (newState.size > oldState.size + 0.05) {
      triggerAlert({
        type: 'POSITION_INCREASE',
        severity: 'fire',
        badge: '🔼 POSITION INCREASED',
        title: `Scaled In · ${coin} ${side}`,
        message: `@${trader} added margin to ${coin}: size increased from ${oldState.size}% ➔ ${newState.size}%`,
        coin, side, trader, portfolioTitle, baseId,
        diff: { field: 'entrySize', old: oldState.size, new: newState.size },
        sound: 'scale_up',
      });
    }

    // 4. Position Size Decrease (Trim / Partial TP)
    if (newState.size < oldState.size - 0.05) {
      triggerAlert({
        type: 'POSITION_DECREASE',
        severity: 'success',
        badge: '🔽 POSITION TRIMMED',
        title: `Trimmed Position · ${coin} ${side}`,
        message: `@${trader} took partial profits: size reduced from ${oldState.size}% ➔ ${newState.size}%`,
        coin, side, trader, portfolioTitle, baseId,
        diff: { field: 'entrySize', old: oldState.size, new: newState.size },
        sound: 'scale_down',
      });
    }
  }

  // Dispatch alert to Audio, Push, Telegram, Discord, Feed, and History
  function triggerAlert(alert) {
    alert.id = 'alert_' + Date.now();
    alert.timestamp = new Date().toISOString();

    // Sound
    if (state.soundEnabled && window.soundAlerts) {
      window.soundAlerts.trigger(alert.sound || 'notification_ping');
    }

    // Desktop Notification
    if (state.notifEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`OLYMPIAN RADAR: ${alert.title}`, {
          body: alert.message,
          icon: '/favicon.ico',
        });
      } catch (e) {}
    }

    // Telegram
    sendTelegramAlert(alert).catch(() => {});
    // Discord
    sendDiscordWebhook(alert).catch(() => {});

    // Save to trade history
    if (alert.baseId) {
      if (!state.tradeHistory[alert.baseId]) state.tradeHistory[alert.baseId] = [];
      state.tradeHistory[alert.baseId].unshift(alert);
      localStorage.setItem('olympian_trade_history', JSON.stringify(state.tradeHistory));

      if (state.watchedStatus.active && state.watchedStatus.baseId === alert.baseId) {
        state.watchedStatus.history = state.tradeHistory[alert.baseId];
        renderPositionHistory(state.watchedStatus.history);
      }
    }

    // Save to live feed
    state.feedEvents.unshift(alert);
    if (state.feedEvents.length > 250) state.feedEvents.pop();
    localStorage.setItem('olympian_feed_events', JSON.stringify(state.feedEvents));
    renderFeed();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Telegram & Discord Webhooks (Direct Browser Fetch)
  // ───────────────────────────────────────────────────────────────────────────
  async function sendTelegramAlert(event) {
    if (!state.telegramBotToken || !state.telegramChatId) return;
    const text = `🏛️ *${event.badge}*\n*${event.title}*\n${event.message}\n\n_Trader:_ @${event.trader}\n_Portfolio:_ ${event.portfolioTitle}`;
    try {
      await fetch(`https://api.telegram.org/bot${state.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: state.telegramChatId,
          text,
          parse_mode: 'Markdown',
        }),
      });
    } catch (e) {
      console.warn('Telegram webhook error:', e);
    }
  }

  async function sendDiscordWebhook(event) {
    if (!state.discordWebhook || !state.discordWebhook.startsWith('http')) return;
    const color = event.severity === 'fire' ? 0xc59b27 : event.severity === 'danger' ? 0xdc2626 : 0x059669;
    const payload = {
      embeds: [
        {
          title: `${event.badge} · ${event.title}`,
          description: event.message,
          color,
          fields: [
            { name: 'Trader', value: `@${event.trader}`, inline: true },
            { name: 'Portfolio', value: event.portfolioTitle || 'Invo', inline: true },
            { name: 'Asset', value: `${event.coin} (${event.side})`, inline: true },
          ],
          footer: { text: 'Olympian Invo Radar · Web Edition' },
          timestamp: event.timestamp,
        },
      ],
    };
    try {
      await fetch(state.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('Discord webhook error:', e);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Feed Rendering & Filtering ("feed type shit thing")
  // ───────────────────────────────────────────────────────────────────────────
  function renderFeed() {
    const filter = state.activeFilter;
    let list = state.feedEvents;

    if (filter === 'tpsl') {
      list = list.filter((e) => {
        const t = (e.type || '').toUpperCase();
        return t.includes('TP') || t.includes('SL') || t.includes('PROFIT') || t.includes('STOP');
      });
    } else if (filter === 'size') {
      list = list.filter((e) => {
        const t = (e.type || '').toUpperCase();
        return t.includes('POSITION') || t.includes('SIZE') || t.includes('TRIM') || t.includes('SCALE');
      });
    } else if (filter === 'close') {
      list = list.filter((e) => {
        const t = (e.type || '').toUpperCase();
        return t.includes('CLOSE') || t.includes('EXIT') || t.includes('NEW_TRADE');
      });
    }

    el.feedCount.textContent = list.length;

    if (list.length === 0) {
      el.feedContainer.innerHTML = `
        <div class="feed-empty">
          No matching alert events in Oracle feed.
        </div>
      `;
      return;
    }

    el.feedContainer.innerHTML = '';

    list.forEach((alert) => {
      const card = createAlertCardElement(alert);
      el.feedContainer.appendChild(card);
    });
  }

  function createAlertCardElement(alert) {
    const card = document.createElement('div');
    const severity = alert.severity || 'fire';
    const badge = alert.badge || 'ALERT';
    const timeStr = alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

    card.className = `alert-card ${severity}`;

    let diffHtml = '';
    if (alert.diff && alert.diff.field) {
      const d = alert.diff;
      if (d.field === 'takeProfit' || d.field === 'takeProfitPrice') {
        diffHtml = `
          <div class="alert-diff-box">
            <span>🎯 TP ORDER:</span>
            <span class="diff-old">${d.old ? '$' + formatPrice(d.old) : 'None'}</span>
            <span class="diff-arrow">➔</span>
            <span class="diff-new">${d.new ? '$' + formatPrice(d.new) : 'Cleared'}</span>
          </div>
        `;
      } else if (d.field === 'stopLoss' || d.field === 'stopLossPrice') {
        diffHtml = `
          <div class="alert-diff-box">
            <span>🛡️ SL ORDER:</span>
            <span class="diff-old">${d.old ? '$' + formatPrice(d.old) : 'None'}</span>
            <span class="diff-arrow">➔</span>
            <span class="diff-new">${d.new ? '$' + formatPrice(d.new) : 'Cleared'}</span>
          </div>
        `;
      } else if (d.field === 'entrySize' || d.field === 'size' || d.field === 'margin') {
        diffHtml = `
          <div class="alert-diff-box">
            <span>📊 MARGIN SIZE:</span>
            <span class="diff-old">${d.old}%</span>
            <span class="diff-arrow">➔</span>
            <span class="diff-new">${d.new}%</span>
          </div>
        `;
      } else if (d.field === 'status') {
        diffHtml = `
          <div class="alert-diff-box">
            <span>🏁 POSITION STATUS:</span>
            <span class="diff-old">${d.old}</span>
            <span class="diff-arrow">➔</span>
            <span class="diff-new">${d.new}</span>
          </div>
        `;
      }
    }

    const traderName = alert.trader || alert.portfolioTitle || 'Trader';
    const assetTag = alert.coin ? `${alert.coin} ${alert.side || ''}` : '';

    card.innerHTML = `
      <div class="alert-card-top">
        <span class="alert-badge">${escapeHtml(badge)}</span>
        <span class="alert-time">${timeStr}</span>
      </div>

      <div class="alert-title">${escapeHtml(alert.title || 'Trader Action Detected')}</div>
      <div class="alert-msg">${escapeHtml(alert.message || '')}</div>
      ${diffHtml}

      <div class="alert-foot">
        <span>Trader: @${escapeHtml(traderName)} ${assetTag ? `· ${escapeHtml(assetTag)}` : ''}</span>
        <span>${escapeHtml(alert.portfolioTitle || 'Invo')}</span>
      </div>
    `;

    return card;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Settings & Configuration Modal
  // ───────────────────────────────────────────────────────────────────────────
  function saveSettings() {
    state.invoToken = el.cfgRefreshToken.value.trim() || HARDCODED_INVO_TOKEN;
    state.corsProxyMode = el.cfgCorsProxy.value;
    state.pollIntervalMs = parseInt(el.cfgPollInterval.value, 10) || 3500;
    state.discordWebhook = el.cfgDiscordWebhook.value.trim();
    state.telegramBotToken = el.cfgTelegramToken.value.trim();
    state.telegramChatId = el.cfgTelegramChatId.value.trim();

    localStorage.setItem('olympian_invo_token', state.invoToken);
    localStorage.setItem('olympian_cors_proxy', state.corsProxyMode);
    localStorage.setItem('olympian_poll_interval', String(state.pollIntervalMs));
    localStorage.setItem('olympian_discord_webhook', state.discordWebhook);
    localStorage.setItem('olympian_telegram_token', state.telegramBotToken);
    localStorage.setItem('olympian_telegram_chat', state.telegramChatId);

    // Reinitialize API Client
    invo = new InvoClient(state.invoToken, state.corsProxyMode);
    startPollingLoop();

    closeSettingsModal();
    alert('Settings saved and Oracle updated!');
  }

  async function testDiscordWebhook() {
    const url = el.cfgDiscordWebhook.value.trim();
    if (!url) {
      alert('Please enter a Discord Webhook URL first.');
      return;
    }

    el.testDiscordBtn.disabled = true;
    el.testDiscordBtn.textContent = 'Sending...';

    try {
      const payload = {
        embeds: [{
          title: '🏛️ Test Alert · Olympian Radar Active',
          description: 'Connection verified! Your browser will deliver live TP, SL, and size alerts here.',
          color: 0xc59b27,
          footer: { text: 'Olympian Invo Radar · Web Edition' },
          timestamp: new Date().toISOString(),
        }],
      };
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        alert('Test notification sent to Discord successfully! Check your channel.');
      } else {
        alert(`Discord Webhook test returned status ${resp.status}`);
      }
    } catch (err) {
      alert('Discord test error: ' + err.message);
    } finally {
      el.testDiscordBtn.disabled = false;
      el.testDiscordBtn.textContent = 'Test Discord';
    }
  }

  async function testTelegram() {
    const token = el.cfgTelegramToken.value.trim();
    const chat = el.cfgTelegramChatId.value.trim();
    if (!token || !chat) {
      alert('Please enter both Telegram Bot Token and Chat ID first.');
      return;
    }

    el.testTelegramBtn.disabled = true;
    el.testTelegramBtn.textContent = 'Testing...';

    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat,
          text: '🏛️ *OLYMPIAN RADAR VERIFIED*\n\nTelegram live trade alerts are active and connected directly from your browser.',
          parse_mode: 'Markdown',
        }),
      });
      const data = await resp.json();

      if (resp.ok && data.ok) {
        alert('Test alert delivered to Telegram successfully! Check your Telegram chat.');
      } else {
        alert('Telegram test failed: ' + (data.description || 'Unknown error'));
      }
    } catch (err) {
      alert('Telegram test error: ' + err.message);
    } finally {
      el.testTelegramBtn.disabled = false;
      el.testTelegramBtn.textContent = 'Test Telegram';
    }
  }

  function openSettingsModal() {
    el.settingsModal.classList.add('open');
  }

  function closeSettingsModal() {
    el.settingsModal.classList.remove('open');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Audio & Notification Toggles
  // ───────────────────────────────────────────────────────────────────────────
  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    localStorage.setItem('olympian_sound_enabled', state.soundEnabled);
    updateAudioBtnUI();

    if (state.soundEnabled && window.soundAlerts) {
      window.soundAlerts.trigger('notification_ping');
    }
  }

  function updateAudioBtnUI() {
    if (state.soundEnabled) {
      el.soundToggleBtn.textContent = '🔊 Sound: ON';
      el.soundToggleBtn.classList.add('active');
    } else {
      el.soundToggleBtn.textContent = '🔇 Sound: OFF';
      el.soundToggleBtn.classList.remove('active');
    }
  }

  async function toggleNotifications() {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications.');
      return;
    }

    if (Notification.permission === 'granted') {
      state.notifEnabled = !state.notifEnabled;
      localStorage.setItem('olympian_notif_enabled', state.notifEnabled);
      updateNotifBtnUI();
    } else if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        state.notifEnabled = true;
        localStorage.setItem('olympian_notif_enabled', true);
        new Notification('OLYMPIAN RADAR', { body: 'Desktop alerts enabled!' });
      }
      updateNotifBtnUI();
    } else {
      alert('Notifications are blocked by your browser settings. Please permit notifications in browser site permissions.');
    }
  }

  function updateNotifBtnUI() {
    if (state.notifEnabled && 'Notification' in window && Notification.permission === 'granted') {
      el.notifToggleBtn.textContent = '🔔 Desktop: ON';
      el.notifToggleBtn.classList.add('active');
    } else {
      el.notifToggleBtn.textContent = '🔕 Desktop: OFF';
      el.notifToggleBtn.classList.remove('active');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event Listeners Setup
  // ───────────────────────────────────────────────────────────────────────────
  function setupEventListeners() {
    el.portfolioInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleInputSubmission();
    });

    el.loadPortfolioBtn.addEventListener('click', () => handleInputSubmission());

    el.refreshTradesBtn.addEventListener('click', () => {
      if (state.currentPortfolioId) {
        if (state.currentInvestmentId) {
          loadSpecificInvestment(state.currentPortfolioId, state.currentInvestmentId);
        } else {
          loadPortfolio(state.currentPortfolioId);
        }
      }
    });

    el.unwatchBtn.addEventListener('click', unwatchCurrent);
    el.pinPositionBtn.addEventListener('click', togglePinCurrentPosition);

    el.soundToggleBtn.addEventListener('click', toggleSound);
    el.notifToggleBtn.addEventListener('click', toggleNotifications);

    // Test Alert trigger
    el.testAlertBtn.addEventListener('click', () => {
      const sampleTypes = ['TP_UPDATE', 'SL_UPDATE', 'POSITION_INCREASE', 'POSITION_DECREASE', 'TRADE_CLOSED'];
      const randomType = sampleTypes[Math.floor(Math.random() * sampleTypes.length)];
      triggerAlert({
        type: randomType,
        severity: randomType === 'SL_UPDATE' ? 'warning' : (randomType === 'TRADE_CLOSED' ? 'success' : 'fire'),
        badge: randomType.replace('_', ' '),
        title: `Simulated Alert · BTC LONG`,
        message: `@Trader moved orders on BTC 20x position`,
        coin: 'BTC',
        side: 'LONG',
        trader: 'CryptoWhale',
        portfolioTitle: 'Alpha Momentum',
        baseId: state.watchedStatus.baseId || 'test-1',
        sound: randomType === 'TP_UPDATE' ? 'tp_chime' : (randomType === 'SL_UPDATE' ? 'sl_warning' : 'scale_up'),
        diff: { field: 'takeProfit', old: 94000, new: 98000 },
      });
    });

    // Clear feed
    el.clearFeedBtn.addEventListener('click', () => {
      state.feedEvents = [];
      localStorage.removeItem('olympian_feed_events');
      renderFeed();
    });

    // Feed filter buttons
    el.filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        el.filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeFilter = btn.dataset.filter || 'all';
        renderFeed();
      });
    });

    // Settings Modal
    el.settingsBtn.addEventListener('click', openSettingsModal);
    el.modalCloseBtn.addEventListener('click', closeSettingsModal);
    el.cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    el.saveSettingsBtn.addEventListener('click', saveSettings);
    el.testDiscordBtn.addEventListener('click', testDiscordWebhook);
    el.testTelegramBtn.addEventListener('click', testTelegram);

    el.settingsModal.addEventListener('click', (e) => {
      if (e.target === el.settingsModal) closeSettingsModal();
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Extract & Normalize Invo Trade Object
  // ───────────────────────────────────────────────────────────────────────────
  function parseTrade(inv) {
    if (!inv) return null;
    const baseId = inv.baseId || inv.id || inv.investmentId || '';
    const coin = inv.ticker || inv.coin || inv.symbol || 'ASSET';
    const isBuy = inv.directionLong === true || inv.isBuy === true || inv.side === 'long' || inv.side === 'LONG';
    const entryPrice = parseFloat(inv.entryPrice || inv.price || 0) || null;
    const currentPrice = parseFloat(inv.currentPrice || inv.markPrice || entryPrice || 0) || null;
    const leverage = parseFloat(inv.leverage || 1);
    const size = parseFloat(inv.entrySize ?? inv.margin ?? inv.marginUsd ?? inv.size ?? 0);

    const tp = inv.takeProfitPrice ?? inv.takeProfit ?? inv.tpPx ?? inv.tp ?? null;
    const parsedTp = tp !== null && tp !== undefined && tp !== '' ? parseFloat(tp) : null;

    const sl = inv.stopLossPrice ?? inv.stopLoss ?? inv.slPx ?? inv.sl ?? null;
    const parsedSl = sl !== null && sl !== undefined && sl !== '' ? parseFloat(sl) : null;

    let pnlPercent = parseFloat(inv.pnlPercent ?? inv.unrealizedPnlPercent ?? 0);
    if ((!pnlPercent || pnlPercent === 0) && entryPrice && currentPrice) {
      const move = isBuy ? (currentPrice - entryPrice) / entryPrice : (entryPrice - currentPrice) / entryPrice;
      pnlPercent = move * leverage * 100;
    }

    return {
      baseId,
      coin,
      side: isBuy ? 'LONG' : 'SHORT',
      isBuy,
      leverage,
      size,
      entryPrice,
      currentPrice,
      tp: parsedTp,
      sl: parsedSl,
      pnlPercent,
      createdAt: inv.createdAt || new Date().toISOString(),
      trader: inv.owner?.username || inv.trader || 'Trader',
      portfolioTitle: inv.portfolio?.title || 'Portfolio',
      portfolioId: inv.portfolio?.id || '',
      raw: inv,
    };
  }

  function formatPrice(val) {
    if (val == null || isNaN(val)) return '0.00';
    const num = Number(val);
    if (num >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (num >= 1) return num.toFixed(3);
    return num.toFixed(6);
  }

  function formatTimestamp(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(ts);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
