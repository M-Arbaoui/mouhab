/* ═══════════════════════════════════════════════
   Watchy. — app.js v13
   Season/Episode dropdowns · 5 new sources ·
   Cinematic loader · Premium micro-interactions ·
   Modern card design · Full mobile polish
   ═══════════════════════════════════════════════ */
'use strict';

const TMDB_KEY  = 'e79205984c6394afec4499019f32f679';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG  = 'https://image.tmdb.org/t/p';

const GENRES=[
  {label:'All',id:null},{label:'Action',id:'28'},{label:'Drama',id:'18'},
  {label:'Comedy',id:'35'},{label:'Horror',id:'27'},{label:'Sci-Fi',id:'878'},
  {label:'Thriller',id:'53'},{label:'Adventure',id:'12'},{label:'Mystery',id:'9648'},
  {label:'Romance',id:'10749'},{label:'Animation',id:'16'},
  {label:'Documentary',id:'99'},{label:'Crime',id:'80'},
];

/* ── State ── */
const S={
  page:'home',lastPage:'home',
  scrollPositions:{},
  heroItems:[],heroIdx:0,heroTimer:null,heroTrailerLoading:false,
  heroTrailerKey:null,heroTrailerMuted:true,heroTrailerActive:false,
  favs:JSON.parse(localStorage.getItem('wt_favs')||'[]'),
  hist:JSON.parse(localStorage.getItem('wt_hist')||'[]'),
  prog:JSON.parse(localStorage.getItem('wt_prog')||'{}'),
  genre:null,moviesLoaded:false,seriesLoaded:false,
  moviesPage:1,seriesPage:1,moviesLoading:false,seriesLoading:false,
  moviesDone:false,seriesDone:false,
  playerItem:null,playerType:null,playerSeason:1,playerEp:1,
  playerEps:[],playerSeasons:0,playerSeasonData:{},
  searchOpen:false,searchFilter:'all',
  titleItem:null,titlePrevPage:'home',
  discoverItems:[],discoverIdx:0,discoverType:'movie',
  playerOpenTime:0,playerRuntime:0,
};
(()=>{const p=localStorage.getItem('wt_page');if(p&&p!=='player'){S.page=p;S.lastPage=p;}})();

/* ── Persist ── */
const save=()=>{
  localStorage.setItem('wt_favs',JSON.stringify(S.favs));
  localStorage.setItem('wt_hist',JSON.stringify(S.hist));
  localStorage.setItem('wt_prog',JSON.stringify(S.prog));
};
const savePage=p=>{if(p!=='player'&&p!=='title'){localStorage.setItem('wt_page',p);S.lastPage=p;}};
const progKey=(id,t,s,e)=>t==='movie'?`m_${id}`:`tv_${id}_${s}_${e}`;
const getProg=(id,t,s=1,e=1)=>S.prog[progKey(id,t,s,e)]||0;
function saveProg(id,type,season,ep,pct){
  S.prog[progKey(id,type,season,ep)]=Math.min(Math.round(pct),99);
  save();refreshContRow();
}
function getLastEp(id){
  const keys=Object.keys(S.prog).filter(k=>k.startsWith(`tv_${id}_`));
  if(!keys.length)return null;
  const best=keys.reduce((b,k)=>S.prog[k]>S.prog[b]?k:b,keys[0]);
  const p=best.split('_');return{season:parseInt(p[2]),episode:parseInt(p[3])};
}
const isFav=id=>S.favs.some(f=>f.id===id);
function toggleFav(item){
  const i=S.favs.findIndex(f=>f.id===item.id);
  if(i>-1){S.favs.splice(i,1);showToast('Removed from My List');}
  else{S.favs.unshift({...item,_ts:Date.now()});showToast('Added to My List');}
  save();refreshFavPage();return isFav(item.id);
}
function addHist(item){
  const i=S.hist.findIndex(h=>h.id===item.id);
  if(i>-1)S.hist.splice(i,1);
  S.hist.unshift({...item,_ts:Date.now()});
  if(S.hist.length>40)S.hist.pop();save();
}

/* ── TMDB API ── */
async function api(path,params={}){
  const url=new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key',TMDB_KEY);
  url.searchParams.set('language','en-US');
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  try{const r=await fetch(url);if(!r.ok)throw 0;return await r.json();}
  catch(_){return null;}
}
const A={
  trending:()=>api('/trending/all/week').then(d=>d?.results||[]),
  movies:()=>api('/movie/popular').then(d=>d?.results||[]),
  tv:()=>api('/tv/popular').then(d=>d?.results||[]),
  topRated:()=>api('/movie/top_rated').then(d=>d?.results||[]),
  nowPlaying:()=>api('/movie/now_playing').then(d=>d?.results||[]),
  topTV:()=>api('/tv/top_rated').then(d=>d?.results||[]),
  details:(id,t)=>api(`/${t}/${id}`,{append_to_response:'credits,belongs_to_collection,videos,watch/providers,external_ids'}),
  season:(id,s)=>api(`/tv/${id}/season/${s}`),
  search:q=>api('/search/multi',{query:q}).then(d=>(d?.results||[]).filter(r=>r.media_type!=='person')),
  byGenre:g=>api('/discover/movie',{with_genres:g,sort_by:'popularity.desc'}).then(d=>d?.results||[]),
  similar:(id,t)=>api(`/${t}/${id}/similar`).then(d=>d?.results||[]),
  recommended:(id,t)=>api(`/${t}/${id}/recommendations`).then(d=>d?.results||[]),
  collection:id=>api(`/collection/${id}`).then(d=>d?.parts||[]),
  discoverM:(page)=>api('/discover/movie',{sort_by:'vote_average.desc','vote_count.gte':'500',page}).then(d=>d?.results||[]),
  discoverTV:(page)=>api('/discover/tv',{sort_by:'vote_average.desc','vote_count.gte':'200',page}).then(d=>d?.results||[]),
  person:(id)=>api(`/person/${id}`,{append_to_response:'combined_credits'}),
  videos:(id,t)=>api(`/${t}/${id}/videos`).then(d=>d?.results||[]),
};

const ttl=i=>i.title||i.name||'Untitled';
const yr=i=>(i.release_date||i.first_air_date||'').slice(0,4);
const mtyp=i=>i.media_type||(i.first_air_date?'tv':'movie');
const imgP=p=>p?`${TMDB_IMG}/w342${p}`:null;
const imgB=p=>p?`${TMDB_IMG}/w1280${p}`:null;
const imgBHi=p=>p?`${TMDB_IMG}/original${p}`:null;
const imgBLq=p=>p?`${TMDB_IMG}/w300${p}`:null;
const imgFace=p=>p?`${TMDB_IMG}/w185${p}`:null;
function genreLabel(ids){
  if(!ids?.length)return'';
  const g=GENRES.find(g=>g.id&&ids.includes(parseInt(g.id)));
  return g?g.label:'';
}
function fmtScore(v){
  if(!v)return'';
  const pct=Math.round(v*10);
  const cls=pct>=70?'score-fresh':pct>=50?'score-mixed':'score-rotten';
  return`<span class="score-pill ${cls}">${pct}%</span>`;
}
function fmtRuntime(mins){
  if(!mins)return'';
  const h=Math.floor(mins/60),m=mins%60;
  return h>0?`${h}h ${m}m`:`${m}m`;
}

/* ── Hash routing ── */
function setHash(path){history.replaceState(null,'',window.location.pathname+'#'+path);}

/* ═══════════════════════════════════════════════
   STREAM SOURCES — 5 premium + 4 legacy
   ═══════════════════════════════════════════════ */
