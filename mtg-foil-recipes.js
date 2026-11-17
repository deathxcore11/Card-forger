// Magic foil treatments: one row of data each. Pattern = how the foil sheet is structured; coverage =
// where it shows (whole card, frame only, or an ink found in the image); relief = raised height taken from
// the art; film = thin-film colour instead of the sheet's bands. mtg-foil-shader.js composes one small
// shader per row from these values.
// Approximate simulations from reference; not certified physical-foil matches.
// 19 (gloss) is a foil under a glossier clear coat. 20 is a scanline sheet no row uses: Vault Boy is a card
// style, not a foil. 21 is facet foil, so step-and-compleat is 22. 23-29 came with the approved look of 16 Nov 2026
// (Foil Test Bench "Blended"), each from real footage: silver scroll, chocobo track, cosmic, singularity, dazzle, gleaming gold
// and the Jurassic World emblem.
export const MTG_PATTERN={traditional:1,oldborder:2,ftv:3,etched:4,textured:5,surge:6,galaxy:7,halo:8,confetti:9,doublerainbow:10,fracture:11,ripple:12,mana:13,dragonscale:14,rainbow:15,invisible:16,raised:17,silver:18,gloss:19,facet:21,compleat:22,silverscroll:23,chocobo:24,cosmic:25,singularity:26,dazzle:27,gleaminggold:28,emblem:29};
// stamped: the whole card is foil and the gold ink on top of it is raised and glossy. frameonly: the frame and nothing
// else, neither the picture nor the rules box (old border 1999-2003, the owner's video of Fierce Empath and Brainstorm).
export const MTG_COVER={whole:0,frame:1,gold:2,neon:3,paper:4,lines:5,stamped:6,frameonly:7};
export const MTG_TINT={rainbow:0,gold:1,silver:2};
const P=MTG_PATTERN,C=MTG_COVER,T=MTG_TINT;
const r=(label,era,pat,o={})=>({label,era,pat,tint:o.tint??T.rainbow,cover:o.cover??C.whole,relief:o.relief??0,film:o.film??0,sparkle:o.sparkle??0,stamp:o.stamp??0,keep:o.keep??0,note:o.note||''});
export const MTG_FOIL_RECIPES={
 'mtg-traditional':r('Traditional foil','2003–today',P.traditional,{note:'Foil under the whole card; inks tint it, dark ink absorbs it. A broad diagonal rainbow rolls across as you tilt.'}),
 'mtg-oldborder':r('Old-border foil','1999–2003',P.oldborder,{cover:C.frameonly,stamp:1,note:'Only the frame is foil: the picture and the rules box stay plain. A wide, hazy band, and the shooting-star mark at the corner of the rules box.'}),
 'mtg-retro':r('Retro frame foil','2021–today',P.oldborder,{cover:C.frame,stamp:1,note:'Modern reprints in the old frame: the frame and the rules box are foil, the picture stays plain, with the shooting-star mark.'}),
 'mtg-ftv':r('From the Vault foil','2008–2017',P.ftv,{note:'Hyper-glossy laminate: a sharp vertical mirror bar sweeps left to right.'}),
 'mtg-etched':r('Foil-etched','2020–today',P.etched,{cover:C.frame,note:'Art printed on white; the frame is frosted metal grain that sparkles instead of mirroring.'}),
 'mtg-etched-full':r('Foil-etched (borderless)','2021–today',P.etched,{note:'Borderless etched cards have no frame: the frosted metal grain runs across the whole face, art included.'}),
 'mtg-etched-archive':r('Foil-etched (Mystical Archive)','2021',P.etched,{cover:C.gold,note:'The gold ornaments and the name, type and rules panels are stamped gold metal; the picture stays print.'}),
 'mtg-textured':r('Textured foil','2022–today',P.textured,{relief:0.3,keep:0.3,note:'Fine raised grooves follow the artwork\'s own contours, so light ripples around the drawing while the art and text stay clear.'}),
 'mtg-surge':r('Surge foil','2022–today',P.surge,{sparkle:0.5,note:'Crossing wave fields and sparks; bands surge in different directions.'}),
 'mtg-galaxy':r('Galaxy foil','2022–today',P.galaxy,{sparkle:1,note:'Traditional foil with a field of star points that twinkle on and off.'}),
 'mtg-halo':r('Halo foil','2023–today',P.halo,{note:'A swirling halo pattern: rainbow arcs wheel around the centre.'}),
 'mtg-confetti':r('Confetti foil','2023–today',P.confetti,{note:'Scattered confetti pieces, each with its own angle, flash independently.'}),
 'mtg-doublerainbow':r('Double rainbow foil','2023–today',P.doublerainbow,{note:'Two crossed gratings: two rainbows at once, the brightest standard pattern.'}),
 'mtg-fracture':r('Fracture foil','2024–today',P.fracture,{note:'Broken-glass panels; seams catch the light as a panel turns.'}),
 'mtg-ripple':r('Ripple foil','2024–today',P.ripple,{note:'Concentric ripples spreading from the centre.'}),
 'mtg-mana':r('Mana foil','2024–today',P.mana,{note:'Mana-symbol rings pressed into the foil.'}),
 'mtg-dragonscale':r('Dragonscale foil','2025–today',P.dragonscale,{relief:0.3,note:'Overlapping scales, each catching the light at its own angle.'}),
 'mtg-rainbow':r('Rainbow foil','Secret Lair',P.rainbow,{note:'Fine, high-dispersion lines: saturated rainbow at almost every angle.'}),
 'mtg-invisible':r('Invisible ink','2024',P.traditional,{note:'In room light a plain foil: the hidden notes only show under ultraviolet light.'}),
 'mtg-raised':r('Raised foil','2022–today',P.raised,{relief:0.3,note:'Traditional foil with raised, glossy drawn lines.'}),
 'mtg-embossed':r('Jurassic World emblem foil','2023',P.emblem,{cover:C.gold,note:'Only the embossed Jurassic World emblem is foil, in prism chips; the rest of the card is plain.'}),
 'mtg-oilslick':r('Oil slick foil','2023',P.traditional,{relief:0.6,film:1,note:'Black card; only the raised drawn lines are glossy, with thin-film oil colours.'}),
 'mtg-compleat':r('Step-and-compleat foil','2023',P.compleat,{note:'Rows of the Phyrexian mark pressed into the foil across the whole card; each mark lights in one pure colour, even over black.'}),
 'mtg-gilded':r('Gilded foil','2022',P.traditional,{cover:C.stamped,relief:0.6,note:'A traditional foil card with raised, hot-stamped gold on the gold parts of its frame.'}),
 'mtg-neon':r('Neon ink foil','2022–today',P.traditional,{cover:C.neon,note:'Fluorescent ink glows over the foil; neon parts stay vivid even unlit.'}),
 'mtg-silver':r('Silver foil','2024–today',P.silver,{tint:T.silver,note:'Achromatic silver mirror with only a hint of colour.'}),
 'mtg-firstplace':r('First-place foil','2025',P.silver,{tint:T.gold,note:'A gold-plated mirror sheet across the whole card.'}),
 'mtg-masterpiece':r('Masterpiece foil','2015–2017',P.gloss,{keep:0.3,note:'Zendikar Expeditions, Kaladesh Inventions, Amonkhet Invocations: deep printed colours under a high gloss and a quiet rainbow.'}),
 'mtg-ampersand':r('Ampersand foil','2021',P.gloss,{note:'Traditional foil with a large glossy D&D ampersand stamped across the card (approximate shape).'}),
 'mtg-silverscreen':r('Silver screen foil','2022',P.silver,{tint:T.silver,note:'Black-and-white film look: a silver nitrate sheen over the monochrome art.'}),
 'mtg-scroll':r('Scroll foil','2023',P.silver,{tint:T.silver,cover:C.paper,note:'Parchment-matte ink; only the paper areas take a liquid-silver sheen.'}),
 'mtg-vaultboy':r('Vault Boy foil','2024',P.traditional,{note:'Vault Boy is a card style, not a foil material: these draw as traditional foil (surge foil copies use the surge row).'}),
 'mtg-pds':r('Premium Deck foil','2009–2011',P.traditional,{note:'Premium Deck Series: an ordinary foil of 2009 to 2011. No source shows the From the Vault mirror bar on these.'}),
 'mtg-emblem':r('Set emblem foil','2025–today',P.mana,{note:'A set\'s own emblem pressed into the foil (approximate shape).'}),
 'mtg-silverscroll':r('Silver scroll foil','2021',P.silverscroll,{tint:T.silver,note:'Japanese Mystical Archive: the picture is printed on silver, the plates and borders are mirror silver, almost no rainbow.'}),
 'mtg-chocobo':r('Chocobo Track foil','2025',P.chocobo,{note:'Big three-toed chocobo prints flash pale silver-rainbow over the picture, dark ink included.'}),
 'mtg-cosmic':r('Cosmic foil','2025',P.cosmic,{cover:C.stamped,note:'Prism glitter in patches over the picture; the gold bars are dull bronze until the light catches them.'}),
 'mtg-singularity':r('Singularity foil','2025',P.singularity,{note:'The black core stays black; the purple and cyan ring around it shines.'}),
 'mtg-dazzle':r('Dazzle foil','2025',P.dazzle,{note:'Secret Lair dazzle foil (no footage yet: drawn from written sources).'}),
 'mtg-gleaminggold':r('Gleaming gold foil','2025',P.gleaminggold,{cover:C.stamped,note:'A thick gold frame, dark bronze out of the light and bright gold with some rainbow in it; the picture is a vivid rainbow foil.'}),
 'mtg-facet':r('Facet foil','2025–today',P.facet,{note:'Printed glass shards, each a flat mirror with its own tilt; the neon outlines are cut edges that throw the rainbow.'})
};
// promo_types that name a foil material, most specific first (oil slick cards are also raised). Only material
// names belong here: frame and art styles (scroll, poster, showcase...) and serial numbers describe how a card
// looks or is numbered, not its foil. The serialized double-rainbow cards carry their own 'doublerainbow' tag;
// a serial number alone (the 1/1 One Ring, nonfoil Secret Lair serials) never selects a foil.
const PROMO=[['oilslick','mtg-oilslick'],['stepandcompleat','mtg-compleat'],['gilded','mtg-gilded'],['neonink','mtg-neon'],['textured','mtg-textured'],
 ['surgefoil','mtg-surge'],['galaxyfoil','mtg-galaxy'],['halofoil','mtg-halo'],['confettifoil','mtg-confetti'],['doublerainbow','mtg-doublerainbow'],
 ['fracturefoil','mtg-fracture'],['rainbowfoil','mtg-rainbow'],['ripplefoil','mtg-ripple'],['manafoil','mtg-mana'],['dragonscalefoil','mtg-dragonscale'],
 ['invisibleink','mtg-invisible'],['silverfoil','mtg-silver'],['firstplacefoil','mtg-firstplace'],['raisedfoil','mtg-raised'],['embossed','mtg-embossed'],
 ['ampersand','mtg-ampersand'],['silverscreen','mtg-silverscreen'],
 ['silverscroll','mtg-silverscroll'],['chocobotrackfoil','mtg-chocobo'],['cosmicfoil','mtg-cosmic'],['singularityfoil','mtg-singularity'],
 ['dazzlefoil','mtg-dazzle'],['gleaminggold','mtg-gleaminggold'],['facetfoil','mtg-facet']];
