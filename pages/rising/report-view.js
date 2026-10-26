export const metrics={stores:['점포수','개'],sales:['추정매출','원'],footfall:['유동인구','명'],residents:['상주인구','명']};
export const quarter=q=>`${q.slice(0,4)}년 ${q.slice(4)}분기`;
export const number=n=>Math.round(n).toLocaleString('ko-KR');
export const value=(n,key)=>key==='sales'?(n>=1e8?`${(n/1e8).toLocaleString('ko-KR',{maximumFractionDigits:1})}억 원`:`${number(n/1e4)}만 원`):`${number(n)}${metrics[key][1]}`;
export const summaryValue=(n,key)=>key==='footfall'?`${number(n/1e4)}만 명`:key==='sales'?`${(n/1e8).toLocaleString('ko-KR',{maximumFractionDigits:1})}억 원`:value(n,key);
export const rate=n=>n==null?'비교 자료 없음':`${n>=0?'+':''}${(n*100).toFixed(1)}%`;
export const monthlySalesPerStore=(sales,stores)=>Number.isFinite(sales)&&Number.isFinite(stores)&&stores>0?sales/3/stores:null;
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node};
function opinionLine(text){
  const item=el('li'),pattern=/(증가|감소|점포수|추정매출액|유동인구|상주인구|\d[\d,]*(?:\.\d+)?(?:%|개|명|원|위))/g;
  const emphasis=/^(?:증가|감소|점포수|추정매출액|유동인구|상주인구|\d[\d,]*(?:\.\d+)?(?:%|개|명|원|위))$/;
  for(const part of text.split(pattern))if(part)item.append(emphasis.test(part)?el('strong','opinion-emphasis',part):document.createTextNode(part));
  return item;
}
function reportCard(report,key,title){
  const card=el('article','report-metric report-summary-card'),item=report.metrics[key];
  const areaHa=report.analysisAreaM2>0?report.analysisAreaM2/10000:null;
  const density=key==='footfall'&&areaHa!=null;
  const history=report.history.filter(x=>x.metric===key).sort((a,b)=>a.quarter.localeCompare(b.quarter));
  const storeCounts=new Map(report.history.filter(x=>x.metric==='stores').map(x=>[x.quarter,x.value]));
  const previous=history.filter(x=>x.quarter<report.quarter).at(-1);
  const yearAgo=history.find(x=>x.quarter===`${Number(report.quarter.slice(0,4))-1}${report.quarter.slice(4)}`);
  const salesValue=key==='sales'&&item?monthlySalesPerStore(report.officialSalesEok!=null?report.officialSalesEok*1e8:item.value,storeCounts.get(report.quarter)):null;
  const comparison=(label,reference)=>{
    const referenceSales=key==='sales'&&reference?monthlySalesPerStore(reference.value,storeCounts.get(reference.quarter)):null;
    const diff=key==='sales'?(salesValue!=null&&referenceSales!=null?salesValue-referenceSales:null):reference&&item?item.value-reference.value:null;
    const official=key==='sales'?report.officialReportSales?.[label==='전분기 대비'?'previousChange':'yearAgoChange']:null;
    const shown=official!=null?official*1e4:diff;
    const box=el('div',`metric-delta ${shown==null?'unknown':shown<0?'down':'up'}`);
    const display=shown==null?'비교 자료 없음':key==='sales'?`${number(Math.abs(shown)/1e4)}만 원`:density?`${number(Math.abs(shown)/areaHa)}명/ha`:summaryValue(Math.abs(shown),key);
    box.append(el('small','',label),el('strong','',shown==null?display:`${shown>0?'+':shown<0?'−':''}${display}`));
    return box;
  };
  card.append(el('h4','',title),comparison('전분기 대비',previous));
  const current=el('div','metric-current');
  const currentValue=key==='sales'?(report.officialReportSales?.current!=null?`${number(report.officialReportSales.current)}만 원`:salesValue==null?'자료 없음':`${number(salesValue/1e4)}만 원`):!item?'자료 없음':density?`${number(item.value/areaHa)}명/ha`:summaryValue(item.value,key);
  current.append(el('small','',quarter(report.quarter)),el('strong','',currentValue));
  card.append(current,comparison('전년 동분기 대비',yearAgo));
  return card;
}

