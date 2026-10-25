"""Map-first layout for the owner page."""
from __future__ import annotations

import streamlit as st


def apply_owner_layout() -> None:
    st.html("""<style>
[data-testid="stMainBlockContainer"]:has(.st-key-owner-canvas) {max-width:none;padding:8px 10px 0;}
[data-testid="stMainBlockContainer"]:has(.st-key-owner-canvas) > [data-testid="stVerticalBlock"] {gap:.3rem;}
.st-key-owner-canvas {position:fixed;top:calc(8px + 76px + 0.3rem);bottom:0;left:10px;right:10px;width:auto;height:auto;min-height:0;overflow:hidden;background:#edf0e8;isolation:isolate;}
.st-key-owner-map-canvas {position:absolute;inset:0;z-index:0;height:100%;}
.st-key-owner-map-canvas [data-testid="stVerticalBlock"] {gap:0;height:100%;}
.st-key-owner-filter-panel,.st-key-owner-report-panel {position:absolute;top:0;bottom:0;z-index:4;overflow-y:auto;scrollbar-width:thin;background:#fff;box-shadow:0 2px 12px #0002;}
.st-key-owner-filter-panel {left:0;width:clamp(380px,23vw,440px);padding:0;box-shadow:2px 0 8px #0001;}
.st-key-owner-report-panel {right:0;width:clamp(520px,36vw,720px);padding:18px 22px;border-top:5px solid #ffbf00;}
.st-key-owner-filter-panel h2 {font-size:23px;margin:0;color:#101624;}
.st-key-owner-filter-panel [data-testid="stCaptionContainer"] {color:#627188;}
.st-key-owner-filter-panel [data-testid="stSegmentedControl"] [role="radiogroup"] {display:flex;width:100%;flex-wrap:nowrap;}
.st-key-owner-filter-panel [data-testid="stSegmentedControl"] button {flex:1 1 0;min-width:0;white-space:nowrap;}
.st-key-owner-filter-panel [data-testid="stButtonGroup"] button[data-selected] {background:#ffbf00!important;color:#101624!important;}
.st-key-owner-filter-panel [data-testid="stSelectbox"] label,.st-key-owner-filter-panel [data-testid="stTextInput"] label {font-size:13px;color:#26364c;}
.st-key-owner-report-panel h3 {font-size:22px;margin:0;}
.st-key-owner-report-panel [data-testid="stSegmentedControl"] button[aria-checked="true"] {background:#ffbf00;color:#101624;}
.st-key-owner-report-panel [data-testid="stMetric"] {border-color:#e4e5e7;}
.st-key-owner-left-toggle,.st-key-owner-right-toggle {position:absolute;top:20px;z-index:10001;transform:none;width:42px!important;max-width:42px;pointer-events:none;}
.st-key-owner-left-toggle {left:clamp(380px,23vw,440px);}
.st-key-owner-right-toggle {right:clamp(520px,36vw,720px);}
.st-key-owner-canvas:has(.kb-owner-left-collapsed) .st-key-owner-filter-panel {transform:translateX(-100%);}
.st-key-owner-canvas:has(.kb-owner-right-collapsed) .st-key-owner-report-panel {transform:translateX(100%);}
.st-key-owner-canvas:has(.kb-owner-left-collapsed) .st-key-owner-left-toggle {left:0;}
.st-key-owner-canvas:has(.kb-owner-right-collapsed) .st-key-owner-right-toggle {right:0;}
.st-key-owner-left-toggle button,.st-key-owner-right-toggle button {pointer-events:auto;min-width:42px;height:42px;padding:0;border:1px solid #e2d6aa;background:#fff;color:#8a6400;font-size:24px;border-radius:0 6px 6px 0;box-shadow:0 2px 8px #0002;}
.st-key-owner-right-toggle button {border-radius:6px 0 0 6px;}
.st-key-owner-filter-panel,.st-key-owner-report-panel {transition:transform .25s ease;}
@media(max-width:1350px) {
  .st-key-owner-canvas {position:relative;inset:auto;width:auto;height:auto;min-height:0;overflow:visible;display:flex;flex-direction:column;}
  .st-key-owner-map-canvas,.st-key-owner-filter-panel,.st-key-owner-report-panel {position:relative;inset:auto;width:auto;max-width:none;}
  .st-key-owner-map-canvas {order:1;min-height:650px;}
  .st-key-owner-filter-panel {order:2;margin:12px;max-height:70dvh;}
  .st-key-owner-report-panel {order:3;margin:0 12px 12px;max-height:75dvh;}
  .st-key-owner-left-toggle,.st-key-owner-right-toggle {position:relative;top:auto;left:auto;right:auto;order:2;margin:0 12px;}
  .st-key-owner-canvas:has(.kb-owner-left-collapsed) .st-key-owner-filter-panel,.st-key-owner-canvas:has(.kb-owner-right-collapsed) .st-key-owner-report-panel {display:none;}
}
.st-key-owner-filter-panel > [data-testid="stVerticalBlock"],.st-key-owner-rank-card > [data-testid="stVerticalBlock"] {gap:0;}
.st-key-owner-controls-card,.st-key-owner-rank-card {padding:16px 12px;background:#fff;border:0;border-bottom:6px solid #f2f4f5;border-radius:0;box-shadow:none;}
.st-key-owner-filter-panel [data-testid="stVerticalBlock"] {gap:.32rem;}
.st-key-owner-filter-panel [data-testid="stHorizontalBlock"] {gap:.25rem;}
.st-key-owner-filter-panel [data-testid="stCaptionContainer"] {font-size:11px;}
.st-key-owner-filter-panel [data-testid="stSelectbox"] label,.st-key-owner-filter-panel [data-testid="stTextInput"] label {font-size:12px;color:#101624;}
.st-key-owner-controls-card [data-testid="stButtonGroup"] [role="radiogroup"] {display:flex;flex-wrap:nowrap;gap:6px!important;width:100%;padding:0;border:0!important;background:transparent!important;box-shadow:none!important;}
.st-key-owner-controls-card [data-testid="stButtonGroup"] button {flex:1 1 0;min-width:0;min-height:48px;padding:5px 3px;margin:0!important;border:0!important;border-radius:12px!important;background:#f1f2f5!important;color:#101624!important;font-size:12px;font-weight:800!important;line-height:1.2;white-space:normal;box-shadow:none!important;}
.st-key-owner-controls-card [data-testid="stButtonGroup"] button p {color:inherit!important;font-weight:800!important;}
.st-key-owner-controls-card [data-testid="stButtonGroup"] button[data-selected] {background:#ffbf00!important;color:#101624!important;}
.st-key-owner-controls-card [data-testid="stButtonGroup"] button:hover {background:#ffe182!important;}
.st-key-owner-metric-control [data-testid="stHorizontalBlock"] {display:flex!important;flex-wrap:nowrap!important;gap:4px!important;width:100%;}
.st-key-owner-metric-control [data-testid="stColumn"] {flex:1 1 0!important;min-width:0!important;}
.st-key-owner-metric-control [data-testid="stButton"] button {width:100%;min-width:0;min-height:54px;padding:4px 2px;border:0;border-radius:12px;background:#f1f2f5;color:#101624;text-align:center;justify-content:center;font-size:14px;font-weight:800!important;white-space:nowrap;}
.st-key-owner-metric-control [data-testid="stButton"] button[kind="primary"] {background:#ffbf00;color:#101624;}
.st-key-owner-metric-control [data-testid="stButton"] button:hover {background:#ffe182;color:#101624;}
.st-key-owner-rank-card h3 {font-size:16px;margin:0 0 8px;}
.st-key-owner-rank-card [data-testid="stButton"] button {justify-content:flex-start;border:0;border-bottom:1px solid #dedede;border-radius:0;box-shadow:none;padding:8px 2px;min-height:38px;font-size:12px;white-space:normal;text-align:left;}
.st-key-owner-rank-card [data-testid="stButton"] button:hover {color:#b57a00;background:#fff8df;}
.kb-owner-field-heading {font-size:13px;font-weight:400;margin:8px 0 3px;color:#101624;}
.st-key-owner-report-panel [data-testid="stMetric"] {min-width:0;padding:8px;}
.st-key-owner-report-panel [data-testid="stMetricLabel"] {font-size:11px;}
.st-key-owner-report-panel [data-testid="stMetricValue"] {font-size:18px;line-height:1.2;}
.st-key-owner-report-panel [data-testid="stMetricDelta"] {font-size:11px;}
.st-key-owner-report-panel [data-testid="stSegmentedControl"] {width:100%;overflow-x:auto;}
.st-key-owner-report-panel [data-testid="stSegmentedControl"] button {flex:1 1 0;min-width:0;min-height:48px;padding:5px 3px;margin:0!important;border:0!important;border-radius:12px!important;background:#f1f2f5!important;color:#101624!important;font-size:12px;font-weight:800!important;line-height:1.2;white-space:normal;box-shadow:none!important;}
.st-key-owner-report-panel [data-testid="stSegmentedControl"] button p {font-size:12px;font-weight:800!important;color:#101624!important;line-height:1.2;white-space:normal!important;}
.st-key-owner-report-panel [data-testid="stSegmentedControl"] button[aria-checked="true"],.st-key-owner-report-panel [data-testid="stSegmentedControl"] button[data-selected] {background:#ffbf00!important;color:#101624!important;}</style>""")
