import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

function resolveTradePanel(state, fallbackPanel) {
  const modules = state?.panelModules || {};
  for (const panelId of [1, 2, 3, 4]) {
    if (modules[panelId] === "trade") return panelId;
  }
  if (modules[2] !== undefined) return 2;
  return fallbackPanel;
}

function calcMaxDrawdown(equityHistory) {
  if (!Array.isArray(equityHistory) || equityHistory.length < 2) return 0;
  const values = equityHistory.map((h) => Number(h.equity || 0));
  let peak = values[0];
  let maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? ((peak - v) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function calcWinRate(orders) {
  if (!Array.isArray(orders) || !orders.length) return null;
  const sells = orders.filter((o) => o.side === "sell");
  if (!sells.length) return null;
  const wins = sells.filter((o) => Number(o.realizedPl || 0) > 0).length;
  return (wins / sells.length) * 100;
}

function calcSharpeEstimate(equityHistory, startingCash = 100_000) {
  if (!Array.isArray(equityHistory) || equityHistory.length < 5) return null;
  const values = equityHistory.map((h) => Number(h.equity || 0));
  const returns = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) returns.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  return (mean / std) * Math.sqrt(252); // annualised (rough)
}

function buildAllocationBars(rows, totalValue) {
  if (!rows.length || totalValue <= 0) return "";
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  return sorted
    .map((row) => {
      const pct = ((row.value / totalValue) * 100).toFixed(1);
      const barW = Math.max(2, ((row.value / totalValue) * 100)).toFixed(1);
      const tone = row.pnl >= 0 ? "var(--success)" : "var(--danger)";
      return `
        <div class="alloc-row">
          <span class="alloc-symbol">${row.symbol}</span>
          <div class="alloc-bar-track">
            <div class="alloc-bar-fill" style="width:${barW}%;background:${tone}"></div>
          </div>
          <span class="alloc-pct">${pct}%</span>
          <span class="alloc-pl ${row.pnl >= 0 ? "positive" : "negative"}">${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}</span>
        </div>
      `;
    })
    .join("");
}

function buildEquityCurve(equityHistory, startingCash = 100_000) {
  if (!Array.isArray(equityHistory) || equityHistory.length < 2) {
    return `<div class="port-equity-empty"><span>Equity curve appears after your first trade.</span></div>`;
  }

  const W = 560, H = 100, padL = 2, padR = 2, padT = 6, padB = 6;
  const values = equityHistory.map((h) => Number(h.equity || 0));
  const minV = Math.min(...values, startingCash);
  const maxV = Math.max(...values, startingCash);
  const range = Math.max(maxV - minV, 1);

  const xScale = (i) => padL + (i / Math.max(values.length - 1, 1)) * (W - padL - padR);
  const yScale = (v) => padT + (H - padT - padB) * (1 - (v - minV) / range);

  const pts = values.map((v, i) => [xScale(i), yScale(v)]);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - padB} L${pts[0][0].toFixed(1)},${H - padB} Z`;

  const first = values[0], last = values[values.length - 1];
  const delta = last - first;
  const isUp = delta >= 0;
  const strokeColor = isUp ? "#2fcf84" : "#ff5f7f";
  const fillColor = isUp ? "rgba(47,207,132,0.15)" : "rgba(255,95,127,0.12)";

  const baseY = yScale(startingCash);

  return `
    <svg class="port-equity-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="${padL}" y1="${baseY.toFixed(1)}" x2="${W - padR}" y2="${baseY.toFixed(1)}"
            stroke="rgba(100,120,180,0.3)" stroke-width="1" stroke-dasharray="4 3"/>
      <path d="${area}" fill="${fillColor}"/>
      <path d="${line}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="3" fill="${strokeColor}"/>
    </svg>
  `;
}

export function createPortfolioRenderer(context) {
  const { enrichPositions, calculatePortfolioSummary, state } = context;

  return function renderPortfolio(panel) {
    const rows = enrichPositions();
    const totals = calculatePortfolioSummary();
    const tradePanel = resolveTradePanel(state, panel);

    // Paper account data (optional — only logged-in users)
    const paper = state.paperAccount;
    const equityHistory = paper?.equityHistory || [];
    const paperOrders = paper?.orders || [];
    const startingCash = paper?.account?.startingCash || 100_000;

    // Performance analytics
    const maxDD = calcMaxDrawdown(equityHistory);
    const winRate = calcWinRate(paperOrders);
    const sharpe = calcSharpeEstimate(equityHistory, startingCash);
    const totalValue = totals.value || 0;

    const topGainer = rows.length ? rows.reduce((b, r) => r.pnl > (b?.pnl ?? -Infinity) ? r : b, null) : null;
    const topLoser  = rows.length ? rows.reduce((b, r) => r.pnl < (b?.pnl ?? Infinity) ? r : b, null) : null;

    // Today's P/L attribution — which positions are driving today's move
    const dayChangeRows = rows
      .filter((r) => Number.isFinite(r.dayChange) && r.dayChange !== 0)
      .sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange));
    const todayTotalChange = rows.reduce((sum, r) => sum + (Number(r.dayChange) || 0), 0);
    const todayWinners = dayChangeRows.filter((r) => r.dayChange > 0).slice(0, 5);
    const todayLosers = dayChangeRows.filter((r) => r.dayChange < 0).sort((a, b) => a.dayChange - b.dayChange).slice(0, 5);
    const maxAbsContribution = Math.max(
      1,
      ...todayWinners.map((r) => Math.abs(r.dayChange)),
      ...todayLosers.map((r) => Math.abs(r.dayChange)),
    );

    const hasEquityCurve = equityHistory.length >= 2;

    return `
      <section class="stack stack-lg">

        <!-- Stat bar -->
        <div class="card-grid card-grid-home" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">
          <article class="card stat-card">
            <span>Total Value</span>
            <strong>${tabularValue(formatPrice(totalValue, "USD"))}</strong>
            <small>${rows.length} position${rows.length !== 1 ? "s" : ""}</small>
          </article>
          <article class="card stat-card">
            <span>P/L</span>
            <strong class="${totals.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${totals.pnl >= 0 ? "+" : ""}${formatPrice(totals.pnl, "USD")}`)}</strong>
            <small>${topGainer ? "Best: " + topGainer.symbol : "—"}</small>
          </article>
          <article class="card stat-card">
            <span>Return</span>
            <strong class="${totals.pnlPct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(totals.pnlPct))}</strong>
            <small>${topLoser ? "Worst: " + topLoser.symbol : "—"}</small>
          </article>
          ${maxDD > 0 ? `
          <article class="card stat-card">
            <span>Max Drawdown</span>
            <strong class="negative">-${maxDD.toFixed(2)}%</strong>
            <small>Peak→trough</small>
          </article>` : ""}
          ${winRate !== null ? `
          <article class="card stat-card">
            <span>Win Rate</span>
            <strong class="${winRate >= 50 ? "positive" : "negative"}">${winRate.toFixed(0)}%</strong>
            <small>${paperOrders.filter(o => o.side === "sell").length} closed trades</small>
          </article>` : ""}
          ${sharpe !== null ? `
          <article class="card stat-card">
            <span>Sharpe (est.)</span>
            <strong class="${sharpe >= 1 ? "positive" : sharpe >= 0 ? "" : "negative"}">${sharpe.toFixed(2)}</strong>
            <small>Annualised · paper</small>
          </article>` : ""}
        </div>

        <!-- Equity curve (only for logged-in paper traders) -->
        ${paper ? `
        <article class="card">
          <header class="card-head card-head-split">
            <h4>Equity Curve</h4>
            <small class="${(paper.account?.totalPl || 0) >= 0 ? "positive" : "negative"}">${(paper.account?.totalPl || 0) >= 0 ? "+" : ""}${formatPrice(paper.account?.totalPl || 0, "USD")} total P/L</small>
          </header>
          <div class="port-equity-chart">
            ${buildEquityCurve(equityHistory, startingCash)}
          </div>
          <div class="port-equity-meta">
            <span>Start: <strong>${formatPrice(startingCash, "USD")}</strong></span>
            <span>Now: <strong>${formatPrice(paper.account?.equity || startingCash, "USD")}</strong></span>
            <span>${equityHistory.length} snapshots</span>
          </div>
        </article>
        ` : ""}

        <!-- Allocation bars -->
        ${rows.length && totalValue > 0 ? `
        <article class="card">
          <header class="card-head card-head-split">
            <h4>Allocation</h4>
            <small>By market value</small>
          </header>
          <div class="port-alloc-grid">
            ${buildAllocationBars(rows, totalValue)}
          </div>
        </article>
        ` : ""}

        <!-- Today's Movers — attribution of today's P/L by position -->
        ${dayChangeRows.length ? `
        <article class="card today-movers-card">
          <header class="card-head card-head-split">
            <h4>Today's Movers</h4>
            <small class="${todayTotalChange >= 0 ? "positive" : "negative"}">
              ${todayTotalChange >= 0 ? "+" : ""}${formatPrice(todayTotalChange, "USD")} today
            </small>
          </header>
          <div class="today-movers-grid">
            <div class="today-movers-col">
              <h5 class="today-movers-title positive">▲ Top Contributors</h5>
              ${todayWinners.length ? todayWinners.map((row) => {
                const w = (Math.abs(row.dayChange) / maxAbsContribution) * 100;
                return `
                  <button class="today-mover-row" type="button" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${panel}">
                    <div class="today-mover-head">
                      <strong>${row.symbol}</strong>
                      <span class="positive">+${formatPrice(row.dayChange, "USD")}</span>
                    </div>
                    <div class="today-mover-bar"><i class="positive-bar" style="width:${w.toFixed(1)}%"></i></div>
                    <div class="today-mover-meta">
                      <small>${row.shares} sh · ${formatSignedPct(row.dayChangePct)}</small>
                    </div>
                  </button>
                `;
              }).join("") : `<div class="empty-inline">No green positions today.</div>`}
            </div>
            <div class="today-movers-col">
              <h5 class="today-movers-title negative">▼ Top Detractors</h5>
              ${todayLosers.length ? todayLosers.map((row) => {
                const w = (Math.abs(row.dayChange) / maxAbsContribution) * 100;
                return `
                  <button class="today-mover-row" type="button" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${panel}">
                    <div class="today-mover-head">
                      <strong>${row.symbol}</strong>
                      <span class="negative">${formatPrice(row.dayChange, "USD")}</span>
                    </div>
                    <div class="today-mover-bar"><i class="negative-bar" style="width:${w.toFixed(1)}%"></i></div>
                    <div class="today-mover-meta">
                      <small>${row.shares} sh · ${formatSignedPct(row.dayChangePct)}</small>
                    </div>
                  </button>
                `;
              }).join("") : `<div class="empty-inline">No red positions today.</div>`}
            </div>
          </div>
        </article>
        ` : ""}

        <!-- Share performance card — only when there are positions -->
        ${rows.length && totals.value > 0 ? `
        <article class="card port-share-card">
          <header class="card-head card-head-split">
            <h4>Share Performance</h4>
            <small>Copy summary or post to X</small>
          </header>
          <div class="port-share-body">
            <div class="port-share-preview" id="portSharePreview">
              <span class="port-share-logo">📊 Meridian Terminal</span>
              <div class="port-share-stats">
                <span>Portfolio: <strong>${formatPrice(totalValue, "USD")}</strong></span>
                <span class="${totals.pnl >= 0 ? "positive" : "negative"}">P/L: <strong>${totals.pnl >= 0 ? "+" : ""}${formatPrice(totals.pnl, "USD")}</strong></span>
                <span class="${totals.pnlPct >= 0 ? "positive" : "negative"}">Return: <strong>${formatSignedPct(totals.pnlPct)}</strong></span>
                ${winRate !== null ? `<span>Win rate: <strong>${winRate.toFixed(0)}%</strong></span>` : ""}
              </div>
              <span class="port-share-footer">meridian-terminal.app · Paper trading</span>
            </div>
            <div class="port-share-actions">
              <button class="btn btn-ghost btn-sm" type="button" data-share-portfolio="copy"
                data-share-text="📊 My Meridian paper portfolio: ${formatPrice(totalValue, "USD")} · P/L ${totals.pnl >= 0 ? "+" : ""}${formatPrice(totals.pnl, "USD")} · Return ${formatSignedPct(totals.pnlPct)} — trade smarter with Meridian Terminal">
                📋 Copy text
              </button>
              <button class="btn btn-ghost btn-sm" type="button" data-share-portfolio="twitter"
                data-share-text="📊 My Meridian paper portfolio: ${formatPrice(totalValue, "USD")} · P/L ${totals.pnl >= 0 ? "+" : ""}${formatPrice(totals.pnl, "USD")} · Return ${formatSignedPct(totals.pnlPct)} — trade smarter with Meridian Terminal %23trading %23stocks">
                𝕏 Post on X
              </button>
            </div>
          </div>
        </article>
        ` : ""}

        <!-- Add position form -->
        <article class="card">
          <header class="card-head card-head-split"><h4>Add Position</h4><small>Track a holding manually</small></header>
          <form id="addPositionForm" class="add-pos-form">
            <input name="symbol" placeholder="Ticker (e.g. AAPL)" required />
            <input name="shares" type="number" step="0.01" placeholder="Shares" required />
            <input name="cost" type="number" step="0.01" placeholder="Avg cost ($)" required />
            <button class="btn btn-primary" type="submit">Add</button>
          </form>
        </article>

        <!-- Holdings table -->
        ${rows.length ? `
        <article class="card">
          <header class="card-head card-head-split">
            <h4>Holdings</h4>
            <div style="display:flex;gap:8px;align-items:center">
              <small>${rows.length} positions</small>
              <button class="btn btn-ghost btn-sm" type="button" data-export-portfolio>Export CSV</button>
            </div>
          </header>
          <div class="table-scroll-wrapper">
            <table class="data-table data-table-dense financial-data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th style="text-align:right">Shares</th>
                  <th style="text-align:right">Cost</th>
                  <th style="text-align:right">Market</th>
                  <th style="text-align:right">Value</th>
                  <th style="text-align:right">P/L $</th>
                  <th style="text-align:right">Return</th>
                  <th style="text-align:right">Weight</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((row) => {
                  const weight = totalValue > 0 ? ((row.value / totalValue) * 100).toFixed(1) : "—";
                  const returnPct = row.cost ? ((row.price - row.cost) / row.cost) * 100 : 0;
                  const editRowId = `pos-edit-${row.symbol}`;
                  return `
                    <tr>
                      <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${panel}"><strong>${row.symbol}</strong></button></td>
                      <td style="text-align:right">${tabularValue(row.shares)}</td>
                      <td style="text-align:right">${tabularValue(formatPrice(row.cost, row.symbol))}</td>
                      <td style="text-align:right">${tabularValue(formatPrice(row.price, row.symbol), { flashKey: "quote:" + row.symbol + ":price", currentPrice: row.price })}</td>
                      <td style="text-align:right">${tabularValue(formatPrice(row.value, "USD"))}</td>
                      <td style="text-align:right" class="${row.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}`)}</td>
                      <td style="text-align:right" class="${row.pnl >= 0 ? "positive" : "negative"}">${row.cost ? tabularValue(formatSignedPct(returnPct)) : "—"}</td>
                      <td style="text-align:right" class="muted-cell">${weight}%</td>
                      <td class="row-actions">
                        <button class="btn btn-ghost btn-inline" type="button" data-trade-symbol="${row.symbol}" data-target-panel="${tradePanel}" title="Trade">💸</button>
                        <button class="btn btn-ghost btn-inline" type="button" data-load-module="chart" data-target-symbol="${row.symbol}" data-target-panel="${panel}">Chart</button>
                        <button class="btn btn-ghost btn-inline" type="button" data-create-alert="${row.symbol}:>=:${(row.price * 1.05).toFixed(2)}">Alert +5%</button>
                        <button class="btn btn-ghost btn-inline" type="button" data-toggle-pos-edit="${editRowId}" title="Edit shares or cost basis">✏</button>
                        <button class="btn btn-ghost btn-inline btn-danger" type="button" data-remove-position="${row.symbol}">✕</button>
                      </td>
                    </tr>
                    <tr class="pos-edit-row hidden" id="${editRowId}">
                      <td colspan="9">
                        <form class="pos-edit-form" data-edit-position="${row.symbol}">
                          <span class="pos-edit-label">Edit <strong>${row.symbol}</strong></span>
                          <label class="pos-edit-field">
                            <span>Shares</span>
                            <input name="shares" type="number" step="0.0001" min="0" value="${row.shares}" placeholder="Shares" />
                          </label>
                          <label class="pos-edit-field">
                            <span>Avg Cost ($)</span>
                            <input name="cost" type="number" step="0.01" min="0" value="${Number(row.cost).toFixed(2)}" placeholder="Cost basis" />
                          </label>
                          <div class="pos-edit-actions">
                            <button class="btn btn-primary btn-sm" type="submit">Save</button>
                            <button class="btn btn-ghost btn-sm" type="button" data-toggle-pos-edit="${editRowId}">Cancel</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </article>
        ` : `
        <article class="card">
          <div class="empty-state empty-state-lg">
            <strong>No positions yet.</strong><br>
            Use the form above to track a holding, or <button class="btn btn-ghost btn-sm" style="display:inline" type="button" data-load-module="trade" data-target-panel="${panel}">open the paper trading desk</button> to simulate trades.
          </div>
        </article>
        `}
      </section>
    `;
  };
}
