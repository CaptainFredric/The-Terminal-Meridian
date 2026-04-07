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
import { LogicEngine } from "./LogicEngine.js";
import { createDefaultModuleRegistry } from "./Registry.js";
import { applyPriceTone, tabularValue } from "./Renderers/Common.js";
import { createStateStore } from "./StateStore.js";
import { authApi, marketApi, uiCache, workspaceApi } from "./api.js";
import { getStockDeepDive } from "./marketService.js";
import { fetchQuotes, fetchChart, fetchOptions, fetchNews, fetchFxRates } from "./services.js";

const DEFAULT_OVERVIEW_SYMBOLS = ["SPY", "QQQ", "NVDA", "TLT", "BTC-USD", "AAPL"];
const DEFAULT_CHART_RANGES = { 1: "1mo", 2: "1mo", 3: "1mo", 4: "1mo" };
const CHART_RANGE_OPTIONS = [
  { label: "5D", value: "5d" },
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
];
const BIG_FOUR_DEFAULT_MODULES = { 1: "quote", 2: "chart", 3: "news", 4: "rules" };
const BIG_FOUR_DEFAULT_SYMBOLS = { 1: "AAPL", 2: "MSFT", 3: "QQQ", 4: "NVDA" };
const AUTH_ENABLED = false;

const universe = buildUniverse();
const universeMap = new Map(universe.map((item) => [item.symbol, item]));
const uiSnapshot = uiCache.read();
const guestWorkspace = uiSnapshot.guestWorkspace || {};
const chartViews = new Map();
let lightweightChartsModulePromise = null;
let moduleRegistry = null;
let appCore = null;
let commandController = null;
let workspaceController = null;
let dockingController = null;
let logicEngine = null;
let uiRefreshQueued = false;
let unsubscribeStateUpdates = null;
let hasInitialized = false;
let lastStateUpdatedAt = Date.now();
const pendingPriceChanges = new Map();

const initialState = {
  user: null,
  activePanel: Number(uiSnapshot.activePanel || 1),
  focusedPanel: Number(uiSnapshot.focusedPanel || 0) || null,
  panelModules: normalizePanelModules(guestWorkspace.panelModules, BIG_FOUR_DEFAULT_MODULES, moduleTitles),
  panelSymbols: normalizePanelMap(guestWorkspace.panelSymbols, BIG_FOUR_DEFAULT_SYMBOLS),
  chartRanges: normalizePanelMap(uiSnapshot.chartRanges, DEFAULT_CHART_RANGES),
  watchlist: [...(guestWorkspace.watchlist || defaultWatchlist)],
  alerts: structuredClone(guestWorkspace.alerts || defaultAlerts),
  positions: structuredClone(guestWorkspace.positions || defaultPositions),
  commandHistory: [...(guestWorkspace.commandHistory || [])],
  activeRules: structuredClone(seedLiveRules(guestWorkspace.activeRules)),
  notifications: structuredClone(seedLiveNotifications(guestWorkspace.notifications, guestWorkspace.activeRules)),
  commandHistoryIndex: -1,
  screenerFilters: {
    1: { universe: "", sector: "", search: "" },
    2: { universe: "", sector: "", search: "" },
    3: { universe: "", sector: "", search: "" },
    4: { universe: "", sector: "", search: "" },
  },
  calculator: structuredClone(calculatorDefaults),
  quotes: new Map(),
  chartCache: new Map(),
  optionsCache: new Map(),
  deepDiveCache: new Map(),
  deepDiveLoading: new Set(),
  newsItems: [],
  newsFilter: String(uiSnapshot.newsFilter || "ALL"),
  fxRates: {},
  overviewQuotes: [],
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
};

const stateStore = createStateStore(initialState);
const state = stateStore.state;

const el = {
  appTitle: document.querySelector("#appTitle"),
  functionRow: document.querySelector("#functionRow"),
  openCommandPalette: document.querySelector("#openCommandPalette"),
  paletteBackdrop: document.querySelector("#paletteBackdrop"),
  commandPalette: document.querySelector("#commandPalette"),
  overviewStrip: document.querySelector("#overviewStrip"),
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
};

