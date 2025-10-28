(()=>{
  if (location.pathname.includes('/reset/')) return;
  const API = "https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec";
  if (!API) return;

  let armed=false, inFlight=false, lastSent=0;
  const arm=()=>{ armed=true; window.removeEventListener('pointerdown',arm,true); window.removeEventListener('keydown',arm,true); };
  window.addEventListener('pointerdown',arm,true);
  window.addEventListener('keydown',arm,true);

  function getScope(){
    const l=document.querySelector('link[rel="manifest"]');
    if(l&&l.getAttribute('href')){
      try{ const u=new URL(l.getAttribute('href'),location.href); const m=u.pathname.match(/^\/([^/]+)\//); if(m) return '/'+m[1]+'/'; }catch(e){}
    }
    return '/gestore/';
  }
  const SCOPE=getScope();
  const REDIRECT=location.origin+SCOPE+'reset/';

  function send(email){
    if(!armed || !email || !API) return;
    const now=Date.now(); if(inFlight || (now-lastSent)<6000) return; // debounce 6s
    inFlight=true; lastSent=now;
    const url=API+'?action=request&email='+encodeURIComponent(email)+'&redirect='+encodeURIComponent(REDIRECT);
    try{ fetch(url,{method:'GET',cache:'no-store',mode:'no-cors'}) }catch(e){}
    setTimeout(()=>{ inFlight=false; },1200);
    try{ localStorage.setItem('gs_last_reset_request', String(Date.now())); }catch(e){}
    // niente alert/modale
  }

  function pickEmail(){
    try{ const v=localStorage.getItem('gs_email'); if(v) return v; }catch(e){}
    // se l'app ha già messo l'email nell'input, la riuso
    const inp=[...document.querySelectorAll('input[type="email"],input[autocomplete="email"]')].find(i=>i.value && i.value.includes('@'));
    return inp ? inp.value : null;
  }

  function matchResetButton(el){
    if(!el) return false;
    const t=(el.textContent||'').toLowerCase();
    if(t.includes('invia') && t.includes('reset') && (t.includes('link')||t.includes('pin'))) return true;
    if(el.hasAttribute('data-reset-mail')) return true;
    return false;
  }

  function attach(el){
    if(!el || el.__gs_bound) return; el.__gs_bound=true;
    el.addEventListener('click', (ev)=>{
      if(!armed || !ev.isTrusted) return;
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      const email = pickEmail();
      send(email);
    }, {capture:true});
  }

  function scan(){
    document.querySelectorAll('button, a, [role="button"], [data-reset-mail]').forEach(btn=>{
      if(matchResetButton(btn)) attach(btn);
    });
  }
  scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  window.gsResetTest=(e)=>send(e); // helper opzionale
})();