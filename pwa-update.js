(function(){ if(!('serviceWorker' in navigator)) return;
  var scopeGuess='/gestore/';
  function banner(onAccept,onDismiss){
    var w=document.createElement('div');
    w.id='pwa-update-banner';
    w.className='fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md rounded-xl border border-slate-200 bg-white shadow-xl p-4 flex items-start gap-3';
    w.innerHTML='<div class="flex-1"><h3 class="text-slate-900 font-semibold">Aggiornamento disponibile</h3><p class="text-slate-600 text-sm mt-1">È pronta una nuova versione dell\'app.</p></div><div class="flex gap-2"><button id="pwa-update-later" class="px-3 py-2 text-sm rounded-lg bg-slate-200 text-slate-800">Più tardi</button><button id="pwa-update-now" class="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white">Aggiorna</button></div>';
    document.body.appendChild(w);
    document.getElementById('pwa-update-later').onclick=function(){ w.remove(); onDismiss&&onDismiss(); };
    document.getElementById('pwa-update-now').onclick=function(){ w.remove(); onAccept&&onAccept(); };
  }
  var refreshing=false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){ if(refreshing) return; refreshing=true; location.reload(); });
  function wire(reg){
    function show(){ if(reg.waiting && navigator.serviceWorker.controller){ banner(function(){ reg.waiting && reg.waiting.postMessage({type:'SKIP_WAITING'}); }, function(){}); } }
    show();
    reg.addEventListener('updatefound', function(){
      var nw=reg.installing;
      nw && nw.addEventListener('statechange', function(){
        if(nw.state==='installed' && navigator.serviceWorker.controller){ show(); }
      });
    });
    var check=function(){ reg.update().catch(function(){}); };
    window.addEventListener('focus', check); check();
  }
  window.addEventListener('load', function(){
    (navigator.serviceWorker.getRegistration(scopeGuess).catch(function(){}) ).then(function(reg){
      if(!reg){ return navigator.serviceWorker.getRegistration(); }
      return reg;
    }).then(function(reg){ reg && wire(reg); }).catch(function(){});
  }); })();