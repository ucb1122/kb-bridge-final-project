import {renderOverview,renderTrends,renderTable,quarter,number,value,rate} from './report-view.js';

const labels={stores:'점포수',sales:'추정매출액',footfall:'유동인구',residents:'상주인구'};
const days=['월요일','화요일','수요일','목요일','금요일','토요일','일요일'];
const hours=['00~06시','06~11시','11~14시','14~17시','17~21시','21~24시'];
const ages=['10대','20대','30대','40대','50대','60대 이상'];
const groupName=code=>code?.startsWith('CS1')?'외식업':code?.startsWith('CS2')?'서비스업':code?.startsWith('CS3')?'소매업':'기타';
const make=(tag,className='',text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node};
const svg=(tag,attributes={})=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,val] of Object.entries(attributes))node.setAttribute(key,String(val));return node};
const current=r=>r.details?.[r.quarter]||{};
const periods=r=>[...new Set([...r.history.map(x=>x.quarter),...Object.keys(r.details||{})])].sort();
const detail=(r,group,key)=>current(r)[group]?.[key];
const amount=(n,unit='개')=>n==null?'자료 없음':unit==='원'?value(n,'sales'):`${number(n)}${unit}`;
const short=n=>Math.abs(n)>=1e8?`${(n/1e8).toFixed(1)}억`:Math.abs(n)>=1e4?`${Math.round(n/1e4)}만`:number(n);