const SERVERS=[
  {
    id:'vidking', label:'Vidking', tag:'⭐ Best',
    movie:id=>`https://www.vidking.net/embed/movie/${id}?color=c9a96e`,
    tv:(id,s,e)=>`https://www.vidking.net/embed/tv/${id}/${s}/${e}?color=c9a96e`,
  },
  {
    id:'vidsrc_xyz', label:'VidSrc XYZ', tag:'Reliable',
    movie:id=>`https://vidsrc.xyz/embed/movie?tmdb=${id}`,
    tv:(id,s,e)=>`https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    id:'vidsrc_sbs', label:'VidSrc SBS', tag:'New',
    movie:id=>`https://vidsrc.sbs/embed/movie/${id}`,
    tv:(id,s,e)=>`https://vidsrc.sbs/embed/tv/${id}/${s}/${e}`,
  },
  {
    id:'vidsrc_to', label:'VidSrc', tag:'Popular',
    movie:id=>`https://vidsrc.to/embed/movie/${id}`,
    tv:(id,s,e)=>`https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    id:'superembed', label:'SuperEmbed', tag:'HD',
    movie:id=>`https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`,
    tv:(id,s,e)=>`https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
  {
    id:'autoembed', label:'AutoEmbed', tag:'',
    movie:id=>`https://player.autoembed.cc/embed/movie/${id}`,
    tv:(id,s,e)=>`https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
  {
    id:'embedsu', label:'Embed.su', tag:'',
    movie:id=>`https://embed.su/embed/movie/${id}`,
    tv:(id,s,e)=>`https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    id:'vidsrc2', label:'VidSrc 2', tag:'',
    movie:id=>`https://v2.vidsrc.me/embed/${id}/`,
    tv:(id,s,e)=>`https://v2.vidsrc.me/embed/${id}/${s}-${e}/`,
  },
  {
    id:'videasy', label:'Videasy', tag:'',
    movie:id=>`https://player.videasy.net/movie/${id}`,
    tv:(id,s,e)=>`https://player.videasy.net/tv/${id}/${s}/${e}`,
  },
  {
    id:'embed2', label:'2Embed', tag:'',
    movie:id=>`https://www.2embed.cc/embed/${id}`,
    tv:(id,s,e)=>`https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    id:'vidnest', label:'VidNest', tag:'',
    movie:id=>`https://vidnest.online/embed/movie/${id}`,
    tv:(id,s,e)=>`https://vidnest.online/embed/tv/${id}/${s}/${e}`,
  },
];
let _currentServer=parseInt(localStorage.getItem('wt_server')||'0');
const getCurrentServer=()=>SERVERS[_currentServer]||SERVERS[0];
function setServer(idx){
  _currentServer=idx;localStorage.setItem('wt_server',idx);
  buildServerSwitcher();
  if(S.playerItem)loadVidSrcWithServer(S.playerItem.id,S.playerType,S.playerSeason,S.playerEp);
}

/* ── Routing ── */
function goTo(name,skipSave=false,restoreScroll=false){
  if(S.page==='player'&&name!=='player')stopPlayer();
  if(name!=='home')stopHeroTrailer();
  clearToast();closeSearch();
  if(S.page&&S.page!=='player'&&S.page!=='title'){
    S.scrollPositions[S.page]=window.scrollY;
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(`page-${name}`)?.classList.add('active');
  document.querySelectorAll('.nav-link[data-page]').forEach(l=>l.classList.toggle('active',l.dataset.page===name));
  document.querySelectorAll('.bot-nav-item[data-page]').forEach(l=>l.classList.toggle('active',l.dataset.page===name));
  const nav=document.getElementById('nav'),bot=document.querySelector('.bot-nav');
  if(name==='player'){
    nav.classList.add('hidden');
    if(bot)bot.style.display='none';
  }else{
    nav.classList.remove('hidden');
    if(bot&&window.innerWidth<=800)bot.style.display='flex';
  }
  S.page=name;
  if(!skipSave)savePage(name);
  if(restoreScroll&&S.scrollPositions[name]!==undefined){
    requestAnimationFrame(()=>window.scrollTo(0,S.scrollPositions[name]));
  }else{
    window.scrollTo(0,0);
  }
}

/* ── Toast ── */
let _tt;
const showToast=msg=>{
  const el=document.getElementById('toast');if(!el)return;
  el.textContent=msg;el.classList.add('show');
  clearTimeout(_tt);_tt=setTimeout(()=>el.classList.remove('show'),2500);
};
const clearToast=()=>{clearTimeout(_tt);document.getElementById('toast')?.classList.remove('show');};
const greeting=()=>{
  const h=new Date().getHours();
  if(h<5)return'Still up?';if(h<12)return'Good morning.';
  if(h<17)return'Good afternoon.';if(h<21)return'Good evening.';
  return'Good night.';
};

/* ══════════════════════════════════════════
   CINEMATIC LOADER
   ══════════════════════════════════════════ */
function showCinematicLoader(){
  let el=document.getElementById('cinematic-loader');
  if(!el){
    el=document.createElement('div');
    el.id='cinematic-loader';
    el.innerHTML=`
      <div class="cl-backdrop" id="cl-backdrop"></div>
      <div class="cl-content">
        <div class="cl-logo">Watchy<span class="cl-dot">.</span></div>
        <div class="cl-bar-wrap"><div class="cl-bar" id="cl-bar"></div></div>
        <div class="cl-label" id="cl-label">Loading…</div>
      </div>`;
    document.body.appendChild(el);
  }
  el.classList.add('visible');
  return el;
}
function updateCinematicLoader(pct,label,bgUrl){
  document.getElementById('cl-bar').style.width=pct+'%';
  document.getElementById('cl-label').textContent=label||'';
  if(bgUrl)document.getElementById('cl-backdrop').style.backgroundImage=`url(${bgUrl})`;
}
function hideCinematicLoader(){
  const el=document.getElementById('cinematic-loader');
  if(el){el.classList.remove('visible');el.classList.add('fading');setTimeout(()=>el.classList.remove('fading'),600);}
}

/* ── Search ── */
function openSearch(){
  S.searchOpen=true;
  document.getElementById('search-overlay').classList.add('open');
  setTimeout(()=>{
    document.getElementById('search-overlay-input')?.focus();
    renderSearchHist();
  },200);
}
function closeSearch(){
  if(!S.searchOpen)return;S.searchOpen=false;
  document.getElementById('search-overlay')?.classList.remove('open');
  const inp=document.getElementById('search-overlay-input');if(inp)inp.value='';
  const grid=document.getElementById('search-overlay-results');if(grid)grid.innerHTML='';
  const countEl=document.getElementById('search-result-count');if(countEl)countEl.textContent='';
}
function clearSearchOnEmpty(q){if(!q.trim())renderSearchHist();}

/* ── Search history ── */
const SEARCH_HIST_KEY='wt_srch';
const getSearchHist=()=>JSON.parse(localStorage.getItem(SEARCH_HIST_KEY)||'[]');
function addSearchHist(q){
  if(!q||q.length<2)return;
  let hist=getSearchHist().filter(h=>h!==q);
  hist.unshift(q);
  if(hist.length>10)hist=hist.slice(0,10);
  localStorage.setItem(SEARCH_HIST_KEY,JSON.stringify(hist));
}
function clearSearchHist(){localStorage.removeItem(SEARCH_HIST_KEY);renderSearchHist();}

/* ── Trending searches (derived from trending titles, fetched once per session) ── */
let _trendingSearchCache=null;
async function getTrendingSearches(){
  if(_trendingSearchCache)return _trendingSearchCache;
  const items=await A.trending();
  _trendingSearchCache=(items||[]).slice(0,8).map(i=>ttl(i)).filter(Boolean);
  return _trendingSearchCache;
}

async function renderSearchHist(){
  const grid=document.getElementById('search-overlay-results');
  const cnt=document.getElementById('search-result-count');
  const inp=document.getElementById('search-overlay-input');
  if(!grid||inp?.value?.trim())return;
  const hist=getSearchHist();
  const trending=await getTrendingSearches();
  if(inp?.value?.trim())return; // input changed while trending was loading
  if(!hist.length&&!trending.length){grid.innerHTML='';if(cnt)cnt.textContent='';return;}
  if(cnt)cnt.textContent='';
  grid.innerHTML=`
    ${hist.length?`
    <div class="search-hist-header">
      <span class="search-hist-label">Recent searches</span>
      <button class="search-hist-clear" id="search-hist-clear-btn">Clear all</button>
    </div>
    <div class="search-hist-pills">${
      hist.map(h=>`<button class="search-hist-pill" data-q="${h.replace(/"/g,'&quot;')}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${h}</button>`).join('')
    }</div>`:''}
    ${trending.length?`
    <div class="search-hist-header" style="margin-top:${hist.length?'18px':'0'}">
      <span class="search-hist-label">Trending now</span>
    </div>
    <div class="search-hist-pills">${
      trending.map(h=>`<button class="search-hist-pill search-trend-pill" data-q="${h.replace(/"/g,'&quot;')}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        ${h}</button>`).join('')
    }</div>`:''}`;
  document.getElementById('search-hist-clear-btn')?.addEventListener('click',e=>{e.stopPropagation();clearSearchHist();});
  grid.querySelectorAll('.search-hist-pill').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.getElementById('search-overlay-input').value=btn.dataset.q;
      handleSearchInput(btn.dataset.q);
    });
  });
}
let _sd;
function handleSearchInput(q){
  clearTimeout(_sd);
  const grid=document.getElementById('search-overlay-results');
  const countEl=document.getElementById('search-result-count');
  if(!q.trim()){if(grid)grid.innerHTML='';if(countEl)countEl.textContent='';return;}
  _sd=setTimeout(async()=>{
    if(grid){grid.innerHTML='';skels(6).forEach(s=>grid.appendChild(s));}
    if(countEl)countEl.textContent='';
    const results=await A.search(q);
    if(!grid)return;grid.innerHTML='';
    let filtered=results;
    if(S.searchFilter==='movie')filtered=results.filter(r=>mtyp(r)==='movie');
    if(S.searchFilter==='tv')filtered=results.filter(r=>mtyp(r)==='tv');
    if(!filtered.length){
      const safeQ=q.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      grid.innerHTML=emptyHTML('No matches.',`We couldn't find anything for "${safeQ}". Try a different title or spelling.`);return;
    }
    if(countEl)countEl.textContent=`${filtered.length} result${filtered.length!==1?'s':''}`;
    addSearchHist(q);
    filtered.slice(0,20).forEach(item=>grid.appendChild(makeCard(item)));
  },380);
}
function setSearchFilter(f){
  S.searchFilter=f;
  document.querySelectorAll('.search-filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.f===f));
  document.getElementById('search-result-count').textContent='';
  const q=document.getElementById('search-overlay-input')?.value;
  if(q?.trim())handleSearchInput(q);
}

/* ══════════════════════════════════════════
   CARDS — modern design with micro-interactions
   ══════════════════════════════════════════ */
function makeCard(item,opts={}){
  const type=mtyp(item),t=ttl(item),y=yr(item);
  const src=imgP(item.poster_path),fav=isFav(item.id);
  const pct=opts.showProgress?getProg(item.id,type):0;
  const score=item.vote_average?Math.round(item.vote_average*10):0;

  const wrap=document.createElement('div');
  wrap.className='card';wrap.dataset.id=item.id;

  const imgW=document.createElement('div');imgW.className='card-img-w';
  if(src){
    const img=document.createElement('img');
    img.className='card-img';img.src=src;img.alt=t;img.loading='lazy';
    img.onload=()=>imgW.classList.add('loaded');
    imgW.appendChild(img);
  }else{
    const ph=document.createElement('div');ph.className='card-ph';
    ph.innerHTML=`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="m7 8 4 3-4 3V8z"/></svg>`;
    imgW.appendChild(ph);
  }

  // Score badge
  if(score>0&&!opts.hideScore){
    const sb=document.createElement('div');
    sb.className=`card-score ${score>=70?'fresh':score>=50?'mixed':'rotten'}`;
    sb.textContent=`${score}%`;
    imgW.appendChild(sb);
  }

  // Rank badge
  if(opts.rank){
    const rb=document.createElement('div');
    rb.className=`rank-badge${opts.rank<=3?' rank-top':''}`;
    rb.textContent=`#${opts.rank}`;
    imgW.appendChild(rb);
  }

  // Progress bar at bottom of image
  if(opts.showProgress&&pct>0){
    const pb=document.createElement('div');pb.className='card-prog-bar';
    pb.innerHTML=`<div class="card-prog-fill" style="width:${pct}%"></div>`;
    imgW.appendChild(pb);
  }

  // Hover overlay — dark scrim + centered play button (no trailer, no network calls)
  const ov=document.createElement('div');ov.className='card-ov';
  ov.innerHTML=`
    <button class="card-play-icon" aria-label="Watch ${t}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
    </button>`;
  imgW.appendChild(ov);

  // Persistent type pill (independent of hover so it stays visible on touch)
  if(type==='tv'){
    const pill=document.createElement('span');pill.className='card-type-pill';pill.textContent='Series';
    imgW.appendChild(pill);
  }

  // Fav button
  const favBtn=document.createElement('button');
  favBtn.className=`card-fav${fav?' active':''}`;
  favBtn.setAttribute('aria-label',fav?'Remove from My List':'Add to My List');
  favBtn.innerHTML=`<svg width="13" height="13" viewBox="0 0 24 24" fill="${fav?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l8.84 8.84 8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  imgW.appendChild(favBtn);

  wrap.appendChild(imgW);

  const gl=genreLabel(item.genre_ids);
  const info=document.createElement('div');info.className='card-info';
  info.innerHTML=`
    <div class="card-title">${t}</div>
    <div class="card-meta">${y}${gl?`<span class="cdot">·</span><span class="card-genre">${gl}</span>`:''}</div>`;
  wrap.appendChild(info);

  wrap.addEventListener('click',e=>{if(e.target.closest('.card-fav'))return;closeSearch();openTitlePage(item);});
  favBtn.addEventListener('click',e=>{
    e.stopPropagation();
    const now=toggleFav(item);
    favBtn.classList.toggle('active',now);
    favBtn.setAttribute('aria-label',now?'Remove from My List':'Add to My List');
    favBtn.querySelector('svg').setAttribute('fill',now?'currentColor':'none');
    // Micro-interaction: scale pulse
    favBtn.animate([{transform:'scale(1)'},{transform:'scale(1.35)'},{transform:'scale(1)'}],{duration:300,easing:'ease'});
  });
  return wrap;
}
const skels=(n=8)=>Array.from({length:n},()=>{const d=document.createElement('div');d.className='card-sk';return d;});
async function fillRail(el,fn,opts={}){
  el.innerHTML='';skels(8).forEach(s=>el.appendChild(s));
  const items=await fn();el.innerHTML='';
  const filtered=S.genre?items.filter(i=>i.genre_ids?.includes(parseInt(S.genre))):items;
  const list=filtered.length?filtered:items;
  list.forEach((item,i)=>el.appendChild(makeCard(item,{...opts,rank:opts.ranked?i+1:undefined})));
}
const pagedfetch={
  movies:page=>api('/movie/popular',{page}).then(d=>d?.results||[]),
  nowPlaying:page=>api('/movie/now_playing',{page}).then(d=>d?.results||[]),
  tv:page=>api('/tv/popular',{page}).then(d=>d?.results||[]),
  topTV:page=>api('/tv/top_rated',{page}).then(d=>d?.results||[]),
};
function initInfiniteScroll(sentinelId,onLoad){
  const sentinel=document.getElementById(sentinelId);if(!sentinel)return;
  const obs=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)onLoad();},{rootMargin:'200px'});
  obs.observe(sentinel);return obs;
}
const emptyHTML=(h,p)=>`<div class="empty"><div class="empty-icon">◻</div><div class="empty-h">${h}</div><div class="empty-p">${p}</div></div>`;

function preloadImage(url){
  return new Promise(resolve=>{
    if(!url)return resolve(false);
    const img=new Image();
    img.onload=()=>resolve(true);
    img.onerror=()=>resolve(false);
    img.src=url;
  });
}

/* ══════════════════════════════════════════
   AMBIENT COLOR
   ══════════════════════════════════════════ */
function extractAmbientColor(imgUrl){
  return new Promise(resolve=>{
    const img=new Image();img.crossOrigin='anonymous';
    img.onload=()=>{
      try{
        const c=document.createElement('canvas');c.width=8;c.height=4;
        const ctx=c.getContext('2d');ctx.drawImage(img,0,0,8,4);
        const d=ctx.getImageData(0,0,8,4).data;
        let r=0,g=0,b=0,n=0;
        for(let i=32;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}
        r=Math.round(r/n);g=Math.round(g/n);b=Math.round(b/n);
        const min=Math.min(r,g,b),boost=1.4;
        r=Math.min(255,Math.round(min+(r-min)*boost));
        g=Math.min(255,Math.round(min+(g-min)*boost));
        b=Math.min(255,Math.round(min+(b-min)*boost));
        resolve(`${r},${g},${b}`);
      }catch(_){resolve('201,169,110');}
    };
    img.onerror=()=>resolve('201,169,110');
    img.src=imgUrl;
  });
}

/* ══════════════════════════════════════════
   HERO TRAILER AUTOPLAY
   ══════════════════════════════════════════ */
let _heroTrailerTimer=null;
function loadHeroTrailer(key){
  S.heroTrailerKey=key;
  const wrap=document.getElementById('hero-trailer-wrap');
  const iframe=document.getElementById('hero-trailer-iframe');
  const muteBtn=document.getElementById('hero-mute-btn');
  if(!wrap||!iframe)return;
  iframe.src=`https://www.youtube.com/embed/${key}?autoplay=1&mute=1&loop=1&playlist=${key}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3`;
  S.heroTrailerMuted=true;
  setTimeout(()=>{
    if(S.heroTrailerKey===key&&S.page==='home'){
      wrap.classList.add('active');
      if(muteBtn)muteBtn.style.display='flex';
      S.heroTrailerActive=true;
    }
  },1500);
}
function stopHeroTrailer(){
  S.heroTrailerActive=false;S.heroTrailerKey=null;
  const wrap=document.getElementById('hero-trailer-wrap');
  const iframe=document.getElementById('hero-trailer-iframe');
  const muteBtn=document.getElementById('hero-mute-btn');
  if(wrap)wrap.classList.remove('active');
  if(iframe)iframe.src='';
  if(muteBtn)muteBtn.style.display='none';
}
function toggleHeroMute(){
  const iframe=document.getElementById('hero-trailer-iframe');
  const muteBtn=document.getElementById('hero-mute-btn');
  if(!iframe||!S.heroTrailerKey)return;
  S.heroTrailerMuted=!S.heroTrailerMuted;
  const key=S.heroTrailerKey,muted=S.heroTrailerMuted?1:0;
  iframe.src=`https://www.youtube.com/embed/${key}?autoplay=1&mute=${muted}&loop=1&playlist=${key}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3`;
  if(muteBtn){
    muteBtn.querySelector('.mute-off').style.display=S.heroTrailerMuted?'block':'none';
    muteBtn.querySelector('.mute-on').style.display=S.heroTrailerMuted?'none':'block';
  }
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopHeroTrailer();});

