import {
  emptyState,
  formatInsightValue,
  formatMarketCap,
  formatPrice,
  formatSignedPct,
  formatVolume,
  loadingSkeleton,
  tabularValue,
} from "./Common.js";

export function createQuoteRenderer(context) {
  const { state, buildQuote, findRelatedSymbols } = context;

  return function renderQuote(panel) {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const quote = buildQuote(symbol);
    if (!quote) {
      if (!state.health?.ok) {
        return `<section class="stack stack-lg">${emptyState(`Offline: ${symbol} quote feed unavailable. Try SYNC ${symbol} once connection resumes.`)}</section>`;
      }
      return `<section class="stack">${loadingSkeleton(5)}</section>`;
    }

    const alertThreshold = Math.max(1, quote.price * 1.03);
    const peers = findRelatedSymbols(symbol).slice(0, 4);
    const deepDive = state.deepDiveCache.get(symbol);
    const profile = deepDive?.profile || {};
    const financials = deepDive?.financials || {};
    const isAnalyzing = state.deepDiveLoading.has(symbol);

    return `
      <section class="stack stack-lg">
        <div class="quote-action-row">
          <button class="btn btn-primary" type="button" data-analyze-symbol="${symbol}">🔬 Analyze</button>
          <button class="btn btn-ghost" type="button" data-open-news-symbol="${symbol}">📰 News</button>
          <button class="btn btn-ghost" type="button" data-sync-symbol="${symbol}">🔄 Sync</button>
        </div>

        <div class="toolbar toolbar-wrap">
          <button class="btn btn-ghost" type="button" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">📈 Chart</button>
          <button class="btn btn-ghost" type="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">⛓ Options</button>
          <button class="btn btn-ghost" type="button" data-news-filter="${symbol}">📋 Related news</button>
          <button class="btn btn-ghost" type="button" data-watch-symbol="${symbol}">👁 Watchlist</button>
          <button class="btn btn-primary" type="button" data-create-alert="${symbol}:>=:${alertThreshold.toFixed(2)}">🔔 Set 3% alert</button>
        </div>

        <article class="card quote-card quote-card-feature">
          <div class="quote-hero">
            <div>
              <span class="eyebrow">${quote.exchange}</span>
              <h4>${quote.name}</h4>
              <div class="quote-row">
                <strong>${tabularValue(formatPrice(quote.price, symbol), { flashKey: `quote:${symbol}:price`, currentPrice: quote.price })}</strong>
                <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct))}</span>
              </div>
              <p>${quote.sector} · ${quote.universe}</p>
            </div>
            <div class="quote-meta-grid">
              <div><span>Volume</span><strong>${tabularValue(formatVolume(quote.volume))}</strong></div>
              <div><span>Market cap</span><strong>${tabularValue(formatMarketCap(quote.marketCap))}</strong></div>
              <div><span>High</span><strong>${tabularValue(formatPrice(quote.dayHigh, symbol))}</strong></div>
              <div><span>Low</span><strong>${tabularValue(formatPrice(quote.dayLow, symbol))}</strong></div>
            </div>
          </div>
        </article>

        <table class="data-table financial-data-table">
          <tbody>
            <tr><td>Previous close</td><td>${tabularValue(formatPrice(quote.previousClose, symbol))}</td><td>Day high</td><td>${tabularValue(formatPrice(quote.dayHigh, symbol))}</td></tr>
            <tr><td>Day low</td><td>${tabularValue(formatPrice(quote.dayLow, symbol))}</td><td>Volume</td><td>${tabularValue(formatVolume(quote.volume))}</td></tr>
            <tr><td>Market cap</td><td>${tabularValue(formatMarketCap(quote.marketCap))}</td><td>Change</td><td class="${quote.change >= 0 ? "positive" : "negative"}">${tabularValue(`${quote.change >= 0 ? "+" : ""}${Number(quote.change).toFixed(2)}`)}</td></tr>
            <tr><td>52-wk high</td><td>${tabularValue(formatPrice(quote.fiftyTwoWeekHigh || quote.dayHigh, symbol))}</td><td>52-wk low</td><td>${tabularValue(formatPrice(quote.fiftyTwoWeekLow || quote.dayLow, symbol))}</td></tr>
            <tr><td>P/E ratio</td><td>${tabularValue(quote.trailingPE ? Number(quote.trailingPE).toFixed(2) : "--")}</td><td>EPS</td><td>${tabularValue(quote.epsTrailingTwelveMonths ? formatPrice(quote.epsTrailingTwelveMonths, symbol) : "--")}</td></tr>
          </tbody>
        </table>

        <article class="card">
          <header class="card-head card-head-split"><h4>🔎 Deep Insight</h4><small>${deepDive?.provider === "rapidapi" ? "🟢 Live modules" : "📦 Provisioned research"}</small></header>
          ${isAnalyzing
            ? loadingSkeleton(4)
            : deepDive
              ? `
                <div class="deep-dive-grid">
                  <div class="insight-block"><span>Sector</span><strong>${profile.sector || quote.sector}</strong></div>
                  <div class="insight-block"><span>Industry</span><strong>${profile.industry || "N/A"}</strong></div>
                  <div class="insight-block"><span>Target mean</span><strong>${tabularValue(formatInsightValue(financials.targetMeanPrice))}</strong></div>
                  <div class="insight-block"><span>Recommendation</span><strong>${formatInsightValue(financials.recommendationKey)}</strong></div>
                  <div class="insight-block"><span>Total revenue</span><strong>${tabularValue(formatInsightValue(financials.totalRevenue))}</strong></div>
                  <div class="insight-block"><span>Free cash flow</span><strong>${tabularValue(formatInsightValue(financials.freeCashflow))}</strong></div>
                </div>
                <p class="insight-summary">${profile.longBusinessSummary || profile.longBusinessDescription || deepDive.reason || "Run analyze to load deeper company context."}</p>
              `
              : `<div class="empty-inline">Run ANALYZE to pull profile, financials, and ticker-specific news.</div>`}
        </article>

        <article class="card">
          <header class="card-head card-head-split"><h4>🔗 Similar Names</h4><small>${quote.sector} · ${peers.length} peers</small></header>
          <div class="chip-grid compact-chip-grid">
            ${peers.map((peer) => `<button class="chip chip-peer" type="button" data-load-module="quote" data-target-symbol="${peer.symbol}" data-target-panel="${panel}"><strong>${peer.symbol}</strong><span>${tabularValue(formatPrice(peer.price, peer.symbol), { flashKey: `quote:${peer.symbol}:price`, currentPrice: peer.price })}</span><small class="${peer.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(peer.changePct))}</small></button>`).join("") || `<div class="empty-inline">No comparable names found yet.</div>`}
          </div>
        </article>
      </section>
    `;
  };
}
