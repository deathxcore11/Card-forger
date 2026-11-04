// Story mode screens (story-mode-acts.md Parts B and H; Randall 1 Nov 18:09Z): the road of acts,
// an act's battles, the duel setup, the talking-head scenes and the speech bubbles that come from a
// seat's portrait during a match. Markup and two small DOM controllers; app.js wires the actions.
// The road reveals itself: cleared acts, the current act, one blurred tease, and nothing after it.
import {createMatchFacts} from './match-facts.js';
import {STORY_ACTS, SET_NAMES, setSymbolUrl} from './story-acts.js';
import {purseMarkup} from './play-econ-ui.js';
import {battleStars, battleCleared, actCleared, actStars, currentBattle, currentAct, secretOpen, secretStatus, STAR_VALUE} from './story-client.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const back = (act, label) => `<button class="pl-back" data-act="${act}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>`;
const head = (title, econ, eyebrow, backAct = 'playHome', backLabel = 'Back to Play') => `<header class="pl-head pe-head st-head">${back(backAct, backLabel)}<div class="pl-head-title"><p class="eyebrow">${esc(eyebrow)}</p><h1 id="playTitle" tabindex="-1">${esc(title)}</h1></div>${purseMarkup(econ)}</header>`;
const symbols = act => `<span class="st-symbols">${act.sets.filter(c => c !== 'leb' && c !== '2ed').map(c => `<img src="${setSymbolUrl(c)}" alt="${esc(SET_NAMES[c] || c)}" title="${esc(SET_NAMES[c] || c)}" loading="lazy" decoding="async">`).join('')}</span>`;
const star = (on, label) => `<svg class="st-star${on ? ' on' : ''}" viewBox="0 0 24 24" role="img" aria-label="${esc(label)}"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z"/></svg>`;
const STAR_SLOTS = [['loaner', 'Loaner deck win'], ['loaner', 'Loaner deck win'], ['loaner', 'Loaner deck win'], ['own', 'Win with your own deck'], ['villain', 'Win from the other side']];
export const starsRow = rec => `<span class="st-stars" role="group" aria-label="${battleStars(rec)} of 5 stars">${STAR_SLOTS.map(([k, l]) => star(!!rec?.[k], l)).join('')}</span>`;
const ring = (done, total, label) => { const pct = Math.round(done / total * 100); return `<span class="st-ring" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="st-ring-track"/><circle cx="18" cy="18" r="15" class="st-ring-fill" pathLength="100" stroke-dasharray="${pct} 100"/></svg><b>${done}<small>/${total}</small></b></span>`; };
export const portraitUrl = p => p?.crop || '';
const faceStyle = p => `background-image:url(${esc(portraitUrl(p))});background-position:${esc(p?.focus || '50% 30%')}`;

// The Story road: the age you're in, as a shelf of act covers.
export function storyHomeMarkup({progress, econ, actsData = {}}) {
  const now = currentAct(progress), shown = STORY_ACTS.filter(a => a.act <= now + 1);
  const cover = a => {
    const data = actsData[a.act], done = actCleared(progress, a.act), here = a.act === now, tease = a.act > now;
    const cleared = Array.from({length: 8}, (_, i) => battleCleared(progress, `a${a.act}b${i + 1}`)).filter(Boolean).length;
    const art = `<span class="st-cover-art" style="background-image:url(${esc(a.art.crop)})" aria-hidden="true"></span>`;
    const name = `<span class="st-cover-act">Act ${a.act}</span><span class="st-cover-name">${esc(a.title)}</span>`;
    if (tease) return `<div class="st-cover st-cover--tease" aria-hidden="true">${art}<span class="st-cover-copy">${symbols(a)}${name}</span></div>`;
    return `<button class="st-cover${here ? ' st-cover--hero' : ' st-cover--done'}" data-act="storyOpenAct" data-story-act="${a.act}" aria-label="Act ${a.act}, ${esc(a.title)}. ${done ? 'Cleared' : cleared + ' of 8 battles won'}">${art}
      <span class="st-cover-copy">${symbols(a)}${name}<span class="st-cover-years">${esc(a.years)}</span>
      ${here ? `<span class="st-cover-foot">${ring(cleared, 8, cleared + ' of 8 battles won')}<span class="pl-mode-cta">${cleared ? 'Continue' : 'Begin'}</span></span>` : `<span class="st-cover-foot"><span class="st-cover-stars">${star(true, 'Stars')}<b>${actStars(progress, a.act)}</b><small>/40</small></span></span>`}</span>
      ${data && here ? '' : ''}</button>`;
  };
  const allDone = now > STORY_ACTS.length;
  return `<section class="play-menu st-screen st-road" aria-labelledby="playTitle">${head('Story', econ, 'Play')}
    <p class="st-age">${esc(STORY_ACTS[0].age)}</p>
    <div class="st-shelf">${shown.map(cover).join('')}${allDone ? `<div class="st-cover st-cover--book" aria-hidden="true"><span class="st-book"></span><span class="st-cover-copy"><span class="st-cover-act">The next age</span><span class="st-cover-name">The Weatherlight Saga</span></span></div>` : ''}</div>
  </section>`;
}

