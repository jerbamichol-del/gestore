(() => {
  const API = "https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec" || '';
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
  function attach(el){
    if(!el||el.__gs_bound) return; el.__gs_bound=true;
    el.addEventListener('click',(ev)=>{
      try{ev.preventDefault();ev.stopPropagation();}catch(e){}
      const email=pickEmail();
      if(email) sendReset(email);
    },{capture:true});
  }
  function scan(){
    document.querySelectorAll('[data-reset-mail]').forEach(attach);
    const re=/(reset|reimposta).*(pin)|pin.*(reset|reimposta)/i;
    const cand=[...document.querySelectorAll('button, a, [role="button"]')];
    cand.filter(el=>re.test(el.textContent||'')).forEach(attach);
  }
  scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  window.gsResetTest = (email)=>sendReset(email);
})();