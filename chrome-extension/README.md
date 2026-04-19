# Meridian Quick Quotes — Chrome Extension (v0.1 scaffold)

A Manifest V3 Chrome extension that surfaces a small watchlist popup, a live
toolbar badge, and one-click links into the [Meridian Market Terminal](https://captainfredric.github.io/The-Terminal-Meridian/).

This is an early scaffold — read-only, no auth, no build step.

## Install (unpacked)

1. Open `chrome://extensions` in Chrome / Edge / Brave.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this `chrome-extension/` directory.
4. Pin the "Meridian Quick Quotes" icon to your toolbar.

## Configure the API base

The extension talks to the Meridian Flask backend. By default it points at
`http://127.0.0.1:4173` (local dev). To target production:

1. Edit `MERIDIAN_API_BASE` at the top of **`popup.js`** and **`background.js`**.
2. Update `host_permissions` in **`manifest.json`** to include the prod origin.
3. Reload the extension on `chrome://extensions`.

## Features (v0.1)

- Popup watchlist with live prices and colored % change.
- Click any symbol to open Meridian focused on that ticker (`#symbol=AAPL`).
- "Open Meridian" button to launch the full app.
- Settings gear: edit the watchlist (comma-separated), persisted in
  `chrome.storage.local`.
- Toolbar badge auto-refreshes every 5 minutes via `chrome.alarms` and shows
  the count of advancers (green / red background based on breadth).
- Graceful offline state: shows "Offline" with last-seen time instead of
  blowing up when the backend is unreachable.

## Planned / stubbed

- **Price alerts**: `checkPriceAlerts()` in `background.js` is a TODO stub
  awaiting the `/api/alerts/*` endpoints on the backend. The `notifications`
  permission is already declared so the wiring is ready.
- **News headlines** in the popup (endpoint exists: `/api/market/news`).
- **Auth** — none; v0.1 is read-only by design.
- **Real icons** — see `icons/README.md`.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest; declares popup, service worker, permissions. |
| `popup.html` / `popup.js` | The toolbar popup UI. Inline styles match Meridian tokens. |
| `background.js` | Service worker; periodic alarm updates the action badge. |
| `icons/` | Toolbar / store icons (placeholders — replace before publishing). |

## Verifying

```bash
node --check chrome-extension/popup.js
node --check chrome-extension/background.js
python3 -c "import json; json.load(open('chrome-extension/manifest.json'))"
```
