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
const AUTH_ENABLED = false;

const universe = buildUniverse();
const universeMap = new Map(universe.map((item) => [item.symbol, item]));
const uiSnapshot = uiCache.read();
const guestWorkspace = uiSnapshot.guestWorkspace || {};
const chartViews = new Map();
let lightweightChartsModulePromise = null;

const state = {
  user: null,
  activePanel: Number(uiSnapshot.activePanel || 1),
  focusedPanel: Number(uiSnapshot.focusedPanel || 0) || null,
  panelModules: normalizePanelMap(guestWorkspace.panelModules, { 1: "briefing", 2: "quote", 3: "chart", 4: "news" }),
  panelSymbols: normalizePanelMap(guestWorkspace.panelSymbols, { 1: "NVDA", 2: "AAPL", 3: "MSFT", 4: "QQQ" }),
  chartRanges: normalizePanelMap(uiSnapshot.chartRanges, DEFAULT_CHART_RANGES),
  watchlist: [...(guestWorkspace.watchlist || defaultWatchlist)],
  alerts: structuredClone(guestWorkspace.alerts || defaultAlerts),
  positions: structuredClone(guestWorkspace.positions || defaultPositions),
  commandHistory: [...(guestWorkspace.commandHistory || [])],
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
  document.title = appName;
  if (el.appTitle) el.appTitle.textContent = appName;
  if (el.signupRole) {
    el.signupRole.innerHTML = authRoles.map((role) => `<option value="${role}">${role}</option>`).join("");
  }
  if (el.settingsRole) {
    el.settingsRole.innerHTML = authRoles.map((role) => `<option value="${role}">${role}</option>`).join("");
  }

  bindEvents();
  enablePanelDocking();
  setActivePanel(state.activePanel);
  renderFunctionRow();
  renderOverviewStrip();
  renderRails();
  renderAllPanels();
  applyTerminalInputClass(document);
  updateFocusLayout();
  updateAuthControls();
  updateAutoJumpButton();
  updateStatusBar();
  if (AUTH_ENABLED) restoreSession();
  checkHealth();
  refreshAllData();

  setInterval(updateSessionClock, 1000);
  setInterval(handleRefreshCountdown, 1000);
  setInterval(checkHealth, 60000);
  window.addEventListener("resize", fitAllCharts);
}

