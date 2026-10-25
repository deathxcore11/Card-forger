import fs from 'node:fs';
import {inspectTutorTargets} from '../mtg-target-evidence.js';
import {inspectPrimaryInputs} from '../mtg-primary-inputs.js';
import {assessCommanderBracket} from '../commander-evidence.js';
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const decks=input.decks.map(d=>{
 const targets=inspectTutorTargets(d.cards),primary=inspectPrimaryInputs(d.cards,{commander:d.commander});
 const bracket=assessCommanderBracket({...d,format:'Commander'},Object.fromEntries(d.cards.map(r=>[r.name.toLowerCase(),r.card])));
 return {attempt:d.attempt,commander:d.commander,missingSearchRoles:targets.groups.filter(g=>g.status==='missing'),unknownSearchRoles:targets.groups.filter(g=>g.status==='unverified'),missingDefiningInputs:primary.groups.filter(g=>g.defining&&g.status==='missing').map(g=>({kind:g.kind,label:g.label})),unknownDefiningInputs:primary.groups.filter(g=>g.defining&&g.status==='unverified').map(g=>g.label),restrictionFloor:bracket.restrictionFloor,unknownCardCopies:bracket.unknown};
});
const count=field=>decks.filter(d=>d[field].length).length;
const report={scope:'Recheck of the original captured 100 lists, not 100 newly generated decks, played matches or price refreshes. Only the bounded new checks are measured.',inputSha256:input.inputSha256,summary:{decks:decks.length,decksWithMissingSearchRoles:count('missingSearchRoles'),decksWithMissingDefiningInputs:count('missingDefiningInputs'),unknownCardCopies:decks.reduce((n,d)=>n+d.unknownCardCopies,0)},decks};
fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
