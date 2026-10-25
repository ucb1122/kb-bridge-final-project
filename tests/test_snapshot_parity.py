"""Regression checks migrated from the test project's rankings.test.js."""
import unittest

from kb_bridge.repositories import rising_snapshot, owner_snapshot
from kb_bridge.services.rising_analysis import footfall_per_ha, sales_per_store_month


@unittest.skipUnless(rising_snapshot.available(), "Local test snapshot is absent")
class RisingSnapshotParityTests(unittest.TestCase):
    def test_official_gangnam_order(self):
        result = rising_snapshot.rankings(kind="dong", metric="stores", quarter="20262", district="강남구")
        self.assertEqual(result["ranking_source"], "official")
        self.assertEqual([r["code"] for r in result["rows"]], ["11680720", "11680656", "11680565", "11680700", "11680690", "11680660", "11680650", "11680630", "11680510", "11680640"])

    def test_gangdong_official_sales_and_rate(self):
        rows = rising_snapshot.rankings(kind="dong", metric="sales", quarter="20262", district="강동구")["rows"]
        row = next(x for x in rows if x["code"] == "11740600")
        self.assertEqual(row["value"], 287.9e8)
        self.assertEqual(row["change"], .034)
        self.assertEqual(row["value_source"], "official_rank")
        self.assertEqual(row["change_source"], "official_rank")
        self.assertEqual(row["rank_source"], "official")

    def test_detail_filters(self):
        high = rising_snapshot.rankings(kind="dong", metric="stores", quarter="20262", district="강남구", criterion="highest")
        food = rising_snapshot.rankings(kind="dong", metric="stores", quarter="20262", district="강남구", industry="CS1")
        self.assertEqual((high["rows"][0]["name"], high["rows"][0]["value"]), ("역삼1동", 11922))
        self.assertEqual(high["rows"][0]["value_source"], "public_raw")
        self.assertEqual(high["rows"][0]["rank_source"], "calculated")
        self.assertEqual((food["rows"][0]["name"], food["rows"][0]["value"]), ("일원본동", 53))

    def test_official_rank_scope_is_exact(self):
        base = dict(kind="dong", metric="sales", quarter="20262", district="강동구")
        self.assertEqual(rising_snapshot.rankings(**base)["ranking_source"], "official")
        for override in ({"criterion": "highest"}, {"comparison": "same"},
                         {"industry": "CS1"}, {"period": "year", "year": "2026"},
                         {"quarter": "20261"}):
            self.assertEqual(rising_snapshot.rankings(**(base | override))["ranking_source"], "calculated")

    def test_map_selector_can_open_region_outside_city_top_ten(self):
        city_top = {row["code"] for row in rising_snapshot.rankings(kind="dong", metric="stores", quarter="20262")["rows"]}
        regions = rising_snapshot.locations(kind="dong", quarter="20262")
        selected = next(row for row in regions if row["district"] == "강남구" and row["code"] not in city_top)
        self.assertIsNotNone(rising_snapshot.report(kind="dong", code=selected["code"], quarter="20262"))
        self.assertIsInstance(selected["lat"], float)
        self.assertIsInstance(selected["lng"], float)

    def test_jamsil_report_uses_verified_official_card_ranks(self):
        report = rising_snapshot.report(kind="dong", code="11710690", quarter="20262")
        self.assertEqual(report["official_report_ranks"], {
            "stores": [26, 27], "sales": [18, 27], "footfall": [17, 27],
        })
        ranks = rising_snapshot.overview_ranks(kind="dong", code="11710690",
                                              quarter="20262", district="송파구")
        self.assertEqual(ranks, {"stores": (26, 27), "sales": (18, 27), "footfall": (17, 27)})
        self.assertIsNone(rising_snapshot.report(kind="dong", code="11710690",
                                                  quarter="20262", industry="CS1")["official_report_ranks"])

    def test_overview_card_ranks_use_same_district_and_card_units(self):
        ranks = rising_snapshot.overview_ranks(kind="dong", code="11530800",
                                              quarter="20262", district="구로구")
        self.assertEqual(ranks, {"stores": (16, 16), "sales": (16, 16), "footfall": (15, 16)})

    def test_industry_card_ranks_use_industry_store_and_sales_values(self):
        ranks = rising_snapshot.overview_ranks(kind="dong", code="11530800",
                                              quarter="20262", district="구로구", industry="CS1")
        self.assertEqual(set(ranks), {"stores", "sales", "footfall"})
        self.assertEqual(ranks["footfall"], (15, 16))
        self.assertTrue(all(1 <= rank <= total <= 16 for rank, total in ranks.values()))

    def test_report_units_and_official_override(self):
        songcheon = rising_snapshot.report(kind="dong", code="11305555", quarter="20262")
        self.assertEqual(round(footfall_per_ha(songcheon)[0]), 118254)
        jamsil = rising_snapshot.report(kind="dong", code="11710690", quarter="20262")
        self.assertEqual(round(jamsil["metrics"]["sales"]["value"] / 3 / jamsil["metrics"]["stores"]["value"] / 10000), 999)
        self.assertEqual(sales_per_store_month(jamsil), (1003, "공식 보고서 확인값"))


@unittest.skipUnless(owner_snapshot.available(), "Local owner snapshot is absent")
class OwnerSnapshotParityTests(unittest.TestCase):
    def test_jamsil_beauty_market_statistics(self):
        report = owner_snapshot.market_report("3120227", "CS200028")
        self.assertEqual(report["current"]["stores"], 47)
        self.assertEqual(report["current"]["sales"], 4_594_054_328)

    def test_branch_order_and_distance(self):
        branches = owner_snapshot.nearest_branches(37.51513667, 127.1016547)
        self.assertEqual(len(branches), 3)
        self.assertLessEqual(branches[0]["meters"], branches[1]["meters"])
