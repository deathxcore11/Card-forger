// Table playmats: Randall's fourteen painted mats, each with its own light edge effects (play-forge-table.css). A player picks one,
// or gets a new one each match (never the same twice in a row). The choice is a look only; it never touches the game.
export const PLAYMATS=[['moonlit-courtyard','Moonlit Courtyard'],['white-sanctuary','White Sanctuary'],['ashen-forge','Ashen Forge'],['drowned-archive','Drowned Archive'],['black-ossuary','Black Ossuary'],['star-observatory','Star Observatory'],['forest-temple','Forest Temple'],['keldon-battlefield','Keldon Battlefield'],['wild-hedrons','Wild Hedrons'],['artifact-vault','Artifact Vault'],['innistrad-graveyard','Innistrad Graveyard'],['ravnica-guild-city','Ravnica Guild City'],['zendikar-expedition','Zendikar Expedition'],['charcoal-table','Charcoal Table']];
const CHOICE='cardstashy.playmat',LAST='cardstashy.playmat.last';
const store=()=>{try{return globalThis.localStorage||null;}catch{return null;}};
const get=(key,s)=>{try{return s?.getItem(key)||'';}catch{return '';}};
const set=(key,value,s)=>{try{s?.setItem(key,value);}catch{}};
const known=id=>PLAYMATS.some(([key])=>key===id);
export function readPlaymatChoice(s=store()){const v=get(CHOICE,s);return known(v)?v:'rotate';}
// Rotate -> each mat in turn -> rotate.
export function cyclePlaymatChoice(s=store()){const order=['rotate',...PLAYMATS.map(([id])=>id)],next=order[(order.indexOf(readPlaymatChoice(s))+1)%order.length];set(CHOICE,next,s);return next;}
export function nextPlaymat(s=store(),random=Math.random){
  const choice=readPlaymatChoice(s);if(choice!=='rotate'){set(LAST,choice,s);return choice;}
  const last=get(LAST,s),pool=PLAYMATS.map(([id])=>id).filter(id=>id!==last),pick=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
  set(LAST,pick,s);return pick;
}
export function playmatButtonMarkup(choice=readPlaymatChoice()){
  const name=choice==='rotate'?'New each match':PLAYMATS.find(([id])=>id===choice)[1];
  return `<button type="button" class="btn ghost play-playmat" data-act="playPlaymat" data-playmat="${choice}" aria-label="Playmat: ${name}. Tap to change."><span class="play-playmat-thumb" aria-hidden="true"></span><span><small>Playmat</small><b>${name}</b></span></button>`;
}
// Floating hedrons on the two Zendikar mats: cut-outs drawn over a clean painting, each bobbing on its own beat.
// [x, y, width, height] in % of the wide painting; the upright crop is the middle 529 of 1672 px, so it is derived.
const SPRITES={'wild-hedrons':[[6.28,52.18,5.02,8.18],[10.17,58.77,9.75,15.52],[92.4,12.65,5.02,9.14],[94.38,51.65,6.46,18.28],[36.24,-0.21,5.5,7.97],[26.44,5.74,3.53,6.59]],
  'zendikar-expedition':[[90.07,41.55,10.89,24.76],[91.39,17.11,4.37,8.93],[5.32,31.99,3.89,7.76],[16.63,1.17,3.41,7.76]]};
const TALL_X=571/1672*100,TALL_W=529/1672*100;
// The painted scene sits right behind the table (the table's root redraws its children, so the scene lives beside it).
export function mountPlaymatScene(root,doc=document){
  unmountPlaymatScene(doc);const id=root.getAttribute('data-playmat');if(!known(id))return null;
  const scene=doc.createElement('div'),stage=doc.createElement('div'),layer=cls=>{const el=doc.createElement('div');el.className=cls;stage.append(el);return el;};
  scene.className='playmat-scene';scene.dataset.playmat=id;scene.setAttribute('aria-hidden','true');stage.className='pm-stage';layer('pm-art');
  (SPRITES[id]||[]).forEach(([x,y,w,h],i)=>{const el=layer('pm-sprite'),tx=(x-TALL_X)/TALL_W*100,tw=w/TALL_W*100,size=Math.max(w,h/1.78);
    el.style.cssText=`--img:url(assets/play/playmat-${id}-hedron${i}.webp);--x:${x}%;--y:${y}%;--w:${w}%;--h:${h}%;--tx:${tx.toFixed(2)}%;--tw:${tw.toFixed(2)}%;--amp:${(2+size*.55).toFixed(1)}px;--bob:${(4.2+i*.9).toFixed(1)}s;--bob-at:-${(i*1.7).toFixed(1)}s`;
    if(tx+tw<0||tx>100)el.dataset.tallOff='true';});
  layer('pm-shade');layer('pm-glow');const motes=doc.createElement('div');motes.className='pm-motes';scene.append(stage,motes);root.after(scene);return scene;
}
export function unmountPlaymatScene(doc=document){doc.querySelector('.playmat-scene')?.remove();}
