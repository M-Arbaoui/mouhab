/* Watchy. — enhancement layer (loads after app.min.js; app code is untouched).
   Continue Watching: show everything you started and haven't finished, from localStorage only. */
(function(){
  'use strict';
  if(typeof S==='undefined'||typeof makeCard!=='function'||typeof itemProgress!=='function')return;
  const MAX=12;
  function refresh(){
    const sec=document.getElementById('continue-sec'),rail=document.getElementById('rail-continue');
    if(!sec||!rail)return;
    // The original only listed titles with 3-92% saved progress, and not every
    // video source reports progress, so the row stayed empty. Here every title in
    // the watch history that is not (almost) finished counts, newest first.
    const seen=new Set();
    const items=S.hist.filter(item=>{
      if(!item||item.id==null||seen.has(item.id))return false;
      seen.add(item.id);
      const type=item.media_type||mtyp(item);
      return itemProgress(item.id,type)<92;
    }).slice(0,MAX);
    if(!items.length){sec.style.display='none';rail.innerHTML='';return;}
    sec.style.display='block';rail.innerHTML='';
    items.forEach(item=>{
      const wrap=document.createElement('div');wrap.className='cont-item';
      wrap.style.cssText='position:relative;flex:0 0 152px';
      wrap.appendChild(makeCard(item,{showProgress:true,hideScore:true,showPlayIcon:true}));
      const x=document.createElement('button');x.className='cont-remove-btn';x.type='button';
      x.setAttribute('aria-label','Remove from Continue Watching');x.textContent='✕';
      x.addEventListener('click',e=>{
        e.stopPropagation();
        const i=S.hist.findIndex(h=>h.id===item.id);if(i>-1)S.hist.splice(i,1);
        const type=item.media_type||(item.first_air_date?'tv':'movie');
        Object.keys(S.prog).filter(k=>k.startsWith(type==='movie'?`m_${item.id}`:`tv_${item.id}_`)).forEach(k=>delete S.prog[k]);
        save();wrap.remove();
        if(!rail.children.length)sec.style.display='none';
        if(typeof showToast==='function')showToast('Removed from Continue Watching');
      });
      wrap.appendChild(x);rail.appendChild(wrap);
    });
  }
  try{window.refreshContRow=refresh;refreshContRow=refresh;}catch(_){}
  refresh();
})();

/* Poster watchdog: on slow or flaky connections (image.tmdb.org can stall or be
   blocked), posters that never arrive left empty holes. Retry quickly a few times,
   show a quiet placeholder meanwhile, then keep retrying slowly while the card is
   near the screen so it fills in as soon as the connection recovers. */
(function(){
  'use strict';
  const FAST_TRIES=3,STALL_MS=7000,SLOW_MS=15000;
  const reload=img=>{
    const s=img.getAttribute('src');if(!s)return;
    img.dataset.last=Date.now();img.loading='eager';
    img.removeAttribute('src');
    requestAnimationFrame(()=>img.setAttribute('src',s));
  };
  const fail=img=>{img.parentElement&&img.parentElement.classList.add('img-failed');};
  const near=img=>{const r=img.getBoundingClientRect();return r.width&&r.bottom>-innerHeight&&r.top<innerHeight*2;};
  document.addEventListener('error',e=>{
    const img=e.target;
    if(!(img instanceof HTMLImageElement)||!img.classList.contains('card-img'))return;
    const n=(+img.dataset.tries||0)+1;img.dataset.tries=n;
    if(n>FAST_TRIES){fail(img);img.dataset.last=Date.now();return;}
    setTimeout(()=>reload(img),n*1500);
  },true);
  document.addEventListener('load',e=>{
    const img=e.target;
    if(img instanceof HTMLImageElement&&img.classList.contains('card-img')&&img.parentElement){
      img.parentElement.classList.remove('img-failed');img.dataset.tries=0;
    }
  },true);
  const sweep=()=>{
    const now=Date.now();
    document.querySelectorAll('img.card-img').forEach(img=>{
      if(img.complete&&img.naturalWidth>0)return;
      if(!near(img))return;
      const tries=+img.dataset.tries||0,last=+img.dataset.last||0;
      if(tries>FAST_TRIES){                       // already failed: slow background retry
        if(now-last>SLOW_MS)reload(img);
        return;
      }
      if(img.complete)return;                      // error handler owns finished failures
      if(!img.dataset.since){img.dataset.since=now;return;}
      if(now-img.dataset.since>STALL_MS){          // stalled: still pending after 7s
        img.dataset.since=now;img.dataset.tries=tries+1;
        if(tries+1>FAST_TRIES){fail(img);img.dataset.last=now;}
        reload(img);
      }
    });
  };
  setInterval(sweep,3000);
  addEventListener('online',sweep);
  addEventListener('scrollend',sweep);
})();

