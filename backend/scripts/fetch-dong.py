"""Download the four official Seoul administrative-dong commercial datasets."""

import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data/raw/dong"
SHEET = "https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do"
DATASETS = {
    "stores": ("OA-22172", "VwsmAdstrdStorW"),
    "sales": ("OA-22175", "VwsmAdstrdSelngW"),
    "footfall": ("OA-22178", "VwsmAdstrdFlpopW"),
    "residents": ("OA-22183", "VwsmAdstrdRepopW"),
}
BOUNDARY_URL = "https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260401/HangJeongDong_ver20260401.geojson"


def get_count(service):
    url = f"http://openapi.seoul.go.kr:8088/sample/json/{service}/1/1/"
    with urllib.request.urlopen(url, timeout=60) as response:
        return int(json.load(response)[service]["list_total_count"])


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for metric, (oa_id, service) in DATASETS.items():
        count = get_count(service)
        body = urllib.parse.urlencode({
            "srvType": "S", "infId": oa_id, "serviceKind": "1", "pageNo": "1",
            "gridTotalCnt": str(count), "ssUserId": "SAMPLE_VIEW", "strWhere": "",
            "strOrderby": "", "filterCol": "필터선택", "txtFilter": "",
        }).encode()
        request = urllib.request.Request(SHEET, data=body, headers={
            "User-Agent": "Mozilla/5.0 (KB-Bridge team data collection)",
            "Referer": f"https://data.seoul.go.kr/dataList/{oa_id}/S/1/datasetView.do",
        })
        print(f"{metric}: 공식 API 전체 {count:,}행 중 최신 공개 CSV 내려받는 중…", flush=True)
        with urllib.request.urlopen(request, timeout=900) as response:
            data = response.read()
        if len(data) < 100 or data[:100].lstrip().lower().startswith((b"<html", b"<!doctype")):
            raise RuntimeError(f"{metric}: CSV 대신 오류 응답을 받았습니다: {data[:100]!r}")
        target = OUTPUT / f"{metric}.csv"
        target.write_bytes(data)
        actual = data.count(b"\n") - 1
        print(f"{metric}: CSV {actual:,}행, {len(data):,}바이트 → {target}", flush=True)
    boundary_target = OUTPUT / "boundaries.geojson"
    urllib.request.urlretrieve(BOUNDARY_URL, boundary_target)
    print(f"행정동 경계 → {boundary_target}", flush=True)


if __name__ == "__main__":
    main()
