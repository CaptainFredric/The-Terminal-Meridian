import {
  appName,
  authRoles,
  buildUniverse,
  calculatorDefaults,
  commandCatalog,
  defaultAlerts,
  defaultPositions,
  defaultWatchlist,
  functionKeys,
  heatmapGroups,
  macroDefaults,
  moduleOrder,
  moduleTitles,
} from "./data.js";
import { AppCore } from "./AppCore.js";
import { lexCommand } from "./CommandLexer.js";
import { CommandController } from "./Controllers/CommandController.js";
import { DockingController } from "./Controllers/DockingController.js";
import {
  WorkspaceController,
  normalizePanelMap,
  normalizePanelModules,
  seedLiveNotifications,
  seedLiveRules,
} from "./Controllers/WorkspaceController.js";
import { observeChartResize } from "./Renderers/ChartRenderer.js";
import { SCREENER_PRESETS, filterUniverse, sortUniverse } from "./Renderers/ScreenerRenderer.js";
import { LogicEngine } from "./LogicEngine.js";
import { createDefaultModuleRegistry } from "./Registry.js";
import { applyPriceTone, emptyState, formatPrice, formatSignedPct, tabularValue } from "./Renderers/Common.js";
import { createStateStore } from "./StateStore.js";
import { aiApi, authApi, billingApi, marketApi, paperApi, uiCache, workspaceApi } from "./api.js";
import { ActionEngine } from "./ActionEngine.js";
import { getStockDeepDive } from "./marketService.js";
import { fetchQuotes, fetchChart, fetchOptions, fetchNews, fetchFxRates } from "./services.js";
import { NotificationManager } from "./NotificationManager.js";

const DEFAULT_OVERVIEW_SYMBOLS = ["SPY", "QQQ", "NVDA", "TLT", "BTC-USD", "AAPL"];
const MERIDIAN_STATE_KEY = "meridian_state";

// ── Data cache (TTL-based, reduces API calls to Render) ──────────────────────────
// Overview + quote data is lightweight and safe to serve stale (30s) during
// the 5s refresh tick. Without this, every tick hits the backend even if
// nothing changed. Cache misses are rare; cache hits save 80% of API traffic.
const _dataCache = {
  overview: { data: null, ts: 0, ttl: 30_000 },  // 30s TTL
  quotes: { data: null, ts: 0, ttl: 30_000 },
};

function _getCached(key) {
  const entry = _dataCache[key];
  if (!entry) return null;
  const now = Date.now();
  if (now - entry.ts < entry.ttl) {
    return entry.data;
  }
  return null;
}

function _setCached(key, data) {
  const entry = _dataCache[key];
  if (entry) {
    entry.data = data;
    entry.ts = Date.now();
  }
}

// ── Free tier limits ───────────────────────────────────────────────────────────
// Pro users (state.user?.tier === "pro") bypass all limits.
const FREE_WATCHLIST_LIMIT = 10;
const FREE_ALERT_LIMIT = 3;
const FREE_RULES_LIMIT = 5;

function isProUser() {
  // Active paid subscriber? Check explicitly so we honour the gate as soon
  // as Stripe is wired up. Until billing is live for an account, signed-in
  // users still get Pro behaviour as a "soft launch" preview.
  const tier = state.subscription?.tier;
  const status = state.subscription?.status;
  if ((tier === "pro" || tier === "pro_plus") && status !== "canceled" && status !== "unpaid") {
    return true;
  }
  return Boolean(state.user);
}

function checkFreeTierLimit(count, limit, label) {
  if (isProUser()) return false; // no limit for pro/authed users
  if (count < limit) return false;
  openPricingModal();
  showToast(`Free tier: up to ${limit} ${label}. Upgrade to Pro for unlimited.`, "warning");
  return true; // blocked
}

// Returns "X / LIMIT" for free users (with CSS class hint), "X" for Pro.
function formatTierUsage(count, limit) {
  if (isProUser()) return String(count);
  return `${count} / ${limit}`;
}

// Returns CSS class for usage badge: "" | "tier-warn" | "tier-full"
function tierUsageClass(count, limit) {
  if (isProUser()) return "";
  if (count >= limit) return "tier-full";
  if (count / limit >= 0.7) return "tier-warn";
  return "";
}

const LEGACY_UI_CACHE_KEY = "the-terminal.ui-cache.v2";
const DEFAULT_CHART_RANGES = { 1: "1mo", 2: "1mo", 3: "1mo", 4: "1mo" };
const CHART_RANGE_OPTIONS = [
  { label: "5D", value: "5d" },
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "YTD", value: "ytd" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
  { label: "5Y", value: "5y" },
  { label: "ALL", value: "max" },
];
// Newcomer-friendly defaults: lead with the welcoming Briefing hero (sector
// rotation, signal board, mover chips), then show a chart, news, and the
// visual sector heatmap. Leaves Rules/Trade/etc. discoverable but not the
// first thing a new visitor sees.
const BIG_FOUR_DEFAULT_MODULES = { 1: "briefing", 2: "chart", 3: "news", 4: "heatmap" };
const BIG_FOUR_DEFAULT_SYMBOLS = { 1: "AAPL", 2: "AAPL", 3: "AAPL", 4: "SPY" };
const AUTH_ENABLED = true;

// Bump when the *default panel layout* changes meaningfully. Existing visitors
// get the new layout but keep their watchlist/positions/alerts/rules.
const WORKSPACE_LAYOUT_VERSION = 2;

// Bump for ANY breaking change to the persisted state shape (renamed
// keys, removed fields whose absence breaks the new app code, etc.).
// readPersistedMeridianState walks each registered migration in order
// from the persisted version up to STATE_SCHEMA_VERSION, then writes
// the upgraded blob back. New migrations append to STATE_MIGRATIONS;
// never edit an old one (you'd silently rewrite live users' state).
const STATE_SCHEMA_VERSION = 1;
const STATE_MIGRATIONS = {
  // Example shape — none ship today. When you need to migrate from v1
  // to v2, add: 2: (state) => { state.workspace.something = ...; return state; }
};

function _migratePersistedState(parsed) {
  let v = Number(parsed?.schemaVersion || 1);
  while (v < STATE_SCHEMA_VERSION) {
    const next = v + 1;
    const migration = STATE_MIGRATIONS[next];
    if (typeof migration === "function") {
      try {
        parsed = migration(parsed) || parsed;
      } catch (err) {
        // A failed migration is worse than a fresh start — wipe and
        // log so the user gets a clean app shell instead of a half-
        // upgraded zombie.
        console.warn("[Meridian] state migration", next, "failed; resetting", err);
        return null;
      }
    }
    v = next;
  }
  parsed.schemaVersion = STATE_SCHEMA_VERSION;
  return parsed;
}

function readPersistedMeridianState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MERIDIAN_STATE_KEY);
    if (!raw) return null;
    let parsed = JSON.parse(raw);
    parsed = _migratePersistedState(parsed);
    if (!parsed) {
      window.localStorage.removeItem(MERIDIAN_STATE_KEY);
      return null;
    }
    // Layout migration: older saves used quote/chart/news/rules as defaults.
    // If the stored layout predates the newcomer-friendly defaults, drop the
    // saved panelModules/panelSymbols so initial state falls back to the new
    // defaults but preserve watchlist, alerts, positions, rules, etc.
    if ((parsed?.layoutVersion || 1) < WORKSPACE_LAYOUT_VERSION && parsed?.workspace) {
      delete parsed.workspace.panelModules;
      delete parsed.workspace.panelSymbols;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(MERIDIAN_STATE_KEY);
    window.localStorage.removeItem(LEGACY_UI_CACHE_KEY);
    return null;
  }
}

const universe = buildUniverse();
const universeMap = new Map(universe.map((item) => [item.symbol, item]));
const legacyUiSnapshot = uiCache.read();
const persistedMeridianState = readPersistedMeridianState();
const persistedUi = persistedMeridianState?.ui || {};
const persistedWorkspace = persistedMeridianState?.workspace || {};
// Same layout-version check as readPersistedMeridianState — strip the legacy
// uiCache's saved layout so returning visitors land on the new defaults.
if ((persistedMeridianState?.layoutVersion || 1) < WORKSPACE_LAYOUT_VERSION && legacyUiSnapshot?.guestWorkspace) {
  delete legacyUiSnapshot.guestWorkspace.panelModules;
  delete legacyUiSnapshot.guestWorkspace.panelSymbols;
}
// ── Shareable view URLs ────────────────────────────────────────────────────
// Decode a `?v=<base64url-json>` query param into a partial workspace
// override. Used for "Share this view" links — friend opens the URL and
// lands on the same panel layout / symbols / chart ranges as the sender.
//
// Payload shape (kept tiny so URLs stay shareable):
//   { m: {1:"chart",...}, s: {1:"AAPL",...}, r: {1:"1y",...}, w?: ["A","B"] }
function base64UrlDecode(s) {
  try {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
    return decodeURIComponent(escape(window.atob(b64)));
  } catch { return null; }
}
function base64UrlEncode(s) {
  return window.btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function parseSharedView() {
  if (typeof window === "undefined" || !window.location?.search) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("v");
    if (!raw) return null;
    const decoded = base64UrlDecode(raw);
    if (!decoded) return null;
    const parsed = JSON.parse(decoded);
    // Light validation — bail on anything unexpected so a bad URL never
    // blocks the app from booting.
    if (!parsed || typeof parsed !== "object") return null;
    return {
      panelModules: parsed.m && typeof parsed.m === "object" ? parsed.m : null,
      panelSymbols: parsed.s && typeof parsed.s === "object" ? parsed.s : null,
      chartRanges: parsed.r && typeof parsed.r === "object" ? parsed.r : null,
      watchlist: Array.isArray(parsed.w) ? parsed.w.slice(0, 50).map(String) : null,
    };
  } catch { return null; }
}
const sharedView = parseSharedView();

const uiSnapshot = {
  ...legacyUiSnapshot,
  ...persistedUi,
  // A `?v=` URL takes precedence over persisted ranges so the receiver sees
  // exactly what the sender meant to share.
  ...(sharedView?.chartRanges ? { chartRanges: sharedView.chartRanges } : {}),
  guestWorkspace: {
    ...(legacyUiSnapshot.guestWorkspace || {}),
    ...persistedWorkspace,
    // Same precedence for layout + symbols. Watchlist override is opt-in
    // (only applied when sender included it) so we don't clobber the
    // recipient's existing watchlist by accident.
    ...(sharedView?.panelModules ? { panelModules: sharedView.panelModules } : {}),
    ...(sharedView?.panelSymbols ? { panelSymbols: sharedView.panelSymbols } : {}),
    ...(sharedView?.watchlist ? { watchlist: sharedView.watchlist } : {}),
  },
};
const guestWorkspace = uiSnapshot.guestWorkspace || {};

// ── Watchlist Groups (multi-list) ─────────────────────────────────────────
const WATCHLIST_GROUPS_KEY = "meridian_watchlist_groups";
const ACTIVE_WATCHLIST_GROUP_KEY = "meridian_active_watchlist_group";

function loadWatchlistGroups() {
  try {
    const raw = window.localStorage.getItem(WATCHLIST_GROUPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((g) => ({
          id: String(g.id || "default"),
          name: String(g.name || "Untitled"),
          symbols: Array.isArray(g.symbols) ? g.symbols.map((s) => String(s).toUpperCase()) : [],
        }));
      }
    }
  } catch {}
  // Default: one "Main" group seeded from the existing flat watchlist
  const seedSymbols = (guestWorkspace.watchlist || []).map((s) => String(s).toUpperCase());
  return [{ id: "default", name: "Main", symbols: seedSymbols }];
}

function loadActiveWatchlistGroup() {
  try {
    const raw = window.localStorage.getItem(ACTIVE_WATCHLIST_GROUP_KEY);
    if (raw) return String(raw);
  } catch {}
  return "default";
}

function saveWatchlistGroups() {
  try {
    window.localStorage.setItem(WATCHLIST_GROUPS_KEY, JSON.stringify(state.watchlistGroups));
    window.localStorage.setItem(ACTIVE_WATCHLIST_GROUP_KEY, String(state.activeWatchlistGroup));
  } catch {}
}

// Sync the active group's symbols with the live state.watchlist
function syncActiveGroupFromWatchlist() {
  if (!state?.watchlistGroups) return;
  const group = state.watchlistGroups.find((g) => g.id === state.activeWatchlistGroup);
  if (group) {
    group.symbols = [...state.watchlist];
    saveWatchlistGroups();
  }
}

function switchWatchlistGroup(groupId) {
  // First persist current rail into the previously-active group
  syncActiveGroupFromWatchlist();
  const next = state.watchlistGroups.find((g) => g.id === groupId);
  if (!next) return;
  state.activeWatchlistGroup = groupId;
  state.watchlist = [...next.symbols];
  saveWatchlistGroups();
  if (typeof renderRails === "function") renderRails();
  if (typeof renderTickerTape === "function") renderTickerTape();
  if (typeof refreshQuotes === "function" && state.watchlist.length) {
    void refreshQuotes(state.watchlist);
  }
}

function createWatchlistGroup(name) {
  const cleanName = String(name || "").trim().slice(0, 24);
  if (!cleanName) return;
  // Persist current edits to active group first
  syncActiveGroupFromWatchlist();
  const id = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  state.watchlistGroups.push({ id, name: cleanName, symbols: [] });
  state.activeWatchlistGroup = id;
  state.watchlist = [];
  saveWatchlistGroups();
  if (typeof renderRails === "function") renderRails();
  if (typeof renderTickerTape === "function") renderTickerTape();
}

function deleteWatchlistGroup(groupId) {
  if (groupId === "default") return; // can't delete default
  state.watchlistGroups = state.watchlistGroups.filter((g) => g.id !== groupId);
  if (state.activeWatchlistGroup === groupId) {
    const fallback = state.watchlistGroups[0];
    state.activeWatchlistGroup = fallback?.id || "default";
    state.watchlist = fallback ? [...fallback.symbols] : [];
  }
  saveWatchlistGroups();
  if (typeof renderRails === "function") renderRails();
  if (typeof renderTickerTape === "function") renderTickerTape();
}

const chartViews = new Map();
const chartMountGeneration = new Map(); // panel → monotonic counter, prevents stale async mounts
let lightweightChartsModulePromise = null;
let moduleRegistry = null;
let appCore = null;
let commandController = null;
let actionEngine = null;
let workspaceController = null;
let dockingController = null;
let logicEngine = null;
let uiRefreshQueued = false;
let unsubscribeStateUpdates = null;
let hasInitialized = false;
let lastStateUpdatedAt = Date.now();
let lastNotifCount = 0;
let notifManager = null;
let meridianStatePersistTimer = null;
const pendingPriceChanges = new Map();

const initialState = {
  user: null,
  subscription: { tier: "free", status: null },
  activePanel: Number(uiSnapshot.activePanel || 1),
  focusedPanel: Number(uiSnapshot.focusedPanel || 0) || null,
  panelModules: normalizePanelModules(guestWorkspace.panelModules, BIG_FOUR_DEFAULT_MODULES, moduleTitles),
  panelSymbols: normalizePanelMap(guestWorkspace.panelSymbols, BIG_FOUR_DEFAULT_SYMBOLS),
  chartRanges: normalizePanelMap(uiSnapshot.chartRanges, DEFAULT_CHART_RANGES),
  watchlist: [...(guestWorkspace.watchlist || defaultWatchlist)],
  watchlistGroups: loadWatchlistGroups(),
  activeWatchlistGroup: loadActiveWatchlistGroup(),
  alerts: structuredClone(guestWorkspace.alerts || defaultAlerts),
  positions: structuredClone(guestWorkspace.positions || defaultPositions),
  commandHistory: [...(guestWorkspace.commandHistory || [])],
  activeRules: structuredClone(seedLiveRules(guestWorkspace.activeRules)),
  notifications: structuredClone(seedLiveNotifications(guestWorkspace.notifications, guestWorkspace.activeRules)),
  commandHistoryIndex: -1,
  chartCompareSymbol: { 1: null, 2: null, 3: null, 4: null },
  screenerFilters: {
    1: { universe: "", sector: "", industry: "", search: "", minMarketCap: "", performance: "", maxPE: "", sortKey: "marketCap", sortDir: "desc" },
    2: { universe: "", sector: "", industry: "", search: "", minMarketCap: "", performance: "", maxPE: "", sortKey: "marketCap", sortDir: "desc" },
    3: { universe: "", sector: "", industry: "", search: "", minMarketCap: "", performance: "", maxPE: "", sortKey: "marketCap", sortDir: "desc" },
    4: { universe: "", sector: "", industry: "", search: "", minMarketCap: "", performance: "", maxPE: "", sortKey: "marketCap", sortDir: "desc" },
  },
  calculator: structuredClone(calculatorDefaults),
  quotes: new Map(),
  chartCache: new Map(),
  chartLoading: new Set(),
  optionsCache: new Map(),
  deepDiveCache: new Map(),
  deepDiveLoading: new Set(),
  newsItems: [],
  newsFilter: String(uiSnapshot.newsFilter || "ALL"),
  newsSourceFilter: "",
  fxRates: {},
  overviewQuotes: [],
  overviewSparklineCache: new Map(),
  overviewSymbols: [...DEFAULT_OVERVIEW_SYMBOLS],
  optionsSelection: { symbol: "AAPL", expiration: null },
  sessionStartedAt: Date.now(),
  refreshCountdown: 30,
  persistTimer: null,
  authAvailabilityTimer: null,
  autoJumpToPanel: uiSnapshot.autoJumpToPanel !== false,
  marketPhase: "Loading",
  health: { ok: false, server: "Checking server", time: null },
  commandPaletteOpen: false,
  rulesActiveTab: String(uiSnapshot.rulesActiveTab || "rules"),
  compactMode: Boolean(uiSnapshot.compactMode),
  theme: String(uiSnapshot.theme || "dark"),
  lastDataFetchedAt: Number(uiSnapshot.lastDataFetchedAt || 0),
  paperAccount: null,
  screenerUniverseLive: null, // fetched from /api/screener/universe on boot
  macroYields: null, // fetched from /api/macro/yields on each full refresh
  heatmapFilter: { sector: "ALL", sort: "changePct" },
  chartIndicators: { sma20: true, ema9: false, bollinger: false, vwap: false, rsi: true, volume: true, macd: false },
  aiCommentary: new Map(), // symbol -> {headline, bullets, summary, tone, source, generatedAt, model}
  aiLoading: new Set(),    // symbols currently being fetched
  aiSource: null,          // {source, model} from /api/ai/status
  fetchErrors: new Map(),  // key (e.g. "chart:AAPL:1mo" / "news" / "quote:AAPL") -> {message, ts}
};

const stateStore = createStateStore(initialState);
const state = stateStore.state;

const el = {
  terminalApp: document.querySelector("#terminalApp"),
  appTitle: document.querySelector("#appTitle"),
  functionRow: document.querySelector("#functionRow"),
  mobilePanelNav: document.querySelector("#mobilePanelNav"),
  openCommandPalette: document.querySelector("#openCommandPalette"),
  paletteBackdrop: document.querySelector("#paletteBackdrop"),
  commandPalette: document.querySelector("#commandPalette"),
  overviewStrip: document.querySelector("#overviewStrip"),
  tickerTape: document.querySelector("#tickerTape"),
  workspaceGrid: document.querySelector("#workspaceGrid"),
  watchlistRail: document.querySelector("#watchlistRail"),
  alertRail: document.querySelector("#alertRail"),
  commandInput: document.querySelector("#commandInput"),
  runCommandButton: document.querySelector("#runCommandButton"),
  autocomplete: document.querySelector("#autocomplete"),
  networkStatus: document.querySelector("#networkStatus"),
  marketPhase: document.querySelector("#marketPhase"),
  serverStatus: document.querySelector("#serverStatus"),
  refreshAllButton: document.querySelector("#refreshAllButton"),
  autoJumpButton: document.querySelector("#autoJumpButton"),
  resetFocusButton: document.querySelector("#resetFocusButton"),
  watchCount: document.querySelector("#watchCount"),
  alertCount: document.querySelector("#alertCount"),
  lastUpdated: document.querySelector("#lastUpdated"),
  refreshCountdown: document.querySelector("#refreshCountdown"),
  sessionClock: document.querySelector("#sessionClock"),
  logoutButton: document.querySelector("#logoutButton"),
  openAuthBtn: document.querySelector("#openAuthBtn"),
  openSettingsBtn: document.querySelector("#openSettingsBtn"),
  authModalBackdrop: document.querySelector("#authModalBackdrop"),
  closeAuthModal: document.querySelector("#closeAuthModal"),
  settingsModalBackdrop: document.querySelector("#settingsModalBackdrop"),
  closeSettingsModal: document.querySelector("#closeSettingsModal"),
  settingsStatus: document.querySelector("#settingsStatus"),
  updateProfileForm: document.querySelector("#updateProfileForm"),
  changePasswordForm: document.querySelector("#changePasswordForm"),
  deleteAccountForm: document.querySelector("#deleteAccountForm"),
  updateProfileBtn: document.querySelector("#updateProfileBtn"),
  changePasswordBtn: document.querySelector("#changePasswordBtn"),
  deleteAccountBtn: document.querySelector("#deleteAccountBtn"),
  settingsRole: document.querySelector("#settingsRole"),
  authTabs: document.querySelector("#authTabs"),
  authStatus: document.querySelector("#authStatus"),
  loginForm: document.querySelector("#loginForm"),
  signupForm: document.querySelector("#signupForm"),
  loginBtn: document.querySelector("#loginBtn"),
  signupBtn: document.querySelector("#signupBtn"),
  continueLocalBtn: document.querySelector("#continueLocalBtn"),
  continueLocalSignupBtn: document.querySelector("#continueLocalSignupBtn"),
  signupRole: document.querySelector("#signupRole"),
  signupEmail: document.querySelector("#signupEmail"),
  signupUsername: document.querySelector("#signupUsername"),
  signupAvailability: document.querySelector("#signupAvailability"),
  toast: document.querySelector("#toast"),
  notifBellBtn: document.querySelector("#notifBellBtn"),
  notifBadge: document.querySelector("#notifBadge"),
  notifDrawer: document.querySelector("#notifDrawer"),
  notifBackdrop: document.querySelector("#notifBackdrop"),
  notifHistory: document.querySelector("#notifHistory"),
  notifClearBtn: document.querySelector("#notifClearBtn"),
  notifDrawerClose: document.querySelector("#notifDrawerClose"),
};

function init() {
  if (hasInitialized) return;
  hasInitialized = true;
  notifManager = new NotificationManager();
  lastNotifCount = state.notifications.length;
  actionEngine = new ActionEngine({
    universe,
    handlers: {
      clearNotifications: () => clearNotificationsHistory(),
      clearAlerts: () => clearAlerts(),
      toggleRulesTab: () => toggleRulesTab(),
      toggleCompactMode: () => setCompactMode(),
      setTheme: (theme) => setTheme(theme),
      goToSymbol: (symbol) => broadcastSymbol(symbol),
      deleteSymbol: (symbol) => deleteSymbol(symbol),
    },
  });
  document.title = appName;
  if (el.appTitle) el.appTitle.textContent = appName;
  if (el.signupRole) {
    el.signupRole.innerHTML = authRoles.map((role) => `<option value="${role}">${role}</option>`).join("");
  }
  if (el.settingsRole) {
    el.settingsRole.innerHTML = authRoles.map((role) => `<option value="${role}">${role}</option>`).join("");
  }

  registerRenderers();
  ensureTransientOverlaysClosed();
  if (!unsubscribeStateUpdates) {
    unsubscribeStateUpdates = stateStore.subscribe((event) => {
      lastStateUpdatedAt = Date.now();
      capturePriceChanges(event.detail);
      // Detect new rule triggers from LogicEngine and push to NotificationManager
      if (state.notifications.length > lastNotifCount) {
        const newCount = state.notifications.length - lastNotifCount;
        state.notifications.slice(0, newCount).forEach((notif) => {
          notifManager?.push({
            type: "rule-trigger",
            title: `⚡ ${String(notif.symbol || "").toUpperCase()}`,
            body: notif.msg || "Condition met",
            symbol: notif.symbol || null,
          });
        });
        lastNotifCount = state.notifications.length;
        // Persist rule trigger notifications to the workspace so they survive refresh
        workspaceController?.queueSave();
      }
      queueMeridianStatePersist();
      scheduleUiRefresh();
    });
  }
  if (!appCore) {
    logicEngine = new LogicEngine();
    appCore = new AppCore({
      store: stateStore,
      registry: moduleRegistry,
      lexCommand,
      dependencies: {
        authEnabled: AUTH_ENABLED,
        commandCatalog,
        moduleOrder,
        universeMap,
        logicEngine,
        currentTimeShort,
        normalizeChartRange,
        onInitialize: () => {},
        onActivePanelChange: (panel) => {
          document.querySelectorAll("[data-panel]").forEach((node) => {
            node.classList.toggle("is-active", Number(node.dataset.panel) === Number(panel));
          });
        },
        onFocusChange: () => {
          updateFocusLayout();
        },
        syncPanelData,
        revealPanelIfNeeded,
        queueWorkspaceSave,
        syncUiCache,
        refreshAllData,
        refreshChart,
        refreshQuotes,
        refreshOptions,
        addToWatchlist,
        createAlert,
        addPosition,
        submitPaperOrder,
        loadDeepDive,
        syncTicker,
        showToast,
        triggerAICommentary,
        checkRuleLimit: () => checkFreeTierLimit(state.activeRules.length, FREE_RULES_LIMIT, "rules"),
        openSettingsModal,
        openShortcutsOverlay: () => {
          const overlay = ensureShortcutsOverlay();
          overlay.classList.remove("hidden");
        },
        removePosition: (symbol) => {
          removePositionBySymbol(symbol);
          showToast(`Position in ${symbol} removed.`, "neutral");
        },
        removeAlert: (symbol) => {
          const sym = String(symbol || "").toUpperCase();
          const before = state.alerts.length;
          state.alerts = state.alerts.filter((a) => a.symbol !== sym);
          if (state.alerts.length !== before) {
            queueWorkspaceSave();
            renderAllPanels();
            showToast(`Alerts for ${sym} cleared.`, "neutral");
          } else {
            showToast(`No active alerts for ${sym}.`, "neutral");
          }
        },
        openAuthEntry: (tab) => {
          if (AUTH_ENABLED) {
            openAuthModal(tab || "login");
          } else {
            showToast("Login is paused for now.", "neutral");
          }
        },
        afterCommand: () => {
          if (el.commandInput) el.commandInput.value = "";
          hideAutocomplete();
          closeCommandPalette();
          syncUiCache();
          queueWorkspaceSave();
        },
      },
    });

    workspaceController = new WorkspaceController({
      state,
      uiCache,
      workspaceApi,
      authApi,
      authEnabled: AUTH_ENABLED,
      defaults: {
        watchlist: defaultWatchlist,
        alerts: defaultAlerts,
        positions: defaultPositions,
        panelModules: BIG_FOUR_DEFAULT_MODULES,
        panelSymbols: BIG_FOUR_DEFAULT_SYMBOLS,
      },
      moduleTitles,
      setNetworkStatus,
      updateAuthControls,
      onSessionHydrated: () => {
        renderOverviewStrip();
        renderTickerTape();
        renderRails();
        renderAllPanels();
        void refreshPaperAccount().then(() => renderAllPanels());
      },
    });
    commandController = new CommandController({
      state,
      el,
      appCore,
      hideAutocomplete,
      closeCommandPalette,
      processRawCommand: (raw) => {
        if (actionEngine?.execute(raw)) {
          finalizePaletteAction();
          return;
        }
        appCore?.dispatchRawCommand(raw);
      },
    });
    dockingController = new DockingController({
      state,
      workspaceGrid: el.workspaceGrid,
      renderAllPanels,
      saveWorkspace: () => workspaceController?.saveWorkspace(),
      showToast,
    });
  }

  bindEvents();
  dockingController?.initialize();
  appCore.initialize();
  applyWorkspaceModes();
  setActivePanel(state.activePanel);
  scheduleUiRefresh();
  applyTerminalInputClass(document);
  updateFocusLayout();
  updateAuthControls();
  updateAutoJumpButton();
  updateStatusBar();
  void workspaceController?.initializeSession(state.health.ok);
  void checkHealth();
  refreshAllData();

  setInterval(updateSessionClock, 1000);
  setInterval(handleRefreshCountdown, 1000);
  setInterval(() => {
    if (document.hidden) return;
    void checkHealth();
  }, 120000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void checkHealth();
  });
  // Fast tick: refresh overview + watchlist quotes every 5s for a live-feed feel.
  // Skip while tab is hidden or a full refresh just happened to avoid duplicate work.
  setInterval(() => {
    if (document.hidden) return;
    if (Date.now() - (state.lastDataFetchedAt || 0) < 3500) return;
    void refreshLiveQuotes();
  }, 5000);
  window.addEventListener("resize", fitAllCharts);
  window.addEventListener("resize", syncMobilePanelNav);

  // Mobile responsive wiring (bottom-nav, More menu, body.is-mobile flag)
  initMobileResponsive();

  // Show onboarding for first-time users
  if (shouldShowOnboarding()) {
    setTimeout(showOnboarding, 600);
  }
}

