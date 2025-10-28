(()=> {
  function isNewPinScreen(){
    const headers=[...document.querySelectorAll('h1,h2,h3')].map(n=>(n.textContent||'').trim().toLowerCase());
    if (headers.some(t=>t.includes('crea un nuovo pin'))) return true;
    const keys=[...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim());
    const hasKeypad=['0','1','2','3','4','5','6','7','8','9'].every(x=>keys.includes(x));
    return hasKeypad && headers.join(' ').includes('pin');
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
    const guesses = [
      '#/new-pin','#/pin/new','#/set-pin','#/reset-pin','#/pin',
      '/pin/new','/set-pin','/reset-pin','/auth/pin','/pin'
    ];
    let i=0;
    const tick=()=>{
      if (isNewPinScreen()) { return; }
      if (i>=guesses.length) { clickCandidates(); return; }
      const r=guesses[i++];
      if (r.startsWith('#')) {
        if (location.pathname !== '/gestore/') history.replaceState(null,'',base);
        location.hash=r;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } else {
        history.pushState(null,'', base.replace(//$/,'') + r);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      setTimeout(tick, 500);
    };
    tick();
  }
  function hideEmailScreen(){
    [...document.querySelectorAll('*')].forEach(n=>{
      const t=(n.textContent||'').toLowerCase();
      if (t.includes('controlla la tua email')) n.style.display='none';
    });
  }
  function run(){
    let flag=false;
    try { flag = localStorage.getItem('gs_force_new_pin')==='1'; } catch(e){}
    const urlFlag = new URL(location.href).searchParams.get('resetpin')==='1';
    if (!(flag || urlFlag)) return;
    hideEmailScreen();
    if (!isNewPinScreen()) tryRoutes();
  }
  run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();