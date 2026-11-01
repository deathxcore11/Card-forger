// Two-piece click matrix: engines make resources, payoffs multiply them.
const ENG=['surge','spark','signet','contract','legion','font','embers','hearth'],PAY=['furnace','twin','paradox','season','horde','monument','pyre'];
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const s0=html.indexOf('<script id="pw-game">')>=0?html.indexOf('<script id="pw-game">')+21:html.indexOf('<script>')+8;const src=html.slice(s0,html.indexOf('</script>',s0));// the game script, by id (the boot veil's script comes first)
const N=+process.argv[3]||300;const POL=process.argv[4]||'any';
const BIG=new Set(['giant','brute','marauder','dasher','hauler','glory','shivan','fireball','guide','king']);
const ctx={console,Math,JSON,Object,Array,String,Number,structuredClone,Map,Set,setTimeout:f=>f(),document:{getElementById:()=>({innerHTML:'',addEventListener(){}})}};
ctx.PW_FORM=process.env.FORM==='0'?0:1;ctx.PW_FEAT={sig:process.env.SIG==='0'?0:1,ante:process.env.ANTE==='0'?0:1,dun:process.env.DUN==='0'?0:1};ctx.PW_DMG={};ctx.PW_HEADLESS=1;if(process.env.SPARK!=null)ctx.PW_SPARK=+process.env.SPARK;/* Spark level gate runs: SPARK=0|5|10 */for(const k of ['PW_FIGS','PW_CARDART','PW_UIART']){const m=html.match(new RegExp('window\\.'+k+'=(\\[.*?\\]);'));if(m)ctx[k]=JSON.parse(m[1])}/* mirror what ships: art-gated rows stay out */if(process.env.BELT)ctx.PW_UIART=[...(ctx.PW_UIART||[]),...['treasure','food','clue','blood','map','powerstone','monster','younghero','gold','incubator','shard'].map(k=>'tok-'+k)];if(process.env.TRAIL)ctx.PW_TRAIL=+process.env.TRAIL;if(process.env.FIGHT)ctx.PW_FIGHT=JSON.parse(process.env.FIGHT);ctx.PW_SOAK={};if(process.env.AT)ctx.PW_AT=+process.env.AT;if(process.env.TRB)ctx.PW_TR=1;if(process.env.DL)ctx.PW_DL=+process.env.DL;if(process.env.DR)ctx.PW_DR=+process.env.DR;if(process.env.DH)ctx.PW_DH=+process.env.DH;if(process.env.DS)ctx.PW_DS=+process.env.DS;if(process.env.FOEHP)ctx.PW_FOEHP=+process.env.FOEHP;
vm.createContext(ctx);
vm.runInContext(src+`;globalThis.G={get run(){return run},get c(){return c},get view(){return view},get reward(){return reward},set view(v){view=v},set reward(v){reward=v},
 newRun,enter,anteFight,startFight,DUN,nextAct,open,play,attack,ability,endTurn,canPlay,ready,alive,pow,tough,costOf,C,E,EMB,toMap:()=>toMap(),heal,mk,evChoice,get POOL(){return POOL},bombard,forecast,PRICE,intentOf,useToken,TOKENS,exN};`,ctx);
const G=ctx.G;
const stats={wins:0,deaths:{},fights:[],turns:[],errors:[],killers:{},hpAtBoss:[],bossWins:0,bossTries:0,picks:{}};
// Draft like a player chasing an engine: rarity plus synergy with what the deck already has.
const GOB=new Set(['titan','king','warchief','mob','tremors','krenko','guide','rgoblin','piker','hauler','fanatic','snipe','bombard']);
const WIDE=new Set(['thune','alarm','knight','charge','anthem','cathars','marshal','warden','pguard','vanguard']),FLY=new Set(['akroma','eagle','overseer','hawk','serra','baneslayer','heroism','pridemate','stance','banish']);
const SPELL=new Set(['ambush','ignition','snipe','pyro','grape','rite','mana','impulse','bolt','shock','cannon','brute','fireball']);
function draftScore(k){const deck=G.run.deck.map(d=>d.key);const r={M:4,R:3,U:2,C:1,S:0}[G.C[k].r];
 const gob=deck.filter(x=>['king','warchief','mob','tremors','bombard'].includes(x)).length, sp=deck.filter(x=>['snipe','pyro','grape'].includes(x)).length+(G.run.emblems.includes('twin')?1:0);
 if(POL==='goblins')return r+(GOB.has(k)?3+gob:-2);if(POL==='spells')return r+(SPELL.has(k)?3+sp:-2);if(POL==='big')return r+(BIG.has(k)?3:-2);if(POL==='wide')return r+(WIDE.has(k)?3:-2);if(POL==='flyers')return r+(FLY.has(k)?3:-2);
 return r+(GOB.has(k)?gob*1.5:0)+(SPELL.has(k)?sp*1.5:0)}
