// Drawn stand-ins for Play table cards that have no printing to show: tokens, which
// never appear in a deck list, and any card whose artwork could not be found. Each
// gets a crest chosen from its own type line and a frame in its own colors, so the
// battlefield never shows a blank "art unavailable" tile. Presentation only.
const GLYPHS={
 shield:'<path d="M12 2 4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5z"/><path d="M12 5.2 7 7.1v3.9c0 3.4 2 6.4 5 7.8z" fill="#fff" opacity=".22"/>',
 sword:'<path d="M20.5 2.5 21.5 3.5 21 7 11.6 16.4 7.6 12.4 17 3z"/><path d="m5.4 12.8 5.8 5.8-1.4 1.4-1.8-1.8L5 21.2 2.8 19 5.8 16 4 14.2z"/>',
 skull:'<path d="M12 2C7 2 3 5.6 3 10.4c0 2.8 1.3 5 3.5 6.4V21h3v-2h1.6v2h1.8v-2h1.6v2h3v-4.2c2.2-1.4 3.5-3.6 3.5-6.4C21 5.6 17 2 12 2zm-3.5 11a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zm7 0a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2z"/>',
 ghost:'<path d="M12 2a7 7 0 0 0-7 7v12l2.3-1.8 2.3 1.8L12 19.2l2.4 1.8 2.3-1.8L19 21V9a7 7 0 0 0-7-7zm-2.6 9.2a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2zm5.2 0a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z"/>',
 leaf:'<path d="M20.5 3C11.6 3 4.5 8 4.5 15.6c0 1.8.4 3.3 1.1 4.6l1.5-1.5C9.6 13.9 13 11.4 17 9.6c-3.4 2.2-6.5 5.2-8.9 9.7 1.2 1 2.8 1.7 4.6 1.7 5.9 0 8.6-6.8 7.8-18z"/>',
 paw:'<ellipse cx="6.2" cy="10.6" rx="2.1" ry="2.6"/><ellipse cx="9.6" cy="6" rx="2.1" ry="2.6"/><ellipse cx="14.4" cy="6" rx="2.1" ry="2.6"/><ellipse cx="17.8" cy="10.6" rx="2.1" ry="2.6"/><path d="M12 11.6c-3 0-6 3.6-6 6.3 0 1.8 1.3 2.4 2.9 2.4 1.3 0 2.1-.7 3.1-.7s1.8.7 3.1.7c1.6 0 2.9-.6 2.9-2.4 0-2.7-3-6.3-6-6.3z"/>',
 wing:'<path d="M2 6c3.6.3 6.6 1.8 9 4.6.4-3.6 2.4-6.6 6-8.6-.6 2.6-.4 5 .6 7.2 1.1-1 2.6-1.6 4.4-1.6-1 1.6-1.6 3.3-1.6 5.2 0 4.6-3.7 8.2-8.2 8.2-1.3 0-2.5-.3-3.6-.8C8.4 15.4 4.6 11.4 2 6z"/>',
 flame:'<path d="M12.6 2c.6 3.7 4.9 5.6 4.9 10.6A5.6 5.6 0 0 1 6.5 13c0-2.2 1-3.9 2.3-5 .1 2.1 1 3.3 2.2 3.8-.3-3.4.1-6.9 1.6-9.8z"/><path d="M12 13.4c.4 1.6 2.3 2.4 2.3 4.4a2.3 2.3 0 0 1-4.6.1c0-1 .4-1.6 1-2.1 0 .8.3 1.3.8 1.5-.1-1.4 0-2.7.5-3.9z" fill="#fff" opacity=".3"/>',
 cog:'<circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width="4.2" stroke-dasharray="2.9 2.3"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2" fill="#000" opacity=".35"/>',
 gem:'<path d="M6.5 3h11L22 9 12 21 2 9z"/><path d="M2 9h20M8.4 3 12 9l3.6-6M12 9v12" fill="none" stroke="#fff" stroke-width=".9" opacity=".45"/>',
 apple:'<path d="M12 7.2C10.9 5 9 4 7 4c0 2 1.4 3.7 3.5 4.1C6.6 8 4 11.2 4 15c0 3.9 2.9 7 5.5 7 1 0 1.7-.5 2.5-.5s1.5.5 2.5.5c2.6 0 5.5-3.1 5.5-7 0-3.8-2.6-7-6.6-6.9.2-1.6 1-3 2.3-3.9l-1-1.4c-1.5 1-2.4 2.6-2.7 4.4z"/>',
 lens:'<circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="m14.4 14.4 6.4 6.4-2 2-6.4-6.4z"/><circle cx="10" cy="10" r="3.6" opacity=".35"/>',
 drop:'<path d="M12 2s-7 7.7-7 12.6A7 7 0 0 0 19 14.6C19 9.7 12 2 12 2z"/><path d="M9.4 14.2a3 3 0 0 0 2.6 3.4" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".45"/>',
 coin:'<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#fff" stroke-width="1.2" opacity=".4"/><path d="m12 7.6 1.3 3.1 3.1 1.3-3.1 1.3L12 16.4l-1.3-3.1L7.6 12l3.1-1.3z" fill="#fff" opacity=".45"/>',
 map:'<path d="M2.5 5.5 8.5 3l7 2.5 6-2.5v15.5l-6 2.5-7-2.5-6 2.5z"/><path d="M8.5 3v15.5M15.5 5.5V21" fill="none" stroke="#000" stroke-width="1" opacity=".3"/>',
 crystal:'<path d="M12 1.8 18 8v8l-6 6.2L6 16V8z"/><path d="M12 1.8V22.2M6 8l6 3.4L18 8" fill="none" stroke="#fff" stroke-width=".9" opacity=".45"/>',
 peak:'<path d="M1.5 20.5 8.6 8l3.8 6.2 2.6-4 7.5 10.3z"/><path d="m8.6 8 1.7 2.8-1.7-.8-1.5.9z" fill="#fff" opacity=".55"/>',
 spark:'<path d="m12 1.5 2.5 8 8 2.5-8 2.5-2.5 8-2.5-8-8-2.5 8-2.5z"/>',
};
// First match wins; the type line is read as Forge reports it ("Token Creature — Soldier").
const KINDS=[
 [/\btreasure\b/i,'gem'],[/\bfood\b/i,'apple'],[/\bclue\b/i,'lens'],[/\bblood\b/i,'drop'],[/\bmap\b/i,'map'],[/\bgold\b/i,'coin'],[/\b(powerstone|incubator|shard)\b/i,'crystal'],
 [/\b(zombie|skeleton|horror)\b/i,'skull'],[/\b(spirit|shade|specter)\b/i,'ghost'],[/\b(vampire|bat)\b/i,'drop'],
 [/\b(bird|drake|dragon|angel|thopter|faerie|pegasus|griffin)\b/i,'wing'],
 [/\b(construct|servo|golem|myr|robot|gnome)\b/i,'cog'],
 [/\b(saproling|plant|treefolk|elf|squirrel|fungus|insect)\b/i,'leaf'],
 [/\b(beast|wolf|cat|dog|bear|boar|ox|rhino|elk|ape|hound|dinosaur)\b/i,'paw'],
 [/\b(elemental|goblin|devil|imp)\b/i,'flame'],
 [/\b(soldier|knight|warrior|human|citizen|cleric|monk|samurai)\b/i,'shield'],
 [/\bland\b/i,'peak'],[/\bcreature\b/i,'sword'],[/\bartifact\b/i,'cog'],[/\benchantment\b/i,'ghost'],[/\b(instant|sorcery)\b/i,'flame'],
];
const ORDER='WUBRG';
const PALETTE={W:'#efe3bd',U:'#3f86d8',B:'#6b5679',R:'#d6503a',G:'#3f9a55'};
export function glyphFor(type){for(const [pattern,glyph]of KINDS)if(pattern.test(String(type||'')))return glyph;return 'spark';}
// Colors in WUBRG order from a mana cost ("{1}{R}{W}", "{G/U}"); generic and colorless symbols add none.
export function manaColors(cost){return [...new Set(String(cost||'').toUpperCase().match(/[WUBRG]/g)||[])].sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b));}
// The table's color identity for one card: the printing's colors (a land's identity),
// a token's colors from Forge, then its mana cost. Null when nothing says.
export function surfaceColors(surface,card){
 const pick=list=>Array.isArray(list)?[...new Set(list.filter(c=>ORDER.includes(c)))].sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b)):null;
 if(card){const own=pick(/\bland\b/i.test(card.type_line||'')?card.color_identity:card.colors);if(own)return own;}
 if(Array.isArray(surface?.tokenColors))return pick(surface.tokenColors);
 const cost=manaColors(surface?.manaCost);return cost.length?cost:(surface?.manaCost?[]:null);
}
export function frameTone(colors){
 if(!colors)return null;
 if(!colors.length)return {key:'C',a:'#aab3b9',b:'#6f7a82'};
 if(colors.length>2)return {key:'M',a:'#e6c66d',b:'#a8812f'};
 return {key:colors.join(''),a:PALETTE[colors[0]],b:PALETTE[colors[colors.length-1]]};
}
// A crest tile in the same slot a printing's art would fill. The visible name and
// stats stay on the card; this only replaces the empty art area.
export function drawnArtwork(doc,surface,colors){
 const tone=frameTone(colors)||{key:'C',a:'#8fa3ad',b:'#4f626c'},glyph=glyphFor(surface?.type||surface?.name);
 const art=doc.createElement('span');art.className='play-match-piece-art play-drawn-art';art.dataset.glyph=glyph;art.dataset.tone=tone.key;
 art.style.setProperty('--drawn-a',tone.a);art.style.setProperty('--drawn-b',tone.b);art.setAttribute('aria-hidden','true');
 const crest=doc.createElement('span');crest.className='play-drawn-crest';crest.innerHTML='<svg viewBox="0 0 24 24" focusable="false">'+GLYPHS[glyph]+'</svg>';
 art.append(crest);
 return art;
}
