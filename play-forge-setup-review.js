// Transport/readiness review only. Forge alone decides card support, identity,
// construction legality and game rules after receiving both exact snapshots.
import {forgeCpuPolicy} from './play-forge-cpu-policy.js';
export function forgeDeckSupport(deck){
 const invalid=!deck||!['Commander','Standard','Modern'].includes(deck.format)||!Array.isArray(deck.cards)||!deck.cards.length||!Array.isArray(deck.side===undefined?[]:deck.side)||!Array.isArray(deck.commanders===undefined?[]:deck.commanders)
  ||[...deck.cards,...(deck.side||[]),...(deck.commanders||[])].some(r=>typeof r?.name!=='string'||!r.name.trim()||r.name.length>512||/[\u0000-\u001f\u007f]/.test(r.name)||!Number.isSafeInteger(r.qty)||r.qty<1||r.qty>1000)
  ||deck.cards.length+(deck.side||[]).length+(deck.commanders||[]).length>2500||[...deck.cards,...(deck.side||[])].reduce((n,r)=>n+r.qty,0)>2500;
 return invalid?{status:'review',label:'List needs review',detail:'Choose a complete snapshot with valid rows, quantities and format.'}:{status:'native-pending',label:'Forge validation pending',detail:'This exact list will be checked by Forge when the match opens. Card support and legality have not been certified.',affected:[]};
}
export function reviewForgeSetup(setup,{allowMissingOpponent=false}={}){
 const reasons=[],profile=setup?.profile,match=setup?.match;
 if(profile?.signedIn!==true||!profile.ownerId||profile.locked)reasons.push('Sign in to the current account before starting.');
 if(match?.mode!=='cpu')reasons.push('Private friend matches are not available.');
 try{forgeCpuPolicy(match?.difficulty);}catch(e){reasons.push(e.message);}
 if(!['Commander','Standard','Modern'].includes(match?.format))reasons.push('Choose a supported match format.');
 for(const [seat,label]of [['selected','your deck'],['opponent','the CPU deck']]){
  const deck=setup?.[seat];if(!deck){if(seat!=='opponent'||!allowMissingOpponent)reasons.push('Choose '+label+' first.');continue;}
  if(forgeDeckSupport(deck).status!=='native-pending'||deck.format!==match.format)reasons.push('Review '+label+' rows and format.');
 }
 return {canLoad:reasons.length===0,reasons,seats:null,construction:'pending-native',coverageVersion:'pending-native'};
}
