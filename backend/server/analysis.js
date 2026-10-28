import {getRegionReport} from './data.js';

const cache=new Map();
const names={stores:'점포수',sales:'추정매출액',footfall:'유동인구',residents:'상주인구'};
const number=value=>Math.round(value).toLocaleString('ko-KR');
const days=['월요일','화요일','수요일','목요일','금요일','토요일','일요일'];
const hours=['00~06시','06~11시','11~14시','14~17시','17~21시','21~24시'];
const units={stores:'개',sales:'원',footfall:'명',residents:'명'};
function topPart(source,labels,prefix,unit){
  if(!source)return null;
  const parts=labels.map((label,i)=>({label,value:source[`${prefix}${i}`]})).filter(x=>x.value!=null);
  if(!parts.length)return null;
  const top=parts.reduce((a,b)=>a.value>=b.value?a:b);
  return `${top.label} ${number(top.value)}${unit}`;
}
function analysisFacts(report){
  const quarter=report.quarter,details=report.details?.[quarter]||{};
  const metrics=Object.fromEntries(Object.entries(names).map(([key,label])=>{
    const metric=report.metrics[key],history=report.history.filter(x=>x.metric===key).slice(-5);
    return [label,{현재:`${number(metric?.value||0)}${units[key]}`,
      전분기대비:metric?.change==null?'비교 자료 없음':`${metric.change>=0?'+':''}${(metric.change*100).toFixed(1)}%`,
      최근5분기:history.map(x=>`${x.quarter}: ${number(x.value)}${units[key]}`)}];
  }));
  return {지역:`${report.district} ${report.name}`,기준분기:quarter,지표:metrics,
    점포세부:details.stores?{개업:`${number(details.stores.opened||0)}개`,폐업:`${number(details.stores.closed||0)}개`,
      일반점포:`${number(details.stores.regular||0)}개`,프랜차이즈:`${number(details.stores.franchise||0)}개`}:null,
    점포수상위업종:[...(report.industries||[])].sort((a,b)=>(b.stores||0)-(a.stores||0)).slice(0,5).map(x=>`${x.name} ${number(x.stores||0)}개`),
    매출최고요일:topPart(details.sales,days,'day_','원'),매출최고시간대:topPart(details.sales,hours,'hour_','원'),
    유동인구최고요일:topPart(details.footfall,days,'day_','명'),유동인구최고시간대:topPart(details.footfall,hours,'hour_','명')};
}

function localSummary(report){
  const lines=[];
  for(const [metric,label] of Object.entries(names)){
    const item=report.metrics[metric];
    if(!item)continue;
    const unit=metric==='sales'?'원':metric==='stores'?'개':'명';
    const trend=item.change==null?'전분기 비교 자료가 없습니다':item.change===0?'전분기와 같습니다':`전분기보다 ${Math.abs(item.change*100).toFixed(1)}% ${item.change>0?'증가':'감소'}했습니다`;
    if(metric==='residents'&&lines.length)lines[lines.length-1]+=` 상주인구는 ${number(item.value)}명이며 ${trend}.`;
    else lines.push(`${label}${metric==='sales'?'은':'는'} ${number(item.value)}${unit}이며 ${trend}.`);
  }
  const stores=report.details?.[report.quarter]?.stores;
  const extras=[];
  if(stores)extras.push(`이번 분기 개업 점포는 ${number(stores.opened||0)}개, 폐업 점포는 ${number(stores.closed||0)}개입니다.`);
  const top=[...(report.industries||[])].sort((a,b)=>(b.stores||0)-(a.stores||0))[0];
  if(top)extras.push(`점포가 가장 많은 세부 업종은 ${top.name}(${number(top.stores)}개)입니다.`);
  const sales=report.details?.[report.quarter]?.sales;
  if(sales){const most=days.map((day,i)=>({day,value:sales[`day_${i}`]||0})).sort((a,b)=>b.value-a.value)[0];extras.push(`추정매출액이 가장 큰 요일은 ${most.day}입니다.`)}
  if(extras.length)lines.push(extras.join(' '));
  return lines.slice(0,4);
}

export async function getRegionAnalysis(query){
  const report=getRegionReport(query);
  if(!report)return null;
  const model=process.env.OLLAMA_MODEL||'gemma4:e2b';
  const fallback={mode:'data',lines:localSummary(report),note:'Ollama 종합의견을 사용할 수 없어 원본 CSV의 핵심 수치를 표시합니다. Ollama를 실행하고 설정된 모델을 내려받으세요.'};
  const key=`${model}:${report.kind}:${report.code}:${report.quarter}`;
  if(cache.has(key))return cache.get(key);
  try{
    const base=new URL(process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434');
    const response=await fetch(new URL('/api/generate',base),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model,stream:false,think:false,
        format:{type:'object',properties:{opinions:{type:'array',minItems:4,maxItems:4,items:{type:'string'}}},required:['opinions'],additionalProperties:false},
        system:'서울시 상권분석 보고서의 종합의견을 작성합니다. JSON opinions 배열에 한국어 문장 정확히 4개를 넣으세요. 각 문장은 화면의 글머리표 하나로 표시되므로 1~2문장, 110자 이내로 씁니다. 1번: 점포수의 전분기 변화와 개폐업. 2번: 추정매출액의 전분기 변화와 최고 요일 또는 시간대. 3번: 유동인구와 상주인구의 변화. 4번: 앞의 지표를 함께 본 신중한 종합 판단 또는 추가 확인할 점. 입력된 수치와 단위만 사용하고 자릿수를 바꾸지 마세요. 제공되지 않은 순위·소득·임대료·수익성·창업 성공률을 만들지 마세요. 유동인구 증가가 매출 증가를 일으켰다고 단정하지 마세요. 월평균과 분기 합계를 혼동하지 말고 과장된 조언을 피하세요. 마크다운·번호·제목은 쓰지 마세요.',
        prompt:JSON.stringify(analysisFacts(report)),
        options:{temperature:0.2,num_ctx:8192,num_predict:420}}),
      signal:AbortSignal.timeout(120000),
    });
    if(!response.ok){
      if(response.status===404)throw Error(`모델 ${model}을 찾을 수 없습니다. ollama pull ${model}을 실행하세요.`);
      throw Error(`Ollama 응답 ${response.status}`);
    }
    const data=await response.json();
    const summary=JSON.parse(data.response||'{}');
    if(!Array.isArray(summary.opinions)||summary.opinions.length!==4||summary.opinions.some(line=>typeof line!=='string'||!line.trim()))
      throw Error('Ollama 응답에 4개 종합의견이 없습니다.');
    const result={mode:'ai',lines:summary.opinions.map(line=>line.trim()),note:`로컬 Ollama ${model} 생성 · 원본 CSV와 비교해 활용하세요.`};
    cache.set(key,result);return result;
  }catch(error){
    const reason=error.name==='TimeoutError'?'2분 안에 응답하지 않았습니다. 더 작은 모델을 선택해 보세요.':
      error instanceof TypeError?'Ollama 서버에 연결할 수 없습니다. Ollama가 실행 중인지 확인하세요.':error.message;
    return {...fallback,note:`${reason} 원본 CSV 수치 요약을 표시합니다.`};
  }
}
