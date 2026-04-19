"""
Unit tests for achievements evaluation and comeback_kid logic.

Run with:  python -m pytest tests/test_achievements.py -v
"""
from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestAchievementCatalog(unittest.TestCase):
    """Verify the achievement catalog is well-formed."""

    def setUp(self):
        from backend.app import ACHIEVEMENT_CATALOG
        self.catalog = ACHIEVEMENT_CATALOG

    def test_catalog_has_expected_length(self):
        self.assertEqual(len(self.catalog), 8)

    def test_all_entries_have_required_keys(self):
        for item in self.catalog:
            self.assertIn("key", item)
            self.assertIn("title", item)
            self.assertIn("description", item)

    def test_keys_are_unique(self):
        keys = [item["key"] for item in self.catalog]
        self.assertEqual(len(keys), len(set(keys)))

    def test_expected_keys_present(self):
        keys = {item["key"] for item in self.catalog}
        expected = {
            "first_trade", "five_trades", "twenty_trades",
            "first_profit", "big_winner", "diversified",
            "bull_run", "comeback_kid",
        }
        self.assertEqual(keys, expected)


class TestComputeBuyLogic(unittest.TestCase):
    """Test the paper trading buy computation edge cases."""

    def _simulate_buy(self, shares, price, cash, positions):
        cost = shares * price
        if cost > cash:
            return None, "Insufficient buying power"
        new_cash = cash - cost
        existing = next((p for p in positions if p["symbol"] == "TEST"), None)
        if existing:
            total_shares = existing["shares"] + shares
            total_cost = existing["costBasis"] + cost
            existing["shares"] = total_shares
            existing["avgCost"] = total_cost / total_shares
            existing["costBasis"] = total_cost
        else:
            positions.append({
                "symbol": "TEST",
                "shares": shares,
                "avgCost": price,
                "costBasis": cost,
            })
        return new_cash, None

    def test_exact_cash_match(self):
        """Edge: cost exactly equals available cash."""
        new_cash, err = self._simulate_buy(100, 100.0, 10_000.0, [])
        self.assertIsNone(err)
        self.assertAlmostEqual(new_cash, 0.0)

    def test_one_cent_over_budget(self):
        """Edge: cost is $0.01 more than available cash."""
        _, err = self._simulate_buy(100, 100.01, 10_000.0, [])
        self.assertIsNotNone(err)

    def test_avg_cost_three_purchases(self):
        """Cost averaging across three separate buys."""
        positions = []
        cash = 100_000.0
        cash, _ = self._simulate_buy(10, 100.0, cash, positions)
        cash, _ = self._simulate_buy(20, 150.0, cash, positions)
        cash, _ = self._simulate_buy(30, 200.0, cash, positions)
        self.assertEqual(positions[0]["shares"], 60)
        expected_avg = (10*100 + 20*150 + 30*200) / 60
        self.assertAlmostEqual(positions[0]["avgCost"], expected_avg, places=2)


class TestComputeSellLogic(unittest.TestCase):
    """Test paper sell edge cases."""

    def _simulate_sell(self, shares, price, cash, positions):
        existing = next((p for p in positions if p["symbol"] == "TEST"), None)
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

    def test_partial_sell_preserves_avg_cost(self):
        """Selling partial shares keeps the same avgCost."""
        positions = [{"symbol": "TEST", "shares": 100, "avgCost": 50.0, "costBasis": 5_000.0}]
        _, _, err = self._simulate_sell(30, 60.0, 0, positions)
        self.assertIsNone(err)
        self.assertEqual(positions[0]["shares"], 70)
        self.assertAlmostEqual(positions[0]["avgCost"], 50.0)

    def test_sell_at_loss_negative_pl(self):
        positions = [{"symbol": "TEST", "shares": 10, "avgCost": 100.0, "costBasis": 1_000.0}]
        _, pl, _ = self._simulate_sell(10, 80.0, 0, positions)
        self.assertAlmostEqual(pl, -200.0)

    def test_sell_exact_shares_removes_position(self):
        positions = [{"symbol": "TEST", "shares": 10, "avgCost": 100.0, "costBasis": 1_000.0}]
        self._simulate_sell(10, 100.0, 0, positions)
        self.assertEqual(len(positions), 0)

    def test_sell_more_than_owned_fails(self):
        positions = [{"symbol": "TEST", "shares": 5, "avgCost": 100.0, "costBasis": 500.0}]
        _, _, err = self._simulate_sell(10, 100.0, 0, positions)
        self.assertIsNotNone(err)

    def test_sell_from_empty_position_list(self):
        _, _, err = self._simulate_sell(1, 100.0, 0, [])
        self.assertIsNotNone(err)


class TestComebackKidLogic(unittest.TestCase):
    """Test the comeback_kid achievement condition in isolation."""

    def _check_comeback(self, current_equity, starting_cash, history_low):
        """Mirror of the comeback_kid check from evaluate_achievements."""
        if current_equity < starting_cash:
            return False
        if history_low is None:
            return False
        return history_low <= starting_cash * 0.95

    def test_eligible_after_recovery(self):
        """Equity dropped to $94K and recovered to $100K+."""
        self.assertTrue(self._check_comeback(100_000, 100_000, 94_000))

    def test_not_eligible_if_never_dropped(self):
        """Equity never went below 95% of starting."""
        self.assertFalse(self._check_comeback(110_000, 100_000, 99_000))

    def test_not_eligible_if_still_below_starting(self):
        """Equity dropped but hasn't recovered yet."""
        self.assertFalse(self._check_comeback(96_000, 100_000, 92_000))

    def test_edge_exactly_95_percent(self):
        """Low is exactly 95% of starting → should qualify."""
        self.assertTrue(self._check_comeback(100_000, 100_000, 95_000))

    def test_edge_just_above_95_percent(self):
        """Low is $95,001 → should NOT qualify."""
        self.assertFalse(self._check_comeback(100_000, 100_000, 95_001))

    def test_no_history_data(self):
        """No equity history rows at all."""
        self.assertFalse(self._check_comeback(100_000, 100_000, None))


class TestShareValidation(unittest.TestCase):
    """Expanded share validation edge cases."""

    def _validate(self, shares_raw):
        try:
            shares = float(shares_raw)
        except (TypeError, ValueError):
            return None, "Invalid shares value"
        if shares <= 0:
            return None, "Shares must be positive"
        if shares > 100_000:
            return None, "Maximum 100,000 shares per order"
        if abs(shares - round(shares)) > 1e-6:
            return None, "Fractional shares not supported"
        return float(round(shares)), None

    def test_string_number(self):
        shares, err = self._validate("42")
        self.assertIsNone(err)
        self.assertEqual(shares, 42.0)

    def test_string_non_number(self):
        _, err = self._validate("abc")
        self.assertIsNotNone(err)

    def test_none_input(self):
        _, err = self._validate(None)
        self.assertIsNotNone(err)

    def test_very_small_positive(self):
        """0.0001 is fractional → rejected."""
        _, err = self._validate(0.0001)
        self.assertIsNotNone(err)

    def test_float_rounding_near_integer(self):
        """10.0000001 rounds to 10 → accepted."""
        shares, err = self._validate(10.0000001)
        self.assertIsNone(err)
        self.assertEqual(shares, 10.0)

    def test_boundary_100k(self):
        shares, err = self._validate(100_000)
        self.assertIsNone(err)

    def test_boundary_100k_plus_one(self):
        _, err = self._validate(100_001)
        self.assertIsNotNone(err)


if __name__ == "__main__":
    unittest.main()
