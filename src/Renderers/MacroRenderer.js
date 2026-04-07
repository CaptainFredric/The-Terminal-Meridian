import { loadingSkeleton, tabularValue } from "./Common.js";

export function createMacroRenderer(context) {
  const { state, macroDefaults } = context;

  return function renderMacro() {
    const fxCards = macroDefaults.currencies
      .map((currency) => ({ currency, rate: state.fxRates[currency] }))
      .filter((item) => item.rate)
      .map(
        (item) => `<article class="card fx-card"><span>USD / ${item.currency}</span><strong>${tabularValue(Number(item.rate).toFixed(4), { flashKey: "fx:" + item.currency, currentPrice: item.rate })}</strong><small>${Number(item.rate) > 1 ? "Dollar stronger" : "Dollar weaker"}</small></article>`,
      )
      .join("");

    const maxYield = Math.max(...macroDefaults.curve.map(p => p.yield));
    const minYield = Math.min(...macroDefaults.curve.map(p => p.yield));
    const spread = (macroDefaults.curve[macroDefaults.curve.length - 1]?.yield || 0) - (macroDefaults.curve[0]?.yield || 0);
    const inverted = spread < 0;

    return `
      <section class="stack stack-lg">
        <div class="toolbar">
          <button class="btn btn-primary" type="button" data-refresh-all>Refresh macro data</button>
        </div>

        <div class="card-grid card-grid-home">
          <article class="card stat-card">
            <span>Market Phase</span>
            <strong>${state.marketPhase}</strong>
            <small>New York session</small>
          </article>
          <article class="card stat-card">
            <span>Server Status</span>
            <strong>${state.health.ok ? "🟢 Live" : "🔴 Offline"}</strong>
            <small>${state.health.server}</small>
          </article>
          <article class="card stat-card">
            <span>FX Crosses</span>
            <strong>${tabularValue(Object.keys(state.fxRates).length)}</strong>
            <small>USD base pairs loaded</small>
          </article>
        </div>

        <article class="card">
          <header class="card-head card-head-split">
            <h4>📈 US Treasury Yield Curve</h4>
            <small class="${inverted ? 'negative' : ''}">${inverted ? "⚠ Inverted" : "Normal"} · Spread: ${spread.toFixed(2)}%</small>
          </header>
          <div class="curve-grid">
            ${macroDefaults.curve.map((point) => {
              const normalized = maxYield > minYield ? ((point.yield - minYield) / (maxYield - minYield)) * 100 + 20 : 60;
              return `<div class="curve-col"><div class="curve-bar" style="height:${normalized}px"></div><strong>${tabularValue(point.yield.toFixed(2) + "%")}</strong><small>${point.tenor}</small></div>`;
            }).join("")}
          </div>
        </article>

        <article class="card">
          <header class="card-head card-head-split">
            <h4>💱 Foreign Exchange</h4>
            <small>${macroDefaults.currencies.length} pairs</small>
          </header>
          <div class="fx-grid">${fxCards || `<div class="empty-inline">${loadingSkeleton(4)}<p style="margin-top:8px">Loading FX rates…</p></div>`}</div>
        </article>
      </section>
    `;
  };
}
