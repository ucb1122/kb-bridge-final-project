"""Map-first presentation for the rising-market screen."""
from __future__ import annotations

import streamlit as st


def apply_rising_layout() -> None:
    st.html("""<style>
/* The page uses the same map canvas and floating panels as the team owner screen. */
[data-testid="stMainBlockContainer"]:has(.st-key-rising-canvas) {
  max-width: none; padding: 10px 16px 16px;
}
[data-testid="stMainBlockContainer"]:has(.st-key-rising-canvas) > [data-testid="stVerticalBlock"] {
  gap: 0.3rem;
}
.st-key-rising-canvas {
  position: relative; height: calc(100vh - 125px); min-height: 710px;
  overflow: hidden; background: #edece7; isolation: isolate;
}
.st-key-rising-map-canvas { position: absolute; inset: 0; z-index: 0; }
.st-key-rising-map-canvas [data-testid="stVerticalBlock"] { gap: 0; }
.st-key-rising-filter-panel,
.st-key-rising-report-panel {position:absolute;z-index:4;overflow-y:auto;scrollbar-width:thin;}
.st-key-rising-filter-panel {top:0;bottom:0;left:0;width:clamp(320px,22vw,380px);padding:0;background:#fff;border:0;box-shadow:2px 0 8px #0001;}
.st-key-rising-filter-panel > [data-testid="stVerticalBlock"] {gap:0;}
.st-key-rising-controls-card,.st-key-rising-rank-card {padding:16px 20px;background:#fff;border:0;border-bottom:6px solid #f2f4f5;border-radius:0;box-shadow:none;}
.st-key-rising-report-panel {right:0;top:0;bottom:0;width:clamp(520px,36vw,720px);padding:18px 22px;background:#fff;border:0;border-top:5px solid #FFBF00;box-shadow:-2px 0 12px #0002;}
.st-key-rising-map-selector {position:absolute;top:16px;left:60%;transform:translateX(-50%);z-index:5;width:410px;padding:6px 12px;background:#fff;box-shadow:0 2px 8px #0002;border-radius:3px;}
.st-key-rising-map-selector [data-testid="stHorizontalBlock"] {align-items:center;gap:6px;}
.st-key-rising-map-selector [data-testid="stVerticalBlock"] {gap:0;}
.st-key-rising-map-selector [data-testid="stSelectbox"] {min-width:0;}
.st-key-rising-map-selector [data-testid="stSelectbox"] [data-baseweb="select"] > div {border:0;min-height:34px;}
.kb-rising-city {white-space:nowrap;color:#D69C00;font-size:14px;font-weight:700;line-height:35px;}
.st-key-rising-canvas:has(.st-key-rising-report-panel) .st-key-rising-map-selector {left:41%;}
.st-key-rising-filter-panel h2 { margin: 0; color: #101624; font-size: 23px; }
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
.st-key-rising-filter-panel [data-testid="stButton"] button:hover { border-color:#D69C00; color:#D69C00; }
.st-key-rising-rank-card [data-testid="stButton"] button {border:0;border-bottom:1px solid #e6e6e6;border-radius:0;background:#fff;padding:6px 0;font-size:13px;font-weight:600;}
.st-key-rising-rank-card [data-testid="stCaptionContainer"] {text-align:right;color:#a27100;margin-top:-5px;}
.st-key-rising-rank-card [data-testid="stVerticalBlock"] {gap:0.2rem;}
.st-key-rising-controls-card [data-testid="stSegmentedControl"] button[aria-checked="true"] {background:#D69C00;color:#101624;}
.st-key-rising-filter-panel [data-testid="stCaptionContainer"] { font-size: 11px; }
.st-key-rising-report-panel h3 { margin-top: 0; font-size: 21px; }
.kb-rising-report-banner {margin:-18px -22px 14px;padding:15px 22px;background:#FFBF00;color:#101624;font-size:19px;font-weight:700;}
.kb-rising-report-banner span {font-size:12px;font-weight:400;margin-left:14px;}
.st-key-rising-report-panel [data-testid="stHorizontalBlock"]:first-child { align-items: center; }
.st-key-rising-report-panel [data-testid="stSegmentedControl"] { overflow-x: auto; }
.st-key-rising-report-panel [data-testid="stSegmentedControl"] button { white-space: nowrap; border:0; border-bottom:3px solid transparent; border-radius:0; background:#fff; color:#596171; }
.st-key-rising-report-panel [data-testid="stSegmentedControl"] button[aria-checked="true"] { border-bottom-color:#E5A900; color:#101624; font-weight:700; }
.st-key-rising-report-panel [data-testid="stMetric"] { border:1px solid #e9e5d9; border-radius:4px; }
.st-key-rising-report-panel [data-testid="stAlert"] { border-color:#f0dc9a; background:#fffaf0; }
.st-key-rising-filter-panel [data-testid="stSegmentedControl"] button[aria-checked="true"] {background:#FFBF00;color:#101624;}
.st-key-rising-filter-panel [data-testid="stFormSubmitButton"] button { background:#FFBF00; border-color:#FFBF00; color:#101624; justify-content:center; }
.st-key-rising-filter-panel [data-testid="stRadio"] label,
.st-key-rising-filter-panel [data-testid="stSelectbox"] label { margin-bottom: 0; }
.st-key-rising-filter-panel [data-testid="stVerticalBlockBorderWrapper"] { border-radius: 4px; }
.st-key-rising-filter-panel [data-testid="stCaptionContainer"] p { line-height: 1.2; }
.st-key-rising-report-panel [data-testid="stMetric"] { padding: 8px; }
.st-key-rising-report-panel [data-testid="stMetricLabel"] { font-size: 11px; }
.st-key-rising-report-panel [data-testid="stMetricValue"] { font-size: 19px; }
.st-key-rising-source-badge {
  position: absolute; bottom: 8px; left: 400px; z-index: 2;
  max-width: min(560px, calc(100% - 420px));
  background: #fffefbea; border: 1px solid #ece9e2;
  border-radius: 7px; padding: 4px 10px; box-shadow: 0 2px 8px #0001;
}
.st-key-rising-source-badge p { margin: 0; color: #525963; font-size: 11px; }
@media (max-width: 1100px) {
  .st-key-rising-canvas { height: auto; min-height: 0; overflow: visible; display: flex; flex-direction: column; }
  .st-key-rising-map-canvas, .st-key-rising-map-selector, .st-key-rising-filter-panel, .st-key-rising-report-panel,
  .st-key-rising-source-badge { position: relative; inset: auto; width: auto; max-width: none; }
  .st-key-rising-map-canvas { order: 1; }
  .st-key-rising-map-selector {order:2;transform:none;margin:12px;width:auto;max-width:none;}
  .st-key-rising-filter-panel { order: 3; margin: 12px; max-height: none; }
  .st-key-rising-report-panel { order: 4; margin: 0 12px 12px; max-height: none; }
  .st-key-rising-source-badge { order: 5; margin: 0 12px 12px; }
}
</style>""")
