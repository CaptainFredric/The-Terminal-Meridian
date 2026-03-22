import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

function buildCommandSuggestions({ authEnabled, state, buildQuote, panel }) {
  const symbol = state.panelSymbols[panel] || state.watchlist[0] || "AAPL";
  const suggestions = [];

  if (authEnabled && !state.user) {
    suggestions.push({ label: "Sign in and sync", detail: "Back up your workspace to the backend", command: "LOGIN" });
  } else if (authEnabled && state.user) {
    suggestions.push({ label: "Open account settings", detail: "Update profile, password, or account state", command: "SETTINGS" });
  } else {
    suggestions.push({ label: "Local workspace mode", detail: "Everything is running without login right now", command: "SAVE" });
  }

  suggestions.push({ label: "Open Meridian Briefing", detail: "See regime, breadth, and signal board", command: "BRIEF" });

  if (!state.alerts.length) {
    const threshold = Math.max(1, Math.round((buildQuote(symbol)?.price || 100) * 1.03));
    suggestions.push({ label: `Create ${symbol} alert`, detail: "Track a price level for this symbol", command: `ALERT ${symbol} ${threshold}` });
  } else {
    suggestions.push({ label: "Review positions and alerts", detail: "Check triggers and current exposure", command: "PORT" });
  }

  if (state.watchlist.length < 10) {
    suggestions.push({ label: "Broaden your watchlist", detail: "Add a benchmark like SPY", command: "WATCH SPY" });
  }

  suggestions.push({ label: "Show more suggestions", detail: "Refresh this panel with quick ideas", command: "SUGGEST" });
  return suggestions.slice(0, 5);
}

export function createHomeRenderer(context) {
  const { state, buildQuote, calculatePortfolioSummary, authEnabled } = context;

  return function renderHome(panel) {
    const portfolio = calculatePortfolioSummary();
    const top = state.watchlist.slice(0, 6).map(buildQuote).filter(Boolean);
    const recentCommands = state.commandHistory.slice(0, 5);
    const primarySymbol = state.panelSymbols[panel] || state.watchlist[0] || "AAPL";
    const suggestions = buildCommandSuggestions({ authEnabled, state, buildQuote, panel });

    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home">
          <article class="card stat-card glow-card">
            <span>Watchlist</span>
            <strong>${tabularValue(state.watchlist.length)}</strong>
            <small>${state.watchlist.slice(0, 4).join(" · ")}</small>
          </article>
          <article class="card stat-card glow-card">
            <span>Portfolio value</span>
            <strong>${tabularValue(formatPrice(portfolio.value, "USD"))}</strong>
            <small class="${portfolio.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${portfolio.pnl >= 0 ? "+" : ""}${formatPrice(portfolio.pnl, "USD")}`)}</small>
          </article>
          <article class="card stat-card glow-card">
            <span>Market phase</span>
            <strong>${state.marketPhase}</strong>
            <small>${state.health.ok ? state.health.server : "Live feed reconnecting"}</small>
          </article>
        </div>

        <article class="card card-feature">
          <header class="card-head card-head-split">
            <h4>Quick start</h4>
            <small>Open what you need in one click</small>
          </header>
          <div class="action-grid">
            <button class="action-tile" type="button" data-load-module="quote" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Quote</strong><span>Open ${primarySymbol} detail</span></button>
            <button class="action-tile" type="button" data-load-module="chart" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Chart</strong><span>See price action</span></button>
            <button class="action-tile" type="button" data-load-module="options" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Options</strong><span>Load nearest chain</span></button>
            <button class="action-tile" type="button" data-news-filter="${primarySymbol}"><strong>News</strong><span>Filter headlines for ${primarySymbol}</span></button>
          </div>
        </article>

        <article class="card">
          <header class="card-head card-head-split"><h4>Watchlist movers</h4><small>${top.length} active symbols</small></header>
          <div class="chip-grid">
            ${top
              .map(
                (quote) => `
                  <button class="chip" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">
                    <strong>${quote.symbol}</strong>
                    <span>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `quote:${quote.symbol}:price`, currentPrice: quote.price })}</span>
                    <small class="${quote.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct))}</small>
                  </button>
                `,
              )
              .join("")}
          </div>
        </article>

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split"><h4>Recent commands</h4><small>Use again</small></header>
            <div class="stack-list compact-list">
              ${recentCommands.length ? recentCommands.map((item) => `<button class="list-row" type="button" data-autocomplete="${item}"><strong>${item}</strong><small>Run again</small></button>`).join("") : `<div class="empty-inline">Commands you run will show up here.</div>`}
            </div>
          </article>
          <article class="card">
            <header class="card-head card-head-split"><h4>Live pulse</h4><small>${state.marketPhase}</small></header>
            <div class="pulse-grid">
              ${state.overviewQuotes.length
                ? state.overviewQuotes
                    .slice(0, 4)
                    .map((quote) => `<div class="pulse-card is-live"><span>${quote.symbol}</span><strong>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `overview:${quote.symbol}:price`, currentPrice: quote.price })}</strong><small class="${Number(quote.changePct || 0) >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct || 0))}</small></div>`)
                    .join("")
                : `<div class="pulse-card">${loadingSkeleton(3)}</div>`}
            </div>
          </article>
        </div>

        <article class="card">
          <header class="card-head card-head-split"><h4>Suggested next steps</h4><small>Picked from your current view</small></header>
          <div class="stack-list compact-list">
            ${suggestions.map((item) => `<button class="list-row" type="button" data-suggest-command="${item.command}"><strong>${item.label}</strong><small>${item.detail}</small></button>`).join("")}
          </div>
        </article>
      </section>
    `;
  };
}
