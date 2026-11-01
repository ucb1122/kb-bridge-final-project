const helpControl=document.querySelector('body > header.kb-header .header-end');
if(helpControl){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/shared/tutorial.css';document.head.append(css);
  const topics={
    rising:{name:'뜨는 상권',image:'/shared/characters/kobi-magnifying-glass.png',question:'요즘 어디가 뜨는지 궁금하다면?',summary:'서울 상권의 순위와 변화를 지도에서 살펴보세요.',url:'/pages/rising/',steps:[
      {target:'.rank-panel',title:'먼저 순위를 살펴보세요',text:'선택한 지표에서 눈에 띄는 지역을 한눈에 볼 수 있어요.'},
      {target:'#map',title:'지도에서 지역을 고르세요',text:'지도나 순위 목록의 지역을 클릭하면 해당 지역 분석이 열려요.'},
    ]},
    owner:{name:'내 상권 분석',image:'/shared/characters/kobi-coding.png',question:'우리 동네 상권이 궁금하다면?',summary:'지역과 업종을 골라 점포·매출·인구 보고서를 확인하세요.',url:'/pages/owner/',steps:[
      {target:'#analysis-controls',title:'내 상황을 먼저 선택하세요',text:'사업 운영 중인지, 창업을 준비 중인지에 따라 보고서가 달라져요.'},
      {target:'.rank-panel',title:'지역을 비교해 보세요',text:'지표와 순위를 확인한 뒤 지역을 클릭하면 상세 보고서를 볼 수 있어요.'},
    ]},
    recovery:{name:'우리 가게 회복 플래너',image:'/shared/characters/kobi-warning.png',question:'가게 운영이 걱정된다면?',summary:'상권 위험을 보고 내 부담과 필요한 도움을 정리하세요.',url:'/pages/intended-owner/',steps:[
      {target:'#region-panel',title:'관심 상권부터 선택하세요',text:'지도나 목록에서 지역을 고르면 그 상권을 기준으로 계획을 세울 수 있어요.'},
      {target:'#recovery-panel',title:'고민을 단계별로 정리하세요',text:'부담 계산과 필요한 도움을 살펴보고 상담서를 확인할 수 있어요.'},
    ]},
    finance:{name:'금융상품 안내',image:'/shared/characters/kobi-face.png',question:'어떤 금융상품이 있는지 궁금하다면?',summary:'고객 유형과 용도에 맞는 상품을 찾아 조건을 비교하세요.',url:'/pages/guide/',steps:[
      {target:'.audience-switch',title:'고객 유형을 고르세요',text:'임차인 또는 임대인을 선택하면 관련 상품을 모아 보여줘요.'},
      {target:'#search-form',title:'필요한 상품을 검색하세요',text:'상품명이나 자금 용도를 입력해 목록을 좁힐 수 있어요.'},
      {target:'.category-tabs',title:'종류별로 살펴보세요',text:'사업자대출, 기업대출, 부동산담보, 정책자금 중 필요한 종류를 고르세요.'},
      {target:'#product-list',title:'상품을 선택하세요',text:'목록에서 상품을 누르면 오른쪽에 상세정보가 나타나요.'},
      {target:'#product-detail',title:'조건을 확인하세요',text:'대상과 금리·한도 등 공개 정보를 살펴보고, 신청 전 공식 안내에서 최신 조건을 확인하세요.'},
    ]},
  };
  const layer=document.createElement('div');layer.className='kb-tutorial-layer';layer.hidden=true;
  layer.innerHTML=`<div class="kb-tutorial-shade"></div><div class="kb-tutorial-focus"></div><section class="kb-tutorial-card" role="dialog" aria-modal="true" aria-labelledby="kb-tutorial-title"><button class="kb-tutorial-close" type="button" aria-label="튜토리얼 닫기">×</button><div class="kb-tutorial-hero"><img class="kb-tutorial-kobi" src="/shared/characters/kobi-wow.png" alt="반갑게 인사하는 코비"><div class="kb-tutorial-speech"><p class="kb-tutorial-eyebrow">코비와 함께 알아보기</p><h2 id="kb-tutorial-title"></h2><p class="kb-tutorial-description"></p></div></div><div class="kb-tutorial-choices"></div><div class="kb-tutorial-footer"></div></section>`;
  document.body.append(layer);
  const focus=layer.querySelector('.kb-tutorial-focus'),card=layer.querySelector('.kb-tutorial-card');
  const title=layer.querySelector('#kb-tutorial-title'),description=layer.querySelector('.kb-tutorial-description');
  const choices=layer.querySelector('.kb-tutorial-choices'),footer=layer.querySelector('.kb-tutorial-footer');
  helpControl.textContent='튜토리얼 모드';
  helpControl.setAttribute('aria-label','튜토리얼 모드 열기');
  const chatbot=helpControl.parentElement?.querySelector('.header-chatbot');
  if(chatbot)helpControl.parentElement.insertBefore(helpControl,chatbot);
  let active=null,index=0,lastFocus=null;
  const close=()=>{layer.hidden=true;active=null;document.body.classList.remove('kb-tutorial-open');lastFocus?.focus()};
  const button=(label,action,primary=false)=>{const item=document.createElement('button');item.type='button';item.className=primary?'kb-tutorial-primary':'kb-tutorial-secondary';item.textContent=label;item.addEventListener('click',action);return item};
  const layout=()=>{
    if(!active||layer.hidden)return;
    const node=document.querySelector(topics[active].steps[index].target);
    if(!node)return;
    const rect=node.getBoundingClientRect();
    const left=Math.max(6,rect.left-7),top=Math.max(6,rect.top-7);
    focus.style.cssText=`left:${left}px;top:${top}px;width:${Math.max(0,Math.min(innerWidth-left-6,rect.width+14))}px;height:${Math.max(0,Math.min(innerHeight-top-6,rect.height+14))}px`;
    const cardWidth=Math.min(380,innerWidth-32),gap=16;
    const rightSpace=innerWidth-rect.right,leftSpace=rect.left;
    let x=rightSpace>=cardWidth+gap?rect.right+gap:leftSpace>=cardWidth+gap?rect.left-cardWidth-gap:Math.max(16,(innerWidth-cardWidth)/2);
    let y=rightSpace>=cardWidth+gap||leftSpace>=cardWidth+gap?Math.max(16,Math.min(rect.top,innerHeight-card.offsetHeight-16)):(rect.bottom+card.offsetHeight+gap<innerHeight?rect.bottom+gap:Math.max(16,rect.top-card.offsetHeight-gap));
    card.style.left=`${x}px`;card.style.top=`${y}px`;card.style.transform='none';
  };
  const showStep=()=>{
    const step=topics[active].steps[index],node=document.querySelector(step.target);
    if(!node){close();return}
    layer.classList.remove('is-intro');layer.classList.add('is-step');title.textContent=step.title;description.textContent=step.text;
    choices.replaceChildren();footer.replaceChildren();
    const count=document.createElement('span');count.className='kb-tutorial-count';count.textContent=`${index+1} / ${topics[active].steps.length}`;
    footer.append(count,button(index?'이전':'기능 선택',()=>index? (index--,showStep()):showIntro()),button(index===topics[active].steps.length-1?'완료':'다음',()=>index===topics[active].steps.length-1?close():(index++,showStep()),true));
    node.scrollIntoView({block:'nearest',behavior:'auto'});requestAnimationFrame(layout);
  };
  const start=(key)=>{
    if(!topics[key])return;
    if(location.pathname!==topics[key].url){sessionStorage.setItem('kb-tutorial-pending',key);location.href=topics[key].url;return}
    active=key;index=0;showStep();
  };
  const showIntro=()=>{
    active=null;layer.hidden=false;layer.classList.remove('is-step','is-intro');void layer.offsetWidth;layer.classList.add('is-intro');document.body.classList.add('kb-tutorial-open');
    card.removeAttribute('style');focus.removeAttribute('style');
    title.textContent='안녕하세요! 코비와 함께 둘러봐요';description.textContent='궁금한 기능을 선택하면 해당 화면에서 하나씩 알려드릴게요.';
    choices.replaceChildren();footer.replaceChildren();
    for(const [key,topic] of Object.entries(topics)){
      const item=button('',()=>start(key));item.classList.add('kb-tutorial-topic');
      const img=document.createElement('img');img.src=topic.image;img.alt='';
      const question=document.createElement('span');question.className='kb-tutorial-question';question.textContent=topic.question;
      const name=document.createElement('strong');name.textContent=topic.name;
      const summary=document.createElement('span');summary.className='kb-tutorial-summary';summary.textContent=topic.summary;
      const action=document.createElement('span');action.className='kb-tutorial-action';action.textContent='살펴보기';
      item.append(img,question,name,summary,action);choices.append(item);
    }
    layer.querySelector('.kb-tutorial-close')?.focus();
  };
  helpControl.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();lastFocus=helpControl;showIntro()},true);
  layer.querySelector('.kb-tutorial-close').addEventListener('click',close);
  layer.querySelector('.kb-tutorial-shade').addEventListener('click',close);
  document.addEventListener('keydown',event=>{if(!layer.hidden&&event.key==='Escape')close()});
  addEventListener('resize',layout);addEventListener('scroll',layout,true);
  const pending=sessionStorage.getItem('kb-tutorial-pending');
  if(pending&&topics[pending]?.url===location.pathname){sessionStorage.removeItem('kb-tutorial-pending');lastFocus=helpControl;layer.hidden=false;document.body.classList.add('kb-tutorial-open');start(pending)}
}
