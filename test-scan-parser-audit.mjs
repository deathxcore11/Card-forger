// Scanner parser audit: synthetic OCR strings exercise actual parsing,
// catalogue lookup and evidence. This is not a physical-camera accuracy test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {scanNamesFor,nameCandidates,scanCardNameKey,scanCandidateMatches,ptcgNumberReadings,ptcgNumbers,ygoPasscodes} from './scan.js';
import {collectorQuery,collectorMatches,narrowPrintings} from './scan-collector.js';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {scanIdentifierEvidence,signalEvidence} from './scan-signals.js';

test('Magic titles beginning with a type or keyword reach the catalogue',()=>{
  for(const name of ['Land Tax','Artifact Mutation','Enchantment Alteration','Flying Men','Wizards of Thay',"Wizards' School",'Vigilance'])
    assert.equal(nameCandidates('mtg',name)[0],name,name);
  const pack=compileCatalog({schema:1,game:'mtg',rows:[['land-tax','Land Tax','lea','24','Limited Edition Alpha',['nonfoil'],'oracle-land-tax','en']]});
  assert.deepEqual(lookupCatalog(pack,{name:'Land Tax'}).cands.map(c=>c.id),['land-tax']);
});

test('Yu-Gi-Oh type-prefix titles remain intact',()=>{
  for(const name of ['Dragon Master Knight','Machine Duplication','Fusion Destiny','Effect Veiler','Link Spider','Synchro Chase','Ritual Sanctuary','Counter Gate','Thunder Dragon','Thunder Dragon Fusion','Counter Counter','Dragon Zombie','Pendulum Xyz'])
    assert.equal(nameCandidates('ygo',name)[0],name,name);
  const pack=compileCatalog({schema:1,game:'ygo',rows:[['effect-veiler','Effect Veiler','DREV-EN002','Ultra Rare','Duelist Revolution','Effect Monster']]});
  assert.deepEqual(lookupCatalog(pack,{name:'Effect Veiler'}).cands.map(c=>c.id),['effect-veiler']);
});

test('Pokemon Draw Energy is a title but draw instructions remain filtered',()=>{
  assert.equal(nameCandidates('ptcg','Draw Energy')[0],'Draw Energy');
  for(const text of ['Draw 3 cards','Draw two cards','Draw a card','Draw cards'])assert.deepEqual(scanNamesFor('ptcg',text),[]);
});

test('structural type lines still cannot crowd titles out of candidate budget',()=>{
  for(const text of ['Instant','Land','Creature — Human','Legendary Artifact Creature — Golem'])assert.deepEqual(scanNamesFor('mtg',text),[],text);
  for(const text of ['[DRAGON/NORMAL]','Dragon / Effect','Warrior / Fusion / Effect','Spell Card','Trap Card','Link'])assert.deepEqual(scanNamesFor('ygo',text),[],text);
  assert.equal(nameCandidates('mtg','Legendary Creature — Human\nLand Tax')[0],'Land Tax');
  assert.equal(nameCandidates('ygo','[DRAGON/NORMAL]\nDragon Master Knight')[0],'Dragon Master Knight');
});

test('intact short suffixes and accents survive noise-repair alternatives',()=>{
  for(const [game,name] of [['mtg','The Meathook Massacre II'],['mtg','Let Go'],['ygo','Level Up!']])assert.equal(nameCandidates(game,name)[0],name);
  assert.equal(nameCandidates('mtg','Lim-Dûl’s Vault')[0],'Lim-Dul’s Vault');
  assert.equal(nameCandidates('ygo','DARK MAGICIAN HE)')[0],'DARK MAGICIAN');
  assert(nameCandidates('mtg','Ase Eldegoss %& Hk').includes('Eldegoss'));
});

test('numbers at the start of genuine titles remain part of their identity',()=>{
  for(const [game,names] of [['mtg',['+2 Mace','17-Year Cicadas','70,000 Light-Years from Home']],['ygo',['7 Colored Fish','1st Movement Solo','4-Starred Ladybug of Doom','D2 Shield']]])
    for(const name of names)assert.equal(nameCandidates(game,name)[0],name);
  assert.equal(nameCandidates('ptcg','snce1 Eldegoss')[0],'Eldegoss','the demonstrated lowercase border scrap still repairs');
});

