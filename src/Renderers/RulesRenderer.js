import { tabularValue } from "./Common.js";

export function createRulesRenderer(context) {
  const { state } = context;

  const formatSystemTime = (value) =>
    new Date(value || Date.now())
      .toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(/^(\d{2}:\d{2}:\d{2})/, "$1");

  return function renderRules() {
    const rows = Array.isArray(state.activeRules) ? state.activeRules : [];
    const history = Array.isArray(state.notifications) ? state.notifications.slice(0, 20) : [];

    return `
      <section class="stack stack-lg">
        <article class="card">
          <header class="card-head card-head-split"><h4>Active Rules</h4><small>${rows.length} loaded</small></header>
          ${rows.length
            ? `
              <table class="data-table data-table-dense financial-data-table">
                <thead><tr><th>Symbol</th><th>Condition</th><th>Message</th><th></th></tr></thead>
                <tbody>
                  ${rows
                    .map(
                      (rule) => `
                        <tr>
                          <td>${rule.symbol}</td>
                          <td>${tabularValue(`${rule.op} ${rule.limit}`)}</td>
                          <td>${rule.msg}</td>
                          <td><button class="btn btn-ghost btn-inline" type="button" data-remove-rule="${rule.id}">Delete</button></td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            `
            : `<div class="empty-state">No rules yet. Try: IF AAPL > 220 THEN Breakout!</div>`}
        </article>

        <article class="card">
          <header class="card-head card-head-split"><h4>Trigger History</h4><small>${history.length} events</small></header>
          <div class="system-log${history.length ? '' : ' is-empty'}">
            ${history.length
              ? history
                  .map((item) => {
                    const time = formatSystemTime(item.triggeredAt);
                    const symbol = String(item.symbol || "--").toUpperCase();
                    const message = item.msg || "Condition Met";
                    return `<div class="system-log-entry"><span class="system-log-line">[${time}] <span style='color: #6f8fff'>LOG</span>: ${symbol} ${message}</span></div>`;
                  })
                  .join("")
              : `<div class="empty-state">No triggers yet. Fired rules will appear here in real-time.</div>`}
          </div>
        </article>
      </section>
    `;
  };
}