// One act: its banner and the battles you've reached. Cleared ones, the current one, then one tease.
// A closed secret boss shows once the act is far enough along: what it still needs (all 8 battles won with the Story
// decks and the act's key feats). The key feats themselves are marked in Achievements, on the Story tab.
const secretTease = (data, progress, act, counters) => {
  if (!data.battles.some(b => b.secret) || secretOpen(progress, act, counters)) return '';
  const st = secretStatus(progress, act, counters);
  if (st.won < 4 && !st.keys) return '';
  return `<p class="st-secret-tease" role="note">A secret battle waits in this act. Win all 8 battles with the Story decks (${st.won} of 8) and earn its ${st.keysNeeded} key feats (${st.keys} of ${st.keysNeeded}). Key feats are marked in Achievements.</p>`;
};
export function storyActMarkup({act, data, progress, econ}) {
  const counters = econ?.state?.counters || {};
  const meta = STORY_ACTS.find(a => a.act === act), now = currentBattle(progress, act), boss = b => b.slot >= 8;
  const cleared = data.battles.filter(b => !b.secret && battleCleared(progress, b.id)).length;
  const villainFace = b => data.cast[b.villain.who]?.portrait;
  const row = b => {
    const rec = progress.battles?.[b.id], done = battleCleared(progress, b.id), here = b.slot === now, tease = b.slot === now + 1;
    if (tease) return `<li class="st-battle st-battle--tease" aria-hidden="true"><span class="st-battle-face" style="${faceStyle(villainFace(b))}"></span><span class="st-battle-copy"><span class="st-battle-kind">${esc(b.kind)}</span><span class="st-battle-title">${esc(b.title)}</span></span></li>`;
    return `<li><button class="st-battle${here ? ' st-battle--here' : ''}${boss(b) ? ' st-battle--boss' : ''}${b.secret ? ' st-battle--secret' : ''}" data-act="storyOpenBattle" data-story-battle="${esc(b.id)}" aria-label="${esc(b.kind)}: ${esc(b.title)}. ${done ? battleStars(rec) + ' of 5 stars' : 'Not won yet'}">
      <span class="st-battle-face" style="${faceStyle(villainFace(b))}" aria-hidden="true"></span>
      <span class="st-battle-copy"><span class="st-battle-kind">${b.slot === 8 ? 'Boss' : esc(b.kind)} <i>${esc(b.difficulty)}</i></span><span class="st-battle-title">${esc(b.title)}</span><span class="st-battle-blurb">${esc(b.blurb)}</span></span>
      <span class="st-battle-side">${starsRow(rec)}<span class="pl-mode-cta">${done ? 'Replay' : 'Duel'}</span></span></button></li>`;
  };
  return `<section class="play-menu st-screen st-act" aria-labelledby="playTitle">${head(meta.title, econ, 'Story · Act ' + act, 'storyHome', 'Back to Story')}
    <header class="st-banner"><span class="st-banner-art" style="background-image:url(${esc(meta.art.crop)})" aria-hidden="true"></span>
      <span class="st-banner-copy">${symbols(meta)}<span class="st-banner-years">${esc(meta.years)}</span></span>${ring(cleared, 8, cleared + ' of 8 battles won')}</header>
    <ol class="st-battles">${data.battles.filter(b => b.secret ? secretOpen(progress, act, counters) : b.slot <= now + 1).map(row).join('')}</ol>
    ${secretTease(data, progress, act, counters)}
  </section>`;
}

