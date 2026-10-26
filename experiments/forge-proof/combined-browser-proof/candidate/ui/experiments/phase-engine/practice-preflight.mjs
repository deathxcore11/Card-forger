// Small setup review before downloading/instantiating the rules runtime.
// A positive result is permission to run authoritative admission, not legality.
import {prepareMatchInput} from './match-input.mjs';
import {CPU_DIFFICULTIES,CPU_LABELS_READY} from './cpu-difficulty-config.mjs';
export function reviewPracticeSetup(setup){
 const reasons=[],profile=setup?.profile,match=setup?.match;
 if(profile?.signedIn!==true||typeof profile.ownerId!=='string'||!profile.ownerId||profile.locked)reasons.push('Sign in to the current account before starting Practice.');
 if(match?.mode!=='cpu')reasons.push('Private friend matches are coming after CPU practice.');
 if(!CPU_DIFFICULTIES.includes(match?.difficulty)||(!CPU_LABELS_READY&&match?.difficulty!=='Medium'))reasons.push('Choose an available CPU difficulty.');
 for(const [seat,label]of [['selected','your deck'],['opponent','the CPU deck']])if(!setup?.[seat])reasons.push('Choose '+label+' first.');
 let support=null;
 if(setup?.selected&&setup?.opponent){
  try{
   // This sentinel is not a runtime pin or an admitted match. The worker later
   // reconstructs/validates exact inputs with the pinned runtime identity.
   prepareMatchInput({player:setup.selected,opponent:setup.opponent,format:match?.format,difficulty:match?.difficulty,profile,runtimeIdentity:'preflight-only'});
   // The historical test fixture list is evidence, not a deck whitelist.
   // The worker checks the verified, loaded card database before dealing.
   support={seats:{player:{unsupported:[],covered:null},opponent:{unsupported:[],covered:null}}};
  }catch{reasons.push('Review deck rows, quantities, format and commander declarations in Decks.');}
 }
 return {canLoad:reasons.length===0,reasons,coverageVersion:'pending-engine-data',seats:support?.seats||null,construction:'pending-engine'};
}
