# Meridian — Deployment Guide

Two paths covered:

1. **Run locally** — get the Flask backend up on your laptop in ~3 minutes.
2. **Deploy to Render** — host the backend long-term so the live GitHub Pages
   site (`https://captainfredric.github.io/The-Terminal-Meridian/`) talks to a
   real API instead of falling back to demo data.

---

## 1. Run locally

### Prereqs

- Python 3.10+ (you have 3.14.3 installed — perfect)
- The repo cloned to your machine (you're already in it)

### One-time setup

```bash
# from the repo root
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Then open `.env` and fill in the keys you actually need. For a first run the
only ones that matter are:

- `TERMINAL_SECRET` — set to anything random (`python3 -c 'import secrets; print(secrets.token_urlsafe(32))'`)
- `RAPIDAPI_KEY` — optional, only needed for the Deep Dive / News modules
- Stripe / OpenAI / Anthropic keys — leave blank for now; everything degrades
  gracefully

### Start the server

```bash
# inside the activated venv
python -m backend.app
```

That boots Flask on `http://127.0.0.1:4173`. Health check:

```bash
curl http://127.0.0.1:4173/api/health
```

You should see `"ok": true` plus a `checks` object showing which providers
are configured.

### Frontend pointing at local backend

The frontend auto-detects local dev — when you open `index.html` from the
repo root over `file://` or via `python -m http.server 5173`, `src/api.js`
resolves the API base to `http://127.0.0.1:4173`. No config needed.

To override:

```js
// in browser DevTools console
localStorage.setItem('meridian.api-base', 'http://127.0.0.1:4173');
```

### Stop / restart

`Ctrl-C` to stop. To leave the venv: `deactivate`. To re-enter on a fresh
terminal session: `cd <repo>; source .venv/bin/activate`.

---

## 2. Deploy to Render (recommended for long-term hosting)

Render's free tier is the closest fit: free Python web service, persistent
disk for SQLite, automatic HTTPS, env vars in the dashboard, GitHub auto-deploy.

> **Free-tier caveat:** the service spins down after ~15 min of inactivity;
> the first request after wake takes ~30s. Upgrade to a Starter plan ($7/mo)
> to keep it warm — or accept the cold start for now.

### Step 1 — Push the deploy files

This commit added `Procfile`, `render.yaml`, and updated `requirements.txt`,
`.env.example`, and `backend/app.py` (CORS + cross-site cookies). Push them:

```bash
git add Procfile render.yaml requirements.txt .env.example backend/app.py DEPLOY.md
git commit -m "feat: production deployment config (Render + CORS + Procfile)"
git push origin main
```

### Step 2 — Create the Render service

1. Sign up / log in at https://render.com (GitHub OAuth is fastest).
2. Click **New +** → **Blueprint**.
3. Connect the GitHub repo. Render reads `render.yaml` and proposes the
   service + the 1 GB persistent disk.
4. Click **Apply**. First build runs `pip install -r requirements.txt`
   then `gunicorn 'backend.app:create_app()' …`.
5. Wait ~3 min for the build + first deploy. The dashboard shows live logs.

You'll get a public URL like `https://meridian-backend-xyz.onrender.com`.

### Step 3 — Set the secret env vars

`render.yaml` declares the keys but leaves provider secrets blank for
security. In the Render dashboard → your service → **Environment** tab,
add whichever you need:

| Key | Value | Where to get it |
| --- | --- | --- |
| `RAPIDAPI_KEY` | your key | https://rapidapi.com → Yahoo Finance 15 subscription |
| `STRIPE_SECRET_KEY` | `sk_live_…` | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Stripe dashboard → Webhooks → endpoint signing secret |
| `STRIPE_PRICE_PRO_MONTHLY` | `price_…` | Stripe dashboard → Products |
| `OPENAI_API_KEY` | `sk-…` | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | https://console.anthropic.com → API Keys |

`TERMINAL_SECRET`, `CORS_ORIGINS`, `CROSS_SITE_COOKIES`, and `TERMINAL_DB_PATH`
are pre-filled by the blueprint.

After saving env vars, click **Manual Deploy → Deploy latest commit** to pick
them up.

### Step 4 — Point the frontend at the backend

Tell the GH Pages frontend where the API lives. Two options:

**Option A — Hard-code in `src/api.js`** (simple, one line):

```js
function resolveApiBase() {
  if (typeof window === "undefined") return "";
  const override = window.MERIDIAN_API_BASE
    || window.localStorage.getItem("meridian.api-base")
    || "";
  if (override) return String(override).replace(/\/$/, "");

  const { protocol, hostname, port } = window.location;
  const isLocal = hostname === "127.0.0.1" || hostname === "localhost";
  if (isLocal && port && port !== "4173") {
    return `${protocol}//${hostname}:4173`;
  }

  // Production: GH Pages → Render backend
  if (hostname.endsWith("github.io")) {
    return "https://meridian-backend-xyz.onrender.com";
  }

  return "";
}
```

**Option B — Inline `<script>` in `index.html`** (no rebuild needed):

```html
<!-- before <script type="module" src="src/AppBootstrap.js"> -->
<script>
  window.MERIDIAN_API_BASE = "https://meridian-backend-xyz.onrender.com";
