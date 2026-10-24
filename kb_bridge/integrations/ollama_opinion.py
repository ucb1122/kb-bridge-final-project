"""Optional local Ollama wording over verified report facts."""
from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from kb_bridge.config import load_settings
from kb_bridge.services.rising_analysis import LABELS, human_value, overview_lines, percent

SYSTEM = (
    "서울시 상권분석 보고서의 종합의견을 한국어 문장 4개로 작성하세요. "
    "점포·매출·인구 변화와 신중한 종합 판단을 순서대로 설명하세요. "
    "주어진 수치, 기간, 단위와 출처만 사용하세요. 없는 임대료·소득·폐업 확률·대출 적격성을 만들지 마세요. "
    "지역 통계를 개인 점포의 재무정보로 해석하지 마세요. 결과는 JSON opinions 문자열 배열로 반환하세요."
)


def generate_opinion(report: dict) -> dict:
    settings = load_settings()
    facts = {"지역": f"{report['district']} {report['name']}", "분기": report["quarter"],
             "지표": {LABELS[key]: {"현재": human_value(key, item["value"]), "전분기": percent(item["change"])}
                    for key, item in report["metrics"].items() if key in LABELS}}
    body = {"model": settings.ollama_model, "stream": False, "think": False,
            "format": {"type": "object", "properties": {"opinions": {"type": "array", "minItems": 4, "maxItems": 4, "items": {"type": "string"}}},
                       "required": ["opinions"], "additionalProperties": False},
            "system": SYSTEM, "prompt": json.dumps(facts, ensure_ascii=False),
            "options": {"temperature": 0.2, "num_predict": 420}}
    request = Request(settings.ollama_base_url.rstrip("/") + "/api/generate",
                      data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                      headers={"Content-Type": "application/json"}, method="POST")
    fallback = {"mode": "data", "lines": overview_lines(report)[:4],
                "note": "Ollama 의견을 사용할 수 없어 검증된 수치 기반 요약을 표시합니다."}
    try:
        with urlopen(request, timeout=60) as response:
            payload = json.load(response)
        opinions = json.loads(payload.get("response", "{}"))["opinions"]
        if not isinstance(opinions, list) or len(opinions) != 4 or any(not isinstance(x, str) or not x.strip() for x in opinions):
            raise ValueError("의견 4개를 받지 못했습니다.")
        return {"mode": "ai", "lines": [line.strip() for line in opinions],
                "note": f"로컬 Ollama {settings.ollama_model} 생성 문장 · 수치는 원본 보고서에서 확인하세요."}
    except (HTTPError, URLError, TimeoutError, KeyError, ValueError, json.JSONDecodeError) as error:
        return {**fallback, "note": f"{type(error).__name__}: {fallback['note']}"}
