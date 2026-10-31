import {renderPagePreviews} from '../../../intended-owner/consultation-pdf.js';

let fontBytes;
export async function buildFounderReviewPDF(sections,note){
  const {PDFDocument,rgb}=globalThis.PDFLib;
  const pdf=await PDFDocument.create();
  pdf.registerFontkit(globalThis.fontkit);
  if(!fontBytes){const response=await fetch('/pages/intended-owner/vendor/NotoSansKR-PDF.ttf');if(!response.ok)throw Error('PDF 글꼴을 불러오지 못했습니다.');fontBytes=await response.arrayBuffer()}
  const font=await pdf.embedFont(fontBytes,{subset:false});
  const ink=rgb(.09,.15,.24),muted=rgb(.39,.45,.55),line=rgb(.83,.86,.9),pale=rgb(.95,.96,.98),gold=rgb(1,.74,0);
  const paintings=[];let page,y;
  function paint(command){const index=pdf.getPages().indexOf(page);(paintings[index]??=[]).push(command)}
  function rect(x,top,width,height,color){const bottom=top-height;page.drawRectangle({x,y:bottom,width,height,color});paint({kind:'rect',x,y:bottom,width,height,color})}
  function draw(value,x,baseline,size,color){for(const char of String(value)){page.drawText(char,{x,y:baseline,size,font,color});paint({kind:'text',text:char,x,y:baseline,size,color});x+=font.widthOfTextAtSize(char,size)}}
  function wrap(value,size,width){const lines=[];let current='';for(const char of String(value||'')){if(char==='\n'){lines.push(current);current='';continue}if(current&&font.widthOfTextAtSize(current+char,size)>width){lines.push(current);current=char}else current+=char}lines.push(current);return lines}
  function startPage(){page=pdf.addPage([595.28,841.89]);rect(36,837,523,5,gold);draw('상권브릿지  |  KB 영업점 금융상담',38,811,10,muted);draw('상담 준비 내용',38,766,24,ink);draw('선택한 상권과 직접 입력한 예상 창업비용을 정리했습니다.',38,744,10,muted);y=716}
  function ensure(height){if(y-height<76)startPage()}
  function heading(title){ensure(42);rect(36,y,523,29,pale);draw(title,45,y-20,12,ink);y-=35}
  function row(label,value){const lines=wrap(value,10.5,390);const height=Math.max(34,lines.length*16+12);ensure(height);rect(38,y,519,height,line);rect(38.7,y-.7,105,height-1.4,pale);rect(143.7,y-.7,412.6,height-1.4,rgb(1,1,1));draw(label,47,y-23,10,muted);for(const [index,text] of lines.entries())draw(text,153,y-23-index*16,10.5,ink);y-=height}
  startPage();
  for(const section of sections){heading(section.title);for(const [label,value] of section.rows)row(label,value)}
  y-=15;for(const text of wrap(note,8.5,510)){ensure(16);draw(text,40,y,8.5,muted);y-=15}
  const pages=pdf.getPages();for(const [index,target] of pages.entries()){page=target;draw(`상권브릿지 · 고객 직접 입력 / ${index+1} / ${pages.length}`,40,30,9,muted)}
  pdf.setTitle('상권브릿지 - KB 영업점 상담 준비 내용');
  const preview=await renderPagePreviews(paintings,fontBytes);
  return {bytes:await pdf.save(),preview};
}
