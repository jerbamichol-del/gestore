(() => {
  if (location.pathname.includes('/reset/')) return;
  const API = 'https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec';
  if (!API) return;

  // Armare solo dopo un gesto reale
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
    if (inFlight || (now - lastSent) < 8000) return; // debounce
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

  // Prompt per nuovo PIN se il reset è stato confermato dalla pagina /reset/
  function maybeAskForNewPin(){
    try{
      if(localStorage.getItem('gs_pin_reset_ready')==='1'){
        localStorage.removeItem('gs_pin_reset_ready');
        showPinModal();
      }
    }catch(e){}
  }

  function showPinModal(){
    const wrap=document.createElement('div');
    wrap.innerHTML = `
      <div id="gs-pin-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px">
        <div style="background:#fff;border-radius:16px;max-width:380px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:18px">
          <h3 style="margin:0 0 10px;font:600 18px system-ui">Imposta nuovo PIN</h3>
          <p style="margin:0 0 12px;color:#475569">Inserisci un PIN di 4-6 cifre.</p>
          <input id="gs-new-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:16px;letter-spacing:4px;text-align:center" placeholder="••••" />
          <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
            <button id="gs-cancel" style="padding:8px 12px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#0f172a">Annulla</button>
            <button id="gs-save" style="padding:8px 12px;border-radius:10px;background:#4f46e5;color:#fff">Salva PIN</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap.firstElementChild);
    const modal=document.getElementById('gs-pin-modal');
    document.getElementById('gs-cancel').onclick=()=>modal.remove();
    document.getElementById('gs-save').onclick=()=>{
      const v=(document.getElementById('gs-new-pin').value||'').trim();
      if(!/^[0-9]{4,6}$/.test(v)){ alert('PIN non valido. Usa 4-6 cifre.'); return; }
      ['pin','PIN','gs_pin','app_pin','userPin'].forEach(k=>{ try{localStorage.setItem(k,v);}catch(e){} });
      try{ localStorage.setItem('pinSetAt', String(Date.now())); }catch(e){}
      window.dispatchEvent(new CustomEvent('gs:pin-updated',{detail:{at:Date.now()}}));
      modal.remove();
      alert('PIN aggiornato.');
    };
  }

  function scan(){
    if (!armed) return;
    document.querySelectorAll('[data-reset-mail]').forEach(attach);
    findResetButtons().forEach(attach);
  }

  const mo = new MutationObserver(scan);
  function enable(){ maybeAskForNewPin(); scan(); mo.observe(document.documentElement,{childList:true,subtree:true}); window.gsResetTest=(email)=>sendReset(email); }
})();
