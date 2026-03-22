import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

export function createPortfolioRenderer(context) {
  const { enrichPositions, calculatePortfolioSummary } = context;

  return function renderPortfolio(panel) {
    const rows = enrichPositions();
    const totals = calculatePortfolioSummary();
    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home">
          <article class="card stat-card"><span>Value</span><strong>${tabularValue(formatPrice(totals.value, "USD"))}</strong></article>
          <article class="card stat-card"><span>P/L</span><strong class="${totals.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${totals.pnl >= 0 ? "+" : ""}${formatPrice(totals.pnl, "USD")}`)}</strong></article>
          <article class="card stat-card"><span>Return</span><strong class="${totals.pnlPct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(totals.pnlPct))}</strong></article>
        </div>
        <form id="addPositionForm" class="add-pos-form">
          <input name="symbol" placeholder="Ticker" required />
          <input name="shares" type="number" step="0.01" placeholder="Shares" required />
          <input name="cost" type="number" step="0.01" placeholder="Cost" required />
          <button class="btn btn-primary" type="submit">Add position</button>
        </form>
        ${rows.length ? `
          <table class="data-table data-table-dense financial-data-table">
            <thead><tr><th>Ticker</th><th>Shares</th><th>Cost</th><th>Mark</th><th>Value</th><th>P/L</th><th></th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                    <tr>
                      <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${panel}">${row.symbol}</button></td>
                      <td>${tabularValue(row.shares)}</td>
                      <td>${tabularValue(formatPrice(row.cost, row.symbol))}</td>
                      <td>${tabularValue(formatPrice(row.price, row.symbol), { flashKey: `quote:${row.symbol}:price`, currentPrice: row.price })}</td>
                      <td>${tabularValue(formatPrice(row.value, "USD"))}</td>
                      <td class="${row.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}`)}</td>
                      <td class="row-actions">
                        <button class="btn btn-ghost btn-inline" type="button" data-load-module="options" data-target-symbol="${row.symbol}" data-target-panel="${panel}">Options</button>
                        <button class="btn btn-ghost btn-inline" type="button" data-create-alert="${row.symbol}:>=:${(row.price * 1.04).toFixed(2)}">Alert</button>
                        <button class="btn btn-ghost btn-inline" type="button" data-remove-position="${row.symbol}">Remove</button>
                      </td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>` : `<article class="card">${loadingSkeleton(4)}</article>`}
      </section>
    `;
  };
}
