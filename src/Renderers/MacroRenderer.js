import { formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

// ── Inline SVG yield curve ────────────────────────────────────────────────────
function buildYieldCurve(curve) {
  if (!Array.isArray(curve) || curve.length < 2) {
    return `<div class="empty-inline">Yield curve data unavailable.</div>`;
  }

  const W = 560;
  const H = 140;
  const padL = 38;
  const padR = 10;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const yields = curve.map((p) => p.yield);
  const minY = Math.min(...yields) - 0.1;
  const maxY = Math.max(...yields) + 0.1;
  const yRange = Math.max(maxY - minY, 0.01);

  const toX = (i) => padL + (i / (curve.length - 1)) * innerW;
  const toY = (v) => padT + innerH - ((v - minY) / yRange) * innerH;

  const linePath = curve.map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.yield).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${toX(curve.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${toX(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`;

  const inverted = yields[yields.length - 1] < yields[0];
  const strokeColor = inverted ? "#ff6363" : "#6f8fff";
  const fillColor = inverted ? "rgba(255,99,99,0.12)" : "rgba(111,143,255,0.12)";

  // Y-axis grid lines (3 levels)
  const gridYields = [minY + yRange * 0.25, minY + yRange * 0.5, minY + yRange * 0.75];
  const gridLines = gridYields.map((v) => {
    const y = toY(v).toFixed(1);
    return `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
      <text x="${(padL - 4).toFixed(0)}" y="${(Number(y) + 4).toFixed(0)}" text-anchor="end" fill="rgba(152,166,207,0.7)" font-size="9">${v.toFixed(2)}</text>
    `;
  }).join("");

  // X-axis labels
  const xLabels = curve.map((p, i) => `
    <text x="${toX(i).toFixed(1)}" y="${(H - 4).toFixed(1)}" text-anchor="middle" fill="rgba(152,166,207,0.8)" font-size="9">${p.tenor}</text>
  `).join("");

  // Dot on each data point
  const dots = curve.map((p, i) => `
    <circle cx="${toX(i).toFixed(1)}" cy="${toY(p.yield).toFixed(1)}" r="2.5" fill="${strokeColor}" />
  `).join("");

  return `
    <svg class="yield-curve-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${gridLines}
      <path d="${areaPath}" fill="${fillColor}" />
      <path d="${linePath}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      ${dots}
      ${xLabels}
    </svg>
  `;
}

export function createMacroRenderer(context) {
  const { state, macroDefaults, buildQuote, heatmapGroups } = context;

  return function renderMacro(panel) {
    // Use live yields if fetched, fall back to static defaults
    const curve = (Array.isArray(state.macroYields) && state.macroYields.length)
      ? state.macroYields
      : macroDefaults.curve;

    // ── Derived curve stats ────────────────────────────────────────────────
    const yield2Y = curve.find((p) => p.tenor === "2Y")?.yield ?? null;
    const yield10Y = curve.find((p) => p.tenor === "10Y")?.yield ?? null;
    const yield3M = curve.find((p) => p.tenor === "3M")?.yield ?? null;
    const yield30Y = curve.find((p) => p.tenor === "30Y")?.yield ?? null;
    const spread2s10s = yield2Y !== null && yield10Y !== null ? yield10Y - yield2Y : null;
    const spread3m10y = yield3M !== null && yield10Y !== null ? yield10Y - yield3M : null;
    const longShortSpread = curve.length >= 2
      ? (curve[curve.length - 1].yield) - curve[0].yield
      : null;
    const inverted = longShortSpread !== null && longShortSpread < 0;
    const isLive = Array.isArray(state.macroYields) && state.macroYields.length > 0;

    // ── FX cards ───────────────────────────────────────────────────────────
    const fxCards = macroDefaults.currencies
      .map((currency) => ({ currency, rate: state.fxRates[currency] }))
      .filter((item) => item.rate)
      .map(
        (item) => `<article class="card fx-card"><span>USD / ${item.currency}</span><strong>${tabularValue(Number(item.rate).toFixed(4), { flashKey: "fx:" + item.currency, currentPrice: item.rate })}</strong><small>${Number(item.rate) > 1 ? "Dollar stronger" : "Dollar weaker"}</small></article>`,
      )
      .join("");

    // ── Sector performance breakdown ───────────────────────────────────────
    const sectorPerf = Object.entries(heatmapGroups)
      .map(([sector, symbols]) => {
        const quotes = symbols.map((s) => buildQuote(s)).filter(Boolean);
        const avgPct = quotes.length
          ? quotes.reduce((s, q) => s + (q.changePct || 0), 0) / quotes.length
          : 0;
        const advancing = quotes.filter((q) => (q.changePct || 0) > 0).length;
        return { sector, avgPct, advancing, total: quotes.length };
      })
      .sort((a, b) => b.avgPct - a.avgPct);

    const allQuotes = sectorPerf.reduce((acc, s) => acc + s.total, 0);
    const allAdvancing = sectorPerf.reduce((acc, s) => acc + s.advancing, 0);
    const marketBreadth = allQuotes ? (allAdvancing / allQuotes) * 100 : 50;

    // ── Key benchmarks ─────────────────────────────────────────────────────
    const benchmarks = ["SPY", "QQQ", "IWM", "DIA", "TLT", "GLD", "BTC-USD", "VXX"]
      .map((s) => ({ symbol: s, quote: buildQuote(s) }))
      .filter((e) => e.quote);

    return `
      <section class="stack stack-lg">
        <div class="toolbar">
          <button class="btn btn-primary" type="button" data-refresh-all>Refresh macro data</button>
        </div>

        <div class="card-grid card-grid-home" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));">
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
            <span>Market Breadth</span>
            <strong class="${marketBreadth >= 50 ? "positive" : "negative"}">${marketBreadth.toFixed(0)}%</strong>
            <small>${allAdvancing}/${allQuotes} advancing</small>
          </article>
          ${spread2s10s !== null ? `
          <article class="card stat-card">
            <span>2s/10s Spread</span>
            <strong class="${spread2s10s < 0 ? "negative" : ""}">${spread2s10s >= 0 ? "+" : ""}${spread2s10s.toFixed(2)}%</strong>
            <small>${spread2s10s < 0 ? "⚠ Inverted" : "Normal slope"}</small>
          </article>
          ` : ""}
          ${spread3m10y !== null ? `
          <article class="card stat-card">
            <span>3M/10Y Spread</span>
            <strong class="${spread3m10y < 0 ? "negative" : ""}">${spread3m10y >= 0 ? "+" : ""}${spread3m10y.toFixed(2)}%</strong>
            <small>${spread3m10y < 0 ? "⚠ Inverted" : "Normal slope"}</small>
          </article>
          ` : ""}
          ${yield10Y !== null ? `
          <article class="card stat-card">
            <span>10Y Treasury</span>
            <strong>${yield10Y.toFixed(2)}%</strong>
            <small>${isLive ? "Live" : "Seed data"}</small>
          </article>
          ` : ""}
        </div>

        ${benchmarks.length ? `
        <article class="card">
          <header class="card-head card-head-split">
            <h4>Key Benchmarks</h4>
            <small>${benchmarks.length} instruments</small>
          </header>
          <table class="data-table data-table-dense financial-data-table">
            <thead><tr><th>Symbol</th><th>Name</th><th style="text-align:right">Price</th><th style="text-align:right">Change</th></tr></thead>
            <tbody>
              ${benchmarks.map(({ symbol, quote }) => `
                <tr class="clickable-row" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">
                  <td><strong>${symbol}</strong></td>
                  <td>${quote.name || symbol}</td>
                  <td style="text-align:right">${tabularValue("$" + Number(quote.price || 0).toFixed(2), { flashKey: "macro:" + symbol, currentPrice: quote.price })}</td>
                  <td style="text-align:right" class="${(quote.changePct || 0) >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct || 0))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </article>
        ` : ""}

        <article class="card">
          <header class="card-head card-head-split">
            <h4>US Treasury Yield Curve</h4>
            <small class="${inverted ? "negative" : ""}">
              ${isLive ? "Live · " : "Seed data · "}
              ${inverted ? "⚠ Inverted" : "Normal"}
              ${longShortSpread !== null ? ` · 1M to 30Y: ${longShortSpread >= 0 ? "+" : ""}${longShortSpread.toFixed(2)}%` : ""}
            </small>
          </header>
          <div class="yield-curve-wrap">
            ${buildYieldCurve(curve)}
          </div>
          <div class="curve-tenor-row">
            ${curve.map((p) => `
              <div class="curve-tenor-cell">
                <strong>${p.yield.toFixed(2)}%</strong>
                <small>${p.tenor}</small>
              </div>
            `).join("")}
          </div>
        </article>

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split">
              <h4>Sector Performance</h4>
              <small>${sectorPerf.length} sectors</small>
            </header>
            <div class="stack-list compact-list">
              ${sectorPerf.map((s) => {
                const barWidth = Math.min(Math.abs(s.avgPct) * 15, 100);
                const tone = s.avgPct >= 0 ? "positive" : "negative";
                return `
                  <div class="list-row" style="cursor:default;gap:10px">
                    <div style="flex:1;min-width:0">
                      <strong style="font-size:0.78rem">${s.sector}</strong>
                      <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
                        <div style="flex:1;height:5px;border-radius:3px;background:var(--border)">
                          <div style="width:${barWidth}%;height:100%;border-radius:3px;background:${s.avgPct >= 0 ? "var(--accent, #2fcf84)" : "var(--danger, #ff5f7f)"}"></div>
                        </div>
                        <small class="${tone}" style="min-width:52px;text-align:right;font-weight:600">${formatSignedPct(s.avgPct)}</small>
                      </div>
                    </div>
                    <small style="color:var(--muted);white-space:nowrap">${s.advancing}/${s.total} ↑</small>
                  </div>
                `;
              }).join("")}
            </div>
          </article>

          <article class="card">
            <header class="card-head card-head-split">
              <h4>Foreign Exchange</h4>
              <small>${macroDefaults.currencies.length} pairs</small>
            </header>
            <div class="fx-grid">${fxCards || `<div class="empty-inline">${loadingSkeleton(4)}<p style="margin-top:8px">Loading FX rates…</p></div>`}</div>
          </article>
        </div>
      </section>
    `;
  };
}