// The duel setup: both sides, your deck, and Play. ui: {seat, deck:'loaner'|<play deck id>}.
// "New in this battle": one plain sentence per mechanic a battle introduces (battle.teaches).
export const LESSONS = {
  'Land drops and mana': 'Play one land a turn and tap lands for mana to cast your spells.',
  'Casting creatures': 'Creatures can\'t attack the turn they arrive. Next turn, they fight.',
  'Attacking and blocking': 'Attack with creatures; your opponent chooses which of theirs block. Unblocked damage hits the player.',
  'Flying': 'Creatures with flying can only be blocked by other flyers.',
  'First strike': 'A first striker deals its combat damage before creatures without it.',
  'Protection from a colour': 'Protection from a colour: it can\'t be blocked, targeted, damaged or enchanted by that colour.',
  "Instants on the opponent's turn": 'Instants can be cast any time, even during your opponent\'s turn. Hold mana open to surprise them.',
  'Bounce': 'Bounce returns a permanent to its owner\'s hand. They have to pay for it again.',
  'Artifacts': 'Artifacts are colourless, so any deck can play them.',
  'Answering artifacts': 'Some cards destroy artifacts outright. Save them for the biggest machine.',
  'Tempo': 'Tempo means using your mana better than your opponent each turn, so they fall behind.',
  'Counterspells': 'A counterspell stops a spell as it\'s cast. Leave blue mana open to threaten one.',
  'Artifact creatures': 'Artifact creatures are both artifacts and creatures, so artifact removal hits them too.',
  'Sacrifice': 'Sacrifice means putting your own permanent into the graveyard to pay for an effect.',
  'Two colours of mana': 'Two-colour decks need both land types. Watch which colours your hand needs.',
  'Legendary creatures': 'Legendary creatures are named heroes. You can only control one with each name.',
  'Three colours': 'Three-colour cards need all three mana colours. Dual lands make that possible.',
  'Tokens': 'Tokens are creatures made by other cards. They count as creatures until they leave play.',
  'Counters': 'Counters placed on a card change it, like spore counters that grow into Thallids.',
  'Multicolour gold cards': 'Gold cards need more than one colour of mana and are usually stronger for it.',
  'Card advantage': 'Card advantage: getting more cards than your opponent. More cards, more choices.',
  'Playing around counterspells': 'Against counterspells, cast your less important spell first, or wait until their mana is tapped.',
  'Discard': 'Discard makes a player throw cards from hand. Play your cards before they\'re taken.',
  'Snow': 'Snow lands make snow mana, which powers the cards of the long winter.',
  'Cumulative upkeep': 'Cumulative upkeep: pay more each turn to keep it, or let it go.',
  'Paying life': 'Some cards cost life instead of mana. Life is a resource until it runs out.',
  'Direct damage': 'Direct damage spells hit creatures or go straight at the player.',
  'Growing creatures': 'Some creatures grow with counters or pump spells. Answer them early.',
  'Alternate costs': 'Alternate costs let you cast a spell without paying its mana, at a price.',
  'Racing a card-draw engine': 'They pay life to draw cards. Attack hard: every point you deal is one they can\'t spend.',
  'Flanking': 'Flanking: when a creature without flanking blocks it, the blocker gets -1/-1 first.',
  'Phasing': 'Phasing: every other turn the card blinks out of time, then returns untouched. Plan around the gaps.',
  'Locking creatures down': 'Tap their best creature or keep it from untapping, and it can\'t attack or block.',
  'Racing': 'Racing: when both sides attack, count the turns. Spend life to deal damage faster than they can.',
  'Shadow': 'Shadow creatures can only block or be blocked by other shadow creatures.',
  'Buyback': 'Buyback: pay the extra cost and the spell returns to your hand to cast again.',
  'Slivers': 'Every sliver shares its ability with all slivers, theirs included. Each one makes the hive stronger.',
  'Gaining life': 'Gaining life buys you turns. Use the time to build a board that wins.',
  'The graveyard': 'Your graveyard is a resource: some cards bring creatures back from it.',
  'Playing against reanimation': 'They fill their graveyard and bring back their best creatures. Answer the big one, and pressure them early.',
  'Enchantments': 'Enchantments stay in play and keep working every turn. Some make all your creatures stronger.',
  'Echo': 'Echo: next upkeep, pay the cost again or sacrifice it. Strong cards, paid for twice.',
  'Cycling': 'Cycling: pay a little and discard a card you don\'t need to draw a new one.',
  'Mana creatures': 'Some creatures tap for mana. Play them early and cast big spells sooner.',
  'Artifact mana': 'Artifacts that make mana let you cast spells far ahead of schedule. Answer them early.',
  'Enchantments returning': 'Some spells return every enchantment from the graveyard at once. Don\'t overcommit into it.',
  'Rebels': 'Rebels search your deck for more rebels. Pay the cost, tap one, and another joins the fight. Get one early and it keeps calling friends.',
  'Spellshapers': 'Spellshapers turn a card you discard into a spell. A land you do not need becomes a bolt.',
  'Rhystic': 'Rhystic spells work unless any player pays. If they keep mana open to pay, they cannot spend it on their own turn.',
  'Fading': 'Fading creatures arrive with counters and lose one each turn. When they run out, they are gone. Attack while they are big.',
  'Lords': 'A lord changes the creatures around it. Kill the lord and the whole army shrinks back.',
  'Kicker': 'Kicker is an optional extra cost. Pay it and the spell does more. Cheap early, strong late.',
  'Split cards': 'A split card is two spells on one card. You cast one half, and it goes to the graveyard.',
  'Combat math': 'Before you attack, count: their blockers\' power against your toughness, and yours against theirs. Attack when the trade is good.',
  'Threshold': 'Threshold: with seven or more cards in your graveyard, threshold cards get stronger. Long games feed them.',
  'Flashback': 'Flashback lets you cast a spell again from your graveyard for its flashback cost. One card, two uses.',
  'Madness': 'Madness: if you discard a madness card, you may cast it for its madness cost. Discarding turns into a free spell.',
  'Equipment': 'Equipment stays in play. Pay its equip cost to attach it to your creature; if the creature dies, move it to another.',
  'Affinity': 'Affinity for artifacts: the spell costs one less for each artifact you control. Artifact lands count.',
  'Artifact lands': 'Artifact lands are lands and artifacts at once. They make mana, feed affinity, and die to artifact removal.',
  'Imprint': 'Imprint: the machine exiles a card when it arrives and keeps it. What it holds decides what it does.',
  'Modular': 'Modular: it enters with +1/+1 counters, and when it dies they can move onto another artifact creature.',
  'Indestructible': 'Indestructible permanents can\'t be destroyed by damage or destroy effects. Exile, bounce or make them sacrificed instead.',
  'Sunburst': 'Sunburst: the card gets a counter for each colour of mana spent to cast it. More colours, bigger machine.',
  'Entwine': 'Entwine: a spell with two choices. Pay the entwine cost as well and you get both.',
  'Bushido': 'Bushido: when this creature blocks or becomes blocked, it gets bigger until end of turn.',
  'Soulshift': 'Soulshift: when this Spirit dies, return a smaller Spirit card from your graveyard to your hand.',
  'Splice': 'Splice onto Arcane: when you cast an Arcane spell, pay the splice cost to add this card\'s effect too. You keep the spliced card.',
  'Ninjutsu': 'Ninjutsu: when your attacker is unblocked, pay the ninjutsu cost and swap it for a Ninja from your hand. The Ninja deals the damage.',
  'Flip cards': 'Flip cards: when the condition is met, the creature turns upside down and becomes the stronger creature printed below.',
  'Convoke': 'Convoke: tap your creatures to help pay for this spell. Each one pays one mana of its colour, or one generic.',
  'Dredge': 'Dredge: instead of drawing a card, mill that many cards and return this card from your graveyard to your hand.',
  'Bloodthirst': 'Bloodthirst: this creature enters with +1/+1 counters if an opponent was dealt damage this turn.',
  'Transmute': 'Transmute: pay the cost and discard this card to search your library for a card with the same mana value.',
  'Haunt': 'Haunt: when this dies, exile it haunting a creature. When that creature dies, you get the effect again.',
  'Forecast': 'Forecast: during your upkeep, reveal this card from your hand to use its effect. It stays in your hand.',
  'Graft': 'Graft: enters with +1/+1 counters. When another creature enters, you may move one counter onto it.',
  'Suspend': 'Suspend: pay the suspend cost to exile the card with time counters. Remove one each upkeep; when the last one comes off, cast it for free.',
  'Split second': 'Split second: while this spell is on the stack, nobody can cast spells or activate abilities. It just happens.',
  'Card types': 'Card types: creature, instant, sorcery, land, enchantment, artifact. Some cards count how many types are in the graveyards.',
  'Evoke': 'Evoke: pay a cheaper evoke cost and the creature arrives, does its arrival trick, then is sacrificed at once.',
  'Planeswalkers': 'Planeswalkers: cast with loyalty counters. Once a turn, use one ability to add or remove loyalty. Creatures can attack them instead of you.',
  'Flash': 'Flash: these permanents can be cast any time you could cast an instant, even in combat or on the other player\'s turn.',
  'Wither': 'Wither: this creature deals damage as -1/-1 counters, which stay after the turn ends.',
  'Persist': 'Persist: when it dies without a -1/-1 counter on it, it comes back with one.',
  'Champion': 'Champion: when it arrives, exile one of your creatures of the named type. When it leaves, that creature comes back.',
  'Leaves the battlefield': 'Leaves the battlefield: some cards trigger when they leave play for any reason, so killing them still gives you value.',
  'Hybrid mana': 'Hybrid mana: a two-colour symbol can be paid with either colour, so the card fits a deck of either colour.',
  'Toughness as power': 'Toughness as power: with Doran out, every creature deals combat damage equal to its toughness instead of its power.',
  'Exalted': 'Exalted: whenever a creature you control attacks alone, it gets +1/+1 for each exalted permanent you control.',
  'Devour': 'Devour: as it arrives, sacrifice any number of creatures. It gets +1/+1 counters for each one it eats.',
  'Ultimates': 'Ultimates: a planeswalker\'s biggest ability costs lots of loyalty. Protect it long enough and that ability can win the game.',
  'Unearth': 'Unearth: pay the unearth cost to return a creature from your graveyard with haste. At end of turn, or if it would leave play, exile it.',
  'Cascade': 'Cascade: when you cast it, reveal cards from your library until you hit a cheaper nonland card, and cast that card for free.',
  'Morph': 'Morph: cast a creature face down as a 2/2 for three mana, then pay its morph cost any time to turn it face up. Watch for face-down cards.',
  'Tribes': 'Tribal cards care about creature types. Elves pump elves, goblins pump goblins. Play the tribe together.',
  'Alternate wins': 'Some cards win the game a different way. If Phage deals combat damage to a player, that player loses. Block her or kill her.',
  'Punishing full hands': 'Black Vise deals 1 damage each turn for every card over four in your hand. Play cards fast, keep your hand small, and break the Vises.',
  'Landfall': 'Landfall: whenever a land enters the battlefield under your control, a landfall card triggers. Play a land every turn, and hold one back for the right moment.',
  'Quests': 'Quests: a quest enchantment collects counters as you do something, like playing lands. When it has enough, sacrifice it for a big reward.',
  'Allies': 'Allies: whenever another Ally enters the battlefield under your control, every Ally you already have triggers. The more you have, the better each new one gets.',
  'Level up': 'Level up: pay the level up cost any time you could cast a sorcery to put a level counter on the creature. At enough levels it gets bigger and gains abilities.',
  'Eldrazi Spawn': 'Eldrazi Spawn: 0/1 tokens you can sacrifice for one colourless mana. They chump block too. The decks that make them are ramping into something huge.',
  'Annihilator': 'Annihilator: whenever it attacks, the defending player sacrifices that many permanents. Keep cheap permanents to give up, and kill it before it attacks twice.',
  'Metalcraft': 'Metalcraft: some cards get stronger while you control three or more artifacts. Keep your artifacts on the table, and kill the opponent\'s to switch theirs off.',
  'Infect': 'Infect: these creatures deal damage as -1/-1 counters to creatures and as poison counters to players. Ten poison counters and you lose, whatever your life total.',
  'Proliferate': 'Proliferate: choose any players and permanents that already have counters, and give each one more of a kind it already has. Poison counters count too.',
  'Phyrexian mana': 'Phyrexian mana: you can pay each Phyrexian symbol with one mana of its colour or with 2 life. Any deck can cast these cards, but the life adds up.',
  'Battle cry': 'Battle cry: whenever this creature attacks, each other attacking creature gets +1/+0. Go wide and attack together.',
  'Transform': 'Transform: double-faced cards have two sides. A werewolf is human until a turn passes with no spells cast, then it turns over into a wolf. Two spells in one turn turn it back.',
  'Morbid': 'Morbid: these cards get a bonus if a creature died this turn. Any creature counts, yours or theirs, so every trade can switch one on.',
  'Undying': 'Undying: when a creature with undying dies, if it had no +1/+1 counter on it, it comes back with one. Kill it twice, or exile it.',
  'Miracle': 'Miracle: if a miracle card is the first card you draw in a turn, you may reveal it and cast it right away for its much cheaper miracle cost.',
  'Populate': 'Populate: create a copy of a creature token you already control. Make one strong token first, then every populate copies it.',
  'Battalion': 'Battalion: whenever this creature and at least two other creatures attack, it gets its bonus. Attack in threes.',
  'Evolve': 'Evolve: whenever a creature with greater power or toughness enters under your control, an evolve creature gets a +1/+1 counter. Play small creatures first.',
  'Cipher': 'Cipher: after a cipher spell resolves, it is encoded on a creature. Whenever that creature deals combat damage to a player, its controller casts the spell again for free.',
  'Extort': 'Extort: whenever you cast a spell, you may pay one more mana to make each opponent lose 1 life while you gain that much.',
  'Overload': 'Overload: some spells have a second, bigger cost. Cast with overload, a spell that says "target" says "each" instead and hits everything it can.',
  'Heroic': 'Heroic: whenever you cast a spell that targets a heroic creature, its ability triggers. Cheap Auras and pump spells on one hero can win the game.',
  'Bestow': 'Bestow: cast the creature as an Aura for its bestow cost and it gives its stats to the creature it enchants. If that creature dies, the Aura stays as a creature.',
  'Devotion': 'Devotion: count the mana symbols of one colour in the costs of your permanents. Gods only become creatures when your devotion to their colour is high enough.',
  'Monstrosity': 'Monstrosity: pay the cost once and the creature gets that many +1/+1 counters and often a bonus. It can only become monstrous once.',
  'Constellation': 'Constellation: whenever an enchantment enters the battlefield under your control, a constellation card triggers. Enchantment creatures count.',
  'Ferocious': 'Ferocious: these cards get a bonus if you control a creature with power 4 or greater. Land a big creature first, then the rest gets better.',
  'Prowess': 'Prowess: whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn. Cast your spells before combat damage.',
  'Delve': 'Delve: each card you exile from your graveyard while casting this spell pays for one generic mana. A full graveyard makes big spells cheap.',
  'Raid': 'Raid: these cards get a bonus if you attacked with a creature this turn. Attack first, then cast them after combat.',
  'Manifest': 'Manifest: put the top card of your library onto the battlefield face down as a 2/2 creature. If it is a creature card, you can turn it face up for its mana cost.',
  'Outlast': 'Outlast: pay the cost and tap the creature to put a +1/+1 counter on it, any time you could cast a sorcery. Some cards reward every creature with a counter.',
  'Ingest': 'Ingest: whenever an ingest creature deals combat damage to a player, that player exiles the top card of their library. Processors then use those exiled cards for bonuses.',
  'Awaken': 'Awaken: cast the spell for its awaken cost and one of your lands also becomes a 0/0 Elemental creature with that many +1/+1 counters. It stays a land.',
  'Spell mastery': 'Spell mastery: these spells get a bonus if there are two or more instant and sorcery cards in your graveyard.',
  'Devoid': 'Devoid: the card has no colour, even though its cost uses coloured mana. Effects that care about colour do not see it.',
  'Surge': 'Surge: you may cast the spell for its surge cost if you or a teammate has cast another spell this turn. Chain a cheap spell into it.',
  'Investigate': 'Investigate: make a Clue token. Pay 2 and sacrifice it to draw a card. Crack Clues with spare mana at the end of their turn.',
  'Delirium': 'Delirium: these cards get stronger when there are four or more card types among cards in your graveyard. Fill it on purpose.',
  'Emerge': 'Emerge: you may cast the spell by sacrificing a creature and paying the emerge cost, reduced by that creature\'s mana value.',
  'Skulk': 'Skulk: the creature can\'t be blocked by creatures with greater power. Keep a small blocker back.',
  'Escalate': 'Escalate: pay the escalate cost for each mode beyond the first. One spell can do two or three things at once.',
  'Energy': 'Energy: some cards give you energy counters. Save them and spend them on bigger effects later.',
  'Vehicles': 'Vehicles: artifacts that become creatures only when you crew them. Tap creatures with enough total power, then attack.',
  'Fabricate': 'Fabricate: when the creature enters, put that many +1/+1 counters on it, or make that many 1/1 Servos instead.',
  'Improvise': 'Improvise: your artifacts can tap to help pay for the spell, one generic mana each.',
  'Revolt': 'Revolt: the card gets better if a permanent you controlled left the battlefield this turn. Sacrifice a Clue or a Map first.',
  'Crew': 'Crew: tap creatures with total power equal to the crew number to turn a vehicle into a creature until end of turn.',
  'Embalm': 'Embalm: pay the embalm cost and exile the card from your graveyard to make a token copy that is a white Zombie. Kill it twice.',
  'Exert': 'Exert: when it attacks you may exert it, and it will not untap during your next untap step. Use it when the extra effect wins the game.',
  'Aftermath': 'Aftermath: the second half of the split card can only be cast from your graveyard, and is then exiled. Cast the first half first.',
  'Eternalize': 'Eternalize: pay the eternalize cost and exile the card from your graveyard to make a 4/4 black Zombie copy. Exile their graveyard.',
  'Explore': 'Explore: reveal the top card of your library. If it is a land it goes to your hand. If not, the creature gets a +1/+1 counter and you may put the card into your graveyard.',
  'Treasure': 'Treasure: a token you can sacrifice for one mana of any colour. Save it for the turn you need the extra mana.',
  'Enrage': 'Enrage: it triggers each time the creature is dealt damage. Blocking and fighting with it are good ways to set it off.',
  'Ascend': 'Ascend: control ten permanents and you get the city\'s blessing for the rest of the game. Lands and tokens count.',
  'Lifelink': 'Lifelink: damage dealt by the creature also gains its controller that much life. Race it carefully, or remove it.',
  'Sagas': 'Sagas: an enchantment that gets a lore counter each turn and does a chapter ability for each one. When the last chapter is done, it is sacrificed.',
  'Historic': 'Historic: artifacts, legendary cards and Sagas. Some cards get better when you cast one.',
  'Legendary sorceries': 'Legendary sorceries can only be cast if you control a legendary creature or planeswalker. Keep a legend on the table first.',
  'Surveil': 'Surveil: look at the top cards of your library, then put any of them into your graveyard and the rest back on top in any order. It digs and fuels graveyard cards.',
  'Mentor': 'Mentor: when this creature attacks, put a +1/+1 counter on an attacking creature with lesser power. Attack with the small ones beside it.',
  'Afterlife': 'Afterlife: when the creature dies, you make that many 1/1 flying Spirit tokens. Trading it away still leaves something behind.',
  'Amass': 'Amass: put counters on your Army token, or make one first. Kill the Army and all of its counters go with it.',
  'Adventures': 'Adventures: an Adventure card is a spell and a creature in one. Cast the Adventure first, the card goes to exile, and later you can cast the creature from there.',
  'Food': 'Food: a Food token is an artifact. Pay 2, tap and sacrifice it to gain 3 life. Some cards get stronger when you control Food.',
  'Escape': 'Escape: cast the card from your graveyard by paying its escape cost and exiling other cards from your graveyard. A full graveyard is a second hand.',
  'Mutate': 'Mutate: cast a mutating creature on top of or under a non-Human creature you control. They become one creature with both sets of abilities.',
  'Cycling matters': 'Cycling matters: a card that cycles is never dead in hand, and some decks reward you for doing it. Count your cycling cards when deciding what to keep.',
  'Modal double-faced cards': 'Modal double-faced cards: one card with two faces. Cast either face from your hand; a land face can be played as a land, so it is never a dead draw.',
  'Foretell': 'Foretell: pay 2 on your turn to set the card face down in exile. On a later turn, cast it for its foretell cost.',
  'Learn': 'Learn: get a Lesson from outside the game, or discard a card to draw a card. Most of the time it is a way to find what you need.',
  'Magecraft': 'Magecraft: triggers whenever you cast or copy an instant or sorcery spell. Keep the mage on the table, then cast spells.',
  'Dungeons': 'Dungeons: venture into the dungeon to move to a room and get its effect. Each new venture goes deeper, and the last room is the best.',
  'Day and night': 'Day and night: it starts as neither. It becomes day or night after a player casts no spells on their own turn, and returns to day if a player casts two or more spells in a turn. Werewolves transform with it.',
  'Disturb': 'Disturb: cast the back face of this spirit card from your graveyard. A creature that dies can come back as an aura or a spirit.',
  'Reconfigure': 'Reconfigure: an Equipment creature can pay to attach to another creature, and pay again to become a creature once more.',
  'Shield counters': 'A shield counter protects a permanent: the next time it would be destroyed or take damage, remove the counter instead.',
  'Connive': 'Connive: draw a card, then discard one. If you discarded a nonland card, the creature gets a +1/+1 counter.',
  'Read ahead': 'Read ahead: when this saga enters, you may begin at any chapter. Pick the chapter you need and skip the earlier ones.',
  'Domain': 'Domain counts the basic land types among lands you control. Plains, Island, Swamp, Mountain and Forest each count once, so mixed lands make domain cards cheaper.',
  'Prototype': 'Prototype: you may cast this card for a smaller cost as a smaller creature, or for its full cost as the big one.',
  'Enlist': 'Enlist: as this creature attacks, you may tap a non-attacking creature you control. This creature gets +X/+0, where X is the tapped creature\'s power.',
  'Toxic': 'Toxic: a creature with toxic gives the player poison counters when it deals combat damage to them. A player with ten poison counters loses the game.',
  'Oil counters': 'Oil counters: Phyrexian permanents store them and spend them for effects. They are a resource, like charge, that can be used up or built up.',
  'Battles': 'A battle is a permanent you attack. It has defense counters, and when the last is removed, the battle flips and its owner gets a reward.',
  'Incubate': 'Incubate: create an Incubator token with counters on it. Pay to flip it into a Phyrexian creature that carries them.',
  'Bargain': 'Bargain: as you cast a spell, you may sacrifice an artifact, enchantment or token. If you do, the spell gets a better effect.',
  'Roles': 'Roles are Aura tokens with a name. Each creature can only wear one of yours, and each Role gives a small bonus like a counter, ward or extra power.',
  'Discover': 'Discover N: reveal cards from the top of your library until you find a nonland card of that value or lower. Cast it free or put it in your hand.',
  'Collect evidence': 'Collect evidence N: exile cards from your graveyard with total mana value N or more. It is a cost, so the spell it powers is stronger.',
  'Plot': 'Plot: exile a card from your hand as part of a spell\'s cost. On a later turn you may cast it from exile for free.',
  'Offspring': 'Offspring: pay extra as you cast the creature and you also get a 1/1 token copy of it.',
  'Rooms': 'A Room is an enchantment with two doors. Cast one half, then pay to unlock the other later.',
  'Survival': 'Survival: at the start of your second main phase, if the creature is tapped, its survival ability triggers.',
  'Playing under a lock': 'A lock stops cards from untapping or moving. Break it, or win with what\'s already in play.',
};
// Every Story deck says what it is (Randall, 2 Nov 2026): Historical Exact, Historical Tribute or
// Experimental. A deck with a documented original lists every change from it, with the reason.
export const DECK_LABELS = {exact: 'Historical Exact', tribute: 'Historical Tribute', experimental: 'Experimental'};
const LABEL_LINE = {exact: 'The original list, card for card.', tribute: 'Built from this era\'s cards for the story.', experimental: 'A deck made for this fight.'};
export function deckDossierMarkup(deck) {
  if (!deck || !DECK_LABELS[deck.label]) return '';
  const changes = deck.changes || [];
  const line = deck.rules || deck.note || LABEL_LINE[deck.label];
  return `<section class="st-dossier" aria-label="About this deck"><span class="st-dossier-label st-dossier-label--${esc(deck.label)}">${esc(DECK_LABELS[deck.label])}</span><p>${esc(line)}</p>
    ${changes.length ? `<h3>Changed from the ${esc(deck.original?.source || 'original')}</h3><ul class="st-changes">${changes.map(c => `<li><span class="st-change-cards"><s>${esc(c.from)}</s><b>${esc(c.to)}</b></span><span class="st-change-why">${esc(c.why)}</span></li>`).join('')}</ul>` : ''}
  </section>`;
}
// The archive record a secret boss opens with: what the deck was, why it won, how to beat it, what came after.
export function archiveRecordMarkup(a) {
  if (!a) return '';
  const row = (k, v) => v ? `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>` : '';
  return `<aside class="st-learn st-archive" aria-label="Archive record"><span class="st-learn-tag">Archive record · ${esc(a.when)}</span>
    <p class="st-archive-what">${esc(a.what)}</p>
    <dl>${row('Format', a.format)}${row('Why it won', a.why)}${row('How to beat it', a.beat)}${row('What came next', a.after)}</dl></aside>`;
}
// What a battle pays, in words: era packs for your side, the villain's signature card for theirs.
export const rewardText = (rw = {}, set = '') => rw.card ? `${esc(rw.card.name)}${rw.coins ? ` and ${rw.coins} coins` : ''}`
  : `${rw.packs || 1} ${esc(SET_NAMES[set] || set.toUpperCase())} ${(rw.packs || 1) > 1 ? 'packs' : 'pack'}${rw.coins ? ` and ${rw.coins} coins` : ''}`;
