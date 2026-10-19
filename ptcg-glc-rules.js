// Organizer rules snapshot, checked 2026-10-19. This is GLC's own list, not
// Expanded's list. Effective dates describe bans, not the date of our read.
// Printing identities are English TCGdex / PokemonTCG set IDs and collector
// numbers. A Pokémon's name alone never identifies its banned game card.
export const GLC_RULES = Object.freeze({
  version: 'glc-2026-04-20.checked-2026-10-19',
  checkedAt: '2026-10-19',
  latestBanEffectiveAt: '2026-04-20',
  source: 'https://gymleaderchallenge.com/rules',
  faq: 'https://gymleaderchallenge.com/faq/',
  banList: 'https://gymleaderchallenge.com/ban-list',
  scope: 'Organizer core rules and listed bans; regional release, older-print reprint/errata exceptions and event house rules require separate evidence.',
});

export const GLC_BANS = Object.freeze([
  { name: "Lysandre's Trump Card", effectiveAt: '2021-11-16', printings: [['xy4', '99'], ['xy4', '118']] },
  { name: 'Oranguru', effectiveAt: '2021-11-16', printings: [['sm5', '114']] },
  { name: 'Forest of Giant Plants', effectiveAt: '2022-01-10', printings: [['xy7', '74']] },
  { name: 'Chip-Chip Ice Axe', effectiveAt: '2022-06-08', printings: [['sm10', '165']] },
  { name: 'Hiker', effectiveAt: '2022-06-08', printings: [['sm7', '133'], ['sma', 'SV85'], ['sm115', 'SV85']] },
  { name: 'Kyogre', effectiveAt: '2022-11-11', printings: [['swsh4.5', '21'], ['swsh45', '21']] },
  { name: 'Pokémon Research Lab', effectiveAt: '2023-11-01', printings: [['sm11', '205']] },
  { name: 'Raikou', effectiveAt: '2024-09-01', printings: [['swsh4', '50']] },
  { name: 'Marshadow', effectiveAt: '2024-09-01', printings: [['sm3.5', '45'], ['sm35', '45'], ['smp', 'SM85']] },
  { name: 'Duskull', effectiveAt: '2024-09-01', printings: [['sm12', '83']] },
  { name: 'Double Colorless Energy', effectiveAt: '2025-04-24', allVersions: true },
  { name: 'Twin Energy', effectiveAt: '2025-04-24', printings: [['swsh2', '174'], ['swsh2', '209']] },
  { name: 'Dimension Valley', effectiveAt: '2026-04-20', printings: [['xy4', '93']] },
]);

// The FAQ names exactly these two shared-name copy-limit groups. Similar
// effects on other differently named Supporters do not create equivalence.
export const GLC_SHARED_NAMES = Object.freeze([
  ["Boss's Orders", 'Lysandre'],
  ["Professor's Research", 'Professor Sycamore', 'Professor Juniper'],
]);
