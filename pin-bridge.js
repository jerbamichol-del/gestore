(()=> {
  function hideEmailScreen(){
    const nodes=[...document.querySelectorAll('*')];
    nodes.forEach(n=>{
      const t=(n.textContent||'').toLowerCase();
      if(t.includes('controlla la tua email')){ n.style.display='none'; }
    });
  }
  function run(){
    try{
      const flag = localStorage.getItem('gs_force_new_pin');
      if(flag==='1'){ hideEmailScreen(); }
    }catch(e){}
  }
  run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();