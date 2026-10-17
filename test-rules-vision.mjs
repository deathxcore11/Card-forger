import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {detectCardQuad,quadPoint,warpPixels,normalizedQuality,quadArea} from './scan-vision.js';
import {rankScanCandidates,signalEvidence,nameDistance,readScanSignals} from './scan-signals.js';
import {ptcgNumbers} from './scan.js';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {LESSONS,TURN_STEPS,RULE_CHECKS} from './rule-lessons.js';
import {interactiveRules,searchRulebook,cardRuleHelp} from './rule-learning.js';
const inside=(x,y,q)=>{let c=false;for(let i=0,j=q.length-1;i<q.length;j=i++)if((q[i].y>y)!==(q[j].y>y)&&x<(q[j].x-q[i].x)*(y-q[i].y)/(q[j].y-q[i].y)+q[i].x)c=!c;return c;};
for(const q of [[{x:24,y:35},{x:116,y:22},{x:145,y:170},{x:38,y:186}],[{x:90,y:18},{x:183,y:64},{x:121,y:204},{x:28,y:158}],[{x:12,y:24},{x:88,y:24},{x:88,y:134},{x:12,y:134}]]){
 const w=220,h=230,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,v=inside(x,y,q)?210:25;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
 const hit=detectCardQuad(data,w,h);assert(hit,'off-centre, rotated or skewed card is detected');assert(Math.abs(quadArea(hit.quad)-quadArea(q))/quadArea(q)<.17);
 const warped=warpPixels(data,w,h,hit.quad,80,112);assert.equal(warped.length,80*112*4);assert(warped[(56*80+40)*4]>180,'warp centre is inside card');
}
assert.equal(detectCardQuad(new Uint8ClampedArray(100*140*4).fill(90),100,140),null,'plain background rejected');
const quad=[{x:3,y:7},{x:100,y:10},{x:89,y:140},{x:11,y:131}];for(const [u,v,i] of [[0,0,0],[1,0,1],[1,1,2],[0,1,3]]){const p=quadPoint(quad,u,v);assert(Math.abs(p.x-quad[i].x)<.001&&Math.abs(p.y-quad[i].y)<.001);}
const a=new Uint8ClampedArray(120*168*4).fill(220),b=a.slice();for(let y=0;y<168;y++)for(let x=0;x<120;x++)if(y<30||y>140){const i=(y*120+x)*4;b[i]=b[i+1]=b[i+2]=(x*17+y*13)%7<3?50:220;}assert(normalizedQuality(b,120,168).sharp>normalizedQuality(a,120,168).sharp+100,'text-band blur gate excludes smooth frame');
assert.deepEqual(ptcgNumbers('O9S/I9B'),[{num:'095',total:'198'}]);assert.equal(nameDistance('VikavoIt','Vikavolt'),1);
const wrong={id:'sv2-95',name:'Sandygast',hp:90,set:{number:'095',total:193}},right={id:'swsh8-125',name:'Sandygast',hp:80,set:{number:'125',total:264}};
const read={name:'Sandygast HP 80',code:'125/264',stats:'Vibration\nSpooky Shot'};
assert.deepEqual(signalEvidence('ptcg',wrong,read).conflicts,['HP','collector number']);assert.equal(rankScanCandidates('ptcg',[{card:wrong,name:wrong.name},{card:right,name:right.name}],read)[0].card.id,right.id);
assert.equal(rankScanCandidates('ygo',[{card:{atk:2500,def:2100}}],{stats:'ATK/3000 DEF/2500'}).length,0);
const manifest=JSON.parse(fs.readFileSync('scanidx/catalog-manifest.json'));
for(const [g,entry] of Object.entries(manifest.games)){const raw=gunzipSync(fs.readFileSync(entry.signals.file));assert.equal(createHash('sha256').update(raw).digest('hex'),entry.signals.sha256);const stats=JSON.parse(raw);assert.equal(stats.game,g);assert(Object.keys(stats.rows).length>10000);}
const pk=JSON.parse(gunzipSync(fs.readFileSync('scanidx/ptcg-catalog-v1.json.gz')));pk.signals=JSON.parse(gunzipSync(fs.readFileSync(manifest.games.ptcg.signals.file)));const pack=compileCatalog(pk);const match=lookupCatalog(pack,read);assert.equal(match.cands[0].id,'swsh8-125');assert.equal(match.cands[0].card.hp,80);assert(match.cands[0].exact);assert(lookupCatalog(pack,{name:'Sandygast HP 80'}).cands.every(c=>c.card.hp===80));
const books=JSON.parse(fs.readFileSync('rulebooks/manifest.json'));
for(const [g,info] of Object.entries(books)){
 const raw=gunzipSync(fs.readFileSync(info.file));assert.equal(createHash('sha256').update(raw).digest('hex'),info.sha256);const book=JSON.parse(raw);assert.equal(book.entries.length,info.count);assert.equal(book.game,g);assert(LESSONS[g].length>=8&&TURN_STEPS[g].length>=6&&RULE_CHECKS[g].length>=4);assert.match(interactiveRules(g),/data-rule-answer|data-rule-load/);assert(book.sources.every(s=>s.url.startsWith('https://')));
 const term=g==='mtg'?'903.8':g==='ptcg'?'Rare Candy':'Spell Speed';assert(searchRulebook(book,term).length,term+' found in actual supplied text');
 if(g==='mtg'){assert.equal(searchRulebook(book,'903.8')[0].id,'903.8');assert(searchRulebook(book,'','', '4').every(e=>e.chapter==='4'));}
}
assert.match(cardRuleHelp('mtg',{oracle_text:'Flying, trample'}),/data-rule="flying"/);assert.doesNotMatch(cardRuleHelp('ptcg',{name:'<script>alert(1)</script>'}),/<script>/);
console.log('PASS: free-angle contour detection/projective warp, text sharpness, Sandygast HP/number mismatch rejection, all-game offline signals, complete dated rulebooks, source integrity and navigable learning content.');
const {S,blank}=await import('./store.js'),V=await import('./views.js'),T=await import('./tcg.js');
for(const g of ['mtg','ptcg','ygo']){
 S.state=blank();S.state.settings.game=g;S.state.tcg={ptcg:{collection:[],decks:[],wishlist:[]},ygo:{collection:[],decks:[],wishlist:[]}};
 if(g==='mtg'){S.state.decks=[{id:'rules-deck',name:'Rules deck',format:'Commander',cards:[]}];S.ui.deckId='rules-deck';S.ui.deckTab='rules';assert.match(V.deckPage(),/data-learning-root/);}
 else {S.state.tcg[g].decks=[{id:'rules-deck',name:'Rules deck',format:g==='ptcg'?'Standard':'Advanced',zones:{main:[],extra:[],side:[]}}];S.ui.tdeckTab={[g+':rules-deck']:'rules'};assert.match(T.tcgDeck('rules-deck'),/data-learning-root/);}
}
console.log('PASS: Rules pill renders the shared interactive learning view inside actual deck pages for all three games.');

assert.equal(readScanSignals('ygo',{stats:'ATK 7/7000 NEC 71060 4'}).atk,null,'garbled fraction after ATK is not a readable attack value');
