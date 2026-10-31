import {esc} from './ui.js';
import {pokemonArtCrop} from './artwork.js';

// Collection banner (all three games): the card the player pinned with
// "Use artwork as… → Collection banner" stays until they change it. Without a pin the
// banner shows art from their own collection and changes every hour.
export const BANNER_HOUR = 3600000;

// The same hour gives the same card on every render and device; the next hour moves on.
export function bannerSlot(count, now = Date.now()) {
  if (!(count > 0)) return -1;
  const hour = Math.floor(now / BANNER_HOUR);
  return (Math.imul(hour, 2654435761) >>> 0) % count;
}

// items: [{id, name, sources:[url…]} | {id, name, ptcg:true, card}] from the player's own cards.
// pin: {cardId, name, image} saved in settings.collectionBanner[game].
export function pickBanner(items, pin, now = Date.now(), {fallback = null} = {}) {
  const usable = (items || []).filter(i => i && i.id && (i.ptcg ? i.card : i.sources?.length));
  if (pin?.cardId) {
    const hit = usable.find(i => String(i.id) === String(pin.cardId));
    if (hit) return {...hit, pinned: true};
    const known = fallback?.(pin);
    if (known) return {...known, pinned: true};
    if (pin.image) return {id: String(pin.cardId), name: pin.name || '', sources: [pin.image], pinned: true};
  }
  const pool = [...new Map(usable.map(i => [String(i.id), i])).values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const slot = bannerSlot(pool.length, now);
  return slot < 0 ? null : pool[slot];
}

function bannerArt(item) {
  if (!item) return '';
  if (item.ptcg) return pokemonArtCrop(item.card, 'page-hero-crop', item.src || '', {loading: 'eager'});
  const urls = item.sources;
  return `<img class="page-hero-img" src="${esc(urls[0])}" data-art-sources="${esc(JSON.stringify(urls))}" data-art-index="0" alt="" decoding="async" referrerpolicy="no-referrer">`;
}

// The page head with the banner behind it; without any art it stays a plain page head.
export function bannerHead(item, inner) {
  const art = bannerArt(item);
  return `<div class="page-head${art ? ' page-hero' : ''}"${art ? ` data-banner-card="${esc(item.id)}"${item.pinned ? ' data-banner-pinned' : ''}` : ''}>${art ? `<span class="page-hero-art" aria-hidden="true">${art}</span>` : ''}${inner}</div>`;
}

// What a pin stores: enough to draw the art even after the card leaves the collection.
export function bannerPin(game, card, image) {
  if (!card?.id || !/^(https:\/\/|img\/)/.test(String(image || ''))) return null;
  return {cardId: String(card.id).slice(0, 100), name: String(card.name || '').slice(0, 200), image: String(image).slice(0, 500)};
}
