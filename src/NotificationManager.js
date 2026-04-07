const STORAGE_KEY = "meridian_notif_history";
const MAX_ENTRIES = 50;

export class NotificationManager {
  constructor() {
    this._history = this._load();
    this._unseenCount = 0;
  }

  push({ type = "alert", title = "", body = "", symbol = null } = {}) {
    const entry = {
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      title,
      body,
      symbol: symbol ? String(symbol).toUpperCase() : null,
      timestamp: Date.now(),
    };
    this._history.unshift(entry);
    this._history = this._history.slice(0, MAX_ENTRIES);
    this._unseenCount += 1;
    this._persist();
    window.dispatchEvent(new CustomEvent("meridian:notification", { detail: entry }));
    return entry;
  }

  getHistory() {
    return this._history.slice();
  }

  getUnseenCount() {
    return this._unseenCount;
  }

  markAllSeen() {
    this._unseenCount = 0;
  }

  clearHistory() {
    this._history = [];
    this._unseenCount = 0;
    this._persist();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._history));
    } catch {
      // ignore storage quota errors
    }
  }
}
