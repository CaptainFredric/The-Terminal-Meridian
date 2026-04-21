import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

function buildCommandSuggestions({ authEnabled, state, buildQuote, panel }) {
  const symbol = state.panelSymbols[panel] || state.watchlist[0] || "AAPL";
  const suggestions = [];

  if (authEnabled && !state.user) {
    suggestions.push({ label: "Sign in and sync", detail: "Back up your workspace to the backend", command: "LOGIN", icon: "🔐" });
  } else if (authEnabled && state.user) {
    suggestions.push({ label: "Open account settings", detail: "Update profile, password, or account state", command: "SETTINGS", icon: "⚙" });
  } else {
    suggestions.push({ label: "Save workspace now", detail: "Persist watchlist, alerts, and positions locally", command: "SAVE", icon: "→" });
  }

  suggestions.push({ label: "Open Meridian Briefing", detail: "Regime analysis, breadth metrics, and signal board", command: "BRIEF", icon: "→" });

  if (!state.alerts.length) {
    const threshold = Math.max(1, Math.round((buildQuote(symbol)?.price || 100) * 1.03));
    suggestions.push({ label: `Set ${symbol} price alert`, detail: `Get notified when ${symbol} crosses a level`, command: `ALERT ${symbol} ${threshold}`, icon: "→" });
  } else {
    suggestions.push({ label: "Review portfolio exposure", detail: "Check positions, P/L, and active alerts", command: "PORT", icon: "→" });
  }

  if (state.watchlist.length < 10) {
    suggestions.push({ label: "Expand your watchlist", detail: "Track more symbols. Try adding SPY or TSLA", command: "WATCH SPY", icon: "→" });
  }

  suggestions.push({ label: "Open the heatmap", detail: "See every sector at a glance", command: "HEAT", icon: "→" });
  suggestions.push({ label: "Discover next action", detail: "Refresh this panel with contextual ideas", command: "SUGGEST", icon: "→" });
  return suggestions.slice(0, 5);
}

function buildTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Late night session";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Late night session";
}