let _heroBgToggle=false;
async function renderHero(item){
  const bg=imgB(item.backdrop_path);
  // Preload before swapping so the crossfade never reveals a blank/partial frame
  if(bg)await preloadImage(bg);
  if(S.heroItems[S.heroIdx]?.id!==item.id)return; // stale response, hero moved on
  const layerA=document.getElementById('hero-bg');
  const layerB=document.getElementById('hero-bg-2');
  const showing=_heroBgToggle?layerB:layerA;
  const hiding=_heroBgToggle?layerA:layerB;
  showing.style.backgroundImage=bg?`url(${bg})`:'linear-gradient(135deg,#141416,#09090b)';
  showing.classList.add('visible');
  hiding.classList.remove('visible');
  _heroBgToggle=!_heroBgToggle;
  document.getElementById('hero-greeting').textContent=greeting();
  document.getElementById('hero-title').textContent=ttl(item);
  document.getElementById('hero-type').textContent=mtyp(item)==='tv'?'Series':'Film';
  document.getElementById('hero-year').textContent=yr(item);
  document.getElementById('hero-score').innerHTML=fmtScore(item.vote_average);
  document.getElementById('hero-overview').textContent=(item.overview||'').slice(0,200)+((item.overview?.length||0)>200?'…':'');
  document.querySelectorAll('.hero-dot').forEach((d,i)=>d.classList.toggle('active',i===S.heroIdx));
  if(bg){
    extractAmbientColor(bg).then(rgb=>{
      const ambient=document.getElementById('hero-ambient');
      if(ambient)ambient.style.background=`radial-gradient(ellipse 80% 60% at 20% 80%, rgba(${rgb},.28) 0%, transparent 70%)`;
    });
  }
  stopHeroTrailer();clearTimeout(_heroTrailerTimer);S.heroTrailerLoading=false;
  _heroTrailerTimer=setTimeout(async()=>{
    if(S.heroItems[S.heroIdx]?.id!==item.id||S.page!=='home')return;
    S.heroTrailerLoading=true;
    const vids=await A.videos(item.id,mtyp(item));
    S.heroTrailerLoading=false;
    if(S.heroItems[S.heroIdx]?.id===item.id&&S.page==='home'){
      const tr=vids?.find(v=>v.type==='Trailer'&&v.site==='YouTube')||vids?.find(v=>v.site==='YouTube');
      if(tr)loadHeroTrailer(tr.key);
    }
  },4000);
}
function setupHero(items){
  S.heroItems=items.slice(0,7);S.heroIdx=0;renderHero(S.heroItems[0]);
  const dw=document.getElementById('hero-dots');dw.innerHTML='';
  S.heroItems.forEach((_,i)=>{
    const d=document.createElement('button');d.className=`hero-dot${i===0?' active':''}`;
    d.addEventListener('click',()=>{S.heroIdx=i;renderHero(S.heroItems[i]);startHeroTimer();});
    dw.appendChild(d);
  });
  startHeroTimer();
}
function startHeroTimer(){
  clearInterval(S.heroTimer);
  S.heroTimer=setInterval(()=>{
    if(S.heroTrailerActive)return;
    S.heroIdx=(S.heroIdx+1)%S.heroItems.length;
    renderHero(S.heroItems[S.heroIdx]);
  },12000);
}
function setupGenres(){
  const bar=document.getElementById('mood-bar');if(!bar)return;
  bar.innerHTML='<span class="mood-label">Genre</span>';
  GENRES.forEach(g=>{
    const btn=document.createElement('button');
    btn.className=`mood-chip${!g.id?' active':''}`;btn.textContent=g.label;
    btn.addEventListener('click',async()=>{
      document.querySelectorAll('.mood-chip').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');S.genre=g.id;
      const rail=document.getElementById('rail-trending');
      if(g.id)fillRail(rail,()=>A.byGenre(g.id));
      else fillRail(rail,A.trending,{ranked:true});
    });
    bar.appendChild(btn);
  });
}
async function loadHome(){
  const trending=await A.trending();
  if(trending.length)setupHero(trending);
  refreshContRow();
  fillRail(document.getElementById('rail-trending'),A.trending,{ranked:true});
  fillRail(document.getElementById('rail-movies'),A.movies);
  fillRail(document.getElementById('rail-tv'),A.tv);
  fillRail(document.getElementById('rail-toprated'),A.topRated);
}
function refreshContRow(){
  const sec=document.getElementById('continue-sec'),rail=document.getElementById('rail-continue');
  if(!sec||!rail)return;
  if(!S.hist.length){sec.style.display='none';return;}
  sec.style.display='block';rail.innerHTML='';
  S.hist.slice(0,12).forEach(item=>{
    const wrap=document.createElement('div');wrap.className='cont-item';
    wrap.style.cssText='position:relative;flex:0 0 152px';
    const card=makeCard(item,{showProgress:true,hideScore:true});wrap.appendChild(card);
    const xBtn=document.createElement('button');xBtn.className='cont-remove-btn';
    xBtn.innerHTML='✕';
    xBtn.addEventListener('click',e=>{
      e.stopPropagation();
      const idx=S.hist.findIndex(h=>h.id===item.id);if(idx>-1)S.hist.splice(idx,1);
      const type=item.media_type||(item.first_air_date?'tv':'movie');
      Object.keys(S.prog).filter(k=>k.startsWith(type==='movie'?`m_${item.id}`:`tv_${item.id}_`)).forEach(k=>delete S.prog[k]);
      save();refreshContRow();showToast('Removed from Continue Watching');
    });
    wrap.appendChild(xBtn);rail.appendChild(wrap);
  });
}
function refreshFavPage(){
  const grid=document.getElementById('fav-grid');if(!grid)return;
  if(!S.favs.length){grid.innerHTML=emptyHTML('Your list is empty.','Save something worth returning to.');return;}
  grid.innerHTML='';S.favs.forEach(item=>grid.appendChild(makeCard(item)));
}

