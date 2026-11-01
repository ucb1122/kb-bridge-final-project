import {findChatRegion,getRegionSummary} from '../data.js';

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
