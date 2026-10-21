// Yu-Gi-Oh! foil recipes: one row of data per rarity, rendered by one shader (ygo-rarity-foil.js)
// and mirrored as lighter CSS layers for small tiles (finish-effects.js). A recipe says where foil
// goes (whole card, frame or border band, art), which pattern and tint, and the name metal.
// Approximate simulations from reference; not certified physical-foil matches.
export const FOIL_PATTERN={lines:1,diag:2,prism:3,glitter:4,ghost:5,emboss:6,stroke:7,mosaic:8,shatter:9,stars:10,parallel:11,qcr:12};
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
 'ygo-collector':{label:'Collector\'s Rare',art:[P.stroke,T.rainbow,1],name:'rainbow'},
 'ygo-gold':{label:'Gold Rare',art:[P.lines,T.rainbow,1],frame:[P.lines,T.gold,2],name:'gold'},
 'ygo-gold-secret':{label:'Gold Secret Rare',art:[P.diag,T.rainbow,1],frame:[P.lines,T.gold,2],name:'gold'},
 'ygo-premium-gold':{label:'Premium Gold Rare',frame:[P.glitter,T.gold,1],name:'gold'},
 'ygo-platinum':{label:'Platinum Rare',art:[P.lines,T.platinum,1],frame:[P.lines,T.platinum,2],name:'platinum'},
 'ygo-platinum-secret':{label:'Platinum Secret Rare',art:[P.diag,T.platinum,1],frame:[P.lines,T.platinum,2],name:'platinum'},
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
 rare:'ygo-rare',superrare:'ygo-super',ultrarare:'ygo-ultra',ultrararepharaohsrare:'ygo-ultra',
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
// Display order for rarity choices, plainest first (Common has no recipe and always leads).
const ORDER=['ygo-rare','ygo-parallel','ygo-rare-parallel','ygo-super','ygo-super-parallel','ygo-shatterfoil','ygo-starfoil','ygo-ultra','ygo-ultra-parallel','ygo-mosaic','ygo-gold','ygo-premium-gold','ygo-platinum','ygo-secret','ygo-ultra-secret','ygo-gold-secret','ygo-platinum-secret','ygo-prismatic','ygo-collector','ygo-ultimate','ygo-ghost','ygo-ghost-gold','ygo-quarter-century','ygo-starlight'];
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