function panel(title,description){const box=make('section','report-block');box.append(make('h3','',title));if(description)box.append(make('p','report-caption',description));return box}
function unavailable(text){return make('p','report-unavailable',text)}
function table(headers,rows){const t=make('table','detail-table'),thead=make('thead'),head=make('tr');headers.forEach(x=>head.append(make('th','',x)));thead.append(head);t.append(thead);const body=make('tbody');rows.forEach(row=>{const tr=make('tr');row.forEach((x,i)=>tr.append(make(i?'td':'th','',x)));body.append(tr)});t.append(body);return t}
function chart(values,labels,mode='bar'){
  const box=make('div','detail-chart');if(!values.length)return box;
  const max=Math.max(...values,1),min=mode==='line'?Math.min(...values):0,span=Math.max(max-min,1);
  const graphic=svg('svg',{viewBox:'0 0 600 245',role:'img','aria-label':labels.map((label,i)=>`${label} ${number(values[i])}`).join(', ')});
  [30,80,130,180].forEach(y=>graphic.append(svg('line',{x1:42,y1:y,x2:580,y2:y,stroke:'#e6e9ef'})));
  const xs=values.map((_,i)=>65+(490*i/Math.max(values.length-1,1)));
  if(mode==='line'){
    const line=svg('polyline',{points:values.map((n,i)=>`${xs[i]},${185-(n-min)/span*135}`).join(' '),fill:'none',stroke:'#c49200','stroke-width':3});graphic.append(line);
    values.forEach((n,i)=>graphic.append(svg('circle',{cx:xs[i],cy:185-(n-min)/span*135,r:4,fill:'#c49200'})));
  }else values.forEach((n,i)=>graphic.append(svg('rect',{x:xs[i]-Math.min(26,220/values.length),y:185-n/max*145,width:Math.min(52,440/values.length),height:Math.max(n/max*145,1),fill:i===values.indexOf(max)?'#c49200':'#b9c2cb'})));
  values.forEach((n,i)=>{
    const y=mode==='line'?185-(n-min)/span*135:185-n/max*145;
    const val=svg('text',{x:xs[i],y:Math.max(17,y-8),'text-anchor':'middle',fill:'#2e3540','font-size':11});val.textContent=short(n);graphic.append(val);
    const label=svg('text',{x:xs[i],y:211,'text-anchor':'middle',fill:'#5b626c','font-size':10});label.textContent=labels[i].length>8?labels[i].slice(-7):labels[i];graphic.append(label);
  });box.append(graphic);return box;
}
function trend(report,title,group,key,unit='개',description='',divisor=1){
  const box=panel(title,description),series=periods(report).map(q=>({q,n:report.details[q]?.[group]?.[key]})).filter(x=>x.n!=null);
  if(!series.length){box.append(unavailable('이 지표는 제공된 원본 CSV에 없습니다.'));return box}
  const latest=series.at(-1),prev=series.at(-2);
  box.append(make('p','report-highlight',`${title}: ${amount(latest.n/divisor,unit)}`));
  if(prev)box.append(make('p','report-change',`전분기 대비 ${latest.n-prev.n>=0?'+':''}${amount((latest.n-prev.n)/divisor,unit)}`));
  box.append(chart(series.map(x=>x.n/divisor),series.map(x=>quarter(x.q)),'line'));
  box.append(table(['기준 분기',title],series.slice().reverse().map(x=>[quarter(x.q),amount(x.n/divisor,unit)])));
  return box;
}
function metricTrend(report,key){
  const title=`${labels[key]} 추이`,box=panel(title),series=report.history.filter(x=>x.metric===key);
  if(!series.length){box.append(unavailable('분기별 자료가 없습니다.'));return box}
  const unit=key==='sales'?'원':key==='stores'?'개':'명';
  box.append(make('p','report-highlight',amount(series.at(-1).value,unit)));
  box.append(chart(series.map(x=>x.value),series.map(x=>quarter(x.quarter)),'line'));
  box.append(table(['기준 분기',labels[key]],series.slice().reverse().map(x=>[quarter(x.quarter),amount(x.value,unit)])));
  return box;
}
function breakdown(report,title,group,keys,names,unit='명',description=''){
  const box=panel(title,description),source=current(report)[group];
  if(!source||!keys.some(k=>source[k]!=null)){box.append(unavailable('이 지역·분기의 세부 자료가 원본 CSV에 없습니다.'));return box}
  const data=keys.map((key,i)=>({name:names[i],n:source[key]||0})),total=data.reduce((sum,x)=>sum+x.n,0),top=data.reduce((a,b)=>a.n>=b.n?a:b);
  box.append(make('p','report-highlight',`${top.name} 비중이 가장 높습니다 (${total?((top.n/total)*100).toFixed(1):'0.0'}%).`));
  const visual=data.length>10?[...data].sort((a,b)=>b.n-a.n).slice(0,8):data;
  box.append(chart(visual.map(x=>x.n),visual.map(x=>x.name)));
  box.append(table(['구분',unit==='원'?'금액':`수치 (${unit})`,'비율'],data.map(x=>[x.name,amount(x.n,unit),`${total?((x.n/total)*100).toFixed(1):'0.0'}%`])));
  return box;
}
function topIndustries(report,field,title,unit='개'){
  const box=panel(title),items=[...(report.industries||[])].filter(x=>x[field]!=null).sort((a,b)=>b[field]-a[field]).slice(0,10);
  if(!items.length){box.append(unavailable('업종별 자료가 없습니다.'));return box}
  box.append(table(['순위','업종','수치'],items.map((x,i)=>[String(i+1),x.name,amount(x[field],unit)])));return box;
}
function industryComposition(report){
  const sums={외식업:0,서비스업:0,소매업:0};
  for(const item of report.industries||[])sums[groupName(item.code)]=(sums[groupName(item.code)]||0)+(item.stores||0);
  const box=panel('업종분포','서비스 업종 코드를 외식업·서비스업·소매업으로 묶었습니다.');
  const names=Object.keys(sums),values=Object.values(sums),total=values.reduce((a,b)=>a+b,0);
  box.append(chart(values,names),table(['업종군','점포수','비율'],names.map((name,i)=>[name,amount(values[i]),`${total?(values[i]/total*100).toFixed(1):'0.0'}%`])));return box;
}
function industryTrend(report){
  const box=panel('업종분포 추이','분기별 외식업·서비스업·소매업 점포수입니다.');
  const qs=periods(report),groups=[['CS1','외식업'],['CS2','서비스업'],['CS3','소매업']];
  if(!report.industryHistory?.length){box.append(unavailable('분기별 업종 자료가 없습니다.'));return box}
  for(const [code,name] of groups){
    const values=qs.map(q=>report.industryHistory.find(x=>x.quarter===q&&x.group_code===code)?.stores||0);
    box.append(make('h4','',name),chart(values,qs.map(quarter),'line'));
  }
  box.append(table(['분기',...groups.map(x=>x[1])],qs.slice().reverse().map(q=>[quarter(q),...groups.map(([code])=>amount(report.industryHistory.find(x=>x.quarter===q&&x.group_code===code)?.stores||0))])));
  return box;
}
function industryAgeSales(report,groupCode,groupLabel){
  const box=panel(`${groupLabel} 연령대별 매출`,'서비스 업종 코드별 매출금액을 해당 업종군에 합산했습니다.');
  const rows=report.groupSales?.filter(x=>x.group_code===groupCode)||[];
  if(!rows.length){box.append(unavailable('업종군별 연령대 매출 자료가 없습니다.'));return box}
  const values=[10,20,30,40,50,60].map(age=>rows.find(x=>x.key===`age_${age}`)?.value||0);
  const total=values.reduce((a,b)=>a+b,0);
  box.append(chart(values,ages),table(['연령대','매출액','비율'],ages.map((name,i)=>[name,amount(values[i],'원'),`${total?(values[i]/total*100).toFixed(1):'0.0'}%`])));
  return box;
}
function sexAge(report,group,title){
  const box=panel(title),source=current(report)[group];
  if(!source?.male_age_10){box.append(unavailable('이 지역 유형의 원본 CSV에는 성별·연령 교차 자료가 없습니다.'));return box}
  const data=[10,20,30,40,50,60].map((age,i)=>[ages[i],source[`male_age_${age}`]||0,source[`female_age_${age}`]||0]);
  box.append(table(['연령대','남성','여성'],data.map(x=>[x[0],amount(x[1],'명'),amount(x[2],'명')])));return box;
}
function benchmark(report,key){
  const b=report.benchmarks?.[key],box=panel(`${labels[key]} 지역 비교`,'같은 유형의 지역을 합산한 원본 CSV 수치입니다.');
  if(!b)return box;
  const own=report.metrics[key]?.value||0,unit=key==='sales'?'원':key==='stores'?'개':'명';
  box.append(table(['범위','값'],[[report.name,amount(own,unit)],[report.district,amount(b.district,unit)],['서울시',amount(b.city,unit)]]));return box;
}
function bestSummary(report){
  const wrap=make('div','best-grid');
  for(const [title,field] of [['점포가 가장 많은 업종','stores'],['개업이 가장 많은 업종','opened'],['폐업이 가장 많은 업종','closed']]){
    const first=[...(report.industries||[])].sort((a,b)=>(b[field]||0)-(a[field]||0))[0];
    const card=make('div','best-card');card.append(make('small','',title),make('strong','',first?first.name:'자료 없음'),make('span','',first?amount(first[field]):''));wrap.append(card);
  }
  const sales=current(report).sales,footfall=current(report).footfall;
  for(const [title,source,names,prefix] of [['매출이 가장 높은 요일',sales,days,'day_'],['유동인구가 가장 많은 시간대',footfall,hours,'hour_']]){
    const card=make('div','best-card'),pairs=names.map((name,i)=>({name,n:source?.[prefix+i]||0})),best=pairs.reduce((a,b)=>a.n>=b.n?a:b);
    card.append(make('small','',title),make('strong','',source?best.name:'자료 없음'));wrap.append(card);
  }
  return wrap;
}
function ownerOverview(report){
  const content=make('div','full-report owner-overview');
  const recent=[...new Set(report.history.filter(x=>x.quarter<=report.quarter).map(x=>x.quarter))].sort().slice(-5);
  const observation=(q,key)=>report.history.find(x=>x.quarter===q&&x.metric===key)?.value;
  const previous=recent.at(-2);
  const cards=make('div','owner-overview-cards');
  for(const [key,title] of [['stores','점포수'],['sales','매출액'],['footfall','유동인구']]){
    const currentValue=observation(report.quarter,key)??report.metrics[key]?.value;
    const card=make('article','owner-overview-card');
    let displayed='자료 없음';
    if(key==='stores'&&currentValue!=null)displayed=`${number(currentValue)}개`;
    if(key==='sales'){
      const monthly=report.officialReportSales?.current;
      const stores=observation(report.quarter,'stores')??report.metrics.stores?.value;
      if(monthly!=null)displayed=`${number(monthly)}만 원`;
      else if(currentValue!=null&&stores>0)displayed=`${number(Math.round(currentValue/3/stores/1e4))}만 원`;
    }
    if(key==='footfall'&&currentValue!=null&&report.analysisAreaM2>0)displayed=`${number(Math.round(currentValue/(report.analysisAreaM2/10000)))}명/ha`;
    card.append(make('span','owner-card-title',title),make('small','owner-card-quarter',quarter(report.quarter)),make('strong','owner-card-value',displayed));
    cards.append(card);
  }
  content.append(cards);
  for(const [key,title] of [['stores','점포수 추이'],['sales','분기 추정매출 추이']]){
    const section=panel(title);
    const items=recent.map(q=>({q,v:observation(q,key)}));
    const available=items.filter(({v})=>v!=null);
    if(available.length>1)section.append(chart(available.map(({v})=>v),available.map(({q})=>quarter(q)),'line'));
    const values=make('div','owner-trend-values');
    items.forEach(({q,v})=>{const item=make('div','owner-trend-value');item.append(make('small','',quarter(q)),make('strong','',v==null?'자료 없음':value(v,key)));values.append(item)});
    section.append(values);
    content.append(section);
  }
  const evidence=make('details','report-block owner-evidence');evidence.append(make('summary','','원본 수치·계산 근거'));
  evidence.append(make('h4','','최근 분기 원본 수치'));
  evidence.append(table(['분기','점포수','분기 추정매출','유동인구 집계'],recent.map(q=>[quarter(q),observation(q,'stores')==null?'자료 없음':`${number(observation(q,'stores'))}개`,observation(q,'sales')==null?'자료 없음':`${number(observation(q,'sales'))}원`,observation(q,'footfall')==null?'자료 없음':`${number(observation(q,'footfall'))}명`])));
  evidence.append(make('h4','','분석 조건'));
  const industry={all:'전체 업종',CS1:'외식업',CS2:'서비스업',CS3:'소매업'}[report.scopeIndustry||'all']||report.scopeIndustry;
  evidence.append(table(['항목','내용'],[['지역',report.name],['공간 기준',report.kind==='dong'?'행정동 전체':'공식 상권'],['자치구',report.district],['업종',industry],['분석 분기',quarter(report.quarter)],['비교 분기',previous?quarter(previous):'자료 없음']]));
  evidence.append(make('p','report-source','출처: 서울특별시 서울 열린데이터광장 / 공공데이터포털(data.go.kr)'));
  content.append(evidence);
  return content;
}
export function renderReportTab(target,report,tab,analysis){
  if(tab==='overview'&&document.body.classList.contains('owner-unified')){target.replaceChildren(ownerOverview(report));return}
  const content=make('div','full-report');
  if(report.scopeIndustry){const label={CS1:'외식업',CS2:'서비스업',CS3:'소매업'}[report.scopeIndustry];content.append(make('p','report-source',`${label} 점포수·매출은 선택 업종 기준입니다. 인구·주변 환경과 세부 요일·시간대 자료는 지역 전체 기준입니다.`))}
  if(!report.detailAvailable)content.append(unavailable('세부 원본 데이터가 적재되지 않았습니다. npm run import:details를 실행하세요.'));
  if(tab==='overview'){
    const summary=make('div');renderOverview(summary,report,analysis);content.append(summary,make('h3','report-section-title','핵심 업종·고객'),bestSummary(report));
    const trends=make('div');renderTrends(trends,report);content.append(make('h3','report-section-title','주요 지표 추이'),trends);
    const raw=make('div');renderTable(raw,report);content.append(make('h3','report-section-title','원본 수치'),raw);
  }
  if(tab==='industry'){
    content.append(metricTrend(report,'stores'),trend(report,'일반 점포수','stores','regular','개'));
    content.append(industryComposition(report),industryTrend(report),breakdown(report,'일반점포와 프랜차이즈','stores',['regular','franchise'],['일반점포','프랜차이즈'],'개'));
    content.append(trend(report,'개업 점포','stores','opened'),trend(report,'폐업 점포','stores','closed'));
    content.append(topIndustries(report,'stores','점포수 상위 업종'),topIndustries(report,'opened','개업 상위 업종'),topIndustries(report,'closed','폐업 상위 업종'));
    content.append(trend(report,'운영 영업기간 평균','operation','months','개월','상권변화지표 원본의 운영 영업 개월 평균이며 행정동 자료는 제공되지 않습니다.'));
    const survival=panel('신생기업 3년 생존율');survival.append(unavailable('제공된 ZIP·행정동 CSV에 생존율 원본이 없어 표시할 수 없습니다.'));content.append(survival);
  }
  if(tab==='sales'){
    content.append(metricTrend(report,'sales'));
    const sales=report.officialSalesEok!=null?Math.round(report.officialSalesEok*1e8):report.metrics.sales?.value;
    const stores=report.metrics.stores?.value;
    const box=panel('점포당 월평균 추정매출',report.officialReportSales?'서울시 분석보고서 표시값입니다.':report.officialSalesEok!=null?'서울시 순위 화면의 매출액을 3개월과 점포수로 나눈 값입니다.':'원본 CSV의 분기 매출액을 3개월과 점포수로 나눈 참고값입니다. 서울시 화면과 다를 수 있습니다.');
    box.append(make('p','report-highlight',report.officialReportSales?.current!=null?`${number(report.officialReportSales.current)}만 원`:sales!=null&&stores?amount(sales/3/stores,'원'):'자료 없음'));content.append(box);
    content.append(trend(report,'월평균 매출건수','sales','transactions','건','분기 매출건수를 3개월로 나눈 참고값입니다.',3),topIndustries(report,'sales','추정매출 상위 업종','원'));
    content.append(breakdown(report,'요일별 매출','sales',days.map((_,i)=>`day_${i}`),days,'원'));
    content.append(breakdown(report,'시간대별 매출','sales',hours.map((_,i)=>`hour_${i}`),hours,'원'));
    content.append(breakdown(report,'성별 매출','sales',['male','female'],['남성','여성'],'원'));
    content.append(breakdown(report,'연령대별 매출','sales',ages.map((_,i)=>`age_${i===5?60:(i+1)*10}`),ages,'원'));
    content.append(industryAgeSales(report,'CS1','외식업'),industryAgeSales(report,'CS2','서비스업'),industryAgeSales(report,'CS3','소매업'));
    content.append(benchmark(report,'sales'));
  }
  if(tab==='population'){
    content.append(metricTrend(report,'footfall'));
    if(report.analysisAreaM2>0){
      const density=panel('유동인구 밀도 (3개월, 1ha당)','원본 CSV의 분기 유동인구를 서울시 분석 면적(ha)으로 나눈 값입니다.');
      density.append(make('p','report-highlight',`${number(report.metrics.footfall.value/(report.analysisAreaM2/10000))}명/ha`));
      content.append(density);
    }
    const daily=panel('일평균 유동인구','분기 유동인구 수를 해당 분기의 일수로 나눈 참고값입니다.');
    const year=Number(report.quarter.slice(0,4)),q=Number(report.quarter.slice(4));
    const daysInQuarter=Math.round((Date.UTC(year,3*q,1)-Date.UTC(year,3*(q-1),1))/86400000);
    daily.append(make('p','report-highlight',amount(report.metrics.footfall?.value/daysInQuarter,'명')));content.append(daily);
    content.append(benchmark(report,'footfall'),breakdown(report,'성별 유동인구','footfall',['male','female'],['남성','여성']));
    content.append(breakdown(report,'연령대별 유동인구','footfall',ages.map((_,i)=>`age_${i===5?60:(i+1)*10}`),ages));
    content.append(breakdown(report,'요일별 유동인구','footfall',days.map((_,i)=>`day_${i}`),days));
    content.append(breakdown(report,'시간대별 유동인구','footfall',hours.map((_,i)=>`hour_${i}`),hours));
    content.append(metricTrend(report,'residents'),benchmark(report,'residents'),breakdown(report,'성별 상주인구','residents',['male','female'],['남성','여성']));
    content.append(breakdown(report,'연령대별 상주인구','residents',ages.map((_,i)=>`age_${i===5?60:(i+1)*10}`),ages));
    content.append(sexAge(report,'residents','성별·연령대별 상주인구'));
    content.append(breakdown(report,'가구 현황','residents',['apartment_households','other_households'],['아파트 가구','비아파트 가구'],'가구'));
    content.append(breakdown(report,'직장인구','workers',['male','female'],['남성','여성'],'명','직장인구는 상권별 원본에만 있습니다.'));
    content.append(breakdown(report,'연령대별 직장인구','workers',ages.map((_,i)=>`age_${i===5?60:(i+1)*10}`),ages));
  }
  if(tab==='hinterland'){
    content.append(breakdown(report,'소비 지출 구성','consumption',['food','clothes','household','medical','transport','leisure','culture','education','entertainment'],['식료품','의류·신발','생활용품','의료비','교통','여가','문화','교육','유흥'],'원','소비 자료는 상권별 원본에만 있습니다.'));
    content.append(breakdown(report,'집객시설 현황','facilities',['office','bank','general_hospital','hospital','pharmacy','kindergarten','school','middle_school','high_school','university','department_store','supermarket','theater','lodging','railway','subway','bus'],['관공서','은행','종합병원','일반병원','약국','유치원','초등학교','중학교','고등학교','대학교','백화점','슈퍼마켓','극장','숙박시설','철도역','지하철역','버스정거장'],'개','원본 CSV가 제공하는 시설 유형입니다.'));
    content.append(breakdown(report,'아파트 면적별 세대','apartments',['under_66','size_66','size_99','size_132','size_165'],['66㎡ 미만','66㎡대','99㎡대','132㎡대','165㎡대'],'세대'));
    content.append(breakdown(report,'아파트 가격대별 세대','apartments',['price_under_1','price_1','price_2','price_3','price_4','price_5','price_6_plus'],['1억 미만','1억대','2억대','3억대','4억대','5억대','6억 이상'],'세대'));
    content.append(breakdown(report,'상주 가구','residents',['apartment_households','other_households'],['아파트 가구','비아파트 가구'],'가구'));
    content.append(breakdown(report,'직장인구','workers',['male','female'],['남성','여성'],'명'));
    content.append(benchmark(report,'stores'),benchmark(report,'footfall'));
    for(const title of ['소득수준','임대시세']){const box=panel(title);box.append(unavailable('제공된 ZIP·행정동 CSV에 이 지표의 원본이 없어 표시할 수 없습니다.'));content.append(box)}
  }
  const chapter={overview:'종합의견',industry:'업종분석',sales:'매출분석',population:'인구분석',hinterland:'지역(배후지)분석'}[tab];
  target.replaceChildren(...(target.id?.startsWith('report-')?[make('h3','report-chapter-title',chapter)]:[]),content);
}
