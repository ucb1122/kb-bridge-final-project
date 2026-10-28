# 매출 연동 상환 화면용: 상권×업종 분기 매출 패턴(2023Q1~2025Q4, 평균=100) 생성
# 입력: 서울시 상권분석서비스 추정매출-상권 (~/mnt/dev/seoul_public_data/13_추정매출-상권)
# 출력: assets/revenue-pattern.json  (값은 '그 분기 매출 / 12분기 평균 x 100' 정수. 금액은 담지 않음)
import pandas as pd, numpy as np, zipfile, glob, io, json, os, datetime
SD=os.path.expanduser('~/mnt/dev/seoul_public_data/13_추정매출-상권')
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','assets','revenue-pattern.json')
Q=[20231,20232,20233,20234,20241,20242,20243,20244,20251,20252,20253,20254]
cols=['기준_년분기_코드','상권_코드','서비스_업종_코드','서비스_업종_코드_명','당월_매출_금액']
L=[]
for z in sorted(glob.glob(f'{SD}/*.zip')):
    zf=zipfile.ZipFile(z); L.append(pd.read_csv(io.BytesIO(zf.read(zf.namelist()[0])),encoding='cp949',usecols=cols))
L.append(pd.read_csv(f'{SD}/서울시 상권분석서비스(추정매출-상권).csv',encoding='cp949',usecols=cols))
s=pd.concat(L).drop_duplicates(['기준_년분기_코드','상권_코드','서비스_업종_코드_명'])
s=s[s['기준_년분기_코드'].isin(Q)]
codemap=s.drop_duplicates('서비스_업종_코드_명').set_index('서비스_업종_코드_명')['서비스_업종_코드'].astype(str).to_dict()
GROUP={'CS1':'외식업','CS2':'서비스업','CS3':'소매업'}
pv=s.pivot_table(index=['상권_코드','서비스_업종_코드_명'],columns='기준_년분기_코드',values='당월_매출_금액').reindex(columns=Q)
pv=pv[(pv.notna().sum(1)==len(Q))&(pv.min(1)>0)]
flat=int((pv.nunique(1)<=1).sum()); pv=pv[pv.nunique(1)>1]  # 12분기 값이 모두 같은 조합은 변동 정보를 줄 수 없어 제외 → 자치구/서울 값으로 대체
print('값이 모두 같은 조합 제외',flat)
ratio=pv.div(pv.mean(1),axis=0)
inds=sorted(ratio.index.get_level_values(1).unique())
idx={n:i for i,n in enumerate(inds)}
areas={}
for (code,ind),row in ratio.iterrows():
    areas.setdefault(str(code),{})[str(idx[ind])]=[int(round(x*100)) for x in row.values]
dist=pd.read_csv(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','analysis','generated','closure-priority-2027.csv'),dtype={'code':str}).set_index('code')['district'].to_dict()
rd=ratio.copy(); rd['district']=[dist.get(str(c)) for c in rd.index.get_level_values(0)]; rd=rd.dropna(subset=['district'])
dmed={}
for (dname,ind),g in rd.groupby(['district',rd.index.get_level_values(1)]):
    if len(g)<3: continue
    m=g[Q].median(); m=m/m.mean(); dmed.setdefault(dname,{})[str(idx[ind])]=[int(round(x*100)) for x in m.values]
med=ratio.groupby(level=1).median()
med=med.div(med.mean(1),axis=0)
cnt=ratio.groupby(level=1).size()
out={'schemaVersion':1,'kind':'revenue-pattern','generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
 'source':'서울시 상권분석서비스(추정매출-상권), 서울 열린데이터광장','quarters':Q,'unit':'분기 매출 / 12분기 평균 x 100',
 'note':'상권 전체 추정매출의 패턴이며 개별 가게 매출이 아닙니다.',
 'industries':inds,'industryCodes':[codemap.get(n,'') for n in inds],'industryGroups':[GROUP.get(codemap.get(n,'')[:3],'기타') for n in inds],'groupRule':'서비스_업종_코드 앞 3자리: CS1 외식업 · CS2 서비스업 · CS3 소매업','seoulMedian':{str(idx[k]):[int(round(x*100)) for x in r.values] for k,r in med.iterrows()},
 'districtMedian':dmed,'districtRule':'같은 자치구에서 해당 업종 상권 3곳 이상일 때 분기별 중앙값','industryAreaCount':{str(idx[k]):int(v) for k,v in cnt.items()},'areas':areas}
json.dump(out,open(OUT,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print('업종',len(inds),'상권',len(areas),'조합',len(ratio),'bytes',os.path.getsize(OUT))
