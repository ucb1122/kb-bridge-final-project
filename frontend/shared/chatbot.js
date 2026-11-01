const button=document.querySelector('.header-chatbot');
if(button){
  button.disabled=false;button.removeAttribute('title');button.setAttribute('aria-haspopup','dialog');
  const link=document.createElement('link');link.rel='stylesheet';link.href='/shared/chatbot.css';document.head.append(link);
  const overlay=document.createElement('div');overlay.className='chat-overlay';overlay.hidden=true;
  overlay.innerHTML=`<section class="chat-dialog" role="dialog" aria-modal="false" aria-labelledby="chat-title">
    <header class="chat-top"><div class="chat-title-wrap"><img src="/shared/characters/kobi-face.png" alt=""><div><h2 id="chat-title">코비에게 물어보세요</h2></div></div><div class="chat-actions"><button class="chat-reset" type="button">대화 초기화</button><button class="chat-close" type="button" aria-label="챗봇 닫기"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button></div></header>
    <div class="chat-messages" role="log" aria-live="polite"><div class="chat-line bot"><img src="/shared/characters/kobi-face.png" alt=""><div class="chat-bubble">안녕하세요! 상권 분석, 회복 플래너, 상담 준비에 대해 궁금한 점을 물어보세요.</div></div></div>
    <form class="chat-form"><label class="chat-sr" for="chat-question">질문</label><textarea id="chat-question" rows="1" maxlength="800" placeholder="상권브릿지에 대해 질문해 주세요" required></textarea><button type="submit">보내기</button></form></section>`;
  document.body.append(overlay);
  const form=overlay.querySelector('form'),input=overlay.querySelector('textarea'),messages=overlay.querySelector('.chat-messages');
  let before,controller,busy=false,sessionVersion=0;const history=[];
  const dialog=overlay.querySelector('.chat-dialog'),header=overlay.querySelector('.chat-top');
  const storageKey='kb-bridge-chat-session';
  const saved=[];
  const persist=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify(saved.slice(-30)))}catch{}};
  function open(){before=document.activeElement;overlay.hidden=false;input.focus()}
  function close(){overlay.hidden=true;before?.focus()}
  button.addEventListener('click',open);
  overlay.querySelector('.chat-close').addEventListener('click',close);
  overlay.querySelector('.chat-reset').addEventListener('click',()=>{
    sessionVersion++;
    controller?.abort();
    history.length=0;saved.length=0;
    try{sessionStorage.removeItem(storageKey)}catch{}
    messages.replaceChildren();
    addLine('bot','안녕하세요! 상권 분석, 회복 플래너, 상담 준비에 대해 궁금한 점을 물어보세요.');
    input.value='';input.focus();
  });
  document.addEventListener('keydown',event=>{if(!overlay.hidden&&event.key==='Escape')close()});
  let drag;
  header.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button'))return;
    const rect=dialog.getBoundingClientRect();
    drag={x:event.clientX-rect.left,y:event.clientY-rect.top};
    header.setPointerCapture(event.pointerId);header.classList.add('dragging');
  });
  header.addEventListener('pointermove',event=>{
    if(!drag)return;
    const x=Math.max(0,Math.min(innerWidth-dialog.offsetWidth,event.clientX-drag.x));
    const y=Math.max(0,Math.min(innerHeight-dialog.offsetHeight,event.clientY-drag.y));
    dialog.style.left=`${x}px`;dialog.style.top=`${y}px`;
    dialog.style.right='auto';dialog.style.bottom='auto';
  });
  const stopDrag=()=>{drag=null;header.classList.remove('dragging')};
  header.addEventListener('pointerup',stopDrag);header.addEventListener('pointercancel',stopDrag);
  window.addEventListener('resize',()=>{
    if(!dialog.style.left)return;
    dialog.style.left=`${Math.max(0,Math.min(innerWidth-dialog.offsetWidth,parseFloat(dialog.style.left)))}px`;
    dialog.style.top=`${Math.max(0,Math.min(innerHeight-dialog.offsetHeight,parseFloat(dialog.style.top)))}px`;
  });
  function addLine(role,text=''){
    const line=document.createElement('div');line.className=`chat-line ${role}`;
    if(role==='bot'){const image=document.createElement('img');image.src='/shared/characters/kobi-face.png';image.alt='';line.append(image)}
    const bubble=document.createElement('div');bubble.className='chat-bubble';bubble.textContent=text;line.append(bubble);messages.append(line);messages.scrollTop=messages.scrollHeight;
    return {line,bubble};
  }
  function formatAnswer(bubble,value,streaming=false){
    bubble.replaceChildren();let list;
    const appendInline=(element,text)=>{
      text=text.replace(/\\\*/g,'*');
      if(streaming&&text.endsWith('*')&&!text.endsWith('**'))text=text.slice(0,-1);
      let start=0;
      while(start<text.length){
        const opening=text.indexOf('**',start);
        if(opening<0){element.append(document.createTextNode(text.slice(start)));break}
        element.append(document.createTextNode(text.slice(start,opening)));
        const closing=text.indexOf('**',opening+2);
        const strong=document.createElement('strong');strong.textContent=text.slice(opening+2,closing<0?undefined:closing);element.append(strong);
        if(closing<0)break;
        start=closing+2;
      }
    };
    for(const raw of value.split('\n')){
      const line=raw.trim();if(!line)continue;
      const bullet=line.match(/^(?:[•*-]|\d+\.)\s+(.+)/);
      if(bullet){
        list??=document.createElement('ul');
        const item=document.createElement('li');appendInline(item,bullet[1]);list.append(item);
        if(!list.isConnected)bubble.append(list);
      }else{
        list=null;const paragraph=document.createElement('p');appendInline(paragraph,line);bubble.append(paragraph);
      }
    }
  }
  const durationText=seconds=>seconds>=60?`${Math.floor(seconds/60)}분 ${seconds%60}초`:`${seconds}초`;
  function sourceText(sources){
    const labels=[...new Set(sources.map(item=>{
      if(item.source==='data/commerce.sqlite')return `서울시 공개 상권 통계 · ${item.title.replace(/ (?:원본 통계|지역 상세 통계)$/,'')}`;
      if(item.source==='frontend/shared/finance/products.json')return `${item.title}${item.verifiedAt?` (${item.verifiedAt} 확인)`:''}`;
      if(item.source==='frontend/pages/intended-owner/assets/closure-risk.json')return `우리 가게 회복 플래너 · ${item.title}`;
      if(item.source==='docs/CHATBOT-KNOWLEDGE.md')return '상권브릿지 이용 안내';
      if(item.source==='docs/OWNER-FOUNDER-CONSULTATION.md')return 'KB 영업점 금융상담 안내';
      if(item.source==='docs/DATA-MODEL.md')return '상권 데이터 설명';
      if(item.source==='README.md')return '상권브릿지 프로젝트 안내';
      return '상권브릿지 안내 자료';
    }))];
    return `참고 자료: ${labels.join(' · ')}`;
  }
  try{
    const previous=JSON.parse(sessionStorage.getItem(storageKey)||'[]');
    if(Array.isArray(previous)&&previous.length){
      messages.replaceChildren();
      for(const item of previous.slice(-30)){
        if(!['user','bot'].includes(item?.role)||typeof item.text!=='string')continue;
        const {line,bubble}=addLine(item.role,item.text);
        if(item.role==='bot')formatAnswer(bubble,item.text);
        if(item.role==='bot'&&Array.isArray(item.sources)&&item.sources.length){
          const small=document.createElement('small');small.className='chat-source';small.textContent=sourceText(item.sources);line.append(small);
        }
        if(item.role==='bot'&&Number.isFinite(item.durationSeconds)){
          const small=document.createElement('small');small.className='chat-duration';small.textContent=`답변 시간 ${durationText(item.durationSeconds)}`;line.append(small);
        }
        saved.push(item);
      }
      for(const item of saved.slice(-4))history.push({role:item.role==='bot'?'assistant':'user',content:item.text});
    }
  }catch{}
  async function ask(question){
    if(busy)return;const version=sessionVersion;busy=true;input.value='';form.querySelector('button').disabled=true;
    addLine('user',question);saved.push({role:'user',text:question});persist();
    const {line,bubble}=addLine('bot','생각 중…');
    const started=performance.now();
    const duration=document.createElement('small');duration.className='chat-duration';line.append(duration);
    const updateDuration=()=>{duration.textContent=`답변 중 · ${durationText(Math.floor((performance.now()-started)/1000))}`};
    updateDuration();const durationTimer=setInterval(updateDuration,1000);
    let answer='',pending='',typing=false,sources=[];
    const render=()=>{
      if(version!==sessionVersion){pending='';typing=false;return}
      if(!pending){typing=false;return}
      const size=Math.min(48,Math.max(12,Math.ceil(pending.length/8)));
      answer+=pending.slice(0,size);pending=pending.slice(size);formatAnswer(bubble,answer,true);
      messages.scrollTop=messages.scrollHeight;requestAnimationFrame(render);
    };
    const push=value=>{if(!answer)bubble.textContent='';pending+=value;if(!typing){typing=true;requestAnimationFrame(render)}};
    controller=new AbortController();
    try{
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,history:history.slice(-4)}),signal:controller.signal});
      if(!response.ok)throw Error('답변을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(true){
        const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});
        let index;while((index=buffer.indexOf('\n'))>=0){
          const raw=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);if(!raw)continue;
          const item=JSON.parse(raw);
          if(item.type==='delta')push(item.text);
          if(item.type==='replace'){
            pending='';typing=false;answer=item.text;
            formatAnswer(bubble,answer,true);
          }
          if(item.type==='sources')sources=item.sources;
        }
      }
      while(typing)await new Promise(resolve=>setTimeout(resolve,20));
      if(version!==sessionVersion)return;
      if(!answer)throw Error('답변이 비어 있어요. 다시 질문해 주세요.');
      formatAnswer(bubble,answer);
      if(sources.length){const small=document.createElement('small');small.className='chat-source';small.textContent=sourceText(sources);line.append(small)}
      history.push({role:'user',content:question},{role:'assistant',content:answer});
      saved.push({role:'bot',text:answer,sources,durationSeconds:Math.floor((performance.now()-started)/1000)});persist();
    }catch(error){if(version===sessionVersion){bubble.textContent=error.name==='AbortError'?'답변을 중단했어요.':error.message;saved.push({role:'bot',text:bubble.textContent,durationSeconds:Math.floor((performance.now()-started)/1000)});persist()}}
    finally{clearInterval(durationTimer);if(version===sessionVersion)duration.textContent=`답변 시간 ${durationText(Math.floor((performance.now()-started)/1000))}`;busy=false;form.querySelector('button').disabled=false;if(!overlay.hidden)input.focus()}
  }
  form.addEventListener('submit',event=>{event.preventDefault();const question=input.value.trim();if(question)ask(question)});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit()}});
}