export function storyBattleMarkup({act, data, battle: b, progress, econ, ui = {}, ownDecks = [], avatarUrl = '', listHtml = ''}) {
  const rec = progress.battles?.[b.id] || {}, villainOpen = battleCleared(progress, b.id), seat = villainOpen && ui.seat === 'villain' ? 'villain' : 'hero';
  const mine = b[seat], theirs = b[seat === 'hero' ? 'villain' : 'hero'];
  const person = side => data.cast[b[side].who] || {name: 'You'};
  const face = side => b[side].who === 'you' && avatarUrl ? `background-image:url(${esc(avatarUrl)});background-position:50% 50%` : faceStyle(person(side).portrait);
  const listOpen = !!ui.listOpen;
  // Each side pays once: say what this win pays, or point at the other side's reward once yours is claimed.
  const rw = b.reward || {}, mineDone = seat === 'villain' ? !!rec.villain : !!rec.loaner, ownPick = (ui.deck || 'loaner') !== 'loaner';
  // A boss pays a Collector pack (every card holo) on the first hero-side win, with any deck.
  const collector = b.slot >= 8 && seat === 'hero' && !villainOpen ? ' + a Collector pack' : '';
  const prize = ownPick ? (collector ? `<small>Your deck</small> XP${collector}` : '<small>Your deck</small> XP only') : !mineDone ? `<small>Win</small> ${rewardText(rw[seat], b.rewardSet)}${collector}`
    : seat === 'hero' && !rec.villain && rw.villain?.card ? `<small>Their side</small> ${rewardText(rw.villain, b.rewardSet)}` : '<small>Reward claimed</small>';
  const deckChoice = ui.deck && ui.deck !== 'loaner' ? ownDecks.find(d => d.id === ui.deck) : null;
  const sideCard = (side, you) => `<article class="st-side${you ? ' st-side--you' : ''}" data-side="${side}"><span class="st-side-face" style="${face(side)}" aria-hidden="true"></span>
    <span class="st-side-copy"><span class="st-side-who">${you ? 'You play' : 'Opponent'}</span><h2>${esc(person(side).name)}</h2>${you ? '' : `<p>${esc(b[side].deck.name)}</p>`}</span></article>`;
  // Deck choice: the app's deck shelf cards. The loaner deck shows its lead card in the act's own printing.
  const cropOf = id => `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`;
  const lead = deck => deck.cards.find(r => !/^(snow-covered )?(plains|island|swamp|mountain|forest)$/i.test(r.name));
  const count = deck => deck.cards.reduce((t, r) => t + (Number(r.qty) || 0), 0);
  const deckCard = ({id, name, art, sub, ok = true, reason = ''}) => `<button type="button" class="home-personal-deck st-deck-opt" data-act="storyDeckPick" data-story-deck="${esc(id)}" aria-pressed="${(ui.deck || 'loaner') === id}"${(ui.deck || 'loaner') === id ? ` aria-expanded="${listOpen}" aria-controls="stDeckList"` : ''} ${ok ? '' : 'disabled'}><span class="home-personal-art" aria-hidden="true">${art ? `<img src="${esc(art)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span><span class="home-personal-copy"><b>${esc(name)}</b><small>${esc(ok ? sub : reason)}</small></span>${(ui.deck || 'loaner') === id ? '<span class="st-deck-chev" aria-hidden="true"></span>' : ''}</button>`;
  const loanLead = lead(mine.deck);
  const picks = [deckCard({id: 'loaner', name: mine.deck.name, art: loanLead?.id ? cropOf(loanLead.id) : '', sub: `Story deck · ${count(mine.deck)} cards`}),
    ...(ownDecks.length ? ownDecks.map(d => deckCard({id: d.id, name: d.name, art: d.art || '', sub: `Your deck · ${count(d)} cards`, ok: d.fits.ok, reason: d.fits.reason})) : [])].join('');
  // Their list stays secret until you've beaten them; after that you can play their side too.
  const listSide = villainOpen && ui.listSide === 'theirs' ? 'theirs' : 'mine';
  const learn = (b.teaches || []).filter(t => LESSONS[t]);
  // The deck whose list is open: theirs, the Story loaner on your side, or none for your own deck.
  const listDeck = listSide === 'theirs' ? theirs.deck : (ui.deck || 'loaner') === 'loaner' ? mine.deck : null;
  return `<section class="play-menu st-screen st-duel" aria-labelledby="playTitle">${head(b.title, econ, `Act ${act} · ${b.slot === 8 ? 'Boss' : b.kind}`, 'storyOpenAct', 'Back to the act')}
    <div class="st-duel-stage" style="--st-bg:url(${esc(person('villain').portrait?.crop || '')})">
      <section class="pl-arena st-arena" aria-label="This battle">${sideCard(seat, true)}<span class="pl-vs" aria-hidden="true"><b><span>VS</span></b></span>${sideCard(seat === 'hero' ? 'villain' : 'hero', false)}</section>
      <p class="st-duel-blurb">${esc(b.blurb)}</p>
    </div>
    ${archiveRecordMarkup(b.archive)}
    ${learn.length ? `<aside class="st-learn" aria-label="New in this battle"><span class="st-learn-tag">New in this battle</span>${learn.map(t => `<p><b>${esc(t)}</b> ${esc(LESSONS[t])}</p>`).join('')}</aside>` : ''}
    <div class="home-personal-grid st-deck-grid" role="group" aria-label="Your deck">${picks}</div>
    <div class="st-duel-bar">
      ${villainOpen ? `<div class="st-seg" role="group" aria-label="Side"><button data-act="storySeat" data-story-seat="hero" aria-pressed="${seat === 'hero'}">${esc(person('hero').name)}</button><button data-act="storySeat" data-story-seat="villain" aria-pressed="${seat === 'villain'}">${esc(person('villain').name)}</button></div>` : ''}
      <span class="st-duel-stars">${starsRow(rec)}</span>
      <span class="st-reward">${prize}</span>
      <button class="pl-mode-cta st-play" data-act="storyPlay">${battleCleared(progress, b.id) ? 'Replay' : 'Duel'}</button>
    </div>
    ${listOpen ? `<section class="st-decks" id="stDeckList" aria-label="Decklist">
      <div class="st-lists">
        ${villainOpen ? `<div class="st-seg" role="group" aria-label="Decklist"><button data-act="storyListSide" data-story-list="mine" aria-pressed="${listSide === 'mine'}">Your deck</button><button data-act="storyListSide" data-story-list="theirs" aria-pressed="${listSide === 'theirs'}">Their deck</button></div>` : ''}
        ${deckDossierMarkup(listDeck)}
        ${listHtml}
      </div>
    </section>` : ''}
  </section>`;
}

