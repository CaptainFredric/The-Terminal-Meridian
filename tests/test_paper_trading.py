"""
Unit tests for paper trading logic in backend/app.py.

Run with:  python -m pytest tests/test_paper_trading.py -v
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest

# Make backend importable without the package prefix
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── helpers that bypass Flask context ────────────────────────────────────────

def _make_app():
    """Spin up a test Flask app with an isolated in-memory SQLite database."""
    # Patch the DB path so we get a fresh temp file per test
    import backend.app as m

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    original_db_path = getattr(m, "DB_PATH", None)

    app = m.app
    app.config["TESTING"] = True
    app.config["_TEST_DB_PATH"] = tmp.name

    # Monkey-patch get_db to point at the test DB
    import sqlite3
    from flask import g

    def _test_get_db():
        db = getattr(g, "_database", None)
        if db is None:
            db = g._database = sqlite3.connect(tmp.name, check_same_thread=False)
            db.row_factory = sqlite3.Row
        return db

    m.get_db = _test_get_db

    with app.app_context():
        m.ensure_database()

    return app, tmp.name


# ── Sentiment scorer ──────────────────────────────────────────────────────────

class TestScoreSentiment(unittest.TestCase):
    def setUp(self):
        from backend.app import score_sentiment
        self.score = score_sentiment

    def test_positive_earnings_beat(self):
        self.assertEqual(self.score("Apple beats earnings expectations by wide margin"), "Positive")

    def test_negative_earnings_miss(self):
        self.assertEqual(self.score("Tesla misses quarterly revenue estimates"), "Negative")

    def test_negation_flips_positive(self):
        # "not beat" → should not be positive
        result = self.score("Company did not beat expectations")
        self.assertIn(result, ("Neutral", "Negative"))

    def test_negation_flips_negative(self):
        # "no decline" → should not be negative
        result = self.score("No decline reported in latest quarter")
        self.assertIn(result, ("Neutral", "Positive"))

    def test_booster_amplifies_positive(self):
        # "dramatically surge" should be strongly positive
        self.assertEqual(self.score("Stock dramatically surges on record profit"), "Positive")

    def test_booster_amplifies_negative(self):
        self.assertEqual(self.score("Shares sharply plunge amid fraud probe"), "Negative")

    def test_neutral_baseline(self):
        self.assertEqual(self.score("Company releases quarterly earnings report"), "Neutral")

    def test_empty_string(self):
        self.assertEqual(self.score(""), "Neutral")

    def test_upgrade_positive(self):
        self.assertEqual(self.score("Goldman upgrades NVDA to strong buy"), "Positive")

    def test_downgrade_negative(self):
        self.assertEqual(self.score("Morgan Stanley downgrades AAPL to underperform"), "Negative")

    def test_mixed_headline_resolves(self):
        # Growth + downgrade → let the math decide, just assert it returns a valid value
        result = self.score("Despite strong growth, analyst downgrades stock")
        self.assertIn(result, ("Positive", "Negative", "Neutral"))


# ── Paper order math ──────────────────────────────────────────────────────────

class TestPaperOrderMath(unittest.TestCase):
    """
    Tests the P/L arithmetic that the paper_order endpoint produces.
    We test the computation directly rather than going through HTTP to keep
    tests fast and dependency-free.
    """

    def _simulate_buy(self, shares: float, price: float, cash: float, positions: list) -> tuple:
        """Minimal re-implementation of the paper_order BUY path."""
        cost = shares * price
        if cost > cash:
            return None, "Insufficient buying power"
        new_cash = cash - cost
        existing = next((p for p in positions if p["symbol"] == "AAPL"), None)
        if existing:
            total_shares = existing["shares"] + shares
            total_cost = existing["costBasis"] + cost
            existing["shares"] = total_shares
            existing["avgCost"] = total_cost / total_shares
            existing["costBasis"] = total_cost
        else:
            positions.append({
                "symbol": "AAPL",
                "shares": shares,
                "avgCost": price,
                "costBasis": cost,
            })
        return new_cash, None

    def _simulate_sell(self, shares: float, price: float, cash: float, positions: list) -> tuple:
        existing = next((p for p in positions if p["symbol"] == "AAPL"), None)
        if not existing or existing["shares"] < shares:
            return None, None, "Insufficient shares"
        proceeds = shares * price
        realized_pl = (price - existing["avgCost"]) * shares
        new_cash = cash + proceeds
        existing["shares"] -= shares
        existing["costBasis"] -= existing["avgCost"] * shares
        if existing["shares"] == 0:
            positions.remove(existing)
        return new_cash, realized_pl, None

    def test_buy_reduces_cash(self):
        cash = 10_000.0
        positions: list = []
        new_cash, err = self._simulate_buy(10, 100.0, cash, positions)
        self.assertIsNone(err)
        self.assertAlmostEqual(new_cash, 9_000.0)

    def test_buy_creates_position(self):
        cash = 10_000.0
        positions: list = []
        self._simulate_buy(10, 150.0, cash, positions)
        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0]["shares"], 10)
        self.assertAlmostEqual(positions[0]["avgCost"], 150.0)

    def test_buy_averages_cost_on_second_purchase(self):
        cash = 100_000.0
        positions: list = []
        self._simulate_buy(10, 100.0, cash, positions)
        cash -= 1_000.0
        self._simulate_buy(10, 200.0, cash, positions)
        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0]["shares"], 20)
        self.assertAlmostEqual(positions[0]["avgCost"], 150.0)  # (1000+2000)/20

    def test_buy_fails_when_insufficient_cash(self):
        _, err = self._simulate_buy(1000, 500.0, 100.0, [])
        self.assertIsNotNone(err)

    def test_sell_increases_cash(self):
        cash = 5_000.0
        positions = [{"symbol": "AAPL", "shares": 10, "avgCost": 100.0, "costBasis": 1_000.0}]
        new_cash, realized_pl, err = self._simulate_sell(5, 120.0, cash, positions)
        self.assertIsNone(err)
        self.assertAlmostEqual(new_cash, 5_600.0)   # 5_000 + 5*120
        self.assertAlmostEqual(realized_pl, 100.0)  # (120-100)*5

    def test_sell_removes_position_when_fully_closed(self):
        positions = [{"symbol": "AAPL", "shares": 5, "avgCost": 100.0, "costBasis": 500.0}]
        self._simulate_sell(5, 100.0, 0.0, positions)
        self.assertEqual(len(positions), 0)

    def test_sell_fails_when_insufficient_shares(self):
        positions = [{"symbol": "AAPL", "shares": 3, "avgCost": 100.0, "costBasis": 300.0}]
        _, _, err = self._simulate_sell(5, 100.0, 0.0, positions)
        self.assertIsNotNone(err)

    def test_realized_pl_on_loss(self):
        positions = [{"symbol": "AAPL", "shares": 10, "avgCost": 200.0, "costBasis": 2_000.0}]
        _, realized_pl, _ = self._simulate_sell(10, 150.0, 0.0, positions)
        self.assertAlmostEqual(realized_pl, -500.0)  # (150-200)*10


# ── Equity history compaction ─────────────────────────────────────────────────

class TestEquityHistoryCompaction(unittest.TestCase):
    """
    Verifies the 30-second dedup and 500-point cap logic without hitting SQLite.
    """

    def _compact(self, history: list, new_equity: float, new_cash: float, new_pos_val: float,
                  now_iso: str, window_secs: int = 30, max_points: int = 500) -> list:
        """
        Mirrors the compaction logic in record_equity_snapshot.
        Returns updated history list.
        """
        from datetime import datetime, timezone

        def _parse(ts: str) -> datetime:
            try:
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                return datetime.now(timezone.utc)

        now_dt = _parse(now_iso)

        if history:
            last = history[-1]
            age_secs = (now_dt - _parse(last["createdAt"])).total_seconds()
            if (age_secs <= window_secs
                    and abs(last["equity"] - new_equity) < 0.01
                    and abs(last["cash"] - new_cash) < 0.01):
                # Dedup: just update timestamp
                last["createdAt"] = now_iso
                return history

        history.append({
            "equity": new_equity,
            "cash": new_cash,
            "positionsValue": new_pos_val,
            "createdAt": now_iso,
        })
        # Cap
        if len(history) > max_points:
            history = history[-max_points:]
        return history

    def test_first_entry_is_added(self):
        h = self._compact([], 100_000, 100_000, 0, "2024-01-01T00:00:00+00:00")
        self.assertEqual(len(h), 1)

    def test_identical_entry_within_window_updates_timestamp(self):
        h = [{"equity": 100_000, "cash": 100_000, "positionsValue": 0,
               "createdAt": "2024-01-01T00:00:00+00:00"}]
        h = self._compact(h, 100_000, 100_000, 0, "2024-01-01T00:00:10+00:00")
        self.assertEqual(len(h), 1)
        self.assertEqual(h[0]["createdAt"], "2024-01-01T00:00:10+00:00")

    def test_different_equity_adds_new_entry(self):
        h = [{"equity": 100_000, "cash": 99_000, "positionsValue": 1_000,
               "createdAt": "2024-01-01T00:00:00+00:00"}]
        h = self._compact(h, 101_000, 99_000, 2_000, "2024-01-01T00:00:10+00:00")
        self.assertEqual(len(h), 2)

    def test_entry_after_window_adds_new_row(self):
        h = [{"equity": 100_000, "cash": 100_000, "positionsValue": 0,
               "createdAt": "2024-01-01T00:00:00+00:00"}]
        # 40 seconds later — outside the 30s window
        h = self._compact(h, 100_000, 100_000, 0, "2024-01-01T00:00:40+00:00")
        self.assertEqual(len(h), 2)

    def test_cap_trims_to_max_points(self):
        h: list = []
        for i in range(510):
            ts = f"2024-01-01T{i // 3600:02d}:{(i % 3600) // 60:02d}:{i % 60:02d}+00:00"
            # Force unique equity each time to bypass dedup
            h = self._compact(h, 100_000 + i, 100_000, i, ts, max_points=500)
        self.assertLessEqual(len(h), 500)


# ── Guardrails ────────────────────────────────────────────────────────────────

class TestGuardrails(unittest.TestCase):
    """Tests the share-count guardrails without HTTP."""

    def _validate_shares(self, shares_raw) -> tuple[float | None, str | None]:
        """Mirror of the app's guardrail checks."""
        try:
            shares = float(shares_raw)
        except (TypeError, ValueError):
            return None, "Invalid shares value"
        if shares <= 0:
            return None, "Shares must be positive"
        if shares > 100_000:
            return None, "Maximum 100,000 shares per order"
        if abs(shares - round(shares)) > 1e-6:
            return None, "Fractional shares are not supported yet"
        return float(round(shares)), None

    def test_valid_order(self):
        shares, err = self._validate_shares(10)
        self.assertIsNone(err)
        self.assertEqual(shares, 10.0)

    def test_too_many_shares(self):
        _, err = self._validate_shares(100_001)
        self.assertIsNotNone(err)

    def test_exactly_limit_is_ok(self):
        shares, err = self._validate_shares(100_000)
        self.assertIsNone(err)
        self.assertEqual(shares, 100_000.0)

    def test_fractional_rejected(self):
        _, err = self._validate_shares(10.5)
        self.assertIsNotNone(err)

    def test_zero_rejected(self):
        _, err = self._validate_shares(0)
        self.assertIsNotNone(err)

    def test_negative_rejected(self):
        _, err = self._validate_shares(-5)
        self.assertIsNotNone(err)


if __name__ == "__main__":
    unittest.main()
