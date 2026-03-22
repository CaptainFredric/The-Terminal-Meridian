# Entry shell and manifests

Copy-paste packet generated from the current workspace state.

## Included Files

- `README.md`
- `index.html`
- `package.json`
- `requirements.txt`
- `.env.example`
- `.gitignore`

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
