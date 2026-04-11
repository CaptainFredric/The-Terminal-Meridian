import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

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
    const chartUnavailable = !points.length && !state.health?.ok;
    const waitingForData = chartIsLoading || (!points.length && state.health?.ok);
    const freshnessLabel = state.health?.ok
      ? `Live feed · ${currentTimeShort(state.lastDataFetchedAt || Date.now())}`
      : `Stale snapshot · ${currentTimeShort(state.lastDataFetchedAt || Date.now())}`;

    const rsiValue = stats.rsi;
    const rsiClass = rsiValue === null ? "" : rsiValue >= 70 ? "negative" : rsiValue <= 30 ? "positive" : "";
    const rsiLabel = rsiValue === null ? "--" : rsiValue.toFixed(1);
    const rsiSignal = rsiValue === null ? "Insufficient data" : rsiValue >= 70 ? "Overbought" : rsiValue <= 30 ? "Oversold" : "Neutral";

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          ${chartRangeOptions.map((option) => `<button class="range-pill ${option.value === range ? "is-active" : ""}" type="button" data-chart-range="${panel}:${option.value}">${option.label}</button>`).join("")}
          <span class="toolbar-sep"></span>
          <button class="btn btn-ghost btn-sm" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}">Quote</button>
          <button class="btn btn-ghost btn-sm" type="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Options</button>
          <button class="btn btn-ghost btn-sm" type="button" data-news-filter="${symbol}">News</button>
          <button class="btn btn-primary btn-sm" type="button" data-refresh-chart="${panel}:${symbol}:${range}">Refresh</button>
        </div>

        <article class="card chart-card chart-card-feature">
          <div class="chart-state-badge ${state.health?.ok ? "" : "is-stale"}">${freshnessLabel}</div>
          <div class="chart-canvas-wrap">
            <div class="chart-canvas" id="chartCanvas${panel}" data-chart-panel="${panel}"></div>
            ${chartUnavailable ? `<div class="chart-loading chart-fallback">${loadingSkeleton(4)}<p class="empty-inline">Offline: ${symbol} chart feed unavailable. Last requested window ${range.toUpperCase()}.</p></div>` : ""}
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
          <span class="chart-legend-item"><i class="legend-swatch" style="background:#00E676"></i>Candles</span>
          <span class="chart-legend-item"><i class="legend-swatch" style="background:rgba(111,143,255,0.7)"></i>MA(20)</span>
          <span class="chart-legend-item"><i class="legend-swatch" style="background:rgba(0,230,118,0.25)"></i>Volume</span>
        </div>
      </section>
    `;
  };
}