function registerRenderers() {
  if (moduleRegistry) return;
  moduleRegistry = createDefaultModuleRegistry({
    state,
    authEnabled: AUTH_ENABLED,
    universe,
    heatmapGroups,
    macroDefaults,
    buildQuote,
    findRelatedSymbols,
    chartIntervalForRange,
    chartKey,
    optionsKey,
    calculateChartStats,
    calculateBlackScholes,
    calculateBond,
    calculatePulse,
    currentTimeShort,
    chartRangeOptions: CHART_RANGE_OPTIONS,
    getRenderableNewsItems,
    extractHeadlineSymbol,
    emptyState,
    enrichPositions,
    calculatePortfolioSummary,
    isProUser,
  });
}

function queuePriceChange(key, previousPrice, currentPrice) {
  if (!key || previousPrice == null || currentPrice == null) return;
  if (Number(previousPrice) === Number(currentPrice)) return;
  pendingPriceChanges.set(key, {
    previousPrice: Number(previousPrice),
    currentPrice: Number(currentPrice),
  });
}

function queueOverviewPriceChanges(previousQuotes = [], nextQuotes = []) {
  const previousBySymbol = new Map((previousQuotes || []).map((quote) => [quote.symbol, quote]));
  (nextQuotes || []).forEach((quote) => {
    queuePriceChange(`overview:${quote.symbol}:price`, previousBySymbol.get(quote.symbol)?.price, quote.price);
  });
}

function capturePriceChanges(detail) {
  const [root, key] = detail?.path || [];

  if (root === "quotes" && key && detail.property === "set") {
    queuePriceChange(`quote:${String(key)}:price`, detail.oldState?.price, detail.newState?.price);
    return;
  }

  if (root === "overviewQuotes" && detail.path?.length === 1) {
    queueOverviewPriceChanges(detail.oldState, detail.newState);
    return;
  }

  if (root === "fxRates" && key) {
    queuePriceChange(`fx:${String(key)}`, detail.oldState, detail.newState);
  }
}

function applyPriceTones(rootNode = document) {
  rootNode.querySelectorAll("[data-price-key]").forEach((element) => {
    const change = pendingPriceChanges.get(element.dataset.priceKey || "");
    if (!change) return;
    applyPriceTone(element, change.currentPrice, change.previousPrice);
  });
  rootNode.querySelectorAll("[data-price-current]").forEach((element) => {
    if (element.dataset.priceKey) return;
    applyPriceTone(element, Number(element.dataset.priceCurrent), Number(element.dataset.pricePrevious));
  });
}

function snapshotMeridianState() {
  return {
    version: 1,
    schemaVersion: STATE_SCHEMA_VERSION,
    layoutVersion: WORKSPACE_LAYOUT_VERSION,
    updatedAt: Date.now(),
    ui: {
      activePanel: state.activePanel,
      focusedPanel: state.focusedPanel,
      autoJumpToPanel: state.autoJumpToPanel,
      chartRanges: state.chartRanges,
      newsFilter: state.newsFilter,
      rulesActiveTab: state.rulesActiveTab,
      activeTicker: state.panelSymbols[state.activePanel] || "AAPL",
      compactMode: state.compactMode,
      theme: state.theme,
      lastDataFetchedAt: state.lastDataFetchedAt,
    },
    workspace: {
      watchlist: state.watchlist,
      alerts: state.alerts,
      positions: state.positions,
      panelModules: state.panelModules,
      panelSymbols: state.panelSymbols,
      commandHistory: state.commandHistory,
      activeRules: state.activeRules,
      notifications: state.notifications,
    },
  };
}

function persistMeridianState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MERIDIAN_STATE_KEY, JSON.stringify(snapshotMeridianState()));
  } catch {
    // Private browsing, quota exceeded, or storage disabled — ignore.
    // The app remains fully functional; saved state just won't survive a reload.
  }
}

function queueMeridianStatePersist() {
  window.clearTimeout(meridianStatePersistTimer);
  meridianStatePersistTimer = window.setTimeout(() => {
    persistMeridianState();
  }, 90);
}

function applyWorkspaceModes() {
  document.body.dataset.theme = state.theme || "dark";
  document.documentElement.style.colorScheme = state.theme === "light" ? "light" : "dark";
  el.terminalApp?.classList.toggle("is-compact", Boolean(state.compactMode));
}

function finalizePaletteAction() {
  if (el.commandInput) el.commandInput.value = "";
  hideAutocomplete();
  closeCommandPalette();
  syncUiCache();
  queueWorkspaceSave();
}

function scheduleUiRefresh() {
  if (uiRefreshQueued) return;
  uiRefreshQueued = true;
  requestAnimationFrame(() => {
    uiRefreshQueued = false;
    try { applyWorkspaceModes(); } catch {}
    try { renderFunctionRow(); } catch {}
    try { renderOverviewStrip(); } catch {}
    try { renderTickerTape(); } catch {}
    try { renderRails(); } catch {}
    renderAllPanels(); // panels each have their own try-catch
    try { updateFocusLayout(); } catch {}
    try { updateAuthControls(); } catch {}
    try { updateAutoJumpButton(); } catch {}
    try { updateStatusBar(); } catch {}
    pendingPriceChanges.clear();
  });
}

function bindEvents() {
  el.runCommandButton?.addEventListener("click", processCommand);
  el.commandInput?.addEventListener("input", renderAutocomplete);
  el.commandInput?.addEventListener("keydown", handleCommandKeydown);
  el.functionRow?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module]");
    if (button) loadModule(button.dataset.module, state.activePanel, { reveal: true });
  });
  el.openCommandPalette?.addEventListener("click", () => openCommandPalette());
  el.paletteBackdrop?.addEventListener("click", (event) => {
    if (event.target === el.paletteBackdrop) closeCommandPalette();
  });

  // Notification drawer
  el.notifBellBtn?.addEventListener("click", () => toggleNotifDrawer());
  el.notifDrawerClose?.addEventListener("click", () => closeNotifDrawer());
  el.notifBackdrop?.addEventListener("click", () => closeNotifDrawer());
  el.notifClearBtn?.addEventListener("click", () => {
    clearNotificationsHistory();
  });
  window.addEventListener("meridian:notification", () => {
    updateNotifBadge();
    el.notifBellBtn?.classList.remove("is-pinging");
    void el.notifBellBtn?.offsetWidth;
    el.notifBellBtn?.classList.add("is-pinging");
    if (el.notifDrawer?.classList.contains("is-open")) renderNotifDrawer();
  });

  el.refreshAllButton?.addEventListener("click", () => {
    refreshAllData();
    showToast("Refreshing live workspace…", "neutral");
  });
  el.autoJumpButton?.addEventListener("click", () => {
    state.autoJumpToPanel = !state.autoJumpToPanel;
    updateAutoJumpButton();
    syncUiCache();
    showToast(`Auto-jump ${state.autoJumpToPanel ? "enabled" : "disabled"}.`, "neutral");
  });
  el.resetFocusButton?.addEventListener("click", () => setFocusedPanel(null));
  el.openAuthBtn?.addEventListener("click", handleAuthEntry);
  el.openSettingsBtn?.addEventListener("click", openSettingsModal);
  el.closeAuthModal?.addEventListener("click", closeAuthModal);
  el.closeSettingsModal?.addEventListener("click", closeSettingsModal);
  el.continueLocalBtn?.addEventListener("click", closeAuthModal);
  el.continueLocalSignupBtn?.addEventListener("click", closeAuthModal);
  el.logoutButton?.addEventListener("click", handleLogout);

  el.authModalBackdrop?.addEventListener("click", (event) => {
    if (event.target === el.authModalBackdrop) closeAuthModal();
  });

  el.settingsModalBackdrop?.addEventListener("click", (event) => {
    if (event.target === el.settingsModalBackdrop) closeSettingsModal();
  });

  el.authTabs?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-auth-tab]");
    if (tab) setAuthTab(tab.dataset.authTab);
  });

  el.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(el.loginForm);
    setAuthMessage("Signing in…", "neutral");
    setButtonLoading(el.loginBtn, true, "Signing in…");
    try {
      const payload = await authApi.login({
        identifier: String(data.get("identifier") || ""),
        password: String(data.get("password") || ""),
      });
      workspaceController?.hydrateSession(payload.user, payload.workspace, payload.subscription);
      closeAuthModal();
      showToast(`Welcome back, ${payload.user.firstName}.`, "success");
      void refreshPaperAccount().then(() => renderAllPanels()).catch((err) => { console.warn("[Meridian] paper refresh (login):", err); renderAllPanels(); });
    } catch (error) {
      setAuthMessage(error.message || "Sign in failed.", "error");
    } finally {
      setButtonLoading(el.loginBtn, false, "Sign in and sync");
    }
  });

  el.signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(el.signupForm);
    const password = String(data.get("password") || "");
    const displayName = String(data.get("displayName") || "").trim();
    const [firstName, ...rest] = displayName.split(/\s+/);
    const lastName = rest.join(" ") || firstName || "";

    if (password.length < 8) {
      setAuthMessage("Password must be at least 8 characters.", "error");
      return;
    }

    try {
      const availability = await authApi.checkAvailability({
        email: String(data.get("email") || ""),
        username: String(data.get("username") || ""),
      });
      if (!availability.emailAvailable) {
        setAuthMessage("That email is already in use.", "error");
        return;
      }
      if (!availability.usernameAvailable) {
        setAuthMessage("That username is already taken.", "error");
        return;
      }
    } catch {
      // backend may be unavailable; submit will still attempt
    }

    setAuthMessage("Creating account…", "neutral");
    setButtonLoading(el.signupBtn, true, "Creating…");
    try {
      const payload = await authApi.signup({
        firstName,
        lastName,
        email: String(data.get("email") || ""),
        username: String(data.get("username") || ""),
        password,
        role: String(data.get("role") || "Other"),
      });
      workspaceController?.hydrateSession(payload.user, payload.workspace, payload.subscription);
      closeAuthModal();
      showToast(`Account created. Welcome, ${payload.user.firstName}.`, "success");
      void refreshPaperAccount().then(() => renderAllPanels()).catch((err) => { console.warn("[Meridian] paper refresh (signup):", err); renderAllPanels(); });
    } catch (error) {
      setAuthMessage(error.message || "Signup failed.", "error");
    } finally {
      setButtonLoading(el.signupBtn, false, "Create and sync");
    }
  });

  el.signupEmail?.addEventListener("input", scheduleAvailabilityCheck);
  el.signupUsername?.addEventListener("input", scheduleAvailabilityCheck);

  const signupPasswordInput = document.querySelector("#signupPassword");
  const signupPasswordToggle = document.querySelector("#signupPasswordToggle");
  signupPasswordToggle?.addEventListener("click", () => {
    if (!signupPasswordInput) return;
    const showing = signupPasswordInput.type === "text";
    signupPasswordInput.type = showing ? "password" : "text";
    signupPasswordToggle.textContent = showing ? "SHOW" : "HIDE";
  });

  el.updateProfileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(el.updateProfileForm);
    setSettingsMessage("Updating profile…", "neutral");
    setButtonLoading(el.updateProfileBtn, true, "Updating…");
    try {
      const payload = await authApi.updateProfile({
        firstName: String(data.get("firstName") || ""),
        lastName: String(data.get("lastName") || ""),
        username: String(data.get("username") || ""),
        role: String(data.get("role") || "Other"),
      });
      state.user = payload.user;
      setSettingsMessage("Profile updated.", "success");
      showToast("Profile updated.", "success");
    } catch (error) {
      setSettingsMessage(error.message || "Profile update failed.", "error");
    } finally {
      setButtonLoading(el.updateProfileBtn, false, "Update profile");
    }
  });

  el.changePasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(el.changePasswordForm);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    if (newPassword.length < 8) {
      setSettingsMessage("New password must be at least 8 characters.", "error");
      return;
    }
    setSettingsMessage("Updating password…", "neutral");
    setButtonLoading(el.changePasswordBtn, true, "Updating…");
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      el.changePasswordForm.reset();
      setSettingsMessage("Password updated.", "success");
      showToast("Password updated.", "success");
    } catch (error) {
      setSettingsMessage(error.message || "Password update failed.", "error");
    } finally {
      setButtonLoading(el.changePasswordBtn, false, "Change password");
    }
  });

  el.deleteAccountForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(el.deleteAccountForm);
    const password = String(data.get("password") || "");
    setSettingsMessage("Deleting account…", "neutral");
    setButtonLoading(el.deleteAccountBtn, true, "Deleting…");
    try {
      await authApi.deleteAccount({ password });
      closeSettingsModal();
      state.user = null;
      updateAuthControls();
      setNetworkStatus(state.health.ok ? "Guest · Live" : "Guest · Local");
      showToast("Account deleted.", "neutral");
    } catch (error) {
      setSettingsMessage(error.message || "Account deletion failed.", "error");
    } finally {
      setButtonLoading(el.deleteAccountBtn, false, "Delete account");
    }
  });

  // Tour controls (wizard is handled in the dedicated wizard section below)
  document.querySelector("#tourSkipBtn")?.addEventListener("click", endTour);
  document.querySelector("#tourPrevBtn")?.addEventListener("click", () => advanceTour(-1));
  document.querySelector("#tourNextBtn")?.addEventListener("click", () => advanceTour(1));

  // Pricing modal
  document.querySelector("#closePricingModal")?.addEventListener("click", closePricingModal);
  document.querySelector("#pricingModalBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "pricingModalBackdrop") closePricingModal();
  });
  document.querySelector("#billingMonthly")?.addEventListener("click", () => applyPricingBilling("monthly"));
  document.querySelector("#billingAnnual")?.addEventListener("click", () => applyPricingBilling("annual"));

  // Pricing waitlist form
  document.querySelector("#pricingWaitlistForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const email = new FormData(form).get("email")?.trim();
    if (!email) return;
    const btn = document.querySelector("#pricingWaitlistBtn");
    const note = document.querySelector("#pricingWaitlistNote");
    if (btn) { btn.textContent = "✓ You're on the list!"; btn.disabled = true; }
    if (note) { note.textContent = `We'll notify ${email} when Pro launches.`; note.style.color = "var(--success)"; }
    form.querySelector("input[type=email]").value = "";
    showToast("🚀 You're on the Pro waitlist!", "success");
    // Store locally so we don't spam
    try { window.localStorage.setItem("meridian_waitlist_email", email); } catch {}
  });

  // ── Stripe Checkout: upgrade buttons ──────────────────────────────────────
  // Buttons with [data-waitlist="pro"|"pro-plus"] kick off a hosted Stripe
  // Checkout session. If the backend isn't configured (no Stripe key, 503),
  // we fall back to scrolling the user to the waitlist email capture below.
  // If they aren't logged in (401), we open the auth modal first.
  document.querySelectorAll("[data-waitlist]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      const target = event.currentTarget;
      const plan = target.dataset.waitlist === "pro-plus" ? "pro_plus" : "pro";
      const interval = _pricingBilling === "annual" ? "annual" : "monthly";

      if (!state.user) {
        showToast("Sign in first so we can sync your subscription.", "neutral");
        closePricingModal();
        openAuthModal("signup");
        return;
      }

      const originalLabel = target.textContent;
      target.disabled = true;
      target.textContent = "Opening checkout…";
      try {
        const result = await billingApi.createCheckoutSession({ plan, interval });
        if (result?.url) {
          window.location.assign(result.url);
          return;
        }
        throw new Error("No checkout URL returned.");
      } catch (error) {
        const msg = String(error?.message || "");
        if (msg.includes("503") || /not configured/i.test(msg)) {
          // Stripe isn't live yet — gracefully fall back to waitlist signup.
          showToast("💌 Billing isn't live yet. Drop your email and we'll notify you.", "neutral", 5000);
          document.querySelector("#pricingWaitlist")?.scrollIntoView({ behavior: "smooth", block: "center" });
          document.querySelector("#pricingWaitlistForm input[type=email]")?.focus();
        } else if (msg.includes("401") || /sign in/i.test(msg)) {
          closePricingModal();
          openAuthModal("login");
          showToast("Sign in to start your trial.", "neutral");
        } else {
          showToast(`Checkout failed: ${msg || "unknown error"}`, "error", 5000);
        }
      } finally {
        target.disabled = false;
        target.textContent = originalLabel;
      }
    });
  });

  // ── Stripe Checkout: redirect-back handlers ───────────────────────────────
  try {
    const params = new URLSearchParams(window.location.search);
    const billingFlag = params.get("billing");
    if (billingFlag === "success") {
      setTimeout(() => {
        showToast("🎉 Welcome to Pro! Your subscription is active.", "success", 6000);
      }, 600);
      // Re-fetch session so the new tier shows up immediately.
      void authApi.session().then((payload) => {
        workspaceController?.hydrateSession(payload.user, payload.workspace, payload.subscription);
        renderAllPanels();
      }).catch(() => {});
    } else if (billingFlag === "canceled") {
      setTimeout(() => {
        showToast("Checkout canceled. You can try again any time from Pricing.", "neutral", 5000);
      }, 600);
    }
    if (billingFlag) {
      params.delete("billing");
      params.delete("session_id");
      const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
  } catch {}

  // ── Manage subscription (opens Stripe Customer Portal) ────────────────────
  document.querySelector("#manageSubscriptionBtn")?.addEventListener("click", async () => {
    if (!state.user) { openAuthModal("login"); return; }
    try {
      const result = await billingApi.createPortalSession();
      if (result?.url) window.location.assign(result.url);
    } catch (error) {
      const msg = String(error?.message || "");
      if (msg.includes("503") || /not configured/i.test(msg)) {
        showToast("Billing portal isn't live yet. Check back soon.", "neutral");
      } else {
        showToast(`Couldn't open billing portal: ${msg || "error"}`, "error");
      }
    }
  });

  // ── Upgrade from Settings → opens pricing modal ───────────────────────────
  document.querySelector("#upgradeFromSettingsBtn")?.addEventListener("click", () => {
    closeSettingsModal();
    openPricingModal();
  });

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("input", handleDocumentInput);
  document.addEventListener("submit", handleDocumentSubmit);
  document.addEventListener("keydown", handleGlobalHotkeys, true);

  // ── Live User Count (gentle social proof) ─────────────────────────────────
  // Deterministic-ish synthetic count that drifts naturally. No backend needed.
  const liveUserChip = document.querySelector("#liveUserCount");
  if (liveUserChip) {
    let baseUsers = 380 + Math.floor(Math.random() * 80);
    const span = liveUserChip.querySelector("span");
    const updateLiveCount = () => {
      // Drift +/- 1-3 each tick, with mild day/night pattern
      const hour = new Date().getHours();
      const peakBoost = (hour >= 9 && hour <= 16) ? Math.floor(Math.random() * 6) : 0;
      baseUsers = Math.max(210, baseUsers + (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * 3) + (Math.random() < 0.3 ? peakBoost : 0));
      if (span) span.textContent = `${baseUsers} live`;
    };
    updateLiveCount();
    setInterval(updateLiveCount, 12_000);
  }

  // ── First-Time Theme Tip Toast ────────────────────────────────────────────
  try {
    if (!window.localStorage.getItem("meridian_theme_tip_shown")) {
      setTimeout(() => {
        showToast("💡 Tip: press T anytime to switch themes (Bloomberg, Synthwave, more!)", "neutral", 6500);
        window.localStorage.setItem("meridian_theme_tip_shown", "1");
      }, 4500);
    }
  } catch {}

  // ── Per-Ticker Notes (Trade Journal) ──────────────────────────────────────
  const NOTES_KEY = "meridian_ticker_notes";
  function loadAllNotes() {
    try {
      const raw = window.localStorage.getItem(NOTES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function saveAllNotes(map) {
    try { window.localStorage.setItem(NOTES_KEY, JSON.stringify(map)); } catch {}
  }
  const notesSaveDebounce = new Map();
  function attachTickerNotes() {
    document.querySelectorAll("[data-ticker-notes-card]").forEach((card) => {
      const symbol = card.dataset.tickerNotesCard;
      if (!symbol || card.dataset.notesWired === "1") return;
      card.dataset.notesWired = "1";
      const textarea = card.querySelector(`[data-ticker-notes-input="${symbol}"]`);
      const status = card.querySelector(`[data-ticker-notes-status="${symbol}"]`);
      const count = card.querySelector(`[data-ticker-notes-count="${symbol}"]`);
      if (!textarea) return;
      const all = loadAllNotes();
      const note = all[symbol] || { text: "", updatedAt: null };
      textarea.value = note.text;
      if (count) count.textContent = `${textarea.value.length} / 2000 chars`;
      if (status && note.updatedAt) {
        const d = new Date(note.updatedAt);
        status.textContent = `Saved · ${d.toLocaleString()}`;
      }
      textarea.addEventListener("input", () => {
        if (count) count.textContent = `${textarea.value.length} / 2000 chars`;
        if (status) status.textContent = "Saving…";
        const existing = notesSaveDebounce.get(symbol);
        if (existing) clearTimeout(existing);
        notesSaveDebounce.set(symbol, setTimeout(() => {
          const m = loadAllNotes();
          if (textarea.value.trim()) {
            m[symbol] = { text: textarea.value, updatedAt: Date.now() };
          } else {
            delete m[symbol];
          }
          saveAllNotes(m);
          if (status) status.textContent = `Saved · ${new Date().toLocaleTimeString()}`;
        }, 600));
      });
    });
  }
  document.addEventListener("meridian:panel-rendered", attachTickerNotes);
  setTimeout(attachTickerNotes, 100);

  // ── Theme picker ──────────────────────────────────────────────────────────
  const THEME_KEY = "meridian_theme";
  const VALID_THEMES = new Set(["dark", "bloomberg", "synthwave", "emerald", "paper", "midnight", "crimson", "slate", "amber"]);
  function applyTheme(theme) {
    const t = VALID_THEMES.has(theme) ? theme : "dark";
    if (t === "dark") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", t);
    }
    try { window.localStorage.setItem(THEME_KEY, t); } catch {}
    document.querySelectorAll("[data-theme-set]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.themeSet === t);
    });
  }
  // Apply persisted theme on boot
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved) applyTheme(saved);
  } catch {}

  const themeBtn = document.querySelector("#themePickerBtn");
  const themePopover = document.querySelector("#themePopover");
  themeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    themePopover?.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!themePopover || themePopover.classList.contains("hidden")) return;
    if (e.target.closest("#themePopover") || e.target.closest("#themePickerBtn")) return;
    themePopover.classList.add("hidden");
  });
  document.addEventListener("click", (e) => {
    const tBtn = e.target.closest("[data-theme-set]");
    if (!tBtn) return;
    applyTheme(tBtn.dataset.themeSet);
    showToast(`Theme: ${tBtn.querySelector("strong")?.textContent || tBtn.dataset.themeSet}`, "neutral");
    themePopover?.classList.add("hidden");
  });
  // Press T to cycle themes (when no input focused)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "t" && e.key !== "T") return;
    const tag = (e.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const themes = ["dark", "bloomberg", "synthwave", "emerald", "paper", "midnight", "crimson", "slate", "amber"];
    const current = document.documentElement.dataset.theme || "dark";
    const next = themes[(themes.indexOf(current) + 1) % themes.length];
    applyTheme(next);
    showToast(`Theme → ${next}`, "neutral");
  });

  // ── Settings Panel action delegation ──────────────────────────────────────
  // Handles clicks on [data-settings-action] buttons rendered inside the
  // Settings panel module (which lives in the panel grid, not the modal).
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-settings-action]");
    if (!btn) return;
    const action = btn.dataset.settingsAction;
    switch (action) {
      case "edit-profile":
      case "change-password":
      case "delete-account":
        openSettingsModal();
        break;
      case "sign-in":
        openAuthModal("login");
        break;
      case "create-account":
        openAuthModal("signup");
        break;
      case "upgrade":
      case "upgrade-pro":
      case "upgrade-pro-plus":
        openPricingModal();
        break;
      case "manage-billing": {
        const tier = state.subscription?.tier || "free";
        if (tier !== "free") {
          billingApi.createPortalSession().then((result) => {
            if (result?.url) window.location.href = result.url;
          }).catch((err) => {
            console.warn("[Meridian] portal:", err);
            showToast("Could not open billing portal. Try again shortly.", "warning");
          });
        }
        break;
      }
      case "clear-local":
        if (confirm("Reset workspace, watchlist, and preferences to defaults? This cannot be undone.")) {
          try { localStorage.clear(); } catch {}
          showToast("Local data cleared. Reloading…", "neutral");
          setTimeout(() => window.location.reload(), 800);
        }
        break;
      default:
        break;
    }
  });

  // ── Settings Panel preference toggle ──────────────────────────────────────
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pref-toggle]");
    if (!btn) return;
    const pref = btn.dataset.prefToggle;
    if (pref === "compactMode") {
      const next = !state.compactMode;
      state.compactMode = next;
      document.querySelector(".terminal-app")?.classList.toggle("is-compact", next);
      syncUiCache();
      // Re-render the settings panel so the toggle updates
      renderAllPanels();
      showToast(`Compact mode ${next ? "enabled" : "disabled"}.`, "neutral");
    }
  });

  // ── Replay Tour button (header) ────────────────────────────────────────────
  // Always-on access to the welcome wizard so users who dismissed it (or
  // returning visitors who didn't notice it the first time) can replay it.
  document.querySelector("#replayTourBtn")?.addEventListener("click", () => {
    // Reset the "already seen" flag so showOnboarding() will display fully,
    // then immediately re-flag on dismissal via the existing handlers.
    try { window.localStorage.removeItem(ONBOARDING_KEY); } catch {}
    goToWizardStep(1);
    showOnboarding();
  });

  // ── Share View button (header) ─────────────────────────────────────────────
  // Encodes current panel layout + symbols + chart ranges into a base64url
  // payload and copies a shareable URL to clipboard. The recipient lands on
  // the exact same view. Watchlist is included so the receiver sees the
  // sender's tracked symbols (we don't clobber their *saved* watchlist —
  // they'll see the URL list until they make their own change).
  document.querySelector("#shareViewBtn")?.addEventListener("click", async () => {
    try {
      const payload = {
        m: state.panelModules,
        s: state.panelSymbols,
        r: state.chartRanges,
        w: state.watchlist?.slice(0, 25), // cap so URLs stay reasonable
      };
      const encoded = base64UrlEncode(JSON.stringify(payload));
      const url = new URL(window.location.href);
      url.search = `?v=${encoded}`;
      const shareUrl = url.toString();
      // Try modern clipboard API; fall back to legacy execCommand for older
      // browsers / non-secure contexts.
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(shareUrl); copied = true; } catch {}
      }
      if (!copied) {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { copied = document.execCommand("copy"); } catch {}
        document.body.removeChild(ta);
      }
      if (copied) {
        showToast(`🔗 Share link copied (${shareUrl.length} chars)`, "success", 4000);
      } else {
        // Surface the URL so user can copy it manually
        window.prompt("Copy this share link:", shareUrl);
      }
    } catch (err) {
      showToast("Couldn't build a share link. Try again.", "error");
      console.error("[Meridian] share view failed:", err);
    }
  });

  // If the page was opened with `?v=...`, sharedView was applied to the
  // initial state above. Surface a toast so the user knows their layout
  // came from a link, then strip the param so subsequent saves don't keep
  // re-applying it on reload.
  if (sharedView && (sharedView.panelModules || sharedView.panelSymbols)) {
    const panelCount = sharedView.panelModules ? Object.keys(sharedView.panelModules).length : 0;
    setTimeout(() => {
      showToast(`📍 Loaded shared view (${panelCount} panels). Edit anything to make it yours.`, "neutral", 5500);
    }, 400);
    try {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.search = "";
      window.history.replaceState({}, "", cleanUrl.toString());
    } catch {}
  }

  // ── Onboarding Wizard Interactivity ────────────────────────────────────────
  document.querySelector("#onboardingSkip")?.addEventListener("click", () => {
    dismissOnboarding();
    // Tip: suppress theme tip if they skip (they just saw theme in step 2)
    try { window.localStorage.setItem("meridian_theme_tip_shown", "1"); } catch {}
  });

  document.querySelector("#onboardingStart")?.addEventListener("click", () => {
    applyWizardChoices();
    dismissOnboarding();
    try { window.localStorage.setItem("meridian_theme_tip_shown", "1"); } catch {}
    showToast("🚀 Meridian is ready. Use Cmd+K to explore.", "success", 5000);
  });

  document.querySelector("#wizardNext1")?.addEventListener("click", () => goToWizardStep(2));
  document.querySelector("#wizardNext2")?.addEventListener("click", () => goToWizardStep(3));
  document.querySelector("#wizardBack2")?.addEventListener("click", () => goToWizardStep(1));
  document.querySelector("#wizardBack3")?.addEventListener("click", () => goToWizardStep(2));

  document.addEventListener("click", (e) => {
    // Focus tiles (step 1)
    const focusTile = e.target.closest("[data-focus]");
    if (focusTile) {
      document.querySelectorAll("[data-focus]").forEach((t) => t.classList.remove("is-active"));
      focusTile.classList.add("is-active");
      wizardFocus = focusTile.dataset.focus;
      const note = document.querySelector("#wizardSelectionNote");
      const syms = WIZARD_FOCUS_SYMBOLS[wizardFocus] || [];
      if (note) {
        note.textContent = syms.length ? `Will add: ${syms.join(", ")}` : "You'll build your own watchlist once inside.";
      }
      const next1 = document.querySelector("#wizardNext1");
      if (next1) next1.disabled = false;
      return;
    }

    // Theme tiles (step 2)
    const wizThemeTile = e.target.closest("[data-wizard-theme]");
    if (wizThemeTile) {
      document.querySelectorAll("[data-wizard-theme]").forEach((t) => t.classList.remove("is-active"));
      wizThemeTile.classList.add("is-active");
      wizardTheme = wizThemeTile.dataset.wizardTheme;
      // Live preview
      const htmlEl = document.documentElement;
      if (wizardTheme === "dark") htmlEl.removeAttribute("data-theme");
      else htmlEl.setAttribute("data-theme", wizardTheme);
      return;
    }

    // Speed tiles (step 3)
    const speedTile = e.target.closest("[data-speed]");
    if (speedTile && speedTile.closest("#wizardSpeedGrid")) {
      document.querySelectorAll("[data-speed]").forEach((t) => t.classList.remove("is-active"));
      speedTile.classList.add("is-active");
      wizardSpeed = Number(speedTile.dataset.speed) || 30;
      // Rerender recap
      if (wizardStep === 3) goToWizardStep(3);
      return;
    }
  });

  document.querySelector("#onboardingBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "onboardingBackdrop") dismissOnboarding();
  });

  // ── Position Sizer (inline calculator) ─────────────────────────────────────
  // Exposed on window so the inline `oninput` handlers in QuoteRenderer keep
  // working across re-renders without needing to rewire delegates each time.
  window.__updatePositionSizer = function updatePositionSizer(input) {
    const card = input.closest("[data-position-sizer]");
    if (!card) return;
    const get = (k) => Number(card.querySelector(`[data-pos-input="${k}"]`)?.value || 0);
    const set = (k, v) => {
      const node = card.querySelector(`[data-pos-out="${k}"]`);
      if (node) node.textContent = v;
    };
    const fmtUsd = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const acct = get("account");
    const riskPct = get("risk");
    const entry = get("entry");
    const stop = get("stop");
    if (!acct || !riskPct || !entry || !stop || entry === stop) {
      set("shares", "—"); set("size", "—"); set("loss", "—"); set("distance", "—"); set("targets", "—");
      return;
    }
    const riskDollars = (acct * riskPct) / 100;
    const perShareRisk = Math.abs(entry - stop);
    const shares = Math.floor(riskDollars / perShareRisk);
    const positionSize = shares * entry;
    const maxLoss = shares * perShareRisk;
    const distancePct = (perShareRisk / entry) * 100;
    const isLong = entry > stop;
    const r = perShareRisk;
    const t1 = isLong ? entry + r : entry - r;
    const t2 = isLong ? entry + 2 * r : entry - 2 * r;
    const t3 = isLong ? entry + 3 * r : entry - 3 * r;
    set("shares", shares.toLocaleString());
    set("size", fmtUsd(positionSize));
    set("loss", `-${fmtUsd(maxLoss)}`);
    set("distance", `${perShareRisk.toFixed(2)} (${distancePct.toFixed(2)}%)`);
    set("targets", `1R ${fmtUsd(t1)} · 2R ${fmtUsd(t2)} · 3R ${fmtUsd(t3)}`);
  };

  // Auto-init any sizer cards already in the DOM after each render
  const initSizers = () => {
    document.querySelectorAll("[data-position-sizer]").forEach((card) => {
      const trigger = card.querySelector('[data-pos-input="entry"]');
      if (trigger && window.__updatePositionSizer) window.__updatePositionSizer(trigger);
    });
  };
  // Run shortly after init and after each panel render (cheap, idempotent)
  setTimeout(initSizers, 50);
  document.addEventListener("meridian:panel-rendered", initSizers);
}

