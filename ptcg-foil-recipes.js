// Pokémon foil treatments: one row of data each, drawn by one shader (ptcg-foil.js). Holo rares foil
// the art window behind the Pokémon (which sits on white ink), reverse holos foil everything but the
// art, and full-art cards foil the whole face, textured on the eras that emboss it. Each era printed
// its own foil sheet, so the pattern follows the set; the variant's own foil (cosmos, Poké Ball,
// Master Ball, gold) wins when the provider names one. Approximate simulations, not physical matches.
export const PTCG_PATTERN={wotc:1,crystal:2,lines:3,sheen:4,sparkle:5,cosmos:6,firework:7,mirror:8,pokeball:9,masterball:10,texture:11,strokes:12,shiny:13,diagonal:14,confetti:15,ancient:16,emblem:17,cracked:18,
 rainbowMirror:19,bigGlitter:20,energy2:21,pinwheel:22,emerald:23,ballHologram:24,vsheenRainbow:25,vsheen:26,cosmosPixel:27,cosmosHd:28,tinsel:29,tinsel2:30,diagonalLeft:31,horizontal:32,striped:33,
 prism:34,starlight2:35,waterWeb:36,radiant:37,glitter:38,glitterSheen:39,aceSpec:40,prismaticBall:41,rcDots:42,starfoil:43,sequin:44,crosshatch:45,tcgClassic:46,acidWash:47,disco:48};
