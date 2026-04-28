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
      // Don't start a drag from inputs/buttons inside the panel —
      // it makes selecting text or clicking buttons feel sluggish.
      const interactive = event.target.closest("input, textarea, select, button, a, [contenteditable]");
      if (interactive) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/panel-id", panelNode.dataset.panel || "");
      panelNode.classList.add("is-dragging");

      // Replace the default browser ghost (a full-size translucent
      // copy of the panel that looks like a "duplicate" hovering with
      // the cursor) with a small chip showing what's being moved.
      // Without this the user sees a huge floating panel which is
      // both ugly and confusing.
      try {
        const moduleLabel = (panelNode.dataset.moduleKey || "PANEL").toString();
        const chip = document.createElement("div");
        chip.className = "panel-drag-chip";
        chip.textContent = moduleLabel;
        // Off-screen so it isn't visible itself, but referenced as the
        // drag image. Browsers require it be in the DOM at dragstart.
        chip.style.position = "fixed";
        chip.style.top = "-1000px";
        chip.style.left = "-1000px";
        document.body.appendChild(chip);
        event.dataTransfer.setDragImage(chip, 16, 16);
        // Clean up after the browser has snapshotted the image.
        setTimeout(() => chip.remove(), 0);
      } catch {
        // setDragImage is widely supported but not universal; fall
        // back to the default ghost on failure rather than aborting
        // the drag.
      }
    });

    this.workspaceGrid.addEventListener("dragend", () => {
      this.workspaceGrid.querySelectorAll("[data-panel].is-dragging").forEach((panelNode) => {
        panelNode.classList.remove("is-dragging");
      });
      this.workspaceGrid.querySelectorAll("[data-panel].is-drop-target").forEach((panelNode) => {
        panelNode.classList.remove("is-drop-target");
      });
    });

    this.workspaceGrid.addEventListener("dragover", (event) => {
      const target = event.target.closest("[data-panel]");
      if (!target) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      // Highlight the would-be drop target (skip the source panel)
      if (!target.classList.contains("is-dragging")) {
        this.workspaceGrid.querySelectorAll("[data-panel].is-drop-target").forEach((panelNode) => {
          if (panelNode !== target) panelNode.classList.remove("is-drop-target");
        });
        target.classList.add("is-drop-target");
      }
    });

    this.workspaceGrid.addEventListener("dragleave", (event) => {
      const target = event.target.closest("[data-panel]");
      if (!target) return;
      // Only clear the highlight if we actually left the panel (not
      // just moved between its child elements).
      if (!target.contains(event.relatedTarget)) {
        target.classList.remove("is-drop-target");
      }
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
