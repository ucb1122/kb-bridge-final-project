"""Shared KB Bridge navigation based on the team's owner header."""
from __future__ import annotations

import streamlit as st


def navigation(active: str = "") -> None:
    links = "".join(
        f'<a href="{path}" class="{"active" if active == label else ""}">{label}</a>'
        for path, label in (("/", "뜨는 상권"), ("/my_market", "내상권 분석"),
                            ("/warning", "젠트리피케이션 경고"))
    )
    st.html("""
    <style>
      .kb-site-header {height:76px;display:flex;align-items:center;gap:30px;
        padding:0 1.6%;background:#fff;border-bottom:1px solid #f0ece4;
        font-family:'KB Noto Sans KR','Malgun Gothic',sans-serif}
      .kb-site-brand {display:inline-flex;align-items:center;gap:10px;flex:none;
        text-decoration:none;color:#101624}
      .kb-site-symbol {position:relative;display:block;width:46px;height:35px;
        overflow:hidden;flex:none}
      .kb-site-symbol img {position:absolute;display:block;max-width:none;width:248px;
        height:auto;left:-33.7px;top:-65.6px}
      .kb-site-name {font-size:24px;font-weight:700;letter-spacing:-1.1px;white-space:nowrap}
      .kb-site-header nav {display:flex;align-items:center;gap:23px;min-width:0;overflow-x:auto}
      .kb-site-header nav a {display:inline-flex;align-items:center;height:76px;flex:none;
        border-bottom:3px solid transparent;padding-top:3px;color:#172032;
        font-size:16px;font-weight:500;text-decoration:none;white-space:nowrap}
      .kb-site-header nav a:hover,.kb-site-header nav a.active {border-bottom-color:#ffbf00;color:#101624}
      .kb-site-header nav a.active {font-weight:700}
      [data-testid="stHeader"], [data-testid="stDecoration"] {display:none}
      [data-testid="stMainBlockContainer"]:has(.kb-site-header) {max-width:none;padding:10px 0 20px}
      @media(max-width:850px) {
        .kb-site-header {height:auto;min-height:68px;gap:14px;padding:7px 12px;flex-wrap:wrap}
        .kb-site-symbol {width:42px;height:32px}
        .kb-site-symbol img {width:226px;left:-31px;top:-60px}
        .kb-site-name {font-size:21px}
        .kb-site-header nav {order:3;width:100%;gap:20px}
        .kb-site-header nav a {height:37px;font-size:12px}
      }
    </style>
    <header class="kb-site-header">
      <a class="kb-site-brand" href="/" aria-label="KB 상권브릿지 홈">
        <span class="kb-site-symbol" aria-hidden="true"><img src="/app/static/assets/kb-bank-brand-source.png" alt=""></span>
        <span class="kb-site-name">상권브릿지</span>
      </a>
      <nav aria-label="주 메뉴">__KB_NAV_LINKS__</nav>
    </header>""".replace("__KB_NAV_LINKS__", links))


def header(section: str) -> None:
    """Legacy page helper retained for callers outside the main navigation."""
    st.caption(section)


def section_label(text: str, description: str = "") -> None:
    st.subheader(text)
    if description:
        st.caption(description)
