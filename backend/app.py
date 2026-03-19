from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
import time
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


def fetch_fx_rates() -> dict[str, Any]:
    payload = fetch_json(FX_URL)
    return payload.get("rates") or {}


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=4173, debug=False)
