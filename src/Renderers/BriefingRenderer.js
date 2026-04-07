import { formatPrice, formatSignedPct, tabularValue } from "./Common.js";

function regimeLabel(breadth) {
  if (breadth >= 70) return { label: "Risk-On", tone: "positive" };
  if (breadth >= 50) return { label: "Neutral", tone: "" };
  if (breadth >= 30) return { label: "Cautious", tone: "" };
  return { label: "Risk-Off", tone: "negative" };
}

function volatilityLabel(vol) {
  if (vol < 0.5) return "Low";
  if (vol < 1.2) return "Moderate";
  if (vol < 2.5) return "Elevated";
  return "High";
}

export function createBriefingRenderer(context) {
  const { state, buildQuote, currentTimeShort, calculatePulse } = context;

  return function renderBriefing(panel) {
    const primary = state.panelSymbols[panel] || state.watchlist[0] || "SPY";
    const primaryQuote = buildQuote(primary);
    const pulse = calculatePulse();
    const totalTickers = pulse.gainers + pulse.losers;
    const breadth = totalTickers ? (pulse.gainers / totalTickers) * 100 : 50;
    const regime = regimeLabel(breadth);
    const volatility = state.overviewQuotes.length
      ? state.overviewQuotes.reduce((sum, quote) => sum + Math.abs(Number(quote.changePct || 0)), 0) / state.overviewQuotes.length
      : 0;
    const volLabel = volatilityLabel(volatility);
    const watchedLeaders = state.watchlist
      .map((symbol) => buildQuote(symbol))
      .filter(Boolean)
      .sort((left, right) => Math.abs(right.changePct) - Math.abs(left.changePct))
      .slice(0, 6);
    const activeAlerts = state.alerts.filter(a => a.status === "watching").length;
    const triggeredAlerts = state.alerts.filter(a => a.status === "triggered").length;
    const rulesCount = Array.isArray(state.activeRules) ? state.activeRules.length : 0;

    return `
      <section class="stack stack-lg">
        <article class="card briefing-hero">
          <header class="card-head card-head-split">
            <h4>📡 Meridian Briefing</h4>
            <small>${currentTimeShort()} · ${state.health.ok ? "Live" : "Reconnecting"}</small>
          </header>
          <div class="briefing-grid">
            <div class="brief-metric">
              <span>Market Phase</span>
              <strong>${state.marketPhase}</strong>
              <small>${state.health.ok ? "Feed connected" : "Feed reconnecting"}</small>
            </div>
            <div class="brief-metric">
              <span>Regime</span>
              <strong class="${regime.tone}">${regime.label}</strong>
              <small>Breadth ${breadth.toFixed(0)}%</small>
            </div>
            <div class="brief-metric">
              <span>Breadth</span>
              <strong>${tabularValue(`${breadth.toFixed(0)}%`)}</strong>
              <small>${pulse.gainers} up · ${pulse.losers} down</small>
            </div>
            <div class="brief-metric">
              <span>Volatility</span>
              <strong>${tabularValue(`${volatility.toFixed(2)}%`)}</strong>
              <small>${volLabel} — avg absolute move</small>
            </div>
          </div>
        </article>

        <div class="card-grid card-grid-home">
          <article class="card stat-card">
            <span>Anchor Symbol</span>
            <strong>${primary}</strong>
            <small>${primaryQuote ? tabularValue(formatPrice(primaryQuote.price, primary), { flashKey: "quote:" + primary + ":price", currentPrice: primaryQuote.price }) : "Fetching…"}</small>
          </article>
          <article class="card stat-card">
            <span>Active Alerts</span>
            <strong>${activeAlerts + triggeredAlerts}</strong>
            <small>${triggeredAlerts ? triggeredAlerts + " triggered" : activeAlerts + " watching"}</small>
          </article>
          <article class="card stat-card">
            <span>Rules Engine</span>
            <strong>${rulesCount}</strong>
            <small>${rulesCount ? "Active rules loaded" : "No rules set"}</small>
          </article>
        </div>

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split"><h4>📋 Signal Board</h4><small>Recommended actions</small></header>
            <div class="stack-list compact-list">
              <button class="list-row" type="button" data-load-module="chart" data-target-symbol="${primary}" data-target-panel="${panel}"><strong>📈 ${primary} Trend</strong><small>Review structure, support, and resistance</small></button>
              <button class="list-row" type="button" data-news-filter="${primary}"><strong>📰 ${primary} Headlines</strong><small>Scan catalysts and sentiment</small></button>
              <button class="list-row" type="button" data-load-module="portfolio" data-target-panel="${panel}"><strong>💼 Risk Check</strong><small>P/L exposure and triggered alerts</small></button>
              <button class="list-row" type="button" data-load-module="macro" data-target-panel="${panel}"><strong>🌐 Macro Backdrop</strong><small>Yield curve, FX, and regime context</small></button>
              <button class="list-row" type="button" data-load-module="heatmap" data-target-panel="${panel}"><strong>🗺 Sector Heatmap</strong><small>Identify sector rotation and strength</small></button>
            </div>
          </article>

          <article class="card">
            <header class="card-head card-head-split"><h4>🏆 Top Movers</h4><small>By absolute move</small></header>
            <div class="chip-grid compact-chip-grid">
              ${watchedLeaders.length
                ? watchedLeaders
                    .map(
                      (quote) => `<button class="chip chip-peer" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}"><strong>${quote.symbol}</strong><span>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: "quote:" + quote.symbol + ":price", currentPrice: quote.price })}</span><small class="${quote.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct))}</small></button>`,
                    )
                    .join("")
                : `<div class="empty-inline">Leaders appear as data updates arrive.</div>`}
            </div>
          </article>
        </div>
      </section>
    `;
  };
}
