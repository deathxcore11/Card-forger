// Small setup review before downloading/instantiating the rules runtime.
// A positive result is permission to run authoritative admission, not legality.
import {prepareMatchInput,evaluateCardCoverage} from './match-input.mjs';
import {PRACTICE_COVERAGE} from './practice-coverage.mjs';
export function reviewPracticeSetup(setup,{coverage=PRACTICE_COVERAGE}={}){
 const reasons=[],profile=setup?.profile,match=setup?.match;
 if(profile?.signedIn!==true||typeof profile.ownerId!=='string'||!profile.ownerId||profile.locked)reasons.push('Sign in to the current account before starting Practice.');
 if(match?.mode!=='cpu')reasons.push('Private friend matches are coming after CPU practice.');
 if(match?.difficulty!=='Medium')reasons.push('Choose Medium for the first beta. Easy and Hard tuning will follow.');
 for(const [seat,label]of [['selected','your deck'],['opponent','the CPU deck']])if(!setup?.[seat])reasons.push('Choose '+label+' first.');
 let support=null;
 if(setup?.selected&&setup?.opponent){
  try{
   // This sentinel is not a runtime pin or an admitted match. The worker later
   // reconstructs/validates exact inputs with the pinned runtime identity.
   const input=prepareMatchInput({player:setup.selected,opponent:setup.opponent,format:match?.format,difficulty:match?.difficulty,profile,runtimeIdentity:'preflight-only'});
   support=evaluateCardCoverage(input,coverage);
   for(const [seat,label]of [['player','Your deck'],['opponent','CPU deck']])if(!support.seats[seat].covered)reasons.push(label+' has cards outside the tested beta pool.');
  }catch{reasons.push('Review deck rows, quantities, format and commander declarations in Decks.');}
 }
 return {canLoad:reasons.length===0,reasons,coverageVersion:support?.coverageVersion||coverage.coverageVersion,seats:support?.seats||null,construction:'pending-engine'};
}
