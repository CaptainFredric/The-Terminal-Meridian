"""AI market commentary endpoint.

Generates short-form analyst-style commentary on a symbol or the overall
market. Designed with **graceful degradation** as the core principle:

- If `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set, we call a real LLM.
- If neither is set, we fall back to a deterministic, template-driven
  "rule-based analyst" that synthesises commentary from real quote data
  (price action, volume, 52-week range position, etc.). This means the
  panel is *always* useful — even on a fresh checkout with no API keys —
  and you can flip on real AI by adding one env var.

The endpoint is rate-limited to 1 request / 5 seconds per IP via a tiny
in-memory token bucket so that pre-launch traffic spikes don't blow up
your LLM bill or expose you to a trivial DoS.

Routes mounted by `register_ai_routes(app, ...)`:

  GET  /api/ai/commentary?symbol=AAPL  ->  {symbol, headline, bullets, summary,
                                            tone, generatedAt, source}
  GET  /api/ai/market-pulse            ->  {summary, bullets, tone, generatedAt}

`source` is one of: "openai", "anthropic", "template" — so the frontend
can show a small badge ("Powered by GPT-4o" vs "Rule-based insights").
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any, Callable

from flask import Flask, jsonify, request


# ── Config ────────────────────────────────────────────────────────────

def _openai_key() -> str | None:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    return key or None


def _anthropic_key() -> str | None:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    return key or None


def _model() -> str:
    return os.environ.get("AI_COMMENTARY_MODEL", "gpt-4o-mini").strip()


# ── Rate limiting (per-IP token bucket, in-memory) ────────────────────
# Intentionally simple: a dict of {ip: last_request_ts}. Resets on app
# restart, which is fine for a single-instance Flask deploy. If you go
# multi-worker behind gunicorn, swap this for Redis.

_RATE_WINDOW_SEC = 5.0
_last_request_at: dict[str, float] = {}


def _check_rate_limit(ip: str) -> bool:
    """Return True if request is allowed; False if rate-limited."""
    now = time.time()
    last = _last_request_at.get(ip, 0)
    if now - last < _RATE_WINDOW_SEC:
        return False
    _last_request_at[ip] = now
    return True


def _client_ip() -> str:
    """Extract the real client IP, resistant to X-Forwarded-For spoofing.

    Behind a single reverse-proxy (Render, nginx, etc.) the header looks like:
        X-Forwarded-For: <real-client-ip>, <proxy-ip>

    An attacker can prepend arbitrary IPs by sending:
        X-Forwarded-For: 1.2.3.4, 5.6.7.8, <real-ip>

    Taking the *rightmost* IP that was added by the proxy we trust is the
    safest default for a single-hop deployment. If we're behind two trusted
    hops we take the second-from-last, etc. Here we default to rightmost
    unless the env var TRUSTED_PROXY_DEPTH is set (integer ≥ 1).
    """
    fwd = request.headers.get("X-Forwarded-For", "").strip()
    if fwd:
        parts = [p.strip() for p in fwd.split(",") if p.strip()]
        if parts:
            try:
                depth = max(1, int(os.environ.get("TRUSTED_PROXY_DEPTH", "1")))
            except ValueError:
                depth = 1
            # Rightmost IP is the one added by the innermost trusted proxy.
            idx = max(len(parts) - depth, 0)
            return parts[idx]
    return request.remote_addr or "unknown"


# ── Template-driven fallback (always available) ───────────────────────

def _tone_for(change_pct: float) -> str:
    if change_pct >= 2.5:
        return "bullish"
    if change_pct >= 0.5:
        return "constructive"
    if change_pct <= -2.5:
        return "bearish"
    if change_pct <= -0.5:
        return "cautious"
    return "neutral"


def _position_in_range(price: float, low: float, high: float) -> str:
    if not (low and high) or high <= low:
        return "mid-range"
    pct = (price - low) / (high - low)
    if pct >= 0.85:
        return "near 52-week highs"
    if pct >= 0.6:
        return "in the upper half of its 52-week range"
    if pct <= 0.15:
        return "near 52-week lows"
    if pct <= 0.4:
        return "in the lower half of its 52-week range"
    return "mid-range vs. its 52-week band"


def _volume_signal(volume: float, avg_volume: float) -> str | None:
    if not avg_volume or avg_volume <= 0:
        return None
    ratio = volume / avg_volume
    if ratio >= 1.8:
        return f"Volume is running ~{ratio:.1f}× the 3-month average — institutions are paying attention."
    if ratio >= 1.3:
        return f"Volume is ~{ratio:.1f}× normal, suggesting above-average conviction in today's move."
    if ratio <= 0.5:
        return f"Volume is light at ~{ratio:.1f}× average — today's move lacks broad participation."
    return None


def _template_commentary(quote: dict[str, Any]) -> dict[str, Any]:
    """Build deterministic commentary from a quote dict."""
    sym = quote.get("symbol", "?")
    name = quote.get("name") or sym
    price = float(quote.get("price") or 0)
    change_pct = float(quote.get("changePct") or 0)
    high = float(quote.get("fiftyTwoWeekHigh") or 0)
    low = float(quote.get("fiftyTwoWeekLow") or 0)
    volume = float(quote.get("volume") or 0)
    avg_vol = float(quote.get("averageVolume") or 0)

    tone = _tone_for(change_pct)
    arrow = "▲" if change_pct >= 0 else "▼"
    abs_change = abs(change_pct)

    headline_map = {
        "bullish": f"{sym} surges {abs_change:.2f}% — momentum is firmly with the bulls",
        "constructive": f"{sym} grinds higher (+{abs_change:.2f}%) on steady demand",
        "neutral": f"{sym} trades quietly near ${price:,.2f}",
        "cautious": f"{sym} drifts lower (−{abs_change:.2f}%) as buyers step back",
        "bearish": f"{sym} sells off {abs_change:.2f}% — sellers in control",
    }
    headline = headline_map[tone]

    bullets: list[str] = []
    bullets.append(
        f"{name} ({sym}) is at ${price:,.2f}, {arrow} {abs_change:.2f}% on the session."
    )
    if high and low:
        bullets.append(f"{sym} is currently {_position_in_range(price, low, high)}.")
    vol_msg = _volume_signal(volume, avg_vol)
    if vol_msg:
        bullets.append(vol_msg)

    if tone == "bullish":
        bullets.append(
            "Watch for follow-through tomorrow: a second up-day on similar volume "
            "would confirm the breakout. A reversal back below today's open would "
            "suggest the move was a short-squeeze rather than fresh accumulation."
        )
    elif tone == "bearish":
        bullets.append(
            "Key question: is this profit-taking after a strong run, or the start "
            "of a deeper correction? Watch the next support level and overall market breadth."
        )
    elif tone == "neutral":
        bullets.append(
            "Low-volatility sessions often precede directional moves. Consider "
            "checking implied vol on near-dated options for a sense of what the "
            "market is pricing in."
        )

    summary = " ".join(bullets[:2])

    return {
        "symbol": sym,
        "headline": headline,
        "bullets": bullets,
        "summary": summary,
        "tone": tone,
        "source": "template",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": "meridian-rule-engine-v1",
    }


def _template_market_pulse(quotes: list[dict[str, Any]]) -> dict[str, Any]:
    if not quotes:
        return {
            "summary": "No market data available right now — try refreshing in a moment.",
            "bullets": [],
            "tone": "neutral",
            "source": "template",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

    advancers = [q for q in quotes if float(q.get("changePct") or 0) > 0]
    decliners = [q for q in quotes if float(q.get("changePct") or 0) < 0]
    breadth = len(advancers) - len(decliners)
    avg_change = sum(float(q.get("changePct") or 0) for q in quotes) / max(len(quotes), 1)

    biggest_winner = max(quotes, key=lambda q: float(q.get("changePct") or 0))
    biggest_loser = min(quotes, key=lambda q: float(q.get("changePct") or 0))

    if avg_change >= 0.5:
        tone = "bullish"
        headline = f"Risk-on tape: {len(advancers)} of {len(quotes)} bellwethers in the green."
    elif avg_change <= -0.5:
        tone = "bearish"
        headline = f"Risk-off tape: {len(decliners)} of {len(quotes)} bellwethers under water."
    else:
        tone = "neutral"
        headline = f"Mixed tape: breadth {breadth:+d}, average move {avg_change:+.2f}%."

    bullets = [
        headline,
        f"Leader: {biggest_winner.get('symbol')} {float(biggest_winner.get('changePct') or 0):+.2f}% "
        f"at ${float(biggest_winner.get('price') or 0):,.2f}.",
        f"Laggard: {biggest_loser.get('symbol')} {float(biggest_loser.get('changePct') or 0):+.2f}% "
        f"at ${float(biggest_loser.get('price') or 0):,.2f}.",
    ]

    if tone == "bullish":
        bullets.append(
            "Look for confirmation in market breadth (advance/decline line) and "
            "whether the rally extends beyond mega-caps into small/mid-cap names."
        )
    elif tone == "bearish":
        bullets.append(
            "Watch defensive sectors (utilities, staples, healthcare) for relative "
            "outperformance — that's the classic risk-off rotation signal."
        )

    return {
        "summary": " ".join(bullets[:2]),
        "bullets": bullets,
        "tone": tone,
        "source": "template",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


# ── LLM-backed commentary ─────────────────────────────────────────────

_COMMENTARY_SYSTEM = (
    "You are a senior equity research analyst writing for a Bloomberg-style "
    "terminal. Your audience is financially literate. Be specific, cite real "
    "numbers from the data provided, and avoid generic platitudes. Never give "
    "buy/sell recommendations or financial advice — frame everything as "
    "observation and 'things to watch.' Keep responses tight: one headline, "
    "3-5 bullets, ~120 words total."
)


def _build_user_prompt(quote: dict[str, Any]) -> str:
    return (
        f"Write commentary on {quote.get('symbol')} ({quote.get('name', '')}).\n"
        f"Today's data:\n"
        f"- Price: ${float(quote.get('price') or 0):,.2f}\n"
        f"- Day change: {float(quote.get('changePct') or 0):+.2f}%\n"
        f"- 52-week range: ${float(quote.get('fiftyTwoWeekLow') or 0):,.2f} - "
        f"${float(quote.get('fiftyTwoWeekHigh') or 0):,.2f}\n"
        f"- Volume: {float(quote.get('volume') or 0):,.0f} "
        f"(3M avg: {float(quote.get('averageVolume') or 0):,.0f})\n"
        f"- Market cap: ${float(quote.get('marketCap') or 0):,.0f}\n\n"
        "Return a JSON object with keys: headline (string), bullets (array of "
        "3-5 strings), summary (one sentence), tone (one of: bullish, "
        "constructive, neutral, cautious, bearish)."
    )


def _try_openai(quote: dict[str, Any]) -> dict[str, Any] | None:
    key = _openai_key()
    if not key:
        return None
    try:
        # Lazy import so the dependency stays optional.
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=key)
        response = client.chat.completions.create(
            model=_model(),
            messages=[
                {"role": "system", "content": _COMMENTARY_SYSTEM},
                {"role": "user", "content": _build_user_prompt(quote)},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=400,
        )
        import json
        payload = json.loads(response.choices[0].message.content or "{}")
        return {
            "symbol": quote.get("symbol"),
            "headline": payload.get("headline", ""),
            "bullets": payload.get("bullets", []),
            "summary": payload.get("summary", ""),
            "tone": payload.get("tone", "neutral"),
            "source": "openai",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "model": _model(),
        }
    except Exception:  # noqa: BLE001 — fall through to template on ANY error
        return None


def _try_anthropic(quote: dict[str, Any]) -> dict[str, Any] | None:
    key = _anthropic_key()
    if not key:
        return None
    try:
        import anthropic  # type: ignore

        client = anthropic.Anthropic(api_key=key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            system=_COMMENTARY_SYSTEM
            + "\n\nReturn ONLY a JSON object — no markdown fences, no prose.",
            messages=[{"role": "user", "content": _build_user_prompt(quote)}],
            max_tokens=400,
        )
        import json
        text = response.content[0].text if response.content else "{}"
        # Strip code fences if the model added them anyway.
        text = text.strip().lstrip("`").lstrip("json").strip("`").strip()
        payload = json.loads(text)
        return {
            "symbol": quote.get("symbol"),
            "headline": payload.get("headline", ""),
            "bullets": payload.get("bullets", []),
            "summary": payload.get("summary", ""),
            "tone": payload.get("tone", "neutral"),
            "source": "anthropic",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "model": "claude-haiku-4-5",
        }
    except Exception:  # noqa: BLE001
        return None


# ── Route registration ────────────────────────────────────────────────

def register_ai_routes(
    app: Flask,
    fetch_quotes_fn: Callable[[list[str]], list[dict[str, Any]]],
    overview_symbols: list[str],
) -> None:
    """Mount /api/ai/* endpoints. Caller injects fetch_quotes to avoid
    a circular import with backend.app."""

    @app.get("/api/ai/commentary")
    def ai_commentary() -> Any:
        if not _check_rate_limit(_client_ip()):
            return jsonify({"error": "Rate limit: 1 request / 5 seconds."}), 429

        symbol = (request.args.get("symbol") or "").strip().upper()
        if not symbol:
            return jsonify({"error": "Missing ?symbol= parameter."}), 400

        quotes = fetch_quotes_fn([symbol])
        if not quotes:
            return jsonify({"error": f"No data available for {symbol}."}), 404
        quote = quotes[0]

        # Try OpenAI -> Anthropic -> template, in that order.
        result = _try_openai(quote) or _try_anthropic(quote) or _template_commentary(quote)
        return jsonify(result)

    @app.get("/api/ai/market-pulse")
    def ai_market_pulse() -> Any:
        if not _check_rate_limit(_client_ip()):
            return jsonify({"error": "Rate limit: 1 request / 5 seconds."}), 429

        quotes = fetch_quotes_fn(overview_symbols)
        # Market pulse always uses the template engine — it's fast,
        # deterministic, and doesn't burn an LLM call per page-load.
        # Plug in LLM-backed pulse later if you want richer narrative.
        return jsonify(_template_market_pulse(quotes))

    @app.get("/api/ai/status")
    def ai_status() -> Any:
        """Tells the frontend which backend is active so it can show a
        'Powered by GPT-4o' badge (or 'Rule-based insights')."""
        if _openai_key():
            return jsonify({"source": "openai", "model": _model()})
        if _anthropic_key():
            return jsonify({"source": "anthropic", "model": "claude-3-5-haiku"})
        return jsonify({"source": "template", "model": "meridian-rule-engine-v1"})
