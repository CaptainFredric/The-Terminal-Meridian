# Frontend services and data

Copy-paste packet generated from the current workspace state.

## Included Files

- `src/api.js`
- `src/AppCore.js`
- `src/CommandLexer.js`
- `src/Controllers/CommandController.js`
- `src/Controllers/DockingController.js`
- `src/Controllers/WorkspaceController.js`
- `src/data.js`
- `src/LogicEngine.js`
- `src/Registry.js`
- `src/Renderers/ChartRenderer.js`
- `src/Renderers/Common.js`
- `src/Renderers/BriefingRenderer.js`
- `src/Renderers/CalculatorRenderer.js`
- `src/Renderers/HeatmapRenderer.js`
- `src/Renderers/HomeRenderer.js`
- `src/Renderers/MacroRenderer.js`
- `src/Renderers/NewsRenderer.js`
- `src/Renderers/OptionsRenderer.js`
- `src/Renderers/PortfolioRenderer.js`
- `src/Renderers/QuoteRenderer.js`
- `src/Renderers/RulesRenderer.js`
- `src/Renderers/ScreenerRenderer.js`
- `src/StateStore.js`
- `src/services.js`
- `src/marketService.js`

---

## `src/api.js`

````javascript
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

function resolveApiBase() {
  if (typeof window === "undefined") return "";

  const override = window.MERIDIAN_API_BASE || window.localStorage.getItem("meridian.api-base") || "";
  if (override) return String(override).replace(/\/$/, "");

  const { protocol, hostname, port } = window.location;
  const isLocal = hostname === "127.0.0.1" || hostname === "localhost";
  if (isLocal && port && port !== "4173") {
    return `${protocol}//${hostname}:4173`;
  }

  return "";
}

const API_BASE = resolveApiBase();

