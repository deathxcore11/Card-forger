// Source-bound artwork for Home. No random illustrations, provider search, or
// archetype-wide cover substitution: a featured card must belong to this list.
import { pokemonDeckCover } from './artwork.js';
import { GAMES, GAME_ICON } from './games.js';
import { esc } from './ui.js';
import { safeNewsImage } from './community-sources.js';

const SOURCE_HOSTS = {
  mtg: ['magic.wizards.com', 'www.magic.wizards.com', 'www.mtgo.com', 'mtgo.com', 'edhtop16.com', 'topdeck.gg', 'magic.gg', 'www.magic.gg', 'locator.wizards.com'],
  ptcg: ['www.pokemon.com', 'pokemon.com', 'events.pokemon.com', 'play.limitlesstcg.com', 'limitlesstcg.com'],
  ygo: ['www.yugioh-card.com', 'yugioh-card.com', 'ygoprodeck.com'],
};
function allowedUrl(value, hosts) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) return '';
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && hosts?.includes(u.hostname) ? u.href : '';
  } catch { return ''; }
}
export const safeCommunityImage = safeNewsImage;
const sourceUrl = (value, game) => allowedUrl(value, SOURCE_HOSTS[game]);
const cleanName = value => typeof value === 'string' && value.length <= 180 && !/[<>\u0000-\u001f\u007f]/.test(value) ? value.trim() : '';
const numericId = value => /^(?:[1-9]\d{0,9})$/.test(String(value)) ? String(value) : '';
const rows = value => Array.isArray(value) ? value.slice(0, 300) : [];

export function communityDeckArtwork(game, deck) {
  if (!GAMES[game] || !deck || !cleanName(deck.key)) return null;
  const source = sourceUrl(deck.url, game) || sourceUrl(deck.eventUrl, game);
  if (!source) return null;
  const base = { kind: 'card', game, deckKey: deck.key, sourceUrl: source };
  if (game === 'ptcg') {
    const cover = pokemonDeckCover({ ...deck, list: rows(deck.list), icons: rows(deck.icons) });
    if (!cover || !cleanName(cover.name)) return null;
    return { ...base, name: cover.name, printing: cover.printing, cardId: `${cover.name} · ${cover.printing.set} ${cover.printing.number}` };
  }
  if (game === 'ygo') {
    const id = numericId(deck.cover);
    if (!id || ![...rows(deck.main), ...rows(deck.extra), ...rows(deck.side)].some(row => numericId(row) === id)) return null;
    return { ...base, name: `Yu-Gi-Oh! card ${id}`, cardId: id };
  }
  const name = cleanName(deck.cover);
  // MTGO supplies names, not printing IDs. An exact-name art endpoint is safer
  // than trusting an opaque cached d.art URL whose card identity is unavailable.
  if (!name || ![...rows(deck.main), ...rows(deck.commanders), ...rows(deck.side)].some(row => cleanName(row?.name) === name && Number(row.qty) > 0)) return null;
  return { ...base, name, cardId: name };
}

// Revalidate descriptors at the rendering boundary. URLs are constructed from
// the same identity, never passed through from a cache's arbitrary image field.
function cardImage(art, game, slide) {
  if (art?.kind !== 'card' || art.game !== game || art.deckKey !== slide.deckKey || art.sourceUrl !== sourceUrl(slide.url, game)) return '';
  if (game === 'ptcg') {
    const p = art.printing;
    if (!p || !cleanName(p.name) || p.name !== art.name || !/^[A-Z0-9]{2,8}$/.test(p.set || '') || !/^\d{1,3}$/.test(String(p.number)) || Number(p.number) < 1 || art.cardId !== `${p.name} · ${p.set} ${p.number}`) return '';
    return `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${p.set}/${p.set}_${String(Number(p.number)).padStart(3, '0')}_R_EN.png`;
  }
  if (game === 'ygo') return numericId(art.cardId) ? `https://images.ygoprodeck.com/images/cards_cropped/${art.cardId}.jpg` : '';
  return cleanName(art.name) && art.name === art.cardId ? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(art.name)}&format=image&version=art_crop` : '';
}
export function communityArtwork(game, slide = {}, { compact = false } = {}) {
  if (!GAMES[game]) return '';
  const deckImage = slide.kind === 'deck' ? cardImage(slide.artwork, game, slide) : '';
  const publisherImage = ['news', 'event'].includes(slide.kind) ? safeCommunityImage(slide.image, game, slide.sourceId, slide.url, slide.kind) : '';
  const deckContext = slide.kind === 'deck' || compact && !slide.url && (!slide.kind || slide.kind === 'link');
  if (!deckContext && !publisherImage) return ''; // News/source cards are honestly text-only.
  const src = deckImage || publisherImage, kind = deckImage ? 'card' : publisherImage ? 'publisher' : 'theme';
  const fallback = compact ? 'Game theme' : deckContext ? 'Game theme · deck art unavailable' : 'Article image unavailable';
  const credit = deckImage ? `Featured card: ${slide.artwork.cardId}` : 'Source image';
  const image = src ? `<img class="community-art-image" data-community-image src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '';
  const visual = deckImage && game === 'ptcg' ? `<span class="community-art-scan"><span class="community-art-window">${image}</span></span>` : image;
  return `<span class="community-art${compact ? ' community-art-compact' : ''}" data-community-art data-art-game="${game}" data-art-kind="${kind}" data-art-state="${src ? 'pending' : 'missing'}"${deckImage ? ` data-art-card="${esc(slide.artwork.cardId)}" data-art-deck="${esc(slide.deckKey)}"` : ''}${src ? ` data-art-source="${esc(slide.url)}"` : ''} aria-hidden="true">${deckContext ? `<span class="community-art-theme"><span class="community-art-orbit"></span><span class="community-art-emblem">${GAME_ICON[game]}</span><span class="community-art-lines"></span></span>` : ''}${visual}<span class="community-art-shade"></span><span class="community-art-caption community-art-fallback">${fallback}</span>${src ? `<span class="community-art-caption community-art-credit">${esc(credit)}</span>` : ''}</span>`;
}

// One request per exact image. Failed publisher art becomes a clean text card; no broken-image
// icon, retries, network discovery, or insertion of remotely supplied markup.
export function handleCommunityArtwork(event) {
  const image = event.target;
  if (!image?.matches?.('img[data-community-image]')) return;
  const wrapper = image.closest?.('[data-community-art]');
  if (!wrapper || wrapper.dataset.artState === 'missing') return;
  if (event.type === 'load' && image.naturalWidth > 0) wrapper.dataset.artState = 'ready';
  else if (event.type === 'error' || event.type === 'load') {
    image.hidden = true;
    wrapper.dataset.artState = 'missing';
    if (wrapper.dataset.artKind === 'publisher') { wrapper.hidden = true; wrapper.closest?.('.community-feature')?.classList?.add('feature-text-only'); }
  }
}
