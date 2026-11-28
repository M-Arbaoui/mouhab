/* PWA helpers: install button, shortcut routing, update flow */
(function(){
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  if(standalone)document.documentElement.classList.add('is-standalone');
  /* shortcuts: ./?go=movies|series|mylist */
  const go=new URLSearchParams(location.search).get('go');
  if(go&&/^(movies|series|mylist|anime|home)$/.test(go)){
    let n=0;const t=setInterval(()=>{const b=document.querySelector('.nav-link[data-page="'+go+'"]')||document.querySelector('.bot-nav-item[data-page="'+go+'"]');
      if(b||++n>40){clearInterval(t);if(b)b.click();history.replaceState(null,'',location.pathname+location.hash)}},250);
  }
  /* install button */
  let deferred=null;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!standalone;
  function btn(){
    if(document.getElementById('pwa-install')||standalone)return;
    const host=document.querySelector('.footer-brand')?.parentElement||document.querySelector('footer');
    if(!host)return;
    const b=document.createElement('button');b.id='pwa-install';b.type='button';
    b.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg><span>Install app</span>';
    b.onclick=async()=>{
      if(deferred){deferred.prompt();await deferred.userChoice.catch(()=>{});deferred=null;b.remove()}
      else alert('To install: tap Share in Safari, then "Add to Home Screen".');
    };
    host.appendChild(b);
  }
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;btn()});
  addEventListener('appinstalled',()=>document.getElementById('pwa-install')?.remove());
  if(ios)addEventListener('load',btn);
  /* update flow: new service worker takes over on next load */
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistration().then(r=>{r&&r.update().catch(()=>{})}).catch(()=>{});
  }
})();
