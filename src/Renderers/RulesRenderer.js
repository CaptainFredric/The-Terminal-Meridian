import { tabularValue, formatPrice, formatSignedPct } from "./Common.js";

export function createRulesRenderer(context) {
  const { state, buildQuote } = context;

  const formatSystemTime = (value) =>
    new Date(value || Date.now())
      .toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(/^(\d{2}:\d{2}:\d{2})/, "$1");

  const formatRelativeTime = (ts) => {
    const ms = Date.now() - new Date(ts).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return `${Math.floor(ms / 86_400_000)}d ago`;
  };

  return function renderRules(panel) {
    const rows = Array.isArray(state.activeRules) ? state.activeRules : [];
    const alerts = Array.isArray(state.alerts) ? state.alerts : [];
    const history = Array.isArray(state.notifications) ? state.notifications.slice(0, 40) : [];
    const uniqueSymbols = [...new Set(rows.map((r) => r.symbol))];
    const activeTab = state.rulesActiveTab || "rules";

    // Compute live status for each rule
    const rulesWithStatus = rows.map((rule) => {
      // Support both legacy (rule.op/rule.limit) and new (rule.conditions) formats
      const conditions = rule.conditions || [
        {
          type: "price",
          op: rule.op,
          limit: rule.limit,
        },
      ];

      // For watchlist rules, check if ANY symbol in watchlist matches
      // For single-symbol rules, check that symbol
      const priceCondition = conditions.find((c) => c.type === "price");
      const op = priceCondition?.op;
      const limit = priceCondition?.limit;

      let isMatched = false;
      let price = null;
      let distance = null;
      let symbolsMatched = [];

      if (rule.applyToWatchlist && Array.isArray(state.watchlist)) {
        // Check each watchlist symbol
        for (const sym of state.watchlist) {
          const q = buildQuote(sym);
          const p = q?.price;
          if (!Number.isFinite(p)) continue;

          const matches = op && (() => {
            if (op === ">")  return p > limit;
            if (op === ">=") return p >= limit;
            if (op === "<")  return p < limit;
            if (op === "<=") return p <= limit;
            if (op === "==") return Math.abs(p - limit) < 0.01;
            return false;
          })();

          if (matches) {
            symbolsMatched.push(sym);
            isMatched = true;
          }
        }
        // Use first symbol's price for display (or average if multiple)
        const firstMatch = state.watchlist.find((s) => symbolsMatched.includes(s));
        if (firstMatch) {
          price = buildQuote(firstMatch)?.price;
        }
      } else {
        // Single symbol rule
        const quote = buildQuote(rule.symbol);
        price = quote?.price;

        isMatched = price != null && (() => {
          if (!op) return false;
          if (op === ">")  return price > limit;
          if (op === ">=") return price >= limit;
          if (op === "<")  return price < limit;
          if (op === "<=") return price <= limit;
          if (op === "==") return Math.abs(price - limit) < 0.01;
          return false;
        })();
      }

      // Distance calculation
      distance = price != null && priceCondition ? ((price - priceCondition.limit) / priceCondition.limit * 100) : null;
      // Proximity 0-100%: 100 = touching threshold, 0 = very far
      const proximityPct = distance != null
        ? Math.min(100, Math.max(0, 100 - Math.min(Math.abs(distance) * 5, 100)))
        : 0;
      const isClose = !isMatched && proximityPct >= 80; // within ~4%
      return { ...rule, price, isMatched, distance, proximityPct, isClose, conditions, symbolsMatched };
    });

    const matchedCount = rulesWithStatus.filter((r) => r.isMatched).length;

    // Alert summary
    const alertsTriggered = alerts.filter((a) => a.status === "triggered").length;
    const alertsWatching = alerts.filter((a) => a.status === "watching").length;

    const RULE_TEMPLATES = [
      { label: "📈 SPY breakout",   cmd: "IF SPY > 540 THEN SPY breakout, above 540" },
      { label: "🍎 AAPL above 210", cmd: "IF AAPL > 210 THEN Apple above 210" },
      { label: "📉 QQQ sell-off",   cmd: "IF QQQ < 400 THEN QQQ selling off, below 400" },
      { label: "🔥 NVDA momentum",  cmd: "IF NVDA > 130 AND RSI >= 70 THEN NVDA overbought breakout" },
      { label: "🎯 Watchlist scan", cmd: "IF @WATCHLIST > 5pct THEN Watchlist symbol moving up 5% daily" },
      { label: "⚡ VIX spike",      cmd: "IF VIX > 25 THEN Volatility spike, hedge accordingly" },
    ];

    const ALERT_TEMPLATES = [
      { label: "AAPL ≥ 210",  cmd: "ALERT AAPL >= 210" },
      { label: "SPY ≥ 540",   cmd: "ALERT SPY >= 540" },
      { label: "NVDA ≥ 130",  cmd: "ALERT NVDA >= 130" },
      { label: "QQQ ≤ 400",   cmd: "ALERT QQQ <= 400" },
    ];

    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));">
          <article class="card stat-card">
            <span>Active Rules</span>
            <strong>${rows.length}</strong>
            <small>${uniqueSymbols.length} symbol${uniqueSymbols.length !== 1 ? "s" : ""}</small>
          </article>
          <article class="card stat-card">
            <span>Matched Now</span>
            <strong class="${matchedCount > 0 ? "positive" : ""}">${matchedCount}</strong>
            <small>${matchedCount > 0 ? "Conditions met" : "None triggered"}</small>
          </article>
          <article class="card stat-card">
            <span>Price Alerts</span>
            <strong>${alertsWatching + alertsTriggered}</strong>
            <small>${alertsTriggered ? `${alertsTriggered} triggered` : `${alertsWatching} watching`}</small>
          </article>
          <article class="card stat-card">
            <span>Event Log</span>
            <strong>${history.length}</strong>
            <small>${history.length ? "Recent events" : "No events yet"}</small>
          </article>
        </div>

        <div class="rules-tab-bar" role="tablist">
          <button class="rules-tab-btn${activeTab === "rules" ? " is-active" : ""}" type="button" data-rules-tab="rules" role="tab">
            Active Rules
            <span class="rules-tab-badge">${rows.length}</span>
          </button>
          <button class="rules-tab-btn${activeTab === "alerts" ? " is-active" : ""}" type="button" data-rules-tab="alerts" role="tab">
            Price Alerts
            <span class="rules-tab-badge">${alerts.length}</span>
          </button>
          <button class="rules-tab-btn${activeTab === "history" ? " is-active" : ""}" type="button" data-rules-tab="history" role="tab">
            Event Log
            <span class="rules-tab-badge">${history.length}</span>
          </button>
        </div>

        ${activeTab === "rules" ? `
          <article class="card">
            <header class="card-head card-head-split">
              <h4>IF / THEN Rules</h4>
              <small class="${matchedCount > 0 ? "positive" : ""}">
                <span class="rules-live-dot"></span>
                Evaluating live · ${matchedCount > 0 ? `${matchedCount} matched` : "none matched"}
              </small>
            </header>
            ${rulesWithStatus.length
              ? `
                <div class="rules-live-list">
                  ${rulesWithStatus.map((rule) => {
                    // Format conditions for display
                    const conditionDisplays = rule.conditions ? rule.conditions.map((cond) => {
                      if (cond.type === "price") {
                        const dirLabel = { ">": "above", ">=": "≥", "<": "below", "<=": "≤", "==": "equals" }[cond.op] || cond.op;
                        const symbolDisplay = rule.applyToWatchlist ? "* All Watchlist *" : (cond.symbol || rule.symbol);
                        return `${symbolDisplay} ${dirLabel} ${Number(cond.limit).toLocaleString()}`;
                      } else if (cond.type === "indicator") {
                        const dirLabel = { ">": ">", ">=": "≥", "<": "<", "<=": "≤", "==": "=" }[cond.op] || cond.op;
                        return `${cond.indicator} ${dirLabel} ${Number(cond.limit).toFixed(1)}`;
                      }
                      return "";
                    }).filter(Boolean) : [];
                    const conditionText = conditionDisplays.join(" AND ");

                    // Legacy rule support
                    const directionLabel = rule.op ? ({ ">": "above", ">=": "≥", "<": "below", "<=": "≤", "==": "equals" }[rule.op] || rule.op) : "";
                    const thresholdClass = rule.op ? ((rule.op === ">" || rule.op === ">=") ? "positive" : (rule.op === "<" || rule.op === "<=") ? "negative" : "") : "";
                    const pctLabel = rule.distance != null ? `${rule.distance > 0 ? "+" : ""}${rule.distance.toFixed(1)}%` : "--";
                    const statusClass = rule.isMatched ? "rule-status-matched" : rule.isClose ? "rule-status-close" : "rule-status-watching";
                    const statusLabel = rule.isMatched ? "✅ TRIGGERED" : rule.isClose ? "🔶 CLOSE" : "⏳ watching";
                    const watchlistLabel = rule.applyToWatchlist ? ` <span style="font-size: 0.85rem; color: var(--text-muted);">(${rule.symbolsMatched.length}/${state.watchlist.length} matching)</span>` : "";
                    return `
                      <div class="rule-live-row ${statusClass}">
                        <div class="rule-live-header">
                          <div class="rule-live-title">
                            <span class="rule-condition-text">${conditionText || `${rule.symbol} ${directionLabel} ${Number(rule.limit).toLocaleString()}`}${watchlistLabel}</span>
                          </div>
                          <div class="rule-live-status ${statusClass}">${statusLabel}</div>
                          <button class="btn btn-ghost btn-inline btn-danger" type="button" data-remove-rule="${rule.id}" title="Remove rule">✕</button>
                        </div>
                        <div class="rule-live-progress">
                          <div class="rule-proximity-bar">
                            <div class="rule-proximity-fill ${rule.isMatched ? "matched" : rule.isClose ? "close" : ""}"
                                 style="width:${rule.proximityPct.toFixed(1)}%"></div>
                          </div>
                          <div class="rule-live-meta">
                            <span>Current: <strong>${rule.price != null ? `$${Number(rule.price).toFixed(2)}` : "--"}</strong></span>
                            <span>Distance: <strong class="${rule.distance !== null ? (rule.distance >= 0 ? 'positive' : 'negative') : ''}">${pctLabel}</strong></span>
                            <span class="rule-live-msg">${rule.msg}</span>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              `
              : `
                <div class="rules-empty-state">
                  <div class="rules-empty-icon">📋</div>
                  <h4>No rules yet</h4>
                  <p>Rules evaluate live prices every 5 seconds and fire events in the log below.</p>
                  <p class="rules-syntax-hint">
                    <strong>Syntax:</strong>
                    <code>IF [SYMBOL] [&gt; / &lt; / ==] [VALUE] THEN [MESSAGE]</code>
                    <br>
                    <code>IF @WATCHLIST [OP] [VALUE] THEN [MESSAGE]</code>
                    <br>
                    <code>IF [SYMBOL] [OP] [VALUE] AND [RSI/SMA20/EMA9] [OP] [VALUE] THEN [MESSAGE]</code>
                  </p>
                  <div class="rules-template-section">
                    <span class="rules-template-label">Quick-add a template</span>
                    <div class="rules-template-grid">
                      ${RULE_TEMPLATES.map((t) => `
                        <button class="rules-template-btn" type="button" data-rule-template="${t.cmd.replace(/"/g, '&quot;')}">${t.label}</button>
                      `).join("")}
                    </div>
                  </div>
                </div>
              `}
          </article>
          <article class="card rules-syntax-card">
            <span class="rules-syntax-prefix">⌨</span>
            <span>Type <code>IF [SYMBOL] [&gt;/&lt;/==] [VALUE] THEN [MSG]</code> in the command bar to add rules.</span>
          </article>
        ` : activeTab === "alerts" ? `
          <article class="card">
            <header class="card-head card-head-split">
              <h4>Price Alerts</h4>
              <small>Add via command bar: <code>ALERT AAPL &gt;= 200</code></small>
            </header>
            ${alerts.length
              ? `
                <table class="data-table data-table-dense financial-data-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Operator</th>
                      <th style="text-align:right">Threshold</th>
                      <th style="text-align:right">Current</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${alerts.map((alert) => {
                      const quote = buildQuote(alert.symbol);
                      const price = quote?.price;
                      const isTriggered = alert.status === "triggered";
                      return `
                        <tr class="${isTriggered ? "rule-matched" : ""}">
                          <td><strong>${alert.symbol}</strong></td>
                          <td><code>${alert.operator}</code></td>
                          <td style="text-align:right">${tabularValue(Number(alert.threshold).toLocaleString())}</td>
                          <td style="text-align:right">${price != null
                            ? tabularValue("$" + Number(price).toFixed(2), { flashKey: "alert:" + alert.symbol, currentPrice: price })
                            : '<span style="color:var(--muted)">--</span>'}</td>
                          <td>${isTriggered
                            ? '<span class="status-dot status-dot-green">● Triggered</span>'
                            : '<span class="status-dot status-dot-yellow">○ Watching</span>'}</td>
                          <td><button class="btn btn-ghost btn-inline btn-danger" type="button" data-remove-alert="${alert.symbol}:${alert.operator}:${alert.threshold}" title="Delete alert">✕</button></td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>
              `
              : `
                <div class="rules-empty-state">
                  <div class="rules-empty-icon">🔔</div>
                  <h4>No alerts set</h4>
                  <p>Get notified the moment a stock crosses your target price.</p>
                  <div class="rules-template-section">
                    <span class="rules-template-label">Quick-add an alert</span>
                    <div class="rules-template-grid">
                      ${ALERT_TEMPLATES.map((t) => `
                        <button class="rules-template-btn" type="button" data-rule-template="${t.cmd}">${t.label}</button>
                      `).join("")}
                    </div>
                  </div>
                </div>
              `}
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
                      return `<div class="system-log-entry"><span class="system-log-line">[${time}] <span class="log-trigger-dot"></span> <strong>${symbol}</strong>: ${message}</span></div>`;
                    })
                    .join("")
                : `
                  <div class="rules-empty-state">
                    <div class="rules-empty-icon">🗂️</div>
                    <h4>Event log is empty</h4>
                    <p>Fired rules and triggered alerts appear here in real-time. Add a rule above to get started.</p>
                  </div>
                `}
            </div>
          </article>
        `}
      </section>
    `;
  };
}