export const PTCG_TINT={rainbow:0,gold:1,silver:2,magenta:3};
const P=PTCG_PATTERN,T=PTCG_TINT;
// soft: full-art cards keep their attack text readable, so the lower half of the card is foiled lightly.
const r=(label,pat,o={})=>({label,pat,tint:o.tint??T.rainbow,underbase:o.underbase??0,relief:o.relief??0,sparkle:o.sparkle??0,soft:o.soft??0,strip:o.strip??0,strength:o.strength??0,coat:o.coat??0,note:o.note||''});
export const PTCG_FOIL_RECIPES={
 'ptcg-wotc-holo':r('WotC holo',P.wotc,{underbase:1,sparkle:.4,note:'1999-2001 holo: streaked starlight foil with four-point stars at three sizes, fixed in the foil, each lighting at its own angle behind the Pokémon; the Pokémon itself sits on white ink.'}),
 'ptcg-lc-holo':r('Legendary Collection holo',P.wotc,{underbase:1,sparkle:.4,note:'WotC-style starlight holo behind the Pokémon.'}),
 'ptcg-ecard-holo':r('e-Card holo',P.crystal,{underbase:1,sparkle:.5,strip:1,note:'e-Card era holo: a fine crystalline foil that breaks the light into small facets; the e-Reader dashes down the left border are holo too.'}),
 'ptcg-ex-holo':r('EX-era holo',P.cosmos,{underbase:1,note:'2003-2011 holo (EX to HeartGold SoulSilver): Cosmos circles behind the Pokémon.'}),
 'ptcg-classic-holo':r('Holo rare',P.sheen,{underbase:1,note:'Broad rainbow sheen behind the Pokémon (Diamond & Pearl to Sword & Shield).'}),
 'ptcg-sv-holo':r('Scarlet & Violet holo',P.mirror,{underbase:1,sparkle:.35,note:'Scarlet & Violet and Mega Evolution holo: a smooth mirror foil with a light sparkle behind the Pokémon.'}),
 'ptcg-cosmos':r('Cosmos holo',P.cosmos,{underbase:1,note:'Cosmos foil: scattered circles of every size that light up in turn.'}),
 'ptcg-reverse':r('Reverse holo',P.mirror,{note:'Everything but the art is foil: frame, text box and borders.'}),
 'ptcg-lc-reverse':r('Legendary Collection reverse',P.firework,{note:'The famous firework reverse: starbursts across everything but the art.'}),
 'ptcg-ecard-reverse':r('e-Card reverse',P.crystal,{sparkle:.4,note:'e-Card reverse: crystalline foil everywhere but the art.'}),
 'ptcg-sv-reverse':r('Scarlet & Violet reverse',P.mirror,{sparkle:.15,note:'Sparkle foil everywhere but the art.'}),
 'ptcg-cosmos-reverse':r('Cosmos reverse',P.cosmos,{note:'Cosmos circles everywhere but the art.'}),
 'ptcg-pokeball':r('Poké Ball reverse',P.pokeball,{coat:1,note:'Poké Ball stamps in a top-side coat: each ball shines over the printed ink, the rest of the card stays as printed.'}),
 'ptcg-masterball':r('Master Ball reverse',P.masterball,{coat:1,note:'Master Ball stamps in a top-side coat over the printed ink.'}),
 'ptcg-emblem-reverse':r('Energy Symbols reverse',P.emblem,{note:'Energy-symbol and set-logo reverse holos: rows of small emblems whose odd and even icons flash on opposite tilts (approximate shapes).'}),
 'ptcg-cracked-reverse':r('Cracked Ice reverse',P.cracked,{sparkle:.2,note:'Cracked Ice shards everywhere but the art.'}),
 'ptcg-cracked-ice':r('Cracked Ice holo',P.cracked,{underbase:1,sparkle:.2,note:'Cracked Ice holo: large shards of foil, each catching the light at its own angle, behind the Pokémon.'}),
 'ptcg-full-art':r('Full-art holo',P.diagonal,{soft:1,note:'The whole card is foil, smooth, with a 45° rainbow band that sweeps across it.'}),
 'ptcg-textured':r('Textured full art',P.texture,{relief:.5,soft:1,note:'Embossed full art: raised grooves follow the artwork, so the light ripples around it.'}),
 'ptcg-rainbow':r('Rainbow rare',P.texture,{relief:.5,sparkle:.4,soft:1,note:'Rainbow-tinted, textured full art.'}),
 'ptcg-gold':r('Gold secret rare',P.texture,{tint:T.gold,relief:.5,soft:1,note:'Gold foil with embossed texture.'}),
 'ptcg-illustration':r('Illustration rare',P.strokes,{relief:0,sparkle:.3,soft:1,strength:.9,note:'The whole illustration is foil. Ordinary Illustration Rares are not the textured Special Illustration family, so no relief is added (texture unverified).'}),
 'ptcg-special-illustration':r('Special illustration rare',P.strokes,{relief:.28,sparkle:.55,soft:1,strength:1,note:'Heavily textured, whole-card foil that follows the brushwork.'}),
 'ptcg-shiny':r('Shiny rare',P.shiny,{relief:.3,sparkle:1,soft:1,note:'Sparkling shiny foil across the whole card.'}),
 'ptcg-confetti':r('Celebrations Classic Collection holo',P.confetti,{underbase:1,sparkle:.25,note:'Classic Collection reprints: Confetti holofoil, scattered flakes that each catch the light at their own angle, over a fine etched grain.'}),
 'ptcg-ancient-speckle':r('Ancient speckle holo',P.ancient,{tint:T.gold,sparkle:.3,note:'Ancient Mew: the whole face is gold foil scattered with coloured flecks of varied sizes that light up one by one as it tilts; the raised gold glyphs and lines stay solid.'}),
 'ptcg-double-rare':r('ex Starfoil',P.starfoil,{soft:1,note:'Scarlet & Violet double rare ex: crisp four-point stars at three sizes across the whole card, each firing at its own tilt.'}),
 'ptcg-rmirror-reverse':r('Rainbow Mirror reverse',P.rainbowMirror,{note:'EX-era reverse: a grain-free mirror under a film that sweeps the spectrum with the light.'}),
 'ptcg-big-glitter':r('Big Glitter holo',P.bigGlitter,{underbase:1,note:'Box-topper holo: a tight grid of hard dots, each tilted its own way.'}),
 'ptcg-energy2-reverse':r('Energy Symbols II reverse',P.energy2,{note:'Hidden Legends reverse: two rotated scatters of emblems at two sizes.'}),
 'ptcg-pinwheel-reverse':r('Pinwheel reverse',P.pinwheel,{note:'Deoxys reverse: four-bladed pinwheels, every blade its own facet.'}),
 'ptcg-emerald-reverse':r('EX Emerald reverse',P.emerald,{note:'Emerald reverse: gem octagons, four-point stars and rings in a lattice.'}),
 'ptcg-ball-hologram-reverse':r('Poké Ball Hologram reverse',P.ballHologram,{note:'Unseen Forces reverse: one large Poké Ball lit like a sphere.'}),
 'ptcg-vsheen-spectrum':r('Vertical Sheen Rainbow holo',P.vsheenRainbow,{underbase:1,note:'Call of Legends: brushed vertical hairlines with saturated bands sweeping across.'}),
 'ptcg-vsheen':r('Vertical Sheen holo',P.vsheen,{tint:T.silver,underbase:1,note:'XY and Sword & Shield holo: a silvery pillar of light sliding with the tilt.'}),
 'ptcg-cosmos-pixel':r('Cosmos II holo',P.cosmosPixel,{underbase:1,note:'Blister and POP promo cosmos: pixel-stepped orbs.'}),
 'ptcg-cosmos-hd':r('Cosmos III holo',P.cosmosHd,{underbase:1,note:'Modern promo cosmos and the 151 special Energy: soft bokeh orbs at four sizes, fixed in the foil.'}),
 'ptcg-tinsel':r('Tinsel holo',P.tinsel,{underbase:1,note:'Black & White holo: wavy horizontal ribbons with fine striations.'}),
 'ptcg-tinsel2':r('Tinsel II holo',P.tinsel2,{underbase:1,note:'Black & White holo: finer ribbons, alternate rows leaning opposite ways.'}),
 'ptcg-diagonal-left':r('Diagonal Left Sheen',P.diagonalLeft,{soft:1,note:'The mirrored −45° rainbow band.'}),
 'ptcg-horizontal':r('Horizontal Sheen holo',P.horizontal,{underbase:1,note:'A wide bar of light sweeping top to bottom.'}),
 'ptcg-striped':r('Striped Vertical Sheen holo',P.striped,{underbase:1,note:'Detective Pikachu: the vertical pillar broken into pin-stripes.'}),
 'ptcg-prism':r('Prism holo',P.prism,{underbase:1,note:'BREAK and Prism Star cards: interlocking triangular facets, each a flat mirror.'}),
 'ptcg-starlight2':r('Starlight II holo',P.starlight2,{underbase:1,note:'Evolutions: crisp four-point stars in the art box.'}),
 'ptcg-water-web':r('Water Web holo',P.waterWeb,{underbase:1,note:'Sun & Moon holo: flowing caustic ridges.'}),
 'ptcg-radiant':r('Radiant',P.radiant,{soft:1,note:'Radiant Pokémon: woven micro-diamonds catching opposite tilt axes.'}),
 'ptcg-rainbow-glitter':r('Rainbow Glitter',P.glitter,{soft:1,note:'Shiny Vault and Amazing Rares: fine coloured flakes, each lighting at its own tilt.'}),
 'ptcg-glitter-sheen':r('Rainbow Glitter Sheen',P.glitterSheen,{soft:1,note:'Shining Fates: rainbow glitter under a diagonal sheen.'}),
 'ptcg-ace-spec':r('ACE SPEC',P.aceSpec,{tint:T.magenta,soft:1,note:'ACE SPEC: a magenta circuit grid of squares and crosses.'}),
 'ptcg-prismatic-pokeball':r('Prismatic Poké Ball reverse',P.prismaticBall,{coat:1,note:'Prismatic Evolutions: radial diffraction inside each Poké Ball, coated over the ink.'}),
 'ptcg-prismatic-masterball':r('Prismatic Master Ball reverse',P.prismaticBall,{coat:1,sparkle:.3,note:'Prismatic Evolutions Master Ball: radial diffraction with a light sparkle, coated over the ink.'}),
 'ptcg-rc-dots':r('Radiant Collection',P.rcDots,{soft:1,note:'Radiant Collection: pastel dots, hearts and stars with a pearly sheen.'}),
 'ptcg-sequin':r('Sequin holo',P.sequin,{underbase:1,note:'General Mills promos: overlapping cupped discs.'}),
 'ptcg-crosshatch':r('Crosshatch holo',P.crosshatch,{underbase:1,note:'League promos: a checkerboard of ±45° grooves.'}),
 'ptcg-tcg-classic':r('TCG Classic holo',P.tcgClassic,{underbase:1,note:'TCG Classic: crushed-opal dust inside, prism bars along the border.'}),
 'ptcg-acid-wash':r('Acid Wash holo',P.acidWash,{underbase:1,note:'Rare Energy cards: marbled veins of raw foil.'}),
 'ptcg-disco':r('Disco holo',P.disco,{underbase:1,note:'Test prints: square mirror tiles that snap on in steps.'})
};
// The 39 holo patterns of the redesign brief, in brief order, and the treatment that shows each one.
export const PTCG_HOLO_PATTERNS=[['Starlight','ptcg-wotc-holo'],['Cosmos','ptcg-cosmos'],['Fireworks','ptcg-lc-reverse'],['Mirror','ptcg-reverse'],['Rainbow Mirror','ptcg-rmirror-reverse'],['Big Glitter','ptcg-big-glitter'],
 ['Energy Symbols','ptcg-emblem-reverse'],['Energy Symbols II','ptcg-energy2-reverse'],['Cracked Ice','ptcg-cracked-ice'],['Pinwheel','ptcg-pinwheel-reverse'],['EX Emerald','ptcg-emerald-reverse'],['Poké Ball Hologram','ptcg-ball-hologram-reverse'],
 ['Vertical Sheen Rainbow','ptcg-vsheen-spectrum'],['Vertical Sheen','ptcg-vsheen'],['Cosmos II','ptcg-cosmos-pixel'],['Cosmos III','ptcg-cosmos-hd'],['Tinsel','ptcg-tinsel'],['Tinsel II','ptcg-tinsel2'],['Diagonal Right Sheen','ptcg-full-art'],
 ['Diagonal Left Sheen','ptcg-diagonal-left'],['Horizontal Sheen','ptcg-horizontal'],['Striped Vertical Sheen','ptcg-striped'],['Prism','ptcg-prism'],['Starlight II','ptcg-starlight2'],['Water Web','ptcg-water-web'],['Radiant','ptcg-radiant'],
 ['Rainbow Glitter','ptcg-rainbow-glitter'],['Rainbow Glitter Sheen','ptcg-glitter-sheen'],['ACE SPEC','ptcg-ace-spec'],['Poké Ball / Master Ball','ptcg-pokeball'],['Prismatic Poké Ball','ptcg-prismatic-pokeball'],['Radiant Collection','ptcg-rc-dots'],
 ['ex Starfoil','ptcg-double-rare'],['Sequin','ptcg-sequin'],['Crosshatch','ptcg-crosshatch'],['TCG Classic','ptcg-tcg-classic'],['Confetti','ptcg-confetti'],['Acid Wash','ptcg-acid-wash'],['Disco','ptcg-disco']].map(([name,key],i)=>({n:i+1,name,key}));
