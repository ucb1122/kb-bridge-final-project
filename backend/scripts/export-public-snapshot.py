"""Export only four allowlisted public-statistics tables; never open users.sqlite."""
import sqlite3, gzip, json, pathlib, hashlib
root = pathlib.Path(__file__).resolve().parents[2]
out = root / 'data' / 'public-snapshot'
out.mkdir(exist_ok=True)
db = sqlite3.connect((root/'data/commerce.sqlite').as_uri()+'?mode=ro', uri=True)
manifest = {'format': 1, 'source': '서울특별시 서울 열린데이터광장 / 공공데이터포털(data.go.kr)', 'tables': [], 'note': '공개 집계통계의 배포용 논리 사본. 결측치와 원본 수치를 변경하지 않음. 사용자 DB 제외.'}
for name in ['observations','report_details','report_industries','report_group_sales']:
    sql = db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?",(name,)).fetchone()[0]
    indexes = [r[0] for r in db.execute("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL",(name,))]
    filename = name+'.jsonl.gz'
    rows = 0
    with gzip.open(out/filename,'wt',encoding='utf-8',newline='\n') as f:
        f.write(json.dumps({'schema': sql, 'indexes': indexes},ensure_ascii=False)+'\n')
        for row in db.execute('SELECT * FROM '+name):
            f.write(json.dumps(row,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n'); rows+=1
    manifest['tables'].append({'name':name,'file':filename,'rows':rows,'sha256':hashlib.file_digest(open(out/filename,'rb'),'sha256').hexdigest()})
db.close()
for filename in ['commerce.geojson','commerce-dong.geojson']:
    with open(root/'data'/filename,'rb') as src, gzip.open(out/(filename+'.gz'),'wb') as dst:
        dst.write(src.read())
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False))