</script>
```

Commit + push. GH Pages auto-deploys in ~30s.

### Step 5 — Update Stripe webhook endpoint

In the Stripe dashboard → Webhooks → your endpoint, change the URL to:

```
https://meridian-backend-xyz.onrender.com/api/billing/webhook
```

Re-copy the signing secret if Stripe rotated it; paste into Render's
`STRIPE_WEBHOOK_SECRET`.

### Step 6 — Smoke test

```bash
curl https://meridian-backend-xyz.onrender.com/api/health
```

Then load the GH Pages site, open DevTools → Network, and confirm
requests go to your Render URL with `200` responses and `Set-Cookie`
headers carrying `SameSite=None; Secure`.

---

## Maintenance notes

### SQLite vs Postgres

The free 1 GB persistent disk holds `terminal.db` indefinitely, but SQLite
on a single file becomes a contention point past ~50 concurrent writers.
When you outgrow it:

1. Add `psycopg2-binary` to `requirements.txt`.
2. Provision a Render Postgres instance (free tier: 1 GB, expires after 90
   days; $7/mo Starter is permanent).
3. Refactor `get_db()` in `backend/app.py` to dispatch on `DATABASE_URL`.
4. Migrate with a one-shot script — schemas are simple enough to recreate
   from scratch and replay user signups.

Not urgent. SQLite is fine for the first 1k users.

### Logs

Render streams stdout/stderr to the **Logs** tab. Gunicorn is configured
to log access + error to stdout (see `Procfile`). For longer retention,
forward to Logtail / Better Stack via the Render integrations panel.

### Custom domain

Render dashboard → your service → **Settings → Custom Domains**. Add
`api.meridian.example.com`, copy the CNAME target into your DNS provider,
wait for cert. Then add the new origin to `CORS_ORIGINS`.

### Rollbacks

Render keeps every deploy. Dashboard → **Deploys** tab → click any prior
deploy → **Rollback to this deploy**. Takes ~30s.

---

## Troubleshooting

**Browser console: `CORS error: No 'Access-Control-Allow-Origin' header`**
→ The frontend origin isn't in `CORS_ORIGINS`. Add it (Render → Environment),
redeploy.

**Browser: requests succeed but session cookie isn't stored**
→ `CROSS_SITE_COOKIES` not set to `1`, or the response is over plain HTTP.
Render gives you HTTPS automatically; double-check the env var.

**`ModuleNotFoundError: flask_cors`**
→ Old build cache. Render dashboard → **Manual Deploy → Clear build cache & deploy**.

**Service sleeps and first request 30s**
→ Free-tier behavior. Upgrade to Starter, or set up an external uptime
pinger (UptimeRobot free) hitting `/api/health` every 10 min.

**SQLite "database is locked"**
→ Concurrency past SQLite's comfort zone. Migrate to Postgres (above).
