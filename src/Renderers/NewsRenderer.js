import { loadingSkeleton } from "./Common.js";

function sentimentClassForHeadline(headline) {
  const content = String(headline || "").toUpperCase();
  const positiveTerms = ["BULLISH", "GROWTH", "SURGE", "GAIN", "RALLY", "RECORD", "BEAT", "PROFIT"];
  const negativeTerms = ["DROP", "MISS", "RISK", "FALL", "CRASH", "LOSS", "DECLINE", "SLUMP", "PLUNGE"];

  if (positiveTerms.some((term) => content.includes(term))) return "news-title-positive";
  if (negativeTerms.some((term) => content.includes(term))) return "news-title-negative";
  return "";
}

export function createNewsRenderer(context) {
  const { state, getRenderableNewsItems, extractHeadlineSymbol, emptyState } = context;

  return function renderNews(panel) {
    const quickFilters = ["ALL", ...new Set([state.panelSymbols[panel], ...Object.values(state.panelSymbols), ...state.watchlist.slice(0, 3)].filter(Boolean))].slice(0, 6);
    let items = getRenderableNewsItems(state.newsFilter);

    // Graceful degradation: if ticker filter returns nothing but global news exists,
    // fall through to show all available newsItems (already in state, no async fetch needed)
    let isGlobalFallback = false;
    if (!items.length && state.newsItems.length) {
      items = state.newsItems.slice(0, 16);
      isGlobalFallback = true;
    }

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          <button class="btn btn-primary" type="button" data-refresh-all>Refresh feed</button>
          ${quickFilters.map((item) => `<button class="range-pill ${item === state.newsFilter ? "is-active" : ""}" type="button" data-news-filter="${item}">${item}</button>`).join("")}
        </div>
        ${items.length
          ? items
              .slice(0, 16)
              .map((item) => {
                const relatedSymbol = extractHeadlineSymbol(item.headline);
                const titleSentimentClass = sentimentClassForHeadline(item.headline);
                return `
                  <article class="news-item${isGlobalFallback ? ' global-news-fallback' : ''}">
                    <div class="news-meta">
                      <span class="news-source">${item.source}</span>
                      <span class="news-time">${item.time}</span>
                      <span class="news-sentiment ${String(item.sentiment || "Neutral").toLowerCase()}">${item.sentiment || "Neutral"}</span>
                    </div>
                    <div class="news-row">
                      <a href="${item.link}" target="_blank" rel="noopener" class="news-title ${titleSentimentClass}">${item.headline}</a>
                      ${relatedSymbol ? `<button class="mini-link" type="button" data-load-module="quote" data-target-symbol="${relatedSymbol}" data-target-panel="${panel}">${relatedSymbol}</button>` : ""}
                    </div>
                  </article>
                `;
              })
              .join("")
          : `<article class="card">${loadingSkeleton(5)}</article>`}
        ${isGlobalFallback ? `<div class="empty-state">No headlines for this ticker. Showing Global Market Feed.</div>` : ""}
      </section>
    `;
  };
}
