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
  const { state, buildQuote, currentTimeShort, calculatePulse, heatmapGroups } = context;

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

    // Sector performance bars (GICS only, skip ETF/Crypto)
    const sectorBars = Object.entries(heatmapGroups || {})
      .filter(([name]) => !name.includes("ETF") && !name.includes("Crypto"))
      .map(([sector, symbols]) => {
        const quotes = symbols.map(s => buildQuote(s)).filter(Boolean);
        const avgPct = quotes.length
          ? quotes.reduce((s, q) => s + (q.changePct || 0), 0) / quotes.length
          : 0;
        return { sector, avgPct };
      })
      .sort((a, b) => b.avgPct - a.avgPct);

    // Recent news sentiment summary
    const recentNews = (state.newsItems || []).slice(0, 20);
    const posNews = recentNews.filter(n => n.sentiment === "Positive").length;
    const negNews = recentNews.filter(n => n.sentiment === "Negative").length;
    const neuNews = recentNews.length - posNews - negNews;
    const newsSentimentScore = recentNews.length
      ? ((posNews - negNews) / recentNews.length * 100).toFixed(0)
      : "—";

    return `
      <section class="stack stack-lg">
        <article class="card briefing-hero">
          <header class="card-head card-head-split">
            <h4>Meridian Briefing</h4>
            <small>${currentTimeShort()} · ${state.health.ok ? "Live" : "Waking server"}</small>
          </header>
          <div class="briefing-grid">
            <div class="brief-metric">
              <span>Market Phase</span>
              <strong>${state.marketPhase}</strong>
              <small>${state.health.ok ? "Feed connected" : "Server waking up (free tier cold start, ~30s)"}</small>
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
              <small>${volLabel} (avg absolute move)</small>
            </div>
            <div class="brief-metric">
              <span>News Tone</span>
              <strong class="${Number(newsSentimentScore) > 0 ? "positive" : Number(newsSentimentScore) < 0 ? "negative" : ""}">${newsSentimentScore}%</strong>
              <small>${posNews}+ ${negNews}- ${neuNews}= of ${recentNews.length}</small>
            </div>
          </div>
        </article>

        <div class="card-grid card-grid-home" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));">
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
          <article class="card stat-card">
            <span>Watchlist</span>
            <strong>${state.watchlist.length}</strong>
            <small>Symbols tracked</small>
          </article>
        </div>

        ${sectorBars.length ? `
        <article class="card">
          <header class="card-head card-head-split">
            <h4>Sector Rotation</h4>
            <small>${sectorBars.length} sectors</small>
          </header>
          <div class="stack-list compact-list" style="gap:3px">
            ${sectorBars.map(s => {
              const barWidth = Math.min(Math.abs(s.avgPct) * 18, 100);
              const tone = s.avgPct >= 0 ? "positive" : "negative";
              const shortName = s.sector
                .replace(/^Information /, "")
                .replace(/^Communication /, "")
                .replace(/^Consumer /, "")
                .replace(/ & Utilities$/, "");
              return `
                <div class="list-row" style="cursor:default;gap:8px;padding:5px 10px">
                  <strong style="font-size:0.74rem;min-width:80px;flex-shrink:0">${shortName}</strong>
                  <div style="flex:1;height:5px;border-radius:3px;background:var(--border)">
                    <div style="width:${barWidth}%;height:100%;border-radius:3px;background:${s.avgPct >= 0 ? "var(--accent, #2fcf84)" : "var(--danger, #ff5f7f)"};opacity:0.7"></div>
                  </div>
                  <small class="${tone}" style="min-width:50px;text-align:right;font-weight:600;font-family:var(--mono)">${formatSignedPct(s.avgPct)}</small>
                </div>
              `;
            }).join("")}
          </div>
        </article>
        ` : ""}

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split">
              <h4>Signal Board</h4>
              <small>Recommended actions</small>
            </header>
            <div class="stack-list compact-list">
              <button class="list-row" type="button" data-load-module="chart" data-target-symbol="${primary}" data-target-panel="${panel}"><strong>📈 ${primary} Trend</strong><small>Review structure, support, and resistance</small></button>
              <button class="list-row" type="button" data-news-filter="${primary}"><strong>📰 ${primary} Headlines</strong><small>Scan catalysts and sentiment</small></button>
              <button class="list-row" type="button" data-load-module="portfolio" data-target-panel="${panel}"><strong>💼 Risk Check</strong><small>P/L exposure and triggered alerts</small></button>
              <button class="list-row" type="button" data-load-module="macro" data-target-panel="${panel}"><strong>🌐 Macro Backdrop</strong><small>Yield curve, FX, and regime context</small></button>
              <button class="list-row" type="button" data-load-module="heatmap" data-target-panel="${panel}"><strong>🗺 Sector Heatmap</strong><small>Identify sector rotation and strength</small></button>
              <button class="list-row" type="button" data-open-pricing style="border-style:dashed;border-color:rgba(246,179,75,0.35)">
                <strong style="color:var(--warning)">🔒 Webhook Alerts &amp; AI Commentary</strong>
                <small>Get instant Slack/email pushes on rule triggers and AI market summaries. <span style="color:var(--warning);font-weight:600">Pro feature</span></small>
              </button>
            </div>
          </article>

          <article class="card">
            <header class="card-head card-head-split"><h4>Top Movers</h4><small>By absolute move</small></header>
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

        ${recentNews.length ? `
        <article class="card">
          <header class="card-head card-head-split">
            <h4>Recent Headlines</h4>
            <small>
              <button class="btn btn-ghost btn-sm" type="button" data-load-module="news" data-target-panel="${panel}">View all news</button>
            </small>
          </header>
          <div class="stack-list compact-list">
            ${recentNews.slice(0, 5).map((item) => {
              const sentColor = item.sentiment === "Positive" ? "positive" : item.sentiment === "Negative" ? "negative" : "";
              return `
                <a class="list-row" href="${item.link || "#"}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">
                  <div style="flex:1;min-width:0">
                    <strong style="font-size:0.76rem;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.title || "Untitled"}</strong>
                    <small style="color:var(--muted)">${item.source || ""} · ${item.relativeTime || ""}</small>
                  </div>
                  ${item.sentiment ? `<small class="${sentColor}" style="flex-shrink:0;font-weight:600">${item.sentiment}</small>` : ""}
                </a>
              `;
            }).join("")}
          </div>
        </article>
        ` : ""}
      </section>
    `;
  };
}
