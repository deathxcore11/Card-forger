// Clue fusion (scan-fuse.js): a printing is "sure" only when the picture and a second kind of
// clue agree, and never when what was read contradicts it.
import assert from 'node:assert/strict';
globalThis.localStorage ||= {getItem:()=>null,setItem(){},removeItem(){}};
const {compileCatalog}=await import('./scan-catalog.js');
const {fuseClues,pictureVerdict,looksLike,printedIdSeen,nameSeen,passcodeSeen,candidateKey,FUSE}=await import('./scan-fuse.js');
const {PIX_REC}=await import('./scan-pix.js');

// Look-alike characters count only where the expected character makes the intent clear.
assert.ok(looksLike('O72','072'));assert.ok(looksLike('2O3','203'));assert.ok(!looksLike('073','072'));
assert.ok(looksLike('M0M','MOM'));assert.ok(!looksLike('MOM','M0N'));assert.ok(!looksLike('72','072'));

const ptcg=compileCatalog({schema:1,game:'ptcg',rows:[
 ['swsh7-72','Floette','swsh7','72',203,'Evolving Skies','swsh/swsh7/72'],
 ['xy2-64','Floette','xy2','64',106,'Flashfire','xy/xy2/64'],
 ['base1-58','Pikachu','base1','58',102,'Base','base/base1/58'],
 ['basep-1','Pikachu','basep','1','','Wizards Black Star Promos','base/basep/1']]});
assert.ok(printedIdSeen('ptcg',ptcg.rows[0],'(Q)\n072/203 &'));
assert.ok(printedIdSeen('ptcg',ptcg.rows[0],'Q\n072203 &'),'a lost slash still reads as number then total');
assert.ok(printedIdSeen('ptcg',ptcg.rows[0],'O72/2O3'));
assert.ok(!printedIdSeen('ptcg',ptcg.rows[0],'©2021 weakness x 2'));
assert.ok(!printedIdSeen('ptcg',ptcg.rows[1],'072/203'));
assert.ok(nameSeen('Floette','smce1) Floette\nw70'));assert.ok(nameSeen('Dark Gloom','Dork Gloom 60 HP'));
assert.ok(!nameSeen('Floette','Evolves from Flabébé'));assert.ok(!nameSeen('Mew','mewtwo'));assert.ok(nameSeen('Mew','STAGE Mew 60'));
assert.ok(nameSeen('Delver of Secrets // Insectile Aberration','Insectile Aberration'));

const strong=rows=>({dist:20,rival:90,strong:true,name:ptcg.rows[rows[0]][1],rows:rows.map(row=>({row,dist:20}))});
// One printing has this picture and its name is on the card: sure.
let f=fuseClues('ptcg',ptcg,strong([0]),{name:'smce1) Floette',code:'weakness'});
assert.equal(f.sure,true);assert.equal(f.key,'swsh7-72');assert.equal(f.proof,'picture and name');assert.equal(f.cands[0].exact,true);
assert.equal(candidateKey('ptcg',f.cands[0]),f.key);
// The picture alone is never sure.
f=fuseClues('ptcg',ptcg,strong([0]),{name:'',code:''});assert.equal(f.sure,false);assert.equal(f.cands[0].exact,false);
// Two printings share the picture: the number picks one; without it the person chooses.
f=fuseClues('ptcg',ptcg,strong([0,1]),{name:'Floette',code:'064/106'});assert.equal(f.sure,true);assert.equal(f.key,'xy2-64');
f=fuseClues('ptcg',ptcg,strong([0,1]),{name:'Floette',code:''});assert.equal(f.sure,false);assert.equal(f.known,true);assert.equal(f.cands.length,2);
// A number that was read and belongs to no printing of this picture cancels "sure".
f=fuseClues('ptcg',ptcg,strong([0]),{name:'Floette',code:'011/198'});assert.equal(f.sure,false);
// A weak picture only suggests, a far one says nothing.
f=fuseClues('ptcg',ptcg,{dist:FUSE.suggest-2,rival:FUSE.suggest+10,strong:false,name:'Floette',rows:[{row:0,dist:FUSE.suggest-2}]},{name:'Floette',code:'072/203'});
assert.equal(f.sure,false);assert.equal(f.cands.length,1);
f=fuseClues('ptcg',ptcg,{dist:FUSE.suggest+10,rival:FUSE.suggest+12,strong:false,name:'Floette',rows:[{row:0,dist:90}]},{});assert.equal(f.cands.length,0);

