import { loadingSkeleton } from "./Common.js";

// Extracted as module-level constants — not recreated on every render call
const POSITIVE_TERMS = ["BULLISH", "GROWTH", "SURGE", "GAIN", "RALLY", "RECORD", "BEAT", "PROFIT", "UPGRADE", "STRONG", "SOAR", "JUMP", "HIGH"];
const NEGATIVE_TERMS = ["DROP", "MISS", "RISK", "FALL", "CRASH", "LOSS", "DECLINE", "SLUMP", "PLUNGE", "DOWNGRADE", "WEAK", "WARNING", "SELL", "CUT"];

function sentimentClassForHeadline(headline) {
  const content = String(headline || "").toUpperCase();
  if (POSITIVE_TERMS.some((t) => content.includes(t))) return "news-title-positive";
  if (NEGATIVE_TERMS.some((t) => content.includes(t))) return "news-title-negative";
  return "";
}

function sentimentIcon(sentiment) {
  const s = String(sentiment || "").toLowerCase();
  if (s === "positive") return "🟢";
  if (s === "negative") return "🔴";
  return "⚪";
}

/** Ensure news links don't inject javascript: or data: URIs */
function safeLink(href) {
  const str = String(href || "").trim();
  return str.startsWith("http://") || str.startsWith("https://") ? str : "#";
}

export function createNewsRenderer(context) {
  const { state, getRenderableNewsItems, extractHeadlineSymbol } = context;

  return function renderNews(panel) {
    const quickFilters = ["ALL", ...new Set([state.panelSymbols[panel], ...Object.values(state.panelSymbols), ...state.watchlist.slice(0, 4)].filter(Boolean))].slice(0, 7);
    let items = getRenderableNewsItems(state.newsFilter);

    let isGlobalFallback = false;
    if (!items.length && state.newsItems.length) {
      items = state.newsItems.slice(0, 20);
      isGlobalFallback = true;
    }

    const positiveCount = items.filter((i) => String(i.sentiment || "").toLowerCase() === "positive").length;
    const negativeCount = items.filter((i) => String(i.sentiment || "").toLowerCase() === "negative").length;
    const neutralCount = items.length - positiveCount - negativeCount;
    const filterLabel = state.newsFilter !== "ALL" ? `${state.newsFilter} filtered` : "All sources";

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap news-filter-bar">
          <span class="toolbar-label">Feed</span>
          ${quickFilters.map((item) => `<button class="range-pill ${item === state.newsFilter ? "is-active" : ""}" type="button" data-news-filter="${item}">${item}</button>`).join("")}
          <button class="btn btn-ghost btn-refresh-icon" type="button" data-refresh-all title="Refresh news feed">↻</button>
        </div>

        ${items.length ? `
          <div class="news-sentiment-bar">
            <strong>${items.length}</strong>&thinsp;headlines
            <span class="sentiment-sep">·</span>
            <span class="positive">🟢 ${positiveCount}</span>
            <span class="negative">🔴 ${negativeCount}</span>
            <span class="sentiment-neutral">⚪ ${neutralCount}</span>
            <span class="sentiment-filter-note">${isGlobalFallback ? "Global feed" : filterLabel}</span>
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
                    <article class="news-item${isGlobalFallback ? " global-news-fallback" : ""}">
                      <div class="news-meta">
                        <span class="news-source">${item.source}</span>
                        <span class="news-time">${item.time}</span>
                        <span class="news-sentiment ${String(item.sentiment || "Neutral").toLowerCase()}">${sentimentIcon(item.sentiment)} ${item.sentiment || "Neutral"}</span>
                      </div>
                      <div class="news-row">
                        <a href="${safeLink(item.link)}" target="_blank" rel="noopener noreferrer" class="news-title ${titleSentimentClass}">${item.headline}</a>
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