// Talking heads: one line at a time, the speaker lit, everyone else dimmed. Tap to go on, Skip to end.
// Returns a promise that settles when the scene closes.
export function playScene({lines, cast, leftWho, rightWho, avatarUrl = '', title = '', doc = document}) {
  return new Promise(resolve => {
    if (!lines?.length) return resolve();
    const el = doc.createElement('div');
    el.className = 'st-scene'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title || 'Story');
    const faceUrl = who => who === 'you' ? avatarUrl : cast[who]?.portrait?.crop || '';
    const bg = cast[rightWho]?.portrait?.crop || cast[leftWho]?.portrait?.crop || '';
    el.innerHTML = `<span class="st-scene-bg" style="background-image:url(${esc(bg)})"></span>
      <figure class="st-talker st-talker--left"><span class="st-talker-face"></span></figure>
      <figure class="st-talker st-talker--right"><span class="st-talker-face"></span></figure>
      <div class="st-say" aria-live="polite"><b class="st-say-name"></b><p class="st-say-line"></p><span class="st-say-next" aria-hidden="true"></span></div>
      <button class="st-skip" type="button">Skip</button>`;
    const left = el.querySelector('.st-talker--left'), right = el.querySelector('.st-talker--right'), name = el.querySelector('.st-say-name'), text = el.querySelector('.st-say-line'), say = el.querySelector('.st-say');
    const setFace = (fig, who) => { const url = faceUrl(who), f = fig.querySelector('.st-talker-face'); fig.dataset.who = who || ''; fig.hidden = !url; f.style.backgroundImage = url ? `url("${url}")` : ''; f.style.backgroundPosition = cast[who]?.portrait?.focus || '50% 30%'; };
    setFace(left, leftWho); setFace(right, rightWho);
    let i = -1, typing = 0, full = '', closed = false;
    const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const close = () => { if (closed) return; closed = true; clearInterval(typing); el.classList.add('st-scene--out'); doc.removeEventListener('keydown', key, true); setTimeout(() => { el.remove(); resolve(); }, reduce ? 0 : 260); };
    const next = () => {
      if (typing) { clearInterval(typing); typing = 0; text.textContent = full; say.classList.add('done'); return; }
      i++; if (i >= lines.length) return close();
      const l = lines[i], stage = l.who === 'stage' || l.who === 'narrator';
      // A third speaker takes the side of whoever they stand with: the villain's side if it's the villain.
      if (!stage && l.who !== leftWho && l.who !== rightWho) { if (l.who === rightWho) setFace(right, l.who); else setFace(left, l.who); }
      const onRight = l.who === right.dataset.who;
      left.classList.toggle('on', !stage && !onRight); right.classList.toggle('on', !stage && onRight);
      el.classList.toggle('st-scene--stage', stage); say.classList.toggle('st-say--right', onRight); say.classList.toggle('st-say--whisper', !!l.whisper || !!l.offstage);
      name.textContent = stage ? '' : (cast[l.who]?.name || l.who);
      full = (l.aside ? `(${l.aside}) ` : '') + (l.quote ? `“${l.line}”` : l.line);
      say.classList.remove('done'); text.textContent = '';
      if (reduce) { text.textContent = full; say.classList.add('done'); return; }
      let k = 0; typing = setInterval(() => { k += 2; text.textContent = full.slice(0, k); if (k >= full.length) { clearInterval(typing); typing = 0; say.classList.add('done'); } }, 18);
    };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next(); } };
    el.addEventListener('click', e => { if (e.target.closest('.st-skip')) close(); else next(); });
    doc.addEventListener('keydown', key, true);
    doc.body.append(el);
    requestAnimationFrame(() => { el.classList.add('st-scene--in'); el.querySelector('.st-skip').focus({preventScroll: true}); next(); });
  });
}

