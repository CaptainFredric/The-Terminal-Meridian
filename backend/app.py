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

try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False

from flask import Flask, current_app, g, jsonify, make_response, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from flask_cors import CORS
    FLASK_CORS_AVAILABLE = True
except ImportError:
    # CORS is required when the API is hosted on a different origin than the
    # frontend (e.g. GitHub Pages frontend → Render backend). For pure local
    # dev where everything is served from 127.0.0.1:4173 the import is
    # optional, so we degrade gracefully instead of hard-failing the import.
    FLASK_CORS_AVAILABLE = False

try:
    from .universe import build_universe_payload, universe_symbols
except ImportError:
    # When run as `python backend/app.py` (not as a package), fall back to
    # resolving the sibling module directly.
    import sys as _sys
    _sys.path.insert(0, str(Path(__file__).resolve().parent))
    from universe import build_universe_payload, universe_symbols  # type: ignore

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

# DB location is overridable so production deployments can point at a
# persistent disk (e.g. Render's `/opt/render/data/terminal.db`) without
# touching code. Falls back to the repo-local `data/` dir for local dev.
_DB_OVERRIDE = os.environ.get("TERMINAL_DB_PATH", "").strip()
if _DB_OVERRIDE:
    DATABASE_PATH = Path(_DB_OVERRIDE).expanduser().resolve()
    DATABASE_DIR = DATABASE_PATH.parent
