# The-Terminal

`The-Terminal` is a Bloomberg-inspired market workspace with a real Flask backend, SQLite persistence, API-backed account sessions, and a multi-panel browser client. It now stores accounts and saved workspaces on the server instead of pretending with browser-only persistence.

## What It Does

- authenticates users through `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, and `/api/auth/session`
- lets signed-in users manage profile, password, and account deletion from the new Account modal
- stores user profiles, session tokens, and workspace state in SQLite
- saves watchlists, alerts, positions, command history, and panel layout per account
- proxies live public market data for quotes, charts, options, news, and FX through the backend
- renders a four-panel terminal workspace with keyboard routing and command-style navigation
- includes portfolio math, options snapshots, macro monitors, and pricing calculators

## Stack

- `backend/app.py` — Flask server, API routes, SQLite wiring, public-market adapters, static asset serving
- `backend/__init__.py` — backend package export for tests and local imports
- `src/clientApp.js` — active browser controller for auth, panel routing, commands, rendering, and autosave
- `src/api.js` — fetch wrapper for auth, workspace, market, and health endpoints
- `src/data.js` — command catalog, module metadata, defaults, and product copy
- `src/styles.css` — terminal-inspired visual system and cockpit layout
- `index.html` — landing view, auth forms, workspace shell, panel layout, and command surface
- `scripts/smoke_test.py` — structural and behavioral smoke test for the current stack
- `requirements.txt` — Python dependency manifest

## Modules

- `HOME` — market pulse, alerts, watchlist tone, and account summary
- `QUOTE` — live quote snapshot with price, volume, range, and change data
- `CHART` — API-fed line chart for the active symbol and timeframe
- `NEWS` — aggregated headlines from public financial feeds
- `EQS` — screener-style market list for tracked names
- `HEAT` — market map view for relative movers
- `PORT` — saved portfolio positions and P/L math
- `MACRO` — FX and macro monitor view
- `OMON` — options chain snapshot by symbol and expiry
- `CALC` — Black-Scholes and bond pricing tools

## API Surface

- `GET /api/health` — backend availability and server time
- `POST /api/auth/signup` — create a user and seed a default workspace
- `GET /api/auth/availability` — check whether email/username are available
- `POST /api/auth/login` — start an authenticated session
- `POST /api/auth/logout` — clear the current session cookie
- `GET /api/auth/session` — restore the active user and workspace
- `PATCH /api/auth/profile` — update first name, last name, username, and role
- `POST /api/auth/password` — change password with current-password verification
- `DELETE /api/auth/account` — delete account, workspace state, and active sessions
- `GET /api/workspace` — fetch saved workspace state
- `PUT /api/workspace` — persist workspace changes
- `GET /api/market/quotes` — quote batch for comma-separated symbols
- `GET /api/market/chart/<symbol>` — chart series for a symbol
- `GET /api/market/options/<symbol>` — option chain snapshot
- `GET /api/market/news` — normalized financial headlines
- `GET /api/market/fx` — FX rates feed

## Local Run

1. Install Python dependencies:

```bash
python3 -m pip install -r requirements.txt
```

2. Validate the app:

```bash
npm run check
```

3. Start the server:

```bash
npm run start
```

4. Open `http://127.0.0.1:4173`

## Commands

- `HELP`
- `SAVE`
- `NEXT` / `PREV`
- `AAPL Q`
- `MSFT CHART`
- `LOGIN` / `SIGNUP`
- `WATCH PLTR`
- `ALERT NVDA 950`
- `ADDPOS QQQ 3 441`
- `OMON AAPL`
- `MACRO`

## Notes

- Passwords are hashed on the server and sessions are stored with an HTTP-only cookie.
- Market data comes from public upstream sources, so availability depends on those feeds.
- SQLite lives under `data/terminal.db` by default and can be overridden in tests via app config.