// In-match speech: a bubble grows out of the speaker's seat portrait and fades. It never takes a tap
// and never pauses play. Cues: start, big (first creature of power 4+), low (life 5 or less), win, loss.
export function createStoryBubbles({root, battle, cast, playerSide, avatarUrl = '', doc = document, now = () => Date.now()}) {
  const cpuSide = playerSide === 'hero' ? 'villain' : 'hero';
  const said = new Set(), queue = [];
  let busy = false, mySeat = null, faced = false, disposed = false;
  // What the table showed this match, for Story deeds (story-deeds.js): only what the viewer saw.
  const seen = createMatchFacts();
  const sideOf = who => who === 'me' ? playerSide : cpuSide;
  const speaker = side => battle[side].who;
  const lineFor = (side, cue) => battle.cues?.[side]?.[cue] || null;
  // A cue can be a plain line or {who, line}: someone else speaks from that seat (Jolrael at Kaervek's half life).
  // The seat's portrait (its crest badge) when the table draws one, otherwise the seat itself.
  const seatEl = mine => root.querySelector(mine ? '.play-match-seat[data-seat="you"]' : '.play-match-seat[data-player-seat]:not([data-seat="you"])');
  const anchor = mine => { const s = seatEl(mine); return s?.querySelector('.play-match-profile-badge') || s; };
  function show({side, text, who: by}) {
    const mine = side === playerSide, who = by || speaker(side), url = who === 'you' ? avatarUrl : cast[who]?.portrait?.crop || '';
    const b = doc.createElement('div');
    b.className = `st-bubble ${mine ? 'st-bubble--me' : 'st-bubble--them'}`; b.setAttribute('role', 'status'); b.setAttribute('aria-live', 'polite');
    b.innerHTML = `${url ? `<span class="st-bubble-face" style="background-image:url(${esc(url)});background-position:${esc(cast[who]?.portrait?.focus || '50% 30%')}"></span>` : ''}<span class="st-bubble-copy"><b>${esc(cast[who]?.name || 'You')}</b><span>${esc(text)}</span></span>`;
    const a = anchor(mine), r = a?.getBoundingClientRect?.(), vw = doc.documentElement.clientWidth, vh = doc.documentElement.clientHeight;
    if (r && r.width) {
      const x = Math.min(Math.max(12, r.left + r.width / 2 - 150), vw - 312);
      b.style.left = x + 'px';
      if (mine) b.style.bottom = Math.max(12, vh - r.top + 10) + 'px'; else b.style.top = Math.min(vh - 120, r.bottom + 10) + 'px';
      b.style.setProperty('--tail-x', Math.max(18, Math.min(282, r.left + r.width / 2 - x)) + 'px');
    } else b.classList.add(mine ? 'st-bubble--dock-me' : 'st-bubble--dock-them');
    root.append(b);
    requestAnimationFrame(() => b.classList.add('in'));
    return new Promise(done => setTimeout(() => { b.classList.remove('in'); b.classList.add('out'); setTimeout(() => { b.remove(); done(); }, 300); }, Math.min(5200, 2200 + text.length * 45)));
  }
  async function pump() { if (busy) return; busy = true; while (queue.length && !disposed) { await show(queue.shift()); await new Promise(r => setTimeout(r, 250)); } busy = false; }
  const say = (who, cue) => { const side = sideOf(who), key = side + ':' + cue; if (said.has(key)) return; said.add(key); const c = lineFor(side, cue); if (!c) return; queue.push(typeof c === 'string' ? {side, text: c} : {side, text: c.line, who: c.who}); pump(); };
  // The opponent's seat wears their character's portrait.
  function dressSeat() {
    const badge = seatEl(false)?.querySelector('.play-match-profile-badge'), who = speaker(cpuSide), url = who === 'you' ? avatarUrl : cast[who]?.portrait?.crop;
    if (!badge || !url || badge.querySelector(':scope>.st-seat-face')) return;
    const f = doc.createElement('span'); f.className = 'st-seat-face'; f.setAttribute('aria-hidden', 'true'); f.style.backgroundImage = `url("${url}")`; f.style.backgroundPosition = cast[who]?.portrait?.focus || '50% 30%'; badge.append(f); faced = true;
  }
  return {
    update(state) {
      if (disposed || state?.phase !== 'playing') return;
      const s = state.game?.status?.surface; if (!s) return;
      mySeat = s.seat ?? mySeat; dressSeat();
      seen.update(s);
      if ((s.turn || 0) >= 1 && !said.has(cpuSide + ':start')) { say('cpu', 'start'); setTimeout(() => say('me', 'start'), 400); }
      for (const p of s.players || []) if (Number.isFinite(p.life) && p.life <= 5 && p.life > 0) say(p.seat === mySeat ? 'me' : 'cpu', 'low');
      for (const p of s.players || []) if (Number.isFinite(p.life) && p.life <= 10 && p.life > 5) say(p.seat === mySeat ? 'me' : 'cpu', 'half');
      for (const c of s.cards || []) if (c.zone === 'Battlefield' && c.types?.includes('Creature') && Number(c.power) >= 4) say(c.controller === mySeat ? 'me' : 'cpu', 'big');
    },
    finish(outcome) {
      if (disposed || !['win', 'loss'].includes(outcome)) return;
      say('cpu', outcome === 'win' ? 'loss' : 'win'); say('me', outcome === 'win' ? 'win' : 'loss');
    },
    destroy() { disposed = true; queue.length = 0; root.querySelectorAll('.st-bubble,.st-seat-face').forEach(n => n.remove()); },
    stats: () => seen.snapshot(),
    _faced: () => faced,
  };
}

// The Story tile on the Play home: the act you're on, its boss art, and where you are in it.
export function storyTileMarkup(progress) {
  const now = Math.min(currentAct(progress), STORY_ACTS.length), a = STORY_ACTS.find(x => x.act === now), done = currentAct(progress) > STORY_ACTS.length;
  const cleared = Array.from({length: 8}, (_, i) => battleCleared(progress, `a${now}b${i + 1}`)).filter(Boolean).length;
  return `<button class="pl-mode st-tile" data-act="storyHome"><span class="pl-mode-art" style="background-image:url(${esc(a.art.crop)});background-position:50% 35%" aria-hidden="true"></span>
    <span class="st-tile-copy"><span class="pl-mode-name">Story</span><span class="pl-mode-copy">${done ? 'Every act so far is cleared.' : `Act ${now} · ${esc(a.title)}`}</span>${symbols(a)}</span>
    <span class="pl-mode-foot">${done ? '' : ring(cleared, 8, cleared + ' of 8 battles won')}<span class="pl-mode-cta">${cleared || now > 1 ? 'Continue' : 'Begin'}</span></span></button>`;
}
export {STAR_VALUE};
