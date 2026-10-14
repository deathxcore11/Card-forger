// Printing order, never alphabetical card names pretending to be collector order.
const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
export function collectionOrder(a, b) {
  const year = x => /^\d{4}/.test(x.date || '') ? Number(x.date.slice(0, 4)) : 0;
  return year(b) - year(a) || String(b.date || '').localeCompare(String(a.date || '')) || natural.compare(a.set || '', b.set || '') || natural.compare(String(a.number || ''), String(b.number || '')) || natural.compare(a.name || '', b.name || '');
}
