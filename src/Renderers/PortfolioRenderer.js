import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

export function createPortfolioRenderer(context) {
  const { enrichPositions, calculatePortfolioSummary } = context;

  return function renderPortfolio(panel) {
    const rows = enrichPositions();
    const totals = calculatePortfolioSummary();
    const topGainer = rows.length ? rows.reduce((best, row) => (row.pnl > (best?.pnl || -Infinity) ? row : best), null) : null;
    const topLoser = rows.length ? rows.reduce((worst, row) => (row.pnl < (worst?.pnl || Infinity) ? row : worst), null) : null;

    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home">
          <article class="card stat-card">
            <span>Total Value</span>
            <strong>${tabularValue(formatPrice(totals.value, "USD"))}</strong>
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
        </div>

        <article class="card">
          <header class="card-head card-head-split"><h4>Add Position</h4><small>Track a new holding</small></header>
          <form id="addPositionForm" class="add-pos-form">
            <input name="symbol" placeholder="Ticker (e.g. AAPL)" required />
            <input name="shares" type="number" step="0.01" placeholder="Shares" required />
            <input name="cost" type="number" step="0.01" placeholder="Avg cost" required />
            <button class="btn btn-primary" type="submit">Add position</button>
          </form>
        </article>

        ${rows.length ? `
          <article class="card">
            <header class="card-head card-head-split"><h4>Holdings</h4><small>${rows.length} positions</small></header>
            <table class="data-table data-table-dense financial-data-table">
              <thead><tr><th>Ticker</th><th>Shares</th><th>Cost</th><th>Market</th><th>Value</th><th>P/L</th><th>Return</th><th></th></tr></thead>
              <tbody>
                ${rows
                  .map(
                    (row) => `
                      <tr>
                        <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${panel}">${row.symbol}</button></td>
                        <td>${tabularValue(row.shares)}</td>
                        <td>${tabularValue(formatPrice(row.cost, row.symbol))}</td>
                        <td>${tabularValue(formatPrice(row.price, row.symbol), { flashKey: "quote:" + row.symbol + ":price", currentPrice: row.price })}</td>
                        <td>${tabularValue(formatPrice(row.value, "USD"))}</td>
                        <td class="${row.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}`)}</td>
                        <td class="${row.pnl >= 0 ? "positive" : "negative"}">${row.cost ? tabularValue(formatSignedPct(((row.price - row.cost) / row.cost) * 100)) : "—"}</td>
                        <td class="row-actions">
                          <button class="btn btn-ghost btn-inline" type="button" data-load-module="chart" data-target-symbol="${row.symbol}" data-target-panel="${panel}">Chart</button>
                          <button class="btn btn-ghost btn-inline" type="button" data-load-module="options" data-target-symbol="${row.symbol}" data-target-panel="${panel}">Options</button>
                          <button class="btn btn-ghost btn-inline" type="button" data-create-alert="${row.symbol}:>=:${(row.price * 1.04).toFixed(2)}">Alert</button>
                          <button class="btn btn-ghost btn-inline btn-danger" type="button" data-remove-position="${row.symbol}">Remove</button>
                        </td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>
          </article>` : `<article class="card"><div class="empty-inline">No positions yet. Add one above or use: ADDPOS AAPL 10 150</div></article>`}
      </section>
    `;
  };
}
