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

  const formatOptionalNumber = (value, digits = 2) => {
    if (value == null || Number.isNaN(Number(value))) return "N/A";
    return Number(value).toFixed(digits);
  };

  const formatOptionalPercent = (value) => {
    if (value == null || Number.isNaN(Number(value))) return "N/A";
    const numeric = Number(value);
    const percent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
    return `${percent.toFixed(2)}%`;
  };

  const formatOptionalDate = (value) => {
    if (!value) return "N/A";
    const numeric = Number(value);
    const date = Number.isFinite(numeric) && numeric > 1e9 ? new Date(numeric * (numeric < 10_000_000_000 ? 1000 : 1)) : new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatRange = (low, high, symbol) => {
    if (!low && !high) return "N/A";
    return `${formatPrice(low || 0, symbol)} - ${formatPrice(high || 0, symbol)}`;
  };

  const buildDepth = (quote) => {
    const spread = Math.max(Number(quote.price || 0) * 0.001, 0.01);
    const bid = Number(quote.bid ?? (quote.price - spread / 2));
    const ask = Number(quote.ask ?? (quote.price + spread / 2));
    const bidSize = Number(quote.bidSize || Math.max(Math.round((quote.averageVolume || quote.volume || 10_000) / 1600), 24));
    const askSize = Number(quote.askSize || Math.max(Math.round((quote.averageVolume || quote.volume || 10_000) / 1750), 20));
    return {
      bid,
      ask,
      bidSize,
      askSize,
      spread: Math.max(ask - bid, 0),
    };
  };

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
    const depth = buildDepth(quote);
    const statTiles = [
      { label: "Mkt Cap", value: formatMarketCap(quote.marketCap) },
      { label: "P/E Ratio", value: formatOptionalNumber(quote.trailingPE) },
      { label: "Div Yield", value: formatOptionalPercent(quote.dividendYield) },
      { label: "52W Range", value: formatRange(quote.fiftyTwoWeekLow, quote.fiftyTwoWeekHigh, symbol), className: "quote-stat-wide" },
      { label: "Avg Volume", value: formatVolume(quote.averageVolume || quote.volume) },
      { label: "Beta", value: formatOptionalNumber(quote.beta) },
      { label: "Prev Close", value: formatPrice(quote.previousClose, symbol) },
      { label: "Bid / Ask", value: `${formatPrice(depth.bid, symbol)} / ${formatPrice(depth.ask, symbol)}`, className: "quote-stat-wide" },
      { label: "Next Earnings", value: formatOptionalDate(quote.earningsTimestamp || financials.nextEarningsDate || profile.nextEarningsDate) },
    ];

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

        <article class="card">
          <header class="card-head card-head-split"><h4>Key Statistics</h4><small>Quote intelligence grid</small></header>
          <div class="quote-stats-grid">
            ${statTiles
              .map(
                (tile) => `
                  <div class="quote-stat-tile ${tile.className || ""}">
                    <span>${tile.label}</span>
                    <strong>${tabularValue(tile.value)}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>

        <article class="card quote-depth-card">
          <header class="card-head card-head-split"><h4>Mini Depth</h4><small>${tabularValue(formatPrice(depth.spread, symbol))} spread</small></header>
          <div class="quote-depth-grid">
            <div class="quote-depth-side bid-side">
              <span>Bid stack</span>
              <strong>${tabularValue(formatPrice(depth.bid, symbol))}</strong>
              <small>${tabularValue(formatVolume(depth.bidSize))} bid size</small>
              <div class="depth-bar"><i style="width: ${Math.min(100, Math.max(18, depth.bidSize / Math.max(depth.askSize, depth.bidSize) * 100))}%"></i></div>
            </div>
            <div class="quote-depth-side ask-side">
              <span>Ask stack</span>
              <strong>${tabularValue(formatPrice(depth.ask, symbol))}</strong>
              <small>${tabularValue(formatVolume(depth.askSize))} ask size</small>
              <div class="depth-bar"><i style="width: ${Math.min(100, Math.max(18, depth.askSize / Math.max(depth.askSize, depth.bidSize) * 100))}%"></i></div>
            </div>
          </div>
        </article>

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
