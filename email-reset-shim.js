(() => {
  const API = "https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec" || '';
  let lastTs = 0; const THROTTLE_MS = 1500;
  function getScope(){
    const l=document.querySelector('link[rel="manifest"]');
    if(l&&l.getAttribute('href')){
      try{
        const u=new URL(l.getAttribute('href'),location.href);
        const m=u.pathname.match(/^\/([^/]+)\//);
        if(m) return '/'+m[1]+'/';
      }catch(e){}
    }
    return '/gestore/';
  }
  const SCOPE=getScope(), REDIRECT=location.origin+SCOPE+'reset/';
  function sendReset(email){
    if(!email || !API) return;
    const url=API+'?action=request&email='+encodeURIComponent(email)+'&redirect='+encodeURIComponent(REDIRECT);
    try{ fetch(url,{method:'GET',cache:'no-store',mode:'no-cors'}) }catch(e){}
    const img=new Image(); img.src=url+'&_b=1';
    alert('Se esiste un account con questa email, riceverai un link di reset.');
  }
  function pickEmail(){
    try{const s=localStorage.getItem('gs_email'); if(s) return s;}catch(e){}
    const email=prompt('Inserisci la tua email per resettare il PIN:');
    if(email){ try{localStorage.setItem('gs_email', email);}catch(e){} }
    return email;
  }
  function isResetNode(node){
    if(!node || !(node instanceof Element)) return false;
    if(node.hasAttribute('data-reset-mail')) return true;
    const id=node.id||'', cls=node.className||'';
    const title=node.getAttribute('title')||'';
    const aria=node.getAttribute('aria-label')||'';
    const text=(node.textContent||'').trim();
    const rx=/((reset|reimposta|ripristina|réinitialiser).*(pin))|(pin).*(reset|reimposta|ripristina|réinitialiser)/i;
    return [id,cls,title,aria,text].some(v=>rx.test(String(v)));
  }
  function findResetAncestor(start){
    let el=start;
    for(let i=0;i<6 && el;i++){
      if(isResetNode(el)) return el;
      el=el.parentElement;
    }
    return null;
  }
  function handleClick(ev){
    const now=Date.now();
    if(now - lastTs < THROTTLE_MS) return;
    const target = findResetAncestor(ev.target);
    if(!target) return;
    lastTs = now;
    try{ ev.preventDefault(); ev.stopPropagation(); }catch(e){}
    const email = pickEmail();
    if(email) sendReset(email);
  }
  window.addEventListener('click', handleClick, true);
  function attachCandidates(){
    document.querySelectorAll('[data-reset-mail],button,a,[role="button"]').forEach(el=>{
      if(el.__gs_bound) return;
      if(isResetNode(el)){
        el.__gs_bound = true;
        el.addEventListener('click', handleClick, true);
      }
    });
  }
  attachCandidates();
  new MutationObserver(attachCandidates).observe(document.documentElement,{childList:true,subtree:true});
  window.gsResetTest = (email)=>sendReset(email);
})();