/* ══════════════════════════════════════════
   JUSTWATCH / IMDB
   ══════════════════════════════════════════ */
const JW_SERVICES={
  8:{name:'Netflix',logo:'https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg'},
  337:{name:'Disney+',logo:'https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg'},
  9:{name:'Prime Video',logo:'https://image.tmdb.org/t/p/original/dQeAar5H991VYporEjUspolDarG.jpg'},
  384:{name:'Max',logo:'https://image.tmdb.org/t/p/original/Ajqyt5aNxNvaG0sDlKm0F7ReiID.jpg'},
  15:{name:'Hulu',logo:'https://image.tmdb.org/t/p/original/zxrVdFjIjLqkfnwyghnfywTn3Lh.jpg'},
  531:{name:'Paramount+',logo:'https://image.tmdb.org/t/p/original/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg'},
  2:{name:'Apple TV+',logo:'https://image.tmdb.org/t/p/original/peURlLlr8jggOwK53fJ5wdQl05y.jpg'},
  283:{name:'Crunchyroll',logo:'https://image.tmdb.org/t/p/original/8Gt1iClBlzTeQs8WQm8UrCoIxnQ.jpg'},
};
const JW_IDS=new Set(Object.keys(JW_SERVICES).map(Number));
function parseWatchProviders(watchData){
  const region=(watchData?.results||{})['US']||(watchData?.results||{})['GB']||Object.values(watchData?.results||{})[0];
  if(!region)return[];
  const flat=region.flatrate||[],ads=region.ads||[],rent=[...(region.rent||[]),(region.buy||[])];
  const seen=new Set(),out=[];
  for(const p of [...flat,...ads,...rent]){
    if(seen.has(p.provider_id)||!JW_IDS.has(p.provider_id))continue;
    seen.add(p.provider_id);
    const svc=JW_SERVICES[p.provider_id];
    out.push({
      id:p.provider_id,name:svc.name,
      logo:p.logo_path?`${TMDB_IMG}/w45${p.logo_path}`:svc.logo,
      type:flat.some(x=>x.provider_id===p.provider_id)?'stream':ads.some(x=>x.provider_id===p.provider_id)?'ads':'rent',
    });
  }
  return out;
}
function renderImdbBlock(details){
  const block=document.getElementById('tp-imdb-block');if(!block)return;
  const v=details.vote_average,c=details.vote_count,imdb_id=details.external_ids?.imdb_id;
  if(!v){block.style.display='none';return;}
  const score=v.toFixed(1),stars=Math.round(v/2);
  const starsHtml=Array.from({length:5},(_,i)=>`<svg class="imdb-star${i<stars?' filled':''}" viewBox="0 0 24 24" width="14" height="14"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`).join('');
  const votes=c>=1e6?(c/1e6).toFixed(1)+'M':c>=1000?Math.round(c/1000)+'K':String(c||'');
  block.innerHTML=`<div class="imdb-badge"><div class="imdb-logo-wrap"><span class="imdb-logo-text">IMDb</span></div><div class="imdb-score-wrap"><span class="imdb-score">${score}</span><span class="imdb-max">/10</span></div><div class="imdb-stars">${starsHtml}</div>${votes?`<div class="imdb-votes">${votes} votes</div>`:''}${imdb_id?`<a class="imdb-link" href="https://www.imdb.com/title/${imdb_id}/" target="_blank" rel="noopener">IMDb ↗</a>`:''}</div>`;
  block.style.display='block';
}
function renderJustWatchBlock(watchProviders){
  const block=document.getElementById('tp-justwatch-block');if(!block)return;
  const providers=parseWatchProviders(watchProviders);
  if(!providers.length){block.style.display='none';return;}
  const streaming=providers.filter(p=>p.type==='stream');
  const adFree=providers.filter(p=>p.type==='ads');
  const rent=providers.filter(p=>p.type==='rent');
  const rg=(label,list)=>!list.length?'':`<div class="jw-group"><div class="jw-group-label">${label}</div><div class="jw-logos">${list.map(p=>`<div class="jw-provider" title="${p.name}">${p.logo?`<img src="${p.logo}" alt="${p.name}" class="jw-logo" loading="lazy">`:`<span class="jw-logo-text">${p.name.slice(0,2)}</span>`}<span class="jw-name">${p.name}</span></div>`).join('')}</div></div>`;
  block.innerHTML=`<div class="jw-block"><div class="jw-header"><span class="jw-title">Where to Watch</span><span class="jw-powered">via JustWatch</span></div>${rg('Stream',streaming)}${rg('Free with Ads',adFree)}${rg('Rent / Buy',rent)}</div>`;
  block.style.display='block';
}

/* ══════════════════════════════════════════
   TITLE PAGE
   ══════════════════════════════════════════ */
