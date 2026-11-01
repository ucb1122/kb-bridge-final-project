const button=document.querySelector('.header-chatbot');
if(button){
  button.disabled=false;button.removeAttribute('title');button.setAttribute('aria-haspopup','dialog');
  const link=document.createElement('link');link.rel='stylesheet';link.href='/shared/chatbot.css';document.head.append(link);
  const overlay=document.createElement('div');overlay.className='chat-overlay';overlay.hidden=true;
  overlay.innerHTML=`<section class="chat-dialog" role="dialog" aria-modal="false" aria-labelledby="chat-title">
    <header class="chat-top"><div class="chat-title-wrap"><img src="/shared/characters/kobi-face.png" alt=""><div><h2 id="chat-title">코비에게 물어보세요</h2></div></div><button class="chat-close" type="button" aria-label="챗봇 닫기">×</button></header>
    <div class="chat-messages" role="log" aria-live="polite"><div class="chat-line bot"><img src="/shared/characters/kobi-face.png" alt=""><div class="chat-bubble">안녕하세요! 상권 분석, 회복 플래너, 상담 준비에 대해 궁금한 점을 물어보세요.</div></div></div>
    <form class="chat-form"><label class="chat-sr" for="chat-question">질문</label><textarea id="chat-question" rows="1" maxlength="800" placeholder="상권브릿지에 대해 질문해 주세요" required></textarea><button type="submit">보내기</button></form></section>`;
  document.body.append(overlay);
  const form=overlay.querySelector('form'),input=overlay.querySelector('textarea'),messages=overlay.querySelector('.chat-messages');
  let before,controller,busy=false;const history=[];
  const dialog=overlay.querySelector('.chat-dialog'),header=overlay.querySelector('.chat-top');
  const storageKey='kb-bridge-chat-session';
  const saved=[];
  const persist=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify(saved.slice(-30)))}catch{}};
  function open(){before=document.activeElement;overlay.hidden=false;input.focus()}
  function close(){overlay.hidden=true;before?.focus()}
  button.addEventListener('click',open);
  overlay.querySelector('.chat-close').addEventListener('click',close);
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
  function formatAnswer(bubble,value){
    bubble.replaceChildren();let list;
    for(const raw of value.split('\n')){
      const line=raw.trim();if(!line)continue;
      const bullet=line.match(/^(?:[•*-]|\d+\.)\s+(.+)/);
      if(bullet){
        list??=document.createElement('ul');
        const item=document.createElement('li');item.textContent=bullet[1];list.append(item);
        if(!list.isConnected)bubble.append(list);
      }else{
        list=null;const paragraph=document.createElement('p');paragraph.textContent=line;bubble.append(paragraph);
      }
    }
  }
  const durationText=seconds=>seconds>=60?`${Math.floor(seconds/60)}분 ${seconds%60}초`:`${seconds}초`;
  try{
    const previous=JSON.parse(sessionStorage.getItem(storageKey)||'[]');
    if(Array.isArray(previous)&&previous.length){
      messages.replaceChildren();
      for(const item of previous.slice(-30)){
        if(!['user','bot'].includes(item?.role)||typeof item.text!=='string')continue;
        const {line,bubble}=addLine(item.role,item.text);
        if(item.role==='bot')formatAnswer(bubble,item.text);
        if(item.role==='bot'&&Array.isArray(item.sources)&&item.sources.length){
          const small=document.createElement('small');small.className='chat-source';small.textContent=`근거: ${item.sources.map(source=>source.title).join(' · ')}`;line.append(small);
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
    if(busy)return;busy=true;input.value='';form.querySelector('button').disabled=true;
    addLine('user',question);saved.push({role:'user',text:question});persist();
    const {line,bubble}=addLine('bot','생각 중…');
    const started=performance.now();
    const duration=document.createElement('small');duration.className='chat-duration';line.append(duration);
    const updateDuration=()=>{duration.textContent=`답변 중 · ${durationText(Math.floor((performance.now()-started)/1000))}`};
    updateDuration();const durationTimer=setInterval(updateDuration,1000);
    let answer='',pending='',typing=false,sources=[];
    const render=()=>{
      if(!pending){typing=false;return}
      const size=Math.min(48,Math.max(12,Math.ceil(pending.length/8)));
      answer+=pending.slice(0,size);pending=pending.slice(size);bubble.textContent=answer;
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
            bubble.textContent=answer;
          }
          if(item.type==='sources')sources=item.sources;
        }
      }
      while(typing)await new Promise(resolve=>setTimeout(resolve,20));
      if(!answer)throw Error('답변이 비어 있어요. 다시 질문해 주세요.');
      formatAnswer(bubble,answer);
      if(sources.length){const small=document.createElement('small');small.className='chat-source';small.textContent=`근거: ${sources.map(item=>item.title).join(' · ')}`;line.append(small)}
      history.push({role:'user',content:question},{role:'assistant',content:answer});
      saved.push({role:'bot',text:answer,sources,durationSeconds:Math.floor((performance.now()-started)/1000)});persist();
    }catch(error){bubble.textContent=error.name==='AbortError'?'답변을 중단했어요.':error.message;saved.push({role:'bot',text:bubble.textContent,durationSeconds:Math.floor((performance.now()-started)/1000)});persist()}
    finally{clearInterval(durationTimer);duration.textContent=`답변 시간 ${durationText(Math.floor((performance.now()-started)/1000))}`;busy=false;form.querySelector('button').disabled=false;if(!overlay.hidden)input.focus()}
  }
  form.addEventListener('submit',event=>{event.preventDefault();const question=input.value.trim();if(question)ask(question)});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit()}});
}
