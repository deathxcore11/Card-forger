// Pokémon foil treatments: one row of data each, drawn by one shader (ptcg-foil.js). Holo rares foil
// the art window behind the Pokémon (which sits on white ink), reverse holos foil everything but the
// art, and full-art cards foil the whole face, textured on the eras that emboss it. Each era printed
// its own foil sheet, so the pattern follows the set; the variant's own foil (cosmos, Poké Ball,
// Master Ball, gold) wins when the provider names one. Approximate simulations, not physical matches.
export const PTCG_PATTERN={wotc:1,crystal:2,lines:3,sheen:4,sparkle:5,cosmos:6,firework:7,mirror:8,pokeball:9,masterball:10,texture:11,strokes:12,shiny:13,diagonal:14};
export const PTCG_TINT={rainbow:0,gold:1,silver:2};
const P=PTCG_PATTERN,T=PTCG_TINT;
// soft: full-art cards keep their attack text readable, so the lower half of the card is foiled lightly.
const r=(label,pat,o={})=>({label,pat,tint:o.tint??T.rainbow,underbase:o.underbase??0,relief:o.relief??0,sparkle:o.sparkle??0,soft:o.soft??0,note:o.note||''});
export const PTCG_FOIL_RECIPES={
 'ptcg-wotc-holo':r('WotC holo',P.wotc,{underbase:1,sparkle:.4,note:'1999-2001 holo: streaked starlight foil with four-point stars on three parallax depths behind the Pokémon; the Pokémon itself sits on white ink.'}),
 'ptcg-lc-holo':r('Legendary Collection holo',P.wotc,{underbase:1,sparkle:.4,note:'WotC-style starlight holo behind the Pokémon.'}),
 'ptcg-ecard-holo':r('e-Card holo',P.crystal,{underbase:1,sparkle:.5,note:'e-Card era holo: a fine crystalline foil that breaks the light into small facets.'}),
 'ptcg-ex-holo':r('EX-era holo',P.lines,{underbase:1,note:'2003-2007 holo: fine diagonal lines sweeping behind the Pokémon.'}),
 'ptcg-classic-holo':r('Holo rare',P.sheen,{underbase:1,note:'Broad rainbow sheen behind the Pokémon (Diamond & Pearl to Sword & Shield).'}),
 'ptcg-sv-holo':r('Scarlet & Violet holo',P.sparkle,{underbase:1,sparkle:.5,note:'Scarlet & Violet holo: glittering sparkle foil behind the Pokémon.'}),
 'ptcg-cosmos':r('Cosmos holo',P.cosmos,{underbase:1,note:'Cosmos foil: scattered circles of every size that light up in turn.'}),
 'ptcg-reverse':r('Reverse holo',P.mirror,{note:'Everything but the art is foil: frame, text box and borders.'}),
 'ptcg-lc-reverse':r('Legendary Collection reverse',P.firework,{note:'The famous firework reverse: starbursts across everything but the art.'}),
 'ptcg-ecard-reverse':r('e-Card reverse',P.crystal,{sparkle:.4,note:'e-Card reverse: crystalline foil everywhere but the art.'}),
 'ptcg-sv-reverse':r('Scarlet & Violet reverse',P.mirror,{sparkle:.15,note:'Sparkle foil everywhere but the art.'}),
 'ptcg-cosmos-reverse':r('Cosmos reverse',P.cosmos,{note:'Cosmos circles everywhere but the art.'}),
 'ptcg-pokeball':r('Poké Ball reverse',P.pokeball,{note:'Poké Ball pattern foil everywhere but the art.'}),
 'ptcg-masterball':r('Master Ball reverse',P.masterball,{note:'Master Ball pattern foil everywhere but the art.'}),
 'ptcg-full-art':r('Full-art holo',P.diagonal,{soft:1,note:'The whole card is foil, smooth, with a 45° rainbow band that sweeps across it.'}),
 'ptcg-textured':r('Textured full art',P.texture,{relief:.5,soft:1,note:'Embossed full art: raised grooves follow the artwork, so the light ripples around it.'}),
 'ptcg-rainbow':r('Rainbow rare',P.texture,{relief:.5,sparkle:.4,soft:1,note:'Rainbow-tinted, textured full art.'}),
 'ptcg-gold':r('Gold secret rare',P.texture,{tint:T.gold,relief:.5,soft:1,note:'Gold foil with embossed texture.'}),
 'ptcg-illustration':r('Illustration rare',P.strokes,{relief:.35,soft:1,note:'The whole illustration is foil, with texture that follows the brushwork.'}),
 'ptcg-special-illustration':r('Special illustration rare',P.strokes,{relief:.6,sparkle:.3,soft:1,note:'Heavily textured, whole-card foil that follows the brushwork.'}),
 'ptcg-shiny':r('Shiny rare',P.shiny,{relief:.3,sparkle:1,soft:1,note:'Sparkling shiny foil across the whole card.'}),
 'ptcg-double-rare':r('Double rare ex',P.diagonal,{sparkle:.15,soft:1,note:'Modern ex / V gloss: a smooth 45° oil-slick rainbow band sweeping across the whole card.'})
};
const ERA_HOLO={'pk-wotc':'ptcg-wotc-holo','pk-gym':'ptcg-wotc-holo','pk-neo':'ptcg-wotc-holo','pk-lc':'ptcg-lc-holo','pk-ecard':'ptcg-ecard-holo','pk-exa':'ptcg-ex-holo','pk-exb':'ptcg-ex-holo','pk-sv':'ptcg-sv-holo'};
const ERA_REVERSE={'pk-lc':'ptcg-lc-reverse','pk-ecard':'ptcg-ecard-reverse','pk-sv':'ptcg-sv-reverse'};
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
// Picks the treatment. finish: holofoil | reverse-holofoil; era: the measured frame family (pk-wotc,
// pk-sv...) or '' for full art; foil: the variant's own foil name from the provider, if any.
export function ptcgFoilEffect({finish,era='',foil='',rarity='',fullArt=false,textured=false,gold=false}={}){
 const f=norm(foil),rar=norm(rarity);
 if(finish==='reverse-holofoil'){
  if(f==='pokeball')return 'ptcg-pokeball';if(f==='masterball')return 'ptcg-masterball';if(f==='cosmos')return 'ptcg-cosmos-reverse';
  return ERA_REVERSE[era]||'ptcg-reverse';
 }
 if(finish!=='holofoil')return '';
 if(fullArt){
  if(gold||f==='gold')return 'ptcg-gold';
  if(/specialillustration/.test(rar))return 'ptcg-special-illustration';
  if(/^illustrationrare/.test(rar))return 'ptcg-illustration';
  if(/rainbow/.test(rar)||rar==='hyperrare'&&!/^(sv|me)/.test(era))return 'ptcg-rainbow';
  if(/shiny/.test(rar))return 'ptcg-shiny';
  if(rar==='doublerare')return 'ptcg-double-rare';
  return textured?'ptcg-textured':'ptcg-full-art';
 }
 if(f==='cosmos')return 'ptcg-cosmos';
 return ERA_HOLO[era]||'ptcg-classic-holo';
}