export function renderOverview(target,report,analysis){
  const wrap=el('div','report-overview');
  const box=el('section','analysis-box');
  if(analysis?.lines?.length){const list=el('ul');for(const line of analysis.lines)list.append(opinionLine(line));box.append(list)}
  else box.append(el('p','','요약을 준비하는 중입니다…'));
  if(analysis?.note)box.append(el('small','',analysis.note));wrap.append(box);
  const grid=el('div','report-metric-grid');
  for(const [key,title] of [['stores','점포수'],['sales','매출액 (점포당 월평균)'],['footfall',report.analysisAreaM2>0?'유동인구 (3개월간 1ha당 인구수)':'유동인구 (분기 합계)']])grid.append(reportCard(report,key,title));
  const source=`자료: 서울시 상권분석서비스 ${report.kind==='dong'?'행정동별':'상권별'} 원본 CSV · ${quarter(report.quarter)}. ${report.officialReportSales?'매출 요약은 서울시 분석보고서 표시값입니다. ':`매출액은 분기 합계를 3개월과 해당 분기 점포수로 나눴습니다. ${report.officialSalesEok!=null?'현재 매출은 서울시 순위 표시값을 사용하며 과거 분기는 원본 CSV 기준입니다. ':''}원본과 서울시 화면의 반올림·자료 차이로 증감액이 다를 수 있습니다. `}${report.analysisAreaM2>0?'유동인구는 서울시 분석 면적 기준으로 환산했습니다. ':''}`;
  wrap.append(grid,el('p','report-source',source));
  target.replaceChildren(wrap);
}

export function renderTrends(target,report){
  const wrap=el('div','trend-grid');
  for(const [key,[label]] of Object.entries(metrics)){
    const points=report.history.filter(x=>x.metric===key);const card=el('section','trend-card');
    card.append(el('h3','',label));
    if(!points.length){card.append(el('p','','추이 자료가 없습니다.'));wrap.append(card);continue}
    const values=points.map(x=>x.value),min=Math.min(...values),max=Math.max(...values),span=max-min||1;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 360 145');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${label} 분기별 추이`);
    for(const y of [24,65,106]){const line=document.createElementNS(svg.namespaceURI,'line');for(const [name,v] of Object.entries({x1:16,x2:344,y1:y,y2:y}))line.setAttribute(name,v);line.setAttribute('stroke','#e6e8f0');svg.append(line)}
    const coords=points.map((p,i)=>[20+(320*i/Math.max(points.length-1,1)),112-(p.value-min)/span*78]);
    const poly=document.createElementNS(svg.namespaceURI,'polyline');poly.setAttribute('points',coords.map(p=>p.join(',')).join(' '));poly.setAttribute('fill','none');poly.setAttribute('stroke','#6637cb');poly.setAttribute('stroke-width','3');svg.append(poly);
    coords.forEach(([x,y])=>{const dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','4');dot.setAttribute('fill','#6637cb');svg.append(dot)});
    card.append(svg,el('div','trend-labels',`${quarter(points[0].quarter)} → ${quarter(points.at(-1).quarter)}`),el('strong','',value(points.at(-1).value,key)));wrap.append(card);
  }
  target.replaceChildren(wrap);
}

export function renderTable(target,report){
  const table=el('table','history-table'),head=el('thead'),heading=el('tr');
  for(const name of ['분기',...Object.values(metrics).map(x=>x[0])])heading.append(el('th','',name));head.append(heading);table.append(head);
  const body=el('tbody');
  for(const q of [...new Set(report.history.map(x=>x.quarter))].reverse()){
    const tr=el('tr');tr.append(el('th','',quarter(q)));
    for(const key of Object.keys(metrics)){const row=report.history.find(x=>x.quarter===q&&x.metric===key);tr.append(el('td','',row?value(row.value,key):'—'))}body.append(tr);
  }
  table.append(body);target.replaceChildren(table,el('p','report-source','표의 값은 CSV 원본 수치입니다. 추이와 순위는 서로 다른 지표일 수 있습니다.'));
}
