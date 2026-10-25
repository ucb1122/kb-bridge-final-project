"""휠 확대와 드래그가 없는 보고서용 정적 SVG 그래프."""
from __future__ import annotations

from html import escape

import streamlit as st


def _number(value: float, unit: str) -> str:
    if unit == "억 원":
        return f"{value:,.1f}"
    return f"{value:,.0f}"


def _wrap(title: str, unit: str, svg: str, description: str) -> None:
    st.html(
        '<section class="kb-static-chart" style="border:1px solid #dce1e8;border-radius:10px;'
        'padding:18px;margin:14px 0;background:#fff">'
        f'<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline">'
        f'<strong style="font-size:17px;color:#17243a">{escape(title)}</strong>'
        f'<small style="color:#6b778a">단위: {escape(unit)}</small></div>'
        f'<svg viewBox="0 0 760 290" role="img" aria-label="{escape(description, quote=True)}" '
        'style="width:100%;height:auto;display:block;pointer-events:none;user-select:none" '
        'xmlns="http://www.w3.org/2000/svg">'
        f'{svg}</svg></section>'
    )


def bars(title: str, labels: list[str], values: list[float | None], unit: str, *,
         current_last: bool = True) -> None:
    """값을 직접 표시하는 정적 막대그래프. 결측값은 0으로 대체하지 않는다."""
    if not labels or not any(value is not None for value in values):
        st.info(f"{title} 자료가 없습니다.")
        return
    count = len(labels)
    valid = [float(value) for value in values if value is not None]
    ceiling = max(max(valid), 1.0) * 1.12
    left, right, top, bottom = 52, 738, 34, 235
    width = right - left
    step = width / count
    bar_width = min(74, step * .58)
    svg = ['<defs><pattern id="kb-hatch" width="7" height="7" patternUnits="userSpaceOnUse" '
           'patternTransform="rotate(45)"><rect width="7" height="7" fill="#d5d9de"/>'
           '<path d="M 0 0 L 0 7" stroke="#c1c6cc" stroke-width="2"/></pattern></defs>']
    for tick in range(5):
        y = bottom - tick * (bottom - top) / 4
        val = ceiling * tick / 4
        svg.append(f'<line x1="{left}" y1="{y:.1f}" x2="{right}" y2="{y:.1f}" stroke="#e7e9ed"/>')
        svg.append(f'<text x="{left-8}" y="{y+4:.1f}" text-anchor="end" font-size="12" fill="#697586">{escape(_number(val, unit))}</text>')
    for index, (label, value) in enumerate(zip(labels, values)):
        x = left + (index + .5) * step
        svg.append(f'<text x="{x:.1f}" y="263" text-anchor="middle" font-size="12" fill="#46546a">{escape(label)}</text>')
        if value is None:
            svg.append(f'<text x="{x:.1f}" y="225" text-anchor="middle" font-size="13" fill="#697586">자료 없음</text>')
            continue
        height = max(2, float(value) / ceiling * (bottom - top))
        y = bottom - height
        fill = '#13a8f3' if current_last and index == count - 1 else 'url(#kb-hatch)'
        svg.append(f'<rect x="{x-bar_width/2:.1f}" y="{y:.1f}" width="{bar_width:.1f}" height="{height:.1f}" fill="{fill}"/>')
        value_y = max(top + 15, y - 7) if height < 28 else min(bottom - 8, y + height / 2 + 5)
        svg.append(f'<text x="{x:.1f}" y="{value_y:.1f}" text-anchor="middle" font-size="13" font-weight="600" fill="#15283c">{escape(_number(float(value), unit))}</text>')
    description = title + ': ' + ', '.join(f'{label} {_number(float(value), unit) if value is not None else "자료 없음"}{unit}' for label, value in zip(labels, values))
    _wrap(title, unit, ''.join(svg), description)


