(() => {
  if (location.pathname.includes('/reset/')) return;
  const API = "https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec";
  if (!API) return;

  // "armed" solo per invio mail, NON per mostrare il modale PIN
  let armed = false;
  const arm = () => { armed = true; enable(); window.removeEventListener('pointerdown', arm, true); window.removeEventListener('keydown', arm, true); };
  window.addEventListener('pointerdown', arm, true);
  window.addEventListener('keydown', arm, true);

  let inFlight = false, lastSent = 0;

  function getScope(){
    const l=document.querySelector('link[rel="manifest"]');
    if(l&&l.getAttribute('href')){
      try{ const u=new URL(l.getAttribute('href'),location.href); const m=u.pathname.match(/^\/([^/]+)\//); if(m) return '/'+m[1]+'/'; }catch(e){}
    }
    return '/gestore/';
  }
  const SCOPE=getScope();
  const REDIRECT=location.origin+SCOPE+'reset/';

  function sendReset(email){
    if (!armed) return;
    if (!email || !API) return;
    const now = Date.now();
    if (inFlight || (now - lastSent) < 8000) return;
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
      if (!armed) return;
      if (!ev.isTrusted) return;
      try{ev.preventDefault();ev.stopPropagation();}catch(e){}
      const email=pickEmail();
      if(email) sendReset(email);
    },{capture:true});
  }

  // Bottoni da agganciare (meglio se metti data-reset-mail sul tuo bottone)
  function findResetButtons(){
    const direct=[...document.querySelectorAll('[data-reset-mail]')];
    if (direct.length) return direct;
    const all=[...document.querySelectorAll('button, [role="button"], a')];
    return all.filter(el=>{
      const t=(el.textContent||'').trim().toLowerCase();
      return (t.includes('invia')||t.includes('manda')) && t.includes('reset') && (t.includes('link')||t.includes('pin'));
    });
  }

  // ---- MODALE PIN (si apre anche senza click, se c'è reset pendente)
  function showPinModal(){
    if (document.getElementById('gs-pin-modal')) return;
    const wrap=document.createElement('div');
    wrap.id='gs-pin-modal';
    wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:99999;';
    const card=document.createElement('div');
    card.style.cssText='width:min(92%,420px);background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:20px;font-family:system-ui,Arial,sans-serif;';
    card.innerHTML = 
      '<h2 style="margin:0 0 8px;font-size:18px">Imposta nuovo PIN</h2>'+
      '<p style="margin:0 0 12px;color:#475569;font-size:14px">Inserisci e conferma un PIN di 4–6 cifre.</p>'+
      '<div style="display:flex;gap:8px;flex-direction:column">'+
      '  <input id="gs-pin1" inputmode="numeric" pattern="\d*" minlength="4" maxlength="6" placeholder="Nuovo PIN" style="padding:10px;border:1px solid #cbd5e1;border-radius:10px;font-size:16px">'+
      '  <input id="gs-pin2" inputmode="numeric" pattern="\d*" minlength="4" maxlength="6" placeholder="Conferma PIN" style="padding:10px;border:1px solid #cbd5e1;border-radius:10px;font-size:16px">'+
      '  <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">'+
      '    <button id="gs-pin-cancel" style="padding:8px 12px;border-radius:10px;background:#e2e8f0">Annulla</button>'+
      '    <button id="gs-pin-save" style="padding:8px 12px;border-radius:10px;background:#4f46e5;color:#fff">Salva</button>'+
      '  </div>'+
      '</div>';
    wrap.appendChild(card); document.body.appendChild(wrap);
    const $ = (sel)=>card.querySelector(sel);
    $('#gs-pin-cancel').onclick=()=>{ wrap.remove(); };
    $('#gs-pin-save').onclick=()=>{
      const p1 = $('#gs-pin1').value.replace(/\D/g,'');
      const p2 = $('#gs-pin2').value.replace(/\D/g,'');
      if (!/^\d{4,6}$/.test(p1)) { alert('PIN non valido (4–6 cifre).'); return; }
      if (p1!==p2) { alert('I PIN non coincidono.'); return; }
      try { localStorage.setItem('gs_pin', p1); } catch(e) {}
      try { localStorage.setItem('pin', p1); } catch(e) {}
      try { localStorage.removeItem('gs_pin_reset_pending'); } catch(e) {}
      try { window.dispatchEvent(new CustomEvent('gs-pin-updated',{detail:{pin:p1}})); } catch(e) {}
      alert('PIN aggiornato.');
      wrap.remove();
    };
  }
  function checkPending(){ try { if (localStorage.getItem('gs_pin_reset_pending')==='1') showPinModal(); } catch(e) {} }

  // Scansione bottoni (solo quando armed)
  function scan(){ if (!armed) return; findResetButtons().forEach(attach); }
  const mo = new MutationObserver(scan);
  function enable(){ scan(); mo.observe(document.documentElement,{childList:true,subtree:true}); }

  // Mostra modale PIN appena possibile (anche senza click)
  checkPending();
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') checkPending(); });
  window.addEventListener('focus', checkPending);
  // helper manuale
  window.gsResetTest = (email)=>{ if (!armed) { armed=true; enable(); } sendReset(email); };
})();