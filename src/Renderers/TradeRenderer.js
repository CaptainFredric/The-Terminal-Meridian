import { emptyState, formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

function formatMoney(value) {
  const num = Number(value || 0);
  const sign = num < 0 ? "-" : "";
  return `${sign}$${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedMoney(value) {
  const num = Number(value || 0);
  if (num === 0) return "$0.00";
  const sign = num > 0 ? "+" : "-";
  return `${sign}$${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatShares(value) {
  const num = Number(value || 0);
  return num % 1 === 0 ? String(num) : num.toFixed(2);
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildEquitySparkline(history, startingCash) {
  if (!Array.isArray(history) || history.length < 2) {
    return `
      <div class="equity-spark empty">
        <div class="equity-spark-empty">
          <span>Equity history will appear here as you trade.</span>
        </div>
      </div>
    `;
  }

  const values = history.map((h) => Number(h.equity || 0));
  const minV = Math.min(...values, startingCash || values[0]);
  const maxV = Math.max(...values, startingCash || values[0]);
  const range = Math.max(maxV - minV, 1);

  const width = 600;
  const height = 120;
  const pad = 6;
  const step = (width - pad * 2) / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (height - pad * 2) * (1 - (v - minV) / range);
    return [x, y];
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${height - pad} L${points[0][0].toFixed(1)},${height - pad} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const deltaPct = first ? (delta / first) * 100 : 0;
  const trendClass = delta >= 0 ? "positive" : "negative";
  const strokeColor = delta >= 0 ? "#2fcf84" : "#ff6363";
  const fillColor = delta >= 0 ? "rgba(47,207,132,0.18)" : "rgba(255,99,99,0.18)";

  const baseY = pad + (height - pad * 2) * (1 - ((startingCash || first) - minV) / range);

  return `
    <div class="equity-spark">
      <div class="equity-spark-head">
        <div>
          <span class="equity-spark-label">Equity Curve</span>
          <small>${history.length} snapshot${history.length === 1 ? "" : "s"} · session</small>
        </div>
        <div class="equity-spark-delta ${trendClass}">
          ${delta >= 0 ? "+" : ""}$${Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 2 })}
          <small>${delta >= 0 ? "+" : ""}${deltaPct.toFixed(2)}%</small>
        </div>
      </div>
      <svg class="equity-spark-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <line x1="${pad}" y1="${baseY.toFixed(1)}" x2="${width - pad}" y2="${baseY.toFixed(1)}"
              stroke="rgba(120,140,180,0.35)" stroke-width="1" stroke-dasharray="4 4" />
        <path d="${areaPath}" fill="${fillColor}" />
        <path d="${linePath}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <circle cx="${points[points.length - 1][0].toFixed(1)}" cy="${points[points.length - 1][1].toFixed(1)}" r="3" fill="${strokeColor}" />
      </svg>
    </div>
  `;
}

export function createTradeRenderer(context) {
  const { state, buildQuote, authEnabled } = context;

  return function renderTrade(panel) {
    if (authEnabled && !state.user) {
      return `
        <section class="stack stack-lg">
          <article class="card trade-gate">
            <header class="card-head card-head-split">
              <h4>Paper Trading</h4>
              <small>Login required</small>
            </header>
            <div class="empty-state empty-state-lg">
              Sign in to get a free <strong>$100,000</strong> paper trading account. Buy and sell any listed ticker with live prices, track P&amp;L across sessions, and unlock achievements.
            </div>
            <div class="toolbar toolbar-wrap" style="margin-top:12px">
              <button class="btn btn-primary" type="button" data-open-auth="signup">Create account</button>
              <button class="btn btn-ghost" type="button" data-open-auth="login">Sign in</button>
            </div>
          </article>
        </section>
      `;
    }

    const paper = state.paperAccount;
    if (!paper) {
      return `<section class="stack">${loadingSkeleton(5)}</section>`;
    }

    const account = paper.account || {};
    const positions = paper.positions || [];
    const orders = paper.orders || [];
    const pendingOrders = paper.pendingOrders || [];
    const achievements = paper.achievements || [];
    const equityHistory = paper.equityHistory || [];
    const unlockedCount = achievements.filter((a) => a.unlocked).length;

    const symbol = state.panelSymbols[panel] || positions[0]?.symbol || state.watchlist[0] || "AAPL";
    const quote = buildQuote(symbol);
    const lastPrice = quote?.price || 0;
    const existingPosition = positions.find((p) => p.symbol === symbol);
    const buyingPower = account.cash || 0;
    const maxShares = lastPrice > 0 ? Math.floor(buyingPower / lastPrice) : 0;

    const equityClass = account.totalPl >= 0 ? "positive" : "negative";
    const realizedClass = (account.realizedPl || 0) >= 0 ? "positive" : "negative";

    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home">
          <article class="card stat-card">
            <span>Equity</span>
            <strong>${tabularValue(formatMoney(account.equity))}</strong>
            <small class="${equityClass}">${tabularValue(formatSignedMoney(account.totalPl))} · ${tabularValue(formatSignedPct(account.totalPlPct || 0))}</small>
          </article>
          <article class="card stat-card">
            <span>Buying Power</span>
            <strong>${tabularValue(formatMoney(account.cash))}</strong>
            <small>${positions.length} position${positions.length !== 1 ? "s" : ""} held</small>
          </article>
          <article class="card stat-card">
            <span>Realized P/L</span>
            <strong class="${realizedClass}">${tabularValue(formatSignedMoney(account.realizedPl || 0))}</strong>
            <small>${orders.length} fill${orders.length !== 1 ? "s" : ""}</small>
          </article>
          <article class="card stat-card">
            <span>Achievements</span>
            <strong>${unlockedCount}<span class="muted-fraction">/${achievements.length}</span></strong>
            <small>${unlockedCount === achievements.length ? "All unlocked!" : `${achievements.length - unlockedCount} to go`}</small>
          </article>
        </div>

        <article class="card equity-spark-card">
          ${buildEquitySparkline(equityHistory, account.startingCash)}
        </article>

        <article class="card trade-ticket-card">
          <header class="card-head card-head-split">
            <h4>Order Ticket · ${symbol}</h4>
            <small>${quote ? `Last ${formatPrice(lastPrice, symbol)}` : "Loading quote…"}</small>
          </header>
          <form class="trade-ticket" id="tradeTicketForm" data-trade-panel="${panel}">
            <label class="trade-field">
              <span>Symbol</span>
              <input name="symbol" type="text" value="${symbol}" autocomplete="off" spellcheck="false" />
            </label>
            <label class="trade-field">
              <span>Order Type</span>
              <select name="orderType" class="trade-order-type-select" id="tradeOrderType${panel}">
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
              </select>
            </label>
            <label class="trade-field">
              <span>Shares</span>
              <input name="shares" type="number" min="1" step="1" value="${Math.min(10, maxShares || 10)}" />
            </label>
            <label class="trade-field trade-limit-price-field" id="tradeLimitPriceField${panel}" style="display:none">
              <span>Limit / Stop Price</span>
              <input name="limitPrice" type="number" min="0.01" step="0.01" value="${lastPrice > 0 ? lastPrice.toFixed(2) : ""}" placeholder="0.00" />
            </label>
            <div class="trade-field trade-field-readout">
              <span>Est. Cost</span>
              <strong id="tradeEstCost">${formatMoney(lastPrice * Math.min(10, maxShares || 10))}</strong>
            </div>
            <div class="trade-field trade-field-readout">
              <span>Max Qty</span>
              <strong>${maxShares.toLocaleString("en-US")}</strong>
            </div>
            <div class="trade-actions">
              <button class="btn btn-buy" type="submit" data-trade-side="buy">Buy ${symbol}</button>
              <button class="btn btn-sell" type="submit" data-trade-side="sell" ${existingPosition ? "" : "disabled"}>Sell ${symbol}</button>
            </div>
            ${existingPosition ? `
              <div class="trade-position-hint">
                Holding ${formatShares(existingPosition.shares)} @ ${formatPrice(existingPosition.avgCost, symbol)} · Unrealized <span class="${existingPosition.unrealizedPl >= 0 ? "positive" : "negative"}">${formatSignedMoney(existingPosition.unrealizedPl)}</span>
              </div>
            ` : ""}
          </form>
          <div class="trade-quick-pick">
            ${state.watchlist.slice(0, 6).map((sym) => `
              <button class="chip chip-sm" type="button" data-trade-symbol="${sym}" data-target-panel="${panel}">${sym}</button>
            `).join("")}
          </div>
        </article>

        <article class="card">
          <header class="card-head card-head-split">
            <h4>Open Positions</h4>
            <small>${positions.length ? `${positions.length} held` : "None yet"}</small>
          </header>
          ${positions.length ? `
            <table class="data-table data-table-dense financial-data-table">
              <thead><tr><th>Ticker</th><th>Shares</th><th>Avg Cost</th><th>Mark</th><th>Market Value</th><th>P/L</th><th>Return</th><th></th></tr></thead>
              <tbody>
                ${positions.map((p) => `
                  <tr>
                    <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${p.symbol}" data-target-panel="${panel}">${p.symbol}</button></td>
                    <td>${tabularValue(formatShares(p.shares))}</td>
                    <td>${tabularValue(formatPrice(p.avgCost, p.symbol))}</td>
                    <td>${tabularValue(formatPrice(p.mark, p.symbol), { flashKey: `quote:${p.symbol}:price`, currentPrice: p.mark })}</td>
                    <td>${tabularValue(formatMoney(p.marketValue))}</td>
                    <td class="${p.unrealizedPl >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedMoney(p.unrealizedPl))}</td>
                    <td class="${p.unrealizedPl >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(p.unrealizedPct || 0))}</td>
                    <td class="row-actions">
                      <button class="btn btn-ghost btn-inline" type="button" data-trade-symbol="${p.symbol}" data-target-panel="${panel}">Trade</button>
                      <button class="btn btn-ghost btn-inline btn-danger" type="button" data-trade-close="${p.symbol}">Close</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          ` : emptyState("No open positions. Place your first order to get started.")}
        </article>

        ${pendingOrders.length ? `
          <article class="card">
            <header class="card-head card-head-split">
              <h4>Pending Orders</h4>
              <small>${pendingOrders.length} working</small>
            </header>
            <table class="data-table data-table-dense financial-data-table">
              <thead><tr><th>Side</th><th>Ticker</th><th>Type</th><th>Shares</th><th>Trigger Price</th><th>Placed</th><th></th></tr></thead>
              <tbody>
                ${pendingOrders.map((o) => `
                  <tr class="pending-order-row">
                    <td><span class="fill-side fill-side-${o.side}">${o.side.toUpperCase()}</span></td>
                    <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${o.symbol}" data-target-panel="${panel}">${o.symbol}</button></td>
                    <td><span class="order-type-badge order-type-${o.orderType}">${o.orderType.charAt(0).toUpperCase() + o.orderType.slice(1)}</span></td>
                    <td>${tabularValue(formatShares(o.shares))}</td>
                    <td>${tabularValue(formatPrice(o.limitPrice, o.symbol))}</td>
                    <td class="muted">${formatRelativeTime(o.createdAt)}</td>
                    <td class="row-actions">
                      <button class="btn btn-ghost btn-inline btn-danger" type="button" data-cancel-pending-order="${o.id}">Cancel</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </article>
        ` : ""}

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split">
              <h4>Recent Fills</h4>
              <small>${orders.length} total</small>
            </header>
            ${orders.length ? `
              <div class="fills-list">
                ${orders.slice(0, 12).map((order) => `
                  <div class="fill-row">
                    <span class="fill-side fill-side-${order.side}">${order.side.toUpperCase()}</span>
                    <span class="fill-symbol">${order.symbol}</span>
                    <span class="fill-qty">${formatShares(order.shares)} @ ${formatPrice(order.price, order.symbol)}</span>
                    <span class="fill-total">${formatMoney(order.total)}</span>
                    ${order.side === "sell"
                      ? `<span class="${order.realizedPl >= 0 ? "positive" : "negative"}">${formatSignedMoney(order.realizedPl)}</span>`
                      : `<span class="muted">—</span>`}
                    <span class="fill-time">${formatRelativeTime(order.createdAt)}</span>
                  </div>
                `).join("")}
              </div>
            ` : emptyState("No fills yet.")}
          </article>

          <article class="card">
            <header class="card-head card-head-split">
              <h4>Achievements</h4>
              <small>${unlockedCount}/${achievements.length} unlocked</small>
            </header>
            <div class="achievement-grid">
              ${achievements.map((a) => `
                <div class="achievement-tile ${a.unlocked ? "is-unlocked" : ""}" title="${a.description}">
                  <strong>${a.title}</strong>
                  <small>${a.description}</small>
                  ${a.unlocked ? `<span class="achievement-badge">✓</span>` : `<span class="achievement-locked">—</span>`}
                </div>
              `).join("")}
            </div>
          </article>
        </div>

        <div class="toolbar toolbar-wrap">
          <button class="btn btn-ghost btn-sm" type="button" data-trade-reset>Reset paper account</button>
          <small class="muted">Starting cash: ${formatMoney(account.startingCash)} · All fills use live market prices</small>
        </div>
      </section>
    `;
  };
}
