import {findChatRegion,getRegionSummary,getRegionReport} from '../data.js';

const count=value=>`${Math.round(value).toLocaleString('ko-KR')}`;
const money=value=>`${(value/100000000).toLocaleString('ko-KR',{maximumFractionDigits:1})}억 원`;
const quarterText=value=>`${value.slice(0,4)}년 ${value.slice(4)}분기`;

export function regionReply(question){
  const region=findChatRegion(question);
  if(!region)return null;
  const report=getRegionSummary(region);
  if(!report)return null;
  const requested=[];
  if(/점포|가게|매장/.test(question))requested.push('stores');
  if(/매출/.test(question))requested.push('sales');
  if(/유동|방문/.test(question))requested.push('footfall');
  if(/거주|주민/.test(question))requested.push('residents');
  const keys=requested.length?requested:['stores','sales','footfall','residents'];
  const labels={stores:'점포 수',sales:'분기 추정매출',footfall:'분기 유동인구 원본값',residents:'거주인구 원본값'};
  const lines=keys.map(key=>{
    const value=report.metrics[key]?.value;
    return `• ${labels[key]}: ${Number.isFinite(value)?key==='sales'?money(value):`${count(value)}${key==='stores'?'개':'명'}`:'자료 없음'}`;
  });
  const scope=region.kind==='dong'?'행정동 전체':'공식 상권';
  const note=keys.includes('sales')?'매출은 지역의 분기 추정 총액이며, 개별 가게의 매출은 아닙니다.':'';
  return {text:[`${report.district} ${report.name} · ${scope} · ${quarterText(report.quarter)}`, ...lines,note].filter(Boolean).join('\n'),
    source:{source:'data/commerce.sqlite',title:`${report.district} ${report.name} ${quarterText(report.quarter)} 원본 통계`}};
}

export function regionDetail(question,history=[]){
  if(!/자세|상세|추이|변화|더 알려|더 설명|분석해/.test(question))return null;
  const previous=[...history].reverse().find(item=>item.role==='user'&&findChatRegion(item.content));
  const region=findChatRegion(question)|| (previous&&findChatRegion(previous.content));
  if(!region)return null;
  const report=getRegionReport(region);
  if(!report)return null;
  const source={source:'data/commerce.sqlite',title:`${report.district} ${report.name} ${quarterText(report.quarter)} 지역 상세 통계`};
  const scope=region.kind==='dong'?'행정동 전체':'공식 상권';
  const format=(key,value)=>key==='sales'?money(value):`${count(value)}${key==='stores'?'개':'명'}`;
  const changes=['stores','sales','footfall','residents'].map(key=>{
    const current=report.metrics[key];
    const previous=report.history.filter(row=>row.metric===key&&row.quarter<report.quarter).at(-1);
    if(!Number.isFinite(current?.value))return null;
    const delta=previous&&previous.value>0?`${(100*(current.value-previous.value)/previous.value).toFixed(1)}%`:null;
    return {key,current:format(key,current.value),previous:previous?format(key,previous.value):null,previousQuarter:previous?.quarter,delta};
  }).filter(Boolean);
  const stores=report.details?.[report.quarter]?.stores||{};
  const industries=(report.industries||[]).filter(row=>Number.isFinite(row.stores)).slice(0,3).map(row=>({name:row.name,stores:count(row.stores)}));
  const lines=[`${report.district} ${report.name} · ${scope} · ${quarterText(report.quarter)}`,
    ...changes.map(row=>`• ${ {stores:'점포 수',sales:'분기 추정매출',footfall:'분기 유동인구 원본값',residents:'거주인구 원본값'}[row.key]}: ${row.current}${row.previous?` (직전 자료 ${row.previousQuarter}: ${row.previous}, 변화 ${row.delta})`:''}`),
    Number.isFinite(stores.opened)&&Number.isFinite(stores.closed)?`• 점포 개업 ${count(stores.opened)}개, 폐업 ${count(stores.closed)}개 (해당 분기 원본값)`:null,
    industries.length?`• 점포가 많은 업종: ${industries.map(row=>`${row.name} ${row.stores}개`).join(', ')}`:null,
    '분기 추정매출은 지역 전체의 추정 총액입니다. 개별 가게의 매출이나 창업 성공 가능성을 뜻하지 않습니다.'].filter(Boolean);
  const facts=lines.join('\n');
  const byKey=Object.fromEntries(changes.map(row=>[row.key,row]));
  const trend=row=>{
    if(!row)return null;
    if(!row.previous||!row.delta)return `현재 값은 ${row.current}입니다. 비교할 직전 분기 값은 확인되지 않습니다.`;
    const change=parseFloat(row.delta);
    if(change===0)return `직전 분기 ${row.previous}와 현재 ${row.current}로, 표시된 변화율은 0.0%입니다.`;
    return `직전 분기 ${row.previous}에서 ${row.current}${row.key==='sales'?'으로':'로'} ${change<0?'줄었':'늘었'}습니다 (${Math.abs(change).toFixed(1)}%).`;
  };
  const detailLines=[
    `${report.district} ${report.name}의 ${quarterText(report.quarter)} 자료를 점포, 매출, 인구 순서로 살펴보겠습니다. 분석 범위는 ${scope}입니다.`,
    byKey.stores?`• 점포: ${trend(byKey.stores)} 이는 지역 전체의 점포 수 변화입니다.`:null,
    byKey.sales?`• 매출: ${trend(byKey.sales)} 분기 추정매출은 지역 전체의 3개월 합계로, 한 가게의 매출이나 월매출이 아닙니다.`:null,
    Number.isFinite(stores.opened)&&Number.isFinite(stores.closed)
      ?`• 개업·폐업: 이 분기에 개업 ${count(stores.opened)}개, 폐업 ${count(stores.closed)}개가 집계됐습니다. 두 수치만으로 다음 분기의 점포 수나 창업 성공 가능성을 단정할 수 없습니다.`:null,
    industries.length?`• 업종 구성: 점포가 많은 업종은 ${industries.map(row=>`${row.name} ${row.stores}개`).join(', ')} 순입니다. 업종별 점포 수는 경쟁 규모를 살펴볼 단서이며, 수익성 자체를 보여 주지는 않습니다.`:null,
    byKey.footfall?`• 유동인구: ${trend(byKey.footfall)} 공개 자료의 지역 집계값으로, 실제 고객 수와는 다릅니다.`:null,
    byKey.residents?`• 거주인구: ${trend(byKey.residents)} 상주 인구와 방문 인구는 서로 다른 지표입니다.`:null,
    '• 다음 확인: 내 상권 분석에서 업종을 고른 뒤 매출과 점포 수의 분기 추이를 함께 보세요. 입지나 창업비용을 판단하려면 실제 임대료와 예상 운영비도 따로 확인해야 합니다.',
  ].filter(Boolean);
  return {source,facts,fallback:detailLines.join('\n'),hit:{source:source.source,title:source.title,text:facts}};
}
