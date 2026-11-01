async function authState(){try{const r=await fetch('/api/auth/me',{cache:'no-store'});if(r.ok)return(await r.json()).user}catch{}return null}
function makeDialog(onLogin){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/shared/auth-modal.css';document.head.append(css);
  const overlay=document.createElement('div');overlay.className='auth-overlay';overlay.hidden=true;
  overlay.innerHTML=`<section class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <button class="auth-close" type="button" aria-label="닫기">×</button><div class="auth-brand"><span class="auth-brand-mark"><img src="/shared/kb-bank-brand-source.png" alt=""></span><strong>상권브릿지</strong></div>
    <h2 id="auth-title">로그인</h2>
    <form class="auth-form"><label class="auth-sr" for="auth-id">아이디 또는 이메일</label><input id="auth-id" name="loginId" autocomplete="username" placeholder="아이디 또는 이메일" required>
    <label class="auth-sr" for="auth-password">비밀번호</label><input id="auth-password" name="password" type="password" autocomplete="current-password" placeholder="비밀번호" required>
    <div class="auth-options"><label><input type="checkbox" name="remember"> 로그인 유지</label><button type="button" disabled title="준비 중">비밀번호 찾기</button></div>
    <p class="auth-error" role="alert"></p><button class="auth-primary" type="submit">로그인</button></form>
    <div class="auth-links"><button type="button" disabled title="준비 중">회원가입</button><span>│</span><button type="button" disabled title="준비 중">이메일 찾기</button></div>
    <div class="auth-divider">간편 로그인</div><div class="auth-social" aria-label="네이버·카카오·구글·애플·페이스북 간편 로그인 준비 중"><img src="/shared/auth-social-icons.png" alt="네이버, 카카오, 구글, 애플, 페이스북"></div>
    <button class="auth-demo" type="button">테스트 계정으로 바로 로그인</button></section>`;
  document.body.append(overlay);const form=overlay.querySelector('form'),error=overlay.querySelector('.auth-error');let previousFocus;
  const close=()=>{overlay.hidden=true;document.body.classList.remove('auth-modal-open');previousFocus?.focus()};
  const open=()=>{previousFocus=document.activeElement;error.textContent='';overlay.hidden=false;document.body.classList.add('auth-modal-open');overlay.querySelector('#auth-id').focus()};
  overlay.querySelector('.auth-close').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close()});document.addEventListener('keydown',e=>{if(!overlay.hidden&&e.key==='Escape')close()});
  async function submit(endpoint,body,button){error.textContent='';button.disabled=true;try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await r.json();if(!r.ok){error.textContent=result.error||'로그인하지 못했습니다.';return}close();onLogin(result.user)}catch{error.textContent='서버에 연결하지 못했습니다.'}finally{button.disabled=false}}
  form.onsubmit=e=>{e.preventDefault();submit('/api/auth/login',Object.fromEntries(new FormData(form)),form.querySelector('.auth-primary'))};
  const demo=overlay.querySelector('.auth-demo');demo.onclick=()=>submit('/api/auth/demo-login',{},demo);
  return{open};
}
document.addEventListener('DOMContentLoaded',async()=>{
  const button=document.querySelector('.header-login');if(!button)return;let user=await authState();button.disabled=false;button.removeAttribute('title');
  const dialog=makeDialog(value=>{user=value;render()});const menu=document.createElement('div');menu.className='account-menu';menu.hidden=true;button.parentElement.append(menu);
  function render(){if(!user){button.textContent='로그인';button.removeAttribute('aria-expanded');button.onclick=dialog.open;menu.hidden=true;return}
    button.textContent=`${user.name}님`;button.setAttribute('aria-label',`${user.name}님 계정 정보`);button.setAttribute('aria-expanded','false');menu.replaceChildren();
    const profile=document.createElement('div');profile.className='account-profile';
    const avatar=document.createElement('span');avatar.className='account-avatar';avatar.textContent=user.name.slice(0,1);
    const name=document.createElement('strong');name.textContent=user.name;profile.append(avatar,name);
    const info=document.createElement('div');info.className='account-info';
    const id=document.createElement('div');id.className='account-info-row';
    const idLabel=document.createElement('span');idLabel.textContent='아이디';const idValue=document.createElement('b');idValue.textContent=user.loginId;id.append(idLabel,idValue);
    const email=document.createElement('div');email.className='account-info-row';
    const emailLabel=document.createElement('span');emailLabel.textContent='이메일';const emailValue=document.createElement('b');emailValue.textContent=user.email;email.append(emailLabel,emailValue);info.append(id,email);
    const actions=document.createElement('div');actions.className='account-actions';
    const myPage=document.createElement('button');myPage.type='button';myPage.textContent='마이페이지';myPage.disabled=true;myPage.title='준비 중';
    const logout=document.createElement('button');logout.type='button';logout.textContent='로그아웃';
    logout.onclick=async()=>{const r=await fetch('/api/auth/logout',{method:'POST'});if(r.ok){user=null;render()}};
    actions.append(myPage,logout);menu.append(profile,info,actions);button.onclick=()=>{menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden))};}
  document.addEventListener('click',e=>{if(!button.parentElement.contains(e.target)){menu.hidden=true;button.setAttribute('aria-expanded','false')}});render();
  if(new URLSearchParams(location.search).get('login')==='1'&&!user)dialog.open();
});
import('/shared/chatbot.js');
import('/shared/tutorial.js?v=2');
