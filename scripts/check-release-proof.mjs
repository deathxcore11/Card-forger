// Checks a release record (format in qa/release-proof.md) before a release card is posted.
// Usage: node scripts/check-release-proof.mjs <record.md> <proof folder>
// Exit 0: every row has a known verdict and every Pass row names a proof file that exists.
// Exit 1: the record may not go on a card. This script reports facts; it never upgrades a verdict.
import { readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const VERDICTS = new Map([['pass', 'Pass'], ['fail', 'Fail'], ['not assessed', 'Not assessed']]);

export function parseRecord(text) {
  const rows = [];
  let inTable = false;
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) { inTable = false; continue; }
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (!inTable) {
      inTable = cells.length >= 3 && /^item$/i.test(cells[0]) && /^verdict$/i.test(cells[1]) && /^proof$/i.test(cells[2]);
      continue;
    }
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    rows.push({ item: cells[0] || '', verdict: cells[1] || '', proof: (cells[2] || '').replace(/^`|`$/g, ''), notes: cells[3] || '' });
  }
  return rows;
}

export function checkRecord(text, proofDir, fileSize = defaultFileSize) {
  const rows = parseRecord(text);
  const problems = [];
  const counts = { Pass: 0, Fail: 0, 'Not assessed': 0 };
  if (!rows.length) problems.push('No rows found. The record needs a table headed Item | Verdict | Proof.');
  const root = resolve(proofDir);
  for (const row of rows) {
    const verdict = VERDICTS.get(row.verdict.toLowerCase());
    if (!verdict) { problems.push(`"${row.item}": verdict "${row.verdict}" is not Pass, Fail or Not assessed.`); continue; }
    counts[verdict] += 1;
    if (verdict === 'Fail') problems.push(`"${row.item}": Fail.`);
    if (verdict === 'Not assessed' && !row.notes) problems.push(`"${row.item}": Not assessed needs a reason in Notes.`);
    if (verdict !== 'Pass') continue;
    if (!row.proof) { problems.push(`"${row.item}": Pass with no proof file.`); continue; }
    const full = resolve(root, row.proof);
    if (full !== root && !full.startsWith(root + sep)) { problems.push(`"${row.item}": proof "${row.proof}" is outside the proof folder.`); continue; }
    const size = fileSize(full);
    if (size === null) problems.push(`"${row.item}": proof file "${row.proof}" is not on disk.`);
    else if (size === 0) problems.push(`"${row.item}": proof file "${row.proof}" is empty.`);
  }
  return { rows, counts, problems, ok: problems.length === 0 };
}

function defaultFileSize(path) {
  try { const s = statSync(path); return s.isFile() ? s.size : null; } catch { return null; }
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const [record, proofDir] = process.argv.slice(2);
  if (!record || !proofDir) {
    console.error('Usage: node scripts/check-release-proof.mjs <record.md> <proof folder>');
    process.exit(2);
  }
  const result = checkRecord(readFileSync(record, 'utf8'), proofDir);
  console.log(`Rows: ${result.rows.length}. Pass ${result.counts.Pass}, Fail ${result.counts.Fail}, Not assessed ${result.counts['Not assessed']}.`);
  for (const row of result.rows) if (/^not assessed$/i.test(row.verdict)) console.log(`NOT SEEN: ${row.item} (${row.notes || 'no reason given'})`);
  for (const p of result.problems) console.log(`BLOCKS THE CARD: ${p}`);
  console.log(result.ok ? 'Record is consistent. Not assessed rows must be listed on the card as not seen.' : 'Record may not go on a release card.');
  process.exit(result.ok ? 0 : 1);
}
