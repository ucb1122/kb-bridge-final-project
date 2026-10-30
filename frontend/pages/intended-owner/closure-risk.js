import {escapeHTML as esc} from './navigator-model.js';
const number=(n,digits=1)=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:digits}).format(n);
export function validateClosureRisk(raw,knownCodes){
 if(raw?.schemaVersion!==1||raw.kind!=='closure-risk-priority'||raw.inputYear!==2025||raw.targetYear!==2027||raw.model?.formula!=='y ~ close_now + logstore + C(typ)')throw Error('폐업 위험 분석 기준을 확인해 주세요.');
 if(!Array.isArray(raw.results)||raw.results.length!==raw.universeCount)throw Error('상권 결과 수가 일치하지 않습니다.');
 const seen=new Set(),ranks=new Set();
 for(const row of raw.results){
  if(!knownCodes.has(row.code)||seen.has(row.code)||!['candidate','observed','insufficient'].includes(row.status))throw Error('상권코드 또는 상태가 유효하지 않습니다.');
  seen.add(row.code);
  if(row.status==='insufficient'){if(row.rank!==null||row.predictedClosureRate!==null)throw Error('자료미비 지역에 추정 순위가 있습니다.');}
  else {if(!Number.isInteger(row.rank)||row.rank<1||ranks.has(row.rank)||!Number.isFinite(row.predictedClosureRate)||!Number.isFinite(row.currentClosureRate)||row.averageStores<10)throw Error('폐업률·순위를 확인해 주세요.');ranks.add(row.rank);if((row.rank<=raw.candidateCount)!==(row.status==='candidate'))throw Error('상위 10% 기준이 일치하지 않습니다.');}
 }
 if(ranks.size!==raw.eligibleCount||raw.candidateCount!==Math.ceil(raw.eligibleCount*.1)||raw.results.filter(r=>r.status==='candidate').length!==raw.candidateCount||raw.results.filter(r=>r.status==='insufficient').length!==raw.unavailableCount)throw Error('선정 집계가 일치하지 않습니다.');
 for(let i=1;i<=raw.eligibleCount;i++)if(!ranks.has(i))throw Error('순위 누락이 있습니다.');
 const ranked=raw.results.filter(r=>r.rank!==null).sort((a,b)=>a.rank-b.rank);
 if(ranked.some((r,i)=>i&&r.predictedClosureRate>ranked[i-1].predictedClosureRate))throw Error('폐업률 순서가 일치하지 않습니다.');
 return {...raw,byCode:new Map(raw.results.map(r=>[r.code,r]))};
}
export function riskRows(regions,data,{kind='area',district='',query='',heat='candidate'}={}){
 const words=query.trim().toLocaleLowerCase('ko').split(/\s+/).filter(Boolean);
 return regions.filter(r=>r.kind===kind&&(!district||district===r.district)&&words.every(w=>(r.name+' '+r.district+' '+(r.dong||'')).toLocaleLowerCase('ko').includes(w))&&(kind!=='area'||query.trim()||heat==='all'||(heat==='unknown'?data.byCode.get(r.code)?.status==='insufficient':data.byCode.get(r.code)?.status==='candidate')))
 .sort((a,b)=>(data.byCode.get(a.code)?.rank??Infinity)-(data.byCode.get(b.code)?.rank??Infinity)||a.name.localeCompare(b.name,'ko'));
}
export function riskDetail(data,region){
 const r=region?.kind==='area'?data.byCode.get(region.code):null;
 if(!r)return {title:region?.kind==='dong'?'개별 상권으로 확인해 주세요':'폐업 위험 관찰 상권',badge:region?.kind==='dong'?'행정동 분류 없음':`${data.candidateCount}개 후보`,description:region?'분석은 개별 상권 단위입니다. 행정동 전체의 위험으로 합산하지 않습니다.':'예측 폐업률 상위 10%를 먼저 살펴봅니다. 왼쪽 순위나 지도에서 상권을 선택하세요.',html:''};
 if(r.status==='insufficient')return {title:'분석 자료 추가 확인',badge:'자료미비',description:r.missingReason+' · 안전한 상권이라는 뜻이 아닙니다.',html:''};
 const contributions=[['2025년 폐업률',data.model.coefficients.closureRate*r.currentClosureRate],['점포 규모',data.model.coefficients.log1pStores*Math.log1p(r.averageStores)],['상권 유형',data.model.coefficients['type:'+r.type]??0],['기준값',data.model.coefficients.intercept]];
 const html=`<p class="risk-period">2025년 입력 → 2027년 추정 · 개별 점포 확률 아님</p><div class="risk-kpis"><div><span>2027 예측 폐업률</span><strong>${number(r.predictedClosureRate)}<small>%</small></strong></div><div><span>2025 실제 폐업률</span><strong>${number(r.currentClosureRate)}<small>%</small></strong></div><div><span>서울 내 검토 순위</span><strong>${number(r.rank)}<small> / ${number(data.eligibleCount)}</small></strong></div></div><details class="risk-row-evidence"><summary>이 상권의 산출 근거</summary><p>2025년 폐업 ${number(r.closedStores,0)}개 ÷ 연평균 점포 ${number(r.averageStores,2)}개 × 100</p><p>유형: ${esc(r.type)} · 점포 규모: log(1+연평균 점포 수)</p><div class="risk-formula-parts">${contributions.map(([label,value])=>`<div><span>${esc(label)} 항</span><strong>${value>=0?'+':''}${number(value,3)}%p</strong></div>`).join('')}</div><p>위 항의 합 = ${number(r.predictedClosureRate,3)}%. 계수는 학습 결과이며 원인·효과의 크기가 아닙니다.</p><p>G지수 ${number(r.gIndex,3)} (${esc(r.gStage)})는 참고정보이며 순위 가산점이 없습니다.</p><p>재개발·철거 여부는 미대조 상태로 현장 확인이 필요합니다.</p></details>`;
 return {title:r.status==='candidate'?'먼저 살펴볼 집중검토 후보':'집중검토 후보 밖',badge:r.status==='candidate'?`서울 ${r.rank}위`:'일반·관찰',description:r.status==='candidate'?'예측 폐업률 상위 10%에 해당합니다. 개별 점포 지원 여부는 별도로 확인합니다.':'상위 10%에 포함되지 않았습니다. 위험이 없다는 뜻은 아닙니다.',html};
}
export function criteriaHTML(data){
 const c=data.model.coefficients,validation=data.validation.find(r=>r.horizonYears===2);
 return `<div class="criteria-visual"><article><span>① 현재 폐업률</span><strong>× ${number(c.closureRate,4)}</strong></article><article><span>② 점포 규모 (log(1+연평균 점포 수))</span><strong>× ${number(c.log1pStores,4)}</strong></article><article><span>③ 상권 유형</span><strong>유형별 보정</strong></article></div><div class="criteria-funnel"><strong>평가 ${number(data.eligibleCount,0)}곳</strong><span>↓ 예측 폐업률 순</span><strong>상위 10% · ${data.candidateCount}곳</strong></div><details class="criteria-explanation"><summary>산식·제외 기준·G지수</summary><p>예측 폐업률 = ${number(c.intercept,4)} + 위 두 항 + 유형 보정. 골목상권 0, 관광특구 ${number(c['type:관광특구'],4)}, 발달상권 ${number(c['type:발달상권'],4)}, 전통시장 ${number(c['type:전통시장'],4)} (%p).</p><p>현재 폐업률 = 연간 폐업 수 ÷ 4개 분기 평균 점포 수 × 100. 점포 10개 미만 제외, G 입력 완전 표본 사용. 자료미비 ${data.unavailableCount}곳은 별도 확인합니다.</p><p>2022~2023년 입력과 2024~2025년 결과로 학습. 2025년 입력 → 2027년 추정.</p><p>G지수는 보조지표이며 위 순위에 가산하지 않습니다. G 가중치: 상주인구 13.4% · 유동인구 20.2% · 창폐업 14.1% · 영업기간 13.4% · 프랜차이즈 15.0% · 매출 23.9%.</p><p>과거 2년 뒤 고위험(폐업률 상위 25%) 검증: 선정 적중률 ${number(validation.precision*100)}% · 전체 고위험 포착률 ${number(validation.recall*100)}%.</p><p>개별 점포의 폐업 확률이 아닙니다. 재개발·철거 여부는 별도 확인이 필요합니다.</p><p>${esc(data.sourceNotice)}</p></details>`;
}