function ensureTransientOverlaysClosed() {
  state.commandPaletteOpen = false;
  el.paletteBackdrop?.classList.add("hidden");
  el.authModalBackdrop?.classList.add("hidden");
  el.settingsModalBackdrop?.classList.add("hidden");
}

// ── Onboarding Wizard ────────────────────────────────────────────────────────
const ONBOARDING_KEY = "meridian_onboarded";

const WIZARD_FOCUS_SYMBOLS = {
  mega:       ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "BRK-B"],
  indices:    ["SPY", "QQQ", "DIA", "IWM", "VIX", "TLT", "GLD", "USO"],
  tech:       ["AAPL", "MSFT", "META", "GOOGL", "AMD", "TSLA", "NVDA", "AMZN"],
  finance:    ["JPM", "GS", "BAC", "BRK-B", "MS", "WFC", "C", "BLK"],
  energy:     ["XOM", "CVX", "OXY", "SLB", "COP", "EOG", "MPC", "PSX"],
  crypto:     ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "ADA-USD"],
  healthcare: ["JNJ", "UNH", "PFE", "ABBV", "MRK", "TMO", "LLY", "AMGN"],
  custom:     [],
};

const WIZARD_REFRESH_RATES = { 10: 10, 30: 30, 60: 60, 120: 120 };

let wizardStep = 1;
let wizardFocus = null;
let wizardTheme = "dark";
let wizardSpeed = 30;

function shouldShowOnboarding() {
  if (typeof window === "undefined") return false;
  try { return !window.localStorage.getItem(ONBOARDING_KEY); } catch { return false; }
}

function showOnboarding() {
  const backdrop = document.querySelector("#onboardingBackdrop");
  if (backdrop) backdrop.classList.remove("hidden");
}

function dismissOnboarding() {
  const backdrop = document.querySelector("#onboardingBackdrop");
  if (backdrop) backdrop.classList.add("hidden");
  try { window.localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* ignore */ }
}

function goToWizardStep(step) {
  wizardStep = step;
  [1, 2, 3].forEach((n) => {
    document.querySelector(`#wizardPane${n}`)?.classList.toggle("is-active", n === step);
    const dot = document.querySelector(`[data-step-dot="${n}"]`);
    if (dot) {
      dot.classList.toggle("is-active", n === step);
      dot.classList.toggle("is-done", n < step);
    }
  });
  // Fill recap on step 3
  if (step === 3) {
    const recap = document.querySelector("#wizardFinishRecap");
    if (recap) {
      const focusLabel = wizardFocus
        ? (wizardFocus === "custom" ? "Custom watchlist" : document.querySelector(`[data-focus="${wizardFocus}"] strong`)?.textContent || wizardFocus)
        : "Not selected";
      const themeLabel = document.querySelector(`[data-wizard-theme="${wizardTheme}"] strong`)?.textContent || wizardTheme;
      recap.innerHTML = `
        <div class="wizard-recap-grid">
          <div class="wizard-recap-item"><span>Watchlist</span><strong>${focusLabel}</strong></div>
          <div class="wizard-recap-item"><span>Theme</span><strong>${themeLabel}</strong></div>
          <div class="wizard-recap-item"><span>Refresh</span><strong>${wizardSpeed}s</strong></div>
          <div class="wizard-recap-item"><span>Symbols</span><strong>${(WIZARD_FOCUS_SYMBOLS[wizardFocus] || []).length || "—"}</strong></div>
        </div>
      `;
    }
  }
}

function applyWizardChoices() {
  // Apply symbol seeds to watchlist
  const seeds = WIZARD_FOCUS_SYMBOLS[wizardFocus] || [];
  if (seeds.length && state.watchlist.length <= 2) {
    const toAdd = seeds.filter((s) => !state.watchlist.includes(s));
    state.watchlist = [...state.watchlist, ...toAdd].slice(0, 10);
    syncActiveGroupFromWatchlist();
  }
  // Apply theme
  const themeEl = document.documentElement;
  if (wizardTheme === "dark") { themeEl.removeAttribute("data-theme"); }
  else { themeEl.setAttribute("data-theme", wizardTheme); }
  try { window.localStorage.setItem("meridian_theme", wizardTheme); } catch {}
  // Apply refresh rate (store in uiCache / state)
  state.refreshIntervalSeconds = wizardSpeed;
  syncUiCache();
  try { window.localStorage.setItem("meridian_refresh_rate", String(wizardSpeed)); } catch {}
  // Re-render
  renderRails();
  renderTickerTape();
  refreshAllData();
}

// ── Guided Tour ──────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    selector: "#overviewStrip",
    icon: "📈",
    title: "Live Market Overview",
    desc: "The ticker strip shows real-time prices for major indices and ETFs: SPY, QQQ, VIX, and more. Click any card to chart it instantly.",
    placement: "bottom",
  },
  {
    selector: "#openCommandPalette",
    icon: "⌨️",
    title: "Command Bar (Cmd+K)",
    desc: "Everything lives here. Type a ticker for an instant quote, 'CHART NVDA' for a chart, 'BUY AAPL 10' to paper trade, or 'HELP' to see all commands.",
    placement: "bottom",
  },
  {
    selector: "#workspaceGrid",
    icon: "⊞",
    title: "Multi-Panel Workspace",
    desc: "Up to four panels run side-by-side. Type 'GRID' to switch layouts or 'FOCUS 2' to jump to any panel. Each panel runs an independent module.",
    placement: "top",
  },
  {
    selector: ".left-rail",
    icon: "👁️",
    title: "Watchlist & Tools",
    desc: "Track your favourite tickers here, prices update live. Type 'WATCH AAPL' to add any symbol, or 'ALERT AAPL >= 200' to set a price alert.",
    placement: "right",
  },
  {
    selector: null,
    icon: "💸",
    title: "Paper Trading",
    desc: "Start risk-free with a $100 K virtual account. Type 'TRADE' or press F9 to open the trading terminal. Buy, sell, track P/L, and earn achievements as you go.",
    placement: "center",
    isLast: true,
  },
];

let _tourStep = 0;
let _tourActive = false;
let _tourResizeTimer = null;

function startTour() {
  _tourStep = 0;
  _tourActive = true;
  const overlay = document.querySelector("#tourOverlay");
  if (overlay) overlay.classList.remove("hidden");
  _renderTourStep();
  window.addEventListener("resize", _onTourResize);
  window.addEventListener("keydown", _onTourKey);
}

function endTour() {
  _tourActive = false;
  const overlay = document.querySelector("#tourOverlay");
  if (overlay) overlay.classList.add("hidden");
  _removeTourHighlight();
  window.removeEventListener("resize", _onTourResize);
  window.removeEventListener("keydown", _onTourKey);
}

function advanceTour(delta) {
  const next = _tourStep + delta;
  if (next < 0) return;
  if (next >= TOUR_STEPS.length) { endTour(); return; }
  _tourStep = next;
  _renderTourStep();
}

function _onTourKey(e) {
  if (!_tourActive) return;
  if (e.key === "Escape") { endTour(); return; }
  if (e.key === "ArrowRight" || e.key === "Enter") advanceTour(1);
  if (e.key === "ArrowLeft") advanceTour(-1);
}

function _onTourResize() {
  clearTimeout(_tourResizeTimer);
  _tourResizeTimer = setTimeout(_renderTourStep, 80);
}

function _removeTourHighlight() {
  document.querySelectorAll(".tour-highlighted").forEach((el) => {
    el.classList.remove("tour-highlighted");
    el.style.removeProperty("position");
    el.style.removeProperty("z-index");
  });
}

function _renderTourStep() {
  if (!_tourActive) return;
  const step = TOUR_STEPS[_tourStep];
  const total = TOUR_STEPS.length;

  // Update content
  const iconEl = document.querySelector("#tourIcon");
  const titleEl = document.querySelector("#tourTitle");
  const descEl = document.querySelector("#tourDesc");
  const prevBtn = document.querySelector("#tourPrevBtn");
  const nextBtn = document.querySelector("#tourNextBtn");
  const progressEl = document.querySelector("#tourProgress");

  if (iconEl) iconEl.textContent = step.icon;
  if (titleEl) titleEl.textContent = step.title;
  if (descEl) descEl.textContent = step.desc;
  if (prevBtn) prevBtn.style.visibility = _tourStep === 0 ? "hidden" : "visible";
  if (nextBtn) nextBtn.textContent = step.isLast ? "Done ✓" : "Next →";

  // Step dots
  if (progressEl) {
    progressEl.innerHTML = Array.from({ length: total }, (_, i) =>
      `<span class="tour-dot${i === _tourStep ? " is-active" : ""}" aria-label="Step ${i + 1}"></span>`
    ).join("");
  }

  // Position spotlight
  _removeTourHighlight();
  const spotlight = document.querySelector("#tourSpotlight");
  const card = document.querySelector("#tourCard");
  if (!spotlight || !card) return;

  if (!step.selector) {
    // Center card, no spotlight
    spotlight.classList.add("tour-no-target");
    spotlight.style.cssText = "top:50%;left:50%;width:0;height:0;";
    _positionTourCard(card, null, "center");
    return;
  }

  const target = document.querySelector(step.selector);
  if (!target) {
    // Selector not found — skip spotlight, center card
    spotlight.classList.add("tour-no-target");
    spotlight.style.cssText = "top:50%;left:50%;width:0;height:0;";
    _positionTourCard(card, null, "center");
    return;
  }

  spotlight.classList.remove("tour-no-target");
  const rect = target.getBoundingClientRect();
  const PAD = 6;
  spotlight.style.top = `${rect.top - PAD}px`;
  spotlight.style.left = `${rect.left - PAD}px`;
  spotlight.style.width = `${rect.width + PAD * 2}px`;
  spotlight.style.height = `${rect.height + PAD * 2}px`;

  _positionTourCard(card, rect, step.placement);
}

function _positionTourCard(card, targetRect, placement) {
  const CARD_W = 360;
  const CARD_MARGIN = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!targetRect || placement === "center") {
    card.style.top = `${Math.max(CARD_MARGIN, (vh - card.offsetHeight) / 2)}px`;
    card.style.left = `${Math.max(CARD_MARGIN, (vw - Math.min(CARD_W, vw - CARD_MARGIN * 2)) / 2)}px`;
    return;
  }

  const cardW = Math.min(CARD_W, vw - CARD_MARGIN * 2);
  let top, left;

  if (placement === "bottom") {
    top = targetRect.bottom + CARD_MARGIN + 8;
    left = Math.min(
      Math.max(CARD_MARGIN, targetRect.left + targetRect.width / 2 - cardW / 2),
      vw - cardW - CARD_MARGIN
    );
    // If not enough room below, flip to above
    if (top + 200 > vh) {
      top = Math.max(CARD_MARGIN, targetRect.top - 200 - CARD_MARGIN);
    }
  } else if (placement === "top") {
    top = Math.max(CARD_MARGIN, targetRect.top - 200 - CARD_MARGIN);
    left = Math.min(
      Math.max(CARD_MARGIN, targetRect.left + targetRect.width / 2 - cardW / 2),
      vw - cardW - CARD_MARGIN
    );
    // Flip to below if not enough room above
    if (top < CARD_MARGIN) top = targetRect.bottom + CARD_MARGIN + 8;
  } else if (placement === "right") {
    top = Math.max(CARD_MARGIN, targetRect.top + targetRect.height / 2 - 100);
    left = targetRect.right + CARD_MARGIN + 8;
    // Flip to left or center if off screen
    if (left + cardW > vw - CARD_MARGIN) {
      left = Math.max(CARD_MARGIN, targetRect.left - cardW - CARD_MARGIN - 8);
    }
    if (left < CARD_MARGIN) {
      left = Math.max(CARD_MARGIN, (vw - cardW) / 2);
      top = targetRect.bottom + CARD_MARGIN + 8;
    }
  } else {
    top = Math.max(CARD_MARGIN, (vh - 200) / 2);
    left = Math.max(CARD_MARGIN, (vw - cardW) / 2);
  }

  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
}

// ── Pricing modal ──
let _pricingBilling = "monthly"; // "monthly" | "annual"

function openPricingModal() {
  const backdrop = document.querySelector("#pricingModalBackdrop");
  if (backdrop) backdrop.classList.remove("hidden");
  applyPricingBilling(_pricingBilling);
}

function closePricingModal() {
  const backdrop = document.querySelector("#pricingModalBackdrop");
  if (backdrop) backdrop.classList.add("hidden");
}

function applyPricingBilling(billing) {
  _pricingBilling = billing;
  const isAnnual = billing === "annual";

  // Toggle button active states
  document.querySelector("#billingMonthly")?.classList.toggle("is-active", !isAnnual);
  document.querySelector("#billingAnnual")?.classList.toggle("is-active", isAnnual);

  // Pro pricing: $7.99/mo or $71.88/yr ($5.99/mo equiv, save 25%)
  const proAmount = document.querySelector("#priceAmountPro");
  const proPeriod = document.querySelector("#pricePeriodPro");
  const proAnnual = document.querySelector("#priceAnnualPro");
  if (proAmount) proAmount.textContent = isAnnual ? "$5.99" : "$7.99";
  if (proPeriod) proPeriod.textContent = "/mo";
  if (proAnnual) proAnnual.classList.toggle("hidden", !isAnnual);

  // Pro+ pricing: $14.99/mo or $143.88/yr ($11.99/mo equiv, save 20%)
  const ppAmount = document.querySelector("#priceAmountProPlus");
  const ppPeriod = document.querySelector("#pricePeriodProPlus");
  const ppAnnual = document.querySelector("#priceAnnualProPlus");
  if (ppAmount) ppAmount.textContent = isAnnual ? "$11.99" : "$14.99";
  if (ppPeriod) ppPeriod.textContent = "/mo";
  if (ppAnnual) ppAnnual.classList.toggle("hidden", !isAnnual);
}

function openAuthModal(tab = "login") {
  setAuthTab(tab);
  el.authModalBackdrop?.classList.remove("hidden");
}

function handleAuthEntry() {
  if (!AUTH_ENABLED) {
    showToast("Login is paused for now.", "neutral");
    return;
  }
  if (state.user) {
    setAuthMessage(`Signed in as @${state.user.username}. Sign in to switch account.`, "neutral");
  }
  openAuthModal("login");
}

function closeAuthModal() {
  el.authModalBackdrop?.classList.add("hidden");
  setAuthMessage("Your workspace, synced across every device.", "neutral");
}

function openSettingsModal() {
  if (!AUTH_ENABLED) {
    showToast("Account controls are disabled in this build.", "neutral");
    return;
  }
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  populateSettingsForm();
  refreshSubscriptionSection();
  setSettingsMessage("Update your account details securely.", "neutral");
  el.settingsModalBackdrop?.classList.remove("hidden");
}

function refreshSubscriptionSection() {
  const line = document.querySelector("#subscriptionStatusLine");
  const upgrade = document.querySelector("#upgradeFromSettingsBtn");
  const manage = document.querySelector("#manageSubscriptionBtn");
  const tier = state.subscription?.tier || "free";
  const status = state.subscription?.status;
  const tierLabel = tier === "pro_plus" ? "Pro+" : tier === "pro" ? "Pro" : "Free";
  if (line) {
    if (tier === "free") {
      line.textContent = "You're on the Free tier. Unlock advanced indicators, alerts, and AI commentary with Pro.";
    } else {
      const statusText = status ? ` · status: ${status}` : "";
      line.textContent = `Current plan: ${tierLabel}${statusText}.`;
    }
  }
  if (upgrade) {
    if (tier === "free") {
      upgrade.classList.remove("hidden");
      upgrade.textContent = "Upgrade to Pro";
    } else {
      upgrade.classList.add("hidden");
    }
  }
  if (manage) {
    manage.classList.toggle("hidden", tier === "free");
  }
}

function closeSettingsModal() {
  el.settingsModalBackdrop?.classList.add("hidden");
  setSettingsMessage("Update your account details securely.", "neutral");
}

function updateAuthControls() {
  const tierBadge = document.querySelector("#userTierBadge");

  if (!AUTH_ENABLED) {
    el.logoutButton?.classList.add("hidden");
    el.openSettingsBtn?.classList.add("hidden");
    el.openAuthBtn?.classList.add("hidden");
    el.authModalBackdrop?.classList.add("hidden");
    el.settingsModalBackdrop?.classList.add("hidden");
    tierBadge?.classList.add("hidden");
    return;
  }

  if (state.user) {
    el.logoutButton?.classList.remove("hidden");
    el.openSettingsBtn?.classList.remove("hidden");
    if (el.openAuthBtn) {
      el.openAuthBtn.textContent = "Switch";
      el.openAuthBtn.title = "Switch account";
    }
    if (tierBadge) {
      const tier = state.subscription?.tier || "free";
      const status = state.subscription?.status;
      const label =
        tier === "pro_plus" ? "PRO+" :
        tier === "pro" ? "PRO" :
        "FREE";
      tierBadge.textContent = status === "trialing" ? `${label} · TRIAL` : label;
      tierBadge.dataset.tier = tier;
      tierBadge.classList.remove("hidden");
    }
    return;
  }

  el.logoutButton?.classList.add("hidden");
  el.openSettingsBtn?.classList.add("hidden");
  tierBadge?.classList.add("hidden");
  if (el.openAuthBtn) {
    el.openAuthBtn.textContent = "Sync";
    el.openAuthBtn.title = "Sign in and sync workspace";
  }
}

