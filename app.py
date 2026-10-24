"""Streamlit entrypoint: navigation and common UI only."""

import streamlit as st


st.set_page_config(page_title="KB 상권브릿지", layout="wide")
st.navigation(
    [
        st.Page("app_pages/rising.py", title="뜨는 상권", default=True),
        st.Page("app_pages/my_market.py", title="내상권 분석"),
        st.Page("app_pages/warning.py", title="젠트리피케이션 경고"),
    ],
    position="top",
).run()
