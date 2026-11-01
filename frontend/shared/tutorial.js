const helpControl=document.querySelector('body > header.kb-header .header-end');
if(helpControl){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/shared/tutorial.css?v=2';document.head.append(css);
  const topics={
    rising:{name:'뜨는 상권',image:'/shared/characters/kobi-magnifying-glass.png',question:'요즘 어디가 뜨는지 궁금하다면?',summary:'서울 상권의 순위와 변화를 지도에서 살펴보세요.',url:'/pages/rising/',steps:[
      {target:'.district-fields',title:'살펴볼 동네를 정해요',text:'자치구와 행정동을 고르면 보고 싶은 지역으로 범위를 좁힐 수 있어요. 전체를 유지하면 서울의 여러 지역을 비교합니다.'},
      {target:'.segmented',title:'지역 단위를 골라요',text:'뜨는 동네는 행정동을, 뜨는 상권은 실제 상권 구역을 살펴봅니다. 같은 위치라도 선택한 단위에 따라 결과가 달라져요.'},
      {target:'.metric',title:'비교할 숫자를 고르세요',text:'점포수·매출·유동인구·거주인구 중 궁금한 지표를 누르세요. 선택한 지표에 맞춰 지도와 순위가 바뀝니다.'},
      {target:'#filter-toggle',title:'기준을 더 자세히 바꿀 수 있어요',text:'상세조건에서 업종과 분기, 증가율 같은 비교 기준을 고를 수 있어요. 원하는 조건을 적용한 뒤 순위를 다시 확인하세요.'},
      {target:'.rank-panel .rank-head',title:'순위의 기준을 먼저 읽어요',text:'TOP 10은 지금 선택한 지표와 조건으로 정렬한 결과예요. 제목 옆 기준과 자료 분기를 확인하고 숫자를 비교하세요.'},
      {target:'#ranking',title:'관심 지역을 직접 눌러보세요',text:'순위 목록에서 지역을 클릭해 보세요. 지도에서 그 위치를 확인하고, 오른쪽에 분석 보고서가 열리면 안내가 이어집니다.'},
      {target:'#region-card .report-head',title:'선택한 지역부터 확인해요',text:'오른쪽 보고서 맨 위에는 선택한 지역 이름과 분석 기준이 나옵니다. 다른 지역을 누르면 이 보고서도 함께 바뀝니다.'},
      {target:'#region-card .report-tabs',title:'보고서의 다섯 가지 주제를 골라요',text:'종합의견, 업종분석, 매출분석, 인구분석, 지역 분석 탭을 눌러 보세요. 궁금한 주제만 골라 자세히 읽을 수 있어요.'},
      {target:'#report-body',title:'숫자의 흐름과 근거를 살펴봐요',text:'그래프는 분기별 변화를, 표는 실제 집계값을 보여줘요. 추정매출은 지역 전체의 값으로 개별 가게의 매출과 다를 수 있습니다.'},
    ]},
    owner:{name:'내 상권 분석',image:'/shared/characters/kobi-coding.png',question:'우리 동네 상권이 궁금하다면?',summary:'지역과 업종을 골라 점포·매출·인구 보고서를 확인하세요.',url:'/pages/owner/',steps:[
      {target:'.owner-mode',title:'내 상황을 먼저 선택해요',text:'이미 가게를 운영하는지, 창업을 준비하는지 고르세요. 그 상황에 맞는 지역 분석과 상담 준비 흐름을 안내합니다.'},
      {target:'.owner-find',title:'지역을 찾는 방법을 골라요',text:'알고 있는 동네를 직접 찾거나, 매출과 상권 순위를 둘러보며 후보 지역을 고를 수 있어요.'},
      {target:'#analysis-controls .metric',title:'궁금한 지표를 선택해요',text:'점포수·매출·유동인구·거주인구 중 하나를 누르세요. 지표를 바꾸면 비교하는 숫자와 순위도 달라집니다.'},
      {target:'.owner-details',title:'업종과 기준 분기를 조절해요',text:'상세조건에서 업종, 분석 단위, 기준 분기를 고를 수 있어요. 원하는 지역과 업종을 맞춘 뒤 결과를 비교하세요.'},
      {target:'.rank-panel .rank-head',title:'순위 기준을 확인해요',text:'정렬 기준에 따라 순서가 바뀝니다. 증가율이 높은 곳과 현재 매출이 큰 곳은 다를 수 있으니 기준을 함께 읽어 주세요.'},
      {target:'#ranking',title:'지역을 눌러 보고서를 열어요',text:'관심 지역을 클릭해 보세요. 오른쪽에 선택 지역 보고서가 열리면 다음 설명으로 이어집니다.'},
      {target:'#region-card .report-head',title:'선택한 지역과 조건을 확인해요',text:'오른쪽 보고서의 지역 이름과 업종, 기준 분기를 먼저 확인하세요. 고른 조건이 이 보고서에 반영됩니다.'},
      {target:'#region-card .report-tabs',title:'궁금한 내용을 탭에서 고르세요',text:'한눈에 보기부터 업종·경쟁, 매출, 고객·인구, 주변 환경까지 나눠 보여줘요. 탭을 눌러 필요한 분석을 살펴보세요.'},
      {target:'#report-body',title:'그래프와 계산 근거를 함께 읽어요',text:'분기별 변화와 지역 통계를 확인하고 원본 수치·계산 근거도 펼쳐보세요. 점포당 월평균 매출은 내 가게의 실제 매출이 아닌 참고값입니다.'},
    ]},
    recovery:{name:'우리 가게 회복 플래너',image:'/shared/characters/kobi-warning.png',question:'가게 운영이 걱정된다면?',summary:'상권 위험을 보고 내 부담과 필요한 도움을 정리하세요.',url:'/pages/intended-owner/',steps:[
      {target:'#region-search-form',title:'동네나 상권을 찾아요',text:'관심 있는 동네·상권·역 이름을 검색하세요. 목록이나 지도에서 직접 골라도 됩니다.'},
      {target:'.risk-filter-wrap',title:'보고 싶은 지역을 좁혀요',text:'지역·표시 조건에서 행정동과 개별 상권을 바꾸거나 자치구를 선택할 수 있어요.'},
      {target:'#region-results',title:'폐업 위험 순위를 읽어요',text:'목록의 예측 폐업률은 상권 단위 참고값이에요. 내 가게가 그 확률로 폐업한다는 뜻은 아니며, 관심 지역을 눌러 다음 단계로 이어가세요.'},
      {target:'#rp-steps',title:'네 단계를 차례로 진행해요',text:'내 고민을 고르고 부담을 계산한 다음, 필요한 도움을 살펴보세요. 마지막에 영업점과 상담서 내용을 정리할 수 있어요.'},
      {target:'#rp-content',title:'내 금액과 상황을 입력해요',text:'예시값은 화면을 이해하는 데 쓰고 실제 계획에는 내 숫자를 입력하세요. 상담서 확인 전에 입력 내용을 다시 살펴볼 수 있어요.'},
    ]},
    finance:{name:'금융상품 안내',image:'/shared/characters/kobi-face.png',question:'어떤 금융상품이 있는지 궁금하다면?',summary:'고객 유형과 용도에 맞는 상품을 찾아 조건을 비교하세요.',url:'/pages/guide/',steps:[
      {target:'.audience-switch',title:'고객 유형을 고르세요',text:'임차인 또는 임대인을 선택하면 관련 상품을 모아 보여줘요.'},
      {target:'#search-form',title:'필요한 상품을 검색하세요',text:'상품명이나 자금 용도를 입력해 목록을 좁힐 수 있어요.'},
      {target:'.category-tabs',title:'종류별로 살펴보세요',text:'사업자대출, 기업대출, 부동산담보, 정책자금 중 필요한 종류를 고르세요.'},
      {target:'.filter-panel',title:'용도와 기관으로 좁혀보세요',text:'필요하면 상세 조건을 열어 자금 용도나 제공기관을 선택하세요. 조건을 적용하면 상품 목록을 더 쉽게 비교할 수 있어요.'},
      {target:'#product-list',title:'상품을 선택하세요',text:'목록에서 상품을 누르면 오른쪽에 상세정보가 나타나요.'},
      {target:'#product-detail',title:'조건을 확인하세요',text:'대상과 금리·한도 등 공개 정보를 살펴보고, 신청 전 공식 안내에서 최신 조건을 확인하세요.'},
    ]},
  };
  const layer=document.createElement('div');layer.className='kb-tutorial-layer';layer.hidden=true;
  layer.innerHTML=`<div class="kb-tutorial-shade"></div><div class="kb-tutorial-focus"></div><section class="kb-tutorial-card" role="dialog" aria-modal="true" aria-labelledby="kb-tutorial-title"><button class="kb-tutorial-close" type="button" aria-label="튜토리얼 닫기">×</button><div class="kb-tutorial-hero"><img class="kb-tutorial-kobi" src="/shared/characters/kobi-wow.png" alt="반갑게 인사하는 코비"><div class="kb-tutorial-speech"><p class="kb-tutorial-eyebrow">코비와 함께 알아보기</p><h2 id="kb-tutorial-title"></h2><p class="kb-tutorial-description"></p></div></div><div class="kb-tutorial-choices"></div><div class="kb-tutorial-footer"></div></section>`;
  document.body.append(layer);
  const focus=layer.querySelector('.kb-tutorial-focus'),card=layer.querySelector('.kb-tutorial-card');
  const title=layer.querySelector('#kb-tutorial-title'),description=layer.querySelector('.kb-tutorial-description');
  const kobi=layer.querySelector('.kb-tutorial-kobi');
  const choices=layer.querySelector('.kb-tutorial-choices'),footer=layer.querySelector('.kb-tutorial-footer');
  helpControl.textContent='튜토리얼 모드';
  helpControl.setAttribute('aria-label','튜토리얼 모드 열기');
  const chatbot=helpControl.parentElement?.querySelector('.header-chatbot');
  if(chatbot)helpControl.parentElement.insertBefore(helpControl,chatbot);
  let active=null,index=0,lastFocus=null;
  const reportCard=document.querySelector('#region-card');
  const reportReady=()=>reportCard&&!reportCard.hidden;
  const close=()=>{layer.hidden=true;active=null;document.body.classList.remove('kb-tutorial-open');lastFocus?.focus()};
  const button=(label,action,primary=false)=>{const item=document.createElement('button');item.type='button';item.className=primary?'kb-tutorial-primary':'kb-tutorial-secondary';item.textContent=label;item.addEventListener('click',action);return item};
  const layout=()=>{
    if(!active||layer.hidden)return;
    const node=document.querySelector(topics[active].steps[index].target);
    if(!node)return;
    const rect=node.getBoundingClientRect(),pad=3;
    const left=Math.max(pad,rect.left),top=Math.max(pad,rect.top);
    const right=Math.min(innerWidth-pad,rect.right),bottom=Math.min(innerHeight-pad,rect.bottom);
    if(right<=left||bottom<=top)return;
    focus.style.cssText=`left:${left}px;top:${top}px;width:${right-left}px;height:${bottom-top}px`;
    const cardWidth=card.getBoundingClientRect().width,gap=24;
    const rightSpace=innerWidth-right,leftSpace=left;
    let x=rightSpace>=cardWidth+gap?right+gap:leftSpace>=cardWidth+gap?left-cardWidth-gap:Math.max(16,(innerWidth-cardWidth)/2);
    let y=Math.max(16,Math.min(top,innerHeight-card.offsetHeight-16));
    const roomLeft=x,roomRight=innerWidth-(x+cardWidth);
    const imageRight=x>=right&&roomRight>=155 || roomLeft<155&&roomRight>=155;
    card.classList.toggle('kb-tutorial-kobi-right',imageRight);
    const imageTop=!imageRight&&roomLeft<155;
    card.classList.toggle('kb-tutorial-kobi-top',imageTop);
    if(imageTop)y=Math.max(130,y);
    card.style.left=`${x}px`;card.style.top=`${y}px`;card.style.transform='none';
  };
  const showStep=()=>{
    const step=topics[active].steps[index],node=document.querySelector(step.target);
    if(!node){close();return}
    layer.classList.remove('is-intro');layer.classList.add('is-step');kobi.src='/shared/characters/kobi-tutorial-guide.png';title.textContent=step.title;description.textContent=step.text;
    choices.replaceChildren();footer.replaceChildren();
    const count=document.createElement('span');count.className='kb-tutorial-count';count.textContent=`${index+1} / ${topics[active].steps.length}`;
    const next=button(index===topics[active].steps.length-1?'완료':step.target==='#ranking'&&!reportReady()?'지역 선택 후 계속':'다음',()=>{
      if(index===topics[active].steps.length-1){close();return}
      if(step.target==='#ranking'&&!reportReady())return;
      index++;showStep();
    },true);
    if(step.target==='#ranking'&&!reportReady())next.disabled=true;
    footer.append(count,button(index?'이전':'기능 선택',()=>index? (index--,showStep()):showIntro()),next);
    node.scrollIntoView({block:'center',behavior:'auto'});requestAnimationFrame(()=>requestAnimationFrame(layout));
  };
  const start=(key)=>{
    if(!topics[key])return;
    if(location.pathname!==topics[key].url){sessionStorage.setItem('kb-tutorial-pending',key);location.href=topics[key].url;return}
    active=key;index=0;showStep();
  };
  const showIntro=()=>{
    active=null;layer.hidden=false;layer.classList.remove('is-step','is-intro');void layer.offsetWidth;layer.classList.add('is-intro');document.body.classList.add('kb-tutorial-open');
    card.removeAttribute('style');focus.removeAttribute('style');
    kobi.src='/shared/characters/kobi-wow.png';title.textContent='안녕하세요! 코비와 함께 둘러봐요';description.textContent='궁금한 기능을 선택하면 해당 화면에서 하나씩 알려드릴게요.';
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
  if(reportCard)new MutationObserver(()=>{
    if(!layer.hidden&&active&&topics[active].steps[index]?.target==='#ranking'&&reportReady()){
      index++;showStep();
    }
  }).observe(reportCard,{attributes:true,attributeFilter:['hidden']});
  const pending=sessionStorage.getItem('kb-tutorial-pending');
  if(pending&&topics[pending]?.url===location.pathname){sessionStorage.removeItem('kb-tutorial-pending');lastFocus=helpControl;layer.hidden=false;document.body.classList.add('kb-tutorial-open');start(pending)}
}
