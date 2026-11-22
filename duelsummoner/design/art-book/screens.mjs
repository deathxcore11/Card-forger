// Every screen: where things sit and which pieces it uses. Positions are for a 16:9 screen; phones in landscape
// keep the same corners, the Thor bottom screen takes the minimap and stats.
export const SCREENS = [
  { name: 'Run HUD', uses: ['UI06', 'UI07', 'UI08', 'UI09', 'UI10', 'UI11', 'UI12', 'UI13', 'IC11'], lay: [
    'Top left: LP bar (UI06) with the number inside; under it the five monster field slots (UI13) with each monster\'s level, then two rows of item slots (UI12).',
    'Top centre: stage clock plate (UI08) "STAGE 1  6:42"; under it the event strip: small icons for elite, boss A, boss B and gate at their times; a tracked quest line under that.',
    'Top: counters (UI09): run time, coins, kills, Star Chips, each with its symbol (IC11).',
    'Top right: level badge and the minimap (UI10), north up or rotating (setting).',
    'Bottom: the XP bar (UI07) across the full width.',
    'Boss fights: the boss bar (UI11) slides in under the clock; at most two bars.',
  ] },
  { name: 'Level-up offer', uses: ['UI14', 'UI15', 'IC08', 'IC05'], lay: [
    'The game slows to a stop and dims. Three card backs (UI15) deal in from the bottom and flip one by one, each in its rarity frame (UI14) with its rarity sound.',
    'Each card: element icon top left, the art, the name, what it does now and at the next level, one line of stat changes with stat icons.',
    'Under the cards: Redraw and Banish buttons with how many are left; Skip for coins.',
  ] },
  { name: 'Pause', uses: ['UI01', 'UI02', 'UI03', 'UI12', 'IC05', 'IC06', 'IC07', 'IC10'], lay: [
    'Title PAUSED across the top. Under it a plaque with the map name, difficulty and the score multiplier.',
    'Left window "Inventory" (UI01 with UI02): monsters with levels and forms, then items, then Spells and Traps. Under it "Run log": shrine and Blessing results so far, and the Oaths you swore (IC10).',
    'Centre: buttons Resume, Map, Settings, Restart, Quit (UI03), with corner brackets on the chosen one.',
    'Right window "Stats": the full Ledger stat sheet, grouped: life (Max LP, regen, Overheal, Shield, Guard, Sidestep, Lifesteal, Thorns); damage (Damage, Keen, crit damage, attack speed, extra cards, bounces); reach (size, card speed, duration, damage to elites, knockback, move speed); movement (extra jumps, jump height); fortune (Fortune, Difficulty, pickup range, XP, coins, Star Chips). Each with its stat icon.',
  ] },
  { name: 'Full map', uses: ['UI01', 'UI02', 'KA14', 'IC11'], lay: [
    'A big square window titled MAP with compass letters on all four sides and a close button.',
    'The parchment (KA14) shows what you have explored; the rest is drifting fog drawn in code. Icons: you, chests, shrines, the Broker, boss rings, the gate, the Descent Circle.',
    'Better than the reference: tap an icon to drop a pin that shows on the minimap and as a beam in the world.',
  ] },
  { name: 'Settings', uses: ['UI01', 'UI02', 'UI04', 'UI05'], lay: [
    'A window titled SETTINGS with tabs (UI04): Game, Video, Controls, Audio, Effects, Accessibility.',
    'Game: camera shake, aim mode (auto-aim nearest, smart aim, manual), aim randomness, show tips, minimap size and rotation, damage numbers.',
    'Video: resolution scale, frame rate cap (60, 90, 120), shadows, effects quality, view distance.',
    'Controls: rebinding for keyboard, mouse and pad; touch layout for phones; dual-screen layout for the Thor.',
    'Audio: master, music, effects, interface, boss cues.',
    'Effects: hit flashes, screen flash, effect opacity of your summons.',
    'Accessibility: reduce motion, colour-blind danger colours, big text, hold or toggle for dash.',
    'Each row: name on the left, arrows or a slider and its value on the right (UI05).',
  ] },
  { name: 'Main menu', uses: ['KA02', 'KA03', 'UI03', 'IC11', 'UI19', 'UI20'], lay: [
    'Backdrop KA03 with the logo top left. Buttons down the left: Play, Card Library, Quests, Shop, Settings, Quick Duel.',
    'Right: weekly leaderboard window (Global / Friends tabs) with the reset countdown, rows with rank medal, profile frame, duelist icon, name and score.',
    'Bottom left: the four quests closest to done with progress bars. Top right: Star Chips.',
  ] },
  { name: 'Duelist select', uses: ['KA04', 'PT01', 'PT02', 'PT03', 'PT04', 'PT05', 'UI01'], lay: [
    'Left: a grid of portraits (locked are dark silhouettes). Centre: the 3D duelist idling on a pedestal, turnable.',
    'Right window: name, mastery rank and bar, runs and kills, one fun line, starting monster, passive, outfit slots, Regalia slot.',
  ] },
  { name: 'Map select', uses: ['KA05', 'KA06', 'KA07', 'KA08', 'UI01', 'IC10'], lay: [
    'Map cards left (KA05 to KA08); the chosen map on the right with its blurb, Easy / Medium / Hard rows (Star Chip and score multipliers, best score, best time, duelist icons of who cleared it), Stages: 3, the Oaths button and Confirm.',
  ] },
  { name: 'Oaths', uses: ['IC10', 'NP03', 'UI01'], lay: [
    'The Oath Keeper (NP03) stands left with the book open. Right: eight wax seals (IC10); press one to swear it; each shows its rule, the score bonus and its quest.',
  ] },
  { name: 'Card Library', uses: ['UI14', 'UI15', 'UI04', 'IC01', 'IC02', 'IC03', 'IC04'], lay: [
    'Tabs: Duelists, Monsters, Spells and Traps, Items, Regalia. A grid of cards (locked ones are card backs with the quest that unlocks them).',
    'Right window: the chosen entry large, what it does, useful stats, and the "in offers" switch.',
  ] },
  { name: 'Quests', uses: ['UI21', 'UI04', 'IC11'], lay: [
    'Tabs: Duelists, Monsters, Spells and Traps, Items, General, Oaths, Mastery, Regalia. Rows with rarity borders, a progress bar, the reward and a hide-completed switch.',
  ] },
  { name: 'Results', uses: ['KA09', 'KA10', 'UI01', 'UI19', 'UI20'], lay: [
    'Backdrop KA09 or KA10. Score counting up, then time, level, kills, Fusions, Oaths kept, Star Chips, what downed you, damage taken.',
    'Right: where this run places on the boards (personal best, weekly, all-time) with the profile frame; buttons Main menu, Try again, Watch replay.',
  ] },
  { name: 'Shop (Broker)', uses: ['NP01', 'WX13', 'UI14', 'UI01'], lay: [
    'The Broker (NP01) waves beside the stall. Three to five item cards with prices, a reroll button and your coins.',
  ] },
  { name: 'Boss intro', uses: ['UI18', 'UI17'], lay: [
    'Camera swings to the boss, slow motion, the name card (UI18) slams in with the boss title; 3 s, skippable.',
  ] },
  { name: 'Controls: touch, controller and keys', uses: ['UI01', 'UI17'], lay: [
    'The game plays the same on the AYN Thor, a phone and a PC. Every action works by touch, by controller and by keys; nothing is touch-only or pad-only.',
    'Touch: left thumb anywhere on the left half is a floating move stick. Right side holds two big round buttons: Jump and Slide. Attacks are automatic.',
    'Tap the thing itself: tap a chest, shrine, door, merchant or pickup within reach and the Duelist uses it. If it is out of reach, the Duelist walks to it and then uses it. A soft ring shows what a tap will hit.',
    'Jump: one press. Slide: press while moving to duck low and slip under attacks and gaps; hold to stay crouched when standing still.',
    'Controller: left stick moves, right stick turns the camera, A jumps, B slides, X uses the nearest thing, Start pauses, Select opens the map. Button hints on screen change to match what was last touched.',
    'Menus: every button is at least a thumb wide, cards can be tapped, swiped or picked with the stick, and a press-and-hold on any item, card or stat shows what it does. Back is always a swipe from the edge, B, or Esc.',
    'Thor with two screens: the top screen is the game with nothing on it but the fight; the bottom screen holds the map, the hand and the inventory, all touchable while playing.',
    'Phone held sideways: buttons stay out of the middle of the screen and move in from the rounded corners and the camera cut-out.',
  ] },
];
