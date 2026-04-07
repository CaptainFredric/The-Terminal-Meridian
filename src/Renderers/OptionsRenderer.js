import { formatExpiry, formatPrice, loadingSkeleton, tabularValue } from "./Common.js";

function renderOptionsTable(contracts, type) {
  if (!contracts.length) return `<div class="empty-inline">No ${type} contracts loaded yet.</div>`;
  return `
    <table class="data-table compact financial-data-table">
      <thead><tr><th>Strike</th><th>Bid</th><th>Ask</th><th>Last</th><th>Vol</th><th>OI</th></tr></thead>
      <tbody>
        ${contracts
          .slice(0, 15)
          .map(
            (contract) => {
              const bid = contract.bid?.fmt || contract.bid || "--";
              const ask = contract.ask?.fmt || contract.ask || "--";
              const spread = (Number(contract.ask?.raw || contract.ask || 0) - Number(contract.bid?.raw || contract.bid || 0));
              return `
                <tr>
                  <td><strong>${tabularValue(contract.strike?.fmt || contract.strike || "--")}</strong></td>
                  <td>${tabularValue(bid)}</td>
                  <td>${tabularValue(ask)}</td>
                  <td>${tabularValue(contract.lastPrice?.fmt || contract.lastPrice || "--")}</td>
                  <td>${tabularValue(contract.volume?.fmt || contract.volume || "--")}</td>
                  <td>${tabularValue(contract.openInterest?.fmt || contract.openInterest || "--")}</td>
                </tr>
              `;
            },
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
    const callCount = chain?.calls?.length || 0;
    const putCount = chain?.puts?.length || 0;

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          <button class="btn btn-ghost" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}">📋 Quote</button>
          <button class="btn btn-ghost" type="button" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">📈 Chart</button>
          <button class="btn btn-ghost" type="button" data-load-module="calculator" data-target-symbol="${symbol}" data-target-panel="${panel}">🧮 Calculator</button>
          <select data-options-expiry="${panel}">
            <option value="">Nearest expiry</option>
            ${expirations.slice(0, 10).map((value) => `<option value="${value}" ${String(value) === String(state.optionsSelection.expiration || "") ? "selected" : ""}>${formatExpiry(value)}</option>`).join("")}
          </select>
          <button class="btn btn-primary" type="button" data-refresh-options="${panel}:${symbol}">Refresh chain</button>
        </div>

        <div class="card-grid card-grid-home">
          <article class="card stat-card">
            <span>Underlying</span>
            <strong>${symbol}</strong>
            <small>${chain?.spot ? tabularValue(formatPrice(chain.spot, symbol), { flashKey: "quote:" + symbol + ":price", currentPrice: chain.spot }) : "Awaiting chain data"}</small>
          </article>
          <article class="card stat-card">
            <span>Calls</span>
            <strong class="positive">${tabularValue(callCount)}</strong>
            <small>${callCount ? "Contracts loaded" : "Waiting for data"}</small>
          </article>
          <article class="card stat-card">
            <span>Puts</span>
            <strong class="negative">${tabularValue(putCount)}</strong>
            <small>${putCount ? "Contracts loaded" : "Waiting for data"}</small>
          </article>
        </div>

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split"><h4>📈 Calls</h4><small>${callCount} contracts</small></header>
            ${renderOptionsTable(chain?.calls || [], "call")}
          </article>
          <article class="card">
            <header class="card-head card-head-split"><h4>📉 Puts</h4><small>${putCount} contracts</small></header>
            ${renderOptionsTable(chain?.puts || [], "put")}
          </article>
        </div>
      </section>
    `;
  };
}
