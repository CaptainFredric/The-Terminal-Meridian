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
