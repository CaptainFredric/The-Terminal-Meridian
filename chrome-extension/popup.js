/*
 * Meridian Quick Quotes — popup
 *
 * The popup is a thin read-only client over the Meridian Flask backend. We
 * intentionally avoid frameworks/build steps so the extension is trivially
 * auditable and ships as plain files. State lives in chrome.storage.local so
 * the user's watchlist survives popup close + browser restart.
 */

// --- Configuration ---------------------------------------------------------
// Configurable so dev (localhost) and prod (deployed Flask) can swap easily.
// To point at production, change MERIDIAN_API_BASE to the public origin
// (e.g. "https://api.meridian.example.com") and update host_permissions in
// manifest.json to match.
const MERIDIAN_API_BASE = "http://127.0.0.1:4173";
const MERIDIAN_APP_URL = "https://captainfredric.github.io/The-Terminal-Meridian/";

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY"];
const POLL_INTERVAL_MS = 30_000; // 30s while popup is open

// --- DOM refs --------------------------------------------------------------
const els = {
  body: document.getElementById("watchlistBody"),
  statusText: document.getElementById("statusText"),
  statusTime: document.getElementById("statusTime"),
  statusBar: document.getElementById("statusBar"),
  refreshBtn: document.getElementById("refreshBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsPanel: document.getElementById("settingsPanel"),
  symbolsInput: document.getElementById("symbolsInput"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
  openMeridianBtn: document.getElementById("openMeridianBtn"),
};

// --- State -----------------------------------------------------------------
let watchlist = DEFAULT_WATCHLIST.slice();
let lastSuccessAt = null;
let pollTimer = null;

// --- Storage helpers -------------------------------------------------------
function loadWatchlist() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ watchlist: DEFAULT_WATCHLIST }, (res) => {
      const list = Array.isArray(res.watchlist) && res.watchlist.length
        ? res.watchlist
        : DEFAULT_WATCHLIST.slice();
      resolve(list);
    });
  });
}

function saveWatchlist(list) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ watchlist: list }, resolve);
  });
}

// --- Networking ------------------------------------------------------------
// Returns array of quote objects, or throws on network/HTTP error. We let the
// caller decide how to render the error state so this stays a pure fetcher.
async function fetchQuotes(symbols) {
  if (!symbols.length) return [];
  const url = `${MERIDIAN_API_BASE}/api/market/quotes?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  // The API returns an array; tolerate either {quotes: [...]} or [...] just in case.
  return Array.isArray(data) ? data : (data.quotes || []);
}

// --- Rendering -------------------------------------------------------------
function fmtPrice(p) {
  if (p == null || Number.isNaN(p)) return "--";
  return Number(p).toFixed(2);
}

function fmtPct(p) {
  if (p == null || Number.isNaN(p)) return "--";
  const sign = p > 0 ? "+" : "";
  return `${sign}${Number(p).toFixed(2)}%`;
}

function classForChange(p) {
  if (p == null || Number.isNaN(p)) return "flat";
  if (p > 0) return "pos";
  if (p < 0) return "neg";
  return "flat";
}

function renderRows(quotes) {
  if (!quotes.length) {
    els.body.innerHTML = `<tr><td colspan="3" class="empty">Watchlist is empty. Open settings to add symbols.</td></tr>`;
    return;
  }
  // Build a map so the row order matches the user's saved watchlist order.
  const bySym = new Map(quotes.map((q) => [String(q.symbol).toUpperCase(), q]));
  els.body.innerHTML = "";
  for (const sym of watchlist) {
    const q = bySym.get(sym.toUpperCase());
    const tr = document.createElement("tr");
    const cls = classForChange(q?.changePct);
    tr.innerHTML = `
      <td class="sym" data-sym="${sym}">${sym}</td>
      <td class="num">${q ? fmtPrice(q.price) : "--"}</td>
      <td class="num ${cls}">${q ? fmtPct(q.changePct) : "--"}</td>
    `;
    els.body.appendChild(tr);
  }
  // Symbol click → open Meridian focused on that ticker via hash routing.
  els.body.querySelectorAll("td.sym").forEach((td) => {
    td.addEventListener("click", () => {
      const sym = td.getAttribute("data-sym");
      chrome.tabs.create({ url: `${MERIDIAN_APP_URL}#symbol=${encodeURIComponent(sym)}` });
    });
  });
}

function renderStatus(ok, msg) {
  els.statusBar.classList.toggle("error", !ok);
  els.statusText.textContent = msg;
  if (ok && lastSuccessAt) {
    els.statusTime.textContent = lastSuccessAt.toLocaleTimeString();
  } else if (!ok && lastSuccessAt) {
    const mins = Math.max(1, Math.floor((Date.now() - lastSuccessAt.getTime()) / 60000));
    els.statusTime.textContent = `last seen ${mins}m ago`;
  } else {
    els.statusTime.textContent = "";
  }
}

// --- Refresh cycle ---------------------------------------------------------
async function refresh() {
  renderStatus(true, "Refreshing...");
  try {
    const quotes = await fetchQuotes(watchlist);
    lastSuccessAt = new Date();
    renderRows(quotes);
    renderStatus(true, "Live");
  } catch (err) {
    // Network errors are common in dev (backend not running) — degrade gracefully.
    console.warn("[meridian-popup] fetch failed:", err);
    renderStatus(false, "Offline");
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

// --- Settings panel --------------------------------------------------------
function openSettings() {
  els.symbolsInput.value = watchlist.join(", ");
  els.settingsPanel.classList.add("open");
}
function closeSettings() {
  els.settingsPanel.classList.remove("open");
}

async function handleSaveSettings() {
  const raw = els.symbolsInput.value || "";
  // Normalize: split, trim, uppercase, dedupe, drop empties.
  const next = Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  );
  watchlist = next;
  await saveWatchlist(next);
  closeSettings();
  refresh();
}

// --- Wiring ----------------------------------------------------------------
els.refreshBtn.addEventListener("click", refresh);
els.settingsBtn.addEventListener("click", () => {
  if (els.settingsPanel.classList.contains("open")) closeSettings();
  else openSettings();
});
els.saveSettingsBtn.addEventListener("click", handleSaveSettings);
els.cancelSettingsBtn.addEventListener("click", closeSettings);
els.openMeridianBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: MERIDIAN_APP_URL });
});

// Stop the timer when the popup closes so we don't leak intervals on reopen.
window.addEventListener("unload", stopPolling);

// Boot.
(async function init() {
  watchlist = await loadWatchlist();
  await refresh();
  startPolling();
})();
