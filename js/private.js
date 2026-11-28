/* Private section: adult-flagged titles live only here. Open: tap the Watchy wordmark 5 times. */
(function(){
  const KEY=typeof TMDB_KEY!=='undefined'?TMDB_KEY:'',BASE=typeof TMDB_BASE!=='undefined'?TMDB_BASE:'';
  const $=(s,r=document)=>r.querySelector(s);
  const el=(h)=>{const d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild};
  async function hash(s){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('wy|'+s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(_){let h=5381;for(const c of s)h=((h<<5)+h+c.charCodeAt(0))|0;return 'x'+h}}
  async function raw(path,params){
    const u=new URL(BASE+path);u.searchParams.set('api_key',KEY);u.searchParams.set('language','en-US');u.searchParams.set('include_adult','true');
    Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));
    try{const r=await fetch(u);if(!r.ok)return null;return await r.json()}catch(_){return null}
  }
  /* ---- tap counter ---- */
  let taps=[];
  document.addEventListener('click',e=>{
    if(!e.target.closest('#nav-logo'))return;
    const n=Date.now();taps=taps.filter(t=>n-t<3000);taps.push(n);
    if(taps.length>=5){taps=[];openGate()}
  },true);
  /* ---- gate ---- */
  function modal(html){
    const m=el(`<div class="pv-modal"><div class="pv-box">${html}</div></div>`);
    document.body.appendChild(m);return m;
  }
  const PIN_HASH='d73970054d703aaef6aeaf1d4d8c30fd1372189a1871d6eae92894db2bff8803';
  async function openGate(){
    if($('.pv-modal')||$('#pv-overlay'))return;
    const m=modal(`<h3>Private</h3><p>Adults only (18+). Enter your PIN to continue.</p><input class="pv-in" type="password" inputmode="numeric" maxlength="12" placeholder="PIN"><div class="pv-err"></div><div class="pv-row"><button class="pv-b" data-x="no">Cancel</button><button class="pv-b gold" data-x="ok">I am 18+, open</button></div>`);
    const inp=$('input',m),go=async()=>{if(await hash(inp.value.trim())===PIN_HASH){m.remove();openOverlay()}else{$('.pv-err',m).textContent='Wrong PIN';inp.value=''}};
    m.addEventListener('click',e=>{const b=e.target.closest('[data-x]');if(b)b.dataset.x==='no'?m.remove():go();else if(e.target===m)m.remove()});
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')go()});setTimeout(()=>inp.focus(),50);
  }
  /* ---- overlay ---- */
  let page=0,mode='feed',query='',busy=false,seen=new Set();
  function openOverlay(){
    const o=el(`<div id="pv-overlay"><div class="pv-top"><div class="pv-title">Private</div><input class="pv-search" placeholder="Search" autocomplete="off"><button class="pv-x" aria-label="Close">Close</button></div><div class="pv-grid"></div><div class="pv-empty"></div><button class="pv-more">Load more</button></div>`);
    document.body.appendChild(o);document.body.style.overflow='hidden';
    const close=()=>{o.remove();document.body.style.overflow=''};
    $('.pv-x',o).onclick=close;
    o.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    const grid=$('.pv-grid',o),empty=$('.pv-empty',o),more=$('.pv-more',o),inp=$('.pv-search',o);
    page=0;seen=new Set();mode='feed';query='';
    const reset=()=>{grid.innerHTML='';empty.textContent='';page=0;seen=new Set();load()};
    let tm;inp.addEventListener('input',()=>{clearTimeout(tm);tm=setTimeout(()=>{query=inp.value.trim();mode=query?'search':'feed';reset()},400)});
    more.onclick=load;
    async function load(){
      if(busy)return;busy=true;more.disabled=true;empty.textContent='Loading';
      let found=0;
      for(let k=0;k<4&&found<8;k++){
        page++;
        const reqs=mode==='search'
          ?[raw('/search/multi',{query,page})]
          :[raw('/discover/movie',{sort_by:'vote_count.asc',page}),raw('/discover/tv',{sort_by:'vote_count.asc',page})];
        const res=await Promise.all(reqs);
        res.forEach((d,i)=>(d&&d.results||[]).forEach(it=>{
          if(!it.adult||it.media_type==='person')return;
          if(!it.media_type)it.media_type=(mode==='feed'&&i===1)?'tv':'movie';
          const id=it.media_type+it.id;if(seen.has(id))return;seen.add(id);
          if(typeof makeCard==='function'){grid.appendChild(makeCard(it,{hideNewBadge:true}));found++}
        }));
        if(res.every(d=>!d||page>=(d.total_pages||1)))break;
      }
      busy=false;more.disabled=false;
      empty.textContent=grid.children.length?'':'Nothing found. Only titles flagged adult by TMDB show up here.';
    }
    load();
  }
  /* open the title, hide overlay behind it */
  document.addEventListener('click',e=>{const c=e.target.closest('#pv-overlay .card');if(c&&!e.target.closest('.card-fav')){const o=$('#pv-overlay');if(o){o.remove();document.body.style.overflow=''}}},true);
})();
