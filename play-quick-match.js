// Pick a CPU list for review. Matching is an estimate, never engine admission.
import {playDeckSupport} from './play-deck-sources.js';
export function chooseQuickOpponent({player,candidates=[],difficulty='Medium',estimate=()=>null,support=playDeckSupport}={}){
 if(!['Easy','Medium','Hard'].includes(difficulty))throw Error('Choose a CPU difficulty.');
 if(!player||support(player).status!=='pool')throw Error('Your selected deck needs play-support review before Quick Play.');
 const listKey=deck=>JSON.stringify([deck.format,deck.commander||'',deck.commanders||[],deck.cards,deck.side||[]]);
 const seen=new Set(),rows=[];
 for(const entry of candidates){const deck=entry?.deck||entry;if(!deck||deck.format!==player.format)continue;const key=listKey(deck);if(seen.has(key)||support(deck).status!=='pool')continue;seen.add(key);let score=null;try{const n=estimate(deck);if(Number.isFinite(n)&&n>=0&&n<=100)score=n;}catch{}rows.push({deck,score,key});}
 if(!rows.length)throw Error('No compatible CPU deck is available in this format yet. Choose another source in Practice.');
 let own=null;try{const n=estimate(player);if(Number.isFinite(n)&&n>=0&&n<=100)own=n;}catch{}
 const target=own===null?null:Math.max(0,Math.min(100,own+({Easy:-10,Medium:0,Hard:10}[difficulty])));
 const rated=target===null?[]:rows.filter(r=>r.score!==null);const pool=rated.length?rated:rows;
 if(rated.length)pool.sort((a,b)=>Math.abs(a.score-target)-Math.abs(b.score-target)||a.key.localeCompare(b.key));
 const selected=pool[0],mirror=selected.key===listKey(player);return {deck:structuredClone(selected.deck),candidateCount:rows.length,estimated:!!rated.length,mirror,reason:(mirror?'CPU will use the same card list as you. ':'')+(rated.length?'Matched using existing deck estimates for '+difficulty+'. Estimates do not guarantee an even game.':'Matched from available supported lists. Deck-strength estimates are unavailable.'),difficulty};
}
