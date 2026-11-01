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
];
export const SET_NAMES = {lea: 'Limited Edition Alpha', leb: 'Limited Edition Beta', '2ed': 'Unlimited Edition', arn: 'Arabian Nights', atq: 'Antiquities',
  '3ed': 'Revised Edition', leg: 'Legends', drk: 'The Dark', fem: 'Fallen Empires', ice: 'Ice Age', hml: 'Homelands', all: 'Alliances', '4ed': 'Fourth Edition'};
export const storyAct = n => STORY_ACTS.find(a => a.act === Number(n)) || null;
export const setSymbolUrl = code => `https://svgs.scryfall.io/sets/${encodeURIComponent(code)}.svg`;