export function createHomeRenderer(context) {
  const { state, buildQuote, calculatePortfolioSummary, authEnabled, heatmapGroups } = context;

  return function renderHome(panel) {
    const portfolio = calculatePortfolioSummary();
    const top = state.watchlist.slice(0, 8).map(buildQuote).filter(Boolean);
    const gainers = [...top].filter(q => q.changePct > 0).sort((a, b) => b.changePct - a.changePct);
    const losers = [...top].filter(q => q.changePct < 0).sort((a, b) => a.changePct - b.changePct);
    const recentCommands = state.commandHistory.slice(0, 6);
    const primarySymbol = state.panelSymbols[panel] || state.watchlist[0] || "AAPL";
    const suggestions = buildCommandSuggestions({ authEnabled, state, buildQuote, panel });
    const greeting = buildTimeGreeting();
    const alertsTriggered = state.alerts.filter(a => a.status === "triggered").length;
    const alertsWatching = state.alerts.filter(a => a.status === "watching").length;

    // Sector performance snapshot (top 6 GICS sectors, skip ETF/crypto)
    const sectorPerf = Object.entries(heatmapGroups || {})
      .filter(([name]) => !name.includes("ETF") && !name.includes("Crypto"))
      .map(([sector, symbols]) => {
        const quotes = symbols.map(s => buildQuote(s)).filter(Boolean);
        const avgPct = quotes.length
          ? quotes.reduce((s, q) => s + (q.changePct || 0), 0) / quotes.length
          : 0;
        return { sector, avgPct };
      })
      .sort((a, b) => b.avgPct - a.avgPct)
      .slice(0, 6);

    // Market breadth from overview quotes
    const breadthQuotes = state.overviewQuotes.length ? state.overviewQuotes : top;
    const advCount = breadthQuotes.filter(q => (q.changePct || 0) > 0).length;
    const breadthPct = breadthQuotes.length ? Math.round((advCount / breadthQuotes.length) * 100) : 50;

    // News headlines (latest 4)
    const recentNews = (state.newsItems || []).slice(0, 4);

    // Earnings calendar — find upcoming earnings across watchlist
    const now = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const earnings = state.watchlist
      .map((sym) => {
        const q = buildQuote(sym);
        if (!q?.earningsTimestamp) return null;
        const ts = Number(q.earningsTimestamp);
        const ms = ts > 1e10 ? ts : ts * 1000;
        const date = new Date(ms);
        if (Number.isNaN(date.getTime())) return null;
        const daysUntil = Math.round((ms - now) / (24 * 60 * 60 * 1000));
        if (daysUntil < -1 || daysUntil > 14) return null;
        return { symbol: sym, name: q.name || sym, date, daysUntil, price: q.price, changePct: q.changePct || 0 };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 6);

    // Paper trading summary
    const paper = state.paperAccount;
    const paperEquity = paper?.equity || paper?.cash || 0;
    const paperPl = paperEquity ? paperEquity - (paper?.startingCash || 100_000) : 0;

    return `
      <section class="stack stack-lg">
        <div class="home-hero">
          <div class="home-hero-text">
            <h3 class="home-greeting">${greeting}</h3>
            <p class="home-subtitle">${state.marketPhase} · ${state.watchlist.length} symbols tracked · ${state.positions.length} positions open</p>
          </div>
        </div>

        <div class="card-grid card-grid-home" style="grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));">
          <article class="card stat-card home-stat">
            <span>Portfolio Value</span>
            <strong>${tabularValue(formatPrice(portfolio.value, "USD"))}</strong>
            <small class="${portfolio.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${portfolio.pnl >= 0 ? "+" : ""}${formatPrice(portfolio.pnl, "USD")}`)}</small>
          </article>
          <article class="card stat-card home-stat">
            <span>Return</span>
            <strong class="${portfolio.pnlPct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(portfolio.pnlPct))}</strong>
            <small>${state.positions.length} position${state.positions.length !== 1 ? "s" : ""}</small>
          </article>
          <article class="card stat-card home-stat">
            <span>Market Breadth</span>
            <strong class="${breadthPct >= 50 ? "positive" : "negative"}">${breadthPct}%</strong>
            <small>${advCount}/${breadthQuotes.length} advancing</small>
          </article>
          <article class="card stat-card home-stat">
            <span>Alerts</span>
            <strong>${alertsWatching + alertsTriggered}</strong>
            <small>${alertsTriggered ? `${alertsTriggered} triggered` : `${alertsWatching} watching`}</small>
          </article>
          ${paper ? `
          <article class="card stat-card home-stat">
            <span>Paper P/L</span>
            <strong class="${paperPl >= 0 ? "positive" : "negative"}">${paperPl >= 0 ? "+" : ""}${formatPrice(paperPl, "USD")}</strong>
            <small>$${Number(paperEquity).toLocaleString()} equity</small>
          </article>
          ` : ""}
        </div>

        <article class="card card-feature">
          <header class="card-head card-head-split">
            <h4>Quick Actions</h4>
            <small>Jump to any module</small>
          </header>
          <div class="action-grid">
            <button class="action-tile" type="button" data-load-module="quote" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Quote</strong><span>${primarySymbol} detail view</span></button>
            <button class="action-tile" type="button" data-load-module="chart" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Chart</strong><span>Price action & patterns</span></button>
            <button class="action-tile" type="button" data-load-module="options" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Options</strong><span>Call/put chain</span></button>
            <button class="action-tile" type="button" data-load-module="screener" data-target-panel="${panel}"><strong>Screener</strong><span>Filter the universe</span></button>
            <button class="action-tile" type="button" data-load-module="heatmap" data-target-panel="${panel}"><strong>Heatmap</strong><span>Sector overview</span></button>
            <button class="action-tile" type="button" data-load-module="trade" data-target-panel="${panel}"><strong>Trade</strong><span>Paper trading desk</span></button>
            <button class="action-tile" type="button" data-load-module="calculator" data-target-panel="${panel}"><strong>Calculator</strong><span>Black-Scholes &amp; bonds</span></button>
          </div>
        </article>

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split"><h4>Gainers</h4><small class="positive">${gainers.length} up</small></header>
            <div class="stack-list compact-list">
              ${gainers.length ? gainers.slice(0, 4).map(quote => `
                <button class="list-row" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">
                  <div><strong>${quote.symbol}</strong><small>${quote.name || quote.symbol}</small></div>
                  <div style="text-align:right"><span>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: "quote:" + quote.symbol + ":price", currentPrice: quote.price })}</span><br><small class="positive">${tabularValue(formatSignedPct(quote.changePct))}</small></div>
                </button>
              `).join("") : `<div class="empty-inline">No gainers in your watchlist today.</div>`}
            </div>
          </article>
          <article class="card">
            <header class="card-head card-head-split"><h4>Losers</h4><small class="negative">${losers.length} down</small></header>
            <div class="stack-list compact-list">
              ${losers.length ? losers.slice(0, 4).map(quote => `
                <button class="list-row" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">
                  <div><strong>${quote.symbol}</strong><small>${quote.name || quote.symbol}</small></div>
                  <div style="text-align:right"><span>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: "quote:" + quote.symbol + ":price", currentPrice: quote.price })}</span><br><small class="negative">${tabularValue(formatSignedPct(quote.changePct))}</small></div>
                </button>
              `).join("") : `<div class="empty-inline">No losers in your watchlist today.</div>`}
            </div>
          </article>
        </div>

        ${earnings.length ? `
        <article class="card earnings-calendar-card">
          <header class="card-head card-head-split">
            <h4>📅 Earnings Calendar</h4>
            <small>Next ${earnings.length} from your watchlist · 14 days</small>
          </header>
          <div class="earnings-cal-grid">
            ${earnings.map((e) => {
              const dayLabel = e.daysUntil < 0 ? "Yesterday" : e.daysUntil === 0 ? "TODAY" : e.daysUntil === 1 ? "Tomorrow" : `${e.daysUntil}d`;
              const dateLabel = e.date.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });
              const urgent = e.daysUntil <= 1 ? "is-urgent" : e.daysUntil <= 3 ? "is-soon" : "";
              return `
                <button class="earnings-cal-tile ${urgent}" type="button" data-load-module="quote" data-target-symbol="${e.symbol}" data-target-panel="${panel}">
                  <div class="earnings-cal-day">${dayLabel}</div>
                  <div class="earnings-cal-date">${dateLabel}</div>
                  <div class="earnings-cal-sym"><strong>${e.symbol}</strong></div>
                  <div class="earnings-cal-price">
                    <span>${formatPrice(e.price, e.symbol)}</span>
                    <small class="${e.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(e.changePct)}</small>
                  </div>
                </button>
              `;
            }).join("")}
          </div>
        </article>
        ` : ""}

        ${sectorPerf.length ? `
        <article class="card">
          <header class="card-head card-head-split">
            <h4>Sector Snapshot</h4>
            <small>Top ${sectorPerf.length} sectors by performance</small>
          </header>
          <div class="sector-snapshot-grid">
            ${sectorPerf.map((s) => {
              const tone = s.avgPct >= 0 ? "positive" : "negative";
              return `
                <div class="sector-snapshot-tile ${tone}">
                  <strong>${s.sector.replace(/^(Information |Communication |Consumer )/, "")}</strong>
                  <span class="${tone}">${formatSignedPct(s.avgPct)}</span>
                </div>
              `;
            }).join("")}
          </div>
        </article>
        ` : ""}

        <article class="card">
          <header class="card-head card-head-split"><h4>Watchlist Overview</h4><small>${top.length} active symbols</small></header>
          <div class="chip-grid">
            ${top
              .map(
                (quote) => `
                  <button class="chip" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">
                    <strong>${quote.symbol}</strong>
                    <span>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: "quote:" + quote.symbol + ":price", currentPrice: quote.price })}</span>
                    <small class="${quote.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct))}</small>
                  </button>
                `,
              )
              .join("")}
          </div>
        </article>

        ${recentNews.length ? `
        <article class="card">
          <header class="card-head card-head-split">
            <h4>Latest Headlines</h4>
            <small>
              <button class="btn btn-ghost btn-sm" type="button" data-load-module="news" data-target-panel="${panel}">View all</button>
            </small>
          </header>
          <div class="stack-list compact-list">
            ${recentNews.map((item) => {
              const sentColor = item.sentiment === "Positive" ? "positive" : item.sentiment === "Negative" ? "negative" : "";
              return `
                <a class="list-row" href="${item.link || "#"}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">
                  <div style="flex:1;min-width:0">
                    <strong style="font-size:0.78rem;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.title || "Untitled"}</strong>
                    <small style="color:var(--muted)">${item.source || ""} ${item.relativeTime || ""}</small>
                  </div>
                  ${item.sentiment ? `<small class="${sentColor}" style="flex-shrink:0;font-weight:600">${item.sentiment}</small>` : ""}
                </a>
              `;
            }).join("")}
          </div>
        </article>
        ` : ""}

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split"><h4>Live Pulse</h4><small>${state.marketPhase}</small></header>
            <div class="pulse-grid">
              ${state.overviewQuotes.length
                ? state.overviewQuotes
                    .slice(0, 4)
                    .map((quote) => `<div class="pulse-card is-live"><span>${quote.symbol}</span><strong>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: "overview:" + quote.symbol + ":price", currentPrice: quote.price })}</strong><small class="${Number(quote.changePct || 0) >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct || 0))}</small></div>`)
                    .join("")
                : `<div class="pulse-card">${loadingSkeleton(3)}</div>`}
            </div>
          </article>
          <article class="card">
            <header class="card-head card-head-split"><h4>Recent Commands</h4><small>History</small></header>
            <div class="stack-list compact-list">
              ${recentCommands.length ? recentCommands.map((item) => `<button class="list-row" type="button" data-autocomplete="${item}"><strong style="font-family:var(--mono);font-size:0.78rem">${item}</strong><small>↵ Run again</small></button>`).join("") : `<div class="empty-inline">Commands you run will appear here.</div>`}
            </div>
          </article>
        </div>

        <article class="card">
          <header class="card-head card-head-split"><h4>Suggested Next Steps</h4><small>Contextual recommendations</small></header>
          <div class="stack-list compact-list">
            ${suggestions.map((item) => `<button class="list-row" type="button" data-suggest-command="${item.command}"><strong>${item.icon} ${item.label}</strong><small>${item.detail}</small></button>`).join("")}
          </div>
        </article>

        <div class="upgrade-banner">
          <div class="upgrade-banner-text">
            <h4>⚡ Go Pro: Unlock the Full Terminal</h4>
            <p>Unlimited alerts &amp; rules, MACD/Bollinger/VWAP indicators, analyst ratings, financial statements, screener CSV export, webhook alerts, and 10s live refresh. <strong style="color:#fff">Starting at $5.99/mo with annual billing.</strong></p>
            <div class="upgrade-feature-pills">
              <span class="upgrade-pill">📊 Advanced indicators</span>
              <span class="upgrade-pill">🔔 Unlimited alerts</span>
              <span class="upgrade-pill">📋 Financial statements</span>
              <span class="upgrade-pill">⬇ CSV export</span>
              <span class="upgrade-pill">☁️ Cloud sync</span>
              <span class="upgrade-pill">🪝 Webhooks</span>
            </div>
          </div>
          <button class="btn-upgrade" type="button" data-open-pricing>View plans →</button>
        </div>
      </section>
    `;
  };
}
