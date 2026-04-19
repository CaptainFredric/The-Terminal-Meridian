/**
 * Unit tests for src/LogicEngine.js
 *
 * Run with Node.js:
 *   node --input-type=module < tests/LogicEngine.test.js
 */

// ── Minimal test harness ────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function describe(name, fn) {
  console.log(`\n▶ ${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failures.push({ suite: name, error: err.message });
    failed++;
  }
}

function expect(received) {
  return {
    toBe(expected) {
      if (received !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(received)}`);
    },
    toEqual(expected) {
      const a = JSON.stringify(received);
      const b = JSON.stringify(expected);
      if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
    },
    toThrow(msg) {
      // `received` should be a function
      let threw = false;
      let errorMsg = "";
      try {
        received();
      } catch (e) {
        threw = true;
        errorMsg = e.message || "";
      }
      if (!threw) throw new Error(`Expected function to throw, but it did not`);
      if (msg && !errorMsg.includes(msg))
        throw new Error(`Expected throw message to include "${msg}", got "${errorMsg}"`);
    },
    toBeGreaterThan(n) {
      if (received <= n) throw new Error(`Expected ${received} > ${n}`);
    },
    toBeTruthy() {
      if (!received) throw new Error(`Expected truthy, got ${JSON.stringify(received)}`);
    },
    toBeFalsy() {
      if (received) throw new Error(`Expected falsy, got ${JSON.stringify(received)}`);
    },
    toHaveLength(n) {
      if (received.length !== n)
        throw new Error(`Expected length ${n}, got ${received.length}`);
    },
  };
}

// ── Inline the LogicEngine ──────────────────────────────────────────────────
const COMPARATORS = {
  ">": (left, right) => left > right,
  "<": (left, right) => left < right,
  ">=": (left, right) => left >= right,
  "<=": (left, right) => left <= right,
  "==": (left, right) => left === right,
};

class LogicEngine {
  constructor() {
    this.lastMatches = new Map();
  }

  parseRule(input) {
    const source = String(input || "").trim();
    const match = source.match(/^IF\s+([A-Z0-9.-]+)\s*(>=|<=|>|<|==)\s*([0-9]+(?:\.[0-9]+)?)\s+THEN\s+(.+)$/i);
    if (!match) {
      throw new Error("Invalid rule syntax. Use: IF [ticker] [operator] [value] THEN [message]");
    }
    const symbol = String(match[1] || "").toUpperCase();
    const op = String(match[2] || "");
    const limit = Number(match[3]);
    const msg = String(match[4] || "").trim();
    if (!COMPARATORS[op]) throw new Error("Unsupported operator. Use >, <, >=, <=, or ==.");
    if (!Number.isFinite(limit)) throw new Error("Rule value must be numeric.");
    if (!msg) throw new Error("Rule message is required after THEN.");
    return {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol, op, limit, msg, createdAt: Date.now(),
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
          ruleId: rule.id, symbol: rule.symbol, op: rule.op,
          limit: rule.limit, msg: rule.msg, price, triggeredAt: Date.now(),
        });
      }
      this.lastMatches.set(rule.id, matched);
    }
    return triggers;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("parseRule — valid inputs", () => {
  const engine = new LogicEngine();

  it("parses basic > rule", () => {
    const rule = engine.parseRule("IF AAPL > 220 THEN Breakout");
    expect(rule.symbol).toBe("AAPL");
    expect(rule.op).toBe(">");
    expect(rule.limit).toBe(220);
    expect(rule.msg).toBe("Breakout");
  });

  it("parses < rule", () => {
    const rule = engine.parseRule("IF NVDA < 500 THEN Value zone");
    expect(rule.symbol).toBe("NVDA");
    expect(rule.op).toBe("<");
    expect(rule.limit).toBe(500);
  });

  it("parses == rule", () => {
    const rule = engine.parseRule("IF SPY == 500 THEN Exactly 500");
    expect(rule.op).toBe("==");
    expect(rule.limit).toBe(500);
  });

  it("handles decimal limits", () => {
    const rule = engine.parseRule("IF BTC-USD > 68420.50 THEN New high");
    expect(rule.symbol).toBe("BTC-USD");
    expect(rule.limit).toBe(68420.50);
  });

  it("is case-insensitive for IF/THEN keywords", () => {
    const rule = engine.parseRule("if aapl > 200 then Go long");
    expect(rule.symbol).toBe("AAPL");
    expect(rule.msg).toBe("Go long");
  });

  it("generates unique IDs", () => {
    const r1 = engine.parseRule("IF A > 1 THEN x");
    const r2 = engine.parseRule("IF A > 1 THEN x");
    expect(r1.id !== r2.id).toBeTruthy();
  });

  it("preserves multiword messages", () => {
    const rule = engine.parseRule("IF TSLA > 300 THEN Tesla broke out above resistance!");
    expect(rule.msg).toBe("Tesla broke out above resistance!");
  });
});

