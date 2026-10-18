import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {boxAppearance, deckBoxMarkup} from './deck-box.js';
const css = await readFile(new URL('./style.css', import.meta.url), 'utf8');
assert.equal(boxAppearance().color, '#7664a0');
for (const color of ['#ffffff','#000000','#12AbCd','#a83250']) {
  assert.equal(boxAppearance({color}).color, color, 'custom color is never remapped');
  const html = deckBoxMarkup({id:'fixture',name:'Fixture',boxAppearance:{color}}, {open:true,button:true,images:['https://example.com/card.png']});
  assert.ok(html.includes(`--deck-box-color:${color}`));
  assert.ok(html.includes('deck-box is-open deck-box-control'));
  assert.ok(html.includes('data-act="deckMenu"'));
  assert.equal((html.match(/src="https:\/\/example.com\/card.png"/g)||[]).length, 2, 'fan and case preserve cover art');
}
assert.equal(boxAppearance({color:'white'}).color, '#7664a0');
assert.equal(boxAppearance({color:'#ffffff;background:red'}).color, '#7664a0');
assert.match(deckBoxMarkup({id:'empty',name:'Empty'}), /deck-box-mark/);
const caseRule = css.match(/\.deck-box-case\{([^}]+)\}/)[1];
const lidRule = css.match(/\.deck-box-lid\{([^}]+)\}/)[1];
for (const rule of [caseRule,lidRule]) {
  assert.ok(rule.includes('background:var(--deck-box-color)'), 'solid custom-color fallback');
  assert.ok(rule.includes('%,black)'), 'edge has tonal depth for white and bright colors');
  assert.ok(rule.includes('box-shadow:inset'), 'local material highlights');
  assert.doesNotMatch(rule, /backdrop-filter|filter:|opacity:/, 'no blurred or washed-out casing');
}
assert.match(css,/\.deck-box-case>img\{[^}]*opacity:\.9;box-shadow:/);
assert.match(css,/\.deck-box\{[^}]*width:50px;height:54px/);
assert.match(css,/@media\(max-width:600px\)\{\.deck-box\{width:42px;height:46px/);
assert.match(css,/prefers-reduced-motion:no-preference/);
console.log('Deck box polish: custom colors, art, fallback, dimensions and material rules pass.');
