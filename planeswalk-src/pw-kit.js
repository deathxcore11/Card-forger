/* Planeswalk painted kit in the game: the hero's mana symbol through the chrome and icons on event choices. The look itself is kit.css; this file only adds what CSS can't. */
(()=>{
 const app=document.getElementById('app');if(!app)return;
 const M=window.PW_MANA||{};
 // the kit reads --pwk-mana: the hero's symbol, or a given colour's on .pwk-mana[data-c]
 const st=document.createElement('style');st.id='pw-kit-mana';
 st.textContent=`:root{--pwk-mana:url(${M.R})}body[data-hero=W]{--pwk-mana:url(${M.W})}`+'RWBUG'.split('').map(k=>M[k]?`.pwk-mana[data-c=${k}]{--pwk-mana:url(${M[k]})}`:'').join('');
 document.head.append(st);
 const G=k=>{try{return eval(k)}catch{return undefined}};
 // event choices get an icon: walking on is a back arrow, burning is the pyre, the rest wear the hero's mana
 const ICON={leave:'<span class="pwk-back"></span>',burn:'pyre',remove:'pyre',heal:'heart',bandage:'heart',bless:'heart',tend:'drop',blood:'drop',loot:'plus',dig:'star',hedron:'cycle',purify:'ban',sac:'skull',take:'plus',claim:'plus'};
 const ring=k=>typeof ico==='function'&&typeof PWI!=='undefined'&&PWI[k]?`<span class="ev-ring">${ico(k)}</span>`:'<span class="ev-ring"></span>';
 function evIcons(){for(const o of app.querySelectorAll('.screen.event .option:not(:has(>.emb-art,>svg,>.ev-ic))')){const k=ICON[o.dataset.act];const i=document.createElement('span');i.className='ev-ic';i.setAttribute('aria-hidden','true');
  i.innerHTML=k==='pyre'&&window.PW_EMB_ART?.html?PW_EMB_ART.html('pyre'):k&&k.startsWith('<')?k:ring(k||'star');o.prepend(i)}
  /* 4.3.46: event titles are gold lettering over the painting (StS 2 events), not a ribbon */}
 function tick(){const v=G('view');
  if(v==='event')evIcons()}
 let q=0;new MutationObserver(()=>{if(!q){q=1;requestAnimationFrame(()=>{q=0;tick()})}}).observe(app,{childList:true,subtree:true});tick();
})();
