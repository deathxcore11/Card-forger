// Build a disposable, local-only browser fixture from actual app sources.
// Never edits production/frozen sources. Auth/cache are fixture dependencies;
// menu/setup/handlers/table/native service are not replaced with mocks.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url)),takeover=path.dirname(here),base=path.join(takeover,'cardstashy'),overlay=path.join(takeover,'forge-play-integration-overlay');
const dest=path.resolve(process.argv[2]||path.join(here,'runtime'));
if(dest===base||dest===overlay||!dest.startsWith(here+path.sep))throw Error('Fixture destination must stay inside the isolated browser proof directory');
await fs.rm(dest,{recursive:true,force:true});await fs.cp(base,dest,{recursive:true});
const widePatch=process.env.FORGE_WIDE_ENTRY?await fs.readFile(path.resolve(process.env.FORGE_WIDE_ENTRY),'utf8'):null;
const patch=(dry=false)=>{const r=spawnSync('patch',[...(dry?['--dry-run']:[]),'--fuzz=0','--batch','-p1','-d',dest],{input:widePatch,encoding:'utf8'});if(r.status)throw Error('Wide patch base/composition mismatch: '+r.stdout+r.stderr);};
if(widePatch)patch(true); // Assert the supplied patch against the actual baseline.
const hashes=JSON.parse(await fs.readFile(path.join(overlay,'SHA256SUMS.json'),'utf8'));
for(const {path:rel,sha256} of hashes){const bytes=await fs.readFile(path.join(overlay,rel));if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw Error('Overlay checkpoint differs: '+rel);await fs.mkdir(path.dirname(path.join(dest,rel)),{recursive:true});await fs.writeFile(path.join(dest,rel),bytes);}
for(const [dir,rel]of [['forge-inspector-fix-overlay','experiments/phase-engine/match-table.mjs'],['forge-land-hitfix-overlay','experiments/phase-engine/match-table.css']])await fs.copyFile(path.join(takeover,dir,rel),path.join(dest,rel));
// Wide admission is an explicit reviewed composition input, not a capability stub.
if(widePatch){
 // The only overlapping hunk is import context. Temporarily remove exactly the
 // two new Forge imports, apply reviewed hunks with zero fuzz, then restore.
 const appPath=path.join(dest,'app.js');let merged=await fs.readFile(appPath,'utf8');
 const additions="import {FORGE_PLAY_TEST_ENABLED} from './play-forge-feature.js';\nimport {forgeDeckSupport} from './play-forge-setup-review.js';\n";
 if(merged.split(additions).length!==2)throw Error('Integration import seam changed');
 await fs.writeFile(appPath,merged.replace(additions,''));patch();merged=await fs.readFile(appPath,'utf8');
 const anchor="import {createPlaySetup} from './play-setup.js';\n";if(merged.split(anchor).length!==2)throw Error('Wide import seam changed');
 await fs.writeFile(appPath,merged.replace(anchor,anchor+additions));
}
const app=await fs.readFile(path.join(dest,'app.js'),'utf8');
const capture=(re,label)=>{const m=app.match(re);if(!m)throw Error('App source seam changed: '+label);return m[1]||m[0];};
const fragments=[capture(/function closePlayerMat\(\)\{[^\n]*\}/,'close'),capture(/function focusNextPlaySelection\(\)\{[^\n]*\}/,'focus')];
for(const name of ['playStyle','playSelectDeck','playInspectSeat','playClearSelection','playConfigure','playImportPreview','playImportUse'])fragments.push(capture(new RegExp('A\\.'+name+'=[^\\n]*;'),'A.'+name));
fragments.push('A.playFindOpponent='+capture(/A\.playFindOpponent=(async\(\)=>\{[\s\S]*?\n\});\nA\.playSaveDeck/,'quick')+';');
fragments.push('A.playStartCandidate='+capture(/A\.playStartCandidate=(async\(\)=>\{[\s\S]*?\n\});\nfunction playDeckPreview/,'start')+';');
fragments.push(capture(/I\.playImportDraft=C\.playImportDraft=t=>\{[\s\S]*?\n\};/,'draft'));
fragments.push(capture(/C\.playMatchOption=[^\n]*;/,'option'));
fragments.push(capture(/I\.playDeckSearch=[^\n]*;/,'search'));
const module=`// Mechanically extracted from app.js; do not edit generated handler bodies.\nexport function bindPlayHandlers(deps){const {FORGE_PLAY_TEST_ENABLED,PLAY_MATCH_RELEASE_READY,T,syncDesktopPlayEntries,S,playSetup,readPlayAccount,cloudInfo,accountGeneration,accountLocked,cloudAccessToken,meta,toast,go,chooseQuickOpponent,forgeDeckSupport,capturePracticeDeckContext,readPlaySources,refreshPlayMenu,cancelPlayBuilds}=deps;let playerMatHost=null,playerMatRoot=null,practicePregame=null,playStarting=false,quickSequence=0,quickStatus={busy:false,error:null};const A={},C={},I={};${fragments.join('\n')}return {A,C,I,close:closePlayerMat};}\n`;
await fs.writeFile(path.join(dest,'fixture-app-handlers.mjs'),module);
const bootstrap=JSON.parse(await fs.readFile(path.join(takeover,'forge-proof/review-candidate-20261026-0146-exact/fixtures/bootstrap-existing.json'),'utf8')).input;
const {parsePlayDeckImport}=await import(pathToFileURL(path.join(base,'play-deck-import.js'))),{parseDeckImport}=await import(pathToFileURL(path.join(base,'deck-flow.js')));
const dck=await fs.readFile(path.join(takeover,'forge-proof/decks/reign-of-dragons.dck'),'utf8');let text='',zone='';
for(const line of dck.split(/\r?\n/)){if(line==='[Commander]'){zone='Commander';text+='Commander\n';}else if(line==='[Main]'){zone='Deck';text+='\nDeck\n';}else if(zone&&/^\d+ /.test(line)){text+=line.split('|')[0]+'\n';}}
const reign={...parsePlayDeckImport(text,{parseDeckImport}),id:'browser-fixture:reign-of-dragons',name:'Reign of Dragons',format:'Commander'};
const decks=[bootstrap.humanDeck,bootstrap.opponentDeck,reign];
await fs.writeFile(path.join(dest,'fixture-decks.json'),JSON.stringify({decks,angelsImport:('Commander\n1 '+decks[0].commander+'\n\nDeck\n'+decks[0].cards.filter(r=>r.name!==decks[0].commander).map(r=>`${r.qty} ${r.name}`).join('\n'))},null,2)+'\n');
for(const name of ['forge-play-browser.html','fixture-entry.mjs'])await fs.copyFile(path.join(here,name),path.join(dest,name));
const record={schema:'forge-play-browser-fixture.v1',base:'existing CardStashy 4.0.5',integrationPatchHash:createHash('sha256').update(await fs.readFile(path.join(overlay,'forge-play-integration.patch'))).digest('hex'),handlerSourceHash:createHash('sha256').update(app).digest('hex'),extractedHandlersHash:createHash('sha256').update(module).digest('hex'),wideEntry:!!widePatch,widePatchHash:widePatch?createHash('sha256').update(widePatch).digest('hex'):null,decks:decks.map(d=>({id:d.id,name:d.name,cards:d.cards.reduce((s,c)=>s+c.qty,0)})),boundaries:['synthetic account/auth provider','preloaded public saved deck/cache fixtures','isolated Play shell; not full app boot or cloud persistence']};
await fs.writeFile(path.join(dest,'fixture-build.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({uiRoot:dest,entry:'/forge-play-browser.html',...record}));
