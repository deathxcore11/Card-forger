// Pick a CPU list for review. Matching is an estimate, never engine admission.
import {playDeckSupport} from './play-deck-sources.js';
export function chooseQuickOpponent({player,candidates=[],difficulty='Medium',estimate=()=>null,support=playDeckSupport,candidateEligible=null,nativeValidationPending=false}={}){
 if(!['Easy','Medium','Hard'].includes(difficulty))throw Error('Choose a CPU difficulty.');
 const eligible=candidateEligible||((deck)=>support(deck).status==='pool');
 if(!player||!eligible(player))throw Error('Your selected deck needs play-support review before Quick Play.');
 const listKey=deck=>JSON.stringify([deck.format,deck.commander||'',deck.commanders||[],deck.cards,deck.side||[]]);
 const seen=new Set(),rows=[];
 for(const entry of candidates){const deck=entry?.deck||entry;if(!deck||deck.format!==player.format)continue;const key=listKey(deck);if(seen.has(key)||!eligible(deck))continue;seen.add(key);let score=null;try{const n=estimate(deck);if(Number.isFinite(n)&&n>=0&&n<=100)score=n;}catch{}rows.push({deck,score,key});}
 if(!rows.length)throw Error('No compatible CPU deck is available in this format yet. Choose another source in Practice.');
 // The CPU plays a different list whenever one exists; a mirror is only the last resort.
 // Same cards under another record (a precon you selected, a saved copy, an import), or split across
 // rows and printings, is still a mirror.
 const cardsKey=deck=>JSON.stringify([[deck.commander||'',...(deck.commanders||[])].map(n=>String(n?.name??n).toLowerCase()).sort(),...['cards','side'].map(z=>{const total=new Map();for(const r of deck[z]||[]){const n=String(r?.name||'').trim().toLowerCase(),q=Number(r?.qty)||0;total.set(n,(total.get(n)||0)+q);}return [...total].filter(([,q])=>q>0).map(([n,q])=>n+'×'+q).sort();})]);
 const ownKey=listKey(player),ownCards=cardsKey(player),others=rows.filter(r=>r.key!==ownKey&&cardsKey(r.deck)!==ownCards&&!(player.id&&r.deck.id===player.id));if(!others.length)throw Error('Quick Play needs a different deck for the CPU in this format. Load Precons or Meta, or pick the CPU deck in Practice.');rows.splice(0,rows.length,...others);
 let own=null;try{const n=estimate(player);if(Number.isFinite(n)&&n>=0&&n<=100)own=n;}catch{}
 // Forge difficulty changes decision policy; it must not secretly select a
 // stronger opposing list. Keep deck-strength matching independent of its tier.
 const target=own===null?null:Math.max(0,Math.min(100,own+(nativeValidationPending?0:({Easy:-10,Medium:0,Hard:10}[difficulty]))));
 const rated=target===null?[]:rows.filter(r=>r.score!==null);const pool=rated.length?rated:rows;
 if(rated.length)pool.sort((a,b)=>Math.abs(a.score-target)-Math.abs(b.score-target)||a.key.localeCompare(b.key));
 const selected=pool[0],mirror=cardsKey(selected.deck)===ownCards;return {deck:structuredClone(selected.deck),candidateCount:rows.length,estimated:!!rated.length,mirror,reason:(mirror?'CPU will use the same card list as you. ':'')+(nativeValidationPending?(rated.length?'Matched using your deck’s estimated strength.':'Selected from available decks in your format.')+' Both full lists are checked when the match opens.':(rated.length?'Matched using existing deck estimates for '+difficulty+'. Estimates do not guarantee an even game.':'Matched from available supported lists. Deck-strength estimates are unavailable.')),difficulty};
}
