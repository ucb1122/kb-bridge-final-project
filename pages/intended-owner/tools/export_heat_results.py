"""Export reviewed Python/Colab results to the existing interactive map contract.

CSV fields: regionCode, classification, reason, evidence (a JSON array).
No model, threshold, classification, missing value or reviewer is invented here.
"""
import argparse
import csv
import datetime
import json
import math
import re
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / 'assets'

def valid_date(value):
    try:
        return isinstance(value, str) and datetime.date.fromisoformat(value).isoformat() == value
    except (ValueError, TypeError):
        return False

def nonempty(value):
    return isinstance(value, str) and bool(value.strip())

def build_payload(metadata, rows, known_codes):
    if not isinstance(metadata, dict):
        raise ValueError('분석 메타정보가 필요합니다.')
    review = metadata.get('review', {})
    periods = metadata.get('referencePeriods')
    if metadata.get('regionKind') != 'area' or not valid_date(metadata.get('asOfDate')):
        raise ValueError('개별 상권 단위와 올바른 기준일이 필요합니다.')
    if not all(nonempty(metadata.get(key)) for key in ('analysisVersion','source','definition')):
        raise ValueError('분석 버전·출처·분류 기준이 필요합니다.')
    if not isinstance(periods, list) or not periods or not all(isinstance(p,dict) and nonempty(p.get('indicator')) and nonempty(p.get('period')) for p in periods):
        raise ValueError('지표별 자료 기간이 필요합니다.')
    if metadata.get('scope') not in ('observed-classification','forecast'):
        raise ValueError('관측 분류와 예측을 구분해 주세요.')
    if metadata.get('scope') == 'forecast' and not nonempty(metadata.get('predictionHorizon')):
        raise ValueError('예측 대상 기간이 필요합니다.')
    if not isinstance(review,dict) or review.get('approved') is not True or not valid_date(review.get('reviewedAt')) or not all(nonempty(review.get(k)) for k in ('reviewedBy','method')):
        raise ValueError('실제 팀 검토 완료 정보가 필요합니다. 자동 승인하지 않습니다.')
    results, seen = [], set()
    for index, row in enumerate(rows, 1):
        code = row.get('regionCode')
        classification = row.get('classification')
        if not isinstance(code,str) or not re.fullmatch(r'\d{7}',code) or code not in known_codes or code in seen:
            raise ValueError(f'{index}행의 상권코드·중복·공식 경계 연결을 확인해 주세요.')
        if classification not in ('overheated','not_overheated','unknown') or not nonempty(row.get('reason')):
            raise ValueError(f'{index}행의 분류값과 판단 설명이 필요합니다.')
        evidence = row.get('evidence')
        if isinstance(evidence,str):
            evidence = json.loads(evidence) if evidence.strip() else []
        if not isinstance(evidence,list):
            raise ValueError(f'{index}행의 evidence는 JSON 배열이어야 합니다.')
        for item in evidence:
            if not isinstance(item,dict) or 'value' not in item or not all(nonempty(item.get(k)) for k in ('label','unit','period')):
                raise ValueError(f'{index}행의 근거 이름·단위·기간이 필요합니다.')
            value = item.get('value')
            if value is not None and (isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value)):
                raise ValueError(f'{index}행의 근거 값은 숫자 또는 null이어야 합니다.')
        if classification != 'unknown' and not any(isinstance(e.get('value'),(int,float)) and not isinstance(e.get('value'),bool) for e in evidence):
            raise ValueError(f'{index}행의 분류에는 숫자로 확인된 근거가 필요합니다.')
        seen.add(code)
        results.append({'regionCode':code,'classification':classification,'reason':row['reason'],'evidence':evidence})
    if not results:
        raise ValueError('내보낼 결과가 없습니다.')
    return {'schemaVersion':1,'metadata':metadata,'results':results}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv',type=Path,required=True)
    parser.add_argument('--metadata',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=ASSETS/'heat-results.json')
    parser.add_argument('--overwrite',action='store_true')
    parser.add_argument('--activate',action='store_true',help='검증된 결과를 현재 지도 연결 설정에 반영')
    args = parser.parse_args()
    try:
        with args.csv.open(encoding='utf-8-sig',newline='') as source:
            rows = list(csv.DictReader(source))
        metadata = json.loads(args.metadata.read_text(encoding='utf-8-sig'))
        regions = json.loads((ASSETS/'regions.json').read_text(encoding='utf-8-sig'))
        codes = {str(row['code']) for row in regions['regions'] if row['kind']=='area'}
        payload = build_payload(metadata,rows,codes)
        output = args.output.resolve()
        if output in (args.csv.resolve(),args.metadata.resolve(),(ASSETS/'regions.json').resolve(),(ASSETS/'heat-connection.json').resolve()):
            raise ValueError('입력 원본이나 연결 설정을 결과 파일로 덮어쓸 수 없습니다.')
        if output.exists() and not args.overwrite:
            raise ValueError('결과 파일이 이미 있습니다. 새 이름 또는 --overwrite를 명시해 주세요.')
        if args.activate and (output.parent != ASSETS.resolve() or not re.fullmatch(r'[A-Za-z0-9_.-]+\.json',output.name)):
            raise ValueError('연결할 결과는 assets 바로 아래의 영문 JSON 파일이어야 합니다.')
        output.parent.mkdir(parents=True,exist_ok=True)
        output.write_text(json.dumps(payload,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
        if args.activate:
            connection = {'schemaVersion':1,'resultFile':output.name,'status':'connected','message':'팀 검토 완료 결과 연결'}
            (ASSETS/'heat-connection.json').write_text(json.dumps(connection,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(f'{len(payload["results"])}개 검증 결과 저장: {output}')
    except (ValueError,OSError,KeyError,TypeError,OverflowError) as error:
        parser.exit(2,f'연결하지 않았습니다: {error}\n')

if __name__=='__main__':
    main()
