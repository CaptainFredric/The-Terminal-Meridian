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
