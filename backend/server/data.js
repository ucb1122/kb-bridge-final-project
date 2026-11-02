import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const kinds=new Set(['dong','area']),metrics=new Set(['stores','sales','salesPerStore','footfall','residents']);
const criteria=new Set(['growth','highest','absolute','decline']),comparisons=new Set(['previous','same']),industries=new Set(['all','CS1','CS2','CS3']);
function open(){const dbPath=path.resolve(root,process.env.DB_PATH||'data/commerce.sqlite');return fs.existsSync(dbPath)?new DatabaseSync(dbPath,{readOnly:true}):null}
function displayRegionName(name){return name?.replaceAll('?','·')}
function officialSnapshot(quarter){
  const filename=path.join(root,'data',`official-rankings-${quarter}.json`);
  if(!fs.existsSync(filename))return null;
  const snapshot=JSON.parse(fs.readFileSync(filename,'utf8'));
  return snapshot.quarter===quarter?snapshot:null;
}
function officialReportSales(quarter,kind,code){
  const filename=path.join(root,'data',`official-report-sales-${quarter}.json`);
  if(!fs.existsSync(filename))return null;
  const snapshot=JSON.parse(fs.readFileSync(filename,'utf8'));
  return snapshot.quarter===quarter?snapshot.values?.[`${kind}:${code}`]??null:null;
}
function officialDongWorkers(code){
  const filename=path.join(root,'data','official-dong-workers-20252-20262.json');
  if(!fs.existsSync(filename))return {};
  return JSON.parse(fs.readFileSync(filename,'utf8')).values?.[code]??{};
}
export function getFilters(){
  const db=open();if(!db)return {quarters:[],districts:[],available:false};
  try{return {quarters:db.prepare("SELECT quarter FROM observations GROUP BY quarter HAVING COUNT(DISTINCT kind || ':' || metric)=8 ORDER BY quarter DESC").all().map(x=>x.quarter),districts:db.prepare("SELECT DISTINCT district FROM observations WHERE district != '' ORDER BY district").all().map(x=>x.district),available:true}}finally{db.close()}
}
export function findChatRegion(question){
  const db=open();if(!db)return null;
  try{
    const rows=db.prepare(`SELECT kind,region_code AS code,region_name AS name,district,MAX(quarter) AS quarter
      FROM observations WHERE metric='stores' GROUP BY kind,region_code,region_name,district`).all();
    const normalized=String(question).replace(/\s+/g,'');
    const matches=rows.filter(row=>normalized.includes(row.name.replace(/\s+/g,'')));
    matches.sort((a,b)=>b.name.length-a.name.length||(a.kind==='dong'?-1:1));
    return matches[0]||null;
  }finally{db.close()}
}
function customRankings(db,{kind,metric,quarter,district,criterion,comparison,industry,period,year}){
  const reference=period==='year'?String(Number(year)-1):comparison==='same'?`${Number(quarter.slice(0,4))-1}${quarter.slice(4)}`:
    String(Number(quarter.slice(4))===1?Number(quarter.slice(0,4))-1:Number(quarter.slice(0,4)))+String(Number(quarter.slice(4))===1?4:Number(quarter.slice(4))-1);
  const currentQuarters=period==='year'?db.prepare('SELECT DISTINCT quarter FROM observations WHERE substr(quarter,1,4)=? ORDER BY quarter').all(year).map(x=>x.quarter):[quarter];
  if(!currentQuarters.length)return {quarter,year,period,rows:[],available:true,rankingSource:'calculated'};
  let selectedQuarters=period==='year'&&['stores','residents'].includes(metric)?[currentQuarters.at(-1)]:currentQuarters;
  if(period==='year'&&industry!=='all'&&criterion!=='highest'){
    const detailed=new Set(db.prepare('SELECT DISTINCT quarter FROM report_industries').all().map(x=>x.quarter));
    selectedQuarters=selectedQuarters.filter(q=>detailed.has(q)&&detailed.has(`${Number(q.slice(0,4))-1}${q.slice(4)}`));
  }
  const referenceQuarters=selectedQuarters.map(q=>period==='year'?`${Number(q.slice(0,4))-1}${q.slice(4)}`:reference);
  const metricColumn=metric==='stores'?'stores':'sales';
  const readValues=quarters=>{
    if(!quarters.length)return new Map();
    const marks=quarters.map(()=>'?').join(',');
    const query=industry==='all'
      ?`SELECT region_code AS code,SUM(value) AS value FROM observations WHERE kind=? AND metric=? AND quarter IN (${marks}) GROUP BY region_code`
      :`SELECT region_code AS code,SUM(${metricColumn}) AS value FROM report_industries WHERE kind=? AND substr(industry_code,1,3)=? AND quarter IN (${marks}) GROUP BY region_code`;
    const params=industry==='all'?[kind,metric,...quarters]:[kind,industry,...quarters];
    return new Map(db.prepare(query).all(...params).map(row=>[row.code,row.value]));
  };
  const current=readValues(selectedQuarters),previous=readValues(referenceQuarters);
  const metadata=db.prepare(`SELECT region_code AS code,region_name AS name,district,lat,lng FROM observations
    WHERE kind=? AND metric='stores' AND quarter=? AND (?='' OR district=?)`).all(kind,currentQuarters.at(-1),district,district);
  const rows=metadata.flatMap(row=>{
    const value=current.get(row.code),prior=previous.get(row.code);
    if(!Number.isFinite(value)||criterion!=='highest'&&!Number.isFinite(prior))return [];
    const delta=Number.isFinite(prior)?value-prior:null;
    const change=Number.isFinite(prior)&&prior>0?delta/prior:null;
    return [{...row,name:displayRegionName(row.name),value,previous:prior??null,delta,change}];
  });
  const score=row=>criterion==='highest'?row.value:criterion==='absolute'?row.delta:criterion==='decline'?(row.change==null?null:-row.change):row.change;
  rows.sort((a,b)=>(score(b)??-Infinity)-(score(a)??-Infinity)||b.value-a.value||a.code.localeCompare(b.code));
  return {quarter:currentQuarters.at(-1),year,period,rows:rows.slice(0,10),available:true,rankingSource:'calculated'};
}
function averageSalesRankings(db,{kind,quarter,district,criterion,comparison,industry,period,year}){
  const currentQuarter=period==='year'?db.prepare("SELECT MAX(quarter) AS value FROM observations WHERE substr(quarter,1,4)=?").get(year).value:quarter;
  if(!currentQuarter)return {quarter,rows:[],available:true,rankingSource:'calculated'};
  const reference=period==='year'||comparison==='same'?`${Number(currentQuarter.slice(0,4))-1}${currentQuarter.slice(4)}`:
    String(Number(currentQuarter.slice(4))===1?Number(currentQuarter.slice(0,4))-1:Number(currentQuarter.slice(0,4)))+String(Number(currentQuarter.slice(4))===1?4:Number(currentQuarter.slice(4))-1);
  const readValues=q=>{
    const sql=industry==='all'
      ?`SELECT s.region_code AS code,s.value AS sales,n.value AS stores FROM observations s JOIN observations n
         ON n.quarter=s.quarter AND n.kind=s.kind AND n.region_code=s.region_code AND n.metric='stores'
         WHERE s.quarter=? AND s.kind=? AND s.metric='sales'`
      :`SELECT region_code AS code,SUM(sales) AS sales,SUM(stores) AS stores FROM report_industries
         WHERE quarter=? AND kind=? AND substr(industry_code,1,3)=? GROUP BY region_code`;
    const rows=industry==='all'?db.prepare(sql).all(q,kind):db.prepare(sql).all(q,kind,industry);
    return new Map(rows.filter(row=>row.stores>0&&row.sales!=null).map(row=>[row.code,row.sales/3/row.stores]));
  };
  const current=readValues(currentQuarter),previous=readValues(reference);
  const metadata=db.prepare(`SELECT region_code AS code,region_name AS name,district,lat,lng FROM observations
    WHERE quarter=? AND kind=? AND metric='stores' AND (?='' OR district=?)`).all(currentQuarter,kind,district,district);
  const rows=metadata.flatMap(row=>{
    const value=current.get(row.code),prior=previous.get(row.code);
    if(!Number.isFinite(value)||criterion!=='highest'&&!Number.isFinite(prior))return [];
    const delta=Number.isFinite(prior)?value-prior:null;
    const change=Number.isFinite(prior)&&prior>0?delta/prior:null;
    return [{...row,name:displayRegionName(row.name),value,previous:prior??null,delta,change}];
  });
  const score=row=>criterion==='highest'?row.value:criterion==='absolute'?row.delta:criterion==='decline'?(row.change==null?null:-row.change):row.change;
  rows.sort((a,b)=>(score(b)??-Infinity)-(score(a)??-Infinity)||b.value-a.value||a.code.localeCompare(b.code));
  return {quarter:currentQuarter,year,period,rows:rows.slice(0,10),available:true,rankingSource:'calculated'};
}
export function getRankings({kind='dong',metric='stores',quarter,district='',criterion='growth',comparison='previous',industry='all',period='quarter',year}={}){
  if(!kinds.has(kind)||!metrics.has(metric)||district.length>100||quarter&&!/^20\d{2}[1-4]$/.test(quarter)||!criteria.has(criterion)||!comparisons.has(comparison)||!industries.has(industry)||!['quarter','year'].includes(period)||year&&!/^20\d{2}$/.test(year)||industry!=='all'&&!['stores','sales','salesPerStore'].includes(metric))throw Error('잘못된 조회 조건입니다.');
  const db=open();if(!db)return {rows:[],quarter:null,available:false};
  try{
    quarter ||= db.prepare('SELECT MAX(quarter) AS value FROM observations').get().value;
    if(!quarter)return {rows:[],quarter:null,available:true};
    year ||= quarter.slice(0,4);
    if(metric==='salesPerStore')return averageSalesRankings(db,{kind,quarter,district,criterion,comparison,industry,period,year});
    if(criterion!=='growth'||comparison!=='previous'||industry!=='all'||period!=='quarter')return customRankings(db,{kind,metric,quarter,district,criterion,comparison,industry,period,year});
    const rows=db.prepare(`SELECT o.region_code AS code,o.region_name AS name,o.district,o.value,o.lat,o.lng,
      (SELECT p.value FROM observations p WHERE p.quarter =
        (SELECT MAX(q.quarter) FROM observations q WHERE q.quarter < o.quarter)
        AND p.kind=o.kind AND p.metric=o.metric AND p.region_code=o.region_code) AS previous
      FROM observations o WHERE o.quarter=? AND o.kind=? AND o.metric=? AND (?='' OR o.district=?)
      ORDER BY CASE WHEN previous>0 THEN 1.0*(o.value-previous)/previous ELSE -999 END DESC,
        o.region_code DESC`).all(quarter,kind,metric,district,district);
    const byCode=new Map(rows.map(row=>[row.code,row]));
    const snapshot=officialSnapshot(quarter);
    const stored=snapshot?.entries?.[`${kind}:${metric}:${district}`];
    const reference=stored?.every(code=>byCode.has(code))?stored:null;
    if(reference){
      const ordered=reference.map(code=>byCode.get(code));
      const used=new Set(ordered.map(row=>row.code));
      rows.splice(0,rows.length,...ordered,...rows.filter(row=>!used.has(row.code)));
    }
    return {quarter,rows:rows.slice(0,10).map(row=>{
      const key=`${kind}:${metric}:${row.code}`;
      const officialValue=reference&&metric==='sales'?snapshot.values?.[key]:null;
      const officialRate=reference?snapshot.rates?.[key]:null;
      return {...row,name:displayRegionName(row.name),value:officialValue!=null?Math.round(officialValue*1e8):row.value,
        change:officialRate!=null?officialRate/100:row.previous>0?(row.value-row.previous)/row.previous:null};
    }),available:true,rankingSource:reference?'official':'calculated'};
  }finally{db.close()}
}
export function getRegionSummary({kind,code,quarter}={}){
  if(!kinds.has(kind)||!code||code.length>100||!/^20\d{2}[1-4]$/.test(quarter||''))throw Error('잘못된 조회 조건입니다.');
  const db=open();if(!db)return null;
  try{
    const rows=db.prepare(`SELECT metric,value,region_name AS name,district,lat,lng,
      (SELECT p.value FROM observations p WHERE p.quarter=(SELECT MAX(q.quarter) FROM observations q WHERE q.quarter<o.quarter)
       AND p.kind=o.kind AND p.metric=o.metric AND p.region_code=o.region_code) AS previous
      FROM observations o WHERE quarter=? AND kind=? AND region_code=?`).all(quarter,kind,code);
    if(!rows.length)return null;
    const history=db.prepare(`SELECT quarter,metric,value FROM observations
      WHERE kind=? AND region_code=? AND quarter<=? AND quarter>=?
      ORDER BY quarter`).all(kind,code,quarter,String(Number(quarter.slice(0,4))-1)+quarter.slice(4));
    const snapshot=officialSnapshot(quarter);
    const located=rows.find(row=>Number.isFinite(row.lat)&&Number.isFinite(row.lng));
    return {code,kind,quarter,name:displayRegionName(rows[0].name),district:rows[0].district,
      lat:located?.lat??null,lng:located?.lng??null,
      analysisAreaM2:snapshot?.areas?.[`${kind}:${code}`]??null,
      officialSalesEok:snapshot?.values?.[`${kind}:sales:${code}`]??null,
      officialReportSales:officialReportSales(quarter,kind,code),
      metrics:Object.fromEntries(rows.map(x=>[x.metric,{value:x.value,change:x.previous>0?(x.value-x.previous)/x.previous:null}])),history};
  }finally{db.close()}
}
function buildRegionReport(query={}){
  const selectedIndustry=query.industry||'all';
  if(!industries.has(selectedIndustry))throw Error('잘못된 업종 조건입니다.');
  const summary=getRegionSummary(query);
  if(!summary)return null;
  const db=open();
  try{
    if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='report_details'").get())
      return {...summary,details:{},industries:[],detailAvailable:false};
    const rows=db.prepare(`SELECT quarter,category,key,value FROM report_details
      WHERE kind=? AND region_code=? AND quarter<=? AND quarter>=? ORDER BY quarter`).all(
      summary.kind,summary.code,summary.quarter,String(Number(summary.quarter.slice(0,4))-1)+summary.quarter.slice(4));
    const details={};
    for(const row of rows)(details[row.quarter]??={})[row.category]??={};
    for(const row of rows)details[row.quarter][row.category][row.key]=row.value;
    if(summary.kind==='dong')for(const [quarter,total] of Object.entries(officialDongWorkers(summary.code))){
      if(details[quarter]?.workers?.total==null)(details[quarter]??={}).workers={...details[quarter]?.workers,total};
    }
    const industries=db.prepare(`SELECT industry_code AS code,name,stores,regular,franchise,opened,closed,sales,transactions
      FROM report_industries WHERE kind=? AND region_code=? AND quarter=? ORDER BY stores DESC`).all(summary.kind,summary.code,summary.quarter);
    const industryHistory=db.prepare(`SELECT quarter,SUBSTR(industry_code,1,3) AS group_code,SUM(stores) AS stores
      FROM report_industries WHERE kind=? AND region_code=? AND quarter<=? AND quarter>=? AND stores IS NOT NULL
      GROUP BY quarter,SUBSTR(industry_code,1,3) ORDER BY quarter`).all(summary.kind,summary.code,
      summary.quarter,String(Number(summary.quarter.slice(0,4))-1)+summary.quarter.slice(4));
    const groupSales=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='report_group_sales'").get()
      ?db.prepare(`SELECT industry_group AS group_code,key,value FROM report_group_sales
        WHERE kind=? AND region_code=? AND quarter=?`).all(summary.kind,summary.code,summary.quarter):[];
    const benchmarks=db.prepare(`SELECT metric,
      SUM(CASE WHEN district=? THEN value ELSE 0 END) AS district,
      SUM(value) AS city FROM observations WHERE quarter=? AND kind=? GROUP BY metric`).all(summary.district,summary.quarter,summary.kind);
    if(selectedIndustry!=='all'){
      const grouped=db.prepare(`SELECT quarter,SUM(stores) AS stores,SUM(sales) AS sales
        FROM report_industries WHERE kind=? AND region_code=? AND quarter<=? AND quarter>=?
          AND substr(industry_code,1,3)=? GROUP BY quarter ORDER BY quarter`).all(
        summary.kind,summary.code,summary.quarter,String(Number(summary.quarter.slice(0,4))-1)+summary.quarter.slice(4),selectedIndustry);
      const byQuarter=new Map(grouped.map(row=>[row.quarter,row]));
      const current=byQuarter.get(summary.quarter);
      const previous=grouped.filter(row=>row.quarter<summary.quarter).at(-1);
      const metrics={...summary.metrics};
      for(const metric of ['stores','sales']){
        const value=current?.[metric]??null,prior=previous?.[metric]??null;
        metrics[metric]={value,change:value!=null&&prior>0?(value-prior)/prior:null};
      }
      const history=summary.history.filter(row=>!['stores','sales'].includes(row.metric));
      for(const row of grouped)for(const metric of ['stores','sales'])if(row[metric]!=null)history.push({quarter:row.quarter,metric,value:row[metric]});
      history.sort((a,b)=>a.quarter.localeCompare(b.quarter));
      return {...summary,metrics,history,officialSalesEok:null,officialReportSales:null,
        scopeIndustry:selectedIndustry,details,industries:industries.filter(row=>row.code.startsWith(selectedIndustry)),
        industryHistory:industryHistory.filter(row=>row.group_code===selectedIndustry),groupSales:groupSales.filter(row=>row.group_code===selectedIndustry),
        benchmarks:{footfall:Object.fromEntries(benchmarks.filter(row=>row.metric==='footfall').map(x=>[x.metric,{district:x.district,city:x.city}])).footfall,
          residents:Object.fromEntries(benchmarks.filter(row=>row.metric==='residents').map(x=>[x.metric,{district:x.district,city:x.city}])).residents},detailAvailable:rows.length>0};
    }
    return {...summary,details,industries,industryHistory,groupSales,
      benchmarks:Object.fromEntries(benchmarks.map(x=>[x.metric,{district:x.district,city:x.city}])),detailAvailable:rows.length>0};
  }finally{db.close()}
}
const reportCache=new Map();
export function getRegionReport(query={}){
  const dbPath=path.resolve(root,process.env.DB_PATH||'data/commerce.sqlite');
  const workersPath=path.join(root,'data/official-dong-workers-20252-20262.json');
  const snapshotPaths=[dbPath,workersPath,path.join(root,'data',`official-rankings-${query.quarter}.json`),path.join(root,'data',`official-report-sales-${query.quarter}.json`)];
  const signature=snapshotPaths.map(file=>fs.existsSync(file)?fs.statSync(file).mtimeMs:0).join(':');
  const key=JSON.stringify([dbPath,signature,query.kind,query.code,query.quarter,query.industry||'all']);
  if(reportCache.has(key))return reportCache.get(key);
  const report=buildRegionReport(query);
  if(report){
    if(reportCache.size>=250)reportCache.delete(reportCache.keys().next().value);
    reportCache.set(key,report);
  }
  return report;
}
