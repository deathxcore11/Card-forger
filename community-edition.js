// Reviewed launch edition. Publication/check dates never advance on a page visit.
// Expired editions disappear; daily publisher ingestion supplies later stories.
export const NEWS_EDITION = Object.freeze({
  checkedAt: '2026-10-23T00:00:00.000Z', expiresAt: '2026-10-26T00:00:00.000Z',
  stories: Object.freeze([
    { game: 'mtg', sourceId: 'wizards', title: 'Reality Fracture Secret Lair Bundle Delayed', publishedAt: '2026-10-19', category: 'Release',
      url: 'https://magic.wizards.com/en/news/announcements/reality-fracture-secret-lair-bundle-delayed',
      summary: 'Production and shipping delays may push the bundle past October 23. Arrival timing varies by location.', art: 'img/news/2026-10-19-magic-delay.webp' },
    { game: 'ptcg', sourceId: 'pokemon-rules', title: 'Mega Evolution—Delta Reign Rule Changes Announcement', publishedAt: '2026-10-22', category: 'Rules',
      url: 'https://www.pokemon.com/us/play-pokemon/about/mega-evolution/mega-evolution-delta-reign-rule-changes-announcement',
      summary: 'The Pokémon TCG rules announcement published October 22 lists November 20 as its effective date. Check the official update before upcoming events.', art: 'img/news/2026-10-22-pokemon-rules.webp' },
    { game: 'ygo', sourceId: 'konami-limited', title: 'Forbidden & Limited Lists – October 19, 2026', publishedAt: '2026-10-19', category: 'Rules',
      url: 'https://www.yugioh-card.com/en/limited/list_2026-10-19/',
      summary: 'The Advanced Format list takes effect October 19. The Perfectron Hydradrive Dragon change instead takes effect November 11.', art: 'img/news/2026-10-19-ygo-list.webp' },
  ].map(Object.freeze)),
});
export function editionStories(game, now = Date.now()) {
  if (now < Date.parse(NEWS_EDITION.checkedAt) || now >= Date.parse(NEWS_EDITION.expiresAt)) return [];
  return NEWS_EDITION.stories.filter(row => row.game === game).map(({art, ...row}) => ({...row, id:row.url, kind:'news', cadence:'weekly', fetchedAt:NEWS_EDITION.checkedAt, evidence:row.summary, whyItMatters:row.summary, editorial:'source-ranked'}));
}
// Exact article identity, never an arbitrary image URL received from a cache.
export function editionArtwork(game, slide) {
  return slide?.kind === 'news' ? NEWS_EDITION.stories.find(row => row.game === game && row.sourceId === slide.sourceId && row.url === slide.url)?.art || '' : '';
}

export function expiredEditionStory(row, now) {
  return now >= Date.parse(NEWS_EDITION.expiresAt) && row?.fetchedAt === NEWS_EDITION.checkedAt && NEWS_EDITION.stories.some(story => story.game === row.game && story.url === row.url && story.sourceId === row.sourceId);
}
