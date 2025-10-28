(function(){
  if (location.pathname.includes('/reset/')) return;
  const API = "https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec";
  if (!API) return;

  let armed=false;
  const arm=()=>{ armed=true; enable(); window.removeEventListener('pointerdown',arm,true); window.removeEventListener('keydown',arm,true); };
  window.addEventListener('pointerdown',arm,true);
  window.addEventListener('keydown',arm,true);

  let inFlight=false, lastSent=0;

  function getScope(){
    const l=document.querySelector('link[rel="manifest"]');
    if(l&&l.getAttribute('href')){
      try{ const u=new URL(l.getAttribute('href'),location.href);
        const m=u.pathname.match(/^\/([^/]+)\//); if(m) return '/'+m[1]+'/';
      }catch(e){}
    }
    return '/gestore/';
  }
  const SCOPE=getScope();
  const REDIRECT=location.origin+SCOPE+'reset/';

  function readEmailNear(el){
    let root=el.closest('form') || el.closest('div') || document;
    let inp = root.querySelector('input[type="email"], input[type="text"]');
    let v = inp && (inp.value||'').trim();
    return v || null;
  }

  function sendReset(email){
    if (!armed || !email) return;
    const now=Date.now();
    if (inFlight || (now-lastSent)<5000) return;
    inFlight=true; lastSent=now;
    const url=API+'?action=request&email='+encodeURIComponent(email)+'&redirect='+encodeURIComponent(REDIRECT);
    try{ fetch(url,{method:'GET',cache:'no-store',mode:'no-cors'}) }catch(e){}
    const img=new Image(); img.src=url+'&_b=1';
    setTimeout(()=>{ inFlight=false; },1200);
  }

  function attach(el){
    if(!el||el.__gs_bound) return; el.__gs_bound=true;
    el.addEventListener('click',(ev)=>{
      if (!armed || !ev.isTrusted) return;
      const email = readEmailNear(el) || (localStorage.getItem('gs_email')||'');
      if (email) { try{ localStorage.setItem('gs_email', email);}catch(e){} sendReset(email); }
      // Non blocchiamo il click → la tua UI mostra "Controlla la tua Email"
    },{capture:true});
  }

  function scan(){
    document.querySelectorAll('[data-reset-mail]').forEach(attach);
    [...document.querySelectorAll('button, a, [role="button"]')].forEach(el=>{
      const t=(el.textContent||'').toLowerCase();
      if (t.includes('invia') && t.includes('reset') && (t.includes('link')||t.includes('pin'))) attach(el);
    });
  }

  function enable(){
    scan();
    new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
    window.gsResetTest = (email)=> sendReset(email);
  }
})();