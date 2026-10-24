"""Shared KB Bridge navigation based on the team's owner header."""
from __future__ import annotations

import streamlit as st


def navigation() -> None:
    st.html("""
    <style>
      .kb-site-header {height:102px;display:flex;align-items:center;gap:54px;
        padding:0 4.5%;background:#fff;border-bottom:1px solid #f0ece4;
        font-family:'KB Noto Sans KR','Malgun Gothic',sans-serif}
      .kb-site-brand {display:inline-flex;align-items:center;gap:10px;flex:none;
        text-decoration:none;color:#101624}
      .kb-site-symbol {position:relative;display:block;width:58px;height:43.7px;
        overflow:hidden;flex:none}
      .kb-site-symbol img {position:absolute;display:block;max-width:none;width:312px;
        height:auto;left:-42.4px;top:-82.5px}
      .kb-site-name {font-size:30px;font-weight:700;letter-spacing:-1.1px;white-space:nowrap}
      .kb-site-header nav {display:flex;align-items:center;gap:34px;min-width:0;overflow-x:auto}
      .kb-site-header nav a {display:inline-flex;align-items:center;height:102px;flex:none;
        border-bottom:3px solid transparent;padding-top:3px;color:#172032;
        font-size:19px;font-weight:500;text-decoration:none;white-space:nowrap}
      .kb-site-header nav a:hover {border-bottom-color:#ffbf00;color:#101624}
      .kb-site-header .kb-project-badge {margin-left:auto;color:#8b8c91;font-size:11px;white-space:nowrap}
      [data-testid="stMainBlockContainer"]:has(.kb-site-header) {max-width:none;padding:84px 0 20px}
      @media(max-width:850px) {
        .kb-site-header {height:auto;min-height:68px;gap:14px;padding:7px 12px;flex-wrap:wrap}
        .kb-site-symbol {width:42px;height:32px}
        .kb-site-symbol img {width:226px;left:-31px;top:-60px}
        .kb-site-name {font-size:21px}
        .kb-site-header nav {order:3;width:100%;gap:20px}
        .kb-site-header nav a {height:37px;font-size:12px}
        .kb-site-header .kb-project-badge {font-size:10px}
      }
    </style>
    <header class="kb-site-header">
      <a class="kb-site-brand" href="/" aria-label="KB 상권브릿지 홈">
        <span class="kb-site-symbol" aria-hidden="true"><img src="/app/static/assets/kb-bank-brand-source.png" alt=""></span>
        <span class="kb-site-name">상권브릿지</span>
      </a>
      <nav aria-label="주 메뉴">
        <a href="/">뜨는 상권</a>
        <a href="/my_market">내상권 분석</a>
        <a href="/warning">젠트리피케이션 경고</a>
      </nav>
      <span class="kb-project-badge">교육용 프로젝트</span>
    </header>""")


def header(section: str) -> None:
    """Legacy page helper retained for callers outside the main navigation."""
    st.caption(section)


def section_label(text: str, description: str = "") -> None:
    st.subheader(text)
    if description:
        st.caption(description)
