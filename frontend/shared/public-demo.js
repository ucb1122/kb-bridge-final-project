document.addEventListener('DOMContentLoaded',()=>{
 const badge=document.createElement('div');badge.textContent='공개 시연본 · 로그인·상담 서버 저장 제한 · 실제 은행 미접수';
 badge.style.cssText='position:fixed;bottom:4px;left:50%;transform:translateX(-50%);z-index:9999;max-width:90vw;background:#fff8dc;color:#493d20;padding:5px 12px;border-radius:6px;font:12px sans-serif;pointer-events:none';
 document.body.append(badge);
});
