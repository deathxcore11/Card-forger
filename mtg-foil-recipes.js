// Magic foil treatments: one row of data each. Pattern = how the foil sheet is structured; coverage =
// where it shows (whole card, frame only, or an ink found in the image); relief = raised height taken from
// the art; film = thin-film colour instead of the sheet's bands. mtg-foil-shader.js composes one small
// shader per row from these values.
// Approximate simulations from reference; not certified physical-foil matches.
// 19 (gloss) is a foil under a clear glossy coat, with or without a big emblem (mtgFoilEmblem). 20 was the
// Vault Boy scanline look, which is a card style and not a foil. 21 is the native app's facet foil, so
// step-and-compleat is 22.
export const MTG_PATTERN={traditional:1,oldborder:2,ftv:3,etched:4,textured:5,surge:6,galaxy:7,halo:8,confetti:9,doublerainbow:10,fracture:11,ripple:12,mana:13,dragonscale:14,rainbow:15,invisible:16,raised:17,silver:18,gloss:19,compleat:22};
// stamped: the whole card is foil and the gold ink on top of it is raised and glossy.
export const MTG_COVER={whole:0,frame:1,gold:2,neon:3,paper:4,lines:5,stamped:6};
export const MTG_TINT={rainbow:0,gold:1,silver:2};
const P=MTG_PATTERN,C=MTG_COVER,T=MTG_TINT;
const r=(label,era,pat,o={})=>({label,era,pat,tint:o.tint??T.rainbow,cover:o.cover??C.whole,relief:o.relief??0,film:o.film??0,sparkle:o.sparkle??0,stamp:o.stamp??0,keep:o.keep??0,note:o.note||''});
export const MTG_FOIL_RECIPES={
 'mtg-traditional':r('Traditional foil','2003–today',P.traditional,{note:'Foil under the whole card; inks tint it, dark ink absorbs it. A broad diagonal rainbow rolls across as you tilt.'}),
 'mtg-oldborder':r('Old-border foil','1999–2003',P.oldborder,{stamp:1,note:'Wider, hazier, more saturated band, with the shooting-star foil mark in the rules box.'}),
 'mtg-ftv':r('From the Vault foil','2008–2017',P.ftv,{note:'A heavy gloss coat over the foil: one upright gold bar crosses the card with the light.'}),
 'mtg-etched':r('Foil-etched','2020–today',P.etched,{cover:C.frame,note:'Art printed flat; the frame is metal ink. Dull away from the light, brighter metal in its own colour under it, with grains that flash one by one.'}),
 'mtg-etched-full':r('Foil-etched (borderless)','2021–today',P.etched,{note:'Borderless etched cards have no frame: the frosted metal grain runs across the whole face, art included.'}),
 'mtg-textured':r('Textured foil','2022–today',P.textured,{relief:.15,keep:.5,note:'Fine raised grooves follow the artwork\'s own contours, so light ripples around the drawing while the art and text stay clear.'}),
 'mtg-surge':r('Surge foil','2022–today',P.surge,{note:'Ragged streaks of silver rising to the right with pale colour inside them, strongest on light ink. Which streaks light up changes as the card turns.'}),
 'mtg-galaxy':r('Galaxy foil','2022–today',P.galaxy,{sparkle:1,note:'A dense field of white specks with a few planets and small pastel stars, strongest over dark ink.'}),
 'mtg-halo':r('Halo foil','2023–today',P.halo,{note:'A swirled sheet: one large blue-white streak crosses the card with the light, with a small pink-violet streak beside it.'}),
 'mtg-confetti':r('Confetti foil','2023–today',P.confetti,{note:'Tiny glitter dots packed over dark ink, each its own colour, flashing one by one. They stop where the dark ink stops.'}),
 'mtg-doublerainbow':r('Double rainbow foil','2023–today',P.doublerainbow,{note:'Two crossed gratings: two rainbows at once, the brightest standard pattern.'}),
 'mtg-fracture':r('Fracture foil','2024–today',P.fracture,{note:'A crust of tiny silver chips on the border strip, each with its own tilt and cool colour. Inside the art only a few specks on light ink.'}),
 'mtg-ripple':r('Ripple foil','2024–today',P.ripple,{note:'A few wide, thin rings running off the card, yellow-green drifting to orange and pink, glowing only near the light.'}),
 'mtg-mana':r('Mana foil','2024–today',P.mana,{note:'Mana-symbol rings pressed into the foil.'}),
 'mtg-dragonscale':r('Dragonscale foil','2025–today',P.dragonscale,{note:'Round-tipped scales that overlap like roof tiles, in rows that bow and shrink toward the right. Each scale is a pale ice-blue or lilac facet with a bright lower rim.'}),
 'mtg-rainbow':r('Rainbow foil','Secret Lair',P.rainbow,{note:'Secret Lair rainbow foil: a traditional foil with stronger colour.'}),
 'mtg-invisible':r('Invisible ink','2024',P.invisible,{note:'Close to a plain card in room light, a flat silver-white sheen under a lamp. The hidden case notes only show under black light and differ on every card, so none are drawn.'}),
 'mtg-raised':r('Raised foil','2022–today',P.raised,{cover:C.stamped,relief:.6,note:'A traditional foil card whose gold frame ornament is raised and glossy. The art itself stays flat.'}),
 'mtg-embossed':r('Embossed foil','2021–today',P.gloss,{note:'Jurassic World emblem cards: only the emblem is foil, in flat prism chips that each flash one colour; the rest of the card is plain. Other embossed promos draw as a foil under a glossy coat.'}),
 'mtg-oilslick':r('Oil slick foil','2023',P.traditional,{film:1,note:'Black art over foil: one narrow upright band of gold, orange, purple and blue crosses the card as it turns. Outside the band the card is near black.'}),
 'mtg-compleat':r('Step-and-compleat foil','2023',P.compleat,{note:'Rows of the Phyrexian mark pressed into the foil across the whole card; each mark lights in one pure colour, even over black.'}),
 'mtg-gilded':r('Gilded foil','2022',P.traditional,{cover:C.stamped,relief:.6,note:'A traditional foil card with raised, hot-stamped gold on the gold parts of its frame.'}),
 'mtg-neon':r('Neon ink foil','2022–today',P.traditional,{cover:C.neon,note:'Fluorescent ink glows over the foil; neon parts stay vivid even unlit.'}),
 'mtg-silver':r('Silver foil','2024–today',P.silver,{tint:T.silver,note:'Achromatic silver mirror with only a hint of colour.'}),
 'mtg-firstplace':r('First-place foil','2025',P.silver,{tint:T.gold,note:'A gold sheet across the whole card: deep amber away from the light, pale cream gold under it. Black ink stays black.'}),
 'mtg-masterpiece':r('Masterpiece foil','2015–2017',P.gloss,{note:'Masterpiece Series: a foil under a heavy gloss coat. Sources describe the three series differently, so this is the common part only.'}),
 'mtg-ampersand':r('Ampersand foil','2021',P.gloss,{note:'A traditional foil with the big D&D ampersand as a clear glossy stamp: it adds no colour and flashes as the light passes over it.'}),
 'mtg-silverscreen':r('Silver screen foil','2022',P.silver,{tint:T.silver,note:'Black-and-white film look: a silver nitrate sheen over the monochrome art.'}),
 'mtg-scroll':r('Scroll foil','2023',P.silver,{tint:T.silver,cover:C.paper,note:'Parchment-matte ink; only the paper areas take a liquid-silver sheen.'}),
 'mtg-vaultboy':r('Vault Boy foil','2024',P.traditional,{note:'Vault Boy is a card style, not a foil material: these draw as traditional foil (surge foil copies use the surge row).'}),
 'mtg-pds':r('Premium Deck foil','2009–2011',P.traditional,{note:'Premium Deck Series: an ordinary foil of 2009 to 2011. No source shows the From the Vault mirror bar on these.'}),
 'mtg-emblem':r('Set emblem foil','2025–today',P.mana,{note:'A set\'s own emblem pressed into the foil (approximate shape).'})
};
// promo_types that name a foil material, most specific first (oil slick cards are also raised). Only material
// names belong here: frame and art styles (scroll, poster, showcase...) and serial numbers describe how a card
// looks or is numbered, not its foil. The serialized double-rainbow cards carry their own 'doublerainbow' tag;
// a serial number alone (the 1/1 One Ring, nonfoil Secret Lair serials) never selects a foil.
const PROMO=[['oilslick','mtg-oilslick'],['stepandcompleat','mtg-compleat'],['gilded','mtg-gilded'],['neonink','mtg-neon'],['textured','mtg-textured'],
 ['surgefoil','mtg-surge'],['galaxyfoil','mtg-galaxy'],['halofoil','mtg-halo'],['confettifoil','mtg-confetti'],['doublerainbow','mtg-doublerainbow'],
 ['fracturefoil','mtg-fracture'],['rainbowfoil','mtg-rainbow'],['ripplefoil','mtg-ripple'],['manafoil','mtg-mana'],['dragonscalefoil','mtg-dragonscale'],
 ['invisibleink','mtg-invisible'],['silverfoil','mtg-silver'],['firstplacefoil','mtg-firstplace'],['raisedfoil','mtg-raised'],['embossed','mtg-embossed'],
 ['ampersand','mtg-ampersand'],['silverscreen','mtg-silverscreen']];
