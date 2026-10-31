// Built entirely in the customer's browser. The PDF and contact details are not uploaded.
let fontBytes,previewFontPromise;
export async function buildConsultationPDF({summary,branch,form},dependencies={}){
 const {PDFDocument,rgb}=dependencies.PDFLib||globalThis.PDFLib;
 const pdf=await PDFDocument.create();pdf.registerFontkit(dependencies.fontkit||globalThis.fontkit);
 if(dependencies.fontBytes)fontBytes=dependencies.fontBytes;
 if(!fontBytes){const r=await fetch(new URL('./vendor/NotoSansKR-PDF.ttf',import.meta.url));if(!r.ok)throw Error('한글 글꼴을 불러오지 못했어요.');fontBytes=await r.arrayBuffer();}
 // This static Korean font requires full embedding; subsetting corrupts its CFF data.
 const font=await pdf.embedFont(fontBytes,{subset:false});
 let page=pdf.addPage([595.28,841.89]),y=735;
 const paintings=[];
 const ink=rgb(.12,.19,.29),muted=rgb(.38,.43,.5),gold=rgb(1,.77,.06);
 function paint(command,target=page){const i=pdf.getPages().indexOf(target);(paintings[i]??=[]).push(command);}
 function rect(x,y,width,height,color){page.drawRectangle({x,y,width,height,color});paint({kind:'rect',x,y,width,height,color});}
 function draw(text,x,baseline,size,color,target=page){for(const ch of text){target.drawText(ch,{x,y:baseline,size,font,color});paint({kind:'text',text:ch,x,y:baseline,size,color},target);x+=font.widthOfTextAtSize(ch,size);}}
 function header(){rect(36,792,523,5,gold);draw('상권브릿지  |  우리 가게 회복 플래너',38,811,10,muted);draw('소상공인 금융상담 신청서',38,757,23,ink);draw('고객 상황과 상담 희망 내용을 미리 정리하는 사전 상담서',38,735,10.5,muted);y=708;}
 header();
 function wrapped(text,size,max=510){const lines=[];let line='';for(const ch of String(text).replaceAll('→',' -> ').replaceAll('−','-')){if(font.widthOfTextAtSize(line+ch,size)>max&&line){lines.push(line);line=ch;}else line+=ch;}if(line)lines.push(line);return lines;}
 function line(text,size=10.5,color=ink){for(const value of wrapped(text,size)){if(y<63){page=pdf.addPage([595.28,841.89]);header();}draw(value,40,y,size,color);y-=18;}y-=5;}
 function heading(text){y-=5;rect(36,y-22,523,25,rgb(.95,.96,.98));draw(text,40,y-14,12,ink);y-=26;}
 const values=new Map(summary.split('\n').filter(t=>t.includes(':')).map(t=>{const i=t.indexOf(':');return [t.slice(0,i).trim(),t.slice(i+1).trim()];}));
 function tableRow(entries){
  const columns=entries.length,columnWidth=519/columns,labelWidth=90;
  const lines=entries.map(([label,value])=>({label,lines:wrapped(value||' ',11,columnWidth-labelWidth-17)}));
  const height=Math.max(34,...lines.map(c=>c.lines.length*16+12));
  if(y-height<70){page=pdf.addPage([595.28,841.89]);header();}
  for(const [i,cell] of lines.entries()){
   const x=38+i*columnWidth;
   rect(x,y-height,columnWidth,height,rgb(.81,.84,.88));rect(x+.6,y-height+.6,labelWidth-.6,height-1.2,rgb(.95,.96,.975));rect(x+labelWidth,y-height+.6,columnWidth-labelWidth-.6,height-1.2,rgb(1,1,1));
   draw(cell.label,x+9,y-24,10.5,muted);
   for(const [j,text]of cell.lines.entries())draw(text,x+labelWidth+8,y-23-j*16,11,ink);
  }
  y-=height;
 }
 heading('01  신청인 · 상담 희망 정보');
 tableRow([['상호',form.businessName||''],['성명',form.name||'']]);
 tableRow([['연락처',form.phone],['이메일',form.email||'']]);
 tableRow([['희망 영업점','KB국민은행 '+branch.name]]);
 tableRow([['희망일',form.date],['방법·시간',(form.channel==='visit'?'방문':'전화')+' 상담 / '+form.time]]);
 heading('02  상담하고 싶은 내용');
 tableRow([['주요 고민',values.get('가장 큰 고민')||values.get('고민')||'']]);
 tableRow([['선택 상권',values.get('상권')||'']]);
 const metric=['월세','월 상환액','월 매출'].find(key=>values.has(key));
 const linkedKey=[...values.keys()].find(k=>k.startsWith('매출 연동 상환 비교'));
 const linkedOn=linkedKey&&!values.get(linkedKey).startsWith('미입력');
 if(metric||!linkedOn)heading('03  고객이 입력한 부담 변화  /  단위: 만원');
 if(metric){
  const comparison=values.get(metric).split(/\s*(?:→|->)\s*/);
  tableRow([['비교 항목',metric],['입력 구분',values.get('입력 구분')||'고객 직접 입력']]);
  tableRow([['현재·평소',comparison[0]],['변경·최근',comparison[1]||'']]);
  const change=values.get('월 부담 변화')||values.get('매출 변화');if(change)tableRow([['한 달 차이',change]]);
 }else if(!linkedOn)tableRow([['금액 정보','미입력 / 상담에서 함께 확인']]);
 const cash=summary.split('\n').find(t=>t.startsWith('지금 남는 돈'));if(cash)tableRow([['남는 돈 계산',cash]]);
 if(linkedOn){
  heading((metric?'03-1':'03')+'  매출 연동 상환 비교 (제안 기능 · 현재 KB 상품 아님)');
  tableRow([['대출 조건',values.get(linkedKey)]]);
  if(values.has('업종'))tableRow([['업종',values.get('업종')]]);
  tableRow([['매출 흐름',values.get('매출 흐름 근거')||'']]);
  if(values.has('매출 변화 가정'))tableRow([['매출 변화 가정',values.get('매출 변화 가정')]]);
  if(values.has('앞으로 3개월 상환액 합계'))tableRow([['3개월 상환 합계',(values.get('앞으로 3개월 상환액 합계')||'')+'  (지금 방식 -> 연동)']]);
  tableRow([['최저 매출 달',(values.get('매출이 가장 적은 달 상환액')||'')+'  (지금 방식 -> 연동)']]);
  if(values.has('매출이 가장 많은 달 상환액'))tableRow([['최고 매출 달',values.get('매출이 가장 많은 달 상환액')]]);
  if(values.has('월매출 대비 최대 상환 부담'))tableRow([['최대 부담률',values.get('월매출 대비 최대 상환 부담')]]);
  tableRow([values.has('만기 일시 상환 원금')?['만기 원금',values.get('만기 일시 상환 원금')]:['상환 기간',values.get('상환 기간')||''],['총이자',values.get('총이자 차이')||'']]);
 }
 heading('04  함께 확인하고 싶은 지원');
 tableRow([['노란우산',values.get('노란우산 요청')||'선택 안 함']]);
 tableRow([['추가 상담',values.get('추가 상담')||'없음']]);
 y-=13;line('상담 참고: '+(values.get('상권 신호')||'상권 신호는 상담에서 확인'),8.5,muted);
 line('고객 입력과 가정의 비교이며, 지원·상환 조정·공제 가입은 별도 확인합니다.',8.5,muted);
 line('시연용 사전 상담서입니다. 실제 은행 접수·예약 또는 정식 신청서를 대신하지 않습니다.',8.5,muted);
 const pages=pdf.getPages();for(const [i,p] of pages.entries())draw(`상권브릿지  |  ${i+1} / ${pages.length}`,40,30,9,muted,p);
 pdf.setTitle('우리 가게 회복 플래너 - 영업점 상담서');
 if(dependencies.onPreview)await dependencies.onPreview(paintings,fontBytes);
 return pdf.save();
}

// The page preview uses the very same glyph positions, font and drawing commands as the PDF.
// It avoids requiring a browser PDF plug-in; the downloadable file remains a real PDF.
export async function renderPagePreviews(paintings,bytes){
 previewFontPromise??=(async()=>{const face=new FontFace('ConsultationPDF',bytes);await face.load();document.fonts.add(face);})();
 await previewFontPromise;
 return paintings.map(commands=>{
  const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=Math.round(1500*841.89/595.28);
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(canvas.width/595.28,canvas.height/841.89);
  for(const cmd of commands){ctx.fillStyle=`rgb(${Math.round(cmd.color.red*255)},${Math.round(cmd.color.green*255)},${Math.round(cmd.color.blue*255)})`;
   if(cmd.kind==='rect')ctx.fillRect(cmd.x,841.89-cmd.y-cmd.height,cmd.width,cmd.height);
   else{ctx.font=`${cmd.size}px ConsultationPDF`;ctx.fillText(cmd.text,cmd.x,841.89-cmd.y);}
  }
  return canvas.toDataURL('image/png');
 });
}
