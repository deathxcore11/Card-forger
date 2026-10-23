// Magic foil treatments: one row of data each, drawn by one shader. Pattern = how the foil sheet is
// structured; coverage = where it shows (whole card, frame only, or an ink found in the image);
// relief = embossed height taken from the art; film = thin-film colour instead of a grating.
// Approximate simulations from reference; not certified physical-foil matches.
export const MTG_PATTERN={traditional:1,oldborder:2,ftv:3,etched:4,textured:5,surge:6,galaxy:7,halo:8,confetti:9,doublerainbow:10,fracture:11,ripple:12,mana:13,dragonscale:14,rainbow:15,invisible:16,raised:17,silver:18,ampersand:19,scanline:20};
export const MTG_COVER={whole:0,frame:1,gold:2,neon:3,paper:4,lines:5};
export const MTG_TINT={rainbow:0,gold:1,silver:2};
const P=MTG_PATTERN,C=MTG_COVER,T=MTG_TINT;
const r=(label,era,pat,o={})=>({label,era,pat,tint:o.tint??T.rainbow,cover:o.cover??C.whole,relief:o.relief??0,film:o.film??0,sparkle:o.sparkle??0,stamp:o.stamp??0,keep:o.keep??0,note:o.note||''});
export const MTG_FOIL_RECIPES={
 'mtg-traditional':r('Traditional foil','2003–today',P.traditional,{note:'Foil under the whole card; inks tint it, dark ink absorbs it. A broad diagonal rainbow rolls across as you tilt.'}),
 'mtg-oldborder':r('Old-border foil','1999–2003',P.oldborder,{stamp:1,note:'Wider, hazier, more saturated band, with the shooting-star foil mark in the rules box.'}),
 'mtg-ftv':r('From the Vault foil','2008–2017',P.ftv,{note:'Hyper-glossy laminate: a sharp vertical mirror bar sweeps left to right.'}),
 'mtg-etched':r('Foil-etched','2020–today',P.etched,{cover:C.frame,note:'Art printed on white; the frame is frosted metal grain that sparkles instead of mirroring.'}),
 'mtg-etched-full':r('Foil-etched (borderless)','2021–today',P.etched,{note:'Borderless etched cards have no frame: the frosted metal grain runs across the whole face, art included.'}),
 'mtg-textured':r('Textured foil','2022–today',P.textured,{relief:.3,keep:.5,note:'Fine raised grooves follow the artwork\'s own contours, so light ripples around the drawing while the art and text stay clear.'}),
 'mtg-surge':r('Surge foil','2022–today',P.surge,{sparkle:.5,note:'Crossing wave fields and sparks; bands surge in different directions.'}),
 'mtg-galaxy':r('Galaxy foil','2022–today',P.galaxy,{sparkle:1,note:'Traditional foil with a field of star points that twinkle on and off.'}),
 'mtg-halo':r('Halo foil','2023–today',P.halo,{note:'A swirling halo pattern: rainbow arcs wheel around the centre.'}),
 'mtg-confetti':r('Confetti foil','2023–today',P.confetti,{note:'Scattered confetti pieces, each with its own angle, flash independently.'}),
 'mtg-doublerainbow':r('Double rainbow foil','2023–today',P.doublerainbow,{note:'Two crossed gratings: two rainbows at once, the brightest standard pattern.'}),
 'mtg-fracture':r('Fracture foil','2024–today',P.fracture,{note:'Broken-glass panels; seams catch the light as a panel turns.'}),
 'mtg-ripple':r('Ripple foil','2024–today',P.ripple,{note:'Concentric ripples spreading from the centre.'}),
 'mtg-mana':r('Mana foil','2024–today',P.mana,{note:'Mana-symbol rings pressed into the foil.'}),
 'mtg-dragonscale':r('Dragonscale foil','2025–today',P.dragonscale,{relief:.3,note:'Overlapping scales, each catching the light at its own angle.'}),
 'mtg-rainbow':r('Rainbow foil','Secret Lair',P.rainbow,{note:'Fine, high-dispersion lines: saturated rainbow at almost every angle.'}),
 'mtg-invisible':r('Invisible ink','2024',P.invisible,{note:'A hidden pattern only appears in the reflection.'}),
 'mtg-raised':r('Raised foil','2022–today',P.raised,{relief:.7,note:'Traditional foil with raised, glossy drawn lines.'}),
 'mtg-embossed':r('Embossed foil','2021–today',P.raised,{relief:.8,note:'Embossed relief over traditional foil.'}),
 'mtg-oilslick':r('Oil slick foil','2023',P.traditional,{cover:C.lines,film:1,relief:.6,note:'Black card; only the raised drawn lines are glossy, with thin-film oil colours.'}),
 'mtg-compleat':r('Step-and-compleat foil','2023',P.raised,{cover:C.paper,relief:.5,note:'Foil only where the sketch leaves bare paper; the ink lines stay matte.'}),
 'mtg-gilded':r('Gilded foil','2022',P.traditional,{tint:T.gold,cover:C.gold,relief:.6,note:'Raised gold foil on the gold ink only; the rest is matte.'}),
 'mtg-neon':r('Neon ink foil','2022–today',P.traditional,{cover:C.neon,note:'Fluorescent ink glows over the foil; neon parts stay vivid even unlit.'}),
 'mtg-silver':r('Silver foil','2024–today',P.silver,{tint:T.silver,note:'Achromatic silver mirror with only a hint of colour.'}),
 'mtg-firstplace':r('First-place foil','2025',P.silver,{tint:T.gold,note:'A gold-plated mirror sheet across the whole card.'}),
 'mtg-masterpiece':r('Masterpiece foil','2015–2017',P.silver,{tint:T.silver,note:'Zendikar Expeditions, Kaladesh Inventions, Amonkhet Invocations: a high-gloss mirror finish.'}),
 'mtg-ampersand':r('Ampersand foil','2021',P.ampersand,{note:'Traditional foil with a large glossy D&D ampersand stamped across the card (approximate shape).'}),
 'mtg-silverscreen':r('Silver screen foil','2022',P.silver,{tint:T.silver,note:'Black-and-white film look: a silver nitrate sheen over the monochrome art.'}),
 'mtg-scroll':r('Scroll foil','2023',P.silver,{tint:T.silver,cover:C.paper,note:'Parchment-matte ink; only the paper areas take a liquid-silver sheen.'}),
 'mtg-vaultboy':r('Vault Boy foil','2024',P.scanline,{note:'Fallout Pip-Boy screen: CRT scanlines rolling through the foil.'}),
 'mtg-pds':r('Premium Deck foil','2009–2011',P.ftv,{relief:0,note:'Premium Deck Series: a softer version of the From the Vault mirror bar.'}),
 'mtg-emblem':r('Set emblem foil','2025–today',P.mana,{note:'A set\'s own emblem pressed into the foil (approximate shape).'})
};
// promo_types that name a foil treatment, most specific first (oil slick cards are also raised).
const PROMO=[['oilslick','mtg-oilslick'],['stepandcompleat','mtg-compleat'],['gilded','mtg-gilded'],['neonink','mtg-neon'],['textured','mtg-textured'],
 ['surgefoil','mtg-surge'],['galaxyfoil','mtg-galaxy'],['halofoil','mtg-halo'],['confettifoil','mtg-confetti'],['doublerainbow','mtg-doublerainbow'],['serialized','mtg-doublerainbow'],
 ['fracturefoil','mtg-fracture'],['rainbowfoil','mtg-rainbow'],['ripplefoil','mtg-ripple'],['manafoil','mtg-mana'],['dragonscalefoil','mtg-dragonscale'],
 ['invisibleink','mtg-invisible'],['silverfoil','mtg-silver'],['firstplacefoil','mtg-firstplace'],['raisedfoil','mtg-raised'],['embossed','mtg-embossed'],
 ['ampersand','mtg-ampersand'],['silverscreen','mtg-silverscreen'],['scroll','mtg-scroll'],['poster','mtg-scroll'],['vaultboy','mtg-vaultboy']];