async function openTitlePage(item){
  S.titleItem=item;
  S.titlePrevPage=S.lastPage||'home';
  const type=mtyp(item);
  setHash(`/title/${type}/${item.id}`);
  goTo('title');

  // Backdrop — blurred low-res placeholder appears instantly, full-res crossfades in on top
  const tp=document.getElementById('tp-backdrop');
  const tpLq=document.getElementById('tp-backdrop-lq');
  tp.classList.remove('loaded');tp.style.backgroundImage='';tp.style.animation='none';
  if(tpLq){tpLq.classList.remove('loaded');tpLq.style.backgroundImage='';}
  const lqUrl=imgBLq(item.backdrop_path);
  const bgUrl=imgBHi(item.backdrop_path)||imgB(item.backdrop_path);
  if(lqUrl&&tpLq){
    tpLq.style.backgroundImage=`url(${lqUrl})`;
    requestAnimationFrame(()=>tpLq.classList.add('loaded'));
  }
  if(bgUrl){
    const img=new Image();
    img.onload=()=>{
      tp.style.backgroundImage=`url(${bgUrl})`;
      requestAnimationFrame(()=>{tp.style.animation='';tp.classList.add('loaded');});
    };
    img.src=bgUrl;
  }

  // Poster
  const posterImg=document.getElementById('tp-poster-img');
  const posterPh=document.getElementById('tp-poster-ph');
  if(posterImg&&item.poster_path){
    posterImg.style.display='none';
    if(posterPh)posterPh.style.display='flex';
    posterImg.onload=()=>{posterImg.style.display='block';if(posterPh)posterPh.style.display='none';};
    posterImg.src=`${TMDB_IMG}/w342${item.poster_path}`;
  }

  // Immediate text
  document.getElementById('tp-title').textContent=ttl(item);
  document.getElementById('tp-year').textContent=yr(item);
  document.getElementById('tp-overview').textContent=item.overview||'';
  document.getElementById('tp-score').innerHTML=fmtScore(item.vote_average);
  document.getElementById('tp-type-badge').textContent=type==='tv'?'Series':'Movie';

  // Reset
  ['tp-genres','tp-trailer-wrap','tp-cast-rail','tp-ep-list','tp-collection-rail','tp-similar-rail','tp-imdb-block','tp-justwatch-block'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='';});
  ['tp-eps-section','tp-collection-sec','tp-similar-sec'].forEach(id=>document.getElementById(id).style.display='none');
  ['tp-runtime','tp-seasons'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='';});
  ['tp-imdb-block','tp-justwatch-block'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  const tew=document.getElementById('tp-trailer-embed-wrap');
  const tei=document.getElementById('tp-trailer-embed');
  if(tew)tew.style.display='none';if(tei)tei.src='';

  // Skeleton cast
  document.getElementById('tp-cast-rail').innerHTML=Array.from({length:6},()=>`<div class="cast-skel"><div class="cast-skel-face"></div><div class="cast-skel-line"></div></div>`).join('');

  // Watch/fav
  const watchBtn=document.getElementById('tp-watch-btn');
  const prog=getProg(item.id,type);
  watchBtn.innerHTML=prog>5
    ?`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Resume (${prog}%)`
    :`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Watch Now`;
  watchBtn.onclick=()=>{
    if(type==='tv'){const last=getLastEp(item.id);openPlayer(item,'tv',last?.season||1,last?.episode||1);}
    else openPlayer(item,'movie');
  };
  const favBtn=document.getElementById('tp-fav-btn');
  const upFav=a=>{favBtn.classList.toggle('active',a);favBtn.querySelector('span').textContent=a?'In My List':'My List';};
  upFav(isFav(item.id));
  favBtn.onclick=()=>{const now=toggleFav(item);upFav(now);};

  // Fetch details
  const details=await A.details(item.id,type);
  if(!details){document.getElementById('tp-cast-rail').innerHTML='<p style="color:var(--text3);font-size:13px">Could not load details.</p>';return;}

  const rt=details.runtime||details.episode_run_time?.[0];
  document.getElementById('tp-runtime').textContent=rt?fmtRuntime(rt):'';
  document.getElementById('tp-seasons').textContent=details.number_of_seasons?`${details.number_of_seasons} Season${details.number_of_seasons!==1?'s':''}` :'';

  // Genres
  const gEl=document.getElementById('tp-genres');
  (details.genres||[]).forEach(g=>{const pill=document.createElement('span');pill.className='tp-genre-pill';pill.textContent=g.name;gEl.appendChild(pill);});

  renderImdbBlock(details);
  renderJustWatchBlock(details['watch/providers']);

  // Trailer
  const videos=details.videos?.results||[];
  const trailer=videos.find(v=>v.type==='Trailer'&&v.site==='YouTube')||videos.find(v=>v.site==='YouTube');
  if(trailer){
    const trailerWrap=document.getElementById('tp-trailer-wrap');
    if(trailerWrap){
      const btn=document.createElement('button');btn.className='tp-trailer-btn';
      btn.innerHTML=`<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z"/></svg> Trailer`;
      btn.addEventListener('click',()=>openTrailer(trailer.key));
      trailerWrap.appendChild(btn);
    }
    if(tew&&tei){tei.src=`https://www.youtube.com/embed/${trailer.key}?rel=0&modestbranding=1`;tew.style.display='block';}
  }

  // Cast
  const cast=(details.credits?.cast||[]).slice(0,14);
  const castRail=document.getElementById('tp-cast-rail');castRail.innerHTML='';
  cast.forEach(person=>{
    const card=document.createElement('div');card.className='cast-card';
    const imgW=document.createElement('div');imgW.className='cast-img-w';
    if(person.profile_path){
      const img=document.createElement('img');
      img.alt=person.name;img.loading='eager';
      img.onerror=()=>{imgW.innerHTML=castPH();};
      img.src=`${TMDB_IMG}/w185${person.profile_path}`;
      imgW.appendChild(img);
    }else imgW.innerHTML=castPH();
    const name=document.createElement('div');name.className='cast-name';name.textContent=person.name;
    const role=document.createElement('div');role.className='cast-role';role.textContent=person.character||'';
    card.appendChild(imgW);card.appendChild(name);card.appendChild(role);
    card.addEventListener('click',()=>openPersonPage(person.id));
    castRail.appendChild(card);
  });

  // TV: season/episode dropdowns + tabs
  if(type==='tv'&&details.number_of_seasons){
    S.playerSeasons=details.number_of_seasons;
    document.getElementById('tp-eps-section').style.display='block';
    buildTitlePageSeasons(item,details);
  }

  // Collection
  if(type==='movie'&&details.belongs_to_collection?.id){
    const parts=await A.collection(details.belongs_to_collection.id);
    const others=parts.filter(p=>p.id!==item.id).sort((a,b)=>(a.release_date||'').localeCompare(b.release_date||''));
    if(others.length){
      document.getElementById('tp-collection-title').textContent=details.belongs_to_collection.name||'Other Parts';
      const rail=document.getElementById('tp-collection-rail');
      rail.innerHTML='';others.forEach(p=>{p.media_type='movie';rail.appendChild(makeCard(p));});
      document.getElementById('tp-collection-sec').style.display='block';
    }
  }

  // Similar
  const [sim,rec]=await Promise.all([A.similar(item.id,type),A.recommended(item.id,type)]);
  const combined=[...rec,...sim].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i&&v.id!==item.id).slice(0,16);
  const simRail=document.getElementById('tp-similar-rail');
  if(simRail&&combined.length){combined.forEach(p=>{p.media_type=type;simRail.appendChild(makeCard(p));});}
  document.getElementById('tp-similar-sec').style.display=combined.length?'block':'none';
}

const castPH=()=>`<div class="cast-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="24" height="24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>`;

/* ══════════════════════════════════════════
   SEASON / EPISODE DROPDOWNS
   ══════════════════════════════════════════ */
function buildTitlePageSeasons(item,details){
  const n=details.number_of_seasons;
  const seasons=(details.seasons||[]).filter(s=>s.season_number>0);
  const head=document.getElementById('tp-season-tabs');
  const list=document.getElementById('tp-ep-list');
  head.innerHTML='';

  // Season dropdown
  const seasonSel=document.createElement('select');
  seasonSel.className='season-dropdown';
  seasonSel.setAttribute('aria-label','Select season');
  seasons.forEach(s=>{
    const opt=document.createElement('option');
    opt.value=s.season_number;
    opt.textContent=`Season ${s.season_number}${s.episode_count?` (${s.episode_count} eps)`:''}`;
    seasonSel.appendChild(opt);
  });
  head.appendChild(seasonSel);

  // Episode dropdown (populated on season change)
  const epSel=document.createElement('select');
  epSel.className='ep-dropdown';
  epSel.setAttribute('aria-label','Select episode');
  head.appendChild(epSel);

  // Watch selected episode button
  const watchEpBtn=document.createElement('button');
  watchEpBtn.className='btn-primary btn-watch-ep';
  watchEpBtn.innerHTML=`<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg> Watch`;
  watchEpBtn.onclick=()=>{
    const s=parseInt(seasonSel.value);
    const e=parseInt(epSel.value);
    const epName=epSel.options[epSel.selectedIndex]?.dataset.name||'';
    openPlayer(item,'tv',s,e,epName);
  };
  head.appendChild(watchEpBtn);

  // Load episode list on season change
  async function loadSeasonEps(sNum){
    epSel.innerHTML='<option>Loading…</option>';
    epSel.disabled=true;
    list.innerHTML=`<div class="ep-loading">Loading episodes…</div>`;

    // Cache season data
    if(!S.playerSeasonData[item.id]) S.playerSeasonData[item.id]={};
    if(!S.playerSeasonData[item.id][sNum]){
      S.playerSeasonData[item.id][sNum]=await A.season(item.id,sNum);
    }
    const data=S.playerSeasonData[item.id][sNum];
    const eps=data?.episodes||[];

    // Populate episode dropdown
    epSel.innerHTML='';
    eps.forEach(ep=>{
      const opt=document.createElement('option');
      opt.value=ep.episode_number;
      opt.dataset.name=ep.name||'';
      const pct=getProg(item.id,'tv',sNum,ep.episode_number);
      opt.textContent=`E${ep.episode_number} — ${ep.name||'Episode '+ep.episode_number}${pct>5?` (${pct}%)`:''}`;
      epSel.appendChild(opt);
    });
    epSel.disabled=false;

    // Auto-select last watched in this season
    const lastEp=getLastEp(item.id);
    if(lastEp&&lastEp.season===sNum){
      epSel.value=lastEp.episode;
    }

    // Render episode grid
    list.innerHTML='';
    eps.forEach(ep=>{
      const pct=getProg(item.id,'tv',sNum,ep.episode_number);
      const still=ep.still_path?`${TMDB_IMG}/w300${ep.still_path}`:null;
      const row=document.createElement('div');row.className='ep-item';
      row.innerHTML=`
        ${still?`<img class="ep-still" src="${still}" alt="" loading="lazy">`:`<div class="ep-still ep-still-ph"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1"><path d="m7 8 4 3-4 3V8z"/></svg></div>`}
        <div class="ep-info">
          <div class="ep-info-top">
            <span class="ep-num">E${ep.episode_number}</span>
            <span class="ep-name">${ep.name||'Episode '+ep.episode_number}</span>
            ${ep.runtime?`<span class="ep-dur">${ep.runtime}m</span>`:''}
          </div>
          ${ep.overview?`<div class="ep-overview">${ep.overview.slice(0,120)}${ep.overview.length>120?'…':''}</div>`:''}
          ${pct>0?`<div class="ep-prog-bar"><div class="ep-prog-fill" style="width:${pct}%"></div></div>`:''}
        </div>
        <span class="ep-arr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>`;
      row.addEventListener('click',()=>openPlayer(item,'tv',sNum,ep.episode_number,ep.name));
      list.appendChild(row);
    });
  }

  seasonSel.addEventListener('change',()=>loadSeasonEps(parseInt(seasonSel.value)));
  loadSeasonEps(1);
}

/* ── Trailer modal ── */
function openTrailer(key){
  document.getElementById('trailer-frame').src=`https://www.youtube.com/embed/${key}?autoplay=1&rel=0`;
  document.getElementById('trailer-modal').classList.add('open');
}
function closeTrailer(){
  document.getElementById('trailer-frame').src='';
  document.getElementById('trailer-modal').classList.remove('open');
}

/* ── Person page ── */
async function openPersonPage(id){
  goTo('person');
  document.getElementById('person-name').textContent='Loading…';
  document.getElementById('person-bio').textContent='';
  document.getElementById('person-credits-rail').innerHTML='';
  const data=await A.person(id);if(!data)return;
  const face=imgFace(data.profile_path);
  const img=document.getElementById('person-img');
  if(face&&img){img.src=face;img.style.display='block';}
  document.getElementById('person-name').textContent=data.name||'';
  document.getElementById('person-known').textContent=data.known_for_department||'';
  document.getElementById('person-bio').textContent=(data.biography||'').slice(0,400)+((data.biography?.length||0)>400?'…':'');
  const credits=[...(data.combined_credits?.cast||[]),...(data.combined_credits?.crew||[])]
    .filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i&&v.poster_path)
    .sort((a,b)=>(b.vote_count||0)-(a.vote_count||0)).slice(0,20);
  const rail=document.getElementById('person-credits-rail');
  credits.forEach(item=>{item.media_type=item.media_type||'movie';rail.appendChild(makeCard(item));});
}