// Era defaults (the measured frame family). Black & White and XY share one frame, so the set decides there.
const ERA_HOLO={'pk-wotc':'ptcg-wotc-holo','pk-gym':'ptcg-wotc-holo','pk-neo':'ptcg-wotc-holo','pk-lc':'ptcg-lc-holo','pk-ecard':'ptcg-ecard-holo','pk-exa':'ptcg-ex-holo','pk-exb':'ptcg-ex-holo',
 'pk-dppt':'ptcg-ex-holo','pk-hgss':'ptcg-ex-holo','pk-sm':'ptcg-water-web','pk-swsh':'ptcg-vsheen','pk-sv':'ptcg-sv-holo'};
const ERA_REVERSE={'pk-lc':'ptcg-lc-reverse','pk-ecard':'ptcg-ecard-reverse','pk-exa':'ptcg-rmirror-reverse','pk-exb':'ptcg-rmirror-reverse','pk-sv':'ptcg-sv-reverse'};
// Per-set sheets, keyed by TCGdex set id. Where a set is missing, the era default applies.
// Deliberate deviations from the brief, pending scans: WotC main sets keep Starlight (TCGdex calls it "galaxy"),
// and the Scarlet & Violet reverse keeps its measured sheen.
const bw=/^bw\d+$/,xy=/^xy\d+$/;
// 151's HD Cosmos belongs to its two special holo Energy variants, not to every holo in the set, so it is not a set rule.
const SET_HOLO={col1:'ptcg-vsheen-spectrum',xy12:'ptcg-starlight2',det1:'ptcg-striped'};
const SET_REVERSE={ex5:'ptcg-energy2-reverse',ex6:'ptcg-emblem-reverse',ex8:'ptcg-pinwheel-reverse',ex9:'ptcg-emerald-reverse',ex10:'ptcg-ball-hologram-reverse',
 ex11:'ptcg-reverse',ex12:'ptcg-reverse',ex13:'ptcg-reverse',ex14:'ptcg-reverse',ex15:'ptcg-reverse',ex16:'ptcg-reverse'};