const PDS=new Set(['h09','pd2','pd3']);
// Picks the treatment from the card's own Scryfall data; finish is 'foil' or 'etched'.
export function mtgFoilEffect(c,finish='foil'){
 if(finish==='etched')return 'mtg-etched';if(finish!=='foil')return '';
 const promos=c?.promo_types||[];for(const [k,e] of PROMO)if(promos.includes(k))return e;
 // A newer set-specific foil Scryfall names (chocobotrackfoil, ...) shows as a set emblem foil, not plain traditional.
 if(promos.some(p=>/foil$/.test(p)&&p!=='foil'))return 'mtg-emblem';
 if(c?.set_type==='from_the_vault')return 'mtg-ftv';if(c?.set_type==='masterpiece')return 'mtg-masterpiece';if(PDS.has(c?.set))return 'mtg-pds';
 if(c?.frame==='1997'||c?.frame==='1993')return 'mtg-oldborder';
 return 'mtg-traditional';
}
// Rares and mythics printed in the M15 frame (2015 onward) carry the oval holo security stamp.
export const mtgHoloStamp=c=>c?.frame==='2015'&&['rare','mythic'].includes(c?.rarity)&&c?.border_color!=='borderless';
export const mtgFrameKey=c=>c?.border_color==='borderless'||c?.full_art?'borderless':c?.frame==='1993'?'1997':['1997','2003','2015'].includes(c?.frame)?c.frame:'2015';
