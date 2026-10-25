"""Map-first layout for the owner page."""
from __future__ import annotations

import streamlit as st


def apply_owner_layout() -> None:
    st.html("""<style>
[data-testid="stMainBlockContainer"]:has(.st-key-owner-canvas) {max-width:none;padding:8px 10px 0;}
[data-testid="stMainBlockContainer"]:has(.st-key-owner-canvas) > [data-testid="stVerticalBlock"] {gap:0;}
.st-key-owner-canvas {position:fixed;top:calc(8px + 76px + 0.3rem);bottom:0;left:10px;right:10px;width:auto;height:auto;min-height:0;overflow:hidden;background:#edf0e8;isolation:isolate;}
.st-key-owner-map-canvas {position:absolute;inset:0;z-index:0;}
.st-key-owner-map-canvas [data-testid="stVerticalBlock"] {gap:0;}
.st-key-owner-filter-panel,.st-key-owner-report-panel {position:absolute;top:0;bottom:0;z-index:4;overflow-y:auto;scrollbar-width:thin;background:#fff;box-shadow:0 2px 12px #0002;}
.st-key-owner-filter-panel {left:0;width:clamp(380px,23vw,440px);padding:18px 16px;}
.st-key-owner-report-panel {right:0;width:clamp(520px,36vw,720px);padding:18px 22px;border-top:5px solid #ffbf00;}
.st-key-owner-filter-panel h2 {font-size:27px;margin:4px 0 8px;}
.st-key-owner-filter-panel [data-testid="stCaptionContainer"] {color:#627188;}
.st-key-owner-filter-panel [data-testid="stSegmentedControl"] [role="radiogroup"] {display:flex;width:100%;flex-wrap:nowrap;}
.st-key-owner-filter-panel [data-testid="stSegmentedControl"] button {flex:1 1 0;min-width:0;white-space:nowrap;}
.st-key-owner-filter-panel [data-testid="stSegmentedControl"] button[aria-checked="true"] {background:#ffbf00;color:#101624;font-weight:700;}
.st-key-owner-filter-panel [data-testid="stSelectbox"] label,.st-key-owner-filter-panel [data-testid="stTextInput"] label {font-size:13px;color:#26364c;}
.st-key-owner-report-panel h3 {font-size:22px;margin:0;}
.st-key-owner-report-panel [data-testid="stSegmentedControl"] button[aria-checked="true"] {background:#ffbf00;color:#101624;}
.st-key-owner-report-panel [data-testid="stMetric"] {border-color:#e4e5e7;}
.st-key-owner-left-toggle,.st-key-owner-right-toggle {position:absolute;z-index:7;top:20px;}
.st-key-owner-left-toggle {left:clamp(380px,23vw,440px);}
.st-key-owner-right-toggle {right:clamp(520px,36vw,720px);}
.st-key-owner-canvas:has(.kb-owner-left-collapsed) .st-key-owner-filter-panel {transform:translateX(-100%);}
.st-key-owner-canvas:has(.kb-owner-right-collapsed) .st-key-owner-report-panel {transform:translateX(100%);}
.st-key-owner-canvas:has(.kb-owner-left-collapsed) .st-key-owner-left-toggle {left:0;}
.st-key-owner-canvas:has(.kb-owner-right-collapsed) .st-key-owner-right-toggle {right:0;}
.st-key-owner-left-toggle button,.st-key-owner-right-toggle button {height:42px;min-width:34px;border:1px solid #e2d6aa;background:#fff;color:#8a6400;box-shadow:0 2px 8px #0002;}
.st-key-owner-filter-panel,.st-key-owner-report-panel {transition:transform .25s ease;}
.st-key-owner-canvas:not(:has(.kb-owner-right-collapsed)) .st-key-owner-right-toggle {display:none;}
.st-key-owner-report-panel .st-key-owner-collapse-report button {white-space:nowrap;font-size:12px;padding:5px 8px;}
@media(max-width:1100px) {
  .st-key-owner-canvas {position:relative;inset:auto;width:auto;height:auto;min-height:0;overflow:visible;display:flex;flex-direction:column;}
  .st-key-owner-map-canvas,.st-key-owner-filter-panel,.st-key-owner-report-panel {position:relative;inset:auto;width:auto;max-width:none;}
  .st-key-owner-map-canvas {order:1;min-height:650px;}
  .st-key-owner-filter-panel {order:2;margin:12px;max-height:70dvh;}
  .st-key-owner-report-panel {order:3;margin:0 12px 12px;max-height:75dvh;}
  .st-key-owner-left-toggle,.st-key-owner-right-toggle {position:relative;top:auto;left:auto;right:auto;order:2;margin:0 12px;}
  .st-key-owner-canvas:has(.kb-owner-left-collapsed) .st-key-owner-filter-panel,.st-key-owner-canvas:has(.kb-owner-right-collapsed) .st-key-owner-report-panel {display:none;}
}
</style>""")
