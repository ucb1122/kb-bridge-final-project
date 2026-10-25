"""Streamlit entrypoint and shared navigation."""
import importlib
from pathlib import Path

import streamlit as st

from kb_bridge.ui import brand

st.set_page_config(page_title="KB 상권브릿지", page_icon=Path(__file__).parent / "static/assets/kb-favicon.png", layout="wide", initial_sidebar_state="collapsed")
page = st.navigation(
    [
        st.Page("app_pages/rising.py", title="뜨는 상권", icon=":material/trending_up:", default=True),
        st.Page("app_pages/my_market.py", title="내 상권 분석", icon=":material/storefront:"),
        st.Page("app_pages/warning.py", title="위험상권", icon=":material/warning:"),
        st.Page("app_pages/products.py", title="금융 상품 추천", icon=":material/account_balance:"),
    ],
    position="hidden",
)
importlib.reload(brand)
brand.navigation(page.title)
page.run()
