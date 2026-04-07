import { loadingSkeleton } from "./Common.js";

function sentimentClassForHeadline(headline) {
  const content = String(headline || "").toUpperCase();
  const positiveTerms = ["BULLISH", "GROWTH", "SURGE", "GAIN", "RALLY", "RECORD", "BEAT", "PROFIT", "UPGRADE", "STRONG", "SOAR", "JUMP", "HIGH"];
  const negativeTerms = ["DROP", "MISS", "RISK", "FALL", "CRASH", "LOSS", "DECLINE", "SLUMP", "PLUNGE", "DOWNGRADE", "WEAK", "WARNING", "SELL", "CUT"];

  if (positiveTerms.some((term) => content.includes(term))) return "news-title-positive";
  if (negativeTerms.some((term) => content.includes(term))) return "news-title-negative";
  return "";
}

function sentimentIcon(sentiment) {
  const s = String(sentiment || "").toLowerCase();
  if (s === "positive") return "🟢";
  if (s === "negative") return "🔴";
  return "⚪";
}

export function createNewsRenderer(context) {
  const { state, getRenderableNewsItems, extractHeadlineSymbol, emptyState } = context;

  return function renderNews(panel) {
    const quickFilters = ["ALL", ...new Set([state.panelSymbols[panel], ...Object.values(state.panelSymbols), ...state.watchlist.slice(0, 4)].filter(Boolean))].slice(0, 7);
    let items = getRenderableNewsItems(state.newsFilter);

    let isGlobalFallback = false;
    if (!items.length && state.newsItems.length) {
      items = state.newsItems.slice(0, 20);
      isGlobalFallback = true;
    }

    const positiveCount = items.filter(i => String(i.sentiment || "").toLowerCase() === "positive").length;
    const negativeCount = items.filter(i => String(i.sentiment || "").toLowerCase() === "negative").length;
    const neutralCount = items.length - positiveCount - negativeCount;

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          <button class="btn btn-primary" type="button" data-refresh-all>Refresh feed</button>
          ${quickFilters.map((item) => `<button class="range-pill ${item === state.newsFilter ? "is-active" : ""}" type="button" data-news-filter="${item}">${item}</button>`).join("")}
        </div>

        ${items.length ? `
          <div class="card-grid card-grid-home">
            <article class="card stat-card"><span>Headlines</span><strong>${items.length}</strong><small>${state.newsFilter === "ALL" ? "All sources" : state.newsFilter + " filtered"}</small></article>
            <article class="card stat-card"><span>Positive</span><strong class="positive">${positiveCount}</strong><small>Bullish sentiment</small></article>
            <article class="card stat-card"><span>Negative</span><strong class="negative">${negativeCount}</strong><small>Bearish sentiment</small></article>
          </div>
        ` : ""}

        <article class="card">
          ${items.length
            ? items
                .slice(0, 20)
                .map((item) => {
                  const relatedSymbol = extractHeadlineSymbol(item.headline);
                  const titleSentimentClass = sentimentClassForHeadline(item.headline);
                  return `
                    <article class="news-item${isGlobalFallback ? ' global-news-fallback' : ''}">
                      <div class="news-meta">
                        <span class="news-source">${item.source}</span>
                        <span class="news-time">${item.time}</span>
                        <span class="news-sentiment ${String(item.sentiment || "Neutral").toLowerCase()}">${sentimentIcon(item.sentiment)} ${item.sentiment || "Neutral"}</span>
                      </div>
                      <div class="news-row">
                        <a href="${item.link}" target="_blank" rel="noopener" class="news-title ${titleSentimentClass}">${item.headline}</a>
                        ${relatedSymbol ? `<button class="mini-link" type="button" data-load-module="quote" data-target-symbol="${relatedSymbol}" data-target-panel="${panel}">${relatedSymbol}</button>` : ""}
                      </div>
                    </article>
                  `;
                })
                .join("")
            : `<div class="empty-inline">${loadingSkeleton(5)}<p style="margin-top:8px">Loading headlines…</p></div>`}
        </article>

        ${isGlobalFallback ? `<div class="empty-state">No headlines matched "${state.newsFilter}". Showing global market feed instead.</div>` : ""}
      </section>
    `;
  };
}
