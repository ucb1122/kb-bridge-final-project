"""Small, explicit scenario calculations; no eligibility or approval decisions."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class CashFlowScenario:
    current: Decimal
    after_rent_change: Decimal
    proposed_rent: Decimal


def _amount(value: int | float | str | Decimal) -> Decimal:
    number = Decimal(str(value))
    if not number.is_finite() or number < 0:
        raise ValueError("금액은 0 이상의 유한한 값이어야 합니다.")
    return number


def rent_stress(*, monthly_sales: int | float | Decimal, operating_cost: int | float | Decimal,
                current_rent: int | float | Decimal, existing_debt_payment: int | float | Decimal,
                rent_increase_percent: int | float | Decimal) -> CashFlowScenario:
    sales, cost, rent, debt, increase = map(_amount, (monthly_sales, operating_cost, current_rent,
                                                      existing_debt_payment, rent_increase_percent))
    new_rent = rent * (1 + increase / 100)
    return CashFlowScenario(current=sales - cost - rent - debt,
                            after_rent_change=sales - cost - new_rent - debt,
                            proposed_rent=new_rent)


def amortizing_payment(*, principal: int | float | Decimal, annual_rate_percent: int | float | Decimal,
                       months: int) -> Decimal:
    amount = _amount(principal)
    rate = _amount(annual_rate_percent) / 1200
    if months <= 0:
        raise ValueError("상환 개월 수는 1 이상이어야 합니다.")
    if rate == 0:
        return amount / months
    factor = (1 + rate) ** months
    return amount * rate * factor / (factor - 1)
