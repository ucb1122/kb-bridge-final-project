"""Shared KB Bridge presentation adapted from the team's owner screen."""
from __future__ import annotations

import streamlit as st


def header(section: str) -> None:
    st.html(f"""
    <div style="display:flex;align-items:center;gap:14px;padding:10px 2px 18px;border-bottom:1px solid #ece9e2;margin-bottom:18px">
      <span style="display:inline-grid;place-items:center;width:40px;height:40px;border-radius:10px;background:#ffbf00;color:#101624;font-weight:900;font-size:19px">KB</span>
      <div><div style="font-size:25px;font-weight:750;letter-spacing:-1px;color:#101624">상권브릿지</div>
      <div style="font-size:12px;color:#7c7f86">{section} · 교육용 프로젝트</div></div>
    </div>""")


def section_label(text: str, description: str = "") -> None:
    st.subheader(text)
    if description:
        st.caption(description)
