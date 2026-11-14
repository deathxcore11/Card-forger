// Guards the release-record checker: a Pass with no proof on disk must block the card.
import assert from 'node:assert/strict';
import { checkRecord, parseRecord } from './scripts/check-release-proof.mjs';

const record = (rows) => `# Release record\n\n| Item | Verdict | Proof | Notes |\n|---|---|---|---|\n${rows.join('\n')}\n`;
const disk = (files) => (path) => {
  const name = path.split(/[\\/]/).pop();
  return name in files ? files[name] : null;
};

assert.equal(parseRecord(record(['| B1 match reaches turn 1 | Pass | b1.png | Thor |'])).length, 1);

let r = checkRecord(record(['| B1 | Pass | b1.png | Thor |', '| A1 | Not assessed | | PC offline |']), '/proof', disk({ 'b1.png': 2048 }));
assert.equal(r.ok, true, r.problems.join('; '));
assert.deepEqual(r.counts, { Pass: 1, Fail: 0, 'Not assessed': 1 });

r = checkRecord(record(['| B1 | Pass | b1.png | |']), '/proof', disk({}));
assert.equal(r.ok, false);
assert.match(r.problems[0], /not on disk/);

r = checkRecord(record(['| B1 | Pass | | unit test passed |']), '/proof', disk({}));
assert.match(r.problems[0], /no proof file/);

r = checkRecord(record(['| B1 | Pass | b1.png | |']), '/proof', disk({ 'b1.png': 0 }));
assert.match(r.problems[0], /empty/);

r = checkRecord(record(['| B1 | Pass | ../../etc/hosts | |']), '/proof', disk({ hosts: 10 }));
assert.match(r.problems[0], /outside the proof folder/);

r = checkRecord(record(['| C1 | Fixed | c1.txt | |']), '/proof', disk({ 'c1.txt': 5 }));
assert.match(r.problems[0], /not Pass, Fail or Not assessed/);

r = checkRecord(record(['| B1 | Fail | | match never started |']), '/proof', disk({}));
assert.equal(r.ok, false);

r = checkRecord(record(['| A1 | Not assessed | | |']), '/proof', disk({}));
assert.match(r.problems[0], /needs a reason/);

assert.equal(checkRecord('no table here', '/proof', disk({})).ok, false);

console.log('release-proof: all checks passed');