else:
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
PAPER_STARTING_CASH = 100_000.0
FX_URL = "https://open.er-api.com/v6/latest/USD"
QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbols}"
CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range}&interval={interval}&includePrePost=false"
OPTIONS_URL = "https://query1.finance.yahoo.com/v7/finance/options/{symbol}{suffix}"
NEWS_FEEDS = [
    ("CNBC Markets", "https://www.cnbc.com/id/100727362/device/rss/rss.html"),
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

# ── Simple per-IP rate limiter (in-memory) ───────────────────────────────────
# Covers sensitive unauthenticated endpoints: signup, login, availability.
# Key → list of timestamps of recent calls.  Rolls a sliding window so bursty
# traffic is treated more fairly than a fixed-bucket approach.
import logging as _logging
_log = _logging.getLogger("meridian.backend")

_rl_store: dict[str, list[float]] = {}

def _rate_limited(key: str, max_calls: int, window_sec: float) -> bool:
    """Return True if the caller should be throttled.

    Args:
        key:        Caller identifier (IP, user_id, etc.).
        max_calls:  Max requests permitted within window_sec.
        window_sec: Sliding window in seconds.
    """
    now = time.time()
    cutoff = now - window_sec
    history = _rl_store.get(key, [])
    # Expire timestamps outside the window
    history = [t for t in history if t > cutoff]
    if len(history) >= max_calls:
        _rl_store[key] = history
        return True
    history.append(now)
    _rl_store[key] = history
    return False


def _request_ip() -> str:
    """Extract client IP from X-Forwarded-For (rightmost trusted proxy strategy)."""
    fwd = request.headers.get("X-Forwarded-For", "").strip()
    if fwd:
        parts = [p.strip() for p in fwd.split(",") if p.strip()]
        if parts:
            try:
                depth = max(1, int(os.environ.get("TRUSTED_PROXY_DEPTH", "1")))
            except ValueError:
                depth = 1
            return parts[max(len(parts) - depth, 0)]
    return request.remote_addr or "unknown"


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
        "activeRules": [],
        "notifications": [],
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

    # ── CORS ──────────────────────────────────────────────────────────────
    # The frontend may be served from a different origin (GitHub Pages,
    # custom domain, Chrome extension popup, etc.). CORS_ORIGINS is a
    # comma-separated allowlist. Defaults cover local dev + the public
    # GitHub Pages URL so a fresh deploy works out of the box.
    cors_origins_env = os.environ.get(
        "CORS_ORIGINS",
        "https://captainfredric.github.io,http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:5173,http://localhost:5173",
    )
    cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    if FLASK_CORS_AVAILABLE:
        CORS(
            app,
            resources={r"/api/*": {"origins": cors_origins}},
            supports_credentials=True,  # cookies must flow on cross-site requests
            expose_headers=["Content-Type"],
            max_age=3600,
        )
        app.config["CORS_ENABLED"] = True
    else:
        app.logger.warning(
            "flask-cors not installed; cross-origin browsers will block /api/* "
            "requests. Run `pip install flask-cors` to enable.",
        )
        app.config["CORS_ENABLED"] = False
    app.config["CORS_ORIGINS"] = cors_origins

    # ── Cookie / session config ──────────────────────────────────────────
    # When the frontend lives on a different origin we need
    # `SameSite=None; Secure` so the browser actually attaches the session
    # cookie to cross-site fetches. Toggled via env var so local dev (which
    # serves over plain http://127.0.0.1) keeps working with `Lax`.
    app.config["CROSS_SITE_COOKIES"] = os.environ.get("CROSS_SITE_COOKIES", "0") == "1"

    # Stripe billing tables + routes — split into backend/billing.py to keep
    # this file focused. Loaded lazily so the app still boots if the import
    # fails (defensive against partial deploys).
    try:
        from .billing import (
            ensure_subscription_tables,
            register_billing_routes,
            get_subscription,
        )
        ensure_subscription_tables(app)
        _billing_get_subscription = get_subscription
    except Exception as exc:  # noqa: BLE001
        app.logger.warning("Billing module not loaded: %s", exc)
        _billing_get_subscription = None  # type: ignore[assignment]

    @app.before_request
    def before_request() -> None:
        ensure_database(app)

    @app.teardown_appcontext
    def teardown_db(_: BaseException | None) -> None:
        connection = g.pop("db", None)
        if connection is not None:
            connection.close()

    @app.get("/api/ready")
    def readiness() -> Any:
        """Lightweight readiness probe used by Render's health-check and load
        balancers. Returns 200 only when the database is reachable so traffic
        isn't routed to a node that can't serve requests.

        Intentionally cheaper than /api/health (no external URL probe) so it
        can be called every few seconds without side-effects.
        """
        try:
            db = get_db(app)
            db.execute("SELECT 1").fetchone()
            return jsonify({"ok": True, "time": utc_now_iso()})
        except Exception as exc:
            app.logger.error("Readiness check failed: %s", exc)
            return jsonify({"ok": False, "error": str(exc)}), 503

    @app.get("/api/health")
    def health() -> Any:
        checks: dict[str, Any] = {}

        # ── Database ──────────────────────────────────────────────────────
        try:
            db = get_db(app)
            db.execute("SELECT 1").fetchone()
            checks["db"] = "ok"
        except Exception as db_err:
            checks["db"] = f"error: {db_err}"

        # ── yfinance ──────────────────────────────────────────────────────
        checks["yfinance"] = "available" if YFINANCE_AVAILABLE else "not_installed"

        # ── Quote API reachability (lightweight probe, no retry needed) ───
        try:
            probe_url = QUOTE_URL.format(symbols="AAPL")
            req = urllib.request.Request(probe_url, headers=HTTP_HEADERS)
            with urllib.request.urlopen(req, timeout=5) as r:
                checks["quote_api"] = "ok" if r.status < 400 else f"http_{r.status}"
        except Exception as qa_err:
            checks["quote_api"] = f"error: {type(qa_err).__name__}"

        # ── RapidAPI key ──────────────────────────────────────────────────
        checks["rapidapi"] = "configured" if RAPIDAPI_KEY else "not_configured"

        all_ok = all(v in ("ok", "available", "configured", "not_configured") for v in checks.values())
        return jsonify({
            "ok": all_ok,
            "time": utc_now_iso(),
            "phase": market_phase(),
            "server": "Meridian Flask",
            "checks": checks,
        })

    @app.get("/api/auth/availability")
    def auth_availability() -> Any:
        # 30 calls / 60 s per IP — enough for real-time debounce typing,
        # too slow for an automated email enumeration scan.
        if _rate_limited(f"avail:{_request_ip()}", max_calls=30, window_sec=60):
            return error_response("Too many requests. Please slow down.", 429)
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
        # 5 signups / 10 min per IP — prevents mass account creation.
        if _rate_limited(f"signup:{_request_ip()}", max_calls=5, window_sec=600):
            return error_response("Too many signup attempts. Please try again later.", 429)
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
        response = jsonify({
            "user": user,
            "workspace": get_workspace_state(app, user_id),
            "subscription": _subscription_for(user_id),
        })
        set_session_cookie(app, response, session_token)
        return response, 201

    @app.post("/api/auth/login")
    def login() -> Any:
        # 10 attempts / 5 min per IP — slows brute-force without annoying
        # legitimate users who mistype a password.
        if _rate_limited(f"login:{_request_ip()}", max_calls=10, window_sec=300):
            return error_response("Too many login attempts. Please wait a few minutes.", 429)
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
        response = jsonify({
            "user": row_to_user(user),
            "workspace": get_workspace_state(app, user["id"]),
            "subscription": _subscription_for(user["id"]),
        })
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
        clear_session_cookie(response)
        return response

    def _subscription_for(user_id: int) -> dict[str, Any]:
        """Return the user's subscription tier/status, defaulting to free."""
        if _billing_get_subscription is None:
            return {"tier": "free", "status": None}
        try:
            return _billing_get_subscription(get_db(app), user_id)
        except Exception as exc:  # noqa: BLE001
            _log.warning("get_subscription failed for user %s: %s", user_id, exc)
            return {"tier": "free", "status": None}

    @app.get("/api/auth/session")
    def session_info() -> Any:
        user = require_user(app)
        workspace = get_workspace_state(app, user["id"])
        return jsonify({
            "user": row_to_user(user),
            "workspace": workspace,
            "subscription": _subscription_for(user["id"]),
        })

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
        clear_session_cookie(response)
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

    @app.get("/api/paper/account")
    def paper_account() -> Any:
        user = require_user(app)
        # Check and fill any triggered pending orders before building the snapshot
        newly_filled = []
        try:
            newly_filled = check_and_fill_pending_orders(app, user["id"])
        except Exception as exc:
            _log.warning("check_and_fill_pending_orders failed for user %s: %s", user["id"], exc)
        snapshot = build_paper_snapshot(app, user["id"])
        # Record a mark-to-market snapshot on each account fetch. The helper
        # compacts consecutive identical points to avoid flooding the DB.
        try:
            record_equity_snapshot(
                app,
                user["id"],
                equity=float(snapshot["account"]["equity"]),
                cash=float(snapshot["account"]["cash"]),
                positions_value=float(snapshot["account"]["holdingsValue"]),
            )
            snapshot["equityHistory"] = load_equity_history(app, user["id"])
        except Exception as exc:
            _log.warning("record_equity_snapshot failed for user %s: %s", user["id"], exc)
        if newly_filled:
            snapshot["newlyFilled"] = newly_filled
        return jsonify(snapshot)

    @app.post("/api/paper/reset")
    def paper_reset() -> Any:
        user = require_user(app)
        db = get_db(app)
        db.execute("DELETE FROM paper_positions WHERE user_id = ?", (user["id"],))
        db.execute("DELETE FROM paper_orders WHERE user_id = ?", (user["id"],))
        db.execute("DELETE FROM paper_accounts WHERE user_id = ?", (user["id"],))
        db.execute("DELETE FROM paper_equity_history WHERE user_id = ?", (user["id"],))
        db.execute("DELETE FROM paper_pending_orders WHERE user_id = ?", (user["id"],))
        db.commit()
        ensure_paper_account(app, user["id"])
        snapshot = build_paper_snapshot(app, user["id"])
        try:
            record_equity_snapshot(
                app,
                user["id"],
                equity=float(snapshot["account"]["equity"]),
                cash=float(snapshot["account"]["cash"]),
                positions_value=float(snapshot["account"]["holdingsValue"]),
            )
            snapshot["equityHistory"] = load_equity_history(app, user["id"])
        except Exception as exc:
            _log.warning("record_equity_snapshot (reset) failed for user %s: %s", user["id"], exc)
        return jsonify(snapshot)

    @app.post("/api/paper/order")
    def paper_order() -> Any:
        user = require_user(app)
        payload = request.get_json(silent=True) or {}
        symbol = str(payload.get("symbol", "")).strip().upper()
        side = str(payload.get("side", "")).strip().lower()
        try:
            shares = float(payload.get("shares", 0))
        except (TypeError, ValueError):
            return error_response("Shares must be a number.", 400)

        if not symbol:
            return error_response("Symbol is required.", 400)
        if side not in {"buy", "sell"}:
            return error_response("Side must be 'buy' or 'sell'.", 400)
        if shares <= 0:
            return error_response("Shares must be greater than zero.", 400)

        # Basic guardrails so paper trading stays grounded in reality:
        #   - Whole-share orders only (up to 6 decimals tolerated for future
        #     fractional support, rejected above that).
        #   - Hard cap of 100,000 shares per order.
        if shares > 100_000:
            return error_response(
                "Maximum 100,000 shares per order. Split into smaller tickets.",
                400,
            )
        if abs(shares - round(shares)) > 1e-6:
            return error_response("Fractional shares are not supported yet — use whole shares.", 400)
        shares = float(round(shares))

        quotes = fetch_quotes([symbol])
        if not quotes:
            return error_response(f"No live quote for {symbol}.", 400)
        price = float(quotes[0].get("price") or 0)
        if price <= 0:
            return error_response(f"{symbol} has no tradable price right now.", 400)

        ensure_paper_account(app, user["id"])
        db = get_db(app)
        account = db.execute(
            "SELECT cash FROM paper_accounts WHERE user_id = ?",
            (user["id"],),
        ).fetchone()
        cash = float(account["cash"])

        position_row = db.execute(
            "SELECT shares, avg_cost FROM paper_positions WHERE user_id = ? AND symbol = ?",
            (user["id"], symbol),
        ).fetchone()
        existing_shares = float(position_row["shares"]) if position_row else 0.0
        existing_avg = float(position_row["avg_cost"]) if position_row else 0.0

        realized_pl = 0.0
        total = price * shares

        if side == "buy":
            if total > cash + 1e-6:
                return error_response(
                    f"Insufficient buying power: need ${total:,.2f}, have ${cash:,.2f}.",
                    400,
                )
            new_shares = existing_shares + shares
            new_avg = (
                (existing_shares * existing_avg + shares * price) / new_shares
                if new_shares > 0
                else price
            )
            cash -= total
            upsert_position(db, user["id"], symbol, new_shares, new_avg)
        else:
            if shares > existing_shares + 1e-6:
                return error_response(
                    f"Cannot sell {shares} shares — you hold {existing_shares:g} of {symbol}.",
                    400,
                )
            realized_pl = (price - existing_avg) * shares
            cash += total
            new_shares = existing_shares - shares
            if new_shares <= 1e-6:
                db.execute(
                    "DELETE FROM paper_positions WHERE user_id = ? AND symbol = ?",
                    (user["id"], symbol),
                )
            else:
                upsert_position(db, user["id"], symbol, new_shares, existing_avg)

        db.execute(
            "UPDATE paper_accounts SET cash = ? WHERE user_id = ?",
            (cash, user["id"]),
        )
        db.execute(
            """
            INSERT INTO paper_orders (user_id, symbol, side, shares, price, total, realized_pl, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user["id"], symbol, side, shares, price, total, realized_pl, utc_now_iso()),
        )
        db.commit()

        newly_unlocked = evaluate_achievements(app, user["id"])

        snapshot = build_paper_snapshot(app, user["id"])
        # Record the post-trade equity snapshot so the history chart has a
        # data point anchored to each fill.
        try:
            record_equity_snapshot(
                app,
                user["id"],
                equity=float(snapshot["account"]["equity"]),
                cash=float(snapshot["account"]["cash"]),
                positions_value=float(snapshot["account"]["holdingsValue"]),
            )
            snapshot["equityHistory"] = load_equity_history(app, user["id"])
        except Exception as exc:
            _log.warning("record_equity_snapshot (order) failed for user %s: %s", user["id"], exc)
        snapshot["lastFill"] = {
            "symbol": symbol,
            "side": side,
            "shares": shares,
            "price": price,
            "total": total,
            "realizedPl": realized_pl,
        }
        snapshot["newlyUnlocked"] = newly_unlocked
        return jsonify(snapshot)

    @app.post("/api/paper/pending-order")
    def paper_pending_order_create() -> Any:
        user = require_user(app)
        payload = request.get_json(silent=True) or {}
        symbol = str(payload.get("symbol", "")).strip().upper()
        side = str(payload.get("side", "")).strip().lower()
        order_type = str(payload.get("orderType", "limit")).strip().lower()
        try:
            shares = float(payload.get("shares", 0))
        except (TypeError, ValueError):
            return error_response("Shares must be a number.", 400)
        try:
            limit_price = float(payload.get("limitPrice", 0))
        except (TypeError, ValueError):
            return error_response("Limit price must be a number.", 400)

        if not symbol:
            return error_response("Symbol is required.", 400)
        if side not in {"buy", "sell"}:
            return error_response("Side must be 'buy' or 'sell'.", 400)
        if order_type not in {"limit", "stop"}:
            return error_response("Order type must be 'limit' or 'stop'.", 400)
        if shares <= 0:
            return error_response("Shares must be greater than zero.", 400)
        if limit_price <= 0:
            return error_response("Limit/stop price must be greater than zero.", 400)
        if abs(shares - round(shares)) > 1e-6:
            return error_response("Fractional shares are not supported yet.", 400)
        shares = float(round(shares))

        ensure_paper_account(app, user["id"])
        db = get_db(app)

        # Validate buying power for buy-side pending orders
        if side == "buy":
            account = db.execute(
                "SELECT cash FROM paper_accounts WHERE user_id = ?", (user["id"],)
            ).fetchone()
            needed = shares * limit_price
            if float(account["cash"]) < needed - 1e-6:
                return error_response(
                    f"Insufficient buying power: need ${needed:,.2f}, have ${float(account['cash']):,.2f}.",
                    400,
                )

        db.execute(
            """
            INSERT INTO paper_pending_orders (user_id, symbol, side, order_type, shares, limit_price, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user["id"], symbol, side, order_type, shares, limit_price, utc_now_iso()),
        )
        db.commit()
        snapshot = build_paper_snapshot(app, user["id"])
        return jsonify(snapshot)

    @app.delete("/api/paper/pending-order/<int:order_id>")
    def paper_pending_order_cancel(order_id: int) -> Any:
        user = require_user(app)
        db = get_db(app)
        row = db.execute(
            "SELECT id FROM paper_pending_orders WHERE id = ? AND user_id = ?",
            (order_id, user["id"]),
        ).fetchone()
        if row is None:
            return error_response("Order not found.", 404)
        db.execute("DELETE FROM paper_pending_orders WHERE id = ?", (order_id,))
        db.commit()
        snapshot = build_paper_snapshot(app, user["id"])
        return jsonify(snapshot)

    @app.get("/api/achievements")
    def achievements_list() -> Any:
        user = require_user(app)
        return jsonify({"achievements": list_achievements(app, user["id"])})

    @app.get("/api/screener/universe")
    def screener_universe() -> Any:
        """Return the static equity universe (~200 tickers with sector metadata).
        Frontend merges this with live quotes via /api/market/quotes.
        """
        return jsonify({
            "generatedAt": utc_now_iso(),
            "universe": build_universe_payload(),
        })

    @app.get("/api/market/quotes")
    def market_quotes() -> Any:
        symbols_param = request.args.get("symbols", "")
        symbols = [symbol.strip() for symbol in symbols_param.split(",") if symbol.strip()]
        if not symbols:
            return jsonify({"quotes": []})
        try:
            return jsonify({"quotes": fetch_quotes(symbols)})
        except Exception as exc:
            # Returning 500 forces the frontend into its error state and
            # blocks all downstream renders. Returning an empty list lets
            # the client fall back to its cached/seed data gracefully.
            _log.warning("fetch_quotes failed for %s: %s", symbols, exc)
            return jsonify({"quotes": [], "error": str(exc)}), 200

    @app.get("/api/market/overview")
    def market_overview() -> Any:
        symbols_param = request.args.get("symbols", "")
        symbols = [symbol.strip() for symbol in symbols_param.split(",") if symbol.strip()] or OVERVIEW_SYMBOLS
        try:
            quotes = fetch_quotes(symbols)
        except Exception as exc:
            _log.warning("fetch_quotes failed for overview %s: %s", symbols, exc)
            quotes = []
        return jsonify({
            "generatedAt": utc_now_iso(),
            "phase": market_phase(),
            "quotes": quotes,
        })

    @app.get("/api/market/chart/<symbol>")
    def market_chart(symbol: str) -> Any:
        range_value = request.args.get("range", "1mo")
        interval = request.args.get("interval", "1d")
        try:
            return jsonify({"points": fetch_chart(symbol, range_value, interval)})
        except Exception as exc:
            _log.warning("fetch_chart failed for %s/%s/%s: %s", symbol, range_value, interval, exc)
            return jsonify({"points": [], "error": str(exc)}), 200

    @app.get("/api/market/options/<symbol>")
    def market_options(symbol: str) -> Any:
        expiration = request.args.get("date")
        try:
            return jsonify(fetch_options(symbol, expiration))
        except Exception as exc:
            _log.warning("fetch_options failed for %s/%s: %s", symbol, expiration, exc)
            return jsonify({"expirations": [], "calls": [], "puts": [], "error": str(exc)}), 200

    @app.get("/api/market/news")
    def market_news() -> Any:
        return jsonify({"items": fetch_news_items()})

    @app.get("/api/market/deep-dive/<symbol>")
    def market_deep_dive(symbol: str) -> Any:
        return jsonify(fetch_deep_dive(symbol))

    @app.get("/api/market/fx")
    def market_fx() -> Any:
        try:
            return jsonify({"rates": fetch_fx_rates()})
        except Exception as exc:
            _log.warning("fetch_fx_rates failed: %s", exc)
            return jsonify({"rates": {}}), 200

    @app.get("/api/macro/yields")
    def macro_yields() -> Any:
        """Return US Treasury yield curve data from yfinance."""
        try:
            import yfinance as yf
            tenors = [
                ("1M", "^IRX"),   # 13-week T-bill (proxy for 1M)
                ("3M", "^IRX"),   # 13-week T-bill
                ("6M", "^IRX"),   # reuse 3M for 6M proxy
                ("2Y", "2YY=F"),  # 2Y yield futures
                ("5Y", "^FVX"),   # 5Y treasury yield
                ("10Y", "^TNX"),  # 10Y treasury yield
                ("30Y", "^TYX"),  # 30Y treasury yield
            ]
            # Use specific tickers that yfinance knows
            yield_tickers = ["^IRX", "^FVX", "^TNX", "^TYX"]
            data = yf.download(yield_tickers, period="1d", progress=False)
            close = data.get("Close", data)
            curve = []
            ticker_map = {
                "^IRX": [("1M", 0.95), ("3M", 1.0), ("6M", 1.02)],
                "^FVX": [("5Y", 1.0)],
                "^TNX": [("2Y", 0.92), ("10Y", 1.0)],
                "^TYX": [("30Y", 1.0)],
            }
            for ticker in yield_tickers:
                try:
                    val = float(close[ticker].iloc[-1]) if ticker in close else None
                    if val is not None and val > 0:
                        for tenor, scale in ticker_map[ticker]:
                            curve.append({"tenor": tenor, "yield": round(val * scale, 2)})
                except Exception:
                    continue
            # Sort by maturity
            tenor_order = {"1M": 1, "3M": 2, "6M": 3, "1Y": 4, "2Y": 5, "5Y": 6, "10Y": 7, "30Y": 8}
            curve.sort(key=lambda p: tenor_order.get(p["tenor"], 99))
            if curve:
                return jsonify({"curve": curve, "generatedAt": utc_now_iso()})
        except Exception as exc:
            _log.warning("macro_yields failed: %s", exc)
        return jsonify({"curve": [], "generatedAt": utc_now_iso()})

    # Register Stripe billing routes (status / checkout / portal / webhook).
    # require_user and get_db are passed in so billing.py doesn't have to
    # import from app.py (avoids circular import).
    try:
        register_billing_routes(app, require_user_fn=require_user, get_db_fn=get_db)
    except NameError:
        # billing module failed to import — endpoints just won't exist
        pass

    # ── Internal admin endpoint ────────────────────────────────────────────────
    # Protected by the server secret (TERMINAL_SECRET env var).  Used to
    # manually grant/modify subscription tiers for test accounts.  Do NOT
    # expose in any public client code — bearer token is server-side only.
    @app.post("/api/admin/set-tier")
    def admin_set_tier() -> Any:
        try:
            secret = os.environ.get("TERMINAL_SECRET", "")
            auth = request.headers.get("Authorization", "")
            if not secret or auth != f"Bearer {secret}":
                return error_response("Unauthorized", 401)
            data = request.get_json(silent=True) or {}
            username = data.get("username")
            tier = data.get("tier", "free")
            status_val = data.get("status", "active")
            if not username:
                return error_response("username required", 400)
            if tier not in ("free", "pro", "pro_plus"):
                return error_response("invalid tier", 400)
            db_path = Path(app.config["DATABASE"])
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            try:
                user = conn.execute(
                    "SELECT id FROM users WHERE username = ?", (username,)
                ).fetchone()
                if not user:
                    return error_response("user not found", 404)
                uid = user["id"]
                now = datetime.now(timezone.utc).isoformat()
                # Ensure subscriptions table exists (may be absent on fresh DB)
                conn.execute(
                    """CREATE TABLE IF NOT EXISTS subscriptions (
                        user_id TEXT PRIMARY KEY,
                        tier TEXT NOT NULL DEFAULT 'free',
                        stripe_customer_id TEXT,
                        stripe_subscription_id TEXT,
                        status TEXT,
                        current_period_end TEXT,
                        updated_at TEXT NOT NULL
                    )"""
                )
                existing = conn.execute(
                    "SELECT user_id FROM subscriptions WHERE user_id = ?", (uid,)
                ).fetchone()
                if existing:
                    conn.execute(
                        "UPDATE subscriptions SET tier=?, status=?, updated_at=? WHERE user_id=?",
                        (tier, status_val if tier != "free" else None, now, uid),
                    )
                else:
                    conn.execute(
                        "INSERT INTO subscriptions (user_id, tier, status, updated_at) VALUES (?,?,?,?)",
                        (uid, tier, status_val if tier != "free" else None, now),
                    )
                conn.commit()
                return jsonify({"ok": True, "username": username, "tier": tier, "status": status_val})
            finally:
                conn.close()
        except Exception as exc:  # noqa: BLE001
            _log.exception("admin_set_tier failed")
            return error_response(f"Internal error: {exc}", 500)

    # AI commentary endpoints. fetch_quotes is injected so ai_commentary.py
    # doesn't need to know about yfinance or any data source — same
    # dependency-injection pattern as the billing module above.
    try:
        from .ai_commentary import register_ai_routes
        register_ai_routes(app, fetch_quotes_fn=fetch_quotes, overview_symbols=OVERVIEW_SYMBOLS)
    except Exception as ai_exc:  # noqa: BLE001
        app.logger.warning("AI commentary routes not loaded: %s", ai_exc)

    @app.get("/")
    def serve_index() -> Any:
        # The repo root index.html is the marketing landing page.
        return send_from_directory(ROOT, "index.html")

    @app.get("/terminal")
    def serve_terminal_clean() -> Any:
        # Allow extension-less /terminal as a clean URL for the app.
        return send_from_directory(ROOT, "terminal.html")

    @app.get("/<path:asset_path>")
    def serve_asset(asset_path: str) -> Any:
        candidate = ROOT / asset_path
        if candidate.exists() and candidate.is_file():
            return send_from_directory(ROOT, asset_path)
        # Unknown paths fall back to the terminal app shell so client-side
        # navigation inside the workspace doesn't 404.
        return send_from_directory(ROOT, "terminal.html")

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

        CREATE TABLE IF NOT EXISTS paper_accounts (
            user_id TEXT PRIMARY KEY,
            cash REAL NOT NULL,
            starting_cash REAL NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS paper_positions (
            user_id TEXT NOT NULL,
            symbol TEXT NOT NULL,
            shares REAL NOT NULL,
            avg_cost REAL NOT NULL,
            PRIMARY KEY(user_id, symbol),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS paper_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            shares REAL NOT NULL,
            price REAL NOT NULL,
            total REAL NOT NULL,
            realized_pl REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS achievements (
            user_id TEXT NOT NULL,
            key TEXT NOT NULL,
            unlocked_at TEXT NOT NULL,
            PRIMARY KEY(user_id, key),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS paper_equity_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            equity REAL NOT NULL,
            cash REAL NOT NULL,
            positions_value REAL NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_paper_equity_history_user_created
            ON paper_equity_history(user_id, created_at);

        CREATE TABLE IF NOT EXISTS paper_pending_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            order_type TEXT NOT NULL,
            shares REAL NOT NULL,
            limit_price REAL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_paper_pending_orders_user
            ON paper_pending_orders(user_id);
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


def _cookie_flags(app_or_config: Flask | dict[str, Any]) -> tuple[bool, str]:
    """Return (secure, samesite) based on the app config."""
    if isinstance(app_or_config, dict):
        is_testing = app_or_config.get("TESTING", False)
        cross_site = app_or_config.get("CROSS_SITE_COOKIES", False)
    else:
        is_testing = app_or_config.config.get("TESTING", False)
        cross_site = app_or_config.config.get("CROSS_SITE_COOKIES", False)

    if cross_site and not is_testing:
        return True, "None"
    return not is_testing, "Lax"


def set_session_cookie(app: Flask, response: Any, token: str) -> None:
    # Browsers reject `SameSite=None` cookies that aren't also Secure, so we
    # always pair them. In test mode we drop Secure (no TLS) and stay on Lax.
    secure_cookie, same_site = _cookie_flags(app)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=60 * 60 * 24 * 14,
        httponly=True,
        secure=secure_cookie,
        samesite=same_site,
    )


def clear_session_cookie(response: Any) -> None:
    """Delete the session cookie with attributes that match how it was set.

    Browsers only delete a cookie when the delete instruction carries the same
    SameSite/Secure/Path attributes as the original Set-Cookie. We read from
    `current_app` (works inside any active request context).
    """
    try:
        secure_cookie, same_site = _cookie_flags(current_app._get_current_object())  # type: ignore[attr-defined]
    except RuntimeError:
        # Outside of an app context (e.g. tests) — use sensible defaults.
        secure_cookie, same_site = False, "Lax"
    response.set_cookie(
        SESSION_COOKIE,
        "",
        max_age=0,
        httponly=True,
        secure=secure_cookie,
        samesite=same_site,
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
    clear_session_cookie(response)
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
        if key in {"watchlist", "alerts", "positions", "commandHistory", "activeRules", "notifications"} and isinstance(value, list):
            merged[key] = value
        elif key in {"panelModules", "panelSymbols"} and isinstance(value, dict):
            merged[key] = {str(k): v for k, v in value.items()}
        elif key in {"layoutMode", "createdAt", "updatedAt"} and value:
            merged[key] = value
    if not merged.get("createdAt"):
        merged["createdAt"] = utc_now_iso()
    return merged


ACHIEVEMENT_CATALOG = [
    {"key": "first_trade", "title": "Opening Bell", "description": "Place your first paper trade."},
    {"key": "five_trades", "title": "Active Trader", "description": "Place 5 paper trades."},
    {"key": "twenty_trades", "title": "Market Maker", "description": "Place 20 paper trades."},
    {"key": "first_profit", "title": "First Green Print", "description": "Close a trade with realized profit."},
    {"key": "big_winner", "title": "Big Winner", "description": "Close a trade with $1,000+ realized profit."},
    {"key": "diversified", "title": "Diversified", "description": "Hold 5 different positions simultaneously."},
    {"key": "bull_run", "title": "Bull Run", "description": "Take total equity above $110,000."},
    {"key": "comeback_kid", "title": "Comeback Kid", "description": "Return to $100K after a drawdown to $95K or less."},
]


def ensure_paper_account(app: Flask, user_id: str) -> None:
    db = get_db(app)
    row = db.execute(
        "SELECT user_id FROM paper_accounts WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if row is None:
        db.execute(
            "INSERT INTO paper_accounts (user_id, cash, starting_cash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, PAPER_STARTING_CASH, PAPER_STARTING_CASH, utc_now_iso()),
        )
        db.commit()


def upsert_position(db: sqlite3.Connection, user_id: str, symbol: str, shares: float, avg_cost: float) -> None:
    db.execute(
        """
        INSERT INTO paper_positions (user_id, symbol, shares, avg_cost)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, symbol) DO UPDATE SET shares = excluded.shares, avg_cost = excluded.avg_cost
        """,
        (user_id, symbol, shares, avg_cost),
    )


def build_paper_snapshot(app: Flask, user_id: str) -> dict[str, Any]:
    ensure_paper_account(app, user_id)
    db = get_db(app)
    account = db.execute(
        "SELECT cash, starting_cash, created_at FROM paper_accounts WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    positions_rows = db.execute(
        "SELECT symbol, shares, avg_cost FROM paper_positions WHERE user_id = ? ORDER BY symbol",
        (user_id,),
    ).fetchall()
    orders_rows = db.execute(
        """
        SELECT id, symbol, side, shares, price, total, realized_pl, created_at
        FROM paper_orders
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 40
        """,
        (user_id,),
    ).fetchall()

    position_symbols = [row["symbol"] for row in positions_rows]
    live_quotes: dict[str, float] = {}
    if position_symbols:
        try:
            quote_rows = fetch_quotes(position_symbols)
            for q in quote_rows:
                live_quotes[q["symbol"]] = float(q.get("price") or 0)
        except Exception:
            pass

    positions: list[dict[str, Any]] = []
    holdings_value = 0.0
    for row in positions_rows:
        symbol = row["symbol"]
        shares = float(row["shares"])
        avg_cost = float(row["avg_cost"])
        mark = live_quotes.get(symbol) or avg_cost
        market_value = shares * mark
        cost_basis = shares * avg_cost
        unrealized = market_value - cost_basis
        holdings_value += market_value
        positions.append({
            "symbol": symbol,
            "shares": shares,
            "avgCost": avg_cost,
            "mark": mark,
            "marketValue": market_value,
            "costBasis": cost_basis,
            "unrealizedPl": unrealized,
            "unrealizedPct": (unrealized / cost_basis * 100.0) if cost_basis else 0.0,
        })

    cash = float(account["cash"])
    starting_cash = float(account["starting_cash"])
    equity = cash + holdings_value
    total_pl = equity - starting_cash
    total_pl_pct = (total_pl / starting_cash * 100.0) if starting_cash else 0.0

    realized_total = sum(float(row["realized_pl"] or 0) for row in orders_rows)

    orders = [
        {
            "id": row["id"],
            "symbol": row["symbol"],
            "side": row["side"],
            "shares": float(row["shares"]),
            "price": float(row["price"]),
            "total": float(row["total"]),
            "realizedPl": float(row["realized_pl"] or 0),
            "createdAt": row["created_at"],
        }
        for row in orders_rows
    ]

    pending_rows = db.execute(
        """
        SELECT id, symbol, side, order_type, shares, limit_price, created_at
        FROM paper_pending_orders
        WHERE user_id = ?
        ORDER BY id DESC
        """,
        (user_id,),
    ).fetchall()
    pending_orders = [
        {
            "id": row["id"],
            "symbol": row["symbol"],
            "side": row["side"],
            "orderType": row["order_type"],
            "shares": float(row["shares"]),
            "limitPrice": float(row["limit_price"]) if row["limit_price"] is not None else None,
            "createdAt": row["created_at"],
        }
        for row in pending_rows
    ]

    return {
        "account": {
            "cash": cash,
            "startingCash": starting_cash,
            "equity": equity,
            "holdingsValue": holdings_value,
            "totalPl": total_pl,
            "totalPlPct": total_pl_pct,
            "realizedPl": realized_total,
            "createdAt": account["created_at"],
        },
        "positions": positions,
        "orders": orders,
        "pendingOrders": pending_orders,
        "achievements": list_achievements(app, user_id),
        "equityHistory": load_equity_history(app, user_id),
    }


def check_and_fill_pending_orders(app: Flask, user_id: str) -> list[dict[str, Any]]:
    """Check all pending limit/stop orders against current prices and fill any
    that have triggered. Returns a list of newly-filled order dicts."""
    db = get_db(app)
    pending = db.execute(
        "SELECT id, symbol, side, order_type, shares, limit_price FROM paper_pending_orders WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    if not pending:
        return []

    symbols = list({row["symbol"] for row in pending})
    try:
        quote_rows = fetch_quotes(symbols)
        live_prices = {q["symbol"]: float(q.get("price") or 0) for q in quote_rows}
    except Exception:
        return []

    filled = []
    for row in pending:
        sym = row["symbol"]
        price = live_prices.get(sym, 0)
        if price <= 0:
            continue
        lp = float(row["limit_price"]) if row["limit_price"] is not None else 0
        otype = row["order_type"]
        side = row["side"]
        shares = float(row["shares"])

        # Trigger logic:
        #   Limit buy  → fill when price ≤ limit_price
        #   Limit sell → fill when price ≥ limit_price
        #   Stop  buy  → fill when price ≥ limit_price (stop price)
        #   Stop  sell → fill when price ≤ limit_price (stop price)
        triggered = False
        if otype == "limit":
            triggered = (side == "buy" and price <= lp) or (side == "sell" and price >= lp)
        elif otype == "stop":
            triggered = (side == "buy" and price >= lp) or (side == "sell" and price <= lp)

        if not triggered:
            continue

        # Attempt to execute using current market price
        account = db.execute(
            "SELECT cash FROM paper_accounts WHERE user_id = ?", (user_id,)
        ).fetchone()
        if account is None:
            continue
        cash = float(account["cash"])
        total = price * shares

        pos_row = db.execute(
            "SELECT shares, avg_cost FROM paper_positions WHERE user_id = ? AND symbol = ?",
            (user_id, sym),
        ).fetchone()
        existing_shares = float(pos_row["shares"]) if pos_row else 0.0
        existing_avg = float(pos_row["avg_cost"]) if pos_row else 0.0
        realized_pl = 0.0

        if side == "buy":
            if total > cash + 1e-6:
                continue  # skip if insufficient cash at fill time
            new_shares = existing_shares + shares
            new_avg = (existing_shares * existing_avg + shares * price) / new_shares if new_shares else price
            cash -= total
            upsert_position(db, user_id, sym, new_shares, new_avg)
        else:
            if shares > existing_shares + 1e-6:
                continue  # skip if position closed since order was placed
            realized_pl = (price - existing_avg) * shares
            cash += total
            new_shares = existing_shares - shares
            if new_shares <= 1e-6:
                db.execute("DELETE FROM paper_positions WHERE user_id = ? AND symbol = ?", (user_id, sym))
            else:
                upsert_position(db, user_id, sym, new_shares, existing_avg)

        db.execute("UPDATE paper_accounts SET cash = ? WHERE user_id = ?", (cash, user_id))
        db.execute(
            """
            INSERT INTO paper_orders (user_id, symbol, side, shares, price, total, realized_pl, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, sym, side, shares, price, total, realized_pl, utc_now_iso()),
        )
        db.execute("DELETE FROM paper_pending_orders WHERE id = ?", (row["id"],))
        db.commit()
        filled.append({"symbol": sym, "side": side, "shares": shares, "price": price, "orderType": otype})

    return filled


def record_equity_snapshot(
    app: Flask,
    user_id: str,
    *,
    equity: float,
    cash: float,
    positions_value: float,
) -> None:
    """Append a point to the paper equity history. Collapses consecutive
    identical snapshots within 30 seconds to keep the series compact.
    """
    db = get_db(app)
    created_at = utc_now_iso()
    last = db.execute(
        "SELECT id, equity, created_at FROM paper_equity_history WHERE user_id = ? ORDER BY id DESC LIMIT 1",
        (user_id,),
    ).fetchone()
    if last is not None:
        try:
            same_value = abs(float(last["equity"]) - float(equity)) < 0.01
            # Compact: if equity is unchanged and the last point is less than 30s old, update rather than insert.
            if same_value:
                last_ts = datetime.fromisoformat(last["created_at"])
                if (datetime.now(timezone.utc) - last_ts).total_seconds() < 30:
                    db.execute(
                        "UPDATE paper_equity_history SET created_at = ? WHERE id = ?",
                        (created_at, last["id"]),
                    )
                    db.commit()
                    return
        except Exception:
            pass
    db.execute(
        """
        INSERT INTO paper_equity_history (user_id, equity, cash, positions_value, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (user_id, float(equity), float(cash), float(positions_value), created_at),
    )
    # Trim history to the most recent 500 points per user so the table never explodes.
    db.execute(
        """
        DELETE FROM paper_equity_history
        WHERE user_id = ?
          AND id NOT IN (
            SELECT id FROM paper_equity_history
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 500
          )
        """,
        (user_id, user_id),
    )
    db.commit()


def load_equity_history(app: Flask, user_id: str, limit: int = 200) -> list[dict[str, Any]]:
    db = get_db(app)
    rows = db.execute(
        """
        SELECT equity, cash, positions_value, created_at
        FROM paper_equity_history
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (user_id, limit),
    ).fetchall()
    series = [
        {
            "equity": float(row["equity"]),
            "cash": float(row["cash"]),
            "positionsValue": float(row["positions_value"]),
            "createdAt": row["created_at"],
        }
        for row in rows
    ]
    # Reverse so the caller receives oldest → newest.
    series.reverse()
    return series


def list_achievements(app: Flask, user_id: str) -> list[dict[str, Any]]:
    db = get_db(app)
    rows = db.execute(
        "SELECT key, unlocked_at FROM achievements WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    unlocked = {row["key"]: row["unlocked_at"] for row in rows}
    return [
        {
            **item,
            "unlocked": item["key"] in unlocked,
            "unlockedAt": unlocked.get(item["key"]),
        }
        for item in ACHIEVEMENT_CATALOG
    ]


def evaluate_achievements(app: Flask, user_id: str) -> list[str]:
    db = get_db(app)
    existing = {
        row["key"]
        for row in db.execute(
            "SELECT key FROM achievements WHERE user_id = ?", (user_id,)
        ).fetchall()
    }
    newly: list[str] = []

    def unlock(key: str) -> None:
        if key in existing:
            return
        db.execute(
            "INSERT OR IGNORE INTO achievements (user_id, key, unlocked_at) VALUES (?, ?, ?)",
            (user_id, key, utc_now_iso()),
        )
        existing.add(key)
        newly.append(key)

    order_count_row = db.execute(
        "SELECT COUNT(*) AS total, MAX(realized_pl) AS best_pl FROM paper_orders WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    total_orders = int(order_count_row["total"] or 0)
    best_pl = float(order_count_row["best_pl"] or 0)

    if total_orders >= 1:
        unlock("first_trade")
    if total_orders >= 5:
        unlock("five_trades")
    if total_orders >= 20:
        unlock("twenty_trades")
    if best_pl > 0:
        unlock("first_profit")
    if best_pl >= 1000:
        unlock("big_winner")

    position_count_row = db.execute(
        "SELECT COUNT(*) AS total FROM paper_positions WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if int(position_count_row["total"] or 0) >= 5:
        unlock("diversified")

    snapshot = build_paper_snapshot_for_equity(app, user_id)
    equity = snapshot["equity"]
    starting = snapshot["startingCash"]
    if equity >= starting + 10_000:
        unlock("bull_run")

    # comeback_kid: equity ≥ starting cash AND equity history shows a low ≤ 95% of starting
    if "comeback_kid" not in existing and equity >= starting:
        low_row = db.execute(
            "SELECT MIN(equity) AS low FROM paper_equity_history WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        if low_row and low_row["low"] is not None:
            low_equity = float(low_row["low"])
            if low_equity <= starting * 0.95:
                unlock("comeback_kid")

    db.commit()
    return newly


def build_paper_snapshot_for_equity(app: Flask, user_id: str) -> dict[str, float]:
    """Small helper that just computes equity without the full snapshot object."""
    db = get_db(app)
    account = db.execute(
        "SELECT cash, starting_cash FROM paper_accounts WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if account is None:
        return {"equity": PAPER_STARTING_CASH, "startingCash": PAPER_STARTING_CASH}
    cash = float(account["cash"])
    positions_rows = db.execute(
        "SELECT symbol, shares, avg_cost FROM paper_positions WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    symbols = [row["symbol"] for row in positions_rows]
    live_quotes: dict[str, float] = {}
    if symbols:
        try:
            quote_rows = fetch_quotes(symbols)
            for q in quote_rows:
                live_quotes[q["symbol"]] = float(q.get("price") or 0)
        except Exception:
            pass
    holdings = sum(
        float(row["shares"]) * (live_quotes.get(row["symbol"]) or float(row["avg_cost"]))
        for row in positions_rows
    )
    return {"equity": cash + holdings, "startingCash": float(account["starting_cash"])}


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


_RETRY_STATUS_CODES = {429, 500, 502, 503, 504}
_RETRY_MAX_ATTEMPTS = 3
_RETRY_BASE_DELAY = 0.6  # seconds; doubles each retry


def _http_get_bytes(url: str, extra_headers: dict[str, str] | None = None) -> bytes:
    """Low-level HTTP GET with exponential-backoff retry.

    Retries on transient errors (rate-limit 429, server 5xx, socket timeouts).
    Raises the original exception if all attempts are exhausted.
    """
    headers = {**HTTP_HEADERS, **(extra_headers or {})}
    last_exc: Exception | None = None
    for attempt in range(_RETRY_MAX_ATTEMPTS):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=12) as resp:
                status = getattr(resp, "status", 200)
                data = resp.read()
                if status in _RETRY_STATUS_CODES:
                    raise urllib.error.HTTPError(url, status, f"HTTP {status}", {}, None)  # type: ignore[arg-type]
                return data
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as exc:
            last_exc = exc
            is_retriable = (
                isinstance(exc, urllib.error.HTTPError) and exc.code in _RETRY_STATUS_CODES
            ) or isinstance(exc, (urllib.error.URLError, TimeoutError, OSError))
            if not is_retriable or attempt == _RETRY_MAX_ATTEMPTS - 1:
                raise
            delay = _RETRY_BASE_DELAY * (2 ** attempt)
            time.sleep(delay)
    raise last_exc  # type: ignore[misc]


def fetch_json(url: str) -> Any:
    return json.loads(_http_get_bytes(url).decode("utf-8"))


def fetch_json_with_headers(url: str, headers: dict[str, str]) -> Any:
    return json.loads(_http_get_bytes(url, extra_headers=headers).decode("utf-8"))


def fetch_text(url: str) -> str:
    return _http_get_bytes(url).decode("utf-8")


def fetch_quotes(symbols: list[str]) -> list[dict[str, Any]]:
    clean_symbols = sorted({symbol for symbol in symbols if symbol})
    if not clean_symbols:
        return []

    if YFINANCE_AVAILABLE:
        try:
            tickers = yf.Tickers(" ".join(clean_symbols))
            quotes = []
            for symbol in clean_symbols:
                try:
                    t = tickers.tickers.get(symbol) or yf.Ticker(symbol)
                    info = t.fast_info
                    prev_close = float(getattr(info, "previous_close", 0) or 0)
                    price = float(getattr(info, "last_price", 0) or getattr(info, "regular_market_price", 0) or 0)
                    change_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0
                    entry: dict[str, Any] = {
                        "symbol": symbol,
                        "name": getattr(info, "name", None) or symbol,
                        "exchange": getattr(info, "exchange", "N/A") or "N/A",
                        "price": price,
                        "changePct": round(change_pct, 4),
                        "change": round(price - prev_close, 4),
                        "marketCap": float(getattr(info, "market_cap", 0) or 0),
                        "volume": float(getattr(info, "last_volume", 0) or getattr(info, "three_month_average_volume", 0) or 0),
                        "averageVolume": float(getattr(info, "three_month_average_volume", 0) or 0),
                        "dayHigh": float(getattr(info, "day_high", price) or price),
                        "dayLow": float(getattr(info, "day_low", price) or price),
                        "previousClose": prev_close,
                        "fiftyTwoWeekHigh": float(getattr(info, "year_high", 0) or 0),
                        "fiftyTwoWeekLow": float(getattr(info, "year_low", 0) or 0),
                        "currency": getattr(info, "currency", "USD") or "USD",
                    }
                    # Supplement with fundamental fields from full info (best-effort)
                    try:
                        full = t.info
                        pe_val = full.get("trailingPE") or full.get("forwardPE")
                        entry["trailingPE"] = pe_val
                        entry["pe"] = pe_val  # shorthand alias for frontend screener
                        entry["beta"] = full.get("beta") or full.get("betaThreeYear")
                        entry["dividendYield"] = full.get("trailingAnnualDividendYield") or full.get("dividendYield")
                        entry["bid"] = full.get("bid")
                        entry["ask"] = full.get("ask")
                        entry["bidSize"] = full.get("bidSize")
                        entry["askSize"] = full.get("askSize")
                        entry["earningsTimestamp"] = full.get("earningsTimestamp") or full.get("earningsTimestampStart")
                        if not entry["marketCap"]:
                            entry["marketCap"] = float(full.get("marketCap") or 0)
                    except Exception:
                        pass
                    quotes.append(entry)
                except Exception:
                    continue
            if quotes:
                return quotes
        except Exception:
            pass

    # Fallback: direct Yahoo Finance API
    url = QUOTE_URL.format(symbols=urllib.parse.quote(",".join(clean_symbols)))
    payload = fetch_json(url)
    results = payload.get("quoteResponse", {}).get("result", [])
    quotes = []
    for item in results:
        quotes.append({
            "symbol": item.get("symbol"),
            "name": item.get("shortName") or item.get("longName") or item.get("symbol"),
            "exchange": item.get("fullExchangeName") or item.get("exchange") or "N/A",
            "price": item.get("regularMarketPrice") or item.get("postMarketPrice") or 0,
            "changePct": item.get("regularMarketChangePercent") or 0,
            "change": item.get("regularMarketChange") or 0,
            "marketCap": item.get("marketCap") or 0,
            "volume": item.get("regularMarketVolume") or 0,
            "averageVolume": item.get("averageDailyVolume3Month") or item.get("averageDailyVolume10Day") or 0,
            "dayHigh": item.get("regularMarketDayHigh") or item.get("regularMarketPrice") or 0,
            "dayLow": item.get("regularMarketDayLow") or item.get("regularMarketPrice") or 0,
            "previousClose": item.get("regularMarketPreviousClose") or item.get("regularMarketPrice") or 0,
            "fiftyTwoWeekHigh": item.get("fiftyTwoWeekHigh") or item.get("regularMarketDayHigh") or 0,
            "fiftyTwoWeekLow": item.get("fiftyTwoWeekLow") or item.get("regularMarketDayLow") or 0,
            "trailingPE": item.get("trailingPE") or item.get("forwardPE"),
            "pe": item.get("trailingPE") or item.get("forwardPE"),  # shorthand alias
            "beta": item.get("beta") or item.get("betaThreeYear"),
            "dividendYield": item.get("trailingAnnualDividendYield") or item.get("dividendYield"),
            "bid": item.get("bid"),
            "ask": item.get("ask"),
            "bidSize": item.get("bidSize"),
            "askSize": item.get("askSize"),
            "earningsTimestamp": item.get("earningsTimestamp") or item.get("earningsTimestampStart"),
            "currency": item.get("currency") or "USD",
        })
    return quotes


def fetch_chart(symbol: str, range_value: str, interval: str) -> list[dict[str, Any]]:
    if YFINANCE_AVAILABLE:
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=range_value, interval=interval, auto_adjust=True)
            if not df.empty:
                points = []
                for ts, row in df.iterrows():
                    t = int(ts.timestamp())
                    close = float(row.get("Close", 0) or 0)
                    if not close:
                        continue
                    points.append({
                        "timestamp": t,
                        "open": float(row.get("Open", close) or close),
                        "high": float(row.get("High", close) or close),
                        "low": float(row.get("Low", close) or close),
                        "close": close,
                        "volume": int(row.get("Volume", 0) or 0),
                    })
                if points:
                    return points
        except Exception:
            pass

    # Fallback: direct Yahoo Finance API
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
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    volumes = quote.get("volume") or []
    points = []
    for index, timestamp in enumerate(timestamps):
        close_value = closes[index] if index < len(closes) else None
        if close_value is None:
            continue
        points.append({
            "timestamp": timestamp,
            "open": opens[index] if index < len(opens) else close_value,
            "high": highs[index] if index < len(highs) else close_value,
            "low": lows[index] if index < len(lows) else close_value,
            "close": close_value,
            "volume": volumes[index] if index < len(volumes) else 0,
        })
    return points


def fetch_options(symbol: str, expiration: str | None) -> dict[str, Any]:
    # Primary path: yfinance, which scrapes option chains reliably
    # even when the v7 JSON endpoint is gated. Returns per-contract
    # impliedVolatility so the frontend can compute Greeks.
    if YFINANCE_AVAILABLE:
        try:
            ticker = yf.Ticker(symbol)
            expirations = list(ticker.options or [])
            if not expirations:
                return {"expirations": [], "calls": [], "puts": [], "spot": 0}

            # Resolve chosen expiration: allow ISO date, unix seconds, or None.
            chosen = None
            if expiration:
                try:
                    # Unix seconds → ISO date
                    if str(expiration).isdigit():
                        chosen_date = datetime.fromtimestamp(
                            int(expiration), timezone.utc
                        ).strftime("%Y-%m-%d")
                        if chosen_date in expirations:
                            chosen = chosen_date
                    elif expiration in expirations:
                        chosen = expiration
                except Exception:
                    chosen = None
            if not chosen:
                chosen = expirations[0]

            chain = ticker.option_chain(chosen)

            def _as_epoch(date_str: str) -> int:
                try:
                    return int(
                        datetime.strptime(date_str, "%Y-%m-%d")
                        .replace(tzinfo=timezone.utc)
                        .timestamp()
                    )
                except Exception:
                    return 0

            def _row_to_dict(row: dict) -> dict:
                return {
                    "contractSymbol": row.get("contractSymbol"),
                    "strike": row.get("strike"),
                    "lastPrice": row.get("lastPrice"),
                    "bid": row.get("bid"),
                    "ask": row.get("ask"),
                    "change": row.get("change"),
                    "percentChange": row.get("percentChange"),
                    "volume": row.get("volume"),
                    "openInterest": row.get("openInterest"),
                    "impliedVolatility": row.get("impliedVolatility"),
                    "inTheMoney": row.get("inTheMoney"),
                    "expiration": _as_epoch(chosen),
                }

            calls_df = chain.calls.fillna(0).head(20)
            puts_df = chain.puts.fillna(0).head(20)
            calls = [_row_to_dict(r) for r in calls_df.to_dict(orient="records")]
            puts = [_row_to_dict(r) for r in puts_df.to_dict(orient="records")]

            # Current spot from info/fast_info
            spot = 0.0
            try:
                fast = getattr(ticker, "fast_info", None)
                if fast and getattr(fast, "last_price", None):
                    spot = float(fast.last_price) or 0.0
            except Exception:
                spot = 0.0
            if not spot:
                try:
                    info = ticker.history(period="1d")
                    if not info.empty:
                        spot = float(info["Close"].iloc[-1])
                except Exception:
                    spot = 0.0

            return {
                "expirations": [_as_epoch(d) for d in expirations],
                "expiration": _as_epoch(chosen),
                "calls": calls,
                "puts": puts,
                "spot": spot,
            }
        except Exception:
            pass

    # Fallback: legacy v7 JSON endpoint (often 401/429 these days).
    try:
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
    except Exception:
        return {"expirations": [], "calls": [], "puts": [], "spot": 0}


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


def score_sentiment(text: str) -> str:  # noqa: PLR0912
    """
    Lightweight VADER-style sentiment scorer designed for financial headlines.

    Approach
    --------
    1.  Tokenise the headline into lower-case words.
    2.  Score each token against a 140-term financial lexicon.
    3.  Apply a negation window: if a negator word (not, no, never …) appears
        within 3 tokens before a sentiment term, flip its sign.
    4.  Apply a booster window: if an intensifier (very, extremely, massively …)
        appears within 2 tokens before a sentiment term, multiply by 1.5.
    5.  Normalise the raw score by text length to avoid headline-length bias.
    6.  Classify as Positive / Negative / Neutral with a ±0.15 deadband.
    """
    # ── lexicon ──────────────────────────────────────────────────────────────
    _POSITIVE: dict[str, float] = {
        # earnings / guidance
        "beat": 1.5, "beats": 1.5, "exceed": 1.4, "exceeds": 1.4, "exceeded": 1.4,
        "outperform": 1.3, "surpass": 1.4, "raised": 1.2, "raises": 1.2,
        "record": 1.3, "records": 1.3, "milestone": 1.1, "breakout": 1.2,
        # growth
        "growth": 1.2, "grow": 1.0, "growing": 1.1, "accelerate": 1.2,
        "expansion": 1.1, "expand": 1.0, "booming": 1.3, "boom": 1.1,
        "surge": 1.4, "surged": 1.4, "surges": 1.4,
        "soar": 1.4, "soared": 1.4, "soars": 1.4,
        "rally": 1.3, "rallied": 1.3, "rallies": 1.3,
        "jump": 1.2, "jumped": 1.2, "jumps": 1.2,
        "gain": 1.2, "gains": 1.2, "gained": 1.2,
        "rise": 1.1, "rises": 1.1, "rose": 1.1, "rising": 1.1,
        "climb": 1.1, "climbed": 1.1, "climbs": 1.1,
        "spike": 1.2, "spiked": 1.2,
        # analyst/ratings
        "upgrade": 1.4, "upgraded": 1.4, "upgrades": 1.4,
        "buy": 0.9, "overweight": 1.0, "outperformer": 1.2, "top pick": 1.3,
        "strong buy": 1.5, "initiates": 0.6, "raises target": 1.3,
        # macro / deal
        "profit": 1.2, "profitable": 1.2, "profitability": 1.2,
        "dividend": 0.8, "buyback": 0.9, "repurchase": 0.8,
        "merger": 0.7, "acquisition": 0.7, "deal": 0.7,
        "partnership": 0.7, "contract": 0.6, "wins": 1.1, "won": 0.9,
        "approval": 1.0, "approved": 1.0, "approves": 1.0,
        "innovation": 0.8, "breakthrough": 1.3, "launch": 0.7, "launches": 0.7,
        # sentiment words
        "bull": 1.0, "bullish": 1.2, "optimistic": 1.0, "confidence": 0.8,
        "strong": 1.0, "strength": 1.0, "robust": 0.9, "solid": 0.8,
        "recovery": 0.9, "rebound": 1.0, "bounces": 0.9, "stabilise": 0.6,
        "stabilize": 0.6, "stabilises": 0.6, "stabilizes": 0.6,
    }
    _NEGATIVE: dict[str, float] = {
        # earnings / guidance
        "miss": 1.5, "misses": 1.5, "missed": 1.5,
        "disappoint": 1.3, "disappoints": 1.3, "disappointing": 1.4,
        "shortfall": 1.2, "shortfalls": 1.2, "below": 0.8,
        "cut": 1.2, "cuts": 1.2, "slashed": 1.4, "slash": 1.3,
        "lowered": 1.1, "lowers": 1.1, "warns": 1.2, "warning": 1.2,
        "caution": 0.9, "concern": 0.8, "concerns": 0.8,
        # decline
        "fall": 1.1, "falls": 1.1, "fell": 1.1, "falling": 1.1,
        "drop": 1.2, "drops": 1.2, "dropped": 1.2,
        "decline": 1.1, "declines": 1.1, "declined": 1.1,
        "slide": 1.2, "slides": 1.2, "slid": 1.2,
        "plunge": 1.4, "plunges": 1.4, "plunged": 1.4,
        "tumble": 1.3, "tumbles": 1.3, "tumbled": 1.3,
        "sink": 1.2, "sinks": 1.2, "sank": 1.2,
        "crash": 1.5, "crashing": 1.4, "collapsed": 1.4, "collapse": 1.3,
        "tank": 1.2, "tanks": 1.2, "tanked": 1.2,
        "slump": 1.2, "slumps": 1.2, "slumped": 1.2,
        # analyst/ratings
        "downgrade": 1.4, "downgraded": 1.4, "downgrades": 1.4,
        "sell": 0.9, "underweight": 1.0, "underperform": 1.1,
        "lowers target": 1.3, "cuts target": 1.3,
        # macro / risk
        "loss": 1.2, "losses": 1.2, "losing": 1.1,
        "debt": 0.7, "default": 1.3, "bankruptcy": 1.5, "bankrupt": 1.5,
        "layoff": 1.2, "layoffs": 1.2, "layoffs": 1.2, "firing": 1.1,
        "lawsuit": 0.8, "fine": 0.7, "penalty": 0.9, "penalties": 0.9,
        "recall": 0.8, "delay": 0.7, "delays": 0.7, "delayed": 0.7,
        "investigation": 0.9, "probe": 0.8, "fraud": 1.4, "scandal": 1.3,
        "inflation": 0.6, "recession": 1.2, "slowdown": 1.0,
        "rate hike": 0.8, "tariff": 0.7, "tariffs": 0.7,
        # sentiment
        "bear": 1.0, "bearish": 1.2, "pessimistic": 1.0,
        "weak": 0.9, "weakness": 1.0, "volatile": 0.7, "volatility": 0.6,
        "uncertain": 0.8, "uncertainty": 0.8, "risk": 0.6, "risks": 0.6,
        "pressure": 0.8, "headwind": 0.9, "headwinds": 0.9,
        "struggle": 1.0, "struggles": 1.0, "struggling": 1.1,
    }
    _NEGATORS = {"not", "no", "never", "neither", "nor", "without", "lack",
                 "lacking", "fails", "failed", "fail", "unable", "despite",
                 "n't", "cannot", "can't", "won't", "doesn't", "don't", "didn't"}
    _BOOSTERS = {"very", "extremely", "highly", "massively", "significantly",
                 "sharply", "dramatically", "substantially", "largely"}

    # ── tokenise ─────────────────────────────────────────────────────────────
    import re as _re
    tokens = _re.sub(r"[^a-z0-9'\- ]", " ", text.lower()).split()
    if not tokens:
        return "Neutral"

    score = 0.0
    for idx, token in enumerate(tokens):
        weight_pos = _POSITIVE.get(token, 0.0)
        weight_neg = _NEGATIVE.get(token, 0.0)
        if not weight_pos and not weight_neg:
            continue

        # negation window: look back up to 3 tokens
        negated = any(tokens[j] in _NEGATORS for j in range(max(0, idx - 3), idx))
        # booster window: look back up to 2 tokens
        boost = 1.5 if any(tokens[j] in _BOOSTERS for j in range(max(0, idx - 2), idx)) else 1.0

        local = (weight_pos - weight_neg) * boost
        if negated:
            local = -local
        score += local

    # normalise by token count so longer headlines don't dominate
    normalised = score / max(len(tokens), 1)

    if normalised >= 0.15:
        return "Positive"
    if normalised <= -0.15:
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
