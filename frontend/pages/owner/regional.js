export const officialFood=[['CS100001','한식음식점'],['CS100002','중식음식점'],['CS100003','일식음식점'],['CS100004','양식음식점'],['CS100005','제과점'],['CS100006','패스트푸드점'],['CS100007','치킨전문점'],['CS100008','분식전문점'],['CS100009','호프·간이주점'],['CS100010','커피·음료']];
export const licenseToOfficial={korean:'CS100001',chinese:'CS100002',japanese:'CS100003',western:'CS100004',bakery:'CS100005',fastfood:'CS100006',chicken:'CS100007',snack:'CS100008',pub:'CS100009',coffee:'CS100010','service-0':'CS200001','service-1':'CS200002','service-2':'CS200005','service-3':'CS200006','service-4':'CS200007','service-5':'CS200008','service-6':'CS200009','service-9':'CS200028','service-10':'CS200029','service-11':'CS200031','service-art':'CS200003','service-computer':'CS200004','service-study':'CS200038','service-golf':'CS200017','service-gym':'CS200024','service-skin':'CS200030','retail-2':'CS300018','retail-3':'CS300019','retail-6':'CS300016','retail-11':'CS300029'};
export const quarterLabel=q=>q?`${String(q).slice(0,4)}년 ${String(q).slice(4)}분기`:'자료 없음';
export function metricValue(area,quarter,industry,metric){
 const p=area.periods[quarter];if(!p)return null;
 if(!['stores','sales','opened','closed','transactions','weekday','weekend'].includes(metric))return p[metric]??null;
 const entries=Object.entries(p.industries).filter(([code])=>industry==='all'||(industry==='food'?code.startsWith('CS1'):industry==='service'?code.startsWith('CS2'):industry==='retail'?code.startsWith('CS3'):code===industry));
 const values=entries.map(([,v])=>v[metric]).filter(v=>v!=null);
 return values.length?values.reduce((a,b)=>a+b,0):null;
}
export function growth(current,previous){return current==null||previous==null||previous<=0?null:(current-previous)/previous*100;}
export function rankAreas(data,{district='',dong='',industry='all',metric='stores'}={}){
 return Object.values(data.areas).filter(a=>(!district||a.district===district)&&(!dong||a.dong===dong)).map(area=>{
  const value=metricValue(area,data.quarter,industry,metric),previous=metricValue(area,data.previous,industry,metric);
  return {...area,value,previous,change:growth(value,previous)};
 }).filter(a=>a.value!=null&&a.change!=null).sort((a,b)=>b.change-a.change||b.value-a.value||a.code.localeCompare(b.code));
}