test('long printed titles fit the bounded title input without substring replacement',()=>{
  for(const [game,name] of [
    ['ygo','Calamity of the Sacred Beasts - Hamon, Lord of Striking Thunder'],
    ['ygo','Layer 19: "Preventing the Invasion! The Pitch-Black Super Quantum!!"'],
    ['mtg','Our Market Research Shows That Players Like Really Long Card Names So We Made this Card to Have the Absolute Longest Card Name Ever Elemental'],
  ])assert(nameCandidates(game,name).some(candidate=>scanCardNameKey(game,candidate)===scanCardNameKey(game,name)),name);
  assert.deepEqual(scanNamesFor('mtg','A'.repeat(161)),[],'OCR lines still have a finite bound');
});

test('Basic Energy title remains distinct from a Pokemon stage label',()=>{
  for(const energy of ['Fire','Water','Grass','Lightning','Psychic','Fighting','Darkness','Metal'])assert.equal(nameCandidates('ptcg','Basic '+energy+' Energy')[0],'Basic '+energy+' Energy');
  assert.equal(nameCandidates('ptcg','BASIC Pikachu HP60')[0],'Pikachu');
  const pack=compileCatalog({schema:1,game:'ptcg',rows:[['basic','Basic Fire Energy','fixture','1',100,'Fixture',''],['old','Fire Energy','fixture','2',100,'Fixture','']]});
  assert.deepEqual(lookupCatalog(pack,{name:'Basic Fire Energy',code:'1/100'}).cands.map(c=>[c.id,c.exact]),[['basic',true]]);
});

test('complete alternate title wins over its shorter same-name card',()=>{
  const pack=compileCatalog({schema:1,game:'mtg',rows:[
    ['one','The Meathook Massacre','one','1','One',['nonfoil'],'one','en'],
    ['two','The Meathook Massacre II','two','2','Two',['nonfoil'],'two','en'],
  ]});
  assert.deepEqual(lookupCatalog(pack,{name:'The Meathook Massacre II'}).cands.map(c=>c.id),['two']);
});

test('Pokemon glyphs and Unown punctuation retain separate identity keys',()=>{
  for(const [a,b] of [['Nidoran♀','Nidoran♂'],['Unown !','Unown ?'],['Unown !','Unown'],['Unown ?','Unown']]){
    assert.notEqual(scanCardNameKey('ptcg',a),scanCardNameKey('ptcg',b));
    assert.equal(scanCandidateMatches({name:a},b),false);
  }
  assert.equal(nameCandidates('ptcg','BASIC Nidoran♀ HP60')[0],'Nidoran♀');
  assert.equal(nameCandidates('ptcg','BASIC Nidoran♂ HP60')[0],'Nidoran♂');
  assert.equal(scanCandidateMatches({name:'Unown !'},'Unown!'),true);
});

test('Pokemon symbol identities remain distinct through catalogue lookup',()=>{
  const pack=compileCatalog({schema:1,game:'ptcg',rows:[
    ['female','Nidoran♀','fixture','1',100,'Fixture',''],['male','Nidoran♂','fixture','2',100,'Fixture',''],
    ['question','Unown ?','fixture','3',100,'Fixture',''],['exclamation','Unown !','fixture','4',100,'Fixture',''],
  ]});
  for(const [name,id] of [['Nidoran♀','female'],['Nidoran♂','male'],['Unown ?','question'],['Unown !','exclamation']])
    assert.deepEqual(lookupCatalog(pack,{name}).cands.map(c=>c.id),[id]);
});

