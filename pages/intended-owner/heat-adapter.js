/** Reviewed binary area classifications only. Missing is never interpreted as non-overheated. */
export const HEAT_SCHEMA_VERSION=1;
export const HEAT_LABELS={overheated:'과열상권',not_overheated:'비과열상권',unknown:'결과 없음'};
const str=v=>typeof v==='string'&&v.trim().length>0;
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export function validateHeatResults(raw,knownCodes){
 const empty={ready:false,status:'pending',errors:[],results:new Map(),metadata:null};
 if(!raw)return empty;
 const meta=raw.metadata,errors=[];
 if(raw.schemaVersion!==1||!meta||!Array.isArray(raw.results))return {...empty,status:'invalid',errors:['분석결과 형식을 확인해 주세요.']};
 if(meta.regionKind!=='area'||!validDate(meta.asOfDate)||!str(meta.analysisVersion)||!str(meta.source)||!str(meta.definition)||!Array.isArray(meta.referencePeriods)||!meta.referencePeriods.length||!meta.referencePeriods.every(p=>p&&typeof p==='object'&&str(p.indicator)&&str(p.period)))errors.push('지역 단위·기준일·버전·분류 기준·지표별 기간이 필요합니다.');
 if(!['observed-classification','forecast'].includes(meta.scope))errors.push('관측 분류인지 미래 예측인지 구분해야 합니다.');
 if(meta.scope==='forecast'&&!str(meta.predictionHorizon))errors.push('예측 대상 기간이 필요합니다.');
 if(meta.review?.approved!==true||!validDate(meta.review?.reviewedAt)||!str(meta.review?.reviewedBy)||!str(meta.review?.method))return {...empty,status:'unreviewed',metadata:meta,errors:[...errors,'팀 검토를 완료한 결과만 지도에 연결합니다.']};
 const results=new Map();
 for(const row of raw.results){
  if(!row||typeof row.regionCode!=='string'||!/^\d{7}$/.test(row.regionCode)||!['overheated','not_overheated','unknown'].includes(row.classification)||results.has(row.regionCode)||knownCodes&&!knownCodes.has(row.regionCode)){
   errors.push('상권코드·분류값·중복 또는 공식 경계 연결을 확인해 주세요.');continue;
  }
  if(!str(row.reason)||!Array.isArray(row.evidence)||!row.evidence.every(e=>e&&typeof e==='object'&&str(e.label)&&str(e.period)&&str(e.unit)&&(e.value===null||typeof e.value==='number'&&Number.isFinite(e.value)))||row.classification!=='unknown'&&!row.evidence.some(e=>e&&typeof e.value==='number'&&Number.isFinite(e.value))){
   errors.push('상권별 근거와 지표의 값·단위·기간을 확인해 주세요.');continue;
  }
  results.set(row.regionCode,row);
 }
 if(errors.length)return {...empty,status:'invalid',metadata:meta,errors};
 return {ready:results.size>0,status:results.size?'ready':'pending',errors:[],results,metadata:meta};
}
export function classificationFor(validated,code){return validated?.ready?validated.results.get(String(code))||null:null;}
