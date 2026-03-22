import { formatExpiry, formatPrice, loadingSkeleton, tabularValue } from "./Common.js";

function renderOptionsTable(contracts) {
  if (!contracts.length) return loadingSkeleton(6);
  return `
    <table class="data-table compact financial-data-table">
      <thead><tr><th>Strike</th><th>Bid</th><th>Ask</th><th>Last</th><th>OI</th></tr></thead>
      <tbody>
        ${contracts
          .slice(0, 12)
          .map(
            (contract) => `
              <tr>
                <td>${tabularValue(contract.strike?.fmt || contract.strike || "--")}</td>
                <td>${tabularValue(contract.bid?.fmt || contract.bid || "--")}</td>
                <td>${tabularValue(contract.ask?.fmt || contract.ask || "--")}</td>
                <td>${tabularValue(contract.lastPrice?.fmt || contract.lastPrice || "--")}</td>
                <td>${tabularValue(contract.openInterest?.fmt || contract.openInterest || "--")}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function createOptionsRenderer(context) {
  const { state, optionsKey } = context;

  return function renderOptions(panel) {
    const symbol = state.panelSymbols[panel] || state.optionsSelection.symbol;
    const expiration = state.optionsSelection.expiration || "nearest";
    const chain = state.optionsCache.get(optionsKey(symbol, expiration)) || state.optionsCache.get(optionsKey(symbol, "nearest"));
    const expirations = chain?.expirations || [];

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          <button class="btn btn-ghost" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}">Quote</button>
          <button class="btn btn-ghost" type="button" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">Chart</button>
          <select data-options-expiry="${panel}">
            <option value="">Nearest expiry</option>
            ${expirations.slice(0, 8).map((value) => `<option value="${value}" ${String(value) === String(state.optionsSelection.expiration || "") ? "selected" : ""}>${formatExpiry(value)}</option>`).join("")}
          </select>
          <button class="btn btn-primary" type="button" data-refresh-options="${panel}:${symbol}">Refresh options</button>
        </div>
        <div class="card-grid card-grid-home">
          <article class="card stat-card"><span>Underlying</span><strong>${symbol}</strong><small>${chain?.spot ? tabularValue(formatPrice(chain.spot, symbol), { flashKey: `quote:${symbol}:price`, currentPrice: chain.spot }) : "Waiting for chain"}</small></article>
          <article class="card stat-card"><span>Calls</span><strong>${tabularValue(chain?.calls?.length || 0)}</strong><small>Loaded contracts</small></article>
          <article class="card stat-card"><span>Puts</span><strong>${tabularValue(chain?.puts?.length || 0)}</strong><small>Loaded contracts</small></article>
        </div>
        <div class="split-grid">
          <article class="card">
            <header class="card-head"><h4>Calls</h4></header>
            ${renderOptionsTable(chain?.calls || [])}
          </article>
          <article class="card">
            <header class="card-head"><h4>Puts</h4></header>
            ${renderOptionsTable(chain?.puts || [])}
          </article>
        </div>
      </section>
    `;
  };
}