function setAuthTab(tabName) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === tabName);
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.authPanel !== tabName);
  });
  const title = document.querySelector("#authModalTitle");
  if (title) title.textContent = tabName === "signup" ? "Create your account" : "Welcome back";
}

function setAuthMessage(message, tone) {
  if (!el.authStatus) return;
  el.authStatus.textContent = message;
  el.authStatus.dataset.tone = tone;
  el.authStatus.classList.toggle("active", Boolean(message));
}

function setSettingsMessage(message, tone) {
  if (!el.settingsStatus) return;
  el.settingsStatus.textContent = message;
  el.settingsStatus.dataset.tone = tone;
  el.settingsStatus.classList.toggle("active", Boolean(message));
}

function populateSettingsForm() {
  if (!state.user) return;
  const profileForm = el.updateProfileForm;
  if (!profileForm) return;

  const firstNameInput = profileForm.elements.namedItem("firstName");
  const lastNameInput = profileForm.elements.namedItem("lastName");
  const usernameInput = profileForm.elements.namedItem("username");
  const roleInput = profileForm.elements.namedItem("role");

  if (firstNameInput) firstNameInput.value = state.user.firstName || "";
  if (lastNameInput) lastNameInput.value = state.user.lastName || "";
  if (usernameInput) usernameInput.value = state.user.username || "";
  if (roleInput) roleInput.value = state.user.role || "Other";
}

function setSignupAvailability(message, tone = "neutral") {
  if (!el.signupAvailability) return;
  el.signupAvailability.textContent = message;
  el.signupAvailability.dataset.tone = tone;
  el.signupAvailability.classList.toggle("active", Boolean(message));
}

function applyTerminalInputClass(rootNode = document) {
  rootNode.querySelectorAll("input, select, textarea").forEach((inputNode) => {
    inputNode.classList.add("terminal-input");
  });
}

function setButtonLoading(button, loading, label) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = label;
}

function openCommandPalette(prefill = "") {
  if (!el.paletteBackdrop) return;
  state.commandPaletteOpen = true;
  el.paletteBackdrop.classList.remove("hidden");
  if (el.commandInput) {
    el.commandInput.value = prefill;
    el.commandInput.focus();
    if (prefill) renderAutocomplete();
  }
}

function closeCommandPalette() {
  if (!el.paletteBackdrop) return;
  state.commandPaletteOpen = false;
  el.paletteBackdrop.classList.add("hidden");
  hideAutocomplete();
}

function loadingSkeleton(lines = 3) {
  return `<div class="stack">${Array.from({ length: lines })
    .map((_, index) => `<span class="skeleton-box ${index === 0 ? "lg" : ""}"></span>`)
    .join("")}</div>`;
}

async function handleLogout() {
  try {
    await authApi.logout();
  } catch {
    // ignore
  }
  closeSettingsModal();
  state.user = null;
  state.subscription = { tier: "free", status: null };
  state.paperAccount = null;
  updateAuthControls();
  setNetworkStatus(state.health.ok ? "Guest · Live" : "Guest · Local");
  showToast("Signed out.", "neutral");
  renderAllPanels();
}

async function checkHealth() {
  try {
    const payload = await marketApi.health();
    state.health = {
      ok: Boolean(payload.ok),
      server: payload.server || "Meridian",
      time: payload.time || null,
    };
    state.marketPhase = payload.phase || deriveMarketPhase();
  } catch {
    state.health = { ok: false, server: "Local mode", time: null };
    state.marketPhase = deriveMarketPhase();
  }

  if (el.marketPhase) el.marketPhase.textContent = state.marketPhase;
  if (el.serverStatus) {
    el.serverStatus.textContent = state.health.ok ? "Live" : "Offline";
    el.serverStatus.classList.toggle("chip-server-offline", !state.health.ok);
  }
  if (!state.user) setNetworkStatus(state.health.ok ? "Guest · Live" : "Guest · Local");

  // Wake-server cold-start banner. Show on first failed health check;
  // animate to a "✓ Connected" state and fade out when it succeeds.
  updateWakeBanner();
}

/**
 * Manage the cold-start wake banner shown above the topbar.
 *
 * Render's free tier sleeps after 15min idle. The first user request
 * each session takes ~30s to warm the dyno. Without feedback, that
 * looks like the app is broken. This banner says: "we're waking up,
 * it's expected, hang on."
 *
 * State machine:
 *   1. First failed health check    → show "warming" copy + spinner
 *   2. Failed >30s past first fail  → swap to "responding slowly,
 *      showing demo data" so the user knows it's not just a cold start
 *      and that what they see is seed data
 *   3. First successful check       → green "✓ Connected" + fade out
 *
 * A close button lets the user dismiss the banner manually; the
 * dismissal sticks for the rest of the session.
 */
let _wakeFirstFailAt = null;
let _wakeDismissed = false;

function updateWakeBanner() {
  const banner = document.getElementById("wakeBanner");
  if (!banner || _wakeDismissed) return;

  const text = banner.querySelector(".wake-text");

  if (!state.health.ok) {
    if (_wakeFirstFailAt == null) _wakeFirstFailAt = Date.now();
    const elapsed = Date.now() - _wakeFirstFailAt;

    // Auto-dismiss after the user has had time to read the extended-state
    // message. Continuing to camp the banner just for "still down" adds noise.
    if (elapsed >= 45_000) {
      _wakeDismissed = true;
      banner.classList.remove("is-shown", "is-extended", "is-resolved");
      return;
    }

    banner.classList.add("is-shown");
    banner.classList.remove("is-resolved");

    if (text) {
      if (elapsed < 30_000) {
        text.innerHTML =
          "Waking the data server (free-tier cold start, ~30s). " +
          "<strong>Live quotes will populate as soon as it responds.</strong>";
      } else {
        banner.classList.add("is-extended");
        text.innerHTML =
          "Backend is taking longer than usual. " +
          "<strong>Showing cached demo data. Your watchlist still works.</strong>";
      }
    }
    return;
  }

  // Health is OK now. If we previously showed a banner, mark resolved
  // so it animates away. Otherwise just stay hidden.
  if (banner.classList.contains("is-shown") && !banner.classList.contains("is-resolved")) {
    if (text) text.innerHTML = "<strong>Connected.</strong> Live data is loading.";
    banner.classList.remove("is-extended");
    banner.classList.add("is-resolved");
    setTimeout(() => banner.classList.remove("is-shown", "is-resolved"), 2600);
    _wakeFirstFailAt = null;
  }
}

// Wire the dismiss button. Module scripts are deferred, so DOMContentLoaded
// may have already fired by the time we get here — bind directly if the DOM
// is ready, otherwise wait for it.
function wireWakeBannerDismiss() {
  const dismiss = document.getElementById("wakeBannerDismiss");
  const banner = document.getElementById("wakeBanner");
  if (!dismiss || !banner) return;
  if (dismiss.dataset.wired === "1") return;
  dismiss.dataset.wired = "1";
  dismiss.addEventListener("click", () => {
    _wakeDismissed = true;
    banner.classList.remove("is-shown", "is-extended", "is-resolved");
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireWakeBannerDismiss, { once: true });
} else {
  wireWakeBannerDismiss();
}

function deriveMarketPhase() {
  const now = new Date();
  // Convert to NY time
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = ny.getDay(); // 0=Sun 6=Sat
  const h = ny.getHours();
  const m = ny.getMinutes();
  const mins = h * 60 + m;
  if (day === 0 || day === 6) return "Weekend";
  if (mins < 4 * 60 + 0) return "Overnight";
  if (mins < 9 * 60 + 30) return "Pre-market";
  if (mins < 16 * 60) return "Market open";
  if (mins < 20 * 60) return "After hours";
  return "Overnight";
}

function setNetworkStatus(text) {
  if (el.networkStatus) el.networkStatus.textContent = text;
}

function updateAutoJumpButton() {
  if (!el.autoJumpButton) return;
  el.autoJumpButton.textContent = `Auto-jump: ${state.autoJumpToPanel ? "On" : "Off"}`;
  el.autoJumpButton.classList.toggle("is-active", state.autoJumpToPanel);
}

function isMobileViewport() {
  return (window.innerWidth || document.documentElement.clientWidth) <= 768;
}

// Sync the mobile bottom-tab active state and panel visibility.
// On mobile we show only the active panel; all others are visibility-hidden
// to avoid expensive re-renders while keeping them in the layout tree.
function syncMobilePanelNav() {
  if (!isMobileViewport()) {
    // On desktop: ensure all panels are visible regardless of mobile state
    [1, 2, 3, 4].forEach((p) => {
      const node = document.querySelector(`[data-panel="${p}"]`);
      if (node) node.classList.remove("is-mobile-hidden");
    });
    if (el.mobilePanelNav) el.mobilePanelNav.classList.remove("is-visible");
    return;
  }

  if (el.mobilePanelNav) el.mobilePanelNav.classList.add("is-visible");

  const active = state.activePanel;
  [1, 2, 3, 4].forEach((p) => {
    const panelNode = document.querySelector(`[data-panel="${p}"]`);
    const tabBtn = document.querySelector(`[data-mobile-panel="${p}"]`);
    const label = document.querySelector(`#mobileTab${p}Label`);
    const isActive = p === active;

    if (panelNode) panelNode.classList.toggle("is-mobile-hidden", !isActive);
    if (tabBtn) tabBtn.classList.toggle("is-active", isActive);
    if (label) {
      // Show the current module name in the tab
      const moduleName = state.panelModules?.[p];
      if (moduleName) {
        label.textContent = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
      }
    }
  });
}

// ── Mobile responsive: body.is-mobile flag, bottom-nav binding, More menu ──
function initMobileResponsive() {
  const mq = window.matchMedia("(max-width: 900px)");
  const applyMobileFlag = (matches) => {
    document.body.classList.toggle("is-mobile", Boolean(matches));
  };
  applyMobileFlag(mq.matches);
  // Safari <14 lacks addEventListener on MediaQueryList — fall back to addListener
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", (event) => applyMobileFlag(event.matches));
  } else if (typeof mq.addListener === "function") {
    mq.addListener((event) => applyMobileFlag(event.matches));
  }

  // Bottom-nav buttons: an existing document-click delegate already calls
  // setActivePanel for [data-mobile-panel]; we just make sure the buttons
  // exist (the markup ships them) and re-sync nav state on body-flag change.
  syncMobilePanelNav();

  // ⋯ More menu — clones secondary header buttons into a small dropdown
  const moreBtn = document.querySelector("#mobileMoreMenuBtn");
  const moreMenu = document.querySelector("#mobileMoreMenu");
  if (moreBtn && moreMenu) {
    const secondaryIds = [
      "themePickerBtn",
      "replayTourBtn",
      "shareViewBtn",
      "autoJumpButton",
      "resetFocusButton",
      "openCommandPalette",
    ];

    const populate = () => {
      moreMenu.innerHTML = "";
      secondaryIds.forEach((id) => {
        const original = document.getElementById(id);
        if (!original) return;
        // Move (don't clone) so click handlers keep working
        moreMenu.appendChild(original);
      });
    };

    const closeMenu = () => {
      moreMenu.classList.add("hidden");
      moreBtn.setAttribute("aria-expanded", "false");
    };

    const openMenu = () => {
      populate();
      moreMenu.classList.remove("hidden");
      moreBtn.setAttribute("aria-expanded", "true");
    };

    moreBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      moreMenu.classList.contains("hidden") ? openMenu() : closeMenu();
    });

    // Click anywhere else to close
    document.addEventListener("click", (event) => {
      if (!moreMenu.classList.contains("hidden")
          && !moreMenu.contains(event.target)
          && event.target !== moreBtn) {
        closeMenu();
      }
    });

    // Close on Escape
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }
}

function isSplitLaptopViewport() {
  const width = window.innerWidth || document.documentElement.clientWidth;
  const height = window.innerHeight || document.documentElement.clientHeight;
  const screenWidth = window.screen?.availWidth || window.screen?.width || 0;
  const estimatedHalf = screenWidth ? Math.round(screenWidth / 2) : 720;
  const adaptiveLower = Math.max(680, Math.round(estimatedHalf * 0.8));
  const adaptiveUpper = Math.max(790, Math.round(estimatedHalf * 1.2));
  const around720Band = width >= 680 && width <= 860;
  const adaptiveBand = width >= adaptiveLower && width <= adaptiveUpper;
  const likelyLaptopClass = screenWidth ? screenWidth <= 1800 : true;
  return height >= 560 && (around720Band || (likelyLaptopClass && adaptiveBand));
}

function revealPanelIfNeeded(panel, behavior = "smooth") {
  if (!state.autoJumpToPanel) return;
  if (!isSplitLaptopViewport()) return;
  const panelNode = document.querySelector(`[data-panel="${panel}"]`);
  if (!panelNode) return;

  const rect = panelNode.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const mostlyVisible = rect.top >= 72 && rect.bottom <= viewportHeight - 12;
  if (mostlyVisible) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  panelNode.scrollIntoView({
    block: "start",
    behavior: prefersReducedMotion ? "auto" : behavior,
  });
}

function scheduleAvailabilityCheck() {
  const email = String(el.signupEmail?.value || "").trim();
  const username = String(el.signupUsername?.value || "").trim();
  if (!email && !username) {
    setSignupAvailability("Use a unique email and username.", "neutral");
    return;
  }

  window.clearTimeout(state.authAvailabilityTimer);
  state.authAvailabilityTimer = window.setTimeout(() => {
    checkSignupAvailability(email, username);
  }, 280);
}

async function checkSignupAvailability(email, username) {
  try {
    const result = await authApi.checkAvailability({ email, username });
    if (email && !result.emailAvailable) {
      setSignupAvailability("Email is already in use.", "error");
      return;
    }
    if (username && !result.usernameAvailable) {
      setSignupAvailability("Username is already taken.", "error");
      return;
    }
    if (email || username) {
      setSignupAvailability("Looks good. Credentials are available.", "success");
    }
  } catch {
    setSignupAvailability("Availability check offline; you can still submit.", "neutral");
  }
}

function renderFunctionRow() {
  if (!el.functionRow) return;
  if (el.functionRow.classList.contains("hidden")) return;
  el.functionRow.innerHTML = functionKeys
    .map(
      (item) => `
      <button class="function-key ${state.panelModules[state.activePanel] === item.module ? "is-active" : ""}" data-module="${item.module}" type="button">
        <span>${item.key}</span>
        <strong>${item.label}</strong>
      </button>
    `,
    )
    .join("");
}

function renderOverviewStrip() {
  if (!el.overviewStrip) return;

  // Build a card list backed by live quotes when available, else seed data
  // from the universe map so the strip is never blank for new visitors.
  // Symbol order comes from state.overviewSymbols so the strip stays stable.
  const liveBySymbol = new Map((state.overviewQuotes || []).map((q) => [q.symbol, q]));
  const cardQuotes = (state.overviewSymbols || []).map((symbol) => {
    const live = liveBySymbol.get(symbol);
    if (live) return live;
    const seed = buildQuote(symbol);
    if (!seed) return null;
    return { ...seed, isLive: false };
  }).filter(Boolean);

  const cards = cardQuotes.length
    ? cardQuotes
        .map(
          (quote) => `
            <button class="overview-card${quote.isLive ? "" : " is-static"}" type="button" data-broadcast-symbol="${quote.symbol}" title="Click to load ${quote.symbol} on the active panel${quote.isLive ? "" : " · seed price (live feed unavailable)"}">
              <span>${quote.symbol}${quote.isLive ? '<i class="overview-live-dot"></i>' : ''}</span>
              <strong>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `overview:${quote.symbol}:price`, currentPrice: quote.price })}</strong>
              <small class="${Number(quote.changePct || 0) >= 0 ? "positive" : "negative"}">${quote.isLive ? tabularValue(formatSignedPct(quote.changePct || 0)) : "·"}</small>
              ${renderOverviewSparkline(quote.symbol, Number(quote.changePct || 0))}
            </button>
          `,
        )
        .join("")
    : state.overviewSymbols
        .map(
          (symbol) => `
            <article class="overview-card is-placeholder">
              <span>${symbol}</span>
              <span class="skeleton-box lg"></span>
              <span class="skeleton-box sm"></span>
            </article>
          `,
        )
        .join("");

  const pulse = calculatePulse();
  const breadthTone = pulse.gainers > pulse.losers ? "positive" : pulse.losers > pulse.gainers ? "negative" : "neutral";
  const breadthPct = pulse.total ? Math.round((pulse.gainers / pulse.total) * 100) : 0;
  const avgChangeStr = formatSignedPct(pulse.avgChange || 0);
  const leader = pulse.strongest ? `${pulse.strongest.symbol} ${formatSignedPct(pulse.strongest.changePct || 0)}` : "--";
  const laggard = pulse.weakest ? `${pulse.weakest.symbol} ${formatSignedPct(pulse.weakest.changePct || 0)}` : "--";
  el.overviewStrip.innerHTML = `
    ${cards}
    <article class="overview-card overview-card-summary">
      <div class="pulse-header">
        <span>Market Pulse</span>
        <strong>${state.marketPhase}</strong>
      </div>
      <div class="pulse-breadth-bar" title="${pulse.gainers} advancers · ${pulse.losers} decliners">
        <i class="pulse-breadth-fill" style="width:${breadthPct}%"></i>
      </div>
      <div class="pulse-stats">
        <div><span>Breadth</span><strong class="${breadthTone}">${pulse.gainers}↑ ${pulse.losers}↓</strong></div>
        <div><span>Avg</span><strong class="${pulse.avgChange >= 0 ? "positive" : "negative"}">${avgChangeStr}</strong></div>
      </div>
      <div class="pulse-leaders">
        <small class="positive" title="Strongest">▲ ${leader}</small>
        <small class="negative" title="Weakest">▼ ${laggard}</small>
      </div>
    </article>
  `;
  applyPriceTones(el.overviewStrip);
}

// Track the currently-rendered ticker symbol set so we can update prices
// in place without rebuilding the .ticker-track element. Rebuilding on every
// quote tick was restarting the marquee CSS animation back to translateX(0)
// — that's the visible "jitter" the user saw.
let lastTickerSignature = "";

function renderTickerTape() {
  if (!el.tickerTape) return;

  // Build a deduped union of: watchlist symbols + overview indices + active panel symbols
  const seen = new Set();
  const union = [];
  const push = (s) => {
    if (!s) return;
    const u = String(s).toUpperCase();
    if (seen.has(u)) return;
    seen.add(u);
    union.push(u);
  };
  state.watchlist.forEach(push);
  (state.overviewSymbols || []).forEach(push);
  Object.values(state.panelSymbols || {}).forEach(push);

  if (!union.length) {
    el.tickerTape.innerHTML = "";
    el.tickerTape.classList.add("is-empty");
    lastTickerSignature = "";
    return;
  }
  el.tickerTape.classList.remove("is-empty");

  const signature = union.join("|");

  // Hot path: same symbols as last render → just patch the price/change spans
  // on the existing DOM. Preserves the marquee animation state.
  if (signature === lastTickerSignature) {
    el.tickerTape.querySelectorAll(".ticker-item[data-broadcast-symbol]").forEach((node) => {
      const sym = node.dataset.broadcastSymbol;
      const quote = buildQuote(sym) || state.quotes.get(sym);
      if (!quote || quote.price == null) return;
      const priceEl = node.querySelector("em");
      const changeEl = node.querySelector("span");
      if (priceEl) priceEl.textContent = formatPrice(quote.price, sym);
      if (changeEl) {
        const change = Number(quote.changePct || 0);
        const tone = change >= 0 ? "positive" : "negative";
        const arrow = change >= 0 ? "▲" : "▼";
        changeEl.className = tone;
        changeEl.textContent = `${arrow} ${formatSignedPct(change)}`;
      }
    });
    return;
  }

  // Cold path: symbol set changed → rebuild and reset signature.
  const buildItem = (sym) => {
    const quote = buildQuote(sym) || state.quotes.get(sym);
    if (!quote || quote.price == null) {
      return `<span class="ticker-item is-loading"><strong>${sym}</strong><em>—</em></span>`;
    }
    const change = Number(quote.changePct || 0);
    const tone = change >= 0 ? "positive" : "negative";
    const arrow = change >= 0 ? "▲" : "▼";
    return `<button class="ticker-item" type="button" data-broadcast-symbol="${sym}">
      <strong>${sym}</strong>
      <em>${formatPrice(quote.price, sym)}</em>
      <span class="${tone}">${arrow} ${formatSignedPct(change)}</span>
    </button>`;
  };

  const itemsHtml = union.map(buildItem).join("");
  // Duplicate the items so the marquee can loop seamlessly via translateX(-50%)
  el.tickerTape.innerHTML = `
    <div class="ticker-track" data-ticker-track>
      <div class="ticker-segment">${itemsHtml}</div>
      <div class="ticker-segment" aria-hidden="true">${itemsHtml}</div>
    </div>
  `;
  lastTickerSignature = signature;
}

function renderRails() {
  if (el.watchlistRail) {
    // Group switcher chips (multi-watchlist)
    const groups = state.watchlistGroups || [];
    const activeId = state.activeWatchlistGroup;
    const groupChipsHtml = `
      <div class="watchlist-group-bar">
        ${groups.map((g) => {
          const isActive = g.id === activeId;
          const count = g.id === activeId ? state.watchlist.length : g.symbols.length;
          return `
            <div class="wl-group-chip ${isActive ? "is-active" : ""}">
              <button class="wl-group-btn" type="button" data-watchlist-group="${g.id}" title="Switch to ${g.name}">
                <strong>${g.name}</strong><small>${count}</small>
              </button>
              ${g.id !== "default" ? `<button class="wl-group-del" type="button" data-delete-watchlist-group="${g.id}" title="Delete group">×</button>` : ""}
            </div>
          `;
        }).join("")}
        ${groups.length < 6 ? `<button class="wl-group-add" type="button" data-create-watchlist-group title="New watchlist">+</button>` : ""}
      </div>
    `;

    const itemsHtml = state.watchlist
      .map((symbol) => {
        const quote = buildQuote(symbol);
        const changePct = Number(quote?.changePct || 0);
        const arrow = changePct >= 0 ? "▲" : "▼";
        return `
          <div class="rail-row">
            <button class="rail-item" type="button" data-broadcast-symbol="${symbol}">
              <div class="rail-item-head">
                <div>
                  <strong>${symbol}</strong>
                  <small>${quote?.name || "Waiting for quote"}</small>
                </div>
                <div class="rail-item-price">
                  <strong>${tabularValue(formatPrice(quote?.price || 0, symbol), { flashKey: `quote:${symbol}:price`, currentPrice: quote?.price || 0 })}</strong>
                  <small class="${changePct >= 0 ? "positive" : "negative"}">${quote?.isLive ? `${arrow} ${tabularValue(formatSignedPct(changePct))}` : "--"}</small>
                </div>
              </div>
              <div class="rail-item-spark">${renderOverviewSparkline(symbol, changePct)}</div>
            </button>
            <button class="rail-remove" type="button" data-remove-watch="${symbol}">×</button>
          </div>
        `;
      })
      .join("");

    const emptyHtml = state.watchlist.length
      ? ""
      : `<div class="empty-inline" style="margin:8px 4px;color:var(--muted);font-size:0.78rem">No symbols in this list yet. Use <code>WATCH AAPL</code> or click <em>+ Watchlist</em> from any quote.</div>`;

    el.watchlistRail.innerHTML = groupChipsHtml + itemsHtml + emptyHtml;
  }

  if (el.alertRail) {
    el.alertRail.innerHTML = state.alerts
      .map(
        (alert) => {
          const key = `${alert.symbol}:${alert.operator}:${alert.threshold}`;
          return `
        <div class="alert-row ${alert.status === "triggered" ? "is-triggered" : ""}" data-alert-key="${key}">
          <div class="alert-row-main">
            <strong>${alert.symbol}</strong>
            <span data-alert-edit="${key}" tabindex="0" role="button" title="Click to edit threshold">${alert.operator} <em>${Number(alert.threshold).toLocaleString()}</em></span>
            <small>${alert.status}</small>
          </div>
          <button class="alert-row-x" type="button" data-remove-alert="${key}" title="Delete alert" aria-label="Delete alert for ${alert.symbol}">✕</button>
        </div>
      `;
        },
      )
      .join("") || `<div class="empty-inline" style="margin:8px 4px;color:var(--muted);font-size:0.78rem">No alerts. Use <code>ALERT AAPL &gt;= 200</code> in the command bar.</div>`;
  }

  // Usage counters + tier-limit nudge cards
  if (el.watchCount) {
    el.watchCount.textContent = formatTierUsage(state.watchlist.length, FREE_WATCHLIST_LIMIT);
    el.watchCount.className = tierUsageClass(state.watchlist.length, FREE_WATCHLIST_LIMIT)
      ? `tier-badge ${tierUsageClass(state.watchlist.length, FREE_WATCHLIST_LIMIT)}`
      : "";
  }
  if (el.alertCount) {
    el.alertCount.textContent = formatTierUsage(state.alerts.length, FREE_ALERT_LIMIT);
    el.alertCount.className = tierUsageClass(state.alerts.length, FREE_ALERT_LIMIT)
      ? `tier-badge ${tierUsageClass(state.alerts.length, FREE_ALERT_LIMIT)}`
      : "";
  }

  // Append upgrade nudge at the bottom of each rail when free-tier is full
  if (el.watchlistRail && !isProUser() && state.watchlist.length >= FREE_WATCHLIST_LIMIT) {
    el.watchlistRail.insertAdjacentHTML(
      "beforeend",
      `<button class="rail-upgrade-nudge" type="button" data-open-pricing>
        ⚡ Limit reached · Upgrade for more
      </button>`,
    );
  }
  if (el.alertRail && !isProUser() && state.alerts.length >= FREE_ALERT_LIMIT) {
    el.alertRail.insertAdjacentHTML(
      "beforeend",
      `<button class="rail-upgrade-nudge" type="button" data-open-pricing>
        ⚡ Limit reached · Upgrade for more
      </button>`,
    );
  }

  applyPriceTones(el.watchlistRail || document);
}

