"""Measure-definition regressions for rising market overview and exports."""
import unittest

from kb_bridge.repositories import rising_snapshot
from kb_bridge.services.rising_analysis import (
    monthly_sales_from_totals, overview_cards, overview_lines, ranking_change_label, sales_per_store_month,
)


class PureMeasureTests(unittest.TestCase):
    def test_monthly_sales_uses_matching_quarter_totals_and_valid_denominator(self):
        self.assertEqual(monthly_sales_from_totals(300_000_000, 10), 1000)
        self.assertIsNone(monthly_sales_from_totals(300_000_000, 0))
        self.assertIsNone(monthly_sales_from_totals(None, 10))

    def test_absolute_rank_uses_metric_units_and_missing_remains_missing(self):
        self.assertEqual(ranking_change_label("stores", {"delta": 12, "change": .06}, "absolute"), "+12개")
        self.assertEqual(ranking_change_label("stores", {"delta": -3, "change": -.02}, "absolute"), "−3개")
        self.assertEqual(ranking_change_label("stores", {"delta": None, "change": None}, "absolute"), "비교 자료 없음")
        self.assertEqual(ranking_change_label("stores", {"delta": 12, "change": .06}, "growth"), "+6.0%")

    def test_missing_open_close_counts_are_not_reported_as_zero(self):
        report = {
            "quarter": "20262",
            "metrics": {"stores": {"value": 10, "change": None}},
            "details": {"20262": {"stores": {"opened": None, "closed": 2}}},
        }
        lines = overview_lines(report)
        self.assertEqual(len(lines), 1)
        self.assertNotIn("개업 점포", lines[0])
    def test_each_comparison_uses_its_own_quarter_store_count(self):
        report = {
            "quarter": "20262", "metrics": {
                "stores": {"value": 10}, "sales": {"value": 300_000_000},
                "footfall": {"value": 900},
            },
            "history": [
                {"quarter": "20261", "metric": "stores", "value": 5},
                {"quarter": "20261", "metric": "sales", "value": 180_000_000},
                {"quarter": "20252", "metric": "stores", "value": 20},
                {"quarter": "20252", "metric": "sales", "value": 450_000_000},
            ],
            "area_m2": None, "official_report_sales": None,
        }
        cards = {card["key"]: card for card in overview_cards(report)}
        self.assertEqual(cards["sales"]["current"], 1000)
        self.assertEqual(cards["sales"]["previous_delta"], -200)
        self.assertEqual(cards["sales"]["year_delta"], 250)
        self.assertEqual(cards["sales"]["source"], "공개 원본 계산값")
        self.assertEqual(cards["footfall"]["title"], "유동인구 (분기 총량)")


@unittest.skipUnless(rising_snapshot.available(), "Local test snapshot is absent")
class SnapshotMeasureTests(unittest.TestCase):
    def test_jamsil_verified_report_sales_is_distinct_from_raw_monthly(self):
        report = rising_snapshot.report(kind="dong", code="11710690", quarter="20262")
        cards = {card["key"]: card for card in overview_cards(report)}
        self.assertEqual(cards["stores"]["current"], 441)
        self.assertEqual(cards["stores"]["previous_delta"], 32)
        self.assertEqual(cards["stores"]["year_delta"], 67)
        self.assertEqual(cards["sales"]["current"], 1003)
        self.assertEqual(cards["sales"]["previous_delta"], -60)
        self.assertEqual(cards["sales"]["year_delta"], -184)
        self.assertEqual(cards["sales"]["source"], "공식 보고서 확인값")

    def test_ilwon_verified_monthly_and_density_keep_raw_total_separate(self):
        report = rising_snapshot.report(kind="dong", code="11680720", quarter="20262")
        cards = {card["key"]: card for card in overview_cards(report)}
        self.assertEqual(cards["stores"]["current"], 462)
        self.assertEqual(cards["stores"]["previous_delta"], 4)
        self.assertEqual(cards["stores"]["year_delta"], 3)
        self.assertEqual(cards["sales"]["current"], 868)
        self.assertEqual(cards["sales"]["source"], "공식 보고서 확인값")
        self.assertEqual(round(cards["footfall"]["current"]), 10434)
        self.assertIsNone(cards["footfall"]["previous_delta"])
        self.assertIsNone(cards["footfall"]["year_delta"])

    def test_industry_report_matches_ranking_scope_without_official_override(self):
        rows = rising_snapshot.rankings(kind="dong", metric="stores", quarter="20262",
                                       district="강남구", industry="CS1")["rows"]
        ranked = next(row for row in rows if row["code"] == "11680720")
        report = rising_snapshot.report(kind="dong", code="11680720", quarter="20262", industry="CS1")
        self.assertEqual(report["industry"], "CS1")
        self.assertEqual(report["metrics"]["stores"]["value"], ranked["value"])
        self.assertIsNone(report["official_report_sales"])
        self.assertEqual(sales_per_store_month(report)[1], "공개 원본 계산값")
        all_report = rising_snapshot.report(kind="dong", code="11680720", quarter="20262")
        self.assertNotEqual(report["metrics"]["sales"]["value"], all_report["metrics"]["sales"]["value"])

    def test_official_rank_sales_does_not_replace_unverified_report_monthly(self):
        report = rising_snapshot.report(kind="dong", code="11740600", quarter="20262")
        self.assertIsNone(report["official_report_sales"])
        raw = monthly_sales_from_totals(
            report["metrics"]["sales"]["value"], report["metrics"]["stores"]["value"]
        )
        self.assertEqual(sales_per_store_month(report), (raw, "공개 원본 계산값"))
