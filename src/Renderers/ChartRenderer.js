import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

export function observeChartResize(container, chart) {
  if (!container || !chart) return () => {};

  const resize = () => {
    const width = Math.max(320, Math.floor(container.clientWidth || 0));
    const height = Math.max(220, Math.floor(container.clientHeight || 0));
    chart.resize(width, height);
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

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          ${chartRangeOptions.map((option) => `<button class="range-pill ${option.value === range ? "is-active" : ""}" type="button" data-chart-range="${panel}:${option.value}">${option.label}</button>`).join("")}
          <button class="btn btn-ghost" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}">📋 Quote</button>
          <button class="btn btn-ghost" type="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">⛓ Options</button>
          <button class="btn btn-ghost" type="button" data-news-filter="${symbol}">📰 News</button>
          <button class="btn btn-primary" type="button" data-refresh-chart="${panel}:${symbol}:${range}">🔄 Refresh</button>
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
          <article class="card stat-card"><span>📅 Range</span><strong>${range.toUpperCase()}</strong><small>${symbol} · ${points.length} data pts</small></article>
          <article class="card stat-card"><span>📈 High</span><strong class="positive">${points.length ? tabularValue(formatPrice(stats.high, symbol)) : "--"}</strong><small>${points.length ? "Visible range" : "Waiting"}</small></article>
          <article class="card stat-card"><span>📉 Low</span><strong class="negative">${points.length ? tabularValue(formatPrice(stats.low, symbol)) : "--"}</strong><small>${points.length ? "Visible range" : "Waiting"}</small></article>
          <article class="card stat-card"><span>📊 Return</span><strong class="${stats.returnPct >= 0 ? "positive" : "negative"}">${points.length ? tabularValue(formatSignedPct(stats.returnPct)) : "--"}</strong><small>${points.length ? "Start to end" : "Waiting"}</small></article>
        </div>
      </section>
    `;
  };
}