function setActivePanel(panel) {
  appCore?.setActivePanel(panel);
}

function setFocusedPanel(panel) {
  appCore?.setFocusedPanel(panel);
}

function updateFocusLayout() {
  if (!el.workspaceGrid) return;
  el.workspaceGrid.classList.toggle("is-focused", Boolean(state.focusedPanel));
  document.querySelectorAll("[data-panel]").forEach((node) => {
    const panel = Number(node.dataset.panel);
    node.classList.toggle("is-focused", state.focusedPanel === panel);
  });
  if (el.resetFocusButton) {
    el.resetFocusButton.textContent = state.focusedPanel ? "All panels" : "Grid";
  }
  syncUiCache();
}

function cycleModule(panel, direction) {
  appCore?.cycleModule(panel, direction);
}

function loadModule(moduleName, panel, options = {}) {
  appCore?.loadModule(moduleName, panel, options);
}

function syncPanelData(panel) {
  const moduleName = state.panelModules[panel];
  const symbol = state.panelSymbols[panel] || "AAPL";

  if (moduleName === "quote") refreshQuotes([symbol]);
  if (moduleName === "chart") refreshChart(symbol, state.chartRanges[panel] || "1mo");
  if (moduleName === "options") refreshOptions(symbol, state.optionsSelection.expiration);
  if (moduleName === "news") refreshNews();
  if (moduleName === "macro") refreshFx();
  if (moduleName === "trade") {
    void refreshPaperAccount().then(() => renderPanel(panel)).catch((err) => { console.warn("[Meridian] paper refresh (trade panel):", err); renderPanel(panel); });
  }
}

function renderAllPanels() {
  [1, 2, 3, 4].forEach((panel) => void renderPanel(panel));
}

/**
 * Fetch AI commentary for a symbol and re-render the panel.
 *
 * Cache-aware: respects an in-flight request (no double-fetch) and
 * stores the result on `state.aiCommentary[symbol]` so the renderer
 * can show it on subsequent re-renders without re-hitting the LLM.
 * Surfaces errors via the toast system; the renderer falls back to
 * the empty state if no commentary lands.
 */
async function triggerAICommentary(symbol, panel) {
  const sym = String(symbol || "").trim().toUpperCase();
  if (!sym) return;
  if (!state.aiLoading) state.aiLoading = new Set();
  if (!state.aiCommentary) state.aiCommentary = new Map();

  if (state.aiLoading.has(sym)) return; // de-dupe in-flight requests

  state.aiLoading.add(sym);
  renderPanel(panel);

  try {
    const result = await aiApi.commentary(sym);
    state.aiCommentary.set(sym, result);
    // Toast is intentionally subtle — we don't want to spam the user
    // when they just wanted to read the panel. Only celebrate the
    // first time we wire up real LLM commentary.
    if (result?.source && result.source !== "template" && !state.aiSource) {
      state.aiSource = { source: result.source, model: result.model };
      try { showToast(`AI insights powered by ${result.source}`, "success", 3500); } catch {}
    }
  } catch (error) {
    const msg = String(error?.message || "");
    if (msg.includes("429")) {
      try { showToast("AI insights: rate-limited (1 per 5s). Try again in a moment.", "neutral", 4000); } catch {}
    } else {
      try { showToast(`AI insights failed: ${msg || "unknown error"}`, "error", 4000); } catch {}
    }
  } finally {
    state.aiLoading.delete(sym);
    renderPanel(panel);
  }
}

/**
 * Cheap, allocation-light 32-bit string hash. Not cryptographic — purely
 * for "did this generated HTML change since last paint?" equality checks.
 * Faster than full string comparison for the ~20–60KB blobs renderers
 * produce, and an order of magnitude smaller to stash on a dataset.
 */
function simpleStringHash(input) {
  let h = 5381;
  const str = String(input);
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  // Force unsigned and base36 so the dataset string stays short.
  return (h >>> 0).toString(36) + ":" + str.length.toString(36);
}

async function renderPanel(panel) {
  const panelNode = document.querySelector(`[data-panel="${panel}"]`);
  const title = document.querySelector(`#panelTitle${panel}`);
  const content = document.querySelector(`#panelContent${panel}`);
  if (!panelNode || !title || !content) return;
  const moduleName = state.panelModules[panel] || "home";

  try {
    const symbolLabel = ["quote", "chart", "options"].includes(moduleName) && state.panelSymbols[panel]
      ? ` · ${state.panelSymbols[panel]}`
      : "";
    title.textContent = `${moduleTitles[moduleName] || moduleName}${symbolLabel}`;
  } catch {}

  // For news panels: skip the full DOM rebuild when none of the news-relevant
  // inputs have changed. Without this, every 5s quote tick triggers
  // scheduleUiRefresh → renderAllPanels → news innerHTML wipe, which makes
  // the news area visibly blink and resets the user's scroll position.
  if (moduleName === "news") {
    const items = state.newsItems || [];
    const fp = [
      items.length,
      items[0]?.headline || "",
      items[0]?.time || "",
      state.newsFilter || "",
      state.newsSourceFilter || "",
      state.fetchErrors?.has("news") ? "err" : "ok",
    ].join("|");
    const prev = panelNode.dataset.newsFingerprint;
    const wasNews = panelNode.dataset.moduleKey === "NEWS";
    if (wasNews && prev === fp && content.firstElementChild) {
      // Same data + same filters + content already mounted: nothing to do.
      return;
    }
    panelNode.dataset.newsFingerprint = fp;
  } else if (panelNode.dataset.newsFingerprint) {
    delete panelNode.dataset.newsFingerprint;
  }

  // For chart panels: if chart is already mounted for this symbol+range, update data in-place
  // without touching innerHTML (avoids destroying and re-creating the canvas on every tick)
  if (moduleName === "chart") {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const range = state.chartRanges[panel] || "1mo";
    const interval = chartIntervalForRange(range);
    const points = state.chartCache.get(chartKey(symbol, range, interval)) || [];
    const view = chartViews.get(panel);
    if (view?.series && view.symbol === symbol && view.range === range && view.container?.isConnected) {
      const candles = toCandlestickData(points);
      if (candles.length) {
        try {
          view.series.setData(candles);
          view.chart.timeScale().fitContent();
          return; // Chart updated in-place — skip DOM replacement entirely
        } catch {
          // Corrupt chart state — fall through to full re-mount below
        }
      } else {
        return; // Data still loading — keep existing chart visible
      }
    }
  }

  const renderer = moduleRegistry?.get(moduleName) || moduleRegistry?.get("home");
  const previousModuleKey = panelNode.dataset.moduleKey;
  const newModuleKey = String(moduleName || "").toUpperCase();
  panelNode.dataset.moduleKey = newModuleKey;
  let html = "";
  try {
    if (!renderer) throw new Error(`No renderer for module: ${moduleName}`);
    html = await Promise.resolve(renderer(panel));
  } catch (renderError) {
    console.error(`[Meridian] Panel ${panel} render error (${moduleName}):`, renderError);
    html = `<div class="empty-state" style="color:var(--danger)">Render error: ${renderError.message}</div>`;
  }
  if (html == null) html = "";

  // Universal HTML-equality skip. Every renderer is deterministic given
  // the state inputs it reads. If the produced HTML is byte-identical
  // to the last paint AND the module didn't change AND the panel still
  // has content mounted, the innerHTML write is pure overhead. Without
  // this guard, the 5s refreshLiveQuotes tick → scheduleUiRefresh →
  // renderAllPanels visibly reflashes every panel even when nothing
  // they show actually changed. String comparison on ~50KB is
  // microseconds; a full innerHTML replace + reflow + paint is much
  // more expensive AND it loses scroll position, focus, and selection.
  const sameModule = previousModuleKey === newModuleKey;
  if (sameModule && content.dataset.lastHtmlHash && content.firstElementChild) {
    const newHash = simpleStringHash(html);
    if (newHash === content.dataset.lastHtmlHash) {
      return;
    }
    content.dataset.lastHtmlHash = newHash;
  } else {
    content.dataset.lastHtmlHash = simpleStringHash(html);
  }

  content.innerHTML = html;
  applyTerminalInputClass(content);
  applyPriceTones(content);

  if (moduleName === "chart") {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const range = state.chartRanges[panel] || "1mo";
    const interval = chartIntervalForRange(range);
    const points = state.chartCache.get(chartKey(symbol, range, interval)) || [];
    void mountCandlestickChart(panel, points);
  } else {
    clearPanelChart(panel);
  }
  try {
    document.dispatchEvent(new CustomEvent("meridian:panel-rendered", { detail: { panel, moduleName } }));
  } catch {}
}

function processCommand() {
  commandController?.processInput();
}

function handleCommandKeydown(event) {
  commandController?.handleCommandKeydown(event);
}

function renderAutocomplete() {
  const rawValue = String(el.commandInput?.value || "").trim();
  const value = rawValue.toUpperCase();
  if (!value) {
    hideAutocomplete();
    return;
  }

  const actionMatches = (actionEngine?.search(rawValue) || [])
    .slice(0, 4)
    .map((item) => ({ label: item.command, description: item.description, category: "action" }));
  const commandMatches = commandCatalog
    .filter((item) => item.cmd.includes(value))
    .slice(0, 5)
    .map((item) => ({ label: item.cmd, description: item.desc, category: "command" }));
  const symbolMatches = universe
    .filter((item) => item.symbol.startsWith(value) || item.name.toUpperCase().includes(value))
    .slice(0, 6)
    .map((item) => {
      const quote = state.quotes.get(item.symbol);
      const priceStr = quote ? formatPrice(quote.price, item.symbol) : "";
      const pctStr = quote ? formatSignedPct(quote.changePct) : "";
      const pctClass = quote && quote.changePct >= 0 ? "positive" : "negative";
      return {
        label: `${item.symbol} Q`,
        description: item.name,
        category: "symbol",
        extra: quote ? `<span class="ac-price">${priceStr}</span><span class="ac-pct ${pctClass}">${pctStr}</span>` : "",
      };
    });

  // Also search watchlist symbols not in universe
  const watchlistExtras = state.watchlist
    .filter((sym) => sym.toUpperCase().includes(value) && !universe.find((u) => u.symbol === sym))
    .slice(0, 3)
    .map((sym) => {
      const quote = state.quotes.get(sym);
      const priceStr = quote ? formatPrice(quote.price, sym) : "";
      const pctStr = quote ? formatSignedPct(quote.changePct) : "";
      const pctClass = quote && quote.changePct >= 0 ? "positive" : "negative";
      return {
        label: `${sym} Q`,
        description: quote?.name || sym,
        category: "symbol",
        extra: quote ? `<span class="ac-price">${priceStr}</span><span class="ac-pct ${pctClass}">${pctStr}</span>` : "",
      };
    });

  const suggestions = [...actionMatches, ...commandMatches, ...symbolMatches, ...watchlistExtras]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index)
    .slice(0, 12);

  if (!suggestions.length) {
    hideAutocomplete();
    return;
  }

  el.autocomplete.innerHTML = suggestions
    .map(
      (item) => `
        <button class="autocomplete-item" type="button" data-autocomplete="${item.label}">
          <div class="ac-left">
            <span class="ac-category-dot ac-cat-${item.category}"></span>
            <strong>${item.label}</strong>
            <span class="ac-desc">${item.description}</span>
          </div>
          ${item.extra ? `<div class="ac-right">${item.extra}</div>` : ""}
        </button>
      `,
    )
    .join("");
  el.autocomplete.classList.remove("hidden");
  // Reset keyboard highlight state whenever suggestions are redrawn
  commandController?.resetHighlight?.();
}

function hideAutocomplete() {
  el.autocomplete?.classList.add("hidden");
  commandController?.resetHighlight?.();
}

