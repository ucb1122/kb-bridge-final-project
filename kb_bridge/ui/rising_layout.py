"""Map-first presentation for the rising-market screen."""
from __future__ import annotations

import streamlit as st


def apply_rising_layout() -> None:
    st.html("""<style>
/* The page uses the same map canvas and floating panels as the team owner screen. */
[data-testid="stMainBlockContainer"]:has(.st-key-rising-canvas) {
  max-width: none; padding: 8px 10px 0;
}
[data-testid="stMainBlockContainer"]:has(.st-key-rising-canvas) > [data-testid="stVerticalBlock"] {
  gap: 0.3rem;
}
.st-key-rising-canvas {
  position: relative; height: calc(100dvh - 94px); min-height: 650px;
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
.st-key-rising-map-selector {position:absolute;top:16px;left:60%;transform:translateX(-50%);z-index:5;width:470px;padding:6px 12px;background:#fff;box-shadow:0 2px 8px #0002;border-radius:3px;}
.st-key-rising-map-selector [data-testid="stHorizontalBlock"] {align-items:center;gap:6px;}
.st-key-rising-map-selector [data-testid="stVerticalBlock"] {gap:0;}
.st-key-rising-map-selector [data-testid="stSelectbox"] {min-width:0;}
.st-key-rising-map-selector [data-testid="stSelectbox"] [data-baseweb="select"] > div {border:0;min-height:34px;}
.kb-rising-city {white-space:nowrap;color:#D69C00;font-size:14px;font-weight:700;line-height:35px;}
.st-key-rising-canvas:has(.st-key-rising-report-panel) .st-key-rising-map-selector {left:41%;}
.st-key-rising-canvas:has(.kb-right-collapsed-flag) .st-key-rising-map-selector {left:60%;}
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
.st-key-rising-rank-card > [data-testid="stVerticalBlock"] {gap:0;}
.st-key-rising-rank-card [data-testid="stCaptionContainer"] {text-align:right;color:#a27100;}
[class*="st-key-rising-rank-row-"] {border-bottom:1px solid #dedede;min-height:38px;}
[class*="st-key-rising-rank-row-"] [data-testid="stHorizontalBlock"] {align-items:center;gap:4px;}
[class*="st-key-rising-rank-row-"] [data-testid="stVerticalBlock"] {gap:0;}
.st-key-rising-rank-card [class*="st-key-rising-rank-row-"] [data-testid="stButton"] button {
  display:block;width:100%;min-height:37px;padding:0 2px;border:0;border-radius:0;
  background:transparent;color:#172033;text-align:left;font-size:12px;font-weight:500;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.st-key-rising-rank-card [class*="st-key-rising-rank-row-"] [data-testid="stButton"] button:hover {color:#b57a00;background:#fff8df;}
.kb-rank-number {display:block;text-align:left;font-size:12px;color:#172033;}
.kb-rank-value {display:block;text-align:right;white-space:nowrap;font-size:12px;color:#101624;}
.kb-rank-change {display:block;text-align:right;white-space:nowrap;font-size:11px;color:#e23570;}
.st-key-rising-controls-card [data-testid="stSegmentedControl"] [role="radiogroup"] {display:flex;flex-wrap:nowrap;width:100%;}
.st-key-rising-controls-card [data-testid="stSegmentedControl"] button {flex:1 1 0;min-width:0;white-space:nowrap;padding:5px 2px;font-size:11px;}
.st-key-rising-controls-card [data-testid="stSegmentedControl"] button[aria-checked="true"] {background:#FFBF00;color:#101624;}
.st-key-rising-metric-control [data-testid="stSegmentedControl"] [role="radiogroup"] {display:flex;flex-wrap:nowrap;width:100%;}
.st-key-rising-metric-control [data-testid="stSegmentedControl"] button {
  flex:1 1 0;min-width:0;min-height:66px;white-space:nowrap;
  display:flex;flex-direction:column;gap:2px;justify-content:center;font-size:11px;padding:3px 0;
}
.st-key-rising-metric-control [data-testid="stSegmentedControl"] button:nth-child(1)::before {content:"▣";}
.st-key-rising-metric-control [data-testid="stSegmentedControl"] button:nth-child(2)::before {content:"▤";}
.st-key-rising-metric-control [data-testid="stSegmentedControl"] button:nth-child(3)::before {content:"♧";}
.st-key-rising-metric-control [data-testid="stSegmentedControl"] button:nth-child(4)::before {content:"⌂";}
.st-key-rising-metric-control [data-testid="stSegmentedControl"] button::before {display:block;font-size:20px;line-height:22px;}
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
.st-key-rising-filter-panel,.st-key-rising-report-panel {transition:transform .25s ease;}
.st-key-rising-canvas:has(.kb-left-collapsed-flag) .st-key-rising-filter-panel {transform:translateX(-100%);}
.st-key-rising-canvas:has(.kb-right-collapsed-flag) .st-key-rising-report-panel {transform:translateX(100%);}
.st-key-rising-left-toggle,.st-key-rising-right-toggle {position:absolute;top:20px;z-index:7;transform:none;}
.st-key-rising-left-toggle {left:clamp(320px,22vw,380px);}
.st-key-rising-right-toggle {right:clamp(520px,36vw,720px);}
.st-key-rising-canvas:has(.kb-left-collapsed-flag) .st-key-rising-left-toggle {left:0;}
.st-key-rising-canvas:has(.kb-right-collapsed-flag) .st-key-rising-right-toggle {right:0;}
.st-key-rising-left-toggle button,.st-key-rising-right-toggle button {min-width:32px;height:42px;padding:0;border:1px solid #e2d6aa;background:#fff;color:#8a6400;font-size:24px;border-radius:0 6px 6px 0;box-shadow:0 2px 8px #0002;}
.st-key-rising-right-toggle button {border-radius:6px 0 0 6px;}
.st-key-rising-map-selector:has(.kb-selector-collapsed-flag) {width:135px;padding:5px;}
.st-key-rising-map-selector [data-testid="stButton"] button {min-height:36px;width:100%;padding:0 4px;border:0;border-left:1px solid #e8e2d7;border-radius:0;justify-content:center;background:#fff;color:#8a6400;font-size:11px;white-space:nowrap;}
.st-key-rising-map-selector [data-testid="stButton"] button:hover {background:#fff8df;color:#614900;}
.st-key-rising-map-selector:has(.kb-selector-collapsed-flag) [data-testid="stButton"] button {border-left:0;}
@media (max-width: 1100px) {
  .st-key-rising-canvas { height: auto; min-height: 0; overflow: visible; display: flex; flex-direction: column; }
  .st-key-rising-map-canvas, .st-key-rising-map-selector, .st-key-rising-filter-panel, .st-key-rising-report-panel {position:relative;inset:auto;width:auto;max-width:none;}
  .st-key-rising-map-canvas { order: 1; }
  .st-key-rising-map-selector {order:2;transform:none;margin:12px;width:auto;max-width:none;}
  .st-key-rising-left-toggle,.st-key-rising-right-toggle {position:relative;top:auto;left:auto;right:auto;transform:none;margin:0 12px;order:3;}
  .st-key-rising-canvas:has(.kb-left-collapsed-flag) .st-key-rising-filter-panel,.st-key-rising-canvas:has(.kb-right-collapsed-flag) .st-key-rising-report-panel {display:none;}
  .st-key-rising-filter-panel { order: 3; margin: 12px; max-height: none; }
  .st-key-rising-report-panel { order: 4; margin: 0 12px 12px; max-height: none; }
}
</style>""")
