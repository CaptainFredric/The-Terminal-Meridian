/*
 * Meridian Quick Quotes — service worker (MV3)
 *
 * Why a periodic alarm rather than setInterval: MV3 service workers are torn
 * down whenever idle, so persistent timers are unreliable. chrome.alarms
 * survives worker shutdown — the runtime wakes us back up on schedule.
 *
 * The badge is an at-a-glance summary for users who don't open the popup:
 * "3↑" with green background means three watchlist names are up; red means
 * more are down than up. Empty when offline.
 */

const MERIDIAN_API_BASE = "http://127.0.0.1:4173";
// To switch to prod, replace the line above with the public Flask origin and
// update host_permissions in manifest.json.

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY"];
const ALARM_NAME = "meridian-refresh";
const REFRESH_PERIOD_MIN = 5;

// --- Lifecycle -------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  // (Re)create the alarm on install/update so schedule changes take effect.
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: REFRESH_PERIOD_MIN,
  });
  // Seed watchlist if first install.
  chrome.storage.local.get({ watchlist: null }, (res) => {
    if (!res.watchlist) {
      chrome.storage.local.set({ watchlist: DEFAULT_WATCHLIST });
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  // Browser restart can drop alarms in some edge cases — ensure one exists.
  chrome.alarms.get(ALARM_NAME, (a) => {
    if (!a) {
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: 1,
        periodInMinutes: REFRESH_PERIOD_MIN,
      });
    }
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    refreshBadge().catch((err) => console.warn("[meridian-bg] refresh err:", err));
    checkPriceAlerts().catch((err) => console.warn("[meridian-bg] alerts err:", err));
  }
});

// --- Helpers ---------------------------------------------------------------
function getWatchlist() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ watchlist: DEFAULT_WATCHLIST }, (res) => {
      const list = Array.isArray(res.watchlist) && res.watchlist.length
        ? res.watchlist
        : DEFAULT_WATCHLIST;
      resolve(list);
    });
  });
}

async function fetchQuotes(symbols) {
  if (!symbols.length) return [];
  const url = `${MERIDIAN_API_BASE}/api/market/quotes?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.quotes || []);
}

// --- Badge update ----------------------------------------------------------
async function refreshBadge() {
  const symbols = await getWatchlist();
  let quotes;
  try {
    quotes = await fetchQuotes(symbols);
  } catch (err) {
    // On network error, clear the badge so a stale figure doesn't mislead.
    chrome.action.setBadgeText({ text: "" });
    return;
  }

  let up = 0;
  let down = 0;
  for (const q of quotes) {
    const c = Number(q.changePct);
    if (Number.isFinite(c)) {
      if (c > 0) up++;
      else if (c < 0) down++;
    }
  }

  // Empty badge when nothing meaningful to show — keeps the toolbar clean.
  if (!quotes.length) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }

  // Show the count of advancers; color reflects breadth (more up vs down).
  const text = `${up}\u2191`; // e.g. "3↑"
  const bg = up >= down ? "#2fcf84" : "#ff5f7f"; // mirrors --success / --danger
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: bg });
  // Tooltip gives the breakdown when the user hovers the icon.
  chrome.action.setTitle({
    title: `Meridian — ${up} up · ${down} down · ${quotes.length} tracked`,
  });
}

// --- Price alerts (stub) ---------------------------------------------------
// Wire this once the backend exposes user-defined alert thresholds.
async function checkPriceAlerts() {
  // TODO: call backend alerts endpoint, e.g.:
  //   GET /api/alerts/triggered  ->  [{symbol, message, triggeredAt}, ...]
  // For each fired alert, surface a notification:
  //
  //   chrome.notifications.create(`alert-${a.id}`, {
  //     type: "basic",
  //     iconUrl: "icons/icon128.png",
  //     title: `Meridian alert · ${a.symbol}`,
  //     message: a.message,
  //     priority: 1,
  //   });
  //
  // Then POST back to /api/alerts/ack so we don't re-fire. v0.1 leaves this
  // as a stub because the alerts endpoint isn't finalized yet.
  return;
}

// Refresh once when the worker first wakes so the badge isn't stale on install.
refreshBadge().catch(() => {});