// Named materials Scryfall reports that have no calibrated model yet. They keep their real name and draw the
// closest existing material, marked approximate; they are never a made-up set emblem.
export const MTG_UNMODELLED=Object.freeze({
 silverscroll:{name:'Silver scroll foil',as:'mtg-silver'},gleaminggold:{name:'Gleaming gold foil',as:'mtg-firstplace'},
 singularityfoil:{name:'Singularity foil',as:'mtg-traditional'},cosmicfoil:{name:'Cosmic foil',as:'mtg-traditional'},
 facetfoil:{name:'Facet foil',as:'mtg-traditional'},chocobotrackfoil:{name:'Chocobo Track foil',as:'mtg-traditional'}});
const PDS=new Set(['h09','pd2','pd3']);
// Innistrad: Double Feature prints its foils on silver screen stock; the records carry no promo tag for it.
const SET_MATERIAL={dbl:'mtg-silverscreen'};
const NOT_MATERIAL=new Set(['foil','serialized','scroll','poster','boosterfun','universesbeyond']);
// The printing's material profile for the SELECTED finish ('foil' or 'etched'); a nonfoil copy has none.
// status: 'family' = a documented treatment family (exact optics still calibrated by eye);
// 'approximate' = the real material is named but drawn with a stand-in. unrecognized: foil-like tags kept
// as data for review, never turned into a guessed shader.
export function mtgFoilProfile(c,finish='foil'){
 if(finish==='etched')return {treatment:'mtg-etched',status:'family',name:'',unrecognized:[]};
 if(finish!=='foil')return {treatment:'',status:'family',name:'',unrecognized:[]};
 const promos=c?.promo_types||[];
 for(const [k,e] of PROMO)if(promos.includes(k))return {treatment:e,status:'family',name:'',unrecognized:[]};
 const named=promos.find(p=>MTG_UNMODELLED[p]);
 if(named)return {treatment:MTG_UNMODELLED[named].as,status:'approximate',name:MTG_UNMODELLED[named].name,unrecognized:[]};
 const unrecognized=promos.filter(p=>/foil$/.test(p)&&!NOT_MATERIAL.has(p));
 const base=SET_MATERIAL[c?.set]||(c?.set_type==='from_the_vault'?'mtg-ftv':c?.set_type==='masterpiece'?'mtg-masterpiece':PDS.has(c?.set)?'mtg-pds':c?.frame==='1997'||c?.frame==='1993'?'mtg-oldborder':'mtg-traditional');
 return {treatment:base,status:unrecognized.length?'approximate':'family',name:'',unrecognized};
}
// Picks the treatment from the card's own Scryfall data; finish is 'foil' or 'etched'.
export const mtgFoilEffect=(c,finish='foil')=>mtgFoilProfile(c,finish).treatment;
// Rares and mythics printed in the M15 frame (2015 onward) carry the oval holo security stamp.
export const mtgHoloStamp=c=>c?.frame==='2015'&&['rare','mythic'].includes(c?.rarity)&&c?.border_color!=='borderless';
// A big emblem pressed on the card. Its shape is the same on every card of the set, so it is one measured
// picture per emblem (assets/finishes/mtg-emblem-*.png), never guessed per card. 'rex': Jurassic World
// Collection emblem cards, where the emblem is the card's only foil. 'amp': the D&D ampersand promos (Scryfall
// tags them 'embossed'), a clear glossy ampersand over a traditional foil. '' = no emblem.
export const MTG_EMBLEMS=Object.freeze({rex:{kind:1,src:'assets/finishes/mtg-emblem-rex.png'},amp:{kind:2,src:'assets/finishes/mtg-emblem-amp.png'}});
export const mtgFoilEmblem=(c,treatment=mtgFoilEffect(c,'foil'))=>!['mtg-embossed','mtg-ampersand'].includes(treatment)?'':c?.set==='rex'?'rex':c?.set==='pafr'?'amp':'';
export const mtgFrameKey=c=>c?.border_color==='borderless'||c?.full_art?'borderless':c?.frame==='1993'?'1997':['1997','2003','2015'].includes(c?.frame)?c.frame:'2015';
