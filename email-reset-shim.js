(() => {
  const API = "https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec";
  if (!API) return;
  if (location.pathname.includes('/reset/')) return;

  // attiva solo dopo interazione reale
  let armed = false;
  const arm = () => { armed = true; window.removeEventListener('pointerdown', arm, true); window.removeEventListener('keydown', arm, true); };
  window.addEventListener('pointerdown', arm, true);
  window.addEventListener('keydown', arm, true);

  let inFlight = false, lastSent = 0;

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
  const SCOPE=getScope();
  const REDIRECT=location.origin+SCOPE+'reset/';

  function sendReset(email){
    if (!armed) return;
    if (!email || !API) return;
    const now = Date.now();
    if (inFlight || (now - lastSent) < 8000) return; // 8s debounce
    inFlight = true; lastSent = now;

    // beacon GET (no CORS richiesti)
    const url = API+'?action=request&email='+encodeURIComponent(email)+'&redirect='+encodeURIComponent(REDIRECT);
    const img = new Image();
    img.onload = img.onerror = () => { inFlight = false; };
    img.src = url + '&_b=1';
  }

  function pickEmail(){
    try{const s=localStorage.getItem('gs_email'); if(s) return s;}catch(e){}
    const email=prompt('Inserisci la tua email per resettare il PIN:');
    if(email){ try{localStorage.setItem('gs_email', email);}catch(e){} }
    return email;
  }

  function isResetText(t){
    if(!t) return false;
    const x = t.replace(/\s+/g,' ').trim().toUpperCase();
    // match "INVIA", "RESET", "LINK" in modo flessibile
    return x.includes('INVIA') && x.includes('RESET') && x.includes('LINK');
  }

  function attach(el){
    if(!el || el.__gs_bound) return; el.__gs_bound=true;
    el.addEventListener('click', (ev) => {
      if (!armed) return;
      if (!ev.isTrusted) return; // niente click sintetici
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(e){}
      const email=pickEmail();
      if (email) sendReset(email);
    }, {capture:true});
  }

  function findCandidates(){
    const nodes=[...document.querySelectorAll('button, [role="button"], a')];
    return nodes.filter(el => {
      const t=(el.textContent||'') + ' ' + (el.getAttribute('aria-label')||'') + ' ' + (el.getAttribute('title')||'');
      return isResetText(t);
    });
  }

  function scan(){
    if (!armed) return;
    document.querySelectorAll('[data-reset-mail]').forEach(attach);
    findCandidates().forEach(attach);
  }

  const mo = new MutationObserver(scan);
  const kick = () => { scan(); mo.observe(document.documentElement,{childList:true,subtree:true}); window.removeEventListener('pointerdown', kick, true); };
  window.addEventListener('pointerdown', kick, true);

  // helper test
  window.gsResetTest = (email)=>sendReset(email);
})();