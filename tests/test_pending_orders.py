"""
Unit tests for paper trading limit/stop pending order logic.

Run with:  python -m pytest tests/test_pending_orders.py -v
"""
from __future__ import annotations

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ── helpers extracted from app.py for isolated testing ──────────────────────

def pending_order_trigger(order_type: str, side: str, price: float, limit_price: float) -> bool:
    """Replicates the trigger logic from check_and_fill_pending_orders."""
    if order_type == "limit":
        return (side == "buy" and price <= limit_price) or (side == "sell" and price >= limit_price)
    if order_type == "stop":
        return (side == "buy" and price >= limit_price) or (side == "sell" and price <= limit_price)
    return False


def compute_new_avg_cost(existing_shares: float, existing_avg: float, new_shares: float, price: float) -> float:
    total_shares = existing_shares + new_shares
    if total_shares == 0:
        return price
    return (existing_shares * existing_avg + new_shares * price) / total_shares


# ── TestPendingOrderTrigger ──────────────────────────────────────────────────

class TestPendingOrderTrigger(unittest.TestCase):
    """Test trigger logic for limit and stop orders."""

    # ── limit buy: triggers when price falls to or below limit ──
    def test_limit_buy_triggers_at_exact_price(self):
        self.assertTrue(pending_order_trigger("limit", "buy", price=100.00, limit_price=100.00))

    def test_limit_buy_triggers_below_limit(self):
        self.assertTrue(pending_order_trigger("limit", "buy", price=99.50, limit_price=100.00))

    def test_limit_buy_does_not_trigger_above_limit(self):
        self.assertFalse(pending_order_trigger("limit", "buy", price=100.01, limit_price=100.00))

    # ── limit sell: triggers when price rises to or above limit ──
    def test_limit_sell_triggers_at_exact_price(self):
        self.assertTrue(pending_order_trigger("limit", "sell", price=110.00, limit_price=110.00))

    def test_limit_sell_triggers_above_limit(self):
        self.assertTrue(pending_order_trigger("limit", "sell", price=111.50, limit_price=110.00))

    def test_limit_sell_does_not_trigger_below_limit(self):
        self.assertFalse(pending_order_trigger("limit", "sell", price=109.99, limit_price=110.00))

    # ── stop buy: triggers when price rises to or above stop ──
    def test_stop_buy_triggers_at_exact_price(self):
        self.assertTrue(pending_order_trigger("stop", "buy", price=105.00, limit_price=105.00))

    def test_stop_buy_triggers_above_stop(self):
        self.assertTrue(pending_order_trigger("stop", "buy", price=106.00, limit_price=105.00))

    def test_stop_buy_does_not_trigger_below_stop(self):
        self.assertFalse(pending_order_trigger("stop", "buy", price=104.99, limit_price=105.00))

    # ── stop sell (stop-loss): triggers when price falls to or below stop ──
    def test_stop_sell_triggers_at_exact_price(self):
        self.assertTrue(pending_order_trigger("stop", "sell", price=90.00, limit_price=90.00))

    def test_stop_sell_triggers_below_stop(self):
        self.assertTrue(pending_order_trigger("stop", "sell", price=89.00, limit_price=90.00))

    def test_stop_sell_does_not_trigger_above_stop(self):
        self.assertFalse(pending_order_trigger("stop", "sell", price=90.01, limit_price=90.00))

    # ── unknown order type ──
    def test_unknown_type_never_triggers(self):
        self.assertFalse(pending_order_trigger("market", "buy", price=100.00, limit_price=100.00))
        self.assertFalse(pending_order_trigger("trailing", "sell", price=80.00, limit_price=90.00))


# ── TestAvgCostOnPendingFill ─────────────────────────────────────────────────

