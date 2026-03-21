# Supporting frontend files

Copy-paste packet generated from the current workspace state.

## Included Files

- `src/app.js`
- `src/auth.js`
- `src/storage.js`

---

## `src/app.js`

````javascript
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
  heroMetrics,
  macroDefaults,
  moduleOrder,
  moduleTitles,
  onboardingHighlights,
} from "./data.js";
import { createAccount, login, logout, restoreSessionUser } from "./auth.js";
import { fetchChart, fetchFxRates, fetchNews, fetchOptions, fetchQuotes } from "./services.js";
import { getUserState, saveUserState } from "./storage.js";

const universe = buildUniverse();
const universeMap = new Map(universe.map((item) => [item.symbol, item]));

const state = {
  user: null,
  userState: null,
  sessionStartedAt: Date.now(),
  activePanel: 1,
  panelModules: { 1: "home", 2: "quote", 3: "chart", 4: "news" },
  panelSymbols: { 1: "NVDA", 2: "AAPL", 3: "MSFT", 4: "QQQ" },
  quotes: new Map(),
  chartCache: new Map(),
  optionsCache: new Map(),
  newsItems: [],
  fxRates: {},
  watchlist: [...defaultWatchlist],
  alerts: structuredClone(defaultAlerts),
  positions: structuredClone(defaultPositions),
  commandHistory: [],
  commandHistoryIndex: -1,
  screenerFilters: {
    1: { universe: "", sector: "", search: "" },
    2: { universe: "", sector: "", search: "" },
    3: { universe: "", sector: "", search: "" },
    4: { universe: "", sector: "", search: "" },
  },
  calculator: structuredClone(calculatorDefaults),
  optionsSelection: { symbol: "AAPL", expiration: null },
  refreshCountdown: 30,
};

const elements = {
  authShell: document.querySelector("#authShell"),
  terminalApp: document.querySelector("#terminalApp"),
  loginForm: document.querySelector("#loginForm"),
  signupForm: document.querySelector("#signupForm"),
  authTabs: document.querySelector("#authTabs"),
  authMessage: document.querySelector("#authMessage"),
  heroMetrics: document.querySelector("#heroMetrics"),
  heroHighlights: document.querySelector("#heroHighlights"),
  appTitle: document.querySelector("#appTitle"),
  userBadge: document.querySelector("#userBadge"),
  userMeta: document.querySelector("#userMeta"),
  marketStatus: document.querySelector("#marketStatus"),
  clockDisplay: document.querySelector("#clockDisplay"),
  sessionClock: document.querySelector("#sessionClock"),
  activeCommandDisplay: document.querySelector("#activeCommandDisplay"),
  functionRow: document.querySelector("#functionRow"),
  watchlistRail: document.querySelector("#watchlistRail"),
  alertRail: document.querySelector("#alertRail"),
  commandInput: document.querySelector("#commandInput"),
  runCommandButton: document.querySelector("#runCommandButton"),
  autocomplete: document.querySelector("#autocomplete"),
  lastUpdated: document.querySelector("#lastUpdated"),
  refreshCountdown: document.querySelector("#refreshCountdown"),
  watchCount: document.querySelector("#watchCount"),
  alertCount: document.querySelector("#alertCount"),
  networkStatus: document.querySelector("#networkStatus"),
  logoutButton: document.querySelector("#logoutButton"),
  toast: document.querySelector("#toast"),
};

function init() {
  renderLanding();
  bindAuthEvents();
  bindWorkspaceEvents();

  const restoredUser = restoreSessionUser();
  if (restoredUser) {
    completeLogin(restoredUser);
  }

  updateClock();
  setInterval(updateClock, 1000);
  setInterval(handleRefreshCountdown, 1000);
}

function renderLanding() {
  document.title = appName;
  elements.appTitle.textContent = appName;

  const roleSelect = document.querySelector("#signupRole");
  if (roleSelect) {
    roleSelect.innerHTML = authRoles.map((role) => `<option value="${role}">${role}</option>`).join("");
  }

  elements.heroMetrics.innerHTML = heroMetrics
    .map(
      (metric) => `
        <article class="metric-card">
          <strong>${metric.value}</strong>
          <span>${metric.label}</span>
        </article>
      `,
    )
    .join("");

  elements.heroHighlights.innerHTML = onboardingHighlights
    .map(
      (item) => `
        <article class="highlight-card">
          <h3>${item.title}</h3>
          <p>${item.body}</p>
        </article>
      `,
    )
    .join("");
}

function bindAuthEvents() {
  elements.authTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-auth-tab]");
    if (!button) {
      return;
    }
    setAuthTab(button.dataset.authTab);
  });

  elements.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.loginForm);

    try {
      const user = await login({
        identifier: String(form.get("identifier") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      showAuthMessage("Login successful.", "success");
      completeLogin(user);
    } catch (error) {
      showAuthMessage(error.message, "error");
    }
  });

  elements.signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.signupForm);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password.length < 8) {
      showAuthMessage("Password must be at least 8 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showAuthMessage("Passwords do not match.", "error");
      return;
    }

    try {
      const user = await createAccount({
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        email: String(form.get("email") ?? ""),
        username: String(form.get("username") ?? ""),
        password,
        role: String(form.get("role") ?? "Other"),
      });
      showAuthMessage("Account created. Loading workspace...", "success");
      completeLogin(user);
    } catch (error) {
      showAuthMessage(error.message, "error");
    }
  });
}

function bindWorkspaceEvents() {
  elements.runCommandButton?.addEventListener("click", processCommand);
  elements.commandInput?.addEventListener("input", renderAutocomplete);
  elements.commandInput?.addEventListener("keydown", handleCommandKeydown);
  elements.functionRow?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module]");
    if (!button) {
      return;
    }
    loadModule(button.dataset.module, state.activePanel);
  });
  elements.logoutButton?.addEventListener("click", handleLogout);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("input", handleDocumentInput);
  document.addEventListener("keydown", handleGlobalHotkeys);
  document.addEventListener("submit", handleDocumentSubmit);
}

function handleDocumentClick(event) {
  const panelButton = event.target.closest("[data-panel]");
  if (panelButton) {
    setActivePanel(Number(panelButton.dataset.panel));
    return;
  }

  const cycleButton = event.target.closest("[data-panel-cycle]");
  if (cycleButton) {
    const [panel, direction] = cycleButton.dataset.panelCycle.split(":").map(Number);
    cycleModule(panel, direction);
    return;
  }

  const moduleTrigger = event.target.closest("[data-load-module]");
  if (moduleTrigger) {
    const panel = Number(moduleTrigger.dataset.targetPanel || state.activePanel);
    if (moduleTrigger.dataset.targetSymbol) {
      state.panelSymbols[panel] = moduleTrigger.dataset.targetSymbol;
    }
    loadModule(moduleTrigger.dataset.loadModule, panel);
    if (moduleTrigger.dataset.loadModule === "chart") {
      refreshChart(state.panelSymbols[panel]);
    }
    if (moduleTrigger.dataset.loadModule === "options") {
      refreshOptions(state.panelSymbols[panel], state.optionsSelection.expiration);
    }
    return;
  }

  const watchButton = event.target.closest("[data-watch-symbol]");
  if (watchButton) {
    addToWatchlist(watchButton.dataset.watchSymbol);
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

  const addAlert = event.target.closest("[data-alert-symbol]");
  if (addAlert) {
    createAlert(addAlert.dataset.alertSymbol, Number(addAlert.dataset.alertThreshold), ">=");
    return;
  }

  const autocompleteItem = event.target.closest("[data-autocomplete]");
  if (autocompleteItem) {
    elements.commandInput.value = autocompleteItem.dataset.autocomplete;
    processCommand();
    return;
  }

  if (!event.target.closest(".command-shell")) {
    hideAutocomplete();
  }
}

function handleDocumentInput(event) {
  const screenerSearch = event.target.closest("[data-screener-search]");
  if (screenerSearch) {
    const panel = Number(screenerSearch.dataset.screenerSearch);
    state.screenerFilters[panel].search = screenerSearch.value;
    renderPanel(panel);
    return;
  }

  const screenerUniverse = event.target.closest("[data-screener-universe]");
  if (screenerUniverse) {
    const panel = Number(screenerUniverse.dataset.screenerUniverse);
    state.screenerFilters[panel].universe = screenerUniverse.value;
    renderPanel(panel);
    return;
  }

  const screenerSector = event.target.closest("[data-screener-sector]");
  if (screenerSector) {
    const panel = Number(screenerSector.dataset.screenerSector);
    state.screenerFilters[panel].sector = screenerSector.value;
    renderPanel(panel);
    return;
  }

  const calcInput = event.target.closest("[data-calc-key]");
  if (calcInput) {
    setNestedCalculatorValue(calcInput.dataset.calcKey, Number(calcInput.value));
    renderAllPanels();
    return;
  }

  const quoteInput = event.target.closest("[data-quote-symbol]");
  if (quoteInput) {
    const panel = Number(quoteInput.dataset.quoteSymbol);
    state.panelSymbols[panel] = quoteInput.value.toUpperCase();
    return;
  }

  const optionInput = event.target.closest("[data-option-symbol]");
  if (optionInput) {
    const panel = Number(optionInput.dataset.optionSymbol);
    state.panelSymbols[panel] = optionInput.value.toUpperCase();
    state.optionsSelection.symbol = optionInput.value.toUpperCase();
    return;
  }

  const optionExpiry = event.target.closest("[data-option-expiry]");
  if (optionExpiry) {
    state.optionsSelection.expiration = optionExpiry.value || null;
    refreshOptions(state.optionsSelection.symbol, state.optionsSelection.expiration);
  }
}

function handleDocumentSubmit(event) {
  const addPositionForm = event.target.closest("#addPositionForm");
  if (!addPositionForm) {
    return;
  }

  event.preventDefault();
  const form = new FormData(addPositionForm);
  addPosition({
    symbol: String(form.get("symbol") ?? "").toUpperCase(),
    shares: Number(form.get("shares") ?? 0),
    cost: Number(form.get("cost") ?? 0),
  });
  addPositionForm.reset();
}

function setAuthTab(tabName) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === tabName);
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.authPanel !== tabName);
  });
}

function showAuthMessage(message, tone = "neutral") {
  elements.authMessage.textContent = message;
  elements.authMessage.dataset.tone = tone;
}

function completeLogin(user) {
  state.user = user;
  const userState = getUserState(user.id, {
    watchlist: defaultWatchlist,
    alerts: defaultAlerts,
    positions: defaultPositions,
  });

  state.userState = userState;
  state.watchlist = [...userState.watchlist];
  state.alerts = structuredClone(userState.alerts?.length ? userState.alerts : defaultAlerts);
  state.positions = structuredClone(userState.positions?.length ? userState.positions : defaultPositions);
  state.panelModules = { ...state.panelModules, ...userState.panelModules };
  state.panelSymbols = { ...state.panelSymbols, ...userState.panelSymbols };
  state.commandHistory = [...(userState.commandHistory ?? [])];
  state.sessionStartedAt = Date.now();
  state.refreshCountdown = 30;

  elements.authShell.classList.add("hidden");
  elements.terminalApp.classList.remove("hidden");
  elements.userBadge.textContent = `${user.firstName} ${user.lastName}`;
  elements.userMeta.textContent = `${user.role} · @${user.username}`;
  renderFunctionRow();
  renderRails();
  renderAllPanels();
  refreshAllData();
  elements.commandInput.focus();
  showToast(`Welcome, ${user.firstName}.`, "success");
}

function handleLogout() {
  logout();
  state.user = null;
  state.userState = null;
  elements.terminalApp.classList.add("hidden");
  elements.authShell.classList.remove("hidden");
  setAuthTab("login");
  showAuthMessage("Signed out.", "neutral");
  showToast("Signed out.", "neutral");
}

function buildQuote(symbol) {
  const base = universeMap.get(symbol);
  const live = state.quotes.get(symbol);
  if (!base && !live) {
    return null;
  }

  return {
    symbol,
    name: live?.name ?? base?.name ?? symbol,
    sector: base?.sector ?? "Unknown",
    universe: base?.universe ?? "Custom",
    exchange: live?.exchange ?? base?.exchange ?? "N/A",
    price: live?.price ?? base?.seedPrice ?? 0,
    changePct: live?.changePct ?? 0,
    change: live?.change ?? 0,
    marketCap: live?.marketCap ?? base?.marketCap ?? 0,
    volume: live?.volume ?? 0,
    dayHigh: live?.dayHigh ?? live?.price ?? base?.seedPrice ?? 0,
    dayLow: live?.dayLow ?? live?.price ?? base?.seedPrice ?? 0,
    previousClose: live?.previousClose ?? base?.seedPrice ?? 0,
  };
}

function renderFunctionRow() {
  elements.functionRow.innerHTML = functionKeys
    .map(
      (item) => `
        <button class="function-key ${state.panelModules[state.activePanel] === item.module ? "is-active" : ""}" data-module="${item.module}">
          <span>${item.key}</span>
          <strong>${item.label}</strong>
        </button>
      `,
    )
    .join("");
}

function renderRails() {
  elements.watchlistRail.innerHTML = state.watchlist
    .map((symbol) => {
      const quote = buildQuote(symbol);
      if (!quote) {
        return "";
      }
      return `
        <article class="rail-item-wrap">
          <button class="rail-item" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${state.activePanel}">
            <div>
              <strong>${symbol}</strong>
              <span>${quote.name}</span>
            </div>
            <div>
              <span>${formatPrice(quote.price, symbol)}</span>
              <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
            </div>
          </button>
          <button class="rail-remove" type="button" data-remove-watch="${symbol}">×</button>
        </article>
      `;
    })
    .join("");

  elements.alertRail.innerHTML = state.alerts
    .map(
      (alert) => `
        <article class="rail-alert ${alert.status === "triggered" ? "is-triggered" : ""}">
          <strong>${alert.symbol}</strong>
          <span>${alert.operator} ${alert.threshold}</span>
          <span>${alert.status}</span>
        </article>
      `,
    )
    .join("");

  updateStatusBar();
}

function setActivePanel(panel) {
  state.activePanel = panel;
  document.querySelectorAll("[data-panel]").forEach((node) => {
    node.classList.toggle("is-active", Number(node.dataset.panel) === panel);
  });
  renderFunctionRow();
}

function cycleModule(panel, direction) {
  const currentIndex = moduleOrder.indexOf(state.panelModules[panel]);
  const nextIndex = (currentIndex + direction + moduleOrder.length) % moduleOrder.length;
  loadModule(moduleOrder[nextIndex], panel);
}

function loadModule(moduleName, panel) {
  state.panelModules[panel] = moduleName;
  renderPanel(panel);
  setActivePanel(panel);
  persistWorkspace();
}

function renderAllPanels() {
  [1, 2, 3, 4].forEach((panel) => renderPanel(panel));
}