describe("parseRule — invalid inputs", () => {
  const engine = new LogicEngine();

  it("rejects empty string", () => {
    expect(() => engine.parseRule("")).toThrow("Invalid rule syntax");
  });

  it("rejects missing THEN clause", () => {
    expect(() => engine.parseRule("IF AAPL > 200")).toThrow("Invalid rule syntax");
  });

  it("rejects missing IF keyword", () => {
    expect(() => engine.parseRule("AAPL > 200 THEN Breakout")).toThrow("Invalid rule syntax");
  });

  it("parses >= operator", () => {
    const rule = engine.parseRule("IF AAPL >= 200 THEN Breakout");
    expect(rule.op).toBe(">=");
    expect(rule.limit).toBe(200);
  });

  it("parses <= operator", () => {
    const rule = engine.parseRule("IF NVDA <= 400 THEN Support");
    expect(rule.op).toBe("<=");
    expect(rule.limit).toBe(400);
  });

  it("rejects unsupported operator !=", () => {
    expect(() => engine.parseRule("IF AAPL != 200 THEN Breakout")).toThrow("Invalid rule syntax");
  });

  it("rejects non-numeric limit", () => {
    expect(() => engine.parseRule("IF AAPL > abc THEN Breakout")).toThrow("Invalid rule syntax");
  });

  it("rejects null input", () => {
    expect(() => engine.parseRule(null)).toThrow("Invalid rule syntax");
  });
});