/* ── Discover ── */
let S_discoverGenre=null;
async function initDiscover(){
  const loading=document.getElementById('discover-loading');
  const card=document.getElementById('discover-card');
  loading.style.display='flex';card.style.display='none';
  const page=Math.floor(Math.random()*10)+1;
  let items;
  if(S_discoverGenre){
    const type=S.discoverType==='tv'?'tv':'movie';
    const d=await api(`/discover/${type}`,{with_genres:S_discoverGenre,sort_by:'vote_average.desc','vote_count.gte':'300',page});
    items=d?.results||[];
  }else{
    items=S.discoverType==='movie'?await A.discoverM(page):await A.discoverTV(page);
  }
  S.discoverItems=items.filter(i=>i.backdrop_path&&i.overview);
  S.discoverIdx=0;
  loading.style.display='none';card.style.display='block';
  renderDiscover();
}
function renderDiscover(){
  if(!S.discoverItems.length)return;
  const item=S.discoverItems[S.discoverIdx];
  const bgEl=document.getElementById('discover-bg');
  const bgUrl=imgB(item.backdrop_path);
  if(bgUrl){
    bgEl.style.opacity='0';
    const img=new Image();
    img.onload=()=>{bgEl.style.backgroundImage=`url(${bgUrl})`;bgEl.style.opacity='1';};
    img.src=bgUrl;
  }
  document.getElementById('discover-title').textContent=ttl(item);
  document.getElementById('discover-year').textContent=yr(item);
  document.getElementById('discover-score').innerHTML=fmtScore(item.vote_average);
  document.getElementById('discover-overview').textContent=(item.overview||'').slice(0,200)+((item.overview?.length||0)>200?'…':'');
  document.getElementById('discover-genre').textContent=genreLabel(item.genre_ids)||'';
  document.getElementById('discover-counter').textContent=`${S.discoverIdx+1} / ${S.discoverItems.length}`;
  const favBtn=document.getElementById('discover-fav');
  if(favBtn){
    const active=isFav(item.id);
    favBtn.classList.toggle('active',active);
    favBtn.innerHTML=active
      ?`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l8.84 8.84 8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg> In My List`
      :`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l8.84 8.84 8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg> My List`;
  }
}
const discoverNext=()=>{if(!S.discoverItems.length)return;S.discoverIdx=(S.discoverIdx+1)%S.discoverItems.length;renderDiscover();};
const discoverPrev=()=>{if(!S.discoverItems.length)return;S.discoverIdx=(S.discoverIdx-1+S.discoverItems.length)%S.discoverItems.length;renderDiscover();};
const discoverWatch=()=>{if(!S.discoverItems.length)return;openTitlePage(S.discoverItems[S.discoverIdx]);};
function discoverToggleFav(){if(!S.discoverItems.length)return;toggleFav(S.discoverItems[S.discoverIdx]);renderDiscover();}
let _touchX=0;
function initDiscoverSwipe(){
  const el=document.getElementById('discover-card');if(!el)return;
  el.addEventListener('touchstart',e=>{_touchX=e.touches[0].clientX;},{passive:true});
  el.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-_touchX;if(Math.abs(dx)>50){dx<0?discoverNext():discoverPrev();}},{passive:true});
}

/* ══════════════════════════════════════════
   PLAYER
   ══════════════════════════════════════════ */
async function openPlayer(item,type,season=1,ep=1,epName=''){
  // Show cinematic loader with title backdrop
  const loaderEl=showCinematicLoader();
  const bg=imgB(item.backdrop_path);
  updateCinematicLoader(20,`Loading ${ttl(item)}…`,bg);

  S.playerItem=item;S.playerType=type;S.playerSeason=season;S.playerEp=ep;
  addHist({...item,media_type:type});
  goTo('player');

  document.getElementById('below-title').textContent=ttl(item);
  document.getElementById('below-meta').textContent=type==='tv'
    ?`Season ${season} · Episode ${ep}${epName?' — '+epName:''}`:yr(item);

  S.playerOpenTime=Date.now();
  updateCinematicLoader(50,'Fetching details…',bg);
  const details=await A.details(item.id,type);
  S.playerRuntime=(details?.runtime||details?.episode_run_time?.[0]||45)*60*1000;

  updateCinematicLoader(80,'Starting stream…',bg);
  loadVidSrcWithServer(item.id,type,season,ep);

  const nav=document.getElementById('player-ep-nav');
  if(nav)nav.style.display=type==='tv'?'flex':'none';

  if(type==='tv'){
    S.playerSeasons=details?.number_of_seasons||S.playerSeasons||1;
    const data=await A.season(item.id,season);
    S.playerEps=data?.episodes||[];
    buildEpPanel();updateEpCounter();
    loadBelowContent(item,type,null);
  }else{
    S.playerEps=[];S.playerSeasons=0;
    document.getElementById('pep-list').innerHTML='';
    document.getElementById('pep-season-tabs').innerHTML='';
    loadBelowContent(item,type,details);
  }

  updateCinematicLoader(100,'Ready',bg);
  setTimeout(()=>hideCinematicLoader(),400);
}

function loadVidSrc(id,type,season,ep){loadVidSrcWithServer(id,type,season,ep);}

let _srcHintTimer=null;
function loadVidSrcWithServer(id,type,season,ep){
  const wrap=document.getElementById('player-embed-wrap');if(!wrap)return;
  const old=document.getElementById('vidsrc-iframe');
  if(old){old.src='about:blank';old.remove();}
  const loader=document.getElementById('player-loader');
  if(loader)loader.classList.add('on');
  hideSourceHint();
  const srv=getCurrentServer();
  const url=type==='movie'?srv.movie(id):srv.tv(id,season,ep);
  const iframe=document.createElement('iframe');
  iframe.id='vidsrc-iframe';
  iframe.setAttribute('allowfullscreen','');
  iframe.setAttribute('allow','autoplay; fullscreen; picture-in-picture; encrypted-media');
  iframe.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:none;z-index:2;background:#000;display:block;';
  iframe.src=url;
  // The iframe's own onload fires when the outer document loads — not when
  // the embed's internal player UI has actually initialized. Removing the
  // loader at that exact moment causes the "click play multiple times" bug,
  // since the underlying player isn't interactive yet. Enforce a minimum
  // visible duration so the embed has time to finish setting up.
  const loadStart=Date.now();
  const MIN_LOADER_MS=1800;
  iframe.onload=()=>{
    const elapsed=Date.now()-loadStart;
    const remaining=Math.max(0,MIN_LOADER_MS-elapsed);
    setTimeout(()=>{if(loader)loader.classList.remove('on');},remaining);
  };
  wrap.appendChild(iframe);
  // Some sources silently fail (dead host, blocked embed) without ever
  // erroring — the iframe just sits there. Nudge the user toward switching
  // sources if nothing seems to have happened after a while, instead of
  // leaving them staring at a blank/black rectangle.
  clearTimeout(_srcHintTimer);
  _srcHintTimer=setTimeout(showSourceHint,9000);
}
function showSourceHint(){
  document.getElementById('player-source-hint')?.classList.add('show');
}
function hideSourceHint(){
  clearTimeout(_srcHintTimer);
  document.getElementById('player-source-hint')?.classList.remove('show');
}

function stopPlayer(){
  if(S.playerItem&&S.playerOpenTime&&S.playerRuntime){
    const elapsed=Date.now()-S.playerOpenTime;
    const pct=Math.min(Math.round((elapsed/S.playerRuntime)*100),99);
    if(pct>2)saveProg(S.playerItem.id,S.playerType,S.playerSeason,S.playerEp,pct);
  }
  const iframe=document.getElementById('vidsrc-iframe');
  if(iframe){iframe.src='about:blank';iframe.remove();}
  document.getElementById('player-ep-panel')?.classList.remove('open');
  hideSourceHint();
  S.playerSeasons=0;S.playerOpenTime=0;
}

async function loadBelowContent(item,type,details){
  const collSec=document.getElementById('collection-sec');
  const simSec=document.getElementById('similar-sec');
  if(collSec)collSec.style.display='none';
  if(simSec)simSec.style.display='none';
  let hasParts=false;
  if(type==='movie'&&details?.belongs_to_collection?.id){
    const parts=await A.collection(details.belongs_to_collection.id);
    const others=parts.filter(p=>p.id!==item.id).sort((a,b)=>(a.release_date||'').localeCompare(b.release_date||''));
    if(others.length&&collSec){
      document.getElementById('collection-title').textContent=details.belongs_to_collection.name||'Other Parts';
      const rail=document.getElementById('collection-rail');
      rail.innerHTML='';others.forEach(p=>{p.media_type='movie';rail.appendChild(makeCard(p));});
      collSec.style.display='block';hasParts=true;
    }
  }
  const [sim,rec]=await Promise.all([A.similar(item.id,type),A.recommended(item.id,type)]);
  const combined=[...rec,...sim].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i&&v.id!==item.id).slice(0,20);
  if(combined.length&&simSec){
    document.getElementById('similar-title').textContent=type==='tv'?'More Like This':hasParts?'You May Also Like':'Similar Movies';
    const rail=document.getElementById('similar-rail');
    rail.innerHTML='';combined.forEach(p=>{p.media_type=type;rail.appendChild(makeCard(p));});
    simSec.style.display='block';
  }
}

/* ══════════════════════════════════════════
   SOURCE SWITCHER — tabs UI
   ══════════════════════════════════════════ */
function buildServerSwitcher(){
  const container=document.getElementById('server-switcher');if(!container)return;
  container.innerHTML='';
  SERVERS.forEach((srv,i)=>{
    const btn=document.createElement('button');
    btn.className=`server-opt${i===_currentServer?' active':''}`;
    btn.setAttribute('role','tab');
    btn.setAttribute('aria-selected',i===_currentServer?'true':'false');
    btn.dataset.idx=i;
    btn.innerHTML=`
      <span class="srv-name">${srv.label}</span>
      ${srv.tag?`<span class="srv-tag">${srv.tag}</span>`:''}
      ${i===_currentServer?'<span class="srv-active-ind"></span>':''}`;
    btn.addEventListener('click',()=>{
      setServer(i);
      // Don't close panel on click — allow quick switching
      buildServerSwitcher();
    });
    container.appendChild(btn);
  });
}
function openSrcPanel(){
  const p=document.getElementById('src-panel');if(!p)return;
  p.classList.add('open');
  setTimeout(()=>p.querySelector('.server-opt')?.focus(),50);
}
function closeSrcPanel(){document.getElementById('src-panel')?.classList.remove('open');}
function toggleSrcPanel(){
  const p=document.getElementById('src-panel');if(!p)return;
  p.classList.contains('open')?closeSrcPanel():openSrcPanel();
}

