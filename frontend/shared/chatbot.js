const button=document.querySelector('.header-chatbot');
if(button){
  button.disabled=false;button.removeAttribute('title');button.setAttribute('aria-haspopup','dialog');
  const link=document.createElement('link');link.rel='stylesheet';link.href='/shared/chatbot.css';document.head.append(link);
  const overlay=document.createElement('div');overlay.className='chat-overlay';overlay.hidden=true;
  overlay.innerHTML=`<section class="chat-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-title">
    <header class="chat-top"><div class="chat-title-wrap"><img src="/shared/characters/kobi-face.png" alt=""><div><h2 id="chat-title">코비에게 물어보세요</h2><p>상권브릿지 이용 안내</p></div></div><button class="chat-close" type="button" aria-label="챗봇 닫기">×</button></header>
    <div class="chat-messages" role="log" aria-live="polite"><div class="chat-line bot"><img src="/shared/characters/kobi-face.png" alt=""><div class="chat-bubble">안녕하세요! 상권 분석, 회복 플래너, 상담 준비에 대해 궁금한 점을 물어보세요.</div></div></div>
    <div class="chat-suggestions"><button type="button">창업 상담은 어디서 시작해?</button><button type="button">보고서의 매출액은 무슨 뜻이야?</button><button type="button">PDF는 어디서 저장해?</button></div>
    <form class="chat-form"><label class="chat-sr" for="chat-question">질문</label><textarea id="chat-question" rows="1" maxlength="800" placeholder="상권브릿지에 대해 질문해 주세요" required></textarea><button type="submit">보내기</button></form>
    <p class="chat-note">안내 문서를 바탕으로 답합니다. 비밀번호와 계좌번호는 입력하지 마세요.</p></section>`;
  document.body.append(overlay);
  const form=overlay.querySelector('form'),input=overlay.querySelector('textarea'),messages=overlay.querySelector('.chat-messages');
  let before,controller,busy=false;const history=[];
  function open(){before=document.activeElement;overlay.hidden=false;document.body.classList.add('chat-open');input.focus()}
  function close(){overlay.hidden=true;document.body.classList.remove('chat-open');before?.focus()}
  button.addEventListener('click',open);
  overlay.querySelector('.chat-close').addEventListener('click',close);
  overlay.addEventListener('click',event=>{if(event.target===overlay)close()});
  document.addEventListener('keydown',event=>{if(!overlay.hidden&&event.key==='Escape')close()});
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
  async function ask(question){
    if(busy)return;busy=true;input.value='';form.querySelector('button').disabled=true;
    addLine('user',question);const {line,bubble}=addLine('bot','생각 중…');
    let answer='',pending='',typing=false,sources=[];
    const render=()=>{
      if(!pending){typing=false;return}
      answer+=pending.slice(0,6);pending=pending.slice(6);bubble.textContent=answer;
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
    }catch(error){bubble.textContent=error.name==='AbortError'?'답변을 중단했어요.':error.message}
    finally{busy=false;form.querySelector('button').disabled=false;input.focus()}
  }
  form.addEventListener('submit',event=>{event.preventDefault();const question=input.value.trim();if(question)ask(question)});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit()}});
  overlay.querySelectorAll('.chat-suggestions button').forEach(item=>item.addEventListener('click',()=>ask(item.textContent)));
}