const mtg=compileCatalog({schema:1,game:'mtg',rows:[
 ['a1','Lightning Bolt','m11','149','Magic 2011',['nonfoil'],'o1','en'],
 ['a2','Lightning Bolt','clu','141','Ravnica: Clue Edition',['nonfoil'],'o1','en']]});
assert.ok(printedIdSeen('mtg',mtg.rows[1],'R 0141\nCLU • EN'));assert.ok(!printedIdSeen('mtg',mtg.rows[1],'R 0141\nM11 EN'));assert.ok(!printedIdSeen('mtg',mtg.rows[0],'149/249'),'a number without the set code does not pick a printing');
// A promo-stamped twin prints the regular code: text cannot choose between them, so never sure.
const twins=compileCatalog({schema:1,game:'mtg',rows:[
 ['t1','Yavimaya, Cradle of Growth','mh2','261','Modern Horizons 2',['nonfoil'],'o2','en'],
 ['t2','Yavimaya, Cradle of Growth','pmh2','261p','Modern Horizons 2 Promos',['nonfoil'],'o2','en'],
 ['t3','Portal Card','por','12','Portal',['nonfoil'],'o3','en']]});
assert.ok(printedIdSeen('mtg',twins.rows[1],'261/303 R\nMH2 * EN'));assert.ok(printedIdSeen('mtg',twins.rows[2],'12/215\nPOR'));
f=fuseClues('mtg',twins,{dist:12,rival:90,strong:true,name:'Yavimaya, Cradle of Growth',rows:[{row:1,dist:12}]},{name:'',code:'261/303 R\nMH2 * EN'});
assert.equal(f.sure,false);assert.deepEqual(f.cands.map(c=>c.id).sort(),['t1','t2']);
// The rarity mark read as one more digit, and a strict parse of that, do not hide the number.
assert.ok(printedIdSeen('ptcg',['bw3-42','Stunfisk','bw3','42',101],'Shin Nagasawa 42/1010 y'));assert.ok(!printedIdSeen('ptcg',['bw3-42','Stunfisk','bw3','42',101],'42/1100'));
const ygo=compileCatalog({schema:1,game:'ygo',rows:[
 ['46986414','Dark Magician','LOB-005','Ultra Rare','Legend of Blue Eyes White Dragon','Normal Monster'],
 ['46986414','Dark Magician','SDY-006','Ultra Rare','Starter Deck: Yugi','Normal Monster']]});
assert.ok(printedIdSeen('ygo',ygo.rows[0],'LOB-OO5'));assert.ok(passcodeSeen(ygo.rows[0],'4698G414 x'.replace('G','6')));
f=fuseClues('ygo',ygo,{dist:15,rival:95,strong:true,name:'Dark Magician',rows:[{row:0,dist:15},{row:1,dist:15}]},{name:'',code:'SDY-006\n46986414'});
assert.equal(f.sure,true);assert.equal(f.key,'46986414|SDY-006');

// Picture verdict: the nearest record names the card; same-name printings whose picture is as
// close share it, and one with no picture stays possible.
const bin=new Uint8Array(4*PIX_REC),h=new Uint8Array(PIX_REC).fill(0b10101010);
bin.set(h,0);bin.set(h,PIX_REC);bin[PIX_REC]^=1;bin.set(new Uint8Array(PIX_REC).fill(0b01010101),2*PIX_REC); // row 3 has no picture
let v=pictureVerdict('ptcg',ptcg,{bin},h);
assert.equal(v.dist,0);assert.equal(v.strong,true);assert.deepEqual(v.rows.map(x=>x.row),[0,1]);
v=pictureVerdict('ptcg',ptcg,{bin},new Uint8Array(PIX_REC).fill(0b01010101));
assert.equal(v.name,'Pikachu');assert.deepEqual(v.rows.map(x=>x.row).sort(),[2,3],'a same-name row without a picture is still a possible printing');
console.log('scan fusion: ok');