test('Pokemon repaired collector characters retain their original provenance',()=>{
  assert.deepEqual(ptcgNumberReadings('053/128'),[{raw:'053/128',num:'053',total:'128',corrected:false}]);
  assert.deepEqual(ptcgNumberReadings('O53 / 128'),[{raw:'O53/128',num:'053',total:'128',corrected:true}]);
  assert.deepEqual(ptcgNumberReadings('0537128'),[{raw:'0537128',num:'053',total:'128',corrected:true}]);
  assert.deepEqual(ptcgNumbers('O53/128'),[{num:'053',total:'128'}],'existing public observations stay compatible');
  assert.equal(ptcgNumberReadings('TG03/TG30')[0].corrected,false,'real subset letters are not numeric repairs');
});

test('a readable fraction cannot suppress a contradictory repaired retry',()=>{
  const read={name:'Pikachu ex',code:'053/128\n␞\n0547128'};
  assert.deepEqual(ptcgNumbers(read.code),[{num:'053',total:'128'},{num:'054',total:'128'}]);
  const evidence=scanIdentifierEvidence('ptcg',read);
  assert.equal(evidence.identifierConflict,true);
  assert.equal(evidence.identifierUncertain,true);
});

test('repaired Pokemon number can suggest but cannot verify a printing',()=>{
  const pack=compileCatalog({schema:1,game:'ptcg',rows:[['fixture','Pikachu ex','fixture','53',128,'Fixture','']]});
  for(const code of ['O53/128','0537128','053\\128']){
    const read={name:'Pikachu ex',code},result=lookupCatalog(pack,read);
    assert.equal(result.cands[0]?.id,'fixture',code);
    assert.equal(result.cands[0].exact,false,code);
    assert.equal(signalEvidence('ptcg',result.cands[0].card,read).identifierUncertain,true,code);
  }
  assert.equal(lookupCatalog(pack,{name:'Pikachu ex',code:'053/128'}).cands[0].exact,true);
});

test('prefixed Pokemon fraction descriptors retain numerator namespace',()=>{
  for(const [value,number,total] of [['TG03/TG30','TG03',30],['GG01/GG70','GG01',70],['SV038/SV122','SV038',122],['H01/H32','H01',32]]){
    const query=collectorQuery('ptcg',value);
    assert(query,value);
    assert.equal(collectorMatches('ptcg',{number,total},query),true,value);
    assert.equal(collectorMatches('ptcg',{number:number.replace(/[A-Z]/g,''),total},query),false,value);
  }
  assert.equal(collectorQuery('ptcg','TG03/GG30'),null,'conflicting subset prefixes are not silently discarded');
  assert.equal(collectorQuery('mtg','3/TG30'),null,'Pokemon-only namespace handling cannot alter Magic');
});

test('gallery descriptor narrows to its correct printing for review',()=>{
  const items=[{number:'03',total:30},{number:'TG03',total:30},{number:'GG03',total:70}];
  const result=narrowPrintings('ptcg',items,collectorQuery('ptcg','TG03/TG30'),x=>x);
  assert.deepEqual(result.items,[items[1]]);
});

test('prefixed Pokemon collector zero padding normalizes in either direction',()=>{
  for(const [prefix,total] of [['TG',30],['GG',70],['SV',122]]){
    for(const [observed,stored] of [['03','3'],['3','03']]){
      const query=collectorQuery('ptcg',`${prefix}${observed}/${prefix}${total}`);
      assert.equal(collectorMatches('ptcg',{number:prefix+stored,total},query),true);
      assert.equal(collectorMatches('ptcg',{number:stored,total},query),false,'bare number cannot alias a subset');
      assert.equal(collectorMatches('ptcg',{number:'ZZ'+stored,total},query),false,'different subset remains distinct');
    }
  }
});

test('Yu-Gi-Oh passcodes require a complete numeric token',()=>{
  assert.deepEqual(ygoPasscodes('89631139 © 2020'),['89631139']);
  assert.deepEqual(ygoPasscodes('00000001'),['1'],'leading zeros retain numeric provider identity');
  for(const text of ['A89631139B','CODE-89631139','89631139/999','_89631139_','189631139'])assert.deepEqual(ygoPasscodes(text),[],text);
});

test('name candidate budgets stay bounded after intact-title preservation',()=>{
  for(const game of ['mtg','ptcg','ygo'])assert(nameCandidates(game,'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta\nOne Two Three Four Five').length<=6);
});
