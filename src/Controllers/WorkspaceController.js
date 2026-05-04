export function normalizePanelMap(source, fallback) {
  const next = { ...fallback };
  if (!source || typeof source !== "object") return next;
  Object.entries(source).forEach(([key, value]) => {
    next[Number(key)] = value;
  });
  return next;
}

const LIVE_DEFAULT_RULES = [
  { symbol: "NVDA", op: ">", limit: 130, msg: "NVIDIA Price Target Hit" },
  { symbol: "AAPL", op: "<", limit: 185, msg: "Apple Value Zone" },
  { symbol: "BTC-USD", op: ">", limit: 90000, msg: "Crypto Breakout" },
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

// Cap notification history to prevent the synced payload from growing unbounded.
const MAX_SYNCED_NOTIFICATIONS = 50;

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
    this._saveTimer = null;
    this._retryCount = 0;
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
      // Cap to most recent N notifications to keep payload lean
      notifications: (this.state.notifications || []).slice(0, MAX_SYNCED_NOTIFICATIONS),
    };
  }

  async saveWorkspace() {
    if (!this.state.user) {
      this._writeGuestCache();
      return;
    }

    this.setNetworkStatus("Live · Saving");
    try {
      await this.workspaceApi.save(this.serializeWorkspace());
      this._retryCount = 0;
      this.setNetworkStatus("Live · Saved");
    } catch {
      this._scheduleRetry();
    }
  }

  queueSave() {
    if (!this.state.user) {
      this._writeGuestCache();
      return;
    }

    this.setNetworkStatus("Live · Saving");
    window.clearTimeout(this._saveTimer);
    this._saveTimer = window.setTimeout(() => this.saveWorkspace(), 350);
  }

  _writeGuestCache() {
    this.uiCache.write({
      ...this.uiCache.read(),
      guestWorkspace: this.serializeWorkspace(),
    });
  }

  _scheduleRetry() {
    this._retryCount = (this._retryCount || 0) + 1;
    // Exponential back-off capped at 30s: 2s, 4s, 8s, 16s, 30s, 30s, …
    const delay = Math.min(2000 * Math.pow(2, this._retryCount - 1), 30_000);
    this.setNetworkStatus("Live · Retry");
    window.clearTimeout(this._saveTimer);
    this._saveTimer = window.setTimeout(() => this.saveWorkspace(), delay);
  }

  syncUiCache() {
    this.uiCache.write({
      ...this.uiCache.read(),
      activePanel: this.state.activePanel,
      focusedPanel: this.state.focusedPanel,
      autoJumpToPanel: this.state.autoJumpToPanel,
      chartRanges: this.state.chartRanges,
      chartReplayIndex: this.state.chartReplayIndex,
      chartReplayIsPlaying: this.state.chartReplayIsPlaying,
      newsFilter: this.state.newsFilter,
      compactMode: this.state.compactMode,
      theme: this.state.theme,
      rulesActiveTab: this.state.rulesActiveTab,
      watchlistSortMode: this.state.watchlistSortMode,
    });
  }

  hydrateSession(user, workspace = {}, subscription = null) {
    this.state.user = user;
    this.state.subscription = subscription || { tier: "free", status: null };
    this.state.watchlist = [...(workspace.watchlist || this.defaults.watchlist)];
    this.state.alerts = structuredClone(workspace.alerts || this.defaults.alerts);
    this.state.positions = structuredClone(workspace.positions || this.defaults.positions);
    this.state.panelModules = normalizePanelModules(workspace.panelModules, this.defaults.panelModules, this.moduleTitles);
    this.state.panelSymbols = normalizePanelMap(workspace.panelSymbols, this.defaults.panelSymbols);
    this.state.commandHistory = [...(workspace.commandHistory || [])];
    this.state.activeRules = structuredClone(seedLiveRules(workspace.activeRules));
    // Restore saved notifications; fall back to seeds only when none exist at all.
    const savedNotifications = Array.isArray(workspace.notifications) ? workspace.notifications.filter(Boolean) : [];
    this.state.notifications = structuredClone(
      savedNotifications.length
        ? savedNotifications
        : seedLiveNotifications([], this.state.activeRules),
    );
    this._retryCount = 0;
    this.state.sessionStartedAt = Date.now();

    this.updateAuthControls?.();
    this.setNetworkStatus("Live · Saved");
    this.onSessionHydrated?.({ user, workspace });
  }

  async initializeSession(healthOk = false) {
    if (!this.authEnabled) return;
    try {
      const payload = await this.authApi.session();
      this.hydrateSession(payload.user, payload.workspace, payload.subscription);
    } catch {
      this.setNetworkStatus(healthOk ? "Guest · Live" : "Guest · Local");
    }
  }
}
