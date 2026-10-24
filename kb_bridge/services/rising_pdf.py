"""Source-aware Korean PDF exports for rising-area reports."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from kb_bridge.services.rising_analysis import LABELS, human_value, overview_lines, overview_cards, sales_per_store_month, footfall_per_ha

FONT_PATH = Path(__file__).resolve().parents[2] / "assets" / "fonts" / "NotoSansKR-VF.ttf"
SECTIONS = ("종합의견", "업종분석", "매출분석", "인구분석", "지역(배후지)분석")


def _styles() -> dict:
    if "NotoPDF" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("NotoPDF", str(FONT_PATH)))
    return {
        "title": ParagraphStyle("title", fontName="NotoPDF", fontSize=19, leading=25, textColor=colors.HexColor("#101624"), spaceAfter=13),
        "heading": ParagraphStyle("heading", fontName="NotoPDF", fontSize=12, leading=17, textColor=colors.HexColor("#101624"), spaceBefore=14, spaceAfter=8),
        "body": ParagraphStyle("body", fontName="NotoPDF", fontSize=9, leading=16, textColor=colors.HexColor("#303846"), spaceAfter=6),
        "small": ParagraphStyle("small", fontName="NotoPDF", fontSize=8, leading=13, textColor=colors.HexColor("#667085")),
        "center": ParagraphStyle("center", fontName="NotoPDF", fontSize=8, leading=12, alignment=TA_CENTER),
    }


def _table(rows: list[list[str]]) -> Table:
    table = Table(rows, repeatRows=1, hAlign="LEFT", colWidths=[55 * mm, 112 * mm])
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "NotoPDF"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FFF4CE")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#101624")),
        ("GRID", (0, 0), (-1, -1), .35, colors.HexColor("#E9E6DE")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def _page_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("NotoPDF", 7)
    canvas.setFillColor(colors.HexColor("#667085"))
    canvas.drawString(20 * mm, 14 * mm, "KB 상권브릿지 · 교육용 프로젝트 · 실제 은행 운영 서비스 아님")
    canvas.drawRightString(190 * mm, 14 * mm, str(doc.page))
    canvas.restoreState()


def build_pdf(report: dict, section: str) -> bytes:
    if section not in SECTIONS:
        raise ValueError("알 수 없는 보고서 항목입니다.")
    styles = _styles()
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=22*mm)
    story = [Paragraph("상권브릿지 | " + section, styles["title"]),
             Paragraph(f"{report['district']} {report['name']} · {report['quarter'][:4]}년 {report['quarter'][-1]}분기", styles["body"]),
             Paragraph("지역 단위 공개 통계와 확인된 공식 화면 표시값을 구분해 사용합니다.", styles["small"]), Spacer(1, 8*mm)]
    selected_ranking = report.get("selected_ranking")
    if selected_ranking:
        metric = selected_ranking["metric"]
        source_label = "공식 순위 확인값" if selected_ranking["value_source"] == "official_rank" else "공개 원본 계산값"
        story.append(Paragraph(
            f"선택 지표 순위: {LABELS[metric]} {selected_ranking['rank']}위 · "
            f"{human_value(metric, selected_ranking['value'])} · {source_label}",
            styles["body"],
        ))
    if section == "종합의견":
        story.append(Paragraph("핵심 수치", styles["heading"]))
        card_rows = [["지표", "값"]]
        for card in overview_cards(report):
            unit = card["unit"]
            current = card["current"]
            card_rows.append([card["title"], f"{current:,.0f}{unit}" if current is not None else "자료 없음"])
            for label, delta in (("전분기 대비", card["previous_delta"]), ("전년 동분기 대비", card["year_delta"])):
                card_rows.append([label, f"{delta:+,.0f}{unit}" if delta is not None else "비교 자료 없음"])
            card_rows.append(["출처", card["source"]])
        story.append(_table(card_rows))
        story.append(Paragraph("수치 기반 요약", styles["heading"]))
        story.extend(Paragraph(line, styles["body"]) for line in overview_lines(report))
    elif section == "업종분석":
        story.append(Paragraph("점포가 많은 업종", styles["heading"]))
        story.append(_table([["업종", "점포수"], *[[item["name"], f"{item['stores']:,.0f}개" if item["stores"] is not None else "자료 없음"] for item in report["industries"][:15]]]))
    elif section == "매출분석":
        monthly, source = sales_per_store_month(report)
        story.append(_table([["지표", "값"], ["분기 추정매출 합계", human_value("sales", report["metrics"].get("sales", {}).get("value"))], ["점포당 월평균 매출", f"{monthly:,.0f}만 원" if monthly is not None else "자료 없음"], ["월평균 출처", source]]))
        story.append(Paragraph("분기 합계와 점포당 월평균은 다른 지표입니다. 개인 점포 매출이 아닙니다.", styles["small"]))
    elif section == "인구분석":
        density, source = footfall_per_ha(report)
        story.append(_table([["지표", "값"], ["유동인구", human_value("footfall", report["metrics"].get("footfall", {}).get("value"))], ["상주인구", human_value("residents", report["metrics"].get("residents", {}).get("value"))], ["3개월간 1ha당 유동인구", f"{density:,.0f}명/ha" if density is not None else "면적 정보 없음"], ["밀도 출처", source]]))
    else:
        area = report.get("area_m2")
        story.append(_table([["지표", "값"], ["서울시 분석 면적", f"{area/10_000:,.1f}ha" if area else "자료 없음"], ["지역 코드", report["code"]]]))
        story.append(Paragraph("배지 원형은 실제 경계·반경을 뜻하지 않습니다.", styles["small"]))
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph("자료: 서울시 상권분석서비스 테스트 스냅샷. 지역·기간·단위가 다른 값은 합산하지 않습니다.", styles["small"]))
    doc.build(story, onFirstPage=_page_footer, onLaterPages=_page_footer)
    return buffer.getvalue()


def build_zip(report: dict) -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as archive:
        for index, section in enumerate(SECTIONS, 1):
            archive.writestr(f"{index:02d}_{section}.pdf", build_pdf(report, section))
    return buffer.getvalue()
