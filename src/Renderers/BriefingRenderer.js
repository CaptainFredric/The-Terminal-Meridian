import { formatPrice, formatSignedPct, tabularValue } from "./Common.js";

export function createBriefingRenderer(context) {
  const { state, buildQuote, currentTimeShort, calculatePulse } = context;

  return function renderBriefing(panel) {
    const primary = state.panelSymbols[panel] || state.watchlist[0] || "SPY";
    const primaryQuote = buildQuote(primary);
    const pulse = calculatePulse();
    const breadth = pulse.gainers + pulse.losers ? (pulse.gainers / (pulse.gainers + pulse.losers)) * 100 : 50;
    const volatility = state.overviewQuotes.length
      ? state.overviewQuotes.reduce((sum, quote) => sum + Math.abs(Number(quote.changePct || 0)), 0) / state.overviewQuotes.length
      : 0;
    const watchedLeaders = state.watchlist
      .map((symbol) => buildQuote(symbol))
      .filter(Boolean)
      .sort((left, right) => Math.abs(right.changePct) - Math.abs(left.changePct))
      .slice(0, 4);

    return `
      <section class="stack stack-lg">
        <article class="card briefing-hero">
          <header class="card-head card-head-split">
            <h4>Meridian Briefing</h4>
            <small>${currentTimeShort()} snapshot</small>
          </header>
          <div class="briefing-grid">
            <div class="brief-metric">
              <span>Regime</span>
              <strong>${state.marketPhase}</strong>
              <small>${state.health.ok ? "Live feed connected" : "Feed reconnecting"}</small>
            </div>
            <div class="brief-metric">
              <span>Breadth</span>
              <strong>${tabularValue(`${breadth.toFixed(0)}%`)}</strong>
              <small>${pulse.gainers} up · ${pulse.losers} down</small>
            </div>
            <div class="brief-metric">
              <span>Volatility pulse</span>
              <strong>${tabularValue(`${volatility.toFixed(2)}%`)}</strong>
              <small>Avg absolute move</small>
            </div>
            <div class="brief-metric">
              <span>Anchor</span>
              <strong>${primary}</strong>
              <small>${primaryQuote ? tabularValue(formatPrice(primaryQuote.price, primary), { flashKey: `quote:${primary}:price`, currentPrice: primaryQuote.price }) : "Fetching quote"}</small>
            </div>
          </div>
        </article>

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split"><h4>Signal board</h4><small>What to check next</small></header>
            <div class="stack-list compact-list">
              <button class="list-row" type="button" data-load-module="chart" data-target-symbol="${primary}" data-target-panel="${panel}"><strong>${primary} trend</strong><small>Review structure and range</small></button>
              <button class="list-row" type="button" data-news-filter="${primary}"><strong>${primary} headlines</strong><small>Scan catalysts and tone</small></button>
              <button class="list-row" type="button" data-load-module="portfolio" data-target-panel="${panel}"><strong>Risk check</strong><small>Open positions and alerts</small></button>
              <button class="list-row" type="button" data-load-module="macro" data-target-panel="${panel}"><strong>Macro backdrop</strong><small>Rates, FX, and regime context</small></button>
            </div>
          </article>

          <article class="card">
            <header class="card-head card-head-split"><h4>Leaders</h4><small>By absolute move</small></header>
            <div class="chip-grid compact-chip-grid">
              ${watchedLeaders.length
                ? watchedLeaders
                    .map(
                      (quote) => `<button class="chip chip-peer" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}"><strong>${quote.symbol}</strong><span>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `quote:${quote.symbol}:price`, currentPrice: quote.price })}</span><small class="${quote.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct))}</small></button>`,
                    )
                    .join("")
                : `<div class="empty-inline">Leaders will appear as market data updates.</div>`}
            </div>
          </article>
        </div>
      </section>
    `;
  };
}