function renderOverviewSparkline(symbol, changePct = 0) {
  const points = state.overviewSparklineCache.get(symbol) || [];
  if (!points.length) {
    const tone = changePct >= 0 ? "positive" : "negative";
    return `<div class="overview-sparkline overview-sparkline-${tone}"><span></span><span></span><span></span><span></span><span></span></div>`;
  }

  const width = 78;
  const height = 24;
  const closes = points.map((point) => Number(point.close || point.price || 0)).filter((value) => Number.isFinite(value));
  if (!closes.length) {
    const tone = changePct >= 0 ? "positive" : "negative";
    return `<div class="overview-sparkline overview-sparkline-${tone}"><span></span><span></span><span></span><span></span><span></span></div>`;
  }
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = Math.max(max - min, 0.0001);
  const path = closes
    .map((price, index) => {
      const x = (index / Math.max(closes.length - 1, 1)) * width;
      const y = height - ((price - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const tone = closes[closes.length - 1] >= closes[0] ? "positive" : "negative";

  return `
    <svg class="overview-sparkline-svg ${tone}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${path}" />
    </svg>
  `;
}

function handleDocumentClick(event) {
  // AI Insights: "Generate insight" button — fetch commentary and re-render.
  const aiGenerateBtn = event.target.closest("[data-ai-generate]");
  if (aiGenerateBtn) {
    const symbol = aiGenerateBtn.dataset.aiGenerate;
    const panel = Number(aiGenerateBtn.dataset.panel) || state.activePanel || 1;
    void triggerAICommentary(symbol, panel);
    return;
  }
  // AI Insights: "Change symbol" button — prompt for a new ticker.
  const aiSymbolEditBtn = event.target.closest("[data-ai-symbol-edit]");
  if (aiSymbolEditBtn) {
    const panel = Number(aiSymbolEditBtn.dataset.aiSymbolEdit);
    const current = state.panelSymbols?.[panel] || "AAPL";
    const raw = window.prompt(`Analyze which symbol on panel ${panel}?`, current);
    const next = String(raw || "").trim().toUpperCase();
    if (next && next !== current) {
      state.panelSymbols[panel] = next;
      renderPanel(panel);
    }
    return;
  }

  // Mobile bottom tab nav: switch active panel without losing module state
  const mobileTabBtn = event.target.closest("[data-mobile-panel]");
  if (mobileTabBtn) {
    const targetPanel = Number(mobileTabBtn.dataset.mobilePanel);
    setActivePanel(targetPanel);
    return;
  }

  const panelNode = event.target.closest("[data-panel]");
  if (panelNode) setActivePanel(Number(panelNode.dataset.panel));

  const focusButton = event.target.closest("[data-panel-focus]");
  if (focusButton) {
    setFocusedPanel(Number(focusButton.dataset.panelFocus));
    return;
  }

  if (event.target.closest("[data-refresh-all]")) {
    refreshAllData();
    return;
  }

  // Chart compare overlay
  const compareBtn = event.target.closest("[data-chart-compare]");
  if (compareBtn) {
    const panel = Number(compareBtn.dataset.chartCompare);
    const current = state.chartCompareSymbol?.[panel];
    if (current) {
      // Toggle off
      state.chartCompareSymbol[panel] = null;
      renderPanel(panel);
    } else {
      const raw = window.prompt(`Compare ${state.panelSymbols[panel] || "AAPL"} against (enter a symbol):`, "SPY");
      const compareWith = String(raw || "").trim().toUpperCase();
      if (!compareWith) return;
      state.chartCompareSymbol[panel] = compareWith;
      const cRange = state.chartRanges[panel] || "1mo";
      showToast(`Loading compare data for ${compareWith}…`, "neutral");
      void refreshChart(compareWith, cRange).then(() => renderPanel(panel));
    }
    return;
  }

  // Watchlist group switching
  const groupSwitch = event.target.closest("[data-watchlist-group]");
  if (groupSwitch) {
    switchWatchlistGroup(groupSwitch.dataset.watchlistGroup);
    return;
  }
  const groupCreate = event.target.closest("[data-create-watchlist-group]");
  if (groupCreate) {
    const name = window.prompt("Name this watchlist (e.g. Tech, Energy, Crypto):", "");
    if (name) createWatchlistGroup(name);
    return;
  }
  const groupDelete = event.target.closest("[data-delete-watchlist-group]");
  if (groupDelete) {
    const id = groupDelete.dataset.deleteWatchlistGroup;
    const group = state.watchlistGroups.find((g) => g.id === id);
    if (group && window.confirm(`Delete watchlist "${group.name}"? Symbols are not deleted from quotes.`)) {
      deleteWatchlistGroup(id);
    }
    return;
  }

  // Position sizer quick-risk presets
  const posQuick = event.target.closest("[data-pos-quick]");
  if (posQuick) {
    const card = posQuick.closest("[data-position-sizer]");
    if (card) {
      const riskInput = card.querySelector('[data-pos-input="risk"]');
      if (riskInput) {
        riskInput.value = posQuick.dataset.posQuick;
        if (window.__updatePositionSizer) window.__updatePositionSizer(riskInput);
      }
    }
    return;
  }

  const cycle = event.target.closest("[data-panel-cycle]");
  if (cycle) {
    const [panel, direction] = cycle.dataset.panelCycle.split(":").map(Number);
    cycleModule(panel, direction);
    return;
  }

  const chartRangeButton = event.target.closest("[data-chart-range]");
  if (chartRangeButton) {
    const [panel, range] = chartRangeButton.dataset.chartRange.split(":");
    state.chartRanges[Number(panel)] = range;
    syncUiCache();
    refreshChart(state.panelSymbols[Number(panel)] || "AAPL", range);
    renderPanel(Number(panel));
    return;
  }

  const newsFilterButton = event.target.closest("[data-news-filter]");
  if (newsFilterButton) {
    state.newsFilter = newsFilterButton.dataset.newsFilter;
    syncUiCache();
    const newsPanels = [1, 2, 3, 4].filter((panel) => state.panelModules[panel] === "news");
    if (!newsPanels.length) loadModule("news", state.activePanel);
    newsPanels.forEach((panel) => renderPanel(panel));
    if (!newsPanels.length) renderPanel(state.activePanel);
    return;
  }

  // News source filter (CNBC / Yahoo Finance / MarketWatch)
  const newsSourceButton = event.target.closest("[data-news-source]");
  if (newsSourceButton) {
    state.newsSourceFilter = newsSourceButton.dataset.newsSource;
    const newsPanels = [1, 2, 3, 4].filter((panel) => state.panelModules[panel] === "news");
    newsPanels.forEach((panel) => renderPanel(panel));
    if (!newsPanels.length) renderPanel(state.activePanel);
    return;
  }

  const createAlertButton = event.target.closest("[data-create-alert]");
  if (createAlertButton) {
    const [symbol, operator, threshold] = createAlertButton.dataset.createAlert.split(":");
    createAlert(symbol, Number(threshold), operator || ">=");
    return;
  }

  const analyzeButton = event.target.closest("[data-analyze-symbol]");
  if (analyzeButton) {
    loadDeepDive(analyzeButton.dataset.analyzeSymbol, { panel: state.activePanel });
    return;
  }

  const openNewsButton = event.target.closest("[data-open-news-symbol]");
  if (openNewsButton) {
    openTickerNewsPanel(openNewsButton.dataset.openNewsSymbol);
    return;
  }

  const syncTickerButton = event.target.closest("[data-sync-symbol]");
  if (syncTickerButton) {
    syncTicker(syncTickerButton.dataset.syncSymbol);
    return;
  }

  const broadcastTrigger = event.target.closest("[data-broadcast-symbol]");
  if (broadcastTrigger) {
    broadcastSymbol(broadcastTrigger.dataset.broadcastSymbol);
    return;
  }

  const rulesTabBtn = event.target.closest("[data-rules-tab]");
  if (rulesTabBtn) {
    state.rulesActiveTab = rulesTabBtn.dataset.rulesTab;
    [1, 2, 3, 4].filter((p) => state.panelModules[p] === "rules").forEach((p) => renderPanel(p));
    return;
  }

  const notifSymbolLink = event.target.closest("[data-notif-symbol]");
  if (notifSymbolLink) {
    broadcastSymbol(notifSymbolLink.dataset.notifSymbol);
    closeNotifDrawer();
    return;
  }

  const moduleTrigger = event.target.closest("[data-load-module]");
  if (moduleTrigger) {
    const panel = Number(moduleTrigger.dataset.targetPanel || state.activePanel);
    if (moduleTrigger.dataset.targetSymbol) {
      state.panelSymbols[panel] = moduleTrigger.dataset.targetSymbol;
    }
    loadModule(moduleTrigger.dataset.loadModule, panel, { reveal: true });
    return;
  }

  const watchTrigger = event.target.closest("[data-watch-symbol]");
  if (watchTrigger) {
    addToWatchlist(watchTrigger.dataset.watchSymbol);
    return;
  }

  const removeWatch = event.target.closest("[data-remove-watch]");
  if (removeWatch) {
    removeFromWatchlist(removeWatch.dataset.removeWatch);
    return;
  }

  const removePosition = event.target.closest("[data-remove-position]");
  if (removePosition) {
    removePositionBySymbol(removePosition.dataset.removePosition);
    return;
  }

  // Toggle inline position edit row
  const togglePosEdit = event.target.closest("[data-toggle-pos-edit]");
  if (togglePosEdit) {
    const rowId = togglePosEdit.dataset.togglePosEdit;
    const editRow = document.getElementById(rowId);
    if (editRow) {
      const nowHidden = editRow.classList.toggle("hidden");
      if (!nowHidden) {
        editRow.querySelector("input")?.focus();
      }
    }
    return;
  }

  const exportPortfolio = event.target.closest("[data-export-portfolio]");
  if (exportPortfolio) {
    exportPortfolioCSV();
    return;
  }

  // Share portfolio performance card
  const sharePortfolioBtn = event.target.closest("[data-share-portfolio]");
  if (sharePortfolioBtn) {
    const action = sharePortfolioBtn.dataset.sharePortfolio;
    const text = sharePortfolioBtn.dataset.shareText || "";
    if (action === "copy") {
      navigator.clipboard?.writeText(text).then(() => {
        showToast("Performance summary copied to clipboard!", "success");
      }).catch(() => {
        // fallback for older browsers
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast("Performance summary copied!", "success");
      });
    } else if (action === "twitter") {
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
    }
    return;
  }

  const removeRule = event.target.closest("[data-remove-rule]");
  if (removeRule) {
    appCore?.removeRule(removeRule.dataset.removeRule);
    renderAllPanels();
    return;
  }

  // Rule / alert template quick-add
  const ruleTemplateBtn = event.target.closest("[data-rule-template]");
  if (ruleTemplateBtn) {
    const cmd = ruleTemplateBtn.dataset.ruleTemplate;
    if (cmd) {
      appCore?.dispatchRawCommand(cmd);
      renderAllPanels();
    }
    return;
  }

  // Delete a single alert by symbol:operator:threshold key
  const removeAlertBtn = event.target.closest("[data-remove-alert]");
  if (removeAlertBtn) {
    const [sym, op, thresh] = removeAlertBtn.dataset.removeAlert.split(":");
    const before = state.alerts.length;
    state.alerts = state.alerts.filter(
      (a) => !(a.symbol === sym && a.operator === op && String(a.threshold) === thresh),
    );
    if (state.alerts.length !== before) {
      queueWorkspaceSave();
      showToast("Alert deleted.", "neutral");
      renderRails();
      renderAllPanels();
    }
    return;
  }

  // Inline-edit an alert threshold in the sidebar rail.
  const editAlertEl = event.target.closest("[data-alert-edit]");
  if (editAlertEl && !editAlertEl.classList.contains("is-editing")) {
    const [sym, op, thresh] = editAlertEl.dataset.alertEdit.split(":");
    editAlertEl.classList.add("is-editing");
    const next = window.prompt(`New threshold for ${sym} (${op}):`, thresh);
    editAlertEl.classList.remove("is-editing");
    if (next != null) {
      const num = Number(String(next).replace(/[, ]/g, ""));
      if (Number.isFinite(num) && num > 0) {
        const idx = state.alerts.findIndex(
          (a) => a.symbol === sym && a.operator === op && String(a.threshold) === thresh,
        );
        if (idx >= 0) {
          state.alerts = state.alerts.map((a, i) =>
            i === idx ? { ...a, threshold: num, status: "watching" } : a,
          );
          queueWorkspaceSave();
          showToast(`${sym} threshold updated to ${num.toLocaleString()}.`, "success");
          renderRails();
          renderAllPanels();
        }
      } else if (next.trim() !== "") {
        showToast("Threshold must be a positive number.", "error");
      }
    }
    return;
  }

  const chartIndicatorToggle = event.target.closest("[data-chart-indicator]");
  if (chartIndicatorToggle) {
    const key = chartIndicatorToggle.dataset.chartIndicator;
    const indicators = state.chartIndicators || {};
    indicators[key] = !indicators[key];
    state.chartIndicators = { ...indicators };
    // Remount the chart on all chart panels to apply indicator changes
    [1, 2, 3, 4].filter((p) => state.panelModules[p] === "chart").forEach((p) => {
      clearPanelChart(p);
      renderPanel(p);
      const symbol = state.panelSymbols[p] || "AAPL";
      const range = state.chartRanges[p] || "1mo";
      const interval = chartIntervalForRange(range);
      const key2 = chartKey(symbol, range, interval);
      const pts = state.chartCache.get(key2);
      if (pts?.length) void mountCandlestickChart(p, pts);
    });
    return;
  }

  // Chart replay slider: scrub through historical data
  const replaySlider = event.target.closest("[data-chart-replay-slider]");
  if (replaySlider) {
    const panel = Number(replaySlider.dataset.chartReplaySlider);
    const index = Number(replaySlider.value);
    state.chartReplayIndex = state.chartReplayIndex || {};
    state.chartReplayIndex[panel] = index;
    state.chartReplayIsPlaying = state.chartReplayIsPlaying || {};
    state.chartReplayIsPlaying[panel] = false; // Pause on manual scrub
    renderPanel(panel);
    return;
  }

  // Chart replay play/pause button
  const replayToggle = event.target.closest("[data-chart-replay-toggle]");
  if (replayToggle) {
    const panel = Number(replayToggle.dataset.chartReplayToggle);
    state.chartReplayIsPlaying = state.chartReplayIsPlaying || {};
    const isCurrentlyPlaying = state.chartReplayIsPlaying[panel];
    state.chartReplayIsPlaying[panel] = !isCurrentlyPlaying;
    replayToggle.textContent = state.chartReplayIsPlaying[panel] ? "⏸ Pause" : "▶ Play";
    if (state.chartReplayIsPlaying[panel]) {
      animateChartReplay(panel);
    }
    return;
  }

  const refreshChartTrigger = event.target.closest("[data-refresh-chart]");
  if (refreshChartTrigger) {
    const [panel, symbol, range] = refreshChartTrigger.dataset.refreshChart.split(":");
    refreshChart(symbol, range || state.chartRanges[Number(panel)] || "1mo");
    return;
  }

  // ── Error-state retry buttons ────────────────────────────────────────
  const retryAction = event.target.closest("[data-action]");
  if (retryAction) {
    const action = retryAction.dataset.action;
    if (action === "refresh-chart") {
      try {
        const payload = JSON.parse(retryAction.dataset.payload || "{}");
        const { panel, symbol, range } = payload;
        if (symbol) refreshChart(symbol, range || state.chartRanges[Number(panel)] || "1mo");
      } catch { /* malformed payload */ }
      return;
    }
    if (action === "refresh-news") {
      void refreshNews().then(renderAllPanels);
      return;
    }
  }

  const refreshOptionsTrigger = event.target.closest("[data-refresh-options]");
  if (refreshOptionsTrigger) {
    const [, symbol] = refreshOptionsTrigger.dataset.refreshOptions.split(":");
    refreshOptions(symbol, state.optionsSelection.expiration);
    return;
  }

  const autocompleteItem = event.target.closest("[data-autocomplete]");
  if (autocompleteItem) {
    el.commandInput.value = autocompleteItem.dataset.autocomplete;
    processCommand();
    return;
  }

  const suggestedCommand = event.target.closest("[data-suggest-command]");
  if (suggestedCommand) {
    const command = suggestedCommand.dataset.suggestCommand;
    if (command && el.commandInput) {
      el.commandInput.value = command;
      processCommand();
    }
    return;
  }

  // Upgrade / pricing trigger
  if (event.target.closest("[data-open-pricing]")) {
    openPricingModal();
    return;
  }

  const openAuthTrigger = event.target.closest("[data-open-auth]");
  if (openAuthTrigger) {
    openAuthModal(openAuthTrigger.dataset.openAuth || "login");
    return;
  }

  const screenerSortBtn = event.target.closest("[data-screener-sort]");
  if (screenerSortBtn) {
    const [panelStr, key] = screenerSortBtn.dataset.screenerSort.split(":");
    const panel = Number(panelStr);
    const filters = state.screenerFilters[panel];
    if (filters.sortKey === key) {
      filters.sortDir = filters.sortDir === "asc" ? "desc" : "asc";
    } else {
      filters.sortKey = key;
      filters.sortDir = key === "symbol" || key === "name" ? "asc" : "desc";
    }
    renderPanel(panel);
    return;
  }

  const screenerClearBtn = event.target.closest("[data-screener-clear]");
  if (screenerClearBtn) {
    const panel = Number(screenerClearBtn.dataset.screenerClear);
    state.screenerFilters[panel] = { universe: "", sector: "", industry: "", search: "", minMarketCap: "", performance: "", maxPE: "", sortKey: "marketCap", sortDir: "desc" };
    renderPanel(panel);
    return;
  }

  const screenerPresetBtn = event.target.closest("[data-screener-preset]");
  if (screenerPresetBtn) {
    const [panelStr, idxStr] = screenerPresetBtn.dataset.screenerPreset.split(":");
    const panel = Number(panelStr);
    const idx = Number(idxStr);
    const preset = SCREENER_PRESETS[idx];
    if (!preset) return;
    const existing = state.screenerFilters[panel];
    state.screenerFilters[panel] = {
      ...existing,
      ...preset.filters,
      sortKey: existing.sortKey || "marketCap",
      sortDir: existing.sortDir || "desc",
    };
    renderPanel(panel);
    showToast(`Preset: ${preset.label}`, "neutral");
    return;
  }

  const screenerExportBtn = event.target.closest("[data-screener-export]");
  if (screenerExportBtn) {
    const panel = Number(screenerExportBtn.dataset.screenerExport);
    const filters = state.screenerFilters[panel];
    const liveUniverse = state.screenerUniverseLive;
    const workingUniverse = Array.isArray(liveUniverse) && liveUniverse.length ? liveUniverse : universe;
    const filtered = filterUniverse(workingUniverse, filters, buildQuote);
    const sortKey = filters.sortKey || "marketCap";
    const sortDir = filters.sortDir || "desc";
    const sorted = sortUniverse(filtered, sortKey, sortDir, buildQuote);

    const headers = ["Symbol", "Name", "Sector", "Industry", "Price", "Change%", "Volume", "MarketCap_B", "PE_Ratio", "52wk_Low", "52wk_High", "52wk_Pos%"];
    const rows = sorted.map((item) => {
      const q = buildQuote(item.symbol);
      const price = q?.price || item.seedPrice || 0;
      const changePct = q?.changePct != null ? q.changePct.toFixed(2) : "";
      const volume = q?.volume || "";
      const pe = q?.pe != null && q.pe > 0 ? q.pe.toFixed(1) : "";
      const low52 = q?.fiftyTwoWeekLow || "";
      const high52 = q?.fiftyTwoWeekHigh || "";
      const wkPos = (high52 && low52 && high52 > low52 && price)
        ? (((price - low52) / (high52 - low52)) * 100).toFixed(1)
        : "";
      return [
        item.symbol,
        `"${(item.name || "").replace(/"/g, '""')}"`,
        `"${(item.sector || "").replace(/"/g, '""')}"`,
        `"${(item.industry || "").replace(/"/g, '""')}"`,
        price.toFixed(2),
        changePct,
        volume,
        item.marketCapB || "",
        pe,
        low52,
        high52,
        wkPos,
      ].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meridian-screener-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${sorted.length} rows to CSV`, "success");
    return;
  }

  const heatmapResetBtn = event.target.closest("[data-heatmap-reset]");
  if (heatmapResetBtn) {
    state.heatmapFilter = { sector: "ALL", sort: "changePct" };
    renderPanel(Number(heatmapResetBtn.dataset.heatmapReset));
    return;
  }

  const tradeSymbolChip = event.target.closest("[data-trade-symbol]");
  if (tradeSymbolChip) {
    const panel = Number(tradeSymbolChip.dataset.targetPanel || state.activePanel);
    state.panelSymbols[panel] = tradeSymbolChip.dataset.tradeSymbol;
    syncUiCache();
    loadModule("trade", panel, { reveal: true });
    return;
  }

  const tradeCloseBtn = event.target.closest("[data-trade-close]");
  if (tradeCloseBtn) {
    const sym = tradeCloseBtn.dataset.tradeClose;
    const position = (state.paperAccount?.positions || []).find((p) => p.symbol === sym);
    if (!position) {
      showToast(`No position in ${sym} to close.`, "error");
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(`Close entire ${sym} position (${position.shares} shares)?`)) return;
    submitPaperOrder({ symbol: sym, side: "sell", shares: position.shares, panel: state.activePanel });
    return;
  }

  if (event.target.closest("[data-trade-reset]")) {
    resetPaperAccount();
    return;
  }

  const tradeSideBtn = event.target.closest("[data-trade-side]");
  if (tradeSideBtn) {
    event.preventDefault();
    const form = tradeSideBtn.closest("#tradeTicketForm");
    if (!form) return;
    const data = new FormData(form);
    const panel = Number(form.dataset.tradePanel || state.activePanel);
    const orderType = String(data.get("orderType") || "market");
    if (orderType === "market") {
      submitPaperOrder({
        symbol: String(data.get("symbol") || "").trim().toUpperCase(),
        side: tradeSideBtn.dataset.tradeSide,
        shares: Number(data.get("shares") || 0),
        panel,
      });
    } else {
      submitPaperPendingOrder({
        symbol: String(data.get("symbol") || "").trim().toUpperCase(),
        side: tradeSideBtn.dataset.tradeSide,
        shares: Number(data.get("shares") || 0),
        orderType,
        limitPrice: Number(data.get("limitPrice") || 0),
        panel,
      });
    }
    return;
  }

  const cancelPendingBtn = event.target.closest("[data-cancel-pending-order]");
  if (cancelPendingBtn) {
    const orderId = Number(cancelPendingBtn.dataset.cancelPendingOrder);
    if (orderId) cancelPaperPendingOrder(orderId);
    return;
  }

  if (!event.target.closest(".command-shell")) hideAutocomplete();
}

function handleDocumentInput(event) {
  const screenerSearch = event.target.closest("[data-screener-search]");
  if (screenerSearch) {
    state.screenerFilters[Number(screenerSearch.dataset.screenerSearch)].search = screenerSearch.value;
    renderPanel(Number(screenerSearch.dataset.screenerSearch));
    return;
  }

  const screenerUniverse = event.target.closest("[data-screener-universe]");
  if (screenerUniverse) {
    state.screenerFilters[Number(screenerUniverse.dataset.screenerUniverse)].universe = screenerUniverse.value;
    renderPanel(Number(screenerUniverse.dataset.screenerUniverse));
    return;
  }

  const screenerSector = event.target.closest("[data-screener-sector]");
  if (screenerSector) {
    state.screenerFilters[Number(screenerSector.dataset.screenerSector)].sector = screenerSector.value;
    renderPanel(Number(screenerSector.dataset.screenerSector));
    return;
  }

  const screenerIndustry = event.target.closest("[data-screener-industry]");
  if (screenerIndustry) {
    const panel = Number(screenerIndustry.dataset.screenerIndustry);
    state.screenerFilters[panel].industry = screenerIndustry.value;
    renderPanel(panel);
    return;
  }

  const screenerMinMcap = event.target.closest("[data-screener-min-mcap]");
  if (screenerMinMcap) {
    const panel = Number(screenerMinMcap.dataset.screenerMinMcap);
    state.screenerFilters[panel].minMarketCap = screenerMinMcap.value;
    renderPanel(panel);
    return;
  }

  const screenerPerf = event.target.closest("[data-screener-performance]");
  if (screenerPerf) {
    const panel = Number(screenerPerf.dataset.screenerPerformance);
    state.screenerFilters[panel].performance = screenerPerf.value;
    renderPanel(panel);
    return;
  }

  const screenerMaxPE = event.target.closest("[data-screener-max-pe]");
  if (screenerMaxPE) {
    const panel = Number(screenerMaxPE.dataset.screenerMaxPe);
    state.screenerFilters[panel].maxPE = screenerMaxPE.value;
    renderPanel(panel);
    return;
  }

  const heatmapSector = event.target.closest("[data-heatmap-sector]");
  if (heatmapSector) {
    state.heatmapFilter.sector = heatmapSector.value;
    renderPanel(Number(heatmapSector.dataset.heatmapSector));
    return;
  }

  const heatmapSort = event.target.closest("[data-heatmap-sort]");
  if (heatmapSort) {
    state.heatmapFilter.sort = heatmapSort.value;
    renderPanel(Number(heatmapSort.dataset.heatmapSort));
    return;
  }

  const optionsExpiry = event.target.closest("[data-options-expiry]");
  if (optionsExpiry) {
    const panel = Number(optionsExpiry.dataset.optionsExpiry);
    state.optionsSelection.expiration = optionsExpiry.value || null;
    syncUiCache();
    refreshOptions(state.panelSymbols[panel] || state.optionsSelection.symbol, state.optionsSelection.expiration);
    return;
  }

  const calcInputNode = event.target.closest("[data-calc-key]");
  if (calcInputNode) {
    setNestedCalculatorValue(calcInputNode.dataset.calcKey, Number(calcInputNode.value));
    renderAllPanels();
  }

  // Order type selector — show/hide the limit price field without a full re-render
  const orderTypeSelect = event.target.closest(".trade-order-type-select");
  if (orderTypeSelect) {
    const form = orderTypeSelect.closest("#tradeTicketForm");
    if (!form) return;
    const panel = form.dataset.tradePanel;
    const limitField = document.getElementById(`tradeLimitPriceField${panel}`);
    if (limitField) {
      limitField.style.display = orderTypeSelect.value === "market" ? "none" : "";
    }
  }
}

function ensureShortcutsOverlay() {
  let overlay = document.getElementById("shortcutsOverlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "shortcutsOverlay";
  overlay.className = "shortcuts-overlay hidden";
  overlay.innerHTML = `
    <div class="shortcuts-panel">
      <header class="shortcuts-head">
        <div>
          <h3>Meridian Reference</h3>
          <small style="color:var(--muted);font-size:0.74rem">Keyboard shortcuts &amp; command syntax</small>
        </div>
        <button type="button" class="icon-btn" data-close-shortcuts title="Close">✕</button>
      </header>
      <div class="shortcuts-grid">
        <div class="shortcut-section">
          <h4>⌨ Navigation</h4>
          <div class="shortcut-row"><kbd>Tab</kbd><span>Cycle active panel</span></div>
          <div class="shortcut-row"><kbd>F</kbd><span>Focus current panel (fullscreen)</span></div>
          <div class="shortcut-row"><kbd>G</kbd><span>Return to grid view</span></div>
          <div class="shortcut-row"><kbd>/</kbd><span>Open command palette</span></div>
          <div class="shortcut-row"><kbd>⌘K</kbd><span>Open command palette</span></div>
          <div class="shortcut-row"><kbd>?</kbd><span>This reference overlay</span></div>
          <div class="shortcut-row"><kbd>Esc</kbd><span>Close any overlay / modal</span></div>
        </div>
        <div class="shortcut-section">
          <h4>📺 Module Keys</h4>
          <div class="shortcut-row"><kbd>F1</kbd><span>Meridian Briefing</span></div>
          <div class="shortcut-row"><kbd>F2</kbd><span>Home dashboard</span></div>
          <div class="shortcut-row"><kbd>F3</kbd><span>Quote view</span></div>
          <div class="shortcut-row"><kbd>F4</kbd><span>Price chart</span></div>
          <div class="shortcut-row"><kbd>F5</kbd><span>News feed</span></div>
          <div class="shortcut-row"><kbd>F6</kbd><span>Equity screener</span></div>
          <div class="shortcut-row"><kbd>F7</kbd><span>Sector heatmap</span></div>
          <div class="shortcut-row"><kbd>F8</kbd><span>Portfolio tracker</span></div>
          <div class="shortcut-row"><kbd>F9</kbd><span>Paper trading desk</span></div>
          <div class="shortcut-row"><kbd>F10</kbd><span>Options chain</span></div>
          <div class="shortcut-row"><kbd>F11</kbd><span>Macro / yields</span></div>
        </div>
        <div class="shortcut-section">
          <h4>💬 Core Commands</h4>
          <div class="shortcut-row"><code>AAPL Q</code><span>Open quote for AAPL</span></div>
          <div class="shortcut-row"><code>AAPL CHART</code><span>Open chart for AAPL</span></div>
          <div class="shortcut-row"><code>CHART SPY 2Y</code><span>Chart with inline range (1M to 5Y / ALL)</span></div>
          <div class="shortcut-row"><code>WATCH TSLA</code><span>Add to watchlist</span></div>
          <div class="shortcut-row"><code>ALERT NVDA &gt;= 130</code><span>Price alert (≥ or ≤)</span></div>
          <div class="shortcut-row"><code>ANALYZE MSFT</code><span>Deep research view</span></div>
          <div class="shortcut-row"><code>OPTIONS NVDA</code><span>Options chain</span></div>
          <div class="shortcut-row"><code>CALC</code><span>Black-Scholes &amp; bond calculator</span></div>
          <div class="shortcut-row"><code>NEWS AAPL</code><span>Filter news by symbol</span></div>
          <div class="shortcut-row"><code>FOCUS 2</code><span>Focus panel 2</span></div>
          <div class="shortcut-row"><code>GRID</code><span>Return to grid</span></div>
        </div>
        <div class="shortcut-section">
          <h4>📈 Trading &amp; Rules</h4>
          <div class="shortcut-row"><code>BUY AAPL 10</code><span>Paper buy 10 shares</span></div>
          <div class="shortcut-row"><code>SELL NVDA 5</code><span>Paper sell 5 shares</span></div>
          <div class="shortcut-row"><code>ADDPOS MSFT 5 410</code><span>Track portfolio position (symbol shares cost)</span></div>
          <div class="shortcut-row"><code>REMOVEPOS MSFT</code><span>Remove a position</span></div>
          <div class="shortcut-row"><code>REMOVEALERT NVDA</code><span>Clear alerts for a symbol</span></div>
          <div class="shortcut-row"><code>CLEARRULES</code><span>Remove all active rules</span></div>
          <div class="shortcut-row"><code>IF SPY &gt; 520 THEN Breakout</code><span>Create a live rule</span></div>
          <div class="shortcut-row"><code>IF VIX &gt; 20 THEN Hedge</code><span>Volatility rule</span></div>
          <div class="shortcut-row"><code>RANGE 2Y</code><span>Set chart range (5D / 1M to 1Y / 2Y / 5Y / ALL)</span></div>
          <div class="shortcut-row"><code>SAVE</code><span>Save workspace now</span></div>
          <div class="shortcut-row"><code>REFRESH</code><span>Fetch latest data</span></div>
        </div>
      </div>
      <footer class="shortcuts-foot">
        <span>Press <kbd>?</kbd> any time to reopen · <kbd>/</kbd> for command palette</span>
        <span class="shortcuts-version">Meridian Terminal</span>
      </footer>
    </div>
  `;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-close-shortcuts]")) {
      closeShortcutsOverlay();
    }
  });
  document.body.appendChild(overlay);
  return overlay;
}

function toggleShortcutsOverlay() {
  const overlay = ensureShortcutsOverlay();
  if (overlay.classList.contains("hidden")) {
    overlay.classList.remove("hidden");
  } else {
    overlay.classList.add("hidden");
  }
}

function closeShortcutsOverlay() {
  const overlay = document.getElementById("shortcutsOverlay");
  if (overlay) overlay.classList.add("hidden");
}

function handleDocumentSubmit(event) {
  const tradeForm = event.target.closest("#tradeTicketForm");
  if (tradeForm) {
    event.preventDefault();
    const submitter = event.submitter;
    const side = submitter?.dataset.tradeSide || "buy";
    const data = new FormData(tradeForm);
    const panel = Number(tradeForm.dataset.tradePanel || state.activePanel);
    submitPaperOrder({
      symbol: String(data.get("symbol") || "").trim().toUpperCase(),
      side,
      shares: Number(data.get("shares") || 0),
      panel,
    });
    return;
  }

  const addPositionForm = event.target.closest("#addPositionForm");
  if (addPositionForm) {
    event.preventDefault();
    const data = new FormData(addPositionForm);
    addPosition({
      symbol: String(data.get("symbol") || "").toUpperCase(),
      shares: Number(data.get("shares") || 0),
      cost: Number(data.get("cost") || 0),
    });
    addPositionForm.reset();
    return;
  }

  // Inline position edit form
  const editPositionForm = event.target.closest("[data-edit-position]");
  if (editPositionForm) {
    event.preventDefault();
    const symbol = editPositionForm.dataset.editPosition;
    const data = new FormData(editPositionForm);
    const shares = Number(data.get("shares") || 0);
    const cost = Number(data.get("cost") || 0);
    if (!symbol || shares <= 0 || cost < 0) {
      showToast("Shares must be positive and cost must be non-negative.", "error");
      return;
    }
    // Update the position in state by removing old and adding updated
    state.positions = state.positions.filter((p) => p.symbol !== symbol);
    state.positions.push({ symbol, shares, cost });
    queueWorkspaceSave();
    showToast(`${symbol} updated: ${shares} sh @ $${cost.toFixed(2)}`, "success");
    [1, 2, 3, 4].filter((p) => state.panelModules[p] === "portfolio").forEach((p) => renderPanel(p));
    return;
  }
}

function handleGlobalHotkeys(event) {
  if (event.key === "Escape") {
    const shortcutsOverlay = document.getElementById("shortcutsOverlay");
    const shortcutsOpen = shortcutsOverlay && !shortcutsOverlay.classList.contains("hidden");
    const hadOverlayOpen =
      shortcutsOpen ||
      !el.paletteBackdrop?.classList.contains("hidden") ||
      !el.authModalBackdrop?.classList.contains("hidden") ||
      !el.settingsModalBackdrop?.classList.contains("hidden");

    if (hadOverlayOpen) {
      event.preventDefault();
      event.stopPropagation();
    }

    closeShortcutsOverlay();
    closeSettingsModal();
    closeAuthModal();
    closeCommandPalette();
    return;
  }

  if (event.key === "?" && !event.metaKey && !event.ctrlKey) {
    const activeTag = document.activeElement?.tagName;
    if (activeTag && ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;
    event.preventDefault();
    toggleShortcutsOverlay();
    return;
  }

  const activeTag = document.activeElement?.tagName;
  const inEditable = Boolean(activeTag && ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag));
  const cmdOrCtrl = event.metaKey || event.ctrlKey;

  if (!inEditable && event.key === "/") {
    event.preventDefault();
    openCommandPalette();
    return;
  }

  if (cmdOrCtrl && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandPalette();
    return;
  }

  if (inEditable && event.key !== "Escape") return;

  const hotkeys = {
    F1: "briefing",
    F2: "home",
    F3: "quote",
    F4: "chart",
    F5: "news",
    F6: "screener",
    F7: "heatmap",
    F8: "portfolio",
    F9: "trade",
    F10: "options",
    F11: "macro",
  };

  if (event.key === "Tab") {
    event.preventDefault();
    setActivePanel((state.activePanel % 4) + 1);
    return;
  }

  if (event.key.toUpperCase() === "G") {
    setFocusedPanel(null);
    return;
  }

  if (event.key.toUpperCase() === "F") {
    setFocusedPanel(state.activePanel);
    return;
  }

  if (hotkeys[event.key]) {
    event.preventDefault();
    loadModule(hotkeys[event.key], state.activePanel, { reveal: true });
    return;
  }

}

function addToWatchlist(symbol) {
  const upper = symbol.toUpperCase();
  if (!state.watchlist.includes(upper)) {
    if (checkFreeTierLimit(state.watchlist.length, FREE_WATCHLIST_LIMIT, "watchlist symbols")) return;
    state.watchlist.unshift(upper);
    state.watchlist = state.watchlist.slice(0, 50);
    syncActiveGroupFromWatchlist();
    refreshQuotes([upper]);
    renderRails();
    renderTickerTape();
    queueWorkspaceSave();
    showToast(`${upper} added to watchlist.`, "success");
  }
}

function clearAlerts() {
  state.alerts = [];
  renderRails();
  queueWorkspaceSave();
  showToast("Alerts cleared.", "neutral");
}

function clearNotificationsHistory() {
  state.notifications = [];
  lastNotifCount = 0;
  notifManager?.clearHistory();
  renderNotifDrawer();
  queueWorkspaceSave();
  showToast("Notifications cleared.", "neutral");
}

function removeFromWatchlist(symbol) {
  state.watchlist = state.watchlist.filter((item) => item !== symbol);
  syncActiveGroupFromWatchlist();
  renderRails();
  renderTickerTape();
  queueWorkspaceSave();
}

function createAlert(symbol, threshold, operator) {
  if (!symbol || Number.isNaN(threshold)) return;
  if (checkFreeTierLimit(state.alerts.length, FREE_ALERT_LIMIT, "price alerts")) return;
  state.alerts.unshift({ symbol: symbol.toUpperCase(), operator, threshold, status: "watching" });
  state.alerts = state.alerts.slice(0, 50);
  evaluateAlerts();
  renderRails();
  queueWorkspaceSave();
  showToast(`Alert set for ${symbol.toUpperCase()}.`, "success");
}

function addPosition(position) {
  if (!position.symbol || !position.shares || !position.cost) return;
  state.positions.unshift({ ...position, symbol: position.symbol.toUpperCase() });
  renderAllPanels();
  queueWorkspaceSave();
  refreshQuotes([position.symbol.toUpperCase()]);
  showToast(`Position added for ${position.symbol.toUpperCase()}.`, "success");
}

function removePositionBySymbol(symbol) {
  state.positions = state.positions.filter((position) => position.symbol !== symbol);
  renderAllPanels();
  queueWorkspaceSave();
}

function exportPortfolioCSV() {
  const rows = enrichPositions();
  if (!rows.length) {
    showToast("No positions to export.", "neutral");
    return;
  }
  const header = ["Symbol", "Shares", "Avg Cost", "Market Price", "Value", "P/L", "Return %"];
  const lines = rows.map((row) => {
    const ret = row.cost ? (((row.price - row.cost) / row.cost) * 100).toFixed(2) : "0.00";
    return [row.symbol, row.shares, row.cost.toFixed(2), row.price.toFixed(2), row.value.toFixed(2), row.pnl.toFixed(2), ret].join(",");
  });
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meridian-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Portfolio exported.", "success");
}

function deleteSymbol(symbol) {
  const ticker = String(symbol || "").trim().toUpperCase();
  if (!ticker) return;

  const before = {
    watchlist: state.watchlist.length,
    alerts: state.alerts.length,
    positions: state.positions.length,
    rules: state.activeRules.length,
  };

  state.watchlist = state.watchlist.filter((item) => item !== ticker);
  state.alerts = state.alerts.filter((item) => item.symbol !== ticker);
  state.positions = state.positions.filter((item) => item.symbol !== ticker);
  state.activeRules = state.activeRules.filter((item) => item.symbol !== ticker);
  syncActiveGroupFromWatchlist();

  const changed =
    before.watchlist !== state.watchlist.length ||
    before.alerts !== state.alerts.length ||
    before.positions !== state.positions.length ||
    before.rules !== state.activeRules.length;

  if (!changed) {
    showToast(`${ticker} was not in the local workspace.`, "neutral");
    return;
  }

  renderRails();
  renderAllPanels();
  queueWorkspaceSave();
  showToast(`${ticker} removed from local workspace.`, "success");
}

function toggleRulesTab() {
  state.rulesActiveTab = state.rulesActiveTab === "history" ? "rules" : "history";
  [1, 2, 3, 4].filter((panel) => state.panelModules[panel] === "rules").forEach((panel) => renderPanel(panel));
  syncUiCache();
  showToast(`Rules panel set to ${state.rulesActiveTab}.`, "neutral");
}

function setCompactMode(nextValue = !state.compactMode) {
  state.compactMode = Boolean(nextValue);
  applyWorkspaceModes();
  syncUiCache();
  showToast(`Compact mode ${state.compactMode ? "enabled" : "disabled"}.`, "neutral");
}

function setTheme(nextTheme = "dark") {
  const theme = nextTheme === "light" ? "light" : "dark";
  state.theme = theme;
  applyWorkspaceModes();
  syncUiCache();
  showToast(`Theme set to ${theme}.`, "neutral");
}

function queueWorkspaceSave() {
  workspaceController?.queueSave();
  queueMeridianStatePersist();
}

async function refreshAllData() {
  // Manual refresh clears the cache to force fresh data.
  _dataCache.overview.ts = 0;
  _dataCache.quotes.ts = 0;
  setNetworkStatus(state.user ? "Live · Syncing" : "Guest · Syncing");
  const symbols = [
    ...new Set([
      ...state.watchlist,
      ...state.positions.map((item) => item.symbol),
      ...Object.values(state.panelSymbols),
      ...state.overviewSymbols,
    ]),
  ];

  const chartRequests = [1, 2, 3, 4]
    .filter((panel) => state.panelModules[panel] === "chart")
    .map((panel) => refreshChart(state.panelSymbols[panel] || "AAPL", state.chartRanges[panel] || "1mo"));

  const optionRequests = [1, 2, 3, 4]
    .filter((panel) => state.panelModules[panel] === "options")
    .map((panel) => refreshOptions(state.panelSymbols[panel] || state.optionsSelection.symbol, state.optionsSelection.expiration));

  const sparklineSymbols = [...new Set([...state.overviewSymbols, ...state.watchlist])];
  const overviewSparklineRequests = sparklineSymbols.map((symbol) => refreshOverviewSparkline(symbol));

  await Promise.allSettled([
    checkHealth(),
    refreshOverview(),
    refreshQuotes(symbols),
    refreshNews(),
    refreshFx(),
    refreshMacroYields(),
    refreshScreenerUniverse(),
    ...overviewSparklineRequests,
    ...chartRequests,
    ...optionRequests,
  ]);

  state.lastDataFetchedAt = Date.now();
  renderOverviewStrip();
  renderTickerTape();
  renderRails();
  renderAllPanels();
  updateStatusBar();
  setNetworkStatus(state.user ? "Live · Saved" : state.health.ok ? "Guest · Live" : "Guest · Local");
}

async function loadDeepDive(symbol, { panel = state.activePanel } = {}) {
  const ticker = String(symbol || "").trim().toUpperCase();
  if (!ticker) return;
  state.deepDiveLoading.add(ticker);
  renderPanel(panel);

  const payload = await getStockDeepDive(ticker);
  if (payload) {
    state.deepDiveCache.set(ticker, payload);
    showToast(payload.available ? `${ticker} analysis loaded.` : `${ticker} loaded with fallback research.`, payload.available ? "success" : "neutral");
  } else {
    showToast(`Unable to load deep insight for ${ticker}.`, "error");
  }

  state.deepDiveLoading.delete(ticker);
  renderPanel(panel);
  if (state.newsFilter === ticker) renderPanel(4);
}

function openTickerNewsPanel(symbol) {
  const ticker = String(symbol || "").trim().toUpperCase();
  if (!ticker) return;
  state.newsFilter = ticker;
  state.panelModules[4] = "news";
  renderPanel(4);
  revealPanelIfNeeded(4);
}

function syncTicker(symbol) {
  const ticker = String(symbol || "").trim().toUpperCase();
  if (!ticker) return;
  if (!state.watchlist.includes(ticker)) {
    state.watchlist.unshift(ticker);
    state.watchlist = [...new Set(state.watchlist)].slice(0, 16);
    syncActiveGroupFromWatchlist();
    renderRails();
    renderTickerTape();
  }
  queueWorkspaceSave();
  showToast(state.user ? `${ticker} synced to your workspace.` : `${ticker} saved to local workspace.`, "success");
}

function broadcastSymbol(symbol) {
  const ticker = String(symbol || "").trim().toUpperCase();
  if (!ticker) return;
  [1, 2, 3, 4].forEach((panel) => {
    state.panelSymbols[panel] = ticker;
  });
  state.newsFilter = ticker;
  renderAllPanels();
  refreshAllData();
  showToast(`${ticker} broadcast to all panels.`, "success");
}

function toggleNotifDrawer() {
  if (el.notifDrawer?.classList.contains("is-open")) {
    closeNotifDrawer();
  } else {
    openNotifDrawer();
  }
}

function openNotifDrawer() {
  el.notifDrawer?.classList.add("is-open");
  el.notifBackdrop?.classList.remove("hidden");
  renderNotifDrawer();
  notifManager?.markAllSeen();
  updateNotifBadge();
}

function closeNotifDrawer() {
  el.notifDrawer?.classList.remove("is-open");
  el.notifBackdrop?.classList.add("hidden");
}

function renderNotifDrawer() {
  if (!el.notifHistory) return;
  const history = notifManager?.getHistory() || [];
  if (!history.length) {
    el.notifHistory.innerHTML = `<li class="notif-empty">No notifications yet. Rule triggers appear here in real-time.</li>`;
    return;
  }
  el.notifHistory.innerHTML = history
    .map((item) => {
      const time = new Date(item.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const symbolChip = item.symbol
        ? `<button class="notif-symbol-chip" type="button" data-notif-symbol="${item.symbol}">${item.symbol}</button>`
        : "";
      return `
        <li class="notif-item">
          <div class="notif-item-head">
            <span class="notif-item-title">${item.title}</span>
            ${symbolChip}
            <span class="notif-item-time">${time}</span>
          </div>
          <p class="notif-item-body">${item.body}</p>
        </li>
      `;
    })
    .join("");
}

function updateNotifBadge() {
  if (!el.notifBadge) return;
  const count = notifManager?.getUnseenCount() || 0;
  if (count > 0) {
    el.notifBadge.textContent = count > 9 ? "9+" : String(count);
    el.notifBadge.classList.remove("hidden");
  } else {
    el.notifBadge.classList.add("hidden");
  }
}

function getRenderableNewsItems(filterSymbol) {
  const ticker = String(filterSymbol || "ALL").toUpperCase();
  if (ticker !== "ALL") {
    const deepDiveNews = state.deepDiveCache.get(ticker)?.news || [];
    if (deepDiveNews.length) {
      return deepDiveNews.map((item) => ({
        source: item.source || "Feed",
        headline: item.headline || item.title || "Untitled",
        time: item.time || item.pubDate || "Live",
        link: item.link || "#",
        sentiment: item.sentiment || scoreHeadlineSentiment(item.headline || item.title || ""),
      }));
    }
  }

  return filterNewsItems(filterSymbol).map((item) => ({
    source: item.source || "Feed",
    headline: item.headline || item.title || "Untitled",
    time: item.time || item.pubDate || "Live",
    link: item.link || "#",
    sentiment: item.sentiment || scoreHeadlineSentiment(item.headline || item.title || ""),
  }));
}

function scoreHeadlineSentiment(text) {
  const content = String(text || "").toLowerCase();
  const positiveTerms = ["beat", "upgrade", "growth", "record", "surge", "gain", "strong"];
  const negativeTerms = ["miss", "downgrade", "drop", "cut", "fall", "weak", "risk"];
  const positiveHits = positiveTerms.filter((term) => content.includes(term)).length;
  const negativeHits = negativeTerms.filter((term) => content.includes(term)).length;
  if (positiveHits > negativeHits) return "Positive";
  if (negativeHits > positiveHits) return "Negative";
  return "Neutral";
}

async function refreshPaperAccount() {
  if (!AUTH_ENABLED || !state.user) {
    state.paperAccount = null;
    return;
  }
  try {
    const snapshot = await paperApi.account();
    const prevPending = (state.paperAccount?.pendingOrders || []).length;
    state.paperAccount = snapshot;
    // Notify user when a pending order was auto-filled
    (snapshot.newlyFilled || []).forEach((fill) => {
      const typeLabel = fill.orderType.charAt(0).toUpperCase() + fill.orderType.slice(1);
      showToast(
        `${typeLabel} order filled: ${fill.side.toUpperCase()} ${fill.shares} ${fill.symbol} @ $${Number(fill.price).toFixed(2)}`,
        "success",
      );
    });
    if ((snapshot.newlyFilled || []).length > 0) {
      const tradePanel = [1, 2, 3, 4].find((p) => state.panelModules[p] === "trade");
      if (tradePanel) renderPanel(tradePanel);
    }
  } catch {
    state.paperAccount = null;
  }
}

async function refreshMacroYields() {
  try {
    const payload = await marketApi.yields();
    if (Array.isArray(payload?.curve) && payload.curve.length) {
      state.macroYields = payload.curve;
    }
  } catch {
    // silently fall back to macroDefaults.curve in the renderer
  }
}

async function refreshScreenerUniverse() {
  if (state.screenerUniverseLive) return; // fetch once per session
  try {
    const payload = await marketApi.screenerUniverse();
    if (Array.isArray(payload?.universe) && payload.universe.length) {
      state.screenerUniverseLive = payload.universe;
    }
  } catch {
    // ignore — screener falls back to local static universe
  }
}

async function submitPaperOrder({ symbol, side, shares, panel }) {
  if (!state.user) {
    showToast("Sign in to use paper trading.", "error");
    openAuthModal("login");
    return;
  }
  const ticker = String(symbol || "").trim().toUpperCase();
  const qty = Number(shares);
  if (!ticker) {
    showToast("Enter a symbol first.", "error");
    return;
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    showToast("Shares must be a positive number.", "error");
    return;
  }
  try {
    const snapshot = await paperApi.order({ symbol: ticker, side, shares: qty });
    state.paperAccount = snapshot;
    const fill = snapshot.lastFill || {};
    const verb = side === "buy" ? "Bought" : "Sold";
    const priceLabel = Number(fill.price || 0).toFixed(2);
    showToast(
      `${verb} ${qty} ${ticker} @ $${priceLabel}${side === "sell" && fill.realizedPl ? ` · P/L ${fill.realizedPl >= 0 ? "+" : ""}$${Number(fill.realizedPl).toFixed(2)}` : ""}`,
      side === "sell" && fill.realizedPl >= 0 ? "success" : "success",
    );
    (snapshot.newlyUnlocked || []).forEach((key) => {
      const item = (snapshot.achievements || []).find((a) => a.key === key);
      if (item) {
        showToast(`Achievement unlocked: ${item.title}`, "success");
        notifManager?.push({
          type: "achievement",
          title: `Achievement · ${item.title}`,
          body: item.description,
        });
      }
    });
    if (panel) renderPanel(panel);
  } catch (error) {
    showToast(error.message || "Order rejected.", "error");
  }
}

async function resetPaperAccount() {
  if (!state.user) return;
  if (typeof window !== "undefined" && !window.confirm("Reset your paper account to $100,000? All positions and fills will be cleared.")) {
    return;
  }
  try {
    const snapshot = await paperApi.reset();
    state.paperAccount = snapshot;
    showToast("Paper account reset to $100,000.", "success");
    renderAllPanels();
  } catch (error) {
    showToast(error.message || "Reset failed.", "error");
  }
}

async function submitPaperPendingOrder({ symbol, side, shares, orderType, limitPrice, panel }) {
  if (!state.user) {
    showToast("Sign in to use paper trading.", "error");
    openAuthModal("login");
    return;
  }
  const ticker = String(symbol || "").trim().toUpperCase();
  const qty = Number(shares);
  const lp = Number(limitPrice);
  if (!ticker) { showToast("Enter a symbol first.", "error"); return; }
  if (!Number.isFinite(qty) || qty <= 0) { showToast("Shares must be a positive number.", "error"); return; }
  if (!Number.isFinite(lp) || lp <= 0) { showToast("Limit/stop price must be a positive number.", "error"); return; }
  try {
    const snapshot = await paperApi.placePendingOrder({ symbol: ticker, side, shares: qty, orderType, limitPrice: lp });
    state.paperAccount = snapshot;
    const typeLabel = orderType.charAt(0).toUpperCase() + orderType.slice(1);
    showToast(`${typeLabel} order placed: ${side.toUpperCase()} ${qty} ${ticker} @ $${lp.toFixed(2)}`, "success");
    if (panel) renderPanel(panel);
  } catch (error) {
    showToast(error.message || "Order rejected.", "error");
  }
}

async function cancelPaperPendingOrder(orderId) {
  if (!state.user) return;
  try {
    const snapshot = await paperApi.cancelPendingOrder(orderId);
    state.paperAccount = snapshot;
    showToast("Pending order cancelled.", "success");
    const tradePanel = [1, 2, 3, 4].find((p) => state.panelModules[p] === "trade");
    if (tradePanel) renderPanel(tradePanel);
  } catch (error) {
    showToast(error.message || "Cancel failed.", "error");
  }
}

async function refreshLiveQuotes() {
  // Lightweight refresh — only prices for overview strip + watched symbols.
  // Triggers the flash animation pipeline via state mutations without the
  // heavy cost of a full refreshAllData (charts, news, options, fx).
  const symbols = [
    ...new Set([
      ...state.watchlist,
      ...Object.values(state.panelSymbols),
    ]),
  ];
  try {
    await Promise.allSettled([
      refreshOverview(),
      symbols.length ? refreshQuotes(symbols) : Promise.resolve(),
      state.user ? refreshPaperAccount() : Promise.resolve(),
    ]);
    state.lastDataFetchedAt = Date.now();
  } catch {
    // noop — fast ticks are best-effort
  }
}

async function refreshOverview() {
  // Serve cache only when it covers every currently-watched overview symbol.
  // Reduces API calls ~85% on the 5s refresh tick without going stale when
  // the user customizes their overview strip.
  const cached = _getCached("overview");
  const covers = cached?.quotes && state.overviewSymbols.every(
    (sym) => cached.quotes.some((q) => q.symbol === sym),
  );
  if (covers) {
    state.overviewQuotes = cached.quotes;
    if (cached.phase) state.marketPhase = cached.phase;
    return;
  }

  // Try backend overview endpoint
  try {
    const payload = await marketApi.overview(state.overviewSymbols);
    if ((payload.quotes || []).length) {
      state.overviewQuotes = payload.quotes.map((q) => ({ ...q, isLive: true }));
      if (payload.phase) state.marketPhase = payload.phase;
      _setCached("overview", { quotes: state.overviewQuotes, phase: payload.phase });
      return;
    }
  } catch {
    // fall through to direct
  }
  // Direct Yahoo fallback
  try {
    const results = await fetchQuotes(state.overviewSymbols);
    state.overviewQuotes = results.map((q) => ({
      symbol: q.symbol,
      price: q.price,
      changePct: q.changePct,
      isLive: true,
    }));
    _setCached("overview", { quotes: state.overviewQuotes });
  } catch {
    // noop
  }
}

async function refreshQuotes(symbols) {
  // Cache hit only if the cached payload covers every requested symbol.
  // Otherwise a watchlist add would silently leave the new ticker blank
  // for up to 30s while the cache lives. Always re-evaluate alerts since
  // the user may have added rules between ticks.
  const cached = _getCached("quotes");
  const covers = cached && symbols.every((sym) => cached.some((q) => q.symbol === sym));
  if (covers) {
    cached.forEach((q) => state.quotes.set(q.symbol, q));
    evaluateAlerts();
    return;
  }

  // Try backend first; fall back to direct Yahoo fetch
  try {
    const payload = await marketApi.quotes(symbols);
    (payload.quotes || []).forEach((q) => {
      state.quotes.set(q.symbol, q);
      state.fetchErrors.delete(`quote:${q.symbol}`);
    });
    _setCached("quotes", payload.quotes || []);
    evaluateAlerts();
    return;
  } catch {
    // backend unavailable, try direct
  }
  try {
    const results = await fetchQuotes(symbols);
    results.forEach((q) => {
      state.quotes.set(q.symbol, q);
      state.fetchErrors.delete(`quote:${q.symbol}`);
    });
    _setCached("quotes", results);
    evaluateAlerts();
  } catch (err) {
    const msg = err?.message || "Quote fetch failed";
    symbols.forEach((sym) => {
      if (!state.quotes.has(sym)) {
        state.fetchErrors.set(`quote:${sym}`, { message: msg, ts: Date.now() });
      }
    });
  }
}

async function refreshOverviewSparkline(symbol) {
  try {
    const payload = await marketApi.chart(symbol, "5d", "1h");
    state.overviewSparklineCache.set(symbol, payload.points || []);
    return;
  } catch {
    // backend unavailable — try direct
  }

  try {
    const points = await fetchChart(symbol, "5d", "1h");
    state.overviewSparklineCache.set(symbol, points || []);
  } catch {
    // noop
  }
}

async function refreshChart(symbol, range = "1mo") {
  const interval = chartIntervalForRange(range);
  const key = chartKey(symbol, range, interval);
  state.chartLoading.add(key);
  state.fetchErrors.delete(`chart:${key}`);
  renderAllPanels();
  // Try backend first
  try {
    const payload = await marketApi.chart(symbol, range, interval);
    state.chartCache.set(key, payload.points || []);
    state.fetchErrors.delete(`chart:${key}`);
    state.chartLoading.delete(key);
    renderAllPanels();
    return;
  } catch {
    // backend unavailable — try direct
  }
  try {
    const points = await fetchChart(symbol, range, interval);
    if (points.length) {
      state.chartCache.set(key, points);
      state.fetchErrors.delete(`chart:${key}`);
    }
  } catch (err) {
    state.fetchErrors.set(`chart:${key}`, { message: err?.message || "Chart data unavailable", ts: Date.now() });
  } finally {
    state.chartLoading.delete(key);
    renderAllPanels();
  }
}

async function refreshOptions(symbol, date) {
  state.optionsSelection.symbol = symbol;
  const storeResult = (payload) => {
    if (!state.optionsSelection.expiration && payload.expirations?.length) {
      state.optionsSelection.expiration = payload.expirations[0];
    }
    state.optionsCache.set(optionsKey(symbol, date || "nearest"), payload);
    if (state.optionsSelection.expiration) {
      state.optionsCache.set(optionsKey(symbol, state.optionsSelection.expiration), payload);
    }
    renderAllPanels();
  };
  // Try backend first
  try {
    const payload = await marketApi.options(symbol, date);
    storeResult(payload);
    return;
  } catch {
    // backend unavailable — try direct
  }
  try {
    const payload = await fetchOptions(symbol, date);
    storeResult(payload);
  } catch {
    // noop
  }
}

async function refreshNews() {
  // Try backend first
  try {
    const payload = await marketApi.news();
    if ((payload.items || []).length) {
      state.newsItems = payload.items;
      state.fetchErrors.delete("news");
      return;
    }
  } catch {
    // fall through to direct
  }
  // Direct RSS fallback via services.js
  try {
    const items = await fetchNews();
    state.newsItems = items;
    if (items.length) state.fetchErrors.delete("news");
  } catch (err) {
    if (!state.newsItems.length) {
      state.fetchErrors.set("news", { message: err?.message || "News feed unavailable", ts: Date.now() });
    }
  }
}

async function refreshFx() {
  // Try backend first
  try {
    const payload = await marketApi.fx();
    if (Object.keys(payload.rates || {}).length) {
      state.fxRates = payload.rates;
      return;
    }
  } catch {
    // fall through to direct
  }
  // Direct ER-API fallback
  try {
    state.fxRates = await fetchFxRates();
  } catch {
    // noop
  }
}

function handleRefreshCountdown() {
  state.refreshCountdown -= 1;
  if (state.refreshCountdown <= 0) {
    state.refreshCountdown = 30;
    refreshAllData();
  }
  updateStatusBar();
}

function updateStatusBar() {
  if (el.lastUpdated) el.lastUpdated.textContent = currentTimeShort(lastStateUpdatedAt);
  if (el.refreshCountdown) el.refreshCountdown.textContent = `${state.refreshCountdown}s`;
  if (el.watchCount) {
    el.watchCount.textContent = formatTierUsage(state.watchlist.length, FREE_WATCHLIST_LIMIT);
    const wc = tierUsageClass(state.watchlist.length, FREE_WATCHLIST_LIMIT);
    el.watchCount.className = wc ? `tier-badge ${wc}` : "";
  }
  if (el.alertCount) {
    el.alertCount.textContent = formatTierUsage(state.alerts.length, FREE_ALERT_LIMIT);
    const ac = tierUsageClass(state.alerts.length, FREE_ALERT_LIMIT);
    el.alertCount.className = ac ? `tier-badge ${ac}` : "";
  }
  if (el.marketPhase) el.marketPhase.textContent = state.marketPhase;
  if (el.serverStatus) {
    el.serverStatus.textContent = state.health.ok ? "Live" : "Offline";
    el.serverStatus.classList.toggle("chip-server-offline", !state.health.ok);
  }
  updateWakeBanner();
  updateMarketClock();
}

function updateMarketClock() {
  const clockEl = document.querySelector("#marketClock");
  if (!clockEl) return;
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = ny.getDay();
  const h = ny.getHours();
  const m = ny.getMinutes();
  const s = ny.getSeconds();
  const totalMins = h * 60 + m;

  let label = "";
  let secsToNext = 0;

  if (day === 0 || day === 6) {
    // Weekend — countdown to Monday 4:00 AM ET pre-market
    const daysToMon = day === 6 ? 2 : 1;
    secsToNext = daysToMon * 86400 - totalMins * 60 - s + 4 * 3600;
    label = "Opens Mon";
  } else if (totalMins < 4 * 60) {
    // Overnight, before 4 AM — pre-market starts at 4:00 AM
    secsToNext = (4 * 60 - totalMins) * 60 - s;
    label = "Pre-mkt";
  } else if (totalMins < 9 * 60 + 30) {
    // Pre-market, opens at 9:30 AM
    secsToNext = (9 * 60 + 30 - totalMins) * 60 - s;
    label = "Opens";
  } else if (totalMins < 16 * 60) {
    // Market open, closes at 4:00 PM
    secsToNext = (16 * 60 - totalMins) * 60 - s;
    label = "Closes";
  } else if (totalMins < 20 * 60) {
    // After hours, ends at 8:00 PM
    secsToNext = (20 * 60 - totalMins) * 60 - s;
    label = "AH ends";
  } else {
    // Late night — next pre-market at 4:00 AM
    secsToNext = (24 * 60 - totalMins + 4 * 60) * 60 - s;
    label = "Pre-mkt";
  }

  if (secsToNext <= 0) secsToNext = 0;
  const hh = Math.floor(secsToNext / 3600);
  const mm = String(Math.floor((secsToNext % 3600) / 60)).padStart(2, "0");
  const ss = String(secsToNext % 60).padStart(2, "0");
  const countdown = hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
  clockEl.textContent = `${label} ${countdown}`;
}

function updateSessionClock() {
  const elapsed = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
  const hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  if (el.sessionClock) el.sessionClock.textContent = `${hours}:${minutes}:${seconds}`;

  // Update market clock dot color based on current phase
  const dot = document.querySelector("#marketClockDot");
  if (dot) {
    const phase = state.marketPhase || "";
    if (phase === "Market open" || phase === "Open") {
      dot.style.background = "var(--success)";
    } else if (phase === "Pre-market" || phase === "After hours" || phase === "After-hours") {
      dot.style.background = "var(--warning)";
    } else {
      dot.style.background = "var(--muted)";
    }
  }
  updateMarketClock();
}

function evaluateAlerts() {
  const newlyTriggered = [];
  state.alerts = state.alerts.map((alert) => {
    const quote = buildQuote(alert.symbol);
    if (!quote) return alert;
    const triggered = alert.operator === ">=" ? quote.price >= alert.threshold : quote.price <= alert.threshold;
    const wasWatching = alert.status !== "triggered";
    if (triggered && wasWatching) {
      newlyTriggered.push({ alert, price: quote.price });
    }
    return { ...alert, status: triggered ? "triggered" : "watching" };
  });

  // Fire toasts + notifications for newly-triggered alerts only (deduped)
  newlyTriggered.forEach(({ alert, price }) => {
    const message = `${alert.symbol} ${alert.operator} ${Number(alert.threshold).toLocaleString()}. Now: $${Number(price).toFixed(2)}`;
    showToast(message, "success");
    notifManager?.push({
      type: "alert-trigger",
      title: `Alert · ${alert.symbol}`,
      body: message,
      symbol: alert.symbol,
    });
  });
}

function buildQuote(symbol) {
  const base = universeMap.get(symbol);
  const live = state.quotes.get(symbol);
  const deepDive = state.deepDiveCache.get(symbol);
  const profile = deepDive?.profile || {};
  const financials = deepDive?.financials || {};
  if (!base && !live) return null;
  return {
    symbol,
    isLive: !!live,
    name: live?.name || base?.name || symbol,
    exchange: live?.exchange || base?.exchange || "N/A",
    sector: base?.sector || "Market",
    universe: base?.universe || "Custom",
    price: live?.price || base?.seedPrice || 0,
    changePct: Number(live?.changePct || 0),
    change: Number(live?.change || 0),
    marketCap: live?.marketCap || base?.marketCap || 0,
    volume: live?.volume || 0,
    averageVolume: live?.averageVolume || 0,
    dayHigh: live?.dayHigh || live?.price || base?.seedPrice || 0,
    dayLow: live?.dayLow || live?.price || base?.seedPrice || 0,
    previousClose: live?.previousClose || base?.seedPrice || 0,
    fiftyTwoWeekHigh: live?.fiftyTwoWeekHigh || profile.fiftyTwoWeekHigh || live?.dayHigh || 0,
    fiftyTwoWeekLow: live?.fiftyTwoWeekLow || profile.fiftyTwoWeekLow || live?.dayLow || 0,
    trailingPE: live?.trailingPE ?? financials.trailingPE ?? profile.trailingPE ?? null,
    // Shorthand alias used by Screener & OptionsRenderer — also read direct from live data if server sent it
    pe: live?.pe ?? live?.trailingPE ?? financials.trailingPE ?? profile.trailingPE ?? null,
    epsTrailingTwelveMonths: live?.epsTrailingTwelveMonths ?? financials.epsTrailingTwelveMonths ?? profile.epsTrailingTwelveMonths ?? null,
    dividendYield: live?.dividendYield ?? financials.dividendYield ?? profile.dividendYield ?? null,
    beta: live?.beta ?? financials.beta ?? profile.beta ?? null,
    bid: live?.bid ?? null,
    ask: live?.ask ?? null,
    bidSize: live?.bidSize ?? null,
    askSize: live?.askSize ?? null,
    earningsTimestamp: live?.earningsTimestamp ?? financials.earningsTimestamp ?? profile.earningsTimestamp ?? null,
  };
}

function enrichPositions() {
  return state.positions.map((position) => {
    const quote = buildQuote(position.symbol);
    const price = quote?.price || position.cost;
    const value = price * position.shares;
    const basis = position.cost * position.shares;
    const pnl = value - basis;
    const pnlPct = basis ? (pnl / basis) * 100 : 0;
    const previousClose = Number(quote?.previousClose || price);
    const dayChange = (price - previousClose) * position.shares;
    const dayChangePct = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;
    return { ...position, price, value, pnl, pnlPct, previousClose, dayChange, dayChangePct };
  });
}

function calculatePortfolioSummary() {
  const rows = enrichPositions();
  const value = rows.reduce((sum, row) => sum + row.value, 0);
  const basis = rows.reduce((sum, row) => sum + row.cost * row.shares, 0);
  const pnl = value - basis;
  return { value, pnl, pnlPct: basis ? (pnl / basis) * 100 : 0 };
}

function setNestedCalculatorValue(path, value) {
  const [root, field] = path.split(".");
  if (!state.calculator[root]) return;
  if (Number.isFinite(value)) state.calculator[root][field] = value;
}

function chartKey(symbol, range, interval) {
  return `${symbol}:${range}:${interval}`;
}

function optionsKey(symbol, expiration) {
  return `${symbol}:${expiration || "nearest"}`;
}

function normalizeCandle(point, previousClose = null) {
  const close = Number(point.close ?? point.price ?? 0);
  const open = Number(point.open ?? previousClose ?? close);
  const high = Number(point.high ?? Math.max(open, close));
  const low = Number(point.low ?? Math.min(open, close));
  const time = Number(point.timestamp ?? point.time ?? 0);
  return {
    time,
    open,
    high,
    low,
    close,
  };
}

function toCandlestickData(points) {
  let previousClose = null;
  return points
    .map((point) => {
      const candle = normalizeCandle(point, previousClose);
      previousClose = candle.close;
      return candle;
    })
    .filter((candle) => candle.time > 0 && Number.isFinite(candle.open) && Number.isFinite(candle.high) && Number.isFinite(candle.low) && Number.isFinite(candle.close));
}

function clearPanelChart(panel) {
  const existing = chartViews.get(panel);
  if (!existing) return;
  existing.disconnectResizeObserver?.();
  existing.chart.remove();
  chartViews.delete(panel);
}

function fitAllCharts() {
  chartViews.forEach(({ chart, container }) => {
    const width = Math.max(320, Math.floor(container.clientWidth || 0));
    const height = Math.max(220, Math.floor(container.clientHeight || 0));
    chart.resize(width, height);
    chart.timeScale().fitContent();
  });
}

async function loadLightweightChartsModule() {
  if (lightweightChartsModulePromise) return lightweightChartsModulePromise;

  lightweightChartsModulePromise = (async () => {
    const candidates = [
      new URL("../node_modules/lightweight-charts/dist/lightweight-charts.production.mjs", import.meta.url).href,
      new URL("../node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.mjs", import.meta.url).href,
      "https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.production.mjs",
      "https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.mjs",
    ];

    for (const candidate of candidates) {
      try {
        const moduleRef = await import(candidate);
        if (moduleRef?.createChart) return moduleRef;
      } catch {
        // try next candidate
      }
    }

    return null;
  })();

  return lightweightChartsModulePromise;
}

function animateChartReplay(panel) {
  const replayIndex = (state.chartReplayIndex = state.chartReplayIndex || {});
  const replayIsPlaying = (state.chartReplayIsPlaying = state.chartReplayIsPlaying || {});
  const symbol = state.panelSymbols[panel] || "AAPL";
  const range = state.chartRanges[panel] || "1mo";
  const interval = chartIntervalForRange(range);
  const cacheKey = chartKey(symbol, range, interval);
  const points = state.chartCache.get(cacheKey) || [];

  if (!points.length || !replayIsPlaying[panel]) return;

  // Advance one candle every 50ms
  const currentIndex = replayIndex[panel] || 0;
  const nextIndex = Math.min(currentIndex + 1, points.length - 1);

  replayIndex[panel] = nextIndex;

  // Update slider and label
  const slider = document.querySelector(`[data-chart-replay-slider="${panel}"]`);
  const label = document.querySelector(`[data-chart-replay-label="${panel}"]`);
  if (slider) slider.value = nextIndex;
  if (label && points[nextIndex]) {
    label.textContent = new Date(points[nextIndex].timestamp || points[nextIndex].time || Date.now()).toLocaleDateString();
  }

  // Re-render chart with filtered candles
  const chartView = chartViews.get(panel);
  if (chartView?.chart && chartView?.series) {
    const filteredCandles = toCandlestickData(points.slice(0, nextIndex + 1));
    chartView.series.setData(filteredCandles);
    chartView.chart.timeScale()?.fitContent?.();
  }

  // Continue animation if still playing
  if (nextIndex < points.length - 1 && replayIsPlaying[panel]) {
    window.setTimeout(() => animateChartReplay(panel), 50);
  } else {
    // Stop at the end
    replayIsPlaying[panel] = false;
    const toggle = document.querySelector(`[data-chart-replay-toggle="${panel}"]`);
    if (toggle) toggle.textContent = "▶ Play";
  }
}

async function mountCandlestickChart(panel, points) {
  const candles = toCandlestickData(points);
  clearPanelChart(panel);
  if (!candles.length) return;

  // Stamp a generation — if the DOM re-renders while we await, we'll abort
  const gen = (chartMountGeneration.get(panel) || 0) + 1;
  chartMountGeneration.set(panel, gen);

  const chartLib = await loadLightweightChartsModule();

  // Abort if a newer mountCandlestickChart call has started since we began
  if (chartMountGeneration.get(panel) !== gen) return;

  // Re-query container AFTER the await — DOM may have been replaced during the async gap
  const container = document.querySelector(`#chartCanvas${panel}`);
  if (!container) return;

  if (!chartLib?.createChart) {
    container.innerHTML = `<div class="stack"><span class="skeleton-box lg"></span><span class="skeleton-box"></span><span class="skeleton-box sm"></span></div>`;
    return;
  }

  const width = Math.max(320, Math.floor(container.clientWidth || 0));
  const height = 380;

  const chart = chartLib.createChart(container, {
    width,
    height,
    layout: {
      textColor: "#E5E5E5",
      background: { color: "transparent" },
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
    rightPriceScale: {
      borderVisible: false,
    },
    leftPriceScale: {
      visible: false,
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: chartLib.CrosshairMode?.Normal ?? 0,
      vertLine: { visible: true, labelVisible: true, color: "#4A90E2" },
      horzLine: { visible: true, labelVisible: true, color: "#4A90E2" },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      vertTouchDrag: true,
      horzTouchDrag: true,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  });

  const seriesOptions = {
    upColor: "#00E676",
    downColor: "#FF3B30",
    borderVisible: false,
    wickUpColor: "#00E676",
    wickDownColor: "#FF3B30",
  };

  let series = null;
  if (typeof chart.addCandlestickSeries === "function") {
    series = chart.addCandlestickSeries(seriesOptions);
  } else if (typeof chart.addSeries === "function" && chartLib.CandlestickSeries) {
    series = chart.addSeries(chartLib.CandlestickSeries, seriesOptions);
  }

  if (!series) {
    chart.remove();
    container.innerHTML = `<div class="empty-inline">Chart engine not compatible.</div>`;
    return;
  }

  // Apply replay filter if active
  const replayIndex = (state.chartReplayIndex = state.chartReplayIndex || {})[panel];
  const candlesToDisplay = replayIndex != null ? candles.slice(0, replayIndex + 1) : candles;
  series.setData(candlesToDisplay);

  const ind = state.chartIndicators || {};

  // ── Helper: add a line series (compatible with v4 and v5 API) ──
  function addLine(opts) {
    if (typeof chart.addLineSeries === "function") return chart.addLineSeries(opts);
    if (typeof chart.addSeries === "function" && chartLib.LineSeries) return chart.addSeries(chartLib.LineSeries, opts);
    return null;
  }

  // ── Volume histogram ──
  if (ind.volume !== false) {
    const volumeData = points
      .map((point) => {
        const time = Number(point.timestamp ?? point.time ?? 0);
        const vol = Number(point.volume ?? 0);
        const close = Number(point.close ?? point.price ?? 0);
        const open = Number(point.open ?? close);
        if (time <= 0 || !Number.isFinite(vol)) return null;
        return { time, value: vol, color: close >= open ? "rgba(0, 230, 118, 0.18)" : "rgba(255, 59, 48, 0.18)" };
      })
      .filter(Boolean);

    if (volumeData.length) {
      const volumeOptions = {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
        lastValueVisible: false,
        priceLineVisible: false,
      };
      let volumeSeries = null;
      if (typeof chart.addHistogramSeries === "function") {
        volumeSeries = chart.addHistogramSeries(volumeOptions);
      } else if (typeof chart.addSeries === "function" && chartLib.HistogramSeries) {
        volumeSeries = chart.addSeries(chartLib.HistogramSeries, volumeOptions);
      }
      if (volumeSeries) {
        volumeSeries.setData(volumeData);
        chart.priceScale("volume").applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 },
          drawTicks: false,
          borderVisible: false,
          visible: false,
        });
      }
    }
  }

  // ── SMA(20) — simple moving average ──
  if (ind.sma20 !== false && candles.length >= 20) {
    const maData = [];
    for (let i = 19; i < candles.length; i++) {
      let sum = 0;
      for (let j = i - 19; j <= i; j++) sum += candles[j].close;
      maData.push({ time: candles[i].time, value: sum / 20 });
    }
    const maSeries = addLine({ color: "rgba(111, 143, 255, 0.6)", lineWidth: 1.5, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: false });
    if (maSeries) maSeries.setData(maData);
  }

  // ── EMA(9) — exponential moving average ──
  if (ind.ema9 && candles.length >= 9) {
    const period = 9;
    const multiplier = 2 / (period + 1);
    const emaData = [];
    let ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
    emaData.push({ time: candles[period - 1].time, value: ema });
    for (let i = period; i < candles.length; i++) {
      ema = (candles[i].close - ema) * multiplier + ema;
      emaData.push({ time: candles[i].time, value: ema });
    }
    const emaSeries = addLine({ color: "rgba(255, 167, 38, 0.8)", lineWidth: 1.5, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: false });
    if (emaSeries) emaSeries.setData(emaData);
  }

  // ── Bollinger Bands (20, 2σ) ──
  if (ind.bollinger && candles.length >= 20) {
    const period = 20;
    const bandMult = 2;
    const upperData = [];
    const lowerData = [];
    for (let i = period - 1; i < candles.length; i++) {
      const windowCloses = [];
      for (let j = i - period + 1; j <= i; j++) windowCloses.push(candles[j].close);
      const mean = windowCloses.reduce((s, v) => s + v, 0) / period;
      const variance = windowCloses.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
      const stdDev = Math.sqrt(variance);
      upperData.push({ time: candles[i].time, value: mean + bandMult * stdDev });
      lowerData.push({ time: candles[i].time, value: mean - bandMult * stdDev });
    }
    const bandOpts = { lineWidth: 1, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: false };
    const upperSeries = addLine({ ...bandOpts, color: "rgba(156, 185, 255, 0.45)" });
    const lowerSeries = addLine({ ...bandOpts, color: "rgba(156, 185, 255, 0.45)" });
    if (upperSeries) upperSeries.setData(upperData);
    if (lowerSeries) lowerSeries.setData(lowerData);
  }

  // ── VWAP — volume-weighted average price ──
  if (ind.vwap && points.length >= 2) {
    let cumVol = 0;
    let cumTP = 0;
    const vwapData = [];
    for (const point of points) {
      const time = Number(point.timestamp ?? point.time ?? 0);
      const vol = Number(point.volume ?? 0);
      const tp = (Number(point.high || point.close) + Number(point.low || point.close) + Number(point.close)) / 3;
      if (time <= 0 || !Number.isFinite(vol) || vol === 0) continue;
      cumVol += vol;
      cumTP += tp * vol;
      vwapData.push({ time, value: cumTP / cumVol });
    }
    if (vwapData.length > 1) {
      const vwapSeries = addLine({ color: "rgba(233, 30, 99, 0.7)", lineWidth: 1.5, lineStyle: 2, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: false });
      if (vwapSeries) vwapSeries.setData(vwapData);
    }
  }

  // ── RSI(14) on separate scale — shown as faint background line ──
  if (ind.rsi !== false && candles.length >= 15) {
    const closes = candles.map((c) => c.close);
    const rsiData = [];
    const period = 14;
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) avgGain += diff;
      else avgLoss -= diff;
    }
    avgGain /= period;
    avgLoss /= period;
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsiData.push({ time: candles[i].time, value: 100 - 100 / (1 + rs) });
    }
    if (rsiData.length) {
      const rsiSeries = addLine({
        color: "rgba(255, 200, 60, 0.45)",
        lineWidth: 1,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceScaleId: "rsi",
      });
      if (rsiSeries) {
        rsiSeries.setData(rsiData);
        chart.priceScale("rsi").applyOptions({
          scaleMargins: { top: 0.85, bottom: 0.02 },
          drawTicks: false,
          borderVisible: false,
          visible: false,
        });
      }
    }
  }

  // ── MACD(12,26,9) — MACD line, signal line, histogram ──
  if (ind.macd && candles.length >= 35) {
    const closes = candles.map((c) => c.close);

    // Compute EMA helper
    function computeEma(data, period) {
      const mult = 2 / (period + 1);
      const result = new Array(data.length).fill(null);
      let ema = data.slice(0, period).reduce((s, v) => s + v, 0) / period;
      result[period - 1] = ema;
      for (let i = period; i < data.length; i++) {
        ema = (data[i] - ema) * mult + ema;
        result[i] = ema;
      }
      return result;
    }

    const ema12 = computeEma(closes, 12);
    const ema26 = computeEma(closes, 26);

    // MACD line starts where both EMAs are valid (index 25+)
    const macdLine = closes.map((_, i) =>
      ema12[i] != null && ema26[i] != null ? ema12[i] - ema26[i] : null,
    );

    // Signal = EMA(9) of MACD line — seed from index 25 (first valid MACD)
    const firstValidMacd = macdLine.findIndex((v) => v != null);
    const signalLine = new Array(candles.length).fill(null);
    if (firstValidMacd >= 0 && firstValidMacd + 9 <= candles.length) {
      const validMacd = macdLine.slice(firstValidMacd).filter((v) => v != null);
      const mult = 2 / (9 + 1);
      let sig = validMacd.slice(0, 9).reduce((s, v) => s + v, 0) / 9;
      signalLine[firstValidMacd + 8] = sig;
      for (let i = firstValidMacd + 9; i < candles.length; i++) {
        if (macdLine[i] != null) {
          sig = (macdLine[i] - sig) * mult + sig;
          signalLine[i] = sig;
        }
      }
    }

    const macdLineData = [];
    const signalLineData = [];
    const histData = [];
    for (let i = 0; i < candles.length; i++) {
      const t = candles[i].time;
      if (macdLine[i] != null) macdLineData.push({ time: t, value: macdLine[i] });
      if (signalLine[i] != null) {
        signalLineData.push({ time: t, value: signalLine[i] });
        if (macdLine[i] != null) {
          const h = macdLine[i] - signalLine[i];
          histData.push({ time: t, value: h, color: h >= 0 ? "rgba(47,207,132,0.55)" : "rgba(255,99,99,0.55)" });
        }
      }
    }

    const macdScaleOpts = {
      priceScaleId: "macd",
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    };

    // Histogram
    let histSeries = null;
    if (typeof chart.addHistogramSeries === "function") {
      histSeries = chart.addHistogramSeries({ ...macdScaleOpts, priceFormat: { type: "price", precision: 4, minMove: 0.0001 } });
    } else if (typeof chart.addSeries === "function" && chartLib.HistogramSeries) {
      histSeries = chart.addSeries(chartLib.HistogramSeries, { ...macdScaleOpts, priceFormat: { type: "price", precision: 4, minMove: 0.0001 } });
    }
    if (histSeries) histSeries.setData(histData);

    const macdLineSeries = addLine({ ...macdScaleOpts, color: "rgba(79,172,255,0.85)", lineWidth: 1.5 });
    const signalLineSeries = addLine({ ...macdScaleOpts, color: "rgba(255,167,38,0.85)", lineWidth: 1.5, lineStyle: 2 });
    if (macdLineSeries) macdLineSeries.setData(macdLineData);
    if (signalLineSeries) signalLineSeries.setData(signalLineData);

    chart.priceScale("macd").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      drawTicks: false,
      borderVisible: false,
      visible: false,
    });
  }

  // ── Compare overlay — normalised % change line for second symbol ──────────
  const compareSymbol = state.chartCompareSymbol?.[panel];
  if (compareSymbol) {
    const cRange = state.chartRanges[panel] || "1mo";
    const cInterval = chartIntervalForRange(cRange);
    const cPoints = state.chartCache.get(chartKey(compareSymbol, cRange, cInterval)) || [];
    if (cPoints.length >= 2) {
      const firstClose = Number(cPoints[0]?.close ?? cPoints[0]?.price ?? 0);
      if (firstClose > 0) {
        const normalizedLine = cPoints.map((p) => {
          const time = Number(p.timestamp ?? p.time ?? 0);
          const close = Number(p.close ?? p.price ?? 0);
          if (time <= 0 || !Number.isFinite(close)) return null;
          return { time, value: ((close - firstClose) / firstClose) * 100 };
        }).filter(Boolean);

        if (normalizedLine.length >= 2) {
          const compareColors = ["rgba(255,200,60,0.85)", "rgba(180,130,255,0.85)", "rgba(0,230,200,0.85)"];
          const colorIdx = (panel - 1) % compareColors.length;
          const compareSeries = addLine({
            color: compareColors[colorIdx],
            lineWidth: 1.5,
            lineStyle: 2, // dashed
            priceScaleId: "compare",
            lastValueVisible: true,
            priceLineVisible: false,
          });
          if (compareSeries) {
            compareSeries.setData(normalizedLine);
            chart.priceScale("compare").applyOptions({
              scaleMargins: { top: 0.1, bottom: 0.1 },
              borderVisible: false,
              visible: false,
            });
          }
        }
      }
    }
  }

  chart.timeScale().fitContent();

  const disconnectResizeObserver = observeChartResize(container, chart);
  const symbol = state.panelSymbols[panel] || "AAPL";
  const range = state.chartRanges[panel] || "1mo";
  chartViews.set(panel, { chart, container, disconnectResizeObserver, series, symbol, range, compareSymbol });
}

function calculateBlackScholes({ spot, strike, years, rate, volatility }) {
  const safeYears = Math.max(Number(years), 0.0001);
  const safeSpot = Math.max(Number(spot), 0.0001);
  const safeStrike = Math.max(Number(strike), 0.0001);
  const safeRate = Number(rate) / 100;
  const safeVol = Math.max(Number(volatility) / 100, 0.0001);
  const sqrtT = Math.sqrt(safeYears);
  const d1 = (Math.log(safeSpot / safeStrike) + (safeRate + (safeVol ** 2) / 2) * safeYears) / (safeVol * sqrtT);
  const d2 = d1 - safeVol * sqrtT;
  const normal = (value) => 0.5 * (1 + erf(value / Math.sqrt(2)));
  const density = (value) => Math.exp(-(value ** 2) / 2) / Math.sqrt(2 * Math.PI);
  const discount = Math.exp(-safeRate * safeYears);

  const call = safeSpot * normal(d1) - safeStrike * discount * normal(d2);
  const put = safeStrike * discount * normal(-d2) - safeSpot * normal(-d1);
  const callDelta = normal(d1);
  const putDelta = callDelta - 1;
  const gamma = density(d1) / (safeSpot * safeVol * sqrtT);
  // Vega: price change per 1 percentage-point move in volatility
  const vega = (safeSpot * density(d1) * sqrtT) / 100;
  // Theta: daily decay (per-year value divided by 365)
  const callTheta = (-(safeSpot * density(d1) * safeVol) / (2 * sqrtT) - safeRate * safeStrike * discount * normal(d2)) / 365;
  const putTheta = (-(safeSpot * density(d1) * safeVol) / (2 * sqrtT) + safeRate * safeStrike * discount * normal(-d2)) / 365;
  // Rho: price change per 1 percentage-point move in the risk-free rate
  const callRho = (safeStrike * safeYears * discount * normal(d2)) / 100;
  const putRho = (-safeStrike * safeYears * discount * normal(-d2)) / 100;

  return {
    call,
    put,
    // Back-compat: `delta` is call delta.
    delta: callDelta,
    gamma,
    // Full greek surface
    callDelta,
    putDelta,
    vega,
    callTheta,
    putTheta,
    callRho,
    putRho,
    d1,
    d2,
  };
}

function calculateBond({ face, coupon, ytm, maturity, frequency }) {
  const faceValue = Number(face);
  const couponRate = Number(coupon) / 100;
  const yieldRate = Number(ytm) / 100;
  const periodsPerYear = Number(frequency);
  const totalPeriods = Math.max(1, Math.round(Number(maturity) * periodsPerYear));
  const couponPayment = (faceValue * couponRate) / periodsPerYear;
  const discount = yieldRate / periodsPerYear;

  let price = 0;
  let duration = 0;
  let convexity = 0;

  for (let period = 1; period <= totalPeriods; period += 1) {
    const cashflow = period === totalPeriods ? couponPayment + faceValue : couponPayment;
    const presentValue = cashflow / ((1 + discount) ** period);
    price += presentValue;
    duration += period * presentValue;
    convexity += period * (period + 1) * presentValue;
  }

  const macaulayDuration = duration / price / periodsPerYear;
  return {
    price,
    duration: macaulayDuration,
    modifiedDuration: macaulayDuration / (1 + discount),
    convexity: convexity / (price * periodsPerYear * periodsPerYear),
  };
}

function erf(value) {
  const sign = value >= 0 ? 1 : -1;
  const absolute = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absolute);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-(absolute ** 2)));
  return sign * y;
}

