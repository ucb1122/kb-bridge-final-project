"""Shared placeholder for features that are still in development."""
from html import escape

import streamlit as st


def render_coming_soon(title: str, description: str) -> None:
    st.html(
        """<style>
        .kb-coming-wrap {min-height:calc(100vh - 110px);display:grid;place-items:center;
          padding:32px 20px 60px;font-family:'KB Noto Sans KR','Malgun Gothic',sans-serif}
        .kb-coming-card {box-sizing:border-box;width:min(100%,760px);padding:38px 32px 44px;
          background:#fff;border:1px solid #e9e1cf;border-radius:20px;text-align:center;
          box-shadow:0 14px 45px rgba(37,40,47,.05)}
        .kb-coming-card img {display:block;width:min(100%,420px);height:auto;margin:0 auto 24px}
        .kb-coming-card h1 {margin:0 0 13px;color:#101624;font-size:30px;line-height:1.35}
        .kb-coming-status {display:inline-block;margin:0 0 15px;padding:8px 17px;
          border-radius:999px;background:#fff4d2;color:#765300;font-size:15px;font-weight:700}
        .kb-coming-card p {margin:0;color:#697080;font-size:15px;line-height:1.7}
        @media(max-width:600px) {.kb-coming-card {padding:25px 18px 32px}
          .kb-coming-card h1 {font-size:24px}}
        </style>
        <main class="kb-coming-wrap"><section class="kb-coming-card" aria-labelledby="kb-coming-title">
          <img src="/app/static/assets/under-construction.svg" alt="공사 중인 서비스를 표현한 일러스트">
          <h1 id="kb-coming-title">__TITLE__</h1>
          <span class="kb-coming-status">개발 예정</span>
          <p>__DESCRIPTION__</p>
        </section></main>""".replace("__TITLE__", escape(title)).replace("__DESCRIPTION__", escape(description))
    )
