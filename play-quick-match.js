// Pick a CPU list for review: matched to the player's deck Power (same number as Collection), with a Wild Card chance. Never engine admission.
import {playDeckSupport} from './play-deck-sources.js';
export function chooseQuickOpponent({player,candidates=[],difficulty='Medium',estimate=()=>null,support=playDeckSupport,candidateEligible=null,nativeValidationPending=false,random=Math.random,streak=0,wildChance=0.125,sample=40,bracketOf=()=>null}={}){
 if(!['Easy','Medium','Hard'].includes(difficulty))throw Error('Choose a CPU difficulty.');
 const eligible=candidateEligible||((deck)=>support(deck).status==='pool');
 if(!player||!eligible(player))throw Error('Your selected deck needs play-support review before Quick Play.');
 const listKey=deck=>JSON.stringify([deck.format,deck.commander||'',deck.commanders||[],deck.cards,deck.side||[]]);
 const seen=new Set(),rows=[];
 for(const entry of candidates){const deck=entry?.deck||entry;if(!deck||deck.format!==player.format)continue;const key=listKey(deck);if(seen.has(key)||!eligible(deck))continue;seen.add(key);rows.push({deck,score:null,key});}
 if(!rows.length)throw Error('No compatible CPU deck is available in this format yet. Choose another source in Practice.');
 // The CPU plays a different list whenever one exists; a mirror is only the last resort.
 // Same cards under another record (a precon you selected, a saved copy, an import), or split across
 // rows and printings, is still a mirror.
 const cardsKey=deck=>JSON.stringify([[deck.commander||'',...(deck.commanders||[])].map(n=>String(n?.name??n).toLowerCase()).sort(),...['cards','side'].map(z=>{const total=new Map();for(const r of deck[z]||[]){const n=String(r?.name||'').trim().toLowerCase(),q=Number(r?.qty)||0;total.set(n,(total.get(n)||0)+q);}return [...total].filter(([,q])=>q>0).map(([n,q])=>n+'×'+q).sort();})]);
 const ownKey=listKey(player),ownCards=cardsKey(player),others=rows.filter(r=>r.key!==ownKey&&cardsKey(r.deck)!==ownCards&&!(player.id&&r.deck.id===player.id));if(!others.length)throw Error('Quick Play needs a different deck for the CPU in this format. Load Precons or Meta, or pick the CPU deck in Practice.');rows.splice(0,rows.length,...others);
 // Power matching: rank the pool by the same Power the Collection shows, aim near the player's rank,
 // and keep a small Wild Card chance. Anything unrated or unscored falls back to the random pick.
 const OFFSET={Easy:-15,Medium:0,Hard:10},SIGMA=12,rate=deck=>{try{const n=estimate(deck);return Number.isFinite(n)&&n>=0&&n<=100?n:null;}catch{return null;}};
 const myPower=rate(player);let pick=-1,wildCard=false,matched=false;
 if(myPower!==null&&rows.length>2){
  const pool=rows.length>sample?rows.map(r=>[random(),r]).sort((a,b)=>a[0]-b[0]).slice(0,sample).map(x=>x[1]):rows;
  for(const r of pool)r.score=r.score??rate(r.deck);
  const rated=pool.filter(r=>r.score!==null).sort((a,b)=>a.score-b.score);
  // Commander: keep the CPU within one bracket of yours whenever three or more such lists are rated.
  if(player.format==='Commander'){const b=d=>{try{const n=bracketOf(d);return Number.isFinite(n)?n:null;}catch{return null;}},mineB=b(player);
   if(mineB!==null){const near=rated.filter(r=>{const x=b(r.deck);return x!==null&&Math.abs(x-mineB)<=1;});if(near.length>2)rated.splice(0,rated.length,...near);}}
  if(rated.length>2){
   // Rank, not raw points: placing lists crowd the top of the 0-100 scale, so the gap is measured in pool percentile.
   const pct=v=>100*rated.filter(r=>r.score<v).length/rated.length,mine=pct(myPower);
   const nudge=Math.max(-15,Math.min(15,Number(streak)||0));
   const target=Math.max(0,Math.min(100,mine+OFFSET[difficulty]+nudge));
   rated.forEach(r=>{r.pct=pct(r.score);});
   matched=true;
   const wild=random()<wildChance;
   const wide=wild?rated.filter(r=>r.pct<=target+(difficulty==='Easy'?25:40)):rated,band=wide.length?wide:rated;
   wildCard=wild;
   // Another archetype is more fun than a near-mirror of your own deck: same-archetype lists are rare picks.
   const arch=d=>String(d?.archetype||d?.name||'').split(' · ')[0].trim().toLowerCase(),mineArch=arch(player),same=r=>mineArch&&arch(r.deck)===mineArch?0.15:1;
   const weights=wild?band.map(same):band.map(r=>(Math.exp(-((r.pct-target)**2)/(2*SIGMA*SIGMA))+0.02)*same(r));
   let roll=Math.max(0,random())*weights.reduce((a,b)=>a+b,0),i=0;for(;i<band.length-1;i++){roll-=weights[i];if(roll<=0)break;}
   pick=rows.indexOf(band[i]);
  }
 }
 if(pick<0)pick=Math.min(rows.length-1,Math.floor(Math.max(0,random())*rows.length));
 const selected=rows[pick],mirror=cardsKey(selected.deck)===ownCards;return {deck:structuredClone(selected.deck),candidateCount:rows.length,estimated:matched,wildCard,power:selected.score??null,bracket:(()=>{if(selected.deck.format!=='Commander')return null;try{const n=bracketOf(selected.deck);return Number.isInteger(n)?n:null;}catch{return null;}})(),myPower:matched?myPower:null,mirror,reason:(mirror?'CPU will use the same card list as you. ':'')+(wildCard?'Wild Card from ':matched?'Matched to your deck from ':'Picked at random from ')+rows.length+' deck'+(rows.length===1?'':'s')+' in your format.'+(nativeValidationPending?' Both full lists are checked when the match opens.':''),difficulty};
}