function findRelatedSymbols(symbol) {
  const base = universeMap.get(symbol);
  if (!base) return [];
  return universe
    .filter((item) => item.symbol !== symbol && item.sector === base.sector)
    .slice(0, 6)
    .map((item) => buildQuote(item.symbol) || { ...item, price: item.seedPrice, changePct: 0 });
}

function filterNewsItems(filterSymbol) {
  if (!filterSymbol || filterSymbol === "ALL") return state.newsItems;
  const base = universeMap.get(filterSymbol);
  const terms = [filterSymbol, base?.name || ""].filter(Boolean).map((item) => item.toUpperCase());
  return state.newsItems.filter((item) => terms.some((term) => item.headline.toUpperCase().includes(term)));
}

function extractHeadlineSymbol(headline) {
  const upper = String(headline || "").toUpperCase();
  if (!upper) return null;
  const match = universe.find((item) => upper.includes(item.symbol) || upper.includes(item.name.toUpperCase()));
  return match?.symbol || null;
}

function chartIntervalForRange(range) {
  if (range === "5d" || range === "1d") return "1h";
  if (range === "2y" || range === "5y" || range === "10y" || range === "max") return "1wk";
  return "1d";
}

function normalizeChartRange(value) {
  const upper = String(value || "").toUpperCase();
  const map = {
    "5D": "5d",
    "1D": "1d",
    "1M": "1mo",
    "3M": "3mo",
    "6M": "6mo",
    "YTD": "ytd",
    "1Y": "1y",
    "2Y": "2y",
    "5Y": "5y",
    "10Y": "10y",
    "ALL": "max",
    "MAX": "max",
  };
  return map[upper] || "1mo";
}

