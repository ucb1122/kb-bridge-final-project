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

    def test_stale_map_module_is_reloaded_before_page_render(self):
        from kb_bridge.ui import kakao_rank_map

        def previous_show_map(*, key, rows, boundaries, selected, source, district,
                              fallback_districts=None):
            return None

        with patch.object(kakao_rank_map, "show_map", previous_show_map):
            app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
        self.assertFalse(app.exception)
        self.assertTrue(any(button.key and button.key.startswith("rank-") for button in app.button))

    def test_quick_metric_refreshes_rankings_without_apply(self):
        with patch("kb_bridge.ui.kakao_rank_map._MAP", return_value=SimpleNamespace(selected=None)) as map_component:
            app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
            stores = next(button.label for button in app.button if button.key and button.key.startswith("rank-"))
            store_badges = [row["display"] for row in map_component.call_args.kwargs["data"]["rows"]]
            app.button(key="rising-metric-sales").click().run()
            self.assertEqual(app.session_state["rising_filters"]["metric"], "sales")
            sales = next(button.label for button in app.button if button.key and button.key.startswith("rank-"))
            sales_badges = [row["display"] for row in map_component.call_args.kwargs["data"]["rows"]]
            self.assertNotEqual(stores, sales)
            self.assertNotEqual(store_badges, sales_badges)
            self.assertEqual(len(map_component.call_args.kwargs["data"]["fallback_districts"]), 1)
            self.assertFalse(app.exception)

    def test_center_selector_syncs_district_region_and_collapse(self):
        app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
        district = next(widget for widget in app.selectbox if widget.label == "지도 자치구")
        district.set_value("강남구").run()
        self.assertEqual(app.session_state["rising_filters"]["district"], "강남구")
        self.assertEqual(next(widget for widget in app.selectbox if widget.label == "자치구").value, "강남구")
        region = next(widget for widget in app.selectbox if widget.label == "지도 지역")
        region.set_value(region.options[1]).run()
        self.assertTrue(app.session_state["rising_selected"])
        self.assertEqual(app.session_state["rising_selected"], app.session_state["rising_map_region"])
        app.button(key="rising-city-reset").click().run()
        self.assertEqual(app.session_state["rising_filters"]["district"], "")
        self.assertIsNone(app.session_state["rising_selected"])
        app.button(key="rising-selector-toggle").click().run()
        self.assertFalse(app.session_state["rising_selector_open"])
        app.button(key="rising-selector-toggle").click().run()
        self.assertTrue(app.session_state["rising_selector_open"])
        self.assertFalse(app.exception)

    def test_stale_ollama_function_is_reloaded_before_report(self):
        from kb_bridge.integrations import ollama_opinion

        def old_generate_opinion(report):
            return {"mode": "fallback", "lines": [], "note": "old"}

        def reload_opinion(module):
            if module is ollama_opinion:
                module.generate_opinion = lambda report, focus_metric=None: {
                    "mode": "ai", "lines": ["확인된 분석"] * 4, "note": "테스트 응답"
                }
            return module

        with patch.object(ollama_opinion, "generate_opinion", old_generate_opinion), \
             patch("importlib.reload", side_effect=reload_opinion) as reloaded:
            app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
            next(button for button in app.button if button.key and button.key.startswith("rank-")).click().run()
        self.assertTrue(reloaded.called)
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
        self.assertTrue(any(widget.label == "보고서 항목" for widget in app.get("segmented_control")))
        refresh_key = next(button.key for button in app.button
                           if button.key and button.key.startswith("refresh-opinion-"))
        opinion_key = refresh_key.removeprefix("refresh-")
        future_key = f"{opinion_key}-future"
        if future_key in app.session_state:
            app.session_state[future_key].result(timeout=5)
        app.run()
        app.button(key=refresh_key).click().run()
        self.assertEqual(self.ai_mock.call_count, 2)
        self.assertFalse(app.exception)

    def test_selected_region_opens_overview_then_allows_other_sections(self):
        for metric, section in (("stores", "업종분석"), ("sales", "매출분석"),
                                ("footfall", "인구분석"), ("residents", "인구분석")):
            with self.subTest(metric=metric):
                app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
                if metric != "stores":
                    app.button(key=f"rising-metric-{metric}").click().run()
                first_rank = next(button for button in app.button
                                  if button.key and button.key.startswith("rank-"))
                first_rank.click().run()
                selected_tabs = [widget.value for widget in app.get("segmented_control")
                                 if widget.label == "보고서 항목"]
                self.assertEqual(selected_tabs, ["종합의견"])
                next(widget for widget in app.get("segmented_control")
                     if widget.label == "보고서 항목").set_value(section).run()
                self.assertEqual(next(widget.value for widget in app.get("segmented_control")
                                      if widget.label == "보고서 항목"), section)
                if metric == "stores":
                    second_rank = next(button for button in app.button
                                       if button.key and button.key.startswith("rank-")
                                       and button.key != first_rank.key)
                    second_rank.click().run()
                    self.assertEqual(next(widget.value for widget in app.get("segmented_control")
                                          if widget.label == "보고서 항목"), "종합의견")
                self.assertFalse(app.exception)

    def test_left_panel_collapse_and_selected_district_outline(self):
        with patch("kb_bridge.ui.kakao_rank_map._MAP", return_value=SimpleNamespace(selected=None)) as map_component:
            app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
            city_line = map_component.call_args.kwargs["data"]["fallback_districts"]
            self.assertEqual(len(city_line), 1)
            self.assertEqual(city_line[0]["geometry"]["type"], "MultiLineString")
            self.assertTrue(city_line[0]["geometry"]["coordinates"])
            app.button(key="rising-left-collapse").click().run()
            self.assertFalse(app.session_state["rising_left_open"])
            app.button(key="rising-left-collapse").click().run()
            self.assertTrue(app.session_state["rising_left_open"])
            next(widget for widget in app.selectbox if widget.label == "자치구").set_value("강북구").run()
            district_line = map_component.call_args.kwargs["data"]["fallback_districts"]
            self.assertEqual(len(district_line), 1)
            self.assertEqual(district_line[0]["properties"]["district"], "강북구")
            self.assertFalse(app.exception)

    def test_report_collapses_without_clearing_selection(self):
        app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
        next(button for button in app.button if button.key and button.key.startswith("rank-")).click().run()
        selected = app.session_state["rising_selected"]
        app.button(key="rising-right-collapse").click().run()
        self.assertFalse(app.session_state["rising_right_open"])
        self.assertEqual(app.session_state["rising_selected"], selected)
        app.button(key="rising-right-collapse").click().run()
        self.assertTrue(app.session_state["rising_right_open"])
        self.assertFalse(app.exception)


@unittest.skipUnless(owner_snapshot.available(), "Local owner snapshot is absent")
class OwnerPageInteractionTests(unittest.TestCase):
    def setUp(self):
        map_patch = patch("kb_bridge.ui.kakao_rank_map.show_map")
        map_patch.start()
        self.addCleanup(map_patch.stop)
    def test_market_selectbox_opens_side_report(self):
        app = AppTest.from_file(str(ROOT / "app_pages" / "my_market.py"), default_timeout=30).run()
        first_code = owner_snapshot.markets()[0]["code"]
        next(widget for widget in app.selectbox if widget.label == "분석 상권").set_value(first_code).run()
        self.assertEqual(next(widget for widget in app.selectbox if widget.label == "분석 상권").value, first_code)
        self.assertTrue(any(button.key == "owner-collapse-report" for button in app.button))
        self.assertFalse(app.exception)

    def test_selection_report_collapse_and_finance_calculation(self):
        app = AppTest.from_file(str(ROOT / "app_pages" / "my_market.py"), default_timeout=30).run()
        next(widget for widget in app.get("segmented_control")
             if widget.label == "분석 대상").set_value("나도 곧 사장").run()
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
