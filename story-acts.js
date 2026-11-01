// Story mode act metadata (story-mode-acts.md Parts C, F and G). Small on purpose: the client and
// the worker both import it. The battles themselves (both decks, scenes, cue lines) live in
// data/story/act-<n>.json and load only when an act opens.
export const STORY_ACTS = [
  {act: 1, age: 'The Old World', title: 'The Dawn of Dominaria', years: '1993 to 1994',
    sets: ['lea', 'leb', '2ed', 'arn', 'atq'], landSet: 'lea', packSets: ['lea', 'arn', 'atq'],
    art: {set: 'atq', number: '57', name: "Mishra's War Machine", crop: 'https://cards.scryfall.io/art_crop/front/8/f/8f6b4652-a1d4-418f-a89b-6a977a920a9e.jpg'}},
  {act: 2, age: 'The Old World', title: 'Legends and the Dark', years: '1994',
    sets: ['3ed', 'leg', 'drk', 'fem'], landSet: '3ed', packSets: ['leg', 'drk', 'fem'],
    art: {set: 'leg', number: '246', name: 'Nicol Bolas', crop: 'https://cards.scryfall.io/art_crop/front/7/2/729feb73-4581-4f9d-ba47-bece72481b86.jpg'}},
  {act: 3, age: 'The Old World', title: 'Ice Age', years: '1995 to 1996',
    sets: ['ice', 'hml', 'all', '4ed'], landSet: 'ice', packSets: ['ice', 'hml', 'all'],
    art: {set: 'all', number: '55a', name: "Lim-Dûl's High Guard", crop: 'https://cards.scryfall.io/art_crop/front/b/5/b5afe9b5-3be8-472a-95c3-2c34231bc042.jpg'}},
  {act: 4, age: 'The Weatherlight Saga', title: 'The Jamuraan War', years: '1996 to 1997',
    sets: ['mir', 'vis', '5ed'], landSet: 'mir', packSets: ['mir', 'vis'],
    art: {set: 'mir', number: '185', name: "Kaervek's Torch", crop: 'https://cards.scryfall.io/art_crop/front/0/a/0a1624ab-e50e-48a3-acf7-457069914616.jpg'}},
  {act: 5, age: 'The Weatherlight Saga', title: 'The Rath Cycle', years: '1997 to 1998',
    sets: ['wth', 'tmp', 'sth', 'exo'], landSet: 'tmp', packSets: ['tmp', 'sth', 'exo'],
    art: {set: 'sth', number: '143', name: "Volrath's Stronghold", crop: 'https://cards.scryfall.io/art_crop/front/4/3/43bf015b-152e-4d67-b773-e75fb2487a32.jpg'}},
  {act: 6, age: 'The Weatherlight Saga', title: "Urza's War", years: '1998 to 1999',
    sets: ['usg', 'ulg', 'uds', '6ed'], landSet: 'usg', packSets: ['usg', 'ulg', 'uds'],
    art: {set: 'uds', number: '65', name: 'Phyrexian Negator', crop: 'https://cards.scryfall.io/art_crop/front/4/5/45a02d67-5931-49ae-a28e-57aa6f9c7f83.jpg'}},
  {act: 7, age: 'The Weatherlight Saga', title: 'The Mercadian Masques', years: '1999 to 2000',
    sets: ['mmq', 'nem', 'pcy'], landSet: 'mmq', packSets: ['mmq', 'nem', 'pcy'],
    art: {set: 'nem', number: '75', name: 'Volrath the Fallen', crop: 'https://cards.scryfall.io/art_crop/front/0/8/08bdd66e-9ca1-456e-a61c-7c96cf6f7c56.jpg'}},
];
export const SET_NAMES = {lea: 'Limited Edition Alpha', leb: 'Limited Edition Beta', '2ed': 'Unlimited Edition', arn: 'Arabian Nights', atq: 'Antiquities',
  '3ed': 'Revised Edition', leg: 'Legends', drk: 'The Dark', fem: 'Fallen Empires', ice: 'Ice Age', hml: 'Homelands', all: 'Alliances', '4ed': 'Fourth Edition',
  mir: 'Mirage', vis: 'Visions', '5ed': 'Fifth Edition',
  wth: 'Weatherlight', tmp: 'Tempest', sth: 'Stronghold', exo: 'Exodus',
  usg: "Urza's Saga", ulg: "Urza's Legacy", uds: "Urza's Destiny", '6ed': 'Classic Sixth Edition',
  mmq: 'Mercadian Masques', nem: 'Nemesis', pcy: 'Prophecy'};
export const storyAct = n => STORY_ACTS.find(a => a.act === Number(n)) || null;
export const setSymbolUrl = code => `https://svgs.scryfall.io/sets/${encodeURIComponent(code)}.svg`;
