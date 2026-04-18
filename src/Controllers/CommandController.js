export class CommandController {
  constructor({ state, el, appCore, hideAutocomplete, closeCommandPalette, processRawCommand }) {
    this.state = state;
    this.el = el;
    this.appCore = appCore;
    this.hideAutocomplete = hideAutocomplete;
    this.closeCommandPalette = closeCommandPalette;
    this.processRawCommand = processRawCommand;
    // Track which autocomplete item is focused (-1 = none, 0+ = item index)
    this._acIndex = -1;
  }

  processInput() {
    const raw = String(this.el.commandInput?.value || "").trim();
    if (!raw) return;
    if (this.processRawCommand) {
      this.processRawCommand(raw);
      return;
    }
    this.appCore?.dispatchRawCommand(raw);
  }

  /** Move focus to autocomplete item at `index`. -1 refocuses the input. */
  _focusAcItem(index) {
    const container = this.el.autocomplete;
    if (!container || container.classList.contains("hidden")) return;
    const items = container.querySelectorAll(".autocomplete-item");
    if (!items.length) return;

    const clamped = Math.max(-1, Math.min(index, items.length - 1));
    this._acIndex = clamped;

    // Remove highlight from all
    items.forEach((btn) => btn.classList.remove("is-highlighted"));

    if (clamped === -1) {
      this.el.commandInput?.focus();
      return;
    }

    const target = items[clamped];
    target.classList.add("is-highlighted");
    // Fill the input with the suggestion label
    const label = target.dataset.autocomplete;
    if (label && this.el.commandInput) {
      this.el.commandInput.value = label;
    }
    target.focus();
  }

  handleCommandKeydown(event) {
    const acContainer = this.el.autocomplete;
    const acVisible = acContainer && !acContainer.classList.contains("hidden");
    const acItems = acVisible ? acContainer.querySelectorAll(".autocomplete-item") : [];

    // Tab: select the first (or currently highlighted) autocomplete item
    if (event.key === "Tab" && acVisible && acItems.length) {
      event.preventDefault();
      const targetIdx = this._acIndex >= 0 ? this._acIndex : 0;
      const target = acItems[targetIdx];
      if (target) {
        const label = target.dataset.autocomplete;
        if (label && this.el.commandInput) this.el.commandInput.value = label;
        this.hideAutocomplete();
        this.el.commandInput?.focus();
        this._acIndex = -1;
      }
      return;
    }

    // ArrowDown: navigate into autocomplete (or cycle history when dropdown is closed)
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (acVisible && acItems.length) {
        this._focusAcItem(this._acIndex + 1);
      } else {
        // History navigation
        if (this.state.commandHistoryIndex > 0) {
          this.state.commandHistoryIndex -= 1;
          if (this.el.commandInput) this.el.commandInput.value = this.state.commandHistory[this.state.commandHistoryIndex];
        } else {
          this.state.commandHistoryIndex = -1;
          if (this.el.commandInput) this.el.commandInput.value = "";
        }
      }
      return;
    }

    // ArrowUp: navigate up through autocomplete or history
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (acVisible && acItems.length) {
        if (this._acIndex > 0) {
          this._focusAcItem(this._acIndex - 1);
        } else {
          // Wrap back to input
          this._acIndex = -1;
          this.el.commandInput?.focus();
        }
      } else {
        // History navigation
        if (this.state.commandHistoryIndex < this.state.commandHistory.length - 1) {
          this.state.commandHistoryIndex += 1;
          if (this.el.commandInput) this.el.commandInput.value = this.state.commandHistory[this.state.commandHistoryIndex];
        }
      }
      return;
    }

    if (event.key === "Enter") {
      this._acIndex = -1;
      this.processInput();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this._acIndex = -1;
      if (acVisible) {
        this.hideAutocomplete();
        this.el.commandInput?.focus();
      } else {
        if (this.el.commandInput) this.el.commandInput.value = "";
        this.closeCommandPalette();
      }
    }
  }

  /** Reset the highlight index whenever new suggestions are rendered */
  resetHighlight() {
    this._acIndex = -1;
    const container = this.el.autocomplete;
    if (container) container.querySelectorAll(".autocomplete-item").forEach((b) => b.classList.remove("is-highlighted"));
  }
}