function buildApiUrl(path) {
  return `${API_BASE}${path}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? payload.error : `Request failed with ${response.status}`;
    throw new Error(String(message));
  }

  return payload;
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {}),
    },
  });

  return parseResponse(response);
}

export const authApi = {
  signup(payload) {
    return apiRequest("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload) {
    return apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logout() {
    return apiRequest("/api/auth/logout", { method: "POST" });
  },
  session() {
    return apiRequest("/api/auth/session");
  },
  checkAvailability({ email = "", username = "" } = {}) {
    const query = new URLSearchParams();
    if (email) query.set("email", email);
    if (username) query.set("username", username);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/api/auth/availability${suffix}`);
  },
  updateProfile(payload) {
    return apiRequest("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  changePassword(payload) {
    return apiRequest("/api/auth/password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteAccount(payload) {
    return apiRequest("/api/auth/account", {
      method: "DELETE",
      body: JSON.stringify(payload),
    });
  },
};

export const workspaceApi = {
  get() {
    return apiRequest("/api/workspace");
  },
  save(workspace) {
    return apiRequest("/api/workspace", {
      method: "PUT",
      body: JSON.stringify(workspace),
    });
  },
};

export const marketApi = {
  quotes(symbols) {
    const encoded = encodeURIComponent(symbols.join(","));
    return apiRequest(`/api/market/quotes?symbols=${encoded}`);
  },
  overview(symbols = []) {
    const encoded = encodeURIComponent(symbols.join(","));
    const suffix = encoded ? `?symbols=${encoded}` : "";
    return apiRequest(`/api/market/overview${suffix}`);
  },
  chart(symbol, range = "1mo", interval = "1d") {
    return apiRequest(`/api/market/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`);
  },
  options(symbol, date) {
    const suffix = date ? `?date=${encodeURIComponent(date)}` : "";
    return apiRequest(`/api/market/options/${encodeURIComponent(symbol)}${suffix}`);
  },
  news() {
    return apiRequest("/api/market/news");
  },
  deepDive(symbol) {
    return apiRequest(`/api/market/deep-dive/${encodeURIComponent(symbol)}`);
  },
  fx() {
    return apiRequest("/api/market/fx");
  },
  health() {
    return apiRequest("/api/health");
  },
};

export const uiCache = {
  key: "the-terminal.ui-cache.v2",
  read() {
    try {
      const raw = window.localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },
  write(value) {
    window.localStorage.setItem(this.key, JSON.stringify(value));
  },
};
````

## `src/AppCore.js`

````javascript
export class AppCore {
  constructor({ store, registry, lexCommand, dependencies }) {
    this.store = store;
    this.registry = registry;
    this.lexCommand = lexCommand;
    this.dependencies = dependencies;
    this.logicEngine = dependencies.logicEngine || null;
    this.unsubscribeLogicEngine = null;
  }

  initialize() {
    if (this.logicEngine && !this.unsubscribeLogicEngine) {
      this.unsubscribeLogicEngine = this.store.subscribe(() => {
        const notifications = this.logicEngine.evaluate(this.store.state);
        if (!notifications.length) return;

        notifications.forEach((notification) => {
          this.store.state.notifications.unshift(notification);
          this.store.state.notifications = this.store.state.notifications.slice(0, 100);
          this.dependencies.showToast?.(`${notification.symbol}: ${notification.msg}`, "success");
        });
      });
    }

    this.dependencies.onInitialize?.();
  }

  setActivePanel(panel) {
    this.store.state.activePanel = Number(panel);
    this.dependencies.onActivePanelChange?.(Number(panel));
    this.dependencies.syncUiCache?.();
  }

  setFocusedPanel(panel) {
    const numericPanel = panel ? Number(panel) : null;
    this.store.state.focusedPanel = numericPanel && this.store.state.focusedPanel === numericPanel ? null : numericPanel;
    if (this.store.state.focusedPanel) {
      this.store.state.activePanel = this.store.state.focusedPanel;
    }
    this.dependencies.onFocusChange?.(this.store.state.focusedPanel);
    this.dependencies.syncUiCache?.();
  }

  cycleModule(panel, direction) {
    const currentIndex = this.dependencies.moduleOrder.indexOf(this.store.state.panelModules[panel]);
    const nextIndex = (currentIndex + direction + this.dependencies.moduleOrder.length) % this.dependencies.moduleOrder.length;
    this.loadModule(this.dependencies.moduleOrder[nextIndex], panel);
  }

  loadModule(moduleName, panel, options = {}) {
    if (!this.registry.has(moduleName)) {
      this.dependencies.showToast?.(`Unknown module: ${moduleName}`, "error");
      return;
    }
    this.store.state.panelModules[panel] = moduleName;
    this.setActivePanel(panel);
    this.dependencies.syncPanelData?.(panel);
    if (options.reveal) this.dependencies.revealPanelIfNeeded?.(panel);
    this.dependencies.queueWorkspaceSave?.();
  }

  dispatchRawCommand(raw) {
    const parsed = this.lexCommand(raw, { universeMap: this.dependencies.universeMap });
    return this.dispatchCommand(parsed);
  }

  dispatchCommand(parsed) {
    const { raw, action, payload } = parsed;
    if (action === "EMPTY") return parsed;

    this.store.state.commandHistory.unshift(raw);
    this.store.state.commandHistory = this.store.state.commandHistory.slice(0, 50);
    this.store.state.commandHistoryIndex = -1;

    switch (action) {
      case "HELP":
        this.store.state.newsItems = this.dependencies.commandCatalog.map((item) => ({
          source: "Command",
          headline: `${item.cmd} — ${item.desc}`,
          time: this.dependencies.currentTimeShort(),
          link: "#",
        }));
        this.store.state.newsFilter = "ALL";
        this.loadModule("news", this.store.state.activePanel, { reveal: true });
        break;
      case "REFRESH":
        this.dependencies.refreshAllData?.();
        break;
      case "SAVE":
        this.dependencies.queueWorkspaceSave?.();
        this.dependencies.showToast?.("Workspace save queued.", "success");
        break;
      case "GRID":
        this.setFocusedPanel(null);
        break;
      case "FOCUS":
        this.setFocusedPanel(payload.panel);
        break;
      case "NEXT":
        this.cycleModule(this.store.state.activePanel, 1);
        break;
      case "PREV":
        this.cycleModule(this.store.state.activePanel, -1);
        break;
      case "RANGE": {
        const range = this.dependencies.normalizeChartRange(payload.range);
        this.store.state.chartRanges[this.store.state.activePanel] = range;
        if (this.store.state.panelModules[this.store.state.activePanel] !== "chart") {
          this.loadModule("chart", this.store.state.activePanel, { reveal: true });
        }
        this.dependencies.refreshChart?.(this.store.state.panelSymbols[this.store.state.activePanel] || "AAPL", range);
        break;
      }
      case "MODULE":
        if (payload.newsFilter) this.store.state.newsFilter = payload.newsFilter;
        this.loadModule(payload.module, this.store.state.activePanel, { reveal: true });
        break;
      case "SETTINGS":
        this.dependencies.openSettingsModal?.();
        break;
      case "SUGGEST":
        this.loadModule("home", this.store.state.activePanel, { reveal: true });
        this.dependencies.showToast?.("Showing suggested next steps.", "neutral");
        break;
      case "AUTH":
        this.dependencies.openAuthEntry?.(payload.tab);
        break;
      case "NEWS_FILTER":
        this.store.state.newsFilter = payload.symbol;
        this.loadModule("news", this.store.state.activePanel, { reveal: true });
        break;
      case "ANALYZE":
        this.dependencies.loadDeepDive?.(payload.symbol || this.store.state.panelSymbols[this.store.state.activePanel] || "AAPL", { panel: this.store.state.activePanel });
        break;
      case "SYNC_TICKER":
        this.dependencies.syncTicker?.(payload.symbol);
        break;
      case "OPEN_OPTIONS":
        this.store.state.panelSymbols[this.store.state.activePanel] = payload.symbol;
        this.store.state.optionsSelection.symbol = payload.symbol;
        this.loadModule("options", this.store.state.activePanel, { reveal: true });
        this.dependencies.refreshOptions?.(payload.symbol, this.store.state.optionsSelection.expiration);
        break;
      case "ADD_RULE": {
        if (!this.logicEngine) {
          this.dependencies.showToast?.("Rules engine unavailable.", "error");
          break;
        }

        try {
          const rule = this.logicEngine.parseRule(payload.statement);
          this.store.state.activeRules.unshift(rule);
          this.store.state.activeRules = this.store.state.activeRules.slice(0, 100);
          this.dependencies.queueWorkspaceSave?.();
          this.dependencies.showToast?.(`Rule added for ${rule.symbol}.`, "success");
          this.loadModule("rules", this.store.state.activePanel, { reveal: true });
        } catch (error) {
          this.dependencies.showToast?.(error?.message || "Invalid rule.", "error");
        }
        break;
      }
      case "WATCH":
        this.dependencies.addToWatchlist?.(payload.symbol);
        break;
      case "ALERT":
        this.dependencies.createAlert?.(payload.symbol, payload.threshold, payload.operator);
        break;
      case "ADD_POSITION":
        this.dependencies.addPosition?.(payload);
        break;
      case "OPEN_QUOTE":
        if (payload.symbol) {
          this.store.state.panelSymbols[this.store.state.activePanel] = payload.symbol;
          this.loadModule("quote", this.store.state.activePanel, { reveal: true });
          this.dependencies.refreshQuotes?.([payload.symbol]);
        }
        break;
      case "OPEN_CHART":
        if (payload.symbol) {
          this.store.state.panelSymbols[this.store.state.activePanel] = payload.symbol;
          this.loadModule("chart", this.store.state.activePanel, { reveal: true });
          this.dependencies.refreshChart?.(payload.symbol, this.store.state.chartRanges[this.store.state.activePanel] || "1mo");
        }
        break;
      default:
        this.dependencies.showToast?.(`I couldn't find “${payload.value || parsed.normalized}”. Try HELP.`, "error");
        break;
    }

    this.dependencies.afterCommand?.();
    return parsed;
  }

  removeRule(ruleId) {
    const before = this.store.state.activeRules.length;
    this.store.state.activeRules = this.store.state.activeRules.filter((rule) => rule.id !== ruleId);
    if (this.store.state.activeRules.length !== before) {
      this.dependencies.queueWorkspaceSave?.();
      this.dependencies.showToast?.("Rule deleted.", "neutral");
    }
  }
}
````

## `src/CommandLexer.js`

````javascript
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
````

## `src/Controllers/CommandController.js`

````javascript
export class CommandController {
  constructor({ state, el, appCore, hideAutocomplete, closeCommandPalette }) {
    this.state = state;
    this.el = el;
    this.appCore = appCore;
    this.hideAutocomplete = hideAutocomplete;
    this.closeCommandPalette = closeCommandPalette;
  }

  processInput() {
    const raw = String(this.el.commandInput?.value || "").trim();
    if (!raw) return;
    this.appCore?.dispatchRawCommand(raw);
  }

  handleCommandKeydown(event) {
    if (event.key === "Enter") {
      this.processInput();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (this.el.commandInput) this.el.commandInput.value = "";
      this.hideAutocomplete();
      this.closeCommandPalette();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (this.state.commandHistoryIndex < this.state.commandHistory.length - 1) {
        this.state.commandHistoryIndex += 1;
        this.el.commandInput.value = this.state.commandHistory[this.state.commandHistoryIndex];
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (this.state.commandHistoryIndex > 0) {
        this.state.commandHistoryIndex -= 1;
        this.el.commandInput.value = this.state.commandHistory[this.state.commandHistoryIndex];
      } else {
        this.state.commandHistoryIndex = -1;
        this.el.commandInput.value = "";
      }
    }
  }
}
````

## `src/Controllers/DockingController.js`

````javascript
export class DockingController {
  constructor({ state, workspaceGrid, renderAllPanels, saveWorkspace, showToast }) {
    this.state = state;
    this.workspaceGrid = workspaceGrid;
    this.renderAllPanels = renderAllPanels;
    this.saveWorkspace = saveWorkspace;
    this.showToast = showToast;
    this.persistTimer = null;
    this.bound = false;
  }

  initialize() {
    this.bind();
  }

  bind() {
    if (!this.workspaceGrid || this.bound) return;
    this.bound = true;

    this.workspaceGrid.querySelectorAll("[data-panel]").forEach((panelNode) => {
      panelNode.setAttribute("draggable", "true");
    });

    this.workspaceGrid.addEventListener("dragstart", (event) => {
      const panelNode = event.target.closest("[data-panel]");
      if (!panelNode) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/panel-id", panelNode.dataset.panel || "");
      panelNode.classList.add("is-dragging");
    });

    this.workspaceGrid.addEventListener("dragend", () => {
      this.workspaceGrid.querySelectorAll("[data-panel].is-dragging").forEach((panelNode) => {
        panelNode.classList.remove("is-dragging");
      });
    });

    this.workspaceGrid.addEventListener("dragover", (event) => {
      if (!event.target.closest("[data-panel]")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    this.workspaceGrid.addEventListener("drop", (event) => {
      const target = event.target.closest("[data-panel]");
      if (!target) return;
      event.preventDefault();

      const sourcePanelId = Number(event.dataTransfer.getData("text/panel-id"));
      const targetPanelId = Number(target.dataset.panel || "0");
      if (!sourcePanelId || !targetPanelId || sourcePanelId === targetPanelId) return;

      this.reconcileLayout(sourcePanelId, targetPanelId);
    });
  }

  reconcileLayout(sourcePanelId, targetPanelId) {
    const panelNodes = [...this.workspaceGrid.querySelectorAll("[data-panel]")];

    const snapshot = panelNodes.map((panelNode, slotIndex) => {
      const panelId = Number(panelNode.dataset.panel || "0");
      const moduleFromDom = String(panelNode.dataset.moduleKey || "").trim().toLowerCase();
      return {
        slot: slotIndex + 1,
        panelId,
        module: moduleFromDom || String(this.state.panelModules[panelId] || "quote").toLowerCase(),
        symbol: this.state.panelSymbols[panelId],
        range: this.state.chartRanges[panelId],
      };
    });

    const sourceEntry = snapshot.find((entry) => entry.panelId === Number(sourcePanelId));
    const targetEntry = snapshot.find((entry) => entry.panelId === Number(targetPanelId));
    if (!sourceEntry || !targetEntry) return;

    const swappedSource = {
      module: sourceEntry.module,
      symbol: sourceEntry.symbol,
      range: sourceEntry.range,
    };

    sourceEntry.module = targetEntry.module;
    sourceEntry.symbol = targetEntry.symbol;
    sourceEntry.range = targetEntry.range;

    targetEntry.module = swappedSource.module;
    targetEntry.symbol = swappedSource.symbol;
    targetEntry.range = swappedSource.range;

    const nextPanelModules = {};
    const nextPanelSymbols = {};
    const nextChartRanges = {};

    snapshot.forEach((entry) => {
      nextPanelModules[entry.slot] = entry.module;
      nextPanelSymbols[entry.slot] = entry.symbol;
      nextChartRanges[entry.slot] = entry.range;
    });

    this.state.panelModules = nextPanelModules;
    this.state.panelSymbols = nextPanelSymbols;
    this.state.chartRanges = {
      ...this.state.chartRanges,
      ...nextChartRanges,
    };

    this.renderAllPanels();
    this.debouncedPersistLayout();
    this.showToast?.("Workspace layout updated.", "neutral");
  }

  debouncedPersistLayout() {
    window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => {
      void this.saveWorkspace?.();
    }, 500);
  }
}
````

## `src/Controllers/WorkspaceController.js`

````javascript
export function normalizePanelMap(source, fallback) {
  const next = { ...fallback };
  if (!source || typeof source !== "object") return next;
  Object.entries(source).forEach(([key, value]) => {
    next[Number(key)] = value;
  });
  return next;
}

const LIVE_DEFAULT_RULES = [
  { symbol: "NVDA", op: ">", limit: 950, msg: "NVIDIA Price Target Hit" },
  { symbol: "AAPL", op: "<", limit: 180, msg: "Apple Value Zone" },
  { symbol: "BTC-USD", op: ">", limit: 75000, msg: "Crypto Breakout" },
];

export function seedLiveRules(activeRules) {
  const existingRules = Array.isArray(activeRules) ? activeRules.filter(Boolean) : [];
  if (existingRules.length) return existingRules;

  const now = Date.now();
  return LIVE_DEFAULT_RULES.map((rule, index) => ({
    id: `seed-rule-${index + 1}`,
    symbol: rule.symbol,
    op: rule.op,
    limit: rule.limit,
    msg: rule.msg,
    createdAt: now - (LIVE_DEFAULT_RULES.length - index) * 1000,
  }));
}

export function seedLiveNotifications(notifications, activeRules) {
  const existingNotifications = Array.isArray(notifications) ? notifications.filter(Boolean) : [];
  if (existingNotifications.length) return existingNotifications;

  const seededRules = seedLiveRules(activeRules);
  const now = Date.now();
  return seededRules.map((rule, index) => ({
    ruleId: rule.id,
    symbol: rule.symbol,
    op: rule.op,
    limit: rule.limit,
    msg: rule.msg,
    price: rule.limit,
    triggeredAt: now - (seededRules.length - index) * 60_000,
  }));
}

export function normalizePanelModules(source, fallback, moduleTitles) {
  const next = { ...fallback };
  const allowedModules = new Set(Object.keys(moduleTitles || {}));

  [1, 2, 3, 4].forEach((panel) => {
    const rawValue = source?.[panel] ?? source?.[String(panel)];
    const normalized = String(rawValue || "").trim().toLowerCase();
    if (allowedModules.has(normalized)) {
      next[panel] = normalized;
    }
  });

  return next;
}

export class WorkspaceController {
  constructor({
    state,
    uiCache,
    workspaceApi,
    authApi,
    authEnabled,
    defaults,
    moduleTitles,
    setNetworkStatus,
    updateAuthControls,
    onSessionHydrated,
  }) {
    this.state = state;
    this.uiCache = uiCache;
    this.workspaceApi = workspaceApi;
    this.authApi = authApi;
    this.authEnabled = Boolean(authEnabled);
    this.defaults = defaults;
    this.moduleTitles = moduleTitles;
    this.setNetworkStatus = setNetworkStatus;
    this.updateAuthControls = updateAuthControls;
    this.onSessionHydrated = onSessionHydrated;
  }

  serializeWorkspace() {
    return {
      watchlist: this.state.watchlist,
      alerts: this.state.alerts,
      positions: this.state.positions,
      panelModules: this.state.panelModules,
      panelSymbols: this.state.panelSymbols,
      commandHistory: this.state.commandHistory,
      activeRules: this.state.activeRules,
    };
  }

  async saveWorkspace() {
    if (!this.state.user) {
      this.uiCache.write({
        ...this.uiCache.read(),
        guestWorkspace: this.serializeWorkspace(),
      });
      return;
    }

    this.setNetworkStatus("Live · Saving");
    try {
      await this.workspaceApi.save(this.serializeWorkspace());
      this.setNetworkStatus("Live · Saved");
    } catch {
      this.setNetworkStatus("Live · Retry");
    }
  }

  queueSave() {
    if (!this.state.user) {
      this.uiCache.write({
        ...this.uiCache.read(),
        guestWorkspace: this.serializeWorkspace(),
      });
      return;
    }

    this.setNetworkStatus("Live · Saving");
    window.clearTimeout(this.state.persistTimer);
    this.state.persistTimer = window.setTimeout(async () => {
      try {
        await this.workspaceApi.save(this.serializeWorkspace());
        this.setNetworkStatus("Live · Saved");
      } catch {
        this.setNetworkStatus("Live · Retry");
      }
    }, 350);
  }

  syncUiCache() {
    this.uiCache.write({
      ...this.uiCache.read(),
      activePanel: this.state.activePanel,
      focusedPanel: this.state.focusedPanel,
      autoJumpToPanel: this.state.autoJumpToPanel,
      chartRanges: this.state.chartRanges,
      newsFilter: this.state.newsFilter,
    });
  }

  hydrateSession(user, workspace = {}) {
    this.state.user = user;
    this.state.watchlist = [...(workspace.watchlist || this.defaults.watchlist)];
    this.state.alerts = structuredClone(workspace.alerts || this.defaults.alerts);
    this.state.positions = structuredClone(workspace.positions || this.defaults.positions);
    this.state.panelModules = normalizePanelModules(workspace.panelModules, this.defaults.panelModules, this.moduleTitles);
    this.state.panelSymbols = normalizePanelMap(workspace.panelSymbols, this.defaults.panelSymbols);
    this.state.commandHistory = [...(workspace.commandHistory || [])];
    this.state.activeRules = structuredClone(seedLiveRules(workspace.activeRules));
    this.state.notifications = structuredClone(seedLiveNotifications(workspace.notifications, this.state.activeRules));
    this.state.sessionStartedAt = Date.now();

    this.updateAuthControls?.();
    this.setNetworkStatus("Live · Saved");
    this.onSessionHydrated?.({ user, workspace });
  }

  async initializeSession(healthOk = false) {
    if (!this.authEnabled) return;
    try {
      const payload = await this.authApi.session();
      this.hydrateSession(payload.user, payload.workspace);
    } catch {
      this.setNetworkStatus(healthOk ? "Guest · Live" : "Guest · Local");
    }
  }
}
````

## `src/data.js`

````javascript
export const appName = "Meridian";

export const authRoles = [
  "Portfolio Manager",
  "Research Analyst",
  "Quant Developer",
  "Macro Trader",
  "Independent Investor",
  "Other",
];

export const functionKeys = [
  { key: "F1", module: "briefing", label: "Briefing" },
  { key: "F2", module: "home", label: "Home" },
  { key: "F3", module: "quote", label: "Quote" },
  { key: "F4", module: "chart", label: "Chart" },
  { key: "F5", module: "news", label: "News" },
  { key: "F6", module: "screener", label: "Screener" },
  { key: "F7", module: "heatmap", label: "Heatmap" },
  { key: "F8", module: "portfolio", label: "Portfolio" },
  { key: "F9", module: "macro", label: "Macro" },
  { key: "F10", module: "options", label: "Options" },
  { key: "F11", module: "calculator", label: "Calculator" },
];

export const moduleOrder = ["briefing", "home", "quote", "chart", "news", "screener", "heatmap", "portfolio", "macro", "options", "calculator", "rules"];

export const moduleTitles = {
  briefing: "Briefing",
  home: "Home",
  quote: "Quote",
  chart: "Chart",
  news: "News",
  screener: "Screener",
  heatmap: "Heatmap",
  portfolio: "Portfolio",
  macro: "Macro",
  options: "Options",
  calculator: "Calculator",
  rules: "Rules",
};

export const commandCatalog = [
  { cmd: "HELP", desc: "See available commands" },
  { cmd: "REFRESH", desc: "Refresh market data" },
  { cmd: "SAVE", desc: "Save your current workspace" },
  { cmd: "GRID", desc: "Return to the full panel grid" },
  { cmd: "FOCUS 2", desc: "Focus panel 2" },
  { cmd: "NEXT", desc: "Move to the next module" },
  { cmd: "PREV", desc: "Move to the previous module" },
  { cmd: "RANGE 1Y", desc: "Set chart range" },
  { cmd: "BRIEF", desc: "Open the Meridian briefing" },
  { cmd: "HOME", desc: "Open the home view" },
  { cmd: "SUGGEST", desc: "Show suggested next steps" },
  { cmd: "NEWS", desc: "Open the news view" },
  { cmd: "NEWS NVDA", desc: "Filter news for NVDA" },
  { cmd: "ANALYZE NVDA", desc: "Load deep insight for NVDA" },
  { cmd: "SYNC NVDA", desc: "Save NVDA into your workspace" },
  { cmd: "PORT", desc: "Open the portfolio view" },
  { cmd: "MACRO", desc: "Open the macro view" },
  { cmd: "AAPL Q", desc: "Open quote for AAPL" },
  { cmd: "AAPL CHART", desc: "Open chart for AAPL" },
  { cmd: "WATCH TSLA", desc: "Add TSLA to watchlist" },
  { cmd: "ALERT NVDA 950", desc: "Create an alert level" },
  { cmd: "ADDPOS MSFT 5 410", desc: "Add a portfolio position" },
  { cmd: "OPTIONS NVDA", desc: "Open options for NVDA" },
  { cmd: "RULES", desc: "Open the rules manager" },
  { cmd: "IF AAPL > 220 THEN Breakout", desc: "Create an active rule" },
];

export const calculatorDefaults = {
  option: { spot: 100, strike: 105, years: 0.5, rate: 5, volatility: 25 },
  bond: { face: 1000, coupon: 5, ytm: 4.5, maturity: 10, frequency: 2 },
};

export const defaultWatchlist = ["AAPL", "MSFT", "NVDA", "QQQ", "TSLA", "BTC-USD"];

export const defaultPositions = [
  { symbol: "NVDA", shares: 8, cost: 815.12 },
  { symbol: "QQQ", shares: 12, cost: 418.45 },
];

export const defaultAlerts = [
  { symbol: "NVDA", operator: ">=", threshold: 950, status: "watching" },
  { symbol: "TSLA", operator: "<=", threshold: 180, status: "watching" },
];

export const macroDefaults = {
  currencies: ["EUR", "GBP", "JPY", "CAD", "CHF", "AUD"],
  curve: [
    { tenor: "1M", yield: 5.31 },
    { tenor: "3M", yield: 5.26 },
    { tenor: "6M", yield: 5.17 },
    { tenor: "1Y", yield: 4.95 },
    { tenor: "2Y", yield: 4.58 },
    { tenor: "5Y", yield: 4.23 },
    { tenor: "10Y", yield: 4.18 },
    { tenor: "30Y", yield: 4.29 },
  ],
};

export const heatmapGroups = {
  Technology: ["AAPL", "MSFT", "NVDA", "AMD", "AVGO", "QCOM"],
  Growth: ["TSLA", "PLTR", "CRWD", "ABNB", "UBER", "COIN"],
  Macro: ["SPY", "QQQ", "IWM", "BTC-USD", "ETH-USD", "TLT"],
};

const defaultUniverse = [
  ["AAPL", "Apple", "Information Technology", "S&P 500", 214.72, 2860000000000],
  ["MSFT", "Microsoft", "Information Technology", "S&P 500", 427.35, 3180000000000],
  ["NVDA", "NVIDIA", "Information Technology", "S&P 500", 903.12, 2220000000000],
  ["TSLA", "Tesla", "Consumer Discretionary", "S&P 500", 196.72, 640000000000],
  ["AMZN", "Amazon", "Consumer Discretionary", "S&P 500", 188.61, 1980000000000],
  ["GOOGL", "Alphabet", "Communication Services", "S&P 500", 172.8, 2120000000000],
  ["META", "Meta", "Communication Services", "S&P 500", 501.12, 1290000000000],
  ["AMD", "AMD", "Information Technology", "S&P 500", 178.44, 289000000000],
  ["QCOM", "Qualcomm", "Information Technology", "S&P 500", 170.15, 189000000000],
  ["AVGO", "Broadcom", "Information Technology", "S&P 500", 1328.17, 617000000000],
  ["PLTR", "Palantir", "Information Technology", "Growth", 31.48, 68000000000],
  ["COIN", "Coinbase", "Financials", "Growth", 258.38, 62000000000],
  ["ABNB", "Airbnb", "Consumer Discretionary", "Growth", 166.12, 106000000000],
  ["UBER", "Uber", "Industrials", "Growth", 77.44, 161000000000],
  ["CRWD", "CrowdStrike", "Information Technology", "Growth", 323.14, 79000000000],
  ["SPY", "SPDR S&P 500", "ETF", "ETF", 513.91, 0],
  ["QQQ", "Invesco QQQ", "ETF", "ETF", 441.37, 0],
  ["IWM", "iShares Russell 2000", "ETF", "ETF", 205.12, 0],
  ["TLT", "iShares 20Y Treasury", "ETF", "ETF", 92.61, 0],
  ["BTC-USD", "Bitcoin", "Cryptocurrency", "Crypto", 68420, 0],
  ["ETH-USD", "Ethereum", "Cryptocurrency", "Crypto", 3718, 0],
];

export function buildUniverse() {
  return defaultUniverse.map(([symbol, name, sector, universe, seedPrice, marketCap]) => ({
    symbol,
    name,
    sector,
    universe,
    exchange: universe === "S&P 500" ? "NYSE/NASDAQ" : universe,
    seedPrice,
    marketCap,
  }));
}
````

## `src/LogicEngine.js`

````javascript
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
````

## `src/Registry.js`

````javascript
import { createBriefingRenderer } from "./Renderers/BriefingRenderer.js";
import { createCalculatorRenderer } from "./Renderers/CalculatorRenderer.js";
import { createChartRenderer } from "./Renderers/ChartRenderer.js";
import { createHeatmapRenderer } from "./Renderers/HeatmapRenderer.js";
import { createHomeRenderer } from "./Renderers/HomeRenderer.js";
import { createMacroRenderer } from "./Renderers/MacroRenderer.js";
import { createNewsRenderer } from "./Renderers/NewsRenderer.js";
import { createOptionsRenderer } from "./Renderers/OptionsRenderer.js";
import { createPortfolioRenderer } from "./Renderers/PortfolioRenderer.js";
import { createQuoteRenderer } from "./Renderers/QuoteRenderer.js";
import { createRulesRenderer } from "./Renderers/RulesRenderer.js";
import { createScreenerRenderer } from "./Renderers/ScreenerRenderer.js";

function normalizeKey(key) {
  return String(key || "").trim().toLowerCase();
}

export function createModuleRegistry(seedEntries = []) {
  const registry = new Map();

  seedEntries.forEach(([key, renderer]) => {
    registry.set(normalizeKey(key), renderer);
  });

  return {
    register(key, renderer) {
      registry.set(normalizeKey(key), renderer);
      return this;
    },
    get(key) {
      return registry.get(normalizeKey(key)) || null;
    },
    has(key) {
      return registry.has(normalizeKey(key));
    },
    entries() {
      return [...registry.entries()];
    },
  };
}

export function createDefaultModuleRegistry(context) {
  return createModuleRegistry([
    ["briefing", createBriefingRenderer(context)],
    ["home", createHomeRenderer(context)],
    ["quote", createQuoteRenderer(context)],
    ["chart", createChartRenderer(context)],
    ["news", createNewsRenderer(context)],
    ["screener", createScreenerRenderer(context)],
    ["heatmap", createHeatmapRenderer(context)],
    ["portfolio", createPortfolioRenderer(context)],
    ["macro", createMacroRenderer(context)],
    ["options", createOptionsRenderer(context)],
    ["calculator", createCalculatorRenderer(context)],
    ["rules", createRulesRenderer(context)],
  ]);
}
````

## `src/Renderers/ChartRenderer.js`

````javascript
import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

export function observeChartResize(container, chart) {
  if (!container || !chart) return () => {};

  const resize = () => {
    const width = Math.max(320, Math.floor(container.clientWidth || 0));
    const height = Math.max(220, Math.floor(container.clientHeight || 0));
    chart.resize(width, height);
    chart.timeScale?.().fitContent?.();
  };

  resize();

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    return () => observer.disconnect();
  }

  window.addEventListener("resize", resize);
  return () => window.removeEventListener("resize", resize);
}

export function createChartRenderer(context) {
  const { state, chartIntervalForRange, chartKey, calculateChartStats, chartRangeOptions } = context;

  return function renderChart(panel) {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const range = state.chartRanges[panel] || "1mo";
    const interval = chartIntervalForRange(range);
    const points = state.chartCache.get(chartKey(symbol, range, interval)) || [];
    const stats = calculateChartStats(points);
    const chartUnavailable = !points.length && !state.health?.ok;
    const waitingForData = !points.length && state.health?.ok;

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          ${chartRangeOptions.map((option) => `<button class="range-pill ${option.value === range ? "is-active" : ""}" type="button" data-chart-range="${panel}:${option.value}">${option.label}</button>`).join("")}
          <button class="btn btn-ghost" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}">Quote</button>
          <button class="btn btn-ghost" type="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Options</button>
          <button class="btn btn-ghost" type="button" data-news-filter="${symbol}">News</button>
          <button class="btn btn-primary" type="button" data-refresh-chart="${panel}:${symbol}:${range}">Refresh chart</button>
        </div>

        <article class="card chart-card chart-card-feature">
          <div class="chart-canvas-wrap">
            <div class="chart-canvas" id="chartCanvas${panel}" data-chart-panel="${panel}"></div>
            ${chartUnavailable ? `<div class="chart-loading chart-fallback">${loadingSkeleton(4)}<p class="empty-inline">Offline: ${symbol} chart feed unavailable. Last requested window ${range.toUpperCase()}.</p></div>` : ""}
            ${waitingForData ? `<div class="chart-loading">${loadingSkeleton(4)}</div>` : ""}
          </div>
        </article>

        <div class="card-grid chart-summary-grid">
          <article class="card stat-card"><span>Range</span><strong>${range.toUpperCase()}</strong><small>${symbol}</small></article>
          <article class="card stat-card"><span>High</span><strong>${points.length ? tabularValue(formatPrice(stats.high, symbol)) : "--"}</strong><small>${points.length ? "Visible range" : "Waiting"}</small></article>
          <article class="card stat-card"><span>Return</span><strong class="${stats.returnPct >= 0 ? "positive" : "negative"}">${points.length ? tabularValue(formatSignedPct(stats.returnPct)) : "--"}</strong><small>${points.length ? "Start to end" : "Waiting"}</small></article>
        </div>
      </section>
    `;
  };
}
````

## `src/Renderers/Common.js`

````javascript
export function loadingSkeleton(lines = 3) {
  return `<div class="stack">${Array.from({ length: lines })
    .map((_, index) => `<span class="skeleton-box ${index === 0 ? "lg" : ""}"></span>`)
    .join("")}</div>`;
}

export function formatPrice(value, symbol = "USD") {
  const digits = symbol === "BTC-USD" || symbol === "USD" ? 0 : 2;
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSignedPct(value) {
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
}

export function formatMarketCap(value) {
  if (!value) return "N/A";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${Number(value).toFixed(0)}`;
}

export function formatVolume(value) {
  if (!value) return "N/A";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return `${value}`;
}

export function formatInsightValue(value) {
  if (value == null) return "--";
  if (typeof value === "object") {
    if ("fmt" in value && value.fmt) return String(value.fmt);
    if ("longFmt" in value && value.longFmt) return String(value.longFmt);
    if ("raw" in value && value.raw != null) return String(value.raw);
  }
  return String(value);
}

export function formatExpiry(value) {
  if (!value) return "Nearest";
  return new Date(Number(value) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

export function tabularValue(content, { currentPrice, previousPrice, flashKey, className = "" } = {}) {
  const attributes = [];
  if (currentPrice != null) attributes.push(`data-price-current="${Number(currentPrice)}"`);
  if (previousPrice != null) attributes.push(`data-price-previous="${Number(previousPrice)}"`);
  if (flashKey) attributes.push(`data-price-key="${flashKey}"`);
  return `<span class="tabular-nums ${className}" ${attributes.join(" ")}>${content}</span>`;
}

export function applyPriceTone(element, currentPrice, previousPrice) {
  if (!element || currentPrice == null || previousPrice == null) return;
  if (Number(currentPrice) === Number(previousPrice)) return;
  const nextClass = Number(currentPrice) > Number(previousPrice) ? "flash-up" : "flash-down";
  const signature = `${Number(previousPrice)}:${Number(currentPrice)}`;
  if (element.dataset.priceFlashSignature === signature) return;
  element.classList.remove("flash-up", "flash-down");
  void element.offsetWidth;
  element.classList.add(nextClass);
  element.dataset.priceFlashSignature = signature;
}
````

## `src/Renderers/BriefingRenderer.js`

````javascript
import { formatPrice, formatSignedPct, tabularValue } from "./Common.js";

export function createBriefingRenderer(context) {
  const { state, buildQuote, currentTimeShort, calculatePulse } = context;

  return function renderBriefing(panel) {
    const primary = state.panelSymbols[panel] || state.watchlist[0] || "SPY";
    const primaryQuote = buildQuote(primary);
    const pulse = calculatePulse();
    const breadth = pulse.gainers + pulse.losers ? (pulse.gainers / (pulse.gainers + pulse.losers)) * 100 : 50;
    const volatility = state.overviewQuotes.length
      ? state.overviewQuotes.reduce((sum, quote) => sum + Math.abs(Number(quote.changePct || 0)), 0) / state.overviewQuotes.length
      : 0;
    const watchedLeaders = state.watchlist
      .map((symbol) => buildQuote(symbol))
      .filter(Boolean)
      .sort((left, right) => Math.abs(right.changePct) - Math.abs(left.changePct))
      .slice(0, 4);

    return `
      <section class="stack stack-lg">
        <article class="card briefing-hero">
          <header class="card-head card-head-split">
            <h4>Meridian Briefing</h4>
            <small>${currentTimeShort()} snapshot</small>
          </header>
          <div class="briefing-grid">
            <div class="brief-metric">
              <span>Regime</span>
              <strong>${state.marketPhase}</strong>
              <small>${state.health.ok ? "Live feed connected" : "Feed reconnecting"}</small>
            </div>
            <div class="brief-metric">
              <span>Breadth</span>
              <strong>${tabularValue(`${breadth.toFixed(0)}%`)}</strong>
              <small>${pulse.gainers} up · ${pulse.losers} down</small>
            </div>
            <div class="brief-metric">
              <span>Volatility pulse</span>
              <strong>${tabularValue(`${volatility.toFixed(2)}%`)}</strong>
              <small>Avg absolute move</small>
            </div>
            <div class="brief-metric">
              <span>Anchor</span>
              <strong>${primary}</strong>
              <small>${primaryQuote ? tabularValue(formatPrice(primaryQuote.price, primary), { flashKey: `quote:${primary}:price`, currentPrice: primaryQuote.price }) : "Fetching quote"}</small>
            </div>
          </div>
        </article>

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split"><h4>Signal board</h4><small>What to check next</small></header>
            <div class="stack-list compact-list">
              <button class="list-row" type="button" data-load-module="chart" data-target-symbol="${primary}" data-target-panel="${panel}"><strong>${primary} trend</strong><small>Review structure and range</small></button>
              <button class="list-row" type="button" data-news-filter="${primary}"><strong>${primary} headlines</strong><small>Scan catalysts and tone</small></button>
              <button class="list-row" type="button" data-load-module="portfolio" data-target-panel="${panel}"><strong>Risk check</strong><small>Open positions and alerts</small></button>
              <button class="list-row" type="button" data-load-module="macro" data-target-panel="${panel}"><strong>Macro backdrop</strong><small>Rates, FX, and regime context</small></button>
            </div>
          </article>

          <article class="card">
            <header class="card-head card-head-split"><h4>Leaders</h4><small>By absolute move</small></header>
            <div class="chip-grid compact-chip-grid">
              ${watchedLeaders.length
                ? watchedLeaders
                    .map(
                      (quote) => `<button class="chip chip-peer" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}"><strong>${quote.symbol}</strong><span>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `quote:${quote.symbol}:price`, currentPrice: quote.price })}</span><small class="${quote.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct))}</small></button>`,
                    )
                    .join("")
                : `<div class="empty-inline">Leaders will appear as market data updates.</div>`}
            </div>
          </article>
        </div>
      </section>
    `;
  };
}
````

## `src/Renderers/CalculatorRenderer.js`

````javascript
import { tabularValue } from "./Common.js";

function calcInput(label, key, value) {
  return `<label class="calc-input"><span>${label}</span><input data-calc-key="${key}" value="${value}" /></label>`;
}

export function createCalculatorRenderer(context) {
  const { state, buildQuote, calculateBlackScholes, calculateBond } = context;

  return function renderCalculator(panel) {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const quote = buildQuote(symbol);
    const optionInput = { ...state.calculator.option, spot: quote?.price || state.calculator.option.spot };
    const option = calculateBlackScholes(optionInput);
    const bond = calculateBond(state.calculator.bond);

    return `
      <section class="split-grid">
        <article class="card">
          <header class="card-head card-head-split"><h4>Option pricing</h4><small>${symbol}</small></header>
          <div class="calc-grid">
            ${calcInput("Spot", "option.spot", optionInput.spot)}
            ${calcInput("Strike", "option.strike", state.calculator.option.strike)}
            ${calcInput("Years", "option.years", state.calculator.option.years)}
            ${calcInput("Rate %", "option.rate", state.calculator.option.rate)}
            ${calcInput("Vol %", "option.volatility", state.calculator.option.volatility)}
          </div>
          <div class="calc-results">
            <p>Call: <strong>${tabularValue(option.call.toFixed(4))}</strong></p>
            <p>Put: <strong>${tabularValue(option.put.toFixed(4))}</strong></p>
            <p>Delta: <strong>${tabularValue(option.delta.toFixed(4))}</strong></p>
            <p>Gamma: <strong>${tabularValue(option.gamma.toFixed(6))}</strong></p>
          </div>
        </article>
        <article class="card">
          <header class="card-head"><h4>Bond pricing</h4></header>
          <div class="calc-grid">
            ${calcInput("Face", "bond.face", state.calculator.bond.face)}
            ${calcInput("Coupon %", "bond.coupon", state.calculator.bond.coupon)}
            ${calcInput("YTM %", "bond.ytm", state.calculator.bond.ytm)}
            ${calcInput("Maturity", "bond.maturity", state.calculator.bond.maturity)}
            ${calcInput("Frequency", "bond.frequency", state.calculator.bond.frequency)}
          </div>
          <div class="calc-results">
            <p>Price: <strong>${tabularValue(bond.price.toFixed(4))}</strong></p>
            <p>Duration: <strong>${tabularValue(bond.duration.toFixed(4))}</strong></p>
            <p>Mod duration: <strong>${tabularValue(bond.modifiedDuration.toFixed(4))}</strong></p>
            <p>Convexity: <strong>${tabularValue(bond.convexity.toFixed(4))}</strong></p>
          </div>
        </article>
      </section>
    `;
  };
}
````

## `src/Renderers/HeatmapRenderer.js`

````javascript
import { formatSignedPct, tabularValue } from "./Common.js";

export function createHeatmapRenderer(context) {
  const { heatmapGroups, buildQuote } = context;

  return function renderHeatmap(panel) {
    return `
      <section class="heatmap-grid">
        ${Object.entries(heatmapGroups)
          .map(
            ([sector, symbols]) => `
              <article class="card">
                <header class="card-head card-head-split"><h4>${sector}</h4><small>${symbols.length} names</small></header>
                <div class="tile-grid">
                  ${symbols
                    .map((symbol) => {
                      const quote = buildQuote(symbol);
                      const tone = (quote?.changePct || 0) >= 0 ? "positive" : "negative";
                      return `<button class="tile ${tone}" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}"><strong>${symbol}</strong><small>${quote ? tabularValue(formatSignedPct(quote.changePct)) : "--"}</small></button>`;
                    })
                    .join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </section>
    `;
  };
}
````

## `src/Renderers/HomeRenderer.js`

````javascript
import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

function buildCommandSuggestions({ authEnabled, state, buildQuote, panel }) {
  const symbol = state.panelSymbols[panel] || state.watchlist[0] || "AAPL";
  const suggestions = [];

  if (authEnabled && !state.user) {
    suggestions.push({ label: "Sign in and sync", detail: "Back up your workspace to the backend", command: "LOGIN" });
  } else if (authEnabled && state.user) {
    suggestions.push({ label: "Open account settings", detail: "Update profile, password, or account state", command: "SETTINGS" });
  } else {
    suggestions.push({ label: "Local workspace mode", detail: "Everything is running without login right now", command: "SAVE" });
  }

  suggestions.push({ label: "Open Meridian Briefing", detail: "See regime, breadth, and signal board", command: "BRIEF" });

  if (!state.alerts.length) {
    const threshold = Math.max(1, Math.round((buildQuote(symbol)?.price || 100) * 1.03));
    suggestions.push({ label: `Create ${symbol} alert`, detail: "Track a price level for this symbol", command: `ALERT ${symbol} ${threshold}` });
  } else {
    suggestions.push({ label: "Review positions and alerts", detail: "Check triggers and current exposure", command: "PORT" });
  }

  if (state.watchlist.length < 10) {
    suggestions.push({ label: "Broaden your watchlist", detail: "Add a benchmark like SPY", command: "WATCH SPY" });
  }

  suggestions.push({ label: "Show more suggestions", detail: "Refresh this panel with quick ideas", command: "SUGGEST" });
  return suggestions.slice(0, 5);
}

export function createHomeRenderer(context) {
  const { state, buildQuote, calculatePortfolioSummary, authEnabled } = context;

  return function renderHome(panel) {
    const portfolio = calculatePortfolioSummary();
    const top = state.watchlist.slice(0, 6).map(buildQuote).filter(Boolean);
    const recentCommands = state.commandHistory.slice(0, 5);
    const primarySymbol = state.panelSymbols[panel] || state.watchlist[0] || "AAPL";
    const suggestions = buildCommandSuggestions({ authEnabled, state, buildQuote, panel });

    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home">
          <article class="card stat-card glow-card">
            <span>Watchlist</span>
            <strong>${tabularValue(state.watchlist.length)}</strong>
            <small>${state.watchlist.slice(0, 4).join(" · ")}</small>
          </article>
          <article class="card stat-card glow-card">
            <span>Portfolio value</span>
            <strong>${tabularValue(formatPrice(portfolio.value, "USD"))}</strong>
            <small class="${portfolio.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${portfolio.pnl >= 0 ? "+" : ""}${formatPrice(portfolio.pnl, "USD")}`)}</small>
          </article>
          <article class="card stat-card glow-card">
            <span>Market phase</span>
            <strong>${state.marketPhase}</strong>
            <small>${state.health.ok ? state.health.server : "Live feed reconnecting"}</small>
          </article>
        </div>

        <article class="card card-feature">
          <header class="card-head card-head-split">
            <h4>Quick start</h4>
            <small>Open what you need in one click</small>
          </header>
          <div class="action-grid">
            <button class="action-tile" type="button" data-load-module="quote" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Quote</strong><span>Open ${primarySymbol} detail</span></button>
            <button class="action-tile" type="button" data-load-module="chart" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Chart</strong><span>See price action</span></button>
            <button class="action-tile" type="button" data-load-module="options" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Options</strong><span>Load nearest chain</span></button>
            <button class="action-tile" type="button" data-news-filter="${primarySymbol}"><strong>News</strong><span>Filter headlines for ${primarySymbol}</span></button>
          </div>
        </article>

        <article class="card">
          <header class="card-head card-head-split"><h4>Watchlist movers</h4><small>${top.length} active symbols</small></header>
          <div class="chip-grid">
            ${top
              .map(
                (quote) => `
                  <button class="chip" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">
                    <strong>${quote.symbol}</strong>
                    <span>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `quote:${quote.symbol}:price`, currentPrice: quote.price })}</span>
                    <small class="${quote.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct))}</small>
                  </button>
                `,
              )
              .join("")}
          </div>
        </article>

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split"><h4>Recent commands</h4><small>Use again</small></header>
            <div class="stack-list compact-list">
              ${recentCommands.length ? recentCommands.map((item) => `<button class="list-row" type="button" data-autocomplete="${item}"><strong>${item}</strong><small>Run again</small></button>`).join("") : `<div class="empty-inline">Commands you run will show up here.</div>`}
            </div>
          </article>
          <article class="card">
            <header class="card-head card-head-split"><h4>Live pulse</h4><small>${state.marketPhase}</small></header>
            <div class="pulse-grid">
              ${state.overviewQuotes.length
                ? state.overviewQuotes
                    .slice(0, 4)
                    .map((quote) => `<div class="pulse-card is-live"><span>${quote.symbol}</span><strong>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `overview:${quote.symbol}:price`, currentPrice: quote.price })}</strong><small class="${Number(quote.changePct || 0) >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct || 0))}</small></div>`)
                    .join("")
                : `<div class="pulse-card">${loadingSkeleton(3)}</div>`}
            </div>
          </article>
        </div>

        <article class="card">
          <header class="card-head card-head-split"><h4>Suggested next steps</h4><small>Picked from your current view</small></header>
          <div class="stack-list compact-list">
            ${suggestions.map((item) => `<button class="list-row" type="button" data-suggest-command="${item.command}"><strong>${item.label}</strong><small>${item.detail}</small></button>`).join("")}
          </div>
        </article>
      </section>
    `;
  };
}
````

## `src/Renderers/MacroRenderer.js`

````javascript
import { loadingSkeleton, tabularValue } from "./Common.js";

export function createMacroRenderer(context) {
  const { state, macroDefaults } = context;

  return function renderMacro() {
    const fxCards = macroDefaults.currencies
      .map((currency) => ({ currency, rate: state.fxRates[currency] }))
      .filter((item) => item.rate)
      .map(
        (item) => `<article class="card fx-card"><span>USD/${item.currency}</span><strong>${tabularValue(Number(item.rate).toFixed(4), { flashKey: `fx:${item.currency}`, currentPrice: item.rate })}</strong></article>`,
      )
      .join("");

    return `
      <section class="stack stack-lg">
        <div class="toolbar">
          <button class="btn btn-primary" type="button" data-refresh-all>Refresh macro</button>
        </div>
        <div class="card-grid card-grid-home">
          <article class="card stat-card"><span>Market phase</span><strong>${state.marketPhase}</strong><small>New York session</small></article>
          <article class="card stat-card"><span>Server</span><strong>${state.health.ok ? "Live" : "Offline"}</strong><small>${state.health.server}</small></article>
          <article class="card stat-card"><span>FX crosses</span><strong>${tabularValue(Object.keys(state.fxRates).length)}</strong><small>USD base pairs</small></article>
        </div>
        <article class="card">
          <header class="card-head"><h4>Yield curve</h4></header>
          <div class="curve-grid">
            ${macroDefaults.curve.map((point) => `<div class="curve-col"><div class="curve-bar" style="height:${point.yield * 18}px"></div><strong>${tabularValue(`${point.yield.toFixed(2)}%`)}</strong><small>${point.tenor}</small></div>`).join("")}
          </div>
        </article>
        <article class="card">
          <header class="card-head"><h4>FX rates</h4></header>
          <div class="fx-grid">${fxCards || loadingSkeleton(4)}</div>
        </article>
      </section>
    `;
  };
}
````

## `src/Renderers/NewsRenderer.js`

````javascript
import { loadingSkeleton } from "./Common.js";

function sentimentClassForHeadline(headline) {
  const content = String(headline || "").toUpperCase();
  const positiveTerms = ["BULLISH", "GROWTH", "SURGE"];
  const negativeTerms = ["DROP", "MISS", "RISK"];

  if (positiveTerms.some((term) => content.includes(term))) return "news-title-positive";
  if (negativeTerms.some((term) => content.includes(term))) return "news-title-negative";
  return "";
}

export function createNewsRenderer(context) {
  const { state, getRenderableNewsItems, extractHeadlineSymbol, emptyState } = context;

  return function renderNews(panel) {
    const quickFilters = ["ALL", ...new Set([state.panelSymbols[panel], ...Object.values(state.panelSymbols), ...state.watchlist.slice(0, 3)].filter(Boolean))].slice(0, 6);
    const items = getRenderableNewsItems(state.newsFilter);

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          <button class="btn btn-primary" type="button" data-refresh-all>Refresh feed</button>
          ${quickFilters.map((item) => `<button class="range-pill ${item === state.newsFilter ? "is-active" : ""}" type="button" data-news-filter="${item}">${item}</button>`).join("")}
        </div>
        ${items.length
          ? items
              .slice(0, 16)
              .map((item) => {
                const relatedSymbol = extractHeadlineSymbol(item.headline);
                const titleSentimentClass = sentimentClassForHeadline(item.headline);
                return `
                  <article class="news-item">
                    <div class="news-meta">
                      <span class="news-source">${item.source}</span>
                      <span class="news-time">${item.time}</span>
                      <span class="news-sentiment ${String(item.sentiment || "Neutral").toLowerCase()}">${item.sentiment || "Neutral"}</span>
                    </div>
                    <div class="news-row">
                      <a href="${item.link}" target="_blank" rel="noopener" class="news-title ${titleSentimentClass}">${item.headline}</a>
                      ${relatedSymbol ? `<button class="mini-link" type="button" data-load-module="quote" data-target-symbol="${relatedSymbol}" data-target-panel="${panel}">${relatedSymbol}</button>` : ""}
                    </div>
                  </article>
                `;
              })
              .join("")
          : state.newsItems.length
            ? emptyState(`No headlines matched ${state.newsFilter}.`)
            : `<article class="card">${loadingSkeleton(5)}</article>`}
      </section>
    `;
  };
}
````

## `src/Renderers/OptionsRenderer.js`

````javascript
import { formatExpiry, formatPrice, loadingSkeleton, tabularValue } from "./Common.js";

function renderOptionsTable(contracts) {
  if (!contracts.length) return loadingSkeleton(6);
  return `
    <table class="data-table compact financial-data-table">
      <thead><tr><th>Strike</th><th>Bid</th><th>Ask</th><th>Last</th><th>OI</th></tr></thead>
      <tbody>
        ${contracts
          .slice(0, 12)
          .map(
            (contract) => `
              <tr>
                <td>${tabularValue(contract.strike?.fmt || contract.strike || "--")}</td>
                <td>${tabularValue(contract.bid?.fmt || contract.bid || "--")}</td>
                <td>${tabularValue(contract.ask?.fmt || contract.ask || "--")}</td>
                <td>${tabularValue(contract.lastPrice?.fmt || contract.lastPrice || "--")}</td>
                <td>${tabularValue(contract.openInterest?.fmt || contract.openInterest || "--")}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function createOptionsRenderer(context) {
  const { state, optionsKey } = context;

  return function renderOptions(panel) {
    const symbol = state.panelSymbols[panel] || state.optionsSelection.symbol;
    const expiration = state.optionsSelection.expiration || "nearest";
    const chain = state.optionsCache.get(optionsKey(symbol, expiration)) || state.optionsCache.get(optionsKey(symbol, "nearest"));
    const expirations = chain?.expirations || [];

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          <button class="btn btn-ghost" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}">Quote</button>
          <button class="btn btn-ghost" type="button" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">Chart</button>
          <select data-options-expiry="${panel}">
            <option value="">Nearest expiry</option>
            ${expirations.slice(0, 8).map((value) => `<option value="${value}" ${String(value) === String(state.optionsSelection.expiration || "") ? "selected" : ""}>${formatExpiry(value)}</option>`).join("")}
          </select>
          <button class="btn btn-primary" type="button" data-refresh-options="${panel}:${symbol}">Refresh options</button>
        </div>
        <div class="card-grid card-grid-home">
          <article class="card stat-card"><span>Underlying</span><strong>${symbol}</strong><small>${chain?.spot ? tabularValue(formatPrice(chain.spot, symbol), { flashKey: `quote:${symbol}:price`, currentPrice: chain.spot }) : "Waiting for chain"}</small></article>
          <article class="card stat-card"><span>Calls</span><strong>${tabularValue(chain?.calls?.length || 0)}</strong><small>Loaded contracts</small></article>
          <article class="card stat-card"><span>Puts</span><strong>${tabularValue(chain?.puts?.length || 0)}</strong><small>Loaded contracts</small></article>
        </div>
        <div class="split-grid">
          <article class="card">
            <header class="card-head"><h4>Calls</h4></header>
            ${renderOptionsTable(chain?.calls || [])}
          </article>
          <article class="card">
            <header class="card-head"><h4>Puts</h4></header>
            ${renderOptionsTable(chain?.puts || [])}
          </article>
        </div>
      </section>
    `;
  };
}
````

## `src/Renderers/PortfolioRenderer.js`

````javascript
import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

export function createPortfolioRenderer(context) {
  const { enrichPositions, calculatePortfolioSummary } = context;

  return function renderPortfolio(panel) {
    const rows = enrichPositions();
    const totals = calculatePortfolioSummary();
    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home">
          <article class="card stat-card"><span>Value</span><strong>${tabularValue(formatPrice(totals.value, "USD"))}</strong></article>
          <article class="card stat-card"><span>P/L</span><strong class="${totals.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${totals.pnl >= 0 ? "+" : ""}${formatPrice(totals.pnl, "USD")}`)}</strong></article>
          <article class="card stat-card"><span>Return</span><strong class="${totals.pnlPct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(totals.pnlPct))}</strong></article>
        </div>
        <form id="addPositionForm" class="add-pos-form">
          <input name="symbol" placeholder="Ticker" required />
          <input name="shares" type="number" step="0.01" placeholder="Shares" required />
          <input name="cost" type="number" step="0.01" placeholder="Cost" required />
          <button class="btn btn-primary" type="submit">Add position</button>
        </form>
        ${rows.length ? `
          <table class="data-table data-table-dense financial-data-table">
            <thead><tr><th>Ticker</th><th>Shares</th><th>Cost</th><th>Mark</th><th>Value</th><th>P/L</th><th></th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                    <tr>
                      <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${panel}">${row.symbol}</button></td>
                      <td>${tabularValue(row.shares)}</td>
                      <td>${tabularValue(formatPrice(row.cost, row.symbol))}</td>
                      <td>${tabularValue(formatPrice(row.price, row.symbol), { flashKey: `quote:${row.symbol}:price`, currentPrice: row.price })}</td>
                      <td>${tabularValue(formatPrice(row.value, "USD"))}</td>
                      <td class="${row.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}`)}</td>
                      <td class="row-actions">
                        <button class="btn btn-ghost btn-inline" type="button" data-load-module="options" data-target-symbol="${row.symbol}" data-target-panel="${panel}">Options</button>
                        <button class="btn btn-ghost btn-inline" type="button" data-create-alert="${row.symbol}:>=:${(row.price * 1.04).toFixed(2)}">Alert</button>
                        <button class="btn btn-ghost btn-inline" type="button" data-remove-position="${row.symbol}">Remove</button>
                      </td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>` : `<article class="card">${loadingSkeleton(4)}</article>`}
      </section>
    `;
  };
}
````