/* ══════════════════════════════════════════
   EPISODE PANEL IN PLAYER
   ══════════════════════════════════════════ */
function buildEpPanel(){
  const pepList=document.getElementById('pep-list');
  const pepTabs=document.getElementById('pep-season-tabs');
  if(!pepList)return;
  if(pepTabs&&S.playerSeasons>1){
    pepTabs.innerHTML='';
    for(let s=1;s<=Math.min(S.playerSeasons,8);s++){
      const btn=document.createElement('button');
      btn.className=`pep-season-btn${s===S.playerSeason?' active':''}`;btn.textContent=`S${s}`;
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.pep-season-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');S.playerSeason=s;
        A.season(S.playerItem.id,s).then(d=>{S.playerEps=d?.episodes||[];renderEps(pepList);});
      });
      pepTabs.appendChild(btn);
    }
  }else if(pepTabs)pepTabs.innerHTML='';
  renderEps(pepList);
}
function renderEps(container){
  container.querySelectorAll('.pep-ep-row').forEach(r=>r.remove());
  S.playerEps.forEach(ep=>{
    const pct=getProg(S.playerItem.id,'tv',S.playerSeason,ep.episode_number);
    const still=ep.still_path?`${TMDB_IMG}/w300${ep.still_path}`:null;
    const isNow=ep.episode_number===S.playerEp;
    const row=document.createElement('div');row.className=`pep-ep-row${isNow?' active':''}`;
    row.innerHTML=`
      ${still?`<img class="pep-thumb" src="${still}" alt="" loading="lazy">`:`<div class="pep-thumb pep-thumb-ph"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m7 8 4 3-4 3V8z"/></svg></div>`}
      <div class="pep-info">
        <div class="pep-ep-title">E${ep.episode_number} — ${ep.name||'Episode '+ep.episode_number}</div>
        ${ep.runtime?`<div class="pep-ep-dur">${ep.runtime}m</div>`:''}
        ${pct>0?`<div class="pep-prog"><div class="pep-prog-fill" style="width:${pct}%"></div></div>`:''}
      </div>
      ${isNow?'<span class="pep-now">Now</span>':''}`;
    row.addEventListener('click',()=>{
      document.getElementById('player-ep-panel')?.classList.remove('open');
      openPlayer(S.playerItem,'tv',S.playerSeason,ep.episode_number,ep.name);
    });
    container.appendChild(row);
  });
}
function nextEpisode(){
  const cur=S.playerEps.findIndex(e=>e.episode_number===S.playerEp);
  if(S.playerType!=='tv'||cur===-1||cur===S.playerEps.length-1){showToast('End of season');return;}
  const next=S.playerEps[cur+1];openPlayer(S.playerItem,'tv',S.playerSeason,next.episode_number,next.name);
}
function prevEpisode(){
  const cur=S.playerEps.findIndex(e=>e.episode_number===S.playerEp);
  if(S.playerType!=='tv'||cur<=0){showToast('Already at first episode');return;}
  const prev=S.playerEps[cur-1];openPlayer(S.playerItem,'tv',S.playerSeason,prev.episode_number,prev.name);
}
function updateEpCounter(){
  const el=document.getElementById('player-ep-counter');if(!el||!S.playerEps.length)return;
  const cur=S.playerEps.findIndex(e=>e.episode_number===S.playerEp);
  const ep=S.playerEps[cur];
  el.textContent=ep?`S${S.playerSeason} · E${ep.episode_number}${ep.name?' — '+ep.name.slice(0,28):''}`:`S${S.playerSeason} · E${S.playerEp}`;
  if(document.getElementById('player-prev-btn'))document.getElementById('player-prev-btn').disabled=cur<=0;
  if(document.getElementById('player-next-btn'))document.getElementById('player-next-btn').disabled=cur>=S.playerEps.length-1;
}

/* ── Keyboard ── */
function initKeyboard(){
  document.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;
    if(S.page==='player'){
      if(e.code==='KeyN'){e.preventDefault();nextEpisode();}
      if(e.code==='KeyP'){e.preventDefault();prevEpisode();}
      if(e.code==='Escape')document.getElementById('player-ep-panel')?.classList.remove('open');
    }
    if(S.page==='discover'){
      if(e.code==='ArrowRight')discoverNext();
      if(e.code==='ArrowLeft')discoverPrev();
      if(e.code==='Enter')discoverWatch();
    }
    if(e.key==='Escape'&&S.searchOpen)closeSearch();
  });
}

window.addEventListener('scroll',()=>{
  document.getElementById('nav').classList.toggle('scrolled',window.scrollY>20);
},{passive:true});

/* ── PWA ── */
let _installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();_installPrompt=e;});
function showInstallBanner(){
  if(localStorage.getItem('wt_install_dismissed'))return;
  if(window.matchMedia('(display-mode: standalone)').matches)return;
  const banner=document.getElementById('install-banner');if(!banner)return;
  banner.classList.add('show');setTimeout(()=>banner.classList.remove('show'),5000);
}

/* ── Home auto-refresh ── */
setInterval(async()=>{
  if(S.page!=='home')return;
  const trending=await A.trending();
  if(!trending.length)return;
  const idx=Math.floor(Math.random()*Math.min(trending.length,10));
  const shuffled=[...trending.slice(idx),...trending.slice(0,idx)];
  setupHero(shuffled);
  const rail=document.getElementById('rail-trending');
  if(rail)fillRail(rail,A.trending,{ranked:true});
},5*60*1000);

/* ── Hash routing ── */
async function routeFromHash(){
  let hash=window.location.hash.slice(1);
  if(!hash||hash==='#')return;
  if(hash.startsWith('/'))hash=hash.slice(1);
  const parts=hash.split('/').filter(Boolean);
  const [section,typeOrId,id]=parts;
  if(!section)return;
  if(section==='title'&&typeOrId&&id){
    try{const data=await api(`/${typeOrId}/${id}`);if(data){data.media_type=typeOrId;setTimeout(()=>openTitlePage(data),400);}}catch(_){}
    return;
  }
  if((section==='movie'||section==='tv')&&typeOrId&&!isNaN(typeOrId)){
    try{const data=await api(`/${section}/${typeOrId}`);if(data){data.media_type=section;setTimeout(()=>openTitlePage(data),400);}}catch(_){}
    return;
  }
  if(['discover','mylist','movies','series'].includes(section)){
    setTimeout(()=>document.querySelector(`[data-page="${section}"]`)?.click(),300);
  }
}

/* ── Share card ── */
async function shareCard(item){
  showToast('Generating card…');
  const type=mtyp(item),title=ttl(item),year=yr(item);
  const score=item.vote_average?`${Math.round(item.vote_average*10)}%`:'';
  const overview=(item.overview||'').slice(0,120)+((item.overview?.length||0)>120?'…':'');
  const posterURL=item.poster_path?`${TMDB_IMG}/w500${item.poster_path}`:null;
  const W=1080,H=1350;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#09090B';ctx.fillRect(0,0,W,H);
  if(posterURL){
    try{
      const img=await new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=rej;i.src=posterURL;});
      ctx.save();const sc=Math.max(W/img.width,H/img.height);
      ctx.drawImage(img,(W-img.width*sc)/2,(H-img.height*sc)/2,img.width*sc,img.height*sc);ctx.restore();
      ctx.fillStyle='rgba(9,9,11,0.82)';ctx.fillRect(0,0,W,H);
      const ph=640,pw=ph*(2/3),px=(W-pw)/2,py=120;
      ctx.save();roundRect(ctx,px,py,pw,ph,18);ctx.clip();ctx.drawImage(img,px,py,pw,ph);ctx.restore();
    }catch(_){}
  }
  const gold='#C9A96E';
  const grd=ctx.createLinearGradient(0,0,W,0);
  grd.addColorStop(0,'rgba(201,169,110,0)');grd.addColorStop(.2,gold);grd.addColorStop(.8,gold);grd.addColorStop(1,'rgba(201,169,110,0)');
  ctx.fillStyle=grd;ctx.fillRect(0,0,W,4);
  ctx.font='300 38px Georgia,serif';ctx.fillStyle='#F2F1EC';ctx.textAlign='center';
  ctx.fillText('Watchy',W/2-12,72);ctx.fillStyle=gold;ctx.fillText('.',W/2+56,72);
  const bl=type==='tv'?'SERIES':'FILM';
  ctx.font='500 20px Outfit,system-ui,sans-serif';
  const bw=ctx.measureText(bl).width+32,bx=(W-bw)/2,by=820;
  ctx.fillStyle='rgba(201,169,110,0.14)';roundRect(ctx,bx,by,bw,36,6);ctx.fill();
  ctx.strokeStyle='rgba(201,169,110,0.4)';ctx.lineWidth=1;roundRect(ctx,bx,by,bw,36,6);ctx.stroke();
  ctx.fillStyle=gold;ctx.textAlign='center';ctx.fillText(bl,W/2,by+24);
  ctx.font='400 72px Georgia,serif';ctx.fillStyle='#F2F1EC';ctx.textAlign='center';
  const tl=wrapText(ctx,title,W-120);let ty=900;
  tl.slice(0,2).forEach(l=>{ctx.fillText(l,W/2,ty);ty+=84;});
  ctx.font='300 30px Outfit,system-ui,sans-serif';ctx.fillStyle='rgba(138,138,144,.85)';
  ctx.fillText([year,score].filter(Boolean).join('  ·  '),W/2,ty+10);ty+=56;
  ctx.font='300 26px Outfit,system-ui,sans-serif';ctx.fillStyle='rgba(138,138,144,.7)';
  wrapText(ctx,overview,W-160).slice(0,3).forEach(l=>{ctx.fillText(l,W/2,ty);ty+=36;});
  ctx.font='300 22px Outfit,system-ui,sans-serif';ctx.fillStyle='rgba(62,62,70,.9)';
  ctx.textAlign='left';ctx.fillText(window.location.hostname,52,H-44);
  ctx.textAlign='right';ctx.fillText('@arbw_13',W-52,H-44);
  ctx.fillStyle='rgba(201,169,110,.25)';ctx.fillRect(0,H-3,W,3);
  canvas.toBlob(async blob=>{
    const file=new File([blob],`watchy-${title.replace(/\s+/g,'-').toLowerCase()}.png`,{type:'image/png'});
    const movieUrl=`${window.location.origin}${window.location.pathname}#/title/${type}/${item.id}`;
    if(navigator.canShare?.({files:[file]})){
      try{await navigator.share({files:[file],title:`${title} on Watchy.`,text:`🎬 ${title} (${year})\n${movieUrl}`,url:movieUrl});return;}catch(_){}
    }
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();
    if(navigator.clipboard)navigator.clipboard.writeText(movieUrl).catch(()=>{});
    showToast('Image saved · Link copied');
  },'image/png');
}
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function wrapText(ctx,text,maxW){
  const words=text.split(' '),lines=[];let cur='';
  for(const w of words){const test=cur?cur+' '+w:w;if(ctx.measureText(test).width>maxW&&cur){lines.push(cur);cur=w;}else cur=test;}
  if(cur)lines.push(cur);return lines;
}
function copyTitleLink(){
  const url=window.location.href;
  if(navigator.clipboard)navigator.clipboard.writeText(url).then(()=>showToast('Link copied'));
  else{const el=document.createElement('input');el.value=url;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);showToast('Link copied');}
}