// Careful bot (CAREFUL=1): burn kills the enemy whose shown attack hurts most, and allies stay home to block
// unless their swing kills something or costs no blocking.
const CAREFUL=process.env.CAREFUL==='1';
const threat=e=>{const [t,v]=G.intentOf(e);return e.pacified?0:t==='atk'||t==='annihilate'?v+e.buff:t==='drain'?v:t==='summon'?2:0};
function bestTarget(n){if(CAREFUL){const k=G.alive().filter(e=>e.hp<=n&&!e.shield).sort((x,y)=>threat(y)-threat(x))[0];if(k&&threat(k)>0)return k}const a=G.alive();const k=a.filter(e=>e.hp<=n).sort((x,y)=>y.hp-x.hp)[0];return k||a.sort((x,y)=>x.hp-y.hp)[0]}
function attackPhase(c){
  // attack: only when the attacker kills, survives, or flies over
  for(const a of [...c.allies]){if(G.view!=='battle')return;if(!c.allies.includes(a)||!G.ready(a))continue;
   const p=G.pow(a)+(a.raid||0);const t=G.alive().find(e=>e.hp<=p)||G.alive().sort((x,y)=>x.hp-y.hp)[0];if(!t)break;
   const tt=CAREFUL?(G.alive().filter(e=>e.hp<=p).sort((x,y)=>threat(y)-threat(x))[0]||t):t;
   let safe=(a.flying&&!tt.fly)||tt.pow<G.tough(a)-a.dmg||tt.hp<=p||a.name==='Goblin token'||a.name==='Elemental'||c.allies.length>=4||c.turn>12;
   if(CAREFUL&&safe&&tt.hp>p&&c.turn<=12){const f0=G.forecast().you;a.tapped=true;const f1=G.forecast().you;a.tapped=false;if(f1>f0)safe=false}
   if(safe)G.attack(a,tt)}
}
function battle(){
 const c=G.c;let guard=0;stats._t=0;stats._min=G.run.hp;
 while(G.view==='battle'&&guard++<60){
  const c=G.c;stats._t=Math.max(stats._t,c.turn);stats._min=Math.min(stats._min,G.run.hp);
  // tokens: a simple use-it policy (heal when low, mana when a card is one short, draw any time, roles on the best ally)
  for(let ti=0;ti<4&&G.run.belt&&G.run.belt.length&&G.view==='battle';ti++){const B=G.run.belt;let used=false;for(let i=0;i<B.length;i++){const k=B[i],hp=G.run.hp/G.run.max,short=c.hand.some(h=>!G.canPlay(h)&&G.costOf(h)!=='X'&&G.costOf(h)===c.energy+1);
    const go=k==='food'?hp<.55:k==='treasure'||k==='gold'?short:k==='clue'||k==='blood'?c.hand.length<6:k==='powerstone'?c.hand.some(h=>G.C[h.key].ally):k==='monster'||k==='younghero'?c.allies.length>0:k==='map'?G.alive().length>1:k==='incubator'?c.energy>=3&&!c.hand.some(h=>G.canPlay(h)):k==='shard'?(c.exile||[]).length>0:false;
    if(go){const t=G.TOKENS[k].aim==='ally'?[...c.allies].sort((a,b)=>G.pow(b)-G.pow(a))[0]:G.TOKENS[k].aim==='enemy'?[...G.alive()].sort((a,b)=>threat(b)-threat(a))[0]:undefined;G.useToken(i,t);stats.tokUsed=(stats.tokUsed||0)+1;used=true;break}}if(!used)break}
  for(const h of c.hand)if(G.C[h.key].exile)(c._exSeen=c._exSeen||new Set()).add(h.id);
  // play cards: creatures first, then spells (Paradox: swing first, untap on each spell)
  if(G.run.emblems.includes('paradox'))attackPhase(c);
  let played=true;
  while(played&&G.view==='battle'&&G.c===c){played=false;
   const hand=c.hand.map((h,i)=>({h,i,d:G.C[h.key]})).filter(x=>G.canPlay(x.h));
   const pr=x=>x.h.key==='rite'||x.h.key==='mana'?0:x.h.key==='impulse'?1:x.d.ally?2:x.h.key==='grape'?9:x.d.e==='X'?8:5;
   hand.sort((a,b)=>pr(a)-pr(b));
   if(hand.some(x=>x.h.key==='grape')&&hand.length>1&&hand[0].h.key==='grape')hand.push(hand.shift());
   for(const x of hand){
    if(x.d.e==='X'&&c.energy<2)continue;
    if(x.h.key==='grape'&&hand.filter(y=>y.h.key!=='grape').length>0)continue;
    if(x.h.key==='cannon'&&G.alive().length<2&&hand.length>1)continue;
    let t=null;
    if(x.d.aim==='enemy')t=bestTarget(x.h.key==='bolt'?4:3);
    if(x.h.key==='ambush'){const sw=G.alive().filter(e=>{const [k]=G.intentOf(e);return k==='atk'||k==='annihilate'});if(!sw.length)continue;const bd=x.h.foil?5:4;t=CAREFUL?(sw.filter(e=>e.hp+(e.shield||0)<=bd).sort((a,b)=>threat(b)-threat(a))[0]||sw.sort((a,b)=>threat(b)-threat(a))[0]):sw[0]}
    if(x.d.aim==='ally')t=c.allies.find(a=>G.ready(a))||c.allies[0];
    if(x.d.exile)(c._exPlayed=c._exPlayed||new Set()).add(x.h.id);G.play(x.i,t);played=true;if(G.run.emblems.includes('paradox')&&!x.d.ally&&G.view==='battle')attackPhase(c);break;
   }
  }
  if(G.view!=='battle')break;
  if(!c.used&&c.loyalty>=6&&(c.kind!=='fight'||G.alive().length>=3))G.ability('ult');
  if(!c.used){if((process.env.HERO==='W')?(c.loyalty>=3&&c.allies.length>=3):(c.loyalty>=3&&G.alive().length>=2&&c.kind==='fight'))G.ability(true);else G.ability(false,(()=>{if(CAREFUL){const n=G.run.emblems.includes('pyre')?6:4;const k=G.alive().filter(e=>{const [t]=G.intentOf(e);return (t==='atk'||t==='annihilate')&&e.hp+(e.shield||0)-(e.brand||0)<=n}).sort((a,b)=>threat(b)-threat(a))[0];if(k)return k}return bestTarget(2)})())}
  if(G.view!=='battle')break;
  attackPhase(c);
  if(G.view!=='battle')break;
  if(c.bombard){const F=G.forecast();for(const a of [...c.allies]){if(G.view!=='battle')break;const t=G.alive().find(e=>e.hp<=c.bombard)||(F.dead.has(a.id)?G.alive()[0]:null);if(t&&(F.dead.has(a.id)||a.name==='Goblin token'||a.name==='Elemental'))G.bombard(a,t)}}
  if(G.view!=='battle')break;
  if(CAREFUL&&process.env.FORM!=='0'&&G.c){const c2=G.c;c2.allies.forEach(x=>{x.guard=null});const free=c2.allies.filter(x=>!x.tapped&&!x.noblock&&x.dmg<G.tough(x));
   const atk=G.alive().filter(e=>{const [t]=G.intentOf(e);return (t==='atk'||t==='annihilate')&&!e.pacified}).map(e=>({e,n:G.intentOf(e)[1]+e.buff})).sort((x,y)=>y.n-x.n);
   for(const {e,n} of atk){const ok=x=>free.includes(x)&&(!e.fly||x.flying||x.reach);const room=x=>G.tough(x)-x.dmg;const tr=G.E[e.key].trample;
    const b=free.filter(x=>ok(x)&&room(x)>n).sort((x,y)=>room(x)-room(y))[0]||(tr?free.find(x=>ok(x)&&x.steadfast):free.filter(x=>ok(x)&&!/token$/.test(x.name)).sort((x,y)=>G.pow(x)-G.pow(y))[0]);
    if(b){b.guard=e.id;free.splice(free.indexOf(b),1)}}}
  else if(process.env.FORM!=='0'&&G.c&&G.c.allies.length>1){const can=x=>!x.tapped&&!x.noblock&&x.dmg<G.tough(x);const b=G.c.allies.filter(can).sort((x,y)=>(G.tough(x)-x.dmg)-(G.tough(y)-y.dmg)).pop();if(b)G.c.allies=G.c.allies.filter(x=>x!==b).concat(b)}
  const h0=G.run.hp;G.endTurn();stats._min=Math.min(stats._min,G.run.hp);stats.eT=(stats.eT||0)+1;if(G.run.hp>=h0)stats.clean=(stats.clean||0)+1;else stats.lost=(stats.lost||0)+(h0-Math.max(0,G.run.hp));if((G.run.act||1)===1){stats.eT1=(stats.eT1||0)+1;if(G.run.hp<h0)stats.lost1=(stats.lost1||0)+(h0-Math.max(0,G.run.hp));}
 }
 if(guard>=60)stats.errors.push('stuck battle seed '+G.run.seed);
 stats.exSeen=(stats.exSeen||0)+((c._exSeen&&c._exSeen.size)||0);stats.exPlayed=(stats.exPlayed||0)+((c._exPlayed&&c._exPlayed.size)||0);if(G.reward&&G.reward.tok)stats.tokGot=(stats.tokGot||0)+1;
 return guard;
}
function check(where){const r=G.run;if(!Number.isFinite(r.hp))stats.errors.push('NaN hp '+where);
 if(G.c){if(G.c.allies.length>12)stats.errors.push('allies>12');for(const a of G.c.allies)if((a.attacks||0)>2)stats.errors.push('attacks>2 '+a.name);for(const a of G.c.allies)if(!Number.isFinite(G.pow(a))||!Number.isFinite(G.tough(a)))stats.errors.push('NaN ally '+a.name);for(const e of G.c.enemies)if(!Number.isFinite(e.hp))stats.errors.push('NaN enemy '+e.name);}}