// Named materials Scryfall reports that have no calibrated model yet. They keep their real name and draw the
// closest existing material, marked approximate; they are never a made-up set emblem.
// Every one Scryfall reported on 16 Nov 2026 now has its own row (silver scroll, chocobo, cosmic, singularity, dazzle,
// gleaming gold, facet), so this list is empty until a new one appears.
export const MTG_UNMODELLED=Object.freeze({});
const PDS=new Set(['h09','pd2','pd3']);
// The real Masterpiece Series: Zendikar Expeditions, Kaladesh Inventions, Amonkhet Invocations. Scryfall files many bonus
// sheets under the same set type (Mystical Archive, Special Guests, Wrath of the..., retro artifacts...); those are ordinary foils.
const MASTERPIECE=new Set(['exp','mps','mp2']);
// Jurassic World (rex) cards tagged embossed carry the emblem; the Forgotten Realms ampersand promos (pafr) carry the
// same tag for their glossy ampersand.
const EMBOSSED_AS={pafr:'mtg-ampersand'};
// Innistrad: Double Feature prints its foils on silver screen stock; the records carry no promo tag for it.
const SET_MATERIAL={dbl:'mtg-silverscreen'};
const NOT_MATERIAL=new Set(['foil','serialized','scroll','poster','boosterfun','universesbeyond']);
// The printing's material profile for the SELECTED finish ('foil' or 'etched'); a nonfoil copy has none.
// status: 'family' = a documented treatment family (exact optics still calibrated by eye);
// 'approximate' = the real material is named but drawn with a stand-in. unrecognized: foil-like tags kept
// as data for review, never turned into a guessed shader.
export function mtgFoilProfile(c,finish='foil'){
 if(finish==='etched')return {treatment:c?.set==='sta'?'mtg-etched-archive':'mtg-etched',status:'family',name:'',unrecognized:[]};
 if(finish!=='foil')return {treatment:'',status:'family',name:'',unrecognized:[]};
 const promos=c?.promo_types||[];
 for(const [k,e] of PROMO)if(promos.includes(k))return {treatment:k==='embossed'&&EMBOSSED_AS[c?.set]||e,status:'family',name:'',unrecognized:[]};
 const named=promos.find(p=>MTG_UNMODELLED[p]);
 if(named)return {treatment:MTG_UNMODELLED[named].as,status:'approximate',name:MTG_UNMODELLED[named].name,unrecognized:[]};
 const unrecognized=promos.filter(p=>/foil$/.test(p)&&!NOT_MATERIAL.has(p));
 const base=SET_MATERIAL[c?.set]||(c?.set_type==='from_the_vault'?'mtg-ftv':MASTERPIECE.has(c?.set)?'mtg-masterpiece':PDS.has(c?.set)?'mtg-pds':c?.frame==='1997'||c?.frame==='1993'?((c?.released_at||'')>='2021'?'mtg-retro':'mtg-oldborder'):'mtg-traditional');
 return {treatment:base,status:unrecognized.length?'approximate':'family',name:'',unrecognized};
}
// Picks the treatment from the card's own Scryfall data; finish is 'foil' or 'etched'.
export const mtgFoilEffect=(c,finish='foil')=>mtgFoilProfile(c,finish).treatment;
// Rares and mythics printed in the M15 frame (2015 onward) carry the oval holo security stamp.
export const mtgHoloStamp=c=>c?.frame==='2015'&&['rare','mythic'].includes(c?.rarity)&&c?.border_color!=='borderless';
export const mtgFrameKey=c=>c?.border_color==='borderless'||c?.full_art?'borderless':c?.frame==='1993'?'1997':['1997','2003','2015'].includes(c?.frame)?c.frame:'2015';

// The boxes the foil is placed with: the frame type's, or a layout of its own measured on the Foil Test Bench (Mystical
// Archive, Dominaria United schematic textured, cosmic, gleaming gold, and full-picture cards with no rules box). Each card's
// boxes are then snapped to its own printed frame lines (mtg-foil-analysis.js cardBoxes).
export function mtgFoilFrame(c,treatment){
 if(c?.set==='sta')return 'sta';
 if(treatment==='mtg-cosmic')return 'cosmic';
 if(treatment==='mtg-gleaminggold')return 'smaug';
 if(treatment==='mtg-singularity'||treatment==='mtg-dazzle')return 'none';
 if(treatment==='mtg-textured'&&c?.set==='dmu')return 'dmusg';
 return mtgFrameKey(c);
}
