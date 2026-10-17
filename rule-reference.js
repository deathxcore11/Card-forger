// Canonical, game-scoped source identities. No DOM, storage, network or AI calls.
export const RULE_VERSIONS = {
  "mtg": "c7f3846b799a29021d011421770f5383ffa9283421b4fdf1efb57609b10c11c6",
  "ptcg": "e6e683f5305178ef5c6f9a8e91f2610ed847469d8e737da541acc17c44c8b5aa",
  "ygo": "d1c88f48bd56f75d0e098fbc87ea5bc40ad58ddc412f89f2efd0fc625cf5774b"
};
export const RULE_SOURCES = {
  "mtg": [
    {
      "title": "Comprehensive Rules",
      "date": "2026-09-25",
      "url": "https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.pdf",
      "legacy": false,
      "pages": 312,
      "organization": "Wizards of the Coast",
      "kind": "pdf",
      "fallbackUrl": "https://magic.wizards.com/en/rules",
      "verification": "Official PDF checked 2026-10-17."
    },
    {
      "title": "M14 beginner guide",
      "date": "2013",
      "url": "https://magic.wizards.com/en/rules",
      "legacy": true,
      "pages": 36,
      "organization": "Wizards of the Coast",
      "kind": "official-page",
      "fallbackUrl": "https://magic.wizards.com/en/rules",
      "verification": "Bundled edition; official source page checked 2026-10-17."
    }
  ],
  "ptcg": [
    {
      "title": "Pokémon rulebook",
      "date": "2026-09",
      "url": "https://play.pokemon.com/en-us/resources/rules/",
      "legacy": false,
      "pages": 44,
      "organization": "The Pokémon Company",
      "kind": "official-page",
      "fallbackUrl": "https://play.pokemon.com/en-us/resources/rules/",
      "verification": "Bundled edition; official source page checked 2026-10-17."
    },
    {
      "title": "Tournament handbook",
      "date": "2026-09-01",
      "url": "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tcg-tournament-handbook-en.pdf",
      "legacy": false,
      "pages": 27,
      "organization": "The Pokémon Company",
      "kind": "pdf",
      "fallbackUrl": "https://play.pokemon.com/en-us/resources/rules/",
      "verification": "Official link checked 2026-10-17; live PDF contents could not be verified."
    },
    {
      "title": "Card errata",
      "date": "2026-08-17",
      "url": "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/tcg_errata.pdf",
      "legacy": false,
      "pages": 11,
      "organization": "The Pokémon Company",
      "kind": "pdf",
      "fallbackUrl": "https://play.pokemon.com/en-us/resources/rules/",
      "verification": "Official link checked 2026-10-17; live PDF contents could not be verified."
    },
    {
      "title": "Alternative play",
      "date": "Supplied edition",
      "url": "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/tcg-alternative-play-handbook-en.pdf",
      "legacy": false,
      "pages": 32,
      "organization": "The Pokémon Company",
      "kind": "pdf",
      "fallbackUrl": "https://play.pokemon.com/en-us/resources/rules/",
      "verification": "Official link checked 2026-10-17; live PDF contents could not be verified."
    }
  ],
  "ygo": [
    {
      "title": "Rulebook version 10",
      "date": "Version 10 (legacy)",
      "url": "https://www.yugioh-card.com/en/downloads/rulebook/SD_RuleBook_EN_10.pdf",
      "legacy": true,
      "pages": 31,
      "organization": "Konami",
      "kind": "pdf",
      "fallbackUrl": "https://www.yugioh-card.com/en/rulebook/",
      "verification": "Official PDF checked 2026-10-17. These legacy examples do not establish every card-specific interaction, including removal versus negation; use current card text and applicable rulings."
    },
    {
      "title": "Link Strike beginner guide",
      "date": "2017",
      "url": "https://www.yugioh-card.com/en/downloads/rulebook/YS17_BG_EN.pdf",
      "legacy": true,
      "pages": 17,
      "organization": "Konami",
      "kind": "pdf",
      "fallbackUrl": "https://www.yugioh-card.com/en/rulebook/",
      "verification": "Official PDF checked 2026-10-17."
    }
  ]
};
const official = {
 ygo: {
  '2021 Rules Update': {kind:'official-page',game:'ygo',key:'2021 Rules Update',label:'2021 Rules Update',title:'2021 Rules Update',organization:'Konami',date:'2021',url:'https://www.yugioh-card.com/en/play/2021_rules_update/',summary:'This later official update changes Extra Deck placement and several activation rules. Read it alongside the older bundled books; the update is not included in their searchable text.',verified:'Official page checked 2026-10-17.'},
  'Once-per-turn restrictions': {kind:'official-page',game:'ygo',key:'Once-per-turn restrictions',label:'Once-per-turn restrictions',title:'Problem-Solving Card Text: activation conditions',organization:'Konami',date:'2011-06-01',url:'https://www.yugioh-card.com/en/play/psct/psct-3/',summary:'This official explanation covers activation conditions and limits on when or how often effects activate. It does not by itself establish the difference between use and activate restrictions after negation. Read the exact current card text and applicable rulings before deciding whether that effect can be used again.',verified:'Official page checked 2026-10-17; general text guidance, not a complete once-per-turn ruling.'},
  'Other Rules': {kind:'official-page',game:'ygo',key:'Other Rules',label:'Costs, targets and effect text',title:'Problem-Solving Card Text: Conditions, Activations, and Effects',organization:'Konami',date:'2011-06-01',url:'https://www.yugioh-card.com/en/play/psct/psct-3/',summary:'Konami’s explanation of the colon and semicolon in effect text. Activation conditions, activation actions and resolution are different parts of an effect; use the complete current wording of the card.',verified:'Official page checked 2026-10-17.'}
 }
};
// These are inspected passage identities, not search terms or a guessed first result.
const passageIds = {
 ptcg: {'Turn Actions':'0-p10','Setting Up to Play':'0-p8','Attach an Energy':'0-p11','Rare Candy':'2-p2','Pokémon Tool':'2-p1','Special Conditions':'0-p15','Pokémon Checkup':'0-p15','Prizes':'0-p14','Card errata':'2-p1','Evolve':'0-p11','Trainer':'0-p12','Retreat':'0-p12','Attack':'0-p13','Supporter':'0-p12','Pokémon-GX':'0-p34','Energy':'0-p13'},
 ygo: {'Turn Structure':'0-p20','Summoning Monster Cards':'0-p15','Chains and Spell Speed':'0-p25','Link Monsters':'0-p9','Monster Battle Rules':'0-p23','Things you need to Duel':'0-p4','Draw Phase':'0-p20','Standby Phase':'0-p20','Main Phase':'0-p21','Battle Phase':'0-p21','Main Phase 2':'0-p23','End Phase':'0-p23','Spell Speed':'0-p25','Quick-Play':'0-p17','Chains':'0-p25'}
};
export function normalizeRuleId(id){return String(id??'').trim().toLowerCase().replace(/\.$/,'');}
export function entryReference(game,entryId,label=entryId){
 if(!RULE_VERSIONS[game])return null;
 const id=normalizeRuleId(entryId),doc=game==='mtg'&&!/^\d+-p\d+$/.test(id)?0:Number(id.split('-p')[0]);
 if(!Number.isInteger(doc)||!RULE_SOURCES[game][doc])return null;
 return {kind:'bundled-entry',game,version:RULE_VERSIONS[game],doc,entryId:String(entryId),label:String(label)};
}
export function lessonReference(game,label){
 const external=official[game]?.[label];if(external)return {...external};
 const id=(game==='mtg'&&label==='701'?'701.21':passageIds[game]?.[label])||(game==='mtg'&&/^\d{3}(?:\.\d+[a-z]?)?\.?$/i.test(String(label))?label:null);
 return id?entryReference(game,id,label):null;
}
export function sourceDestination(source,page){
 if(!source)return null;
 const pdf=source.kind==='pdf',url=pdf&&Number.isInteger(page)&&page>0?source.url.split('#')[0]+'#page='+page:source.url;
 return {kind:pdf?'pdf':'official-page',url,label:pdf?(page?'Open PDF at page '+page:'Open / save official PDF'):'Open official source page',fallbackUrl:source.fallbackUrl||source.url};
}
// The supplied MTG extraction repeats six IDs in wrapped cross-reference fragments.
// Pin their actual rule pages for this corpus hash; keep every raw entry searchable.
const canonicalMtgPages={'613.7':114,'701.22a':131,'701.68a':144,'601.2b':90,'704':195,'810.9':244};
export function findRuleEntry(pack,id,doc=0){
 const normalized=normalizeRuleId(id),matches=(pack?.entries||[]).filter(e=>e.doc===doc&&normalizeRuleId(e.id)===normalized);
 const page=pack?.game==='mtg'?canonicalMtgPages[normalized]:null;
 return (page?matches.find(e=>e.page===page):matches[0])||null;
}
export function resolveRuleReference(pack,reference){
 if(!reference||!RULE_VERSIONS[reference.game])return null;
 if(reference.kind==='official-page')return official[reference.game]?.[reference.key]?{reference:{...official[reference.game][reference.key]},entries:[],source:null}:null;
 if(reference.kind!=='bundled-entry'||!pack||pack.game!==reference.game||reference.version!==RULE_VERSIONS[pack.game]||(pack.version&&pack.version!==reference.version))return null;
 const id=normalizeRuleId(reference.entryId),entry=findRuleEntry(pack,id,reference.doc);
 if(!entry)return null;
 const source=RULE_SOURCES[pack.game][entry.doc];if(!source)return null;
 const descendants=pack.game==='mtg'&&/^\d{3}(?:\.\d+)?$/.test(id)?pack.entries.filter(e=>{const next=normalizeRuleId(e.id);return e.doc===entry.doc&&(id.includes('.')?next.startsWith(id)&&/^[a-z]+$/.test(next.slice(id.length)):next.startsWith(id+'.'))&&findRuleEntry(pack,e.id,e.doc)===e;}):[];
 return {reference:{...entryReference(pack.game,entry.id,reference.label),page:entry.page},entry,entries:[entry,...descendants],source,destination:sourceDestination(source,entry.page)};
}
export function lessonMatches(lesson,query){const terms=String(query||'').toLowerCase().trim().split(/\s+/).filter(Boolean);return terms.every(t=>Object.values(lesson).join(' ').toLowerCase().includes(t));}
export function searchRulebook(pack,query='',doc='',chapter=''){
 const q=String(query).trim().toLowerCase(),id=normalizeRuleId(q);
 return (pack?.entries||[]).filter(e=>(doc===''||String(e.doc)===String(doc))&&(!chapter||e.chapter===chapter)&&(normalizeRuleId(e.id)===id||lessonMatches(e,q))).sort((a,b)=>{const score=e=>normalizeRuleId(e.id)===id?(findRuleEntry(pack,e.id,e.doc)===e?2:1):0;return score(b)-score(a);});
}
// Useful to exhaustively verify that every teaching link stays resolvable.
export const LESSON_REFERENCE_IDS=passageIds;

