const holder=document.getElementById('team-page');
const pages=[['rising','뜨는 상권','/pages/rising/'],['owner','내 상권 분석','/pages/owner/'],['intended-owner','창업 준비','/pages/intended-owner/'],['warning','위험상권','/pages/warning/'],['products','금융 상품 추천','/pages/products/']];
const header=document.createElement('header');header.className='kb-header';
const brand=document.createElement('a');brand.className='brand';brand.href='/pages/rising/';brand.setAttribute('aria-label','KB 상권브릿지');
brand.innerHTML='<span class="kb-brand-image" aria-hidden="true"><img src="/pages/owner/assets/kb-bank-brand-source.png" alt=""></span><span>상권브릿지</span>';
const nav=document.createElement('nav');nav.setAttribute('aria-label','주 메뉴');
for(const [id,label,url] of pages){const a=document.createElement('a');a.href=url;a.textContent=label;if(id===holder.dataset.active){a.className='active';a.setAttribute('aria-current','page')}nav.append(a)}
const guide=document.createElement('a');guide.className='header-end';guide.href='/pages/guide/';guide.textContent='이용안내';header.append(brand,nav,guide);
const main=document.createElement('main');main.className='team-main';
const section=document.createElement('section');section.className='team-placeholder';
const title=document.createElement('h1');title.textContent=holder.dataset.title;
const message=document.createElement('p');message.textContent=holder.dataset.message||'이 화면은 개발 중입니다.';
const links=document.createElement('p');links.className='team-links';links.innerHTML='<a href="/pages/rising/">뜨는 상권 보기</a><a href="/pages/owner/">내 상권 분석 보기</a>';
section.append(title,message,links);main.append(section);holder.replaceWith(header,main);
