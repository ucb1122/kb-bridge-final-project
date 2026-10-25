"""Interaction regressions for the two map-first Streamlit pages."""
from __future__ import annotations

import unittest
from pathlib import Path

from streamlit.testing.v1 import AppTest

from kb_bridge.repositories import owner_snapshot, rising_snapshot

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(rising_snapshot.available(), "Local rising snapshot is absent")
class RisingPageInteractionTests(unittest.TestCase):
    def test_selected_metric_opens_matching_report_section(self):
        for metric, section in (("stores", "업종분석"), ("sales", "매출분석"),
                                ("footfall", "인구분석"), ("residents", "인구분석")):
            with self.subTest(metric=metric):
                app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
                app.get("segmented_control")[1].set_value(metric)
                app.form_submit_button[1].click().run()
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