def lines(title: str, labels: list[str], series: dict[str, list[float | None]], unit: str) -> None:
    """여러 지역을 함께 비교하는 정적 꺾은선그래프."""
    valid = [float(value) for values in series.values() for value in values if value is not None]
    if not labels or not valid:
        st.info(f"{title} 자료가 없습니다.")
        return
    count = len(labels)
    left, right, top, bottom = 52, 738, 42, 227
    floor = min(0, min(valid))
    ceiling = max(valid) * 1.12 or 1
    span = ceiling - floor or 1
    colors = ['#08a8ed', '#ffb132', '#8f98a3', '#2cbda0']
    svg = []
    for tick in range(5):
        y = bottom - tick * (bottom - top) / 4
        val = floor + span * tick / 4
        svg.append(f'<line x1="{left}" y1="{y:.1f}" x2="{right}" y2="{y:.1f}" stroke="#e7e9ed"/>')
        svg.append(f'<text x="{left-8}" y="{y+4:.1f}" text-anchor="end" font-size="12" fill="#697586">{escape(_number(val, unit))}</text>')
    for index, label in enumerate(labels):
        x = left + index * (right-left) / max(count-1, 1)
        svg.append(f'<text x="{x:.1f}" y="255" text-anchor="middle" font-size="12" fill="#46546a">{escape(label)}</text>')
    descriptions = []
    for series_index, (name, values) in enumerate(series.items()):
        color = colors[series_index % len(colors)]
        points = []
        for index, value in enumerate(values):
            if value is None:
                continue
            x = left + index * (right-left) / max(count-1, 1)
            y = bottom - (float(value)-floor) / span * (bottom-top)
            points.append((x,y,value))
        if len(points) > 1:
            svg.append(f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x,y,_ in points)}" fill="none" stroke="{color}" stroke-width="3"/>')
        for x,y,value in points:
            svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="{color}"/>')
            svg.append(f'<text x="{x:.1f}" y="{max(18,y-10):.1f}" text-anchor="middle" font-size="12" fill="#15283c">{escape(_number(float(value), unit))}</text>')
        descriptions.append(f'{name}: ' + ', '.join(f'{label} {_number(float(value), unit) if value is not None else "자료 없음"}' for label,value in zip(labels,values)))
        svg.append(f'<circle cx="{left+series_index*160}" cy="278" r="5" fill="{color}"/>')
        svg.append(f'<text x="{left+12+series_index*160}" y="282" font-size="12" fill="#46546a">{escape(name)}</text>')
    _wrap(title, unit, ''.join(svg), '; '.join(descriptions))


def shares(title: str, segments: dict[str, float | None], unit: str) -> None:
    """전체 구성비를 보여 주는 정적 누적 막대."""
    values = {name: float(value) for name, value in segments.items() if value is not None and value >= 0}
    total = sum(values.values())
    if not total:
        st.info(f"{title} 자료가 없습니다.")
        return
    colors = ['#08a8ed', '#2bc9a4', '#ffb132', '#8f98a3']
    svg = ['<circle cx="380" cy="133" r="82" fill="none" stroke="#eef1f5" stroke-width="50"/>']
    circumference = 2 * 3.141592653589793 * 82
    offset = 0.0
    for index, (name, value) in enumerate(values.items()):
        color = colors[index % len(colors)]
        length = value / total * circumference
        svg.append(f'<circle cx="380" cy="133" r="82" fill="none" stroke="{color}" stroke-width="50" '
                   f'stroke-dasharray="{length:.1f} {circumference-length:.1f}" stroke-dashoffset="{-offset:.1f}" '
                   'transform="rotate(-90 380 133)"/>')
        svg.append(f'<rect x="{90+index*290}" y="256" width="12" height="12" fill="{color}"/>')
        svg.append(f'<text x="{108+index*290}" y="267" font-size="13" fill="#46546a">{escape(name)} {value:,.0f}{escape(unit)}</text>')
        offset += length
    svg.append(f'<text x="380" y="140" text-anchor="middle" font-size="25" font-weight="700" fill="#17243a">{total:,.0f}</text>')
    _wrap(title, unit, ''.join(svg), ', '.join(f'{name} {value:,.0f}{unit}' for name,value in values.items()))
