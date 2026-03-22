function upper(value) {
  return String(value || "").trim().toUpperCase();
}

export function lexCommand(raw, context = {}) {
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
