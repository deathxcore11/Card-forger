// Yu-Gi-Oh! foil recipes: one row of data per rarity, rendered by one shader (ygo-rarity-foil.js)
// and mirrored as lighter CSS layers for small tiles (finish-effects.js). A recipe says where foil
// goes (whole card, frame or border band, art), which pattern and tint, and the name metal.
// Approximate simulations from reference; not certified physical-foil matches.
export const FOIL_PATTERN={lines:1,diag:2,prism:3,glitter:4,ghost:5,emboss:6,stroke:7,mosaic:8,shatter:9,stars:10,parallel:11,qcr:12,hieroglyph:13,dots:14};
export const FOIL_TINT={rainbow:0,gold:1,silver:2,platinum:3};
const P=FOIL_PATTERN,T=FOIL_TINT;
// whole: [pattern,tint,rules-box share]; frame: [pattern,tint,1 frame|2 border band]; art: [pattern,tint,1 underbase gaps|2 whole art]
// name: silver | gold | rainbow | platinum; stars: level stars and attribute catch the light.
const parallel=base=>({...base,whole:[P.parallel,T.rainbow,.5]});
export const YGO_FOIL_RECIPES={
 'ygo-rare':{label:'Rare',name:'silver'},
 'ygo-super':{label:'Super Rare',art:[P.lines,T.rainbow,1]},
 'ygo-ultra':{label:'Ultra Rare',art:[P.lines,T.rainbow,1],name:'gold'},
 'ygo-secret':{label:'Secret Rare',art:[P.diag,T.rainbow,1],name:'rainbow'},
 'ygo-ultra-secret':{label:'Ultra Secret Rare',art:[P.diag,T.rainbow,1],name:'gold'},
 'ygo-prismatic':{label:'Prismatic Secret Rare',art:[P.prism,T.rainbow,1],name:'rainbow'},
 'ygo-quarter-century':{label:'Quarter Century Secret Rare',art:[P.qcr,T.platinum,1],name:'platinum'},
 'ygo-starlight':{label:'Starlight Rare',whole:[P.glitter,T.rainbow,.45],art:[P.glitter,T.rainbow,1],name:'rainbow',stars:true},
 'ygo-ghost':{label:'Ghost Rare',art:[P.ghost,T.silver,2],name:'silver'},
 'ygo-ghost-gold':{label:'Ghost/Gold Rare',art:[P.ghost,T.silver,2],frame:[P.lines,T.gold,2],name:'gold'},
 'ygo-ultimate':{label:'Ultimate Rare',art:[P.emboss,T.gold,2],frame:[P.emboss,T.gold,1],name:'gold',stars:true},
 'ygo-ultimate-classic':{label:'Ultimate Rare',art:[P.emboss,T.gold,2],frame:[P.emboss,T.gold,2],name:'gold',stars:true},
 'ygo-ultimate-prismatic':{label:'Ultimate Rare',art:[P.emboss,T.gold,2],frame:[P.glitter,T.rainbow,2],name:'gold',stars:true},
 'ygo-pharaoh':{label:'Ultra Rare (Pharaoh\'s Rare)',art:[P.lines,T.rainbow,1],frame:[P.hieroglyph,T.gold,1],name:'gold'},
 'ygo-collector':{label:'Collector\'s Rare',art:[P.stroke,T.rainbow,1],frame:[P.glitter,T.rainbow,2],name:'rainbow'},
 'ygo-gold':{label:'Gold Rare',art:[P.lines,T.rainbow,1],frame:[P.lines,T.gold,2],name:'gold'},
 'ygo-gold-secret':{label:'Gold Secret Rare',art:[P.diag,T.rainbow,1],frame:[P.lines,T.gold,2],name:'gold'},
 'ygo-premium-gold':{label:'Premium Gold Rare',frame:[P.glitter,T.gold,1],name:'gold'},
 'ygo-platinum':{label:'Platinum Rare',art:[P.lines,T.platinum,1],frame:[P.lines,T.platinum,2],name:'platinum'},
 'ygo-platinum-secret':{label:'Platinum Secret Rare',whole:[P.diag,T.platinum,.5],name:'platinum'},
 'ygo-mosaic':{label:'Mosaic Rare',art:[P.mosaic,T.rainbow,1],name:'gold'},
 'ygo-shatterfoil':{label:'Shatterfoil Rare',whole:[P.shatter,T.rainbow,.5],name:'silver'},
 'ygo-starfoil':{label:'Starfoil Rare',whole:[P.stars,T.rainbow,.5],name:'silver'},
 'ygo-parallel':parallel({label:'Normal Parallel Rare'}),
 'ygo-rare-parallel':parallel({label:'Rare Parallel Rare',name:'silver'}),
 'ygo-super-parallel':parallel({label:'Super Parallel Rare',art:[P.lines,T.rainbow,1]}),
 'ygo-ultra-parallel':parallel({label:'Ultra Parallel Rare',art:[P.lines,T.rainbow,1],name:'gold'})
};
// Every foil rarity string seen in the Yu-Gi-Oh! catalogue (normalised: lowercase, letters/digits only).
const RARITY_EFFECT={
 rare:'ygo-rare',superrare:'ygo-super',ultrarare:'ygo-ultra',ultrararepharaohsrare:'ygo-pharaoh',
 secretrare:'ygo-secret',extrasecretrare:'ygo-secret',extrasecret:'ygo-secret','10000secretrare':'ygo-secret',ultrasecretrare:'ygo-ultra-secret',
 prismaticsecretrare:'ygo-prismatic',quartercenturysecretrare:'ygo-quarter-century',starlightrare:'ygo-starlight',
 ghostrare:'ygo-ghost',ghostgoldrare:'ygo-ghost-gold',ultimaterare:'ygo-ultimate',collectorsrare:'ygo-collector',
 goldrare:'ygo-gold',goldsecretrare:'ygo-gold-secret',premiumgoldrare:'ygo-premium-gold',
 platinumrare:'ygo-platinum',platinumsecretrare:'ygo-platinum-secret',mosaicrare:'ygo-mosaic',shatterfoilrare:'ygo-shatterfoil',
 starfoilrare:'ygo-starfoil',starfoil:'ygo-starfoil',
 normalparallelrare:'ygo-parallel',duelterminalnormalparallelrare:'ygo-parallel',
 duelterminalrareparallelrare:'ygo-rare-parallel',duelterminalnormalrareparallelrare:'ygo-rare-parallel',
 superparallelrare:'ygo-super-parallel',duelterminalsuperparallelrare:'ygo-super-parallel',
 ultraparallelrare:'ygo-ultra-parallel',duelterminalultraparallelrare:'ygo-ultra-parallel'
};
export const ygoRarityEffect=normalized=>RARITY_EFFECT[normalized]||'';
// Duel Terminal parallel rares by series: DT01–DT04 print a square dot matrix, DT05–DT07 shattered ice.
for(const k of ['ygo-parallel','ygo-rare-parallel','ygo-super-parallel','ygo-ultra-parallel'])for(const [suffix,pat] of [['dots',P.dots],['shatter',P.shatter]])
 YGO_FOIL_RECIPES[`${k}-${suffix}`]={...YGO_FOIL_RECIPES[k],whole:[pat,T.rainbow,.5]};