describe("evaluate — triggering logic", () => {
  it("triggers when condition first becomes true", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "AAPL", op: ">", limit: 200, msg: "Breakout" };
    const quotes = new Map([["AAPL", { price: 210 }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(1);
    expect(triggers[0].symbol).toBe("AAPL");
    expect(triggers[0].price).toBe(210);
  });

  it("does not re-trigger on second evaluation if still matched", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "AAPL", op: ">", limit: 200, msg: "Breakout" };
    const quotes = new Map([["AAPL", { price: 210 }]]);
    engine.evaluate({ activeRules: [rule], quotes }); // first trigger
    const triggers2 = engine.evaluate({ activeRules: [rule], quotes }); // second call
    expect(triggers2).toHaveLength(0);
  });

  it("re-triggers after condition becomes false then true again", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "AAPL", op: ">", limit: 200, msg: "Breakout" };
    const above = new Map([["AAPL", { price: 210 }]]);
    const below = new Map([["AAPL", { price: 190 }]]);

    engine.evaluate({ activeRules: [rule], quotes: above }); // trigger
    engine.evaluate({ activeRules: [rule], quotes: below }); // reset
    const triggers = engine.evaluate({ activeRules: [rule], quotes: above }); // re-trigger
    expect(triggers).toHaveLength(1);
  });

  it("does not trigger when condition is false", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "AAPL", op: ">", limit: 200, msg: "Breakout" };
    const quotes = new Map([["AAPL", { price: 190 }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(0);
  });

  it("handles < operator correctly", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "NVDA", op: "<", limit: 500, msg: "Dip" };
    const quotes = new Map([["NVDA", { price: 450 }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(1);
  });

  it("handles == operator correctly", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "SPY", op: "==", limit: 500, msg: "Level" };
    const quotes = new Map([["SPY", { price: 500 }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(1);
  });

  it("skips rules with no quote data", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "ZZZZ", op: ">", limit: 100, msg: "Test" };
    const quotes = new Map(); // no ZZZZ
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(0);
  });

  it("evaluates multiple rules independently", () => {
    const engine = new LogicEngine();
    const rules = [
      { id: "r1", symbol: "AAPL", op: ">", limit: 200, msg: "Apple high" },
      { id: "r2", symbol: "NVDA", op: "<", limit: 500, msg: "NVDA dip" },
      { id: "r3", symbol: "TSLA", op: ">", limit: 300, msg: "Tesla moon" },
    ];
    const quotes = new Map([
      ["AAPL", { price: 210 }],
      ["NVDA", { price: 480 }],
      ["TSLA", { price: 250 }], // not triggered
    ]);
    const triggers = engine.evaluate({ activeRules: rules, quotes });
    expect(triggers).toHaveLength(2);
  });

  it("cleans up stale rules from cache", () => {
    const engine = new LogicEngine();
    const rule1 = { id: "r1", symbol: "AAPL", op: ">", limit: 200, msg: "Test" };
    const quotes = new Map([["AAPL", { price: 210 }]]);
    engine.evaluate({ activeRules: [rule1], quotes });
    // Now remove rule1 from active rules
    engine.evaluate({ activeRules: [], quotes });
    // lastMatches should have cleaned up r1
    expect(engine.lastMatches.has("r1")).toBeFalsy();
  });

  it("handles empty activeRules array", () => {
    const engine = new LogicEngine();
    const triggers = engine.evaluate({ activeRules: [], quotes: new Map() });
    expect(triggers).toHaveLength(0);
  });

  it("handles missing activeRules property", () => {
    const engine = new LogicEngine();
    const triggers = engine.evaluate({});
    expect(triggers).toHaveLength(0);
  });
});

describe("evaluate — edge cases", () => {
  it("NaN price does not trigger", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "AAPL", op: ">", limit: 200, msg: "Test" };
    const quotes = new Map([["AAPL", { price: NaN }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(0);
  });

  it("null price does not trigger", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "AAPL", op: ">", limit: 200, msg: "Test" };
    const quotes = new Map([["AAPL", { price: null }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(0);
  });

  it(">= triggers at exact boundary", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "AAPL", op: ">=", limit: 200, msg: "Test" };
    const quotes = new Map([["AAPL", { price: 200 }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(1);
  });

  it("<= triggers at exact boundary", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "AAPL", op: "<=", limit: 200, msg: "Test" };
    const quotes = new Map([["AAPL", { price: 200 }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(1);
  });

  it(">= does not trigger below threshold", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "AAPL", op: ">=", limit: 200, msg: "Test" };
    const quotes = new Map([["AAPL", { price: 199.99 }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(0);
  });

  it("price at exact boundary > does not trigger", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "AAPL", op: ">", limit: 200, msg: "Test" };
    const quotes = new Map([["AAPL", { price: 200 }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(0); // 200 is NOT > 200
  });

  it("price at exact boundary < does not trigger", () => {
    const engine = new LogicEngine();
    const rule = { id: "r1", symbol: "AAPL", op: "<", limit: 200, msg: "Test" };
    const quotes = new Map([["AAPL", { price: 200 }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers).toHaveLength(0); // 200 is NOT < 200
  });

  it("trigger includes correct ruleId", () => {
    const engine = new LogicEngine();
    const rule = { id: "my-rule-42", symbol: "SPY", op: ">", limit: 400, msg: "Hit" };
    const quotes = new Map([["SPY", { price: 500 }]]);
    const triggers = engine.evaluate({ activeRules: [rule], quotes });
    expect(triggers[0].ruleId).toBe("my-rule-42");
  });
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.error("\nFailed tests:");
  failures.forEach((f) => console.error(`  • ${f.suite}: ${f.error}`));
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
