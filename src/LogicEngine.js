const COMPARATORS = {
  ">": (left, right) => left > right,
  "<": (left, right) => left < right,
  "==": (left, right) => left === right,
};

export class LogicEngine {
  constructor() {
    this.lastMatches = new Map();
  }

  parseRule(input) {
    const source = String(input || "").trim();
    const match = source.match(/^IF\s+([A-Z0-9.-]+)\s*(>|<|==)\s*([0-9]+(?:\.[0-9]+)?)\s+THEN\s+(.+)$/i);
    if (!match) {
      throw new Error("Invalid rule syntax. Use: IF [ticker] [operator] [value] THEN [message]");
    }

    const symbol = String(match[1] || "").toUpperCase();
    const op = String(match[2] || "");
    const limit = Number(match[3]);
    const msg = String(match[4] || "").trim();

    if (!COMPARATORS[op]) {
      throw new Error("Unsupported operator. Use >, <, or ==.");
    }

    if (!Number.isFinite(limit)) {
      throw new Error("Rule value must be numeric.");
    }

    if (!msg) {
      throw new Error("Rule message is required after THEN.");
    }

    return {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol,
      op,
      limit,
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
      const quote = state.quotes?.get?.(rule.symbol);
      const price = Number(quote?.price);
      if (!Number.isFinite(price)) {
        this.lastMatches.set(rule.id, false);
        continue;
      }

      const comparator = COMPARATORS[rule.op];
      if (!comparator) continue;

      const matched = comparator(price, Number(rule.limit));
      const previouslyMatched = Boolean(this.lastMatches.get(rule.id));

      if (matched && !previouslyMatched) {
        triggers.push({
          ruleId: rule.id,
          symbol: rule.symbol,
          op: rule.op,
          limit: rule.limit,
          msg: rule.msg,
          price,
          triggeredAt: Date.now(),
        });
      }

      this.lastMatches.set(rule.id, matched);
    }

    return triggers;
  }
}
