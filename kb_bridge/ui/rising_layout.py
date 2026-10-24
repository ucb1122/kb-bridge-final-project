"""Map-first presentation for the rising-market screen."""
from __future__ import annotations

import streamlit as st


def apply_rising_layout() -> None:
    st.html("""<style>
/* The page uses the same map canvas and floating panels as the team owner screen. */
[data-testid="stMainBlockContainer"]:has(.st-key-rising-canvas) {
  max-width: none; padding: 84px 16px 16px;
}
[data-testid="stMainBlockContainer"]:has(.st-key-rising-canvas) > [data-testid="stVerticalBlock"] {
  gap: 0.3rem;
}
.st-key-rising-canvas {
  position: relative; height: 820px; min-height: 820px;
  overflow: hidden; border: 1px solid #eee9de;
  background: #edece7; isolation: isolate;
}
.st-key-rising-map-canvas { position: absolute; inset: 0; z-index: 0; }
.st-key-rising-map-canvas [data-testid="stVerticalBlock"] { gap: 0; }
.st-key-rising-filter-panel,
.st-key-rising-report-panel {
  position: absolute; top: 16px; bottom: 16px; z-index: 4;
  background: #fff; border: 1px solid #ece9e2; border-radius: 15px;
  box-shadow: 0 5px 25px #40302022; overflow-y: auto;
  scrollbar-width: thin; padding: 15px 18px;
}
.st-key-rising-filter-panel { left: 16px; width: min(410px, 36vw); }
.st-key-rising-report-panel { right: 0; top: 0; bottom: 0; width: min(820px, 51vw); border-radius: 0; border-top: 5px solid #0876ce; padding: 18px 24px; }
.st-key-rising-filter-panel h2 { margin: 0; color: #0876ce; font-size: 23px; }
.st-key-rising-filter-panel h3 { font-size: 16px; margin: 0; }
.st-key-rising-filter-panel [data-testid="stForm"] {
  border: 0; padding: 0; margin: 10px 0 14px;
}
.st-key-rising-filter-panel [data-testid="stVerticalBlock"] { gap: 0.32rem; }
.st-key-rising-filter-panel [data-testid="stHorizontalBlock"] { gap: 0.25rem; }
.st-key-rising-filter-panel [data-testid="stSelectbox"] label { font-size: 12px; }
.st-key-rising-filter-panel [data-testid="stButton"] button {
  justify-content: flex-start; border-radius: 3px; text-align: left; min-height: 35px;
}
.st-key-rising-filter-panel [data-testid="stButton"] button:hover { border-color:#d9a900; color:#745600; }
.st-key-rising-filter-panel [data-testid="stCaptionContainer"] { font-size: 11px; }
.st-key-rising-report-panel h3 { margin-top: 0; font-size: 21px; }
.kb-rising-report-banner {margin:-18px -24px 14px;padding:15px 22px;background:#0876ce;color:#fff;font-size:19px;font-weight:700;}
.kb-rising-report-banner span {font-size:12px;font-weight:400;margin-left:14px;}
.st-key-rising-report-panel [data-testid="stHorizontalBlock"]:first-child { align-items: center; }
.st-key-rising-report-panel [data-testid="stSegmentedControl"] { overflow-x: auto; }
.st-key-rising-report-panel [data-testid="stSegmentedControl"] button { white-space: nowrap; }
.st-key-rising-filter-panel [data-testid="stFormSubmitButton"] button { background:#0876ce; border-color:#0876ce; color:#fff; justify-content:center; }
.st-key-rising-filter-panel [data-testid="stRadio"] label,
.st-key-rising-filter-panel [data-testid="stSelectbox"] label { margin-bottom: 0; }
.st-key-rising-filter-panel [data-testid="stVerticalBlockBorderWrapper"] { border-radius: 4px; }
.st-key-rising-filter-panel [data-testid="stCaptionContainer"] p { line-height: 1.2; }
.st-key-rising-report-panel [data-testid="stMetric"] { padding: 8px; }
.st-key-rising-report-panel [data-testid="stMetricLabel"] { font-size: 11px; }
.st-key-rising-report-panel [data-testid="stMetricValue"] { font-size: 19px; }
.st-key-rising-source-badge {
  position: absolute; bottom: 8px; left: 440px; z-index: 2;
  max-width: min(560px, calc(100% - 460px));
  background: #fffefbea; border: 1px solid #ece9e2;
  border-radius: 7px; padding: 4px 10px; box-shadow: 0 2px 8px #0001;
}
.st-key-rising-source-badge p { margin: 0; color: #525963; font-size: 11px; }
@media (max-width: 1100px) {
  .st-key-rising-canvas { height: auto; min-height: 0; overflow: visible; display: flex; flex-direction: column; }
  .st-key-rising-map-canvas, .st-key-rising-filter-panel, .st-key-rising-report-panel,
  .st-key-rising-source-badge { position: relative; inset: auto; width: auto; max-width: none; }
  .st-key-rising-map-canvas { order: 1; }
  .st-key-rising-filter-panel { order: 2; margin: 12px; max-height: none; }
  .st-key-rising-report-panel { order: 3; margin: 0 12px 12px; max-height: none; }
  .st-key-rising-source-badge { order: 4; margin: 0 12px 12px; }
}
</style>""")
