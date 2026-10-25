"""Interaction regressions for the two map-first Streamlit pages."""
from __future__ import annotations

import unittest
from unittest.mock import patch
from types import SimpleNamespace
from pathlib import Path

from streamlit.testing.v1 import AppTest

from kb_bridge.repositories import owner_snapshot, rising_snapshot

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(rising_snapshot.available(), "Local rising snapshot is absent")
class RisingPageInteractionTests(unittest.TestCase):
    def setUp(self):
        self.ai = patch("kb_bridge.integrations.ollama_opinion.generate_opinion",
                        return_value={"mode": "ai", "lines": ["지역 수치를 읽고 분석했습니다."] * 4,
                                      "note": "테스트 응답"})
        self.ai_mock = self.ai.start()
        self.addCleanup(self.ai.stop)

    def test_quick_metric_refreshes_rankings_without_apply(self):
        with patch("kb_bridge.ui.kakao_rank_map._MAP", return_value=SimpleNamespace(selected=None)) as map_component:
            app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
            stores = next(button.label for button in app.button if button.key and button.key.startswith("rank-"))
            store_badges = [row["display"] for row in map_component.call_args.kwargs["data"]["rows"]]
            next(widget for widget in app.get("segmented_control")
                 if widget.label == "분석 지표").set_value("sales").run()
            self.assertEqual(app.session_state["rising_filters"]["metric"], "sales")
            sales = next(button.label for button in app.button if button.key and button.key.startswith("rank-"))
            sales_badges = [row["display"] for row in map_component.call_args.kwargs["data"]["rows"]]
            self.assertNotEqual(stores, sales)
            self.assertNotEqual(store_badges, sales_badges)
            self.assertEqual(len(map_component.call_args.kwargs["data"]["fallback_districts"]), 25)
            self.assertFalse(app.exception)

    def test_center_selector_syncs_district_region_and_collapse(self):
        app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
        next(widget for widget in app.selectbox if widget.label == "지도 자치구").set_value("강남구").run()
        self.assertEqual(app.session_state["rising_filters"]["district"], "강남구")
        self.assertEqual(next(widget for widget in app.selectbox if widget.label == "자치구").value, "강남구")
        region = next(widget for widget in app.selectbox if widget.label == "지도 지역")
        region.set_value(region.options[1]).run()
        self.assertEqual(app.session_state["rising_selected"], next(widget for widget in app.selectbox if widget.label == "지도 지역").value)
        app.button(key="rising-selector-toggle").click().run()
        self.assertFalse(app.session_state["rising_selector_open"])
        app.button(key="rising-selector-toggle").click().run()
        self.assertTrue(app.session_state["rising_selector_open"])
        self.assertFalse(app.exception)

    def test_detail_filters_and_boundary_toggle(self):
        with patch("kb_bridge.ui.kakao_rank_map._MAP", return_value=SimpleNamespace(selected=None)) as map_component:
            app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
            next(widget for widget in app.get("checkbox")
                 if widget.label == "지도에 전체 지역 표시").check().run()
            self.assertTrue(app.session_state["rising_show_all_boundaries"])
            self.assertGreater(len(map_component.call_args.kwargs["data"]["all_locations"]), 400)
            next(widget for widget in app.get("segmented_control")
                 if widget.label == "기준조건").set_value("highest")
            next(button for button in app.form_submit_button if button.label == "적용").click().run()
            self.assertEqual(app.session_state["rising_filters"]["criterion"], "highest")
            self.assertFalse(app.exception)

    def test_ai_uses_selected_report_and_refreshes(self):
        app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
        next(button for button in app.button if button.key and button.key.startswith("rank-")).click().run()
        self.assertEqual(self.ai_mock.call_count, 1)
        self.assertEqual(self.ai_mock.call_args.args[0]["code"], app.session_state["rising_selected"])
        next(button for button in app.button if button.key and button.key.startswith("refresh-opinion-")).click().run()
        self.assertEqual(self.ai_mock.call_count, 2)
        self.assertFalse(app.exception)

    def test_selected_metric_opens_matching_report_section(self):
        for metric, section in (("stores", "업종분석"), ("sales", "매출분석"),
                                ("footfall", "인구분석"), ("residents", "인구분석")):
            with self.subTest(metric=metric):
                app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
                next(widget for widget in app.get("segmented_control")
                     if widget.label == "분석 지표").set_value(metric).run()
                first_rank = next(button for button in app.button
                                  if button.key and button.key.startswith("rank-"))
                first_rank.click().run()
                selected_tabs = [widget.value for widget in app.get("segmented_control")
                                 if widget.label == "보고서 항목"]
                self.assertEqual(selected_tabs, [section])
                self.assertFalse(app.exception)

    def test_report_collapses_without_clearing_selection(self):
        app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
        next(button for button in app.button if button.key and button.key.startswith("rank-")).click().run()
        selected = app.session_state["rising_selected"]
        app.button(key="rising-collapse-report").click().run()
        self.assertFalse(app.session_state["rising_right_open"])
        self.assertEqual(app.session_state["rising_selected"], selected)
        self.assertFalse(app.exception)


@unittest.skipUnless(owner_snapshot.available(), "Local owner snapshot is absent")
class OwnerPageInteractionTests(unittest.TestCase):
    def test_market_selectbox_opens_side_report(self):
        app = AppTest.from_file(str(ROOT / "app_pages" / "my_market.py"), default_timeout=30).run()
        first_code = owner_snapshot.markets()[0]["code"]
        app.selectbox[2].set_value(first_code).run()
        self.assertEqual(app.selectbox[2].value, first_code)
        self.assertTrue(any(button.key == "owner-collapse-report" for button in app.button))
        self.assertFalse(app.exception)

    def test_selection_report_collapse_and_finance_calculation(self):
        app = AppTest.from_file(str(ROOT / "app_pages" / "my_market.py"), default_timeout=30).run()
        next(button for button in app.button
             if button.key and button.key.startswith("owner-rank-")).click().run()
        self.assertFalse(app.exception)
        app.button(key="owner-collapse-report").click().run()
        self.assertFalse(app.session_state["owner_right_open"])
        app.button(key="owner-right-collapse").click().run()
        self.assertTrue(app.session_state["owner_right_open"])
        next(widget for widget in app.get("segmented_control")
             if widget.label == "분석 항목").set_value("금융상담 준비").run()
        app.form_submit_button[0].click().run()
        self.assertFalse(app.exception)
