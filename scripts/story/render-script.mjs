// Renders a readable script (Markdown) from scripts/story/acts-src/act-<n>.mjs, so Randall reads
// exactly what ships. Usage: node scripts/story/render-script.mjs <act> > act-<n>-script.md
import {storyAct} from '../../story-acts.js';
const n = Number(process.argv[2]), act = storyAct(n), src = (await import(`./acts-src/act-${n}.mjs`)).default;
const name = who => who === 'stage' || who === 'narrator' ? '' : (src.cast[who]?.name || who);
const line = l => name(l.who) ? `- ${name(l.who)}: ${l.line}${l.quote ? ' [card]' : ''}` : `- (${l.line})`;
const face = p => p.fixed ? `${p.fixed.card} (${p.fixed.set} #${p.fixed.number}, face only)` : `${p.card}${p.number ? ' #' + p.number : ''}`;
const cues = c => c && c.start ? `START "${c.start}" / BIG PLAY "${c.big}" / LOW LIFE "${c.low}" / WIN "${c.win}" / LOSS "${c.loss}"${c.half ? ` / HALF LIFE (${name(c.half.who)}) "${c.half.line}"` : ''}` : 'none (you never speak)';
const out = [`# STORY SCRIPT: ACT ${n}, ${act.title.toUpperCase()}`, '', `Sets: ${act.sets.join(' ')}. Land set: ${act.landSet}. Music vibe: ${src.vibe || '-'}.`,
  'Lines marked [card] are real flavor text from the era, said by the person the card credits. Generated from the act file, so this is exactly what ships.', '',
  '## Cast', ...Object.entries(src.cast).filter(([k]) => k !== 'you').map(([, p]) => `- ${p.name}, ${p.title}. Portrait: ${face(p)}.`), '', '## Intro', ...src.intro.map(line)];
for (const b of src.battles) out.push('', `### Battle ${b.slot} (${b.kind}, ${b.difficulty}, mood ${b.mood}): ${b.title}`, `Teaches: ${b.teaches.join(', ')}.`,
  `Hero: ${name(b.hero.who) || 'You'} (${b.hero.deck.name}, ${b.hero.deck.colors}). Villain: ${name(b.villain.who)} (${b.villain.deck.name}, ${b.villain.deck.colors}).`,
  `Blurb: ${b.blurb}`, 'Scene:', ...b.scene.map(line), ...(b.villainScene ? ['Villain-side scene:', ...b.villainScene.map(line)] : []),
  `Cues (hero): ${cues(b.cues.hero)}`, `Cues (villain): ${cues(b.cues.villain)}`, ...(b.after ? ['After a win:', ...b.after.map(line)] : []));
out.push('', '## Finale', ...src.finale.map(line), '', '## Villain-side finale', ...(src.villainFinale || []).map(line), '');
console.log(out.join('\n'));