/* ═════════ Single theme: AMOLED black. Any old saved theme is discarded. ═════════ */
(function(){try{localStorage.removeItem('wt_theme');}catch(_){}
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content='#000000';})();

/* ═════════ Poster hover info + data for filters ═════════ */
(function(){
  'use strict';
  if(typeof makeCard!=='function')return;
  const G={28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Sci-Fi',53:'Thriller',10752:'War',37:'Western',10759:'Action & Adventure',10762:'Kids',10765:'Sci-Fi & Fantasy',10768:'War & Politics'};
  const orig=makeCard;
  function wrapped(item,opts){
    const card=orig.apply(this,arguments);
    try{
      const rating=item.vote_average?Math.round(item.vote_average*10)/10:0;
      const year=((item.release_date||item.first_air_date)||'').slice(0,4);
      const genres=(item.genre_ids||[]).map(i=>G[i]).filter(Boolean).slice(0,2);
      card.dataset.rating=rating;card.dataset.year=year;
      const ov=card.querySelector('.card-ov');
      if(ov&&!ov.querySelector('.card-play-icon')&&(rating||genres.length||year)){
        const d=document.createElement('div');d.className='card-ov-info';
        d.innerHTML=(rating?`<b class="ov-rate"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z"/></svg>${rating.toFixed(1)}</b>`:'')+(genres.length?`<span>${genres.join(' · ')}</span>`:'');
        ov.appendChild(d);
      }
    }catch(_){}
    return card;
  }
  try{window.makeCard=wrapped;makeCard=wrapped;}catch(_){}
})();

/* ═════════ Hero: + My List ═════════ */
(function(){
  'use strict';
  const btn=document.getElementById('hero-list-btn');
  if(!btn||typeof S==='undefined'||typeof toggleFav!=='function')return;
  const cur=()=>S.heroItems&&S.heroItems[S.heroIdx];
  const label=btn.querySelector('.hl-label');
  function sync(){
    const it=cur(),on=!!(it&&isFav(it.id));
    btn.setAttribute('aria-pressed',String(on));
    if(label)label.textContent=on?'In My List':'My List';
    btn.querySelector('svg').innerHTML=on?'<path d="M20 6 9 17l-5-5"/>':'<path d="M12 5v14M5 12h14"/>';
  }
  btn.addEventListener('click',()=>{const it=cur();if(!it)return;toggleFav(it);sync();});
  const t=document.getElementById('hero-title');
  if(t)new MutationObserver(sync).observe(t,{childList:true,subtree:true,characterData:true});
  setInterval(sync,2000);sync();
})();

/* ═════════ Year + rating filters (client-side, on loaded cards) ═════════ */
(function(){
  'use strict';
  const pages=['movies','series','anime'];
  const YEARS=[['','Any year'],['2020','2020s'],['2010','2010s'],['2000','2000s'],['1990','1990s'],['old','Before 1990']];
  const RATES=[['','Any rating'],['6','6+'],['7','7+'],['8','8+']];
  pages.forEach(p=>{
    const end=document.querySelector(`#page-${p} .cat-bar-end`),grid=document.getElementById(`${p}-grid`);
    if(!end||!grid)return;
    const mk=(opts,label)=>{
      const s=document.createElement('select');s.className='cat-country cat-filter';s.setAttribute('aria-label',label);
      s.innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');return s;
    };
    const yr=mk(YEARS,'Year'),rt=mk(RATES,'Minimum rating');
    const sort=end.querySelector('.cat-sort');
    end.insertBefore(yr,sort);end.insertBefore(rt,sort);
    const apply=()=>{
      const y=yr.value,r=+rt.value||0;let n=0;
      grid.querySelectorAll('.card').forEach(c=>{
        const cy=+c.dataset.year||0,cr=+c.dataset.rating||0;
        let ok=true;
        if(y==='old')ok=cy&&cy<1990;else if(y)ok=cy>=+y&&cy<+y+10;
        if(r&&cr<r)ok=false;
        c.classList.toggle('f-hide',!ok);if(ok)n++;
      });
      grid.dataset.visible=n;
    };
    [yr,rt].forEach(s=>s.addEventListener('change',()=>{grid.dataset.autoloads=0;apply();}));
    new MutationObserver(apply).observe(grid,{childList:true});
    apply();
  });
})();

/* ═════════ Infinite scroll (the Load more button stays as a fallback) ═════════ */
(function(){
  'use strict';
  const pages=['movies','series','anime'];let last=0;
  pages.forEach(p=>{const b=document.getElementById(`${p}-more`);if(b&&b.parentElement)b.parentElement.classList.add('auto');});
  setInterval(()=>{
    if(Date.now()-last<1200||document.hidden)return;
    for(const p of pages){
      const page=document.getElementById(`page-${p}`),b=document.getElementById(`${p}-more`),grid=document.getElementById(`${p}-grid`);
      if(!page||!b||b.hidden||b.disabled)continue;
      const r=b.getBoundingClientRect();
      if(!r.width||r.top>innerHeight+700)continue;
      const lab=b.querySelector('.cat-more-label');
      if(lab&&/again/i.test(lab.textContent))continue;           // failed: let the user retry
      const filtered=[...page.querySelectorAll('.cat-filter')].some(s=>s.value);
      const n=+grid.dataset.autoloads||0;
      if(filtered&&n>=6)continue;                                  // filter hides most cards: stop after a few pages
      grid.dataset.autoloads=n+1;last=Date.now();b.click();return;
    }
  },500);
})();

/* ═════════ Top 10 label on the Trending row ═════════ */
(function(){
  'use strict';
  const rail=document.getElementById('rail-trending');if(!rail)return;
  const sec=rail.closest('section'),h=sec&&sec.querySelector('.section-title');
  if(h&&!h.querySelector('.top10-tag')){const t=document.createElement('span');t.className='top10-tag';t.textContent='Top 10';h.appendChild(t);}
})();

/* ═════════ Search: save history only on submit (Enter) or when a result is opened ═════════ */
(function(){
  'use strict';
  const inp=document.getElementById('search-overlay-input');
  const bar=document.querySelector('.search-overlay-bar');
  if(!inp||!bar||typeof addSearchHist!=='function'||typeof A==='undefined')return;

  // 1) History: the app saved every query that returned results (each typed prefix).
  //    Now it only saves when the query is submitted (Enter) or a result is opened.
  const realAdd=addSearchHist;
  const save=q=>{q=(q||'').trim();if(q.length>=2)realAdd(q);};
  try{window.addSearchHist=function(){};addSearchHist=window.addSearchHist;}catch(_){}
  const results=document.getElementById('search-overlay-results');
  if(results)results.addEventListener('click',e=>{
    if(e.target.closest('.card')&&!e.target.closest('.card-fav'))save(inp.value);
  },true);

  inp.addEventListener('keydown',e=>{if(e.key==='Enter')save(inp.value);},true);
})();

/* ═════════ Watch page: tidy sources (top 4 as pills, the rest behind "More") ═════════ */
(function(){
  'use strict';
  try{localStorage.removeItem('wt_sublang');}catch(_){}      // subtitle picker was removed
  if(typeof buildServerSwitcher!=='function')return;
  const SHOW=4;
  const label=()=>{
    const dock=document.getElementById('src-dock'),t=document.getElementById('src-expand');
    if(!dock||!t)return;
    const extra=dock.querySelectorAll('.server-opt.srv-extra').length;
    const open=!dock.classList.contains('collapsed');
    dock.classList.toggle('no-extra',!extra);
    t.textContent=open?'Fewer':(extra?`More (${extra})`:'More');
  };
  const orig=buildServerSwitcher;
  window.buildServerSwitcher=buildServerSwitcher=function(){
    orig.apply(this,arguments);
    const opts=[...document.querySelectorAll('#server-switcher .server-opt')];
    const act=opts.findIndex(b=>b.classList.contains('active'));
    opts.forEach((b,i)=>b.classList.toggle('srv-extra',!(i<SHOW-(act>=SHOW?1:0)||i===act)));
    label();
  };
  if(typeof setSrcDock==='function'){
    const o2=setSrcDock;
    window.setSrcDock=setSrcDock=function(){o2.apply(this,arguments);label();};
  }
})();
