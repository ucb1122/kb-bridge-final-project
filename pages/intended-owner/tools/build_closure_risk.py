"""Reproduce notebook cells 5/6/9/10 and the closure-rate OLS in cell 36.
No Colab installation, Drive mount, G classifier, or original-file edits.
OLS is solved with numpy.linalg.lstsq (intercept + treatment-coded type).
"""
from pathlib import Path
import argparse, datetime, hashlib, json, math, re
import numpy as np
import pandas as pd

ROOT=Path(__file__).resolve().parents[3]
PAGE=Path(__file__).resolve().parents[1]
def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for part in iter(lambda:f.read(1024*1024),b''): h.update(part)
    return h.hexdigest()

def fit_ols(frame, categories):
    x=matrix(frame,categories)
    beta,_,rank,_=np.linalg.lstsq(x,frame['y'].to_numpy(float),rcond=None)
    if rank!=x.shape[1]: raise ValueError('OLS design is not full rank')
    return beta
def matrix(frame,categories):
    return np.column_stack([np.ones(len(frame)),frame['close_now'].to_numpy(float),frame['logstore'].to_numpy(float)]+[(frame['typ']==t).astype(float).to_numpy() for t in categories[1:]])
def safe(v):
    if isinstance(v,dict):return {k:safe(x) for k,x in v.items()}
    if isinstance(v,(list,tuple)):return [safe(x) for x in v]
    if isinstance(v,(np.integer,)):return int(v)
    if isinstance(v,(np.floating,float)):return float(v) if np.isfinite(v) else None
    if isinstance(v,np.bool_):return bool(v)
    return v

