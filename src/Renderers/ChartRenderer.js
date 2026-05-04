import { errorState, formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

export function observeChartResize(container, chart) {
  if (!container || !chart) return () => {};

  const resize = () => {
    const width = Math.max(320, Math.floor(container.clientWidth || 0));
    chart.resize(width, 380);
    chart.timeScale?.().fitContent?.();
  };

  resize();

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    return () => observer.disconnect();
  }

  window.addEventListener("resize", resize);
  return () => window.removeEventListener("resize", resize);
}

export function createChartRenderer(context) {
  const { state, chartIntervalForRange, chartKey, calculateChartStats, chartRangeOptions, currentTimeShort } = context;

  return function renderChart(panel) {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const range = state.chartRanges[panel] || "1mo";
    const interval = chartIntervalForRange(range);
    const cacheKey = chartKey(symbol, range, interval);
    const points = state.chartCache.get(cacheKey) || [];
    const stats = calculateChartStats(points);
    const chartIsLoading = state.chartLoading?.has(cacheKey);
    const fetchErr = state.fetchErrors?.get(`chart:${cacheKey}`);
    const chartUnavailable = !points.length && !state.health?.ok;
    const waitingForData = chartIsLoading || (!points.length && state.health?.ok && !fetchErr);
    const freshnessLabel = state.health?.ok
      ? `Live feed · ${currentTimeShort(state.lastDataFetchedAt || Date.now())}`
      : `Stale snapshot · ${currentTimeShort(state.lastDataFetchedAt || Date.now())}`;

    const ind = state.chartIndicators || {};
    const rsiValue = stats.rsi;
    const rsiClass = rsiValue === null ? "" : rsiValue >= 70 ? "negative" : rsiValue <= 30 ? "positive" : "";
    const rsiLabel = rsiValue === null ? "--" : rsiValue.toFixed(1);
    const rsiSignal = rsiValue === null ? "Insufficient data" : rsiValue >= 70 ? "Overbought" : rsiValue <= 30 ? "Oversold" : "Neutral";

    // Pro indicators: bollinger, vwap, macd show a "Pro" badge
    const PRO_INDICATORS = new Set(["bollinger", "vwap", "macd"]);

    const indicatorToggle = (key, label) => {
      const isActive = !!ind[key];
      const isPro = PRO_INDICATORS.has(key);
      const proTag = isPro ? `<button class="pro-lock-badge" type="button" data-open-pricing title="Upgrade to Pro for ${label}">🔒 Pro</button>` : "";
      return `<span class="indicator-toggle-wrap">${proTag}<button class="indicator-toggle${isActive ? " is-active" : ""}" type="button" data-chart-indicator="${key}" title="Toggle ${label}">${label}</button></span>`;
    };

    const compareSymbol = state.chartCompareSymbol?.[panel] || null;

    // Replay mode badge: indicates user is viewing historical data, not live
    const replayIndex = state.chartReplayIndex?.[panel];
    const isInReplayMode = replayIndex != null && points.length > 0 && replayIndex < points.length - 1;
    const replayPointDate = isInReplayMode && points[replayIndex]
      ? new Date(points[replayIndex].timestamp || points[replayIndex].time || Date.now()).toLocaleDateString()
      : null;

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          ${chartRangeOptions.map((option) => `<button class="range-pill ${option.value === range ? "is-active" : ""}" type="button" data-chart-range="${panel}:${option.value}">${option.label}</button>`).join("")}
          <span class="toolbar-sep"></span>
          <button class="btn btn-ghost btn-sm" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}">Quote</button>
          <button class="btn btn-ghost btn-sm" type="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Options</button>
          <button class="btn btn-ghost btn-sm" type="button" data-news-filter="${symbol}">News</button>
          ${compareSymbol
            ? `<button class="btn btn-ghost btn-sm is-compare-active" type="button" data-chart-compare="${panel}">vs ${compareSymbol} ×</button>`
            : `<button class="btn btn-ghost btn-sm" type="button" data-chart-compare="${panel}">+ Compare</button>`}
          <button class="btn btn-primary btn-sm" type="button" data-refresh-chart="${panel}:${symbol}:${range}">Refresh</button>
        </div>

        <article class="card chart-card chart-card-feature">
          <div class="chart-state-badge ${state.health?.ok ? "" : "is-stale"}">${freshnessLabel}</div>
          <div class="chart-indicator-bar">
            ${indicatorToggle("sma20", "SMA(20)")}
            ${indicatorToggle("ema9", "EMA(9)")}
            ${indicatorToggle("bollinger", "Bollinger")}
            ${indicatorToggle("vwap", "VWAP")}
            ${indicatorToggle("rsi", "RSI(14)")}
            ${indicatorToggle("macd", "MACD")}
            ${indicatorToggle("volume", "Volume")}
          </div>
          ${points.length > 0 ? `
          <div class="chart-replay-controls" data-chart-replay-panel="${panel}">
            <button class="chart-replay-toggle" type="button" data-chart-replay-toggle="${panel}" title="Play/pause replay (Space)">▶ Play</button>
            <input type="range" class="chart-replay-slider" data-chart-replay-slider="${panel}" min="0" max="${Math.max(0, points.length - 1)}" value="${(state.chartReplayIndex && state.chartReplayIndex[panel] != null) ? state.chartReplayIndex[panel] : Math.max(0, points.length - 1)}" title="Scrub history (← →)">
            <span class="chart-replay-label" data-chart-replay-label="${panel}">${new Date(points[Math.max(0, points.length - 1)]?.timestamp || Date.now()).toLocaleDateString()}</span>
            <span class="chart-replay-hint">Space · ← →</span>
          </div>` : ""}
          <div class="chart-canvas-wrap">
            ${isInReplayMode ? `<div class="chart-replay-badge" title="Press R to return to live data">⏯ REPLAY · ${replayPointDate}</div>` : ""}
            <div class="chart-canvas" id="chartCanvas${panel}" data-chart-panel="${panel}"></div>
            ${chartUnavailable ? `<div class="chart-loading chart-fallback">${loadingSkeleton(4)}<p class="empty-inline">Offline: ${symbol} chart feed unavailable. Last requested window ${range.toUpperCase()}.</p></div>` : ""}
            ${fetchErr && !points.length ? `<div class="chart-loading chart-fallback">${errorState(`${symbol} chart unavailable. ${fetchErr.message}`, { retryAction: "refresh-chart", retryLabel: "Retry", retryPayload: JSON.stringify({ panel, symbol, range }) })}</div>` : ""}
            ${waitingForData ? `<div class="chart-loading"><div class="chart-skeleton"><span class="chart-skeleton-line a"></span><span class="chart-skeleton-line b"></span><span class="chart-skeleton-line c"></span><span class="chart-skeleton-line d"></span><span class="chart-skeleton-grid"></span></div></div>` : ""}
          </div>
        </article>

        <div class="card-grid chart-summary-grid">
          <article class="card stat-card"><span>Range</span><strong>${range.toUpperCase()}</strong><small>${symbol} · ${points.length} pts</small></article>
          <article class="card stat-card"><span>High</span><strong class="positive">${points.length ? tabularValue(formatPrice(stats.high, symbol)) : "--"}</strong><small>${points.length ? "Period high" : "Waiting"}</small></article>
          <article class="card stat-card"><span>Low</span><strong class="negative">${points.length ? tabularValue(formatPrice(stats.low, symbol)) : "--"}</strong><small>${points.length ? "Period low" : "Waiting"}</small></article>
          <article class="card stat-card"><span>Return</span><strong class="${stats.returnPct >= 0 ? "positive" : "negative"}">${points.length ? tabularValue(formatSignedPct(stats.returnPct)) : "--"}</strong><small>${points.length ? "Start→end" : "Waiting"}</small></article>
          <article class="card stat-card"><span>RSI(14)</span><strong class="${rsiClass}">${rsiLabel}</strong><small>${rsiSignal}</small></article>
        </div>
        <div class="chart-legend-bar">
          ${ind.sma20 !== false ? '<span class="chart-legend-item"><i class="legend-swatch" style="background:rgba(111,143,255,0.7)"></i>SMA(20)</span>' : ""}
          ${ind.ema9 ? '<span class="chart-legend-item"><i class="legend-swatch" style="background:rgba(255,167,38,0.8)"></i>EMA(9)</span>' : ""}
          ${ind.bollinger ? '<span class="chart-legend-item"><i class="legend-swatch" style="background:rgba(156,185,255,0.5)"></i>Bollinger(20,2)</span>' : ""}
          ${ind.vwap ? '<span class="chart-legend-item"><i class="legend-swatch" style="background:rgba(233,30,99,0.7)"></i>VWAP</span>' : ""}
          ${ind.rsi !== false ? '<span class="chart-legend-item"><i class="legend-swatch" style="background:rgba(255,200,60,0.5)"></i>RSI(14)</span>' : ""}
          ${ind.macd ? '<span class="chart-legend-item"><i class="legend-swatch" style="background:rgba(79,172,255,0.8)"></i>MACD(12,26,9)</span>' : ""}
          ${ind.volume !== false ? '<span class="chart-legend-item"><i class="legend-swatch" style="background:rgba(0,230,118,0.25)"></i>Volume</span>' : ""}
          ${compareSymbol ? `<span class="chart-legend-item compare-legend"><i class="legend-swatch" style="background:rgba(255,200,60,0.85)"></i>${compareSymbol} % overlay</span>` : ""}
        </div>
      </section>
    `;
  };
}
