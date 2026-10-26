"""Stream Seoul's CP949 CSV files directly from data/raw/seoul_public_data.zip."""

import argparse
import csv
import io
import json
import os
import subprocess
import sys
import re
import sqlite3
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "stores": ("서울시 상권분석서비스(점포-상권).csv", "전체_점포_수"),
    "sales": ("서울시 상권분석서비스(추정매출-상권).csv", "당월_매출_금액"),
    "footfall": ("서울시 상권분석서비스(길단위인구-상권).csv", "총_유동인구_수"),
    "residents": ("서울시 상권분석서비스(상주인구-상권).csv", "총_상주인구_수"),
}
MAP_FILE = "서울시 상권분석서비스(영역-상권).csv"
DONG_SOURCES = {
    "stores": "전체_점포_수", "sales": "당월_매출_금액",
    "footfall": "총_유동인구_수", "residents": "총_상주인구_수",
}


def rows(archive, name, required):
    matches = [item for item in archive.namelist() if item.endswith("/" + name)]
    if len(matches) != 1:
        raise ValueError(f"ZIP 안에서 {name} 파일을 하나만 찾아야 합니다: {len(matches)}개")
    with archive.open(matches[0]) as binary, io.TextIOWrapper(binary, encoding="cp949", newline="") as stream:
        reader = csv.DictReader(stream)
        missing = set(required) - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{name}: 필요한 열이 없습니다: {', '.join(sorted(missing))}")
        yield from reader


def number(value, source, line):
    value = value.strip().replace(",", "")
    if not re.fullmatch(r"\d+", value):
        raise ValueError(f"{source} {line}행: 숫자가 아닙니다: {value!r}")
    return int(value)


def dong_rows(folder, metric, column):
    source = folder / f"{metric}.csv"
    if not source.exists():
        raise FileNotFoundError(f"{source} 파일이 없습니다. python scripts/fetch-dong.py를 먼저 실행하세요.")
    with source.open(encoding="cp949", newline="") as stream:
        reader = csv.DictReader(stream)
        required = {"기준_년분기_코드", "행정동_코드", "행정동_코드_명", column}
        if required - set(reader.fieldnames or []):
            raise ValueError(f"{source}: 필요한 열이 없습니다: {required - set(reader.fieldnames or [])}")
        yield from reader


def center(geometry):
    rings = ([geometry["coordinates"][0]] if geometry["type"] == "Polygon"
             else [polygon[0] for polygon in geometry["coordinates"]])
    points = [point for ring in rings for point in ring]
    lngs, lats = [point[0] for point in points], [point[1] for point in points]
    return ((min(lats) + max(lats)) / 2, (min(lngs) + max(lngs)) / 2)


