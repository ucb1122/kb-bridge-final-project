const holder=document.getElementById('team-page');
const pages=[['rising','뜨는 상권','/pages/rising/'],['owner','내 상권 분석','/pages/owner/'],['recovery','우리 가게 회복 플래너','/pages/intended-owner/'],['finance','금융상품 안내','/pages/guide/']];
const header=document.createElement('header');header.className='kb-header';
const brand=document.createElement('a');brand.className='brand';brand.href='/pages/rising/';brand.setAttribute('aria-label','KO-B');
brand.innerHTML='<span class="kb-brand-image" aria-hidden="true"><img src="/shared/kb-bank-brand-source.png" alt=""></span><span>KO-B</span>';
const nav=document.createElement('nav');nav.setAttribute('aria-label','주 메뉴');
for(const [id,label,url] of pages){const a=document.createElement('a');a.href=url;a.textContent=label;if(id===holder.dataset.active){a.className='active';a.setAttribute('aria-current','page')}nav.append(a)}
const actions=document.createElement('div');actions.className='header-actions';
const chatbot=document.createElement('button');chatbot.className='header-chatbot';chatbot.type='button';chatbot.disabled=true;chatbot.title='챗봇 기능 준비 중';chatbot.innerHTML='<img src="/shared/characters/kobi-face.png" alt="">챗봇';
const guide=document.createElement('a');guide.className='header-end';guide.href='/pages/guide/';guide.textContent='이용안내';
const login=document.createElement('button');login.className='header-login';login.type='button';login.disabled=true;login.title='로그인 기능 준비 중';login.textContent='로그인';
actions.append(chatbot,guide,login);header.append(brand,nav,actions);
const main=document.createElement('main');main.className='team-main';
const section=document.createElement('section');section.className='team-placeholder';
const title=document.createElement('h1');title.textContent=holder.dataset.title;
const message=document.createElement('p');message.textContent=holder.dataset.message||'이 화면은 개발 중입니다.';
const links=document.createElement('p');links.className='team-links';links.innerHTML='<a href="/pages/rising/">뜨는 상권 보기</a><a href="/pages/owner/">내 상권 분석 보기</a>';
section.append(title,message,links);main.append(section);holder.replaceWith(header,main);