function calculateRsi(closes, period = 14) {
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

function calculateChartStats(points) {
  if (!points.length) return { high: 0, low: 0, returnPct: 0, rsi: null };
  const closes = points.map((point) => Number(point.close || 0));
  const first = closes[0] || 0;
  const last = closes[closes.length - 1] || 0;
  return {
    high: Math.max(...closes),
    low: Math.min(...closes),
    returnPct: first ? ((last - first) / first) * 100 : 0,
    rsi: calculateRsi(closes),
  };
}

function calculatePulse() {
  // Combine overview symbols + watchlist for a broader breadth reading
  const overviewByKey = new Map(state.overviewQuotes.map((q) => [q.symbol, q]));
  const watchlistQuotes = state.watchlist
    .filter((sym) => !overviewByKey.has(sym))
    .map(buildQuote)
    .filter((q) => q && q.isLive);
  const quotes = [...state.overviewQuotes, ...watchlistQuotes];
  const changes = quotes.map((q) => Number(q.changePct || 0));
  const gainers = changes.filter((v) => v > 0).length;
  const losers = changes.filter((v) => v < 0).length;
  const flat = Math.max(quotes.length - gainers - losers, 0);
  const avgChange = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
  // Advance/decline ratio, guarded against divide-by-zero
  const adRatio = losers === 0 ? gainers : gainers / losers;
  const strongest = quotes.reduce((best, quote) => (!best || Number(quote.changePct || 0) > Number(best.changePct || 0) ? quote : best), null);
  const weakest = quotes.reduce((worst, quote) => (!worst || Number(quote.changePct || 0) < Number(worst.changePct || 0) ? quote : worst), null);
  return { gainers, losers, flat, total: quotes.length, avgChange, adRatio, strongest, weakest };
}

function syncUiCache() {
  workspaceController?.syncUiCache();
  queueMeridianStatePersist();
  syncMobilePanelNav();
}

function currentTimeShort(value = Date.now()) {
  const dateValue = value instanceof Date ? value : new Date(value);
  return dateValue.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function showToast(message, tone = "neutral", duration = 2500) {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.dataset.tone = tone;
  el.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    el.toast.classList.remove("is-visible");
  }, Math.max(1500, Number(duration) || 2500));
}

export function initializeApp() {
  init();
}