/* ══════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  const startPage=S.lastPage||'home';

  async function navTo(p){
    goTo(p);
    if(p==='movies'&&!S.moviesLoaded){
      S.moviesLoaded=true;S.moviesPage=1;S.moviesDone=false;
      const grid=document.getElementById('movies-grid');
      grid.innerHTML='<div class="card-sk" style="height:228px"></div>'.repeat(12);
      const [a,b]=await Promise.all([pagedfetch.movies(1),pagedfetch.nowPlaying(1)]);
      grid.innerHTML='';
      [...a,...b].filter((v,i,arr)=>arr.findIndex(x=>x.id===v.id)===i).forEach(item=>grid.appendChild(makeCard(item)));
      S.moviesPage=2;
      const sentinel=document.getElementById('movies-sentinel');
      if(sentinel)sentinel.style.display='block';
      initInfiniteScroll('movies-sentinel',async()=>{
        if(S.moviesLoading||S.moviesDone)return;
        S.moviesLoading=true;
        const more=await pagedfetch.movies(S.moviesPage);
        if(!more.length){S.moviesDone=true;document.getElementById('movies-sentinel').style.display='none';}
        else{more.forEach(item=>grid.appendChild(makeCard(item)));S.moviesPage++;}
        S.moviesLoading=false;
      });
    }
    if(p==='series'&&!S.seriesLoaded){
      S.seriesLoaded=true;S.seriesPage=1;S.seriesDone=false;
      const grid=document.getElementById('series-grid');
      grid.innerHTML='<div class="card-sk" style="height:228px"></div>'.repeat(12);
      const [a,b]=await Promise.all([pagedfetch.tv(1),pagedfetch.topTV(1)]);
      grid.innerHTML='';
      [...a,...b].filter((v,i,arr)=>arr.findIndex(x=>x.id===v.id)===i).forEach(item=>grid.appendChild(makeCard(item)));
      S.seriesPage=2;
      const sentinel=document.getElementById('series-sentinel');
      if(sentinel)sentinel.style.display='block';
      initInfiniteScroll('series-sentinel',async()=>{
        if(S.seriesLoading||S.seriesDone)return;
        S.seriesLoading=true;
        const more=await pagedfetch.tv(S.seriesPage);
        if(!more.length){S.seriesDone=true;document.getElementById('series-sentinel').style.display='none';}
        else{more.forEach(item=>grid.appendChild(makeCard(item)));S.seriesPage++;}
        S.seriesLoading=false;
      });
    }
    if(p==='mylist')refreshFavPage();
    if(p==='discover')initDiscover();
  }

  // Nav
  document.querySelectorAll('.nav-link[data-page]').forEach(l=>l.addEventListener('click',()=>navTo(l.dataset.page)));
  document.querySelectorAll('.bot-nav-item[data-page]').forEach(l=>l.addEventListener('click',()=>navTo(l.dataset.page)));
  document.getElementById('nav-logo').addEventListener('click',()=>goTo('home'));
  document.querySelectorAll('[data-goto]').forEach(el=>el.addEventListener('click',()=>navTo(el.dataset.goto)));
  // Hero
  document.getElementById('hero-mute-btn')?.addEventListener('click',toggleHeroMute);
  document.getElementById('hero-play-btn').addEventListener('click',()=>{const item=S.heroItems[S.heroIdx];if(item)openPlayer(item,mtyp(item));});
  document.getElementById('hero-info-btn').addEventListener('click',()=>{const item=S.heroItems[S.heroIdx];if(item)openTitlePage(item);});
  // Continue watching
  document.getElementById('continue-clear-btn')?.addEventListener('click',()=>{S.hist=[];S.prog={};save();refreshContRow();showToast('Cleared');});
  // Player
  document.getElementById('player-back-btn').addEventListener('click',()=>{stopPlayer();goTo(S.lastPage||'home',false,true);});
  document.getElementById('player-ep-toggle')?.addEventListener('click',()=>document.getElementById('player-ep-panel')?.classList.toggle('open'));
  document.getElementById('player-prev-btn')?.addEventListener('click',prevEpisode);
  document.getElementById('player-next-btn')?.addEventListener('click',nextEpisode);
  document.getElementById('pep-close')?.addEventListener('click',()=>document.getElementById('player-ep-panel')?.classList.remove('open'));
  document.getElementById('player-source-hint-btn')?.addEventListener('click',()=>{hideSourceHint();openSrcPanel();});
  document.getElementById('player-source-hint-close')?.addEventListener('click',hideSourceHint);
  // Title page
  document.getElementById('tp-back-btn')?.addEventListener('click',()=>goTo(S.titlePrevPage||'home',false,true));
  document.getElementById('tp-share-btn')?.addEventListener('click',()=>{if(S.titleItem)shareCard(S.titleItem);});
  document.getElementById('tp-copy-link-btn')?.addEventListener('click',copyTitleLink);
  // Person
  document.getElementById('person-back-btn')?.addEventListener('click',()=>{if(S.titleItem)openTitlePage(S.titleItem);else goTo(S.lastPage||'home',false,true);});
  // Trailer
  document.getElementById('trailer-close')?.addEventListener('click',closeTrailer);
  document.getElementById('trailer-backdrop')?.addEventListener('click',closeTrailer);
  // Discover
  document.getElementById('discover-next')?.addEventListener('click',discoverNext);
  document.getElementById('discover-prev')?.addEventListener('click',discoverPrev);
  document.getElementById('discover-watch')?.addEventListener('click',discoverWatch);
  document.getElementById('discover-fav')?.addEventListener('click',discoverToggleFav);
  document.querySelectorAll('.discover-genre-chip').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.discover-genre-chip').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');S_discoverGenre=btn.dataset.g||null;initDiscover();
    });
  });
  document.getElementById('discover-type-movie')?.addEventListener('click',()=>{
    S.discoverType='movie';
    document.querySelectorAll('.discover-type-btn').forEach(b=>b.classList.toggle('active',b.dataset.t==='movie'));
    initDiscover();
  });
  document.getElementById('discover-type-tv')?.addEventListener('click',()=>{
    S.discoverType='tv';
    document.querySelectorAll('.discover-type-btn').forEach(b=>b.classList.toggle('active',b.dataset.t==='tv'));
    initDiscover();
  });
  // Search
  document.getElementById('search-icon-btn').addEventListener('click',openSearch);
  document.getElementById('search-overlay-close')?.addEventListener('click',closeSearch);
  document.getElementById('search-overlay-backdrop')?.addEventListener('click',closeSearch);
  document.getElementById('search-overlay-input')?.addEventListener('input',e=>{handleSearchInput(e.target.value);clearSearchOnEmpty(e.target.value);});
  document.querySelectorAll('.search-filter-btn').forEach(b=>b.addEventListener('click',()=>setSearchFilter(b.dataset.f)));
  // Server panel
  buildServerSwitcher();
  document.getElementById('server-panel-toggle')?.addEventListener('click',toggleSrcPanel);
  document.getElementById('server-panel-close')?.addEventListener('click',closeSrcPanel);
  document.addEventListener('click',e=>{
    if(!e.target.closest('#src-panel')&&!e.target.closest('#server-panel-toggle'))closeSrcPanel();
  });
  document.getElementById('src-panel')?.addEventListener('keydown',e=>{
    if(e.key==='Escape')closeSrcPanel();
    const items=[...document.querySelectorAll('.server-opt')];
    const idx=items.indexOf(document.activeElement);
    if(e.key==='ArrowDown'){e.preventDefault();items[(idx+1)%items.length]?.focus();}
    if(e.key==='ArrowUp'){e.preventDefault();items[(idx-1+items.length)%items.length]?.focus();}
  });
  const srcBtn=document.getElementById('server-panel-toggle');
  const srcPanel=document.getElementById('src-panel');
  if(srcBtn&&srcPanel){
    new MutationObserver(()=>{
      srcBtn.setAttribute('aria-expanded',srcPanel.classList.contains('open').toString());
    }).observe(srcPanel,{attributes:true,attributeFilter:['class']});
  }
  // Setup
  setupGenres();initKeyboard();initDiscoverSwipe();
  // Boot
  goTo(startPage,true);
  if(startPage==='movies')navTo('movies');
  else if(startPage==='series')navTo('series');
  else if(startPage==='mylist')navTo('mylist');
  else if(startPage==='discover')navTo('discover');
  else loadHome();
  if(startPage!=='home')loadHome();
  if(window.location.hash)routeFromHash();
  // PWA
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  setTimeout(showInstallBanner,2000);
  document.getElementById('install-btn')?.addEventListener('click',async()=>{
    document.getElementById('install-banner')?.classList.remove('show');
    if(_installPrompt){_installPrompt.prompt();await _installPrompt.userChoice;_installPrompt=null;}
    else showToast('On Chrome: Menu → "Add to Home Screen"');
    localStorage.setItem('wt_install_dismissed','1');
  });
  document.getElementById('install-dismiss')?.addEventListener('click',()=>{
    document.getElementById('install-banner')?.classList.remove('show');
    localStorage.setItem('wt_install_dismissed','1');
  });
});
