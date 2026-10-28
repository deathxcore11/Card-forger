// Table playmats: Randall's painted mats (six originals plus the seven Old School mats). A player picks one, or gets a new one each
// match (never the same twice in a row). The choice is a look only; it never touches the game.
export const PLAYMATS=[['moonlit-courtyard','Moonlit Courtyard'],['ashen-forge','Ashen Forge'],['star-observatory','Star Observatory'],['forest-temple','Forest Temple'],['gothic-stone','Gothic Stone'],['hedron-garden','Hedron Garden'],['ruined-shrine','Ruined Shrine'],['ancient-coast','Ancient Coast'],['forgotten-graves','Forgotten Graves'],['volcanic-plain','Volcanic Plain'],['ancient-woods','Ancient Woods'],['haunted-chapel','Haunted Chapel'],['sky-ruins','Sky Ruins']];
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
