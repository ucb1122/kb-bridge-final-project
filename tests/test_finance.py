import unittest
from decimal import Decimal
from kb_bridge.domain.finance import amortizing_payment, rent_stress


class FinanceScenarioTests(unittest.TestCase):
    def test_reference_rent_example(self):
        result = rent_stress(monthly_sales=1800, operating_cost=1450, current_rent=180,
                             existing_debt_payment=60, rent_increase_percent=25)
        self.assertEqual(result.current, Decimal(110))
        self.assertEqual(result.proposed_rent, Decimal(225))
        self.assertEqual(result.after_rent_change, Decimal(65))

    def test_new_loan_is_additional_monthly_burden(self):
        payment = amortizing_payment(principal=2000, annual_rate_percent=6, months=24)
        self.assertAlmostEqual(float(payment), 88.64, places=1)
        self.assertLess(Decimal(65) - payment, 0)

    def test_zero_rate_and_invalid_term(self):
        self.assertEqual(amortizing_payment(principal=1200, annual_rate_percent=0, months=12), Decimal(100))
        with self.assertRaises(ValueError):
            amortizing_payment(principal=100, annual_rate_percent=5, months=0)
