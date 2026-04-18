import { loadingSkeleton } from "./Common.js";

const POSITIVE_TERMS = ["BULLISH", "GROWTH", "SURGE", "GAIN", "RALLY", "RECORD", "BEAT", "PROFIT", "UPGRADE", "STRONG", "SOAR", "JUMP", "HIGH"];
const NEGATIVE_TERMS = ["DROP", "MISS", "RISK", "FALL", "CRASH", "LOSS", "DECLINE", "SLUMP", "PLUNGE", "DOWNGRADE", "WEAK", "WARNING", "SELL", "CUT"];

/**
 * Build a compact SVG sentiment sparkline.
 * items: headline objects (newest-first assumed). bucketCount: number of time buckets.
 * Returns SVG string showing positive/negative area over time.
 */
function buildSentimentSparkline(items, bucketCount = 6) {
  if (!items.length) return "";

  // Split into equal-sized buckets (oldest → newest, left → right)
  const reversed = [...items].reverse();
  const size = Math.ceil(reversed.length / bucketCount);
  const buckets = [];
  for (let i = 0; i < bucketCount; i++) {
    const slice = reversed.slice(i * size, (i + 1) * size);
    if (!slice.length) continue;
    const pos = slice.filter((x) => String(x.sentiment || "").toLowerCase() === "positive").length;
    const neg = slice.filter((x) => String(x.sentiment || "").toLowerCase() === "negative").length;
    const score = Math.round(((pos - neg) / slice.length) * 100); // -100 .. +100
    buckets.push({ score, pos, neg, total: slice.length });
  }
  if (buckets.length < 2) return "";

  const W = 200, H = 52, PAD = 6;
  const usableW = W - PAD * 2;
  const usableH = H - PAD * 2;
  const midY = PAD + usableH / 2;

  // Map score to Y (score=+100 → top, score=-100 → bottom)
  const scoreToY = (s) => midY - (s / 100) * (usableH / 2);
  const xStep = usableW / (buckets.length - 1);
  const pts = buckets.map((b, i) => ({ x: PAD + i * xStep, y: scoreToY(b.score), score: b.score }));

  // Build smooth polyline path
  const pathPts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Area polygon for fill (close to midY baseline)
  const areaPts = [
    `${pts[0].x.toFixed(1)},${midY.toFixed(1)}`,
    ...pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${pts[pts.length - 1].x.toFixed(1)},${midY.toFixed(1)}`,
  ].join(" ");

  // Determine overall tone for area color
  const avgScore = Math.round(pts.reduce((s, p) => s + p.score, 0) / pts.length);
  const areaFill = avgScore >= 0 ? "rgba(0,230,118,0.12)" : "rgba(255,82,82,0.12)";
  const lineFill = avgScore >= 0 ? "rgba(0,230,118,0.8)" : "rgba(255,82,82,0.8)";

  // Dot at current (last) point
  const last = pts[pts.length - 1];
  const dotFill = last.score >= 0 ? "#00e676" : "#ff5252";

  return `
    <svg class="sentiment-sparkline" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <line x1="${PAD}" y1="${midY.toFixed(1)}" x2="${W - PAD}" y2="${midY.toFixed(1)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 3"/>
      <polygon points="${areaPts}" fill="${areaFill}"/>
      <polyline points="${pathPts}" fill="none" stroke="${lineFill}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((p, i) => i === pts.length - 1 ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${dotFill}" stroke="var(--body-bg)" stroke-width="1.5"/>` : "").join("")}
      <text x="${PAD}" y="${PAD + 6}" font-size="7" fill="var(--muted)" font-family="monospace">older</text>
      <text x="${W - PAD}" y="${PAD + 6}" font-size="7" fill="var(--muted)" font-family="monospace" text-anchor="end">now</text>
    </svg>
  `.trim();
}

function sentimentClassForHeadline(headline) {
  const content = String(headline || "").toUpperCase();
  if (POSITIVE_TERMS.some((t) => content.includes(t))) return "news-title-positive";
  if (NEGATIVE_TERMS.some((t) => content.includes(t))) return "news-title-negative";
  return "";
}

function sentimentIcon(sentiment) {
  const s = String(sentiment || "").toLowerCase();
  if (s === "positive") return `<i class="sentiment-dot sentiment-dot-positive"></i>`;
  if (s === "negative") return `<i class="sentiment-dot sentiment-dot-negative"></i>`;
  return `<i class="sentiment-dot sentiment-dot-neutral"></i>`;
}

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
      items = state.newsItems.slice(0, 25);
      isGlobalFallback = true;
    }

    const positiveCount = items.filter((i) => String(i.sentiment || "").toLowerCase() === "positive").length;
    const negativeCount = items.filter((i) => String(i.sentiment || "").toLowerCase() === "negative").length;
    const neutralCount = items.length - positiveCount - negativeCount;
    const filterLabel = state.newsFilter !== "ALL" ? `${state.newsFilter} filtered` : "All sources";

    // Source breakdown
    const sourceMap = new Map();
    items.forEach((item) => {
      const src = item.source || "Unknown";
      sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
    });
    const sources = [...sourceMap.entries()].sort((a, b) => b[1] - a[1]);

    // Sentiment score (-100 to +100)
    const sentScore = items.length
      ? Math.round(((positiveCount - negativeCount) / items.length) * 100)
      : 0;
    const sentLabel = sentScore > 20 ? "Bullish" : sentScore < -20 ? "Bearish" : "Neutral";
    const sentClass = sentScore > 0 ? "positive" : sentScore < 0 ? "negative" : "";

    // Active source filter (stored in state or defaulted to "")
    const activeSource = state.newsSourceFilter || "";
    const filteredBySource = activeSource ? items.filter(i => (i.source || "") === activeSource) : items;
    const displayItems = filteredBySource;

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap news-filter-bar">
          <span class="toolbar-label">Symbol</span>
          ${quickFilters.map((item) => `<button class="range-pill ${item === state.newsFilter ? "is-active" : ""}" type="button" data-news-filter="${item}">${item}</button>`).join("")}
          <button class="btn btn-ghost btn-refresh-icon" type="button" data-refresh-all title="Refresh news feed">↻</button>
        </div>
        ${sources.length > 1 ? `
        <div class="toolbar toolbar-wrap news-source-bar">
          <span class="toolbar-label">Source</span>
          <button class="range-pill ${!activeSource ? "is-active" : ""}" type="button" data-news-source="">All</button>
          ${sources.map(([src]) => `<button class="range-pill ${src === activeSource ? "is-active" : ""}" type="button" data-news-source="${src}">${src}</button>`).join("")}
        </div>
        ` : ""}

        <div class="card-grid card-grid-home" style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));">
          <article class="card stat-card">
            <span>Headlines</span>
            <strong>${items.length}</strong>
            <small>${isGlobalFallback ? "Global feed" : filterLabel}</small>
          </article>
          <article class="card stat-card">
            <span>Sentiment</span>
            <strong class="${sentClass}">${sentLabel}</strong>
            <small>Score: ${sentScore > 0 ? "+" : ""}${sentScore}%</small>
          </article>
          <article class="card stat-card">
            <span>Positive</span>
            <strong class="positive">${positiveCount}</strong>
            <small>${items.length ? Math.round((positiveCount / items.length) * 100) : 0}%</small>
          </article>
          <article class="card stat-card">
            <span>Negative</span>
            <strong class="negative">${negativeCount}</strong>
            <small>${items.length ? Math.round((negativeCount / items.length) * 100) : 0}%</small>
          </article>
          <article class="card stat-card">
            <span>Sources</span>
            <strong>${sources.length}</strong>
            <small>${sources.map(([s]) => s.split(" ")[0]).join(", ") || "—"}</small>
          </article>
        </div>

        ${items.length ? `
          <div class="news-sentiment-bar">
            <div class="sentiment-bar-visual">
              <div class="sentiment-bar-segment positive" style="width:${(positiveCount / items.length) * 100}%"></div>
              <div class="sentiment-bar-segment neutral-bar" style="width:${(neutralCount / items.length) * 100}%"></div>
              <div class="sentiment-bar-segment negative" style="width:${(negativeCount / items.length) * 100}%"></div>
            </div>
            <div style="display:flex;gap:12px;font-size:0.72rem;margin-top:4px;color:var(--muted)">
              <span class="positive"><i class="sentiment-dot sentiment-dot-positive"></i> ${positiveCount} positive</span>
              <span style="color:var(--muted)"><i class="sentiment-dot sentiment-dot-neutral"></i> ${neutralCount} neutral</span>
              <span class="negative"><i class="sentiment-dot sentiment-dot-negative"></i> ${negativeCount} negative</span>
            </div>
          </div>
        ` : ""}

        ${items.length >= 4 ? (() => {
          const sparkSvg = buildSentimentSparkline(items);
          const tickerLabel = state.newsFilter !== "ALL" ? state.newsFilter : "Market";
          const trendScore = sentScore;
          const trendArrow = trendScore > 20 ? "▲" : trendScore < -20 ? "▼" : "▬";
          const trendClass = trendScore > 20 ? "positive" : trendScore < -20 ? "negative" : "";
          return sparkSvg ? `
            <article class="card sentiment-sparkline-card">
              <div class="sentiment-sparkline-header">
                <div>
                  <span class="sentiment-sparkline-label">${tickerLabel} Sentiment Trend</span>
                  <span class="sentiment-sparkline-sub">Across ${items.length} recent headline${items.length !== 1 ? "s" : ""} · oldest → newest</span>
                </div>
                <div class="sentiment-sparkline-score ${trendClass}">
                  <span class="sentiment-sparkline-arrow">${trendArrow}</span>
                  <span>${sentLabel}</span>
                  <span class="sentiment-sparkline-num">${trendScore > 0 ? "+" : ""}${trendScore}%</span>
                </div>
              </div>
              <div class="sentiment-sparkline-body">
                ${sparkSvg}
                <div class="sentiment-sparkline-legend">
                  <span class="positive">● bullish</span>
                  <span style="color:var(--muted)">● neutral</span>
                  <span class="negative">● bearish</span>
                </div>
              </div>
            </article>
          ` : "";
        })() : ""}

        <article class="card">
          ${displayItems.length
            ? displayItems
                .slice(0, 30)
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
            : `<div class="empty-inline">${items.length ? `<p>No headlines from <strong>${activeSource}</strong>. Try "All" sources.</p>` : loadingSkeleton(5) + `<p style="margin-top:8px">Loading headlines…</p>`}</div>`}
        </article>

        ${isGlobalFallback ? `<div class="empty-state">No headlines matched "${state.newsFilter}". Showing global market feed instead.</div>` : ""}
      </section>
    `;
  };
}
