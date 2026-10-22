/**
 * OLYMPIAN INVO RADAR - Client Application Controller
 * Classical Marble Theme with Sub-Second Position & TP/SL Oracle Feed
 */

(function () {
  'use strict';

  // State Management
  const state = {
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
    feedEvents: [],
    soundEnabled: localStorage.getItem('invo_sound_enabled') !== 'false',
    notifEnabled: localStorage.getItem('invo_notif_enabled') === 'true',
    activeFilter: 'all',
    config: {},
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
    cfgPollInterval: document.getElementById('cfgPollInterval'),
    cfgDiscordWebhook: document.getElementById('cfgDiscordWebhook'),
    cfgTelegramToken: document.getElementById('cfgTelegramToken'),
    cfgTelegramChatId: document.getElementById('cfgTelegramChatId'),
    testDiscordBtn: document.getElementById('testDiscordBtn'),
    testTelegramBtn: document.getElementById('testTelegramBtn'),
    tokenHint: document.getElementById('tokenHint'),
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Smart Link Parser: Supports Direct Position Links & Portfolio Links
  // ───────────────────────────────────────────────────────────────────────────
  function parseInvoLink(input) {
    if (!input) return { portfolioId: '', investmentId: null };
    let str = input.trim();
    // Strip query parameters and hash
    str = str.split('?')[0].split('#')[0];

    // Check for pattern: ...portfolio/<portfolioId>/investment/<investmentId> or <portfolioId>/investment/<investmentId>
    const investMatch = str.match(/(?:portfolio\/)?([a-zA-Z0-9_-]{10,50})\/investment\/([a-zA-Z0-9_-]{10,50})/i);
    if (investMatch) {
      return {
        portfolioId: investMatch[1].trim(),
        investmentId: investMatch[2].trim(),
      };
    }

    // Check for portfolio URL
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
    connectSSE();

    await loadConfig();
    await loadInitialFeed();
    await loadWatchStatus();
    await loadFollowedTraders();

    // Check URL search parameters or hash
    const urlParams = new URLSearchParams(window.location.search);
    const inputParam = urlParams.get('url') || urlParams.get('link') || urlParams.get('portfolio') || urlParams.get('id');
    if (inputParam) {
      el.portfolioInput.value = inputParam;
      await handleInputSubmission(inputParam);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Server-Sent Events (Live Alert Stream)
  // ───────────────────────────────────────────────────────────────────────────
  let sseSource = null;

  function connectSSE() {
    if (sseSource) {
      try { sseSource.close(); } catch {}
    }

    sseSource = new EventSource('/api/events');

    sseSource.onopen = () => {
      el.connectionStatus.textContent = 'RADAR ARMED';
      el.beaconPill.style.borderColor = 'var(--gold)';
    };

    sseSource.onmessage = (event) => {
      try {
        if (!event.data || event.data.trim() === ':') return;
        const data = JSON.parse(event.data);
        handleSSEMessage(data);
      } catch (err) {
        console.error('SSE parse error:', err, event.data);
      }
    };

    sseSource.onerror = () => {
      el.connectionStatus.textContent = 'RECONNECTING...';
      el.beaconPill.style.borderColor = 'var(--gold-light)';
    };
  }

  function handleSSEMessage(msg) {
    if (!msg) return;

    // Direct trade alert event broadcasted from server
    if (msg.title || msg.badge || (msg.type && msg.type.includes('_'))) {
      handleIncomingAlert(msg);
      return;
    }

    if (msg.type === 'init' && msg.watched) {
      state.watchedStatus = msg.watched;
      renderWatchedHud();
    } else if (msg.type === 'trades_polled' && msg.trades) {
      if (msg.portfolioId && msg.portfolioId === state.currentPortfolioId) {
        state.trades = msg.trades;
        renderTradesList();
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Incoming Alert Handler (Audio + Desktop + Feed + History Timeline)
  // ───────────────────────────────────────────────────────────────────────────
  function handleIncomingAlert(alert) {
    if (!alert) return;

    // 1. Play Synthesized Chime Alert
    if (state.soundEnabled && window.soundAlerts) {
      const soundKey = alert.sound || (
        alert.type === 'TP_UPDATE' ? 'tp_chime' :
        alert.type === 'SL_UPDATE' ? 'sl_warning' :
        alert.type === 'POSITION_INCREASE' ? 'scale_up' :
        alert.type === 'POSITION_DECREASE' ? 'scale_down' :
        alert.type === 'TRADE_CLOSED' ? 'close_triumph' : 'notification_ping'
      );
      window.soundAlerts.trigger(soundKey);
    }

    // 2. Desktop Push Notification
    if (state.notifEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`OLYMPIAN RADAR: ${alert.title || 'Trader Action Detected'}`, {
          body: alert.message || '',
          icon: '/favicon.ico',
        });
      } catch (e) {
        console.warn('Desktop notification failed:', e);
      }
    }

    // 3. Update Cockpit HUD if alert is for this watched trade
    if (state.watchedStatus.active) {
      const isThisTrade =
        (alert.baseId && String(alert.baseId) === String(state.watchedStatus.baseId)) ||
        (alert.coin && state.watchedStatus.tradeSnapshot && alert.coin === state.watchedStatus.tradeSnapshot.coin);

      if (isThisTrade) {
        el.hudLastAction.textContent = alert.title || alert.badge || 'Action Detected';
        el.hudLastAction.style.animation = 'none';
        void el.hudLastAction.offsetWidth; // trigger reflow
        el.hudLastAction.style.animation = 'olympianPulse 0.8s ease 2';

        // Update trade snapshot diffs in real time
        if (alert.diff && state.watchedStatus.tradeSnapshot) {
          if (alert.diff.field === 'takeProfit' || alert.diff.field === 'takeProfitPrice') {
            state.watchedStatus.tradeSnapshot.tp = alert.diff.new;
          } else if (alert.diff.field === 'stopLoss' || alert.diff.field === 'stopLossPrice') {
            state.watchedStatus.tradeSnapshot.sl = alert.diff.new;
          } else if (alert.diff.field === 'entrySize' || alert.diff.field === 'size') {
            state.watchedStatus.tradeSnapshot.size = alert.diff.new;
          } else if (alert.diff.field === 'status' && alert.diff.new === 'CLOSED') {
            state.watchedStatus.tradeSnapshot.isOpen = false;
          }
          renderWatchedHud();
        }

        // Prepend to Position Update History list
        if (!Array.isArray(state.watchedStatus.history)) state.watchedStatus.history = [];
        state.watchedStatus.history.unshift(alert);
        renderPositionHistory(state.watchedStatus.history);
      }
    }

    // 4. Prepend to Main Live Feed
    state.feedEvents.unshift(alert);
    if (state.feedEvents.length > 300) {
      state.feedEvents.pop();
    }
    renderFeed();
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
        // Direct Position Link Tracking!
        await loadSpecificInvestment(portfolioId, investmentId);
      } else {
        // Portfolio Level Tracking
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
      const res = await fetch(`/api/portfolio/${encodeURIComponent(portfolioId)}/investment/${encodeURIComponent(investmentId)}`);
      const data = await res.json();

      if (data.success && data.trade) {
        const trade = data.trade;
        const portMeta = data.portfolio || { id: portfolioId, title: `Portfolio #${portfolioId}` };

        state.portfolioDetails = portMeta;
        renderDossier(portMeta);

        // Arm cockpit on this trade
        state.watchedStatus = {
          active: true,
          baseId: trade.baseId || investmentId,
          portfolioId: portfolioId,
          traderName: trade.trader || portMeta.owner?.username || 'Trader',
          tradeSnapshot: trade,
          polledCount: 1,
          history: data.history || [],
        };

        renderWatchedHud();
        renderPositionHistory(state.watchedStatus.history);

        // Also fetch active trades for the deck
        const tradesRes = await fetch(`/api/portfolio/${encodeURIComponent(portfolioId)}/trades`).then((r) => r.json()).catch(() => ({}));
        state.trades = tradesRes.openTrades || tradesRes.trades || [trade];
        renderTradesList();

        // Audio Confirmation
        if (state.soundEnabled && window.soundAlerts) {
          window.soundAlerts.trigger('notification_ping');
        }
      } else {
        // Fallback: load portfolio trades and search
        await loadPortfolio(portfolioId);
        const match = state.trades.find((t) => {
          const id = String(t.baseId || t.id || t._id || '');
          return id === investmentId || id.replace(/-/g, '') === investmentId.replace(/-/g, '');
        });
        if (match) {
          toggleWatchTrade(match);
        } else {
          alert(`Position ${investmentId} was not found among currently open trades for portfolio ${portfolioId}. It may have already closed or been removed.`);
        }
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
      const res = await fetch('/api/portfolios/followed');
      const data = await res.json();
      const list = data.portfolios || [];

      el.followedRow.innerHTML = '<span style="font-size: 11.5px; font-weight: 700; color: var(--gold); padding-right: 4px;">Followed Traders:</span>';

      if (!Array.isArray(list) || list.length === 0) {
        el.followedRow.innerHTML += '<span style="font-size: 12px; color: var(--ink-muted); font-style: italic;">Enter portfolio ID or link above.</span>';
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
      const [detailsRes, tradesRes] = await Promise.all([
        fetch(`/api/portfolio/${encodeURIComponent(portfolioId)}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/portfolio/${encodeURIComponent(portfolioId)}/trades`).then((r) => r.json()).catch(() => ({})),
      ]);

      const portMeta = detailsRes.portfolio || tradesRes.portfolio || { id: portfolioId, title: `Portfolio #${portfolioId}` };
      state.portfolioDetails = portMeta;
      renderDossier(portMeta);

      const openTrades = Array.isArray(tradesRes.openTrades)
        ? tradesRes.openTrades
        : (Array.isArray(tradesRes.trades) ? tradesRes.trades : []);

      state.trades = openTrades;
      renderTradesList();

      // If user had a selected trade before or if portfolio only has 1 trade, auto watch
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
  async function toggleWatchTrade(trade) {
    const baseId = String(trade.baseId || trade.id || trade._id);
    const isCurrentlyWatched =
      state.watchedStatus.active &&
      String(state.watchedStatus.baseId) === baseId;

    if (isCurrentlyWatched) {
      await unwatchCurrent();
    } else {
      try {
        const payload = {
          baseId,
          portfolioId: state.currentPortfolioId,
          tradeData: trade,
        };
        const res = await fetch('/api/watch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          state.watchedStatus = {
            active: true,
            baseId,
            portfolioId: state.currentPortfolioId,
            traderName: trade.trader || state.portfolioDetails?.name || 'Trader',
            tradeSnapshot: trade,
            polledCount: 1,
            history: [],
          };
          renderWatchedHud();
          renderTradesList();

          if (state.soundEnabled && window.soundAlerts) {
            window.soundAlerts.trigger('notification_ping');
          }
        } else {
          alert('Failed to arm trade watcher: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Watch error: ' + err.message);
      }
    }
  }

  async function unwatchCurrent() {
    try {
      const payload = {
        baseId: state.watchedStatus.baseId,
        portfolioId: state.currentPortfolioId,
      };
      await fetch('/api/unwatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

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
    } catch (err) {
      console.error('Unwatch error:', err);
    }
  }

  async function loadWatchStatus() {
    try {
      const res = await fetch('/api/watch/status');
      const data = await res.json();
      if (Array.isArray(data.watchedTrades) && data.watchedTrades.length > 0) {
        const first = data.watchedTrades[0];
        state.watchedStatus = {
          active: true,
          baseId: first.baseId,
          portfolioId: first.portfolioId,
          traderName: first.snapshot?.trader || 'Watched Trader',
          tradeSnapshot: first.snapshot,
          polledCount: 1,
          history: [],
        };
        renderWatchedHud();

        if (first.portfolioId && !state.currentPortfolioId) {
          state.currentPortfolioId = first.portfolioId;
          el.portfolioInput.value = first.portfolioId;
          loadPortfolio(first.portfolioId);
        }
      }
    } catch (err) {
      console.warn('Watch status load error:', err);
    }
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

    // Position Open / Closed status
    const isOpen = trade.isOpen !== false;
    el.hudStatusBadge.className = `status-badge ${isOpen ? 'open' : 'closed'}`;
    el.hudStatusBadge.textContent = isOpen ? 'ACTIVE POSITION' : 'CLOSED POSITION';

    // Link to open directly in Invo app
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

    // PnL Calculation
    let pnlVal = 0;
    if (trade.pnlPercent != null) {
      pnlVal = Number(trade.pnlPercent);
    } else if (entry > 0 && mark > 0) {
      const levNum = parseFloat(leverage) || 1;
      pnlVal = isLong ? ((mark - entry) / entry) * 100 * levNum : ((entry - mark) / entry) * 100 * levNum;
    }

    el.hudPnl.className = `hud-pnl ${pnlVal >= 0 ? 'positive' : 'negative'}`;
    el.hudPnl.textContent = `${pnlVal >= 0 ? '+' : ''}${pnlVal.toFixed(2)}%`;

    // Visual Range Meter
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

    // Bottom Stats
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
  // Feed Rendering & Filtering ("feed type shit thing")
  // ───────────────────────────────────────────────────────────────────────────
  async function loadInitialFeed() {
    try {
      const res = await fetch('/api/feed');
      const data = await res.json();
      const list = data.alerts || data.feed || [];
      if (Array.isArray(list)) {
        state.feedEvents = list;
        renderFeed();
      }
    } catch (err) {
      console.warn('Initial feed load error:', err);
    }
  }

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

    // Diff details formatting
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
  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      state.config = data;
      el.cfgRefreshToken.value = data.invoRefreshToken || '';
      el.cfgDiscordWebhook.value = data.discordWebhook || '';
      el.cfgTelegramToken.value = data.telegramBotToken || '';
      el.cfgTelegramChatId.value = data.telegramChatId || '';
      if (data.pollIntervalMs) {
        el.cfgPollInterval.value = String(data.pollIntervalMs);
      }
      if (data.hasToken) {
        el.tokenHint.textContent = `Active Invo Token: ${data.maskedToken || 'Loaded from sentinel.db'}`;
        el.tokenHint.style.color = 'var(--laurel-green)';
      }
    } catch (err) {
      console.warn('Config load error:', err);
    }
  }

  async function saveSettings() {
    const payload = {
      invoRefreshToken: el.cfgRefreshToken.value.trim(),
      pollIntervalMs: parseInt(el.cfgPollInterval.value, 10) || 3500,
      discordWebhook: el.cfgDiscordWebhook.value.trim(),
      telegramBotToken: el.cfgTelegramToken.value.trim(),
      telegramChatId: el.cfgTelegramChatId.value.trim(),
    };

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        state.config = { ...state.config, ...payload };
        closeSettingsModal();
        alert('Oracle configuration updated and saved!');
      } else {
        alert('Error saving settings: ' + (data.error || 'Failed'));
      }
    } catch (err) {
      alert('Error saving settings: ' + err.message);
    }
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
      const res = await fetch('/api/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: url }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Test notification sent to Discord successfully! Check your channel.');
      } else {
        alert('Discord Webhook test failed: ' + (data.error || 'Error'));
      }
    } catch (err) {
      alert('Discord test error: ' + err.message);
    } finally {
      el.testDiscordBtn.disabled = false;
      el.testDiscordBtn.textContent = 'Test Discord';
    }
  }

  async function testTelegram() {
    const botToken = el.cfgTelegramToken.value.trim();
    const chatId = el.cfgTelegramChatId.value.trim();
    if (!botToken || !chatId) {
      alert('Please enter both Telegram Bot Token and Chat ID first.');
      return;
    }

    el.testTelegramBtn.disabled = true;
    el.testTelegramBtn.textContent = 'Testing...';

    try {
      const res = await fetch('/api/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, chatId }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Test alert delivered to Telegram successfully! Check your Telegram chat.');
      } else {
        alert('Telegram test failed: ' + (data.error || data.data?.description || 'Error'));
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
    localStorage.setItem('invo_sound_enabled', state.soundEnabled);
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
      localStorage.setItem('invo_notif_enabled', state.notifEnabled);
      updateNotifBtnUI();
    } else if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        state.notifEnabled = true;
        localStorage.setItem('invo_notif_enabled', true);
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
    // Search input Enter key
    el.portfolioInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleInputSubmission();
      }
    });

    el.loadPortfolioBtn.addEventListener('click', () => handleInputSubmission());

    // Refresh trades
    el.refreshTradesBtn.addEventListener('click', () => {
      if (state.currentPortfolioId) {
        if (state.currentInvestmentId) {
          loadSpecificInvestment(state.currentPortfolioId, state.currentInvestmentId);
        } else {
          loadPortfolio(state.currentPortfolioId);
        }
      }
    });

    // Unwatch cockpit trade
    el.unwatchBtn.addEventListener('click', unwatchCurrent);

    // Audio & Desktop Notification toggles
    el.soundToggleBtn.addEventListener('click', toggleSound);
    el.notifToggleBtn.addEventListener('click', toggleNotifications);

    // Test Alert trigger
    el.testAlertBtn.addEventListener('click', async () => {
      const sampleTypes = ['TP_UPDATE', 'SL_UPDATE', 'POSITION_INCREASE', 'POSITION_DECREASE', 'TRADE_CLOSED'];
      const randomType = sampleTypes[Math.floor(Math.random() * sampleTypes.length)];
      try {
        await fetch('/api/test-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: randomType, coin: 'BTC', side: 'LONG' }),
        });
      } catch (err) {
        console.error('Test alert error:', err);
      }
    });

    // Clear feed
    el.clearFeedBtn.addEventListener('click', async () => {
      state.feedEvents = [];
      renderFeed();
      try {
        await fetch('/api/feed/clear', { method: 'POST' });
      } catch {}
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

    // Close modal on outside click
    el.settingsModal.addEventListener('click', (e) => {
      if (e.target === el.settingsModal) {
        closeSettingsModal();
      }
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Utility Helpers
  // ───────────────────────────────────────────────────────────────────────────
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
