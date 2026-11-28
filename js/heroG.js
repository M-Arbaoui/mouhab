/* Hero G (A + scroll effect + side arrows): Spotlight carousel. Big centre card, neighbours peeking, arrows + swipe. */
(function(){
  'use strict';
  if(typeof catSpotlight!=='function'||typeof catState==='undefined')return;
  const PLUS='<path d="M12 5v14M5 12h14"/>',CHECK='<path d="M20 6 9 17l-5-5"/>';
  const STAR='<svg class="cs-star" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z"/></svg>';
  const ARW=d=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  function spot(name,items){
    const el=document.getElementById(`${name}-spot`),st=catState[name];if(!el||!st)return;
    clearInterval(st.spotTimer);
    const picks=items.filter(i=>i.backdrop_path).slice(0,7);
    if(picks.length<3){el.className='cat-spot none';el.innerHTML='';return;}
    el.className='cat-spot hA ready';el.innerHTML='';
    const stage=document.createElement('div');stage.className='hA-stage';
    const cards=picks.map((item,i)=>{
      const c=document.createElement('div');c.className='hA-card';
      const bg=document.createElement('div');bg.className='hA-bg';
      bg.style.backgroundImage=`url("${imgB(item.backdrop_path)}")`;
      const tx=document.createElement('div');tx.className='hA-text';
      const t=document.createElement('h2');t.className='hA-title cat-spot-title';renderTitle(t,item);
      const m=document.createElement('div');m.className='hA-meta';
      const y=yr(item),g=(item.genre_ids||[]).map(id=>GENRE_NAME.get(id)).filter(n=>n&&n!=='Animation').slice(0,2).join(', ');
      const bits=[];
      if(item.vote_average)bits.push(`<span class="cs-rate">${STAR}${(Math.round(item.vote_average*10)/10).toFixed(1)}</span>`);
      if(y)bits.push(`<span>${y}</span>`);
      m.innerHTML=bits.join('<i class="hA-sep"></i>');
      if(g){const s=document.createElement('span');s.textContent=g;if(bits.length)m.insertAdjacentHTML('beforeend','<i class="hA-sep"></i>');m.appendChild(s);}
      const ov=document.createElement('p');ov.className='hA-ov';ov.textContent=item.overview||'';
      const extra=document.createElement('span');extra.className='hA-extra';
      c._fill=()=>{
        if(c._filled)return;c._filled=true;
        const ty=mtyp(item);
        api(`/${ty}/${item.id}`).then(d=>{
          if(!d)return;
          let t='';
          if(ty==='tv'){const n=d.number_of_seasons;if(n)t=n+(n>1?' seasons':' season');}
          else if(d.runtime){const h=Math.floor(d.runtime/60),mm=d.runtime%60;t=(h?h+'h ':'')+(mm?mm+'m':'');t=t.trim();}
          if(t){if(m.children.length)m.insertAdjacentHTML('beforeend','<i class="hA-sep"></i>');extra.textContent=t;m.appendChild(extra);}
        }).catch(()=>{});
      };
      const a=document.createElement('div');a.className='hA-actions';
      a.innerHTML=`<button class="btn-primary hA-play" type="button"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Watch Now</button><button class="btn-ghost hA-list" type="button" aria-pressed="false"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${PLUS}</svg><span class="hl-label">My List</span></button><button class="btn-ghost hA-info" type="button"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>More Info</button>`;
      a.querySelector('.hA-info').addEventListener('click',e=>{e.stopPropagation();openTitlePage(item);});
      const lb=a.querySelector('.hA-list');
      const sync=()=>{const on=isFav(item.id);lb.setAttribute('aria-pressed',String(on));lb.querySelector('.hl-label').textContent=on?'In My List':'My List';lb.querySelector('svg').innerHTML=on?CHECK:PLUS;};
      a.querySelector('.hA-play').addEventListener('click',e=>{e.stopPropagation();playItem(item);});
      lb.addEventListener('click',e=>{e.stopPropagation();toggleFav(item);sync();});
      sync();c._sync=sync;
      tx.append(t,m,ov,a);c.append(bg,tx);
      c.addEventListener('click',()=>{if(c.dataset.d!=='0'&&!moved)go(i);});
      stage.appendChild(c);return c;
    });
    const prev=document.createElement('button'),next=document.createElement('button');
    prev.className='hA-arrow hA-prev';next.className='hA-arrow hA-next';
    prev.type=next.type='button';prev.setAttribute('aria-label','Previous');next.setAttribute('aria-label','Next');
    prev.innerHTML=ARW('m15 18-6-6 6-6');next.innerHTML=ARW('m9 18 6-6-6-6');
    const bars=document.createElement('div');bars.className='hA-bars';
    const dots=picks.map((_,i)=>{const b=document.createElement('button');b.className='hero-dot';b.type='button';b.setAttribute('aria-label',`Show title ${i+1}`);b.innerHTML='<span class="hero-dot-fill"></span>';b.addEventListener('click',()=>go(i));bars.appendChild(b);return b;});
    el.append(stage,prev,next,bars);
    const N=picks.length;let cur=0,moved=false;
    const SPAN=7000;
    function layout(){
      cards.forEach((c,i)=>{
        let d=((i-cur)%N+N)%N;if(d>N/2)d-=N;
        c.dataset.d=String(d);c.style.setProperty('--d',d);c.style.setProperty('--a',Math.min(1,Math.abs(d)));
        c.classList.toggle('on',d===0);
        c.style.visibility=Math.abs(d)>1?'hidden':'visible';
        c.setAttribute('aria-hidden',d===0?'false':'true');
        if(d===0){c._sync();c._fill();}
      });
      dots.forEach((x,k)=>{x.classList.remove('active');if(k===cur){void x.offsetWidth;x.classList.add('active');x.firstChild.style.animationDuration=SPAN+'ms';}});
    }
    function restart(){
      clearInterval(st.spotTimer);
      st.spotTimer=setInterval(()=>{if(S.page===name&&!document.hidden)go(cur+1);},SPAN);
    }
    function go(i){cur=((i%N)+N)%N;layout();restart();}
    prev.addEventListener('click',()=>go(cur-1));next.addEventListener('click',()=>go(cur+1));
    let sx=null,sy=0;
    stage.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;moved=false;});
    stage.addEventListener('pointermove',e=>{if(sx!==null&&Math.abs(e.clientX-sx)>12)moved=true;});
    const end=e=>{if(sx===null)return;const dx=e.clientX-sx;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(e.clientY-sy)*1.2)go(cur+(dx<0?1:-1));sx=null;setTimeout(()=>moved=false,0);};
    stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',()=>{sx=null;});
    el.tabIndex=0;el.addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(cur+1);else if(e.key==='ArrowLeft')go(cur-1);});
    layout();restart();
  }
  window.catSpotlight=catSpotlight=spot;

  let tk=false;
  function upd(){
    tk=false;
    const el=document.querySelector('.page.active .cat-spot.hA');if(!el)return;
    const h=el.offsetHeight||1,y=Math.max(0,window.scrollY),p=Math.min(1,y/h);
    el.style.setProperty('--p',p.toFixed(3));
    el.style.setProperty('--py',(y*0.18).toFixed(1)+'px');
  }
  window.addEventListener('scroll',()=>{if(!tk){tk=true;requestAnimationFrame(upd);}},{passive:true});
  window.addEventListener('resize',upd);
})();
/* My List redesign: Continue Watching on top, tabs, sort, Want/Watched marks, quick remove, empty state. */
(function(){
  'use strict';
  const page=document.getElementById('page-mylist');
  if(!page||typeof S==='undefined'||typeof makeCard!=='function')return;
  const KEY='wt_mylist_status';
  const ld=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return {};}};
  const sv=o=>{try{localStorage.setItem(KEY,JSON.stringify(o));}catch(_){}};
  const k=i=>`${mtyp(i)}:${i.id}`;
  const isAni=i=>{try{return typeof isAnimeItem==='function'&&isAnimeItem(i);}catch(_){return false;}};
  let tab='all',sort='recent',stat='any';

  const hdr=page.querySelector('.aux-header');
  const oldGrid=document.getElementById('fav-grid');
  if(oldGrid)oldGrid.style.display='none';
  const root=document.createElement('div');root.className='ml';
  root.innerHTML=`
    <section class="ml-cont" hidden><div class="ml-sec-head"><h2>Continue Watching</h2></div><div class="ml-cont-row"></div></section>
    <div class="ml-bar">
      <div class="ml-tabs" role="tablist" aria-label="Type"></div>
      <div class="ml-tools">
        <div class="ml-seg" role="group" aria-label="Status"></div>
        <label class="ml-sort"><span class="ml-sort-l">Sort</span><select aria-label="Sort by"><option value="recent">Recently added</option><option value="rating">Rating</option><option value="year">Year</option></select></label>
      </div>
    </div>
    <div class="ml-grid grid-page" id="ml-grid"></div>`;
  page.appendChild(root);
  const $=s=>root.querySelector(s);
  const tabsEl=$('.ml-tabs'),segEl=$('.ml-seg'),grid=$('#ml-grid'),sel=$('select');
  const TABS=[['all','All'],['movie','Movies'],['tv','Series'],['anime','Anime']];
  const SEG=[['any','Any'],['want','Want to watch'],['watched','Watched']];
  TABS.forEach(([v,l])=>{const b=document.createElement('button');b.type='button';b.className='ml-tab';b.dataset.v=v;b.setAttribute('role','tab');b.innerHTML=`<span>${l}</span><em></em>`;b.onclick=()=>{tab=v;render();};tabsEl.appendChild(b);});
  SEG.forEach(([v,l])=>{const b=document.createElement('button');b.type='button';b.className='ml-seg-b';b.dataset.v=v;b.textContent=l;b.onclick=()=>{stat=v;render();};segEl.appendChild(b);});
  sel.onchange=()=>{sort=sel.value;render();};

  const inTab=(i,t)=>t==='all'||(t==='anime'?isAni(i):t==='movie'?mtyp(i)==='movie'&&!isAni(i):mtyp(i)==='tv'&&!isAni(i));
  const ICON_LIST='<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  function goDiscover(){const l=document.querySelector('.nav-link[data-page="movies"]')||document.querySelector('.bot-nav-item[data-page="movies"]');if(l)l.click();}

  function tile(item,st){
    const w=document.createElement('div');w.className='ml-tile';
    const card=makeCard(item);w.appendChild(card);
    const s=st[k(item)];
    if(s==='watched')w.classList.add('is-watched');
    const f=document.createElement('div');f.className='ml-foot';
    const mk=(v,l)=>{const b=document.createElement('button');b.type='button';b.className='ml-mark'+(s===v?' on':'');b.textContent=l;b.setAttribute('aria-pressed',String(s===v));
      b.onclick=e=>{e.stopPropagation();const o=ld();if(o[k(item)]===v)delete o[k(item)];else o[k(item)]=v;sv(o);render();};return b;};
    const rm=document.createElement('button');rm.type='button';rm.className='ml-rm';rm.setAttribute('aria-label','Remove from My List');rm.title='Remove';
    rm.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    rm.onclick=e=>{e.stopPropagation();w.classList.add('ml-out');setTimeout(()=>{toggleFav(item);},180);};
    f.append(mk('want','Want'),mk('watched','Watched'),rm);
    w.appendChild(f);return w;
  }
  function renderCont(){
    const sec=$('.ml-cont'),row=$('.ml-cont-row');row.textContent='';
    const list=(S.hist||[]).filter(i=>{const t=i.media_type||mtyp(i);const p=itemProgress(i.id,t);return p>=3&&p<92;}).slice(0,12);
    if(!list.length){sec.hidden=true;return;}
    sec.hidden=false;
    list.forEach(i=>{const w=document.createElement('div');w.className='ml-cont-item';w.appendChild(makeCard(i,{showProgress:true,hideScore:true,showPlayIcon:true}));row.appendChild(w);});
  }
  function render(){
    const st=ld();const favs=S.favs||[];
    // counts
    tabsEl.querySelectorAll('.ml-tab').forEach(b=>{const v=b.dataset.v;b.classList.toggle('on',v===tab);b.setAttribute('aria-selected',String(v===tab));b.querySelector('em').textContent=String(favs.filter(i=>inTab(i,v)).length);});
    segEl.querySelectorAll('.ml-seg-b').forEach(b=>b.classList.toggle('on',b.dataset.v===stat));
    sel.value=sort;
    const total=favs.length;
    const sub=hdr&&hdr.querySelector('.aux-sub');if(sub)sub.textContent=total?`${total} saved`:"Everything you've saved";
    root.classList.toggle('ml-empty-all',!total);
    renderCont();
    $('.ml-bar').hidden=!total;
    grid.textContent='';
    if(!total){
      grid.className='ml-grid ml-empty';
      grid.innerHTML=`<div class="ml-empty-box">${ICON_LIST}<h3>Your list is empty</h3><p>Save movies and shows you want to come back to.</p><button type="button" class="btn-primary ml-disc">Discover</button></div>`;
      grid.querySelector('.ml-disc').onclick=goDiscover;return;
    }
    let list=favs.filter(i=>inTab(i,tab)&&(stat==='any'||st[k(i)]===stat));
    if(sort==='rating')list=[...list].sort((a,b)=>(b.vote_average||0)-(a.vote_average||0));
    else if(sort==='year')list=[...list].sort((a,b)=>(yr(b)||'0').localeCompare(yr(a)||'0'));
    if(!list.length){
      grid.className='ml-grid ml-empty';
      const lbl=TABS.find(t=>t[0]===tab)[1];
      grid.innerHTML=`<div class="ml-empty-box ml-empty-sm"><h3>Nothing here yet</h3><p>${stat!=='any'?'No titles with this mark in '+lbl+'.':'No '+lbl.toLowerCase()+' in your list.'}</p></div>`;return;
    }
    grid.className='ml-grid grid-page';
    list.forEach(i=>grid.appendChild(tile(i,st)));
  }
  window.refreshFavPage=refreshFavPage=render;
  render();
})();
/* Home hero: shrink on scroll (only effect added) */
(function(){
  const h=document.getElementById('hero');if(!h)return;
  let tk=false;
  function u(){tk=false;const p=Math.min(1,Math.max(0,window.scrollY)/(h.offsetHeight||1));h.style.setProperty('--hp',p.toFixed(3));}
  window.addEventListener('scroll',()=>{if(!tk){tk=true;requestAnimationFrame(u);}},{passive:true});
  u();
})();
/* Search history: X on each item */
(function(){
  if(typeof renderSearchHist!=='function')return;
  const orig=renderSearchHist;
  window.renderSearchHist=renderSearchHist=async function(){
    const r=await orig.apply(this,arguments);
    const cb=document.getElementById('search-hist-clear-btn');const blk=cb&&cb.closest('.search-hist-header')&&cb.closest('.search-hist-header').nextElementSibling;
    (blk?blk.querySelectorAll('.search-hist-pill'):[]).forEach(p=>{
      if(p.querySelector('.sh-x'))return;
      const x=document.createElement('span');x.className='sh-x';x.setAttribute('role','button');x.setAttribute('aria-label','Remove from history');
      x.innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      x.addEventListener('click',e=>{
        e.stopPropagation();e.preventDefault();
        const q=p.dataset.q;
        try{lsSetJSON('wt_srch',getSearchHist().filter(t=>t!==q));}catch(_){}
        renderSearchHist();
      });
      p.appendChild(x);
    });
    return r;
  };
})();
/* My List: Undo toast on remove */
(function(){
  if(typeof toggleFav!=='function'||typeof S==='undefined')return;
  const orig=toggleFav;let tm;
  function box(){let b=document.getElementById('undo-toast');if(!b){b=document.createElement('div');b.id='undo-toast';b.setAttribute('role','status');document.body.appendChild(b);}return b;}
  function hide(){clearTimeout(tm);const b=document.getElementById('undo-toast');if(b)b.classList.remove('show');}
  window.toggleFav=toggleFav=function(item){
    const idx=S.favs.findIndex(t=>t.id===item.id);
    const saved=idx>-1?{...S.favs[idx]}:null;
    const r=orig.apply(this,arguments);
    if(saved){
      if(typeof clearToast==='function')clearToast();
      const b=box();b.innerHTML='<span>Removed from My List</span><button type="button">Undo</button>';
      b.querySelector('button').onclick=()=>{
        if(!S.favs.some(t=>t.id===saved.id)){S.favs.splice(Math.min(idx,S.favs.length),0,saved);save();refreshFavPage();}
        hide();
        document.querySelectorAll('[aria-pressed]').forEach(()=>{});
        if(typeof showToast==='function')showToast('Restored to My List');
      };
      void b.offsetWidth;b.classList.add('show');clearTimeout(tm);tm=setTimeout(hide,5000);
    }else hide();
    return r;
  };
})();
/* Scroll reveal: sections and footer ease in as they enter the viewport */
(function(){
  if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('rv-in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.04});
  const seen=new WeakSet();
  function scan(){
    document.querySelectorAll('.page.active .section, .page.active .cat-head, .page.active .cat-bar, .site-footer').forEach(el=>{
      if(seen.has(el))return;seen.add(el);
      const r=el.getBoundingClientRect();
      if(r.top<innerHeight*0.92&&r.bottom>0)return;
      el.classList.add('rv');io.observe(el);
    });
  }
  new MutationObserver(()=>{clearTimeout(scan._t);scan._t=setTimeout(scan,120);}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  setTimeout(scan,400);
})();
/* Watch page: no "Nothing playing?" hint. Real error messages (title missing / can't reach source) still show. */
(function(){
  if(typeof showSourceHint!=='function')return;
  const o=showSourceHint;
  window.showSourceHint=showSourceHint=function(msg){if(!msg)return;return o.apply(this,arguments);};
})();
