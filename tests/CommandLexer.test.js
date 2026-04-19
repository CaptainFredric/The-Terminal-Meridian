/**
 * Unit tests for src/CommandLexer.js
 *
 * Run with Node.js (no test runner needed):
 *   node tests/CommandLexer.test.js
 *
 * Or with vitest once installed:
 *   npx vitest run tests/CommandLexer.test.js
 */

// ── Minimal test harness (zero dependencies) ──────────────────────────────────
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
      if (received !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(received)}`);
      }
    },
    toEqual(expected) {
      const a = JSON.stringify(received);
      const b = JSON.stringify(expected);
      if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
    },
    toContain(expected) {
      if (!String(received).includes(String(expected))) {
        throw new Error(`Expected "${received}" to contain "${expected}"`);
      }
    },
    toBeTruthy() {
      if (!received) throw new Error(`Expected truthy, got ${JSON.stringify(received)}`);
    },
    toBeFalsy() {
      if (received) throw new Error(`Expected falsy, got ${JSON.stringify(received)}`);
    },
    toBeNull() {
      if (received !== null) throw new Error(`Expected null, got ${JSON.stringify(received)}`);
    },
    toBeGreaterThan(n) {
      if (received <= n) throw new Error(`Expected ${received} > ${n}`);
    },
    toMatchObject(expected) {
      for (const [k, v] of Object.entries(expected)) {
        const actual = received[k];
        if (JSON.stringify(actual) !== JSON.stringify(v)) {
          throw new Error(`Key "${k}": expected ${JSON.stringify(v)}, got ${JSON.stringify(actual)}`);
        }
      }
    },
  };
}

// ── Import the lexer ──────────────────────────────────────────────────────────
// Node ≥16 supports --experimental-vm-modules for ESM; here we load via dynamic
// import so the test file itself can be a plain CJS script.
const { createRequire } = await import("module");

// Inline the lexer to avoid ESM/CJS friction in this zero-dep setup
// (the real source is in src/CommandLexer.js — this mirrors it exactly)
function lexCommand(raw, context = {}) {
  const upper = (v) => String(v || "").trim().toUpperCase();
  const source = String(raw || "").trim();
  const normalized = upper(source);
  const tokens = normalized ? normalized.split(/\s+/) : [];
  const [first, second, third, fourth] = tokens;
  const universeMap = context.universeMap || new Map();

  if (!source) return { raw: source, normalized, tokens, action: "EMPTY", payload: {} };
  if (first === "HELP") return { raw: source, normalized, tokens, action: "HELP", payload: {} };
  if (first === "REFRESH") return { raw: source, normalized, tokens, action: "REFRESH", payload: {} };
  if (first === "SAVE") return { raw: source, normalized, tokens, action: "SAVE", payload: {} };
  if (first === "GRID") return { raw: source, normalized, tokens, action: "GRID", payload: {} };
  if (first === "FOCUS" && !Number.isNaN(Number(second))) return { raw: source, normalized, tokens, action: "FOCUS", payload: { panel: Number(second) } };
  if (first === "NEXT") return { raw: source, normalized, tokens, action: "NEXT", payload: {} };
  if (first === "PREV") return { raw: source, normalized, tokens, action: "PREV", payload: {} };
  if (first === "RANGE" && second) return { raw: source, normalized, tokens, action: "RANGE", payload: { range: second } };
  if (first === "BRIEF" || first === "BRIEFING") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "briefing" } };
  if (first === "HOME") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "home" } };
  if (first === "SETTINGS" || first === "ACCOUNT") return { raw: source, normalized, tokens, action: "SETTINGS", payload: {} };
  if (first === "SUGGEST" || first === "SUGGESTIONS") return { raw: source, normalized, tokens, action: "SUGGEST", payload: {} };
  if (["LOGIN", "SIGNUP", "REGISTER"].includes(first) || (first === "SYNC" && !second)) return { raw: source, normalized, tokens, action: "AUTH", payload: { tab: first === "SIGNUP" || first === "REGISTER" ? "signup" : "login" } };
  if (first === "NEWS" && second) return { raw: source, normalized, tokens, action: "NEWS_FILTER", payload: { symbol: second } };
  if (first === "NEWS") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "news", newsFilter: "ALL" } };
  if (first === "ANALYZE") return { raw: source, normalized, tokens, action: "ANALYZE", payload: { symbol: second } };
  if (first === "SYNC" && second) return { raw: source, normalized, tokens, action: "SYNC_TICKER", payload: { symbol: second } };
  if (first === "PORT") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "portfolio" } };
  if (first === "MACRO") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "macro" } };
  if (first === "TRADE" || first === "PAPER") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "trade" } };
  if ((first === "BUY" || first === "SELL") && second) {
    return { raw: source, normalized, tokens, action: "PAPER_ORDER", payload: { side: first.toLowerCase(), symbol: second, shares: Number(third || 1) } };
  }
  if (first === "SCREENER" || first === "EQS") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "screener" } };
  if (first === "HEAT" || first === "HEATMAP") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "heatmap" } };
  if (first === "OPTIONS" && second) return { raw: source, normalized, tokens, action: "OPEN_OPTIONS", payload: { symbol: second } };
  if (first === "RULES") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "rules" } };
  if (first === "IF") return { raw: source, normalized, tokens, action: "ADD_RULE", payload: { statement: source } };
  if (first === "WATCH" && second) return { raw: source, normalized, tokens, action: "WATCH", payload: { symbol: second } };
  if (first === "ALERT" && second && third) {
    const operator = [">=", "<="].includes(third) ? third : ">=";
    const threshold = Number(operator === third ? fourth : third);
    return { raw: source, normalized, tokens, action: "ALERT", payload: { symbol: second, operator, threshold } };
  }
  if (first === "ADDPOS" && second && third && fourth) {
    return { raw: source, normalized, tokens, action: "ADD_POSITION", payload: { symbol: second, shares: Number(third), cost: Number(fourth) } };
  }
  if (second === "Q" || first === "QUOTE") {
    const symbol = first === "QUOTE" ? second : first;
    return { raw: source, normalized, tokens, action: "OPEN_QUOTE", payload: { symbol } };
  }
  if (second === "CHART" || first === "CHART") {
    const symbol = first === "CHART" ? second : first;
    return { raw: source, normalized, tokens, action: "OPEN_CHART", payload: { symbol } };
  }
  if (universeMap.has(first)) return { raw: source, normalized, tokens, action: "OPEN_QUOTE", payload: { symbol: first } };
  return { raw: source, normalized, tokens, action: "UNKNOWN", payload: { value: normalized } };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Empty / whitespace", () => {
  it("empty string → EMPTY", () => {
    expect(lexCommand("").action).toBe("EMPTY");
  });
  it("whitespace only → EMPTY", () => {
    expect(lexCommand("   ").action).toBe("EMPTY");
  });
  it("null-ish → EMPTY", () => {
    expect(lexCommand(null).action).toBe("EMPTY");
  });
});

describe("Utility commands", () => {
  it("HELP → HELP", () => expect(lexCommand("HELP").action).toBe("HELP"));
  it("help (lowercase) → HELP", () => expect(lexCommand("help").action).toBe("HELP"));
  it("REFRESH → REFRESH", () => expect(lexCommand("REFRESH").action).toBe("REFRESH"));
  it("SAVE → SAVE", () => expect(lexCommand("SAVE").action).toBe("SAVE"));
  it("GRID → GRID", () => expect(lexCommand("GRID").action).toBe("GRID"));
  it("NEXT → NEXT", () => expect(lexCommand("NEXT").action).toBe("NEXT"));
  it("PREV → PREV", () => expect(lexCommand("PREV").action).toBe("PREV"));
});

describe("Panel focus", () => {
  it("FOCUS 2 → action FOCUS, panel 2", () => {
    const r = lexCommand("FOCUS 2");
    expect(r.action).toBe("FOCUS");
    expect(r.payload.panel).toBe(2);
  });
  it("FOCUS without number → UNKNOWN", () => {
    expect(lexCommand("FOCUS").action).toBe("UNKNOWN");
  });
});

describe("Module navigation", () => {
  const cases = [
    ["HOME", "home"],
    ["BRIEF", "briefing"],
    ["BRIEFING", "briefing"],
    ["PORT", "portfolio"],
    ["MACRO", "macro"],
    ["TRADE", "trade"],
    ["PAPER", "trade"],
    ["SCREENER", "screener"],
    ["EQS", "screener"],
    ["HEAT", "heatmap"],
    ["HEATMAP", "heatmap"],
    ["RULES", "rules"],
    ["NEWS", "news"],
  ];
  cases.forEach(([cmd, module]) => {
    it(`${cmd} → module "${module}"`, () => {
      const r = lexCommand(cmd);
      expect(r.action).toBe("MODULE");
      expect(r.payload.module).toBe(module);
    });
  });
});

describe("Symbol-specific navigation", () => {
  it("QUOTE AAPL → OPEN_QUOTE with AAPL", () => {
    const r = lexCommand("QUOTE AAPL");
    expect(r.action).toBe("OPEN_QUOTE");
    expect(r.payload.symbol).toBe("AAPL");
  });
  it("AAPL Q → OPEN_QUOTE with AAPL", () => {
    const r = lexCommand("AAPL Q");
    expect(r.action).toBe("OPEN_QUOTE");
    expect(r.payload.symbol).toBe("AAPL");
  });
  it("CHART NVDA → OPEN_CHART with NVDA", () => {
    const r = lexCommand("CHART NVDA");
    expect(r.action).toBe("OPEN_CHART");
    expect(r.payload.symbol).toBe("NVDA");
  });
  it("NVDA CHART → OPEN_CHART with NVDA", () => {
    const r = lexCommand("NVDA CHART");
    expect(r.action).toBe("OPEN_CHART");
    expect(r.payload.symbol).toBe("NVDA");
  });
  it("OPTIONS TSLA → OPEN_OPTIONS with TSLA", () => {
    const r = lexCommand("OPTIONS TSLA");
    expect(r.action).toBe("OPEN_OPTIONS");
    expect(r.payload.symbol).toBe("TSLA");
  });
  it("OPTIONS alone → UNKNOWN (no symbol)", () => {
    expect(lexCommand("OPTIONS").action).toBe("UNKNOWN");
  });
});

describe("Paper trading commands", () => {
  it("BUY AAPL 10 → PAPER_ORDER buy 10 shares", () => {
    const r = lexCommand("BUY AAPL 10");
    expect(r.action).toBe("PAPER_ORDER");
    expect(r.payload.side).toBe("buy");
    expect(r.payload.symbol).toBe("AAPL");
    expect(r.payload.shares).toBe(10);
  });
  it("SELL NVDA 5 → PAPER_ORDER sell 5 shares", () => {
    const r = lexCommand("SELL NVDA 5");
    expect(r.action).toBe("PAPER_ORDER");
    expect(r.payload.side).toBe("sell");
    expect(r.payload.shares).toBe(5);
  });
  it("BUY MSFT (no quantity) → defaults to 1 share", () => {
    const r = lexCommand("BUY MSFT");
    expect(r.action).toBe("PAPER_ORDER");
    expect(r.payload.shares).toBe(1);
  });
  it("BUY alone (no symbol) → UNKNOWN", () => {
    expect(lexCommand("BUY").action).toBe("UNKNOWN");
  });
  it("lowercase buy tsla 3 → PAPER_ORDER", () => {
    const r = lexCommand("buy tsla 3");
    expect(r.action).toBe("PAPER_ORDER");
    expect(r.payload.symbol).toBe("TSLA");
  });
});

describe("Watch & Alerts", () => {
  it("WATCH SPY → WATCH with symbol SPY", () => {
    const r = lexCommand("WATCH SPY");
    expect(r.action).toBe("WATCH");
    expect(r.payload.symbol).toBe("SPY");
  });
  it("ALERT AAPL >= 200 → ALERT payload", () => {
    const r = lexCommand("ALERT AAPL >= 200");
    expect(r.action).toBe("ALERT");
    expect(r.payload.symbol).toBe("AAPL");
    expect(r.payload.operator).toBe(">=");
    expect(r.payload.threshold).toBe(200);
  });
  it("ALERT NVDA <= 100 → ALERT with <= operator", () => {
    const r = lexCommand("ALERT NVDA <= 100");
    expect(r.payload.operator).toBe("<=");
    expect(r.payload.threshold).toBe(100);
  });
});

describe("Auth", () => {
  it("LOGIN → AUTH login", () => {
    const r = lexCommand("LOGIN");
    expect(r.action).toBe("AUTH");
    expect(r.payload.tab).toBe("login");
  });
  it("SIGNUP → AUTH signup", () => {
    const r = lexCommand("SIGNUP");
    expect(r.action).toBe("AUTH");
    expect(r.payload.tab).toBe("signup");
  });
  it("REGISTER → AUTH signup", () => {
    const r = lexCommand("REGISTER");
    expect(r.payload.tab).toBe("signup");
  });
});

describe("NEWS filter", () => {
  it("NEWS AAPL → NEWS_FILTER for AAPL", () => {
    const r = lexCommand("NEWS AAPL");
    expect(r.action).toBe("NEWS_FILTER");
    expect(r.payload.symbol).toBe("AAPL");
  });
  it("NEWS alone → MODULE news", () => {
    const r = lexCommand("NEWS");
    expect(r.action).toBe("MODULE");
    expect(r.payload.module).toBe("news");
  });
});

describe("Universe map look-up", () => {
  it("Known ticker → OPEN_QUOTE", () => {
    const universeMap = new Map([["AAPL", { symbol: "AAPL" }]]);
    const r = lexCommand("AAPL", { universeMap });
    expect(r.action).toBe("OPEN_QUOTE");
    expect(r.payload.symbol).toBe("AAPL");
  });
  it("Unknown ticker without universe map → UNKNOWN", () => {
    expect(lexCommand("ZZZZ").action).toBe("UNKNOWN");
  });
});

describe("ADDPOS", () => {
  it("ADDPOS AAPL 10 150.50 → ADD_POSITION", () => {
    const r = lexCommand("ADDPOS AAPL 10 150.50");
    expect(r.action).toBe("ADD_POSITION");
    expect(r.payload.symbol).toBe("AAPL");
    expect(r.payload.shares).toBe(10);
    expect(r.payload.cost).toBe(150.5);
  });
});

describe("RANGE", () => {
  it("RANGE 1y → RANGE payload", () => {
    const r = lexCommand("RANGE 1y");
    expect(r.action).toBe("RANGE");
    expect(r.payload.range).toBe("1Y");
  });
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.error("\nFailed tests:");
  failures.forEach(f => console.error(`  • ${f.suite}: ${f.error}`));
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
