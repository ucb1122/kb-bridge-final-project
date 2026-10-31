import {renderPagePreviews} from '../../../intended-owner/consultation-pdf.js';

let fontBytes;
export async function buildFounderReviewPDF(sections){
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
  function startPage(){page=pdf.addPage([595.28,841.89]);rect(36,792,523,5,gold);draw('상권브릿지  |  KB 영업점 금융상담',38,811,10,muted);draw('상담 준비 내용',38,757,24,ink);draw('선택한 상권과 직접 입력한 예상 창업비용을 정리했습니다.',38,735,10,muted);y=708}
  function ensure(height){if(y-height<76)startPage()}
  function heading(title){ensure(42);rect(36,y,523,29,pale);draw(title,45,y-20,12,ink);y-=35}
  function rowCells(entries){
    const paired=entries.length===2, width=paired?259.5:519, labelWidth=105;
    const layouts=entries.map(([label,value])=>({label,lines:wrap(value,10.5,width-labelWidth-18)}));
    const height=Math.max(34,...layouts.map(item=>item.lines.length*16+12));
    ensure(height);
    for(const [index,item] of layouts.entries()){
      const x=38+index*width;
      rect(x,y,width,height,line);
      rect(x+.7,y-.7,labelWidth-1.4,height-1.4,pale);
      rect(x+labelWidth-.7,y-.7,width-labelWidth, height-1.4,rgb(1,1,1));
      draw(item.label,x+8,y-23,9.5,muted);
      for(const [lineIndex,value] of item.lines.entries())draw(value,x+labelWidth+8,y-23-lineIndex*16,10.5,ink);
    }
    y-=height;
  }
  function canPair([label,value]){
    return font.widthOfTextAtSize(label,9.5)<=95&&wrap(value,10.5,136).length<=2;
  }
  function memoCell([label,value]){
    const lines=wrap(value,10.5,499);
    for(let offset=0;offset<lines.length;){
      const available=Math.max(1,Math.floor((y-76-66)/16));
      if(available<3){startPage();continue}
      const chunk=lines.slice(offset,offset+available);
      const height=Math.max(86,chunk.length*16+66);
      ensure(height);
      rect(38,y,519,height,line);
      rect(38.7,y-.7,517.6,28,pale);
      rect(38.7,y-28.7,517.6,height-29.4,rgb(1,1,1));
      draw(label,46,y-19,9.5,muted);
      chunk.forEach((text,index)=>draw(text,46,y-48-index*16,10.5,ink));
      y-=height;offset+=chunk.length;
    }
  }
  startPage();
  for(const section of sections){
    heading(section.title);
    const keepTwoColumns=section.title.includes('신청인 정보')||section.title.includes('예상 창업 자금');
    for(let index=0;index<section.rows.length;index++){
      const first=section.rows[index], second=section.rows[index+1];
      if(first[0]==='상담에서 물어볼 내용'){
        startPage();
        heading(section.title);
        memoCell(first);
        continue;
      }
      if(second&&canPair(first)&&canPair(second)){rowCells([first,second]);index++}
      else if(keepTwoColumns&&canPair(first))rowCells([first,['','']]);
      else rowCells([first]);
    }
  }
  const pages=pdf.getPages();for(const [index,target] of pages.entries()){page=target;draw(`상권브릿지  |  ${index+1} / ${pages.length}`,40,30,9,muted)}
  pdf.setTitle('상권브릿지 - KB 영업점 상담 준비 내용');
  const preview=await renderPagePreviews(paintings,fontBytes);
  return {bytes:await pdf.save(),preview};
}
