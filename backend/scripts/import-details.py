"""Import report breakdowns from the same Seoul source CSVs used for rankings."""
import csv
import argparse
import io
import sqlite3
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.stdout.reconfigure(encoding="utf-8")
DB = ROOT / "data/commerce.sqlite"
ZIP = ROOT / "data/raw/seoul_public_data.zip"

SPECS = {
    "stores": ("점포-상권", {
        "regular": "일반_점포_수", "franchise": "프랜차이즈_점포_수",
        "opened": "개업_점포_수", "closed": "폐업_점포_수"}),
    "sales": ("추정매출-상권", {
        "transactions": "당월_매출_건수",
        **{f"day_{i}": f"{day}요일_매출_금액" for i, day in enumerate("월화수목금토일")},
        **{f"hour_{i}": f"시간대_{hour}_매출_금액" for i, hour in enumerate(["00~06", "06~11", "11~14", "14~17", "17~21", "21~24"])},
        "male": "남성_매출_금액", "female": "여성_매출_금액",
        **{f"age_{age}": f"연령대_{age}_매출_금액" for age in [10, 20, 30, 40, 50]},
        "age_60": "연령대_60_이상_매출_금액"}),
    "footfall": ("길단위인구-상권", {
        "male": "남성_유동인구_수", "female": "여성_유동인구_수",
        **{f"age_{age}": f"연령대_{age}_유동인구_수" for age in [10, 20, 30, 40, 50]},
        "age_60": "연령대_60_이상_유동인구_수",
        **{f"day_{i}": f"{day}요일_유동인구_수" for i, day in enumerate("월화수목금토일")},
        **{f"hour_{i}": f"시간대_{hour}_유동인구_수" for i, hour in enumerate(["00_06", "06_11", "11_14", "14_17", "17_21", "21_24"])}}),
    "residents": ("상주인구-상권", {
        "male": "남성_상주인구_수", "female": "여성_상주인구_수",
        **{f"age_{age}": f"연령대_{age}_상주인구_수" for age in [10, 20, 30, 40, 50]},
        "age_60": "연령대_60_이상_상주인구_수",
        **{f"male_age_{age}": f"남성연령대_{age}_상주인구_수" for age in [10,20,30,40,50]},
        "male_age_60": "남성연령대_60_이상_상주인구_수",
        **{f"female_age_{age}": f"여성연령대_{age}_상주인구_수" for age in [10,20,30,40,50]},
        "female_age_60": "여성연령대_60_이상_상주인구_수",
        "households": "총_가구_수", "apartment_households": "아파트_가구_수", "other_households": "비_아파트_가구_수"}),
    "workers": ("직장인구-상권", {
        "total": "총_직장_인구_수", "male": "남성_직장_인구_수", "female": "여성_직장_인구_수",
        **{f"age_{age}": f"연령대_{age}_직장_인구_수" for age in [10,20,30,40,50]},
        "age_60": "연령대_60_이상_직장_인구_수"}),
    "consumption": ("소비-상권", {
        "total": "지출_총금액", "food": "식료품_지출_총금액", "clothes": "의류_신발_지출_총금액",
        "household": "생활용품_지출_총금액", "medical": "의료비_지출_총금액",
        "transport": "교통_지출_총금액", "leisure": "여가_지출_총금액",
        "culture": "문화_지출_총금액", "education": "교육_지출_총금액", "entertainment": "유흥_지출_총금액"}),
    "facilities": ("집객시설-상권", {
        "total": "집객시설_수", "office": "관공서_수", "bank": "은행_수",
        "general_hospital": "종합병원_수", "hospital": "일반_병원_수", "pharmacy": "약국_수",
        "kindergarten": "유치원_수", "school": "초등학교_수", "middle_school": "중학교_수",
        "high_school": "고등학교_수", "university": "대학교_수", "department_store": "백화점_수",
        "supermarket": "슈퍼마켓_수", "theater": "극장_수", "lodging": "숙박_시설_수",
        "airport": "공항_수", "railway": "철도_역_수", "bus_terminal": "버스_터미널_수",
        "subway": "지하철_역_수", "bus": "버스_정거장_수"}),
    "apartments": ("아파트-상권", {
        "complexes": "아파트_단지_수", "under_66": "아파트_면적_66_제곱미터_미만_세대_수",
        "size_66": "아파트_면적_66_제곱미터_세대_수", "size_99": "아파트_면적_99_제곱미터_세대_수",
        "size_132": "아파트_면적_132_제곱미터_세대_수", "size_165": "아파트_면적_165_제곱미터_세대_수",
        "price_under_1": "아파트_가격_1_억_미만_세대_수",
        **{f"price_{i}": f"아파트_가격_{i}_억_세대_수" for i in [1,2,3,4,5]},
        "price_6_plus": "아파트_가격_6_억_이상_세대_수"}),
    "operation": ("상권변화지표-상권", {"months": "운영_영업_개월_평균"}),
}


def integer(value):
    value = (value or "").replace(",", "").strip()
    return int(value) if value and value.lstrip('-').isdigit() else (float(value) if value else None)


