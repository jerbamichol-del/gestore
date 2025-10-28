(function(){
  if (location.pathname.includes('/reset/')) return;
  const API = "https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec";
  if (!API) return;

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
    const root=el.closest('form')||el.closest('div')||document;
    const inp=root.querySelector('input[type="email"],input[type="text"]');
    const v=inp && (inp.value||'').trim();
    return v||null;
  }

  function sawEmailSentUI(){
    const txt=document.body.innerText.toLowerCase();
    return txt.includes('controlla la tua email');
  }

  function sendReset(email){
    const url=API+'?action=request&email='+encodeURIComponent(email)+'&redirect='+encodeURIComponent(REDIRECT);
    try{ fetch(url,{method:'GET',cache:'no-store',mode:'no-cors'}) }catch(e){}
  }

  function attach(el){
    if(!el||el.__gs_bound) return; el.__gs_bound=true;
    el.addEventListener('click',(ev)=>{
      if(!ev.isTrusted) return;
      const email=readEmailNear(el) || (localStorage.getItem('gs_email')||'');
      if(email){ try{ localStorage.setItem('gs_email', email);}catch(e){} }
      // fallback: solo se entro 1200ms NON vediamo la pagina "controlla la tua email"
      let fired=false;
      const t=setTimeout(()=>{ if(!fired && !sawEmailSentUI() && email) sendReset(email); },1200);
      const mo=new MutationObserver(()=>{
        if(sawEmailSentUI()){ fired=true; clearTimeout(t); mo.disconnect(); }
      });
      mo.observe(document.documentElement,{childList:true,subtree:true});
      setTimeout(()=>mo.disconnect(), 3000);
    },{capture:true});
  }

  function scan(){
    document.querySelectorAll('[data-reset-mail]').forEach(attach);
    [...document.querySelectorAll('button, a, [role="button"]')].forEach(el=>{
      const t=(el.textContent||'').toLowerCase();
      if (t.includes('invia') && t.includes('reset') && (t.includes('link')||t.includes('pin'))) attach(el);
    });
  }
  scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});

  // test manuale
  window.gsResetTest = (email)=> sendReset(email);
})();