(function(){
  var ENDPOINT='https://script.google.com/macros/s/AKfycbyE3eTfSyJpRHX1hlmO8vv6H55SvovcH4kwEXAOjWez1tkYrzOwhNCGeucddAQfj_XUTw/exec';
  if(!ENDPOINT) return;
  function toast(msg){
    var t=document.createElement('div');
    t.className='fixed left-1/2 -translate-x-1/2 bottom-6 z-[9999] bg-slate-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg';
    t.textContent=msg; document.body.appendChild(t);
    setTimeout(()=>t.remove(), 2600);
  }
  function jsonp(url){ return new Promise(function(res,rej){
    var cb='__pin_cb_'+Date.now()+Math.random().toString(36).slice(2);
    window[cb]=function(d){ try{delete window[cb];}catch(_){}
      s.remove(); res(d);
    };
    var s=document.createElement('script');
    s.src=url+(url.includes('?')?'&':'?')+'callback='+cb;
    s.onerror=function(){ try{delete window[cb];}catch(_){}
      s.remove(); rej(new Error('net'));
    };
    document.head.appendChild(s);
  });}
  function findBtn(){
    const btns=[...document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]')];
    return btns.find(b=>/invia\s+link\s+di\s+reset/i.test((b.textContent||b.value||'').trim()));
  }
  function findEmail(){
    let el=document.querySelector('input[type="email"]');
    if(el) return el;
    return [...document.querySelectorAll('input')].find(i=>/mail/i.test((i.placeholder||i.name||'').trim()));
  }
  function wire(){
    const btn=findBtn(), email=findEmail();
    if(!btn || !email || btn.dataset._pinBound==='1') return;
    btn.dataset._pinBound='1';
    btn.addEventListener('click', async function(ev){
      try{
        const val=(email.value||'').trim();
        if(!/.+@.+\..+/.test(val)){ toast('Inserisci un\'email valida'); return; }
        btn.disabled=true;
        const url=ENDPOINT+'?action=send&email='+encodeURIComponent(val);
        const j=await jsonp(url).catch(()=>({ok:false}));
        if(j && j.ok){ toast('Email inviata 👍'); }
        else { toast('Errore invio'); }
      }catch(_){ toast('Errore rete'); }
      finally{ btn.disabled=false; }
    }, {capture:true});
  }
  const mo=new MutationObserver(wire);
  mo.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load', wire);
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') wire(); });
  setTimeout(wire, 800);
})();