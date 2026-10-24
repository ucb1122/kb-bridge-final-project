"""Map-first presentation for the rising-market screen."""
from __future__ import annotations

import streamlit as st


def apply_rising_layout() -> None:
    st.html("""<style>
/* The page uses the same map canvas and floating panels as the team owner screen. */
[data-testid="stMainBlockContainer"]:has(.st-key-rising-canvas) {
  max-width: none; padding: 0 16px 16px;
}
[data-testid="stMainBlockContainer"]:has(.st-key-rising-canvas) > [data-testid="stVerticalBlock"] {
  gap: 0.3rem;
}
.st-key-rising-canvas {
  position: relative; height: 750px; min-height: 750px;
  overflow: hidden; border: 1px solid #eee9de;
  background: #edece7; isolation: isolate;
}
.st-key-rising-map-canvas { position: absolute; inset: 0; z-index: 0; }
.st-key-rising-map-canvas [data-testid="stVerticalBlock"] { gap: 0; }
.st-key-rising-filter-panel,
.st-key-rising-report-panel {
  position: absolute; top: 18px; bottom: 18px; z-index: 4;
  background: #fff; border: 1px solid #ece9e2; border-radius: 12px;
  box-shadow: 0 5px 25px #40302022; overflow-y: auto;
  scrollbar-width: thin; padding: 16px 18px;
}
.st-key-rising-filter-panel { left: 16px; width: min(395px, 34vw); }
.st-key-rising-report-panel { right: 16px; width: min(510px, 40vw); }
.st-key-rising-filter-panel h2 { margin: 0; color: #101624; font-size: 25px; }
.st-key-rising-filter-panel h3 { font-size: 17px; }
.st-key-rising-filter-panel [data-testid="stForm"] {
  border: 0; padding: 0; margin: 10px 0 14px;
}
.st-key-rising-filter-panel [data-testid="stVerticalBlock"] { gap: 0.55rem; }
.st-key-rising-filter-panel [data-testid="stHorizontalBlock"] { gap: 0.45rem; }
.st-key-rising-filter-panel [data-testid="stSelectbox"] label { font-size: 12px; }
.st-key-rising-filter-panel [data-testid="stButton"] button {
  justify-content: flex-start; border-radius: 6px; text-align: left;
}
.st-key-rising-filter-panel [data-testid="stButton"] button:hover { border-color:#d9a900; color:#745600; }
.st-key-rising-filter-panel [data-testid="stCaptionContainer"] { font-size: 11px; }
.st-key-rising-report-panel h3 { margin-top: 0; font-size: 21px; }
.st-key-rising-report-panel [data-testid="stMetric"] { padding: 8px; }
.st-key-rising-report-panel [data-testid="stMetricLabel"] { font-size: 11px; }
.st-key-rising-report-panel [data-testid="stMetricValue"] { font-size: 19px; }
.st-key-rising-source-badge {
  position: absolute; bottom: 16px; left: 427px; z-index: 2;
  max-width: min(560px, calc(100% - 455px));
  background: #fffefbea; border: 1px solid #ece9e2;
  border-radius: 7px; padding: 4px 10px; box-shadow: 0 2px 8px #0001;
}
.st-key-rising-source-badge p { margin: 0; color: #525963; font-size: 11px; }
@media (max-width: 900px) {
  .st-key-rising-canvas { height: auto; min-height: 0; overflow: visible; display: flex; flex-direction: column; }
  .st-key-rising-map-canvas, .st-key-rising-filter-panel, .st-key-rising-report-panel,
  .st-key-rising-source-badge { position: relative; inset: auto; width: auto; max-width: none; }
  .st-key-rising-map-canvas { order: 1; }
  .st-key-rising-filter-panel { order: 2; margin: 12px; max-height: none; }
  .st-key-rising-report-panel { order: 3; margin: 0 12px 12px; max-height: none; }
  .st-key-rising-source-badge { order: 4; margin: 0 12px 12px; }
}
</style>""")