// Black & White holos are the horizontal-line Tinsel family. Which sets used the finer Tinsel II sheet is not
// evidenced (odd/even set numbers and the Dragon Vault boundary are both guesses), so it is not routed.
const setHolo=set=>SET_HOLO[set]||(bw.test(set)?'ptcg-tinsel':xy.test(set)?'ptcg-vsheen':'');
const setReverse=set=>SET_REVERSE[set]||(bw.test(set)?'ptcg-emblem-reverse':'');
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
// A provider-named pattern with no model yet: its display name, or ''. The renderer marks it approximate.
export const ptcgUnmodelledFoil=foil=>{const f=norm(foil);return /ball$/.test(f)&&!['pokeball','masterball'].includes(f)?f.replace(/ball$/,'').replace(/^./,x=>x.toUpperCase())+' Ball':'';};
// Picks the treatment. finish: holofoil | reverse-holofoil; era: the measured frame family (pk-wotc,
// pk-sv...) or '' for full art; foil: the variant's own foil name from the provider, if any; set and
// number: the TCGdex set id and the printed number, for the per-set sheets and subsets.
export function ptcgFoilEffect({finish,era='',foil='',rarity='',fullArt=false,textured=false,gold=false,set='',number=''}={}){
 const f=norm(foil),rar=norm(rarity),s=String(set||'').toLowerCase();
 if(finish==='reverse-holofoil'){
  const prismatic=s==='sv08.5';
  // Only the Poké Ball and Master Ball sheets are modelled. Love, Friend, Quick, Dusk and other Ball motifs keep
  // their own identity (ptcgUnmodelledFoil) and fall through to the plain reverse sheet; they never become Poké Balls.
  if(f==='masterball')return prismatic?'ptcg-prismatic-masterball':'ptcg-masterball';if(f==='pokeball')return prismatic?'ptcg-prismatic-pokeball':'ptcg-pokeball';if(f==='cosmos')return 'ptcg-cosmos-reverse';
  // Energy-symbol and set-logo sheets are rows of small emblems.
  if(['energy','league','setlogo','teamrocket'].includes(f))return 'ptcg-emblem-reverse';
  if(f==='crackedice')return 'ptcg-cracked-reverse';if(f==='tinsel')return 'ptcg-sv-reverse';
  return setReverse(s)||ERA_REVERSE[era]||'ptcg-reverse';
 }
 if(finish!=='holofoil')return '';
 if(f==='confetti')return 'ptcg-confetti';if(f==='ancient')return 'ptcg-ancient-speckle';
 // Special rarities print their own sheet, whatever the frame.
 if(/acespec|^rareace$/.test(rar))return 'ptcg-ace-spec';
 if(/^radiant(rare)?$/.test(rar))return 'ptcg-radiant';
 if(/amazing/.test(rar))return 'ptcg-rainbow-glitter';
 if(/prismstar|break/.test(rar))return 'ptcg-prism';
 if(/^rc\d/i.test(String(number)))return 'ptcg-rc-dots';
 if(/shiny/.test(rar)&&['sma','sm115'].includes(s)&&!fullArt)return 'ptcg-rainbow-glitter';
 if(/shiny/.test(rar)&&['swsh4.5','swsh45sv'].includes(s))return 'ptcg-glitter-sheen';
 if(fullArt){
  if(gold||f==='gold')return 'ptcg-gold';
  if(/specialillustration/.test(rar))return 'ptcg-special-illustration';
  if(/^illustrationrare/.test(rar))return 'ptcg-illustration';
  if(/rainbow/.test(rar)||f==='rainbow'||rar==='hyperrare'&&!/^(sv|me)/.test(era))return 'ptcg-rainbow';
  if(/shiny/.test(rar))return 'ptcg-shiny';
  if(rar==='doublerare')return 'ptcg-double-rare';
  return textured?'ptcg-textured':'ptcg-full-art';
 }
 if(f==='cosmos')return 'ptcg-cosmos';if(f==='crackedice')return 'ptcg-cracked-ice';
 if(f==='tinsel')return 'ptcg-tinsel';if(f==='league')return 'ptcg-crosshatch';
 if(rar==='doublerare')return 'ptcg-double-rare';
 return setHolo(s)||ERA_HOLO[era]||'ptcg-classic-holo';
}
