import {metricValue,growth,quarterLabel,licenseToOfficial} from './regional.js';
export const reportTabs=[['summary','간략보고서'],['industry','업종분석'],['sales','매출분석'],['population','인구분석'],['hinterland','지역(배후지)분석']];
const fmt=n=>n==null?'자료 없음':Number(n).toLocaleString('ko-KR');
export const htmlEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p=text=>({type:'paragraph',text});
const table=(title,headers,rows)=>({type:'table',title,headers,rows});
export function buildReports(context){
 const {location,industry,area,regional,market,license}=context;
 const q=regional?.quarter,prev=regional?.previous;
 const code=industry.code||industry.officialCode||licenseToOfficial[industry.id]||(industry.id==='all'?'all':null);
 const val=(metric,quarter=q)=>market&&regional&&(code||['floating','resident','worker'].includes(metric))?metricValue(market,quarter,code,metric):null;
 const change=metric=>{const g=growth(val(metric),val(metric,prev));return g==null?'비교 불가':`${g>0?'+':''}${g.toFixed(2)}%`;};
 const meta=[['위치',location.name],['업종',industry.label],['분석영역',area.label],['통계 기준',quarterLabel(q)],['비교 기준',quarterLabel(prev)]];
 const scope=market?`공식 통계는 ${market.name} (${market.type}, 상권코드 ${market.code}) 전체 기준입니다. 선택한 반경·보행권역과 다르며 상권끼리 합산하지 않습니다.`:'선택 위치가 포함된 공식 상권이 없어 상권별 통계는 표시하지 않습니다.';
 const source=p('출처: 서울 열린데이터광장 상권분석서비스 점포·추정매출·길단위인구·상주인구·직장인구 CSV. 2026-10-21 수집. 업종은 서울시 서비스업종 코드로 조회합니다.');
 const common=[table('분석 조건',['항목','내용'],meta),p(scope)];
 const counts=license?table('선택영역 인허가 관측 기록',['지표','값'],[['선택 업종',`${fmt(license.selected)}건`],['전체 확보 기록',`${fmt(license.total)}건`],['수집일',license.snapshot],['분류 기준','인허가 업태 묶음 (공식 업종과 별도)']]):null;
 const distribution=license?.groups?[{...table('선택영역 업종별 인허가 기록 (상위 5개)',['업종','기록수'],license.groups.map(([name,n])=>[name,fmt(n)+'건'])),type:'distribution',values:license.groups.map(([name,n])=>({name,count:n,share:license.total?n/license.total*100:0}))}]:[];
 const shops=license?.shops?[table('선택 업종 인허가 점포 (최대 30곳)',['상호','주소 / 원본 업태'],license.shops.map(s=>[s.name,s.address+' / '+s.industry]))]:[];
 const overlaps=(context.markets||[]).filter(a=>a.code!==market?.code).map(a=>table('겹치는 공식 상권 참고: '+a.name,['지표',quarterLabel(q)],[['상권코드',a.code],['유동인구 (원자료 집계)',fmt(metricValue(a,q,'all','floating'))],['상주인구',fmt(metricValue(a,q,'all','resident'))],['직장인구',fmt(metricValue(a,q,'all','worker'))]]));
 const basic=table('상권 핵심 지표',['지표',quarterLabel(q),'전분기 대비'],[['점포수',`${fmt(val('stores'))}${val('stores')==null?'':'곳'}`,change('stores')],['추정매출 (원자료 금액)',fmt(val('sales'))+' 원',change('sales')],['유동인구 (원자료 집계)',fmt(val('floating'))+' 명',change('floating')],['상주인구',fmt(val('resident'))+' 명',change('resident')]]);
 const summary=[p(scope),{type:'heading',text:'종합의견'},p(market?`${industry.label} 점포수는 ${val('stores')==null?'자료 없음':fmt(val('stores'))+'곳'}이며 전분기 대비 ${change('stores')}입니다. 매출과 인구의 변화, 현장 접근성 및 임대 조건을 함께 검토하세요.`:'확보된 인허가 점포의 분포를 확인할 수 있습니다. 공식 상권 통계가 없는 위치에 매출·인구 값을 임의 배분하지 않습니다.'),basic,...(counts?[counts]:[]),...distribution,common[0],p('인허가 관측은 허가별 기록으로 한 사업장의 복수 허가가 포함될 수 있습니다. 매출은 카드 기반 추정 집계이며 개별 점포의 실매출·이익·대출 가능액을 뜻하지 않습니다. 증가율은 (당분기-전분기)/전분기×100, 전분기 0 또는 결측은 비교 불가입니다.'),source];
 const sectors=market?Object.entries(market.periods[q]?.industries||{}).filter(([,r])=>r.stores!=null).sort((a,b)=>b[1].stores-a[1].stores).slice(0,15).map(([c,r])=>[regional.industries[c],fmt(r.stores)+'곳']):[];
 return reportTabs.map(([id,title])=>({id,title,location:location.name,industry:industry.label,quarter:q,blocks:id==='summary'?summary:id==='industry'?[...common,table('선택 업종 점포 변화',['지표',quarterLabel(prev),quarterLabel(q)],[['점포수',fmt(val('stores',prev)),fmt(val('stores'))],['개업 점포수',fmt(val('opened',prev)),fmt(val('opened'))],['폐업 점포수',fmt(val('closed',prev)),fmt(val('closed'))]]),...(counts?[counts]:[]),...distribution,...shops,table('상권 내 업종별 점포수 상위 15개',['업종','점포수'],sectors),p('인허가 업태 묶음과 공식 서비스업종은 정의가 달라 두 점포수를 직접 비교하지 않습니다.'),source]:id==='sales'?[...common,table('선택 업종 추정매출',['항목','값'],[['원자료 매출 금액 (원)',fmt(val('sales'))],['전분기 대비',change('sales')],['매출 건수',fmt(val('transactions'))],['주중 매출 금액 (원)',fmt(val('weekday'))],['주말 매출 금액 (원)',fmt(val('weekend'))]]),p('원본의 당월_매출_금액 필드를 분기코드로 조회했습니다. 월평균이나 분기 합계로 재해석하지 않습니다. 업종별 미제공 값을 0으로 대체하지 않습니다. 점포당 매출·임대료·수익은 산출하지 않습니다.'),source]:id==='population'?[...common,table('상권 인구 변화',['지표',quarterLabel(prev),quarterLabel(q),'증감률'],['floating','resident','worker'].map((m,i)=>[['유동인구 (원자료 집계)','상주인구','직장인구'][i],fmt(val(m,prev)),fmt(val(m)),change(m)])),...overlaps,p('유동인구는 원자료 집계값으로 실방문자 수나 고유인원 수가 아닙니다. 인구는 업종과 무관한 상권 전체 값입니다.'),source]:[...common,table('배후지와 공간 범위',['항목','내용'],[['자치구',market?.district||location.district||'지도 선택 위치'],['행정동 (상권 속성)',market?.dong||'자료 없음'],['상권 유형',market?.type||'자료 없음'],['공식 상권 면적',market?fmt(market.area)+' m²':'자료 없음'],['선택영역 면적',area.area?fmt(Math.round(area.area))+' m²':'보행도로 범위 / 미산출'],['보행 기준',area.kind==='walking'?'시속 4km, 공개 보행도로 최단거리':'직선 반경 또는 다각형']]),...overlaps,p('행정동은 상권 영역의 속성입니다. 행정동 전체 통계가 아니며 겹치는 관광특구·발달상권·골목상권을 합산하지 않습니다. 건물별 유동인구와 임대료 자료는 미연결입니다.'),source]}));
}
export function renderReportHTML(report){
 return report.blocks.map(b=>{
  if(b.type==='heading')return '<h2>'+htmlEscape(b.text)+'</h2>';
  if(b.type==='paragraph')return '<p class="report-paragraph">'+htmlEscape(b.text)+'</p>';
  if(b.type==='distribution')return '<section class="report-section"><h3>'+htmlEscape(b.title)+'</h3><div class="distribution">'+b.values.map(v=>'<div><span>'+htmlEscape(v.name)+'</span><b>'+fmt(v.count)+'건</b><i style="--size:'+v.share+'%"></i></div>').join('')+'</div></section>';
  return '<section class="report-section"><h3>'+htmlEscape(b.title)+'</h3><table class="report-table"><thead><tr>'+b.headers.map(h=>'<th>'+htmlEscape(h)+'</th>').join('')+'</tr></thead><tbody>'+(b.rows.length?b.rows.map(row=>'<tr>'+row.map(c=>'<td>'+htmlEscape(c)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+b.headers.length+'">자료 없음</td></tr>')+'</tbody></table></section>';
 }).join('');
}

let fontPromise;
export async function createReportPDF(report,dependencies={}){
 const lib=dependencies.PDFLib||globalThis.PDFLib,kit=dependencies.fontkit||globalThis.fontkit;
 if(!lib||!kit)throw Error('PDF 라이브러리를 불러오지 못했습니다. 새로고침해 주세요.');
 const bytes=dependencies.fontBytes||await(fontPromise??=fetch(new URL('./vendor/NotoSansKR-PDF.ttf',import.meta.url)).then(r=>{if(!r.ok)throw Error('한글 글꼴 로딩 실패');return r.arrayBuffer();}));
 // Full embedding avoids broken Korean compound glyphs in subset fonts across PDF viewers.
 const doc=await lib.PDFDocument.create();doc.registerFontkit(kit);const font=await doc.embedFont(bytes,{subset:false});
 doc.setTitle(report.title+' - '+report.location);doc.setAuthor('KB-Bridge 03조 블렌드');
 const {rgb}=lib,blue=rgb(.02,.45,.86),ink=rgb(.1,.13,.18),gray=rgb(.46,.49,.53);let page,y,pages=[];
 const clean=s=>String(s??'').replace(/[\r\n\t]/g,' ').replace(/\u2011/g,'-');
 // Position glyphs explicitly: some Korean fonts' layout advances differ in PDF viewers.
 const charWidth=(ch,size)=>font.widthOfTextAtSize(ch,size);
 function draw(text,x,baseline,size,color,target=page){for(const ch of clean(text)){target.drawText(ch,{x,y:baseline,size,font,color});x+=charWidth(ch,size);}}
 function addPage(){page=doc.addPage([595.28,841.89]);pages.push(page);y=733;page.drawRectangle({x:0,y:766,width:596,height:76,color:blue});draw(report.title,40,798,21,rgb(1,1,1));draw('KB-Bridge | '+quarterLabel(report.quarter),40,779,10,rgb(1,1,1));}
 function ensure(h){if(y-h<57)addPage();}
 function lines(text,width,size){const out=[];let line='',used=0;for(const ch of clean(text)){const advance=charWidth(ch,size);if(line&&used+advance>width){out.push(line);line=ch;used=advance;}else{line+=ch;used+=advance;}}out.push(line);return out;}
 function write(text,size=10,width=515,x=40,color=ink){const ls=lines(text,width,size);for(const l of ls){ensure(size*1.7);draw(l,x,y,size,color);y-=size*1.7;}}
 addPage();write(report.location+' / '+report.industry,13);y-=15;
 for(const b of report.blocks){
  if(b.type==='heading'){ensure(60);y-=12;write(b.text,17,515,40,blue);y-=8;}
  else if(b.type==='paragraph'){write(b.text,10);y-=15;}
  else{
   ensure(100);write(b.title,13,515,40,blue);y-=8;const n=b.headers.length,colWidth=515/n;
   const drawRow=(row,header=false)=>{const wrapped=row.map(t=>lines(t,colWidth-16,9)),height=Math.max(...wrapped.map(l=>l.length))*15+10;ensure(height+6);page.drawRectangle({x:40,y:y-height+5,width:515,height,color:header?rgb(.91,.95,.99):rgb(.98,.98,.98),borderColor:rgb(.85,.87,.89),borderWidth:.4});for(let i=0;i<n;i++){wrapped[i].forEach((l,j)=>draw(l,48+i*colWidth,y-10-j*15,9,ink));}y-=height;};
   drawRow(b.headers,true);for(const row of b.rows.length?b.rows:[Array(n).fill('자료 없음')]){if(y<110){addPage();drawRow(b.headers,true);}drawRow(row);}y-=23;
  }
 }
 pages.forEach((p,i)=>{draw('서울시 공공데이터 기반 | 현장 확인과 함께 활용하세요.',40,31,8,gray,p);draw(`${i+1} / ${pages.length}`,515,31,8,gray,p);});
 return doc.save();
}
export async function downloadReports(reports,onStatus=()=>{}){
 // One ZIP avoids browsers blocking multiple automatic downloads. Each report is a separate PDF.
 onStatus('한글 PDF 5종을 생성하고 있습니다…');
 const files=[];for(const report of reports)files.push({name:`${report.title}.pdf`,bytes:await createReportPDF(report)});
 const zip=zipFiles(files),url=URL.createObjectURL(new Blob([zip],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=`상권분석_${reports[0].location.replace(/[\\/:*?"<>|]/g,'_')}_PDF5종.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);onStatus('5개 PDF가 담긴 ZIP을 저장했습니다.');
}
export async function downloadOneReport(report){const b=await createReportPDF(report),u=URL.createObjectURL(new Blob([b],{type:'application/pdf'})),a=document.createElement('a');a.href=u;a.download=report.title+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);}
export function zipFiles(files){
 const enc=new TextEncoder(),chunks=[],central=[];let offset=0;
 const crc=b=>{let n=-1;for(const v of b){n^=v;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^-1)>>>0;};
 const header=(size,values)=>{const b=new Uint8Array(size),v=new DataView(b.buffer);for(const [pos,num,len] of values)len===2?v.setUint16(pos,num,true):v.setUint32(pos,num,true);return b;};
 for(const f of files){const name=enc.encode(f.name),b=f.bytes,c=crc(b),local=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[14,c,4],[18,b.length,4],[22,b.length,4],[26,name.length,2]]),cd=header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[16,c,4],[20,b.length,4],[24,b.length,4],[28,name.length,2],[42,offset,4]]);chunks.push(local,name,b);central.push(cd,name);offset+=local.length+name.length+b.length;}
 const length=central.reduce((n,b)=>n+b.length,0),end=header(22,[[0,0x06054b50,4],[8,files.length,2],[10,files.length,2],[12,length,4],[16,offset,4]]),out=new Uint8Array(offset+length+22);let pos=0;for(const b of [...chunks,...central,end]){out.set(b,pos);pos+=b.length;}return out;
}
