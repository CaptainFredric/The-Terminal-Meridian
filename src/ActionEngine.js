function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function scoreCandidate(query, candidate) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  const aliases = [candidate.label, candidate.command, ...(candidate.aliases || [])]
    .map(normalizeText)
    .filter(Boolean);

  let score = 0;
  aliases.forEach((alias) => {
    if (!alias) return;
    if (alias === normalizedQuery) {
      score = Math.max(score, 140);
      return;
    }
    if (alias.startsWith(normalizedQuery)) {
      score = Math.max(score, 112 - Math.max(alias.length - normalizedQuery.length, 0));
    }
    if (alias.includes(normalizedQuery)) {
      score = Math.max(score, 92 - Math.max(alias.length - normalizedQuery.length, 0));
    }

    const queryTokens = tokenize(normalizedQuery);
    const aliasTokens = tokenize(alias);
    const tokenHits = queryTokens.filter((token) => aliasTokens.some((aliasToken) => aliasToken.startsWith(token))).length;
    if (tokenHits) {
      score = Math.max(score, tokenHits * 18 + (aliasTokens.length ? 24 : 0));
    }
  });

  return score;
}

export class ActionEngine {
  constructor({ universe = [], handlers = {} } = {}) {
    this.universe = universe;
    this.handlers = handlers;
  }

  findSymbols(query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return [];

    const directTicker = String(query || "").toUpperCase().match(/[A-Z][A-Z0-9.-]{0,9}/g) || [];
    const directMatches = directTicker
      .map((symbol) => this.universe.find((item) => item.symbol === symbol))
      .filter(Boolean);

    const fuzzyMatches = this.universe.filter((item) => {
      const symbol = normalizeText(item.symbol);
      const name = normalizeText(item.name);
      return symbol.includes(normalizedQuery) || name.includes(normalizedQuery) || normalizedQuery.includes(symbol);
    });

    return [...new Map([...directMatches, ...fuzzyMatches].map((item) => [item.symbol, item])).values()].slice(0, 4);
  }

  buildBaseActions() {
    return [
      {
        id: "clear-notifications",
        label: "Clear Notifications",
        command: "Clear Notifications",
        description: "Reset notification drawer history and badge count.",
        aliases: ["clear notification history", "reset notifications", "clear history"],
        execute: () => this.handlers.clearNotifications?.(),
      },
      {
        id: "clear-alerts",
        label: "Clear Alerts",
        command: "Clear Alerts",
        description: "Remove every active alert from the rail.",
        aliases: ["delete alerts", "remove alerts", "reset alerts"],
        execute: () => this.handlers.clearAlerts?.(),
      },
      {
        id: "toggle-rules-tab",
        label: "Toggle Rules Tab",
        command: "Toggle Rules Tab",
        description: "Flip the Rules panel between rules and trigger history.",
        aliases: ["switch rules tab", "rules history", "toggle history"],
        execute: () => this.handlers.toggleRulesTab?.(),
      },
      {
        id: "compact-mode",
        label: "Compact Mode",
        command: "Compact Mode",
        description: "Toggle denser spacing for terminal-style layouts.",
        aliases: ["toggle compact mode", "dense mode", "compact layout"],
        execute: () => this.handlers.toggleCompactMode?.(),
      },
      {
        id: "theme-light",
        label: "Theme Light",
        command: "Theme Light",
        description: "Switch the workspace to the light theme.",
        aliases: ["light mode", "set theme light"],
        execute: () => this.handlers.setTheme?.("light"),
      },
      {
        id: "theme-dark",
        label: "Theme Dark",
        command: "Theme Dark",
        description: "Switch the workspace to the dark theme.",
        aliases: ["dark mode", "set theme dark"],
        execute: () => this.handlers.setTheme?.("dark"),
      },
    ];
  }

  buildSymbolActions(query) {
    const symbols = this.findSymbols(query);
    if (!symbols.length) return [];

    return symbols.flatMap((item) => [
      {
        id: `goto-${item.symbol}`,
        label: `Go to ${item.symbol}`,
        command: `Go to ${item.symbol}`,
        description: `${item.name} across all panels.`,
        aliases: [`open ${item.symbol}`, `broadcast ${item.symbol}`, `quote ${item.symbol}`],
        execute: () => this.handlers.goToSymbol?.(item.symbol),
      },
      {
        id: `delete-${item.symbol}`,
        label: `Delete ${item.symbol}`,
        command: `Delete ${item.symbol}`,
        description: `Remove ${item.symbol} from local workspace collections.`,
        aliases: [`remove ${item.symbol}`, `delete ${item.name}`],
        execute: () => this.handlers.deleteSymbol?.(item.symbol),
      },
    ]);
  }

  search(query) {
    const candidates = [...this.buildBaseActions(), ...this.buildSymbolActions(query)]
      .map((candidate) => ({ ...candidate, score: scoreCandidate(query, candidate) }))
      .filter((candidate) => candidate.score >= 28)
      .sort((left, right) => right.score - left.score);

    return candidates.slice(0, 8);
  }

  execute(query) {
    const [best] = this.search(query);
    if (!best || best.score < 78) return false;
    best.execute?.();
    return true;
  }
}