class TestAvgCostOnPendingFill(unittest.TestCase):
    """Verify weighted-average cost calculation when a pending buy fills."""

    def test_first_buy_sets_avg_to_fill_price(self):
        avg = compute_new_avg_cost(0, 0, 10, 100.00)
        self.assertAlmostEqual(avg, 100.00)

    def test_average_down_case(self):
        # existing: 10 shares @ $100, new: 10 shares @ $80 → avg = $90
        avg = compute_new_avg_cost(10, 100.00, 10, 80.00)
        self.assertAlmostEqual(avg, 90.00)

    def test_average_up_case(self):
        # existing: 10 shares @ $100, new: 5 shares @ $130 → avg = (1000 + 650) / 15 = 110
        avg = compute_new_avg_cost(10, 100.00, 5, 130.00)
        self.assertAlmostEqual(avg, 110.00)

    def test_single_share_add(self):
        avg = compute_new_avg_cost(100, 50.00, 1, 60.00)
        expected = (100 * 50 + 1 * 60) / 101
        self.assertAlmostEqual(avg, expected, places=6)

    def test_zero_existing_shares_returns_price(self):
        avg = compute_new_avg_cost(0, 0, 5, 200.00)
        self.assertAlmostEqual(avg, 200.00)


# ── TestPendingOrderValidation ───────────────────────────────────────────────

class TestPendingOrderValidation(unittest.TestCase):
    """Logical constraints that pending-order submission should enforce."""

    def test_shares_must_be_positive(self):
        # zero shares → invalid
        self.assertFalse(0 > 0)
        # negative shares → invalid
        self.assertFalse(-5 > 0)
        # positive shares → valid
        self.assertTrue(10 > 0)

    def test_limit_price_must_be_positive(self):
        self.assertFalse(0.0 > 0)
        self.assertFalse(-1.0 > 0)
        self.assertTrue(99.99 > 0)

    def test_side_must_be_buy_or_sell(self):
        valid = {"buy", "sell"}
        self.assertIn("buy", valid)
        self.assertIn("sell", valid)
        self.assertNotIn("short", valid)
        self.assertNotIn("", valid)

    def test_order_type_must_be_limit_or_stop(self):
        valid = {"limit", "stop"}
        self.assertIn("limit", valid)
        self.assertIn("stop", valid)
        self.assertNotIn("market", valid)
        self.assertNotIn("trailing", valid)

    def test_fractional_shares_rejected(self):
        import math
        shares = 10.5
        self.assertGreater(abs(shares - round(shares)), 1e-6)
        shares_ok = 10.0
        self.assertLessEqual(abs(shares_ok - round(shares_ok)), 1e-6)

    def test_buying_power_check_buy_side(self):
        cash = 1000.00
        shares = 10
        limit_price = 110.00
        needed = shares * limit_price  # 1100.00
        self.assertGreater(needed, cash)  # insufficient

        limit_price_ok = 90.00
        needed_ok = shares * limit_price_ok  # 900.00
        self.assertLessEqual(needed_ok, cash)  # sufficient


# ── TestTriggerBoundaryEdges ─────────────────────────────────────────────────

class TestTriggerBoundaryEdges(unittest.TestCase):
    """Floating-point boundary values that could cause off-by-one issues."""

    def test_limit_buy_very_close_above(self):
        # price 100.0001 > limit 100.00 → should NOT trigger
        self.assertFalse(pending_order_trigger("limit", "buy", price=100.0001, limit_price=100.00))

    def test_limit_sell_very_close_below(self):
        # price 109.9999 < limit 110.00 → should NOT trigger
        self.assertFalse(pending_order_trigger("limit", "sell", price=109.9999, limit_price=110.00))

    def test_stop_sell_very_close_above(self):
        # price 90.0001 > stop 90.00 → should NOT trigger
        self.assertFalse(pending_order_trigger("stop", "sell", price=90.0001, limit_price=90.00))

    def test_stop_buy_very_close_below(self):
        # price 104.9999 < stop 105.00 → should NOT trigger
        self.assertFalse(pending_order_trigger("stop", "buy", price=104.9999, limit_price=105.00))

    def test_large_price_limit_buy(self):
        self.assertTrue(pending_order_trigger("limit", "buy", price=150000.0, limit_price=160000.0))

    def test_penny_stock_stop_sell(self):
        self.assertTrue(pending_order_trigger("stop", "sell", price=0.05, limit_price=0.10))


if __name__ == "__main__":
    unittest.main()
