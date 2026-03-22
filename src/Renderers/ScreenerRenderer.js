import { formatPrice, formatSignedPct, tabularValue } from "./Common.js";

function filterUniverse(universe, filters) {
  return universe.filter((item) => {
    if (filters.universe && item.universe !== filters.universe) return false;
    if (filters.sector && item.sector !== filters.sector) return false;
    if (filters.search) {
      const query = filters.search.toLowerCase();
      return item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    }
    return true;
  });
}

export function createScreenerRenderer(context) {
  const { state, universe, buildQuote } = context;

  return function renderScreener(panel) {
    const filters = state.screenerFilters[panel];
    const sectors = [...new Set(universe.map((item) => item.sector))].sort();
    const universes = [...new Set(universe.map((item) => item.universe))].sort();
    const results = filterUniverse(universe, filters).slice(0, 80);

    return `
      <section class="stack stack-lg">
        <div class="screener-filters">
          <select data-screener-universe="${panel}">
            <option value="">All universes</option>
            ${universes.map((value) => `<option value="${value}" ${value === filters.universe ? "selected" : ""}>${value}</option>`).join("")}
          </select>
          <select data-screener-sector="${panel}">
            <option value="">All sectors</option>
            ${sectors.map((value) => `<option value="${value}" ${value === filters.sector ? "selected" : ""}>${value}</option>`).join("")}
          </select>
          <input data-screener-search="${panel}" value="${filters.search}" placeholder="Search by symbol or name" />
        </div>
        <table class="data-table data-table-dense financial-data-table">
          <thead><tr><th>Ticker</th><th>Name</th><th>Sector</th><th>Universe</th><th>Price</th><th>Change</th><th></th></tr></thead>
          <tbody>
            ${results
              .map((item) => {
                const quote = buildQuote(item.symbol);
                const price = quote?.price || item.seedPrice || 0;
                return `
                  <tr>
                    <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${item.symbol}" data-target-panel="${panel}">${item.symbol}</button></td>
                    <td>${item.name}</td>
                    <td>${item.sector}</td>
                    <td>${item.universe}</td>
                    <td>${tabularValue(formatPrice(price, item.symbol), { flashKey: `quote:${item.symbol}:price`, currentPrice: price })}</td>
                    <td class="${(quote?.changePct || 0) >= 0 ? "positive" : "negative"}">${quote ? tabularValue(formatSignedPct(quote.changePct)) : "--"}</td>
                    <td><button class="btn btn-ghost btn-inline" type="button" data-load-module="chart" data-target-symbol="${item.symbol}" data-target-panel="${panel}">Chart</button></td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </section>
    `;
  };
}