def import_archive(source, target):
    with zipfile.ZipFile(source) as archive:
        boundary_files = [name for name in archive.namelist() if name.endswith("seoul_trdar_boundary.geojson")]
        if len(boundary_files) != 1:
            raise ValueError("상권 경계 GeoJSON을 찾을 수 없습니다.")
        boundaries = json.load(archive.open(boundary_files[0]))
        centers = {}
        for feature in boundaries["features"]:
            centers[str(feature["properties"]["TRDAR_CD"])] = center(feature["geometry"])
        mapping = {}
        for line, row in enumerate(rows(archive, MAP_FILE, ["상권_코드", "상권_코드_명", "행정동_코드", "행정동_코드_명", "자치구_코드_명"]), 2):
            code = row["상권_코드"].strip()
            item = (row["상권_코드_명"].strip(), row["행정동_코드"].strip(),
                    row["행정동_코드_명"].strip(), row["자치구_코드_명"].strip())
            if not code or not all(item) or (code in mapping and mapping[code] != item):
                raise ValueError(f"{MAP_FILE} {line}행: 잘못되거나 중복된 상권 코드")
            mapping[code] = item
        if not mapping:
            raise ValueError("상권 코드 매핑이 비어 있습니다.")
        if set(mapping) != set(centers):
            raise ValueError("CSV 상권 코드와 GeoJSON 상권 코드가 일치하지 않습니다.")
        for feature in boundaries["features"]:
            code = str(feature["properties"]["TRDAR_CD"])
            name, dong_code, dong_name, district = mapping[code]
            feature["properties"] = {"code": code, "name": name, "dong_code": dong_code + ":" + district,
                                     "dong_name": dong_name, "district": district}

        # Sales and stores have one row per industry, so their values are summed.
        # Population files normally have one row per area and quarter; duplicate
        # keys are rejected to avoid accidentally inflating population counts.
        observations = defaultdict(int)
        for metric, (name, column) in SOURCES.items():
            count = 0
            seen = set()
            for line, row in enumerate(rows(archive, name, ["기준_년분기_코드", "상권_코드", column]), 2):
                quarter, code = row["기준_년분기_코드"].strip(), row["상권_코드"].strip()
                if not re.fullmatch(r"20\d{2}[1-4]", quarter):
                    raise ValueError(f"{name} {line}행: 잘못된 분기 {quarter!r}")
                if code not in mapping:
                    continue  # Historical or retired commercial area.
                key = (quarter, metric, code)
                if metric in ("footfall", "residents") and key in seen:
                    raise ValueError(f"{name} {line}행: 중복된 상권/분기 {key}")
                seen.add(key)
                observations[key] += number(row[column], name, line)
                count += 1
            print(f"{metric}: 원본 {count:,}행, 집계 {len(seen):,}개", flush=True)
            if not count:
                raise ValueError(f"{name}: 읽은 행이 없습니다.")

    dong_folder = source.parent / "dong"
    dong_boundary_path = dong_folder / "boundaries.geojson"
    if not dong_boundary_path.exists():
        raise FileNotFoundError(f"{dong_boundary_path} 파일이 없습니다. python scripts/fetch-dong.py를 먼저 실행하세요.")
    raw_dong_boundary = json.loads(dong_boundary_path.read_text(encoding="utf-8"))
    dong_features = []
    dong_centers = {}
    for feature in raw_dong_boundary["features"]:
        props = feature["properties"]
        if props.get("sido") != "11":
            continue
        code = str(props["adm_cd2"])[:8]
        dong_centers[code] = center(feature["geometry"])
        feature["properties"] = {"code": code, "name": props["adm_nm"].split()[-1], "district": props["sggnm"]}
        dong_features.append(feature)
    if len(dong_centers) < 400:
        raise ValueError("서울시 행정동 경계가 부족합니다.")
    dong_boundaries = {"type": "FeatureCollection", "features": dong_features}
    district_votes = defaultdict(Counter)
    for _, dong_code, _, district in mapping.values():
        district_votes[dong_code[:5]][district] += 1
    districts = {code: votes.most_common(1)[0][0] for code, votes in district_votes.items()}
    dong_values = defaultdict(int)
    dong_names = {}
    for metric, column in DONG_SOURCES.items():
        count = 0
        for line, row in enumerate(dong_rows(dong_folder, metric, column), 2):
            quarter, code, name = (row[k].strip() for k in ("기준_년분기_코드", "행정동_코드", "행정동_코드_명"))
            if not re.fullmatch(r"20\d{2}[1-4]", quarter) or not re.fullmatch(r"\d{8}", code) or code[:5] not in districts or not name:
                raise ValueError(f"{metric}.csv {line}행: 분기 또는 행정동 코드가 잘못되었습니다: {quarter}, {code}, {name}")
            name_key = (quarter, code)
            if name_key in dong_names and dong_names[name_key] != name:
                raise ValueError(f"{metric}.csv {line}행: 같은 코드의 행정동 이름이 다릅니다: {code}")
            dong_names[name_key] = name
            key = (quarter, metric, code)
            if metric in ("footfall", "residents") and key in dong_values:
                raise ValueError(f"{metric}.csv {line}행: 중복된 행정동/분기 {key}")
            dong_values[key] += number(row[column], f"{metric}.csv", line)
            count += 1
        if not count:
            raise ValueError(f"{metric}.csv: 읽은 행이 없습니다.")
        print(f"dong {metric}: 원본 {count:,}행", flush=True)

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.stem + ".importing.sqlite")
    if temporary.exists():
        temporary.unlink()
    db = sqlite3.connect(temporary)
    try:
        db.executescript("""CREATE TABLE observations (
            quarter TEXT NOT NULL, kind TEXT NOT NULL, metric TEXT NOT NULL,
            region_code TEXT NOT NULL, region_name TEXT NOT NULL,
            district TEXT NOT NULL, value REAL NOT NULL, lat REAL, lng REAL,
            PRIMARY KEY (quarter, kind, metric, region_code)
        );
        CREATE INDEX idx_observations_filter ON observations(quarter, kind, metric, district);""")
        insert = "INSERT INTO observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        batch = []
        for (quarter, metric, code), value in observations.items():
            area_name, _, _, district = mapping[code]
            lat, lng = centers[code]
            batch.append((quarter, "area", metric, code, area_name, district, value, lat, lng))
            if len(batch) >= 5000:
                db.executemany(insert, batch)
                batch.clear()
        db.executemany(insert, batch)
        db.executemany(insert, ((q, "dong", m, c, dong_names[(q, c)], districts[c[:5]], v,
                                 dong_centers.get(c, (None, None))[0], dong_centers.get(c, (None, None))[1])
                                for (q, m, c), v in dong_values.items()))
        db.commit()
        total = db.execute("SELECT count(*) FROM observations").fetchone()[0]
        print(f"SQLite {total:,}행 → {target}", flush=True)
    except BaseException:
        db.close()
        temporary.unlink(missing_ok=True)
        raise
    else:
        db.close()
        os.replace(temporary, target)
        geometry_path = target.with_suffix(".geojson")
        geometry_temp = geometry_path.with_name(geometry_path.name + ".tmp")
        geometry_temp.write_text(json.dumps(boundaries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        os.replace(geometry_temp, geometry_path)
        print(f"상권 경계 {len(boundaries['features']):,}개 → {geometry_path}", flush=True)
        dong_geometry_path = target.with_name(target.stem + "-dong.geojson")
        dong_geometry_temp = dong_geometry_path.with_name(dong_geometry_path.name + ".tmp")
        dong_geometry_temp.write_text(json.dumps(dong_boundaries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        os.replace(dong_geometry_temp, dong_geometry_path)
        print(f"행정동 경계 {len(dong_features):,}개 → {dong_geometry_path}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "data/raw/seoul_public_data.zip")
    parser.add_argument("--db", type=Path, default=ROOT / "data/commerce.sqlite")
    args = parser.parse_args()
    import_archive(args.source, args.db)
    subprocess.run([sys.executable, str(ROOT / "scripts/import-details.py"),
                    "--source", str(args.source), "--db", str(args.db)], check=True)
