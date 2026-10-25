"""Owner flow data contracts derived from the teammate snapshot."""
from __future__ import annotations

import unittest

from kb_bridge.repositories import owner_snapshot


@unittest.skipUnless(owner_snapshot.available(), "Local owner snapshot is absent")
class OwnerFlowDataTests(unittest.TestCase):
    def test_unmapped_licence_never_becomes_all_industries(self):
        code = owner_snapshot.markets()[0]["code"]
        report = owner_snapshot.market_report(code, "unmapped")
        self.assertIsNone(report["current"]["stores"])
        self.assertIsNone(report["current"]["sales"])
        self.assertEqual(owner_snapshot.official_scope_for_group({"id": "unlisted"}), "unmapped")

    def test_known_food_group_uses_explicit_crosswalk(self):
        self.assertEqual(owner_snapshot.official_scope_for_group({"id": "korean"}), "CS100001")

    def test_report_preserves_sales_coverage_and_population_scope(self):
        data = owner_snapshot.regional()
        area = next(iter(data["areas"].values()))
        period = area["periods"][data["quarter"]]
        prior = area["periods"][data["previous"]]
        report = owner_snapshot.market_report(area["code"])
        self.assertEqual(report["current"]["sales_codes"],
                         sum(row.get("sales") is not None for row in period["industries"].values()))
        self.assertEqual(report["current"]["store_codes"],
                         sum(row.get("stores") is not None for row in period["industries"].values()))
        self.assertEqual(report["population_prior"]["floating"], prior.get("floating"))
        self.assertEqual(report["floating"], period.get("floating"))
        self.assertEqual(len(report["industry_breakdown"]), len(period["industries"]))
    def test_founder_ranking_uses_comparable_growth(self):
        ranking = owner_snapshot.growth_rankings(industry_scope="food", metric="stores")
        self.assertTrue(ranking)
        for row in ranking[:20]:
            self.assertGreater(row["previous"], 0)
            self.assertAlmostEqual(row["change"],
                                   (row["value"] - row["previous"]) / row["previous"] * 100)
        self.assertEqual(ranking[:20], sorted(ranking[:20],
                         key=lambda row: (-row["change"], -row["value"], row["code"])))


if __name__ == "__main__":
    unittest.main()
