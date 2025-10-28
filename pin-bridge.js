(()=> {
  function mark(){ try{localStorage.setItem('gs_force_new_pin','1'); sessionStorage.setItem('gs_force_new_pin','1');}catch(e){} }
  try{ if(new URL(location.href).searchParams.get('resetpin')==='1') mark(); }catch(e){}
  function on(){ try{ return localStorage.getItem('gs_force_new_pin')==='1' || sessionStorage.getItem('gs_force_new_pin')==='1'; }catch(e){ return false; } }
  function isNewPin(){
    const headers=[...document.querySelectorAll('h1,h2,h3')].map(n=>(n.textContent||'').toLowerCase());
    if (headers.some(t=>t.includes('crea un nuovo pin'))) return true;
    const keys=[...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim());
    return ['0','1','2','3','4','5','6','7','8','9'].every(x=>keys.includes(x)) && headers.join(' ').includes('pin');
  }
  function clickCandidates(){
    const btns=[...document.querySelectorAll('button,a,[role="button"]')];
    const c = btns.find(b=>{
      const t=(b.textContent||'').toLowerCase();
      return t.includes('pin') && (t.includes('crea')||t.includes('nuovo')||t.includes('imposta')||t.includes('reimposta'));
    });
    if (c) c.click();
  }
  function tryRoutes(){
    const base = location.origin + '/gestore/';
    const hashes=['#/new-pin','#/set-pin','#/create-pin','#/pin/new','#/auth/new-pin','#/reset-pin','#/pin/setup','#/pin'];
    const paths=['pin/new','set-pin','create-pin','auth/new-pin','reset-pin','pin/setup','pin'];
    let i=0; const start=Date.now();
    const tick=()=>{
      if(isNewPin()) return;
      if(Date.now()-start>6000){ clickCandidates(); return; }
      const r = (i<hashes.length) ? hashes[i++] : paths[i++-hashes.length];
      if(!r){ clickCandidates(); return; }
      const basePath = base.replace(//$/,'');
      if(r.startsWith('#')){ if (location.pathname !== '/gestore/') history.replaceState(null,'',base); location.hash = r; window.dispatchEvent(new HashChangeEvent('hashchange')); }
      else { history.pushState(null,'', basePath + '/' + r.replace(/^//,'')); window.dispatchEvent(new PopStateEvent('popstate')); }
      setTimeout(tick, 400);
    };
    tick();
  }
  function hideEmailScreen(){ [...document.querySelectorAll('*')].forEach(n=>{ const t=(n.textContent||'').toLowerCase(); if (t.includes('controlla la tua email')) n.style.display='none'; }); }
  function run(){ if(!on()) return; hideEmailScreen(); tryRoutes(); }
  run(); new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();