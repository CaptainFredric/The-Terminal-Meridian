"""
Stripe Checkout + webhook integration for Meridian.

Designed to degrade gracefully:
- If `stripe` Python SDK isn't installed, all endpoints return 503 with a
  helpful message instead of crashing the app.
- If `STRIPE_SECRET_KEY` isn't set, same behavior.
- If `STRIPE_WEBHOOK_SECRET` isn't set, webhook signature verification is
  skipped (acceptable in test mode; in production you MUST set it).

Wire-up in backend/app.py:
    from .billing import register_billing_routes, ensure_subscription_tables
    ...
    ensure_subscription_tables(app)
    register_billing_routes(app, require_user_fn=require_user, get_db_fn=get_db)

Environment variables consumed:
    STRIPE_SECRET_KEY            sk_test_... or sk_live_...
    STRIPE_WEBHOOK_SECRET        whsec_... (from `stripe listen` or dashboard)
    STRIPE_PRICE_PRO_MONTHLY     price_... (Stripe dashboard product/price ID)
    STRIPE_PRICE_PRO_ANNUAL      price_...
    STRIPE_PRICE_PRO_PLUS_MONTHLY price_...
    STRIPE_PRICE_PRO_PLUS_ANNUAL  price_...
    STRIPE_TRIAL_DAYS            integer, default 7
    APP_BASE_URL                 https://yourdomain.com (used for success/cancel)
"""

from __future__ import annotations

import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Callable

_log = logging.getLogger("meridian.billing")

from flask import Flask, jsonify, request

try:  # pragma: no cover - import guarded so app boots without stripe installed
    import stripe  # type: ignore
    STRIPE_AVAILABLE = True
except ImportError:
    stripe = None  # type: ignore
    STRIPE_AVAILABLE = False


# ── Config helpers ──────────────────────────────────────────────────────────


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _stripe_secret() -> str | None:
    return os.environ.get("STRIPE_SECRET_KEY") or None


def _webhook_secret() -> str | None:
    return os.environ.get("STRIPE_WEBHOOK_SECRET") or None


def _webhook_secret_thin() -> str | None:
    return os.environ.get("STRIPE_WEBHOOK_SECRET_THIN") or None


def _trial_days() -> int:
    try:
        return int(os.environ.get("STRIPE_TRIAL_DAYS", "7"))
    except ValueError:
        return 7


