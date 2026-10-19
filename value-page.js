import {printedCardColors} from './magic-card-color.js';
// Read-only Collection Value presentation shared by all three games. The caller
// supplies resolved owned-lot prices; this module never fetches or records value.
import { esc, usd } from './ui.js';
import { artworkHTML, knownPokemonPlaceholder } from './artwork.js';
import { finishAttrs, finishArtworkCard } from './finish-preview.js';
import { GAMES, GAME_COLOR, GAME_ICON } from './games.js';

const PALETTE = {
  White:'#f3ecd2', Blue:'#7fb6ea', Black:'#b7a6c9', Red:'#f08a6c', Green:'#79c98f', Multicolor:'#e8b95b', Colorless:'#c9ccd3',
  Grass:'#80c879', Fire:'#f08a6c', Water:'#7fb6ea', Lightning:'#efcf62', Psychic:'#b999df', Fighting:'#cfa17b', Darkness:'#958caf', Metal:'#aebfc8', Fairy:'#e7a9ce', Dragon:'#c8ad69',
  Trainer:'#b7a6e5', Energy:'#e7c96d', DARK:'#aa92d1', LIGHT:'#e8d995', EARTH:'#c7a075', WATER:'#78b7df', FIRE:'#ef8d73', WIND:'#82ccb5', DIVINE:'#e9c86e', Spell:'#75c7b8', Trap:'#da91bd', Unknown:'#929aaa',
};
const POKEMON_TYPES = new Set(['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal','Fairy','Dragon','Colorless']);
const MAGIC_COLORS = { W:'White', U:'Blue', B:'Black', R:'Red', G:'Green' };
const count = n => Number(n).toLocaleString('en-US');
const copies = n => `${count(n)} ${Number(n) === 1 ? 'copy' : 'copies'}`;
const finiteValue = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const dateValid = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
const dateLabel = date => new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' });

function bucket(game, card) {
  if (!card) return 'Unknown';
  if (game === 'mtg') {
    const colors = printedCardColors(card);
    if (colors === null) return 'Unknown';
    if (colors.some(c => !MAGIC_COLORS[c])) return 'Unknown';
    return colors.length > 1 ? 'Multicolor' : MAGIC_COLORS[colors[0]] || 'Colorless';
  }
  if (game === 'ptcg') {
    if (card.category === 'Trainer' || card.category === 'Energy') return card.category;
    const types = [...new Set(Array.isArray(card.types) ? card.types : [])].filter(t => typeof t === 'string' && POKEMON_TYPES.has(t));
    return types.length ? types.sort().join(' / ') : 'Unknown';
  }
  if (card.category === 'Spell' || card.category === 'Trap') return card.category;
  const attribute = String(card.attribute || '').toUpperCase();
  return ['DARK','LIGHT','EARTH','WATER','FIRE','WIND','DIVINE'].includes(attribute) ? attribute : 'Unknown';
}

export function valueComposition(game, rows = []) {
  const groups = new Map();
  for (const { entry, card, unit } of rows) {
    const qty = Number(entry?.qty);
    if (!finiteValue(unit) || !Number.isFinite(qty) || qty <= 0) continue;
    const key = bucket(game, card), group = groups.get(key) || { key, total:0, copies:0, colors:key.split(' / ').map(k => PALETTE[k] || PALETTE.Unknown) };
    group.total += unit * qty;
    group.copies += qty;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a,b) => b.total - a.total || a.key.localeCompare(b.key));
}

