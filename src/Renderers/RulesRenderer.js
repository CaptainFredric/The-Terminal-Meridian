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
    const history = Array.isArray(state.notifications) ? state.notifications.slice(0, 30) : [];
    const uniqueSymbols = [...new Set(rows.map((r) => r.symbol))];
    const activeTab = state.rulesActiveTab || "history";

    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home">
          <article class="card stat-card"><span>📏 Active Rules</span><strong>${rows.length}</strong><small>${uniqueSymbols.length} unique symbol${uniqueSymbols.length !== 1 ? "s" : ""}</small></article>
          <article class="card stat-card"><span>🔔 Triggers</span><strong>${history.length}</strong><small>${history.length ? "Recent events" : "No events yet"}</small></article>
          <article class="card stat-card"><span>🎯 Coverage</span><strong>${uniqueSymbols.slice(0, 4).join(", ") || "—"}</strong><small>${uniqueSymbols.length > 4 ? `+${uniqueSymbols.length - 4} more` : "Monitored"}</small></article>
        </div>

        <div class="rules-tab-bar" role="tablist">
          <button class="rules-tab-btn${activeTab === "rules" ? " is-active" : ""}" type="button" data-rules-tab="rules" role="tab">
            ⚙️ Active Rules
            <span class="rules-tab-badge">${rows.length}</span>
          </button>
          <button class="rules-tab-btn${activeTab === "history" ? " is-active" : ""}" type="button" data-rules-tab="history" role="tab">
            📜 Trigger History
            <span class="rules-tab-badge">${history.length}</span>
          </button>
        </div>

        ${activeTab === "rules" ? `
          <article class="card">
            ${rows.length
              ? `
                <table class="data-table data-table-dense financial-data-table">
                  <thead><tr><th>Symbol</th><th>Condition</th><th>Threshold</th><th>Message</th><th></th></tr></thead>
                  <tbody>
                    ${rows
                      .map(
                        (rule) => `
                          <tr>
                            <td><strong>${rule.symbol}</strong></td>
                            <td><code>${rule.op}</code></td>
                            <td>${tabularValue(rule.limit)}</td>
                            <td>${rule.msg}</td>
                            <td><button class="btn btn-ghost btn-inline btn-danger" type="button" data-remove-rule="${rule.id}">✕</button></td>
                          </tr>
                        `,
                      )
                      .join("")}
                  </tbody>
                </table>
              `
              : `<div class="empty-state">No rules configured. Try: <code>IF AAPL > 220 THEN Breakout!</code></div>`}
          </article>
        ` : `
          <article class="card">
            <div class="system-log${history.length ? "" : " is-empty"}">
              ${history.length
                ? history
                    .map((item) => {
                      const time = formatSystemTime(item.triggeredAt);
                      const symbol = String(item.symbol || "--").toUpperCase();
                      const message = item.msg || "Condition Met";
                      return `<div class="system-log-entry"><span class="system-log-line">[${time}] <span style='color: #58a6ff'>⚡</span> <strong>${symbol}</strong> — ${message}</span></div>`;
                    })
                    .join("")
                : `<div class="empty-state">No triggers yet. Fired rules appear here in real-time.</div>`}
            </div>
          </article>
        `}
      </section>
    `;
  };
}