def _app_base_url(req_url: str) -> str:
    """Return APP_BASE_URL or fall back to the requesting URL's origin.

    Falling back means dev (localhost) and GH Pages preview both work
    without extra config — Stripe just needs *some* https/http origin to
    redirect users back to.
    """
    explicit = os.environ.get("APP_BASE_URL")
    if explicit:
        return explicit.rstrip("/")
    # Strip path/query from req_url to get the origin
    from urllib.parse import urlparse
    parsed = urlparse(req_url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _price_id(plan: str, interval: str) -> str | None:
    """Map (plan, interval) -> the Stripe price ID configured via env vars."""
    key_map = {
        ("pro", "monthly"): "STRIPE_PRICE_PRO_MONTHLY",
        ("pro", "annual"): "STRIPE_PRICE_PRO_ANNUAL",
        ("pro_plus", "monthly"): "STRIPE_PRICE_PRO_PLUS_MONTHLY",
        ("pro_plus", "annual"): "STRIPE_PRICE_PRO_PLUS_ANNUAL",
    }
    env_key = key_map.get((plan, interval))
    if not env_key:
        return None
    return os.environ.get(env_key) or None


def _stripe_configured() -> tuple[bool, str | None]:
    """Return (ok, reason_if_not). Used by every endpoint as a precheck."""
    if not STRIPE_AVAILABLE:
        return False, "Stripe SDK not installed. Run: pip install stripe"
    if not _stripe_secret():
        return False, "STRIPE_SECRET_KEY environment variable not set."
    stripe.api_key = _stripe_secret()  # type: ignore[union-attr]
    return True, None


# ── Database schema ────────────────────────────────────────────────────────


def ensure_subscription_tables(app: Flask) -> None:
    """Create the subscriptions and webhook_events tables if they don't exist.

    Idempotent — safe to call on every app start. Designed to live alongside
    `ensure_database()` in app.py.
    """
    db = sqlite3.connect(app.config["DATABASE"])
    try:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS subscriptions (
                user_id TEXT PRIMARY KEY,
                tier TEXT NOT NULL DEFAULT 'free',
                stripe_customer_id TEXT,
                stripe_subscription_id TEXT,
                status TEXT,
                current_period_end TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
                ON subscriptions(stripe_customer_id);
            CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription
                ON subscriptions(stripe_subscription_id);

            -- Idempotency table: stores processed Stripe event IDs so that
            -- retried webhooks are silently ignored rather than double-applied.
            CREATE TABLE IF NOT EXISTS stripe_webhook_events (
                stripe_event_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                processed_at TEXT NOT NULL
            );
            """
        )
        db.commit()
    finally:
        db.close()


# ── Subscription read/write helpers ────────────────────────────────────────


def get_subscription(db: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    """Return the user's subscription, defaulting to a free-tier shape."""
    row = db.execute(
        "SELECT * FROM subscriptions WHERE user_id = ?", (user_id,)
    ).fetchone()
    if row is None:
        return {
            "tier": "free",
            "status": None,
            "currentPeriodEnd": None,
            "stripeCustomerId": None,
        }
    return {
        "tier": row["tier"],
        "status": row["status"],
        "currentPeriodEnd": row["current_period_end"],
        "stripeCustomerId": row["stripe_customer_id"],
    }


def upsert_subscription(
    db: sqlite3.Connection,
    user_id: str,
    *,
    tier: str | None = None,
    stripe_customer_id: str | None = None,
    stripe_subscription_id: str | None = None,
    status: str | None = None,
    current_period_end: str | None = None,
) -> None:
    """Create or update the subscription row, writing only provided fields."""
    existing = db.execute(
        "SELECT * FROM subscriptions WHERE user_id = ?", (user_id,)
    ).fetchone()
    now = _utc_now_iso()
    if existing is None:
        db.execute(
            """
            INSERT INTO subscriptions (
                user_id, tier, stripe_customer_id, stripe_subscription_id,
                status, current_period_end, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                tier or "free",
                stripe_customer_id,
                stripe_subscription_id,
                status,
                current_period_end,
                now,
            ),
        )
    else:
        # Build a partial update so callers can patch one field at a time.
        fields = {
            "tier": tier if tier is not None else existing["tier"],
            "stripe_customer_id": (
                stripe_customer_id if stripe_customer_id is not None
                else existing["stripe_customer_id"]
            ),
            "stripe_subscription_id": (
                stripe_subscription_id if stripe_subscription_id is not None
                else existing["stripe_subscription_id"]
            ),
            "status": status if status is not None else existing["status"],
            "current_period_end": (
                current_period_end if current_period_end is not None
                else existing["current_period_end"]
            ),
            "updated_at": now,
        }
        db.execute(
            """
            UPDATE subscriptions
               SET tier = ?,
                   stripe_customer_id = ?,
                   stripe_subscription_id = ?,
                   status = ?,
                   current_period_end = ?,
                   updated_at = ?
             WHERE user_id = ?
            """,
            (
                fields["tier"],
                fields["stripe_customer_id"],
                fields["stripe_subscription_id"],
                fields["status"],
                fields["current_period_end"],
                fields["updated_at"],
                user_id,
            ),
        )
    db.commit()


def _user_id_from_stripe_customer(
    db: sqlite3.Connection, customer_id: str
) -> str | None:
    row = db.execute(
        "SELECT user_id FROM subscriptions WHERE stripe_customer_id = ?",
        (customer_id,),
    ).fetchone()
    return row["user_id"] if row else None


# ── Webhook handling ───────────────────────────────────────────────────────


def _tier_from_price_id(price_id: str) -> str:
    """Reverse-lookup: which env-configured price corresponds to which tier?"""
    pro_prices = {
        os.environ.get("STRIPE_PRICE_PRO_MONTHLY"),
        os.environ.get("STRIPE_PRICE_PRO_ANNUAL"),
    }
    pro_plus_prices = {
        os.environ.get("STRIPE_PRICE_PRO_PLUS_MONTHLY"),
        os.environ.get("STRIPE_PRICE_PRO_PLUS_ANNUAL"),
    }
    if price_id in pro_prices:
        return "pro"
    if price_id in pro_plus_prices:
        return "pro_plus"
    return "free"


def _handle_subscription_event(
    db: sqlite3.Connection, subscription: Any
) -> None:
    """Update local subscription row from a Stripe Subscription object.

    Handles created / updated / deleted by mapping Stripe status to our tier.
    Called from the webhook for events:
        customer.subscription.created
        customer.subscription.updated
        customer.subscription.deleted
    """
    customer_id = subscription.get("customer")
    if not customer_id:
        return
    user_id = _user_id_from_stripe_customer(db, customer_id)
    if not user_id:
        return  # Customer exists in Stripe but not linked to a user yet

    status = subscription.get("status")  # active, trialing, past_due, canceled, ...
    # Determine tier from the first item's price
    items = (subscription.get("items") or {}).get("data") or []
    price_id = None
    if items:
        price_id = (items[0].get("price") or {}).get("id")
    tier = _tier_from_price_id(price_id) if price_id else "free"

    # If the subscription is canceled or unpaid, downgrade to free
    if status in ("canceled", "incomplete_expired", "unpaid"):
        tier = "free"

    period_end_ts = subscription.get("current_period_end")
    period_end_iso = (
        datetime.fromtimestamp(period_end_ts, tz=timezone.utc).isoformat()
        if period_end_ts else None
    )

    upsert_subscription(
        db,
        user_id,
        tier=tier,
        stripe_subscription_id=subscription.get("id"),
        status=status,
        current_period_end=period_end_iso,
    )


# ── Route registration ─────────────────────────────────────────────────────


def register_billing_routes(
    app: Flask,
    *,
    require_user_fn: Callable[[Flask], sqlite3.Row],
    get_db_fn: Callable[[Flask], sqlite3.Connection],
) -> None:
    """Wire the billing routes onto the Flask app.

    `require_user_fn` and `get_db_fn` are passed in to avoid circular imports
    with backend/app.py.
    """

    @app.get("/api/billing/status")
    def billing_status() -> Any:
        user = require_user_fn(app)
        db = get_db_fn(app)
        return jsonify({"subscription": get_subscription(db, user["id"])})

    @app.post("/api/billing/create-checkout-session")
    def create_checkout_session() -> Any:
        ok, reason = _stripe_configured()
        if not ok:
            return jsonify({"error": reason}), 503

        user = require_user_fn(app)
        db = get_db_fn(app)
        body = request.get_json(silent=True) or {}
        plan = str(body.get("plan", "pro")).lower()
        interval = str(body.get("interval", "monthly")).lower()

        if plan not in ("pro", "pro_plus"):
            return jsonify({"error": "Invalid plan."}), 400
        if interval not in ("monthly", "annual"):
            return jsonify({"error": "Invalid interval."}), 400

        # Disposable-email gate, applied only at the trial-start moment.
        # Free tier signup is unrestricted (no friction, biggest funnel),
        # but to begin a 7-day Pro trial the user must have a permanent
        # email so we can reach them for billing-failed / past-due
        # dunning and so the trial can't be farmed via mailinator+N.
        # We import lazily to keep this module decoupled from app.py.
        try:
            from .app import is_disposable_email  # type: ignore
        except Exception:  # noqa: BLE001
            is_disposable_email = lambda _e: False  # noqa: E731 — graceful no-op
        if is_disposable_email(user.get("email", "") or ""):
            return jsonify({
                "error": (
                    "To start a Pro trial, please use a permanent email "
                    "address. Update your account email in Settings and "
                    "try again — your free-tier workspace is unaffected."
                ),
                "code": "disposable_email_trial_block",
            }), 400

        price_id = _price_id(plan, interval)
        if not price_id:
            env_key = f"STRIPE_PRICE_{plan.upper()}_{interval.upper()}"
            return jsonify({
                "error": f"Stripe price ID not configured. Set {env_key}."
            }), 503

        # Reuse the user's existing Stripe customer if we have one, else
        # create a new one (Stripe's session API can also create implicitly,
        # but doing it explicitly lets us store the ID right away).
        sub = get_subscription(db, user["id"])
        customer_id = sub.get("stripeCustomerId")
        if not customer_id:
            customer = stripe.Customer.create(  # type: ignore[union-attr]
                email=user["email"],
                name=f"{user['first_name']} {user['last_name']}".strip(),
                metadata={"meridian_user_id": user["id"]},
            )
            customer_id = customer.id
            upsert_subscription(db, user["id"], stripe_customer_id=customer_id)

        base = _app_base_url(request.url)
        try:
            session = stripe.checkout.Session.create(  # type: ignore[union-attr]
                mode="subscription",
                customer=customer_id,
                line_items=[{"price": price_id, "quantity": 1}],
                subscription_data={
                    "trial_period_days": _trial_days(),
                    # On trial expiry, ask Stripe to attempt billing
                    # immediately. If the card is invalid or declines,
                    # Stripe transitions the sub to past_due/unpaid
                    # which our get_subscription() reads as not Pro.
                    "trial_settings": {
                        "end_behavior": {"missing_payment_method": "cancel"},
                    },
                    "metadata": {"meridian_user_id": user["id"], "plan": plan},
                },
                # Card upfront, even during the trial. Without this,
                # Stripe's default lets people start a trial without
                # entering payment info. That makes one-trial-per-email
                # the only friction, which a $0-cost mailinator address
                # defeats. Requiring a card forces a chargeable
                # fingerprint Stripe Radar can match against.
                payment_method_collection="always",
                success_url=f"{base}/?billing=success&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{base}/?billing=canceled",
                allow_promotion_codes=True,
                billing_address_collection="auto",
                metadata={"meridian_user_id": user["id"], "plan": plan},
            )
        except Exception as exc:  # noqa: BLE001 - surface Stripe errors to client
            return jsonify({"error": f"Stripe error: {exc}"}), 502

        return jsonify({"url": session.url, "id": session.id})

    @app.post("/api/billing/create-portal-session")
    def create_portal_session() -> Any:
        """Open the Stripe-hosted Customer Portal so users can cancel/update."""
        ok, reason = _stripe_configured()
        if not ok:
            return jsonify({"error": reason}), 503

        user = require_user_fn(app)
        db = get_db_fn(app)
        sub = get_subscription(db, user["id"])
        customer_id = sub.get("stripeCustomerId")
        if not customer_id:
            return jsonify({"error": "No billing account on file yet."}), 404

        base = _app_base_url(request.url)
        try:
            portal = stripe.billing_portal.Session.create(  # type: ignore[union-attr]
                customer=customer_id,
                return_url=f"{base}/",
            )
        except Exception as exc:  # noqa: BLE001
            return jsonify({"error": f"Stripe error: {exc}"}), 502

        return jsonify({"url": portal.url})

    @app.post("/api/billing/webhook")
    def stripe_webhook() -> Any:
        """Stripe POSTs here on subscription lifecycle events.

        Configure the endpoint URL in your Stripe dashboard:
            https://yourdomain.com/api/billing/webhook
        Subscribe to (at minimum):
            customer.subscription.created
            customer.subscription.updated
            customer.subscription.deleted
            checkout.session.completed
        """
        ok, reason = _stripe_configured()
        if not ok:
            return jsonify({"error": reason}), 503

        payload = request.get_data()
        sig_header = request.headers.get("Stripe-Signature", "")
        secret = _webhook_secret()

        # Parse + verify (or just parse if no secret configured — dev only)
        # Two secrets exist because snapshot and thin payload destinations
        # each get their own signing secret from Stripe, even if they share
        # the same URL.  We try snapshot first, then thin.
        thin_secret = _webhook_secret_thin()
        try:
            if secret:
                try:
                    event = stripe.Webhook.construct_event(  # type: ignore[union-attr]
                        payload, sig_header, secret
                    )
                except Exception:
                    if thin_secret:
                        event = stripe.Webhook.construct_event(  # type: ignore[union-attr]
                            payload, sig_header, thin_secret
                        )
                    else:
                        raise
            else:
                # Dev fallback — skip signature check. NEVER do this in prod.
                import json as _json
                event = _json.loads(payload.decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            return jsonify({"error": f"Invalid webhook: {exc}"}), 400

        event_type = event.get("type", "")
        event_id = event.get("id", "")
        data_object = (event.get("data") or {}).get("object") or {}
        db = get_db_fn(app)

        # ── Thin payload expansion ────────────────────────────────────────
        # Stripe's newer "thin payload" destinations omit data.object.
        # When we detect an empty object on an event type we care about,
        # fetch the full event from Stripe's API so handlers work normally.
        _HANDLED_TYPES = {
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
            "checkout.session.completed",
            "invoice.payment_succeeded",
            "invoice.payment_failed",
        }
        if not data_object and event_type in _HANDLED_TYPES and event_id:
            try:
                full_event = stripe.Event.retrieve(event_id)  # type: ignore[union-attr]
                data_object = (full_event.get("data") or {}).get("object") or {}
                _log.info("stripe thin payload expanded event_id=%s", event_id)
            except Exception as exc:  # noqa: BLE001
                _log.warning("stripe thin payload expand failed event_id=%s: %s", event_id, exc)

        _log.info("stripe webhook received event_id=%s type=%s", event_id, event_type)

        # ── Idempotency check ─────────────────────────────────────────────
        # Stripe retries webhooks on non-2xx responses and also when a
        # test re-sends an event. If we've already processed this event
        # ID, return 200 immediately without re-applying side-effects.
        if event_id:
            already = db.execute(
                "SELECT stripe_event_id FROM stripe_webhook_events WHERE stripe_event_id = ?",
                (event_id,),
            ).fetchone()
            if already:
                _log.info("stripe webhook duplicate event_id=%s — skipping", event_id)
                return jsonify({"received": True, "duplicate": True})

        if event_type in (
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
        ):
            _handle_subscription_event(db, data_object)

        elif event_type == "checkout.session.completed":
            # Useful as a fast-path so the user sees Pro features immediately
            # without waiting for the subscription.created event (which Stripe
            # usually fires moments later).
            customer_id = data_object.get("customer")
            user_id = (data_object.get("metadata") or {}).get("meridian_user_id")
            if customer_id and user_id:
                upsert_subscription(
                    db,
                    user_id,
                    stripe_customer_id=customer_id,
                    status="trialing" if _trial_days() > 0 else "active",
                )
        else:
            _log.debug("stripe webhook unhandled event type=%s id=%s", event_type, event_id)

        # Mark this event as processed
        if event_id:
            try:
                db.execute(
                    "INSERT OR IGNORE INTO stripe_webhook_events (stripe_event_id, event_type, processed_at) VALUES (?, ?, ?)",
                    (event_id, event_type, _utc_now_iso()),
                )
                db.commit()
            except Exception as exc:
                _log.warning("failed to record webhook event %s: %s", event_id, exc)

        # Always 200 so Stripe doesn't retry on no-op events
        return jsonify({"received": True})
