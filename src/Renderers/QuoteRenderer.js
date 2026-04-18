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

function formatRecommendation(key) {
  if (!key) return "N/A";
  const map = { buy: "Buy", strongbuy: "Strong Buy", strong_buy: "Strong Buy", hold: "Hold", sell: "Sell", strongsell: "Strong Sell", strong_sell: "Strong Sell", underperform: "Underperform", outperform: "Outperform" };
  return map[String(key).toLowerCase().replace(/[\s-]/g, "")] || String(key);
}

function getRecommendationTone(key) {
  if (!key) return "";
  const lower = String(key).toLowerCase().replace(/[\s_-]/g, "");
  if (lower.includes("buy") || lower === "outperform") return "rec-bullish";
  if (lower.includes("sell") || lower === "underperform") return "rec-bearish";
  return "rec-neutral";
}

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

    const w52low = quote.fiftyTwoWeekLow || 0;
    const w52high = quote.fiftyTwoWeekHigh || 0;
    const w52pct = (w52low && w52high && w52high > w52low)
      ? Math.max(0, Math.min(100, ((quote.price - w52low) / (w52high - w52low)) * 100))
      : null;

    return `
      <section class="stack stack-lg">
        <div class="quote-action-row">
          <button class="btn btn-primary" type="button" data-analyze-symbol="${symbol}">Analyze</button>
          <button class="btn btn-ghost" type="button" data-open-news-symbol="${symbol}">News</button>
          <button class="btn btn-ghost" type="button" data-sync-symbol="${symbol}">Sync</button>
        </div>

        <div class="toolbar toolbar-wrap">
          <button class="btn btn-ghost btn-sm" type="button" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">Chart</button>
          <button class="btn btn-ghost btn-sm" type="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Options</button>
          <button class="btn btn-ghost btn-sm" type="button" data-news-filter="${symbol}">Related news</button>
          <button class="btn btn-ghost btn-sm" type="button" data-watch-symbol="${symbol}">+ Watchlist</button>
          <button class="btn btn-outline btn-sm" type="button" data-create-alert="${symbol}:>=:${alertThreshold.toFixed(2)}">Set 3% alert</button>
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
              ${w52pct !== null ? `
                <div class="w52-range-wrap">
                  <div class="w52-range-bar">
                    <div class="w52-range-fill" style="width:${w52pct.toFixed(1)}%"></div>
                    <div class="w52-range-marker" style="left:${w52pct.toFixed(1)}%"></div>
                  </div>
                  <div class="w52-range-labels">
                    <span>${formatPrice(w52low, symbol)}</span>
                    <span class="w52-label-mid">52W Range</span>
                    <span>${formatPrice(w52high, symbol)}</span>
                  </div>
                </div>` : ""}
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

        <article class="card position-sizer-card" data-position-sizer>
          <header class="card-head card-head-split">
            <h4>Position Sizer</h4>
            <small>Risk-based share count · ${symbol}</small>
          </header>
          <div class="position-sizer-grid">
            <label class="position-sizer-field">
              <span>Account size ($)</span>
              <input type="number" min="0" step="100" value="100000" data-pos-input="account" oninput="window.__updatePositionSizer && window.__updatePositionSizer(this)" />
            </label>
            <label class="position-sizer-field">
              <span>Risk per trade (%)</span>
              <input type="number" min="0.1" max="100" step="0.1" value="1" data-pos-input="risk" oninput="window.__updatePositionSizer && window.__updatePositionSizer(this)" />
            </label>
            <label class="position-sizer-field">
              <span>Entry price ($)</span>
              <input type="number" min="0" step="0.01" value="${quote.price.toFixed(2)}" data-pos-input="entry" oninput="window.__updatePositionSizer && window.__updatePositionSizer(this)" />
            </label>
            <label class="position-sizer-field">
              <span>Stop loss ($)</span>
              <input type="number" min="0" step="0.01" value="${(quote.price * 0.95).toFixed(2)}" data-pos-input="stop" oninput="window.__updatePositionSizer && window.__updatePositionSizer(this)" />
            </label>
          </div>
          <div class="position-sizer-results">
            <div class="sizer-result">
              <span>Shares</span>
              <strong data-pos-out="shares">—</strong>
            </div>
            <div class="sizer-result">
              <span>Position size</span>
              <strong data-pos-out="size">—</strong>
            </div>
            <div class="sizer-result">
              <span>Max loss</span>
              <strong class="negative" data-pos-out="loss">—</strong>
            </div>
            <div class="sizer-result">
              <span>Stop distance</span>
              <strong data-pos-out="distance">—</strong>
            </div>
            <div class="sizer-result sizer-result-wide">
              <span>R-multiple targets</span>
              <strong data-pos-out="targets">—</strong>
            </div>
          </div>
          <div class="position-sizer-quick">
            <button class="btn btn-ghost btn-sm" type="button" data-pos-quick="0.5">0.5%</button>
            <button class="btn btn-ghost btn-sm" type="button" data-pos-quick="1">1%</button>
            <button class="btn btn-ghost btn-sm" type="button" data-pos-quick="2">2%</button>
            <button class="btn btn-ghost btn-sm" type="button" data-pos-quick="3">3%</button>
            <span class="position-sizer-hint">Quick risk presets · educational only</span>
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
          <header class="card-head card-head-split"><h4>Deep Insight</h4><small>${deepDive?.provider === "rapidapi" ? "🟢 Live modules" : "📦 Provisioned research"}</small></header>
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

        ${!deepDive ? `
        <article class="card pro-teaser-card" style="border-style:dashed;border-color:rgba(246,179,75,0.3);background:rgba(246,179,75,0.03)">
          <header class="card-head card-head-split">
            <h4 style="color:var(--warning)">📋 Analyst Ratings &amp; Financial Statements</h4>
            <button class="pro-lock-badge" type="button" data-open-pricing style="font-size:0.75rem;padding:3px 10px">🔒 Unlock with Pro</button>
          </header>
          <p style="color:var(--muted);font-size:0.78rem;margin:0">Run ANALYZE to load deep-dive data, or upgrade to Pro for analyst targets, revenue, margins, ROE, and full financials — always visible without a manual fetch.</p>
        </article>
        ` : ""}

        ${deepDive && financials ? `
        <article class="card">
          <header class="card-head card-head-split"><h4>Analyst Consensus</h4><small>Wall Street ratings</small></header>
          <div class="analyst-consensus">
            <div class="analyst-rating-badge ${getRecommendationTone(financials.recommendationKey)}">
              <strong>${formatRecommendation(financials.recommendationKey)}</strong>
              <small>${formatInsightValue(financials.numberOfAnalystOpinions)} analysts</small>
            </div>
            <div class="analyst-targets">
              <div class="target-row"><span>Target Low</span><strong>${tabularValue(formatInsightValue(financials.targetLowPrice))}</strong></div>
              <div class="target-row"><span>Target Mean</span><strong class="accent-text">${tabularValue(formatInsightValue(financials.targetMeanPrice))}</strong></div>
              <div class="target-row"><span>Target High</span><strong>${tabularValue(formatInsightValue(financials.targetHighPrice))}</strong></div>
              <div class="target-row"><span>Current Price</span><strong>${tabularValue(formatPrice(quote.price, symbol))}</strong></div>
            </div>
          </div>
        </article>

        <article class="card">
          <header class="card-head card-head-split"><h4>Financial Snapshot</h4><small>Key financial metrics</small></header>
          <div class="financial-grid">
            <div class="financial-metric"><span>Revenue</span><strong>${tabularValue(formatInsightValue(financials.totalRevenue))}</strong></div>
            <div class="financial-metric"><span>Gross Profit</span><strong>${tabularValue(formatInsightValue(financials.grossProfits))}</strong></div>
            <div class="financial-metric"><span>EBITDA</span><strong>${tabularValue(formatInsightValue(financials.ebitda))}</strong></div>
            <div class="financial-metric"><span>Net Income</span><strong>${tabularValue(formatInsightValue(financials.netIncomeToCommon || financials.earningsGrowth))}</strong></div>
            <div class="financial-metric"><span>Operating Margin</span><strong>${tabularValue(formatInsightValue(financials.operatingMargins))}</strong></div>
            <div class="financial-metric"><span>Profit Margin</span><strong>${tabularValue(formatInsightValue(financials.profitMargins))}</strong></div>
            <div class="financial-metric"><span>ROE</span><strong>${tabularValue(formatInsightValue(financials.returnOnEquity))}</strong></div>
            <div class="financial-metric"><span>ROA</span><strong>${tabularValue(formatInsightValue(financials.returnOnAssets))}</strong></div>
            <div class="financial-metric"><span>Debt/Equity</span><strong>${tabularValue(formatInsightValue(financials.debtToEquity))}</strong></div>
            <div class="financial-metric"><span>Current Ratio</span><strong>${tabularValue(formatInsightValue(financials.currentRatio))}</strong></div>
            <div class="financial-metric"><span>Revenue Growth</span><strong>${tabularValue(formatInsightValue(financials.revenueGrowth))}</strong></div>
            <div class="financial-metric"><span>Earnings Growth</span><strong>${tabularValue(formatInsightValue(financials.earningsGrowth))}</strong></div>
          </div>
        </article>
        ` : ""}

        <article class="card ticker-notes-card" data-ticker-notes-card="${symbol}">
          <header class="card-head card-head-split">
            <h4>📝 Trade Journal</h4>
            <small data-ticker-notes-status="${symbol}">Local · auto-saved</small>
          </header>
          <textarea
            class="ticker-notes-textarea"
            data-ticker-notes-input="${symbol}"
            placeholder="Notes about ${symbol}: thesis, entry plan, key levels, earnings expectations…"
            rows="4"
            maxlength="2000"
          ></textarea>
          <div class="ticker-notes-meta">
            <small data-ticker-notes-count="${symbol}">0 / 2000 chars</small>
            <small class="muted-cell">Stored locally — never leaves your device</small>
          </div>
        </article>

        <article class="card">
          <header class="card-head card-head-split"><h4>Similar Names</h4><small>${quote.sector} · ${peers.length} peers</small></header>
          <div class="chip-grid compact-chip-grid">
            ${peers.map((peer) => `<button class="chip chip-peer" type="button" data-load-module="quote" data-target-symbol="${peer.symbol}" data-target-panel="${panel}"><strong>${peer.symbol}</strong><span>${tabularValue(formatPrice(peer.price, peer.symbol), { flashKey: `quote:${peer.symbol}:price`, currentPrice: peer.price })}</span><small class="${peer.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(peer.changePct))}</small></button>`).join("") || `<div class="empty-inline">No comparable names found yet.</div>`}
          </div>
        </article>
      </section>
    `;
  };
}
