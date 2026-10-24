"""Streamlit entrypoint and shared navigation."""
import streamlit as st

from kb_bridge.ui.brand import navigation

st.set_page_config(page_title="KB 상권브릿지", page_icon="🏦", layout="wide", initial_sidebar_state="collapsed")
page = st.navigation(
    [
        st.Page("app_pages/rising.py", title="뜨는 상권", icon=":material/trending_up:", default=True),
        st.Page("app_pages/my_market.py", title="내상권 분석", icon=":material/storefront:"),
        st.Page("app_pages/warning.py", title="젠트리피케이션 경고", icon=":material/warning:"),
    ],
    position="hidden",
)
navigation(page.title)
page.run()