// Legacy observations remain visible, but are never promoted to fully priced
// snapshots. An unavailable value is a gap, not a fabricated $0 point.
export function valueHistoryModel(history = [], now = Date.now(), limit = Infinity) {
  const dated = new Map(), today = new Date(now).toISOString().slice(0,10);
  for (const point of Array.isArray(history) ? history : []) {
    if (!dateValid(point?.date) || point.date > today) continue;
    const valid = finiteValue(point.total), countValid = n => Number.isInteger(n) && n >= 0,
      coverage = countValid(point.copies) && countValid(point.unpriced) && point.unpriced <= point.copies,
      invalidCoverage = (point.copies != null && !countValid(point.copies)) || (point.unpriced != null && !countValid(point.unpriced)) || (countValid(point.copies) && countValid(point.unpriced) && point.unpriced > point.copies),
      supported = point.currency === 'USD' && point.basis === 'exact-owned-v1',
      incompatible = (point.currency != null && point.currency !== 'USD') || (point.basis != null && point.basis !== 'exact-owned-v1'),
      allMissing = coverage && point.copies > 0 && point.unpriced >= point.copies;
    const status = !valid || invalidCoverage || incompatible || allMissing ? 'unavailable' : coverage && supported ? point.unpriced > 0 ? 'partial' : 'complete' : 'legacy';
    dated.set(point.date, { date:point.date, total:status === 'unavailable' ? null : point.total, copies:point.copies, unpriced:point.unpriced, status });
  }
  const allPoints = [...dated.values()].sort((a,b) => a.date.localeCompare(b.date)),
    points = Number.isInteger(limit) && limit > 0 ? allPoints.slice(-limit) : allPoints;
  const tail = [];
  for (let i=points.length-1; i>=0 && points[i].status === 'complete'; i--) tail.unshift(points[i]);
  let change = null;
  if (tail.length > 1) {
    const first=tail[0], last=tail.at(-1), delta=Math.round((last.total-first.total)*100)/100;
    change={ date:first.date, delta, percent:first.total > 0 ? delta / first.total * 100 : null, direction:delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' };
  }
  return { points, change, recordedCount:allPoints.length };
}

const statusLabel = point => point.status === 'complete' ? 'Estimated value' : point.status === 'partial' ? `Known subtotal · ${copies(point.unpriced)} unpriced` : point.status === 'legacy' ? 'Legacy snapshot · price coverage unknown' : 'Value unavailable';

export function valueHistoryChart(history = [], now = Date.now()) {
  const { points, change, recordedCount } = valueHistoryModel(history, now, 365), plotted = points.filter(p => p.total !== null);
  if (!points.length) return '<div class="value-chart value-chart-empty"><h3>Value over time</h3><p class="muted small">No saved snapshots yet. Refresh prices to record your collection’s current value.</p></div>';
  const left=70, right=624, top=22, bottom=166, width=640, height=190;
  const vals=plotted.map(p => p.total), low=vals.length ? Math.min(...vals) : 0, high=vals.length ? Math.max(...vals) : 1,
    pad=Math.max((high-low)*.16, high*.04, .01), min=Math.max(0,low-pad), max=high+pad,
    start=Date.parse(points[0].date), span=Date.parse(points.at(-1).date)-start,
    x=p=>span ? left+(Date.parse(p.date)-start)/span*(right-left) : (left+right)/2,
    y=p=>bottom-(p.total-min)/Math.max(.01,max-min)*(bottom-top),
    pos=p=>`${x(p).toFixed(2)},${y(p).toFixed(2)}`;
  let lines='';
  for(let i=1;i<points.length;i++) if(points[i-1].status==='complete' && points[i].status==='complete') lines+=`<path class="value-chart-line" d="M${pos(points[i-1])} L${pos(points[i])}"/>`;
  const grid=plotted.length ? [max,(min+max)/2,min].map(n=>{const yy=bottom-(n-min)/(max-min)*(bottom-top);return `<line class="value-chart-grid" x1="${left}" x2="${right}" y1="${yy}" y2="${yy}"/><text class="value-chart-axis" x="${left-10}" y="${yy+4}" text-anchor="end">${usd(n)}</text>`;}).join('') : '';
  const dots=points.map(p=>p.total===null ? `<path class="value-chart-gap" d="M${x(p)-3},${bottom-3} l6,6 m-6,0 l6,-6"><title>${esc(dateLabel(p.date))} · Value unavailable</title></path>` : `<circle class="value-chart-point ${p.status}" cx="${x(p).toFixed(2)}" cy="${y(p).toFixed(2)}" r="4"><title>${esc(dateLabel(p.date))} · ${usd(p.total)} · ${esc(statusLabel(p))}</title></circle>`).join('');
  const movement=change ? `<p class="value-chart-change ${change.direction}"><strong class="no-ic">${change.delta > 0 ? '↑ +' : change.delta < 0 ? '↓ −' : '↔ '}${usd(Math.abs(change.delta))}${change.percent !== null && change.delta !== 0 ? ` (${change.delta > 0 ? '+' : '−'}${Math.abs(change.percent).toFixed(1)}%)` : ''}</strong><span>${change.direction === 'flat' ? 'Unchanged' : 'Total change'} since ${dateLabel(change.date)}</span></p>` : '';
  const range=plotted.length ? `<p class="value-chart-range" data-value-range>Plotted values: <strong>${usd(low)}${high!==low?` to ${usd(high)}`:''}</strong></p>` : '';
  const special=points.some(p=>p.status!=='complete');
  const legend=special ? `<div class="value-chart-legend">${points.some(p=>p.status==='partial')?'<span><i class="partial"></i>Known subtotal</span>':''}${points.some(p=>p.status==='legacy')?'<span><i class="legacy"></i>Legacy · coverage unknown</span>':''}${points.some(p=>p.status==='unavailable')?'<span><i class="unavailable">×</i>Unavailable</span>':''}</div>` : '';
  return `<div class="value-chart"><div class="value-section-head"><h3>Value over time</h3><span class="small muted">${recordedCount} saved ${recordedCount===1?'snapshot':'snapshots'}</span></div>${movement}${range}
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Collection value over time, recorded USD snapshots"><title>Collection value over time</title><desc>${plotted.length?'Only saved values are plotted.':'No priced snapshots available.'}${special?' Lines stop where price coverage is incomplete or unknown.':''}</desc>${grid}${lines}${dots}</svg>
    <div class="value-chart-dates"><span>${esc(dateLabel(points[0].date))}</span>${points.length>1?`<span>${esc(dateLabel(points.at(-1).date))}</span>`:''}</div>${legend}
    <p class="value-chart-note">${recordedCount>points.length?`Showing the latest ${points.length} snapshots; earlier records remain saved. `:''}${points.length===1 ? 'Your first saved snapshot. No earlier values have been estimated.' : 'Collection-total changes include copies, custom values and available prices, not market-only returns.'}${special?' Incomplete and legacy snapshots are not compared.':''}</p>
    <details class="value-history-details"><summary>View recorded values</summary><ol>${points.map(p=>`<li><time datetime="${p.date}">${esc(dateLabel(p.date))}</time><strong>${usd(p.total)}</strong><span>${esc(statusLabel(p))}</span></li>`).join('')}</ol></details>
  </div>`;
}

export function valuePageOverview({ game='mtg', value, history=[], rows=[], now=Date.now() }) {
  const allMissing=value.copies>0 && value.unpriced>=value.copies, known=finiteValue(value.total) && !allMissing,
    amount=known?usd(value.total):'—', label=!known?'Value unavailable':value.unpriced?'Known subtotal · USD':'Estimated value · USD',
    refresh=game==='mtg'?'refreshPrices':'tRefreshPrices', composition=valueComposition(game,rows), max=Math.max(0,...composition.map(g=>g.total)),
    by=game==='mtg'?'color':game==='ptcg'?'type':'attribute';
  return `<section class="panel value-panel value-overview"><div class="value-overview-head"><div class="value-overview-main"><p class="eyebrow value-game-label"><span aria-hidden="true">${GAME_ICON[game]||''}</span>${esc(GAMES[game]?.short||'')} · Your collection value</p><p class="value-amount" data-value-amount>${amount}</p><p class="value-coverage" data-value-coverage>${label}</p><p class="muted small">${copies(value.copies)}${value.unpriced?` · ${copies(value.unpriced)} without a price`:''}</p></div><button type="button" class="btn ghost small value-refresh" data-value-refresh data-act="${refresh}">↻ Refresh prices</button></div>${valueHistoryChart(history,now)}<p class="value-source-note">Includes your custom values. Unpriced copies are excluded, not valued at $0.</p></section>
    <section class="panel value-panel value-composition"><div class="value-section-head"><h3>By ${by}</h3><span class="small muted">${value.unpriced?'Known subtotal':'Owned value'}</span></div>${composition.length?composition.map(group=>`<div class="value-meter" data-value-group="${esc(group.key)}"><span class="value-meter-name"><i style="background:${group.colors.length>1?`linear-gradient(135deg,${group.colors.join(',')})`:group.colors[0]}"></i>${esc(group.key)}</span><b>${usd(group.total)}</b><span class="value-meter-track"><i style="width:${max?Math.max(0,Math.min(100,group.total/max*100)).toFixed(3):0}%;background:${group.colors.length>1?`linear-gradient(90deg,${group.colors.join(',')})`:group.colors[0]}"></i></span><small>${copies(group.copies)}</small></div>`).join(''):'<p class="muted small">No priced copies yet. Refresh prices or add a custom value to an owned lot.</p>'}${game==='ptcg'?'<p class="value-chart-note">Dual-type cards stay together. Trainer and Energy cards have their own groups.</p>':game==='ygo'?'<p class="value-chart-note">Monsters use their attribute; Spell and Trap cards have their own groups.</p>':''}</section>`;
}

function lotDetails(game, entry, card) {
  const condition=entry.condition||'Near Mint', variant=card?.variants?.find(v=>v.key===entry.variant)?.label||entry.variantLabel||entry.variant;
  if(game==='mtg') return [entry.printingVerified?(card?.set_name||card?.set):entry.setName||entry.set, entry.printingVerified?card?.collector_number:entry.collectorNumber, entry.finish||'nonfoil', condition].filter(Boolean).join(' · ');
  if(game==='ptcg') return [card?.set?.name||entry.setName,card?.set?.number?`#${card.set.number}`:'',variant,condition].filter(Boolean).join(' · ');
  return [entry.printing,entry.rarity,{'1st-edition':'First Edition',unlimited:'Unlimited',limited:'Limited Edition'}[entry.edition]||entry.edition,condition].filter(Boolean).join(' · ');
}

function valueLotArtwork(game, card, entry, shown) {
  const variant = game==='ptcg' ? card?.variants?.find(v=>v.key===entry.variant) : null;
  if (!variant?.image && !variant?.imageLarge) return artworkHTML(shown,'value-card-art');
  const urls = [...new Set([variant.image,variant.imageLarge].filter(url=>typeof url==='string' && /^(https?:\/\/|img\/)/.test(url) && !knownPokemonPlaceholder(url)))];
  return urls.length ? `<img class="value-card-art" src="${esc(urls[0])}" data-art-sources="${esc(JSON.stringify(urls))}" data-art-index="0" alt="${esc(entry.name)}" loading="lazy" referrerpolicy="no-referrer">` : artworkHTML(null,'value-card-art');
}

export function valueTopLots({ game='mtg', rows=[] }) {
  const top=rows.filter(r=>finiteValue(r.unit)&&Number(r.entry?.qty)>0).map(r=>({...r,total:r.unit*Number(r.entry.qty)})).sort((a,b)=>b.total-a.total||String(a.entry.name).localeCompare(String(b.entry.name))||String(a.entry.id).localeCompare(String(b.entry.id))).slice(0,12);
  return `<section class="panel value-panel value-top"><div class="value-section-head"><h3>Most valuable</h3><span class="small muted">Owned lots</span></div><div class="value-lots">${top.map(({entry,card,unit,total})=>{
    const action=game==='mtg'?`data-act="card" data-name="${esc(entry.name)}"`:`data-act="tCard" data-id="${esc(entry.cardId)}"`, ctx={priceFinish:game==='mtg'?entry.finish||'nonfoil':game==='ptcg'?entry.variant||'unresolved-owned-variant':entry.variant,priceEdition:entry.printing&&entry.rarity?entry.printing+'::'+entry.rarity:'',priceYgoEdition:entry.edition},
      source=finishArtworkCard(game,card,ctx), shown=source?{...source,prices:{...source.prices,usd:unit},...(source.setContext?{setContext:{...source.setContext,price:unit}}:{})}:source;
    return `<button type="button" class="value-lot" ${action} data-entry="${esc(entry.id)}" aria-label="Open ${esc(entry.name)}, ${esc(lotDetails(game,entry,card))}, ${copies(entry.qty)}"><span class="value-lot-art" ${finishAttrs(game,game==='mtg'&&!entry.printingVerified?null:card,ctx,'small')}>${valueLotArtwork(game,card,entry,shown)}</span><span class="value-lot-info"><strong>${esc(entry.name)}</strong><span class="value-lot-details">${esc(lotDetails(game,entry,card))}</span><span class="value-lot-copies">${copies(entry.qty)} · ${usd(unit)} each</span></span><span class="value-lot-total">${usd(total)}</span></button>`;
  }).join('')||'<p class="muted small">No priced owned lots yet. Unpriced copies are not ranked as $0 cards.</p>'}</div></section>`;
}

export const valuePageAttrs = game => `class="collection-value-page" data-value-game="${esc(game)}" style="--value-accent:${GAME_COLOR[game]||GAME_COLOR.mtg}"`;
