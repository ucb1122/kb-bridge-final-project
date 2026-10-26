const holder=document.getElementById('team-page');
const pages=[['rising','뜨는 상권','/'],['owner','내 상권 분석','/pages/owner/'],['intended-owner','창업 준비','/pages/intended-owner/'],['warning','위험상권','/pages/warning/'],['products','금융 상품 추천','/pages/products/'],['guide','이용안내','/pages/guide/']];
const city=document.createElement('div');city.className='citybar';city.innerHTML='<b>✦ 서울특별시</b><span>서울시 상권분석서비스</span>';
const header=document.createElement('header');
const brand=document.createElement('a');brand.className='brand';brand.href='/';brand.innerHTML='<span class="logo">▣</span><b>KB <em>상권브릿지</em></b>';
const nav=document.createElement('nav');nav.setAttribute('aria-label','주 메뉴');
for(const [id,label,url] of pages){const a=document.createElement('a');a.href=url;a.textContent=label;if(id===holder.dataset.active)a.className='active';nav.append(a)}
header.append(brand,nav);
const main=document.createElement('main');main.className='team-main';
const section=document.createElement('section');section.className='team-placeholder';
const title=document.createElement('h1');title.textContent=holder.dataset.title;
const message=document.createElement('p');message.textContent=holder.dataset.message||'이 화면은 개발 중입니다.';
section.append(title,message);main.append(section);holder.replaceWith(city,header,main);
