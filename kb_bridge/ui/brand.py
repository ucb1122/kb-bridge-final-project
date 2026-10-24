"""Shared KB Bridge presentation adapted from the team's owner screen."""
from __future__ import annotations

import streamlit as st


def header(section: str) -> None:
    st.html(f"""
    <style>
      .kb-brand-head {{display:flex;align-items:center;gap:10px;padding:10px 2px 18px;
        border-bottom:1px solid #ece9e2;margin-bottom:18px}}
      .kb-brand-symbol {{position:relative;display:block;width:58px;height:43.7px;
        overflow:hidden;flex:none}}
      .kb-brand-symbol img {{position:absolute;display:block;max-width:none;width:312px;
        height:auto;left:-42.4px;top:-82.5px}}
      .kb-brand-name {{font-size:27px;font-weight:700;letter-spacing:-1.1px;
        line-height:1.15;color:#101624}}
      .kb-brand-subtitle {{font-size:12px;color:#7c7f86;margin-top:3px}}
    </style>
    <div class="kb-brand-head">
      <span class="kb-brand-symbol" aria-hidden="true"><img src="/app/static/assets/kb-bank-brand-source.png" alt=""></span>
      <div><div class="kb-brand-name">상권브릿지</div>
      <div class="kb-brand-subtitle">{section} · 교육용 프로젝트</div></div>
    </div>""")


def section_label(text: str, description: str = "") -> None:
    st.subheader(text)
    if description:
        st.caption(description)