def import_source(db, reader, kind, group, fields, quarters, valid):
    required = {"기준_년분기_코드", f"{'행정동' if kind == 'dong' else '상권'}_코드", *fields.values()}
    if group in ("stores", "sales"):
        required |= {"서비스_업종_코드", "서비스_업종_코드_명"}
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise ValueError(f"{group} {kind}: 누락된 열 {missing}")
    detail = defaultdict(int)
    industries = {}
    group_sales = defaultdict(int)
    code_field = "행정동_코드" if kind == "dong" else "상권_코드"
    for row in reader:
        q, code = row["기준_년분기_코드"], row[code_field]
        if q not in quarters or code not in valid[kind]:
            continue
        for key, column in fields.items():
            amount = integer(row[column])
            if amount is not None:
                detail[q, kind, code, group, key] += amount
        if group in ("stores", "sales"):
            industry = row["서비스_업종_코드"]
            index = (q, kind, code, industry)
            record = industries.setdefault(index, [row["서비스_업종_코드_명"], 0, 0, 0, 0, 0, 0, 0])
            if group == "stores":
                for pos, col in [(1, "전체_점포_수"), (2, "일반_점포_수"), (3, "프랜차이즈_점포_수"), (4, "개업_점포_수"), (5, "폐업_점포_수")]:
                    record[pos] += integer(row[col]) or 0
            else:
                record[6] += integer(row["당월_매출_금액"]) or 0
                record[7] += integer(row["당월_매출_건수"]) or 0
                for age in [10, 20, 30, 40, 50, 60]:
                    column = f"연령대_{age}{'_이상' if age == 60 else ''}_매출_금액"
                    group_sales[q, kind, code, industry[:3], f"age_{age}"] += integer(row[column]) or 0
    db.executemany("INSERT INTO report_details VALUES (?,?,?,?,?,?) ON CONFLICT DO UPDATE SET value=excluded.value",
                   ((*key, value) for key, value in detail.items()))
    db.executemany("""INSERT INTO report_industries VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT DO UPDATE SET name=excluded.name,
        stores=CASE WHEN excluded.stores IS NOT NULL THEN excluded.stores ELSE report_industries.stores END,
        regular=CASE WHEN excluded.regular IS NOT NULL THEN excluded.regular ELSE report_industries.regular END,
        franchise=CASE WHEN excluded.franchise IS NOT NULL THEN excluded.franchise ELSE report_industries.franchise END,
        opened=CASE WHEN excluded.opened IS NOT NULL THEN excluded.opened ELSE report_industries.opened END,
        closed=CASE WHEN excluded.closed IS NOT NULL THEN excluded.closed ELSE report_industries.closed END,
        sales=CASE WHEN excluded.sales IS NOT NULL THEN excluded.sales ELSE report_industries.sales END,
        transactions=CASE WHEN excluded.transactions IS NOT NULL THEN excluded.transactions ELSE report_industries.transactions END""",
        ((q, k, code, industry, *record[:6], None, None) if group == "stores"
         else (q, k, code, industry, record[0], None, None, None, None, None, record[6], record[7])
         for (q, k, code, industry), record in industries.items()))
    db.executemany("INSERT INTO report_group_sales VALUES (?,?,?,?,?,?) ON CONFLICT DO UPDATE SET value=excluded.value",
                   ((*key, value) for key, value in group_sales.items()))
    db.commit()
    print(f"{group} {kind}: 세부값 {len(detail):,}개, 업종 {len(industries):,}개", flush=True)


def main(db_path=DB, zip_path=ZIP):
    if not db_path.exists() or not zip_path.exists():
        raise FileNotFoundError("원본 ZIP과 data/commerce.sqlite가 필요합니다. 먼저 npm run import:raw를 실행하세요.")
    db = sqlite3.connect(db_path)
    db.executescript("""CREATE TABLE IF NOT EXISTS report_details (
        quarter TEXT,kind TEXT,region_code TEXT,category TEXT,key TEXT,value REAL,
        PRIMARY KEY(quarter,kind,region_code,category,key));
    CREATE TABLE IF NOT EXISTS report_industries (
        quarter TEXT,kind TEXT,region_code TEXT,industry_code TEXT,name TEXT,
        stores REAL,regular REAL,franchise REAL,opened REAL,closed REAL,sales REAL,transactions REAL,
        PRIMARY KEY(quarter,kind,region_code,industry_code));""")
    db.execute("""CREATE TABLE IF NOT EXISTS report_group_sales (
        quarter TEXT,kind TEXT,region_code TEXT,industry_group TEXT,key TEXT,value REAL,
        PRIMARY KEY(quarter,kind,region_code,industry_group,key))""")
    quarters = {r[0] for r in db.execute("SELECT DISTINCT quarter FROM observations ORDER BY quarter DESC LIMIT 5")}
    valid = {kind: {r[0] for r in db.execute("SELECT DISTINCT region_code FROM observations WHERE kind=?", (kind,))}
             for kind in ("area", "dong")}
    with zipfile.ZipFile(zip_path) as archive:
        for group, (pattern, fields) in SPECS.items():
            names = [n for n in archive.namelist() if n.endswith(f"({pattern}).csv")]
            if len(names) != 1:
                raise ValueError(f"{pattern} CSV를 찾을 수 없습니다.")
            with archive.open(names[0]) as stream:
                reader = csv.DictReader(io.TextIOWrapper(stream, encoding="cp949", newline=""))
                import_source(db, reader, "area", group, fields, quarters, valid)
    for group in ("stores", "sales", "footfall", "residents"):
        with (zip_path.parent / f"dong/{group}.csv").open(encoding="cp949", newline="") as stream:
            import_source(db, csv.DictReader(stream), "dong", group, SPECS[group][1], quarters, valid)
    db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ZIP)
    parser.add_argument("--db", type=Path, default=DB)
    args = parser.parse_args()
    main(args.db, args.source)
