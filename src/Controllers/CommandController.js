export class CommandController {
  constructor({ state, el, appCore, hideAutocomplete, closeCommandPalette }) {
    this.state = state;
    this.el = el;
    this.appCore = appCore;
    this.hideAutocomplete = hideAutocomplete;
    this.closeCommandPalette = closeCommandPalette;
  }

  processInput() {
    const raw = String(this.el.commandInput?.value || "").trim();
    if (!raw) return;
    this.appCore?.dispatchRawCommand(raw);
  }

  handleCommandKeydown(event) {
    if (event.key === "Enter") {
      this.processInput();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (this.el.commandInput) this.el.commandInput.value = "";
      this.hideAutocomplete();
      this.closeCommandPalette();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (this.state.commandHistoryIndex < this.state.commandHistory.length - 1) {
        this.state.commandHistoryIndex += 1;
        this.el.commandInput.value = this.state.commandHistory[this.state.commandHistoryIndex];
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (this.state.commandHistoryIndex > 0) {
        this.state.commandHistoryIndex -= 1;
        this.el.commandInput.value = this.state.commandHistory[this.state.commandHistoryIndex];
      } else {
        this.state.commandHistoryIndex = -1;
        this.el.commandInput.value = "";
      }
    }
  }
}
