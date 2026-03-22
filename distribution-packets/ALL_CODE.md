# All-In-One Code Packet

Copy-paste-ready full code snapshot generated from the current workspace state.

## Included Files

- `README.md`
- `index.html`
- `package.json`
- `requirements.txt`
- `.env.example`
- `.gitignore`
- `src/styles.css`
- `src/clientApp.js`
- `src/AppBootstrap.js`
- `src/api.js`
- `src/AppCore.js`
- `src/CommandLexer.js`
- `src/Controllers/CommandController.js`
- `src/Controllers/DockingController.js`
- `src/Controllers/WorkspaceController.js`
- `src/data.js`
- `src/LogicEngine.js`
- `src/Registry.js`
- `src/Renderers/ChartRenderer.js`
- `src/Renderers/Common.js`
- `src/Renderers/BriefingRenderer.js`
- `src/Renderers/CalculatorRenderer.js`
- `src/Renderers/HeatmapRenderer.js`
- `src/Renderers/HomeRenderer.js`
- `src/Renderers/MacroRenderer.js`
- `src/Renderers/NewsRenderer.js`
- `src/Renderers/OptionsRenderer.js`
- `src/Renderers/PortfolioRenderer.js`
- `src/Renderers/QuoteRenderer.js`
- `src/Renderers/RulesRenderer.js`
- `src/Renderers/ScreenerRenderer.js`
- `src/StateStore.js`
- `src/services.js`
- `src/marketService.js`
- `src/app.js`
- `src/auth.js`
- `src/storage.js`
- `backend/app.py`
- `backend/__init__.py`
- `scripts/smoke_test.py`

---

## `README.md`

````markdown
# The-Terminal

`The-Terminal` is a Bloomberg-inspired market workspace with a real Flask backend, SQLite persistence, API-backed account sessions, and a multi-panel browser client. It now stores accounts and saved workspaces on the server instead of pretending with browser-only persistence.

## What It Does

- authenticates users through `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, and `/api/auth/session`
- lets signed-in users manage profile, password, and account deletion from the new Account modal
- stores user profiles, session tokens, and workspace state in SQLite
- saves watchlists, alerts, positions, command history, and panel layout per account
- proxies live public market data for quotes, charts, options, news, FX, and secured deep-dive research through the backend
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

## System Architecture (Study Guide)

Meridian 1.0 uses a modular frontend where `AppBootstrap` acts as an orchestration layer and delegates behavior to dedicated controllers and renderers.

- **Unidirectional Data Flow**: user actions dispatch commands, commands mutate state through core/controller paths, and renderers project state to the DOM.
- **Proxy-based State Store**: `StateStore` captures mutations and emits subscription events so UI updates and side effects can react consistently.
- **Component-based Rendering Registry**: each module renderer (Quote, Chart, News, Rules, etc.) is registered once and resolved by module key for panel rendering.
- **Debounced Backend Persistence**: `WorkspaceController` batches workspace writes (`queueSave`) and syncs guest/auth states without blocking interactions.

### The Moat: Logic Engine Parser

The `LogicEngine` is Meridian’s core moat: it parses explicit rule syntax (`IF ... THEN ...`) into structured conditions, evaluates them against live quote state, and emits trigger notifications only on state transitions. This provides custom-scripted financial alerts with deterministic behavior and low runtime overhead, avoiding the bulk and complexity of traditional platform scripting stacks.

## Modules

- `HOME` — market pulse, alerts, watchlist tone, and account summary
- `QUOTE` — live quote snapshot with price, volume, range, action buttons, and deep insight blocks
- `CHART` — API-fed candlestick chart for the active symbol and timeframe
- `NEWS` — high-density headlines with source, time, and sentiment
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
- `GET /api/market/deep-dive/<symbol>` — backend-proxied company profile, financial data, and ticker-specific news
- `GET /api/market/fx` — FX rates feed

## Environment

Copy `.env.example` to `.env` to enable backend-proxied RapidAPI research locally:

```bash
cp .env.example .env
```

Supported variables:

- `RAPIDAPI_KEY` — RapidAPI key for Yahoo Finance deep-dive modules
- `RAPIDAPI_HOST` — defaults to `yahoo-finance15.p.rapidapi.com`
- `TERMINAL_SECRET` — Flask session secret

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
- `ANALYZE NVDA`
- `SYNC NVDA`
- `LOGIN` / `SIGNUP`
- `WATCH PLTR`
- `ALERT NVDA 950`
- `ADDPOS QQQ 3 441`
- `OMON AAPL`
- `MACRO`

## Notes

- Passwords are hashed on the server and sessions are stored with an HTTP-only cookie.
- Market data comes from public upstream sources, so availability depends on those feeds.
- RapidAPI credentials stay on the backend and are read from `.env`, not from frontend code.
- SQLite lives under `data/terminal.db` by default and can be overridden in tests via app config.
````

## `index.html`

````html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Meridian</title>
  <meta
    name="description"
    content="Meridian brings quotes, charts, news, options, and portfolio tracking into one clear market workspace."
  />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="./src/styles.css" />
</head>
<body>
  <main class="terminal-app" id="terminalApp">
    <header class="topbar">
      <div class="brand-block">
        <div class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Meridian">
            <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#bgGlow)"/>
            <path d="M9.8 14.4L20 20.6" stroke="#2fcf84" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M20 20.6L30.2 14.4" stroke="#ff5f7f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M30.2 14.4L33 12.2" stroke="#2fcf84" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="8.1" y="14.2" width="3.4" height="12.4" rx="1" fill="#2fcf84"/>
            <line x1="9.8" y1="11.6" x2="9.8" y2="14.2" stroke="#2fcf84" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="9.8" y1="26.6" x2="9.8" y2="29.2" stroke="#2fcf84" stroke-width="1.5" stroke-linecap="round"/>
            <rect x="18.3" y="19.8" width="3.4" height="9.6" rx="1" fill="#ff5f7f"/>
            <line x1="20" y1="17.1" x2="20" y2="19.8" stroke="#ff5f7f" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="20" y1="29.4" x2="20" y2="32" stroke="#ff5f7f" stroke-width="1.5" stroke-linecap="round"/>
            <rect x="28.5" y="14.2" width="3.4" height="12.4" rx="1" fill="#2fcf84"/>
            <line x1="30.2" y1="11.6" x2="30.2" y2="14.2" stroke="#2fcf84" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="30.2" y1="26.6" x2="30.2" y2="29.2" stroke="#2fcf84" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="33" cy="12.2" r="1.8" fill="#9cb9ff"/>
            <defs>
              <linearGradient id="bgGlow" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                <stop stop-color="#172953"/>
                <stop offset="1" stop-color="#101a3b"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <strong id="appTitle">Meridian</strong>
          <p class="brand-slogan">The Center of the world.</p>
        </div>
      </div>
      <div class="topbar-right">
        <p class="status-chip chip-phase" id="marketPhase">Market</p>
        <p class="status-chip chip-server" id="serverStatus">Server</p>
        <p class="status-chip chip-net" id="networkStatus">Connecting</p>
        <div class="topbar-divider"></div>
        <button class="btn btn-icon" id="refreshAllButton" type="button" title="Refresh live data">
          <svg viewBox="0 0 20 20" fill="none"><path d="M3 10a7 7 0 0 1 12-4.9L17 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17 10a7 7 0 0 1-12 4.9L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><polyline points="14,4 17,7 14,10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><polyline points="6,16 3,13 6,10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn btn-ghost" id="openCommandPalette" type="button">Cmd+K</button>
        <button class="btn btn-ghost" id="autoJumpButton" type="button" title="Auto-scroll to active panel">Auto-jump: On</button>
        <button class="btn btn-ghost" id="resetFocusButton" type="button">Grid</button>
        <button class="btn btn-ghost hidden" id="openSettingsBtn" type="button">Account</button>
        <button class="btn btn-ghost hidden" id="logoutButton" type="button">Sign out</button>
        <button class="btn btn-primary hidden" id="openAuthBtn" type="button">Sync</button>
      </div>
    </header>

    <nav class="function-row hidden" id="functionRow" aria-hidden="true"></nav>

    <section class="overview-strip" id="overviewStrip" aria-label="Live market overview"></section>

    <section class="workspace-shell">
      <aside class="left-rail">
        <section class="rail-card">
          <header class="rail-head">
            <h2>Watchlist</h2>
            <small id="watchCount">0</small>
          </header>
          <div class="rail-body" id="watchlistRail"></div>
        </section>

        <section class="rail-card">
          <header class="rail-head">
            <h2>Alerts</h2>
            <small id="alertCount">0</small>
          </header>
          <div class="rail-body" id="alertRail"></div>
        </section>
      </aside>

      <div class="workspace-main">
        <section class="workspace-grid" id="workspaceGrid">
          <article class="panel is-active" data-panel="1">
            <header class="panel-head">
              <h3 id="panelTitle1">Home</h3>
              <div class="panel-controls">
                <button class="panel-btn" data-panel-focus="1" type="button" title="Focus panel">⤢</button>
                <button class="panel-btn" data-panel-cycle="1:-1" type="button">◀</button>
                <button class="panel-btn" data-panel-cycle="1:1" type="button">▶</button>
              </div>
            </header>
            <div class="panel-content" id="panelContent1"></div>
          </article>

          <article class="panel" data-panel="2">
            <header class="panel-head">
              <h3 id="panelTitle2">Quote</h3>
              <div class="panel-controls">
                <button class="panel-btn" data-panel-focus="2" type="button" title="Focus panel">⤢</button>
                <button class="panel-btn" data-panel-cycle="2:-1" type="button">◀</button>
                <button class="panel-btn" data-panel-cycle="2:1" type="button">▶</button>
              </div>
            </header>
            <div class="panel-content" id="panelContent2"></div>
          </article>

          <article class="panel" data-panel="3">
            <header class="panel-head">
              <h3 id="panelTitle3">Chart</h3>
              <div class="panel-controls">
                <button class="panel-btn" data-panel-focus="3" type="button" title="Focus panel">⤢</button>
                <button class="panel-btn" data-panel-cycle="3:-1" type="button">◀</button>
                <button class="panel-btn" data-panel-cycle="3:1" type="button">▶</button>
              </div>
            </header>
            <div class="panel-content" id="panelContent3"></div>
          </article>

          <article class="panel" data-panel="4">
            <header class="panel-head">
              <h3 id="panelTitle4">News</h3>
              <div class="panel-controls">
                <button class="panel-btn" data-panel-focus="4" type="button" title="Focus panel">⤢</button>
                <button class="panel-btn" data-panel-cycle="4:-1" type="button">◀</button>
                <button class="panel-btn" data-panel-cycle="4:1" type="button">▶</button>
              </div>
            </header>
            <div class="panel-content" id="panelContent4"></div>
          </article>
        </section>

      </div>
    </section>

    <footer class="statusbar">
      <span>Updated: <strong id="lastUpdated">—</strong></span>
      <span>Refresh: <strong id="refreshCountdown">30s</strong></span>
      <span>Session: <strong id="sessionClock">00:00:00</strong></span>
    </footer>
  </main>

  <div class="modal-backdrop hidden" id="authModalBackdrop">
    <section class="auth-modal" id="authModal">
      <header class="auth-head">
        <h2>Provision workspace</h2>
        <button class="icon-btn" id="closeAuthModal" type="button">×</button>
      </header>

      <p class="auth-status error-message-container active" id="authStatus">Provision only if you want backend sync.</p>

      <div class="auth-tabs" id="authTabs">
        <button class="auth-tab is-active" data-auth-tab="login" type="button">Access</button>
        <button class="auth-tab" data-auth-tab="signup" type="button">Provision</button>
      </div>

      <form id="loginForm" data-auth-panel="login" class="auth-form">
        <label>
          Email or username
          <input name="identifier" type="text" required />
        </label>
        <label>
          Password
          <input name="password" type="password" required />
        </label>
        <button class="btn btn-primary" id="loginBtn" type="submit">Access workspace</button>
        <button class="btn btn-ghost" id="continueLocalBtn" type="button">Continue local mode</button>
      </form>

      <form id="signupForm" data-auth-panel="signup" class="auth-form hidden">
        <div class="auth-grid">
          <label>
            First name
            <input name="firstName" type="text" required />
          </label>
          <label>
            Last name
            <input name="lastName" type="text" required />
          </label>
        </div>
        <label>
          Email
          <input id="signupEmail" name="email" type="email" required />
        </label>
        <label>
          Username
          <input id="signupUsername" name="username" type="text" required />
        </label>
        <p class="auth-hint error-message-container active" id="signupAvailability">Use a unique email and username.</p>
        <label>
          Role
          <select id="signupRole" name="role"></select>
        </label>
        <label>
          Password
          <input name="password" type="password" minlength="8" required />
        </label>
        <label>
          Confirm password
          <input name="confirmPassword" type="password" minlength="8" required />
        </label>
        <button class="btn btn-primary" id="signupBtn" type="submit">Provision user</button>
        <button class="btn btn-ghost" id="continueLocalSignupBtn" type="button">Continue local mode</button>
      </form>
    </section>
  </div>

  <div class="palette-backdrop hidden" id="paletteBackdrop">
    <section class="command-shell command-palette" id="commandPalette" aria-label="Command palette">
      <span class="cmd-prefix">CMD</span>
      <input
        id="commandInput"
        class="command-input terminal-input"
        type="text"
        autocomplete="off"
        spellcheck="false"
        placeholder="Try: CHART TSLA, BRIEF, OPTIONS NVDA"
      />
      <button id="runCommandButton" class="btn btn-primary" type="button">Run</button>
      <div class="autocomplete hidden" id="autocomplete"></div>
    </section>
  </div>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>

  <div class="modal-backdrop hidden" id="settingsModalBackdrop">
    <section class="auth-modal settings-modal" id="settingsModal">
      <header class="auth-head">
        <h2>Account settings</h2>
        <button class="icon-btn" id="closeSettingsModal" type="button">×</button>
      </header>

      <p class="auth-status error-message-container active" id="settingsStatus">Update your account details securely.</p>

      <form id="updateProfileForm" class="auth-form">
        <div class="auth-grid">
          <label>
            First name
            <input name="firstName" type="text" required />
          </label>
          <label>
            Last name
            <input name="lastName" type="text" required />
          </label>
        </div>
        <label>
          Username
          <input name="username" type="text" required />
        </label>
        <label>
          Role
          <select id="settingsRole" name="role"></select>
        </label>
        <button class="btn btn-primary" id="updateProfileBtn" type="submit">Update profile</button>
      </form>

      <form id="changePasswordForm" class="auth-form">
        <label>
          Current password
          <input name="currentPassword" type="password" required />
        </label>
        <label>
          New password
          <input name="newPassword" type="password" minlength="8" required />
        </label>
        <button class="btn btn-primary" id="changePasswordBtn" type="submit">Change password</button>
      </form>

      <form id="deleteAccountForm" class="auth-form">
        <label>
          Confirm password to delete account
          <input name="password" type="password" required />
        </label>
        <button class="btn btn-danger" id="deleteAccountBtn" type="submit">Delete account</button>
      </form>
    </section>
  </div>

  <script type="module" src="./src/clientApp.js"></script>
</body>
</html>
````

## `package.json`

````json
{
  "name": "the-terminal",
  "private": true,
  "version": "0.1.0",
  "description": "Market workspace with a Flask backend, SQLite persistence, and a browser terminal client",
  "scripts": {
    "start": "sh -c 'if [ -x ./.venv/bin/python ]; then ./.venv/bin/python backend/app.py; else python3 backend/app.py; fi'",
    "check": "sh -c 'if [ -x ./.venv/bin/python ]; then ./.venv/bin/python scripts/smoke_test.py; else python3 scripts/smoke_test.py; fi'"
  },
  "dependencies": {
    "lightweight-charts": "^5.1.0"
  }
}
````

## `requirements.txt`

````text
flask>=3.1,<4.0
````

## `.env.example`

````text
# Copy this file to `.env` for local development.
RAPIDAPI_KEY=your_rapidapi_key_here
RAPIDAPI_HOST=yahoo-finance15.p.rapidapi.com
TERMINAL_SECRET=replace_this_for_local_use
````

## `.gitignore`

````text
.env
.venv/
node_modules/
__pycache__/
*.pyc
data/*.db
````

## `src/styles.css`

````css
:root {
  color-scheme: dark;
  --bg: #0b1020;
  --bg-soft: #111831;
  --surface: #161f3d;
  --border: #2a355e;
  --text: #e8eeff;
  --muted: #98a6cf;
  --accent: #6f8fff;
  --success: #2fcf84;
  --danger: #ff5f7f;
  --warning: #f6b34b;
  --radius: 12px;
  --mono: "IBM Plex Mono", monospace;
  --sans: "Inter", system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--sans);
  background: radial-gradient(circle at 18% -12%, #1a2a57 0%, #0f1733 42%, var(--bg) 72%);
  color: var(--text);
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

html {
  scroll-behavior: smooth;
}

.hidden {
  display: none !important;
}

.positive {
  color: var(--success);
}

.negative {
  color: var(--danger);
}

.app-ambient,
.ticker-bar,
.topbar__meta,
.topbar__guest,
.topbar__user,
.shell-toolbar,
.context-ribbon,
.mobile-dock,
.briefing-drawer,
.rail-drawer,
.briefingDrawerBackdrop,
.railDrawerBackdrop {
  display: none !important;
}

.terminal-app,
.app-shell {
  min-height: 100vh;
  max-width: 1580px;
  margin: 0 auto;
  display: grid;
  grid-template-rows: auto auto 1fr auto auto;
  gap: 16px;
  padding: 18px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: linear-gradient(180deg, rgba(20, 30, 60, 0.94) 0%, rgba(14, 21, 46, 0.95) 100%);
  border: 1px solid rgba(67, 90, 162, 0.42);
  border-radius: 14px;
  padding: 14px 16px;
}

.brand-block,
.topbar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--accent);
  display: grid;
  place-items: center;
  font-weight: 800;
}

.brand-block strong,
.topbar__brand strong {
  display: block;
  font-size: 1.08rem;
  letter-spacing: 0.01em;
}

.brand-block p,
.topbar__brand span {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
}

.brand-slogan {
  letter-spacing: 0.02em;
  color: #b9c7ee !important;
  font-size: 0.8rem !important;
}

.topbar-right,
.topbar__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-chip {
  margin: 0;
  padding: 6px 11px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(17, 24, 49, 0.9);
  color: var(--muted);
  font-size: 0.78rem;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  white-space: nowrap;
}

.status-chip::before {
  content: "";
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
  flex-shrink: 0;
}

.chip-phase::before { background: var(--warning); }
.chip-server::before { background: var(--success); animation: dot-pulse 2.4s ease-in-out infinite; }
.chip-net::before { background: var(--accent); }

@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.btn {
  border: 1px solid var(--border);
  background: #1c2850;
  color: var(--text);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
}

.btn:hover {
  border-color: #4b63a7;
}

.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.btn-ghost {
  background: transparent;
  color: var(--muted);
}

.btn-danger {
  background: rgba(127, 40, 62, 0.45);
  border-color: rgba(255, 95, 127, 0.62);
  color: #ffd8e1;
}

.btn-danger:hover {
  border-color: rgba(255, 125, 150, 0.9);
  background: rgba(142, 39, 66, 0.62);
}

.btn-ghost.is-active {
  color: #fff;
  border-color: rgba(115, 149, 255, 0.7);
  background: rgba(48, 69, 135, 0.35);
}

.function-row {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 8px;
  position: sticky;
  top: 8px;
  z-index: 12;
  padding: 8px;
  border: 1px solid rgba(58, 78, 138, 0.34);
  border-radius: 14px;
  background: rgba(13, 20, 40, 0.78);
  backdrop-filter: blur(8px);
}

.function-key {
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: var(--muted);
  border-radius: 10px;
  padding: 10px;
  text-align: left;
  display: grid;
  gap: 3px;
}

.function-key span {
  font-family: var(--mono);
  font-size: 0.65rem;
}

.function-key strong {
  font-size: 0.78rem;
}

.function-key.is-active {
  border-color: rgba(105, 140, 240, 0.8);
  color: #fff;
  background: linear-gradient(160deg, #1e3470 0%, #1a2b5e 100%);
  box-shadow: 0 0 0 1px rgba(105, 140, 240, 0.25);
}

.workspace-shell {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  min-height: 0;
}

.left-rail {
  display: grid;
  gap: 12px;
}

.rail-card {
  border: 1px solid rgba(63, 84, 148, 0.44);
  border-radius: 14px;
  background: var(--bg-soft);
  overflow: hidden;
}

.rail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.rail-head h2 {
  margin: 0;
  font-size: 0.85rem;
}

.rail-head small {
  color: var(--muted);
  font-family: var(--mono);
}

.rail-body {
  padding: 8px;
  display: grid;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}

.rail-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
}

.rail-item {
  border: 1px solid rgba(70, 94, 164, 0.35);
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-align: left;
}

.rail-item small {
  display: block;
  color: var(--muted);
  font-size: 0.72rem;
}

.rail-remove {
  width: 28px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
}

.alert-row {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
}

.alert-row.is-triggered {
  border-color: #3e9f75;
}

.workspace-main {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 10px;
  min-height: 0;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 12px;
}

.panel {
  border: 1px solid rgba(67, 90, 160, 0.42);
  border-radius: 14px;
  background: var(--bg-soft);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 0;
}

.panel.is-active {
  border-color: #6a85d9;
}

.panel-head,
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(67, 88, 150, 0.46);
  background: rgba(10, 15, 34, 0.45);
  backdrop-filter: blur(4px);
}

.panel-head h3,
.panel-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.015em;
}

.panel-controls {
  display: flex;
  gap: 6px;
}

.panel-btn {
  border: 1px solid rgba(42, 53, 94, 0.7);
  border-radius: 6px;
  background: rgba(20, 30, 62, 0.6);
  color: var(--muted);
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  cursor: pointer;
  transition: border-color .16s, color .16s, background .16s;
}

.panel-btn:hover {
  border-color: rgba(110, 140, 240, 0.7);
  color: var(--text);
  background: rgba(40, 56, 110, 0.7);
}

.panel-content {
  padding: 14px;
  overflow: auto;
}

.command-shell {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  border: 1px solid rgba(91, 115, 191, 0.44);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(16, 24, 52, 0.96) 0%, rgba(12, 18, 40, 0.97) 100%);
  padding: 12px 14px;
  position: relative;
  transition: border-color .18s, box-shadow .18s;
}

.command-shell:focus-within {
  border-color: rgba(79, 124, 255, 0.65);
  box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.1);
}

.cmd-prefix {
  font-family: var(--mono);
  color: var(--muted);
  font-size: 0.78rem;
}

.command-input {
  border: 1px solid rgba(86, 108, 176, 0.42);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  padding: 9px 12px;
  font-family: var(--mono);
  font-size: 0.84rem;
  outline: none;
  transition: border-color .16s;
}

.command-input:focus {
  border-color: rgba(79, 124, 255, 0.5);
}

.autocomplete {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(100% + 8px);
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 6px;
  display: grid;
  gap: 4px;
}

.autocomplete-item {
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.autocomplete-item:hover {
  border-color: var(--border);
}

.statusbar,
.status-bar {
  border: 1px solid rgba(61, 83, 146, 0.42);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(17, 25, 52, 0.95) 0%, rgba(13, 20, 43, 0.95) 100%);
  padding: 10px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--muted);
  font-size: 0.78rem;
}

.statusbar strong,
.status-bar strong {
  color: var(--text);
}

.stack {
  display: grid;
  gap: 10px;
}

.card {
  border: 1px solid rgba(65, 87, 150, 0.4);
  border-radius: 14px;
  background: var(--surface);
  padding: 13px;
}

.card-head {
  margin-bottom: 10px;
}

.card-head h4 {
  margin: 0;
  font-size: 0.94rem;
  letter-spacing: 0.01em;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.stat-card span,
.stat-card small {
  color: var(--muted);
  font-size: 0.75rem;
}

.stat-card strong {
  display: block;
  margin: 6px 0;
  font-size: 1.2rem;
  font-family: var(--mono);
  letter-spacing: -0.02em;
}

.chip-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.chip {
  border: 1px solid rgba(42, 53, 94, 0.8);
  border-radius: 10px;
  background: linear-gradient(160deg, rgba(24, 36, 74, 0.98), rgba(17, 25, 56, 0.98));
  color: var(--text);
  padding: 10px 12px;
  text-align: left;
  display: grid;
  gap: 3px;
  cursor: pointer;
}

.quote-card h4 {
  margin: 0 0 8px;
}

.quote-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.quote-row strong {
  font-size: 1.3rem;
}

.quote-card p {
  margin: 0;
  color: var(--muted);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chart-card {
  min-height: 260px;
  padding: 16px;
}

.line-chart {
  width: 100%;
  height: 260px;
  display: block;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 9px 8px;
  border-bottom: 1px solid rgba(68, 88, 150, 0.34);
  text-align: left;
  font-size: 0.8rem;
}

.data-table tbody tr:hover {
  background: rgba(31, 44, 88, 0.28);
}

.data-table th {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.68rem;
  text-transform: uppercase;
}

.table-link {
  border: none;
  background: transparent;
  color: #8eb0ff;
  cursor: pointer;
  font-weight: 600;
}

.news-card small {
  color: var(--muted);
}

.news-card p {
  margin: 8px 0;
}

.news-card a {
  color: #8eb0ff;
}

.screener-filters,
.add-pos-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.screener-filters input,
.screener-filters select,
.add-pos-form input,
.calc-input input,
.auth-form input,
.auth-form select {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #1a254b;
  color: var(--text);
  padding: 8px 10px;
  width: 100%;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.tile {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #1a254b;
  color: var(--text);
  padding: 8px;
  display: grid;
  gap: 2px;
  text-align: center;
}

.tile.positive {
  border-color: #2a7458;
}

.tile.negative {
  border-color: #7f3d4f;
}

.curve-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  align-items: end;
  gap: 8px;
}

.curve-col {
  display: grid;
  gap: 4px;
  text-align: center;
}

.curve-bar {
  width: 100%;
  background: #4f7cff;
  border-radius: 4px 4px 0 0;
}

.curve-col strong {
  font-size: 0.72rem;
}

.curve-col small {
  color: var(--muted);
  font-size: 0.7rem;
}

.fx-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.fx-card {
  display: grid;
  gap: 4px;
}

.fx-card span {
  color: var(--muted);
  font-size: 0.75rem;
}

.split-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.calc-grid {
  display: grid;
  gap: 8px;
  margin-bottom: 8px;
}

.calc-input {
  display: grid;
  gap: 4px;
}

.calc-input span {
  color: var(--muted);
  font-size: 0.75rem;
}

.calc-results {
  display: grid;
  gap: 6px;
  font-size: 0.82rem;
}

.empty-state,
.empty-inline {
  color: var(--muted);
  text-align: center;
  padding: 20px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(5, 7, 14, 0.72);
  display: grid;
  place-items: center;
  padding: 16px;
}

.auth-modal {
  width: min(560px, 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-soft);
  padding: 16px;
  display: grid;
  gap: 12px;
}

.auth-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.auth-head h2 {
  margin: 0;
  font-size: 1rem;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.auth-status {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.auth-status[data-tone="error"] {
  color: var(--danger);
}

.auth-status[data-tone="neutral"] {
  color: var(--muted);
}

.auth-status[data-tone="success"] {
  color: var(--success);
}

.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.auth-tab {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  padding: 8px;
}

.auth-tab.is-active {
  background: #253a73;
  border-color: #5876d2;
  color: #fff;
}

.auth-form {
  display: grid;
  gap: 10px;
}

.auth-form label {
  display: grid;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--muted);
}

.auth-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.auth-hint[data-tone="error"] {
  color: var(--danger);
}

.auth-hint[data-tone="success"] {
  color: var(--success);
}

.auth-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.settings-modal {
  width: min(620px, 100%);
  max-height: min(88vh, 760px);
  overflow: auto;
}

.settings-modal .auth-form + .auth-form {
  border-top: 1px solid rgba(79, 100, 165, 0.4);
  padding-top: 12px;
}

.toast {
  position: fixed;
  right: 16px;
  bottom: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  padding: 10px 12px;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity .2s ease, transform .2s ease;
}

.toast.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.toast[data-tone="success"] {
  border-color: #2a7458;
  color: var(--success);
}

.toast[data-tone="error"] {
  border-color: #7f3d4f;
  color: var(--danger);
}

@media (max-width: 1200px) {
  .function-row {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .workspace-shell {
    grid-template-columns: 1fr;
  }

  .left-rail {
    grid-template-columns: 1fr 1fr;
    display: grid;
  }
}

@media (max-width: 900px) {
  .workspace-grid,
  .split-grid,
  .heatmap-grid,
  .card-grid,
  .chip-grid,
  .tile-grid,
  .curve-grid,
  .fx-grid,
  .auth-grid,
  .screener-filters,
  .add-pos-form {
    grid-template-columns: 1fr;
  }

  .command-shell {
    grid-template-columns: 1fr;
  }

  .cmd-prefix {
    display: none;
  }
}

/* Requested hard layout constraints */
.workspace-shell {
  display: flex !important;
  flex-wrap: nowrap !important;
  align-items: stretch;
  gap: 8px !important;
  overflow-x: auto !important;
  overflow-y: hidden;
}

.left-rail {
  width: 280px !important;
  min-width: 280px !important;
  max-width: 280px !important;
  flex: 0 0 280px !important;
  flex-shrink: 0 !important;
}

.workspace-main {
  flex: 1 1 auto !important;
  min-width: 800px !important;
  width: auto !important;
}

.workspace-grid,
.panel,
.panel-content,
.card,
.data-table,
.financial-data-table {
  min-width: 0;
}

.panel-head h3,
.status-chip,
.overview-card,
.table-link,
.data-table th,
.data-table td,
.financial-data-table th,
.financial-data-table td {
  white-space: nowrap;
}

/* Terminal input policy */
.terminal-input {
  background: var(--bg-panel) !important;
  border: 1px solid var(--border-divider) !important;
  color: var(--text-primary) !important;
  height: 28px !important;
  padding: 0 8px !important;
  outline: none;
  transition: border-color 0.15s ease;
}

.terminal-input:focus {
  border-color: #4a90e2 !important;
}

/* Reserve error text space and avoid layout shift */
.error-message-container {
  height: 16px !important;
  color: var(--data-down) !important;
  font-size: 11px !important;
  visibility: hidden;
  margin: 0;
}

.error-message-container.active {
  visibility: visible;
}

/* Fullscreen command palette overlay */
.palette-backdrop {
  position: fixed !important;
  inset: 0 !important;
  background: rgba(0, 0, 0, 0.6) !important;
  backdrop-filter: blur(2px) !important;
  display: flex !important;
  justify-content: center !important;
  align-items: flex-start !important;
  padding-top: 20vh !important;
  z-index: 200 !important;
}

.palette-backdrop.hidden {
  display: none !important;
}

.command-palette {
  width: 600px !important;
  max-width: calc(100vw - 24px);
  position: relative;
  border: 1px solid var(--border-divider) !important;
  background: var(--bg-panel) !important;
  padding: 0 !important;
  display: block !important;
}

.command-palette .cmd-prefix,
.command-palette #runCommandButton {
  display: none !important;
}

.command-palette .command-input {
  display: block;
  width: 100% !important;
  height: 52px !important;
  padding: 0 12px !important;
  font-size: 18px !important;
  border: none !important;
  border-bottom: 1px solid var(--border-divider) !important;
  background: var(--bg-panel) !important;
}

.command-palette .autocomplete {
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  top: 52px !important;
  border-top: none !important;
  background: var(--bg-panel) !important;
}

/* Candlestick chart surface */
.chart-canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 220px;
}

.chart-canvas {
  width: 100%;
  height: 100%;
  min-height: 220px;
}

.chart-loading {
  position: absolute;
  inset: 8px;
  pointer-events: none;
  border-radius: 10px;
  background: rgba(15, 22, 43, 0.82);
  border: 1px solid var(--border-divider);
  padding: 10px;
}

.chart-loading .empty-state,
.chart-loading .empty-inline {
  padding: 8px;
}

.line-chart {
  display: none !important;
}

/* Custom Scrollbar for Webkit */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: var(--bg-app);
}

::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.auth-form input[type="file"] {
  border: 1px dashed var(--border-divider) !important;
  padding: 20px !important;
  background: var(--bg-app) !important;
  cursor: pointer;
  text-align: center;
  height: auto !important;
}

.auth-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px !important;
}

.auth-form label {
  font-family: var(--mono) !important;
  font-size: 11px !important;
  text-transform: uppercase;
  color: var(--text-muted) !important;
  margin-bottom: 4px;
}

.quote-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.deep-dive-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.insight-block {
  border: 1px solid var(--border-divider);
  background: var(--bg-panel);
  padding: 6px;
  display: grid;
  gap: 2px;
}

.insight-block span {
  color: var(--text-muted);
  font-size: 10px;
  text-transform: uppercase;
}

.insight-summary {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.news-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--border-divider);
}

.news-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 10px;
  color: var(--data-up);
  text-transform: uppercase;
  margin-bottom: 2px;
  font-family: var(--mono);
}

.news-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.news-title {
  color: var(--text-primary);
  text-decoration: none;
  font-size: 13px;
  line-height: 1.4;
}

.news-title.news-title-positive {
  color: var(--data-up) !important;
}

.news-title.news-title-negative {
  color: var(--data-down) !important;
}

.news-title:hover {
  text-decoration: underline;
  color: #fff;
}

.news-sentiment.neutral {
  color: var(--text-muted);
}

.news-sentiment.negative {
  color: var(--data-down);
}

.news-sentiment.positive {
  color: var(--data-up);
}

@media (max-width: 900px) {
  .deep-dive-grid {
    grid-template-columns: 1fr;
  }

  .news-row,
  .quote-action-row {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: linear-gradient(145deg, #0e1930 0%, #172040 100%);
  border: 1px solid rgba(79, 124, 255, 0.35);
  color: #f6f8ff;
  box-shadow: 0 0 0 1px rgba(79, 124, 255, 0.18), 0 14px 28px rgba(5, 12, 40, 0.55);
}

.brand-mark svg {
  width: 36px;
  height: 36px;
}

.topbar {
  box-shadow: 0 16px 40px rgba(5, 10, 27, 0.28);
}

.topbar-right {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.status-chip {
  backdrop-filter: blur(8px);
}

.status-chip-secondary {
  background: rgba(29, 41, 79, 0.85);
}

.chip-server-offline::before { background: var(--danger) !important; animation: none !important; }

.topbar-divider {
  width: 1px;
  height: 22px;
  background: var(--border);
  border-radius: 1px;
}

.btn-icon {
  width: 36px;
  height: 36px;
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 10px;
  flex-shrink: 0;
}

.btn-icon svg {
  width: 17px;
  height: 17px;
  stroke: var(--muted);
}

.btn-icon:hover svg {
  stroke: var(--text);
}

.overview-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.overview-card {
  border: 1px solid rgba(60, 82, 140, 0.45);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(22, 32, 66, 0.96) 0%, rgba(14, 20, 44, 0.98) 100%);
  color: var(--text);
  padding: 10px 12px;
  display: grid;
  gap: 3px;
  text-align: left;
  box-shadow: 0 6px 18px rgba(5, 10, 27, 0.28);
  cursor: pointer;
  transition: border-color .17s ease, box-shadow .17s ease;
  border-left: 2px solid transparent;
}

.overview-card:hover {
  border-color: rgba(110, 142, 255, 0.7);
  border-left-color: var(--accent);
  box-shadow: 0 14px 28px rgba(8, 16, 44, 0.4);
}

.overview-card span {
  color: var(--muted);
  font-size: 0.7rem;
  font-family: var(--mono);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.overview-card small {
  color: var(--muted);
  font-size: 0.72rem;
}

.overview-card strong {
  font-size: 0.98rem;
  font-family: var(--mono);
  letter-spacing: -0.01em;
}

.overview-card-summary {
  border-style: dashed;
  background: linear-gradient(180deg, rgba(20, 32, 68, 0.94), rgba(14, 21, 45, 0.96));
}

.overview-card.is-placeholder {
  opacity: 0.8;
}

.workspace-grid {
  transition: grid-template-columns .35s ease, grid-template-rows .35s ease, gap .35s ease;
}

.workspace-grid.is-focused {
  grid-template-columns: 1.35fr 0.65fr;
  grid-template-rows: 1.15fr 0.85fr;
}

.workspace-grid.is-focused .panel {
  opacity: 0.68;
}

.workspace-grid.is-focused .panel.is-focused {
  opacity: 1;
  box-shadow: 0 24px 48px rgba(7, 14, 38, 0.38);
}

.panel {
  transition: box-shadow .24s ease, border-color .22s ease, opacity .22s ease;
  box-shadow: 0 8px 24px rgba(5, 10, 30, 0.32);
  background: linear-gradient(180deg, rgba(18, 26, 52, 0.98) 0%, rgba(13, 19, 40, 1) 100%);
}

.panel:hover {
  border-color: rgba(100, 130, 220, 0.65);
  box-shadow: 0 12px 32px rgba(8, 16, 44, 0.38);
}

.panel.is-active {
  border-color: rgba(110, 144, 255, 0.72);
  box-shadow: 0 18px 40px rgba(14, 26, 72, 0.38);
}

.panel-content {
  scrollbar-width: thin;
  scrollbar-color: #42558f transparent;
}

.panel-btn,
.rail-remove,
.btn,
.function-key,
.chip,
.tile,
.overview-card,
.action-tile,
.list-row,
.range-pill,
.mini-link {
  transition: border-color .18s ease, background .18s ease, color .18s ease, box-shadow .18s ease;
}

.panel-btn:hover,
.rail-remove:hover,
.btn:hover,
.function-key:hover,
.chip:hover,
.tile:hover,
.action-tile:hover,
.list-row:hover,
.range-pill:hover,
.mini-link:hover {
  filter: brightness(1.04);
}

.function-key {
  min-height: 62px;
}

.function-key:hover,
.function-key.is-active {
  box-shadow: 0 12px 20px rgba(21, 36, 82, 0.24);
}

.glow-card,
.card-feature {
  background: linear-gradient(160deg, rgba(28, 40, 80, 0.97) 0%, rgba(17, 25, 54, 0.98) 100%);
  border-color: rgba(72, 98, 172, 0.55);
  box-shadow: 0 8px 22px rgba(5, 10, 32, 0.3);
}

.quote-card-feature,
.chart-card-feature,
.news-card-feature {
  background: linear-gradient(160deg, rgba(22, 33, 68, 0.98) 0%, rgba(14, 20, 46, 0.99) 100%);
  border-color: rgba(64, 90, 162, 0.5);
}

.stack-lg {
  gap: 14px;
}

.card-head-split,
.news-meta-row,
.news-actions,
.quote-hero,
.toolbar-wrap,
.row-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.card-grid-home {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.chart-summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.quote-hero {
  align-items: flex-start;
}

.quote-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-width: min(280px, 100%);
}

.quote-meta-grid div {
  border: 1px solid rgba(95, 120, 196, 0.28);
  border-radius: 10px;
  background: rgba(15, 22, 48, 0.52);
  padding: 10px;
  display: grid;
  gap: 4px;
}

.quote-meta-grid span,
.eyebrow,
.pulse-card span,
.action-tile span,
.list-row small,
.mini-link,
.news-meta-row small,
.compact-list small {
  color: var(--muted);
}

.eyebrow {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 0.72rem;
  font-family: var(--mono);
}

.action-grid,
.pulse-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.action-tile,
.pulse-card,
.list-row {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(18, 27, 57, 0.86);
  color: var(--text);
  padding: 12px;
  text-align: left;
  display: grid;
  gap: 5px;
}

.pulse-card.is-live {
  border-color: rgba(81, 168, 121, 0.62);
  box-shadow: 0 0 0 1px rgba(47, 207, 132, 0.18) inset;
}

.action-tile:hover,
.list-row:hover,
.chip:hover,
.tile:hover {
  border-color: rgba(121, 151, 242, 0.72);
  box-shadow: 0 14px 24px rgba(10, 18, 44, 0.24);
}

.compact-list {
  gap: 8px;
}

.list-row {
  width: 100%;
}

.range-pill {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(23, 34, 69, 0.92);
  color: var(--muted);
  padding: 7px 11px;
  font-weight: 600;
}

.range-pill.is-active {
  color: #fff;
  border-color: #6d8cff;
  background: rgba(72, 102, 203, 0.32);
}

.btn-inline,
.mini-link {
  padding: 6px 10px;
  font-size: 0.75rem;
}

.mini-link {
  border: 1px solid rgba(98, 123, 194, 0.28);
  border-radius: 999px;
  background: rgba(19, 29, 60, 0.72);
}

.compact-chip-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.briefing-hero {
  border: 1px solid rgba(105, 187, 255, 0.28);
  background:
    radial-gradient(120% 120% at 0% 0%, rgba(87, 168, 255, 0.16), transparent 48%),
    radial-gradient(120% 120% at 100% 100%, rgba(77, 255, 176, 0.12), transparent 52%),
    linear-gradient(180deg, rgba(18, 24, 43, 0.92), rgba(13, 18, 33, 0.96));
}

.briefing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.brief-metric {
  display: grid;
  gap: 4px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(7, 11, 22, 0.54);
}

.brief-metric span {
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.brief-metric strong {
  font-size: 1rem;
}

.brief-metric small {
  font-size: 0.72rem;
  color: var(--muted);
}

.split-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

.compact-list .list-row {
  min-height: 2.6rem;
  border-radius: 11px;
}

.chip-peer {
  min-height: 82px;
}

.chip-peer {
  justify-items: start;
  gap: 4px;
}

.chip-peer span {
  font-size: 0.84rem;
  color: var(--text);
}

.chip-peer small {
  font-size: 0.72rem;
}

.news-actions a {
  color: #97b4ff;
  text-decoration: none;
}

.news-actions a:hover {
  text-decoration: underline;
}

.screener-filters,
.add-pos-form {
  align-items: center;
}

.row-actions {
  justify-content: flex-end;
}

.calc-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.overview-strip,
.action-grid,
.pulse-grid,
.compact-chip-grid,
.quote-meta-grid,
.card-grid-home,
.chart-summary-grid {
  min-width: 0;
}

@media (max-width: 1200px) {
  .overview-strip,
  .action-grid,
  .pulse-grid,
  .compact-chip-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .card-grid-home,
  .chart-summary-grid,
  .quote-meta-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 900px) {
  .topbar {
    align-items: flex-start;
  }

  .topbar,
  .topbar-right,
  .quote-hero,
  .card-head-split,
  .news-meta-row,
  .news-actions,
  .row-actions,
  .toolbar-wrap {
    flex-direction: column;
    align-items: stretch;
  }

  .overview-strip,
  .action-grid,
  .pulse-grid,
  .compact-chip-grid,
  .quote-meta-grid,
  .calc-grid,
  .card-grid-home,
  .chart-summary-grid {
    grid-template-columns: 1fr;
  }

  .workspace-grid.is-focused {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
}

/* Terminal Density Override System */
:root {
  --bg-app: #0a0a0a;
  --bg-panel: #141414;
  --bg-hover: #1e1e1e;
  --border-divider: #262626;
  --text-primary: #e5e5e5;
  --text-muted: #a3a3a3;
  --data-up: #00e676;
  --data-down: #ff3b30;
  --data-up-bg: rgba(0, 230, 118, 0.1);

  --bg: var(--bg-app);
  --bg-soft: var(--bg-panel);
  --surface: var(--bg-panel);
  --border: var(--border-divider);
  --text: var(--text-primary);
  --muted: var(--text-muted);
  --success: var(--data-up);
  --danger: var(--data-down);
  --warning: var(--text-muted);
  --accent: var(--text-primary);
  --radius: 2px;
}

* {
  border-radius: 2px !important;
  box-shadow: none !important;
}

body,
.terminal-app,
.topbar,
.statusbar,
.status-bar,
.workspace-shell,
.workspace-main,
.workspace-grid,
.panel,
.panel-head,
.command-shell,
.card,
.rail-card,
.overview-card,
.function-key,
.chip,
.tile,
.action-tile,
.list-row,
.range-pill,
.auth-modal,
.toast,
.modal-backdrop,
.palette-backdrop {
  background-image: none !important;
}

html,
body {
  background: var(--bg-app) !important;
  color: var(--text-primary) !important;
}

.function-row {
  display: none !important;
}

.terminal-app,
.app-shell {
  gap: 8px !important;
  padding: 8px !important;
}

.topbar {
  border: 1px solid var(--border-divider) !important;
  background: var(--bg-panel) !important;
  padding: 6px 8px !important;
}

.brand-mark {
  border: 1px solid var(--border-divider) !important;
  background: var(--bg-panel) !important;
}

.brand-slogan,
.status-chip,
.rail-head small,
.auth-status,
.auth-hint,
.overview-card span,
.overview-card small,
.stat-card span,
.stat-card small,
.news-card small,
.news-meta-row small,
.list-row small,
.mini-link,
.quote-card p {
  color: var(--text-muted) !important;
}

.status-chip,
.btn,
.panel-btn,
.rail-remove,
.icon-btn,
.range-pill,
.mini-link,
.overview-card,
.panel,
.panel-head,
.panel-header,
.card,
.rail-card,
.alert-row,
.chip,
.tile,
.action-tile,
.list-row,
.auth-modal,
.auth-tab,
.autocomplete,
.autocomplete-item,
.command-input,
.toast,
.statusbar,
.status-bar,
.data-table,
.financial-data-table,
.skeleton-box {
  border-color: var(--border-divider) !important;
}

.btn,
.panel-btn,
.rail-remove,
.icon-btn,
.range-pill,
.mini-link,
.table-link,
.auth-tab,
.autocomplete-item,
.command-input,
select,
input {
  background: var(--bg-panel) !important;
  color: var(--text-primary) !important;
  padding: 4px 8px !important;
}

.btn-ghost {
  color: var(--text-muted) !important;
}

.btn-primary,
.range-pill.is-active,
.auth-tab.is-active {
  background: var(--bg-hover) !important;
  color: var(--text-primary) !important;
}

.btn:hover,
.panel-btn:hover,
.rail-remove:hover,
.icon-btn:hover,
.range-pill:hover,
.mini-link:hover,
.chip:hover,
.tile:hover,
.action-tile:hover,
.list-row:hover,
.overview-card:hover,
.auth-tab:hover,
.autocomplete-item:hover {
  background: var(--bg-hover) !important;
}

.workspace-shell {
  grid-template-columns: 240px 1fr !important;
  gap: 8px !important;
}

.workspace-grid {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 6px !important;
  align-content: flex-start;
}

.panel {
  flex: 1 1 calc(50% - 6px);
  min-width: 340px;
  min-height: 240px;
  resize: both;
  overflow: hidden;
}

.workspace-grid.is-focused .panel {
  opacity: 0.78;
}

.workspace-grid.is-focused .panel.is-focused {
  opacity: 1;
  flex-basis: 100%;
}

.overview-strip {
  gap: 4px !important;
}

.overview-card {
  padding: 4px 6px !important;
  border: 1px solid var(--border-divider) !important;
}

.rail-body,
.panel-content,
.card,
.chart-card,
.auth-modal,
.command-shell,
.statusbar,
.status-bar {
  padding: 4px !important;
}

.table-cell {
  padding: 4px 8px !important;
  font-size: 13px !important;
}

.data-table,
.data-table-dense,
.financial-data-table {
  border-collapse: collapse;
  width: 100%;
  border: 1px solid var(--border-divider) !important;
  font-family: "Inter", sans-serif;
.data-table td,
.financial-data-table td,
.price-value,
.quote-price,
.quote-change,
.overview-price,
.overview-change,
.watch-price,
.watch-change,
.position-price,
.position-change,
.metric-value,
[data-price-current] {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.flash-up,
.flash-down {
  will-change: background-color, color, box-shadow;
}

.flash-up {
  animation: flash-green 720ms ease-out;
}

.flash-down {
  animation: flash-red 720ms ease-out;
}

@keyframes flash-green {
  0% {
    color: #d9fbe9;
    background-color: rgba(47, 207, 132, 0.34);
    box-shadow: inset 0 0 0 1px rgba(47, 207, 132, 0.45);
  }
  100% {
    color: inherit;
    background-color: transparent;
    box-shadow: inset 0 0 0 1px transparent;
  }
}

@keyframes flash-red {
  0% {
    color: #ffe0e6;
    background-color: rgba(255, 95, 127, 0.3);
    box-shadow: inset 0 0 0 1px rgba(255, 95, 127, 0.4);
  }
  100% {
    color: inherit;
    background-color: transparent;
    box-shadow: inset 0 0 0 1px transparent;
  }
}

.data-table th,
.data-table td,
.financial-data-table th,
.financial-data-table td {
  padding: 4px 8px !important;
  font-size: 12px !important;
  border-bottom: 1px solid var(--border-divider) !important;
  text-align: left;
}

.data-table th,
.financial-data-table th {
  color: var(--text-muted) !important;
  font-family: var(--mono);
  text-transform: uppercase;
  font-size: 11px !important;
  font-weight: 500;
}

.data-table tbody tr:hover,
.financial-data-table tbody tr:hover {
  background: var(--bg-hover) !important;
}

.stat-card strong,
.quote-row strong,
.card strong,
.chip span,
.chip-peer span,
.brief-metric strong,
.calc-results strong,
.data-table td,
.financial-data-table td {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.positive,
.toast[data-tone="success"],
.auth-status[data-tone="success"],
.auth-hint[data-tone="success"] {
  color: var(--data-up) !important;
}

.negative,
.btn-danger,
.toast[data-tone="error"],
.auth-status[data-tone="error"],
.auth-hint[data-tone="error"] {
  color: var(--data-down) !important;
}

.alert-row.is-triggered,
.pulse-card.is-live {
  background: var(--data-up-bg) !important;
}

.skeleton-box {
  display: block;
  width: 100%;
  height: 12px;
  border: 1px solid var(--border-divider);
  background: linear-gradient(90deg, var(--bg-panel) 25%, var(--bg-hover) 50%, var(--bg-panel) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
}

.skeleton-box.sm {
  width: 46%;
  height: 10px;
}

.tabular-nums,
[data-price-current],
.price-value,
.quote-price,
.quote-change,
.overview-price,
.overview-change,
.watch-price,
.watch-change,
.position-price,
.position-change,
.metric-value,
.data-table th,
.data-table td,
.financial-data-table th,
.financial-data-table td,
.statusbar strong,
.status-bar strong,
#lastUpdated,
#refreshCountdown {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}

.skeleton-box.lg {
  height: 16px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.palette-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 10, 0.85) !important;
  display: grid;
  place-items: center;
  padding: 10px;
  z-index: 120;
}

.palette-backdrop.hidden {
  display: none !important;
}

.command-palette {
  width: min(860px, 100%);
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 6px;
  align-items: center;
  border: 1px solid var(--border-divider) !important;
  background: var(--bg-panel) !important;
  padding: 6px !important;
  position: relative;
}

.command-palette .autocomplete {
  left: 6px;
  right: 6px;
  top: calc(100% + 4px);
  bottom: auto;
}

.system-log {
  display: grid;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border-divider);
  background: var(--bg-panel);
  padding: 6px;
}

.system-log-entry {
  border-bottom: 1px dotted var(--border-divider);
  padding: 2px 0;
}

.system-log-entry:last-child {
  border-bottom: none;
}

.system-log-line {
  display: block;
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.25;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 1200px) {
  .workspace-shell {
    grid-template-columns: 1fr !important;
  }

  .left-rail {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
}

@media (max-width: 900px) {
  .topbar,
  .topbar-right,
  .quote-hero,
  .card-head-split,
  .news-meta-row,
  .news-actions,
  .row-actions,
  .toolbar-wrap,
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .panel {
    min-width: 100%;
    flex-basis: 100%;
  }

  .overview-strip,
  .action-grid,
  .pulse-grid,
  .compact-chip-grid,
  .quote-meta-grid,
  .calc-grid,
  .card-grid-home,
  .chart-summary-grid,
  .chip-grid,
  .tile-grid,
  .heatmap-grid,
  .split-grid,
  .auth-grid,
  .screener-filters,
  .add-pos-form,
  .left-rail {
    grid-template-columns: 1fr !important;
  }

  .command-palette {
    grid-template-columns: 1fr;
  }

  .cmd-prefix {
    display: none;
  }
}
````

## `src/clientApp.js`

````javascript
import { initializeApp } from "./AppBootstrap.js";

document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
});
````

## `src/AppBootstrap.js`

````javascript
import {
  appName,
  authRoles,
  buildUniverse,
  calculatorDefaults,
  commandCatalog,
  defaultAlerts,
  defaultPositions,
  defaultWatchlist,
  functionKeys,
  heatmapGroups,
  macroDefaults,
  moduleOrder,
  moduleTitles,
} from "./data.js";
import { AppCore } from "./AppCore.js";
import { lexCommand } from "./CommandLexer.js";
import { CommandController } from "./Controllers/CommandController.js";
import { DockingController } from "./Controllers/DockingController.js";
import {
  WorkspaceController,
  normalizePanelMap,
  normalizePanelModules,
  seedLiveNotifications,
  seedLiveRules,
} from "./Controllers/WorkspaceController.js";
import { observeChartResize } from "./Renderers/ChartRenderer.js";
import { LogicEngine } from "./LogicEngine.js";
import { createDefaultModuleRegistry } from "./Registry.js";
import { applyPriceTone, tabularValue } from "./Renderers/Common.js";
import { createStateStore } from "./StateStore.js";
import { authApi, marketApi, uiCache, workspaceApi } from "./api.js";
import { getStockDeepDive } from "./marketService.js";
import { fetchQuotes, fetchChart, fetchOptions, fetchNews, fetchFxRates } from "./services.js";

const DEFAULT_OVERVIEW_SYMBOLS = ["SPY", "QQQ", "NVDA", "TLT", "BTC-USD", "AAPL"];
const DEFAULT_CHART_RANGES = { 1: "1mo", 2: "1mo", 3: "1mo", 4: "1mo" };
const CHART_RANGE_OPTIONS = [
  { label: "5D", value: "5d" },
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
];
const BIG_FOUR_DEFAULT_MODULES = { 1: "quote", 2: "chart", 3: "news", 4: "rules" };
const BIG_FOUR_DEFAULT_SYMBOLS = { 1: "AAPL", 2: "MSFT", 3: "QQQ", 4: "NVDA" };
const AUTH_ENABLED = false;

const universe = buildUniverse();
const universeMap = new Map(universe.map((item) => [item.symbol, item]));
const uiSnapshot = uiCache.read();
const guestWorkspace = uiSnapshot.guestWorkspace || {};
const chartViews = new Map();
let lightweightChartsModulePromise = null;
let moduleRegistry = null;
let appCore = null;
let commandController = null;
let workspaceController = null;
let dockingController = null;
let logicEngine = null;
let uiRefreshQueued = false;
let unsubscribeStateUpdates = null;
let hasInitialized = false;
let lastStateUpdatedAt = Date.now();
const pendingPriceChanges = new Map();

const initialState = {
  user: null,
  activePanel: Number(uiSnapshot.activePanel || 1),
  focusedPanel: Number(uiSnapshot.focusedPanel || 0) || null,
  panelModules: normalizePanelModules(guestWorkspace.panelModules, BIG_FOUR_DEFAULT_MODULES, moduleTitles),
  panelSymbols: normalizePanelMap(guestWorkspace.panelSymbols, BIG_FOUR_DEFAULT_SYMBOLS),
  chartRanges: normalizePanelMap(uiSnapshot.chartRanges, DEFAULT_CHART_RANGES),
  watchlist: [...(guestWorkspace.watchlist || defaultWatchlist)],
  alerts: structuredClone(guestWorkspace.alerts || defaultAlerts),
  positions: structuredClone(guestWorkspace.positions || defaultPositions),
  commandHistory: [...(guestWorkspace.commandHistory || [])],
  activeRules: structuredClone(seedLiveRules(guestWorkspace.activeRules)),
  notifications: structuredClone(seedLiveNotifications(guestWorkspace.notifications, guestWorkspace.activeRules)),
  commandHistoryIndex: -1,
  screenerFilters: {
    1: { universe: "", sector: "", search: "" },
    2: { universe: "", sector: "", search: "" },
    3: { universe: "", sector: "", search: "" },
    4: { universe: "", sector: "", search: "" },
  },
  calculator: structuredClone(calculatorDefaults),
  quotes: new Map(),
  chartCache: new Map(),
  optionsCache: new Map(),
  deepDiveCache: new Map(),
  deepDiveLoading: new Set(),
  newsItems: [],
  newsFilter: String(uiSnapshot.newsFilter || "ALL"),
  fxRates: {},
  overviewQuotes: [],
  overviewSymbols: [...DEFAULT_OVERVIEW_SYMBOLS],
  optionsSelection: { symbol: "AAPL", expiration: null },
  sessionStartedAt: Date.now(),
  refreshCountdown: 30,
  persistTimer: null,
  authAvailabilityTimer: null,
  autoJumpToPanel: uiSnapshot.autoJumpToPanel !== false,
  marketPhase: "Loading",
  health: { ok: false, server: "Checking server", time: null },
  commandPaletteOpen: false,
};

const stateStore = createStateStore(initialState);
const state = stateStore.state;

const el = {
  appTitle: document.querySelector("#appTitle"),
  functionRow: document.querySelector("#functionRow"),
  openCommandPalette: document.querySelector("#openCommandPalette"),
  paletteBackdrop: document.querySelector("#paletteBackdrop"),
  commandPalette: document.querySelector("#commandPalette"),
  overviewStrip: document.querySelector("#overviewStrip"),
  workspaceGrid: document.querySelector("#workspaceGrid"),
  watchlistRail: document.querySelector("#watchlistRail"),
  alertRail: document.querySelector("#alertRail"),
  commandInput: document.querySelector("#commandInput"),
  runCommandButton: document.querySelector("#runCommandButton"),
  autocomplete: document.querySelector("#autocomplete"),
  networkStatus: document.querySelector("#networkStatus"),
  marketPhase: document.querySelector("#marketPhase"),
  serverStatus: document.querySelector("#serverStatus"),
  refreshAllButton: document.querySelector("#refreshAllButton"),
  autoJumpButton: document.querySelector("#autoJumpButton"),
  resetFocusButton: document.querySelector("#resetFocusButton"),
  watchCount: document.querySelector("#watchCount"),
  alertCount: document.querySelector("#alertCount"),
  lastUpdated: document.querySelector("#lastUpdated"),
  refreshCountdown: document.querySelector("#refreshCountdown"),
  sessionClock: document.querySelector("#sessionClock"),
  logoutButton: document.querySelector("#logoutButton"),
  openAuthBtn: document.querySelector("#openAuthBtn"),
  openSettingsBtn: document.querySelector("#openSettingsBtn"),
  authModalBackdrop: document.querySelector("#authModalBackdrop"),
  closeAuthModal: document.querySelector("#closeAuthModal"),
  settingsModalBackdrop: document.querySelector("#settingsModalBackdrop"),
  closeSettingsModal: document.querySelector("#closeSettingsModal"),
  settingsStatus: document.querySelector("#settingsStatus"),
  updateProfileForm: document.querySelector("#updateProfileForm"),
  changePasswordForm: document.querySelector("#changePasswordForm"),
  deleteAccountForm: document.querySelector("#deleteAccountForm"),
  updateProfileBtn: document.querySelector("#updateProfileBtn"),
  changePasswordBtn: document.querySelector("#changePasswordBtn"),
  deleteAccountBtn: document.querySelector("#deleteAccountBtn"),
  settingsRole: document.querySelector("#settingsRole"),
  authTabs: document.querySelector("#authTabs"),
  authStatus: document.querySelector("#authStatus"),
  loginForm: document.querySelector("#loginForm"),
  signupForm: document.querySelector("#signupForm"),
  loginBtn: document.querySelector("#loginBtn"),
  signupBtn: document.querySelector("#signupBtn"),
  continueLocalBtn: document.querySelector("#continueLocalBtn"),
  continueLocalSignupBtn: document.querySelector("#continueLocalSignupBtn"),
  signupRole: document.querySelector("#signupRole"),
  signupEmail: document.querySelector("#signupEmail"),
  signupUsername: document.querySelector("#signupUsername"),
  signupAvailability: document.querySelector("#signupAvailability"),
  toast: document.querySelector("#toast"),
};

function init() {
  if (hasInitialized) return;
  hasInitialized = true;
  document.title = appName;
  if (el.appTitle) el.appTitle.textContent = appName;
  if (el.signupRole) {
    el.signupRole.innerHTML = authRoles.map((role) => `<option value="${role}">${role}</option>`).join("");
  }
  if (el.settingsRole) {
    el.settingsRole.innerHTML = authRoles.map((role) => `<option value="${role}">${role}</option>`).join("");
  }

  registerRenderers();
  ensureTransientOverlaysClosed();
  if (!unsubscribeStateUpdates) {
    unsubscribeStateUpdates = stateStore.subscribe((event) => {
      lastStateUpdatedAt = Date.now();
      capturePriceChanges(event.detail);
      scheduleUiRefresh();
    });
  }
  if (!appCore) {
    logicEngine = new LogicEngine();
    appCore = new AppCore({
      store: stateStore,
      registry: moduleRegistry,
      lexCommand,
      dependencies: {
        authEnabled: AUTH_ENABLED,
        commandCatalog,
        moduleOrder,
        universeMap,
        logicEngine,
        currentTimeShort,
        normalizeChartRange,
        onInitialize: () => {},
        onActivePanelChange: (panel) => {
          document.querySelectorAll("[data-panel]").forEach((node) => {
            node.classList.toggle("is-active", Number(node.dataset.panel) === Number(panel));
          });
        },
        onFocusChange: () => {
          updateFocusLayout();
        },
        syncPanelData,
        revealPanelIfNeeded,
        queueWorkspaceSave,
        syncUiCache,
        refreshAllData,
        refreshChart,
        refreshQuotes,
        refreshOptions,
        addToWatchlist,
        createAlert,
        addPosition,
        loadDeepDive,
        syncTicker,
        showToast,
        openSettingsModal,
        openAuthEntry: (tab) => {
          if (AUTH_ENABLED) {
            openAuthModal(tab || "login");
          } else {
            showToast("Login is paused for now.", "neutral");
          }
        },
        afterCommand: () => {
          if (el.commandInput) el.commandInput.value = "";
          hideAutocomplete();
          closeCommandPalette();
          syncUiCache();
          queueWorkspaceSave();
        },
      },
    });

    workspaceController = new WorkspaceController({
      state,
      uiCache,
      workspaceApi,
      authApi,
      authEnabled: AUTH_ENABLED,
      defaults: {
        watchlist: defaultWatchlist,
        alerts: defaultAlerts,
        positions: defaultPositions,
        panelModules: BIG_FOUR_DEFAULT_MODULES,
        panelSymbols: BIG_FOUR_DEFAULT_SYMBOLS,
      },
      moduleTitles,
      setNetworkStatus,
      updateAuthControls,
      onSessionHydrated: () => {
        renderOverviewStrip();
        renderRails();
        renderAllPanels();
      },
    });
    commandController = new CommandController({
      state,
      el,
      appCore,
      hideAutocomplete,
      closeCommandPalette,
    });
    dockingController = new DockingController({
      state,
      workspaceGrid: el.workspaceGrid,
      renderAllPanels,
      saveWorkspace: () => workspaceController?.saveWorkspace(),
      showToast,
    });
  }

  bindEvents();
  dockingController?.initialize();
  appCore.initialize();
  setActivePanel(state.activePanel);
  scheduleUiRefresh();
  applyTerminalInputClass(document);
  updateFocusLayout();
  updateAuthControls();
  updateAutoJumpButton();
  updateStatusBar();
  void workspaceController?.initializeSession(state.health.ok);
  void checkHealth();
  refreshAllData();

  setInterval(updateSessionClock, 1000);
  setInterval(handleRefreshCountdown, 1000);
  setInterval(checkHealth, 60000);
  window.addEventListener("resize", fitAllCharts);
}

function registerRenderers() {
  if (moduleRegistry) return;
  moduleRegistry = createDefaultModuleRegistry({
    state,
    authEnabled: AUTH_ENABLED,
    universe,
    heatmapGroups,
    macroDefaults,
    buildQuote,
    findRelatedSymbols,
    chartIntervalForRange,
    chartKey,
    optionsKey,
    calculateChartStats,
    calculateBlackScholes,
    calculateBond,
    calculatePulse,
    currentTimeShort,
    chartRangeOptions: CHART_RANGE_OPTIONS,
    getRenderableNewsItems,
    extractHeadlineSymbol,
    emptyState,
    enrichPositions,
    calculatePortfolioSummary,
  });
}

function queuePriceChange(key, previousPrice, currentPrice) {
  if (!key || previousPrice == null || currentPrice == null) return;
  if (Number(previousPrice) === Number(currentPrice)) return;
  pendingPriceChanges.set(key, {
    previousPrice: Number(previousPrice),
    currentPrice: Number(currentPrice),
  });
}

function queueOverviewPriceChanges(previousQuotes = [], nextQuotes = []) {
  const previousBySymbol = new Map((previousQuotes || []).map((quote) => [quote.symbol, quote]));
  (nextQuotes || []).forEach((quote) => {
    queuePriceChange(`overview:${quote.symbol}:price`, previousBySymbol.get(quote.symbol)?.price, quote.price);
  });
}

function capturePriceChanges(detail) {
  const [root, key] = detail?.path || [];

  if (root === "quotes" && key && detail.property === "set") {
    queuePriceChange(`quote:${String(key)}:price`, detail.oldState?.price, detail.newState?.price);
    return;
  }

  if (root === "overviewQuotes" && detail.path?.length === 1) {
    queueOverviewPriceChanges(detail.oldState, detail.newState);
    return;
  }

  if (root === "fxRates" && key) {
    queuePriceChange(`fx:${String(key)}`, detail.oldState, detail.newState);
  }
}

function applyPriceTones(rootNode = document) {
  rootNode.querySelectorAll("[data-price-key]").forEach((element) => {
    const change = pendingPriceChanges.get(element.dataset.priceKey || "");
    if (!change) return;
    applyPriceTone(element, change.currentPrice, change.previousPrice);
  });
  rootNode.querySelectorAll("[data-price-current]").forEach((element) => {
    if (element.dataset.priceKey) return;
    applyPriceTone(element, Number(element.dataset.priceCurrent), Number(element.dataset.pricePrevious));
  });
}

function scheduleUiRefresh() {
  if (uiRefreshQueued) return;
  uiRefreshQueued = true;
  requestAnimationFrame(() => {
    uiRefreshQueued = false;
    renderFunctionRow();
    renderOverviewStrip();
    renderRails();
    renderAllPanels();
    updateFocusLayout();
    updateAuthControls();
    updateAutoJumpButton();
    updateStatusBar();
    pendingPriceChanges.clear();
  });
}

function bindEvents() {
  el.runCommandButton?.addEventListener("click", processCommand);
  el.commandInput?.addEventListener("input", renderAutocomplete);
  el.commandInput?.addEventListener("keydown", handleCommandKeydown);
  el.functionRow?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module]");
    if (button) loadModule(button.dataset.module, state.activePanel, { reveal: true });
  });
  el.openCommandPalette?.addEventListener("click", () => openCommandPalette());
  el.paletteBackdrop?.addEventListener("click", (event) => {
    if (event.target === el.paletteBackdrop) closeCommandPalette();
  });

  el.refreshAllButton?.addEventListener("click", () => {
    refreshAllData();
    showToast("Refreshing live workspace…", "neutral");
  });
  el.autoJumpButton?.addEventListener("click", () => {
    state.autoJumpToPanel = !state.autoJumpToPanel;
    updateAutoJumpButton();
    syncUiCache();
    showToast(`Auto-jump ${state.autoJumpToPanel ? "enabled" : "disabled"}.`, "neutral");
  });
  el.resetFocusButton?.addEventListener("click", () => setFocusedPanel(null));
  el.openAuthBtn?.addEventListener("click", handleAuthEntry);
  el.openSettingsBtn?.addEventListener("click", openSettingsModal);
  el.closeAuthModal?.addEventListener("click", closeAuthModal);
  el.closeSettingsModal?.addEventListener("click", closeSettingsModal);
  el.continueLocalBtn?.addEventListener("click", closeAuthModal);
  el.continueLocalSignupBtn?.addEventListener("click", closeAuthModal);
  el.logoutButton?.addEventListener("click", handleLogout);

  el.authModalBackdrop?.addEventListener("click", (event) => {
    if (event.target === el.authModalBackdrop) closeAuthModal();
  });

  el.settingsModalBackdrop?.addEventListener("click", (event) => {
    if (event.target === el.settingsModalBackdrop) closeSettingsModal();
  });

  el.authTabs?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-auth-tab]");
    if (tab) setAuthTab(tab.dataset.authTab);
  });

  el.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(el.loginForm);
    setAuthMessage("Signing in…", "neutral");
    setButtonLoading(el.loginBtn, true, "Signing in…");
    try {
      const payload = await authApi.login({
        identifier: String(data.get("identifier") || ""),
        password: String(data.get("password") || ""),
      });
      workspaceController?.hydrateSession(payload.user, payload.workspace);
      closeAuthModal();
      showToast(`Welcome back, ${payload.user.firstName}.`, "success");
    } catch (error) {
      setAuthMessage(error.message || "Sign in failed.", "error");
    } finally {
      setButtonLoading(el.loginBtn, false, "Sign in and sync");
    }
  });

  el.signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(el.signupForm);
    const password = String(data.get("password") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");

    if (password.length < 8) {
      setAuthMessage("Password must be at least 8 characters.", "error");
      return;
    }
    if (password !== confirmPassword) {
      setAuthMessage("Passwords do not match.", "error");
      return;
    }

    try {
      const availability = await authApi.checkAvailability({
        email: String(data.get("email") || ""),
        username: String(data.get("username") || ""),
      });
      if (!availability.emailAvailable) {
        setAuthMessage("That email is already in use.", "error");
        return;
      }
      if (!availability.usernameAvailable) {
        setAuthMessage("That username is already taken.", "error");
        return;
      }
    } catch {
      // backend may be unavailable; submit will still attempt
    }

    setAuthMessage("Creating account…", "neutral");
    setButtonLoading(el.signupBtn, true, "Creating…");
    try {
      const payload = await authApi.signup({
        firstName: String(data.get("firstName") || ""),
        lastName: String(data.get("lastName") || ""),
        email: String(data.get("email") || ""),
        username: String(data.get("username") || ""),
        password,
        role: String(data.get("role") || "Other"),
      });
      workspaceController?.hydrateSession(payload.user, payload.workspace);
      closeAuthModal();
      showToast(`Account created. Welcome, ${payload.user.firstName}.`, "success");
    } catch (error) {
      setAuthMessage(error.message || "Signup failed.", "error");
    } finally {
      setButtonLoading(el.signupBtn, false, "Create and sync");
    }
  });

  el.signupEmail?.addEventListener("input", scheduleAvailabilityCheck);
  el.signupUsername?.addEventListener("input", scheduleAvailabilityCheck);

  el.updateProfileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(el.updateProfileForm);
    setSettingsMessage("Updating profile…", "neutral");
    setButtonLoading(el.updateProfileBtn, true, "Updating…");
    try {
      const payload = await authApi.updateProfile({
        firstName: String(data.get("firstName") || ""),
        lastName: String(data.get("lastName") || ""),
        username: String(data.get("username") || ""),
        role: String(data.get("role") || "Other"),
      });
      state.user = payload.user;
      setSettingsMessage("Profile updated.", "success");
      showToast("Profile updated.", "success");
    } catch (error) {
      setSettingsMessage(error.message || "Profile update failed.", "error");
    } finally {
      setButtonLoading(el.updateProfileBtn, false, "Update profile");
    }
  });

  el.changePasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(el.changePasswordForm);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    if (newPassword.length < 8) {
      setSettingsMessage("New password must be at least 8 characters.", "error");
      return;
    }
    setSettingsMessage("Updating password…", "neutral");
    setButtonLoading(el.changePasswordBtn, true, "Updating…");
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      el.changePasswordForm.reset();
      setSettingsMessage("Password updated.", "success");
      showToast("Password updated.", "success");
    } catch (error) {
      setSettingsMessage(error.message || "Password update failed.", "error");
    } finally {
      setButtonLoading(el.changePasswordBtn, false, "Change password");
    }
  });

  el.deleteAccountForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(el.deleteAccountForm);
    const password = String(data.get("password") || "");
    setSettingsMessage("Deleting account…", "neutral");
    setButtonLoading(el.deleteAccountBtn, true, "Deleting…");
    try {
      await authApi.deleteAccount({ password });
      closeSettingsModal();
      state.user = null;
      updateAuthControls();
      setNetworkStatus(state.health.ok ? "Guest · Live" : "Guest · Local");
      showToast("Account deleted.", "neutral");
    } catch (error) {
      setSettingsMessage(error.message || "Account deletion failed.", "error");
    } finally {
      setButtonLoading(el.deleteAccountBtn, false, "Delete account");
    }
  });

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("input", handleDocumentInput);
  document.addEventListener("submit", handleDocumentSubmit);
  document.addEventListener("keydown", handleGlobalHotkeys, true);
}

function ensureTransientOverlaysClosed() {
  state.commandPaletteOpen = false;
  el.paletteBackdrop?.classList.add("hidden");
  el.authModalBackdrop?.classList.add("hidden");
  el.settingsModalBackdrop?.classList.add("hidden");
}

function openAuthModal(tab = "login") {
  setAuthTab(tab);
  el.authModalBackdrop?.classList.remove("hidden");
}

function handleAuthEntry() {
  if (!AUTH_ENABLED) {
    showToast("Login is paused for now.", "neutral");
    return;
  }
  if (state.user) {
    setAuthMessage(`Signed in as @${state.user.username}. Sign in to switch account.`, "neutral");
  }
  openAuthModal("login");
}

function closeAuthModal() {
  el.authModalBackdrop?.classList.add("hidden");
  setAuthMessage("Sign in only if you want backend sync.", "neutral");
}

function openSettingsModal() {
  if (!AUTH_ENABLED) {
    showToast("Account controls are disabled in this build.", "neutral");
    return;
  }
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  populateSettingsForm();
  setSettingsMessage("Update your account details securely.", "neutral");
  el.settingsModalBackdrop?.classList.remove("hidden");
}

function closeSettingsModal() {
  el.settingsModalBackdrop?.classList.add("hidden");
  setSettingsMessage("Update your account details securely.", "neutral");
}

function updateAuthControls() {
  if (!AUTH_ENABLED) {
    el.logoutButton?.classList.add("hidden");
    el.openSettingsBtn?.classList.add("hidden");
    el.openAuthBtn?.classList.add("hidden");
    el.authModalBackdrop?.classList.add("hidden");
    el.settingsModalBackdrop?.classList.add("hidden");
    return;
  }

  if (state.user) {
    el.logoutButton?.classList.remove("hidden");
    el.openSettingsBtn?.classList.remove("hidden");
    if (el.openAuthBtn) {
      el.openAuthBtn.textContent = "Switch";
      el.openAuthBtn.title = "Switch account";
    }
    return;
  }

  el.logoutButton?.classList.add("hidden");
  el.openSettingsBtn?.classList.add("hidden");
  if (el.openAuthBtn) {
    el.openAuthBtn.textContent = "Sync";
    el.openAuthBtn.title = "Sign in and sync workspace";
  }
}

function setAuthTab(tabName) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === tabName);
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.authPanel !== tabName);
  });
}

function setAuthMessage(message, tone) {
  if (!el.authStatus) return;
  el.authStatus.textContent = message;
  el.authStatus.dataset.tone = tone;
  el.authStatus.classList.toggle("active", Boolean(message));
}

function setSettingsMessage(message, tone) {
  if (!el.settingsStatus) return;
  el.settingsStatus.textContent = message;
  el.settingsStatus.dataset.tone = tone;
  el.settingsStatus.classList.toggle("active", Boolean(message));
}

function populateSettingsForm() {
  if (!state.user) return;
  const profileForm = el.updateProfileForm;
  if (!profileForm) return;

  const firstNameInput = profileForm.elements.namedItem("firstName");
  const lastNameInput = profileForm.elements.namedItem("lastName");
  const usernameInput = profileForm.elements.namedItem("username");
  const roleInput = profileForm.elements.namedItem("role");

  if (firstNameInput) firstNameInput.value = state.user.firstName || "";
  if (lastNameInput) lastNameInput.value = state.user.lastName || "";
  if (usernameInput) usernameInput.value = state.user.username || "";
  if (roleInput) roleInput.value = state.user.role || "Other";
}

function setSignupAvailability(message, tone = "neutral") {
  if (!el.signupAvailability) return;
  el.signupAvailability.textContent = message;
  el.signupAvailability.dataset.tone = tone;
  el.signupAvailability.classList.toggle("active", Boolean(message));
}

function applyTerminalInputClass(rootNode = document) {
  rootNode.querySelectorAll("input, select, textarea").forEach((inputNode) => {
    inputNode.classList.add("terminal-input");
  });
}

function setButtonLoading(button, loading, label) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = label;
}

function openCommandPalette(prefill = "") {
  if (!el.paletteBackdrop) return;
  state.commandPaletteOpen = true;
  el.paletteBackdrop.classList.remove("hidden");
  if (el.commandInput) {
    el.commandInput.value = prefill;
    el.commandInput.focus();
    if (prefill) renderAutocomplete();
  }
}

function closeCommandPalette() {
  if (!el.paletteBackdrop) return;
  state.commandPaletteOpen = false;
  el.paletteBackdrop.classList.add("hidden");
  hideAutocomplete();
}

function loadingSkeleton(lines = 3) {
  return `<div class="stack">${Array.from({ length: lines })
    .map((_, index) => `<span class="skeleton-box ${index === 0 ? "lg" : ""}"></span>`)
    .join("")}</div>`;
}

async function handleLogout() {
  try {
    await authApi.logout();
  } catch {
    // ignore
  }
  closeSettingsModal();
  state.user = null;
  updateAuthControls();
  setNetworkStatus(state.health.ok ? "Guest · Live" : "Guest · Local");
  showToast("Signed out.", "neutral");
}

async function checkHealth() {
  try {
    const payload = await marketApi.health();
    state.health = {
      ok: Boolean(payload.ok),
      server: payload.server || "Meridian",
      time: payload.time || null,
    };
    state.marketPhase = payload.phase || deriveMarketPhase();
  } catch {
    state.health = { ok: false, server: "Local mode", time: null };
    state.marketPhase = deriveMarketPhase();
  }

  if (el.marketPhase) el.marketPhase.textContent = state.marketPhase;
  if (el.serverStatus) {
    el.serverStatus.textContent = state.health.ok ? "Live" : "Offline";
    el.serverStatus.classList.toggle("chip-server-offline", !state.health.ok);
  }
  if (!state.user) setNetworkStatus(state.health.ok ? "Guest · Live" : "Guest · Local");
}

function deriveMarketPhase() {
  const now = new Date();
  // Convert to NY time
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = ny.getDay(); // 0=Sun 6=Sat
  const h = ny.getHours();
  const m = ny.getMinutes();
  const mins = h * 60 + m;
  if (day === 0 || day === 6) return "Weekend";
  if (mins < 4 * 60 + 0) return "Overnight";
  if (mins < 9 * 60 + 30) return "Pre-market";
  if (mins < 16 * 60) return "Market open";
  if (mins < 20 * 60) return "After hours";
  return "Overnight";
}

function setNetworkStatus(text) {
  if (el.networkStatus) el.networkStatus.textContent = text;
}

function updateAutoJumpButton() {
  if (!el.autoJumpButton) return;
  el.autoJumpButton.textContent = `Auto-jump: ${state.autoJumpToPanel ? "On" : "Off"}`;
  el.autoJumpButton.classList.toggle("is-active", state.autoJumpToPanel);
}

function isSplitLaptopViewport() {
  const width = window.innerWidth || document.documentElement.clientWidth;
  const height = window.innerHeight || document.documentElement.clientHeight;
  const screenWidth = window.screen?.availWidth || window.screen?.width || 0;
  const estimatedHalf = screenWidth ? Math.round(screenWidth / 2) : 720;
  const adaptiveLower = Math.max(680, Math.round(estimatedHalf * 0.8));
  const adaptiveUpper = Math.max(790, Math.round(estimatedHalf * 1.2));
  const around720Band = width >= 680 && width <= 860;
  const adaptiveBand = width >= adaptiveLower && width <= adaptiveUpper;
  const likelyLaptopClass = screenWidth ? screenWidth <= 1800 : true;
  return height >= 560 && (around720Band || (likelyLaptopClass && adaptiveBand));
}

function revealPanelIfNeeded(panel, behavior = "smooth") {
  if (!state.autoJumpToPanel) return;
  if (!isSplitLaptopViewport()) return;
  const panelNode = document.querySelector(`[data-panel="${panel}"]`);
  if (!panelNode) return;

  const rect = panelNode.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const mostlyVisible = rect.top >= 72 && rect.bottom <= viewportHeight - 12;
  if (mostlyVisible) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  panelNode.scrollIntoView({
    block: "start",
    behavior: prefersReducedMotion ? "auto" : behavior,
  });
}

function scheduleAvailabilityCheck() {
  const email = String(el.signupEmail?.value || "").trim();
  const username = String(el.signupUsername?.value || "").trim();
  if (!email && !username) {
    setSignupAvailability("Use a unique email and username.", "neutral");
    return;
  }

  window.clearTimeout(state.authAvailabilityTimer);
  state.authAvailabilityTimer = window.setTimeout(() => {
    checkSignupAvailability(email, username);
  }, 280);
}

async function checkSignupAvailability(email, username) {
  try {
    const result = await authApi.checkAvailability({ email, username });
    if (email && !result.emailAvailable) {
      setSignupAvailability("Email is already in use.", "error");
      return;
    }
    if (username && !result.usernameAvailable) {
      setSignupAvailability("Username is already taken.", "error");
      return;
    }
    if (email || username) {
      setSignupAvailability("Looks good. Credentials are available.", "success");
    }
  } catch {
    setSignupAvailability("Availability check offline; you can still submit.", "neutral");
  }
}

function renderFunctionRow() {
  if (!el.functionRow) return;
  if (el.functionRow.classList.contains("hidden")) return;
  el.functionRow.innerHTML = functionKeys
    .map(
      (item) => `
      <button class="function-key ${state.panelModules[state.activePanel] === item.module ? "is-active" : ""}" data-module="${item.module}" type="button">
        <span>${item.key}</span>
        <strong>${item.label}</strong>
      </button>
    `,
    )
    .join("");
}

function renderOverviewStrip() {
  if (!el.overviewStrip) return;

  const cards = state.overviewQuotes.length
    ? state.overviewQuotes
        .map(
          (quote) => `
            <button class="overview-card" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${state.activePanel}">
              <span>${quote.symbol}</span>
              <strong>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `overview:${quote.symbol}:price`, currentPrice: quote.price })}</strong>
              <small class="${Number(quote.changePct || 0) >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct || 0))}</small>
            </button>
          `,
        )
        .join("")
    : state.overviewSymbols
        .map(
          (symbol) => `
            <article class="overview-card is-placeholder">
              <span>${symbol}</span>
              <span class="skeleton-box lg"></span>
              <span class="skeleton-box sm"></span>
            </article>
          `,
        )
        .join("");

  const pulse = calculatePulse();
  el.overviewStrip.innerHTML = `
    ${cards}
    <article class="overview-card overview-card-summary">
      <span>Market pulse</span>
      <strong>${state.marketPhase}</strong>
      <small>${pulse.gainers} up · ${pulse.losers} down · ${state.health.ok ? "live server" : "local fallback"}</small>
    </article>
  `;
  applyPriceTones(el.overviewStrip);
}

function renderRails() {
  if (el.watchlistRail) {
    el.watchlistRail.innerHTML = state.watchlist
      .map((symbol) => {
        const quote = buildQuote(symbol);
        return `
          <div class="rail-row">
            <button class="rail-item" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${state.activePanel}">
              <div>
                <strong>${symbol}</strong>
                <small>${quote?.name || "Waiting for quote"}</small>
              </div>
              <div>
                <strong>${tabularValue(formatPrice(quote?.price || 0, symbol), { flashKey: `quote:${symbol}:price`, currentPrice: quote?.price || 0 })}</strong>
                <small class="${(quote?.changePct || 0) >= 0 ? "positive" : "negative"}">${quote ? tabularValue(formatSignedPct(quote.changePct)) : "--"}</small>
              </div>
            </button>
            <button class="rail-remove" type="button" data-remove-watch="${symbol}">×</button>
          </div>
        `;
      })
      .join("");
  }

  if (el.alertRail) {
    el.alertRail.innerHTML = state.alerts
      .map(
        (alert) => `
        <div class="alert-row ${alert.status === "triggered" ? "is-triggered" : ""}">
          <strong>${alert.symbol}</strong>
          <span>${alert.operator} ${Number(alert.threshold).toLocaleString()}</span>
          <small>${alert.status}</small>
        </div>
      `,
      )
      .join("");
  }

  if (el.watchCount) el.watchCount.textContent = String(state.watchlist.length);
  if (el.alertCount) el.alertCount.textContent = String(state.alerts.length);
  applyPriceTones(el.watchlistRail || document);
}

function setActivePanel(panel) {
  appCore?.setActivePanel(panel);
}

function setFocusedPanel(panel) {
  appCore?.setFocusedPanel(panel);
}

function updateFocusLayout() {
  if (!el.workspaceGrid) return;
  el.workspaceGrid.classList.toggle("is-focused", Boolean(state.focusedPanel));
  document.querySelectorAll("[data-panel]").forEach((node) => {
    const panel = Number(node.dataset.panel);
    node.classList.toggle("is-focused", state.focusedPanel === panel);
  });
  if (el.resetFocusButton) {
    el.resetFocusButton.textContent = state.focusedPanel ? "All panels" : "Grid";
  }
  syncUiCache();
}

function cycleModule(panel, direction) {
  appCore?.cycleModule(panel, direction);
}

function loadModule(moduleName, panel, options = {}) {
  appCore?.loadModule(moduleName, panel, options);
}

function syncPanelData(panel) {
  const moduleName = state.panelModules[panel];
  const symbol = state.panelSymbols[panel] || "AAPL";

  if (moduleName === "quote") refreshQuotes([symbol]);
  if (moduleName === "chart") refreshChart(symbol, state.chartRanges[panel] || "1mo");
  if (moduleName === "options") refreshOptions(symbol, state.optionsSelection.expiration);
  if (moduleName === "news") refreshNews();
  if (moduleName === "macro") refreshFx();
}

function renderAllPanels() {
  [1, 2, 3, 4].forEach((panel) => renderPanel(panel));
}

function renderPanel(panel) {
  const panelNode = document.querySelector(`[data-panel="${panel}"]`);
  const title = document.querySelector(`#panelTitle${panel}`);
  const content = document.querySelector(`#panelContent${panel}`);
  const moduleName = state.panelModules[panel];
  if (!panelNode || !title || !content) return;

  const symbolLabel = ["quote", "chart", "options"].includes(moduleName) && state.panelSymbols[panel]
    ? ` · ${state.panelSymbols[panel]}`
    : "";
  title.textContent = `${moduleTitles[moduleName] || moduleName}${symbolLabel}`;

  const renderer = moduleRegistry.get(moduleName) || moduleRegistry.get("home");
  panelNode.dataset.moduleKey = String(moduleName || "").toUpperCase();
  content.innerHTML = renderer(panel);
  applyTerminalInputClass(content);
  applyPriceTones(content);

  if (moduleName === "chart") {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const range = state.chartRanges[panel] || "1mo";
    const interval = chartIntervalForRange(range);
    const points = state.chartCache.get(chartKey(symbol, range, interval)) || [];
    void mountCandlestickChart(panel, points);
  } else {
    clearPanelChart(panel);
  }
}

function processCommand() {
  commandController?.processInput();
}

function handleCommandKeydown(event) {
  commandController?.handleCommandKeydown(event);
}

function renderAutocomplete() {
  const value = String(el.commandInput?.value || "").trim().toUpperCase();
  if (!value) {
    hideAutocomplete();
    return;
  }

  const commandMatches = commandCatalog
    .filter((item) => item.cmd.includes(value))
    .slice(0, 5)
    .map((item) => ({ label: item.cmd, description: item.desc }));
  const symbolMatches = universe
    .filter((item) => item.symbol.startsWith(value) || item.name.toUpperCase().includes(value))
    .slice(0, 5)
    .map((item) => ({ label: `${item.symbol} Q`, description: item.name }));
  const suggestions = [...commandMatches, ...symbolMatches].slice(0, 10);

  if (!suggestions.length) {
    hideAutocomplete();
    return;
  }

  el.autocomplete.innerHTML = suggestions
    .map(
      (item) => `
        <button class="autocomplete-item" type="button" data-autocomplete="${item.label}">
          <strong>${item.label}</strong>
          <span>${item.description}</span>
        </button>
      `,
    )
    .join("");
  el.autocomplete.classList.remove("hidden");
}

function hideAutocomplete() {
  el.autocomplete?.classList.add("hidden");
}

function handleDocumentClick(event) {
  const panelNode = event.target.closest("[data-panel]");
  if (panelNode) setActivePanel(Number(panelNode.dataset.panel));

  const focusButton = event.target.closest("[data-panel-focus]");
  if (focusButton) {
    setFocusedPanel(Number(focusButton.dataset.panelFocus));
    return;
  }

  if (event.target.closest("[data-refresh-all]")) {
    refreshAllData();
    return;
  }

  const cycle = event.target.closest("[data-panel-cycle]");
  if (cycle) {
    const [panel, direction] = cycle.dataset.panelCycle.split(":").map(Number);
    cycleModule(panel, direction);
    return;
  }

  const chartRangeButton = event.target.closest("[data-chart-range]");
  if (chartRangeButton) {
    const [panel, range] = chartRangeButton.dataset.chartRange.split(":");
    state.chartRanges[Number(panel)] = range;
    syncUiCache();
    refreshChart(state.panelSymbols[Number(panel)] || "AAPL", range);
    renderPanel(Number(panel));
    return;
  }

  const newsFilterButton = event.target.closest("[data-news-filter]");
  if (newsFilterButton) {
    state.newsFilter = newsFilterButton.dataset.newsFilter;
    syncUiCache();
    const newsPanels = [1, 2, 3, 4].filter((panel) => state.panelModules[panel] === "news");
    if (!newsPanels.length) loadModule("news", state.activePanel);
    newsPanels.forEach((panel) => renderPanel(panel));
    if (!newsPanels.length) renderPanel(state.activePanel);
    return;
  }

  const createAlertButton = event.target.closest("[data-create-alert]");
  if (createAlertButton) {
    const [symbol, operator, threshold] = createAlertButton.dataset.createAlert.split(":");
    createAlert(symbol, Number(threshold), operator || ">=");
    return;
  }

  const analyzeButton = event.target.closest("[data-analyze-symbol]");
  if (analyzeButton) {
    loadDeepDive(analyzeButton.dataset.analyzeSymbol, { panel: state.activePanel });
    return;
  }

  const openNewsButton = event.target.closest("[data-open-news-symbol]");
  if (openNewsButton) {
    openTickerNewsPanel(openNewsButton.dataset.openNewsSymbol);
    return;
  }

  const syncTickerButton = event.target.closest("[data-sync-symbol]");
  if (syncTickerButton) {
    syncTicker(syncTickerButton.dataset.syncSymbol);
    return;
  }

  const moduleTrigger = event.target.closest("[data-load-module]");
  if (moduleTrigger) {
    const panel = Number(moduleTrigger.dataset.targetPanel || state.activePanel);
    if (moduleTrigger.dataset.targetSymbol) {
      state.panelSymbols[panel] = moduleTrigger.dataset.targetSymbol;
    }
    loadModule(moduleTrigger.dataset.loadModule, panel, { reveal: true });
    return;
  }

  const watchTrigger = event.target.closest("[data-watch-symbol]");
  if (watchTrigger) {
    addToWatchlist(watchTrigger.dataset.watchSymbol);
    return;
  }

  const removeWatch = event.target.closest("[data-remove-watch]");
  if (removeWatch) {
    removeFromWatchlist(removeWatch.dataset.removeWatch);
    return;
  }

  const removePosition = event.target.closest("[data-remove-position]");
  if (removePosition) {
    removePositionBySymbol(removePosition.dataset.removePosition);
    return;
  }

  const removeRule = event.target.closest("[data-remove-rule]");
  if (removeRule) {
    appCore?.removeRule(removeRule.dataset.removeRule);
    renderAllPanels();
    return;
  }

  const refreshChartTrigger = event.target.closest("[data-refresh-chart]");
  if (refreshChartTrigger) {
    const [panel, symbol, range] = refreshChartTrigger.dataset.refreshChart.split(":");
    refreshChart(symbol, range || state.chartRanges[Number(panel)] || "1mo");
    return;
  }

  const refreshOptionsTrigger = event.target.closest("[data-refresh-options]");
  if (refreshOptionsTrigger) {
    const [, symbol] = refreshOptionsTrigger.dataset.refreshOptions.split(":");
    refreshOptions(symbol, state.optionsSelection.expiration);
    return;
  }

  const autocompleteItem = event.target.closest("[data-autocomplete]");
  if (autocompleteItem) {
    el.commandInput.value = autocompleteItem.dataset.autocomplete;
    processCommand();
    return;
  }

  const suggestedCommand = event.target.closest("[data-suggest-command]");
  if (suggestedCommand) {
    const command = suggestedCommand.dataset.suggestCommand;
    if (command && el.commandInput) {
      el.commandInput.value = command;
      processCommand();
    }
    return;
  }

  if (!event.target.closest(".command-shell")) hideAutocomplete();
}

function handleDocumentInput(event) {
  const screenerSearch = event.target.closest("[data-screener-search]");
  if (screenerSearch) {
    state.screenerFilters[Number(screenerSearch.dataset.screenerSearch)].search = screenerSearch.value;
    renderPanel(Number(screenerSearch.dataset.screenerSearch));
    return;
  }

  const screenerUniverse = event.target.closest("[data-screener-universe]");
  if (screenerUniverse) {
    state.screenerFilters[Number(screenerUniverse.dataset.screenerUniverse)].universe = screenerUniverse.value;
    renderPanel(Number(screenerUniverse.dataset.screenerUniverse));
    return;
  }

  const screenerSector = event.target.closest("[data-screener-sector]");
  if (screenerSector) {
    state.screenerFilters[Number(screenerSector.dataset.screenerSector)].sector = screenerSector.value;
    renderPanel(Number(screenerSector.dataset.screenerSector));
    return;
  }

  const optionsExpiry = event.target.closest("[data-options-expiry]");
  if (optionsExpiry) {
    const panel = Number(optionsExpiry.dataset.optionsExpiry);
    state.optionsSelection.expiration = optionsExpiry.value || null;
    syncUiCache();
    refreshOptions(state.panelSymbols[panel] || state.optionsSelection.symbol, state.optionsSelection.expiration);
    return;
  }

  const calcInputNode = event.target.closest("[data-calc-key]");
  if (calcInputNode) {
    setNestedCalculatorValue(calcInputNode.dataset.calcKey, Number(calcInputNode.value));
    renderAllPanels();
  }
}

function handleDocumentSubmit(event) {
  const addPositionForm = event.target.closest("#addPositionForm");
  if (!addPositionForm) return;
  event.preventDefault();
  const data = new FormData(addPositionForm);
  addPosition({
    symbol: String(data.get("symbol") || "").toUpperCase(),
    shares: Number(data.get("shares") || 0),
    cost: Number(data.get("cost") || 0),
  });
  addPositionForm.reset();
}

function handleGlobalHotkeys(event) {
  if (event.key === "Escape") {
    const hadOverlayOpen =
      !el.paletteBackdrop?.classList.contains("hidden") ||
      !el.authModalBackdrop?.classList.contains("hidden") ||
      !el.settingsModalBackdrop?.classList.contains("hidden");

    if (hadOverlayOpen) {
      event.preventDefault();
      event.stopPropagation();
    }

    closeSettingsModal();
    closeAuthModal();
    closeCommandPalette();
    return;
  }

  const activeTag = document.activeElement?.tagName;
  const inEditable = Boolean(activeTag && ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag));
  const cmdOrCtrl = event.metaKey || event.ctrlKey;

  if (!inEditable && event.key === "/") {
    event.preventDefault();
    openCommandPalette();
    return;
  }

  if (cmdOrCtrl && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandPalette();
    return;
  }

  if (inEditable && event.key !== "Escape") return;

  const hotkeys = {
    F1: "briefing",
    F2: "home",
    F3: "quote",
    F4: "chart",
    F5: "news",
    F6: "screener",
    F7: "heatmap",
    F8: "portfolio",
    F9: "macro",
    F10: "options",
    F11: "calculator",
  };

  if (event.key === "Tab") {
    event.preventDefault();
    setActivePanel((state.activePanel % 4) + 1);
    return;
  }

  if (event.key.toUpperCase() === "G") {
    setFocusedPanel(null);
    return;
  }

  if (event.key.toUpperCase() === "F") {
    setFocusedPanel(state.activePanel);
    return;
  }

  if (hotkeys[event.key]) {
    event.preventDefault();
    loadModule(hotkeys[event.key], state.activePanel, { reveal: true });
    return;
  }

}

function addToWatchlist(symbol) {
  const upper = symbol.toUpperCase();
  if (!state.watchlist.includes(upper)) {
    state.watchlist.unshift(upper);
    state.watchlist = state.watchlist.slice(0, 24);
    refreshQuotes([upper]);
    renderRails();
    queueWorkspaceSave();
    showToast(`${upper} added to watchlist.`, "success");
  }
}

function removeFromWatchlist(symbol) {
  state.watchlist = state.watchlist.filter((item) => item !== symbol);
  renderRails();
  queueWorkspaceSave();
}

function createAlert(symbol, threshold, operator) {
  if (!symbol || Number.isNaN(threshold)) return;
  state.alerts.unshift({ symbol: symbol.toUpperCase(), operator, threshold, status: "watching" });
  state.alerts = state.alerts.slice(0, 16);
  evaluateAlerts();
  renderRails();
  queueWorkspaceSave();
  showToast(`Alert added for ${symbol.toUpperCase()}.`, "success");
}

function addPosition(position) {
  if (!position.symbol || !position.shares || !position.cost) return;
  state.positions.unshift({ ...position, symbol: position.symbol.toUpperCase() });
  renderAllPanels();
  queueWorkspaceSave();
  refreshQuotes([position.symbol.toUpperCase()]);
  showToast(`Position added for ${position.symbol.toUpperCase()}.`, "success");
}

function removePositionBySymbol(symbol) {
  state.positions = state.positions.filter((position) => position.symbol !== symbol);
  renderAllPanels();
  queueWorkspaceSave();
}

function queueWorkspaceSave() {
  workspaceController?.queueSave();
}

async function refreshAllData() {
  setNetworkStatus(state.user ? "Live · Syncing" : "Guest · Syncing");
  const symbols = [
    ...new Set([
      ...state.watchlist,
      ...state.positions.map((item) => item.symbol),
      ...Object.values(state.panelSymbols),
      ...state.overviewSymbols,
    ]),
  ];

  const chartRequests = [1, 2, 3, 4]
    .filter((panel) => state.panelModules[panel] === "chart")
    .map((panel) => refreshChart(state.panelSymbols[panel] || "AAPL", state.chartRanges[panel] || "1mo"));

  const optionRequests = [1, 2, 3, 4]
    .filter((panel) => state.panelModules[panel] === "options")
    .map((panel) => refreshOptions(state.panelSymbols[panel] || state.optionsSelection.symbol, state.optionsSelection.expiration));

  await Promise.allSettled([
    checkHealth(),
    refreshOverview(),
    refreshQuotes(symbols),
    refreshNews(),
    refreshFx(),
    ...chartRequests,
    ...optionRequests,
  ]);

  renderOverviewStrip();
  renderRails();
  renderAllPanels();
  updateStatusBar();
  setNetworkStatus(state.user ? "Live · Saved" : state.health.ok ? "Guest · Live" : "Guest · Local");
}

async function loadDeepDive(symbol, { panel = state.activePanel } = {}) {
  const ticker = String(symbol || "").trim().toUpperCase();
  if (!ticker) return;
  state.deepDiveLoading.add(ticker);
  renderPanel(panel);

  const payload = await getStockDeepDive(ticker);
  if (payload) {
    state.deepDiveCache.set(ticker, payload);
    showToast(payload.available ? `${ticker} analysis loaded.` : `${ticker} loaded with fallback research.`, payload.available ? "success" : "neutral");
  } else {
    showToast(`Unable to load deep insight for ${ticker}.`, "error");
  }

  state.deepDiveLoading.delete(ticker);
  renderPanel(panel);
  if (state.newsFilter === ticker) renderPanel(4);
}

function openTickerNewsPanel(symbol) {
  const ticker = String(symbol || "").trim().toUpperCase();
  if (!ticker) return;
  state.newsFilter = ticker;
  state.panelModules[4] = "news";
  renderPanel(4);
  revealPanelIfNeeded(4);
}

function syncTicker(symbol) {
  const ticker = String(symbol || "").trim().toUpperCase();
  if (!ticker) return;
  if (!state.watchlist.includes(ticker)) {
    state.watchlist.unshift(ticker);
    state.watchlist = [...new Set(state.watchlist)].slice(0, 16);
    renderRails();
  }
  queueWorkspaceSave();
  showToast(state.user ? `${ticker} synced to your workspace.` : `${ticker} saved to local workspace.`, "success");
}

function formatInsightValue(value) {
  if (value == null) return "--";
  if (typeof value === "object") {
    if ("fmt" in value && value.fmt) return String(value.fmt);
    if ("longFmt" in value && value.longFmt) return String(value.longFmt);
    if ("raw" in value && value.raw != null) return String(value.raw);
  }
  return String(value);
}

function getRenderableNewsItems(filterSymbol) {
  const ticker = String(filterSymbol || "ALL").toUpperCase();
  if (ticker !== "ALL") {
    const deepDiveNews = state.deepDiveCache.get(ticker)?.news || [];
    if (deepDiveNews.length) {
      return deepDiveNews.map((item) => ({
        source: item.source || "Feed",
        headline: item.headline || item.title || "Untitled",
        time: item.time || item.pubDate || "Live",
        link: item.link || "#",
        sentiment: item.sentiment || scoreHeadlineSentiment(item.headline || item.title || ""),
      }));
    }
  }

  return filterNewsItems(filterSymbol).map((item) => ({
    source: item.source || "Feed",
    headline: item.headline || item.title || "Untitled",
    time: item.time || item.pubDate || "Live",
    link: item.link || "#",
    sentiment: item.sentiment || scoreHeadlineSentiment(item.headline || item.title || ""),
  }));
}

function scoreHeadlineSentiment(text) {
  const content = String(text || "").toLowerCase();
  const positiveTerms = ["beat", "upgrade", "growth", "record", "surge", "gain", "strong"];
  const negativeTerms = ["miss", "downgrade", "drop", "cut", "fall", "weak", "risk"];
  const positiveHits = positiveTerms.filter((term) => content.includes(term)).length;
  const negativeHits = negativeTerms.filter((term) => content.includes(term)).length;
  if (positiveHits > negativeHits) return "Positive";
  if (negativeHits > positiveHits) return "Negative";
  return "Neutral";
}

async function refreshOverview() {
  // Try backend overview endpoint
  try {
    const payload = await marketApi.overview(state.overviewSymbols);
    if ((payload.quotes || []).length) {
      state.overviewQuotes = payload.quotes;
      if (payload.phase) state.marketPhase = payload.phase;
      return;
    }
  } catch {
    // fall through to direct
  }
  // Direct Yahoo fallback
  try {
    const results = await fetchQuotes(state.overviewSymbols);
    state.overviewQuotes = results.map((q) => ({
      symbol: q.symbol,
      price: q.price,
      changePct: q.changePct,
    }));
  } catch {
    // noop
  }
}

async function refreshQuotes(symbols) {
  // Try backend first; fall back to direct Yahoo fetch
  try {
    const payload = await marketApi.quotes(symbols);
    (payload.quotes || []).forEach((quote) => state.quotes.set(quote.symbol, quote));
    evaluateAlerts();
    return;
  } catch {
    // backend unavailable — try direct
  }
  try {
    const results = await fetchQuotes(symbols);
    results.forEach((quote) => state.quotes.set(quote.symbol, quote));
    evaluateAlerts();
  } catch {
    // noop
  }
}

async function refreshChart(symbol, range = "1mo") {
  const interval = chartIntervalForRange(range);
  const key = chartKey(symbol, range, interval);
  // Try backend first
  try {
    const payload = await marketApi.chart(symbol, range, interval);
    state.chartCache.set(key, payload.points || []);
    renderAllPanels();
    return;
  } catch {
    // backend unavailable — try direct
  }
  try {
    const points = await fetchChart(symbol, range, interval);
    if (points.length) {
      state.chartCache.set(key, points);
      renderAllPanels();
    }
  } catch {
    // noop
  }
}

async function refreshOptions(symbol, date) {
  state.optionsSelection.symbol = symbol;
  const storeResult = (payload) => {
    if (!state.optionsSelection.expiration && payload.expirations?.length) {
      state.optionsSelection.expiration = payload.expirations[0];
    }
    state.optionsCache.set(optionsKey(symbol, date || "nearest"), payload);
    if (state.optionsSelection.expiration) {
      state.optionsCache.set(optionsKey(symbol, state.optionsSelection.expiration), payload);
    }
    renderAllPanels();
  };
  // Try backend first
  try {
    const payload = await marketApi.options(symbol, date);
    storeResult(payload);
    return;
  } catch {
    // backend unavailable — try direct
  }
  try {
    const payload = await fetchOptions(symbol, date);
    storeResult(payload);
  } catch {
    // noop
  }
}

async function refreshNews() {
  // Try backend first
  try {
    const payload = await marketApi.news();
    if ((payload.items || []).length) {
      state.newsItems = payload.items;
      return;
    }
  } catch {
    // fall through to direct
  }
  // Direct RSS fallback via services.js
  try {
    const items = await fetchNews();
    state.newsItems = items;
  } catch {
    // noop
  }
}

async function refreshFx() {
  // Try backend first
  try {
    const payload = await marketApi.fx();
    if (Object.keys(payload.rates || {}).length) {
      state.fxRates = payload.rates;
      return;
    }
  } catch {
    // fall through to direct
  }
  // Direct ER-API fallback
  try {
    state.fxRates = await fetchFxRates();
  } catch {
    // noop
  }
}

function handleRefreshCountdown() {
  state.refreshCountdown -= 1;
  if (state.refreshCountdown <= 0) {
    state.refreshCountdown = 30;
    refreshAllData();
  }
  updateStatusBar();
}

function updateStatusBar() {
  if (el.lastUpdated) el.lastUpdated.textContent = currentTimeShort(lastStateUpdatedAt);
  if (el.refreshCountdown) el.refreshCountdown.textContent = `${state.refreshCountdown}s`;
  if (el.watchCount) el.watchCount.textContent = String(state.watchlist.length);
  if (el.alertCount) el.alertCount.textContent = String(state.alerts.length);
  if (el.marketPhase) el.marketPhase.textContent = state.marketPhase;
  if (el.serverStatus) {
    el.serverStatus.textContent = state.health.ok ? "Live" : "Offline";
    el.serverStatus.classList.toggle("chip-server-offline", !state.health.ok);
  }
}

function updateSessionClock() {
  const elapsed = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
  const hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  if (el.sessionClock) el.sessionClock.textContent = `${hours}:${minutes}:${seconds}`;
}

function evaluateAlerts() {
  state.alerts = state.alerts.map((alert) => {
    const quote = buildQuote(alert.symbol);
    if (!quote) return alert;
    const triggered = alert.operator === ">=" ? quote.price >= alert.threshold : quote.price <= alert.threshold;
    return { ...alert, status: triggered ? "triggered" : "watching" };
  });
}

function buildQuote(symbol) {
  const base = universeMap.get(symbol);
  const live = state.quotes.get(symbol);
  if (!base && !live) return null;
  return {
    symbol,
    name: live?.name || base?.name || symbol,
    exchange: live?.exchange || base?.exchange || "N/A",
    sector: base?.sector || "Market",
    universe: base?.universe || "Custom",
    price: live?.price || base?.seedPrice || 0,
    changePct: Number(live?.changePct || 0),
    change: Number(live?.change || 0),
    marketCap: live?.marketCap || base?.marketCap || 0,
    volume: live?.volume || 0,
    dayHigh: live?.dayHigh || live?.price || base?.seedPrice || 0,
    dayLow: live?.dayLow || live?.price || base?.seedPrice || 0,
    previousClose: live?.previousClose || base?.seedPrice || 0,
  };
}

function enrichPositions() {
  return state.positions.map((position) => {
    const quote = buildQuote(position.symbol);
    const price = quote?.price || position.cost;
    const value = price * position.shares;
    const basis = position.cost * position.shares;
    const pnl = value - basis;
    const pnlPct = basis ? (pnl / basis) * 100 : 0;
    return { ...position, price, value, pnl, pnlPct };
  });
}

function calculatePortfolioSummary() {
  const rows = enrichPositions();
  const value = rows.reduce((sum, row) => sum + row.value, 0);
  const basis = rows.reduce((sum, row) => sum + row.cost * row.shares, 0);
  const pnl = value - basis;
  return { value, pnl, pnlPct: basis ? (pnl / basis) * 100 : 0 };
}

function setNestedCalculatorValue(path, value) {
  const [root, field] = path.split(".");
  if (!state.calculator[root]) return;
  if (Number.isFinite(value)) state.calculator[root][field] = value;
}

function chartKey(symbol, range, interval) {
  return `${symbol}:${range}:${interval}`;
}

function optionsKey(symbol, expiration) {
  return `${symbol}:${expiration || "nearest"}`;
}

function normalizeCandle(point, previousClose = null) {
  const close = Number(point.close ?? point.price ?? 0);
  const open = Number(point.open ?? previousClose ?? close);
  const high = Number(point.high ?? Math.max(open, close));
  const low = Number(point.low ?? Math.min(open, close));
  const time = Number(point.timestamp ?? point.time ?? 0);
  return {
    time,
    open,
    high,
    low,
    close,
  };
}

function toCandlestickData(points) {
  let previousClose = null;
  return points
    .map((point) => {
      const candle = normalizeCandle(point, previousClose);
      previousClose = candle.close;
      return candle;
    })
    .filter((candle) => candle.time > 0 && Number.isFinite(candle.open) && Number.isFinite(candle.high) && Number.isFinite(candle.low) && Number.isFinite(candle.close));
}

function clearPanelChart(panel) {
  const existing = chartViews.get(panel);
  if (!existing) return;
  existing.disconnectResizeObserver?.();
  existing.chart.remove();
  chartViews.delete(panel);
}

function fitAllCharts() {
  chartViews.forEach(({ chart, container }) => {
    const width = Math.max(320, Math.floor(container.clientWidth || 0));
    const height = Math.max(220, Math.floor(container.clientHeight || 0));
    chart.resize(width, height);
    chart.timeScale().fitContent();
  });
}

async function loadLightweightChartsModule() {
  if (lightweightChartsModulePromise) return lightweightChartsModulePromise;

  lightweightChartsModulePromise = (async () => {
    const candidates = [
      new URL("../node_modules/lightweight-charts/dist/lightweight-charts.production.mjs", import.meta.url).href,
      new URL("../node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.mjs", import.meta.url).href,
      "https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.production.mjs",
      "https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.mjs",
    ];

    for (const candidate of candidates) {
      try {
        const moduleRef = await import(candidate);
        if (moduleRef?.createChart) return moduleRef;
      } catch {
        // try next candidate
      }
    }

    return null;
  })();

  return lightweightChartsModulePromise;
}

async function mountCandlestickChart(panel, points) {
  const container = document.querySelector(`#chartCanvas${panel}`);
  if (!container) return;

  const candles = toCandlestickData(points);
  clearPanelChart(panel);
  if (!candles.length) return;

  const chartLib = await loadLightweightChartsModule();
  if (!chartLib?.createChart) {
    container.innerHTML = `<div class="stack"><span class="skeleton-box lg"></span><span class="skeleton-box"></span><span class="skeleton-box sm"></span></div>`;
    return;
  }

  const width = Math.max(320, Math.floor(container.clientWidth || 0));
  const height = Math.max(220, Math.floor(container.clientHeight || 0));

  const chart = chartLib.createChart(container, {
    width,
    height,
    layout: {
      textColor: "#E5E5E5",
      background: { color: "transparent" },
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
    rightPriceScale: {
      borderVisible: false,
    },
    leftPriceScale: {
      visible: false,
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: chartLib.CrosshairMode?.Normal ?? 0,
      vertLine: { visible: true, labelVisible: false, color: "#4A90E2" },
      horzLine: { visible: true, labelVisible: false, color: "#4A90E2" },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      vertTouchDrag: true,
      horzTouchDrag: true,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  });

  const seriesOptions = {
    upColor: "#00E676",
    downColor: "#FF3B30",
    borderVisible: false,
    wickUpColor: "#00E676",
    wickDownColor: "#FF3B30",
  };

  let series = null;
  if (typeof chart.addCandlestickSeries === "function") {
    series = chart.addCandlestickSeries(seriesOptions);
  } else if (typeof chart.addSeries === "function" && chartLib.CandlestickSeries) {
    series = chart.addSeries(chartLib.CandlestickSeries, seriesOptions);
  }

  if (!series) {
    chart.remove();
    container.innerHTML = `<div class="empty-inline">Chart engine not compatible.</div>`;
    return;
  }

  series.setData(candles);
  chart.timeScale().fitContent();

  const disconnectResizeObserver = observeChartResize(container, chart);
  chartViews.set(panel, { chart, container, disconnectResizeObserver });
}

function calculateBlackScholes({ spot, strike, years, rate, volatility }) {
  const safeYears = Math.max(Number(years), 0.0001);
  const safeSpot = Math.max(Number(spot), 0.0001);
  const safeStrike = Math.max(Number(strike), 0.0001);
  const safeRate = Number(rate) / 100;
  const safeVol = Math.max(Number(volatility) / 100, 0.0001);
  const d1 = (Math.log(safeSpot / safeStrike) + (safeRate + (safeVol ** 2) / 2) * safeYears) / (safeVol * Math.sqrt(safeYears));
  const d2 = d1 - safeVol * Math.sqrt(safeYears);
  const normal = (value) => 0.5 * (1 + erf(value / Math.sqrt(2)));
  const density = (value) => Math.exp(-(value ** 2) / 2) / Math.sqrt(2 * Math.PI);

  return {
    call: safeSpot * normal(d1) - safeStrike * Math.exp(-safeRate * safeYears) * normal(d2),
    put: safeStrike * Math.exp(-safeRate * safeYears) * normal(-d2) - safeSpot * normal(-d1),
    delta: normal(d1),
    gamma: density(d1) / (safeSpot * safeVol * Math.sqrt(safeYears)),
  };
}

function calculateBond({ face, coupon, ytm, maturity, frequency }) {
  const faceValue = Number(face);
  const couponRate = Number(coupon) / 100;
  const yieldRate = Number(ytm) / 100;
  const periodsPerYear = Number(frequency);
  const totalPeriods = Math.max(1, Math.round(Number(maturity) * periodsPerYear));
  const couponPayment = (faceValue * couponRate) / periodsPerYear;
  const discount = yieldRate / periodsPerYear;

  let price = 0;
  let duration = 0;
  let convexity = 0;

  for (let period = 1; period <= totalPeriods; period += 1) {
    const cashflow = period === totalPeriods ? couponPayment + faceValue : couponPayment;
    const presentValue = cashflow / ((1 + discount) ** period);
    price += presentValue;
    duration += period * presentValue;
    convexity += period * (period + 1) * presentValue;
  }

  const macaulayDuration = duration / price / periodsPerYear;
  return {
    price,
    duration: macaulayDuration,
    modifiedDuration: macaulayDuration / (1 + discount),
    convexity: convexity / (price * periodsPerYear * periodsPerYear),
  };
}

function erf(value) {
  const sign = value >= 0 ? 1 : -1;
  const absolute = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absolute);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-(absolute ** 2)));
  return sign * y;
}

function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function findRelatedSymbols(symbol) {
  const base = universeMap.get(symbol);
  if (!base) return [];
  return universe
    .filter((item) => item.symbol !== symbol && item.sector === base.sector)
    .slice(0, 6)
    .map((item) => buildQuote(item.symbol) || { ...item, price: item.seedPrice, changePct: 0 });
}

function filterNewsItems(filterSymbol) {
  if (!filterSymbol || filterSymbol === "ALL") return state.newsItems;
  const base = universeMap.get(filterSymbol);
  const terms = [filterSymbol, base?.name || ""].filter(Boolean).map((item) => item.toUpperCase());
  return state.newsItems.filter((item) => terms.some((term) => item.headline.toUpperCase().includes(term)));
}

function extractHeadlineSymbol(headline) {
  const upper = headline.toUpperCase();
  const match = universe.find((item) => upper.includes(item.symbol) || upper.includes(item.name.toUpperCase()));
  return match?.symbol || null;
}

function chartIntervalForRange(range) {
  return range === "5d" ? "1h" : "1d";
}

function normalizeChartRange(value) {
  const upper = String(value || "").toUpperCase();
  const map = {
    "5D": "5d",
    "1M": "1mo",
    "3M": "3mo",
    "6M": "6mo",
    "1Y": "1y",
  };
  return map[upper] || "1mo";
}

function calculateChartStats(points) {
  if (!points.length) return { high: 0, low: 0, returnPct: 0 };
  const closes = points.map((point) => Number(point.close || 0));
  const first = closes[0] || 0;
  const last = closes[closes.length - 1] || 0;
  return {
    high: Math.max(...closes),
    low: Math.min(...closes),
    returnPct: first ? ((last - first) / first) * 100 : 0,
  };
}

function calculatePulse() {
  const quotes = state.overviewQuotes.length ? state.overviewQuotes : state.watchlist.map(buildQuote).filter(Boolean);
  const gainers = quotes.filter((quote) => Number(quote.changePct || 0) >= 0).length;
  const losers = Math.max(quotes.length - gainers, 0);
  return { gainers, losers };
}

function syncUiCache() {
  workspaceController?.syncUiCache();
}

function formatPrice(value, symbol) {
  const digits = symbol === "BTC-USD" || symbol === "USD" ? 0 : 2;
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatSignedPct(value) {
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
}

function formatMarketCap(value) {
  if (!value) return "N/A";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${Number(value).toFixed(0)}`;
}

function formatVolume(value) {
  if (!value) return "N/A";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return `${value}`;
}

function currentTimeShort(value = Date.now()) {
  const dateValue = value instanceof Date ? value : new Date(value);
  return dateValue.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function showToast(message, tone = "neutral") {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.dataset.tone = tone;
  el.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    el.toast.classList.remove("is-visible");
  }, 2500);
}

export function initializeApp() {
  init();
}
````

## `src/api.js`

````javascript
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

function resolveApiBase() {
  if (typeof window === "undefined") return "";

  const override = window.MERIDIAN_API_BASE || window.localStorage.getItem("meridian.api-base") || "";
  if (override) return String(override).replace(/\/$/, "");

  const { protocol, hostname, port } = window.location;
  const isLocal = hostname === "127.0.0.1" || hostname === "localhost";
  if (isLocal && port && port !== "4173") {
    return `${protocol}//${hostname}:4173`;
  }

  return "";
}

const API_BASE = resolveApiBase();

function buildApiUrl(path) {
  return `${API_BASE}${path}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? payload.error : `Request failed with ${response.status}`;
    throw new Error(String(message));
  }

  return payload;
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {}),
    },
  });

  return parseResponse(response);
}

export const authApi = {
  signup(payload) {
    return apiRequest("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload) {
    return apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logout() {
    return apiRequest("/api/auth/logout", { method: "POST" });
  },
  session() {
    return apiRequest("/api/auth/session");
  },
  checkAvailability({ email = "", username = "" } = {}) {
    const query = new URLSearchParams();
    if (email) query.set("email", email);
    if (username) query.set("username", username);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/api/auth/availability${suffix}`);
  },
  updateProfile(payload) {
    return apiRequest("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  changePassword(payload) {
    return apiRequest("/api/auth/password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteAccount(payload) {
    return apiRequest("/api/auth/account", {
      method: "DELETE",
      body: JSON.stringify(payload),
    });
  },
};

export const workspaceApi = {
  get() {
    return apiRequest("/api/workspace");
  },
  save(workspace) {
    return apiRequest("/api/workspace", {
      method: "PUT",
      body: JSON.stringify(workspace),
    });
  },
};

export const marketApi = {
  quotes(symbols) {
    const encoded = encodeURIComponent(symbols.join(","));
    return apiRequest(`/api/market/quotes?symbols=${encoded}`);
  },
  overview(symbols = []) {
    const encoded = encodeURIComponent(symbols.join(","));
    const suffix = encoded ? `?symbols=${encoded}` : "";
    return apiRequest(`/api/market/overview${suffix}`);
  },
  chart(symbol, range = "1mo", interval = "1d") {
    return apiRequest(`/api/market/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`);
  },
  options(symbol, date) {
    const suffix = date ? `?date=${encodeURIComponent(date)}` : "";
    return apiRequest(`/api/market/options/${encodeURIComponent(symbol)}${suffix}`);
  },
  news() {
    return apiRequest("/api/market/news");
  },
  deepDive(symbol) {
    return apiRequest(`/api/market/deep-dive/${encodeURIComponent(symbol)}`);
  },
  fx() {
    return apiRequest("/api/market/fx");
  },
  health() {
    return apiRequest("/api/health");
  },
};

export const uiCache = {
  key: "the-terminal.ui-cache.v2",
  read() {
    try {
      const raw = window.localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },
  write(value) {
    window.localStorage.setItem(this.key, JSON.stringify(value));
  },
};
````

## `src/AppCore.js`

````javascript
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
````

## `src/CommandLexer.js`

````javascript
function upper(value) {
  return String(value || "").trim().toUpperCase();
}

export function lexCommand(raw, context = {}) {
  const source = String(raw || "").trim();
  const normalized = upper(source);
  const tokens = normalized ? normalized.split(/\s+/) : [];
  const [first, second, third, fourth] = tokens;
  const universeMap = context.universeMap || new Map();

  if (!source) return { raw: source, normalized, tokens, action: "EMPTY", payload: {} };
  if (first === "HELP") return { raw: source, normalized, tokens, action: "HELP", payload: {} };
  if (first === "REFRESH") return { raw: source, normalized, tokens, action: "REFRESH", payload: {} };
  if (first === "SAVE") return { raw: source, normalized, tokens, action: "SAVE", payload: {} };
  if (first === "GRID") return { raw: source, normalized, tokens, action: "GRID", payload: {} };
  if (first === "FOCUS" && !Number.isNaN(Number(second))) return { raw: source, normalized, tokens, action: "FOCUS", payload: { panel: Number(second) } };
  if (first === "NEXT") return { raw: source, normalized, tokens, action: "NEXT", payload: {} };
  if (first === "PREV") return { raw: source, normalized, tokens, action: "PREV", payload: {} };
  if (first === "RANGE" && second) return { raw: source, normalized, tokens, action: "RANGE", payload: { range: second } };
  if (first === "BRIEF" || first === "BRIEFING") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "briefing" } };
  if (first === "HOME") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "home" } };
  if (first === "SETTINGS" || first === "ACCOUNT") return { raw: source, normalized, tokens, action: "SETTINGS", payload: {} };
  if (first === "SUGGEST" || first === "SUGGESTIONS") return { raw: source, normalized, tokens, action: "SUGGEST", payload: {} };
  if (["LOGIN", "SIGNUP", "REGISTER"].includes(first) || (first === "SYNC" && !second)) return { raw: source, normalized, tokens, action: "AUTH", payload: { tab: first === "SIGNUP" || first === "REGISTER" ? "signup" : "login" } };
  if (first === "NEWS" && second) return { raw: source, normalized, tokens, action: "NEWS_FILTER", payload: { symbol: second } };
  if (first === "NEWS") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "news", newsFilter: "ALL" } };
  if (first === "ANALYZE") return { raw: source, normalized, tokens, action: "ANALYZE", payload: { symbol: second } };
  if (first === "SYNC" && second) return { raw: source, normalized, tokens, action: "SYNC_TICKER", payload: { symbol: second } };
  if (first === "PORT") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "portfolio" } };
  if (first === "MACRO") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "macro" } };
  if (first === "SCREENER" || first === "EQS") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "screener" } };
  if (first === "HEAT" || first === "HEATMAP") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "heatmap" } };
  if (first === "OPTIONS" && second) return { raw: source, normalized, tokens, action: "OPEN_OPTIONS", payload: { symbol: second } };
  if (first === "RULES") return { raw: source, normalized, tokens, action: "MODULE", payload: { module: "rules" } };
  if (first === "IF") return { raw: source, normalized, tokens, action: "ADD_RULE", payload: { statement: source } };
  if (first === "WATCH" && second) return { raw: source, normalized, tokens, action: "WATCH", payload: { symbol: second } };
  if (first === "ALERT" && second && third) {
    const operator = [">=", "<="].includes(third) ? third : ">=";
    const threshold = Number(operator === third ? fourth : third);
    return { raw: source, normalized, tokens, action: "ALERT", payload: { symbol: second, operator, threshold } };
  }
  if (first === "ADDPOS" && second && third && fourth) {
    return { raw: source, normalized, tokens, action: "ADD_POSITION", payload: { symbol: second, shares: Number(third), cost: Number(fourth) } };
  }
  if (second === "Q" || first === "QUOTE") {
    const symbol = first === "QUOTE" ? second : first;
    return { raw: source, normalized, tokens, action: "OPEN_QUOTE", payload: { symbol } };
  }
  if (second === "CHART" || first === "CHART") {
    const symbol = first === "CHART" ? second : first;
    return { raw: source, normalized, tokens, action: "OPEN_CHART", payload: { symbol } };
  }
  if (universeMap.has(first)) return { raw: source, normalized, tokens, action: "OPEN_QUOTE", payload: { symbol: first } };

  return { raw: source, normalized, tokens, action: "UNKNOWN", payload: { value: normalized } };
}
````

## `src/Controllers/CommandController.js`

````javascript
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
````

## `src/Controllers/DockingController.js`

````javascript
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
````

## `src/Controllers/WorkspaceController.js`

````javascript
export function normalizePanelMap(source, fallback) {
  const next = { ...fallback };
  if (!source || typeof source !== "object") return next;
  Object.entries(source).forEach(([key, value]) => {
    next[Number(key)] = value;
  });
  return next;
}

const LIVE_DEFAULT_RULES = [
  { symbol: "NVDA", op: ">", limit: 950, msg: "NVIDIA Price Target Hit" },
  { symbol: "AAPL", op: "<", limit: 180, msg: "Apple Value Zone" },
  { symbol: "BTC-USD", op: ">", limit: 75000, msg: "Crypto Breakout" },
];

export function seedLiveRules(activeRules) {
  const existingRules = Array.isArray(activeRules) ? activeRules.filter(Boolean) : [];
  if (existingRules.length) return existingRules;

  const now = Date.now();
  return LIVE_DEFAULT_RULES.map((rule, index) => ({
    id: `seed-rule-${index + 1}`,
    symbol: rule.symbol,
    op: rule.op,
    limit: rule.limit,
    msg: rule.msg,
    createdAt: now - (LIVE_DEFAULT_RULES.length - index) * 1000,
  }));
}

export function seedLiveNotifications(notifications, activeRules) {
  const existingNotifications = Array.isArray(notifications) ? notifications.filter(Boolean) : [];
  if (existingNotifications.length) return existingNotifications;

  const seededRules = seedLiveRules(activeRules);
  const now = Date.now();
  return seededRules.map((rule, index) => ({
    ruleId: rule.id,
    symbol: rule.symbol,
    op: rule.op,
    limit: rule.limit,
    msg: rule.msg,
    price: rule.limit,
    triggeredAt: now - (seededRules.length - index) * 60_000,
  }));
}

export function normalizePanelModules(source, fallback, moduleTitles) {
  const next = { ...fallback };
  const allowedModules = new Set(Object.keys(moduleTitles || {}));

  [1, 2, 3, 4].forEach((panel) => {
    const rawValue = source?.[panel] ?? source?.[String(panel)];
    const normalized = String(rawValue || "").trim().toLowerCase();
    if (allowedModules.has(normalized)) {
      next[panel] = normalized;
    }
  });

  return next;
}

export class WorkspaceController {
  constructor({
    state,
    uiCache,
    workspaceApi,
    authApi,
    authEnabled,
    defaults,
    moduleTitles,
    setNetworkStatus,
    updateAuthControls,
    onSessionHydrated,
  }) {
    this.state = state;
    this.uiCache = uiCache;
    this.workspaceApi = workspaceApi;
    this.authApi = authApi;
    this.authEnabled = Boolean(authEnabled);
    this.defaults = defaults;
    this.moduleTitles = moduleTitles;
    this.setNetworkStatus = setNetworkStatus;
    this.updateAuthControls = updateAuthControls;
    this.onSessionHydrated = onSessionHydrated;
  }

  serializeWorkspace() {
    return {
      watchlist: this.state.watchlist,
      alerts: this.state.alerts,
      positions: this.state.positions,
      panelModules: this.state.panelModules,
      panelSymbols: this.state.panelSymbols,
      commandHistory: this.state.commandHistory,
      activeRules: this.state.activeRules,
    };
  }

  async saveWorkspace() {
    if (!this.state.user) {
      this.uiCache.write({
        ...this.uiCache.read(),
        guestWorkspace: this.serializeWorkspace(),
      });
      return;
    }

    this.setNetworkStatus("Live · Saving");
    try {
      await this.workspaceApi.save(this.serializeWorkspace());
      this.setNetworkStatus("Live · Saved");
    } catch {
      this.setNetworkStatus("Live · Retry");
    }
  }

  queueSave() {
    if (!this.state.user) {
      this.uiCache.write({
        ...this.uiCache.read(),
        guestWorkspace: this.serializeWorkspace(),
      });
      return;
    }

    this.setNetworkStatus("Live · Saving");
    window.clearTimeout(this.state.persistTimer);
    this.state.persistTimer = window.setTimeout(async () => {
      try {
        await this.workspaceApi.save(this.serializeWorkspace());
        this.setNetworkStatus("Live · Saved");
      } catch {
        this.setNetworkStatus("Live · Retry");
      }
    }, 350);
  }

  syncUiCache() {
    this.uiCache.write({
      ...this.uiCache.read(),
      activePanel: this.state.activePanel,
      focusedPanel: this.state.focusedPanel,
      autoJumpToPanel: this.state.autoJumpToPanel,
      chartRanges: this.state.chartRanges,
      newsFilter: this.state.newsFilter,
    });
  }

  hydrateSession(user, workspace = {}) {
    this.state.user = user;
    this.state.watchlist = [...(workspace.watchlist || this.defaults.watchlist)];
    this.state.alerts = structuredClone(workspace.alerts || this.defaults.alerts);
    this.state.positions = structuredClone(workspace.positions || this.defaults.positions);
    this.state.panelModules = normalizePanelModules(workspace.panelModules, this.defaults.panelModules, this.moduleTitles);
    this.state.panelSymbols = normalizePanelMap(workspace.panelSymbols, this.defaults.panelSymbols);
    this.state.commandHistory = [...(workspace.commandHistory || [])];
    this.state.activeRules = structuredClone(seedLiveRules(workspace.activeRules));
    this.state.notifications = structuredClone(seedLiveNotifications(workspace.notifications, this.state.activeRules));
    this.state.sessionStartedAt = Date.now();

    this.updateAuthControls?.();
    this.setNetworkStatus("Live · Saved");
    this.onSessionHydrated?.({ user, workspace });
  }

  async initializeSession(healthOk = false) {
    if (!this.authEnabled) return;
    try {
      const payload = await this.authApi.session();
      this.hydrateSession(payload.user, payload.workspace);
    } catch {
      this.setNetworkStatus(healthOk ? "Guest · Live" : "Guest · Local");
    }
  }
}
````

## `src/data.js`

````javascript
export const appName = "Meridian";

export const authRoles = [
  "Portfolio Manager",
  "Research Analyst",
  "Quant Developer",
  "Macro Trader",
  "Independent Investor",
  "Other",
];

export const functionKeys = [
  { key: "F1", module: "briefing", label: "Briefing" },
  { key: "F2", module: "home", label: "Home" },
  { key: "F3", module: "quote", label: "Quote" },
  { key: "F4", module: "chart", label: "Chart" },
  { key: "F5", module: "news", label: "News" },
  { key: "F6", module: "screener", label: "Screener" },
  { key: "F7", module: "heatmap", label: "Heatmap" },
  { key: "F8", module: "portfolio", label: "Portfolio" },
  { key: "F9", module: "macro", label: "Macro" },
  { key: "F10", module: "options", label: "Options" },
  { key: "F11", module: "calculator", label: "Calculator" },
];

export const moduleOrder = ["briefing", "home", "quote", "chart", "news", "screener", "heatmap", "portfolio", "macro", "options", "calculator", "rules"];

export const moduleTitles = {
  briefing: "Briefing",
  home: "Home",
  quote: "Quote",
  chart: "Chart",
  news: "News",
  screener: "Screener",
  heatmap: "Heatmap",
  portfolio: "Portfolio",
  macro: "Macro",
  options: "Options",
  calculator: "Calculator",
  rules: "Rules",
};

export const commandCatalog = [
  { cmd: "HELP", desc: "See available commands" },
  { cmd: "REFRESH", desc: "Refresh market data" },
  { cmd: "SAVE", desc: "Save your current workspace" },
  { cmd: "GRID", desc: "Return to the full panel grid" },
  { cmd: "FOCUS 2", desc: "Focus panel 2" },
  { cmd: "NEXT", desc: "Move to the next module" },
  { cmd: "PREV", desc: "Move to the previous module" },
  { cmd: "RANGE 1Y", desc: "Set chart range" },
  { cmd: "BRIEF", desc: "Open the Meridian briefing" },
  { cmd: "HOME", desc: "Open the home view" },
  { cmd: "SUGGEST", desc: "Show suggested next steps" },
  { cmd: "NEWS", desc: "Open the news view" },
  { cmd: "NEWS NVDA", desc: "Filter news for NVDA" },
  { cmd: "ANALYZE NVDA", desc: "Load deep insight for NVDA" },
  { cmd: "SYNC NVDA", desc: "Save NVDA into your workspace" },
  { cmd: "PORT", desc: "Open the portfolio view" },
  { cmd: "MACRO", desc: "Open the macro view" },
  { cmd: "AAPL Q", desc: "Open quote for AAPL" },
  { cmd: "AAPL CHART", desc: "Open chart for AAPL" },
  { cmd: "WATCH TSLA", desc: "Add TSLA to watchlist" },
  { cmd: "ALERT NVDA 950", desc: "Create an alert level" },
  { cmd: "ADDPOS MSFT 5 410", desc: "Add a portfolio position" },
  { cmd: "OPTIONS NVDA", desc: "Open options for NVDA" },
  { cmd: "RULES", desc: "Open the rules manager" },
  { cmd: "IF AAPL > 220 THEN Breakout", desc: "Create an active rule" },
];

export const calculatorDefaults = {
  option: { spot: 100, strike: 105, years: 0.5, rate: 5, volatility: 25 },
  bond: { face: 1000, coupon: 5, ytm: 4.5, maturity: 10, frequency: 2 },
};

export const defaultWatchlist = ["AAPL", "MSFT", "NVDA", "QQQ", "TSLA", "BTC-USD"];

export const defaultPositions = [
  { symbol: "NVDA", shares: 8, cost: 815.12 },
  { symbol: "QQQ", shares: 12, cost: 418.45 },
];

export const defaultAlerts = [
  { symbol: "NVDA", operator: ">=", threshold: 950, status: "watching" },
  { symbol: "TSLA", operator: "<=", threshold: 180, status: "watching" },
];

export const macroDefaults = {
  currencies: ["EUR", "GBP", "JPY", "CAD", "CHF", "AUD"],
  curve: [
    { tenor: "1M", yield: 5.31 },
    { tenor: "3M", yield: 5.26 },
    { tenor: "6M", yield: 5.17 },
    { tenor: "1Y", yield: 4.95 },
    { tenor: "2Y", yield: 4.58 },
    { tenor: "5Y", yield: 4.23 },
    { tenor: "10Y", yield: 4.18 },
    { tenor: "30Y", yield: 4.29 },
  ],
};

export const heatmapGroups = {
  Technology: ["AAPL", "MSFT", "NVDA", "AMD", "AVGO", "QCOM"],
  Growth: ["TSLA", "PLTR", "CRWD", "ABNB", "UBER", "COIN"],
  Macro: ["SPY", "QQQ", "IWM", "BTC-USD", "ETH-USD", "TLT"],
};

const defaultUniverse = [
  ["AAPL", "Apple", "Information Technology", "S&P 500", 214.72, 2860000000000],
  ["MSFT", "Microsoft", "Information Technology", "S&P 500", 427.35, 3180000000000],
  ["NVDA", "NVIDIA", "Information Technology", "S&P 500", 903.12, 2220000000000],
  ["TSLA", "Tesla", "Consumer Discretionary", "S&P 500", 196.72, 640000000000],
  ["AMZN", "Amazon", "Consumer Discretionary", "S&P 500", 188.61, 1980000000000],
  ["GOOGL", "Alphabet", "Communication Services", "S&P 500", 172.8, 2120000000000],
  ["META", "Meta", "Communication Services", "S&P 500", 501.12, 1290000000000],
  ["AMD", "AMD", "Information Technology", "S&P 500", 178.44, 289000000000],
  ["QCOM", "Qualcomm", "Information Technology", "S&P 500", 170.15, 189000000000],
  ["AVGO", "Broadcom", "Information Technology", "S&P 500", 1328.17, 617000000000],
  ["PLTR", "Palantir", "Information Technology", "Growth", 31.48, 68000000000],
  ["COIN", "Coinbase", "Financials", "Growth", 258.38, 62000000000],
  ["ABNB", "Airbnb", "Consumer Discretionary", "Growth", 166.12, 106000000000],
  ["UBER", "Uber", "Industrials", "Growth", 77.44, 161000000000],
  ["CRWD", "CrowdStrike", "Information Technology", "Growth", 323.14, 79000000000],
  ["SPY", "SPDR S&P 500", "ETF", "ETF", 513.91, 0],
  ["QQQ", "Invesco QQQ", "ETF", "ETF", 441.37, 0],
  ["IWM", "iShares Russell 2000", "ETF", "ETF", 205.12, 0],
  ["TLT", "iShares 20Y Treasury", "ETF", "ETF", 92.61, 0],
  ["BTC-USD", "Bitcoin", "Cryptocurrency", "Crypto", 68420, 0],
  ["ETH-USD", "Ethereum", "Cryptocurrency", "Crypto", 3718, 0],
];

export function buildUniverse() {
  return defaultUniverse.map(([symbol, name, sector, universe, seedPrice, marketCap]) => ({
    symbol,
    name,
    sector,
    universe,
    exchange: universe === "S&P 500" ? "NYSE/NASDAQ" : universe,
    seedPrice,
    marketCap,
  }));
}
````

## `src/LogicEngine.js`

````javascript
const COMPARATORS = {
  ">": (left, right) => left > right,
  "<": (left, right) => left < right,
  "==": (left, right) => left === right,
};

export class LogicEngine {
  constructor() {
    this.lastMatches = new Map();
  }

  parseRule(input) {
    const source = String(input || "").trim();
    const match = source.match(/^IF\s+([A-Z0-9.-]+)\s*(>|<|==)\s*([0-9]+(?:\.[0-9]+)?)\s+THEN\s+(.+)$/i);
    if (!match) {
      throw new Error("Invalid rule syntax. Use: IF [ticker] [operator] [value] THEN [message]");
    }

    const symbol = String(match[1] || "").toUpperCase();
    const op = String(match[2] || "");
    const limit = Number(match[3]);
    const msg = String(match[4] || "").trim();

    if (!COMPARATORS[op]) {
      throw new Error("Unsupported operator. Use >, <, or ==.");
    }

    if (!Number.isFinite(limit)) {
      throw new Error("Rule value must be numeric.");
    }

    if (!msg) {
      throw new Error("Rule message is required after THEN.");
    }

    return {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol,
      op,
      limit,
      msg,
      createdAt: Date.now(),
    };
  }

  evaluate(state) {
    const triggers = [];
    const activeRules = Array.isArray(state.activeRules) ? state.activeRules : [];
    const activeIds = new Set(activeRules.map((rule) => rule.id));

    for (const cachedId of this.lastMatches.keys()) {
      if (!activeIds.has(cachedId)) this.lastMatches.delete(cachedId);
    }

    for (const rule of activeRules) {
      const quote = state.quotes?.get?.(rule.symbol);
      const price = Number(quote?.price);
      if (!Number.isFinite(price)) {
        this.lastMatches.set(rule.id, false);
        continue;
      }

      const comparator = COMPARATORS[rule.op];
      if (!comparator) continue;

      const matched = comparator(price, Number(rule.limit));
      const previouslyMatched = Boolean(this.lastMatches.get(rule.id));

      if (matched && !previouslyMatched) {
        triggers.push({
          ruleId: rule.id,
          symbol: rule.symbol,
          op: rule.op,
          limit: rule.limit,
          msg: rule.msg,
          price,
          triggeredAt: Date.now(),
        });
      }

      this.lastMatches.set(rule.id, matched);
    }

    return triggers;
  }
}
````

## `src/Registry.js`

````javascript
import { createBriefingRenderer } from "./Renderers/BriefingRenderer.js";
import { createCalculatorRenderer } from "./Renderers/CalculatorRenderer.js";
import { createChartRenderer } from "./Renderers/ChartRenderer.js";
import { createHeatmapRenderer } from "./Renderers/HeatmapRenderer.js";
import { createHomeRenderer } from "./Renderers/HomeRenderer.js";
import { createMacroRenderer } from "./Renderers/MacroRenderer.js";
import { createNewsRenderer } from "./Renderers/NewsRenderer.js";
import { createOptionsRenderer } from "./Renderers/OptionsRenderer.js";
import { createPortfolioRenderer } from "./Renderers/PortfolioRenderer.js";
import { createQuoteRenderer } from "./Renderers/QuoteRenderer.js";
import { createRulesRenderer } from "./Renderers/RulesRenderer.js";
import { createScreenerRenderer } from "./Renderers/ScreenerRenderer.js";

function normalizeKey(key) {
  return String(key || "").trim().toLowerCase();
}

export function createModuleRegistry(seedEntries = []) {
  const registry = new Map();

  seedEntries.forEach(([key, renderer]) => {
    registry.set(normalizeKey(key), renderer);
  });

  return {
    register(key, renderer) {
      registry.set(normalizeKey(key), renderer);
      return this;
    },
    get(key) {
      return registry.get(normalizeKey(key)) || null;
    },
    has(key) {
      return registry.has(normalizeKey(key));
    },
    entries() {
      return [...registry.entries()];
    },
  };
}

export function createDefaultModuleRegistry(context) {
  return createModuleRegistry([
    ["briefing", createBriefingRenderer(context)],
    ["home", createHomeRenderer(context)],
    ["quote", createQuoteRenderer(context)],
    ["chart", createChartRenderer(context)],
    ["news", createNewsRenderer(context)],
    ["screener", createScreenerRenderer(context)],
    ["heatmap", createHeatmapRenderer(context)],
    ["portfolio", createPortfolioRenderer(context)],
    ["macro", createMacroRenderer(context)],
    ["options", createOptionsRenderer(context)],
    ["calculator", createCalculatorRenderer(context)],
    ["rules", createRulesRenderer(context)],
  ]);
}
````

## `src/Renderers/ChartRenderer.js`

````javascript
import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

export function observeChartResize(container, chart) {
  if (!container || !chart) return () => {};

  const resize = () => {
    const width = Math.max(320, Math.floor(container.clientWidth || 0));
    const height = Math.max(220, Math.floor(container.clientHeight || 0));
    chart.resize(width, height);
    chart.timeScale?.().fitContent?.();
  };

  resize();

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    return () => observer.disconnect();
  }

  window.addEventListener("resize", resize);
  return () => window.removeEventListener("resize", resize);
}

export function createChartRenderer(context) {
  const { state, chartIntervalForRange, chartKey, calculateChartStats, chartRangeOptions } = context;

  return function renderChart(panel) {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const range = state.chartRanges[panel] || "1mo";
    const interval = chartIntervalForRange(range);
    const points = state.chartCache.get(chartKey(symbol, range, interval)) || [];
    const stats = calculateChartStats(points);
    const chartUnavailable = !points.length && !state.health?.ok;
    const waitingForData = !points.length && state.health?.ok;

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          ${chartRangeOptions.map((option) => `<button class="range-pill ${option.value === range ? "is-active" : ""}" type="button" data-chart-range="${panel}:${option.value}">${option.label}</button>`).join("")}
          <button class="btn btn-ghost" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}">Quote</button>
          <button class="btn btn-ghost" type="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Options</button>
          <button class="btn btn-ghost" type="button" data-news-filter="${symbol}">News</button>
          <button class="btn btn-primary" type="button" data-refresh-chart="${panel}:${symbol}:${range}">Refresh chart</button>
        </div>

        <article class="card chart-card chart-card-feature">
          <div class="chart-canvas-wrap">
            <div class="chart-canvas" id="chartCanvas${panel}" data-chart-panel="${panel}"></div>
            ${chartUnavailable ? `<div class="chart-loading chart-fallback">${loadingSkeleton(4)}<p class="empty-inline">Offline: ${symbol} chart feed unavailable. Last requested window ${range.toUpperCase()}.</p></div>` : ""}
            ${waitingForData ? `<div class="chart-loading">${loadingSkeleton(4)}</div>` : ""}
          </div>
        </article>

        <div class="card-grid chart-summary-grid">
          <article class="card stat-card"><span>Range</span><strong>${range.toUpperCase()}</strong><small>${symbol}</small></article>
          <article class="card stat-card"><span>High</span><strong>${points.length ? tabularValue(formatPrice(stats.high, symbol)) : "--"}</strong><small>${points.length ? "Visible range" : "Waiting"}</small></article>
          <article class="card stat-card"><span>Return</span><strong class="${stats.returnPct >= 0 ? "positive" : "negative"}">${points.length ? tabularValue(formatSignedPct(stats.returnPct)) : "--"}</strong><small>${points.length ? "Start to end" : "Waiting"}</small></article>
        </div>
      </section>
    `;
  };
}
````

## `src/Renderers/Common.js`

````javascript
export function loadingSkeleton(lines = 3) {
  return `<div class="stack">${Array.from({ length: lines })
    .map((_, index) => `<span class="skeleton-box ${index === 0 ? "lg" : ""}"></span>`)
    .join("")}</div>`;
}

export function formatPrice(value, symbol = "USD") {
  const digits = symbol === "BTC-USD" || symbol === "USD" ? 0 : 2;
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSignedPct(value) {
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
}

export function formatMarketCap(value) {
  if (!value) return "N/A";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${Number(value).toFixed(0)}`;
}

export function formatVolume(value) {
  if (!value) return "N/A";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return `${value}`;
}

export function formatInsightValue(value) {
  if (value == null) return "--";
  if (typeof value === "object") {
    if ("fmt" in value && value.fmt) return String(value.fmt);
    if ("longFmt" in value && value.longFmt) return String(value.longFmt);
    if ("raw" in value && value.raw != null) return String(value.raw);
  }
  return String(value);
}

export function formatExpiry(value) {
  if (!value) return "Nearest";
  return new Date(Number(value) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

export function tabularValue(content, { currentPrice, previousPrice, flashKey, className = "" } = {}) {
  const attributes = [];
  if (currentPrice != null) attributes.push(`data-price-current="${Number(currentPrice)}"`);
  if (previousPrice != null) attributes.push(`data-price-previous="${Number(previousPrice)}"`);
  if (flashKey) attributes.push(`data-price-key="${flashKey}"`);
  return `<span class="tabular-nums ${className}" ${attributes.join(" ")}>${content}</span>`;
}

export function applyPriceTone(element, currentPrice, previousPrice) {
  if (!element || currentPrice == null || previousPrice == null) return;
  if (Number(currentPrice) === Number(previousPrice)) return;
  const nextClass = Number(currentPrice) > Number(previousPrice) ? "flash-up" : "flash-down";
  const signature = `${Number(previousPrice)}:${Number(currentPrice)}`;
  if (element.dataset.priceFlashSignature === signature) return;
  element.classList.remove("flash-up", "flash-down");
  void element.offsetWidth;
  element.classList.add(nextClass);
  element.dataset.priceFlashSignature = signature;
}
````

## `src/Renderers/BriefingRenderer.js`

````javascript
import { formatPrice, formatSignedPct, tabularValue } from "./Common.js";

export function createBriefingRenderer(context) {
  const { state, buildQuote, currentTimeShort, calculatePulse } = context;

  return function renderBriefing(panel) {
    const primary = state.panelSymbols[panel] || state.watchlist[0] || "SPY";
    const primaryQuote = buildQuote(primary);
    const pulse = calculatePulse();
    const breadth = pulse.gainers + pulse.losers ? (pulse.gainers / (pulse.gainers + pulse.losers)) * 100 : 50;
    const volatility = state.overviewQuotes.length
      ? state.overviewQuotes.reduce((sum, quote) => sum + Math.abs(Number(quote.changePct || 0)), 0) / state.overviewQuotes.length
      : 0;
    const watchedLeaders = state.watchlist
      .map((symbol) => buildQuote(symbol))
      .filter(Boolean)
      .sort((left, right) => Math.abs(right.changePct) - Math.abs(left.changePct))
      .slice(0, 4);

    return `
      <section class="stack stack-lg">
        <article class="card briefing-hero">
          <header class="card-head card-head-split">
            <h4>Meridian Briefing</h4>
            <small>${currentTimeShort()} snapshot</small>
          </header>
          <div class="briefing-grid">
            <div class="brief-metric">
              <span>Regime</span>
              <strong>${state.marketPhase}</strong>
              <small>${state.health.ok ? "Live feed connected" : "Feed reconnecting"}</small>
            </div>
            <div class="brief-metric">
              <span>Breadth</span>
              <strong>${tabularValue(`${breadth.toFixed(0)}%`)}</strong>
              <small>${pulse.gainers} up · ${pulse.losers} down</small>
            </div>
            <div class="brief-metric">
              <span>Volatility pulse</span>
              <strong>${tabularValue(`${volatility.toFixed(2)}%`)}</strong>
              <small>Avg absolute move</small>
            </div>
            <div class="brief-metric">
              <span>Anchor</span>
              <strong>${primary}</strong>
              <small>${primaryQuote ? tabularValue(formatPrice(primaryQuote.price, primary), { flashKey: `quote:${primary}:price`, currentPrice: primaryQuote.price }) : "Fetching quote"}</small>
            </div>
          </div>
        </article>

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split"><h4>Signal board</h4><small>What to check next</small></header>
            <div class="stack-list compact-list">
              <button class="list-row" type="button" data-load-module="chart" data-target-symbol="${primary}" data-target-panel="${panel}"><strong>${primary} trend</strong><small>Review structure and range</small></button>
              <button class="list-row" type="button" data-news-filter="${primary}"><strong>${primary} headlines</strong><small>Scan catalysts and tone</small></button>
              <button class="list-row" type="button" data-load-module="portfolio" data-target-panel="${panel}"><strong>Risk check</strong><small>Open positions and alerts</small></button>
              <button class="list-row" type="button" data-load-module="macro" data-target-panel="${panel}"><strong>Macro backdrop</strong><small>Rates, FX, and regime context</small></button>
            </div>
          </article>

          <article class="card">
            <header class="card-head card-head-split"><h4>Leaders</h4><small>By absolute move</small></header>
            <div class="chip-grid compact-chip-grid">
              ${watchedLeaders.length
                ? watchedLeaders
                    .map(
                      (quote) => `<button class="chip chip-peer" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}"><strong>${quote.symbol}</strong><span>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `quote:${quote.symbol}:price`, currentPrice: quote.price })}</span><small class="${quote.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct))}</small></button>`,
                    )
                    .join("")
                : `<div class="empty-inline">Leaders will appear as market data updates.</div>`}
            </div>
          </article>
        </div>
      </section>
    `;
  };
}
````

## `src/Renderers/CalculatorRenderer.js`

````javascript
import { tabularValue } from "./Common.js";

function calcInput(label, key, value) {
  return `<label class="calc-input"><span>${label}</span><input data-calc-key="${key}" value="${value}" /></label>`;
}

export function createCalculatorRenderer(context) {
  const { state, buildQuote, calculateBlackScholes, calculateBond } = context;

  return function renderCalculator(panel) {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const quote = buildQuote(symbol);
    const optionInput = { ...state.calculator.option, spot: quote?.price || state.calculator.option.spot };
    const option = calculateBlackScholes(optionInput);
    const bond = calculateBond(state.calculator.bond);

    return `
      <section class="split-grid">
        <article class="card">
          <header class="card-head card-head-split"><h4>Option pricing</h4><small>${symbol}</small></header>
          <div class="calc-grid">
            ${calcInput("Spot", "option.spot", optionInput.spot)}
            ${calcInput("Strike", "option.strike", state.calculator.option.strike)}
            ${calcInput("Years", "option.years", state.calculator.option.years)}
            ${calcInput("Rate %", "option.rate", state.calculator.option.rate)}
            ${calcInput("Vol %", "option.volatility", state.calculator.option.volatility)}
          </div>
          <div class="calc-results">
            <p>Call: <strong>${tabularValue(option.call.toFixed(4))}</strong></p>
            <p>Put: <strong>${tabularValue(option.put.toFixed(4))}</strong></p>
            <p>Delta: <strong>${tabularValue(option.delta.toFixed(4))}</strong></p>
            <p>Gamma: <strong>${tabularValue(option.gamma.toFixed(6))}</strong></p>
          </div>
        </article>
        <article class="card">
          <header class="card-head"><h4>Bond pricing</h4></header>
          <div class="calc-grid">
            ${calcInput("Face", "bond.face", state.calculator.bond.face)}
            ${calcInput("Coupon %", "bond.coupon", state.calculator.bond.coupon)}
            ${calcInput("YTM %", "bond.ytm", state.calculator.bond.ytm)}
            ${calcInput("Maturity", "bond.maturity", state.calculator.bond.maturity)}
            ${calcInput("Frequency", "bond.frequency", state.calculator.bond.frequency)}
          </div>
          <div class="calc-results">
            <p>Price: <strong>${tabularValue(bond.price.toFixed(4))}</strong></p>
            <p>Duration: <strong>${tabularValue(bond.duration.toFixed(4))}</strong></p>
            <p>Mod duration: <strong>${tabularValue(bond.modifiedDuration.toFixed(4))}</strong></p>
            <p>Convexity: <strong>${tabularValue(bond.convexity.toFixed(4))}</strong></p>
          </div>
        </article>
      </section>
    `;
  };
}
````

## `src/Renderers/HeatmapRenderer.js`

````javascript
import { formatSignedPct, tabularValue } from "./Common.js";

export function createHeatmapRenderer(context) {
  const { heatmapGroups, buildQuote } = context;

  return function renderHeatmap(panel) {
    return `
      <section class="heatmap-grid">
        ${Object.entries(heatmapGroups)
          .map(
            ([sector, symbols]) => `
              <article class="card">
                <header class="card-head card-head-split"><h4>${sector}</h4><small>${symbols.length} names</small></header>
                <div class="tile-grid">
                  ${symbols
                    .map((symbol) => {
                      const quote = buildQuote(symbol);
                      const tone = (quote?.changePct || 0) >= 0 ? "positive" : "negative";
                      return `<button class="tile ${tone}" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}"><strong>${symbol}</strong><small>${quote ? tabularValue(formatSignedPct(quote.changePct)) : "--"}</small></button>`;
                    })
                    .join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </section>
    `;
  };
}
````

## `src/Renderers/HomeRenderer.js`

````javascript
import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

function buildCommandSuggestions({ authEnabled, state, buildQuote, panel }) {
  const symbol = state.panelSymbols[panel] || state.watchlist[0] || "AAPL";
  const suggestions = [];

  if (authEnabled && !state.user) {
    suggestions.push({ label: "Sign in and sync", detail: "Back up your workspace to the backend", command: "LOGIN" });
  } else if (authEnabled && state.user) {
    suggestions.push({ label: "Open account settings", detail: "Update profile, password, or account state", command: "SETTINGS" });
  } else {
    suggestions.push({ label: "Local workspace mode", detail: "Everything is running without login right now", command: "SAVE" });
  }

  suggestions.push({ label: "Open Meridian Briefing", detail: "See regime, breadth, and signal board", command: "BRIEF" });

  if (!state.alerts.length) {
    const threshold = Math.max(1, Math.round((buildQuote(symbol)?.price || 100) * 1.03));
    suggestions.push({ label: `Create ${symbol} alert`, detail: "Track a price level for this symbol", command: `ALERT ${symbol} ${threshold}` });
  } else {
    suggestions.push({ label: "Review positions and alerts", detail: "Check triggers and current exposure", command: "PORT" });
  }

  if (state.watchlist.length < 10) {
    suggestions.push({ label: "Broaden your watchlist", detail: "Add a benchmark like SPY", command: "WATCH SPY" });
  }

  suggestions.push({ label: "Show more suggestions", detail: "Refresh this panel with quick ideas", command: "SUGGEST" });
  return suggestions.slice(0, 5);
}

export function createHomeRenderer(context) {
  const { state, buildQuote, calculatePortfolioSummary, authEnabled } = context;

  return function renderHome(panel) {
    const portfolio = calculatePortfolioSummary();
    const top = state.watchlist.slice(0, 6).map(buildQuote).filter(Boolean);
    const recentCommands = state.commandHistory.slice(0, 5);
    const primarySymbol = state.panelSymbols[panel] || state.watchlist[0] || "AAPL";
    const suggestions = buildCommandSuggestions({ authEnabled, state, buildQuote, panel });

    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home">
          <article class="card stat-card glow-card">
            <span>Watchlist</span>
            <strong>${tabularValue(state.watchlist.length)}</strong>
            <small>${state.watchlist.slice(0, 4).join(" · ")}</small>
          </article>
          <article class="card stat-card glow-card">
            <span>Portfolio value</span>
            <strong>${tabularValue(formatPrice(portfolio.value, "USD"))}</strong>
            <small class="${portfolio.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${portfolio.pnl >= 0 ? "+" : ""}${formatPrice(portfolio.pnl, "USD")}`)}</small>
          </article>
          <article class="card stat-card glow-card">
            <span>Market phase</span>
            <strong>${state.marketPhase}</strong>
            <small>${state.health.ok ? state.health.server : "Live feed reconnecting"}</small>
          </article>
        </div>

        <article class="card card-feature">
          <header class="card-head card-head-split">
            <h4>Quick start</h4>
            <small>Open what you need in one click</small>
          </header>
          <div class="action-grid">
            <button class="action-tile" type="button" data-load-module="quote" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Quote</strong><span>Open ${primarySymbol} detail</span></button>
            <button class="action-tile" type="button" data-load-module="chart" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Chart</strong><span>See price action</span></button>
            <button class="action-tile" type="button" data-load-module="options" data-target-symbol="${primarySymbol}" data-target-panel="${panel}"><strong>Options</strong><span>Load nearest chain</span></button>
            <button class="action-tile" type="button" data-news-filter="${primarySymbol}"><strong>News</strong><span>Filter headlines for ${primarySymbol}</span></button>
          </div>
        </article>

        <article class="card">
          <header class="card-head card-head-split"><h4>Watchlist movers</h4><small>${top.length} active symbols</small></header>
          <div class="chip-grid">
            ${top
              .map(
                (quote) => `
                  <button class="chip" type="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">
                    <strong>${quote.symbol}</strong>
                    <span>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `quote:${quote.symbol}:price`, currentPrice: quote.price })}</span>
                    <small class="${quote.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct))}</small>
                  </button>
                `,
              )
              .join("")}
          </div>
        </article>

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split"><h4>Recent commands</h4><small>Use again</small></header>
            <div class="stack-list compact-list">
              ${recentCommands.length ? recentCommands.map((item) => `<button class="list-row" type="button" data-autocomplete="${item}"><strong>${item}</strong><small>Run again</small></button>`).join("") : `<div class="empty-inline">Commands you run will show up here.</div>`}
            </div>
          </article>
          <article class="card">
            <header class="card-head card-head-split"><h4>Live pulse</h4><small>${state.marketPhase}</small></header>
            <div class="pulse-grid">
              ${state.overviewQuotes.length
                ? state.overviewQuotes
                    .slice(0, 4)
                    .map((quote) => `<div class="pulse-card is-live"><span>${quote.symbol}</span><strong>${tabularValue(formatPrice(quote.price, quote.symbol), { flashKey: `overview:${quote.symbol}:price`, currentPrice: quote.price })}</strong><small class="${Number(quote.changePct || 0) >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct || 0))}</small></div>`)
                    .join("")
                : `<div class="pulse-card">${loadingSkeleton(3)}</div>`}
            </div>
          </article>
        </div>

        <article class="card">
          <header class="card-head card-head-split"><h4>Suggested next steps</h4><small>Picked from your current view</small></header>
          <div class="stack-list compact-list">
            ${suggestions.map((item) => `<button class="list-row" type="button" data-suggest-command="${item.command}"><strong>${item.label}</strong><small>${item.detail}</small></button>`).join("")}
          </div>
        </article>
      </section>
    `;
  };
}
````

## `src/Renderers/MacroRenderer.js`

````javascript
import { loadingSkeleton, tabularValue } from "./Common.js";

export function createMacroRenderer(context) {
  const { state, macroDefaults } = context;

  return function renderMacro() {
    const fxCards = macroDefaults.currencies
      .map((currency) => ({ currency, rate: state.fxRates[currency] }))
      .filter((item) => item.rate)
      .map(
        (item) => `<article class="card fx-card"><span>USD/${item.currency}</span><strong>${tabularValue(Number(item.rate).toFixed(4), { flashKey: `fx:${item.currency}`, currentPrice: item.rate })}</strong></article>`,
      )
      .join("");

    return `
      <section class="stack stack-lg">
        <div class="toolbar">
          <button class="btn btn-primary" type="button" data-refresh-all>Refresh macro</button>
        </div>
        <div class="card-grid card-grid-home">
          <article class="card stat-card"><span>Market phase</span><strong>${state.marketPhase}</strong><small>New York session</small></article>
          <article class="card stat-card"><span>Server</span><strong>${state.health.ok ? "Live" : "Offline"}</strong><small>${state.health.server}</small></article>
          <article class="card stat-card"><span>FX crosses</span><strong>${tabularValue(Object.keys(state.fxRates).length)}</strong><small>USD base pairs</small></article>
        </div>
        <article class="card">
          <header class="card-head"><h4>Yield curve</h4></header>
          <div class="curve-grid">
            ${macroDefaults.curve.map((point) => `<div class="curve-col"><div class="curve-bar" style="height:${point.yield * 18}px"></div><strong>${tabularValue(`${point.yield.toFixed(2)}%`)}</strong><small>${point.tenor}</small></div>`).join("")}
          </div>
        </article>
        <article class="card">
          <header class="card-head"><h4>FX rates</h4></header>
          <div class="fx-grid">${fxCards || loadingSkeleton(4)}</div>
        </article>
      </section>
    `;
  };
}
````

## `src/Renderers/NewsRenderer.js`

````javascript
import { loadingSkeleton } from "./Common.js";

function sentimentClassForHeadline(headline) {
  const content = String(headline || "").toUpperCase();
  const positiveTerms = ["BULLISH", "GROWTH", "SURGE"];
  const negativeTerms = ["DROP", "MISS", "RISK"];

  if (positiveTerms.some((term) => content.includes(term))) return "news-title-positive";
  if (negativeTerms.some((term) => content.includes(term))) return "news-title-negative";
  return "";
}

export function createNewsRenderer(context) {
  const { state, getRenderableNewsItems, extractHeadlineSymbol, emptyState } = context;

  return function renderNews(panel) {
    const quickFilters = ["ALL", ...new Set([state.panelSymbols[panel], ...Object.values(state.panelSymbols), ...state.watchlist.slice(0, 3)].filter(Boolean))].slice(0, 6);
    const items = getRenderableNewsItems(state.newsFilter);

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          <button class="btn btn-primary" type="button" data-refresh-all>Refresh feed</button>
          ${quickFilters.map((item) => `<button class="range-pill ${item === state.newsFilter ? "is-active" : ""}" type="button" data-news-filter="${item}">${item}</button>`).join("")}
        </div>
        ${items.length
          ? items
              .slice(0, 16)
              .map((item) => {
                const relatedSymbol = extractHeadlineSymbol(item.headline);
                const titleSentimentClass = sentimentClassForHeadline(item.headline);
                return `
                  <article class="news-item">
                    <div class="news-meta">
                      <span class="news-source">${item.source}</span>
                      <span class="news-time">${item.time}</span>
                      <span class="news-sentiment ${String(item.sentiment || "Neutral").toLowerCase()}">${item.sentiment || "Neutral"}</span>
                    </div>
                    <div class="news-row">
                      <a href="${item.link}" target="_blank" rel="noopener" class="news-title ${titleSentimentClass}">${item.headline}</a>
                      ${relatedSymbol ? `<button class="mini-link" type="button" data-load-module="quote" data-target-symbol="${relatedSymbol}" data-target-panel="${panel}">${relatedSymbol}</button>` : ""}
                    </div>
                  </article>
                `;
              })
              .join("")
          : state.newsItems.length
            ? emptyState(`No headlines matched ${state.newsFilter}.`)
            : `<article class="card">${loadingSkeleton(5)}</article>`}
      </section>
    `;
  };
}
````

## `src/Renderers/OptionsRenderer.js`

````javascript
import { formatExpiry, formatPrice, loadingSkeleton, tabularValue } from "./Common.js";

function renderOptionsTable(contracts) {
  if (!contracts.length) return loadingSkeleton(6);
  return `
    <table class="data-table compact financial-data-table">
      <thead><tr><th>Strike</th><th>Bid</th><th>Ask</th><th>Last</th><th>OI</th></tr></thead>
      <tbody>
        ${contracts
          .slice(0, 12)
          .map(
            (contract) => `
              <tr>
                <td>${tabularValue(contract.strike?.fmt || contract.strike || "--")}</td>
                <td>${tabularValue(contract.bid?.fmt || contract.bid || "--")}</td>
                <td>${tabularValue(contract.ask?.fmt || contract.ask || "--")}</td>
                <td>${tabularValue(contract.lastPrice?.fmt || contract.lastPrice || "--")}</td>
                <td>${tabularValue(contract.openInterest?.fmt || contract.openInterest || "--")}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function createOptionsRenderer(context) {
  const { state, optionsKey } = context;

  return function renderOptions(panel) {
    const symbol = state.panelSymbols[panel] || state.optionsSelection.symbol;
    const expiration = state.optionsSelection.expiration || "nearest";
    const chain = state.optionsCache.get(optionsKey(symbol, expiration)) || state.optionsCache.get(optionsKey(symbol, "nearest"));
    const expirations = chain?.expirations || [];

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          <button class="btn btn-ghost" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}">Quote</button>
          <button class="btn btn-ghost" type="button" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">Chart</button>
          <select data-options-expiry="${panel}">
            <option value="">Nearest expiry</option>
            ${expirations.slice(0, 8).map((value) => `<option value="${value}" ${String(value) === String(state.optionsSelection.expiration || "") ? "selected" : ""}>${formatExpiry(value)}</option>`).join("")}
          </select>
          <button class="btn btn-primary" type="button" data-refresh-options="${panel}:${symbol}">Refresh options</button>
        </div>
        <div class="card-grid card-grid-home">
          <article class="card stat-card"><span>Underlying</span><strong>${symbol}</strong><small>${chain?.spot ? tabularValue(formatPrice(chain.spot, symbol), { flashKey: `quote:${symbol}:price`, currentPrice: chain.spot }) : "Waiting for chain"}</small></article>
          <article class="card stat-card"><span>Calls</span><strong>${tabularValue(chain?.calls?.length || 0)}</strong><small>Loaded contracts</small></article>
          <article class="card stat-card"><span>Puts</span><strong>${tabularValue(chain?.puts?.length || 0)}</strong><small>Loaded contracts</small></article>
        </div>
        <div class="split-grid">
          <article class="card">
            <header class="card-head"><h4>Calls</h4></header>
            ${renderOptionsTable(chain?.calls || [])}
          </article>
          <article class="card">
            <header class="card-head"><h4>Puts</h4></header>
            ${renderOptionsTable(chain?.puts || [])}
          </article>
        </div>
      </section>
    `;
  };
}
````

## `src/Renderers/PortfolioRenderer.js`

````javascript
import { formatPrice, formatSignedPct, loadingSkeleton, tabularValue } from "./Common.js";

export function createPortfolioRenderer(context) {
  const { enrichPositions, calculatePortfolioSummary } = context;

  return function renderPortfolio(panel) {
    const rows = enrichPositions();
    const totals = calculatePortfolioSummary();
    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home">
          <article class="card stat-card"><span>Value</span><strong>${tabularValue(formatPrice(totals.value, "USD"))}</strong></article>
          <article class="card stat-card"><span>P/L</span><strong class="${totals.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${totals.pnl >= 0 ? "+" : ""}${formatPrice(totals.pnl, "USD")}`)}</strong></article>
          <article class="card stat-card"><span>Return</span><strong class="${totals.pnlPct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(totals.pnlPct))}</strong></article>
        </div>
        <form id="addPositionForm" class="add-pos-form">
          <input name="symbol" placeholder="Ticker" required />
          <input name="shares" type="number" step="0.01" placeholder="Shares" required />
          <input name="cost" type="number" step="0.01" placeholder="Cost" required />
          <button class="btn btn-primary" type="submit">Add position</button>
        </form>
        ${rows.length ? `
          <table class="data-table data-table-dense financial-data-table">
            <thead><tr><th>Ticker</th><th>Shares</th><th>Cost</th><th>Mark</th><th>Value</th><th>P/L</th><th></th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                    <tr>
                      <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${panel}">${row.symbol}</button></td>
                      <td>${tabularValue(row.shares)}</td>
                      <td>${tabularValue(formatPrice(row.cost, row.symbol))}</td>
                      <td>${tabularValue(formatPrice(row.price, row.symbol), { flashKey: `quote:${row.symbol}:price`, currentPrice: row.price })}</td>
                      <td>${tabularValue(formatPrice(row.value, "USD"))}</td>
                      <td class="${row.pnl >= 0 ? "positive" : "negative"}">${tabularValue(`${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}`)}</td>
                      <td class="row-actions">
                        <button class="btn btn-ghost btn-inline" type="button" data-load-module="options" data-target-symbol="${row.symbol}" data-target-panel="${panel}">Options</button>
                        <button class="btn btn-ghost btn-inline" type="button" data-create-alert="${row.symbol}:>=:${(row.price * 1.04).toFixed(2)}">Alert</button>
                        <button class="btn btn-ghost btn-inline" type="button" data-remove-position="${row.symbol}">Remove</button>
                      </td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>` : `<article class="card">${loadingSkeleton(4)}</article>`}
      </section>
    `;
  };
}
````

## `src/Renderers/QuoteRenderer.js`

````javascript
import {
  emptyState,
  formatInsightValue,
  formatMarketCap,
  formatPrice,
  formatSignedPct,
  formatVolume,
  loadingSkeleton,
  tabularValue,
} from "./Common.js";

export function createQuoteRenderer(context) {
  const { state, buildQuote, findRelatedSymbols } = context;

  return function renderQuote(panel) {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const quote = buildQuote(symbol);
    if (!quote) {
      if (!state.health?.ok) {
        return `<section class="stack stack-lg">${emptyState(`Offline: ${symbol} quote feed unavailable. Try SYNC ${symbol} once connection resumes.`)}</section>`;
      }
      return `<section class="stack">${loadingSkeleton(5)}</section>`;
    }

    const alertThreshold = Math.max(1, quote.price * 1.03);
    const peers = findRelatedSymbols(symbol).slice(0, 4);
    const deepDive = state.deepDiveCache.get(symbol);
    const profile = deepDive?.profile || {};
    const financials = deepDive?.financials || {};
    const isAnalyzing = state.deepDiveLoading.has(symbol);

    return `
      <section class="stack stack-lg">
        <div class="quote-action-row">
          <button class="btn btn-primary" type="button" data-analyze-symbol="${symbol}">[ ANALYZE ]</button>
          <button class="btn btn-ghost" type="button" data-open-news-symbol="${symbol}">[ NEWS ]</button>
          <button class="btn btn-ghost" type="button" data-sync-symbol="${symbol}">[ SYNC ]</button>
        </div>

        <div class="toolbar">
          <button class="btn btn-ghost" type="button" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">Open chart</button>
          <button class="btn btn-ghost" type="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Open options</button>
          <button class="btn btn-ghost" type="button" data-news-filter="${symbol}">Related news</button>
          <button class="btn btn-ghost" type="button" data-watch-symbol="${symbol}">Add to watchlist</button>
          <button class="btn btn-primary" type="button" data-create-alert="${symbol}:>=:${alertThreshold.toFixed(2)}">Set 3% alert</button>
        </div>

        <article class="card quote-card quote-card-feature">
          <div class="quote-hero">
            <div>
              <span class="eyebrow">${quote.exchange}</span>
              <h4>${quote.name}</h4>
              <div class="quote-row">
                <strong>${tabularValue(formatPrice(quote.price, symbol), { flashKey: `quote:${symbol}:price`, currentPrice: quote.price })}</strong>
                <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(quote.changePct))}</span>
              </div>
              <p>${quote.sector} · ${quote.universe}</p>
            </div>
            <div class="quote-meta-grid">
              <div><span>Volume</span><strong>${tabularValue(formatVolume(quote.volume))}</strong></div>
              <div><span>Market cap</span><strong>${tabularValue(formatMarketCap(quote.marketCap))}</strong></div>
              <div><span>High</span><strong>${tabularValue(formatPrice(quote.dayHigh, symbol))}</strong></div>
              <div><span>Low</span><strong>${tabularValue(formatPrice(quote.dayLow, symbol))}</strong></div>
            </div>
          </div>
        </article>

        <table class="data-table financial-data-table">
          <tbody>
            <tr><td>Previous close</td><td>${tabularValue(formatPrice(quote.previousClose, symbol))}</td><td>Day high</td><td>${tabularValue(formatPrice(quote.dayHigh, symbol))}</td></tr>
            <tr><td>Day low</td><td>${tabularValue(formatPrice(quote.dayLow, symbol))}</td><td>Volume</td><td>${tabularValue(formatVolume(quote.volume))}</td></tr>
            <tr><td>Market cap</td><td>${tabularValue(formatMarketCap(quote.marketCap))}</td><td>Change</td><td class="${quote.change >= 0 ? "positive" : "negative"}">${tabularValue(`${quote.change >= 0 ? "+" : ""}${Number(quote.change).toFixed(2)}`)}</td></tr>
          </tbody>
        </table>

        <article class="card">
          <header class="card-head card-head-split"><h4>Deep insight</h4><small>${deepDive?.provider === "rapidapi" ? "live modules" : "provisioned research"}</small></header>
          ${isAnalyzing
            ? loadingSkeleton(4)
            : deepDive
              ? `
                <div class="deep-dive-grid">
                  <div class="insight-block"><span>Sector</span><strong>${profile.sector || quote.sector}</strong></div>
                  <div class="insight-block"><span>Industry</span><strong>${profile.industry || "N/A"}</strong></div>
                  <div class="insight-block"><span>Target mean</span><strong>${tabularValue(formatInsightValue(financials.targetMeanPrice))}</strong></div>
                  <div class="insight-block"><span>Recommendation</span><strong>${formatInsightValue(financials.recommendationKey)}</strong></div>
                  <div class="insight-block"><span>Total revenue</span><strong>${tabularValue(formatInsightValue(financials.totalRevenue))}</strong></div>
                  <div class="insight-block"><span>Free cash flow</span><strong>${tabularValue(formatInsightValue(financials.freeCashflow))}</strong></div>
                </div>
                <p class="insight-summary">${profile.longBusinessSummary || profile.longBusinessDescription || deepDive.reason || "Run analyze to load deeper company context."}</p>
              `
              : `<div class="empty-inline">Run ANALYZE to pull profile, financials, and ticker-specific news.</div>`}
        </article>

        <article class="card">
          <header class="card-head card-head-split"><h4>Similar names</h4><small>${quote.sector}</small></header>
          <div class="chip-grid compact-chip-grid">
            ${peers.map((peer) => `<button class="chip chip-peer" type="button" data-load-module="quote" data-target-symbol="${peer.symbol}" data-target-panel="${panel}"><strong>${peer.symbol}</strong><span>${tabularValue(formatPrice(peer.price, peer.symbol), { flashKey: `quote:${peer.symbol}:price`, currentPrice: peer.price })}</span><small class="${peer.changePct >= 0 ? "positive" : "negative"}">${tabularValue(formatSignedPct(peer.changePct))}</small></button>`).join("") || `<div class="empty-inline">No comparable names found yet.</div>`}
          </div>
        </article>
      </section>
    `;
  };
}
````

## `src/Renderers/RulesRenderer.js`

````javascript
import { tabularValue } from "./Common.js";

export function createRulesRenderer(context) {
  const { state } = context;

  const formatSystemTime = (value) =>
    new Date(value || Date.now()).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  return function renderRules() {
    const rows = Array.isArray(state.activeRules) ? state.activeRules : [];
    const history = Array.isArray(state.notifications) ? state.notifications.slice(0, 20) : [];

    return `
      <section class="stack stack-lg">
        <article class="card">
          <header class="card-head card-head-split"><h4>Active Rules</h4><small>${rows.length} loaded</small></header>
          ${rows.length
            ? `
              <table class="data-table data-table-dense financial-data-table">
                <thead><tr><th>Symbol</th><th>Condition</th><th>Message</th><th></th></tr></thead>
                <tbody>
                  ${rows
                    .map(
                      (rule) => `
                        <tr>
                          <td>${rule.symbol}</td>
                          <td>${tabularValue(`${rule.op} ${rule.limit}`)}</td>
                          <td>${rule.msg}</td>
                          <td><button class="btn btn-ghost btn-inline" type="button" data-remove-rule="${rule.id}">Delete</button></td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            `
            : `<div class="empty-state">No rules yet. Try: IF AAPL > 220 THEN Breakout!</div>`}
        </article>

        <article class="card">
          <header class="card-head card-head-split"><h4>Trigger History</h4><small>${history.length} events</small></header>
          ${history.length
            ? `
              <div class="system-log">
                ${history
                  .map((item) => {
                    const time = formatSystemTime(item.triggeredAt);
                    const symbol = String(item.symbol || "--").toUpperCase();
                    const condition = `${item.op || ""} ${item.limit ?? ""}`.trim();
                    const message = item.msg || "Condition Met";
                    const price = item.price != null ? ` @ ${Number(item.price).toFixed(2)}` : "";
                    const suffix = [condition, message].filter(Boolean).join(" · ");
                    return `<div class="system-log-entry"><span class="system-log-line">[${time}] ${symbol} ${suffix}${price}</span></div>`;
                  })
                  .join("")}
              </div>
            `
            : `<div class="empty-state">No triggers yet. Fired rules will appear here in real-time.</div>`}
        </article>
      </section>
    `;
  };
}
````

## `src/Renderers/ScreenerRenderer.js`

````javascript
import { formatPrice, formatSignedPct, tabularValue } from "./Common.js";

function filterUniverse(universe, filters) {
  return universe.filter((item) => {
    if (filters.universe && item.universe !== filters.universe) return false;
    if (filters.sector && item.sector !== filters.sector) return false;
    if (filters.search) {
      const query = filters.search.toLowerCase();
      return item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    }
    return true;
  });
}

export function createScreenerRenderer(context) {
  const { state, universe, buildQuote } = context;

  return function renderScreener(panel) {
    const filters = state.screenerFilters[panel];
    const sectors = [...new Set(universe.map((item) => item.sector))].sort();
    const universes = [...new Set(universe.map((item) => item.universe))].sort();
    const results = filterUniverse(universe, filters).slice(0, 80);

    return `
      <section class="stack stack-lg">
        <div class="screener-filters">
          <select data-screener-universe="${panel}">
            <option value="">All universes</option>
            ${universes.map((value) => `<option value="${value}" ${value === filters.universe ? "selected" : ""}>${value}</option>`).join("")}
          </select>
          <select data-screener-sector="${panel}">
            <option value="">All sectors</option>
            ${sectors.map((value) => `<option value="${value}" ${value === filters.sector ? "selected" : ""}>${value}</option>`).join("")}
          </select>
          <input data-screener-search="${panel}" value="${filters.search}" placeholder="Search by symbol or name" />
        </div>
        <table class="data-table data-table-dense financial-data-table">
          <thead><tr><th>Ticker</th><th>Name</th><th>Sector</th><th>Universe</th><th>Price</th><th>Change</th><th></th></tr></thead>
          <tbody>
            ${results
              .map((item) => {
                const quote = buildQuote(item.symbol);
                const price = quote?.price || item.seedPrice || 0;
                return `
                  <tr>
                    <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${item.symbol}" data-target-panel="${panel}">${item.symbol}</button></td>
                    <td>${item.name}</td>
                    <td>${item.sector}</td>
                    <td>${item.universe}</td>
                    <td>${tabularValue(formatPrice(price, item.symbol), { flashKey: `quote:${item.symbol}:price`, currentPrice: price })}</td>
                    <td class="${(quote?.changePct || 0) >= 0 ? "positive" : "negative"}">${quote ? tabularValue(formatSignedPct(quote.changePct)) : "--"}</td>
                    <td><button class="btn btn-ghost btn-inline" type="button" data-load-module="chart" data-target-symbol="${item.symbol}" data-target-panel="${panel}">Chart</button></td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </section>
    `;
  };
}
````

## `src/StateStore.js`

````javascript
const STATE_UPDATED = "STATE_UPDATED";

function isObjectLike(value) {
  return value !== null && typeof value === "object";
}

function clonePath(path, key) {
  return [...path, String(key)];
}

export function createStateStore(initialState = {}) {
  const eventTarget = new EventTarget();
  const proxyCache = new WeakMap();
  let lastMutation = null;

  const emit = (detail) => {
    lastMutation = detail;
    const event = new CustomEvent(STATE_UPDATED, { detail });
    eventTarget.dispatchEvent(event);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent(STATE_UPDATED, { detail }));
    }
  };

  const wrapCollection = (target, path) => {
    if (proxyCache.has(target)) return proxyCache.get(target);

    const proxy = new Proxy(target, {
      get(collection, property, receiver) {
        const value = Reflect.get(collection, property, receiver);

        if (collection instanceof Map && ["set", "delete", "clear"].includes(property)) {
          return (...args) => {
            const key = args[0];
            const previousValue = property === "set" || property === "delete" ? collection.get(key) : undefined;
            const result = Map.prototype[property].apply(collection, args);
            const nextValue = property === "set" ? collection.get(key) : undefined;
            emit({
              path: property === "clear" ? path : clonePath(path, key),
              property,
              key,
              value: nextValue,
              previousValue,
              oldState: previousValue,
              newState: nextValue,
              target: collection,
            });
            return result;
          };
        }

        if (collection instanceof Set && ["add", "delete", "clear"].includes(property)) {
          return (...args) => {
            const beforeSize = collection.size;
            const result = Set.prototype[property].apply(collection, args);
            emit({ path, property, value: args[0], previousValue: beforeSize, target: collection });
            return result;
          };
        }

        if (collection instanceof Map && property === "get") {
          return (key) => {
            const result = Map.prototype.get.call(collection, key);
            return isObjectLike(result) ? createReactive(result, clonePath(path, key)) : result;
          };
        }

        return isObjectLike(value) ? createReactive(value, clonePath(path, property)) : value;
      },
    });

    proxyCache.set(target, proxy);
    return proxy;
  };

  const createReactive = (target, path = []) => {
    if (!isObjectLike(target)) return target;
    if (target instanceof Map || target instanceof Set) {
      return wrapCollection(target, path);
    }
    if (proxyCache.has(target)) return proxyCache.get(target);

    const proxy = new Proxy(target, {
      get(currentTarget, property, receiver) {
        const value = Reflect.get(currentTarget, property, receiver);
        return isObjectLike(value) ? createReactive(value, clonePath(path, property)) : value;
      },
      set(currentTarget, property, value, receiver) {
        const previousValue = currentTarget[property];
        const nextValue = isObjectLike(value) ? createReactive(value, clonePath(path, property)) : value;
        const didSet = Reflect.set(currentTarget, property, nextValue, receiver);
        if (didSet && previousValue !== value) {
          emit({
            path: clonePath(path, property),
            property,
            value,
            previousValue,
            oldState: previousValue,
            newState: value,
            target: currentTarget,
          });
        }
        return didSet;
      },
      deleteProperty(currentTarget, property) {
        const previousValue = currentTarget[property];
        const didDelete = Reflect.deleteProperty(currentTarget, property);
        if (didDelete) {
          emit({
            path: clonePath(path, property),
            property,
            value: undefined,
            previousValue,
            oldState: previousValue,
            newState: undefined,
            target: currentTarget,
          });
        }
        return didDelete;
      },
    });

    proxyCache.set(target, proxy);
    return proxy;
  };

  const state = createReactive(
    structuredClone({
      activeRules: [],
      notifications: [],
      ...initialState,
    }),
  );

  return {
    STATE_UPDATED,
    state,
    subscribe(listener) {
      eventTarget.addEventListener(STATE_UPDATED, listener);
      return () => eventTarget.removeEventListener(STATE_UPDATED, listener);
    },
    getLastMutation() {
      return lastMutation;
    },
    dispatch(detail) {
      emit(detail);
    },
  };
}

export { STATE_UPDATED };
````

## `src/services.js`

````javascript
const DIRECT_TIMEOUT = 12000;
const PROXY_GET = "https://api.allorigins.win/get?url=";
const PROXY_RAW = "https://api.allorigins.win/raw?url=";
const QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=";
const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const OPTIONS_URL = "https://query1.finance.yahoo.com/v7/finance/options/";
const RSS_TO_JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
const FX_URL = "https://open.er-api.com/v6/latest/USD";

function withTimeout(promise, timeout = DIRECT_TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out.")), timeout)),
  ]);
}

async function fetchText(url) {
  const strategies = [
    () => fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Direct fetch failed: ${response.status}`);
      return response.text();
    }),
    () => fetch(`${PROXY_RAW}${encodeURIComponent(url)}`).then((response) => {
      if (!response.ok) throw new Error(`Raw proxy failed: ${response.status}`);
      return response.text();
    }),
    () => fetch(`${PROXY_GET}${encodeURIComponent(url)}`).then(async (response) => {
      if (!response.ok) throw new Error(`Wrapped proxy failed: ${response.status}`);
      const payload = await response.json();
      if (!payload.contents) throw new Error("Wrapped proxy had no contents.");
      return payload.contents;
    }),
  ];

  let lastError = null;
  for (const strategy of strategies) {
    try {
      return await withTimeout(strategy());
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Unable to fetch remote data.");
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

export async function fetchQuotes(symbols) {
  const clean = [...new Set(symbols.filter(Boolean))];
  if (!clean.length) {
    return [];
  }

  const payload = await fetchJson(`${QUOTE_URL}${encodeURIComponent(clean.join(","))}`);
  const results = payload?.quoteResponse?.result ?? [];
  return results.map((item) => ({
    symbol: item.symbol,
    name: item.shortName ?? item.longName ?? item.symbol,
    exchange: item.fullExchangeName ?? item.exchange ?? "N/A",
    price: item.regularMarketPrice ?? item.postMarketPrice ?? item.bid ?? 0,
    changePct: item.regularMarketChangePercent ?? 0,
    change: item.regularMarketChange ?? 0,
    marketCap: item.marketCap ?? 0,
    volume: item.regularMarketVolume ?? 0,
    dayHigh: item.regularMarketDayHigh ?? item.regularMarketPrice ?? 0,
    dayLow: item.regularMarketDayLow ?? item.regularMarketPrice ?? 0,
    previousClose: item.regularMarketPreviousClose ?? item.regularMarketPrice ?? 0,
    currency: item.currency ?? "USD",
  }));
}

export async function fetchChart(symbol, range = "1mo", interval = "1d") {
  const payload = await fetchJson(`${CHART_URL}${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false`);
  const result = payload?.chart?.result?.[0];
  if (!result) {
    return [];
  }

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const closes = quote.close ?? [];

  return timestamps
    .map((timestamp, index) => ({
      timestamp,
      close: closes[index],
    }))
    .filter((item) => item.close != null);
}

export async function fetchOptions(symbol, expirationDate) {
  const suffix = expirationDate ? `?date=${encodeURIComponent(expirationDate)}` : "";
  const payload = await fetchJson(`${OPTIONS_URL}${encodeURIComponent(symbol)}${suffix}`);
  const result = payload?.optionChain?.result?.[0];
  if (!result) {
    return { expirations: [], calls: [], puts: [], spot: 0 };
  }

  const optionSet = result.options?.[0] ?? { calls: [], puts: [] };
  return {
    expirations: result.expirationDates ?? [],
    calls: (optionSet.calls ?? []).slice(0, 18),
    puts: (optionSet.puts ?? []).slice(0, 18),
    spot: result.quote?.regularMarketPrice ?? 0,
  };
}

export async function fetchNews() {
  const feeds = [
    "https://feeds.reuters.com/reuters/businessNews",
    "https://finance.yahoo.com/news/rssindex",
    "https://feeds.marketwatch.com/marketwatch/topstories/",
  ];

  const requests = feeds.map(async (feedUrl) => {
    try {
      const payload = await fetchJson(`${RSS_TO_JSON}${encodeURIComponent(feedUrl)}`);
      const items = payload.items ?? [];
      return items.slice(0, 6).map((item) => ({
        source: payload.feed?.title ?? "Feed",
        headline: item.title ?? "Untitled",
        time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
        link: item.link ?? "#",
      }));
    } catch {
      return [];
    }
  });

  const results = (await Promise.all(requests)).flat();
  return results.slice(0, 18);
}

export async function fetchFxRates() {
  const payload = await fetchJson(FX_URL);
  return payload?.rates ?? {};
}
````

## `src/marketService.js`

````javascript
import { apiRequest } from "./api.js";

export async function getStockDeepDive(ticker) {
  const symbol = String(ticker || "").trim().toUpperCase();
  if (!symbol) return null;

  try {
    return await apiRequest(`/api/market/deep-dive/${encodeURIComponent(symbol)}`);
  } catch (error) {
    console.error("Deep Dive Failed:", error);
    return null;
  }
}
````

## `src/app.js`

````javascript
import {
  appName,
  authRoles,
  buildUniverse,
  calculatorDefaults,
  commandCatalog,
  defaultAlerts,
  defaultPositions,
  defaultWatchlist,
  functionKeys,
  heatmapGroups,
  heroMetrics,
  macroDefaults,
  moduleOrder,
  moduleTitles,
  onboardingHighlights,
} from "./data.js";
import { createAccount, login, logout, restoreSessionUser } from "./auth.js";
import { fetchChart, fetchFxRates, fetchNews, fetchOptions, fetchQuotes } from "./services.js";
import { getUserState, saveUserState } from "./storage.js";

const universe = buildUniverse();
const universeMap = new Map(universe.map((item) => [item.symbol, item]));

const state = {
  user: null,
  userState: null,
  sessionStartedAt: Date.now(),
  activePanel: 1,
  panelModules: { 1: "home", 2: "quote", 3: "chart", 4: "news" },
  panelSymbols: { 1: "NVDA", 2: "AAPL", 3: "MSFT", 4: "QQQ" },
  quotes: new Map(),
  chartCache: new Map(),
  optionsCache: new Map(),
  newsItems: [],
  fxRates: {},
  watchlist: [...defaultWatchlist],
  alerts: structuredClone(defaultAlerts),
  positions: structuredClone(defaultPositions),
  commandHistory: [],
  commandHistoryIndex: -1,
  screenerFilters: {
    1: { universe: "", sector: "", search: "" },
    2: { universe: "", sector: "", search: "" },
    3: { universe: "", sector: "", search: "" },
    4: { universe: "", sector: "", search: "" },
  },
  calculator: structuredClone(calculatorDefaults),
  optionsSelection: { symbol: "AAPL", expiration: null },
  refreshCountdown: 30,
};

const elements = {
  authShell: document.querySelector("#authShell"),
  terminalApp: document.querySelector("#terminalApp"),
  loginForm: document.querySelector("#loginForm"),
  signupForm: document.querySelector("#signupForm"),
  authTabs: document.querySelector("#authTabs"),
  authMessage: document.querySelector("#authMessage"),
  heroMetrics: document.querySelector("#heroMetrics"),
  heroHighlights: document.querySelector("#heroHighlights"),
  appTitle: document.querySelector("#appTitle"),
  userBadge: document.querySelector("#userBadge"),
  userMeta: document.querySelector("#userMeta"),
  marketStatus: document.querySelector("#marketStatus"),
  clockDisplay: document.querySelector("#clockDisplay"),
  sessionClock: document.querySelector("#sessionClock"),
  activeCommandDisplay: document.querySelector("#activeCommandDisplay"),
  functionRow: document.querySelector("#functionRow"),
  watchlistRail: document.querySelector("#watchlistRail"),
  alertRail: document.querySelector("#alertRail"),
  commandInput: document.querySelector("#commandInput"),
  runCommandButton: document.querySelector("#runCommandButton"),
  autocomplete: document.querySelector("#autocomplete"),
  lastUpdated: document.querySelector("#lastUpdated"),
  refreshCountdown: document.querySelector("#refreshCountdown"),
  watchCount: document.querySelector("#watchCount"),
  alertCount: document.querySelector("#alertCount"),
  networkStatus: document.querySelector("#networkStatus"),
  logoutButton: document.querySelector("#logoutButton"),
  toast: document.querySelector("#toast"),
};

function init() {
  renderLanding();
  bindAuthEvents();
  bindWorkspaceEvents();

  const restoredUser = restoreSessionUser();
  if (restoredUser) {
    completeLogin(restoredUser);
  }

  updateClock();
  setInterval(updateClock, 1000);
  setInterval(handleRefreshCountdown, 1000);
}

function renderLanding() {
  document.title = appName;
  elements.appTitle.textContent = appName;

  const roleSelect = document.querySelector("#signupRole");
  if (roleSelect) {
    roleSelect.innerHTML = authRoles.map((role) => `<option value="${role}">${role}</option>`).join("");
  }

  elements.heroMetrics.innerHTML = heroMetrics
    .map(
      (metric) => `
        <article class="metric-card">
          <strong>${metric.value}</strong>
          <span>${metric.label}</span>
        </article>
      `,
    )
    .join("");

  elements.heroHighlights.innerHTML = onboardingHighlights
    .map(
      (item) => `
        <article class="highlight-card">
          <h3>${item.title}</h3>
          <p>${item.body}</p>
        </article>
      `,
    )
    .join("");
}

function bindAuthEvents() {
  elements.authTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-auth-tab]");
    if (!button) {
      return;
    }
    setAuthTab(button.dataset.authTab);
  });

  elements.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.loginForm);

    try {
      const user = await login({
        identifier: String(form.get("identifier") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      showAuthMessage("Login successful.", "success");
      completeLogin(user);
    } catch (error) {
      showAuthMessage(error.message, "error");
    }
  });

  elements.signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.signupForm);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password.length < 8) {
      showAuthMessage("Password must be at least 8 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showAuthMessage("Passwords do not match.", "error");
      return;
    }

    try {
      const user = await createAccount({
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        email: String(form.get("email") ?? ""),
        username: String(form.get("username") ?? ""),
        password,
        role: String(form.get("role") ?? "Other"),
      });
      showAuthMessage("Account created. Loading workspace...", "success");
      completeLogin(user);
    } catch (error) {
      showAuthMessage(error.message, "error");
    }
  });
}

function bindWorkspaceEvents() {
  elements.runCommandButton?.addEventListener("click", processCommand);
  elements.commandInput?.addEventListener("input", renderAutocomplete);
  elements.commandInput?.addEventListener("keydown", handleCommandKeydown);
  elements.functionRow?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module]");
    if (!button) {
      return;
    }
    loadModule(button.dataset.module, state.activePanel);
  });
  elements.logoutButton?.addEventListener("click", handleLogout);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("input", handleDocumentInput);
  document.addEventListener("keydown", handleGlobalHotkeys);
  document.addEventListener("submit", handleDocumentSubmit);
}

function handleDocumentClick(event) {
  const panelButton = event.target.closest("[data-panel]");
  if (panelButton) {
    setActivePanel(Number(panelButton.dataset.panel));
    return;
  }

  const cycleButton = event.target.closest("[data-panel-cycle]");
  if (cycleButton) {
    const [panel, direction] = cycleButton.dataset.panelCycle.split(":").map(Number);
    cycleModule(panel, direction);
    return;
  }

  const moduleTrigger = event.target.closest("[data-load-module]");
  if (moduleTrigger) {
    const panel = Number(moduleTrigger.dataset.targetPanel || state.activePanel);
    if (moduleTrigger.dataset.targetSymbol) {
      state.panelSymbols[panel] = moduleTrigger.dataset.targetSymbol;
    }
    loadModule(moduleTrigger.dataset.loadModule, panel);
    if (moduleTrigger.dataset.loadModule === "chart") {
      refreshChart(state.panelSymbols[panel]);
    }
    if (moduleTrigger.dataset.loadModule === "options") {
      refreshOptions(state.panelSymbols[panel], state.optionsSelection.expiration);
    }
    return;
  }

  const watchButton = event.target.closest("[data-watch-symbol]");
  if (watchButton) {
    addToWatchlist(watchButton.dataset.watchSymbol);
    return;
  }

  const removeWatch = event.target.closest("[data-remove-watch]");
  if (removeWatch) {
    removeFromWatchlist(removeWatch.dataset.removeWatch);
    return;
  }

  const removePosition = event.target.closest("[data-remove-position]");
  if (removePosition) {
    removePositionBySymbol(removePosition.dataset.removePosition);
    return;
  }

  const addAlert = event.target.closest("[data-alert-symbol]");
  if (addAlert) {
    createAlert(addAlert.dataset.alertSymbol, Number(addAlert.dataset.alertThreshold), ">=");
    return;
  }

  const autocompleteItem = event.target.closest("[data-autocomplete]");
  if (autocompleteItem) {
    elements.commandInput.value = autocompleteItem.dataset.autocomplete;
    processCommand();
    return;
  }

  if (!event.target.closest(".command-shell")) {
    hideAutocomplete();
  }
}

function handleDocumentInput(event) {
  const screenerSearch = event.target.closest("[data-screener-search]");
  if (screenerSearch) {
    const panel = Number(screenerSearch.dataset.screenerSearch);
    state.screenerFilters[panel].search = screenerSearch.value;
    renderPanel(panel);
    return;
  }

  const screenerUniverse = event.target.closest("[data-screener-universe]");
  if (screenerUniverse) {
    const panel = Number(screenerUniverse.dataset.screenerUniverse);
    state.screenerFilters[panel].universe = screenerUniverse.value;
    renderPanel(panel);
    return;
  }

  const screenerSector = event.target.closest("[data-screener-sector]");
  if (screenerSector) {
    const panel = Number(screenerSector.dataset.screenerSector);
    state.screenerFilters[panel].sector = screenerSector.value;
    renderPanel(panel);
    return;
  }

  const calcInput = event.target.closest("[data-calc-key]");
  if (calcInput) {
    setNestedCalculatorValue(calcInput.dataset.calcKey, Number(calcInput.value));
    renderAllPanels();
    return;
  }

  const quoteInput = event.target.closest("[data-quote-symbol]");
  if (quoteInput) {
    const panel = Number(quoteInput.dataset.quoteSymbol);
    state.panelSymbols[panel] = quoteInput.value.toUpperCase();
    return;
  }

  const optionInput = event.target.closest("[data-option-symbol]");
  if (optionInput) {
    const panel = Number(optionInput.dataset.optionSymbol);
    state.panelSymbols[panel] = optionInput.value.toUpperCase();
    state.optionsSelection.symbol = optionInput.value.toUpperCase();
    return;
  }

  const optionExpiry = event.target.closest("[data-option-expiry]");
  if (optionExpiry) {
    state.optionsSelection.expiration = optionExpiry.value || null;
    refreshOptions(state.optionsSelection.symbol, state.optionsSelection.expiration);
  }
}

function handleDocumentSubmit(event) {
  const addPositionForm = event.target.closest("#addPositionForm");
  if (!addPositionForm) {
    return;
  }

  event.preventDefault();
  const form = new FormData(addPositionForm);
  addPosition({
    symbol: String(form.get("symbol") ?? "").toUpperCase(),
    shares: Number(form.get("shares") ?? 0),
    cost: Number(form.get("cost") ?? 0),
  });
  addPositionForm.reset();
}

function setAuthTab(tabName) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === tabName);
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.authPanel !== tabName);
  });
}

function showAuthMessage(message, tone = "neutral") {
  elements.authMessage.textContent = message;
  elements.authMessage.dataset.tone = tone;
}

function completeLogin(user) {
  state.user = user;
  const userState = getUserState(user.id, {
    watchlist: defaultWatchlist,
    alerts: defaultAlerts,
    positions: defaultPositions,
  });

  state.userState = userState;
  state.watchlist = [...userState.watchlist];
  state.alerts = structuredClone(userState.alerts?.length ? userState.alerts : defaultAlerts);
  state.positions = structuredClone(userState.positions?.length ? userState.positions : defaultPositions);
  state.panelModules = { ...state.panelModules, ...userState.panelModules };
  state.panelSymbols = { ...state.panelSymbols, ...userState.panelSymbols };
  state.commandHistory = [...(userState.commandHistory ?? [])];
  state.sessionStartedAt = Date.now();
  state.refreshCountdown = 30;

  elements.authShell.classList.add("hidden");
  elements.terminalApp.classList.remove("hidden");
  elements.userBadge.textContent = `${user.firstName} ${user.lastName}`;
  elements.userMeta.textContent = `${user.role} · @${user.username}`;
  renderFunctionRow();
  renderRails();
  renderAllPanels();
  refreshAllData();
  elements.commandInput.focus();
  showToast(`Welcome, ${user.firstName}.`, "success");
}

function handleLogout() {
  logout();
  state.user = null;
  state.userState = null;
  elements.terminalApp.classList.add("hidden");
  elements.authShell.classList.remove("hidden");
  setAuthTab("login");
  showAuthMessage("Signed out.", "neutral");
  showToast("Signed out.", "neutral");
}

function buildQuote(symbol) {
  const base = universeMap.get(symbol);
  const live = state.quotes.get(symbol);
  if (!base && !live) {
    return null;
  }

  return {
    symbol,
    name: live?.name ?? base?.name ?? symbol,
    sector: base?.sector ?? "Unknown",
    universe: base?.universe ?? "Custom",
    exchange: live?.exchange ?? base?.exchange ?? "N/A",
    price: live?.price ?? base?.seedPrice ?? 0,
    changePct: live?.changePct ?? 0,
    change: live?.change ?? 0,
    marketCap: live?.marketCap ?? base?.marketCap ?? 0,
    volume: live?.volume ?? 0,
    dayHigh: live?.dayHigh ?? live?.price ?? base?.seedPrice ?? 0,
    dayLow: live?.dayLow ?? live?.price ?? base?.seedPrice ?? 0,
    previousClose: live?.previousClose ?? base?.seedPrice ?? 0,
  };
}

function renderFunctionRow() {
  elements.functionRow.innerHTML = functionKeys
    .map(
      (item) => `
        <button class="function-key ${state.panelModules[state.activePanel] === item.module ? "is-active" : ""}" data-module="${item.module}">
          <span>${item.key}</span>
          <strong>${item.label}</strong>
        </button>
      `,
    )
    .join("");
}

function renderRails() {
  elements.watchlistRail.innerHTML = state.watchlist
    .map((symbol) => {
      const quote = buildQuote(symbol);
      if (!quote) {
        return "";
      }
      return `
        <article class="rail-item-wrap">
          <button class="rail-item" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${state.activePanel}">
            <div>
              <strong>${symbol}</strong>
              <span>${quote.name}</span>
            </div>
            <div>
              <span>${formatPrice(quote.price, symbol)}</span>
              <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
            </div>
          </button>
          <button class="rail-remove" type="button" data-remove-watch="${symbol}">×</button>
        </article>
      `;
    })
    .join("");

  elements.alertRail.innerHTML = state.alerts
    .map(
      (alert) => `
        <article class="rail-alert ${alert.status === "triggered" ? "is-triggered" : ""}">
          <strong>${alert.symbol}</strong>
          <span>${alert.operator} ${alert.threshold}</span>
          <span>${alert.status}</span>
        </article>
      `,
    )
    .join("");

  updateStatusBar();
}

function setActivePanel(panel) {
  state.activePanel = panel;
  document.querySelectorAll("[data-panel]").forEach((node) => {
    node.classList.toggle("is-active", Number(node.dataset.panel) === panel);
  });
  renderFunctionRow();
}

function cycleModule(panel, direction) {
  const currentIndex = moduleOrder.indexOf(state.panelModules[panel]);
  const nextIndex = (currentIndex + direction + moduleOrder.length) % moduleOrder.length;
  loadModule(moduleOrder[nextIndex], panel);
}

function loadModule(moduleName, panel) {
  state.panelModules[panel] = moduleName;
  renderPanel(panel);
  setActivePanel(panel);
  persistWorkspace();
}

function renderAllPanels() {
  [1, 2, 3, 4].forEach((panel) => renderPanel(panel));
}

function renderPanel(panel) {
  const moduleName = state.panelModules[panel];
  const title = document.querySelector(`#panelTitle${panel}`);
  const content = document.querySelector(`#panelContent${panel}`);
  if (!title || !content) {
    return;
  }

  title.textContent = moduleTitles[moduleName] ?? moduleName.toUpperCase();

  const renderers = {
    home: renderHomeModule,
    quote: renderQuoteModule,
    chart: renderChartModule,
    news: renderNewsModule,
    screener: renderScreenerModule,
    heatmap: renderHeatmapModule,
    portfolio: renderPortfolioModule,
    macro: renderMacroModule,
    options: renderOptionsModule,
    calculator: renderCalculatorModule,
  };

  content.innerHTML = (renderers[moduleName] ?? renderHomeModule)(panel);
}

function renderHomeModule() {
  const topQuotes = state.watchlist.slice(0, 6).map((symbol) => buildQuote(symbol)).filter(Boolean);
  const portfolioValue = state.positions.reduce((sum, position) => {
    const quote = buildQuote(position.symbol);
    const price = quote?.price ?? position.cost;
    return sum + price * position.shares;
  }, 0);
  const portfolioBasis = state.positions.reduce((sum, position) => sum + position.cost * position.shares, 0);
  const pnl = portfolioValue - portfolioBasis;
  const signal = topQuotes.filter((quote) => quote.changePct >= 0).length >= Math.ceil(topQuotes.length / 2) ? "Risk-on" : "Risk-off";

  return `
    <section class="module-stack">
      <div class="hero-card-grid">
        <article class="hero-card"><span>Session signal</span><strong>${signal}</strong><p>Derived from the current watchlist balance.</p></article>
        <article class="hero-card"><span>Portfolio</span><strong>${formatPrice(portfolioValue, "USD")}</strong><p class="${pnl >= 0 ? "positive" : "negative"}">${pnl >= 0 ? "+" : ""}${formatPrice(pnl, "USD")}</p></article>
        <article class="hero-card"><span>Watchlist</span><strong>${state.watchlist.length}</strong><p>${state.watchlist.slice(0, 4).join(" · ")}</p></article>
        <article class="hero-card"><span>Network</span><strong>${elements.networkStatus.textContent}</strong><p>Public endpoints with local persistence and fallbacks.</p></article>
      </div>
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Market pulse</span><span>${topQuotes.length} symbols</span></div>
          <div class="market-chip-grid">
            ${topQuotes
              .map(
                (quote) => `
                  <button class="market-chip" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${state.activePanel}">
                    <strong>${quote.symbol}</strong>
                    <span>${formatPrice(quote.price, quote.symbol)}</span>
                    <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
                  </button>
                `,
              )
              .join("")}
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>Active alerts</span><span>${state.alerts.length}</span></div>
          <div class="stack-list">
            ${state.alerts
              .map(
                (alert) => `
                  <article class="stack-item ${alert.status === "triggered" ? "is-positive" : ""}">
                    <strong>${alert.symbol}</strong>
                    <span>${alert.operator} ${alert.threshold}</span>
                    <small>${alert.status}</small>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderQuoteModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const quote = buildQuote(symbol) ?? buildQuote("AAPL");
  if (!quote) {
    return emptyStateMarkup("No quote data available yet.");
  }

  return `
    <section class="module-stack">
      <div class="toolbar-row">
        <input class="input" value="${quote.symbol}" data-quote-symbol="${panel}" />
        <button class="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">Refresh</button>
        <button class="button button-muted" data-watch-symbol="${quote.symbol}">Add Watch</button>
        <button class="button button-muted" data-load-module="chart" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">Chart</button>
      </div>
      <div class="quote-hero-card">
        <div>
          <span class="quote-symbol">${quote.symbol}</span>
          <h3>${quote.name}</h3>
          <strong class="quote-price">${formatPrice(quote.price, quote.symbol)}</strong>
          <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
        </div>
        <div class="quote-side-metrics">
          <span>${quote.sector}</span>
          <span>${quote.universe}</span>
          <span>${quote.exchange}</span>
        </div>
      </div>
      <table class="terminal-table">
        <tbody>
          <tr><td>Previous close</td><td>${formatPrice(quote.previousClose, quote.symbol)}</td><td>Day high</td><td>${formatPrice(quote.dayHigh, quote.symbol)}</td></tr>
          <tr><td>Day low</td><td>${formatPrice(quote.dayLow, quote.symbol)}</td><td>Volume</td><td>${formatVolume(quote.volume)}</td></tr>
          <tr><td>Market cap</td><td>${formatMarketCap(quote.marketCap)}</td><td>Change $</td><td class="${quote.change >= 0 ? "positive" : "negative"}">${quote.change >= 0 ? "+" : ""}${Number(quote.change).toFixed(2)}</td></tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderChartModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const chartData = state.chartCache.get(buildChartKey(symbol, "1mo", "1d")) ?? [];
  const quote = buildQuote(symbol);

  return `
    <section class="module-stack">
      <div class="toolbar-row">
        <span class="toolbar-label">${symbol}</span>
        <button class="button button-muted" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">Reload</button>
      </div>
      <div class="chart-card">
        ${chartData.length ? buildLineChartSvg(chartData) : `<div class="empty-chart">Fetching chart data for ${symbol}...</div>`}
      </div>
      <div class="chart-meta-row">
        <span>${quote ? formatPrice(quote.price, quote.symbol) : "--"}</span>
        <span class="${quote && quote.changePct >= 0 ? "positive" : "negative"}">${quote ? formatSignedPct(quote.changePct) : "--"}</span>
      </div>
    </section>
  `;
}

function renderNewsModule() {
  if (!state.newsItems.length) {
    return emptyStateMarkup("Fetching news feeds...");
  }

  return `
    <section class="module-stack news-stack">
      ${state.newsItems
        .map(
          (item) => `
            <article class="news-card">
              <div class="news-meta"><span>${item.source}</span><span>${item.time}</span></div>
              <strong>${item.headline}</strong>
              <a href="${item.link ?? "#"}" target="_blank" rel="noopener">Open source</a>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderScreenerModule(panel) {
  const filters = state.screenerFilters[panel];
  const filtered = getFilteredUniverse(filters);
  const sectors = [...new Set(universe.map((item) => item.sector))].sort();
  const universes = [...new Set(universe.map((item) => item.universe))].sort();

  return `
    <section class="module-stack">
      <div class="toolbar-row wrap">
        <select class="input select" data-screener-universe="${panel}">
          <option value="">All universes</option>
          ${universes.map((item) => `<option value="${item}" ${item === filters.universe ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <select class="input select" data-screener-sector="${panel}">
          <option value="">All sectors</option>
          ${sectors.map((item) => `<option value="${item}" ${item === filters.sector ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <input class="input grow" data-screener-search="${panel}" value="${filters.search}" placeholder="symbol / name" />
        <span class="toolbar-label">${filtered.length} results</span>
      </div>
      <div class="table-wrap">
        <table class="terminal-table compact">
          <thead><tr><th>Ticker</th><th>Name</th><th>Sector</th><th>Universe</th><th>Price</th><th>Chg%</th></tr></thead>
          <tbody>
            ${filtered
              .slice(0, 80)
              .map((item) => {
                const quote = buildQuote(item.symbol);
                return `
                  <tr>
                    <td><button class="table-link" data-load-module="quote" data-target-symbol="${item.symbol}" data-target-panel="${state.activePanel}">${item.symbol}</button></td>
                    <td>${item.name}</td>
                    <td>${item.sector}</td>
                    <td>${item.universe}</td>
                    <td>${quote ? formatPrice(quote.price, item.symbol) : formatPrice(item.seedPrice, item.symbol)}</td>
                    <td class="${quote && quote.changePct >= 0 ? "positive" : "negative"}">${quote ? formatSignedPct(quote.changePct) : "--"}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderHeatmapModule() {
  return `
    <section class="heatmap-grid">
      ${Object.entries(heatmapGroups)
        .map(
          ([sector, symbols]) => `
            <article class="module-card">
              <div class="card-header"><span>${sector}</span><span>${symbols.length}</span></div>
              <div class="heat-sector-grid">
                ${symbols
                  .map((symbol) => {
                    const quote = buildQuote(symbol);
                    const magnitude = Math.max(1, Math.min(5, Math.round(Math.abs(quote?.changePct ?? 0)) + 1));
                    return `
                      <button class="heat-tile ${quote && quote.changePct >= 0 ? "up" : "down"} size-${magnitude}" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${state.activePanel}">
                        <strong>${symbol}</strong>
                        <span>${quote ? formatSignedPct(quote.changePct) : "--"}</span>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderPortfolioModule() {
  const rows = state.positions.map((position) => {
    const quote = buildQuote(position.symbol);
    const price = quote?.price ?? position.cost;
    const value = price * position.shares;
    const basis = position.cost * position.shares;
    const pnl = value - basis;
    const pnlPct = basis ? (pnl / basis) * 100 : 0;
    return { ...position, price, value, pnl, pnlPct };
  });

  const totalValue = rows.reduce((sum, item) => sum + item.value, 0);
  const totalBasis = rows.reduce((sum, item) => sum + item.cost * item.shares, 0);
  const totalPnl = totalValue - totalBasis;
  const totalPct = totalBasis ? (totalPnl / totalBasis) * 100 : 0;

  return `
    <section class="module-stack">
      <div class="hero-card-grid portfolio-summary">
        <article class="hero-card"><span>Total value</span><strong>${formatPrice(totalValue, "USD")}</strong></article>
        <article class="hero-card"><span>Total P/L</span><strong class="${totalPnl >= 0 ? "positive" : "negative"}">${totalPnl >= 0 ? "+" : ""}${formatPrice(totalPnl, "USD")}</strong></article>
        <article class="hero-card"><span>Total P/L %</span><strong class="${totalPct >= 0 ? "positive" : "negative"}">${formatSignedPct(totalPct)}</strong></article>
      </div>
      <form id="addPositionForm" class="toolbar-row wrap">
        <input class="input" name="symbol" placeholder="Symbol" />
        <input class="input" name="shares" type="number" step="0.01" placeholder="Shares" />
        <input class="input" name="cost" type="number" step="0.01" placeholder="Cost basis" />
        <button class="button" type="submit">Add Position</button>
      </form>
      <div class="table-wrap">
        <table class="terminal-table compact">
          <thead><tr><th>Ticker</th><th>Shares</th><th>Cost</th><th>Mark</th><th>Value</th><th>P/L</th><th>P/L %</th><th></th></tr></thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td><button class="table-link" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${state.activePanel}">${row.symbol}</button></td>
                    <td>${row.shares}</td>
                    <td>${formatPrice(row.cost, row.symbol)}</td>
                    <td>${formatPrice(row.price, row.symbol)}</td>
                    <td>${formatPrice(row.value, "USD")}</td>
                    <td class="${row.pnl >= 0 ? "positive" : "negative"}">${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}</td>
                    <td class="${row.pnlPct >= 0 ? "positive" : "negative"}">${formatSignedPct(row.pnlPct)}</td>
                    <td><button class="button button-danger" type="button" data-remove-position="${row.symbol}">Remove</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMacroModule() {
  const fxRows = macroDefaults.currencies
    .map((currency) => ({ currency, rate: state.fxRates[currency] }))
    .filter((item) => item.rate)
    .map(
      (item) => `
        <article class="fx-card">
          <strong>USD/${item.currency}</strong>
          <span>${Number(item.rate).toFixed(4)}</span>
        </article>
      `,
    )
    .join("");

  return `
    <section class="module-stack">
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Yield curve</span><span>Reference</span></div>
          <div class="curve-grid">
            ${macroDefaults.curve
              .map(
                (point) => `
                  <div class="curve-column">
                    <div class="curve-bar" style="height:${point.yield * 18}px"></div>
                    <strong>${point.yield.toFixed(2)}%</strong>
                    <span>${point.tenor}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>FX monitor</span><span>Live</span></div>
          <div class="fx-grid">${fxRows || emptyStateMarkup("Fetching FX rates...")}</div>
        </section>
      </div>
    </section>
  `;
}

function renderOptionsModule(panel) {
  const symbol = state.panelSymbols[panel] ?? state.optionsSelection.symbol ?? "AAPL";
  const cacheKey = buildOptionKey(symbol, state.optionsSelection.expiration);
  const optionState = state.optionsCache.get(cacheKey);
  const expirations = optionState?.expirations ?? [];
  const calls = optionState?.calls ?? [];
  const puts = optionState?.puts ?? [];
  const quote = buildQuote(symbol);

  return `
    <section class="module-stack">
      <div class="toolbar-row wrap">
        <input class="input" value="${symbol}" data-option-symbol="${panel}" />
        <button class="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Load Chain</button>
        <select class="input select" data-option-expiry>
          <option value="">Nearest expiry</option>
          ${expirations
            .slice(0, 8)
            .map(
              (value) => `<option value="${value}" ${String(state.optionsSelection.expiration ?? "") === String(value) ? "selected" : ""}>${formatExpiry(value)}</option>`,
            )
            .join("")}
        </select>
        <span class="toolbar-label">Spot ${quote ? formatPrice(quote.price, symbol) : "--"}</span>
      </div>
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Calls</span><span>${calls.length}</span></div>
          ${renderOptionTable(calls, "call")}
        </section>
        <section class="module-card">
          <div class="card-header"><span>Puts</span><span>${puts.length}</span></div>
          ${renderOptionTable(puts, "put")}
        </section>
      </div>
    </section>
  `;
}

function renderCalculatorModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const quote = buildQuote(symbol);
  const optionInputs = { ...state.calculator.option, spot: quote?.price ?? state.calculator.option.spot };
  const optionResult = calculateBlackScholes(optionInputs);
  const bondResult = calculateBond(state.calculator.bond);

  return `
    <section class="module-stack">
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Black-Scholes</span><span>${symbol}</span></div>
          <div class="calc-grid">
            ${renderCalculatorInput("Spot", "option.spot", optionInputs.spot)}
            ${renderCalculatorInput("Strike", "option.strike", state.calculator.option.strike)}
            ${renderCalculatorInput("Years", "option.years", state.calculator.option.years)}
            ${renderCalculatorInput("Rate %", "option.rate", state.calculator.option.rate)}
            ${renderCalculatorInput("Vol %", "option.volatility", state.calculator.option.volatility)}
          </div>
          <div class="calc-results">
            <div><span>Call</span><strong>${optionResult.call.toFixed(4)}</strong></div>
            <div><span>Put</span><strong>${optionResult.put.toFixed(4)}</strong></div>
            <div><span>Delta</span><strong>${optionResult.delta.toFixed(4)}</strong></div>
            <div><span>Gamma</span><strong>${optionResult.gamma.toFixed(6)}</strong></div>
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>Bond pricing</span><span>Fixed income</span></div>
          <div class="calc-grid">
            ${renderCalculatorInput("Face", "bond.face", state.calculator.bond.face)}
            ${renderCalculatorInput("Coupon %", "bond.coupon", state.calculator.bond.coupon)}
            ${renderCalculatorInput("YTM %", "bond.ytm", state.calculator.bond.ytm)}
            ${renderCalculatorInput("Maturity", "bond.maturity", state.calculator.bond.maturity)}
            ${renderCalculatorInput("Frequency", "bond.frequency", state.calculator.bond.frequency)}
          </div>
          <div class="calc-results">
            <div><span>Price</span><strong>${bondResult.price.toFixed(4)}</strong></div>
            <div><span>Duration</span><strong>${bondResult.duration.toFixed(4)}</strong></div>
            <div><span>Mod duration</span><strong>${bondResult.modifiedDuration.toFixed(4)}</strong></div>
            <div><span>Convexity</span><strong>${bondResult.convexity.toFixed(4)}</strong></div>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderCalculatorInput(label, key, value) {
  return `
    <label class="calc-input-row">
      <span>${label}</span>
      <input class="input" data-calc-key="${key}" value="${value}" />
    </label>
  `;
}

function renderOptionTable(contracts, kind) {
  if (!contracts.length) {
    return emptyStateMarkup(`Fetching ${kind} contracts...`);
  }

  return `
    <div class="table-wrap">
      <table class="terminal-table compact">
        <thead><tr><th>Strike</th><th>Bid</th><th>Ask</th><th>Last</th><th>Vol</th><th>OI</th></tr></thead>
        <tbody>
          ${contracts
            .map(
              (contract) => `
                <tr>
                  <td>${contract.strike?.fmt ?? contract.strike ?? "--"}</td>
                  <td>${contract.bid?.fmt ?? contract.bid ?? "--"}</td>
                  <td>${contract.ask?.fmt ?? contract.ask ?? "--"}</td>
                  <td>${contract.lastPrice?.fmt ?? contract.lastPrice ?? "--"}</td>
                  <td>${contract.volume?.fmt ?? contract.volume ?? "--"}</td>
                  <td>${contract.openInterest?.fmt ?? contract.openInterest ?? "--"}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function emptyStateMarkup(message) {
  return `<div class="empty-state">${message}</div>`;
}

function processCommand() {
  const raw = elements.commandInput.value.trim();
  if (!raw) {
    return;
  }

  const upper = raw.toUpperCase();
  state.commandHistory.unshift(raw);
  state.commandHistory = state.commandHistory.slice(0, 50);
  state.commandHistoryIndex = -1;
  elements.activeCommandDisplay.textContent = upper;

  const parts = upper.split(/\s+/);
  const [first, second, third, fourth] = parts;

  if (first === "HELP") {
    state.panelModules[state.activePanel] = "news";
    state.newsItems = commandCatalog.map((item) => ({
      source: "Command",
      headline: `${item.cmd} — ${item.desc}`,
      time: currentTimeShort(),
      link: "#",
    }));
    renderPanel(state.activePanel);
  } else if (first === "HOME") {
    loadModule("home", state.activePanel);
  } else if (first === "NEWS") {
    loadModule("news", state.activePanel);
  } else if (first === "EQS" || first === "SCREENER") {
    loadModule("screener", state.activePanel);
  } else if (first === "HEAT" || first === "HEATMAP") {
    loadModule("heatmap", state.activePanel);
  } else if (first === "PORT" || first === "PORTFOLIO") {
    loadModule("portfolio", state.activePanel);
  } else if (first === "MACRO") {
    loadModule("macro", state.activePanel);
  } else if (first === "CALC") {
    loadModule("calculator", state.activePanel);
  } else if ((first === "OMON" || first === "OPTIONS") && second) {
    state.panelSymbols[state.activePanel] = second;
    state.optionsSelection.symbol = second;
    loadModule("options", state.activePanel);
    refreshOptions(second, state.optionsSelection.expiration);
  } else if (first === "WATCH" && second) {
    addToWatchlist(second);
  } else if (first === "ALERT" && second && third) {
    createAlert(second, Number(third), ">=");
  } else if (first === "ADDPOS" && second && third && fourth) {
    addPosition({ symbol: second, shares: Number(third), cost: Number(fourth) });
  } else if (second === "Q" || first === "QUOTE") {
    const symbol = first === "QUOTE" ? second : first;
    if (symbol) {
      state.panelSymbols[state.activePanel] = symbol;
      loadModule("quote", state.activePanel);
      refreshQuotes([symbol]);
    }
  } else if (second === "CHART" || first === "CHART") {
    const symbol = first === "CHART" ? second : first;
    if (symbol) {
      state.panelSymbols[state.activePanel] = symbol;
      loadModule("chart", state.activePanel);
      refreshChart(symbol);
    }
  } else if (universeMap.has(first)) {
    state.panelSymbols[state.activePanel] = first;
    loadModule("quote", state.activePanel);
    refreshQuotes([first]);
  } else {
    showToast(`Unknown command: ${upper}`, "error");
  }

  persistWorkspace();
  elements.commandInput.value = "";
  hideAutocomplete();
  renderRails();
}

function handleCommandKeydown(event) {
  if (event.key === "Enter") {
    processCommand();
    return;
  }

  if (event.key === "Escape") {
    elements.commandInput.value = "";
    hideAutocomplete();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (state.commandHistoryIndex < state.commandHistory.length - 1) {
      state.commandHistoryIndex += 1;
      elements.commandInput.value = state.commandHistory[state.commandHistoryIndex];
    }
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (state.commandHistoryIndex > 0) {
      state.commandHistoryIndex -= 1;
      elements.commandInput.value = state.commandHistory[state.commandHistoryIndex];
    } else {
      state.commandHistoryIndex = -1;
      elements.commandInput.value = "";
    }
  }
}

function renderAutocomplete() {
  const value = elements.commandInput.value.trim().toUpperCase();
  if (!value) {
    hideAutocomplete();
    return;
  }

  const commandMatches = commandCatalog
    .filter((item) => item.cmd.startsWith(value) || item.cmd.includes(value))
    .slice(0, 5)
    .map((item) => ({ label: item.cmd, description: item.desc }));

  const symbolMatches = universe
    .filter((item) => item.symbol.startsWith(value) || item.name.toUpperCase().includes(value))
    .slice(0, 6)
    .map((item) => ({ label: `${item.symbol} Q`, description: item.name }));

  const suggestions = [...commandMatches, ...symbolMatches].slice(0, 8);
  if (!suggestions.length) {
    hideAutocomplete();
    return;
  }

  elements.autocomplete.innerHTML = suggestions
    .map(
      (item) => `
        <button class="autocomplete-item" type="button" data-autocomplete="${item.label}">
          <strong>${item.label}</strong>
          <span>${item.description}</span>
        </button>
      `,
    )
    .join("");
  elements.autocomplete.classList.remove("hidden");
}

function hideAutocomplete() {
  elements.autocomplete.classList.add("hidden");
}

function handleGlobalHotkeys(event) {
  if (document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && event.key !== "Escape") {
    return;
  }

  const hotkeys = {
    F1: "home",
    F2: "quote",
    F3: "chart",
    F4: "news",
    F5: "screener",
    F6: "heatmap",
    F7: "portfolio",
    F8: "macro",
    F9: "options",
    F10: "calculator",
  };

  if (event.key === "Tab") {
    event.preventDefault();
    setActivePanel((state.activePanel % 4) + 1);
    return;
  }

  if (hotkeys[event.key]) {
    event.preventDefault();
    loadModule(hotkeys[event.key], state.activePanel);
    return;
  }

  if (event.key === "Escape") {
    elements.commandInput.focus();
    hideAutocomplete();
  }
}

function addToWatchlist(symbol) {
  const upper = symbol.toUpperCase();
  if (!state.watchlist.includes(upper)) {
    state.watchlist.unshift(upper);
    state.watchlist = state.watchlist.slice(0, 24);
    persistWorkspace();
    renderRails();
    refreshQuotes([upper]);
    showToast(`${upper} added to watchlist.`, "success");
  }
}

function removeFromWatchlist(symbol) {
  state.watchlist = state.watchlist.filter((item) => item !== symbol);
  persistWorkspace();
  renderRails();
}

function createAlert(symbol, threshold, operator) {
  if (!symbol || Number.isNaN(threshold)) {
    return;
  }
  state.alerts.unshift({ symbol: symbol.toUpperCase(), operator, threshold, status: "watching" });
  state.alerts = state.alerts.slice(0, 16);
  persistWorkspace();
  renderRails();
  renderAllPanels();
  showToast(`Alert added for ${symbol.toUpperCase()}.`, "success");
}

function addPosition(position) {
  if (!position.symbol || !position.shares || !position.cost) {
    return;
  }
  state.positions.unshift({ symbol: position.symbol.toUpperCase(), shares: position.shares, cost: position.cost });
  persistWorkspace();
  renderAllPanels();
  refreshQuotes([position.symbol.toUpperCase()]);
  showToast(`Position added for ${position.symbol.toUpperCase()}.`, "success");
}

function removePositionBySymbol(symbol) {
  state.positions = state.positions.filter((position) => position.symbol !== symbol);
  persistWorkspace();
  renderAllPanels();
}

function persistWorkspace() {
  if (!state.user) {
    return;
  }

  state.userState = {
    ...state.userState,
    watchlist: state.watchlist,
    alerts: state.alerts,
    positions: state.positions,
    panelModules: state.panelModules,
    panelSymbols: state.panelSymbols,
    commandHistory: state.commandHistory,
  };
  saveUserState(state.user.id, state.userState);
}

async function refreshAllData() {
  elements.networkStatus.textContent = "Syncing";
  const symbols = new Set([...state.watchlist, ...state.positions.map((item) => item.symbol), ...Object.values(state.panelSymbols)]);

  await Promise.allSettled([
    refreshQuotes([...symbols]),
    refreshNewsFeed(),
    refreshFxMonitor(),
    refreshChart(state.panelSymbols[3] ?? "AAPL"),
    refreshOptions(state.panelSymbols[2] ?? "AAPL", state.optionsSelection.expiration),
  ]);

  if (elements.networkStatus.textContent === "Syncing") {
    elements.networkStatus.textContent = "Live";
  }
  renderRails();
  renderAllPanels();
}

async function refreshQuotes(symbols) {
  try {
    const quotes = await fetchQuotes(symbols);
    quotes.forEach((quote) => {
      state.quotes.set(quote.symbol, quote);
    });
    evaluateAlerts();
    renderRails();
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshChart(symbol, range = "1mo", interval = "1d") {
  try {
    const data = await fetchChart(symbol, range, interval);
    state.chartCache.set(buildChartKey(symbol, range, interval), data);
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshOptions(symbol, expiration) {
  state.optionsSelection.symbol = symbol;
  try {
    const chain = await fetchOptions(symbol, expiration);
    if (!state.optionsSelection.expiration && chain.expirations.length) {
      state.optionsSelection.expiration = chain.expirations[0];
    }
    state.optionsCache.set(buildOptionKey(symbol, expiration), chain);
    state.optionsCache.set(buildOptionKey(symbol, state.optionsSelection.expiration), chain);
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshNewsFeed() {
  try {
    const items = await fetchNews();
    if (items.length) {
      state.newsItems = items;
      renderAllPanels();
    }
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshFxMonitor() {
  try {
    state.fxRates = await fetchFxRates();
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

function evaluateAlerts() {
  state.alerts = state.alerts.map((alert) => {
    const quote = buildQuote(alert.symbol);
    if (!quote) {
      return alert;
    }
    const triggered = alert.operator === ">=" ? quote.price >= alert.threshold : quote.price <= alert.threshold;
    return { ...alert, status: triggered ? "triggered" : "watching" };
  });
}

function updateClock() {
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  elements.clockDisplay.textContent = `${ny.toLocaleTimeString("en-US", { hour12: false })} EST`;

  const elapsedSeconds = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
  const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  elements.sessionClock.textContent = `${hours}:${minutes}:${seconds}`;
  updateMarketStatus(ny);
}

function handleRefreshCountdown() {
  if (!state.user) {
    return;
  }
  state.refreshCountdown -= 1;
  if (state.refreshCountdown <= 0) {
    state.refreshCountdown = 30;
    refreshAllData();
  }
  updateStatusBar();
}

function updateMarketStatus(nyTime) {
  const day = nyTime.getDay();
  const hour = nyTime.getHours();
  const minute = nyTime.getMinutes();

  if (day === 0 || day === 6) {
    elements.marketStatus.textContent = "Weekend";
    return;
  }
  if (hour < 9 || (hour === 9 && minute < 30)) {
    elements.marketStatus.textContent = "Pre-market";
    return;
  }
  if (hour < 16) {
    elements.marketStatus.textContent = "Open";
    return;
  }
  elements.marketStatus.textContent = "After-hours";
}

function updateStatusBar() {
  elements.lastUpdated.textContent = currentTimeShort();
  elements.refreshCountdown.textContent = `${state.refreshCountdown}s`;
  elements.watchCount.textContent = `${state.watchlist.length}`;
  elements.alertCount.textContent = `${state.alerts.length}`;
}

function showToast(message, tone = "neutral") {
  elements.toast.textContent = message;
  elements.toast.dataset.tone = tone;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2800);
}

function getFilteredUniverse(filters) {
  return universe.filter((item) => {
    if (filters.universe && item.universe !== filters.universe) {
      return false;
    }
    if (filters.sector && item.sector !== filters.sector) {
      return false;
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      return item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    }
    return true;
  });
}

function setNestedCalculatorValue(path, value) {
  const [root, field] = path.split(".");
  if (!state.calculator[root]) {
    return;
  }
  state.calculator[root][field] = Number.isFinite(value) ? value : state.calculator[root][field];
}

function buildChartKey(symbol, range, interval) {
  return `${symbol}:${range}:${interval}`;
}

function buildOptionKey(symbol, expiration) {
  return `${symbol}:${expiration ?? "nearest"}`;
}

function buildLineChartSvg(points) {
  if (!points.length) {
    return "";
  }

  const width = 700;
  const height = 260;
  const closes = points.map((item) => item.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const line = points
    .map((item, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((item.close - min) / range) * (height - 20) - 10;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="line-chart" preserveAspectRatio="none">
      <polyline points="${line}" fill="none" stroke="#6be6ff" stroke-width="3"></polyline>
    </svg>
  `;
}

function calculateBlackScholes({ spot, strike, years, rate, volatility }) {
  const safeYears = Math.max(Number(years), 0.0001);
  const safeSpot = Math.max(Number(spot), 0.0001);
  const safeStrike = Math.max(Number(strike), 0.0001);
  const safeRate = Number(rate) / 100;
  const safeVol = Math.max(Number(volatility) / 100, 0.0001);
  const d1 = (Math.log(safeSpot / safeStrike) + (safeRate + (safeVol ** 2) / 2) * safeYears) / (safeVol * Math.sqrt(safeYears));
  const d2 = d1 - safeVol * Math.sqrt(safeYears);
  const normal = (value) => 0.5 * (1 + erf(value / Math.sqrt(2)));
  const density = (value) => Math.exp(-(value ** 2) / 2) / Math.sqrt(2 * Math.PI);

  return {
    call: safeSpot * normal(d1) - safeStrike * Math.exp(-safeRate * safeYears) * normal(d2),
    put: safeStrike * Math.exp(-safeRate * safeYears) * normal(-d2) - safeSpot * normal(-d1),
    delta: normal(d1),
    gamma: density(d1) / (safeSpot * safeVol * Math.sqrt(safeYears)),
  };
}

function calculateBond({ face, coupon, ytm, maturity, frequency }) {
  const faceValue = Number(face);
  const couponRate = Number(coupon) / 100;
  const yieldRate = Number(ytm) / 100;
  const periodsPerYear = Number(frequency);
  const totalPeriods = Math.max(1, Math.round(Number(maturity) * periodsPerYear));
  const couponPayment = (faceValue * couponRate) / periodsPerYear;
  const discount = yieldRate / periodsPerYear;

  let price = 0;
  let duration = 0;
  let convexity = 0;

  for (let period = 1; period <= totalPeriods; period += 1) {
    const cashflow = period === totalPeriods ? couponPayment + faceValue : couponPayment;
    const presentValue = cashflow / ((1 + discount) ** period);
    price += presentValue;
    duration += period * presentValue;
    convexity += period * (period + 1) * presentValue;
  }

  const macaulayDuration = duration / price / periodsPerYear;
  const modifiedDuration = macaulayDuration / (1 + discount);
  return {
    price,
    duration: macaulayDuration,
    modifiedDuration,
    convexity: convexity / (price * periodsPerYear * periodsPerYear),
  };
}

function erf(value) {
  const sign = value >= 0 ? 1 : -1;
  const absolute = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absolute);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-(absolute ** 2)));
  return sign * y;
}

function formatPrice(value, symbol) {
  const digits = symbol === "BTC-USD" || symbol === "USD" ? 0 : 2;
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatSignedPct(value) {
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
}

function formatMarketCap(value) {
  if (!value) {
    return "N/A";
  }
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }
  return `$${Number(value).toFixed(0)}`;
}

function formatVolume(value) {
  if (!value) {
    return "N/A";
  }
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return `${value}`;
}

function formatExpiry(value) {
  return new Date(Number(value) * 1000).toLocaleDateString();
}

function currentTimeShort() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

init();
/*
import {
  appName,
  authRoles,
  buildUniverse,
  calculatorDefaults,
  commandCatalog,
  defaultAlerts,
  defaultPositions,
  defaultWatchlist,
  functionKeys,
  heatmapGroups,
  heroMetrics,
  macroDefaults,
  moduleOrder,
  moduleTitles,
  onboardingHighlights,
} from "./data.js";
import { createAccount, login, logout, restoreSessionUser } from "./auth.js";
import { fetchChart, fetchFxRates, fetchNews, fetchOptions, fetchQuotes } from "./services.js";
import { getUserState, saveUserState } from "./storage.js";

const universe = buildUniverse();
const universeMap = new Map(universe.map((item) => [item.symbol, item]));

const state = {
  user: null,
  userState: null,
  sessionStartedAt: Date.now(),
  activePanel: 1,
  panelModules: { 1: "home", 2: "quote", 3: "chart", 4: "news" },
  panelSymbols: { 1: "NVDA", 2: "AAPL", 3: "MSFT", 4: "QQQ" },
  quotes: new Map(),
  chartCache: new Map(),
  optionsCache: new Map(),
  newsItems: [],
  fxRates: {},
  watchlist: [...defaultWatchlist],
  alerts: structuredClone(defaultAlerts),
  positions: structuredClone(defaultPositions),
  commandHistory: [],
  commandHistoryIndex: -1,
  screenerFilters: {
    1: { universe: "", sector: "", search: "" },
    2: { universe: "", sector: "", search: "" },
    3: { universe: "", sector: "", search: "" },
    4: { universe: "", sector: "", search: "" },
  },
  calculator: structuredClone(calculatorDefaults),
  optionsSelection: { symbol: "AAPL", expiration: null },
  refreshCountdown: 30,
};

const elements = {
  authShell: document.querySelector("#authShell"),
  terminalApp: document.querySelector("#terminalApp"),
  loginForm: document.querySelector("#loginForm"),
  signupForm: document.querySelector("#signupForm"),
  authTabs: document.querySelector("#authTabs"),
  authMessage: document.querySelector("#authMessage"),
  heroMetrics: document.querySelector("#heroMetrics"),
  heroHighlights: document.querySelector("#heroHighlights"),
  appTitle: document.querySelector("#appTitle"),
  userBadge: document.querySelector("#userBadge"),
  userMeta: document.querySelector("#userMeta"),
  marketStatus: document.querySelector("#marketStatus"),
  clockDisplay: document.querySelector("#clockDisplay"),
  sessionClock: document.querySelector("#sessionClock"),
  activeCommandDisplay: document.querySelector("#activeCommandDisplay"),
  functionRow: document.querySelector("#functionRow"),
  watchlistRail: document.querySelector("#watchlistRail"),
  alertRail: document.querySelector("#alertRail"),
  commandInput: document.querySelector("#commandInput"),
  runCommandButton: document.querySelector("#runCommandButton"),
  autocomplete: document.querySelector("#autocomplete"),
  lastUpdated: document.querySelector("#lastUpdated"),
  refreshCountdown: document.querySelector("#refreshCountdown"),
  watchCount: document.querySelector("#watchCount"),
  alertCount: document.querySelector("#alertCount"),
  networkStatus: document.querySelector("#networkStatus"),
  logoutButton: document.querySelector("#logoutButton"),
  toast: document.querySelector("#toast"),
};

function init() {
  renderLanding();
  bindAuthEvents();
  bindWorkspaceEvents();

  const restoredUser = restoreSessionUser();
  if (restoredUser) {
    completeLogin(restoredUser);
  }

  updateClock();
  setInterval(updateClock, 1000);
  setInterval(handleRefreshCountdown, 1000);
}

function renderLanding() {
  document.title = appName;
  elements.appTitle.textContent = appName;

  const roleSelect = document.querySelector("#signupRole");
  if (roleSelect) {
    roleSelect.innerHTML = authRoles
      .map((role) => `<option value="${role}">${role}</option>`)
      .join("");
  }

  elements.heroMetrics.innerHTML = heroMetrics
    .map(
      (metric) => `
        <article class="metric-card">
          <strong>${metric.value}</strong>
          <span>${metric.label}</span>
        </article>
      `,
    )
    .join("");

  elements.heroHighlights.innerHTML = onboardingHighlights
    .map(
      (item) => `
        <article class="highlight-card">
          <h3>${item.title}</h3>
          <p>${item.body}</p>
        </article>
      `,
    )
    .join("");
}

function bindAuthEvents() {
  elements.authTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-auth-tab]");
    if (!button) {
      return;
    }
    setAuthTab(button.dataset.authTab);
  });

  elements.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.loginForm);

    try {
      const user = await login({
        identifier: String(form.get("identifier") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      showAuthMessage("Login successful.", "success");
      completeLogin(user);
    } catch (error) {
      showAuthMessage(error.message, "error");
    }
  });

  elements.signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(elements.signupForm);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password.length < 8) {
      showAuthMessage("Password must be at least 8 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showAuthMessage("Passwords do not match.", "error");
      return;
    }

    try {
      const user = await createAccount({
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        email: String(form.get("email") ?? ""),
        username: String(form.get("username") ?? ""),
        password,
        role: String(form.get("role") ?? "Other"),
      });
      showAuthMessage("Account created. Loading workspace...", "success");
      completeLogin(user);
    } catch (error) {
      showAuthMessage(error.message, "error");
    }
  });
}

function bindWorkspaceEvents() {
  elements.runCommandButton?.addEventListener("click", processCommand);
  elements.commandInput?.addEventListener("input", renderAutocomplete);
  elements.commandInput?.addEventListener("keydown", handleCommandKeydown);
  elements.functionRow?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module]");
    if (!button) {
      return;
    }
    loadModule(button.dataset.module, state.activePanel);
  });
  elements.logoutButton?.addEventListener("click", handleLogout);

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("input", handleDocumentInput);
  document.addEventListener("keydown", handleGlobalHotkeys);
  document.addEventListener("submit", handleDocumentSubmit);
}

function handleDocumentClick(event) {
  const panelButton = event.target.closest("[data-panel]");
  if (panelButton) {
    setActivePanel(Number(panelButton.dataset.panel));
    return;
  }

  const cycleButton = event.target.closest("[data-panel-cycle]");
  if (cycleButton) {
    const [panel, direction] = cycleButton.dataset.panelCycle.split(":").map(Number);
    cycleModule(panel, direction);
    return;
  }

  const moduleTrigger = event.target.closest("[data-load-module]");
  if (moduleTrigger) {
    const panel = Number(moduleTrigger.dataset.targetPanel || state.activePanel);
    if (moduleTrigger.dataset.targetSymbol) {
      state.panelSymbols[panel] = moduleTrigger.dataset.targetSymbol;
    }
    loadModule(moduleTrigger.dataset.loadModule, panel);
    if (moduleTrigger.dataset.loadModule === "chart") {
      refreshChart(state.panelSymbols[panel]);
    }
    if (moduleTrigger.dataset.loadModule === "options") {
      refreshOptions(state.panelSymbols[panel], state.optionsSelection.expiration);
    }
    return;
  }

  const watchButton = event.target.closest("[data-watch-symbol]");
  if (watchButton) {
    addToWatchlist(watchButton.dataset.watchSymbol);
    return;
  }

  const removeWatch = event.target.closest("[data-remove-watch]");
  if (removeWatch) {
    removeFromWatchlist(removeWatch.dataset.removeWatch);
    return;
  }

  const removePosition = event.target.closest("[data-remove-position]");
  if (removePosition) {
    removePositionBySymbol(removePosition.dataset.removePosition);
    return;
  }

  const addAlert = event.target.closest("[data-alert-symbol]");
  if (addAlert) {
    const symbol = addAlert.dataset.alertSymbol;
    const threshold = Number(addAlert.dataset.alertThreshold);
    createAlert(symbol, threshold, ">=");
    return;
  }

  const autocompleteItem = event.target.closest("[data-autocomplete]");
  if (autocompleteItem) {
    elements.commandInput.value = autocompleteItem.dataset.autocomplete;
    processCommand();
    return;
  }

  if (!event.target.closest(".command-shell")) {
    hideAutocomplete();
  }
}

function handleDocumentInput(event) {
  const screenerSearch = event.target.closest("[data-screener-search]");
  if (screenerSearch) {
    const panel = Number(screenerSearch.dataset.screenerSearch);
    state.screenerFilters[panel].search = screenerSearch.value;
    renderPanel(panel);
    return;
  }

  const screenerUniverse = event.target.closest("[data-screener-universe]");
  if (screenerUniverse) {
    const panel = Number(screenerUniverse.dataset.screenerUniverse);
    state.screenerFilters[panel].universe = screenerUniverse.value;
    renderPanel(panel);
    return;
  }

  const screenerSector = event.target.closest("[data-screener-sector]");
  if (screenerSector) {
    const panel = Number(screenerSector.dataset.screenerSector);
    state.screenerFilters[panel].sector = screenerSector.value;
    renderPanel(panel);
    return;
  }

  const calcInput = event.target.closest("[data-calc-key]");
  if (calcInput) {
    setNestedCalculatorValue(calcInput.dataset.calcKey, Number(calcInput.value));
    renderAllPanels();
    return;
  }

  const quoteInput = event.target.closest("[data-quote-symbol]");
  if (quoteInput) {
    const panel = Number(quoteInput.dataset.quoteSymbol);
    state.panelSymbols[panel] = quoteInput.value.toUpperCase();
    return;
  }

  const optionInput = event.target.closest("[data-option-symbol]");
  if (optionInput) {
    const panel = Number(optionInput.dataset.optionSymbol);
    state.panelSymbols[panel] = optionInput.value.toUpperCase();
    state.optionsSelection.symbol = optionInput.value.toUpperCase();
    return;
  }

  const optionExpiry = event.target.closest("[data-option-expiry]");
  if (optionExpiry) {
    state.optionsSelection.expiration = optionExpiry.value || null;
    refreshOptions(state.optionsSelection.symbol, state.optionsSelection.expiration);
  }
}

function handleDocumentSubmit(event) {
  const addPositionForm = event.target.closest("#addPositionForm");
  if (!addPositionForm) {
    return;
  }

  event.preventDefault();
  const form = new FormData(addPositionForm);
  addPosition({
    symbol: String(form.get("symbol") ?? "").toUpperCase(),
    shares: Number(form.get("shares") ?? 0),
    cost: Number(form.get("cost") ?? 0),
  });
  addPositionForm.reset();
}

function setAuthTab(tabName) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === tabName);
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.authPanel !== tabName);
  });
}

function showAuthMessage(message, tone = "neutral") {
  elements.authMessage.textContent = message;
  elements.authMessage.dataset.tone = tone;
}

function completeLogin(user) {
  state.user = user;
  const userState = getUserState(user.id, {
    watchlist: defaultWatchlist,
    alerts: defaultAlerts,
    positions: defaultPositions,
  });

  state.userState = userState;
  state.watchlist = [...userState.watchlist];
  state.alerts = structuredClone(userState.alerts?.length ? userState.alerts : defaultAlerts);
  state.positions = structuredClone(userState.positions?.length ? userState.positions : defaultPositions);
  state.panelModules = { ...state.panelModules, ...userState.panelModules };
  state.panelSymbols = { ...state.panelSymbols, ...userState.panelSymbols };
  state.commandHistory = [...(userState.commandHistory ?? [])];
  state.sessionStartedAt = Date.now();
  state.refreshCountdown = 30;

  elements.authShell.classList.add("hidden");
  elements.terminalApp.classList.remove("hidden");
  elements.userBadge.textContent = `${user.firstName} ${user.lastName}`;
  elements.userMeta.textContent = `${user.role} · @${user.username}`;
  renderFunctionRow();
  renderRails();
  renderAllPanels();
  refreshAllData();
  elements.commandInput.focus();
  showToast(`Welcome, ${user.firstName}.`, "success");
}

function handleLogout() {
  logout();
  state.user = null;
  state.userState = null;
  elements.terminalApp.classList.add("hidden");
  elements.authShell.classList.remove("hidden");
  setAuthTab("login");
  showAuthMessage("Signed out.", "neutral");
  showToast("Signed out.", "neutral");
}

function buildQuote(symbol) {
  const base = universeMap.get(symbol);
  const live = state.quotes.get(symbol);
  if (!base && !live) {
    return null;
  }

  return {
    symbol,
    name: live?.name ?? base?.name ?? symbol,
    sector: base?.sector ?? "Unknown",
    universe: base?.universe ?? "Custom",
    exchange: live?.exchange ?? base?.exchange ?? "N/A",
    price: live?.price ?? base?.seedPrice ?? 0,
    changePct: live?.changePct ?? 0,
    change: live?.change ?? 0,
    marketCap: live?.marketCap ?? base?.marketCap ?? 0,
    volume: live?.volume ?? 0,
    dayHigh: live?.dayHigh ?? live?.price ?? base?.seedPrice ?? 0,
    dayLow: live?.dayLow ?? live?.price ?? base?.seedPrice ?? 0,
    previousClose: live?.previousClose ?? base?.seedPrice ?? 0,
  };
}

function renderFunctionRow() {
  elements.functionRow.innerHTML = functionKeys
    .map(
      (item) => `
        <button class="function-key ${state.panelModules[state.activePanel] === item.module ? "is-active" : ""}" data-module="${item.module}">
          <span>${item.key}</span>
          <strong>${item.label}</strong>
        </button>
      `,
    )
    .join("");
}

function renderRails() {
  elements.watchlistRail.innerHTML = state.watchlist
    .map((symbol) => {
      const quote = buildQuote(symbol);
      if (!quote) {
        return "";
      }
      return `
        <article class="rail-item-wrap">
          <button class="rail-item" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${state.activePanel}">
            <div>
              <strong>${symbol}</strong>
              <span>${quote.name}</span>
            </div>
            <div>
              <span>${formatPrice(quote.price, symbol)}</span>
              <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
            </div>
          </button>
          <button class="rail-remove" type="button" data-remove-watch="${symbol}">×</button>
        </article>
      `;
    })
    .join("");

  elements.alertRail.innerHTML = state.alerts
    .map(
      (alert) => `
        <article class="rail-alert ${alert.status === "triggered" ? "is-triggered" : ""}">
          <strong>${alert.symbol}</strong>
          <span>${alert.operator} ${alert.threshold}</span>
          <span>${alert.status}</span>
        </article>
      `,
    )
    .join("");

  updateStatusBar();
}

function setActivePanel(panel) {
  state.activePanel = panel;
  document.querySelectorAll("[data-panel]").forEach((node) => {
    node.classList.toggle("is-active", Number(node.dataset.panel) === panel);
  });
  renderFunctionRow();
}

function cycleModule(panel, direction) {
  const currentIndex = moduleOrder.indexOf(state.panelModules[panel]);
  const nextIndex = (currentIndex + direction + moduleOrder.length) % moduleOrder.length;
  loadModule(moduleOrder[nextIndex], panel);
}

function loadModule(moduleName, panel) {
  state.panelModules[panel] = moduleName;
  renderPanel(panel);
  setActivePanel(panel);
  persistWorkspace();
}

function renderAllPanels() {
  [1, 2, 3, 4].forEach((panel) => renderPanel(panel));
}

function renderPanel(panel) {
  const moduleName = state.panelModules[panel];
  const title = document.querySelector(`#panelTitle${panel}`);
  const content = document.querySelector(`#panelContent${panel}`);
  if (!title || !content) {
    return;
  }

  title.textContent = moduleTitles[moduleName] ?? moduleName.toUpperCase();

  const renderers = {
    home: renderHomeModule,
    quote: renderQuoteModule,
    chart: renderChartModule,
    news: renderNewsModule,
    screener: renderScreenerModule,
    heatmap: renderHeatmapModule,
    portfolio: renderPortfolioModule,
    macro: renderMacroModule,
    options: renderOptionsModule,
    calculator: renderCalculatorModule,
  };

  content.innerHTML = (renderers[moduleName] ?? renderHomeModule)(panel);
}

function renderHomeModule() {
  const topQuotes = state.watchlist.slice(0, 6).map((symbol) => buildQuote(symbol)).filter(Boolean);
  const portfolioValue = state.positions.reduce((sum, position) => {
    const quote = buildQuote(position.symbol);
    const price = quote?.price ?? position.cost;
    return sum + price * position.shares;
  }, 0);
  const portfolioBasis = state.positions.reduce((sum, position) => sum + position.cost * position.shares, 0);
  const pnl = portfolioValue - portfolioBasis;
  const signal = topQuotes.filter((quote) => quote.changePct >= 0).length >= Math.ceil(topQuotes.length / 2) ? "Risk-on" : "Risk-off";

  return `
    <section class="module-stack">
      <div class="hero-card-grid">
        <article class="hero-card"><span>Session signal</span><strong>${signal}</strong><p>Derived from the current watchlist balance.</p></article>
        <article class="hero-card"><span>Portfolio</span><strong>${formatPrice(portfolioValue, "USD")}</strong><p class="${pnl >= 0 ? "positive" : "negative"}">${pnl >= 0 ? "+" : ""}${formatPrice(pnl, "USD")}</p></article>
        <article class="hero-card"><span>Watchlist</span><strong>${state.watchlist.length}</strong><p>${state.watchlist.slice(0, 4).join(" · ")}</p></article>
        <article class="hero-card"><span>Network</span><strong>${elements.networkStatus.textContent}</strong><p>Public endpoints with local persistence and fallbacks.</p></article>
      </div>
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Market pulse</span><span>${topQuotes.length} symbols</span></div>
          <div class="market-chip-grid">
            ${topQuotes
              .map(
                (quote) => `
                  <button class="market-chip" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${state.activePanel}">
                    <strong>${quote.symbol}</strong>
                    <span>${formatPrice(quote.price, quote.symbol)}</span>
                    <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
                  </button>
                `,
              )
              .join("")}
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>Active alerts</span><span>${state.alerts.length}</span></div>
          <div class="stack-list">
            ${state.alerts
              .map(
                (alert) => `
                  <article class="stack-item ${alert.status === "triggered" ? "is-positive" : ""}">
                    <strong>${alert.symbol}</strong>
                    <span>${alert.operator} ${alert.threshold}</span>
                    <small>${alert.status}</small>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderQuoteModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const quote = buildQuote(symbol) ?? buildQuote("AAPL");
  if (!quote) {
    return emptyStateMarkup("No quote data available yet.");
  }

  return `
    <section class="module-stack">
      <div class="toolbar-row">
        <input class="input" value="${quote.symbol}" data-quote-symbol="${panel}" />
        <button class="button" data-load-module="quote" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">Refresh</button>
        <button class="button button-muted" data-watch-symbol="${quote.symbol}">Add Watch</button>
        <button class="button button-muted" data-load-module="chart" data-target-symbol="${quote.symbol}" data-target-panel="${panel}">Chart</button>
      </div>
      <div class="quote-hero-card">
        <div>
          <span class="quote-symbol">${quote.symbol}</span>
          <h3>${quote.name}</h3>
          <strong class="quote-price">${formatPrice(quote.price, quote.symbol)}</strong>
          <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
        </div>
        <div class="quote-side-metrics">
          <span>${quote.sector}</span>
          <span>${quote.universe}</span>
          <span>${quote.exchange}</span>
        </div>
      </div>
      <table class="terminal-table">
        <tbody>
          <tr><td>Previous close</td><td>${formatPrice(quote.previousClose, quote.symbol)}</td><td>Day high</td><td>${formatPrice(quote.dayHigh, quote.symbol)}</td></tr>
          <tr><td>Day low</td><td>${formatPrice(quote.dayLow, quote.symbol)}</td><td>Volume</td><td>${formatVolume(quote.volume)}</td></tr>
          <tr><td>Market cap</td><td>${formatMarketCap(quote.marketCap)}</td><td>Change $</td><td class="${quote.change >= 0 ? "positive" : "negative"}">${quote.change >= 0 ? "+" : ""}${Number(quote.change).toFixed(2)}</td></tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderChartModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const chartData = state.chartCache.get(buildChartKey(symbol, "1mo", "1d")) ?? [];
  const quote = buildQuote(symbol);

  return `
    <section class="module-stack">
      <div class="toolbar-row">
        <span class="toolbar-label">${symbol}</span>
        <button class="button button-muted" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">Reload</button>
      </div>
      <div class="chart-card">
        ${chartData.length ? buildLineChartSvg(chartData) : `<div class="empty-chart">Fetching chart data for ${symbol}...</div>`}
      </div>
      <div class="chart-meta-row">
        <span>${quote ? formatPrice(quote.price, quote.symbol) : "--"}</span>
        <span class="${quote && quote.changePct >= 0 ? "positive" : "negative"}">${quote ? formatSignedPct(quote.changePct) : "--"}</span>
      </div>
    </section>
  `;
}

function renderNewsModule() {
  if (!state.newsItems.length) {
    return emptyStateMarkup("Fetching news feeds...");
  }

  return `
    <section class="module-stack news-stack">
      ${state.newsItems
        .map(
          (item) => `
            <article class="news-card">
              <div class="news-meta"><span>${item.source}</span><span>${item.time}</span></div>
              <strong>${item.headline}</strong>
              <a href="${item.link ?? "#"}" target="_blank" rel="noopener">Open source</a>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderScreenerModule(panel) {
  const filters = state.screenerFilters[panel];
  const filtered = getFilteredUniverse(filters);
  const sectors = [...new Set(universe.map((item) => item.sector))].sort();
  const universes = [...new Set(universe.map((item) => item.universe))].sort();

  return `
    <section class="module-stack">
      <div class="toolbar-row wrap">
        <select class="input select" data-screener-universe="${panel}">
          <option value="">All universes</option>
          ${universes.map((item) => `<option value="${item}" ${item === filters.universe ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <select class="input select" data-screener-sector="${panel}">
          <option value="">All sectors</option>
          ${sectors.map((item) => `<option value="${item}" ${item === filters.sector ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <input class="input grow" data-screener-search="${panel}" value="${filters.search}" placeholder="symbol / name" />
        <span class="toolbar-label">${filtered.length} results</span>
      </div>
      <div class="table-wrap">
        <table class="terminal-table compact">
          <thead><tr><th>Ticker</th><th>Name</th><th>Sector</th><th>Universe</th><th>Price</th><th>Chg%</th></tr></thead>
          <tbody>
            ${filtered
              .slice(0, 80)
              .map((item) => {
                const quote = buildQuote(item.symbol);
                return `
                  <tr>
                    <td><button class="table-link" data-load-module="quote" data-target-symbol="${item.symbol}" data-target-panel="${state.activePanel}">${item.symbol}</button></td>
                    <td>${item.name}</td>
                    <td>${item.sector}</td>
                    <td>${item.universe}</td>
                    <td>${quote ? formatPrice(quote.price, item.symbol) : formatPrice(item.seedPrice, item.symbol)}</td>
                    <td class="${quote && quote.changePct >= 0 ? "positive" : "negative"}">${quote ? formatSignedPct(quote.changePct) : "--"}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderHeatmapModule() {
  return `
    <section class="heatmap-grid">
      ${Object.entries(heatmapGroups)
        .map(
          ([sector, symbols]) => `
            <article class="module-card">
              <div class="card-header"><span>${sector}</span><span>${symbols.length}</span></div>
              <div class="heat-sector-grid">
                ${symbols
                  .map((symbol) => {
                    const quote = buildQuote(symbol);
                    const magnitude = Math.max(1, Math.min(5, Math.round(Math.abs(quote?.changePct ?? 0)) + 1));
                    return `
                      <button class="heat-tile ${quote && quote.changePct >= 0 ? "up" : "down"} size-${magnitude}" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${state.activePanel}">
                        <strong>${symbol}</strong>
                        <span>${quote ? formatSignedPct(quote.changePct) : "--"}</span>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderPortfolioModule() {
  const rows = state.positions.map((position) => {
    const quote = buildQuote(position.symbol);
    const price = quote?.price ?? position.cost;
    const value = price * position.shares;
    const basis = position.cost * position.shares;
    const pnl = value - basis;
    const pnlPct = basis ? (pnl / basis) * 100 : 0;
    return { ...position, price, value, pnl, pnlPct };
  });

  const totalValue = rows.reduce((sum, item) => sum + item.value, 0);
  const totalBasis = rows.reduce((sum, item) => sum + item.cost * item.shares, 0);
  const totalPnl = totalValue - totalBasis;
  const totalPct = totalBasis ? (totalPnl / totalBasis) * 100 : 0;

  return `
    <section class="module-stack">
      <div class="hero-card-grid portfolio-summary">
        <article class="hero-card"><span>Total value</span><strong>${formatPrice(totalValue, "USD")}</strong></article>
        <article class="hero-card"><span>Total P/L</span><strong class="${totalPnl >= 0 ? "positive" : "negative"}">${totalPnl >= 0 ? "+" : ""}${formatPrice(totalPnl, "USD")}</strong></article>
        <article class="hero-card"><span>Total P/L %</span><strong class="${totalPct >= 0 ? "positive" : "negative"}">${formatSignedPct(totalPct)}</strong></article>
      </div>
      <form id="addPositionForm" class="toolbar-row wrap">
        <input class="input" name="symbol" placeholder="Symbol" />
        <input class="input" name="shares" type="number" step="0.01" placeholder="Shares" />
        <input class="input" name="cost" type="number" step="0.01" placeholder="Cost basis" />
        <button class="button" type="submit">Add Position</button>
      </form>
      <div class="table-wrap">
        <table class="terminal-table compact">
          <thead><tr><th>Ticker</th><th>Shares</th><th>Cost</th><th>Mark</th><th>Value</th><th>P/L</th><th>P/L %</th><th></th></tr></thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td><button class="table-link" data-load-module="quote" data-target-symbol="${row.symbol}" data-target-panel="${state.activePanel}">${row.symbol}</button></td>
                    <td>${row.shares}</td>
                    <td>${formatPrice(row.cost, row.symbol)}</td>
                    <td>${formatPrice(row.price, row.symbol)}</td>
                    <td>${formatPrice(row.value, "USD")}</td>
                    <td class="${row.pnl >= 0 ? "positive" : "negative"}">${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}</td>
                    <td class="${row.pnlPct >= 0 ? "positive" : "negative"}">${formatSignedPct(row.pnlPct)}</td>
                    <td><button class="button button-danger" type="button" data-remove-position="${row.symbol}">Remove</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMacroModule() {
  const fxRows = macroDefaults.currencies
    .map((currency) => ({ currency, rate: state.fxRates[currency] }))
    .filter((item) => item.rate)
    .map(
      (item) => `
        <article class="fx-card">
          <strong>USD/${item.currency}</strong>
          <span>${Number(item.rate).toFixed(4)}</span>
        </article>
      `,
    )
    .join("");

  return `
    <section class="module-stack">
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Yield curve</span><span>Reference</span></div>
          <div class="curve-grid">
            ${macroDefaults.curve
              .map(
                (point) => `
                  <div class="curve-column">
                    <div class="curve-bar" style="height:${point.yield * 18}px"></div>
                    <strong>${point.yield.toFixed(2)}%</strong>
                    <span>${point.tenor}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>FX monitor</span><span>Live</span></div>
          <div class="fx-grid">${fxRows || emptyStateMarkup("Fetching FX rates...")}</div>
        </section>
      </div>
    </section>
  `;
}

function renderOptionsModule(panel) {
  const symbol = state.panelSymbols[panel] ?? state.optionsSelection.symbol ?? "AAPL";
  const cacheKey = buildOptionKey(symbol, state.optionsSelection.expiration);
  const optionState = state.optionsCache.get(cacheKey);
  const expirations = optionState?.expirations ?? [];
  const calls = optionState?.calls ?? [];
  const puts = optionState?.puts ?? [];
  const quote = buildQuote(symbol);

  return `
    <section class="module-stack">
      <div class="toolbar-row wrap">
        <input class="input" value="${symbol}" data-option-symbol="${panel}" />
        <button class="button" data-load-module="options" data-target-symbol="${symbol}" data-target-panel="${panel}">Load Chain</button>
        <select class="input select" data-option-expiry>
          <option value="">Nearest expiry</option>
          ${expirations
            .slice(0, 8)
            .map(
              (value) => `<option value="${value}" ${String(state.optionsSelection.expiration ?? "") === String(value) ? "selected" : ""}>${formatExpiry(value)}</option>`,
            )
            .join("")}
        </select>
        <span class="toolbar-label">Spot ${quote ? formatPrice(quote.price, symbol) : "--"}</span>
      </div>
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Calls</span><span>${calls.length}</span></div>
          ${renderOptionTable(calls, "call")}
        </section>
        <section class="module-card">
          <div class="card-header"><span>Puts</span><span>${puts.length}</span></div>
          ${renderOptionTable(puts, "put")}
        </section>
      </div>
    </section>
  `;
}

function renderCalculatorModule(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const quote = buildQuote(symbol);
  const optionInputs = { ...state.calculator.option, spot: quote?.price ?? state.calculator.option.spot };
  const optionResult = calculateBlackScholes(optionInputs);
  const bondResult = calculateBond(state.calculator.bond);

  return `
    <section class="module-stack">
      <div class="card-grid two-up">
        <section class="module-card">
          <div class="card-header"><span>Black-Scholes</span><span>${symbol}</span></div>
          <div class="calc-grid">
            ${renderCalculatorInput("Spot", "option.spot", optionInputs.spot)}
            ${renderCalculatorInput("Strike", "option.strike", state.calculator.option.strike)}
            ${renderCalculatorInput("Years", "option.years", state.calculator.option.years)}
            ${renderCalculatorInput("Rate %", "option.rate", state.calculator.option.rate)}
            ${renderCalculatorInput("Vol %", "option.volatility", state.calculator.option.volatility)}
          </div>
          <div class="calc-results">
            <div><span>Call</span><strong>${optionResult.call.toFixed(4)}</strong></div>
            <div><span>Put</span><strong>${optionResult.put.toFixed(4)}</strong></div>
            <div><span>Delta</span><strong>${optionResult.delta.toFixed(4)}</strong></div>
            <div><span>Gamma</span><strong>${optionResult.gamma.toFixed(6)}</strong></div>
          </div>
        </section>
        <section class="module-card">
          <div class="card-header"><span>Bond pricing</span><span>Fixed income</span></div>
          <div class="calc-grid">
            ${renderCalculatorInput("Face", "bond.face", state.calculator.bond.face)}
            ${renderCalculatorInput("Coupon %", "bond.coupon", state.calculator.bond.coupon)}
            ${renderCalculatorInput("YTM %", "bond.ytm", state.calculator.bond.ytm)}
            ${renderCalculatorInput("Maturity", "bond.maturity", state.calculator.bond.maturity)}
            ${renderCalculatorInput("Frequency", "bond.frequency", state.calculator.bond.frequency)}
          </div>
          <div class="calc-results">
            <div><span>Price</span><strong>${bondResult.price.toFixed(4)}</strong></div>
            <div><span>Duration</span><strong>${bondResult.duration.toFixed(4)}</strong></div>
            <div><span>Mod duration</span><strong>${bondResult.modifiedDuration.toFixed(4)}</strong></div>
            <div><span>Convexity</span><strong>${bondResult.convexity.toFixed(4)}</strong></div>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderCalculatorInput(label, key, value) {
  return `
    <label class="calc-input-row">
      <span>${label}</span>
      <input class="input" data-calc-key="${key}" value="${value}" />
    </label>
  `;
}

function renderOptionTable(contracts, kind) {
  if (!contracts.length) {
    return emptyStateMarkup(`Fetching ${kind} contracts...`);
  }

  return `
    <div class="table-wrap">
      <table class="terminal-table compact">
        <thead><tr><th>Strike</th><th>Bid</th><th>Ask</th><th>Last</th><th>Vol</th><th>OI</th></tr></thead>
        <tbody>
          ${contracts
            .map(
              (contract) => `
                <tr>
                  <td>${contract.strike?.fmt ?? contract.strike ?? "--"}</td>
                  <td>${contract.bid?.fmt ?? contract.bid ?? "--"}</td>
                  <td>${contract.ask?.fmt ?? contract.ask ?? "--"}</td>
                  <td>${contract.lastPrice?.fmt ?? contract.lastPrice ?? "--"}</td>
                  <td>${contract.volume?.fmt ?? contract.volume ?? "--"}</td>
                  <td>${contract.openInterest?.fmt ?? contract.openInterest ?? "--"}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function emptyStateMarkup(message) {
  return `<div class="empty-state">${message}</div>`;
}

function processCommand() {
  const raw = elements.commandInput.value.trim();
  if (!raw) {
    return;
  }

  const upper = raw.toUpperCase();
  state.commandHistory.unshift(raw);
  state.commandHistory = state.commandHistory.slice(0, 50);
  state.commandHistoryIndex = -1;
  elements.activeCommandDisplay.textContent = upper;

  const parts = upper.split(/\s+/);
  const [first, second, third, fourth] = parts;

  if (first === "HELP") {
    state.panelModules[state.activePanel] = "news";
    state.newsItems = commandCatalog.map((item) => ({
      source: "Command",
      headline: `${item.cmd} — ${item.desc}`,
      time: currentTimeShort(),
      link: "#",
    }));
    renderPanel(state.activePanel);
  } else if (first === "HOME") {
    loadModule("home", state.activePanel);
  } else if (first === "NEWS") {
    loadModule("news", state.activePanel);
  } else if (first === "EQS" || first === "SCREENER") {
    loadModule("screener", state.activePanel);
  } else if (first === "HEAT" || first === "HEATMAP") {
    loadModule("heatmap", state.activePanel);
  } else if (first === "PORT" || first === "PORTFOLIO") {
    loadModule("portfolio", state.activePanel);
  } else if (first === "MACRO") {
    loadModule("macro", state.activePanel);
  } else if (first === "CALC") {
    loadModule("calculator", state.activePanel);
  } else if ((first === "OMON" || first === "OPTIONS") && second) {
    state.panelSymbols[state.activePanel] = second;
    state.optionsSelection.symbol = second;
    loadModule("options", state.activePanel);
    refreshOptions(second, state.optionsSelection.expiration);
  } else if (first === "WATCH" && second) {
    addToWatchlist(second);
  } else if (first === "ALERT" && second && third) {
    createAlert(second, Number(third), ">=");
  } else if (first === "ADDPOS" && second && third && fourth) {
    addPosition({ symbol: second, shares: Number(third), cost: Number(fourth) });
  } else if (second === "Q" || first === "QUOTE") {
    const symbol = first === "QUOTE" ? second : first;
    if (symbol) {
      state.panelSymbols[state.activePanel] = symbol;
      loadModule("quote", state.activePanel);
      refreshQuotes([symbol]);
    }
  } else if (second === "CHART" || first === "CHART") {
    const symbol = first === "CHART" ? second : first;
    if (symbol) {
      state.panelSymbols[state.activePanel] = symbol;
      loadModule("chart", state.activePanel);
      refreshChart(symbol);
    }
  } else if (universeMap.has(first)) {
    state.panelSymbols[state.activePanel] = first;
    loadModule("quote", state.activePanel);
    refreshQuotes([first]);
  } else {
    showToast(`Unknown command: ${upper}`, "error");
  }

  persistWorkspace();
  elements.commandInput.value = "";
  hideAutocomplete();
  renderRails();
}

function handleCommandKeydown(event) {
  if (event.key === "Enter") {
    processCommand();
    return;
  }

  if (event.key === "Escape") {
    elements.commandInput.value = "";
    hideAutocomplete();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (state.commandHistoryIndex < state.commandHistory.length - 1) {
      state.commandHistoryIndex += 1;
      elements.commandInput.value = state.commandHistory[state.commandHistoryIndex];
    }
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (state.commandHistoryIndex > 0) {
      state.commandHistoryIndex -= 1;
      elements.commandInput.value = state.commandHistory[state.commandHistoryIndex];
    } else {
      state.commandHistoryIndex = -1;
      elements.commandInput.value = "";
    }
  }
}

function renderAutocomplete() {
  const value = elements.commandInput.value.trim().toUpperCase();
  if (!value) {
    hideAutocomplete();
    return;
  }

  const commandMatches = commandCatalog
    .filter((item) => item.cmd.startsWith(value) || item.cmd.includes(value))
    .slice(0, 5)
    .map((item) => ({ label: item.cmd, description: item.desc }));

  const symbolMatches = universe
    .filter((item) => item.symbol.startsWith(value) || item.name.toUpperCase().includes(value))
    .slice(0, 6)
    .map((item) => ({ label: `${item.symbol} Q`, description: item.name }));

  const suggestions = [...commandMatches, ...symbolMatches].slice(0, 8);
  if (!suggestions.length) {
    hideAutocomplete();
    return;
  }

  elements.autocomplete.innerHTML = suggestions
    .map(
      (item) => `
        <button class="autocomplete-item" type="button" data-autocomplete="${item.label}">
          <strong>${item.label}</strong>
          <span>${item.description}</span>
        </button>
      `,
    )
    .join("");
  elements.autocomplete.classList.remove("hidden");
}

function hideAutocomplete() {
  elements.autocomplete.classList.add("hidden");
}

function handleGlobalHotkeys(event) {
  if (document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && event.key !== "Escape") {
    return;
  }

  const hotkeys = {
    F1: "home",
    F2: "quote",
    F3: "chart",
    F4: "news",
    F5: "screener",
    F6: "heatmap",
    F7: "portfolio",
    F8: "macro",
    F9: "options",
    F10: "calculator",
  };

  if (event.key === "Tab") {
    event.preventDefault();
    setActivePanel((state.activePanel % 4) + 1);
    return;
  }

  if (hotkeys[event.key]) {
    event.preventDefault();
    loadModule(hotkeys[event.key], state.activePanel);
    return;
  }

  if (event.key === "Escape") {
    elements.commandInput.focus();
    hideAutocomplete();
  }
}

function addToWatchlist(symbol) {
  const upper = symbol.toUpperCase();
  if (!state.watchlist.includes(upper)) {
    state.watchlist.unshift(upper);
    state.watchlist = state.watchlist.slice(0, 24);
    persistWorkspace();
    renderRails();
    refreshQuotes([upper]);
    showToast(`${upper} added to watchlist.`, "success");
  }
}

function removeFromWatchlist(symbol) {
  state.watchlist = state.watchlist.filter((item) => item !== symbol);
  persistWorkspace();
  renderRails();
}

function createAlert(symbol, threshold, operator) {
  if (!symbol || Number.isNaN(threshold)) {
    return;
  }
  state.alerts.unshift({ symbol: symbol.toUpperCase(), operator, threshold, status: "watching" });
  state.alerts = state.alerts.slice(0, 16);
  persistWorkspace();
  renderRails();
  renderAllPanels();
  showToast(`Alert added for ${symbol.toUpperCase()}.`, "success");
}

function addPosition(position) {
  if (!position.symbol || !position.shares || !position.cost) {
    return;
  }
  state.positions.unshift({
    symbol: position.symbol.toUpperCase(),
    shares: position.shares,
    cost: position.cost,
  });
  persistWorkspace();
  renderAllPanels();
  refreshQuotes([position.symbol.toUpperCase()]);
  showToast(`Position added for ${position.symbol.toUpperCase()}.`, "success");
}

function removePositionBySymbol(symbol) {
  state.positions = state.positions.filter((position) => position.symbol !== symbol);
  persistWorkspace();
  renderAllPanels();
}

function persistWorkspace() {
  if (!state.user) {
    return;
  }

  state.userState = {
    ...state.userState,
    watchlist: state.watchlist,
    alerts: state.alerts,
    positions: state.positions,
    panelModules: state.panelModules,
    panelSymbols: state.panelSymbols,
    commandHistory: state.commandHistory,
  };
  saveUserState(state.user.id, state.userState);
}

async function refreshAllData() {
  elements.networkStatus.textContent = "Syncing";
  const symbols = new Set([...state.watchlist, ...state.positions.map((item) => item.symbol), ...Object.values(state.panelSymbols)]);

  await Promise.allSettled([
    refreshQuotes([...symbols]),
    refreshNewsFeed(),
    refreshFxMonitor(),
    refreshChart(state.panelSymbols[3] ?? "AAPL"),
    refreshOptions(state.panelSymbols[2] ?? "AAPL", state.optionsSelection.expiration),
  ]);

  if (elements.networkStatus.textContent === "Syncing") {
    elements.networkStatus.textContent = "Live";
  }
  renderRails();
  renderAllPanels();
}

async function refreshQuotes(symbols) {
  try {
    const quotes = await fetchQuotes(symbols);
    quotes.forEach((quote) => {
      state.quotes.set(quote.symbol, quote);
    });
    evaluateAlerts();
    renderRails();
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshChart(symbol, range = "1mo", interval = "1d") {
  try {
    const data = await fetchChart(symbol, range, interval);
    state.chartCache.set(buildChartKey(symbol, range, interval), data);
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshOptions(symbol, expiration) {
  state.optionsSelection.symbol = symbol;
  try {
    const chain = await fetchOptions(symbol, expiration);
    if (!state.optionsSelection.expiration && chain.expirations.length) {
      state.optionsSelection.expiration = chain.expirations[0];
    }
    state.optionsCache.set(buildOptionKey(symbol, expiration), chain);
    state.optionsCache.set(buildOptionKey(symbol, state.optionsSelection.expiration), chain);
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshNewsFeed() {
  try {
    const items = await fetchNews();
    if (items.length) {
      state.newsItems = items;
      renderAllPanels();
    }
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

async function refreshFxMonitor() {
  try {
    state.fxRates = await fetchFxRates();
    renderAllPanels();
  } catch {
    elements.networkStatus.textContent = "Fallback";
  }
}

function evaluateAlerts() {
  state.alerts = state.alerts.map((alert) => {
    const quote = buildQuote(alert.symbol);
    if (!quote) {
      return alert;
    }
    const triggered = alert.operator === ">=" ? quote.price >= alert.threshold : quote.price <= alert.threshold;
    return { ...alert, status: triggered ? "triggered" : "watching" };
  });
}

function updateClock() {
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  elements.clockDisplay.textContent = `${ny.toLocaleTimeString("en-US", { hour12: false })} EST`;

  const elapsedSeconds = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
  const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  elements.sessionClock.textContent = `${hours}:${minutes}:${seconds}`;
  updateMarketStatus(ny);
}

function handleRefreshCountdown() {
  if (!state.user) {
    return;
  }
  state.refreshCountdown -= 1;
  if (state.refreshCountdown <= 0) {
    state.refreshCountdown = 30;
    refreshAllData();
  }
  updateStatusBar();
}

function updateMarketStatus(nyTime) {
  const day = nyTime.getDay();
  const hour = nyTime.getHours();
  const minute = nyTime.getMinutes();

  if (day === 0 || day === 6) {
    elements.marketStatus.textContent = "Weekend";
    return;
  }
  if (hour < 9 || (hour === 9 && minute < 30)) {
    elements.marketStatus.textContent = "Pre-market";
    return;
  }
  if (hour < 16) {
    elements.marketStatus.textContent = "Open";
    return;
  }
  elements.marketStatus.textContent = "After-hours";
}

function updateStatusBar() {
  elements.lastUpdated.textContent = currentTimeShort();
  elements.refreshCountdown.textContent = `${state.refreshCountdown}s`;
  elements.watchCount.textContent = `${state.watchlist.length}`;
  elements.alertCount.textContent = `${state.alerts.length}`;
}

function showToast(message, tone = "neutral") {
  elements.toast.textContent = message;
  elements.toast.dataset.tone = tone;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2800);
}

function getFilteredUniverse(filters) {
  return universe.filter((item) => {
    if (filters.universe && item.universe !== filters.universe) {
      return false;
    }
    if (filters.sector && item.sector !== filters.sector) {
      return false;
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      return item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    }
    return true;
  });
}

function setNestedCalculatorValue(path, value) {
  const [root, field] = path.split(".");
  if (!state.calculator[root]) {
    return;
  }
  state.calculator[root][field] = Number.isFinite(value) ? value : state.calculator[root][field];
}

function buildChartKey(symbol, range, interval) {
  return `${symbol}:${range}:${interval}`;
}

function buildOptionKey(symbol, expiration) {
  return `${symbol}:${expiration ?? "nearest"}`;
}

function buildLineChartSvg(points) {
  if (!points.length) {
    return "";
  }

  const width = 700;
  const height = 260;
  const closes = points.map((item) => item.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const line = points
    .map((item, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((item.close - min) / range) * (height - 20) - 10;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="line-chart" preserveAspectRatio="none">
      <polyline points="${line}" fill="none" stroke="#6be6ff" stroke-width="3"></polyline>
    </svg>
  `;
}

function calculateBlackScholes({ spot, strike, years, rate, volatility }) {
  const safeYears = Math.max(Number(years), 0.0001);
  const safeSpot = Math.max(Number(spot), 0.0001);
  const safeStrike = Math.max(Number(strike), 0.0001);
  const safeRate = Number(rate) / 100;
  const safeVol = Math.max(Number(volatility) / 100, 0.0001);
  const d1 = (Math.log(safeSpot / safeStrike) + (safeRate + (safeVol ** 2) / 2) * safeYears) / (safeVol * Math.sqrt(safeYears));
  const d2 = d1 - safeVol * Math.sqrt(safeYears);
  const normal = (value) => 0.5 * (1 + erf(value / Math.sqrt(2)));
  const density = (value) => Math.exp(-(value ** 2) / 2) / Math.sqrt(2 * Math.PI);

  return {
    call: safeSpot * normal(d1) - safeStrike * Math.exp(-safeRate * safeYears) * normal(d2),
    put: safeStrike * Math.exp(-safeRate * safeYears) * normal(-d2) - safeSpot * normal(-d1),
    delta: normal(d1),
    gamma: density(d1) / (safeSpot * safeVol * Math.sqrt(safeYears)),
  };
}

function calculateBond({ face, coupon, ytm, maturity, frequency }) {
  const faceValue = Number(face);
  const couponRate = Number(coupon) / 100;
  const yieldRate = Number(ytm) / 100;
  const periodsPerYear = Number(frequency);
  const totalPeriods = Math.max(1, Math.round(Number(maturity) * periodsPerYear));
  const couponPayment = (faceValue * couponRate) / periodsPerYear;
  const discount = yieldRate / periodsPerYear;

  let price = 0;
  let duration = 0;
  let convexity = 0;

  for (let period = 1; period <= totalPeriods; period += 1) {
    const cashflow = period === totalPeriods ? couponPayment + faceValue : couponPayment;
    const presentValue = cashflow / ((1 + discount) ** period);
    price += presentValue;
    duration += period * presentValue;
    convexity += period * (period + 1) * presentValue;
  }

  const macaulayDuration = duration / price / periodsPerYear;
  const modifiedDuration = macaulayDuration / (1 + discount);
  return {
    price,
    duration: macaulayDuration,
    modifiedDuration,
    convexity: convexity / (price * periodsPerYear * periodsPerYear),
  };
}

function erf(value) {
  const sign = value >= 0 ? 1 : -1;
  const absolute = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absolute);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-(absolute ** 2)));
  return sign * y;
}

function formatPrice(value, symbol) {
  const digits = symbol === "BTC-USD" || symbol === "USD" ? 0 : 2;
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatSignedPct(value) {
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
}

function formatMarketCap(value) {
  if (!value) {
    return "N/A";
  }
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }
  return `$${Number(value).toFixed(0)}`;
}

function formatVolume(value) {
  if (!value) {
    return "N/A";
  }
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return `${value}`;
}

function formatExpiry(value) {
  return new Date(Number(value) * 1000).toLocaleDateString();
}

function currentTimeShort() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

init();
*/

function renderFunctionRow() {
  functionRow.innerHTML = functionKeys
    .map(
      (item) => `
        <button class="function-key ${state.panelModules[state.activePanel] === item.module ? "is-active" : ""}" data-module="${item.module}">
          <span>${item.key}</span> ${item.label}
        </button>
      `,
    )
    .join("");
}

function launchTerminal() {
  state.launched = true;
  onboarding.classList.add("hidden");
  terminalApp.classList.remove("hidden");
  commandInput.focus();
}

function setActivePanel(panel) {
  state.activePanel = panel;
  document.querySelectorAll(".panel").forEach((item) => {
    item.classList.toggle("active-panel", Number(item.dataset.panel) === panel);
  });
  renderFunctionRow();
}

function cycleModule(panel, direction) {
  const currentIndex = moduleOrder.indexOf(state.panelModules[panel]);
  const nextIndex = (currentIndex + direction + moduleOrder.length) % moduleOrder.length;
  loadModule(moduleOrder[nextIndex], panel);
}

function loadModule(moduleName, panel) {
  state.panelModules[panel] = moduleName;
  document.querySelector(`#panelTitle${panel}`).textContent = moduleTitles[moduleName] ?? moduleName.toUpperCase();
  renderPanel(panel);
  setActivePanel(panel);
  renderFunctionRow();
}

function renderAllPanels() {
  [1, 2, 3, 4].forEach((panel) => renderPanel(panel));
}

function renderPanel(panel) {
  const moduleName = state.panelModules[panel];
  const container = document.querySelector(`#panelContent${panel}`);
  if (!container) {
    return;
  }

  const renderers = {
    home: renderHome,
    quote: renderQuote,
    screener: renderScreener,
    heatmap: renderHeatmap,
    portfolio: renderPortfolio,
    macro: renderMacro,
    news: renderNews,
    calculator: renderCalculator,
  };

  const renderer = renderers[moduleName] ?? renderHome;
  container.innerHTML = renderer(panel);
}

function renderHome() {
  const cards = state.watchlist.slice(0, 8)
    .map(
      (item) => `
        <article class="market-card">
          <span class="market-symbol">${item.symbol}</span>
          <strong>${formatPrice(item.price, item.symbol)}</strong>
          <span class="${item.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(item.changePct)}</span>
          <small>${item.sector}</small>
        </article>
      `,
    )
    .join("");

  const alertMarkup = state.alerts
    .map(
      (alert) => `
        <li>
          <strong>${alert.symbol}</strong>
          <span>${alert.operator} ${alert.threshold}</span>
          <span class="${alert.status === "triggered" ? "positive" : "muted"}">${alert.status}</span>
        </li>
      `,
    )
    .join("");

  const briefingMarkup = state.briefings.slice(0, 3)
    .map(
      (item) => `
        <article class="brief-item">
          <strong>${item.title}</strong>
          <span>${item.impact}</span>
          <p>${item.detail}</p>
        </article>
      `,
    )
    .join("");

  return `
    <section class="module-stack">
      <div class="market-strip">${cards}</div>
      <div class="split-grid two-up">
        <section class="sub-panel">
          <div class="sub-panel-header"><span>Active alerts</span><span>${state.alerts.length}</span></div>
          <ul class="status-list">${alertMarkup}</ul>
        </section>
        <section class="sub-panel">
          <div class="sub-panel-header"><span>Desk briefings</span><span>Live</span></div>
          <div class="brief-grid">${briefingMarkup}</div>
        </section>
      </div>
    </section>
  `;
}

function renderQuote(panel) {
  const symbol = state.panelSymbols[panel] ?? "AAPL";
  const quote = marketMap.get(symbol) ?? marketMap.get("AAPL");
  const spread = quote.price * 0.0012;
  const dayHigh = quote.price * 1.012;
  const dayLow = quote.price * 0.988;
  const previousClose = quote.price / (1 + quote.changePct / 100);
  const marketCap = quote.marketCap ? formatMarketCap(quote.marketCap) : "N/A";

  return `
    <section class="module-stack">
      <div class="toolbar-row">
        <input class="panel-input" data-symbol-input="${panel}" value="${quote.symbol}" />
        <button class="panel-button" data-symbol-go="${panel}">LOAD</button>
        <span class="toolbar-label">${quote.name}</span>
      </div>
      <div class="quote-hero">
        <div>
          <span class="quote-symbol">${quote.symbol}</span>
          <strong class="quote-price">${formatPrice(quote.price, quote.symbol)}</strong>
          <span class="${quote.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(quote.changePct)}</span>
        </div>
        <div class="quote-meta">${quote.sector} · ${quote.universe}</div>
      </div>
      <table class="terminal-table">
        <tbody>
          <tr><td>Bid</td><td>${formatPrice(quote.price - spread, quote.symbol)}</td><td>Ask</td><td>${formatPrice(quote.price + spread, quote.symbol)}</td></tr>
          <tr><td>Prev close</td><td>${formatPrice(previousClose, quote.symbol)}</td><td>Day high</td><td>${formatPrice(dayHigh, quote.symbol)}</td></tr>
          <tr><td>Day low</td><td>${formatPrice(dayLow, quote.symbol)}</td><td>Market cap</td><td>${marketCap}</td></tr>
          <tr><td>Exchange</td><td>${quote.exchange}</td><td>Universe</td><td>${quote.universe}</td></tr>
        </tbody>
      </table>
      <div class="sparkline-row">
        ${buildSparkline(quote.changePct)}
      </div>
    </section>
  `;
}

function renderScreener(panel) {
  const filters = state.screenerFilters[panel];
  const filtered = getFilteredUniverse(filters);
  const sectors = [...new Set(universe.map((item) => item.sector))].sort();
  const universes = [...new Set(universe.map((item) => item.universe))].sort();

  return `
    <section class="module-stack">
      <div class="toolbar-row wrap">
        <select class="panel-select" data-screener-universe="${panel}">
          <option value="">ALL INDEXES</option>
          ${universes.map((item) => `<option value="${item}" ${filters.universe === item ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <select class="panel-select" data-screener-sector="${panel}">
          <option value="">ALL SECTORS</option>
          ${sectors.map((item) => `<option value="${item}" ${filters.sector === item ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <input class="panel-input grow" data-screener-search="${panel}" value="${filters.search}" placeholder="ticker/name" />
        <span class="toolbar-label">${filtered.length} results</span>
      </div>
      <div class="table-scroll">
        <table class="terminal-table compact">
          <thead>
            <tr><th>Ticker</th><th>Name</th><th>Sector</th><th>Index</th><th>Price</th><th>Chg%</th></tr>
          </thead>
          <tbody>
            ${filtered.slice(0, 60).map((item) => `
              <tr data-load-symbol="${item.symbol}">
                <td class="highlight-cell">${item.symbol}</td>
                <td>${item.name}</td>
                <td>${item.sector}</td>
                <td>${item.universe}</td>
                <td>${formatPrice(item.price, item.symbol)}</td>
                <td class="${item.changePct >= 0 ? "positive" : "negative"}">${formatSignedPct(item.changePct)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderHeatmap() {
  const groups = buildHeatmapGroups();
  const sectors = Object.entries(groups)
    .map(([sector, symbols]) => {
      const blocks = symbols
        .map((symbol) => {
          const item = marketMap.get(symbol);
          if (!item) {
            return "";
          }
          const magnitude = Math.max(1, Math.min(4, Math.round(Math.abs(item.changePct)) + 1));
          const tone = item.changePct >= 0 ? "up" : "down";
          return `
            <button class="heat-block ${tone} size-${magnitude}" data-load-symbol="${item.symbol}">
              <strong>${item.symbol}</strong>
              <span>${formatSignedPct(item.changePct)}</span>
            </button>
          `;
        })
        .join("");

      return `
        <section class="heat-sector">
          <div class="sub-panel-header"><span>${sector}</span><span>${symbols.length}</span></div>
          <div class="heat-grid">${blocks}</div>
        </section>
      `;
    })
    .join("");

  return `<section class="module-stack heatmap-board">${sectors}</section>`;
}

function renderPortfolio() {
  const rows = state.positions.map((position) => {
    const quote = marketMap.get(position.symbol);
    const mark = quote?.price ?? position.cost;
    const value = mark * position.shares;
    const basis = position.cost * position.shares;
    const pnl = value - basis;
    const pnlPct = basis ? (pnl / basis) * 100 : 0;
    return { ...position, mark, value, pnl, pnlPct };
  });

  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const totalBasis = rows.reduce((sum, row) => sum + row.cost * row.shares, 0);
  const totalPnl = totalValue - totalBasis;
  const totalPct = totalBasis ? (totalPnl / totalBasis) * 100 : 0;

  return `
    <section class="module-stack">
      <div class="portfolio-summary-grid">
        <article class="summary-box"><span>Total value</span><strong>${formatPrice(totalValue, "USD")}</strong></article>
        <article class="summary-box"><span>Total P/L</span><strong class="${totalPnl >= 0 ? "positive" : "negative"}">${totalPnl >= 0 ? "+" : ""}${formatPrice(totalPnl, "USD")}</strong></article>
        <article class="summary-box"><span>Total P/L %</span><strong class="${totalPct >= 0 ? "positive" : "negative"}">${formatSignedPct(totalPct)}</strong></article>
      </div>
      <div class="table-scroll">
        <table class="terminal-table compact">
          <thead>
            <tr><th>Ticker</th><th>Shares</th><th>Cost</th><th>Mark</th><th>Value</th><th>P/L</th><th>P/L %</th></tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr data-load-symbol="${row.symbol}">
                <td class="highlight-cell">${row.symbol}</td>
                <td>${row.shares}</td>
                <td>${formatPrice(row.cost, row.symbol)}</td>
                <td>${formatPrice(row.mark, row.symbol)}</td>
                <td>${formatPrice(row.value, "USD")}</td>
                <td class="${row.pnl >= 0 ? "positive" : "negative"}">${row.pnl >= 0 ? "+" : ""}${formatPrice(row.pnl, "USD")}</td>
                <td class="${row.pnlPct >= 0 ? "positive" : "negative"}">${formatSignedPct(row.pnlPct)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMacro() {
  const curveMarkup = macroBoard.curve
    .map((point) => {
      const height = point.yield * 14;
      return `
        <div class="curve-bar-wrap">
          <div class="curve-bar" style="height:${height}px"></div>
          <strong>${point.yield.toFixed(2)}%</strong>
          <span>${point.tenor}</span>
        </div>
      `;
    })
    .join("");

  const indicators = macroBoard.indicators
    .map(
      (item) => `
        <tr>
          <td>${item.label}</td>
          <td class="tone-${item.tone}">${item.value}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <section class="module-stack">
      <section class="sub-panel">
        <div class="sub-panel-header"><span>Yield curve</span><span>US Treasury</span></div>
        <div class="curve-grid">${curveMarkup}</div>
      </section>
      <section class="sub-panel">
        <div class="sub-panel-header"><span>Indicators</span><span>Macro tape</span></div>
        <table class="terminal-table compact"><tbody>${indicators}</tbody></table>
      </section>
    </section>
  `;
}

function renderNews() {
  return `
    <section class="module-stack">
      ${state.news.map((item) => `
        <article class="news-card">
          <div class="news-meta"><span>${item.source}</span><span>${item.time}</span></div>
          <strong>${item.headline}</strong>
        </article>
      `).join("")}
    </section>
  `;
}

function renderCalculator(panel) {
  const options = state.calculator.options;
  const bond = state.calculator.bond;
  const optionsResult = calculateBlackScholes(options);
  const bondResult = calculateBond(bond);

  return `
    <section class="module-stack">
      <div class="split-grid two-up">
        <section class="sub-panel">
          <div class="sub-panel-header"><span>Black-Scholes</span><span>Options</span></div>
          <div class="calc-grid">
            ${renderCalcInput("Spot", "option-spot", options.spot)}
            ${renderCalcInput("Strike", "option-strike", options.strike)}
            ${renderCalcInput("Years", "option-years", options.years)}
            ${renderCalcInput("Rate %", "option-rate", options.rate)}
            ${renderCalcInput("Vol %", "option-volatility", options.volatility)}
          </div>
          <button class="panel-button wide" data-calc-run="options">CALCULATE</button>
          <table class="terminal-table compact calc-table">
            <tbody>
              <tr><td>Call</td><td>${optionsResult.call.toFixed(4)}</td><td>Put</td><td>${optionsResult.put.toFixed(4)}</td></tr>
              <tr><td>Delta</td><td>${optionsResult.delta.toFixed(4)}</td><td>Gamma</td><td>${optionsResult.gamma.toFixed(6)}</td></tr>
              <tr><td>Theta/day</td><td>${optionsResult.theta.toFixed(4)}</td><td>Vega</td><td>${optionsResult.vega.toFixed(4)}</td></tr>
            </tbody>
          </table>
        </section>

        <section class="sub-panel">
          <div class="sub-panel-header"><span>Bond pricing</span><span>Fixed income</span></div>
          <div class="calc-grid">
            ${renderCalcInput("Face", "bond-face", bond.face)}
            ${renderCalcInput("Coupon %", "bond-coupon", bond.coupon)}
            ${renderCalcInput("YTM %", "bond-ytm", bond.ytm)}
            ${renderCalcInput("Maturity", "bond-maturity", bond.maturity)}
            ${renderCalcInput("Freq", "bond-frequency", bond.frequency)}
          </div>
          <button class="panel-button wide" data-calc-run="bond">CALCULATE</button>
          <table class="terminal-table compact calc-table">
            <tbody>
              <tr><td>Price</td><td>${bondResult.price.toFixed(4)}</td><td>Duration</td><td>${bondResult.duration.toFixed(4)}</td></tr>
              <tr><td>Mod duration</td><td>${bondResult.modifiedDuration.toFixed(4)}</td><td>Convexity</td><td>${bondResult.convexity.toFixed(4)}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </section>
  `;
}

function renderCalcInput(label, name, value) {
  return `
    <label class="calc-input-row">
      <span>${label}</span>
      <input class="panel-input" data-calc-input="${name}" value="${value}" />
    </label>
  `;
}

function processCommand() {
  const raw = commandInput.value.trim();
  if (!raw) {
    return;
  }

  const upper = raw.toUpperCase();
  state.commandHistory.unshift(raw);
  state.commandHistory = state.commandHistory.slice(0, 50);
  state.commandHistoryIndex = -1;
  activeCommandDisplay.textContent = upper;
  hideAutocomplete();

  const parts = upper.split(/\s+/);
  const first = parts[0];

  if (first === "HELP") {
    state.news.unshift({ source: "System", headline: commandCatalog.map((item) => item.cmd).join(" · "), time: currentTimeShort() });
    state.news = state.news.slice(0, 8);
    loadModule("news", state.activePanel);
  } else if (first === "HOME") {
    loadModule("home", state.activePanel);
  } else if (first === "QUOTE" || parts.includes("Q")) {
    const symbol = first === "QUOTE" ? parts[1] : first;
    if (marketMap.has(symbol)) {
      state.panelSymbols[state.activePanel] = symbol;
    }
    loadModule("quote", state.activePanel);
  } else if (first === "EQS" || first === "SCREENER") {
    loadModule("screener", state.activePanel);
  } else if (first === "HEAT" || first === "HEATMAP") {
    loadModule("heatmap", state.activePanel);
  } else if (first === "PORT" || first === "PORTFOLIO") {
    loadModule("portfolio", state.activePanel);
  } else if (first === "MACRO") {
    loadModule("macro", state.activePanel);
  } else if (first === "NEWS") {
    loadModule("news", state.activePanel);
  } else if (first === "CALC") {
    loadModule("calculator", state.activePanel);
  } else if (first === "ALERT" && parts[1] && parts[2]) {
    addAlert(parts[1], Number(parts[2]));
  } else if (marketMap.has(first)) {
    state.panelSymbols[state.activePanel] = first;
    loadModule("quote", state.activePanel);
  } else {
    state.news.unshift({ source: "System", headline: `Unknown command: ${upper}`, time: currentTimeShort() });
    state.news = state.news.slice(0, 8);
    loadModule("news", state.activePanel);
  }

  commandInput.value = "";
  updateMeta();
}

function addAlert(symbol, threshold) {
  if (!marketMap.has(symbol) || Number.isNaN(threshold)) {
    return;
  }
  state.alerts.unshift({ symbol, operator: ">=", threshold, status: "watching" });
  state.alerts = state.alerts.slice(0, 8);
  renderAllPanels();
  updateMeta();
}

function tickMarket() {
  universe.forEach((item) => {
    const stored = marketMap.get(item.symbol);
    const delta = (Math.random() - 0.5) * 0.9;
    stored.changePct = Number((stored.changePct + delta).toFixed(2));
    stored.price = Number((stored.price * (1 + delta / 100)).toFixed(item.symbol.includes("USD") || item.symbol.includes("=F") ? 2 : 2));
  });

  state.watchlist = state.watchlist.map((item) => ({ ...marketMap.get(item.symbol) }));
  evaluateAlerts();
  renderAllPanels();
  updateMeta();
}

function evaluateAlerts() {
  state.alerts = state.alerts.map((alert) => {
    const item = marketMap.get(alert.symbol);
    const triggered = item ? item.price >= alert.threshold : false;
    return { ...alert, status: triggered ? "triggered" : "watching" };
  });
}

function tickCountdown() {
  state.countdown -= 1;
  if (state.countdown <= 0) {
    state.countdown = 20;
  }
  updateMeta();
}

function updateMeta() {
  const now = new Date();
  lastUpdated.textContent = now.toLocaleTimeString("en-US", { hour12: false });
  refreshCountdown.textContent = `${state.countdown}s`;
  watchCount.textContent = `${state.watchlist.length}`;
  alertCount.textContent = `${state.alerts.length}`;
  updateMarketStatus();
}

function updateClock() {
  const now = new Date();
  const newYork = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  clockDisplay.textContent = `${newYork.toLocaleTimeString("en-US", { hour12: false })} EST`;

  const elapsed = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
  const hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  sessionClock.textContent = `${hours}:${minutes}:${seconds}`;
}

function updateMarketStatus() {
  const time = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hour = time.getHours();
  const minutes = time.getMinutes();
  const day = time.getDay();

  if (day === 0 || day === 6) {
    marketStatus.textContent = "WEEKEND";
  } else if (hour < 9 || (hour === 9 && minutes < 30)) {
    marketStatus.textContent = "PRE-MKT";
  } else if (hour < 16) {
    marketStatus.textContent = "OPEN";
  } else {
    marketStatus.textContent = "AFTER HRS";
  }
}

function showAutocomplete() {
  const value = commandInput.value.trim().toUpperCase();
  if (!value) {
    hideAutocomplete();
    return;
  }

  const commandMatches = commandCatalog
    .filter((item) => item.cmd.startsWith(value) || item.cmd.includes(value))
    .slice(0, 4)
    .map((item) => ({ text: item.cmd, desc: item.desc }));

  const tickerMatches = universe
    .filter((item) => item.symbol.startsWith(value))
    .slice(0, 5)
    .map((item) => ({ text: `${item.symbol} Q`, desc: item.name }));

  const suggestions = [...commandMatches, ...tickerMatches].slice(0, 8);
  if (!suggestions.length) {
    hideAutocomplete();
    return;
  }

  autocomplete.innerHTML = suggestions
    .map(
      (item) => `
        <button class="autocomplete-item" data-autocomplete="${item.text}">
          <strong>${item.text}</strong>
          <span>${item.desc}</span>
        </button>
      `,
    )
    .join("");

  autocomplete.style.display = "grid";
}

function hideAutocomplete() {
  autocomplete.style.display = "none";
}

function handleCommandInputKeydown(event) {
  if (event.key === "Enter") {
    processCommand();
  } else if (event.key === "Escape") {
    commandInput.value = "";
    hideAutocomplete();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (state.commandHistoryIndex < state.commandHistory.length - 1) {
      state.commandHistoryIndex += 1;
      commandInput.value = state.commandHistory[state.commandHistoryIndex];
    }
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    if (state.commandHistoryIndex > 0) {
      state.commandHistoryIndex -= 1;
      commandInput.value = state.commandHistory[state.commandHistoryIndex];
    } else {
      state.commandHistoryIndex = -1;
      commandInput.value = "";
    }
  }
}

function handleGlobalKeydown(event) {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName) && event.key !== "Escape") {
    return;
  }

  const keyMap = {
    F1: "home",
    F2: "quote",
    F3: "screener",
    F4: "heatmap",
    F5: "portfolio",
    F6: "macro",
    F7: "news",
    F8: "calculator",
  };

  if (event.key === "Tab") {
    event.preventDefault();
    const next = state.activePanel % 4 + 1;
    setActivePanel(next);
    return;
  }

  if (keyMap[event.key]) {
    event.preventDefault();
    loadModule(keyMap[event.key], state.activePanel);
    return;
  }

  if (event.key === "Escape") {
    commandInput.value = "";
    hideAutocomplete();
    commandInput.focus();
  }
}

function handleDocumentClick(event) {
  const autoItem = event.target.closest("[data-autocomplete]");
  if (autoItem) {
    commandInput.value = autoItem.dataset.autocomplete;
    processCommand();
    return;
  }

  const symbolRow = event.target.closest("[data-load-symbol]");
  if (symbolRow) {
    const symbol = symbolRow.dataset.loadSymbol;
    state.panelSymbols[state.activePanel] = symbol;
    loadModule("quote", state.activePanel);
    return;
  }

  const symbolGo = event.target.closest("[data-symbol-go]");
  if (symbolGo) {
    const panel = Number(symbolGo.dataset.symbolGo);
    const input = document.querySelector(`[data-symbol-input="${panel}"]`);
    const symbol = input?.value.toUpperCase().trim();
    if (marketMap.has(symbol)) {
      state.panelSymbols[panel] = symbol;
      renderPanel(panel);
    }
    return;
  }

  const calcButton = event.target.closest("[data-calc-run]");
  if (calcButton) {
    updateCalculatorState();
    renderAllPanels();
    return;
  }

  if (!event.target.closest(".command-bar-shell")) {
    hideAutocomplete();
  }
}

function handleDocumentInput(event) {
  const universeSelect = event.target.closest("[data-screener-universe]");
  if (universeSelect) {
    state.screenerFilters[Number(universeSelect.dataset.screenerUniverse)].universe = universeSelect.value;
    renderPanel(Number(universeSelect.dataset.screenerUniverse));
    return;
  }

  const sectorSelect = event.target.closest("[data-screener-sector]");
  if (sectorSelect) {
    state.screenerFilters[Number(sectorSelect.dataset.screenerSector)].sector = sectorSelect.value;
    renderPanel(Number(sectorSelect.dataset.screenerSector));
    return;
  }

  const searchInput = event.target.closest("[data-screener-search]");
  if (searchInput) {
    state.screenerFilters[Number(searchInput.dataset.screenerSearch)].search = searchInput.value;
    renderPanel(Number(searchInput.dataset.screenerSearch));
  }
}

function updateCalculatorState() {
  document.querySelectorAll("[data-calc-input]").forEach((input) => {
    const value = Number(input.value);
    if (Number.isNaN(value)) {
      return;
    }

    if (input.dataset.calcInput.startsWith("option-")) {
      const key = input.dataset.calcInput.replace("option-", "");
      state.calculator.options[key === "volatility" ? "volatility" : key === "rate" ? "rate" : key === "years" ? "years" : key] = value;
    }

    if (input.dataset.calcInput.startsWith("bond-")) {
      const key = input.dataset.calcInput.replace("bond-", "");
      const mapping = { face: "face", coupon: "coupon", ytm: "ytm", maturity: "maturity", frequency: "frequency" };
      state.calculator.bond[mapping[key]] = value;
    }
  });
}

function getFilteredUniverse(filters) {
  return universe.filter((item) => {
    if (filters.universe && item.universe !== filters.universe) {
      return false;
    }
    if (filters.sector && item.sector !== filters.sector) {
      return false;
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return item.symbol.toLowerCase().includes(search) || item.name.toLowerCase().includes(search);
    }
    return true;
  });
}

function buildSparkline(changePct) {
  const points = Array.from({ length: 16 }, (_, index) => {
    const base = 20 + Math.sin(index / 2) * 8 + index * 0.8 + changePct * 0.9;
    return `${index * 18},${Math.max(4, 48 - base)}`;
  }).join(" ");
  const color = changePct >= 0 ? "#33ff66" : "#ff5555";
  return `
    <svg class="sparkline" viewBox="0 0 270 56" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"></polyline>
    </svg>
  `;
}

function calculateBlackScholes({ spot, strike, years, rate, volatility }) {
  const safeYears = Math.max(years, 0.0001);
  const safeVol = Math.max(volatility / 100, 0.0001);
  const safeRate = rate / 100;
  const d1 = (Math.log(spot / strike) + (safeRate + (safeVol ** 2) / 2) * safeYears) / (safeVol * Math.sqrt(safeYears));
  const d2 = d1 - safeVol * Math.sqrt(safeYears);
  const normal = (value) => 0.5 * (1 + erf(value / Math.sqrt(2)));
  const density = (value) => Math.exp(-(value ** 2) / 2) / Math.sqrt(2 * Math.PI);
  const call = spot * normal(d1) - strike * Math.exp(-safeRate * safeYears) * normal(d2);
  const put = call - spot + strike * Math.exp(-safeRate * safeYears);
  const delta = normal(d1);
  const gamma = density(d1) / (spot * safeVol * Math.sqrt(safeYears));
  const theta = (-(spot * density(d1) * safeVol) / (2 * Math.sqrt(safeYears)) - safeRate * strike * Math.exp(-safeRate * safeYears) * normal(d2)) / 365;
  const vega = (spot * density(d1) * Math.sqrt(safeYears)) / 100;
  return { call, put, delta, gamma, theta, vega };
}

function calculateBond({ face, coupon, ytm, maturity, frequency }) {
  const payments = Math.max(1, Math.round(maturity * frequency));
  const couponCash = (coupon / 100) * face / frequency;
  const discount = ytm / 100 / frequency;
  let price = 0;
  let duration = 0;
  let convexity = 0;

  for (let period = 1; period <= payments; period += 1) {
    const cashflow = period === payments ? couponCash + face : couponCash;
    const presentValue = cashflow / ((1 + discount) ** period);
    price += presentValue;
    duration += period * presentValue;
    convexity += period * (period + 1) * presentValue;
  }

  const macDuration = duration / price / frequency;
  const modifiedDuration = macDuration / (1 + discount);
  return {
    price,
    duration: macDuration,
    modifiedDuration,
    convexity: convexity / (price * frequency * frequency),
  };
}

function erf(value) {
  const sign = value >= 0 ? 1 : -1;
  const absolute = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absolute);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-(absolute ** 2));
  return sign * y;
}

function formatPrice(value, symbol) {
  const digits = symbol === "BTC-USD" || symbol === "USD" ? 0 : 2;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatSignedPct(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMarketCap(value) {
  if (!value) {
    return "N/A";
  }
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  return `$${(value / 1e6).toFixed(2)}M`;
}

function currentTimeShort() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

init();
````

## `src/auth.js`

````javascript
import {
  buildDefaultUserState,
  clearSession,
  getSession,
  getUserState,
  getUsers,
  saveSession,
  saveUserState,
  saveUsers,
} from "./storage.js";

function normalizeIdentifier(value) {
  return value.trim().toLowerCase();
}

function generateId() {
  return `usr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function createAccount(payload) {
  const users = getUsers();
  const username = payload.username.trim();
  const email = payload.email.trim().toLowerCase();

  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already exists.");
  }

  if (users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("Email already exists.");
  }

  const passwordHash = await hashPassword(payload.password);
  const user = {
    id: generateId(),
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email,
    username,
    role: payload.role,
    createdAt: new Date().toISOString(),
    passwordHash,
  };

  users.push(user);
  saveUsers(users);
  saveUserState(user.id, buildDefaultUserState());
  saveSession({ userId: user.id, createdAt: new Date().toISOString() });

  return { ...user, passwordHash: undefined };
}

export async function login(payload) {
  const users = getUsers();
  const identifier = normalizeIdentifier(payload.identifier);
  const user = users.find((item) => item.username.toLowerCase() === identifier || item.email.toLowerCase() === identifier);

  if (!user) {
    throw new Error("Account not found.");
  }

  const passwordHash = await hashPassword(payload.password);
  if (passwordHash != user.passwordHash) {
    throw new Error("Incorrect password.");
  }

  saveSession({ userId: user.id, createdAt: new Date().toISOString() });
  return { ...user, passwordHash: undefined };
}

export function logout() {
  clearSession();
}

export function restoreSessionUser() {
  const session = getSession();
  if (!session?.userId) {
    return null;
  }

  const user = getUsers().find((item) => item.id === session.userId);
  if (!user) {
    clearSession();
    return null;
  }

  return { ...user, passwordHash: undefined, state: getUserState(user.id) };
}
````

## `src/storage.js`

````javascript
const KEYS = {
  users: "the-terminal.users.v1",
  session: "the-terminal.session.v1",
  userStatePrefix: "the-terminal.user-state.v1",
};

function safeParse(rawValue, fallbackValue) {
  if (!rawValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
}

export function loadJson(key, fallbackValue) {
  return safeParse(window.localStorage.getItem(key), fallbackValue);
}

export function saveJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getUsers() {
  return loadJson(KEYS.users, []);
}

export function saveUsers(users) {
  saveJson(KEYS.users, users);
}

export function getSession() {
  return loadJson(KEYS.session, null);
}

export function saveSession(session) {
  saveJson(KEYS.session, session);
}

export function clearSession() {
  window.localStorage.removeItem(KEYS.session);
}

export function getUserStateKey(userId) {
  return `${KEYS.userStatePrefix}.${userId}`;
}

export function buildDefaultUserState(seed = {}) {
  return {
    watchlist: seed.watchlist ?? ["AAPL", "MSFT", "NVDA", "QQQ", "BTC-USD", "PLTR"],
    alerts: seed.alerts ?? [],
    positions: seed.positions ?? [],
    panelModules: seed.panelModules ?? { 1: "home", 2: "quote", 3: "chart", 4: "news" },
    panelSymbols: seed.panelSymbols ?? { 1: "NVDA", 2: "AAPL", 3: "MSFT", 4: "QQQ" },
    commandHistory: seed.commandHistory ?? [],
    layoutMode: seed.layoutMode ?? "quad",
    createdAt: seed.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getUserState(userId, seed = {}) {
  const key = getUserStateKey(userId);
  const stored = loadJson(key, null);
  return buildDefaultUserState({ ...seed, ...(stored ?? {}) });
}

export function saveUserState(userId, state) {
  const key = getUserStateKey(userId);
  saveJson(key, {
    ...state,
    updatedAt: new Date().toISOString(),
  });
}
````

## `backend/app.py`

````python
from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from flask import Flask, g, jsonify, make_response, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = Path(__file__).resolve().parents[1]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(ROOT / ".env")

DATABASE_DIR = ROOT / "data"
DATABASE_PATH = DATABASE_DIR / "terminal.db"
SESSION_COOKIE = "terminal_session"
DEFAULT_SYMBOLS = ["AAPL", "MSFT", "NVDA", "PLTR", "QQQ", "BTC-USD", "XOM", "TSLA"]
DEFAULT_POSITIONS = [
    {"symbol": "NVDA", "shares": 12, "cost": 822.11},
    {"symbol": "PLTR", "shares": 140, "cost": 26.42},
    {"symbol": "QQQ", "shares": 18, "cost": 418.52},
    {"symbol": "XOM", "shares": 35, "cost": 108.30},
]
DEFAULT_ALERTS = [
    {"symbol": "NVDA", "operator": ">=", "threshold": 950, "status": "watching"},
    {"symbol": "BTC-USD", "operator": ">=", "threshold": 70000, "status": "watching"},
    {"symbol": "TSLA", "operator": "<=", "threshold": 190, "status": "watching"},
]
DEFAULT_PANEL_MODULES = {"1": "home", "2": "quote", "3": "chart", "4": "news"}
DEFAULT_PANEL_SYMBOLS = {"1": "NVDA", "2": "AAPL", "3": "MSFT", "4": "QQQ"}
FX_URL = "https://open.er-api.com/v6/latest/USD"
QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbols}"
CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range}&interval={interval}&includePrePost=false"
OPTIONS_URL = "https://query1.finance.yahoo.com/v7/finance/options/{symbol}{suffix}"
NEWS_FEEDS = [
    ("Reuters Business", "https://feeds.reuters.com/reuters/businessNews"),
    ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
    ("MarketWatch", "https://feeds.marketwatch.com/marketwatch/topstories/"),
]
HTTP_HEADERS = {
    "User-Agent": "Meridian/1.0 (Professional Market Terminal)",
    "Accept": "application/json, text/plain, */*",
}
PASSWORD_HASH_METHOD = "pbkdf2:sha256"
OVERVIEW_SYMBOLS = ["SPY", "QQQ", "IWM", "TLT", "BTC-USD", "NVDA"]
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]{3,24}$")
RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "").strip()
RAPIDAPI_HOST = os.environ.get("RAPIDAPI_HOST", "yahoo-finance15.p.rapidapi.com").strip() or "yahoo-finance15.p.rapidapi.com"
RAPIDAPI_BASE = f"https://{RAPIDAPI_HOST}"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_workspace_state() -> dict[str, Any]:
    return {
        "watchlist": DEFAULT_SYMBOLS,
        "alerts": DEFAULT_ALERTS,
        "positions": DEFAULT_POSITIONS,
        "panelModules": DEFAULT_PANEL_MODULES,
        "panelSymbols": DEFAULT_PANEL_SYMBOLS,
        "commandHistory": [],
        "layoutMode": "quad",
        "createdAt": utc_now_iso(),
        "updatedAt": utc_now_iso(),
    }


class UnauthorizedResponse(Exception):
    def __init__(self, response: Any) -> None:
        self.response = response


def handle_unauthorized(error: UnauthorizedResponse) -> Any:
    return error.response


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.update(
        SECRET_KEY=os.environ.get("TERMINAL_SECRET", "terminal-dev-secret"),
        DATABASE=str(DATABASE_PATH),
        TESTING=False,
    )

    if test_config:
        app.config.update(test_config)

    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    app.register_error_handler(UnauthorizedResponse, handle_unauthorized)

    @app.before_request
    def before_request() -> None:
        ensure_database(app)

    @app.teardown_appcontext
    def teardown_db(_: BaseException | None) -> None:
        connection = g.pop("db", None)
        if connection is not None:
            connection.close()

    @app.get("/api/health")
    def health() -> Any:
        return jsonify({"ok": True, "time": utc_now_iso(), "phase": market_phase(), "server": "Meridian Flask"})

    @app.get("/api/auth/availability")
    def auth_availability() -> Any:
        email = str(request.args.get("email", "")).strip().lower()
        username = str(request.args.get("username", "")).strip().lower()

        db = get_db(app)
        email_available = True
        username_available = True

        if email:
            email_available = db.execute("SELECT id FROM users WHERE lower(email) = ?", (email,)).fetchone() is None

        if username:
            username_available = db.execute("SELECT id FROM users WHERE lower(username) = ?", (username,)).fetchone() is None

        return jsonify(
            {
                "email": email,
                "username": username,
                "emailAvailable": email_available,
                "usernameAvailable": username_available,
            }
        )

    @app.post("/api/auth/signup")
    def signup() -> Any:
        payload = request.get_json(silent=True) or {}
        required_fields = ["firstName", "lastName", "email", "username", "password", "role"]
        missing = [field for field in required_fields if not str(payload.get(field, "")).strip()]
        if missing:
            return error_response(f"Missing required fields: {', '.join(missing)}.", 400)

        email = str(payload["email"]).strip().lower()
        username = str(payload["username"]).strip()
        password = str(payload["password"])

        if not EMAIL_PATTERN.match(email):
            return error_response("Please provide a valid email address.", 400)

        if not USERNAME_PATTERN.match(username):
            return error_response("Username must be 3-24 chars and use letters, numbers, ., _, or -.", 400)

        if len(password) < 8:
            return error_response("Password must be at least 8 characters.", 400)

        db = get_db(app)
        existing = db.execute(
            "SELECT id FROM users WHERE lower(email) = ? OR lower(username) = ?",
            (email, username.lower()),
        ).fetchone()
        if existing:
            return error_response("An account with that email or username already exists.", 409)

        user_id = secrets.token_hex(12)
        db.execute(
            """
            INSERT INTO users (id, first_name, last_name, email, username, role, password_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                str(payload["firstName"]).strip(),
                str(payload["lastName"]).strip(),
                email,
                username,
                str(payload["role"]).strip(),
                generate_password_hash(password, method=PASSWORD_HASH_METHOD),
                utc_now_iso(),
            ),
        )
        save_workspace_state(app, user_id, default_workspace_state())
        session_token = create_session(app, user_id)
        db.commit()
        user = serialize_user(app, user_id)
        response = jsonify({"user": user, "workspace": get_workspace_state(app, user_id)})
        set_session_cookie(app, response, session_token)
        return response, 201

    @app.post("/api/auth/login")
    def login() -> Any:
        payload = request.get_json(silent=True) or {}
        identifier = str(payload.get("identifier", "")).strip().lower()
        password = str(payload.get("password", ""))
        if not identifier or not password:
            return error_response("Email/username and password are required.", 400)

        db = get_db(app)
        user = db.execute(
            "SELECT * FROM users WHERE lower(email) = ? OR lower(username) = ?",
            (identifier, identifier),
        ).fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            return error_response("Invalid credentials.", 401)

        session_token = create_session(app, user["id"])
        db.commit()
        response = jsonify({"user": row_to_user(user), "workspace": get_workspace_state(app, user["id"])})
        set_session_cookie(app, response, session_token)
        return response

    @app.post("/api/auth/logout")
    def logout() -> Any:
        token = request.cookies.get(SESSION_COOKIE)
        if token:
            db = get_db(app)
            db.execute("DELETE FROM sessions WHERE token = ?", (token,))
            db.commit()
        response = jsonify({"ok": True})
        response.delete_cookie(SESSION_COOKIE)
        return response

    @app.get("/api/auth/session")
    def session_info() -> Any:
        user = require_user(app)
        workspace = get_workspace_state(app, user["id"])
        return jsonify({"user": row_to_user(user), "workspace": workspace})

    @app.patch("/api/auth/profile")
    def update_profile() -> Any:
        user = require_user(app)
        payload = request.get_json(silent=True) or {}

        first_name = str(payload.get("firstName", user["first_name"])).strip()
        last_name = str(payload.get("lastName", user["last_name"])).strip()
        role = str(payload.get("role", user["role"])).strip()
        username = str(payload.get("username", user["username"])).strip()

        if not first_name or not last_name or not role:
            return error_response("First name, last name, and role are required.", 400)

        if not USERNAME_PATTERN.match(username):
            return error_response("Username must be 3-24 chars and use letters, numbers, ., _, or -.", 400)

        db = get_db(app)
        conflict = db.execute(
            "SELECT id FROM users WHERE lower(username) = ? AND id != ?",
            (username.lower(), user["id"]),
        ).fetchone()
        if conflict:
            return error_response("That username is already taken.", 409)

        db.execute(
            """
            UPDATE users
            SET first_name = ?, last_name = ?, username = ?, role = ?
            WHERE id = ?
            """,
            (first_name, last_name, username, role, user["id"]),
        )
        db.commit()
        return jsonify({"user": serialize_user(app, user["id"])})

    @app.post("/api/auth/password")
    def change_password() -> Any:
        user = require_user(app)
        payload = request.get_json(silent=True) or {}
        current_password = str(payload.get("currentPassword", ""))
        new_password = str(payload.get("newPassword", ""))

        if not current_password or not new_password:
            return error_response("Current and new password are required.", 400)

        if len(new_password) < 8:
            return error_response("New password must be at least 8 characters.", 400)

        if not check_password_hash(user["password_hash"], current_password):
            return error_response("Current password is incorrect.", 401)

        db = get_db(app)
        db.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (generate_password_hash(new_password, method=PASSWORD_HASH_METHOD), user["id"]),
        )
        db.commit()
        return jsonify({"ok": True})

    @app.delete("/api/auth/account")
    def delete_account() -> Any:
        user = require_user(app)
        payload = request.get_json(silent=True) or {}
        password = str(payload.get("password", ""))
        if not password:
            return error_response("Password is required to delete your account.", 400)

        if not check_password_hash(user["password_hash"], password):
            return error_response("Password is incorrect.", 401)

        db = get_db(app)
        db.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
        db.execute("DELETE FROM workspace_state WHERE user_id = ?", (user["id"],))
        db.execute("DELETE FROM users WHERE id = ?", (user["id"],))
        db.commit()

        response = jsonify({"ok": True})
        response.delete_cookie(SESSION_COOKIE)
        return response

    @app.get("/api/workspace")
    def get_workspace() -> Any:
        user = require_user(app)
        return jsonify({"workspace": get_workspace_state(app, user["id"])})

    @app.put("/api/workspace")
    @app.patch("/api/workspace")
    def save_workspace() -> Any:
        user = require_user(app)
        payload = request.get_json(silent=True) or {}
        merged = merge_workspace_state(get_workspace_state(app, user["id"]), payload)
        save_workspace_state(app, user["id"], merged)
        get_db(app).commit()
        return jsonify({"workspace": merged})

    @app.get("/api/market/quotes")
    def market_quotes() -> Any:
        symbols_param = request.args.get("symbols", "")
        symbols = [symbol.strip() for symbol in symbols_param.split(",") if symbol.strip()]
        if not symbols:
            return jsonify({"quotes": []})
        return jsonify({"quotes": fetch_quotes(symbols)})

    @app.get("/api/market/overview")
    def market_overview() -> Any:
        symbols_param = request.args.get("symbols", "")
        symbols = [symbol.strip() for symbol in symbols_param.split(",") if symbol.strip()] or OVERVIEW_SYMBOLS
        return jsonify({
            "generatedAt": utc_now_iso(),
            "phase": market_phase(),
            "quotes": fetch_quotes(symbols),
        })

    @app.get("/api/market/chart/<symbol>")
    def market_chart(symbol: str) -> Any:
        range_value = request.args.get("range", "1mo")
        interval = request.args.get("interval", "1d")
        return jsonify({"points": fetch_chart(symbol, range_value, interval)})

    @app.get("/api/market/options/<symbol>")
    def market_options(symbol: str) -> Any:
        expiration = request.args.get("date")
        return jsonify(fetch_options(symbol, expiration))

    @app.get("/api/market/news")
    def market_news() -> Any:
        return jsonify({"items": fetch_news_items()})

    @app.get("/api/market/deep-dive/<symbol>")
    def market_deep_dive(symbol: str) -> Any:
        return jsonify(fetch_deep_dive(symbol))

    @app.get("/api/market/fx")
    def market_fx() -> Any:
        return jsonify({"rates": fetch_fx_rates()})

    @app.get("/")
    def serve_index() -> Any:
        return send_from_directory(ROOT, "index.html")

    @app.get("/<path:asset_path>")
    def serve_asset(asset_path: str) -> Any:
        candidate = ROOT / asset_path
        if candidate.exists() and candidate.is_file():
            return send_from_directory(ROOT, asset_path)
        return send_from_directory(ROOT, "index.html")

    return app


def error_response(message: str, status_code: int) -> Any:
    return jsonify({"error": message}), status_code


def get_db(app: Flask) -> sqlite3.Connection:
    if "db" not in g:
        database_path = Path(app.config["DATABASE"])
        database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        g.db = connection
    return g.db


def ensure_database(app: Flask) -> None:
    db = get_db(app)
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS workspace_state (
            user_id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """
    )
    db.commit()


def row_to_user(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "firstName": row["first_name"],
        "lastName": row["last_name"],
        "email": row["email"],
        "username": row["username"],
        "role": row["role"],
        "createdAt": row["created_at"],
    }


def serialize_user(app: Flask, user_id: str) -> dict[str, Any]:
    row = get_db(app).execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise RuntimeError("User not found during serialization.")
    return row_to_user(row)


def create_session(app: Flask, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    created_at = utc_now_iso()
    expires_at = datetime.fromtimestamp(time.time() + 60 * 60 * 24 * 14, tz=timezone.utc).isoformat()
    get_db(app).execute(
        "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (token, user_id, created_at, expires_at),
    )
    return token


def set_session_cookie(app: Flask, response: Any, token: str) -> None:
    secure_cookie = not app.config.get("TESTING", False)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=60 * 60 * 24 * 14,
        httponly=True,
        secure=secure_cookie,
        samesite="Lax",
    )


def require_user(app: Flask) -> sqlite3.Row:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise_api_unauthorized()

    row = get_db(app).execute(
        """
        SELECT users.*
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ? AND sessions.expires_at > ?
        """,
        (token, utc_now_iso()),
    ).fetchone()
    if row is None:
        raise_api_unauthorized()
    return row


def raise_api_unauthorized() -> None:
    response = make_response(jsonify({"error": "Authentication required."}), 401)
    response.delete_cookie(SESSION_COOKIE)
    raise UnauthorizedResponse(response)


def get_workspace_state(app: Flask, user_id: str) -> dict[str, Any]:
    row = get_db(app).execute(
        "SELECT payload FROM workspace_state WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if row is None:
        state = default_workspace_state()
        save_workspace_state(app, user_id, state)
        return state
    return merge_workspace_state(default_workspace_state(), json.loads(row["payload"]))


def save_workspace_state(app: Flask, user_id: str, state: dict[str, Any]) -> None:
    normalized = merge_workspace_state(default_workspace_state(), state)
    normalized["updatedAt"] = utc_now_iso()
    get_db(app).execute(
        """
        INSERT INTO workspace_state (user_id, payload, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
        """,
        (user_id, json.dumps(normalized), normalized["updatedAt"]),
    )


def merge_workspace_state(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in patch.items():
        if key in {"watchlist", "alerts", "positions", "commandHistory"} and isinstance(value, list):
            merged[key] = value
        elif key in {"panelModules", "panelSymbols"} and isinstance(value, dict):
            merged[key] = {str(k): v for k, v in value.items()}
        elif key in {"layoutMode", "createdAt", "updatedAt"} and value:
            merged[key] = value
    if not merged.get("createdAt"):
        merged["createdAt"] = utc_now_iso()
    return merged


def market_phase() -> str:
    new_york_now = datetime.now(ZoneInfo("America/New_York"))
    weekday = new_york_now.weekday()
    current_minutes = new_york_now.hour * 60 + new_york_now.minute

    if weekday >= 5:
        return "Weekend"
    if current_minutes < 570:
        return "Pre-market"
    if current_minutes < 960:
        return "Open"
    return "After-hours"


def fetch_json(url: str) -> Any:
    request_obj = urllib.request.Request(url, headers=HTTP_HEADERS)
    with urllib.request.urlopen(request_obj, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_json_with_headers(url: str, headers: dict[str, str]) -> Any:
    request_obj = urllib.request.Request(url, headers={**HTTP_HEADERS, **headers})
    with urllib.request.urlopen(request_obj, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_text(url: str) -> str:
    request_obj = urllib.request.Request(url, headers=HTTP_HEADERS)
    with urllib.request.urlopen(request_obj, timeout=12) as response:
        return response.read().decode("utf-8")


def fetch_quotes(symbols: list[str]) -> list[dict[str, Any]]:
    clean_symbols = sorted({symbol for symbol in symbols if symbol})
    if not clean_symbols:
        return []
    url = QUOTE_URL.format(symbols=urllib.parse.quote(",".join(clean_symbols)))
    payload = fetch_json(url)
    results = payload.get("quoteResponse", {}).get("result", [])
    quotes = []
    for item in results:
        quotes.append(
            {
                "symbol": item.get("symbol"),
                "name": item.get("shortName") or item.get("longName") or item.get("symbol"),
                "exchange": item.get("fullExchangeName") or item.get("exchange") or "N/A",
                "price": item.get("regularMarketPrice") or item.get("postMarketPrice") or 0,
                "changePct": item.get("regularMarketChangePercent") or 0,
                "change": item.get("regularMarketChange") or 0,
                "marketCap": item.get("marketCap") or 0,
                "volume": item.get("regularMarketVolume") or 0,
                "dayHigh": item.get("regularMarketDayHigh") or item.get("regularMarketPrice") or 0,
                "dayLow": item.get("regularMarketDayLow") or item.get("regularMarketPrice") or 0,
                "previousClose": item.get("regularMarketPreviousClose") or item.get("regularMarketPrice") or 0,
                "currency": item.get("currency") or "USD",
            }
        )
    return quotes


def fetch_chart(symbol: str, range_value: str, interval: str) -> list[dict[str, Any]]:
    url = CHART_URL.format(
        symbol=urllib.parse.quote(symbol),
        range=urllib.parse.quote(range_value),
        interval=urllib.parse.quote(interval),
    )
    payload = fetch_json(url)
    result = ((payload.get("chart") or {}).get("result") or [None])[0]
    if not result:
        return []
    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    closes = quote.get("close") or []
    points = []
    for index, timestamp in enumerate(timestamps):
        close_value = closes[index] if index < len(closes) else None
        if close_value is None:
            continue
        points.append({"timestamp": timestamp, "close": close_value})
    return points


def fetch_options(symbol: str, expiration: str | None) -> dict[str, Any]:
    suffix = f"?date={urllib.parse.quote(expiration)}" if expiration else ""
    payload = fetch_json(OPTIONS_URL.format(symbol=urllib.parse.quote(symbol), suffix=suffix))
    result = ((payload.get("optionChain") or {}).get("result") or [None])[0]
    if not result:
        return {"expirations": [], "calls": [], "puts": [], "spot": 0}
    option_set = (result.get("options") or [{}])[0]
    return {
        "expirations": result.get("expirationDates") or [],
        "calls": (option_set.get("calls") or [])[:20],
        "puts": (option_set.get("puts") or [])[:20],
        "spot": ((result.get("quote") or {}).get("regularMarketPrice") or 0),
    }


def fetch_news_items() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for source_name, url in NEWS_FEEDS:
        try:
            xml_text = fetch_text(url)
            root = ET.fromstring(xml_text)
            for node in root.findall(".//item")[:6]:
                title = (node.findtext("title") or "Untitled").strip()
                link = (node.findtext("link") or "#").strip()
                published = (node.findtext("pubDate") or "").strip()
                items.append(
                    {
                        "source": source_name,
                        "headline": title,
                        "link": link,
                        "time": published[:25] if published else "Live",
                    }
                )
        except Exception:
            continue
    return items[:18]


def score_sentiment(text: str) -> str:
    content = text.lower()
    positive_terms = ["beat", "upgrade", "growth", "record", "surge", "gain", "bull", "strong"]
    negative_terms = ["miss", "downgrade", "fall", "drop", "cut", "bear", "weak", "risk"]
    positive_hits = sum(1 for term in positive_terms if term in content)
    negative_hits = sum(1 for term in negative_terms if term in content)
    if positive_hits > negative_hits:
        return "Positive"
    if negative_hits > positive_hits:
        return "Negative"
    return "Neutral"


def format_news_time(value: Any) -> str:
    if value is None:
        return "Live"
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, timezone.utc).strftime("%b %d %H:%M")
        except Exception:
            return "Live"
    text = str(value).strip()
    if not text:
        return "Live"
    return text[:25]


def normalize_deep_dive_news(raw_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for item in raw_items[:12]:
        title = str(item.get("title") or item.get("headline") or "Untitled").strip()
        if not title:
            continue
        normalized.append(
            {
                "source": str(item.get("source") or item.get("publisher") or "Feed").strip() or "Feed",
                "headline": title,
                "link": str(item.get("link") or item.get("url") or "#").strip() or "#",
                "time": format_news_time(item.get("pubDate") or item.get("providerPublishTime") or item.get("published_at")),
                "sentiment": score_sentiment(title),
            }
        )
    return normalized


def fallback_deep_dive(symbol: str, reason: str | None = None) -> dict[str, Any]:
    upper_symbol = symbol.upper()
    quote = (fetch_quotes([upper_symbol]) or [{}])[0]
    filtered_news = [item for item in fetch_news_items() if upper_symbol in str(item.get("headline", "")).upper()][:10]
    normalized_news = [
        {
            **item,
            "sentiment": score_sentiment(str(item.get("headline") or "")),
        }
        for item in filtered_news
    ]
    return {
        "ticker": upper_symbol,
        "provider": "fallback",
        "available": False,
        "reason": reason or "RapidAPI deep-dive is not configured.",
        "news": normalized_news,
        "profile": {
            "sector": quote.get("exchange") or "Market",
            "industry": "Live quote fallback",
            "country": "N/A",
            "website": "",
            "longBusinessSummary": "Add RapidAPI credentials in a local .env file to unlock profile and financial metrics.",
        },
        "financials": {
            "currentPrice": {"raw": quote.get("price"), "fmt": f"{quote.get('price', 0):.2f}" if quote.get("price") else "--"},
            "marketCap": {"raw": quote.get("marketCap"), "fmt": str(quote.get("marketCap") or "--")},
            "volume": {"raw": quote.get("volume"), "fmt": str(quote.get("volume") or "--")},
        },
    }


def fetch_deep_dive(symbol: str) -> dict[str, Any]:
    upper_symbol = symbol.upper().strip()
    if not upper_symbol:
      return fallback_deep_dive(symbol, "Ticker is required.")

    if not RAPIDAPI_KEY:
        return fallback_deep_dive(upper_symbol)

    headers = {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
    }
    news_url = f"{RAPIDAPI_BASE}/api/v1/markets/news?ticker={urllib.parse.quote(upper_symbol)}"
    modules_url = (
        f"{RAPIDAPI_BASE}/api/v1/markets/stock/modules?"
        f"ticker={urllib.parse.quote(upper_symbol)}&module=asset-profile,financial-data"
    )

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            news_future = executor.submit(fetch_json_with_headers, news_url, headers)
            modules_future = executor.submit(fetch_json_with_headers, modules_url, headers)
            news_payload = news_future.result()
            modules_payload = modules_future.result()

        module_body = modules_payload.get("body") or {}
        return {
            "ticker": upper_symbol,
            "provider": "rapidapi",
            "available": True,
            "news": normalize_deep_dive_news(news_payload.get("body") or []),
            "profile": module_body.get("assetProfile") or {},
            "financials": module_body.get("financialData") or {},
        }
    except Exception as error:
        return fallback_deep_dive(upper_symbol, f"Deep dive fallback: {error}")


def fetch_fx_rates() -> dict[str, Any]:
    payload = fetch_json(FX_URL)
    return payload.get("rates") or {}


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=4173, debug=False)
````

## `backend/__init__.py`

````python
from .app import app, create_app
````

## `scripts/smoke_test.py`

````python
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app import create_app  # noqa: E402

INDEX = ROOT / "index.html"
CLIENT = ROOT / "src" / "clientApp.js"
APP_BOOTSTRAP = ROOT / "src" / "AppBootstrap.js"
REGISTRY = ROOT / "src" / "Registry.js"
API = ROOT / "src" / "api.js"
BACKEND = ROOT / "backend" / "app.py"
DATA = ROOT / "src" / "data.js"
STYLES = ROOT / "src" / "styles.css"
PACKAGE = ROOT / "package.json"
REQUIREMENTS = ROOT / "requirements.txt"
RENDERERS = [
    ROOT / "src" / "Renderers" / "BriefingRenderer.js",
    ROOT / "src" / "Renderers" / "CalculatorRenderer.js",
    ROOT / "src" / "Renderers" / "ChartRenderer.js",
    ROOT / "src" / "Renderers" / "Common.js",
    ROOT / "src" / "Renderers" / "HeatmapRenderer.js",
    ROOT / "src" / "Renderers" / "HomeRenderer.js",
    ROOT / "src" / "Renderers" / "MacroRenderer.js",
    ROOT / "src" / "Renderers" / "NewsRenderer.js",
    ROOT / "src" / "Renderers" / "OptionsRenderer.js",
    ROOT / "src" / "Renderers" / "PortfolioRenderer.js",
    ROOT / "src" / "Renderers" / "QuoteRenderer.js",
    ROOT / "src" / "Renderers" / "RulesRenderer.js",
    ROOT / "src" / "Renderers" / "ScreenerRenderer.js",
]

required_files = [INDEX, CLIENT, APP_BOOTSTRAP, REGISTRY, API, BACKEND, DATA, STYLES, PACKAGE, REQUIREMENTS, *RENDERERS]
for file_path in required_files:
    assert file_path.exists(), f"Missing required file: {file_path}"

html = INDEX.read_text(encoding="utf-8")
for token in ["authModal", "loginForm", "signupForm", "terminalApp", "functionRow", "watchlistRail", "networkStatus", "clientApp.js"]:
    assert token in html, f"Expected token missing from index.html: {token}"

client_code = CLIENT.read_text(encoding="utf-8")
for token in ["initializeApp", "DOMContentLoaded", "./AppBootstrap.js"]:
    assert token in client_code, f"Expected token missing from clientApp.js: {token}"

bootstrap_code = APP_BOOTSTRAP.read_text(encoding="utf-8")
for token in [
    "new WorkspaceController",
    "workspaceController?.initializeSession",
    "new DockingController",
    "dockingController?.initialize",
    "refreshAllData",
    "capturePriceChanges",
    "processCommand",
    "calculateBlackScholes",
    "calculateBond",
]:
    assert token in bootstrap_code, f"Expected token missing from AppBootstrap.js: {token}"

registry_code = REGISTRY.read_text(encoding="utf-8")
for token in [
    '"briefing"',
    '"home"',
    '"quote"',
    '"chart"',
    '"news"',
    '"screener"',
    '"heatmap"',
    '"portfolio"',
    '"macro"',
    '"options"',
    '"calculator"',
]:
    assert token in registry_code, f"Expected token missing from Registry.js: {token}"

api_code = API.read_text(encoding="utf-8")
for token in ["authApi", "workspaceApi", "marketApi", "apiRequest"]:
    assert token in api_code, f"Expected token missing from api.js: {token}"

backend_code = BACKEND.read_text(encoding="utf-8")
for token in ["/api/auth/signup", "/api/auth/login", "/api/workspace", "/api/market/quotes", "sqlite3"]:
    assert token in backend_code, f"Expected token missing from backend/app.py: {token}"

styles = STYLES.read_text(encoding="utf-8")
for token in ["prefers-reduced-motion", ".auth-modal", ".workspace-grid", ".function-row", ".command-shell"]:
    assert token in styles, f"Expected styling token missing from styles.css: {token}"

with tempfile.TemporaryDirectory() as tmp_dir:
    app = create_app({"TESTING": True, "DATABASE": str(Path(tmp_dir) / "test.db")})
    client = app.test_client()

    signup = client.post(
        "/api/auth/signup",
        data=json.dumps(
            {
                "firstName": "Ada",
                "lastName": "Lovelace",
                "email": "ada@example.com",
                "username": "adal",
                "password": "correcthorsebattery",
                "role": "Quant Developer",
            }
        ),
        content_type="application/json",
    )
    assert signup.status_code == 201, signup.get_data(as_text=True)
    payload = signup.get_json()
    assert payload["user"]["username"] == "adal"
    assert payload["workspace"]["watchlist"], "New workspace should have a default watchlist"

    workspace_update = client.put(
        "/api/workspace",
        data=json.dumps(
            {
                "watchlist": ["AAPL", "MSFT"],
                "alerts": [{"symbol": "AAPL", "operator": ">=", "threshold": 250, "status": "watching"}],
                "positions": [{"symbol": "MSFT", "shares": 2, "cost": 400}],
                "panelModules": {"1": "home", "2": "quote", "3": "chart", "4": "news"},
                "panelSymbols": {"1": "AAPL", "2": "MSFT", "3": "NVDA", "4": "QQQ"},
                "commandHistory": ["AAPL Q"],
            }
        ),
        content_type="application/json",
    )
    assert workspace_update.status_code == 200, workspace_update.get_data(as_text=True)
    assert workspace_update.get_json()["workspace"]["watchlist"] == ["AAPL", "MSFT"]

    session = client.get("/api/auth/session")
    assert session.status_code == 200, session.get_data(as_text=True)
    assert session.get_json()["workspace"]["commandHistory"] == ["AAPL Q"]

package = PACKAGE.read_text(encoding="utf-8")
assert '"start"' in package and '"check"' in package, "package scripts missing"

print("Smoke test passed: backend auth, saved workspace, and frontend shell look consistent.")
````
