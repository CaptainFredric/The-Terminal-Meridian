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
