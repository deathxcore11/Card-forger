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
// Scene effects drawn over the painting (the glow comes in two halves that flicker out of step, so candles never blink together), in painting pixels (1672x941): floating hedron cut-outs on the two Zendikar mats,
// soft halos on moons, orbs and the sun, sparkle crossfades cut from the art (moonlit waves, stars, lava rivers, city lights),
// and slow cloud drift across distant skies. The upright crop is the middle 529 px, so its positions are derived.
const HEDRONS={'wild-hedrons':[[113,490,68,79],[186,551,132,149],[1553,118,68,88],[1588,484,88,176],[615,-3,74,77],[448,53,48,63]],
  'zendikar-expedition':[[1523,389,147,237],[1535,160,59,85],[96,301,52,74],[284,11,46,74]]};
const HALOS={'drowned-archive':[[990,26,70,'#dfe8ff']],'moonlit-courtyard':[[995,30,62,'#e6ecff']],'innistrad-graveyard':[[965,31,66,'#e6ecff']],'artifact-vault':[[990,30,64,'#e8eeff']],
  'star-observatory':[[98,48,34,'#d8dcff'],[150,872,110,'#7d9cff'],[1468,882,92,'#7d9cff'],[332,30,52,'#8fa8ff'],[1305,22,46,'#8fa8ff'],[1555,60,60,'#c9a8ff'],[835,30,60,'#f3e2b8'],[835,880,60,'#f3e2b8']],
  'white-sanctuary':[[1040,32,120,'#ffe6a8']],'ashen-forge':[[965,26,90,'#ff7a2a']]};
const SPARKLES={'drowned-archive':[[600,58,625,87]],'star-observatory':[[0,0,175,360],[1495,0,177,720],[600,0,480,140],[600,800,480,141]],'ashen-forge':[[690,0,540,112]],'ravnica-guild-city':[[560,0,770,95]]};
const CLOUDS={'drowned-archive':[[600,40,625,70]],'moonlit-courtyard':[[500,0,760,70]],'innistrad-graveyard':[[640,60,420,90]],'artifact-vault':[[640,40,480,90]],'white-sanctuary':[[640,50,520,100]],'ashen-forge':[[700,0,520,70]]};
const pct=(x,y,w,h)=>{const tx=(x-571)/529*100,tw=w/529*100;return `--x:${(x/16.72).toFixed(2)}%;--y:${(y/9.41).toFixed(2)}%;--w:${(w/16.72).toFixed(2)}%;--h:${(h/9.41).toFixed(2)}%;--tx:${tx.toFixed(2)}%;--tw:${tw.toFixed(2)}%`;};
const offTall=(x,w)=>x+w<571||x>1100;
// The painted scene sits right behind the table (the table's root redraws its children, so the scene lives beside it).
export function mountPlaymatScene(root,doc=document){
  unmountPlaymatScene(doc);const id=root.getAttribute('data-playmat');if(!known(id))return null;
  const scene=doc.createElement('div'),stage=doc.createElement('div'),layer=(cls,box,extra='')=>{const el=doc.createElement('div');el.className=cls;if(box){el.style.cssText=pct(...box)+extra;if(offTall(box[0],box[2]))el.dataset.tallOff='true';}stage.append(el);return el;};
  scene.className='playmat-scene';scene.dataset.playmat=id;scene.setAttribute('aria-hidden','true');stage.className='pm-stage';layer('pm-art');
  (CLOUDS[id]||[]).forEach(box=>layer('pm-cloud',box).append(doc.createElement('i')));
  (HEDRONS[id]||[]).forEach((box,i)=>layer('pm-sprite',box,`;--img:url(assets/play/playmat-${id}-hedron${i}.webp);--bob:${(6+i*.8).toFixed(1)}s;--bob-at:-${(i*1.9).toFixed(1)}s`));
  layer('pm-shade');layer('pm-glow');layer('pm-glow pm-glow-b');
  (SPARKLES[id]||[]).forEach((box,i)=>{for(const half of ['a','b'])layer('pm-sparkle',box,`;--img:url(assets/play/playmat-${id}-tw${i}${half}.webp)`).dataset.half=half;});
  (HALOS[id]||[]).forEach(([x,y,r,color],i)=>layer('pm-halo',[x-r,y-r,r*2,r*2],`;--halo:${color};--pulse:${(5+i*.7).toFixed(1)}s;--pulse-at:-${(i*1.3).toFixed(1)}s`));
  const motes=doc.createElement('div');motes.className='pm-motes';scene.append(stage,motes);root.after(scene);return scene;
}
export function unmountPlaymatScene(doc=document){doc.querySelector('.playmat-scene')?.remove();}
