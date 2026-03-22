import { loadingSkeleton, tabularValue } from "./Common.js";

export function createMacroRenderer(context) {
  const { state, macroDefaults } = context;

  return function renderMacro() {
    const fxCards = macroDefaults.currencies
      .map((currency) => ({ currency, rate: state.fxRates[currency] }))
      .filter((item) => item.rate)
      .map(
        (item) => `<article class="card fx-card"><span>USD/${item.currency}</span><strong>${tabularValue(Number(item.rate).toFixed(4), { flashKey: `fx:${item.currency}`, currentPrice: item.rate })}</strong></article>`,
      )
      .join("");

    return `
      <section class="stack stack-lg">
        <div class="toolbar">
          <button class="btn btn-primary" type="button" data-refresh-all>Refresh macro</button>
        </div>
        <div class="card-grid card-grid-home">
          <article class="card stat-card"><span>Market phase</span><strong>${state.marketPhase}</strong><small>New York session</small></article>
          <article class="card stat-card"><span>Server</span><strong>${state.health.ok ? "Live" : "Offline"}</strong><small>${state.health.server}</small></article>
          <article class="card stat-card"><span>FX crosses</span><strong>${tabularValue(Object.keys(state.fxRates).length)}</strong><small>USD base pairs</small></article>
        </div>
        <article class="card">
          <header class="card-head"><h4>Yield curve</h4></header>
          <div class="curve-grid">
            ${macroDefaults.curve.map((point) => `<div class="curve-col"><div class="curve-bar" style="height:${point.yield * 18}px"></div><strong>${tabularValue(`${point.yield.toFixed(2)}%`)}</strong><small>${point.tenor}</small></div>`).join("")}
          </div>
        </article>
        <article class="card">
          <header class="card-head"><h4>FX rates</h4></header>
          <div class="fx-grid">${fxCards || loadingSkeleton(4)}</div>
        </article>
      </section>
    `;
  };
}