function init() {
  if (hasInitialized) return;
  hasInitialized = true;
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
        loadDeepDive,
        syncTicker,
        showToast,
        openSettingsModal,
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
        renderRails();
        renderAllPanels();
      },
    });
    commandController = new CommandController({
      state,
      el,
      appCore,
      hideAutocomplete,
      closeCommandPalette,
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
  setInterval(checkHealth, 60000);
  window.addEventListener("resize", fitAllCharts);
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

function scheduleUiRefresh() {
  if (uiRefreshQueued) return;
  uiRefreshQueued = true;
  requestAnimationFrame(() => {
    uiRefreshQueued = false;
    renderFunctionRow();
    renderOverviewStrip();
    renderRails();
    renderAllPanels();
    updateFocusLayout();
    updateAuthControls();
    updateAutoJumpButton();
    updateStatusBar();
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
      workspaceController?.hydrateSession(payload.user, payload.workspace);
      closeAuthModal();
      showToast(`Welcome back, ${payload.user.firstName}.`, "success");
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
    const confirmPassword = String(data.get("confirmPassword") || "");

    if (password.length < 8) {
      setAuthMessage("Password must be at least 8 characters.", "error");
      return;
    }
    if (password !== confirmPassword) {
      setAuthMessage("Passwords do not match.", "error");
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
        firstName: String(data.get("firstName") || ""),
        lastName: String(data.get("lastName") || ""),
        email: String(data.get("email") || ""),
        username: String(data.get("username") || ""),
        password,
        role: String(data.get("role") || "Other"),
      });
      workspaceController?.hydrateSession(payload.user, payload.workspace);
      closeAuthModal();
      showToast(`Account created. Welcome, ${payload.user.firstName}.`, "success");
    } catch (error) {
      setAuthMessage(error.message || "Signup failed.", "error");
    } finally {
      setButtonLoading(el.signupBtn, false, "Create and sync");
    }
  });

  el.signupEmail?.addEventListener("input", scheduleAvailabilityCheck);
  el.signupUsername?.addEventListener("input", scheduleAvailabilityCheck);

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

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("input", handleDocumentInput);
  document.addEventListener("submit", handleDocumentSubmit);
  document.addEventListener("keydown", handleGlobalHotkeys, true);
}

function ensureTransientOverlaysClosed() {
  state.commandPaletteOpen = false;
  el.paletteBackdrop?.classList.add("hidden");
  el.authModalBackdrop?.classList.add("hidden");
  el.settingsModalBackdrop?.classList.add("hidden");
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
  setAuthMessage("Sign in only if you want backend sync.", "neutral");
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
  setSettingsMessage("Update your account details securely.", "neutral");
  el.settingsModalBackdrop?.classList.remove("hidden");
}

function closeSettingsModal() {
  el.settingsModalBackdrop?.classList.add("hidden");
  setSettingsMessage("Update your account details securely.", "neutral");
}