function renderPanel(panel) {
  const moduleName = state.panelModules[panel];
  const title = document.querySelector(`#panelTitle${panel}`);
  const content = document.querySelector(`#panelContent${panel}`);
  if (!title || !content) {
    return;
  }

  title.textContent = moduleTitles[moduleName] ?? moduleName.toUpperCase();

  const renderers = {
    home: renderHomeModule,
    quote: renderQuoteModule,
    chart: renderChartModule,
    news: renderNewsModule,
    screener: renderScreenerModule,
    heatmap: renderHeatmapModule,
    portfolio: renderPortfolioModule,
    macro: renderMacroModule,
    options: renderOptionsModule,
    calculator: renderCalculatorModule,
  };

  content.innerHTML = (renderers[moduleName] ?? renderHomeModule)(panel);
}

function renderHomeModule() {
  const topQuotes = state.watchlist.slice(0, 6).map((symbol) => buildQuote(symbol)).filter(Boolean);
  const portfolioValue = state.positions.reduce((sum, position) => {
    const quote = buildQuote(position.symbol);
    const price = quote?.price ?? position.cost;
    return sum + price * position.shares;
  }, 0);
  const portfolioBasis = state.positions.reduce((sum, position) => sum + position.cost * position.shares, 0);
  const pnl = portfolioValue - portfolioBasis;
  const signal = topQuotes.filter((quote) => quote.changePct >= 0).length >= Math.ceil(topQuotes.length / 2) ? "Risk-on" : "Risk-off";

  return `
    <section class="module-stack">
      <div class="hero-card-grid">
        <article class="hero-card"><span>Session signal</span><strong>${signal}</strong><p>Derived from the current watchlist balance.</p></article>
        <article class="hero-card"><span>Portfolio</span><strong>${formatPrice(portfolioValue, "USD")}</strong><p class="${pnl >= 0 ? "positive" : "negative"}">${pnl >= 0 ? "+" : ""}${formatPrice(pnl, "USD")}</p></article>
        <article class="hero-card"><span>Watchlist</span><strong>${state.watchlist.length}</strong><p>${state.watchlist.slice(0, 4).join(" · ")}</p></article>
        <article class="hero-card"><span>Network</span><strong>${elements.networkStatus.textContent}</strong><p>Public endpoints with local persistence and fallbacks.</p></article>
      </div>
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Market pulse</span><span>${topQuotes.length} symbols</span></div>
          <div class="market-chip-grid">
            ${topQuotes
              .map(
                (quote) => `
                  <button class="market-chip" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${state.activePanel}">
                    <strong>${quote.symbol}</strong>
                    <span>${formatPrice(quote.price, quote.symbol)}</span>
                    <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
                  </button>
                `,
              )
              .join("")}
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>Active alerts</span><span>${state.alerts.length}</span></div>
          <div class="stack-list">
            ${state.alerts
              .map(
                (alert) => `
                  <article class="stack-item ${alert.status === "triggered" ? "is-positive" : ""}">
                    <strong>${alert.symbol}</strong>
                    <span>${alert.operator} ${alert.threshold}</span>
                    <small>${alert.status}</small>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderQuoteModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const quote = buildQuote(symbol) ?? buildQuote("AAPL");
  if (!quote) {
    return emptyStateMarkup("No quote data available yet.");
  }

  return `
    <section class="module-stack">
      <div class="toolbar-row">
        <input class="input" value="${quote.symbol}" data-quote-symbol="${panel}" />
        <button class="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">Refresh</button>
        <button class="button button-muted" data-watch-symbol="${quote.symbol}">Add Watch</button>
        <button class="button button-muted" data-load-module="chart" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">Chart</button>
      </div>
      <div class="quote-hero-card">
        <div>
          <span class="quote-symbol">${quote.symbol}</span>
          <h3>${quote.name}</h3>
          <strong class="quote-price">${formatPrice(quote.price, quote.symbol)}</strong>
          <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
        </div>
        <div class="quote-side-metrics">
          <span>${quote.sector}</span>
          <span>${quote.universe}</span>
          <span>${quote.exchange}</span>
        </div>
      </div>
      <table class="terminal-table">
        <tbody>
          <tr><td>Previous close</td><td>${formatPrice(quote.previousClose, quote.symbol)}</td><td>Day high</td><td>${formatPrice(quote.dayHigh, quote.symbol)}</td></tr>
          <tr><td>Day low</td><td>${formatPrice(quote.dayLow, quote.symbol)}</td><td>Volume</td><td>${formatVolume(quote.volume)}</td></tr>
          <tr><td>Market cap</td><td>${formatMarketCap(quote.marketCap)}</td><td>Change $</td><td class="${quote.change >= 0 ? "positive" : "negative"}">${quote.change >= 0 ? "+" : ""}${Number(quote.change).toFixed(2)}</td></tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderChartModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const chartData = state.chartCache.get(buildChartKey(symbol, "1mo", "1d")) ?? [];
  const quote = buildQuote(symbol);

  return `
    <section class="module-stack">
      <div class="toolbar-row">
        <span class="toolbar-label">${symbol}</span>
        <button class="button button-muted" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">Reload</button>
      </div>
      <div class="chart-card">
        ${chartData.length ? buildLineChartSvg(chartData) : `<div class="empty-chart">Fetching chart data for ${symbol}...</div>`}
      </div>
      <div class="chart-meta-row">
        <span>${quote ? formatPrice(quote.price, quote.symbol) : "--"}</span>
        <span class="${quote && quote.changePct >= 0 ? "positive" : "negative"}">${quote ? formatSignedPct(quote.changePct) : "--"}</span>
      </div>
    </section>
  `;
}

function renderNewsModule() {
  if (!state.newsItems.length) {
    return emptyStateMarkup("Fetching news feeds...");
  }

  return `
    <section class="module-stack news-stack">
      ${state.newsItems
        .map(
          (item) => `
            <article class="news-card">
              <div class="news-meta"><span>${item.source}</span><span>${item.time}</span></div>
              <strong>${item.headline}</strong>
              <a href="${item.link ?? "#"}" target="_blank" rel="noopener">Open source</a>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderScreenerModule(panel) {
  const filters = state.screenerFilters[panel];
  const filtered = getFilteredUniverse(filters);
  const sectors = [...new Set(universe.map((item) => item.sector))].sort();
  const universes = [...new Set(universe.map((item) => item.universe))].sort();

  return `
    <section class="module-stack">
      <div class="toolbar-row wrap">
        <select class="input select" data-screener-universe="${panel}">
          <option value="">All universes</option>
          ${universes.map((item) => `<option value="${item}" ${item === filters.universe ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <select class="input select" data-screener-sector="${panel}">
          <option value="">All sectors</option>
          ${sectors.map((item) => `<option value="${item}" ${item === filters.sector ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <input class="input grow" data-screener-search="${panel}" value="${filters.search}" placeholder="symbol / name" />
        <span class="toolbar-label">${filtered.length} results</span>
      </div>
      <div class="table-wrap">
        <table class="terminal-table compact">
          <thead><tr><th>Ticker</th><th>Name</th><th>Sector</th><th>Universe</th><th>Price</th><th>Chg%</th></tr></thead>
          <tbody>
            ${filtered
              .slice(0, 80)
              .map((item) => {
                const quote = buildQuote(item.symbol);
                return `
                  <tr>
                    <td><button class="table-link" data-load-module="quote" data-target-symbol="${item.symbol}" data-target-panel="${state.activePanel}">${item.symbol}</button></td>
                    <td>${item.name}</td>
                    <td>${item.sector}</td>
                    <td>${item.universe}</td>
                    <td>${quote ? formatPrice(quote.price, item.symbol) : formatPrice(item.seedPrice, item.symbol)}</td>
                    <td class="${quote && quote.changePct >= 0 ? "positive" : "negative"}">${quote ? formatSignedPct(quote.changePct) : "--"}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderHeatmapModule() {
  return `
    <section class="heatmap-grid">
      ${Object.entries(heatmapGroups)
        .map(
          ([sector, symbols]) => `
            <article class="module-card">
              <div class="card-header"><span>${sector}</span><span>${symbols.length}</span></div>
              <div class="heat-sector-grid">
                ${symbols
                  .map((symbol) => {
                    const quote = buildQuote(symbol);
                    const magnitude = Math.max(1, Math.min(5, Math.round(Math.abs(quote?.changePct ?? 0)) + 1));
                    return `
                      <button class="heat-tile ${quote && quote.changePct >= 0 ? "up" : "down"} size-${magnitude}" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${state.activePanel}">
                        <strong>${symbol}</strong>
                        <span>${quote ? formatSignedPct(quote.changePct) : "--"}</span>
                      </button>
                    `;
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

function renderPortfolioModule() {
  const rows = state.positions.map((position) => {
    const quote = buildQuote(position.symbol);
    const price = quote?.price ?? position.cost;
    const value = price * position.shares;
    const basis = position.cost * position.shares;
    const pnl = value - basis;
    const pnlPct = basis ? (pnl / basis) * 100 : 0;
    return { ...position, price, value, pnl, pnlPct };
  });

  const totalValue = rows.reduce((sum, item) => sum + item.value, 0);
  const totalBasis = rows.reduce((sum, item) => sum + item.cost * item.shares, 0);
  const totalPnl = totalValue - totalBasis;
  const totalPct = totalBasis ? (totalPnl / totalBasis) * 100 : 0;

  return `
    <section class="module-stack">
      <div class="hero-card-grid portfolio-summary">
        <article class="hero-card"><span>Total value</span><strong>${formatPrice(totalValue, "USD")}</strong></article>
        <article class="hero-card"><span>Total P/L</span><strong class="${totalPnl >= 0 ? "positive" : "negative"}">${totalPnl >= 0 ? "+" : ""}${formatPrice(totalPnl, "USD")}</strong></article>
        <article class="hero-card"><span>Total P/L %</span><strong class="${totalPct >= 0 ? "positive" : "negative"}">${formatSignedPct(totalPct)}</strong></article>
      </div>
      <form id="addPositionForm" class="toolbar-row wrap">
        <input class="input" name="symbol" placeholder="Symbol" />
        <input class="input" name="shares" type="number" step="0.01" placeholder="Shares" />
        <input class="input" name="cost" type="number" step="0.01" placeholder="Cost basis" />
        <button class="button" type="submit">Add Position</button>
      </form>
      <div class="table-wrap">
        <table class="terminal-table compact">
          <thead><tr><th>Ticker</th><th>Shares</th><th>Cost</th><th>Mark</th><th>Value</th><th>P/L</th><th>P/L %</th><th></th></tr></thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td><button class="table-link" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${state.activePanel}">${row.symbol}</button></td>
                    <td>${row.shares}</td>
                    <td>${formatPrice(row.cost, row.symbol)}</td>
                    <td>${formatPrice(row.price, row.symbol)}</td>
                    <td>${formatPrice(row.value, "USD")}</td>
                    <td class="${row.pnl >= 0 ? "positive" : "negative"}">${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}</td>
                    <td class="${row.pnlPct >= 0 ? "positive" : "negative"}">${formatSignedPct(row.pnlPct)}</td>
                    <td><button class="button button-danger" type="button" data-remove-position="${row.symbol}">Remove</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMacroModule() {
  const fxRows = macroDefaults.currencies
    .map((currency) => ({ currency, rate: state.fxRates[currency] }))
    .filter((item) => item.rate)
    .map(
      (item) => `
        <article class="fx-card">
          <strong>USD/${item.currency}</strong>
          <span>${Number(item.rate).toFixed(4)}</span>
        </article>
      `,
    )
    .join("");

  return `
    <section class="module-stack">
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Yield curve</span><span>Reference</span></div>
          <div class="curve-grid">
            ${macroDefaults.curve
              .map(
                (point) => `
                  <div class="curve-column">
                    <div class="curve-bar" style="height:${point.yield * 18}px"></div>
                    <strong>${point.yield.toFixed(2)}%</strong>
                    <span>${point.tenor}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>FX monitor</span><span>Live</span></div>
          <div class="fx-grid">${fxRows || emptyStateMarkup("Fetching FX rates...")}</div>
        </section>
      </div>
    </section>
  `;
}

function renderOptionsModule(panel) {
  const symbol = state.panelSymbols[panel] ?? state.optionsSelection.symbol ?? "AAPL";
  const cacheKey = buildOptionKey(symbol, state.optionsSelection.expiration);
  const optionState = state.optionsCache.get(cacheKey);
  const expirations = optionState?.expirations ?? [];
  const calls = optionState?.calls ?? [];
  const puts = optionState?.puts ?? [];
  const quote = buildQuote(symbol);

  return `
    <section class="module-stack">
      <div class="toolbar-row wrap">
        <input class="input" value="${symbol}" data-option-symbol="${panel}" />
        <button class="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Load Chain</button>
        <select class="input select" data-option-expiry>
          <option value="">Nearest expiry</option>
          ${expirations
            .slice(0, 8)
            .map(
              (value) => `<option value="${value}" ${String(state.optionsSelection.expiration ?? "") === String(value) ? "selected" : ""}>${formatExpiry(value)}</option>`,
            )
            .join("")}
        </select>
        <span class="toolbar-label">Spot ${quote ? formatPrice(quote.price, symbol) : "--"}</span>
      </div>
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Calls</span><span>${calls.length}</span></div>
          ${renderOptionTable(calls, "call")}
        </section>
        <section class="module-card">
          <div class="card-header"><span>Puts</span><span>${puts.length}</span></div>
          ${renderOptionTable(puts, "put")}
        </section>
      </div>
    </section>
  `;
}

function renderCalculatorModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const quote = buildQuote(symbol);
  const optionInputs = { ...state.calculator.option, spot: quote?.price ?? state.calculator.option.spot };
  const optionResult = calculateBlackScholes(optionInputs);
  const bondResult = calculateBond(state.calculator.bond);

  return `
    <section class="module-stack">
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Black-Scholes</span><span>${symbol}</span></div>
          <div class="calc-grid">
            ${renderCalculatorInput("Spot", "option.spot", optionInputs.spot)}
            ${renderCalculatorInput("Strike", "option.strike", state.calculator.option.strike)}
            ${renderCalculatorInput("Years", "option.years", state.calculator.option.years)}
            ${renderCalculatorInput("Rate %", "option.rate", state.calculator.option.rate)}
            ${renderCalculatorInput("Vol %", "option.volatility", state.calculator.option.volatility)}
          </div>
          <div class="calc-results">
            <div><span>Call</span><strong>${optionResult.call.toFixed(4)}</strong></div>
            <div><span>Put</span><strong>${optionResult.put.toFixed(4)}</strong></div>
            <div><span>Delta</span><strong>${optionResult.delta.toFixed(4)}</strong></div>
            <div><span>Gamma</span><strong>${optionResult.gamma.toFixed(6)}</strong></div>
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>Bond pricing</span><span>Fixed income</span></div>
          <div class="calc-grid">
            ${renderCalculatorInput("Face", "bond.face", state.calculator.bond.face)}
            ${renderCalculatorInput("Coupon %", "bond.coupon", state.calculator.bond.coupon)}
            ${renderCalculatorInput("YTM %", "bond.ytm", state.calculator.bond.ytm)}
            ${renderCalculatorInput("Maturity", "bond.maturity", state.calculator.bond.maturity)}
            ${renderCalculatorInput("Frequency", "bond.frequency", state.calculator.bond.frequency)}
          </div>
          <div class="calc-results">
            <div><span>Price</span><strong>${bondResult.price.toFixed(4)}</strong></div>
            <div><span>Duration</span><strong>${bondResult.duration.toFixed(4)}</strong></div>
            <div><span>Mod duration</span><strong>${bondResult.modifiedDuration.toFixed(4)}</strong></div>
            <div><span>Convexity</span><strong>${bondResult.convexity.toFixed(4)}</strong></div>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderCalculatorInput(label, key, value) {
  return `
    <label class="calc-input-row">
      <span>${label}</span>
      <input class="input" data-calc-key="${key}" value="${value}" />
    </label>
  `;
}

function renderOptionTable(contracts, kind) {
  if (!contracts.length) {
    return emptyStateMarkup(`Fetching ${kind} contracts...`);
  }

  return `
    <div class="table-wrap">
      <table class="terminal-table compact">
        <thead><tr><th>Strike</th><th>Bid</th><th>Ask</th><th>Last</th><th>Vol</th><th>OI</th></tr></thead>
        <tbody>
          ${contracts
            .map(
              (contract) => `
                <tr>
                  <td>${contract.strike?.fmt ?? contract.strike ?? "--"}</td>
                  <td>${contract.bid?.fmt ?? contract.bid ?? "--"}</td>
                  <td>${contract.ask?.fmt ?? contract.ask ?? "--"}</td>
                  <td>${contract.lastPrice?.fmt ?? contract.lastPrice ?? "--"}</td>
                  <td>${contract.volume?.fmt ?? contract.volume ?? "--"}</td>
                  <td>${contract.openInterest?.fmt ?? contract.openInterest ?? "--"}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function emptyStateMarkup(message) {
  return `<div class="empty-state">${message}</div>`;
}

function processCommand() {
  const raw = elements.commandInput.value.trim();
  if (!raw) {
    return;
  }

  const upper = raw.toUpperCase();
  state.commandHistory.unshift(raw);
  state.commandHistory = state.commandHistory.slice(0, 50);
  state.commandHistoryIndex = -1;
  elements.activeCommandDisplay.textContent = upper;

  const parts = upper.split(/\s+/);
  const [first, second, third, fourth] = parts;

  if (first === "HELP") {
    state.panelModules[state.activePanel] = "news";
    state.newsItems = commandCatalog.map((item) => ({
      source: "Command",
      headline: `${item.cmd} — ${item.desc}`,
      time: currentTimeShort(),
      link: "#",
    }));
    renderPanel(state.activePanel);
  } else if (first === "HOME") {
    loadModule("home", state.activePanel);
  } else if (first === "NEWS") {
    loadModule("news", state.activePanel);
  } else if (first === "EQS" || first === "SCREENER") {
    loadModule("screener", state.activePanel);
  } else if (first === "HEAT" || first === "HEATMAP") {
    loadModule("heatmap", state.activePanel);
  } else if (first === "PORT" || first === "PORTFOLIO") {
    loadModule("portfolio", state.activePanel);
  } else if (first === "MACRO") {
    loadModule("macro", state.activePanel);
  } else if (first === "CALC") {
    loadModule("calculator", state.activePanel);
  } else if ((first === "OMON" || first === "OPTIONS") && second) {
    state.panelSymbols[state.activePanel] = second;
    state.optionsSelection.symbol = second;
    loadModule("options", state.activePanel);
    refreshOptions(second, state.optionsSelection.expiration);
  } else if (first === "WATCH" && second) {
    addToWatchlist(second);
  } else if (first === "ALERT" && second && third) {
    createAlert(second, Number(third), ">=");
  } else if (first === "ADDPOS" && second && third && fourth) {
    addPosition({ symbol: second, shares: Number(third), cost: Number(fourth) });
  } else if (second === "Q" || first === "QUOTE") {
    const symbol = first === "QUOTE" ? second : first;
    if (symbol) {
      state.panelSymbols[state.activePanel] = symbol;
      loadModule("quote", state.activePanel);
      refreshQuotes([symbol]);
    }
  } else if (second === "CHART" || first === "CHART") {
    const symbol = first === "CHART" ? second : first;
    if (symbol) {
      state.panelSymbols[state.activePanel] = symbol;
      loadModule("chart", state.activePanel);
      refreshChart(symbol);
    }
  } else if (universeMap.has(first)) {
    state.panelSymbols[state.activePanel] = first;
    loadModule("quote", state.activePanel);
    refreshQuotes([first]);
  } else {
    showToast(`Unknown command: ${upper}`, "error");
  }

  persistWorkspace();
  elements.commandInput.value = "";
  hideAutocomplete();
  renderRails();
}

function handleCommandKeydown(event) {
  if (event.key === "Enter") {
    processCommand();
    return;
  }

  if (event.key === "Escape") {
    elements.commandInput.value = "";
    hideAutocomplete();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (state.commandHistoryIndex < state.commandHistory.length - 1) {
      state.commandHistoryIndex += 1;
      elements.commandInput.value = state.commandHistory[state.commandHistoryIndex];
    }
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (state.commandHistoryIndex > 0) {
      state.commandHistoryIndex -= 1;
      elements.commandInput.value = state.commandHistory[state.commandHistoryIndex];
    } else {
      state.commandHistoryIndex = -1;
      elements.commandInput.value = "";
    }
  }
}

function renderAutocomplete() {
  const value = elements.commandInput.value.trim().toUpperCase();
  if (!value) {
    hideAutocomplete();
    return;
  }

  const commandMatches = commandCatalog
    .filter((item) => item.cmd.startsWith(value) || item.cmd.includes(value))
    .slice(0, 5)
    .map((item) => ({ label: item.cmd, description: item.desc }));

  const symbolMatches = universe
    .filter((item) => item.symbol.startsWith(value) || item.name.toUpperCase().includes(value))
    .slice(0, 6)
    .map((item) => ({ label: `${item.symbol} Q`, description: item.name }));

  const suggestions = [...commandMatches, ...symbolMatches].slice(0, 8);
  if (!suggestions.length) {
    hideAutocomplete();
    return;
  }

  elements.autocomplete.innerHTML = suggestions
    .map(
      (item) => `
        <button class="autocomplete-item" type="button" data-autocomplete="${item.label}">
          <strong>${item.label}</strong>
          <span>${item.description}</span>
        </button>
      `,
    )
    .join("");
  elements.autocomplete.classList.remove("hidden");
}

function hideAutocomplete() {
  elements.autocomplete.classList.add("hidden");
}

function handleGlobalHotkeys(event) {
  if (document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && event.key !== "Escape") {
    return;
  }

  const hotkeys = {
    F1: "home",
    F2: "quote",
    F3: "chart",
    F4: "news",
    F5: "screener",
    F6: "heatmap",
    F7: "portfolio",
    F8: "macro",
    F9: "options",
    F10: "calculator",
  };

  if (event.key === "Tab") {
    event.preventDefault();
    setActivePanel((state.activePanel % 4) + 1);
    return;
  }

  if (hotkeys[event.key]) {
    event.preventDefault();
    loadModule(hotkeys[event.key], state.activePanel);
    return;
  }

  if (event.key === "Escape") {
    elements.commandInput.focus();
    hideAutocomplete();
  }
}

function addToWatchlist(symbol) {
  const upper = symbol.toUpperCase();
  if (!state.watchlist.includes(upper)) {
    state.watchlist.unshift(upper);
    state.watchlist = state.watchlist.slice(0, 24);
    persistWorkspace();
    renderRails();
    refreshQuotes([upper]);
    showToast(`${upper} added to watchlist.`, "success");
  }
}

function removeFromWatchlist(symbol) {
  state.watchlist = state.watchlist.filter((item) => item !== symbol);
  persistWorkspace();
  renderRails();
}

function createAlert(symbol, threshold, operator) {
  if (!symbol || Number.isNaN(threshold)) {
    return;
  }
  state.alerts.unshift({ symbol: symbol.toUpperCase(), operator, threshold, status: "watching" });
  state.alerts = state.alerts.slice(0, 16);
  persistWorkspace();
  renderRails();
  renderAllPanels();
  showToast(`Alert added for ${symbol.toUpperCase()}.`, "success");
}

function addPosition(position) {
  if (!position.symbol || !position.shares || !position.cost) {
    return;
  }
  state.positions.unshift({ symbol: position.symbol.toUpperCase(), shares: position.shares, cost: position.cost });
  persistWorkspace();
  renderAllPanels();
  refreshQuotes([position.symbol.toUpperCase()]);
  showToast(`Position added for ${position.symbol.toUpperCase()}.`, "success");
}

function removePositionBySymbol(symbol) {
  state.positions = state.positions.filter((position) => position.symbol !== symbol);
  persistWorkspace();
  renderAllPanels();
}

function persistWorkspace() {
  if (!state.user) {
    return;
  }

  state.userState = {
    ...state.userState,
    watchlist: state.watchlist,
    alerts: state.alerts,
    positions: state.positions,
    panelModules: state.panelModules,
    panelSymbols: state.panelSymbols,
    commandHistory: state.commandHistory,
  };
  saveUserState(state.user.id, state.userState);
}

async function refreshAllData() {
  elements.networkStatus.textContent = "Syncing";
  const symbols = new Set([...state.watchlist, ...state.positions.map((item) => item.symbol), ...Object.values(state.panelSymbols)]);

  await Promise.allSettled([
    refreshQuotes([...symbols]),
    refreshNewsFeed(),
    refreshFxMonitor(),
    refreshChart(state.panelSymbols[3] ?? "AAPL"),
    refreshOptions(state.panelSymbols[2] ?? "AAPL", state.optionsSelection.expiration),
  ]);

  if (elements.networkStatus.textContent === "Syncing") {
    elements.networkStatus.textContent = "Live";
  }
  renderRails();
  renderAllPanels();
}

async function refreshQuotes(symbols) {
  try {
    const quotes = await fetchQuotes(symbols);
    quotes.forEach((quote) => {
      state.quotes.set(quote.symbol, quote);
    });
    evaluateAlerts();
    renderRails();
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshChart(symbol, range = "1mo", interval = "1d") {
  try {
    const data = await fetchChart(symbol, range, interval);
    state.chartCache.set(buildChartKey(symbol, range, interval), data);
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshOptions(symbol, expiration) {
  state.optionsSelection.symbol = symbol;
  try {
    const chain = await fetchOptions(symbol, expiration);
    if (!state.optionsSelection.expiration && chain.expirations.length) {
      state.optionsSelection.expiration = chain.expirations[0];
    }
    state.optionsCache.set(buildOptionKey(symbol, expiration), chain);
    state.optionsCache.set(buildOptionKey(symbol, state.optionsSelection.expiration), chain);
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshNewsFeed() {
  try {
    const items = await fetchNews();
    if (items.length) {
      state.newsItems = items;
      renderAllPanels();
    }
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshFxMonitor() {
  try {
    state.fxRates = await fetchFxRates();
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

function evaluateAlerts() {
  state.alerts = state.alerts.map((alert) => {
    const quote = buildQuote(alert.symbol);
    if (!quote) {
      return alert;
    }
    const triggered = alert.operator === ">=" ? quote.price >= alert.threshold : quote.price <= alert.threshold;
    return { ...alert, status: triggered ? "triggered" : "watching" };
  });
}

function updateClock() {
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  elements.clockDisplay.textContent = `${ny.toLocaleTimeString("en-US", { hour12: false })} EST`;

  const elapsedSeconds = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
  const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  elements.sessionClock.textContent = `${hours}:${minutes}:${seconds}`;
  updateMarketStatus(ny);
}

function handleRefreshCountdown() {
  if (!state.user) {
    return;
  }
  state.refreshCountdown -= 1;
  if (state.refreshCountdown <= 0) {
    state.refreshCountdown = 30;
    refreshAllData();
  }
  updateStatusBar();
}

function updateMarketStatus(nyTime) {
  const day = nyTime.getDay();
  const hour = nyTime.getHours();
  const minute = nyTime.getMinutes();

  if (day === 0 || day === 6) {
    elements.marketStatus.textContent = "Weekend";
    return;
  }
  if (hour < 9 || (hour === 9 && minute < 30)) {
    elements.marketStatus.textContent = "Pre-market";
    return;
  }
  if (hour < 16) {
    elements.marketStatus.textContent = "Open";
    return;
  }
  elements.marketStatus.textContent = "After-hours";
}

function updateStatusBar() {
  elements.lastUpdated.textContent = currentTimeShort();
  elements.refreshCountdown.textContent = `${state.refreshCountdown}s`;
  elements.watchCount.textContent = `${state.watchlist.length}`;
  elements.alertCount.textContent = `${state.alerts.length}`;
}

function showToast(message, tone = "neutral") {
  elements.toast.textContent = message;
  elements.toast.dataset.tone = tone;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2800);
}

function getFilteredUniverse(filters) {
  return universe.filter((item) => {
    if (filters.universe && item.universe !== filters.universe) {
      return false;
    }
    if (filters.sector && item.sector !== filters.sector) {
      return false;
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      return item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    }
    return true;
  });
}

function setNestedCalculatorValue(path, value) {
  const [root, field] = path.split(".");
  if (!state.calculator[root]) {
    return;
  }
  state.calculator[root][field] = Number.isFinite(value) ? value : state.calculator[root][field];
}

function buildChartKey(symbol, range, interval) {
  return `${symbol}:${range}:${interval}`;
}

function buildOptionKey(symbol, expiration) {
  return `${symbol}:${expiration ?? "nearest"}`;
}

function buildLineChartSvg(points) {
  if (!points.length) {
    return "";
  }

  const width = 700;
  const height = 260;
  const closes = points.map((item) => item.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const line = points
    .map((item, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((item.close - min) / range) * (height - 20) - 10;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="line-chart" preserveAspectRatio="none">
      <polyline points="${line}" fill="none" stroke="#6be6ff" stroke-width="3"></polyline>
    </svg>
  `;
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
  const modifiedDuration = macaulayDuration / (1 + discount);
  return {
    price,
    duration: macaulayDuration,
    modifiedDuration,
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
  if (!value) {
    return "N/A";
  }
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }
  return `$${Number(value).toFixed(0)}`;
}

function formatVolume(value) {
  if (!value) {
    return "N/A";
  }
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return `${value}`;
}

function formatExpiry(value) {
  return new Date(Number(value) * 1000).toLocaleDateString();
}

function currentTimeShort() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

init();
/*
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
  heroMetrics,
  macroDefaults,
  moduleOrder,
  moduleTitles,
  onboardingHighlights,
} from "./data.js";
import { createAccount, login, logout, restoreSessionUser } from "./auth.js";
import { fetchChart, fetchFxRates, fetchNews, fetchOptions, fetchQuotes } from "./services.js";
import { getUserState, saveUserState } from "./storage.js";

const universe = buildUniverse();
const universeMap = new Map(universe.map((item) => [item.symbol, item]));

const state = {
  user: null,
  userState: null,
  sessionStartedAt: Date.now(),
  activePanel: 1,
  panelModules: { 1: "home", 2: "quote", 3: "chart", 4: "news" },
  panelSymbols: { 1: "NVDA", 2: "AAPL", 3: "MSFT", 4: "QQQ" },
  quotes: new Map(),
  chartCache: new Map(),
  optionsCache: new Map(),
  newsItems: [],
  fxRates: {},
  watchlist: [...defaultWatchlist],
  alerts: structuredClone(defaultAlerts),
  positions: structuredClone(defaultPositions),
  commandHistory: [],
  commandHistoryIndex: -1,
  screenerFilters: {
    1: { universe: "", sector: "", search: "" },
    2: { universe: "", sector: "", search: "" },
    3: { universe: "", sector: "", search: "" },
    4: { universe: "", sector: "", search: "" },
  },
  calculator: structuredClone(calculatorDefaults),
  optionsSelection: { symbol: "AAPL", expiration: null },
  refreshCountdown: 30,
};

const elements = {
  authShell: document.querySelector("#authShell"),
  terminalApp: document.querySelector("#terminalApp"),
  loginForm: document.querySelector("#loginForm"),
  signupForm: document.querySelector("#signupForm"),
  authTabs: document.querySelector("#authTabs"),
  authMessage: document.querySelector("#authMessage"),
  heroMetrics: document.querySelector("#heroMetrics"),
  heroHighlights: document.querySelector("#heroHighlights"),
  appTitle: document.querySelector("#appTitle"),
  userBadge: document.querySelector("#userBadge"),
  userMeta: document.querySelector("#userMeta"),
  marketStatus: document.querySelector("#marketStatus"),
  clockDisplay: document.querySelector("#clockDisplay"),
  sessionClock: document.querySelector("#sessionClock"),
  activeCommandDisplay: document.querySelector("#activeCommandDisplay"),
  functionRow: document.querySelector("#functionRow"),
  watchlistRail: document.querySelector("#watchlistRail"),
  alertRail: document.querySelector("#alertRail"),
  commandInput: document.querySelector("#commandInput"),
  runCommandButton: document.querySelector("#runCommandButton"),
  autocomplete: document.querySelector("#autocomplete"),
  lastUpdated: document.querySelector("#lastUpdated"),
  refreshCountdown: document.querySelector("#refreshCountdown"),
  watchCount: document.querySelector("#watchCount"),
  alertCount: document.querySelector("#alertCount"),
  networkStatus: document.querySelector("#networkStatus"),
  logoutButton: document.querySelector("#logoutButton"),
  toast: document.querySelector("#toast"),
};

function init() {
  renderLanding();
  bindAuthEvents();
  bindWorkspaceEvents();

  const restoredUser = restoreSessionUser();
  if (restoredUser) {
    completeLogin(restoredUser);
  }

  updateClock();
  setInterval(updateClock, 1000);
  setInterval(handleRefreshCountdown, 1000);
}

function renderLanding() {
  document.title = appName;
  elements.appTitle.textContent = appName;

  const roleSelect = document.querySelector("#signupRole");
  if (roleSelect) {
    roleSelect.innerHTML = authRoles
      .map((role) => `<option value="${role}">${role}</option>`)
      .join("");
  }

  elements.heroMetrics.innerHTML = heroMetrics
    .map(
      (metric) => `
        <article class="metric-card">
          <strong>${metric.value}</strong>
          <span>${metric.label}</span>
        </article>
      `,
    )
    .join("");

  elements.heroHighlights.innerHTML = onboardingHighlights
    .map(
      (item) => `
        <article class="highlight-card">
          <h3>${item.title}</h3>
          <p>${item.body}</p>
        </article>
      `,
    )
    .join("");
}

function bindAuthEvents() {
  elements.authTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-auth-tab]");
    if (!button) {
      return;
    }
    setAuthTab(button.dataset.authTab);
  });

  elements.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.loginForm);

    try {
      const user = await login({
        identifier: String(form.get("identifier") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      showAuthMessage("Login successful.", "success");
      completeLogin(user);
    } catch (error) {
      showAuthMessage(error.message, "error");
    }
  });

  elements.signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.signupForm);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password.length < 8) {
      showAuthMessage("Password must be at least 8 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showAuthMessage("Passwords do not match.", "error");
      return;
    }

    try {
      const user = await createAccount({
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        email: String(form.get("email") ?? ""),
        username: String(form.get("username") ?? ""),
        password,
        role: String(form.get("role") ?? "Other"),
      });
      showAuthMessage("Account created. Loading workspace...", "success");
      completeLogin(user);
    } catch (error) {
      showAuthMessage(error.message, "error");
    }
  });
}

function bindWorkspaceEvents() {
  elements.runCommandButton?.addEventListener("click", processCommand);
  elements.commandInput?.addEventListener("input", renderAutocomplete);
  elements.commandInput?.addEventListener("keydown", handleCommandKeydown);
  elements.functionRow?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module]");
    if (!button) {
      return;
    }
    loadModule(button.dataset.module, state.activePanel);
  });
  elements.logoutButton?.addEventListener("click", handleLogout);

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("input", handleDocumentInput);
  document.addEventListener("keydown", handleGlobalHotkeys);
  document.addEventListener("submit", handleDocumentSubmit);
}

function handleDocumentClick(event) {
  const panelButton = event.target.closest("[data-panel]");
  if (panelButton) {
    setActivePanel(Number(panelButton.dataset.panel));
    return;
  }

  const cycleButton = event.target.closest("[data-panel-cycle]");
  if (cycleButton) {
    const [panel, direction] = cycleButton.dataset.panelCycle.split(":").map(Number);
    cycleModule(panel, direction);
    return;
  }

  const moduleTrigger = event.target.closest("[data-load-module]");
  if (moduleTrigger) {
    const panel = Number(moduleTrigger.dataset.targetPanel || state.activePanel);
    if (moduleTrigger.dataset.targetSymbol) {
      state.panelSymbols[panel] = moduleTrigger.dataset.targetSymbol;
    }
    loadModule(moduleTrigger.dataset.loadModule, panel);
    if (moduleTrigger.dataset.loadModule === "chart") {
      refreshChart(state.panelSymbols[panel]);
    }
    if (moduleTrigger.dataset.loadModule === "options") {
      refreshOptions(state.panelSymbols[panel], state.optionsSelection.expiration);
    }
    return;
  }

  const watchButton = event.target.closest("[data-watch-symbol]");
  if (watchButton) {
    addToWatchlist(watchButton.dataset.watchSymbol);
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

  const addAlert = event.target.closest("[data-alert-symbol]");
  if (addAlert) {
    const symbol = addAlert.dataset.alertSymbol;
    const threshold = Number(addAlert.dataset.alertThreshold);
    createAlert(symbol, threshold, ">=");
    return;
  }

  const autocompleteItem = event.target.closest("[data-autocomplete]");
  if (autocompleteItem) {
    elements.commandInput.value = autocompleteItem.dataset.autocomplete;
    processCommand();
    return;
  }

  if (!event.target.closest(".command-shell")) {
    hideAutocomplete();
  }
}

function handleDocumentInput(event) {
  const screenerSearch = event.target.closest("[data-screener-search]");
  if (screenerSearch) {
    const panel = Number(screenerSearch.dataset.screenerSearch);
    state.screenerFilters[panel].search = screenerSearch.value;
    renderPanel(panel);
    return;
  }

  const screenerUniverse = event.target.closest("[data-screener-universe]");
  if (screenerUniverse) {
    const panel = Number(screenerUniverse.dataset.screenerUniverse);
    state.screenerFilters[panel].universe = screenerUniverse.value;
    renderPanel(panel);
    return;
  }

  const screenerSector = event.target.closest("[data-screener-sector]");
  if (screenerSector) {
    const panel = Number(screenerSector.dataset.screenerSector);
    state.screenerFilters[panel].sector = screenerSector.value;
    renderPanel(panel);
    return;
  }

  const calcInput = event.target.closest("[data-calc-key]");
  if (calcInput) {
    setNestedCalculatorValue(calcInput.dataset.calcKey, Number(calcInput.value));
    renderAllPanels();
    return;
  }

  const quoteInput = event.target.closest("[data-quote-symbol]");
  if (quoteInput) {
    const panel = Number(quoteInput.dataset.quoteSymbol);
    state.panelSymbols[panel] = quoteInput.value.toUpperCase();
    return;
  }

  const optionInput = event.target.closest("[data-option-symbol]");
  if (optionInput) {
    const panel = Number(optionInput.dataset.optionSymbol);
    state.panelSymbols[panel] = optionInput.value.toUpperCase();
    state.optionsSelection.symbol = optionInput.value.toUpperCase();
    return;
  }

  const optionExpiry = event.target.closest("[data-option-expiry]");
  if (optionExpiry) {
    state.optionsSelection.expiration = optionExpiry.value || null;
    refreshOptions(state.optionsSelection.symbol, state.optionsSelection.expiration);
  }
}

function handleDocumentSubmit(event) {
  const addPositionForm = event.target.closest("#addPositionForm");
  if (!addPositionForm) {
    return;
  }

  event.preventDefault();
  const form = new FormData(addPositionForm);
  addPosition({
    symbol: String(form.get("symbol") ?? "").toUpperCase(),
    shares: Number(form.get("shares") ?? 0),
    cost: Number(form.get("cost") ?? 0),
  });
  addPositionForm.reset();
}

function setAuthTab(tabName) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === tabName);
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.authPanel !== tabName);
  });
}

function showAuthMessage(message, tone = "neutral") {
  elements.authMessage.textContent = message;
  elements.authMessage.dataset.tone = tone;
}

function completeLogin(user) {
  state.user = user;
  const userState = getUserState(user.id, {
    watchlist: defaultWatchlist,
    alerts: defaultAlerts,
    positions: defaultPositions,
  });

  state.userState = userState;
  state.watchlist = [...userState.watchlist];
  state.alerts = structuredClone(userState.alerts?.length ? userState.alerts : defaultAlerts);
  state.positions = structuredClone(userState.positions?.length ? userState.positions : defaultPositions);
  state.panelModules = { ...state.panelModules, ...userState.panelModules };
  state.panelSymbols = { ...state.panelSymbols, ...userState.panelSymbols };
  state.commandHistory = [...(userState.commandHistory ?? [])];
  state.sessionStartedAt = Date.now();
  state.refreshCountdown = 30;

  elements.authShell.classList.add("hidden");
  elements.terminalApp.classList.remove("hidden");
  elements.userBadge.textContent = `${user.firstName} ${user.lastName}`;
  elements.userMeta.textContent = `${user.role} · @${user.username}`;
  renderFunctionRow();
  renderRails();
  renderAllPanels();
  refreshAllData();
  elements.commandInput.focus();
  showToast(`Welcome, ${user.firstName}.`, "success");
}

function handleLogout() {
  logout();
  state.user = null;
  state.userState = null;
  elements.terminalApp.classList.add("hidden");
  elements.authShell.classList.remove("hidden");
  setAuthTab("login");
  showAuthMessage("Signed out.", "neutral");
  showToast("Signed out.", "neutral");
}

function buildQuote(symbol) {
  const base = universeMap.get(symbol);
  const live = state.quotes.get(symbol);
  if (!base && !live) {
    return null;
  }

  return {
    symbol,
    name: live?.name ?? base?.name ?? symbol,
    sector: base?.sector ?? "Unknown",
    universe: base?.universe ?? "Custom",
    exchange: live?.exchange ?? base?.exchange ?? "N/A",
    price: live?.price ?? base?.seedPrice ?? 0,
    changePct: live?.changePct ?? 0,
    change: live?.change ?? 0,
    marketCap: live?.marketCap ?? base?.marketCap ?? 0,
    volume: live?.volume ?? 0,
    dayHigh: live?.dayHigh ?? live?.price ?? base?.seedPrice ?? 0,
    dayLow: live?.dayLow ?? live?.price ?? base?.seedPrice ?? 0,
    previousClose: live?.previousClose ?? base?.seedPrice ?? 0,
  };
}

function renderFunctionRow() {
  elements.functionRow.innerHTML = functionKeys
    .map(
      (item) => `
        <button class="function-key ${state.panelModules[state.activePanel] === item.module ? "is-active" : ""}" data-module="${item.module}">
          <span>${item.key}</span>
          <strong>${item.label}</strong>
        </button>
      `,
    )
    .join("");
}

function renderRails() {
  elements.watchlistRail.innerHTML = state.watchlist
    .map((symbol) => {
      const quote = buildQuote(symbol);
      if (!quote) {
        return "";
      }
      return `
        <article class="rail-item-wrap">
          <button class="rail-item" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${state.activePanel}">
            <div>
              <strong>${symbol}</strong>
              <span>${quote.name}</span>
            </div>
            <div>
              <span>${formatPrice(quote.price, symbol)}</span>
              <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
            </div>
          </button>
          <button class="rail-remove" type="button" data-remove-watch="${symbol}">×</button>
        </article>
      `;
    })
    .join("");

  elements.alertRail.innerHTML = state.alerts
    .map(
      (alert) => `
        <article class="rail-alert ${alert.status === "triggered" ? "is-triggered" : ""}">
          <strong>${alert.symbol}</strong>
          <span>${alert.operator} ${alert.threshold}</span>
          <span>${alert.status}</span>
        </article>
      `,
    )
    .join("");

  updateStatusBar();
}

function setActivePanel(panel) {
  state.activePanel = panel;
  document.querySelectorAll("[data-panel]").forEach((node) => {
    node.classList.toggle("is-active", Number(node.dataset.panel) === panel);
  });
  renderFunctionRow();
}

function cycleModule(panel, direction) {
  const currentIndex = moduleOrder.indexOf(state.panelModules[panel]);
  const nextIndex = (currentIndex + direction + moduleOrder.length) % moduleOrder.length;
  loadModule(moduleOrder[nextIndex], panel);
}

function loadModule(moduleName, panel) {
  state.panelModules[panel] = moduleName;
  renderPanel(panel);
  setActivePanel(panel);
  persistWorkspace();
}

function renderAllPanels() {
  [1, 2, 3, 4].forEach((panel) => renderPanel(panel));
}

function renderPanel(panel) {
  const moduleName = state.panelModules[panel];
  const title = document.querySelector(`#panelTitle${panel}`);
  const content = document.querySelector(`#panelContent${panel}`);
  if (!title || !content) {
    return;
  }

  title.textContent = moduleTitles[moduleName] ?? moduleName.toUpperCase();

  const renderers = {
    home: renderHomeModule,
    quote: renderQuoteModule,
    chart: renderChartModule,
    news: renderNewsModule,
    screener: renderScreenerModule,
    heatmap: renderHeatmapModule,
    portfolio: renderPortfolioModule,
    macro: renderMacroModule,
    options: renderOptionsModule,
    calculator: renderCalculatorModule,
  };

  content.innerHTML = (renderers[moduleName] ?? renderHomeModule)(panel);
}

function renderHomeModule() {
  const topQuotes = state.watchlist.slice(0, 6).map((symbol) => buildQuote(symbol)).filter(Boolean);
  const portfolioValue = state.positions.reduce((sum, position) => {
    const quote = buildQuote(position.symbol);
    const price = quote?.price ?? position.cost;
    return sum + price * position.shares;
  }, 0);
  const portfolioBasis = state.positions.reduce((sum, position) => sum + position.cost * position.shares, 0);
  const pnl = portfolioValue - portfolioBasis;
  const signal = topQuotes.filter((quote) => quote.changePct >= 0).length >= Math.ceil(topQuotes.length / 2) ? "Risk-on" : "Risk-off";

  return `
    <section class="module-stack">
      <div class="hero-card-grid">
        <article class="hero-card"><span>Session signal</span><strong>${signal}</strong><p>Derived from the current watchlist balance.</p></article>
        <article class="hero-card"><span>Portfolio</span><strong>${formatPrice(portfolioValue, "USD")}</strong><p class="${pnl >= 0 ? "positive" : "negative"}">${pnl >= 0 ? "+" : ""}${formatPrice(pnl, "USD")}</p></article>
        <article class="hero-card"><span>Watchlist</span><strong>${state.watchlist.length}</strong><p>${state.watchlist.slice(0, 4).join(" · ")}</p></article>
        <article class="hero-card"><span>Network</span><strong>${elements.networkStatus.textContent}</strong><p>Public endpoints with local persistence and fallbacks.</p></article>
      </div>
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Market pulse</span><span>${topQuotes.length} symbols</span></div>
          <div class="market-chip-grid">
            ${topQuotes
              .map(
                (quote) => `
                  <button class="market-chip" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${state.activePanel}">
                    <strong>${quote.symbol}</strong>
                    <span>${formatPrice(quote.price, quote.symbol)}</span>
                    <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
                  </button>
                `,
              )
              .join("")}
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>Active alerts</span><span>${state.alerts.length}</span></div>
          <div class="stack-list">
            ${state.alerts
              .map(
                (alert) => `
                  <article class="stack-item ${alert.status === "triggered" ? "is-positive" : ""}">
                    <strong>${alert.symbol}</strong>
                    <span>${alert.operator} ${alert.threshold}</span>
                    <small>${alert.status}</small>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderQuoteModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const quote = buildQuote(symbol) ?? buildQuote("AAPL");
  if (!quote) {
    return emptyStateMarkup("No quote data available yet.");
  }

  return `
    <section class="module-stack">
      <div class="toolbar-row">
        <input class="input" value="${quote.symbol}" data-quote-symbol="${panel}" />
        <button class="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">Refresh</button>
        <button class="button button-muted" data-watch-symbol="${quote.symbol}">Add Watch</button>
        <button class="button button-muted" data-load-module="chart" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">Chart</button>
      </div>
      <div class="quote-hero-card">
        <div>
          <span class="quote-symbol">${quote.symbol}</span>
          <h3>${quote.name}</h3>
          <strong class="quote-price">${formatPrice(quote.price, quote.symbol)}</strong>
          <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
        </div>
        <div class="quote-side-metrics">
          <span>${quote.sector}</span>
          <span>${quote.universe}</span>
          <span>${quote.exchange}</span>
        </div>
      </div>
      <table class="terminal-table">
        <tbody>
          <tr><td>Previous close</td><td>${formatPrice(quote.previousClose, quote.symbol)}</td><td>Day high</td><td>${formatPrice(quote.dayHigh, quote.symbol)}</td></tr>
          <tr><td>Day low</td><td>${formatPrice(quote.dayLow, quote.symbol)}</td><td>Volume</td><td>${formatVolume(quote.volume)}</td></tr>
          <tr><td>Market cap</td><td>${formatMarketCap(quote.marketCap)}</td><td>Change $</td><td class="${quote.change >= 0 ? "positive" : "negative"}">${quote.change >= 0 ? "+" : ""}${Number(quote.change).toFixed(2)}</td></tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderChartModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const chartData = state.chartCache.get(buildChartKey(symbol, "1mo", "1d")) ?? [];
  const quote = buildQuote(symbol);

  return `
    <section class="module-stack">
      <div class="toolbar-row">
        <span class="toolbar-label">${symbol}</span>
        <button class="button button-muted" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">Reload</button>
      </div>
      <div class="chart-card">
        ${chartData.length ? buildLineChartSvg(chartData) : `<div class="empty-chart">Fetching chart data for ${symbol}...</div>`}
      </div>
      <div class="chart-meta-row">
        <span>${quote ? formatPrice(quote.price, quote.symbol) : "--"}</span>
        <span class="${quote && quote.changePct >= 0 ? "positive" : "negative"}">${quote ? formatSignedPct(quote.changePct) : "--"}</span>
      </div>
    </section>
  `;
}

function renderNewsModule() {
  if (!state.newsItems.length) {
    return emptyStateMarkup("Fetching news feeds...");
  }

  return `
    <section class="module-stack news-stack">
      ${state.newsItems
        .map(
          (item) => `
            <article class="news-card">
              <div class="news-meta"><span>${item.source}</span><span>${item.time}</span></div>
              <strong>${item.headline}</strong>
              <a href="${item.link ?? "#"}" target="_blank" rel="noopener">Open source</a>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderScreenerModule(panel) {
  const filters = state.screenerFilters[panel];
  const filtered = getFilteredUniverse(filters);
  const sectors = [...new Set(universe.map((item) => item.sector))].sort();
  const universes = [...new Set(universe.map((item) => item.universe))].sort();

  return `
    <section class="module-stack">
      <div class="toolbar-row wrap">
        <select class="input select" data-screener-universe="${panel}">
          <option value="">All universes</option>
          ${universes.map((item) => `<option value="${item}" ${item === filters.universe ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <select class="input select" data-screener-sector="${panel}">
          <option value="">All sectors</option>
          ${sectors.map((item) => `<option value="${item}" ${item === filters.sector ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <input class="input grow" data-screener-search="${panel}" value="${filters.search}" placeholder="symbol / name" />
        <span class="toolbar-label">${filtered.length} results</span>
      </div>
      <div class="table-wrap">
        <table class="terminal-table compact">
          <thead><tr><th>Ticker</th><th>Name</th><th>Sector</th><th>Universe</th><th>Price</th><th>Chg%</th></tr></thead>
          <tbody>
            ${filtered
              .slice(0, 80)
              .map((item) => {
                const quote = buildQuote(item.symbol);
                return `
                  <tr>
                    <td><button class="table-link" data-load-module="quote" data-target-symbol="${item.symbol}" data-target-panel="${state.activePanel}">${item.symbol}</button></td>
                    <td>${item.name}</td>
                    <td>${item.sector}</td>
                    <td>${item.universe}</td>
                    <td>${quote ? formatPrice(quote.price, item.symbol) : formatPrice(item.seedPrice, item.symbol)}</td>
                    <td class="${quote && quote.changePct >= 0 ? "positive" : "negative"}">${quote ? formatSignedPct(quote.changePct) : "--"}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderHeatmapModule() {
  return `
    <section class="heatmap-grid">
      ${Object.entries(heatmapGroups)
        .map(
          ([sector, symbols]) => `
            <article class="module-card">
              <div class="card-header"><span>${sector}</span><span>${symbols.length}</span></div>
              <div class="heat-sector-grid">
                ${symbols
                  .map((symbol) => {
                    const quote = buildQuote(symbol);
                    const magnitude = Math.max(1, Math.min(5, Math.round(Math.abs(quote?.changePct ?? 0)) + 1));
                    return `
                      <button class="heat-tile ${quote && quote.changePct >= 0 ? "up" : "down"} size-${magnitude}" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${state.activePanel}">
                        <strong>${symbol}</strong>
                        <span>${quote ? formatSignedPct(quote.changePct) : "--"}</span>
                      </button>
                    `;
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

function renderPortfolioModule() {
  const rows = state.positions.map((position) => {
    const quote = buildQuote(position.symbol);
    const price = quote?.price ?? position.cost;
    const value = price * position.shares;
    const basis = position.cost * position.shares;
    const pnl = value - basis;
    const pnlPct = basis ? (pnl / basis) * 100 : 0;
    return { ...position, price, value, pnl, pnlPct };
  });

  const totalValue = rows.reduce((sum, item) => sum + item.value, 0);
  const totalBasis = rows.reduce((sum, item) => sum + item.cost * item.shares, 0);
  const totalPnl = totalValue - totalBasis;
  const totalPct = totalBasis ? (totalPnl / totalBasis) * 100 : 0;

  return `
    <section class="module-stack">
      <div class="hero-card-grid portfolio-summary">
        <article class="hero-card"><span>Total value</span><strong>${formatPrice(totalValue, "USD")}</strong></article>
        <article class="hero-card"><span>Total P/L</span><strong class="${totalPnl >= 0 ? "positive" : "negative"}">${totalPnl >= 0 ? "+" : ""}${formatPrice(totalPnl, "USD")}</strong></article>
        <article class="hero-card"><span>Total P/L %</span><strong class="${totalPct >= 0 ? "positive" : "negative"}">${formatSignedPct(totalPct)}</strong></article>
      </div>
      <form id="addPositionForm" class="toolbar-row wrap">
        <input class="input" name="symbol" placeholder="Symbol" />
        <input class="input" name="shares" type="number" step="0.01" placeholder="Shares" />
        <input class="input" name="cost" type="number" step="0.01" placeholder="Cost basis" />
        <button class="button" type="submit">Add Position</button>
      </form>
      <div class="table-wrap">
        <table class="terminal-table compact">
          <thead><tr><th>Ticker</th><th>Shares</th><th>Cost</th><th>Mark</th><th>Value</th><th>P/L</th><th>P/L %</th><th></th></tr></thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td><button class="table-link" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${state.activePanel}">${row.symbol}</button></td>
                    <td>${row.shares}</td>
                    <td>${formatPrice(row.cost, row.symbol)}</td>
                    <td>${formatPrice(row.price, row.symbol)}</td>
                    <td>${formatPrice(row.value, "USD")}</td>
                    <td class="${row.pnl >= 0 ? "positive" : "negative"}">${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}</td>
                    <td class="${row.pnlPct >= 0 ? "positive" : "negative"}">${formatSignedPct(row.pnlPct)}</td>
                    <td><button class="button button-danger" type="button" data-remove-position="${row.symbol}">Remove</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMacroModule() {
  const fxRows = macroDefaults.currencies
    .map((currency) => ({ currency, rate: state.fxRates[currency] }))
    .filter((item) => item.rate)
    .map(
      (item) => `
        <article class="fx-card">
          <strong>USD/${item.currency}</strong>
          <span>${Number(item.rate).toFixed(4)}</span>
        </article>
      `,
    )
    .join("");

  return `
    <section class="module-stack">
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Yield curve</span><span>Reference</span></div>
          <div class="curve-grid">
            ${macroDefaults.curve
              .map(
                (point) => `
                  <div class="curve-column">
                    <div class="curve-bar" style="height:${point.yield * 18}px"></div>
                    <strong>${point.yield.toFixed(2)}%</strong>
                    <span>${point.tenor}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>FX monitor</span><span>Live</span></div>
          <div class="fx-grid">${fxRows || emptyStateMarkup("Fetching FX rates...")}</div>
        </section>
      </div>
    </section>
  `;
}

function renderOptionsModule(panel) {
  const symbol = state.panelSymbols[panel] ?? state.optionsSelection.symbol ?? "AAPL";
  const cacheKey = buildOptionKey(symbol, state.optionsSelection.expiration);
  const optionState = state.optionsCache.get(cacheKey);
  const expirations = optionState?.expirations ?? [];
  const calls = optionState?.calls ?? [];
  const puts = optionState?.puts ?? [];
  const quote = buildQuote(symbol);

  return `
    <section class="module-stack">
      <div class="toolbar-row wrap">
        <input class="input" value="${symbol}" data-option-symbol="${panel}" />
        <button class="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Load Chain</button>
        <select class="input select" data-option-expiry>
          <option value="">Nearest expiry</option>
          ${expirations
            .slice(0, 8)
            .map(
              (value) => `<option value="${value}" ${String(state.optionsSelection.expiration ?? "") === String(value) ? "selected" : ""}>${formatExpiry(value)}</option>`,
            )
            .join("")}
        </select>
        <span class="toolbar-label">Spot ${quote ? formatPrice(quote.price, symbol) : "--"}</span>
      </div>
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Calls</span><span>${calls.length}</span></div>
          ${renderOptionTable(calls, "call")}
        </section>
        <section class="module-card">
          <div class="card-header"><span>Puts</span><span>${puts.length}</span></div>
          ${renderOptionTable(puts, "put")}
        </section>
      </div>
    </section>
  `;
}

function renderCalculatorModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const quote = buildQuote(symbol);
  const optionInputs = { ...state.calculator.option, spot: quote?.price ?? state.calculator.option.spot };
  const optionResult = calculateBlackScholes(optionInputs);
  const bondResult = calculateBond(state.calculator.bond);

  return `
    <section class="module-stack">
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Black-Scholes</span><span>${symbol}</span></div>
          <div class="calc-grid">
            ${renderCalculatorInput("Spot", "option.spot", optionInputs.spot)}
            ${renderCalculatorInput("Strike", "option.strike", state.calculator.option.strike)}
            ${renderCalculatorInput("Years", "option.years", state.calculator.option.years)}
            ${renderCalculatorInput("Rate %", "option.rate", state.calculator.option.rate)}
            ${renderCalculatorInput("Vol %", "option.volatility", state.calculator.option.volatility)}
          </div>
          <div class="calc-results">
            <div><span>Call</span><strong>${optionResult.call.toFixed(4)}</strong></div>
            <div><span>Put</span><strong>${optionResult.put.toFixed(4)}</strong></div>
            <div><span>Delta</span><strong>${optionResult.delta.toFixed(4)}</strong></div>
            <div><span>Gamma</span><strong>${optionResult.gamma.toFixed(6)}</strong></div>
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>Bond pricing</span><span>Fixed income</span></div>
          <div class="calc-grid">
            ${renderCalculatorInput("Face", "bond.face", state.calculator.bond.face)}
            ${renderCalculatorInput("Coupon %", "bond.coupon", state.calculator.bond.coupon)}
            ${renderCalculatorInput("YTM %", "bond.ytm", state.calculator.bond.ytm)}
            ${renderCalculatorInput("Maturity", "bond.maturity", state.calculator.bond.maturity)}
            ${renderCalculatorInput("Frequency", "bond.frequency", state.calculator.bond.frequency)}
          </div>
          <div class="calc-results">
            <div><span>Price</span><strong>${bondResult.price.toFixed(4)}</strong></div>
            <div><span>Duration</span><strong>${bondResult.duration.toFixed(4)}</strong></div>
            <div><span>Mod duration</span><strong>${bondResult.modifiedDuration.toFixed(4)}</strong></div>
            <div><span>Convexity</span><strong>${bondResult.convexity.toFixed(4)}</strong></div>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderCalculatorInput(label, key, value) {
  return `
    <label class="calc-input-row">
      <span>${label}</span>
      <input class="input" data-calc-key="${key}" value="${value}" />
    </label>
  `;
}

function renderOptionTable(contracts, kind) {
  if (!contracts.length) {
    return emptyStateMarkup(`Fetching ${kind} contracts...`);
  }

  return `
    <div class="table-wrap">
      <table class="terminal-table compact">
        <thead><tr><th>Strike</th><th>Bid</th><th>Ask</th><th>Last</th><th>Vol</th><th>OI</th></tr></thead>
        <tbody>
          ${contracts
            .map(
              (contract) => `
                <tr>
                  <td>${contract.strike?.fmt ?? contract.strike ?? "--"}</td>
                  <td>${contract.bid?.fmt ?? contract.bid ?? "--"}</td>
                  <td>${contract.ask?.fmt ?? contract.ask ?? "--"}</td>
                  <td>${contract.lastPrice?.fmt ?? contract.lastPrice ?? "--"}</td>
                  <td>${contract.volume?.fmt ?? contract.volume ?? "--"}</td>
                  <td>${contract.openInterest?.fmt ?? contract.openInterest ?? "--"}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function emptyStateMarkup(message) {
  return `<div class="empty-state">${message}</div>`;
}

function processCommand() {
  const raw = elements.commandInput.value.trim();
  if (!raw) {
    return;
  }

  const upper = raw.toUpperCase();
  state.commandHistory.unshift(raw);
  state.commandHistory = state.commandHistory.slice(0, 50);
  state.commandHistoryIndex = -1;
  elements.activeCommandDisplay.textContent = upper;

  const parts = upper.split(/\s+/);
  const [first, second, third, fourth] = parts;

  if (first === "HELP") {
    state.panelModules[state.activePanel] = "news";
    state.newsItems = commandCatalog.map((item) => ({
      source: "Command",
      headline: `${item.cmd} — ${item.desc}`,
      time: currentTimeShort(),
      link: "#",
    }));
    renderPanel(state.activePanel);
  } else if (first === "HOME") {
    loadModule("home", state.activePanel);
  } else if (first === "NEWS") {
    loadModule("news", state.activePanel);
  } else if (first === "EQS" || first === "SCREENER") {
    loadModule("screener", state.activePanel);
  } else if (first === "HEAT" || first === "HEATMAP") {
    loadModule("heatmap", state.activePanel);
  } else if (first === "PORT" || first === "PORTFOLIO") {
    loadModule("portfolio", state.activePanel);
  } else if (first === "MACRO") {
    loadModule("macro", state.activePanel);
  } else if (first === "CALC") {
    loadModule("calculator", state.activePanel);
  } else if ((first === "OMON" || first === "OPTIONS") && second) {
    state.panelSymbols[state.activePanel] = second;
    state.optionsSelection.symbol = second;
    loadModule("options", state.activePanel);
    refreshOptions(second, state.optionsSelection.expiration);
  } else if (first === "WATCH" && second) {
    addToWatchlist(second);
  } else if (first === "ALERT" && second && third) {
    createAlert(second, Number(third), ">=");
  } else if (first === "ADDPOS" && second && third && fourth) {
    addPosition({ symbol: second, shares: Number(third), cost: Number(fourth) });
  } else if (second === "Q" || first === "QUOTE") {
    const symbol = first === "QUOTE" ? second : first;
    if (symbol) {
      state.panelSymbols[state.activePanel] = symbol;
      loadModule("quote", state.activePanel);
      refreshQuotes([symbol]);
    }
  } else if (second === "CHART" || first === "CHART") {
    const symbol = first === "CHART" ? second : first;
    if (symbol) {
      state.panelSymbols[state.activePanel] = symbol;
      loadModule("chart", state.activePanel);
      refreshChart(symbol);
    }
  } else if (universeMap.has(first)) {
    state.panelSymbols[state.activePanel] = first;
    loadModule("quote", state.activePanel);
    refreshQuotes([first]);
  } else {
    showToast(`Unknown command: ${upper}`, "error");
  }

  persistWorkspace();
  elements.commandInput.value = "";
  hideAutocomplete();
  renderRails();
}

function handleCommandKeydown(event) {
  if (event.key === "Enter") {
    processCommand();
    return;
  }

  if (event.key === "Escape") {
    elements.commandInput.value = "";
    hideAutocomplete();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (state.commandHistoryIndex < state.commandHistory.length - 1) {
      state.commandHistoryIndex += 1;
      elements.commandInput.value = state.commandHistory[state.commandHistoryIndex];
    }
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (state.commandHistoryIndex > 0) {
      state.commandHistoryIndex -= 1;
      elements.commandInput.value = state.commandHistory[state.commandHistoryIndex];
    } else {
      state.commandHistoryIndex = -1;
      elements.commandInput.value = "";
    }
  }
}

function renderAutocomplete() {
  const value = elements.commandInput.value.trim().toUpperCase();
  if (!value) {
    hideAutocomplete();
    return;
  }

  const commandMatches = commandCatalog
    .filter((item) => item.cmd.startsWith(value) || item.cmd.includes(value))
    .slice(0, 5)
    .map((item) => ({ label: item.cmd, description: item.desc }));

  const symbolMatches = universe
    .filter((item) => item.symbol.startsWith(value) || item.name.toUpperCase().includes(value))
    .slice(0, 6)
    .map((item) => ({ label: `${item.symbol} Q`, description: item.name }));

  const suggestions = [...commandMatches, ...symbolMatches].slice(0, 8);
  if (!suggestions.length) {
    hideAutocomplete();
    return;
  }

  elements.autocomplete.innerHTML = suggestions
    .map(
      (item) => `
        <button class="autocomplete-item" type="button" data-autocomplete="${item.label}">
          <strong>${item.label}</strong>
          <span>${item.description}</span>
        </button>
      `,
    )
    .join("");
  elements.autocomplete.classList.remove("hidden");
}

function hideAutocomplete() {
  elements.autocomplete.classList.add("hidden");
}

function handleGlobalHotkeys(event) {
  if (document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && event.key !== "Escape") {
    return;
  }

  const hotkeys = {
    F1: "home",
    F2: "quote",
    F3: "chart",
    F4: "news",
    F5: "screener",
    F6: "heatmap",
    F7: "portfolio",
    F8: "macro",
    F9: "options",
    F10: "calculator",
  };

  if (event.key === "Tab") {
    event.preventDefault();
    setActivePanel((state.activePanel % 4) + 1);
    return;
  }

  if (hotkeys[event.key]) {
    event.preventDefault();
    loadModule(hotkeys[event.key], state.activePanel);
    return;
  }

  if (event.key === "Escape") {
    elements.commandInput.focus();
    hideAutocomplete();
  }
}

function addToWatchlist(symbol) {
  const upper = symbol.toUpperCase();
  if (!state.watchlist.includes(upper)) {
    state.watchlist.unshift(upper);
    state.watchlist = state.watchlist.slice(0, 24);
    persistWorkspace();
    renderRails();
    refreshQuotes([upper]);
    showToast(`${upper} added to watchlist.`, "success");
  }
}

function removeFromWatchlist(symbol) {
  state.watchlist = state.watchlist.filter((item) => item !== symbol);
  persistWorkspace();
  renderRails();
}

function createAlert(symbol, threshold, operator) {
  if (!symbol || Number.isNaN(threshold)) {
    return;
  }
  state.alerts.unshift({ symbol: symbol.toUpperCase(), operator, threshold, status: "watching" });
  state.alerts = state.alerts.slice(0, 16);
  persistWorkspace();
  renderRails();
  renderAllPanels();
  showToast(`Alert added for ${symbol.toUpperCase()}.`, "success");
}

function addPosition(position) {
  if (!position.symbol || !position.shares || !position.cost) {
    return;
  }
  state.positions.unshift({
    symbol: position.symbol.toUpperCase(),
    shares: position.shares,
    cost: position.cost,
  });
  persistWorkspace();
  renderAllPanels();
  refreshQuotes([position.symbol.toUpperCase()]);
  showToast(`Position added for ${position.symbol.toUpperCase()}.`, "success");
}

function removePositionBySymbol(symbol) {
  state.positions = state.positions.filter((position) => position.symbol !== symbol);
  persistWorkspace();
  renderAllPanels();
}

function persistWorkspace() {
  if (!state.user) {
    return;
  }

  state.userState = {
    ...state.userState,
    watchlist: state.watchlist,
    alerts: state.alerts,
    positions: state.positions,
    panelModules: state.panelModules,
    panelSymbols: state.panelSymbols,
    commandHistory: state.commandHistory,
  };
  saveUserState(state.user.id, state.userState);
}

async function refreshAllData() {
  elements.networkStatus.textContent = "Syncing";
  const symbols = new Set([...state.watchlist, ...state.positions.map((item) => item.symbol), ...Object.values(state.panelSymbols)]);

  await Promise.allSettled([
    refreshQuotes([...symbols]),
    refreshNewsFeed(),
    refreshFxMonitor(),
    refreshChart(state.panelSymbols[3] ?? "AAPL"),
    refreshOptions(state.panelSymbols[2] ?? "AAPL", state.optionsSelection.expiration),
  ]);

  if (elements.networkStatus.textContent === "Syncing") {
    elements.networkStatus.textContent = "Live";
  }
  renderRails();
  renderAllPanels();
}

async function refreshQuotes(symbols) {
  try {
    const quotes = await fetchQuotes(symbols);
    quotes.forEach((quote) => {
      state.quotes.set(quote.symbol, quote);
    });
    evaluateAlerts();
    renderRails();
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshChart(symbol, range = "1mo", interval = "1d") {
  try {
    const data = await fetchChart(symbol, range, interval);
    state.chartCache.set(buildChartKey(symbol, range, interval), data);
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshOptions(symbol, expiration) {
  state.optionsSelection.symbol = symbol;
  try {
    const chain = await fetchOptions(symbol, expiration);
    if (!state.optionsSelection.expiration && chain.expirations.length) {
      state.optionsSelection.expiration = chain.expirations[0];
    }
    state.optionsCache.set(buildOptionKey(symbol, expiration), chain);
    state.optionsCache.set(buildOptionKey(symbol, state.optionsSelection.expiration), chain);
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshNewsFeed() {
  try {
    const items = await fetchNews();
    if (items.length) {
      state.newsItems = items;
      renderAllPanels();
    }
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshFxMonitor() {
  try {
    state.fxRates = await fetchFxRates();
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

function evaluateAlerts() {
  state.alerts = state.alerts.map((alert) => {
    const quote = buildQuote(alert.symbol);
    if (!quote) {
      return alert;
    }
    const triggered = alert.operator === ">=" ? quote.price >= alert.threshold : quote.price <= alert.threshold;
    return { ...alert, status: triggered ? "triggered" : "watching" };
  });
}

function updateClock() {
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  elements.clockDisplay.textContent = `${ny.toLocaleTimeString("en-US", { hour12: false })} EST`;

  const elapsedSeconds = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
  const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  elements.sessionClock.textContent = `${hours}:${minutes}:${seconds}`;
  updateMarketStatus(ny);
}

function handleRefreshCountdown() {
  if (!state.user) {
    return;
  }
  state.refreshCountdown -= 1;
  if (state.refreshCountdown <= 0) {
    state.refreshCountdown = 30;
    refreshAllData();
  }
  updateStatusBar();
}

function updateMarketStatus(nyTime) {
  const day = nyTime.getDay();
  const hour = nyTime.getHours();
  const minute = nyTime.getMinutes();

  if (day === 0 || day === 6) {
    elements.marketStatus.textContent = "Weekend";
    return;
  }
  if (hour < 9 || (hour === 9 && minute < 30)) {
    elements.marketStatus.textContent = "Pre-market";
    return;
  }
  if (hour < 16) {
    elements.marketStatus.textContent = "Open";
    return;
  }
  elements.marketStatus.textContent = "After-hours";
}

function updateStatusBar() {
  elements.lastUpdated.textContent = currentTimeShort();
  elements.refreshCountdown.textContent = `${state.refreshCountdown}s`;
  elements.watchCount.textContent = `${state.watchlist.length}`;
  elements.alertCount.textContent = `${state.alerts.length}`;
}

function showToast(message, tone = "neutral") {
  elements.toast.textContent = message;
  elements.toast.dataset.tone = tone;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2800);
}

function getFilteredUniverse(filters) {
  return universe.filter((item) => {
    if (filters.universe && item.universe !== filters.universe) {
      return false;
    }
    if (filters.sector && item.sector !== filters.sector) {
      return false;
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      return item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    }
    return true;
  });
}

function setNestedCalculatorValue(path, value) {
  const [root, field] = path.split(".");
  if (!state.calculator[root]) {
    return;
  }
  state.calculator[root][field] = Number.isFinite(value) ? value : state.calculator[root][field];
}

function buildChartKey(symbol, range, interval) {
  return `${symbol}:${range}:${interval}`;
}

function buildOptionKey(symbol, expiration) {
  return `${symbol}:${expiration ?? "nearest"}`;
}

function buildLineChartSvg(points) {
  if (!points.length) {
    return "";
  }

  const width = 700;
  const height = 260;
  const closes = points.map((item) => item.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const line = points
    .map((item, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((item.close - min) / range) * (height - 20) - 10;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="line-chart" preserveAspectRatio="none">
      <polyline points="${line}" fill="none" stroke="#6be6ff" stroke-width="3"></polyline>
    </svg>
  `;
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
  const modifiedDuration = macaulayDuration / (1 + discount);
  return {
    price,
    duration: macaulayDuration,
    modifiedDuration,
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
  if (!value) {
    return "N/A";
  }
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }
  return `$${Number(value).toFixed(0)}`;
}

function formatVolume(value) {
  if (!value) {
    return "N/A";
  }
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return `${value}`;
}

function formatExpiry(value) {
  return new Date(Number(value) * 1000).toLocaleDateString();
}

function currentTimeShort() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

init();
*/

function renderFunctionRow() {
  functionRow.innerHTML = functionKeys
    .map(
      (item) => `
        <button class="function-key ${state.panelModules[state.activePanel] === item.module ? "is-active" : ""}" data-module="${item.module}">
          <span>${item.key}</span> ${item.label}
        </button>
      `,
    )
    .join("");
}

function launchTerminal() {
  state.launched = true;
  onboarding.classList.add("hidden");
  terminalApp.classList.remove("hidden");
  commandInput.focus();
}

function setActivePanel(panel) {
  state.activePanel = panel;
  document.querySelectorAll(".panel").forEach((item) => {
    item.classList.toggle("active-panel", Number(item.dataset.panel) === panel);
  });
  renderFunctionRow();
}

function cycleModule(panel, direction) {
  const currentIndex = moduleOrder.indexOf(state.panelModules[panel]);
  const nextIndex = (currentIndex + direction + moduleOrder.length) % moduleOrder.length;
  loadModule(moduleOrder[nextIndex], panel);
}

function loadModule(moduleName, panel) {
  state.panelModules[panel] = moduleName;
  document.querySelector(`#panelTitle${panel}`).textContent = moduleTitles[moduleName] ?? moduleName.toUpperCase();
  renderPanel(panel);
  setActivePanel(panel);
  renderFunctionRow();
}

function renderAllPanels() {
  [1, 2, 3, 4].forEach((panel) => renderPanel(panel));
}

function renderPanel(panel) {
  const moduleName = state.panelModules[panel];
  const container = document.querySelector(`#panelContent${panel}`);
  if (!container) {
    return;
  }

  const renderers = {
    home: renderHome,
    quote: renderQuote,
    screener: renderScreener,
    heatmap: renderHeatmap,
    portfolio: renderPortfolio,
    macro: renderMacro,
    news: renderNews,
    calculator: renderCalculator,
  };

  const renderer = renderers[moduleName] ?? renderHome;
  container.innerHTML = renderer(panel);
}

function renderHome() {
  const cards = state.watchlist.slice(0, 8)
    .map(
      (item) => `
        <article class="market-card">
          <span class="market-symbol">${item.symbol}</span>
          <strong>${formatPrice(item.price, item.symbol)}</strong>
          <span class="${item.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(item.changePct)}</span>
          <small>${item.sector}</small>
        </article>
      `,
    )
    .join("");

  const alertMarkup = state.alerts
    .map(
      (alert) => `
        <li>
          <strong>${alert.symbol}</strong>
          <span>${alert.operator} ${alert.threshold}</span>
          <span class="${alert.status === "triggered" ? "positive" : "muted"}">${alert.status}</span>
        </li>
      `,
    )
    .join("");

  const briefingMarkup = state.briefings.slice(0, 3)
    .map(
      (item) => `
        <article class="brief-item">
          <strong>${item.title}</strong>
          <span>${item.impact}</span>
          <p>${item.detail}</p>
        </article>
      `,
    )
    .join("");

  return `
    <section class="module-stack">
      <div class="market-strip">${cards}</div>
      <div class="split-grid two-up">
        <section class="sub-panel">
          <div class="sub-panel-header"><span>Active alerts</span><span>${state.alerts.length}</span></div>
          <ul class="status-list">${alertMarkup}</ul>
        </section>
        <section class="sub-panel">
          <div class="sub-panel-header"><span>Desk briefings</span><span>Live</span></div>
          <div class="brief-grid">${briefingMarkup}</div>
        </section>
      </div>
    </section>
  `;
}

function renderQuote(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const quote = marketMap.get(symbol) ?? marketMap.get("AAPL");
  const spread = quote.price * 0.0012;
  const dayHigh = quote.price * 1.012;
  const dayLow = quote.price * 0.988;
  const previousClose = quote.price / (1 + quote.changePct / 100);
  const marketCap = quote.marketCap ? formatMarketCap(quote.marketCap) : "N/A";

  return `
    <section class="module-stack">
      <div class="toolbar-row">
        <input class="panel-input" data-symbol-input="${panel}" value="${quote.symbol}" />
        <button class="panel-button" data-symbol-go="${panel}">LOAD</button>
        <span class="toolbar-label">${quote.name}</span>
      </div>
      <div class="quote-hero">
        <div>
          <span class="quote-symbol">${quote.symbol}</span>
          <strong class="quote-price">${formatPrice(quote.price, quote.symbol)}</strong>
          <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
        </div>
        <div class="quote-meta">${quote.sector} · ${quote.universe}</div>
      </div>
      <table class="terminal-table">
        <tbody>
          <tr><td>Bid</td><td>${formatPrice(quote.price - spread, quote.symbol)}</td><td>Ask</td><td>${formatPrice(quote.price + spread, quote.symbol)}</td></tr>
          <tr><td>Prev close</td><td>${formatPrice(previousClose, quote.symbol)}</td><td>Day high</td><td>${formatPrice(dayHigh, quote.symbol)}</td></tr>
          <tr><td>Day low</td><td>${formatPrice(dayLow, quote.symbol)}</td><td>Market cap</td><td>${marketCap}</td></tr>
          <tr><td>Exchange</td><td>${quote.exchange}</td><td>Universe</td><td>${quote.universe}</td></tr>
        </tbody>
      </table>
      <div class="sparkline-row">
        ${buildSparkline(quote.changePct)}
      </div>
    </section>
  `;
}

function renderScreener(panel) {
  const filters = state.screenerFilters[panel];
  const filtered = getFilteredUniverse(filters);
  const sectors = [...new Set(universe.map((item) => item.sector))].sort();
  const universes = [...new Set(universe.map((item) => item.universe))].sort();

  return `
    <section class="module-stack">
      <div class="toolbar-row wrap">
        <select class="panel-select" data-screener-universe="${panel}">
          <option value="">ALL INDEXES</option>
          ${universes.map((item) => `<option value="${item}" ${filters.universe === item ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <select class="panel-select" data-screener-sector="${panel}">
          <option value="">ALL SECTORS</option>
          ${sectors.map((item) => `<option value="${item}" ${filters.sector === item ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <input class="panel-input grow" data-screener-search="${panel}" value="${filters.search}" placeholder="ticker/name" />
        <span class="toolbar-label">${filtered.length} results</span>
      </div>
      <div class="table-scroll">
        <table class="terminal-table compact">
          <thead>
            <tr><th>Ticker</th><th>Name</th><th>Sector</th><th>Index</th><th>Price</th><th>Chg%</th></tr>
          </thead>
          <tbody>
            ${filtered.slice(0, 60).map((item) => `
              <tr data-load-symbol="${item.symbol}">
                <td class="highlight-cell">${item.symbol}</td>
                <td>${item.name}</td>
                <td>${item.sector}</td>
                <td>${item.universe}</td>
                <td>${formatPrice(item.price, item.symbol)}</td>
                <td class="${item.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(item.changePct)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderHeatmap() {
  const groups = buildHeatmapGroups();
  const sectors = Object.entries(groups)
    .map(([sector, symbols]) => {
      const blocks = symbols
        .map((symbol) => {
          const item = marketMap.get(symbol);
          if (!item) {
            return "";
          }
          const magnitude = Math.max(1, Math.min(4, Math.round(Math.abs(item.changePct)) + 1));
          const tone = item.changePct >= 0 ? "up" : "down";
          return `
            <button class="heat-block ${tone} size-${magnitude}" data-load-symbol="${item.symbol}">
              <strong>${item.symbol}</strong>
              <span>${formatSignedPct(item.changePct)}</span>
            </button>
          `;
        })
        .join("");

      return `
        <section class="heat-sector">
          <div class="sub-panel-header"><span>${sector}</span><span>${symbols.length}</span></div>
          <div class="heat-grid">${blocks}</div>
        </section>
      `;
    })
    .join("");

  return `<section class="module-stack heatmap-board">${sectors}</section>`;
}

function renderPortfolio() {
  const rows = state.positions.map((position) => {
    const quote = marketMap.get(position.symbol);
    const mark = quote?.price ?? position.cost;
    const value = mark * position.shares;
    const basis = position.cost * position.shares;
    const pnl = value - basis;
    const pnlPct = basis ? (pnl / basis) * 100 : 0;
    return { ...position, mark, value, pnl, pnlPct };
  });

  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const totalBasis = rows.reduce((sum, row) => sum + row.cost * row.shares, 0);
  const totalPnl = totalValue - totalBasis;
  const totalPct = totalBasis ? (totalPnl / totalBasis) * 100 : 0;

  return `
    <section class="module-stack">
      <div class="portfolio-summary-grid">
        <article class="summary-box"><span>Total value</span><strong>${formatPrice(totalValue, "USD")}</strong></article>
        <article class="summary-box"><span>Total P/L</span><strong class="${totalPnl >= 0 ? "positive" : "negative"}">${totalPnl >= 0 ? "+" : ""}${formatPrice(totalPnl, "USD")}</strong></article>
        <article class="summary-box"><span>Total P/L %</span><strong class="${totalPct >= 0 ? "positive" : "negative"}">${formatSignedPct(totalPct)}</strong></article>
      </div>
      <div class="table-scroll">
        <table class="terminal-table compact">
          <thead>
            <tr><th>Ticker</th><th>Shares</th><th>Cost</th><th>Mark</th><th>Value</th><th>P/L</th><th>P/L %</th></tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr data-load-symbol="${row.symbol}">
                <td class="highlight-cell">${row.symbol}</td>
                <td>${row.shares}</td>
                <td>${formatPrice(row.cost, row.symbol)}</td>
                <td>${formatPrice(row.mark, row.symbol)}</td>
                <td>${formatPrice(row.value, "USD")}</td>
                <td class="${row.pnl >= 0 ? "positive" : "negative"}">${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}</td>
                <td class="${row.pnlPct >= 0 ? "positive" : "negative"}">${formatSignedPct(row.pnlPct)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMacro() {
  const curveMarkup = macroBoard.curve
    .map((point) => {
      const height = point.yield * 14;
      return `
        <div class="curve-bar-wrap">
          <div class="curve-bar" style="height:${height}px"></div>
          <strong>${point.yield.toFixed(2)}%</strong>
          <span>${point.tenor}</span>
        </div>
      `;
    })
    .join("");

  const indicators = macroBoard.indicators
    .map(
      (item) => `
        <tr>
          <td>${item.label}</td>
          <td class="tone-${item.tone}">${item.value}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <section class="module-stack">
      <section class="sub-panel">
        <div class="sub-panel-header"><span>Yield curve</span><span>US Treasury</span></div>
        <div class="curve-grid">${curveMarkup}</div>
      </section>
      <section class="sub-panel">
        <div class="sub-panel-header"><span>Indicators</span><span>Macro tape</span></div>
        <table class="terminal-table compact"><tbody>${indicators}</tbody></table>
      </section>
    </section>
  `;
}

function renderNews() {
  return `
    <section class="module-stack">
      ${state.news.map((item) => `
        <article class="news-card">
          <div class="news-meta"><span>${item.source}</span><span>${item.time}</span></div>
          <strong>${item.headline}</strong>
        </article>
      `).join("")}
    </section>
  `;
}

function renderCalculator(panel) {
  const options = state.calculator.options;
  const bond = state.calculator.bond;
  const optionsResult = calculateBlackScholes(options);
  const bondResult = calculateBond(bond);

  return `
    <section class="module-stack">
      <div class="split-grid two-up">
        <section class="sub-panel">
          <div class="sub-panel-header"><span>Black-Scholes</span><span>Options</span></div>
          <div class="calc-grid">
            ${renderCalcInput("Spot", "option-spot", options.spot)}
            ${renderCalcInput("Strike", "option-strike", options.strike)}
            ${renderCalcInput("Years", "option-years", options.years)}
            ${renderCalcInput("Rate %", "option-rate", options.rate)}
            ${renderCalcInput("Vol %", "option-volatility", options.volatility)}
          </div>
          <button class="panel-button wide" data-calc-run="options">CALCULATE</button>
          <table class="terminal-table compact calc-table">
            <tbody>
              <tr><td>Call</td><td>${optionsResult.call.toFixed(4)}</td><td>Put</td><td>${optionsResult.put.toFixed(4)}</td></tr>
              <tr><td>Delta</td><td>${optionsResult.delta.toFixed(4)}</td><td>Gamma</td><td>${optionsResult.gamma.toFixed(6)}</td></tr>
              <tr><td>Theta/day</td><td>${optionsResult.theta.toFixed(4)}</td><td>Vega</td><td>${optionsResult.vega.toFixed(4)}</td></tr>
            </tbody>
          </table>
        </section>

        <section class="sub-panel">
          <div class="sub-panel-header"><span>Bond pricing</span><span>Fixed income</span></div>
          <div class="calc-grid">
            ${renderCalcInput("Face", "bond-face", bond.face)}
            ${renderCalcInput("Coupon %", "bond-coupon", bond.coupon)}
            ${renderCalcInput("YTM %", "bond-ytm", bond.ytm)}
            ${renderCalcInput("Maturity", "bond-maturity", bond.maturity)}
            ${renderCalcInput("Freq", "bond-frequency", bond.frequency)}
          </div>
          <button class="panel-button wide" data-calc-run="bond">CALCULATE</button>
          <table class="terminal-table compact calc-table">
            <tbody>
              <tr><td>Price</td><td>${bondResult.price.toFixed(4)}</td><td>Duration</td><td>${bondResult.duration.toFixed(4)}</td></tr>
              <tr><td>Mod duration</td><td>${bondResult.modifiedDuration.toFixed(4)}</td><td>Convexity</td><td>${bondResult.convexity.toFixed(4)}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </section>
  `;
}

function renderCalcInput(label, name, value) {
  return `
    <label class="calc-input-row">
      <span>${label}</span>
      <input class="panel-input" data-calc-input="${name}" value="${value}" />
    </label>
  `;
}

function processCommand() {
  const raw = commandInput.value.trim();
  if (!raw) {
    return;
  }

  const upper = raw.toUpperCase();
  state.commandHistory.unshift(raw);
  state.commandHistory = state.commandHistory.slice(0, 50);
  state.commandHistoryIndex = -1;
  activeCommandDisplay.textContent = upper;
  hideAutocomplete();

  const parts = upper.split(/\s+/);
  const first = parts[0];

  if (first === "HELP") {
    state.news.unshift({ source: "System", headline: commandCatalog.map((item) => item.cmd).join(" · "), time: currentTimeShort() });
    state.news = state.news.slice(0, 8);
    loadModule("news", state.activePanel);
  } else if (first === "HOME") {
    loadModule("home", state.activePanel);
  } else if (first === "QUOTE" || parts.includes("Q")) {
    const symbol = first === "QUOTE" ? parts[1] : first;
    if (marketMap.has(symbol)) {
      state.panelSymbols[state.activePanel] = symbol;
    }
    loadModule("quote", state.activePanel);
  } else if (first === "EQS" || first === "SCREENER") {
    loadModule("screener", state.activePanel);
  } else if (first === "HEAT" || first === "HEATMAP") {
    loadModule("heatmap", state.activePanel);
  } else if (first === "PORT" || first === "PORTFOLIO") {
    loadModule("portfolio", state.activePanel);
  } else if (first === "MACRO") {
    loadModule("macro", state.activePanel);
  } else if (first === "NEWS") {
    loadModule("news", state.activePanel);
  } else if (first === "CALC") {
    loadModule("calculator", state.activePanel);
  } else if (first === "ALERT" && parts[1] && parts[2]) {
    addAlert(parts[1], Number(parts[2]));
  } else if (marketMap.has(first)) {
    state.panelSymbols[state.activePanel] = first;
    loadModule("quote", state.activePanel);
  } else {
    state.news.unshift({ source: "System", headline: `Unknown command: ${upper}`, time: currentTimeShort() });
    state.news = state.news.slice(0, 8);
    loadModule("news", state.activePanel);
  }

  commandInput.value = "";
  updateMeta();
}

function addAlert(symbol, threshold) {
  if (!marketMap.has(symbol) || Number.isNaN(threshold)) {
    return;
  }
  state.alerts.unshift({ symbol, operator: ">=", threshold, status: "watching" });
  state.alerts = state.alerts.slice(0, 8);
  renderAllPanels();
  updateMeta();
}

function tickMarket() {
  universe.forEach((item) => {
    const stored = marketMap.get(item.symbol);
    const delta = (Math.random() - 0.5) * 0.9;
    stored.changePct = Number((stored.changePct + delta).toFixed(2));
    stored.price = Number((stored.price * (1 + delta / 100)).toFixed(item.symbol.includes("USD") || item.symbol.includes("=F") ? 2 : 2));
  });

  state.watchlist = state.watchlist.map((item) => ({ ...marketMap.get(item.symbol) }));
  evaluateAlerts();
  renderAllPanels();
  updateMeta();
}

function evaluateAlerts() {
  state.alerts = state.alerts.map((alert) => {
    const item = marketMap.get(alert.symbol);
    const triggered = item ? item.price >= alert.threshold : false;
    return { ...alert, status: triggered ? "triggered" : "watching" };
  });
}

function tickCountdown() {
  state.countdown -= 1;
  if (state.countdown <= 0) {
    state.countdown = 20;
  }
  updateMeta();
}

function updateMeta() {
  const now = new Date();
  lastUpdated.textContent = now.toLocaleTimeString("en-US", { hour12: false });
  refreshCountdown.textContent = `${state.countdown}s`;
  watchCount.textContent = `${state.watchlist.length}`;
  alertCount.textContent = `${state.alerts.length}`;
  updateMarketStatus();
}

function updateClock() {
  const now = new Date();
  const newYork = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  clockDisplay.textContent = `${newYork.toLocaleTimeString("en-US", { hour12: false })} EST`;

  const elapsed = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
  const hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  sessionClock.textContent = `${hours}:${minutes}:${seconds}`;
}

function updateMarketStatus() {
  const time = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hour = time.getHours();
  const minutes = time.getMinutes();
  const day = time.getDay();

  if (day === 0 || day === 6) {
    marketStatus.textContent = "WEEKEND";
  } else if (hour < 9 || (hour === 9 && minutes < 30)) {
    marketStatus.textContent = "PRE-MKT";
  } else if (hour < 16) {
    marketStatus.textContent = "OPEN";
  } else {
    marketStatus.textContent = "AFTER HRS";
  }
}

function showAutocomplete() {
  const value = commandInput.value.trim().toUpperCase();
  if (!value) {
    hideAutocomplete();
    return;
  }

  const commandMatches = commandCatalog
    .filter((item) => item.cmd.startsWith(value) || item.cmd.includes(value))
    .slice(0, 4)
    .map((item) => ({ text: item.cmd, desc: item.desc }));

  const tickerMatches = universe
    .filter((item) => item.symbol.startsWith(value))
    .slice(0, 5)
    .map((item) => ({ text: `${item.symbol} Q`, desc: item.name }));

  const suggestions = [...commandMatches, ...tickerMatches].slice(0, 8);
  if (!suggestions.length) {
    hideAutocomplete();
    return;
  }

  autocomplete.innerHTML = suggestions
    .map(
      (item) => `
        <button class="autocomplete-item" data-autocomplete="${item.text}">
          <strong>${item.text}</strong>
          <span>${item.desc}</span>
        </button>
      `,
    )
    .join("");

  autocomplete.style.display = "grid";
}

function hideAutocomplete() {
  autocomplete.style.display = "none";
}

function handleCommandInputKeydown(event) {
  if (event.key === "Enter") {
    processCommand();
  } else if (event.key === "Escape") {
    commandInput.value = "";
    hideAutocomplete();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (state.commandHistoryIndex < state.commandHistory.length - 1) {
      state.commandHistoryIndex += 1;
      commandInput.value = state.commandHistory[state.commandHistoryIndex];
    }
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    if (state.commandHistoryIndex > 0) {
      state.commandHistoryIndex -= 1;
      commandInput.value = state.commandHistory[state.commandHistoryIndex];
    } else {
      state.commandHistoryIndex = -1;
      commandInput.value = "";
    }
  }
}

function handleGlobalKeydown(event) {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName) && event.key !== "Escape") {
    return;
  }

  const keyMap = {
    F1: "home",
    F2: "quote",
    F3: "screener",
    F4: "heatmap",
    F5: "portfolio",
    F6: "macro",
    F7: "news",
    F8: "calculator",
  };

  if (event.key === "Tab") {
    event.preventDefault();
    const next = state.activePanel % 4 + 1;
    setActivePanel(next);
    return;
  }

  if (keyMap[event.key]) {
    event.preventDefault();
    loadModule(keyMap[event.key], state.activePanel);
    return;
  }

  if (event.key === "Escape") {
    commandInput.value = "";
    hideAutocomplete();
    commandInput.focus();
  }
}

function handleDocumentClick(event) {
  const autoItem = event.target.closest("[data-autocomplete]");
  if (autoItem) {
    commandInput.value = autoItem.dataset.autocomplete;
    processCommand();
    return;
  }

  const symbolRow = event.target.closest("[data-load-symbol]");
  if (symbolRow) {
    const symbol = symbolRow.dataset.loadSymbol;
    state.panelSymbols[state.activePanel] = symbol;
    loadModule("quote", state.activePanel);
    return;
  }

  const symbolGo = event.target.closest("[data-symbol-go]");
  if (symbolGo) {
    const panel = Number(symbolGo.dataset.symbolGo);
    const input = document.querySelector(`[data-symbol-input="${panel}"]`);
    const symbol = input?.value.toUpperCase().trim();
    if (marketMap.has(symbol)) {
      state.panelSymbols[panel] = symbol;
      renderPanel(panel);
    }
    return;
  }

  const calcButton = event.target.closest("[data-calc-run]");
  if (calcButton) {
    updateCalculatorState();
    renderAllPanels();
    return;
  }

  if (!event.target.closest(".command-bar-shell")) {
    hideAutocomplete();
  }
}

function handleDocumentInput(event) {
  const universeSelect = event.target.closest("[data-screener-universe]");
  if (universeSelect) {
    state.screenerFilters[Number(universeSelect.dataset.screenerUniverse)].universe = universeSelect.value;
    renderPanel(Number(universeSelect.dataset.screenerUniverse));
    return;
  }

  const sectorSelect = event.target.closest("[data-screener-sector]");
  if (sectorSelect) {
    state.screenerFilters[Number(sectorSelect.dataset.screenerSector)].sector = sectorSelect.value;
    renderPanel(Number(sectorSelect.dataset.screenerSector));
    return;
  }

  const searchInput = event.target.closest("[data-screener-search]");
  if (searchInput) {
    state.screenerFilters[Number(searchInput.dataset.screenerSearch)].search = searchInput.value;
    renderPanel(Number(searchInput.dataset.screenerSearch));
  }
}

function updateCalculatorState() {
  document.querySelectorAll("[data-calc-input]").forEach((input) => {
    const value = Number(input.value);
    if (Number.isNaN(value)) {
      return;
    }

    if (input.dataset.calcInput.startsWith("option-")) {
      const key = input.dataset.calcInput.replace("option-", "");
      state.calculator.options[key === "volatility" ? "volatility" : key === "rate" ? "rate" : key === "years" ? "years" : key] = value;
    }

    if (input.dataset.calcInput.startsWith("bond-")) {
      const key = input.dataset.calcInput.replace("bond-", "");
      const mapping = { face: "face", coupon: "coupon", ytm: "ytm", maturity: "maturity", frequency: "frequency" };
      state.calculator.bond[mapping[key]] = value;
    }
  });
}

function getFilteredUniverse(filters) {
  return universe.filter((item) => {
    if (filters.universe && item.universe !== filters.universe) {
      return false;
    }
    if (filters.sector && item.sector !== filters.sector) {
      return false;
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return item.symbol.toLowerCase().includes(search) || item.name.toLowerCase().includes(search);
    }
    return true;
  });
}

function buildSparkline(changePct) {
  const points = Array.from({ length: 16 }, (_, index) => {
    const base = 20 + Math.sin(index / 2) * 8 + index * 0.8 + changePct * 0.9;
    return `${index * 18},${Math.max(4, 48 - base)}`;
  }).join(" ");
  const color = changePct >= 0 ? "#33ff66" : "#ff5555";
  return `
    <svg class="sparkline" viewBox="0 0 270 56" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"></polyline>
    </svg>
  `;
}

function calculateBlackScholes({ spot, strike, years, rate, volatility }) {
  const safeYears = Math.max(years, 0.0001);
  const safeVol = Math.max(volatility / 100, 0.0001);
  const safeRate = rate / 100;
  const d1 = (Math.log(spot / strike) + (safeRate + (safeVol ** 2) / 2) * safeYears) / (safeVol * Math.sqrt(safeYears));
  const d2 = d1 - safeVol * Math.sqrt(safeYears);
  const normal = (value) => 0.5 * (1 + erf(value / Math.sqrt(2)));
  const density = (value) => Math.exp(-(value ** 2) / 2) / Math.sqrt(2 * Math.PI);
  const call = spot * normal(d1) - strike * Math.exp(-safeRate * safeYears) * normal(d2);
  const put = call - spot + strike * Math.exp(-safeRate * safeYears);
  const delta = normal(d1);
  const gamma = density(d1) / (spot * safeVol * Math.sqrt(safeYears));
  const theta = (-(spot * density(d1) * safeVol) / (2 * Math.sqrt(safeYears)) - safeRate * strike * Math.exp(-safeRate * safeYears) * normal(d2)) / 365;
  const vega = (spot * density(d1) * Math.sqrt(safeYears)) / 100;
  return { call, put, delta, gamma, theta, vega };
}

function calculateBond({ face, coupon, ytm, maturity, frequency }) {
  const payments = Math.max(1, Math.round(maturity * frequency));
  const couponCash = (coupon / 100) * face / frequency;
  const discount = ytm / 100 / frequency;
  let price = 0;
  let duration = 0;
  let convexity = 0;

  for (let period = 1; period <= payments; period += 1) {
    const cashflow = period === payments ? couponCash + face : couponCash;
    const presentValue = cashflow / ((1 + discount) ** period);
    price += presentValue;
    duration += period * presentValue;
    convexity += period * (period + 1) * presentValue;
  }

  const macDuration = duration / price / frequency;
  const modifiedDuration = macDuration / (1 + discount);
  return {
    price,
    duration: macDuration,
    modifiedDuration,
    convexity: convexity / (price * frequency * frequency),
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
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-(absolute ** 2));
  return sign * y;
}

function formatPrice(value, symbol) {
  const digits = symbol === "BTC-USD" || symbol === "USD" ? 0 : 2;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatSignedPct(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMarketCap(value) {
  if (!value) {
    return "N/A";
  }
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  return `$${(value / 1e6).toFixed(2)}M`;
}

function currentTimeShort() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

init();
````

## `src/auth.js`

````javascript
import {
  buildDefaultUserState,
  clearSession,
  getSession,
  getUserState,
  getUsers,
  saveSession,
  saveUserState,
  saveUsers,
} from "./storage.js";

function normalizeIdentifier(value) {
  return value.trim().toLowerCase();
}

function generateId() {
  return `usr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function createAccount(payload) {
  const users = getUsers();
  const username = payload.username.trim();
  const email = payload.email.trim().toLowerCase();

  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already exists.");
  }

  if (users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("Email already exists.");
  }

  const passwordHash = await hashPassword(payload.password);
  const user = {
    id: generateId(),
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email,
    username,
    role: payload.role,
    createdAt: new Date().toISOString(),
    passwordHash,
  };

  users.push(user);
  saveUsers(users);
  saveUserState(user.id, buildDefaultUserState());
  saveSession({ userId: user.id, createdAt: new Date().toISOString() });

  return { ...user, passwordHash: undefined };
}

export async function login(payload) {
  const users = getUsers();
  const identifier = normalizeIdentifier(payload.identifier);
  const user = users.find((item) => item.username.toLowerCase() === identifier || item.email.toLowerCase() === identifier);

  if (!user) {
    throw new Error("Account not found.");
  }

  const passwordHash = await hashPassword(payload.password);
  if (passwordHash != user.passwordHash) {
    throw new Error("Incorrect password.");
  }

  saveSession({ userId: user.id, createdAt: new Date().toISOString() });
  return { ...user, passwordHash: undefined };
}

export function logout() {
  clearSession();
}

export function restoreSessionUser() {
  const session = getSession();
  if (!session?.userId) {
    return null;
  }

  const user = getUsers().find((item) => item.id === session.userId);
  if (!user) {
    clearSession();
    return null;
  }

  return { ...user, passwordHash: undefined, state: getUserState(user.id) };
}
````

## `src/storage.js`

````javascript
const KEYS = {
  users: "the-terminal.users.v1",
  session: "the-terminal.session.v1",
  userStatePrefix: "the-terminal.user-state.v1",
};

function safeParse(rawValue, fallbackValue) {
  if (!rawValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
}

export function loadJson(key, fallbackValue) {
  return safeParse(window.localStorage.getItem(key), fallbackValue);
}

export function saveJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getUsers() {
  return loadJson(KEYS.users, []);
}

export function saveUsers(users) {
  saveJson(KEYS.users, users);
}

export function getSession() {
  return loadJson(KEYS.session, null);
}

export function saveSession(session) {
  saveJson(KEYS.session, session);
}

export function clearSession() {
  window.localStorage.removeItem(KEYS.session);
}

export function getUserStateKey(userId) {
  return `${KEYS.userStatePrefix}.${userId}`;
}

export function buildDefaultUserState(seed = {}) {
  return {
    watchlist: seed.watchlist ?? ["AAPL", "MSFT", "NVDA", "QQQ", "BTC-USD", "PLTR"],
    alerts: seed.alerts ?? [],
    positions: seed.positions ?? [],
    panelModules: seed.panelModules ?? { 1: "home", 2: "quote", 3: "chart", 4: "news" },
    panelSymbols: seed.panelSymbols ?? { 1: "NVDA", 2: "AAPL", 3: "MSFT", 4: "QQQ" },
    commandHistory: seed.commandHistory ?? [],
    layoutMode: seed.layoutMode ?? "quad",
    createdAt: seed.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getUserState(userId, seed = {}) {
  const key = getUserStateKey(userId);
  const stored = loadJson(key, null);
  return buildDefaultUserState({ ...seed, ...(stored ?? {}) });
}

export function saveUserState(userId, state) {
  const key = getUserStateKey(userId);
  saveJson(key, {
    ...state,
    updatedAt: new Date().toISOString(),
  });
}
````
