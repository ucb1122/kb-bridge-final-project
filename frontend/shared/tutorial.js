const helpControl=document.querySelector('body > header.kb-header .header-end');
if(helpControl){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/shared/tutorial.css?v=11';document.head.append(css);
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
      {target:'#report-body .report-overview .analysis-box',title:'AI 종합의견과 원본 수치를 비교해요',text:'종합의견은 AI가 점포·매출·인구 자료를 읽고 요약한 내용이에요.\n아래 그래프와 표의 원본 수치를 함께 확인하며 해석해 주세요.'},
    ]},
    owner:{name:'내 상권 분석',image:'/shared/characters/kobi-coding.png',stepImage:'/shared/characters/kobi-tutorial-owner.png',question:'우리 동네 상권이 궁금하다면?',summary:'창업할 지역을 분석하고 상담 준비서를 PDF로 만들어요.',url:'/pages/owner/',steps:[
      {target:'[data-owner-mode="operating"]',title:'사업 운영 중이에요',text:'이미 가게를 운영하고 있다면 이 모드에서 지역의 점포·매출·인구를 분석하고 경영 진단 보고서를 확인할 수 있어요.'},
      {target:'[data-owner-mode="preparing"]',title:'창업을 준비중이에요',text:'창업 준비를 선택하면 지역 분석 뒤에 자금과 영업점 상담을 준비할 수 있어요.',action:'prepare'},
      {target:'.owner-find',title:'지역을 찾는 방법을 골라요',text:'알고 있는 동네를 직접 찾거나, 매출과 상권 순위를 둘러보며 후보 지역을 고를 수 있어요.'},
      {target:'#analysis-controls .metric',title:'궁금한 지표를 선택해요',text:'점포수·매출·유동인구·거주인구 중 하나를 누르세요. 지표를 바꾸면 비교하는 숫자와 순위도 달라집니다.'},
      {target:'.owner-details',title:'업종과 기준 분기를 조절해요',text:'상세조건에서 업종, 분석 단위, 기준 분기를 고를 수 있어요. 원하는 지역과 업종을 맞춘 뒤 결과를 비교하세요.'},
      {target:'.rank-panel .rank-head',title:'순위 기준을 확인해요',text:'정렬 기준에 따라 순서가 바뀝니다. 증가율이 높은 곳과 현재 매출이 큰 곳은 다를 수 있으니 기준을 함께 읽어 주세요.'},
      {target:'#ranking',title:'창업할 지역의 보고서를 열어요',text:'순위에서 관심 지역을 선택하세요. 선택하지 않으면 중랑구 상봉1동을 예시로 보여드려요. 다른 지역을 고르면 그 지역의 보고서로 이어집니다.',action:'open-report'},
      {target:'#region-card .report-head',title:'선택한 지역과 조건을 확인해요',text:'오른쪽 보고서의 지역 이름과 업종, 기준 분기를 먼저 확인하세요. 고른 조건이 이 보고서에 반영됩니다.'},
      {target:'#region-card .report-tabs',title:'궁금한 내용을 탭에서 고르세요',text:'한눈에 보기부터 업종·경쟁, 매출, 고객·인구, 주변 환경까지 나눠 보여줘요. 탭을 눌러 필요한 분석을 살펴보세요.'},
      {target:'#report-body',title:'그래프와 계산 근거를 함께 읽어요',text:'분기별 변화와 지역 통계를 확인하고 원본 수치·계산 근거도 펼쳐보세요. 점포당 월평균 매출은 내 가게의 실제 매출이 아닌 참고값입니다.'},
      {target:'#owner-consult-link',title:'영업점 상담 준비로 이어가요',text:'보고서를 살펴본 뒤 이 버튼을 누르면 선택한 지역과 업종이 상담 준비 화면으로 이어집니다.',action:'open-founder'},
      {path:'/pages/owner/consultation/founder/',target:'.context-card',title:'선택한 지역을 확인해요',text:'방금 고른 지역과 업종, 기준 분기를 다시 확인하세요. 지도에는 지역과 가까운 KB 영업점이 표시됩니다.'},
      {path:'/pages/owner/consultation/founder/',target:'[data-page="1"]',title:'창업비용을 적어봐요',text:'임차보증금, 시설비, 초도물품비, 초기 운영비와 준비한 자기자금을 만원 단위로 적어요. 예시로 해보기를 눌러 화면을 함께 살펴볼게요.',action:'sample-amounts'},
      {path:'/pages/owner/consultation/founder/',target:'#next-1',title:'필요한 자금을 계산해요',text:'입력한 비용을 바탕으로 합계와 추가로 준비할 금액을 계산합니다. 다음 화면에서 참고할 지원 안내도 확인할 수 있어요.',action:'funding'},
      {path:'/pages/owner/consultation/founder/',target:'[data-page="2"] .funding-summary',title:'자금과 지원을 비교해요',text:'부족한 금액을 확인하고 컨설팅, 은행상품, 정책자금 안내를 비교하세요. 신청 가능 여부와 조건은 각 공식 안내에서 확인해야 합니다.'},
      {path:'/pages/owner/consultation/founder/',target:'#next-2',title:'상담 준비로 이동해요',text:'어떤 도움이 필요한지 살펴봤다면 상담에서 물어볼 내용과 방문할 영업점을 정합니다.',action:'consultation'},
      {path:'/pages/owner/consultation/founder/',target:'#memo',title:'상담할 질문을 정리해요',text:'창업 계획과 궁금한 점을 적어두면 상담 준비서에 담깁니다. 예시 문장으로 채워보고 직접 수정할 수 있어요.',action:'sample-memo'},
      {path:'/pages/owner/consultation/founder/',target:'#branch-list',title:'가까운 영업점을 선택해요',text:'영업점 목록에서 한 곳을 선택하세요. 지도에는 해당 영업점까지의 경로와 예상 거리·시간이 표시됩니다.',action:'choose-branch'},
      {path:'/pages/owner/consultation/founder/',target:'.personal-consent',title:'개인정보 포함 여부를 정해요',text:'로그인한 이름, 이메일, 전화번호를 PDF에 넣으려면 직접 체크하세요. 체크하지 않아도 상담 준비서는 만들 수 있어요.'},
      {path:'/pages/owner/consultation/founder/',target:'#review',title:'준비한 내용을 확인해요',text:'지역, 창업비용, 영업점, 상담 질문을 마지막으로 확인하고 PDF 미리보기를 엽니다.',action:'preview-pdf'},
      {path:'/pages/owner/consultation/founder/',target:'.founder-review-pages',title:'PDF를 미리 살펴봐요',text:'상담 준비서가 페이지별로 보입니다. 실제 저장은 PDF 저장 버튼을 직접 누를 때 진행돼요. 튜토리얼을 마치면 내 상권 분석 첫 화면으로 돌아갑니다.'},
    ]},
    recovery:{name:'우리 가게 회복 플래너',image:'/shared/characters/kobi-warning.png',stepImage:'/shared/characters/kobi-tutorial-recovery.png',question:'가게 운영이 걱정된다면?',summary:'상권 위험을 보고 내 부담과 필요한 도움을 정리하세요.',url:'/pages/intended-owner/',steps:[
      {target:'#region-search-form',title:'동네나 상권을 찾아요',text:'관심 있는 동네·상권·역 이름을 검색하세요. 목록이나 지도에서 직접 골라도 됩니다.'},
      {target:'.risk-filter-wrap',title:'보고 싶은 지역을 좁혀요',text:'지역·표시 조건에서 행정동과 개별 상권을 바꾸거나 자치구를 선택할 수 있어요.'},
      {target:'#region-results',title:'폐업 위험 순위를 읽어요',text:'예측 폐업률은 해당 상권에서 폐업할 점포의 비율을 추정한 값이에요. 내 가게 한 곳이 폐업할 확률을 뜻하지는 않아요. 관심 지역을 눌러 다음 단계로 이어가세요.',action:'recovery-region'},
      {target:'#rp-selected-region',title:'선택한 지역을 확인해요',text:'고른 상권이 회복 플래너에 연결됐어요. 이제 이 지역을 기준으로 고민과 가까운 영업점을 살펴봅니다.'},
      {target:'#rp-steps',title:'네 단계를 차례로 진행해요',text:'내 고민, 부담 계산, 필요한 도움, 영업점·상담서 순서로 진행합니다. 완료한 단계는 다시 눌러 고칠 수 있어요.'},
      {target:'.concern-choices',title:'가장 큰 고민을 고르세요',text:'대출 상환, 매출 감소, 월세 인상, 전환·정리 가운데 하나를 골라요. 여기서는 월세 인상을 예로 살펴봅니다.',action:'recovery-concern'},
      {target:'#rp-next',title:'부담 계산으로 넘어가요',text:'선택한 고민에 맞는 계산 화면으로 이동합니다. 금액을 몰라도 다음 단계로 진행할 수 있어요.',action:'recovery-next'},
      {target:'.rp-comparison-inputs',title:'금액을 비교해요',text:'현재 월세와 예상 월세를 입력하면 한 달 부담 차이가 나타납니다. 예시로 해보기를 눌러 계산 결과를 확인할게요.',action:'recovery-example'},
      {target:'#rp-calculation',title:'계산 결과를 읽어요',text:'두 금액의 차이가 한 달에 얼마나 영향을 주는지 확인하세요. 예시 금액은 내 실제 비용으로 바꿔야 합니다.',action:'recovery-next'},
      {target:'.safety-feature',title:'필요한 도움을 골라요',text:'노란우산공제와 추가 상담 항목을 살펴보고 필요한 도움을 선택하세요. 고른 내용은 상담서에 함께 정리됩니다.',action:'recovery-next'},
      {target:'#appointment-body .nearby-branches',title:'가까운 영업점을 고르세요',text:'선택한 상권 근처 영업점을 거리 순으로 살펴보세요. 한 곳을 고르면 상담서에 영업점 정보가 담깁니다.',action:'recovery-branch'},
      {target:'#appointment-body .request-schedule-head',title:'상담 희망 일정을 적어요',text:'상담 방법, 희망일, 시간대와 연락처를 입력하세요. 예시 사용하기로 흐름을 살펴본 뒤 직접 수정할 수 있어요.',action:'recovery-schedule'},
      {target:'#appointment-body .request-identity',title:'신청인 정보를 확인해요',text:'상호와 이름, 이메일을 적어 상담서에 포함할 수 있어요. 로그인한 정보는 내 정보 불러오기로 가져옵니다.',action:'recovery-identity'},
      {target:'#appointment-body .request-consent',title:'상담서에 담을 정보를 확인해요',text:'연락처와 신청인 정보가 PDF에 들어가는 내용을 확인하고 체크합니다.',action:'recovery-consent'},
      {target:'#appointment-body [data-request-review]',title:'상담서를 미리 확인해요',text:'작성한 내용을 PDF 미리보기에서 확인하세요. 잘못된 내용이 있다면 닫고 이전 단계로 돌아가 수정할 수 있어요.',action:'recovery-preview'},
      {target:'.request-preview-dialog[open] .request-modal-pages',title:'상담서 내용을 확인해요',text:'상권, 고민, 계산 결과, 영업점과 연락처를 살펴보세요. 여기서 PDF를 저장하거나 상담서를 보낼 수 있어요. 튜토리얼을 마치면 회복 플래너 첫 화면으로 돌아갑니다.'},
    ]},
    finance:{name:'금융상품 안내',image:'/shared/characters/kobi-tutorial-finance.png',stepImage:'/shared/characters/kobi-tutorial-finance-step.png',question:'어떤 금융상품이 있는지 궁금하다면?',summary:'고객 유형과 용도에 맞는 상품을 찾아 조건을 비교하세요.',url:'/pages/guide/',steps:[
      {target:'.audience-switch',title:'고객 유형을 고르세요',text:'임차인 또는 임대인을 선택하면 관련 상품을 모아 보여줘요.'},
      {target:'#search-form',title:'필요한 상품을 검색하세요',text:'상품명이나 자금 용도를 입력해 목록을 좁힐 수 있어요.'},
      {target:'.category-tabs',title:'종류별로 살펴보세요',text:'사업자대출, 기업대출, 부동산담보, 정책자금 중 필요한 종류를 고르세요.'},
      {target:'.filter-panel',title:'용도와 기관으로 좁혀보세요',text:'필요하면 상세 조건을 열어 자금 용도나 제공기관을 선택하세요. 조건을 적용하면 상품 목록을 더 쉽게 비교할 수 있어요.'},
      {target:'#product-list',title:'상품을 선택하세요',text:'목록에서 상품을 누르면 오른쪽에 상세정보가 나타나요.',action:'finance-product'},
      {target:'#info-tab-overview',title:'요약에서 핵심 조건을 봐요',text:'누가 이용할 수 있는지, 한도와 기간은 어떤지 먼저 확인하세요. 이 설명은 상품을 고를 때 출발점이에요.',action:'finance-rates'},
      {target:'#info-tab-rates',title:'금리·비용을 비교해요',text:'공시 금리와 우대 조건, 수수료를 확인하세요. 실제 적용 금리는 개인 조건과 공시 시점에 따라 달라질 수 있어요.',action:'finance-repayment'},
      {target:'#info-tab-repayment',title:'상환 방법을 이해해요',text:'돈을 갚는 기간과 방식, 매달 내는 부담을 살펴보세요. 같은 금리라도 갚는 방법에 따라 부담이 달라집니다.',action:'finance-documents'},
      {target:'#info-tab-documents',title:'준비 서류를 살펴봐요',text:'신청할 때 필요한 자료를 확인하세요. 최종 제출 서류는 상품과 신청 조건에 따라 달라질 수 있어요.',action:'finance-process'},
      {target:'#info-tab-process',title:'이용 절차를 확인해요',text:'상담부터 신청과 심사까지 어떤 순서로 진행하는지 살펴보세요. 마지막으로 공식 안내의 최신 조건을 확인하세요.'},
    ]},
  };
  const layer=document.createElement('div');layer.className='kb-tutorial-layer';layer.hidden=true;
  layer.innerHTML=`<div class="kb-tutorial-shade"></div><div class="kb-tutorial-focus"></div><section class="kb-tutorial-card" role="dialog" aria-modal="true" aria-labelledby="kb-tutorial-title"><button class="kb-tutorial-close" type="button" aria-label="튜토리얼 닫기">×</button><div class="kb-tutorial-hero"><img class="kb-tutorial-kobi" src="/shared/characters/kobi-tutorial-delighted.png" alt="반갑게 인사하는 코비"><div class="kb-tutorial-speech"><p class="kb-tutorial-eyebrow">코비와 함께 알아보기</p><h2 id="kb-tutorial-title"></h2><p class="kb-tutorial-description"></p></div></div><div class="kb-tutorial-choices"></div><div class="kb-tutorial-footer"></div></section>`;
  document.body.append(layer);
  const focus=layer.querySelector('.kb-tutorial-focus'),card=layer.querySelector('.kb-tutorial-card');
  const title=layer.querySelector('#kb-tutorial-title'),description=layer.querySelector('.kb-tutorial-description');
  const kobi=layer.querySelector('.kb-tutorial-kobi');
  const showStepKobi=()=>{
    const src=topics[active].stepImage||'/shared/characters/kobi-tutorial-guide.png';
    if(kobi.getAttribute('src')===src&&kobi.complete){kobi.style.visibility='';return}
    kobi.style.visibility='hidden';
    kobi.onload=()=>{kobi.style.visibility=''};
    kobi.onerror=()=>{kobi.style.visibility=''};
    kobi.src=src;
    if(kobi.complete)kobi.style.visibility='';
  };
  const choices=layer.querySelector('.kb-tutorial-choices'),footer=layer.querySelector('.kb-tutorial-footer');
  helpControl.textContent='튜토리얼 모드';
  helpControl.setAttribute('aria-label','튜토리얼 모드 열기');
  const chatbot=helpControl.parentElement?.querySelector('.header-chatbot');
  if(chatbot)helpControl.parentElement.insertBefore(helpControl,chatbot);
  let active=null,index=0,lastFocus=null;
  const pendingKey='kb-tutorial-pending';
  let ownerRegionName='';
  const reportCard=document.querySelector('#region-card');
  const reportReady=()=>reportCard&&!reportCard.hidden;
  const currentOwnerRegion=()=>document.querySelector('#region-title')?.textContent.trim()||document.querySelector('#place')?.textContent.trim()||'';
  const ownerRankingRow=async()=>{
    const first=await waitFor('#ranking li');
    if(!first)return null;
    const rows=[...document.querySelectorAll('#ranking li')];
    const wanted=ownerRegionName||'중랑구 상봉1동';
    return rows.find(row=>row.textContent.replace(/\s/g,'').includes(wanted.replace(/\s/g,'')))||first;
  };
  const visible=node=>node&&!node.hidden&&!node.closest('[hidden]');
  const waitFor=async(selector,timeout=12000)=>{
    const start=Date.now();
    while(Date.now()-start<timeout){const node=document.querySelector(selector);if(visible(node))return node;await new Promise(resolve=>setTimeout(resolve,100))}
    return null;
  };
  const close=()=>{layer.hidden=true;active=null;sessionStorage.removeItem(pendingKey);if(layer.parentElement!==document.body)document.body.append(layer);document.body.classList.remove('kb-tutorial-open');lastFocus?.focus()};
  const button=(label,action,primary=false)=>{const item=document.createElement('button');item.type='button';item.className=primary?'kb-tutorial-primary':'kb-tutorial-secondary';item.textContent=label;item.addEventListener('click',action);return item};
  const layout=()=>{
    if(!active||layer.hidden)return;
    const node=document.querySelector(topics[active].steps[index].target);
    if(!node)return;
    const rect=node.getBoundingClientRect(),pad=12;
    const left=Math.max(3,rect.left-pad),top=Math.max(3,rect.top-pad);
    const right=Math.min(innerWidth-3,rect.right+pad),bottom=Math.min(innerHeight-3,rect.bottom+pad);
    if(right<=left||bottom<=top)return;
    focus.style.cssText=`left:${left}px;top:${top}px;width:${right-left}px;height:${bottom-top}px`;
    if(layer.classList.contains('is-pdf-preview')){
      const width=Math.min(440,innerWidth-32);
      card.style.width=`${width}px`;
      card.style.left=`${Math.max(16,innerWidth-width-24)}px`;
      const kobiSpace=innerHeight>=640?185:0;
      card.style.top=`${Math.max(16,innerHeight-card.offsetHeight-kobiSpace-24)}px`;
      card.style.transform='none';
      card.classList.remove('kb-tutorial-kobi-right','kb-tutorial-kobi-top');
      return;
    }
    if(active==='finance'&&index>=5){
      const detailLeft=document.querySelector('.detail-panel')?.getBoundingClientRect().left??innerWidth;
      const room=Math.min(detailLeft,innerWidth)-16;
      const hasKobiRoom=room>=640;
      const width=Math.min(430,room-(hasKobiRoom?225:36));
      if(width>=280){
        card.style.width=`${width}px`;
        card.classList.remove('kb-tutorial-kobi-right');
        card.classList.toggle('kb-tutorial-kobi-top',!hasKobiRoom);
        card.style.left=`${hasKobiRoom?215:36}px`;
        card.style.top=`${Math.max(hasKobiRoom?16:130,Math.min(top,innerHeight-card.offsetHeight-16))}px`;
        card.style.transform='none';
        return;
      }
    }
    card.style.width='';
    const cardWidth=card.getBoundingClientRect().width,gap=24;
    const rightSpace=innerWidth-right,leftSpace=left;
    let x=rightSpace>=cardWidth+gap?right+gap:leftSpace>=cardWidth+gap?left-cardWidth-gap:Math.max(16,(innerWidth-cardWidth)/2);
    let y=Math.max(16,Math.min(top,innerHeight-card.offsetHeight-16));
    const roomLeft=x,roomRight=innerWidth-(x+cardWidth);
    const imageRight=x>=right&&roomRight>=195 || roomLeft<195&&roomRight>=195;
    card.classList.toggle('kb-tutorial-kobi-right',imageRight);
    const imageTop=!imageRight&&roomLeft<195;
    card.classList.toggle('kb-tutorial-kobi-top',imageTop);
    if(imageTop)y=Math.max(130,y);
    card.style.left=`${x}px`;card.style.top=`${y}px`;card.style.transform='none';
  };
  const performAction=async action=>{
    const click=selector=>document.querySelector(selector)?.click();
    if(action==='prepare')click('[data-owner-mode="preparing"]');
    if(action==='open-report'){
      if(!reportReady())(await ownerRankingRow())?.click();
      if(!await waitFor('#region-card:not([hidden])'))return false;
      ownerRegionName=currentOwnerRegion();
    }
    if(action==='open-founder'){
      const link=document.querySelector('#owner-consult-link');
      if(!link?.href||link.getAttribute('href')==='#')return false;
      ownerRegionName=currentOwnerRegion();
      sessionStorage.setItem(pendingKey,JSON.stringify({key:active,index:index+1,regionName:ownerRegionName}));
      location.href=link.href;return 'navigation';
    }
    if(action==='sample-amounts')click('#fill-sample');
    if(action==='funding')click('#next-1');
    if(action==='consultation')click('#next-2');
    if(action==='sample-memo')click('#fill-memo');
    if(action==='choose-branch')click('#branch-list label');
    if(action==='preview-pdf'){
      click('#review');
      const dialog=await waitFor('.founder-review-dialog[open]');
      if(!dialog)return false;
      await waitFor('.founder-review-pages img',30000);
      dialog.append(layer);
    }
    if(action==='recovery-region'){
      const region=await waitFor('#region-results .region-result',30000);
      if(!region)return false;
      region.click();
      if(!await waitFor('#rp-selected-region:not([hidden])'))return false;
    }
    if(action==='recovery-concern'){
      const concern=document.querySelector('[data-concern="lease"]');
      if(!concern)return false;
      if(concern.getAttribute('aria-pressed')!=='true')concern.click();
    }
    if(action==='recovery-next')click('#rp-next');
    if(action==='recovery-example')click('[data-action="example"]');
    if(action==='recovery-branch'){
      const branch=await waitFor('#appointment-body [data-branch]',30000);
      if(!branch)return false;
      branch.click();
    }
    if(action==='recovery-schedule')click('#appointment-body [data-fill-schedule]');
    if(action==='recovery-identity'){
      click('#appointment-body [data-fill-account]');
      await new Promise(resolve=>setTimeout(resolve,250));
      const phone=document.querySelector('#appointment-body [data-request="phone"]');
      if(phone&&!phone.value){
        phone.value='010-1234-5678';
        phone.dispatchEvent(new Event('input',{bubbles:true}));
      }
    }
    if(action==='recovery-consent'){
      const consent=document.querySelector('#appointment-body [data-request="consent"]');
      if(consent&&!consent.checked)consent.click();
    }
    if(action==='recovery-preview'){
      click('#appointment-body [data-request-review]');
      const dialog=await waitFor('.request-preview-dialog[open]',60000);
      if(!dialog)return false;
      dialog.append(layer);
    }
    if(action==='finance-product'){
      const product=await waitFor('#product-list [data-product-id]',30000);
      if(!product)return false;
      product.click();
    }
    if(action?.startsWith('finance-')&&action!=='finance-product')click(`#info-tab-${action.slice('finance-'.length)}`);
    return true;
  };
  const showPrevious=async()=>{
    if(!index){showIntro();return}
    const previous=topics[active].steps[index-1];
    if(active==='recovery'){
      if(layer.parentElement!==document.body)document.body.append(layer);
      document.querySelector('.request-sent-dialog[open]')?.close();
      document.querySelector('.request-preview-dialog[open]')?.close();
      const stage=index-1<=6?0:index-1<=8?1:index-1===9?2:3;
      document.querySelector(`#rp-steps [data-step="${stage}"]`)?.click();
      if(index-1>=15){
        document.querySelector('#appointment-body [data-request-review]')?.click();
        const dialog=await waitFor('.request-preview-dialog[open]',60000);
        if(!dialog)return;
        dialog.append(layer);
      }
    }
    if(active==='finance'&&index-1>=5){
      const tab=['overview','rates','repayment','documents','process'][index-1-5];
      document.querySelector(`#info-tab-${tab}`)?.click();
    }
    if(active==='owner'&&location.pathname==='/pages/owner/consultation/founder/'){
      const dialog=document.querySelector('.founder-review-dialog[open]');
      if(dialog&&!['.founder-review-pages','[data-review-save]'].includes(previous.target))dialog.close();
      const stage=Number(previous.target.match(/\[data-page="(\d)"\]/)?.[1]
        || (/^#(fill-sample|next-1)$/.test(previous.target)?1:0)
        || (/^#next-2$/.test(previous.target)?2:0)
        || (/^#(memo|branch-list|review)$/.test(previous.target)||previous.target==='.personal-consent'?3:0));
      if(stage)document.querySelector(`[data-step="${stage}"] button`)?.click();
    }
    index--;showStep();
  };
  const showStep=async()=>{
    const step=topics[active].steps[index];
    const stepPath=step.path||topics[active].url;
    if(location.pathname!==stepPath){
      if(active==='owner')ownerRegionName=currentOwnerRegion()||ownerRegionName;
      sessionStorage.setItem(pendingKey,JSON.stringify({key:active,index,regionName:ownerRegionName}));location.href=stepPath;return
    }
    showStepKobi();
    title.textContent=step.title;description.textContent=step.text.replace(/\s*\n\s*/g,' ');
    if(active==='owner'&&index>=7&&index<=10){
      document.querySelector('[data-owner-mode="preparing"]')?.click();
    }
    if(active==='owner'&&index>=7&&index<=10&&!reportReady()){
      (await ownerRankingRow())?.click();
    }
    const node=await waitFor(step.target);
    if(!node){close();return}
    layer.classList.remove('is-intro');layer.classList.add('is-step');layer.classList.toggle('is-pdf-preview',(active==='owner'||active==='recovery')&&index===topics[active].steps.length-1);layer.classList.toggle('is-finance',active==='finance');
    choices.replaceChildren();footer.replaceChildren();
    const count=document.createElement('span');count.className='kb-tutorial-count';count.textContent=`${index+1} / ${topics[active].steps.length}`;
    const next=button(index===topics[active].steps.length-1?'튜토리얼 종료':'다음',async()=>{
      if(index===topics[active].steps.length-1){const returnPath=active==='owner'?'/pages/owner/':active==='recovery'?'/pages/intended-owner/':null;close();if(returnPath)location.href=returnPath;return}
      next.disabled=true;
      const result=step.action?await performAction(step.action):true;
      if(result==='navigation')return;
      if(!result){next.disabled=false;return}
      index++;showStep();
    },true);
    const actions=document.createElement('div');actions.className='kb-tutorial-footer-actions';
    actions.append(button('이전',showPrevious),next);
    footer.append(count,actions);
    node.scrollIntoView({block:'center',behavior:'auto'});requestAnimationFrame(()=>requestAnimationFrame(layout));
  };
  const start=(key)=>{
    if(!topics[key])return;
    if(key==='owner')ownerRegionName='';
    if(location.pathname!==topics[key].url){sessionStorage.setItem(pendingKey,JSON.stringify({key,index:0}));location.href=topics[key].url;return}
    active=key;index=0;layer.hidden=false;document.body.classList.add('kb-tutorial-open');showStep();
  };
  const showIntro=()=>{
    active=null;layer.hidden=false;layer.classList.remove('is-step','is-intro','is-pdf-preview','is-finance');card.style.cssText='';void layer.offsetWidth;layer.classList.add('is-intro');document.body.classList.add('kb-tutorial-open');
    card.removeAttribute('style');focus.removeAttribute('style');
    kobi.onload=null;kobi.onerror=null;kobi.style.visibility='';kobi.src='/shared/characters/kobi-tutorial-delighted.png';title.textContent='안녕하세요! 코비와 함께 둘러봐요';description.textContent='궁금한 기능을 선택하면 해당 화면에서 하나씩 알려드릴게요.';
    choices.replaceChildren();footer.replaceChildren();
    for(const [key,topic] of Object.entries(topics)){
      const item=button('',()=>start(key));item.classList.add('kb-tutorial-topic');
      const img=document.createElement('img');img.src=topic.image;img.alt='';
      const question=document.createElement('span');question.className='kb-tutorial-question';question.textContent=topic.question;
      const name=document.createElement('strong');name.textContent=topic.name;
      const summary=document.createElement('span');summary.className='kb-tutorial-summary';summary.textContent=topic.summary;
      item.append(img,question,name,summary);choices.append(item);
    }
    layer.querySelector('.kb-tutorial-close')?.focus();
  };
  helpControl.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();lastFocus=helpControl;showIntro()},true);
  layer.querySelector('.kb-tutorial-close').addEventListener('click',close);
  layer.querySelector('.kb-tutorial-shade').addEventListener('click',close);
  document.addEventListener('keydown',event=>{if(!layer.hidden&&event.key==='Escape')close()});
  addEventListener('resize',layout);addEventListener('scroll',layout,true);
  const pending=sessionStorage.getItem(pendingKey);
  if(pending){
    try{const state=JSON.parse(pending);const step=topics[state.key]?.steps[state.index];if(step&&(step.path||topics[state.key].url)===location.pathname){sessionStorage.removeItem(pendingKey);lastFocus=helpControl;active=state.key;index=state.index;ownerRegionName=state.regionName||'';showStepKobi();layer.hidden=false;document.body.classList.add('kb-tutorial-open');showStep()}}
    catch{sessionStorage.removeItem(pendingKey)}
  }
}