function updateAuthControls() {
  if (!AUTH_ENABLED) {
    el.logoutButton?.classList.add("hidden");
    el.openSettingsBtn?.classList.add("hidden");
    el.openAuthBtn?.classList.add("hidden");
    el.authModalBackdrop?.classList.add("hidden");
    el.settingsModalBackdrop?.classList.add("hidden");
    return;
  }

  if (state.user) {
    el.logoutButton?.classList.remove("hidden");
    el.openSettingsBtn?.classList.remove("hidden");
    if (el.openAuthBtn) {
      el.openAuthBtn.textContent = "Switch";
      el.openAuthBtn.title = "Switch account";
    }
    return;
  }

  el.logoutButton?.classList.add("hidden");
  el.openSettingsBtn?.classList.add("hidden");
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
  updateAuthControls();
  setNetworkStatus(state.health.ok ? "Guest · Live" : "Guest · Local");
  showToast("Signed out.", "neutral");
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

  const cards = state.overviewQuotes.length
    ? state.overviewQuotes
        .map(
          (quote) => `
            <button class="overview-card" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${state.activePanel}">
              <span>${quote.symbol}</span>
              <strong>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `overview:${quote.symbol}:price`, currentPrice: quote.price })}</strong>
              <small class="${Number(quote.changePct || 0) >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct || 0))}</small>
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
  const breadthIcon = pulse.gainers > pulse.losers ? "🟢" : pulse.losers > pulse.gainers ? "🔴" : "⚪";
  el.overviewStrip.innerHTML = `
    ${cards}
    <article class="overview-card overview-card-summary">
      <span>${breadthIcon} Market Pulse</span>
      <strong>${state.marketPhase}</strong>
      <small>${pulse.gainers} ↑ · ${pulse.losers} ↓ · ${state.health.ok ? "🟢 Live" : "🟡 Local"}</small>
    </article>
  `;
  applyPriceTones(el.overviewStrip);
}

function renderRails() {
  if (el.watchlistRail) {
    el.watchlistRail.innerHTML = state.watchlist
      .map((symbol) => {
        const quote = buildQuote(symbol);
        return `
          <div class="rail-row">
            <button class="rail-item" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${state.activePanel}">
              <div>
                <strong>${symbol}</strong>
                <small>${quote?.name || "Waiting for quote"}</small>
              </div>
              <div>
                <strong>${tabularValue(formatPrice(quote?.price || 0, symbol), { flashKey: `quote:${symbol}:price`, currentPrice: quote?.price || 0 })}</strong>
                <small class="${(quote?.changePct || 0) >= 0 ? "positive" : "negative"}">${quote ? tabularValue(formatSignedPct(quote.changePct)) : "--"}</small>
              </div>
            </button>
            <button class="rail-remove" type="button" data-remove-watch="${symbol}">×</button>
          </div>
        `;
      })
      .join("");
  }

  if (el.alertRail) {
    el.alertRail.innerHTML = state.alerts
      .map(
        (alert) => `
        <div class="alert-row ${alert.status === "triggered" ? "is-triggered" : ""}">
          <strong>${alert.symbol}</strong>
          <span>${alert.operator} ${Number(alert.threshold).toLocaleString()}</span>
          <small>${alert.status}</small>
        </div>
      `,
      )
      .join("");
  }

  if (el.watchCount) el.watchCount.textContent = String(state.watchlist.length);
  if (el.alertCount) el.alertCount.textContent = String(state.alerts.length);
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
}

function renderAllPanels() {
  [1, 2, 3, 4].forEach((panel) => void renderPanel(panel));
}

async function renderPanel(panel) {
  const panelNode = document.querySelector(`[data-panel="${panel}"]`);
  const title = document.querySelector(`#panelTitle${panel}`);
  const content = document.querySelector(`#panelContent${panel}`);
  const moduleName = state.panelModules[panel];
  if (!panelNode || !title || !content) return;

  const symbolLabel = ["quote", "chart", "options"].includes(moduleName) && state.panelSymbols[panel]
    ? ` · ${state.panelSymbols[panel]}`
    : "";
  title.textContent = `${moduleTitles[moduleName] || moduleName}${symbolLabel}`;

  const renderer = moduleRegistry.get(moduleName) || moduleRegistry.get("home");
  panelNode.dataset.moduleKey = String(moduleName || "").toUpperCase();
  const html = await Promise.resolve(renderer(panel));
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
}

function processCommand() {
  commandController?.processInput();
}

function handleCommandKeydown(event) {
  commandController?.handleCommandKeydown(event);
}

function renderAutocomplete() {
  const value = String(el.commandInput?.value || "").trim().toUpperCase();
  if (!value) {
    hideAutocomplete();
    return;
  }

  const commandMatches = commandCatalog
    .filter((item) => item.cmd.includes(value))
    .slice(0, 5)
    .map((item) => ({ label: item.cmd, description: item.desc }));
  const symbolMatches = universe
    .filter((item) => item.symbol.startsWith(value) || item.name.toUpperCase().includes(value))
    .slice(0, 5)
    .map((item) => ({ label: `${item.symbol} Q`, description: item.name }));
  const suggestions = [...commandMatches, ...symbolMatches].slice(0, 10);

  if (!suggestions.length) {
    hideAutocomplete();
    return;
  }

  el.autocomplete.innerHTML = suggestions
    .map(
      (item) => `
        <button class="autocomplete-item" type="button" data-autocomplete="${item.label}">
          <strong>${item.label}</strong>
          <span>${item.description}</span>
        </button>
      `,
    )
    .join("");
  el.autocomplete.classList.remove("hidden");
}

function hideAutocomplete() {
  el.autocomplete?.classList.add("hidden");
}

function handleDocumentClick(event) {
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

  const removeRule = event.target.closest("[data-remove-rule]");
  if (removeRule) {
    appCore?.removeRule(removeRule.dataset.removeRule);
    renderAllPanels();
    return;
  }

  const refreshChartTrigger = event.target.closest("[data-refresh-chart]");
  if (refreshChartTrigger) {
    const [panel, symbol, range] = refreshChartTrigger.dataset.refreshChart.split(":");
    refreshChart(symbol, range || state.chartRanges[Number(panel)] || "1mo");
    return;
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
}

function handleDocumentSubmit(event) {
  const addPositionForm = event.target.closest("#addPositionForm");
  if (!addPositionForm) return;
  event.preventDefault();
  const data = new FormData(addPositionForm);
  addPosition({
    symbol: String(data.get("symbol") || "").toUpperCase(),
    shares: Number(data.get("shares") || 0),
    cost: Number(data.get("cost") || 0),
  });
  addPositionForm.reset();
}

function handleGlobalHotkeys(event) {
  if (event.key === "Escape") {
    const hadOverlayOpen =
      !el.paletteBackdrop?.classList.contains("hidden") ||
      !el.authModalBackdrop?.classList.contains("hidden") ||
      !el.settingsModalBackdrop?.classList.contains("hidden");

    if (hadOverlayOpen) {
      event.preventDefault();
      event.stopPropagation();
    }

    closeSettingsModal();
    closeAuthModal();
    closeCommandPalette();
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
    F9: "macro",
    F10: "options",
    F11: "calculator",
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
    state.watchlist.unshift(upper);
    state.watchlist = state.watchlist.slice(0, 24);
    refreshQuotes([upper]);
    renderRails();
    queueWorkspaceSave();
    showToast(`${upper} added to watchlist.`, "success");
  }
}

function removeFromWatchlist(symbol) {
  state.watchlist = state.watchlist.filter((item) => item !== symbol);
  renderRails();
  queueWorkspaceSave();
}

function createAlert(symbol, threshold, operator) {
  if (!symbol || Number.isNaN(threshold)) return;
  state.alerts.unshift({ symbol: symbol.toUpperCase(), operator, threshold, status: "watching" });
  state.alerts = state.alerts.slice(0, 16);
  evaluateAlerts();
  renderRails();
  queueWorkspaceSave();
  showToast(`Alert added for ${symbol.toUpperCase()}.`, "success");
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

function queueWorkspaceSave() {
  workspaceController?.queueSave();
}

async function refreshAllData() {
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

  await Promise.allSettled([
    checkHealth(),
    refreshOverview(),
    refreshQuotes(symbols),
    refreshNews(),
    refreshFx(),
    ...chartRequests,
    ...optionRequests,
  ]);

  renderOverviewStrip();
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
    renderRails();
  }
  queueWorkspaceSave();
  showToast(state.user ? `${ticker} synced to your workspace.` : `${ticker} saved to local workspace.`, "success");
}

function formatInsightValue(value) {
  if (value == null) return "--";
  if (typeof value === "object") {
    if ("fmt" in value && value.fmt) return String(value.fmt);
    if ("longFmt" in value && value.longFmt) return String(value.longFmt);
    if ("raw" in value && value.raw != null) return String(value.raw);
  }
  return String(value);
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

async function refreshOverview() {
  // Try backend overview endpoint
  try {
    const payload = await marketApi.overview(state.overviewSymbols);
    if ((payload.quotes || []).length) {
      state.overviewQuotes = payload.quotes;
      if (payload.phase) state.marketPhase = payload.phase;
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
    }));
  } catch {
    // noop
  }
}

async function refreshQuotes(symbols) {
  // Try backend first; fall back to direct Yahoo fetch
  try {
    const payload = await marketApi.quotes(symbols);
    (payload.quotes || []).forEach((quote) => state.quotes.set(quote.symbol, quote));
    evaluateAlerts();
    return;
  } catch {
    // backend unavailable — try direct
  }
  try {
    const results = await fetchQuotes(symbols);
    results.forEach((quote) => state.quotes.set(quote.symbol, quote));
    evaluateAlerts();
  } catch {
    // noop
  }
}

async function refreshChart(symbol, range = "1mo") {
  const interval = chartIntervalForRange(range);
  const key = chartKey(symbol, range, interval);
  // Try backend first
  try {
    const payload = await marketApi.chart(symbol, range, interval);
    state.chartCache.set(key, payload.points || []);
    renderAllPanels();
    return;
  } catch {
    // backend unavailable — try direct
  }
  try {
    const points = await fetchChart(symbol, range, interval);
    if (points.length) {
      state.chartCache.set(key, points);
      renderAllPanels();
    }
  } catch {
    // noop
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
      return;
    }
  } catch {
    // fall through to direct
  }
  // Direct RSS fallback via services.js
  try {
    const items = await fetchNews();
    state.newsItems = items;
  } catch {
    // noop
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
  if (el.watchCount) el.watchCount.textContent = String(state.watchlist.length);
  if (el.alertCount) el.alertCount.textContent = String(state.alerts.length);
  if (el.marketPhase) el.marketPhase.textContent = state.marketPhase;
  if (el.serverStatus) {
    el.serverStatus.textContent = state.health.ok ? "Live" : "Offline";
    el.serverStatus.classList.toggle("chip-server-offline", !state.health.ok);
  }
}

function updateSessionClock() {
  const elapsed = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
  const hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  if (el.sessionClock) el.sessionClock.textContent = `${hours}:${minutes}:${seconds}`;
}

function evaluateAlerts() {
  state.alerts = state.alerts.map((alert) => {
    const quote = buildQuote(alert.symbol);
    if (!quote) return alert;
    const triggered = alert.operator === ">=" ? quote.price >= alert.threshold : quote.price <= alert.threshold;
    return { ...alert, status: triggered ? "triggered" : "watching" };
  });
}

function buildQuote(symbol) {
  const base = universeMap.get(symbol);
  const live = state.quotes.get(symbol);
  if (!base && !live) return null;
  return {
    symbol,
    name: live?.name || base?.name || symbol,
    exchange: live?.exchange || base?.exchange || "N/A",
    sector: base?.sector || "Market",
    universe: base?.universe || "Custom",
    price: live?.price || base?.seedPrice || 0,
    changePct: Number(live?.changePct || 0),
    change: Number(live?.change || 0),
    marketCap: live?.marketCap || base?.marketCap || 0,
    volume: live?.volume || 0,
    dayHigh: live?.dayHigh || live?.price || base?.seedPrice || 0,
    dayLow: live?.dayLow || live?.price || base?.seedPrice || 0,
    previousClose: live?.previousClose || base?.seedPrice || 0,
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
    return { ...position, price, value, pnl, pnlPct };
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

async function mountCandlestickChart(panel, points) {
  const container = document.querySelector(`#chartCanvas${panel}`);
  if (!container) return;

  const candles = toCandlestickData(points);
  clearPanelChart(panel);
  if (!candles.length) return;

  const chartLib = await loadLightweightChartsModule();
  if (!chartLib?.createChart) {
    container.innerHTML = `<div class="stack"><span class="skeleton-box lg"></span><span class="skeleton-box"></span><span class="skeleton-box sm"></span></div>`;
    return;
  }

  const width = Math.max(320, Math.floor(container.clientWidth || 0));
  const height = Math.max(220, Math.floor(container.clientHeight || 0));

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

  series.setData(candles);
  chart.timeScale().fitContent();

  const disconnectResizeObserver = observeChartResize(container, chart);
  chartViews.set(panel, { chart, container, disconnectResizeObserver });
}

function calculateBlackScholes({ spot, strike, years, rate, volatility }) {
  const safeYears = Math.max(Number(years), 0.0001);
  const safeSpot = Math.max(Number(spot), 0.0001);
  const safeStrike = Math.max(Number(strike), 0.0001);
  const safeRate = Number(rate) / 100;
  const safeVol = Math.max(Number(volatility) / 100, 0.0001);
  const d1 = (Math.log(safeSpot / safeStrike) + (safeRate + (safeVol ** 2) / 2) * safeYears) / (safeVol * Math.sqrt(safeYears));
  const d2 = d1 - safeVol * Math.sqrt(safeYears);
  const normal = (value) => 0.5 * (1 + erf(value / Math.sqrt(2)));
  const density = (value) => Math.exp(-(value ** 2) / 2) / Math.sqrt(2 * Math.PI);

  return {
    call: safeSpot * normal(d1) - safeStrike * Math.exp(-safeRate * safeYears) * normal(d2),
    put: safeStrike * Math.exp(-safeRate * safeYears) * normal(-d2) - safeSpot * normal(-d1),
    delta: normal(d1),
    gamma: density(d1) / (safeSpot * safeVol * Math.sqrt(safeYears)),
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

function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
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
  const upper = headline.toUpperCase();
  const match = universe.find((item) => upper.includes(item.symbol) || upper.includes(item.name.toUpperCase()));
  return match?.symbol || null;
}

function chartIntervalForRange(range) {
  return range === "5d" ? "1h" : "1d";
}

function normalizeChartRange(value) {
  const upper = String(value || "").toUpperCase();
  const map = {
    "5D": "5d",
    "1M": "1mo",
    "3M": "3mo",
    "6M": "6mo",
    "1Y": "1y",
  };
  return map[upper] || "1mo";
}

function calculateChartStats(points) {
  if (!points.length) return { high: 0, low: 0, returnPct: 0 };
  const closes = points.map((point) => Number(point.close || 0));
  const first = closes[0] || 0;
  const last = closes[closes.length - 1] || 0;
  return {
    high: Math.max(...closes),
    low: Math.min(...closes),
    returnPct: first ? ((last - first) / first) * 100 : 0,
  };
}

function calculatePulse() {
  const quotes = state.overviewQuotes.length ? state.overviewQuotes : state.watchlist.map(buildQuote).filter(Boolean);
  const gainers = quotes.filter((quote) => Number(quote.changePct || 0) >= 0).length;
  const losers = Math.max(quotes.length - gainers, 0);
  return { gainers, losers };
}

function syncUiCache() {
  workspaceController?.syncUiCache();
}

function formatPrice(value, symbol) {
  const digits = symbol === "BTC-USD" || symbol === "USD" ? 0 : 2;
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatSignedPct(value) {
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
}

function formatMarketCap(value) {
  if (!value) return "N/A";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${Number(value).toFixed(0)}`;
}

function formatVolume(value) {
  if (!value) return "N/A";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return `${value}`;
}

function currentTimeShort(value = Date.now()) {
  const dateValue = value instanceof Date ? value : new Date(value);
  return dateValue.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function showToast(message, tone = "neutral") {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.dataset.tone = tone;
  el.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    el.toast.classList.remove("is-visible");
  }, 2500);
}

export function initializeApp() {
  init();
}