// Modern foil layout (Attribute and Level/Rank stars foiled on Super, Ultra and Secret Rares; Gen 2
// Ultimate Rares) starts with Breakers of Shadow.
export const YGO_MODERN_FROM='2016-02-04';
// The SELECTED printing's own release, so set, search, collection and pack views resolve one printing the
// same way. The set prefix comes from its printed code (OP16-EN001 -> OP16); the date from its exact named
// release in the catalogue (registered by tcg.js). The browsing page's set context is used only when it is
// that same release. Missing data stays missing: no date means the date-based rules do not apply.
let releaseLookup=()=>[];
export const setYgoReleaseLookup=fn=>{releaseLookup=typeof fn==='function'?fn:()=>[];};
export function ygoPrintingRelease(printing,setContext=null){
 const code=(String(printing?.code||'').match(/^([A-Z0-9]+)-/i)?.[1]||'').toUpperCase(),name=String(printing?.name||'').normalize('NFC').trim();
 const same=setContext&&String(setContext.name||'').normalize('NFC').trim()===name&&(!code||String(setContext.code||'').toUpperCase()===code);
 if(same)return {code,date:String(setContext.date||''),source:'set-context'};
 let found=[];try{found=(name&&code?releaseLookup(name,code):[])||[];}catch{}
 const dates=[...new Set(found.map(r=>String(r?.date||'')).filter(Boolean))];
 return {code,date:dates.length===1?dates[0]:'',source:dates.length===1?'catalogue':dates.length?'ambiguous':'missing'};
}
// The printing's own set picks the generation of a rarity: Ultimate Rares (classic art-and-rim relief
// before BOSH, full-frame relief after, a sparkle border from OTS Pack 16 and the Rarity Collections)
// and Duel Terminal parallels. code: the set code (DT05, OP16, RA01...); date: the print date.
export function ygoSetEffect(effect,{code='',date=''}={}){
 const c=String(code||'').toUpperCase(),d=String(date||'');
 if(effect==='ygo-ultimate'){if(/^(?:OP(?:1[6-9]|2\d|30)|RA0[1-5])$/.test(c))return 'ygo-ultimate-prismatic';if(d&&d<YGO_MODERN_FROM)return 'ygo-ultimate-classic';return effect;}
 const dt=c.match(/^DT0([1-7])$/);if(dt&&/parallel$/.test(effect))return `${effect}-${Number(dt[1])<=4?'dots':'shatter'}`;
 return effect;
}
// Display order for rarity choices, plainest first (Common has no recipe and always leads).
const ORDER=['ygo-rare','ygo-parallel','ygo-rare-parallel','ygo-super','ygo-super-parallel','ygo-shatterfoil','ygo-starfoil','ygo-ultra','ygo-pharaoh','ygo-ultra-parallel','ygo-mosaic','ygo-gold','ygo-premium-gold','ygo-platinum','ygo-secret','ygo-ultra-secret','ygo-gold-secret','ygo-platinum-secret','ygo-prismatic','ygo-collector','ygo-ultimate','ygo-ghost','ygo-ghost-gold','ygo-quarter-century','ygo-starlight'];
export const ygoRarityRank=effect=>effect?ORDER.indexOf(effect)+1||ORDER.length:0;
// A small swatch hinting at each recipe's metal and pattern (CSS class suffix).
export function ygoRaritySwatch(effect){
 const r=YGO_FOIL_RECIPES[effect];if(!r)return 'plain';
 const art=r.art?.[0],whole=r.whole?.[0],tint=(r.frame||r.art||r.whole)?.[1];
 if(whole===P.glitter||art===P.glitter)return 'glitter';
 if(art===P.ghost)return 'ghost';if(art===P.emboss)return 'emboss';
 if(tint===T.gold||r.frame?.[1]===T.gold)return 'gold';if(tint===T.platinum)return 'platinum';
 if(art===P.prism)return 'prism';if(art===P.diag||art===P.qcr)return 'diagonal';
 if(whole===P.parallel)return 'parallel';if(whole)return 'foilcard';
 if(!r.art)return r.name==='silver'?'silver':'plain';
 return r.name==='gold'?'ultra':'rainbow';
}