## `src/Renderers/QuoteRenderer.js`

````javascript
import {
  emptyState,
  formatInsightValue,
  formatMarketCap,
  formatPrice,
  formatSignedPct,
  formatVolume,
  loadingSkeleton,
  tabularValue,
} from "./Common.js";

export function createQuoteRenderer(context) {
  const { state, buildQuote, findRelatedSymbols } = context;

  return function renderQuote(panel) {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const quote = buildQuote(symbol);
    if (!quote) {
      if (!state.health?.ok) {
        return `<section class="stack stack-lg">${emptyState(`Offline: ${symbol} quote feed unavailable. Try SYNC ${symbol} once connection resumes.`)}</section>`;
      }
      return `<section class="stack">${loadingSkeleton(5)}</section>`;
    }

    const alertThreshold = Math.max(1, quote.price * 1.03);
    const peers = findRelatedSymbols(symbol).slice(0, 4);
    const deepDive = state.deepDiveCache.get(symbol);
    const profile = deepDive?.profile || {};
    const financials = deepDive?.financials || {};
    const isAnalyzing = state.deepDiveLoading.has(symbol);

    return `
      <section class="stack stack-lg">
        <div class="quote-action-row">
          <button class="btn btn-primary" type="button" data-analyze-symbol="${symbol}">[ ANALYZE ]</button>
          <button class="btn btn-ghost" type="button" data-open-news-symbol="${symbol}">[ NEWS ]</button>
          <button class="btn btn-ghost" type="button" data-sync-symbol="${symbol}">[ SYNC ]</button>
        </div>

        <div class="toolbar">
          <button class="btn btn-ghost" type="button" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">Open chart</button>
          <button class="btn btn-ghost" type="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Open options</button>
          <button class="btn btn-ghost" type="button" data-news-filter="${symbol}">Related news</button>
          <button class="btn btn-ghost" type="button" data-watch-symbol="${symbol}">Add to watchlist</button>
          <button class="btn btn-primary" type="button" data-create-alert="${symbol}:>=:${alertThreshold.toFixed(2)}">Set 3% alert</button>
        </div>

        <article class="card quote-card quote-card-feature">
          <div class="quote-hero">
            <div>
              <span class="eyebrow">${quote.exchange}</span>
              <h4>${quote.name}</h4>
              <div class="quote-row">
                <strong>${tabularValue(formatPrice(quote.price, symbol), { flashKey: `quote:${symbol}:price`, currentPrice: quote.price })}</strong>
                <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct))}</span>
              </div>
              <p>${quote.sector} · ${quote.universe}</p>
            </div>
            <div class="quote-meta-grid">
              <div><span>Volume</span><strong>${tabularValue(formatVolume(quote.volume))}</strong></div>
              <div><span>Market cap</span><strong>${tabularValue(formatMarketCap(quote.marketCap))}</strong></div>
              <div><span>High</span><strong>${tabularValue(formatPrice(quote.dayHigh, symbol))}</strong></div>
              <div><span>Low</span><strong>${tabularValue(formatPrice(quote.dayLow, symbol))}</strong></div>
            </div>
          </div>
        </article>

        <table class="data-table financial-data-table">
          <tbody>
            <tr><td>Previous close</td><td>${tabularValue(formatPrice(quote.previousClose, symbol))}</td><td>Day high</td><td>${tabularValue(formatPrice(quote.dayHigh, symbol))}</td></tr>
            <tr><td>Day low</td><td>${tabularValue(formatPrice(quote.dayLow, symbol))}</td><td>Volume</td><td>${tabularValue(formatVolume(quote.volume))}</td></tr>
            <tr><td>Market cap</td><td>${tabularValue(formatMarketCap(quote.marketCap))}</td><td>Change</td><td class="${quote.change >= 0 ? "positive" : "negative"}">${tabularValue(`${quote.change >= 0 ? "+" : ""}${Number(quote.change).toFixed(2)}`)}</td></tr>
          </tbody>
        </table>

        <article class="card">
          <header class="card-head card-head-split"><h4>Deep insight</h4><small>${deepDive?.provider === "rapidapi" ? "live modules" : "provisioned research"}</small></header>
          ${isAnalyzing
            ? loadingSkeleton(4)
            : deepDive
              ? `
                <div class="deep-dive-grid">
                  <div class="insight-block"><span>Sector</span><strong>${profile.sector || quote.sector}</strong></div>
                  <div class="insight-block"><span>Industry</span><strong>${profile.industry || "N/A"}</strong></div>
                  <div class="insight-block"><span>Target mean</span><strong>${tabularValue(formatInsightValue(financials.targetMeanPrice))}</strong></div>
                  <div class="insight-block"><span>Recommendation</span><strong>${formatInsightValue(financials.recommendationKey)}</strong></div>
                  <div class="insight-block"><span>Total revenue</span><strong>${tabularValue(formatInsightValue(financials.totalRevenue))}</strong></div>
                  <div class="insight-block"><span>Free cash flow</span><strong>${tabularValue(formatInsightValue(financials.freeCashflow))}</strong></div>
                </div>
                <p class="insight-summary">${profile.longBusinessSummary || profile.longBusinessDescription || deepDive.reason || "Run analyze to load deeper company context."}</p>
              `
              : `<div class="empty-inline">Run ANALYZE to pull profile, financials, and ticker-specific news.</div>`}
        </article>

        <article class="card">
          <header class="card-head card-head-split"><h4>Similar names</h4><small>${quote.sector}</small></header>
          <div class="chip-grid compact-chip-grid">
            ${peers.map((peer) => `<button class="chip chip-peer" type="button" data-load-module="quote" data-target-symbol="${peer.symbol}" data-target-panel="${panel}"><strong>${peer.symbol}</strong><span>${tabularValue(formatPrice(peer.price, peer.symbol), { flashKey: `quote:${peer.symbol}:price`, currentPrice: peer.price })}</span><small class="${peer.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(peer.changePct))}</small></button>`).join("") || `<div class="empty-inline">No comparable names found yet.</div>`}
          </div>
        </article>
      </section>
    `;
  };
}
````

## `src/Renderers/RulesRenderer.js`

````javascript
import { tabularValue } from "./Common.js";

export function createRulesRenderer(context) {
  const { state } = context;

  const formatSystemTime = (value) =>
    new Date(value || Date.now()).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

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
          ${history.length
            ? `
              <div class="system-log">
                ${history
                  .map((item) => {
                    const time = formatSystemTime(item.triggeredAt);
                    const symbol = String(item.symbol || "--").toUpperCase();
                    const condition = `${item.op || ""} ${item.limit ?? ""}`.trim();
                    const message = item.msg || "Condition Met";
                    const price = item.price != null ? ` @ ${Number(item.price).toFixed(2)}` : "";
                    const suffix = [condition, message].filter(Boolean).join(" · ");
                    return `<div class="system-log-entry"><span class="system-log-line">[${time}] ${symbol} ${suffix}${price}</span></div>`;
                  })
                  .join("")}
              </div>
            `
            : `<div class="empty-state">No triggers yet. Fired rules will appear here in real-time.</div>`}
        </article>
      </section>
    `;
  };
}
````