def build(data_dir, notebook_path, output):
    paths=sorted(data_dir.glob('*'))
    def one(token,year=None,ext='.csv'):
        m=[p for p in paths if token in p.name and (year is None or f'{year}년' in p.name) and p.suffix==ext]
        if len(m)!=1:raise ValueError(f'Expected one source {token} {year}: {m}')
        return str(m[0])
    years=range(2021,2026)
    files={'store':{y:[one('점포',y)] for y in years},'sales':{y:[one('추정매출',y)] for y in years},'flow':[one('길단위인구')],'change':[one('상권변화지표')],'area':[one('영역')],'jumin':[one('주민등록',ext='.xlsx')]}
    notebook=json.loads(notebook_path.read_text(encoding='utf-8'))
    ns={'pd':pd,'np':np,'re':re,'FILES':files,'YEARS':years}
    source_cells={}
    for i in [5,6,9,10]:
        code=''.join(notebook['cells'][i]['source']);source_cells[str(i)]=hashlib.sha256(code.encode()).hexdigest()
        exec(compile(code,f'{notebook_path.name}:cell{i}','exec'),ns)
    a,idx,area=ns['a'],ns['idx'],ns['area']
    assert not a.duplicated(['상권_코드','연도']).any()
    assert not idx.duplicated(['상권_코드','연도']).any()
    if len(area)!=1650 or area['상권_코드'].duplicated().any():raise ValueError('Area source differs from notebook universe')
    if not (a['n_q']==4).all():raise ValueError('Incomplete quarterly source; review before rerun')
    o=a[['상권_코드','연도','점포','폐업']].copy()
    o['폐업률']=np.where(o['점포']>0,o['폐업']/o['점포']*100,np.nan)
    base=idx[['상권_코드','연도','G지수','단계']+[v+'_코드' for v in ns['V6']]].merge(o,on=['상권_코드','연도'],validate='one_to_one')
    keep=[v for v in ns['V6'] if v!='창폐업'];weights=np.array([ns['W'][v] for v in keep]);weights/=weights.sum()
    base['G5']=sum(w*base[v+'_코드'] for w,v in zip(weights,keep))
    base['G5_z']=base.groupby('연도')['G5'].transform(lambda s:(s-s.mean())/s.std())
    base['close_now']=base['폐업률'];base['logstore']=np.log1p(base['점포'])
    base=base.merge(area[['상권_코드','상권_구분_코드_명']],on='상권_코드',validate='many_to_one')
    base['typ']=base['상권_구분_코드_명'].astype(str)
    def cohort(h):
        target=o[['상권_코드','연도','폐업률']].rename(columns={'폐업률':'y'}).copy();target['연도']-=h
        frame=base.merge(target,on=['상권_코드','연도'],validate='one_to_one')
        frame=frame[frame['점포']>=10].dropna(subset=['y','close_now','G5_z','logstore']).copy()
        frame['high']=(frame.y>=frame.groupby('연도').y.transform(lambda s:s.quantile(.75))).astype(int)
        return frame
    validation=[]
    for h in [1,2]:
        frame=cohort(h);parts=[]
        for ty in sorted(y for y in frame['연도'].unique() if (frame['연도']<y).any()):
            train=frame[frame['연도']<ty];test=frame[frame['연도']==ty].copy();cats=sorted(train.typ.unique())
            if not set(test.typ).issubset(cats):raise ValueError('Unseen area type')
            beta=fit_ols(train,cats);test['pred']=matrix(test,cats)@beta
            test['rk']=test.pred.rank(ascending=False,method='first')/len(test);parts.append(test)
        detail=pd.concat(parts,ignore_index=True);chosen=detail['rk']<=.10
        precision=detail.loc[chosen,'high'].mean();recall=detail.loc[chosen,'high'].sum()/detail.high.sum()
        expected=.513 if h==1 else .490
        if abs(precision-expected)>.003:raise ValueError(f'Notebook validation mismatch: h={h} precision={precision}')
        validation.append({'horizonYears':h,'precision':float(precision),'recall':float(recall),'baseline':float(detail.high.mean()),'targetYears':sorted((detail['연도']+h).unique().tolist()),'selectedCount':int(chosen.sum()),'method':'past-input-years-only; top 10%; no retraining on heldout rows'})
    train=cohort(2);cats=sorted(train.typ.unique());beta=fit_ols(train,cats)
    latest=base[base['연도']==2025].copy()
    eligible=latest[(latest['점포']>=10)].dropna(subset=['close_now','G5_z','logstore']).copy()
    eligible['prediction']=matrix(eligible,cats)@beta
    eligible=eligible.sort_values(['prediction','상권_코드'],ascending=[False,True],kind='stable')
    eligible['rank']=range(1,len(eligible)+1)
    n_selected=math.ceil(len(eligible)*.10)
    index={str(int(r['상권_코드'])):r for _,r in eligible.iterrows()}
    latest_index={str(int(r['상권_코드'])):r for _,r in latest.iterrows()}
    rows=[]
    for _,r in area.iterrows():
        code=str(int(r['상권_코드']));row=index.get(code);g=latest_index.get(code)
        status='candidate' if row is not None and row['rank']<=n_selected else 'observed' if row is not None else 'insufficient'
        rows.append({'code':code,'name':r['상권_코드_명'],'district':r['자치구_코드_명'],'dong':r['행정동_코드_명'],'type':r['상권_구분_코드_명'],'status':status,'rank':None if row is None else int(row['rank']),'predictedClosureRate':None if row is None else float(row['prediction']),'currentClosureRate':None if g is None else float(g['close_now']),'averageStores':None if g is None else float(g['점포']),'closedStores':None if g is None else float(g['폐업']),'gIndex':None if g is None else float(g['G지수']),'gStage':None if g is None else str(g['단계']),'missingReason':None if row is not None else 'G지수 입력 미비' if g is None else '연평균 점포 10개 미만 또는 필수 입력 미비'})
    allfiles=[Path(p) for k,v in files.items() for p in ([x[0] for x in v.values()] if isinstance(v,dict) else v)]
    evidence={'schemaVersion':1,'kind':'closure-risk-priority','generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'inputYear':2025,'targetYear':2027,'horizonYears':2,'universeCount':len(rows),'eligibleCount':len(eligible),'candidateCount':n_selected,'unavailableCount':len(rows)-len(eligible),'classificationRule':'Predicted annual area closure rate top 10% (ceil); minimum annual-average stores 10; G-complete cohort matches notebook cell 36','definition':'annual closed stores / annual mean total stores * 100; high outcome is target-year top quartile','model':{'name':'OLS','formula':'y ~ close_now + logstore + C(typ)','solver':'numpy.linalg.lstsq; treatment coding; equivalent OLS objective to notebook statsmodels','trainingInputYears':sorted(train['연도'].unique().tolist()),'trainingTargetYears':sorted((train['연도']+2).unique().tolist()),'trainingRows':len(train),'baselineType':cats[0],'coefficients':dict(zip(['intercept','closureRate','log1pStores']+['type:'+t for t in cats[1:]],beta.tolist()))},'gWeights':ns['W'],'gRole':'reference only; G-complete sample eligibility follows notebook; no G coefficient in ranking','gDefinition':'annual 1%-99% winsorization then -2/-1/1/2 coding by mean, +1sd, +2sd; reverse resident population and operating duration','validation':validation,'caveats':['Report-based closure OLS is used; earlier notebook RF/G model is a different target and is not the displayed ranking.','2025 source -> 2027 estimate, not 2026 observed performance.','Area-level priority is not an individual store closure probability or support eligibility.','Redevelopment/clearance not matched; top candidates need separate field review.','Missing-data regions are not safe; outside top 10% is not low-risk proof.'],'sourceNotice':'출처: 서울특별시 서울 열린데이터광장 / 공공데이터포털(data.go.kr)','provenance':{'notebook':str(notebook_path.relative_to(ROOT)).replace('\\','/'),'notebookSha256':digest(notebook_path),'executedCellSha256':source_cells,'closureCell':36,'closureCellSha256':hashlib.sha256(''.join(notebook['cells'][36]['source']).encode()).hexdigest(),'sources':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':digest(p)} for p in allfiles]},'results':rows}
    report=PAGE/'analysis/sources/상권_폐업위험_금융지원_의사결정_구조_보고서.docx'
    evidence['provenance']['reportSha256']=digest(report)
    evidence['provenance']['builderSha256']=digest(Path(__file__))
    evidence['provenance']['runtime']={'numpy':np.__version__,'pandas':pd.__version__}
    evidence=safe(evidence)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(evidence,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    audit=PAGE/'analysis/generated';audit.mkdir(parents=True,exist_ok=True)
    pd.DataFrame(rows).to_csv(audit/'closure-priority-2027.csv',encoding='utf-8-sig',index=False)
    pd.DataFrame(validation).to_csv(audit/'notebook-validation.csv',encoding='utf-8-sig',index=False)
    print(json.dumps({k:evidence[k] for k in ['eligibleCount','candidateCount','unavailableCount','model','validation']},ensure_ascii=False,indent=2))
    print(pd.DataFrame(rows).dropna(subset=['rank']).sort_values('rank').head(10)[['rank','name','predictedClosureRate','currentClosureRate']].to_string(index=False))

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--data-dir',type=Path,default=PAGE/'analysis/raw');ap.add_argument('--notebook',type=Path,default=PAGE/'analysis/sources/의사결정.ipynb');ap.add_argument('--output',type=Path,default=ROOT/'pages/intended-owner/assets/closure-risk.json');args=ap.parse_args();build(args.data_dir,args.notebook,args.output)