export function validateDecodedRulePack(pack,game,{count,version=RULE_VERSIONS[game]}={}){
 if(!RULE_VERSIONS[game]||version!==RULE_VERSIONS[game]||pack?.schema!==1||pack.game!==game||!Array.isArray(pack.entries)||!Array.isArray(pack.sources)||pack.sources.length!==RULE_SOURCES[game].length||(count!==undefined&&pack.entries.length!==count))return false;
 return pack.entries.every(e=>{return typeof e.id==='string'&&typeof e.title==='string'&&typeof e.text==='string'&&Number.isInteger(e.doc)&&!!RULE_SOURCES[game][e.doc]&&Number.isInteger(e.page)&&e.page>0;});
}
const keywordIds={
 mtg:{flying:'702.9',reach:'702.17',trample:'702.19',haste:'702.10',vigilance:'702.20',deathtouch:'702.2',lifelink:'702.15','first strike':'702.7','double strike':'702.4',hexproof:'702.11',ward:'702.21',indestructible:'702.12',flash:'702.8',equip:'702.6',scry:'701.22',surveil:'701.25',exile:'701.13',sacrifice:'701.21'},
 ptcg:{Ability:'0-p12',Supporter:'0-p12','Active Pokémon':'0-p7',Bench:'0-p10','Prize cards':'0-p14','Knocked Out':'0-p14',Asleep:'0-p15',Paralyzed:'0-p16',Confused:'0-p16',Poisoned:'0-p16',Burned:'0-p15',retreat:'0-p12','damage counters':'0-p14'},
 ygo:{'Quick Effect':'0-p25','once per turn':'0-p8','Special Summon':'0-p15','Fusion Summoned':'0-p14','Normal Summon':'0-p15',banish:'0-p29',GY:'0-p5',negate:'0-p26','End Phase':'0-p23'}
};
export function keywordReference(game,key){return game==='ygo'&&key==='once per turn'?lessonReference(game,'Once-per-turn restrictions'):game==='ygo'&&key==='target'?lessonReference(game,'Other Rules'):keywordIds[game]?.[key]?entryReference(game,keywordIds[game][key],key):null;}

// Keep PDF diagrams/headers available, but show the actual Draw passage first.
export function visibleRulePassage(game,entry){
 if(game==='ptcg'&&entry.id==='0-p10'){const at=entry.text.indexOf('Turn Actions');if(at>=0)return {text:entry.text.slice(at),fullText:entry.text};}
 return {text:entry.text,fullText:null};
}