## `src/Renderers/ScreenerRenderer.js`

````javascript
import { formatPrice, formatSignedPct, tabularValue } from "./Common.js";

function filterUniverse(universe, filters) {
  return universe.filter((item) => {
    if (filters.universe && item.universe !== filters.universe) return false;
    if (filters.sector && item.sector !== filters.sector) return false;
    if (filters.search) {
      const query = filters.search.toLowerCase();
      return item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    }
    return true;
  });
}

export function createScreenerRenderer(context) {
  const { state, universe, buildQuote } = context;

  return function renderScreener(panel) {
    const filters = state.screenerFilters[panel];
    const sectors = [...new Set(universe.map((item) => item.sector))].sort();
    const universes = [...new Set(universe.map((item) => item.universe))].sort();
    const results = filterUniverse(universe, filters).slice(0, 80);

    return `
      <section class="stack stack-lg">
        <div class="screener-filters">
          <select data-screener-universe="${panel}">
            <option value="">All universes</option>
            ${universes.map((value) => `<option value="${value}" ${value === filters.universe ? "selected" : ""}>${value}</option>`).join("")}
          </select>
          <select data-screener-sector="${panel}">
            <option value="">All sectors</option>
            ${sectors.map((value) => `<option value="${value}" ${value === filters.sector ? "selected" : ""}>${value}</option>`).join("")}
          </select>
          <input data-screener-search="${panel}" value="${filters.search}" placeholder="Search by symbol or name" />
        </div>
        <table class="data-table data-table-dense financial-data-table">
          <thead><tr><th>Ticker</th><th>Name</th><th>Sector</th><th>Universe</th><th>Price</th><th>Change</th><th></th></tr></thead>
          <tbody>
            ${results
              .map((item) => {
                const quote = buildQuote(item.symbol);
                const price = quote?.price || item.seedPrice || 0;
                return `
                  <tr>
                    <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${item.symbol}" data-target-panel="${panel}">${item.symbol}</button></td>
                    <td>${item.name}</td>
                    <td>${item.sector}</td>
                    <td>${item.universe}</td>
                    <td>${tabularValue(formatPrice(price, item.symbol), { flashKey: `quote:${item.symbol}:price`, currentPrice: price })}</td>
                    <td class="${(quote?.changePct || 0) >= 0 ? "positive" : "negative"}">${quote ? tabularValue(formatSignedPct(quote.changePct)) : "--"}</td>
                    <td><button class="btn btn-ghost btn-inline" type="button" data-load-module="chart" data-target-symbol="${item.symbol}" data-target-panel="${panel}">Chart</button></td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </section>
    `;
  };
}
````

## `src/StateStore.js`

````javascript
const STATE_UPDATED = "STATE_UPDATED";

function isObjectLike(value) {
  return value !== null && typeof value === "object";
}

function clonePath(path, key) {
  return [...path, String(key)];
}

export function createStateStore(initialState = {}) {
  const eventTarget = new EventTarget();
  const proxyCache = new WeakMap();
  let lastMutation = null;

  const emit = (detail) => {
    lastMutation = detail;
    const event = new CustomEvent(STATE_UPDATED, { detail });
    eventTarget.dispatchEvent(event);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent(STATE_UPDATED, { detail }));
    }
  };

  const wrapCollection = (target, path) => {
    if (proxyCache.has(target)) return proxyCache.get(target);

    const proxy = new Proxy(target, {
      get(collection, property, receiver) {
        const value = Reflect.get(collection, property, receiver);

        if (collection instanceof Map && ["set", "delete", "clear"].includes(property)) {
          return (...args) => {
            const key = args[0];
            const previousValue = property === "set" || property === "delete" ? collection.get(key) : undefined;
            const result = Map.prototype[property].apply(collection, args);
            const nextValue = property === "set" ? collection.get(key) : undefined;
            emit({
              path: property === "clear" ? path : clonePath(path, key),
              property,
              key,
              value: nextValue,
              previousValue,
              oldState: previousValue,
              newState: nextValue,
              target: collection,
            });
            return result;
          };
        }

        if (collection instanceof Set && ["add", "delete", "clear"].includes(property)) {
          return (...args) => {
            const beforeSize = collection.size;
            const result = Set.prototype[property].apply(collection, args);
            emit({ path, property, value: args[0], previousValue: beforeSize, target: collection });
            return result;
          };
        }

        if (collection instanceof Map && property === "get") {
          return (key) => {
            const result = Map.prototype.get.call(collection, key);
            return isObjectLike(result) ? createReactive(result, clonePath(path, key)) : result;
          };
        }

        return isObjectLike(value) ? createReactive(value, clonePath(path, property)) : value;
      },
    });

    proxyCache.set(target, proxy);
    return proxy;
  };

  const createReactive = (target, path = []) => {
    if (!isObjectLike(target)) return target;
    if (target instanceof Map || target instanceof Set) {
      return wrapCollection(target, path);
    }
    if (proxyCache.has(target)) return proxyCache.get(target);

    const proxy = new Proxy(target, {
      get(currentTarget, property, receiver) {
        const value = Reflect.get(currentTarget, property, receiver);
        return isObjectLike(value) ? createReactive(value, clonePath(path, property)) : value;
      },
      set(currentTarget, property, value, receiver) {
        const previousValue = currentTarget[property];
        const nextValue = isObjectLike(value) ? createReactive(value, clonePath(path, property)) : value;
        const didSet = Reflect.set(currentTarget, property, nextValue, receiver);
        if (didSet && previousValue !== value) {
          emit({
            path: clonePath(path, property),
            property,
            value,
            previousValue,
            oldState: previousValue,
            newState: value,
            target: currentTarget,
          });
        }
        return didSet;
      },
      deleteProperty(currentTarget, property) {
        const previousValue = currentTarget[property];
        const didDelete = Reflect.deleteProperty(currentTarget, property);
        if (didDelete) {
          emit({
            path: clonePath(path, property),
            property,
            value: undefined,
            previousValue,
            oldState: previousValue,
            newState: undefined,
            target: currentTarget,
          });
        }
        return didDelete;
      },
    });

    proxyCache.set(target, proxy);
    return proxy;
  };

  const state = createReactive(
    structuredClone({
      activeRules: [],
      notifications: [],
      ...initialState,
    }),
  );

  return {
    STATE_UPDATED,
    state,
    subscribe(listener) {
      eventTarget.addEventListener(STATE_UPDATED, listener);
      return () => eventTarget.removeEventListener(STATE_UPDATED, listener);
    },
    getLastMutation() {
      return lastMutation;
    },
    dispatch(detail) {
      emit(detail);
    },
  };
}

export { STATE_UPDATED };
````

## `src/services.js`

````javascript
const DIRECT_TIMEOUT = 12000;
const PROXY_GET = "https://api.allorigins.win/get?url=";
const PROXY_RAW = "https://api.allorigins.win/raw?url=";
const QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=";
const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const OPTIONS_URL = "https://query1.finance.yahoo.com/v7/finance/options/";
const RSS_TO_JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
const FX_URL = "https://open.er-api.com/v6/latest/USD";

function withTimeout(promise, timeout = DIRECT_TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out.")), timeout)),
  ]);
}

async function fetchText(url) {
  const strategies = [
    () => fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Direct fetch failed: ${response.status}`);
      return response.text();
    }),
    () => fetch(`${PROXY_RAW}${encodeURIComponent(url)}`).then((response) => {
      if (!response.ok) throw new Error(`Raw proxy failed: ${response.status}`);
      return response.text();
    }),
    () => fetch(`${PROXY_GET}${encodeURIComponent(url)}`).then(async (response) => {
      if (!response.ok) throw new Error(`Wrapped proxy failed: ${response.status}`);
      const payload = await response.json();
      if (!payload.contents) throw new Error("Wrapped proxy had no contents.");
      return payload.contents;
    }),
  ];

  let lastError = null;
  for (const strategy of strategies) {
    try {
      return await withTimeout(strategy());
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Unable to fetch remote data.");
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

export async function fetchQuotes(symbols) {
  const clean = [...new Set(symbols.filter(Boolean))];
  if (!clean.length) {
    return [];
  }

  const payload = await fetchJson(`${QUOTE_URL}${encodeURIComponent(clean.join(","))}`);
  const results = payload?.quoteResponse?.result ?? [];
  return results.map((item) => ({
    symbol: item.symbol,
    name: item.shortName ?? item.longName ?? item.symbol,
    exchange: item.fullExchangeName ?? item.exchange ?? "N/A",
    price: item.regularMarketPrice ?? item.postMarketPrice ?? item.bid ?? 0,
    changePct: item.regularMarketChangePercent ?? 0,
    change: item.regularMarketChange ?? 0,
    marketCap: item.marketCap ?? 0,
    volume: item.regularMarketVolume ?? 0,
    dayHigh: item.regularMarketDayHigh ?? item.regularMarketPrice ?? 0,
    dayLow: item.regularMarketDayLow ?? item.regularMarketPrice ?? 0,
    previousClose: item.regularMarketPreviousClose ?? item.regularMarketPrice ?? 0,
    currency: item.currency ?? "USD",
  }));
}

export async function fetchChart(symbol, range = "1mo", interval = "1d") {
  const payload = await fetchJson(`${CHART_URL}${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false`);
  const result = payload?.chart?.result?.[0];
  if (!result) {
    return [];
  }

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const closes = quote.close ?? [];

  return timestamps
    .map((timestamp, index) => ({
      timestamp,
      close: closes[index],
    }))
    .filter((item) => item.close != null);
}

export async function fetchOptions(symbol, expirationDate) {
  const suffix = expirationDate ? `?date=${encodeURIComponent(expirationDate)}` : "";
  const payload = await fetchJson(`${OPTIONS_URL}${encodeURIComponent(symbol)}${suffix}`);
  const result = payload?.optionChain?.result?.[0];
  if (!result) {
    return { expirations: [], calls: [], puts: [], spot: 0 };
  }

  const optionSet = result.options?.[0] ?? { calls: [], puts: [] };
  return {
    expirations: result.expirationDates ?? [],
    calls: (optionSet.calls ?? []).slice(0, 18),
    puts: (optionSet.puts ?? []).slice(0, 18),
    spot: result.quote?.regularMarketPrice ?? 0,
  };
}

export async function fetchNews() {
  const feeds = [
    "https://feeds.reuters.com/reuters/businessNews",
    "https://finance.yahoo.com/news/rssindex",
    "https://feeds.marketwatch.com/marketwatch/topstories/",
  ];

  const requests = feeds.map(async (feedUrl) => {
    try {
      const payload = await fetchJson(`${RSS_TO_JSON}${encodeURIComponent(feedUrl)}`);
      const items = payload.items ?? [];
      return items.slice(0, 6).map((item) => ({
        source: payload.feed?.title ?? "Feed",
        headline: item.title ?? "Untitled",
        time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
        link: item.link ?? "#",
      }));
    } catch {
      return [];
    }
  });

  const results = (await Promise.all(requests)).flat();
  return results.slice(0, 18);
}

export async function fetchFxRates() {
  const payload = await fetchJson(FX_URL);
  return payload?.rates ?? {};
}
````

## `src/marketService.js`

````javascript
import { apiRequest } from "./api.js";

export async function getStockDeepDive(ticker) {
  const symbol = String(ticker || "").trim().toUpperCase();
  if (!symbol) return null;

  try {
    return await apiRequest(`/api/market/deep-dive/${encodeURIComponent(symbol)}`);
  } catch (error) {
    console.error("Deep Dive Failed:", error);
    return null;
  }
}
````
