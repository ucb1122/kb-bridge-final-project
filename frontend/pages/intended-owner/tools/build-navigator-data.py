"""Create a small, page-local, source-traced navigator snapshot. Never change raw data."""
from pathlib import Path
import argparse, hashlib, json

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--project',default=str(Path(__file__).resolve().parents[4]))
    parser.add_argument('--public-data',default=str(Path(__file__).resolve().parents[1]/'analysis/public-boundaries'))
    parser.add_argument('--source-assets',help='unified-regions.json, unified-boundaries.json, neighborhood-places.json이 있는 가공 스냅샷 폴더')
    args=parser.parse_args()
    project=Path(args.project); public=Path(args.public_data); target=project/'pages/intended-owner/assets'
    target.mkdir(parents=True,exist_ok=True)
    source=Path(args.source_assets) if args.source_assets else project/'pages/intended-owner/analysis/map-inputs'
    required=['unified-regions.json','unified-boundaries.json','neighborhood-places.json']
    missing=[name for name in required if not (source/name).is_file()]
    if missing:
        parser.error('가공 스냅샷이 없습니다: '+', '.join(missing)+'. --source-assets로 해당 파일이 있는 폴더를 지정하세요. 웹 화면은 동봉 JSON만으로 실행됩니다.')
    data=json.loads((source/'unified-regions.json').read_text(encoding='utf-8'))
    boundaries=json.loads((source/'unified-boundaries.json').read_text(encoding='utf-8'))
    meta=public/'05-08_상권영역/seoul_trdar_boundary.geojson.meta.json'
    raw=public/'05-08_상권영역/seoul_trdar_boundary.geojson'
    raw_data=json.loads(raw.read_text(encoding='utf-8'))
    source_meta=json.loads(meta.read_text(encoding='utf-8'))
    assert len(raw_data['features'])==source_meta['features']==1650
    original_codes={str(f['properties']['TRDAR_CD']) for f in raw_data['features']}
    features=[]; regions=[]; known=set(); omitted=[]
    for kind in ['area','dong']:
        for feature in boundaries[kind]['features']:
            code=str(feature['properties']['code'])
            row=data['regions'][kind].get(code)
            if not row:
                omitted.append({'kind':kind,'code':code,'reason':'공식 경계에 있으나 현재 화면 통계·명칭 스냅샷과 연결되지 않음'})
                continue
            key=kind+':'+code
            if key in known: raise ValueError('Duplicate region '+key)
            known.add(key)
            current=row.get('periods',{}).get(data['quarter'],{})
            regions.append({k:row.get(k) for k in ['code','name','district','lat','lng','kind','type','dong']} | {
                'quarter':data['quarter'], 'metrics':{
                    'stores':current.get('storesTotal'), 'sales':current.get('salesTotal'),
                    'floating':current.get('floating'), 'worker':current.get('worker')
                }})
            features.append({'type':'Feature','properties':{
                'code':code,'kind':kind,'name':row['name'],'district':row['district']
            },'geometry':feature['geometry']})
    assert {r['code'] for r in regions if r['kind']=='area'}==original_codes
    places=json.loads((source/'neighborhood-places.json').read_text(encoding='utf-8'))['places']
    places=[r for r in places if r.get('kind')=='subway' and 37.4<=r.get('lat',0)<=37.72 and 126.76<=r.get('lng',0)<=127.2]
    snapshot={'schemaVersion':1,'quarter':data['quarter'], 'sourceNotice':'출처: 서울특별시 서울 열린데이터광장 / 공공데이터포털(data.go.kr)',
              'notice':'지역 전체 공공 집계값이며 개별 가게의 매출·임대료·폐업 확률이 아닙니다.',
              'regions':regions,'places':places}
    files={source/'unified-regions.json':'기존 Node 페이지 검증 스냅샷',source/'unified-boundaries.json':'기존 공식 경계',raw:'확보한 WGS84 원본',meta:'원본 메타정보'}
    provenance={'createdAt':'2026-10-26','sourceNotice':snapshot['sourceNotice'],
                'packaged':{'areaCount':1650,'dongCount':sum(r['kind']=='dong' for r in regions),'period':data['quarter']},'omittedBoundaries':omitted,
                'sources':[{'file':str(p),'description':desc,'sha256':digest(p)} for p,desc in files.items()],
                'publicBoundaryMetadata':source_meta,
                'limits':['미래 과열 여부·개별 임대료·폐업확률은 산출하지 않음','자치구·상권·행정동은 별도 지역 단위','경계 좌표를 재변환하거나 값을 0으로 채우지 않음']}
    for name,obj in [('regions.json',snapshot),('boundaries.json',{'type':'FeatureCollection','features':features}),('provenance.json',provenance)]:
        (target/name).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'regions':len(regions),'areas':1650,'subwayPlaces':len(places),'packagedBytes':sum((target/n).stat().st_size for n in ['regions.json','boundaries.json','provenance.json'])}))

if __name__=='__main__':main()
