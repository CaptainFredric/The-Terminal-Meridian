const COMPARATORS = {
  ">": (left, right) => left > right,
  "<": (left, right) => left < right,
  ">=": (left, right) => left >= right,
  "<=": (left, right) => left <= right,
  "==": (left, right) => left === right,
};

export class LogicEngine {
  constructor() {
    this.lastMatches = new Map();
  }

  parseRule(input) {
    const source = String(input || "").trim();
    // Updated regex to support optional AND RSI/SMA condition
    const match = source.match(
      /^IF\s+([A-Z0-9.-]+)\s*(>=|<=|>|<|==)\s*([0-9]+(?:\.[0-9]+)?)\s+(?:AND\s+(RSI|SMA20|EMA9|MACD)\s*(>=|<=|>|<|==)\s*([0-9]+(?:\.[0-9]+)?)\s+)?THEN\s+(.+)$/i
    );
    if (!match) {
      throw new Error(
        "Invalid rule syntax. Use: IF [ticker] [operator] [value] THEN [message]" +
        " or: IF [ticker] [op] [value] AND [indicator] [op] [value] THEN [message]"
      );
    }

    const symbol = String(match[1] || "").toUpperCase();
    const op = String(match[2] || "");
    const limit = Number(match[3]);
    const indicatorType = match[4] ? String(match[4]).toUpperCase() : null;
    const indicatorOp = match[5] ? String(match[5]) : null;
    const indicatorLimit = match[6] ? Number(match[6]) : null;
    const msg = String(match[match.length - 1] || "").trim();

    if (!COMPARATORS[op]) {
      throw new Error("Unsupported operator. Use >, <, >=, <=, or ==.");
    }

    if (!Number.isFinite(limit)) {
      throw new Error("Rule value must be numeric.");
    }

    if (indicatorType && !COMPARATORS[indicatorOp]) {
      throw new Error("Unsupported indicator operator. Use >, <, >=, <=, or ==.");
    }

    if (indicatorType && !Number.isFinite(indicatorLimit)) {
      throw new Error("Indicator value must be numeric.");
    }

    if (!msg) {
      throw new Error("Rule message is required after THEN.");
    }

    const conditions = [
      {
        type: "price",
        symbol,
        op,
        limit,
      },
    ];

    if (indicatorType) {
      conditions.push({
        type: "indicator",
        indicator: indicatorType,
        op: indicatorOp,
        limit: indicatorLimit,
      });
    }

    return {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol,
      conditions,
      msg,
      createdAt: Date.now(),
    };
  }

  evaluate(state) {
    const triggers = [];
    const activeRules = Array.isArray(state.activeRules) ? state.activeRules : [];
    const activeIds = new Set(activeRules.map((rule) => rule.id));

    for (const cachedId of this.lastMatches.keys()) {
      if (!activeIds.has(cachedId)) this.lastMatches.delete(cachedId);
    }

    for (const rule of activeRules) {
      // For legacy rules with op/limit at top level, convert to conditions format
      const conditions = rule.conditions || [
        {
          type: "price",
          symbol: rule.symbol,
          op: rule.op,
          limit: rule.limit,
        },
      ];

      const quote = state.quotes?.get?.(rule.symbol);
      const price = Number(quote?.price);
      if (!Number.isFinite(price)) {
        this.lastMatches.set(rule.id, false);
        continue;
      }

      let matched = true;

      // Check all conditions
      for (const condition of conditions) {
        if (condition.type === "price") {
          const comparator = COMPARATORS[condition.op];
          if (!comparator) {
            matched = false;
            break;
          }
          if (!comparator(price, Number(condition.limit))) {
            matched = false;
            break;
          }
        } else if (condition.type === "indicator") {
          const indicatorValue = this._getIndicatorValue(state, rule.symbol, condition.indicator);
          if (!Number.isFinite(indicatorValue)) {
            matched = false;
            break;
          }
          const comparator = COMPARATORS[condition.op];
          if (!comparator || !comparator(indicatorValue, Number(condition.limit))) {
            matched = false;
            break;
          }
        }
      }

      const previouslyMatched = Boolean(this.lastMatches.get(rule.id));

      if (matched && !previouslyMatched) {
        triggers.push({
          ruleId: rule.id,
          symbol: rule.symbol,
          msg: rule.msg,
          price,
          triggeredAt: Date.now(),
        });
      }

      this.lastMatches.set(rule.id, matched);
    }

    return triggers;
  }

  _getIndicatorValue(state, symbol, indicator) {
    // Helper to fetch indicator values from cached chart data
    // Computes indicators on demand from state.chartCache
    if (!state.chartCache) return null;

    // Find chart data for this symbol (try common ranges: 1mo, 1y)
    const ranges = ["1mo", "1y"];
    let points = null;
    for (const range of ranges) {
      const interval = range === "1mo" ? "1d" : "1w"; // Simple interval mapping
      const key = `${symbol}-${range}-${interval}`;
      points = state.chartCache.get(key);
      if (points && points.length) break;
    }

    if (!points || !points.length) return null;

    switch (indicator) {
      case "RSI":
        const closes = points.map((p) => Number(p.close || 0));
        return this._calculateRsi(closes);
      case "SMA20":
      case "EMA9":
      case "MACD":
        // TODO: Implement other indicators on demand
        return null;
      default:
        return null;
    }
  }

  _calculateRsi(closes, period = 14) {
    // RSI calculation: relative strength index
    if (closes.length < period + 1) return null;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    }
    if (avgLoss === 0) return 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
  }
}
