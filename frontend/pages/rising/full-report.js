import {renderOverview,renderTrends,renderTable,quarter,number,value,rate,monthlySalesPerStore} from './report-view.js?v=6';

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
let chartGradientId=0;

function panel(title,description){const box=make('section','report-block');box.append(make('h3','',title));if(description)box.append(make('p','report-caption',description));return box}
function unavailable(text){return make('p','report-unavailable',text)}
function table(headers,rows){const t=make('table','detail-table'),thead=make('thead'),head=make('tr');headers.forEach(x=>head.append(make('th','',x)));thead.append(head);t.append(thead);const body=make('tbody');rows.forEach(row=>{const tr=make('tr');row.forEach((x,i)=>tr.append(make(i?'td':'th','',x)));body.append(tr)});t.append(body);return t}
function chart(values,labels,mode='bar',format=short){
  const box=make('div','detail-chart');if(!values.length)return box;
  const ownerStyle=true;
  const max=Math.max(...values,1),min=mode==='line'?Math.min(...values):0,span=Math.max(max-min,1);
  const yFor=n=>mode==='line'&&max===min?117.5:185-(n-min)/span*135;
  const graphic=svg('svg',{viewBox:'0 0 600 245',role:'img','aria-label':labels.map((label,i)=>`${label} ${number(values[i])}`).join(', ')});
  let chartFill='#c49200',lineStroke='#428cf2';
  if(ownerStyle){
    const id=`owner-chart-gradient-${++chartGradientId}`;
    const defs=svg('defs'),gradient=svg('linearGradient',{id,x1:'0%',y1:'0%',x2:'0%',y2:'100%'});
    gradient.append(svg('stop',{offset:'0%','stop-color':'#428cf2'}),svg('stop',{offset:'100%','stop-color':'#c8e1ff'}));
    const lineGradient=svg('linearGradient',{id:`${id}-line`,x1:'0%',y1:'0%',x2:'100%',y2:'0%'});
    lineGradient.append(svg('stop',{offset:'0%','stop-color':'#428cf2'}),svg('stop',{offset:'50%','stop-color':'#a8ceff'}),svg('stop',{offset:'100%','stop-color':'#428cf2'}));
    defs.append(gradient,lineGradient);graphic.append(defs);chartFill=`url(#${id})`;lineStroke=`url(#${id}-line)`;
  }
  [30,80,130,180].forEach(y=>graphic.append(svg('line',{x1:42,y1:y,x2:580,y2:y,stroke:'#e6e9ef'})));
  const spread=mode==='bar'&&values.length<=2?150:mode==='bar'&&values.length===3?300:490;
  const xs=values.map((_,i)=>300-spread/2+(spread*i/Math.max(values.length-1,1)));
  if(mode==='line'){
    const line=svg('polyline',{points:values.map((n,i)=>`${xs[i]},${yFor(n)}`).join(' '),fill:'none',stroke:lineStroke,'stroke-width':3});graphic.append(line);
    values.forEach((n,i)=>graphic.append(svg('circle',{cx:xs[i],cy:yFor(n),r:4,fill:ownerStyle?'#498ff0':'#c49200'})));
  }else values.forEach((n,i)=>{
    const width=ownerStyle?Math.min(82,480/values.length):Math.min(52,440/values.length);
    graphic.append(svg('rect',{x:xs[i]-width/2,y:185-n/max*145,width,height:Math.max(n/max*145,1),fill:ownerStyle?chartFill:i===values.indexOf(max)?'#c49200':'#b9c2cb'}));
  });
  values.forEach((n,i)=>{
    const y=mode==='line'?yFor(n):185-n/max*145;
    const val=svg('text',{x:xs[i],y:Math.max(17,y-8),'text-anchor':'middle',fill:'#2e3540','font-size':11});val.textContent=format(n);graphic.append(val);
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
  const data=keys.map((key,i)=>({name:names[i],n:source[key]})).filter(x=>x.n!=null),total=data.reduce((sum,x)=>sum+x.n,0),top=data.reduce((a,b)=>a.n>=b.n?a:b);
  if(group==='footfall'&&keys.length===7&&keys[0]==='day_0'){
    const observed=report.metrics.footfall?.value;
    const matches=observed!=null&&Math.abs(total-observed)<=Math.max(1,observed*0.001);
    box.append(make('p','report-caption',`요일별 원본 합계 ${number(total)}명${matches?' · 분기 유동인구 집계와 일치합니다.':observed!=null?` · 분기 유동인구 집계 ${number(observed)}명과 차이가 있어 원본을 확인해 주세요.`:'.'}`));
  }
  if(data.length<keys.length)box.append(make('p','report-caption','일부 항목의 원본 값이 없어 비율은 값이 제공된 항목 사이에서만 계산했습니다.'));
  box.append(make('p','report-highlight',`${top.name} 비중이 가장 높습니다 (${total?((top.n/total)*100).toFixed(1):'0.0'}%).`));
  if(keys.length===2&&keys[0]==='male'&&keys[1]==='female'){
    const visual=make('div','owner-gender-visual'),image=make('img','owner-gender-image'),stats=make('div','owner-gender-stats');
    image.src='/pages/owner/assets/gender-pictograms.png?v=3';
    image.alt='파란 남성 아이콘과 분홍 여성 아이콘';
    for(const [key,name] of [['male','남성'],['female','여성']]){
      const cell=make('div','owner-gender-stat'),count=source[key];
      cell.append(make('span','owner-gender-name',name),make('strong','owner-gender-percent',count==null?'자료 없음':`${total?(count/total*100).toFixed(1):'0.0'}%`),make('span','owner-gender-amount',amount(count,unit)));
      stats.append(cell);
    }
    visual.append(image,stats);
    box.append(visual);
    return box;
  }
  const visual=data.length>10?[...data].sort((a,b)=>b.n-a.n).slice(0,8):data;
  box.append(chart(visual.map(x=>x.n),visual.map(x=>x.name),'bar',group==='footfall'?number:short));
  box.append(table(['구분',unit==='원'?'금액':`수치 (${unit})`,'비율'],data.map(x=>[x.name,amount(x.n,unit),`${total?((x.n/total)*100).toFixed(1):'0.0'}%`])));
  return box;
}
function topIndustries(report,field,title,unit='개'){
  const box=panel(title),items=[...(report.industries||[])].filter(x=>x[field]!=null).sort((a,b)=>b[field]-a[field]).slice(0,10);
  if(!items.length){box.append(unavailable('업종별 자료가 없습니다.'));return box}
  const ranking=table(['순위','업종','수치'],items.map((x,i)=>[String(i+1),x.name,amount(x[field],unit)]));
  ranking.classList.add('owner-top-industries-table');box.append(ranking);return box;
}
function industryComposition(report){
  if(!(report.industries||[]).some(item=>item.stores!=null))return unavailable('업종별 자료가 없습니다.');
  const sums={외식업:0,서비스업:0,소매업:0};
  for(const item of report.industries||[])sums[groupName(item.code)]=(sums[groupName(item.code)]||0)+(item.stores||0);
  const box=panel('업종분포','서비스 업종 코드를 외식업·서비스업·소매업으로 묶었습니다.');
  const names=Object.keys(sums),values=Object.values(sums),total=values.reduce((a,b)=>a+b,0);
  const layout=make('div','owner-detail-split');
  layout.append(chart(values,names),table(['업종군','점포수','비율'],names.map((name,i)=>[name,amount(values[i]),`${total?(values[i]/total*100).toFixed(1):'0.0'}%`])));
  box.append(layout);return box;
}
function industryTrend(report){
  const box=panel('업종분포 추이','분기별 외식업·서비스업·소매업 점포수입니다.');
  const qs=periods(report),groups=[['CS1','외식업'],['CS2','서비스업'],['CS3','소매업']];
  if(!report.industryHistory?.length){box.append(unavailable('분기별 업종 자료가 없습니다.'));return box}
  const charts=make('div','owner-industry-trends');
  for(const [code,name] of groups){
    const values=qs.map(q=>report.industryHistory.find(x=>x.quarter===q&&x.group_code===code)?.stores||0);
    const item=make('section','owner-mini-trend');
    item.append(make('h4','',name),chart(values,qs.map(quarter),'line'));
    charts.append(item);
  }
  box.append(charts);
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
  const sales=current(report).sales;
  const salesDay=make('div','best-card'),salesDays=days.map((name,i)=>({name,n:sales?.[`day_${i}`]||0}));
  const bestSalesDay=salesDays.reduce((a,b)=>a.n>=b.n?a:b);
  salesDay.append(make('small','','매출이 가장 높은 요일'),make('strong','',sales?bestSalesDay.name:'자료 없음'));wrap.append(salesDay);
  return wrap;
}
function ownerConditionTable(report,comparison){
  const industry={all:'전체 업종',CS1:'외식업',CS2:'서비스업',CS3:'소매업'}[report.scopeIndustry||'all']||report.scopeIndustry;
  const conditions=table(['항목','내용','항목','내용'],[
    ['지역',report.name,'공간 기준',report.kind==='dong'?'행정동 전체':'공식 상권'],
    ['자치구',report.district||'자료 없음','업종',industry],
    ['분석 분기',quarter(report.quarter),'비교 분기',comparison],
  ]);
  conditions.classList.add('owner-condition-grid');
  return conditions;
}
function ownerOverview(report){
  const content=make('div','full-report owner-overview');
  content.append(make('h3','owner-tab-title','우리 동네의 핵심 지표를 한눈에 살펴봐요'));
  const recent=[...new Set(report.history.filter(x=>x.quarter<=report.quarter).map(x=>x.quarter))].sort().slice(-5);
  const observation=(q,key)=>report.history.find(x=>x.quarter===q&&x.metric===key)?.value;
  const cards=make('div','owner-overview-cards');
  const notes=[];
  for(const [key,title] of [['stores','점포수'],['sales','매출액'],['footfall','유동인구']]){
    const currentValue=observation(report.quarter,key)??report.metrics[key]?.value;
    const card=make('article','owner-overview-card');
    let displayed='자료 없음';
    let note='';
    if(key==='stores'&&currentValue!=null){displayed=`${number(currentValue)}개`;note='선택 지역·업종의 분기 점포수 원본값입니다.'}
    if(key==='sales'){
      const total=report.officialSalesEok!=null?Math.round(report.officialSalesEok*1e8):currentValue;
      if(total!=null){displayed=value(total,'sales');note=report.officialSalesEok!=null?'서울시 순위 화면의 분기 추정매출 표시값입니다.':'공개 원본에서 제공된 업종의 분기 추정매출 합계입니다. 일부 업종의 매출이 빠졌을 수 있습니다.'}
    }
    if(key==='footfall'&&currentValue!=null&&report.analysisAreaM2>0){displayed=`${number(Math.round(currentValue/(report.analysisAreaM2/10000)))}명/ha`;note='분기 유동인구 집계 ÷ 분석 면적(ha)으로 계산한 유동인구 밀도입니다.'}
    if(!note)note={stores:'선택 지역·업종의 분기 점포수 원본 자료가 없습니다.',sales:'점포당 월평균 매출을 계산할 자료가 없습니다.',footfall:'유동인구 밀도 계산에 필요한 분기 집계 또는 분석 면적 자료가 없습니다.'}[key];
    card.append(make('span','owner-card-title',title),make('strong','owner-card-value',displayed));
    if(note)notes.push(`${title}: ${note}`);
    cards.append(card);
  }
  content.append(cards);
  const cardNotes=make('div','owner-overview-notes');
  for(const note of notes)cardNotes.append(make('p','',note));
  content.append(cardNotes);
  for(const [key,title] of [['stores','점포수 추이'],['sales','분기 추정매출 추이']]){
    const section=panel(title);
    const items=recent.map(q=>({q,v:observation(q,key)}));
    const available=items.filter(({v})=>v!=null);
    if(available.length>1)section.append(chart(available.map(({v})=>v),available.map(({q})=>quarter(q)),'line',n=>key==='stores'?number(n):value(n,'sales').replace(/ 원$/,'')));
    content.append(section);
  }
  const evidence=make('details','report-block owner-evidence');evidence.append(make('summary','','원본 수치·계산 근거'));
  evidence.append(make('h4','','최근 분기 원본 수치'));
  const rawTable=table(['분기','점포수','분기 추정매출','유동인구 집계'],recent.map(q=>[quarter(q),observation(q,'stores')==null?'자료 없음':`${number(observation(q,'stores'))}개`,observation(q,'sales')==null?'자료 없음':`${number(observation(q,'sales'))}원`,observation(q,'footfall')==null?'자료 없음':`${number(observation(q,'footfall'))}명`]));
  rawTable.classList.add('owner-raw-table');evidence.append(rawTable);
  evidence.append(make('h4','','분석 조건'));
  evidence.append(ownerConditionTable(report,recent.length>1?quarter(recent.at(-2)):'자료 없음'));
  evidence.addEventListener('toggle',()=>{
    if(!evidence.open)return;
    const body=document.getElementById('report-body');
    if(!body)return;
    requestAnimationFrame(()=>{body.scrollTop+=evidence.getBoundingClientRect().top-body.getBoundingClientRect().top-12});
  });
  content.append(evidence);
  content.append(make('p','report-source','출처: 서울특별시 서울 열린데이터광장 / 공공데이터포털(data.go.kr)'));
  return content;
}
function ownerMetricCard(title,n,unit='개'){
  const card=make('article','owner-overview-card');
  card.append(make('span','owner-card-title',title),make('strong','owner-card-value',n==null?'자료 없음':amount(n,unit)));
  return card;
}
function ownerCards(items){
  const section=make('div','owner-card-section'),grid=make('div','owner-overview-cards'),notes=make('div','owner-overview-notes');
  const basis={
    '점포수':'선택 지역·업종의 분기 점포수 원본값입니다.',
    '개업 점포수':'선택 지역·업종의 해당 분기 개업 점포수 원본값입니다.',
    '폐업 점포수':'선택 지역·업종의 해당 분기 폐업 점포수 원본값입니다.',
    '분기 추정매출':'선택 지역·업종의 한 분기 추정매출입니다.',
    '점포당 월평균 참고값':'자료 제공 범위와 점포 수를 확인해 해석하는 월평균 참고값입니다.',
    '분기 매출건수':'선택 지역·업종의 분기 매출건수 원본값입니다.',
    '유동인구 집계':'선택 지역의 분기 유동인구 관측 집계입니다.',
    '상주인구':'선택 지역의 분기 상주인구 원본값입니다.',
    '직장인구':'선택 지역의 분기 직장인구 원본값입니다.'
  };
  for(const [title,n,unit,change,note] of items){
    grid.append(ownerMetricCard(title,n,unit));
    const details=[basis[title],note,change!=null?`전분기 대비 ${rate(change)}.`:''].filter(Boolean).join(' ');
    notes.append(make('p','',`${title}: ${details}`));
  }
  section.append(grid,notes);
  return section;
}
function ownerLine(report,title,values,unit='개'){
  const section=panel(title),entries=values.filter(x=>x.n!=null).slice(-5);
  if(entries.length>1)section.append(chart(entries.map(x=>x.n),entries.map(x=>quarter(x.q)),'line',n=>unit==='원'?value(n,'sales').replace(/ 원$/,''):number(n)));
  else section.append(unavailable('분기별 자료가 없습니다.'));
  return section;
}
function ownerBars(title,entries,unit='개',description=''){
  const section=panel(title,description),items=entries.filter(x=>x.n!=null);
  if(!items.length){section.append(unavailable('이 지역의 세부 자료가 없습니다.'));return section}
  const max=Math.max(...items.map(x=>x.n),1),list=make('div','owner-bar-list');
  for(const item of items){
    const rank=1+items.filter(x=>x.n>item.n).length,same=items.filter(x=>x.n===item.n).length>1;
    const row=make('div','owner-bar-row owner-bar-ranked'),track=make('span','owner-bar-track'),fill=make('span','owner-bar-fill');
    fill.style.width=`${Math.max(1,item.n/max*100)}%`;
    track.append(fill);
    row.append(make('span','owner-bar-rank',`${same?'공동 ':''}${rank}위`));
    row.append(make('span','owner-bar-label',item.label),track,make('strong','owner-bar-value',amount(item.n,unit)));
    list.append(row);
  }
  section.append(list);return section;
}
function ownerDetail(title,description=''){const box=make('details','owner-extra');box.append(make('summary','',title));if(description)box.append(make('p','report-caption',description));return box}
function ownerBasis(report,tab,now){
  const box=ownerDetail('분석 설명·집계 기준');
  const scope=report.kind==='dong'?'행정동 전체':'공식 상권';
  const rows=[['공간·업종 범위',`${scope} · ${{all:'전체 업종',CS1:'외식업',CS2:'서비스업',CS3:'소매업'}[report.scopeIndustry||'all']||report.scopeIndustry}`],['기준 시점',quarter(report.quarter)]];
  if(tab==='industry')rows.push(['점포수·개폐업','선택 지역·업종의 분기별 공개 원본 점포 수와 개업·폐업 점포 수입니다.'],['상위 업종','현재 분기 업종 코드별 점포 수를 내림차순으로 정렬했습니다.']);
  if(tab==='sales'){
    const stores=report.metrics.stores?.value,covered=(report.industries||[]).reduce((n,x)=>n+(x.sales!=null?(x.stores||0):0),0);
    rows.push(['분기 추정매출',report.officialSalesEok!=null?'서울시 순위 화면의 분기 표시값을 우선 사용합니다. 그래프·원본 표는 공개 CSV 집계값입니다.':'공개 CSV의 선택 지역·업종 분기 추정매출 집계값입니다.'],['점포당 월평균',report.officialReportSales?.current!=null?'서울시 공식 화면의 월평균 표시값입니다.':report.officialSalesEok!=null?'서울시 순위 분기 매출액 ÷ 3개월 ÷ 선택 업종 점포 수로 계산한 참고값입니다.':covered>0?`공개 CSV에서 매출이 제공된 업종의 분기 추정매출 ÷ 3개월 ÷ 해당 업종 점포 ${number(covered)}개로 계산했습니다. 전체 점포 ${number(stores??0)}개의 평균이 아닙니다.`:'매출 제공 업종의 점포 수가 없어 계산할 수 없습니다.'],['요일·시간대·성별','공개 CSV에 매출이 제공된 업종의 추정매출을 해당 항목별로 합산했습니다. 실제 개별 점포 매출은 아닙니다.']);
  }
  if(tab==='population'||tab==='hinterland')rows.push(['유동인구','공개 원본의 해당 분기 지역 전체 유동인구 합계입니다. 같은 사람의 반복 관측이 포함될 수 있습니다.'],['상주인구','공개 원본의 해당 분기 지역 상주인구입니다. 동일 값이 여러 분기에 제공될 수 있습니다.'],['직장인구',report.kind==='dong'?'서울 열린데이터광장의 행정동별 직장인구 원본을 지역 코드·분기로 결합했습니다. 같은 값이 연속 분기에 나타나면 원본 제공값의 반복이며 실제 인구가 변하지 않았다는 뜻은 아닙니다.':'공식 상권 기준 직장인구 원본입니다.']);
  if(tab==='hinterland')rows.push(['집객시설',now.facilities?.subway!=null||now.facilities?.bus!=null?'원본에 제공된 시설 유형별 수치이며 지도 중심 반경 집계가 아닙니다.':'현재 적재된 집객시설 원본은 공식 상권 단위입니다. 행정동 전체 시설 수로 환산할 근거가 없어 표시하지 않습니다.']);
  rows.push(['해석 주의','행정동 전체와 공식 상권은 범위가 다릅니다. 추정매출은 실제 점포 매출과 다를 수 있습니다.']);
  const t=table(['항목','집계 기준·계산 방법'],rows);t.classList.add('owner-basis-table');box.append(t);return box;
}
function ownerTab(report,tab){
  const content=make('div','full-report owner-overview owner-tab'),now=current(report),qs=[...new Set(report.history.map(x=>x.quarter))].sort().filter(q=>q<=report.quarter).slice(-5);
  const metric=k=>report.metrics[k]?.value;
  const history=k=>report.history.filter(x=>x.metric===k&&qs.includes(x.quarter)).map(x=>({q:x.quarter,n:x.value}));
  const source=()=>content.append(make('p','report-source','출처: 서울특별시 서울 열린데이터광장 / 공공데이터포털(data.go.kr)'));
  const title={industry:'내 업종의 경쟁 환경을 점검해요',sales:'지역 매출과 내 실제 매출을 구분해 점검해요',population:'사람의 흐름이 내 고객층과 맞는지 살펴봐요',hinterland:'주변 생활환경과 접근성을 점검해요'}[tab];
  content.append(make('h3','owner-tab-title',title));
  if(tab==='industry'){
    const stores=now.stores||{};
    content.append(ownerCards([['점포수',metric('stores'),'개',report.metrics.stores?.change],['개업 점포수',stores.opened,'개'],['폐업 점포수',stores.closed,'개']]));
    content.append(ownerLine(report,'점포수 추이',history('stores')));
    content.append(ownerBars('지역 내 점포수가 많은 업종',[...(report.industries||[])].sort((a,b)=>(b.stores||0)-(a.stores||0)).slice(0,10).map(x=>({label:x.name,n:x.stores}))));
    const extra=ownerDetail('업종 세부 자료 더 보기');
    const openings=make('div','owner-industry-pair');
    openings.append(trend(report,'개업 점포','stores','opened'),trend(report,'폐업 점포','stores','closed'));
    extra.append(industryComposition(report),industryTrend(report),openings);
    content.append(extra);
  }
  if(tab==='sales'){
    const sales=metric('sales'),stores=metric('stores'),covered=(report.industries||[]).reduce((n,x)=>n+(x.sales!=null?(x.stores||0):0),0);
    const official=report.officialReportSales?.current;
    const officialQuarter=report.officialSalesEok!=null?Math.round(report.officialSalesEok*1e8):null;
    const perStore=official!=null?official*1e4:officialQuarter!=null?monthlySalesPerStore(officialQuarter,stores):monthlySalesPerStore(sales,covered);
    const transactions=now.sales?.transactions;
    content.append(ownerCards([['분기 추정매출',officialQuarter??sales,'원',null,officialQuarter!=null?'서울시 순위 화면 표시값입니다.':'공개 원본 집계값입니다.'],['점포당 월평균 참고값',perStore,'원',null,official!=null?'서울시 공식 화면의 표시값입니다.':officialQuarter!=null?'서울시 순위 분기 추정매출 ÷ 3개월 ÷ 전체 점포수로 계산했습니다.':perStore==null?'매출 제공 업종 점포 수가 없어 계산하지 않습니다.':`매출 제공 업종의 분기 추정매출 ÷ 3개월 ÷ 해당 업종 점포 ${number(covered)}개로 계산했습니다. 전체 점포 ${number(stores??0)}개의 평균이 아닙니다.`],['분기 매출건수',transactions,'건']]));
    content.append(ownerBars('요일별 추정매출',days.map((label,i)=>({label,n:now.sales?.[`day_${i}`]})),'원','전체 업종·매출 자료가 제공된 범위의 집계입니다.'));
    content.append(ownerBars('시간대별 추정매출',hours.map((label,i)=>({label,n:now.sales?.[`hour_${i}`]})),'원'));
    content.append(ownerLine(report,officialQuarter!=null?'분기 원본 매출 집계 추이':'분기 추정매출 추이',history('sales'),'원'));
    const extra=ownerDetail('매출 세부 자료 더 보기'),pair=make('div','owner-sales-pair');
    pair.append(topIndustries(report,'sales','추정매출 상위 업종','원'),breakdown(report,'성별 매출','sales',['male','female'],['남성','여성'],'원'));
    extra.append(pair);content.append(extra);
  }
  if(tab==='population'){
    const workers=now.workers?.total??(now.workers?.male!=null&&now.workers?.female!=null?now.workers.male+now.workers.female:null);
    content.append(ownerCards([['유동인구 집계',metric('footfall'),'명',report.metrics.footfall?.change],['상주인구',metric('residents'),'명',report.metrics.residents?.change],['직장인구',workers,'명',null,workers==null?'선택 지역·분기에 제공된 직장인구 값이 없습니다.':'']]));
    content.append(ownerBars('시간대별 유동인구',hours.map((label,i)=>({label,n:now.footfall?.[`hour_${i}`]})),'명'));
    content.append(ownerBars('연령대별 유동인구',ages.map((label,i)=>({label,n:now.footfall?.[`age_${i===5?60:(i+1)*10}`]})),'명'));
    const extra=ownerDetail('인구 세부 자료 더 보기');extra.append(ownerLine(report,'유동인구 추이',history('footfall')),ownerLine(report,'상주인구 추이',history('residents')));content.append(extra);
  }
  if(tab==='hinterland'){
    const workers=now.workers?.total??(now.workers?.male!=null&&now.workers?.female!=null?now.workers.male+now.workers.female:null);
    content.append(ownerCards([['상주인구',metric('residents'),'명',report.metrics.residents?.change],['직장인구',workers,'명',null,workers==null?'선택 지역·분기에 제공된 직장인구 값이 없습니다.':''],['유동인구 집계',metric('footfall'),'명',report.metrics.footfall?.change]]));
    if(now.facilities?.subway!=null||now.facilities?.bus!=null)content.append(ownerBars('집객시설 현황',[['지하철역',now.facilities?.subway],['버스 정류소',now.facilities?.bus]].map(([label,n])=>({label,n})),'개','원본 CSV에 제공된 시설 수이며 지도 기준점 반경 집계와 다릅니다.'));
    const extra=ownerDetail('그래프 더 보기');extra.append(ownerLine(report,'상주인구 추이',history('residents')),ownerLine(report,'유동인구 추이',history('footfall')));content.append(extra);
  }
  content.append(ownerBasis(report,tab,now));
  const evidence=ownerDetail('원본 수치·계산 근거');evidence.append(make('h4','owner-evidence-heading','최근 분기 원본 수치'));
  const raw=table(['분기','점포수','분기 추정매출','유동인구 집계'],qs.map(q=>{const get=k=>report.history.find(x=>x.quarter===q&&x.metric===k)?.value;return [quarter(q),amount(get('stores')),get('sales')==null?'자료 없음':`${number(get('sales'))}원`,amount(get('footfall'),'명')]}));raw.classList.add('owner-raw-table');evidence.append(raw);
  evidence.append(make('h4','owner-evidence-heading','분석 조건'),ownerConditionTable(report,qs.length>1?quarter(qs.at(-2)):'자료 없음'));content.append(evidence);
  source();return content;
}
export function renderReportTab(target,report,tab,analysis){
  if(tab==='overview'&&document.body.classList.contains('owner-unified')){target.replaceChildren(ownerOverview(report));return}
  if(document.body.classList.contains('owner-unified')&&['industry','sales','population','hinterland'].includes(tab)){target.replaceChildren(ownerTab(report,tab));return}
  const content=make('div','full-report');
  if(report.scopeIndustry){const label={CS1:'외식업',CS2:'서비스업',CS3:'소매업'}[report.scopeIndustry];content.append(make('p','report-source',`${label} 점포수·매출은 선택 업종 기준입니다. 인구·주변 환경과 세부 요일·시간대 자료는 지역 전체 기준입니다.`))}
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
  }
  if(tab==='sales'){
    content.append(metricTrend(report,'sales'));
    const sales=report.officialSalesEok!=null?Math.round(report.officialSalesEok*1e8):report.metrics.sales?.value;
    const stores=report.metrics.stores?.value;
    const box=panel('점포당 월평균 추정매출',report.officialReportSales?'서울시 분석보고서 표시값입니다.':report.officialSalesEok!=null?'서울시 순위 화면의 매출액을 3개월과 점포수로 나눈 값입니다.':'원본 CSV의 분기 매출액을 3개월과 점포수로 나눈 참고값입니다.');
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
    content.append(benchmark(report,'footfall'),breakdown(report,'성별 유동인구','footfall',['male','female'],['남성','여성']));
    content.append(breakdown(report,'연령대별 유동인구','footfall',ages.map((_,i)=>`age_${i===5?60:(i+1)*10}`),ages));
    content.append(breakdown(report,'요일별 유동인구','footfall',days.map((_,i)=>`day_${i}`),days));
    content.append(breakdown(report,'시간대별 유동인구','footfall',hours.map((_,i)=>`hour_${i}`),hours));
    content.append(benchmark(report,'residents'),breakdown(report,'성별 상주인구','residents',['male','female'],['남성','여성']));
    content.append(breakdown(report,'연령대별 상주인구','residents',ages.map((_,i)=>`age_${i===5?60:(i+1)*10}`),ages));
    content.append(sexAge(report,'residents','성별·연령대별 상주인구'));
    content.append(breakdown(report,'직장인구','workers',['male','female'],['남성','여성'],'명','직장인구는 상권별 원본에만 있습니다.'));
    content.append(breakdown(report,'연령대별 직장인구','workers',ages.map((_,i)=>`age_${i===5?60:(i+1)*10}`),ages));
  }
  if(tab==='hinterland'){
    content.append(breakdown(report,'소비 지출 구성','consumption',['food','clothes','household','medical','transport','leisure','culture','education','entertainment'],['식료품','의류·신발','생활용품','의료비','교통','여가','문화','교육','유흥'],'원','소비 자료는 상권별 원본에만 있습니다.'));
    content.append(breakdown(report,'집객시설 현황','facilities',['office','bank','general_hospital','hospital','pharmacy','kindergarten','school','middle_school','high_school','university','department_store','supermarket','theater','lodging','railway','subway','bus'],['관공서','은행','종합병원','일반병원','약국','유치원','초등학교','중학교','고등학교','대학교','백화점','슈퍼마켓','극장','숙박시설','철도역','지하철역','버스정거장'],'개','원본 CSV가 제공하는 시설 유형입니다.'));
    content.append(breakdown(report,'아파트 면적별 세대','apartments',['under_66','size_66','size_99','size_132','size_165'],['66㎡ 미만','66㎡대','99㎡대','132㎡대','165㎡대'],'세대'));
    content.append(breakdown(report,'아파트 가격대별 세대','apartments',['price_under_1','price_1','price_2','price_3','price_4','price_5','price_6_plus'],['1억 미만','1억대','2억대','3억대','4억대','5억대','6억 이상'],'세대'));
    content.append(breakdown(report,'직장인구','workers',['male','female'],['남성','여성'],'명'));
    content.append(benchmark(report,'stores'),benchmark(report,'footfall'));
  }
  content.querySelectorAll('.report-block').forEach(box=>{if(box.querySelector('.report-unavailable')&&!box.querySelector('.detail-chart,.detail-table,.report-highlight'))box.remove()});
  content.querySelectorAll('.best-card').forEach(box=>{if(box.textContent.includes('자료 없음'))box.remove()});
  content.querySelectorAll('.report-metric,.trend-card').forEach(box=>{if(box.textContent.includes('자료 없음'))box.remove()});
  content.querySelectorAll('.report-unavailable').forEach(item=>item.remove());
  content.querySelectorAll('.detail-table tbody tr,.history-table tbody tr').forEach(row=>{if(row.textContent.includes('자료 없음'))row.remove()});
  content.querySelectorAll('.detail-table,.history-table').forEach(item=>{if(!item.querySelector('tbody tr'))item.remove()});
  content.querySelectorAll('.best-grid').forEach(item=>{if(!item.children.length)item.remove()});
  const chapter={overview:'종합의견',industry:'업종분석',sales:'매출분석',population:'인구분석',hinterland:'지역(배후지)분석'}[tab];
  target.replaceChildren(...(target.id?.startsWith('report-')?[make('h3','report-chapter-title',chapter)]:[]),content);
}
