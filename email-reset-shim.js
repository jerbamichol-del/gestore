(() => {
  if (location.pathname.includes('/reset/')) return;
  const API = 'https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec';
  if (!API) return;

  let armed = false, inFlight = false, lastSent = 0;
  const arm = () => { armed = true; enable(); window.removeEventListener('pointerdown', arm, true); window.removeEventListener('keydown', arm, true); };
  window.addEventListener('pointerdown', arm, true);
  window.addEventListener('keydown', arm, true);

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
    if (!armed || !email || !API) return;
    const now = Date.now();
    if (inFlight || (now - lastSent) < 8000) return; // debounce 8s
    inFlight = true; lastSent = now;
    const url=API+'?action=request&email='+encodeURIComponent(email)+'&redirect='+encodeURIComponent(REDIRECT);
    try { fetch(url,{method:'GET',cache:'no-store',mode:'no-cors'}) } catch(e) {}
    setTimeout(()=>{ inFlight=false; }, 1500);
    try { alert('Se esiste un account con questa email, riceverai un link di reset.'); } catch(e){}
  }

  function pickEmail(){
    try{const s=localStorage.getItem('gs_email'); if(s) return s;}catch(e){}
    const email=prompt('Inserisci la tua email per resettare il PIN:');
    if(email){ try{localStorage.setItem('gs_email', email);}catch(e){} }
    return email;
  }

  function attach(el){
    if(!el||el.__gs_bound) return; el.__gs_bound=true;
    el.addEventListener('click',(ev)=>{
      if (!armed || !ev.isTrusted) return;
      try{ev.preventDefault();ev.stopPropagation();}catch(e){}
      const email=pickEmail();
      if(email) sendReset(email);
    },{capture:true});
  }

  function findResetButtons(){
    const all=[...document.querySelectorAll('button, [role="button"], a')];
    return all.filter(el=>{
      const t=(el.textContent||'').trim().toLowerCase();
      return t.includes('invia') && t.includes('reset') && (t.includes('link') || t.includes('pin'));
    });
  }

  function scan(){
    if (!armed) return;
    document.querySelectorAll('[data-reset-mail]').forEach(attach);
    findResetButtons().forEach(attach);
  }

  const mo = new MutationObserver(scan);
  function enable(){ scan(); mo.observe(document.documentElement,{childList:true,subtree:true}); window.gsResetTest=(email)=>sendReset(email); }
})();