function enablePanelDocking() {
  if (!el.workspaceGrid) return;

  document.querySelectorAll("[data-panel]").forEach((panelNode) => {
    panelNode.setAttribute("draggable", "true");
  });

  el.workspaceGrid.addEventListener("dragstart", (event) => {
    const panelNode = event.target.closest("[data-panel]");
    if (!panelNode) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/panel-id", panelNode.dataset.panel || "");
    panelNode.classList.add("is-dragging");
  });

  el.workspaceGrid.addEventListener("dragend", () => {
    document.querySelectorAll("[data-panel].is-dragging").forEach((panelNode) => panelNode.classList.remove("is-dragging"));
  });

  el.workspaceGrid.addEventListener("dragover", (event) => {
    if (!event.target.closest("[data-panel]")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  el.workspaceGrid.addEventListener("drop", (event) => {
    const target = event.target.closest("[data-panel]");
    if (!target) return;
    event.preventDefault();

    const sourcePanelId = event.dataTransfer.getData("text/panel-id");
    const source = sourcePanelId ? document.querySelector(`[data-panel="${sourcePanelId}"]`) : null;
    if (!source || source === target) return;

    const sourceNext = source.nextElementSibling;
    const targetNext = target.nextElementSibling;

    if (sourceNext === target) {
      el.workspaceGrid.insertBefore(target, source);
      return;
    }
    if (targetNext === source) {
      el.workspaceGrid.insertBefore(source, target);
      return;
    }

    el.workspaceGrid.insertBefore(source, targetNext);
    el.workspaceGrid.insertBefore(target, sourceNext);
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
      hydrateSession(payload.user, payload.workspace);
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
      hydrateSession(payload.user, payload.workspace);
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
  document.addEventListener("keydown", handleGlobalHotkeys);
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

async function restoreSession() {
  try {
    const payload = await authApi.session();
    hydrateSession(payload.user, payload.workspace);
  } catch {
    setNetworkStatus(state.health.ok ? "Guest · Live" : "Guest · Local");
  }
}

function hydrateSession(user, workspace) {
  state.user = user;
  state.watchlist = [...(workspace.watchlist || defaultWatchlist)];
  state.alerts = structuredClone(workspace.alerts || defaultAlerts);
  state.positions = structuredClone(workspace.positions || defaultPositions);
  state.panelModules = normalizePanelMap(workspace.panelModules, state.panelModules);
  state.panelSymbols = normalizePanelMap(workspace.panelSymbols, state.panelSymbols);
  state.commandHistory = [...(workspace.commandHistory || [])];
  state.sessionStartedAt = Date.now();

  updateAuthControls();
  setNetworkStatus("Live · Saved");
  renderOverviewStrip();
  renderRails();
  renderAllPanels();
}

function normalizePanelMap(source, fallback) {
  const next = { ...fallback };
  if (!source || typeof source !== "object") return next;
  Object.entries(source).forEach(([key, value]) => {
    next[Number(key)] = value;
  });
  return next;
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
              <strong>${formatPrice(quote.price, quote.symbol)}</strong>
              <small class="${Number(quote.changePct || 0) >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct || 0)}</small>
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
  el.overviewStrip.innerHTML = `
    ${cards}
    <article class="overview-card overview-card-summary">
      <span>Market pulse</span>
      <strong>${state.marketPhase}</strong>
      <small>${pulse.gainers} up · ${pulse.losers} down · ${state.health.ok ? "live server" : "local fallback"}</small>
    </article>
  `;
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
                <strong>${formatPrice(quote?.price || 0, symbol)}</strong>
                <small class="${(quote?.changePct || 0) >= 0 ? "positive" : "negative"}">${quote ? formatSignedPct(quote.changePct) : "--"}</small>
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
}

function setActivePanel(panel) {
  state.activePanel = panel;
  document.querySelectorAll("[data-panel]").forEach((node) => {
    node.classList.toggle("is-active", Number(node.dataset.panel) === panel);
  });
  renderFunctionRow();
  syncUiCache();
}

function setFocusedPanel(panel) {
  state.focusedPanel = panel && state.focusedPanel === panel ? null : panel;
  if (state.focusedPanel) state.activePanel = state.focusedPanel;
  updateFocusLayout();
  setActivePanel(state.activePanel);
  renderOverviewStrip();
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
  const currentIndex = moduleOrder.indexOf(state.panelModules[panel]);
  const nextIndex = (currentIndex + direction + moduleOrder.length) % moduleOrder.length;
  loadModule(moduleOrder[nextIndex], panel);
}

function loadModule(moduleName, panel, options = {}) {
  state.panelModules[panel] = moduleName;
  setActivePanel(panel);
  renderPanel(panel);
  syncPanelData(panel);
  if (options.reveal) revealPanelIfNeeded(panel);
  queueWorkspaceSave();
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
  [1, 2, 3, 4].forEach((panel) => renderPanel(panel));
}

function renderPanel(panel) {
  const panelNode = document.querySelector(`[data-panel="${panel}"]`);
  const title = document.querySelector(`#panelTitle${panel}`);
  const content = document.querySelector(`#panelContent${panel}`);
  const moduleName = state.panelModules[panel];
  if (!panelNode || !title || !content) return;

  const symbolLabel = ["quote", "chart", "options"].includes(moduleName) && state.panelSymbols[panel]
    ? ` · ${state.panelSymbols[panel]}`
    : "";
  title.textContent = `${moduleTitles[moduleName] || moduleName}${symbolLabel}`;

  const renderers = {
    briefing: renderBriefing,
    home: renderHome,
    quote: renderQuote,
    chart: renderChart,
    news: renderNews,
    screener: renderScreener,
    heatmap: renderHeatmap,
    portfolio: renderPortfolio,
    macro: renderMacro,
    options: renderOptions,
    calculator: renderCalculator,
  };

  content.innerHTML = (renderers[moduleName] || renderHome)(panel);
  applyTerminalInputClass(content);

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

function renderBriefing(panel) {
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
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
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
            <strong>${breadth.toFixed(0)}%</strong>
            <small>${pulse.gainers} up · ${pulse.losers} down</small>
          </div>
          <div class="brief-metric">
            <span>Volatility pulse</span>
            <strong>${volatility.toFixed(2)}%</strong>
            <small>Avg absolute move</small>
          </div>
          <div class="brief-metric">
            <span>Anchor</span>
            <strong>${primary}</strong>
            <small>${primaryQuote ? formatPrice(primaryQuote.price, primary) : "Fetching quote"}</small>
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
                    (quote) => `<button class="chip chip-peer" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}"><strong>${quote.symbol}</strong><span>${formatPrice(quote.price, quote.symbol)}</span><small class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</small></button>`,
                  )
                  .join("")
              : `<div class="empty-inline">Leaders will appear as market data updates.</div>`}
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderHome(panel) {
  const portfolio = calculatePortfolioSummary();
  const top = state.watchlist.slice(0, 6).map(buildQuote).filter(Boolean);
  const recentCommands = state.commandHistory.slice(0, 5);
  const primarySymbol = state.panelSymbols[panel] || state.watchlist[0] || "AAPL";
  const suggestions = buildCommandSuggestions(panel);

  return `
    <section class="stack stack-lg">
      <div class="card-grid card-grid-home">
        <article class="card stat-card glow-card">
          <span>Watchlist</span>
          <strong>${state.watchlist.length}</strong>
          <small>${state.watchlist.slice(0, 4).join(" · ")}</small>
        </article>
        <article class="card stat-card glow-card">
          <span>Portfolio value</span>
          <strong>${formatPrice(portfolio.value, "USD")}</strong>
          <small class="${portfolio.pnl >= 0 ? "positive" : "negative"}">${portfolio.pnl >= 0 ? "+" : ""}${formatPrice(portfolio.pnl, "USD")}</small>
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
                  <span>${formatPrice(quote.price, quote.symbol)}</span>
                  <small class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</small>
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
              ? state.overviewQuotes.slice(0, 4).map((quote) => `<div class="pulse-card is-live"><span>${quote.symbol}</span><strong>${formatPrice(quote.price, quote.symbol)}</strong><small class="${Number(quote.changePct || 0) >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct || 0)}</small></div>`).join("")
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
}

function renderQuote(panel) {
  const symbol = state.panelSymbols[panel] || "AAPL";
  const quote = buildQuote(symbol);
  if (!quote) return `<section class="stack">${loadingSkeleton(5)}</section>`;

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
              <strong>${formatPrice(quote.price, symbol)}</strong>
              <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
            </div>
            <p>${quote.sector} · ${quote.universe}</p>
          </div>
          <div class="quote-meta-grid">
            <div><span>Volume</span><strong>${formatVolume(quote.volume)}</strong></div>
            <div><span>Market cap</span><strong>${formatMarketCap(quote.marketCap)}</strong></div>
            <div><span>High</span><strong>${formatPrice(quote.dayHigh, symbol)}</strong></div>
            <div><span>Low</span><strong>${formatPrice(quote.dayLow, symbol)}</strong></div>
          </div>
        </div>
      </article>

      <table class="data-table">
        <tbody>
          <tr><td>Previous close</td><td>${formatPrice(quote.previousClose, symbol)}</td><td>Day high</td><td>${formatPrice(quote.dayHigh, symbol)}</td></tr>
          <tr><td>Day low</td><td>${formatPrice(quote.dayLow, symbol)}</td><td>Volume</td><td>${formatVolume(quote.volume)}</td></tr>
          <tr><td>Market cap</td><td>${formatMarketCap(quote.marketCap)}</td><td>Change</td><td class="${quote.change >= 0 ? "positive" : "negative"}">${quote.change >= 0 ? "+" : ""}${Number(quote.change).toFixed(2)}</td></tr>
        </tbody>
      </table>

      <article class="card">
        <header class="card-head card-head-split"><h4>Deep insight</h4><small>${deepDive?.provider === "rapidapi" ? "live modules" : "provisioned research"}</small></header>
        ${isAnalyzing
          ? loadingSkeleton(4)
          : deepDive
            ? `
              <div class="deep-dive-grid">
                <div class="insight-block">
                  <span>Sector</span>
                  <strong>${profile.sector || quote.sector}</strong>
                </div>
                <div class="insight-block">
                  <span>Industry</span>
                  <strong>${profile.industry || "N/A"}</strong>
                </div>
                <div class="insight-block">
                  <span>Target mean</span>
                  <strong>${formatInsightValue(financials.targetMeanPrice)}</strong>
                </div>
                <div class="insight-block">
                  <span>Recommendation</span>
                  <strong>${formatInsightValue(financials.recommendationKey)}</strong>
                </div>
                <div class="insight-block">
                  <span>Total revenue</span>
                  <strong>${formatInsightValue(financials.totalRevenue)}</strong>
                </div>
                <div class="insight-block">
                  <span>Free cash flow</span>
                  <strong>${formatInsightValue(financials.freeCashflow)}</strong>
                </div>
              </div>
              <p class="insight-summary">${profile.longBusinessSummary || profile.longBusinessDescription || deepDive.reason || "Run analyze to load deeper company context."}</p>
            `
            : `<div class="empty-inline">Run ANALYZE to pull profile, financials, and ticker-specific news.</div>`}
      </article>

      <article class="card">
        <header class="card-head card-head-split"><h4>Similar names</h4><small>${quote.sector}</small></header>
        <div class="chip-grid compact-chip-grid">
          ${peers.map((peer) => `<button class="chip chip-peer" type="button" data-load-module="quote" data-target-symbol="${peer.symbol}" data-target-panel="${panel}"><strong>${peer.symbol}</strong><span>${formatPrice(peer.price, peer.symbol)}</span><small class="${peer.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(peer.changePct)}</small></button>`).join("") || `<div class="empty-inline">No comparable names found yet.</div>`}
        </div>
      </article>
    </section>
  `;
}

function renderChart(panel) {
  const symbol = state.panelSymbols[panel] || "AAPL";
  const range = state.chartRanges[panel] || "1mo";
  const interval = chartIntervalForRange(range);
  const points = state.chartCache.get(chartKey(symbol, range, interval)) || [];
  const stats = calculateChartStats(points);

  return `
    <section class="stack stack-lg">
      <div class="toolbar toolbar-wrap">
        ${CHART_RANGE_OPTIONS.map((option) => `<button class="range-pill ${option.value === range ? "is-active" : ""}" type="button" data-chart-range="${panel}:${option.value}">${option.label}</button>`).join("")}
        <button class="btn btn-ghost" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}">Quote</button>
        <button class="btn btn-ghost" type="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Options</button>
        <button class="btn btn-ghost" type="button" data-news-filter="${symbol}">News</button>
        <button class="btn btn-primary" type="button" data-refresh-chart="${panel}:${symbol}:${range}">Refresh chart</button>
      </div>

      <article class="card chart-card chart-card-feature">
        <div class="chart-canvas-wrap">
          <div class="chart-canvas" id="chartCanvas${panel}" data-chart-panel="${panel}"></div>
          ${points.length ? "" : `<div class="chart-loading">${loadingSkeleton(4)}</div>`}
        </div>
      </article>

      <div class="card-grid chart-summary-grid">
        <article class="card stat-card"><span>Range</span><strong>${range.toUpperCase()}</strong><small>${symbol}</small></article>
        <article class="card stat-card"><span>High</span><strong>${points.length ? formatPrice(stats.high, symbol) : "--"}</strong><small>${points.length ? "Visible range" : "Waiting"}</small></article>
        <article class="card stat-card"><span>Return</span><strong class="${stats.returnPct >= 0 ? "positive" : "negative"}">${points.length ? formatSignedPct(stats.returnPct) : "--"}</strong><small>${points.length ? "Start to end" : "Waiting"}</small></article>
      </div>
    </section>
  `;
}

function renderNews(panel) {
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
              return `
                <article class="news-item">
                  <div class="news-meta">
                    <span class="news-source">${item.source}</span>
                    <span class="news-time">${item.time}</span>
                    <span class="news-sentiment ${String(item.sentiment || "Neutral").toLowerCase()}">${item.sentiment || "Neutral"}</span>
                  </div>
                  <div class="news-row">
                    <a href="${item.link}" target="_blank" rel="noopener" class="news-title">${item.headline}</a>
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
}

function renderScreener(panel) {
  const filters = state.screenerFilters[panel];
  const sectors = [...new Set(universe.map((item) => item.sector))].sort();
  const universes = [...new Set(universe.map((item) => item.universe))].sort();
  const results = filterUniverse(filters).slice(0, 80);

  return `
    <section class="stack stack-lg">
      <div class="screener-filters">
        <select data-screener-universe="${panel}">
          <option value="">All universes</option>
          ${universes.map((u) => `<option value="${u}" ${u === filters.universe ? "selected" : ""}>${u}</option>`).join("")}
        </select>
        <select data-screener-sector="${panel}">
          <option value="">All sectors</option>
          ${sectors.map((s) => `<option value="${s}" ${s === filters.sector ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <input data-screener-search="${panel}" value="${filters.search}" placeholder="Search by symbol or name" />
      </div>
      <table class="data-table data-table-dense financial-data-table">
        <thead><tr><th>Ticker</th><th>Name</th><th>Sector</th><th>Universe</th><th>Price</th><th>Change</th><th></th></tr></thead>
        <tbody>
          ${results
            .map((item) => {
              const quote = buildQuote(item.symbol);
              return `
                <tr>
                  <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${item.symbol}" data-target-panel="${panel}">${item.symbol}</button></td>
                  <td>${item.name}</td>
                  <td>${item.sector}</td>
                  <td>${item.universe}</td>
                  <td>${formatPrice(quote?.price || item.seedPrice || 0, item.symbol)}</td>
                  <td class="${(quote?.changePct || 0) >= 0 ? "positive" : "negative"}">${quote ? formatSignedPct(quote.changePct) : "--"}</td>
                  <td><button class="btn btn-ghost btn-inline" type="button" data-load-module="chart" data-target-symbol="${item.symbol}" data-target-panel="${panel}">Chart</button></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderHeatmap(panel) {
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
                    return `<button class="tile ${tone}" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}"><strong>${symbol}</strong><small>${quote ? formatSignedPct(quote.changePct) : "--"}</small></button>`;
                  })
                  .join("")}
              </div>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderPortfolio(panel) {
  const rows = enrichPositions();
  const totals = calculatePortfolioSummary();
  return `
    <section class="stack stack-lg">
      <div class="card-grid card-grid-home">
        <article class="card stat-card"><span>Value</span><strong>${formatPrice(totals.value, "USD")}</strong></article>
        <article class="card stat-card"><span>P/L</span><strong class="${totals.pnl >= 0 ? "positive" : "negative"}">${totals.pnl >= 0 ? "+" : ""}${formatPrice(totals.pnl, "USD")}</strong></article>
        <article class="card stat-card"><span>Return</span><strong class="${totals.pnlPct >= 0 ? "positive" : "negative"}">${formatSignedPct(totals.pnlPct)}</strong></article>
      </div>
      <form id="addPositionForm" class="add-pos-form">
        <input name="symbol" placeholder="Ticker" required />
        <input name="shares" type="number" step="0.01" placeholder="Shares" required />
        <input name="cost" type="number" step="0.01" placeholder="Cost" required />
        <button class="btn btn-primary" type="submit">Add position</button>
      </form>
      <table class="data-table data-table-dense financial-data-table">
        <thead><tr><th>Ticker</th><th>Shares</th><th>Cost</th><th>Mark</th><th>Value</th><th>P/L</th><th></th></tr></thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${panel}">${row.symbol}</button></td>
                  <td>${row.shares}</td>
                  <td>${formatPrice(row.cost, row.symbol)}</td>
                  <td>${formatPrice(row.price, row.symbol)}</td>
                  <td>${formatPrice(row.value, "USD")}</td>
                  <td class="${row.pnl >= 0 ? "positive" : "negative"}">${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}</td>
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
      </table>
    </section>
  `;
}

function renderMacro() {
  const fxCards = macroDefaults.currencies
    .map((currency) => ({ currency, rate: state.fxRates[currency] }))
    .filter((item) => item.rate)
    .map((item) => `<article class="card fx-card"><span>USD/${item.currency}</span><strong>${Number(item.rate).toFixed(4)}</strong></article>`)
    .join("");

  return `
    <section class="stack stack-lg">
      <div class="toolbar">
        <button class="btn btn-primary" type="button" data-refresh-all>Refresh macro</button>
      </div>
      <div class="card-grid card-grid-home">
        <article class="card stat-card"><span>Market phase</span><strong>${state.marketPhase}</strong><small>New York session</small></article>
        <article class="card stat-card"><span>Server</span><strong>${state.health.ok ? "Live" : "Offline"}</strong><small>${state.health.server}</small></article>
        <article class="card stat-card"><span>FX crosses</span><strong>${Object.keys(state.fxRates).length}</strong><small>USD base pairs</small></article>
      </div>
      <article class="card">
        <header class="card-head"><h4>Yield curve</h4></header>
        <div class="curve-grid">
          ${macroDefaults.curve.map((point) => `<div class="curve-col"><div class="curve-bar" style="height:${point.yield * 18}px"></div><strong>${point.yield.toFixed(2)}%</strong><small>${point.tenor}</small></div>`).join("")}
        </div>
      </article>
      <article class="card">
        <header class="card-head"><h4>FX rates</h4></header>
        <div class="fx-grid">${fxCards || loadingSkeleton(4)}</div>
      </article>
    </section>
  `;
}

function renderOptions(panel) {
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
        <article class="card stat-card"><span>Underlying</span><strong>${symbol}</strong><small>${chain?.spot ? formatPrice(chain.spot, symbol) : "Waiting for chain"}</small></article>
        <article class="card stat-card"><span>Calls</span><strong>${chain?.calls?.length || 0}</strong><small>Loaded contracts</small></article>
        <article class="card stat-card"><span>Puts</span><strong>${chain?.puts?.length || 0}</strong><small>Loaded contracts</small></article>
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
}

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
                <td>${contract.strike?.fmt || contract.strike || "--"}</td>
                <td>${contract.bid?.fmt || contract.bid || "--"}</td>
                <td>${contract.ask?.fmt || contract.ask || "--"}</td>
                <td>${contract.lastPrice?.fmt || contract.lastPrice || "--"}</td>
                <td>${contract.openInterest?.fmt || contract.openInterest || "--"}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderCalculator(panel) {
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
          <p>Call: <strong>${option.call.toFixed(4)}</strong></p>
          <p>Put: <strong>${option.put.toFixed(4)}</strong></p>
          <p>Delta: <strong>${option.delta.toFixed(4)}</strong></p>
          <p>Gamma: <strong>${option.gamma.toFixed(6)}</strong></p>
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
          <p>Price: <strong>${bond.price.toFixed(4)}</strong></p>
          <p>Duration: <strong>${bond.duration.toFixed(4)}</strong></p>
          <p>Mod duration: <strong>${bond.modifiedDuration.toFixed(4)}</strong></p>
          <p>Convexity: <strong>${bond.convexity.toFixed(4)}</strong></p>
        </div>
      </article>
    </section>
  `;
}

function calcInput(label, key, value) {
  return `<label class="calc-input"><span>${label}</span><input data-calc-key="${key}" value="${value}" /></label>`;
}

function processCommand() {
  const raw = String(el.commandInput?.value || "").trim();
  if (!raw) return;

  const upper = raw.toUpperCase();
  const parts = upper.split(/\s+/);
  const [first, second, third, fourth] = parts;

  state.commandHistory.unshift(raw);
  state.commandHistory = state.commandHistory.slice(0, 50);
  state.commandHistoryIndex = -1;

  if (first === "HELP") {
    state.newsItems = commandCatalog.map((item) => ({
      source: "Command",
      headline: `${item.cmd} — ${item.desc}`,
      time: currentTimeShort(),
      link: "#",
    }));
    state.newsFilter = "ALL";
    loadModule("news", state.activePanel, { reveal: true });
  } else if (first === "REFRESH") {
    refreshAllData();
  } else if (first === "SAVE") {
    queueWorkspaceSave();
    showToast("Workspace save queued.", "success");
  } else if (first === "GRID") {
    setFocusedPanel(null);
  } else if (first === "FOCUS" && second && !Number.isNaN(Number(second))) {
    setFocusedPanel(Number(second));
  } else if (first === "NEXT") {
    cycleModule(state.activePanel, 1);
  } else if (first === "PREV") {
    cycleModule(state.activePanel, -1);
  } else if (first === "RANGE" && second) {
    const range = normalizeChartRange(second);
    state.chartRanges[state.activePanel] = range;
    if (state.panelModules[state.activePanel] !== "chart") {
      loadModule("chart", state.activePanel, { reveal: true });
    }
    refreshChart(state.panelSymbols[state.activePanel] || "AAPL", range);
  } else if (first === "BRIEF" || first === "BRIEFING") {
    loadModule("briefing", state.activePanel, { reveal: true });
  } else if (first === "HOME") {
    loadModule("home", state.activePanel, { reveal: true });
  } else if (first === "SETTINGS" || first === "ACCOUNT") {
    openSettingsModal();
  } else if (first === "SUGGEST" || first === "SUGGESTIONS") {
    loadModule("home", state.activePanel, { reveal: true });
    showToast("Showing suggested next steps.", "neutral");
  } else if ((first === "LOGIN" || first === "SIGNUP" || first === "REGISTER") || (first === "SYNC" && !second)) {
    if (AUTH_ENABLED) {
      openAuthModal(first === "SIGNUP" || first === "REGISTER" ? "signup" : "login");
    } else {
      showToast("Login is paused for now.", "neutral");
    }
  } else if (first === "NEWS" && second) {
    state.newsFilter = second;
    loadModule("news", state.activePanel, { reveal: true });
  } else if (first === "ANALYZE") {
    loadDeepDive(second || state.panelSymbols[state.activePanel] || "AAPL", { panel: state.activePanel });
  } else if (first === "SYNC" && second) {
    syncTicker(second);
  } else if (first === "NEWS") {
    state.newsFilter = "ALL";
    loadModule("news", state.activePanel, { reveal: true });
  } else if (first === "PORT") {
    loadModule("portfolio", state.activePanel, { reveal: true });
  } else if (first === "MACRO") {
    loadModule("macro", state.activePanel, { reveal: true });
  } else if (first === "SCREENER" || first === "EQS") {
    loadModule("screener", state.activePanel, { reveal: true });
  } else if (first === "HEAT" || first === "HEATMAP") {
    loadModule("heatmap", state.activePanel, { reveal: true });
  } else if (first === "OPTIONS" && second) {
    state.panelSymbols[state.activePanel] = second;
    state.optionsSelection.symbol = second;
    loadModule("options", state.activePanel, { reveal: true });
    refreshOptions(second, state.optionsSelection.expiration);
  } else if (first === "WATCH" && second) {
    addToWatchlist(second);
  } else if (first === "ALERT" && second && third) {
    const operator = [">=", "<="].includes(third) ? third : ">=";
    const threshold = Number(operator === third ? fourth : third);
    createAlert(second, threshold, operator);
  } else if (first === "ADDPOS" && second && third && fourth) {
    addPosition({ symbol: second, shares: Number(third), cost: Number(fourth) });
  } else if (second === "Q" || first === "QUOTE") {
    const symbol = first === "QUOTE" ? second : first;
    if (symbol) {
      state.panelSymbols[state.activePanel] = symbol;
      loadModule("quote", state.activePanel, { reveal: true });
      refreshQuotes([symbol]);
    }
  } else if (second === "CHART" || first === "CHART") {
    const symbol = first === "CHART" ? second : first;
    if (symbol) {
      state.panelSymbols[state.activePanel] = symbol;
      loadModule("chart", state.activePanel, { reveal: true });
      refreshChart(symbol, state.chartRanges[state.activePanel] || "1mo");
    }
  } else if (universeMap.has(first)) {
    state.panelSymbols[state.activePanel] = first;
    loadModule("quote", state.activePanel, { reveal: true });
    refreshQuotes([first]);
  } else {
    showToast(`Unknown command: ${upper}`, "error");
    showToast(`I couldn't find “${upper}”. Try HELP.`, "error");
  }

  if (el.commandInput) el.commandInput.value = "";
  hideAutocomplete();
  closeCommandPalette();
  syncUiCache();
  queueWorkspaceSave();
}

function handleCommandKeydown(event) {
  if (event.key === "Enter") {
    processCommand();
    return;
  }
  if (event.key === "Escape") {
    if (el.commandInput) el.commandInput.value = "";
    hideAutocomplete();
    closeCommandPalette();
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (state.commandHistoryIndex < state.commandHistory.length - 1) {
      state.commandHistoryIndex += 1;
      el.commandInput.value = state.commandHistory[state.commandHistoryIndex];
    }
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (state.commandHistoryIndex > 0) {
      state.commandHistoryIndex -= 1;
      el.commandInput.value = state.commandHistory[state.commandHistoryIndex];
    } else {
      state.commandHistoryIndex = -1;
      el.commandInput.value = "";
    }
  }
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

  if (event.key === "Escape") {
    closeSettingsModal();
    closeAuthModal();
    closeCommandPalette();
  }
}

function buildCommandSuggestions(panel) {
  const symbol = state.panelSymbols[panel] || state.watchlist[0] || "AAPL";
  const suggestions = [];

  if (AUTH_ENABLED && !state.user) {
    suggestions.push({
      label: "Sign in and sync",
      detail: "Back up your workspace to the backend",
      command: "LOGIN",
    });
  } else if (AUTH_ENABLED && state.user) {
    suggestions.push({
      label: "Open account settings",
      detail: "Update profile, password, or account state",
      command: "SETTINGS",
    });
  } else {
    suggestions.push({
      label: "Local workspace mode",
      detail: "Everything is running without login right now",
      command: "SAVE",
    });
  }

  suggestions.push({
    label: "Open Meridian Briefing",
    detail: "See regime, breadth, and signal board",
    command: "BRIEF",
  });

  if (!state.alerts.length) {
    const threshold = Math.max(1, Math.round((buildQuote(symbol)?.price || 100) * 1.03));
    suggestions.push({
      label: `Create ${symbol} alert`,
      detail: "Track a price level for this symbol",
      command: `ALERT ${symbol} ${threshold}`,
    });
  } else {
    suggestions.push({
      label: "Review positions and alerts",
      detail: "Check triggers and current exposure",
      command: "PORT",
    });
  }

  if (state.watchlist.length < 10) {
    suggestions.push({
      label: "Broaden your watchlist",
      detail: "Add a benchmark like SPY",
      command: "WATCH SPY",
    });
  }

  suggestions.push({
    label: "Show more suggestions",
    detail: "Refresh this panel with quick ideas",
    command: "SUGGEST",
  });

  return suggestions.slice(0, 5);
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
  if (!state.user) {
    uiCache.write({
      ...uiCache.read(),
      guestWorkspace: serializeWorkspace(),
    });
    return;
  }
  setNetworkStatus("Live · Saving");
  window.clearTimeout(state.persistTimer);
  state.persistTimer = window.setTimeout(async () => {
    try {
      await workspaceApi.save(serializeWorkspace());
      setNetworkStatus("Live · Saved");
    } catch {
      setNetworkStatus("Live · Retry");
    }
  }, 350);
}

function serializeWorkspace() {
  return {
    watchlist: state.watchlist,
    alerts: state.alerts,
    positions: state.positions,
    panelModules: state.panelModules,
    panelSymbols: state.panelSymbols,
    commandHistory: state.commandHistory,
  };
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
  if (el.lastUpdated) el.lastUpdated.textContent = currentTimeShort();
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

function filterUniverse(filters) {
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
      "/node_modules/lightweight-charts/dist/lightweight-charts.production.mjs",
      "../node_modules/lightweight-charts/dist/lightweight-charts.production.mjs",
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
    container.innerHTML = `<div class="empty-inline">Chart engine unavailable. Data is still live.</div>`;
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
      vertLine: { visible: true, labelVisible: false, color: "#4A90E2" },
      horzLine: { visible: true, labelVisible: false, color: "#4A90E2" },
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

  chartViews.set(panel, { chart, container });
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
  uiCache.write({
    ...uiCache.read(),
    activePanel: state.activePanel,
    focusedPanel: state.focusedPanel,
    autoJumpToPanel: state.autoJumpToPanel,
    chartRanges: state.chartRanges,
    newsFilter: state.newsFilter,
  });
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

function formatExpiry(value) {
  if (!value) return "Nearest";
  return new Date(Number(value) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function currentTimeShort() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
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

init();