for(let s=+(process.env.S0||1);s<=N;s++){if(process.env.TRACE)console.error("seed",s);
 try{
 G.newRun(s,process.env.HERO||'R');let steps=0,lastKind='',runBroken=false,sawRare=false,runDun=0,runAnte=0,runSig=[];
 while(steps++<200&&G.view!=='over'&&G.view!=='victory'){
  const v=G.view,r=G.run;if(process.env.STEPT)console.error("step",steps,v,G.c?G.c.kind+" r"+(G.c.room||"")+" t"+G.c.turn:"");
  if(process.env.FORCE&&r&&r.fights>=1&&!r.forced){r.forced=1;for(const F of process.env.FORCE.split(',')){if(G.EMB[F]&&!r.emblems.includes(F))r.emblems.push(F);if(G.C[F])r.deck.push(G.mk(F));if(F==='contract'){r.max-=4;r.hp=Math.min(r.hp,r.max)}}}
  if(v==='map'){const opts=[];for(let row=0;row<8;row++)for(let l=0;l<3;l++)if(G.open(row,l))opts.push([row,l]);
   if(!opts.length){stats.errors.push('no open node seed '+s);break}
   const low=r.hp<r.max*.5;const score=([row,l])=>{if(row===7)return 0;const t=r.map[row][l];return t==='rest'?(low?-5:2):t==='elite'?(low?6:-1):t==='dungeon'?(r.hp>r.max*(CAREFUL?.6:.75)?-2:7):t==='event'?1:0};
   opts.sort((a,b)=>score(a)-score(b));const [row,l]=opts[0];lastKind=row===7?'boss':r.map[row][l];
   if(lastKind==='boss'){(stats['goldBoss'+(r.act||1)]=stats['goldBoss'+(r.act||1)]||[]).push(r.gold);stats.bossTries++;stats.rareBeforeBoss=(stats.rareBeforeBoss||0)+(sawRare?1:0);stats.hpAtBoss.push(r.hp);(stats.goldAtBoss=stats.goldAtBoss||[]).push(r.gold)}
   if(lastKind==='dungeon'){stats.dunIn=(stats.dunIn||0)+1;runDun=1;r.dunHp=r.hp}if(lastKind==='elite')stats.eliteN=(stats.eliteN||0)+1;
   G.enter(row,l);
  }else if(v==='battle'){const t0=G.c.turn;const kinds=G.c.enemies.map(e=>e.key).join('+');const hpB=G.run.hp,kd=G.c.kind,bk=kd==='boss'||kd==='elite'?G.c.enemies[0].key:'';battle();stats.turns.push(G.c?.turn||0);{const P=stats.P=stats.P||{};const o=P[kd]=P[kd]||{n:0,w:0,t:0,doom:0,lost:0};o.n++;if(G.view!=='over')o.w++;const T=Math.max(stats._t,G.c?.turn||0);o.t+=T;if(T>=(kd==='boss'?9:8))o.doom++;o.lost+=(hpB-Math.max(0,Math.min(stats._min,G.run.hp)))/G.run.max;if(bk){const B=stats.B=stats.B||{};const q=B[bk]=B[bk]||[0,0];q[0]++;if(G.view!=='over')q[1]++}}if(G.view!=="over"&&(G.c?.turn||9)<=2&&!/^(fight)$/.test(G.c?.kind))runBroken=true;if(kinds==='sorin'&&G.view==='victory'){stats.bossT=(stats.bossT||[]);stats.bossT.push(G.c.turn)}if(G.view==='over')stats.killers[kinds]=(stats.killers[kinds]||0)+1;if(G.c&&G.c.kind==='elite'){const w=G.view!=='over',key=G.c.ante?'eA':'eN';stats[key]=stats[key]||[0,0];stats[key][0]++;if(w)stats[key][1]++}}
  else if(v==='ante'){const A=G.reward.ante;stats.anteOff=(stats.anteOff||0)+1;const ok=process.env.ANTEBOT!=='never'&&r.hp>=r.max*(CAREFUL?.65:.8);
   if(ok){const w=[...r.deck].sort((a,b)=>draftScore(a.key)-draftScore(b.key))[0];stats.anteAcc=(stats.anteAcc||0)+1;runAnte++;G.anteFight(w)}else G.startFight([A.k],'elite',A.depth)}
  else if(v==='reward'){const rw=G.reward;if(rw.sig){stats.sigOff=(stats.sigOff||0)+1;if(rw.sig.fb)stats.sigFb=(stats.sigFb||0)+1}if(rw.anteRes&&rw.embs.length){stats.anteRes=stats.anteRes||[0,0];stats.anteRes[0]++;if(rw.anteRes.r==='won')stats.anteRes[1]++}if(rw.dungeon&&rw.embs.length){stats.dunDone=(stats.dunDone||0)+1;(stats.dunLoss=stats.dunLoss||[]).push(((r.dunHp||r.hp)-r.hp)/r.max*100)}if(rw.cards&&rw.cards.some(k=>G.C[k].r==='R'||G.C[k].r==='M'))sawRare=true;if(rw.embs.length){const e=rw.embs.find(k=>G.EMB[k].r==='M')||rw.embs.find(k=>G.EMB[k].r)||rw.embs[0];G.run.emblems.push(e);rw.embs=[]}else{const ds=k=>draftScore(k)+(rw.sig&&rw.sig.foil&&k===rw.sig.k?+(process.env.FB||1):0);const k=[...rw.cards].sort((a,b)=>ds(b)-ds(a))[0];if(rw.sig&&k===rw.sig.k){stats.sigPick=(stats.sigPick||0)+1;runSig.push(k)}stats.picks[k]=(stats.picks[k]||0)+1;{const cd=G.mk(k);if(rw.sig&&rw.sig.foil&&k===rw.sig.k)cd.foil=true;G.run.deck.push(cd)}G.toMap()}}
  else if(v==='rest'&&(r.act||1)>=2&&r.deck.some(d=>d.key==='doubt')){r.deck.find(d=>d.key==='doubt').key='clarity';G.toMap()}
  else if(v==='rest'&&r.hp>=r.max*.7&&r.deck.some(d=>d.key==='doubt')){const i=r.deck.findIndex(d=>d.key==='doubt');r.deck.splice(i,1);stats.restBurn=(stats.restBurn||0)+1;G.toMap()}
  else if(v==='rest'){if(r.hp<r.max*.7){r.hp=Math.min(r.max,r.hp+Math.round(r.max*.3))}else{const x=r.deck.find(d=>!d.foil&&G.C[d.key].ally)||r.deck.find(d=>!d.foil);if(x)x.foil=true}G.toMap()}
  else if(v==='shop'){const sh=G.reward.shop;const order=[...sh.cards].sort((a,b)=>({M:-1,R:0,U:1,C:2}[G.C[a.k].r])-({M:-1,R:0,U:1,C:2}[G.C[b.k].r]));
   order.sort((a,b)=>draftScore(b.k)-draftScore(a.k));for(const x of order){if(G.C[x.k].r!=='C'&&r.gold>=x.price&&!x.sold){r.gold-=x.price;x.sold=true;r.deck.push(G.mk(x.k));stats.picks[x.k]=(stats.picks[x.k]||0)+1}}
   if(r.gold>=sh.remove.price){const w=r.deck.find(d=>d.key==='rgoblin')||r.deck.find(d=>d.key==='shock')||r.deck.find(d=>d.key==='doubt')||r.deck.find(d=>d.key==='vanguard')||r.deck.find(d=>d.key==='salve');if(w){r.gold-=sh.remove.price;r.removed=(r.removed||0)+1;r.deck=r.deck.filter(d=>d!==w)}}
   if(sh.emb&&r.gold>=sh.emb.price){r.gold-=sh.emb.price;r.emblems.push(sh.emb.k)}
   if(sh.foil&&r.gold>=sh.foil.price){const xs=r.deck.filter(d=>!d.foil&&G.C[d.key].kind!=='Curse'&&G.C[d.key].r!=='C');const x=xs[0];if(x){r.gold-=sh.foil.price;sh.foil.sold=true;x.foil=true;stats.shopFoil=(stats.shopFoil||0)+1}}
   G.toMap()}
  else if(v==='actstart'){if(r.claimed){stats.claimOff=(stats.claimOff||0)+1;if(process.env.CLAIM!=='none'&&(process.env.CLAIM==='all'||r.hero==='W')){r.deck.push(G.mk(r.claimed.k));stats.claim=(stats.claim||0)+1}r.claimed=null}const ks=G.run.startPick||[];if((r.act||1)>1)stats.act1=(stats.act1||0)+1;const e=ks.find(k=>G.EMB[k].r==='B')||ks.find(k=>G.EMB[k].r==='M')||ks.find(k=>G.EMB[k].r)||ks[0];if(e){G.run.emblems.push(e);if(e==='contract'){r.max-=4;r.hp=Math.min(r.hp,r.max)}}G.run.startPick=null;G.toMap()}
  else if(v==='bossreward'){const ks=G.reward.boss;const k=ks[s%ks.length]||'';stats.act1=(stats.act1||0)+1;G.nextAct(k)}
  else if(v==='event'&&G.reward.ev==='bargain'){if(r.max>60){G.run.max-=15;G.run.hp=Math.min(G.run.hp,G.run.max);if(G.reward.myth)r.emblems.push(G.reward.myth)}G.toMap()}
  else if(v==='event'&&['cathar','hedron','ruins'].includes(G.reward.ev)){const ev=G.reward.ev,ok=r.hp>r.max*.5;stats.ev=stats.ev||{};stats.ev[ev]=(stats.ev[ev]||0)+1;if(ev==='ruins'&&!ok){G.heal(10);G.toMap()}else G.evChoice(ev==='cathar'?(ok?'tend':'bless'):ev==='hedron'?(ok?'hedron':'x'):'dig');}
  else if(v==='event'){if(G.reward.ev==='shrine'){const w=r.deck.find(d=>d.key==='rgoblin'||d.key==='piker');if(w)r.deck=r.deck.filter(d=>d!==w)}else G.heal(12);G.toMap()}
  check(v);
 }
 const won=G.view==='victory';if(won){stats.wins++;stats.bossWins++}
 stats.bests=(stats.bests||[]);stats.bests.push(G.run.bestTurn||0);if(runBroken||(G.run.bestTurn||0)>=50){stats.broken=(stats.broken||0)+1;const sig=[...G.run.emblems.filter(k=>G.EMB[k].r).sort(),...(runAnte?['ante']:[]),...G.run.deck.filter(d=>G.C[d.key].sig).map(d=>d.key)].join('+')||'(no rare+ emblem)';(stats.brokenSrc=stats.brokenSrc||{})[sig]=(stats.brokenSrc[sig]||0)+1}
 for(const k of new Set(G.run.deck.map(d=>d.key))){stats.card=stats.card||{};const o=stats.card[k]=stats.card[k]||[0,0];o[0]++;if(won)o[1]++}
 {const em=G.run.emblems,eg=em.filter(k=>ENG.includes(k)),py=em.filter(k=>PAY.includes(k));const cls=eg.length&&py.length?'pair':eg.length?'engineOnly':py.length?'payoffOnly':'neither';const o=(stats.click=stats.click||{})[cls]=stats.click[cls]||[0,0];o[0]++;if(won)o[1]++;for(const e of eg)for(const q of py){const pk=e+'×'+q,po=(stats.pairs=stats.pairs||{})[pk]=stats.pairs[pk]||[0,0];po[0]++;if(won)po[1]++}}
 for(const k of G.run.emblems){stats.emb=stats.emb||{};const o=stats.emb[k]=stats.emb[k]||[0,0];o[0]++;if(won)o[1]++}
 stats.fights.push(G.run.fights);
 stats.deaths[lastKind]=(stats.deaths[lastKind]||0)+(G.view==='over'?1:0);
 }catch(e){stats.errors.push('seed '+s+': '+e.stack.split('\n').slice(0,3).join(' | '))}
}
const pct=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length*p)]};
const avg=a=>(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1);
console.log({runs:N,winRate:(stats.wins/(N-(+(process.env.S0||1))+1)*100).toFixed(1)+'%',avgFights:avg(stats.fights),avgTurnsPerFight:avg(stats.turns),bossReached:stats.bossTries,avgHpAtBoss:stats.hpAtBoss.length?avg(stats.hpAtBoss):'-',deathsBy:stats.deaths,topKillers:Object.entries(stats.killers).sort((a,b)=>b[1]-a[1]).slice(0,6),errors:[...new Set(stats.errors)].slice(0,10)});
console.log('boss kill turns p10/p50/p90',pct(stats.bossT||[0],.1),pct(stats.bossT||[0],.5),pct(stats.bossT||[0],.9),'wins in 3 turns or less',((stats.bossT||[]).filter(x=>x<=3).length/N*100).toFixed(1)+'% of runs');
console.log('best TURN damage p50/p90/p99',pct(stats.bests,.5),pct(stats.bests,.9),pct(stats.bests,.99),'runs with a 25+ turn',(stats.bests.filter(x=>x>=25).length/N*100).toFixed(1)+'%');
const tab=o=>Object.entries(o).filter(([k,v])=>v[0]>=15).map(([k,v])=>[k,v[0],(v[1]/v[0]*100).toFixed(0)+'%']).sort((a,b)=>parseFloat(b[2])-parseFloat(a[2]));
console.log('cards: [key, runs holding, win%]',JSON.stringify(tab(stats.card)));console.log('emblems',JSON.stringify(tab(stats.emb||{})));
const dTot=Object.values(stats.deaths).reduce((a,b)=>a+b,0);
console.log('REVIEW policy',POL,'win',(stats.wins/(N-(+(process.env.S0||1))+1)*100).toFixed(1)+'%','bossDeathShare',dTot?((stats.deaths.boss||0)/dTot*100).toFixed(0)+'%':'-','brokenRuns',((stats.broken||0)/N*100).toFixed(1)+'%','rareSeenBeforeBoss',stats.bossTries?((stats.rareBeforeBoss||0)/stats.bossTries*100).toFixed(0)+'%':'-','goldAtBossP50',pct(stats.goldAtBoss||[0],.5),'errors',stats.errors.length);
console.log('REVIEW acts',POL,'act1 clear',((stats.act1||0)/N*100).toFixed(1)+'%','act2 clear given act1',stats.act1?(stats.wins/stats.act1*100).toFixed(1)+'%':'-','gold at Sorin p50',pct(stats.goldBoss1||[0],.5),'gold at Ob p50',pct(stats.goldBoss2||[0],.5));
console.log('REVIEW broken sources',JSON.stringify(Object.entries(stats.brokenSrc||{}).sort((a,b)=>b[1]-a[1]).slice(0,8)));
console.log('REVIEW step3','exile played per drawn',stats.exSeen?(stats.exPlayed/stats.exSeen).toFixed(2):'-','('+(stats.exPlayed||0)+'/'+(stats.exSeen||0)+')','tokens got',stats.tokGot||0,'used',stats.tokUsed||0,stats.tokGot?((stats.tokUsed||0)/stats.tokGot*100).toFixed(0)+'%':'-');
console.log('REVIEW mythics',JSON.stringify(Object.fromEntries(Object.entries(stats.card||{}).filter(([k])=>G.C[k].r==='M').map(([k,v])=>[k,[v[0],(v[1]/v[0]*100).toFixed(0)+'%']]))),'restBurn',stats.restBurn||0,'shopFoil',stats.shopFoil||0);
console.log('REVIEW defense',CAREFUL?'careful':'naive','avgTurnsPerFight',avg(stats.turns),'cleanEnemyTurns',((stats.clean||0)/(stats.eT||1)*100).toFixed(1)+'%','avgLifeLostPerEnemyTurn',((stats.lost||0)/(stats.eT||1)).toFixed(2),'avgLifeLostPerEnemyTurnAct1',((stats.lost1||0)/(stats.eT1||1)).toFixed(2));
{const D=ctx.PW_DMG,T=Object.values(D).reduce((a,b)=>a+b,0)||1;console.log('REVIEW damage sources',JSON.stringify(Object.fromEntries(Object.entries(D).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,(v/T*100).toFixed(0)+'%']))),'soak',JSON.stringify(ctx.PW_SOAK))}
console.log('REVIEW shandalar','sigPick',stats.sigOff?((stats.sigPick||0)/stats.sigOff*100).toFixed(0)+'%':'-','sigFallback',stats.sigOff?((stats.sigFb||0)/stats.sigOff*100).toFixed(0)+'%':'-','anteAccept',stats.anteOff?((stats.anteAcc||0)/stats.anteOff*100).toFixed(0)+'%':'-','eliteWin wagered',stats.eA?(stats.eA[1]/stats.eA[0]*100).toFixed(0)+'%('+stats.eA[0]+')':'-','unwagered',stats.eN?(stats.eN[1]/stats.eN[0]*100).toFixed(0)+'%('+stats.eN[0]+')':'-','dunEntry',((stats.dunIn||0)/N*100/2).toFixed(0)+'% of act-maps','anteSuccess',stats.anteRes?(stats.anteRes[1]/stats.anteRes[0]*100).toFixed(0)+'%':'-','dunHpLostP50',stats.dunLoss?pct(stats.dunLoss,.5).toFixed(0)+'%':'-','dunComplete',stats.dunIn?((stats.dunDone||0)/stats.dunIn*100).toFixed(0)+'%':'-');
console.log('REVIEW events',JSON.stringify(stats.ev||{}));
console.log('REVIEW click matrix',JSON.stringify(Object.fromEntries(Object.entries(stats.click||{}).map(([k,v])=>[k,[v[0],(v[1]/v[0]*100).toFixed(0)+'%']]))),'top pairs',JSON.stringify(tab(stats.pairs||{}).slice(0,5)),'weakest pairs',JSON.stringify(tab(stats.pairs||{}).slice(-3)));
console.log('REVIEW emblems win-when-held',JSON.stringify(tab(stats.emb||{})));
{const P=stats.P||{};console.log('REVIEW pressure',CAREFUL?'careful':'naive',JSON.stringify(Object.fromEntries(Object.entries(P).map(([k,o])=>[k,{n:o.n,win:(o.w/o.n*100).toFixed(0)+'%',turns:(o.t/o.n).toFixed(1),doom:(o.doom/o.n*100).toFixed(0)+'%',lifeLost:(o.lost/o.n*100).toFixed(0)+'%'}]))),'bosses',JSON.stringify(Object.fromEntries(Object.entries(stats.B||{}).map(([k,q])=>[k,q[0]+'/'+(q[1]/q[0]*100).toFixed(0)+'%']))))}
