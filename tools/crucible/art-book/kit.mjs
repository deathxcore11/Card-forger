// Drawing kit for the layout sketches in the Lost Memories asset book. Every sketch is a 512 x 240 box of whole-pixel
// rectangles, the frame size the game is drawn at, so a sketch shows exactly how much room each piece has.
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const px = (x, y, w, h) => `left:${x}px;top:${y}px;` + (w != null ? `width:${w}px;` : '') + (h != null ? `height:${h}px;` : '');
export const b = (x, y, w, h, cls, inner = '', style = '') => `<i class="${cls}" style="${px(x, y, w, h)}${style}">${inner}</i>`;
export const t = (x, y, txt, cls = '') => `<b class="t ${cls}" style="${px(x, y)}">${esc(txt)}</b>`;       // 16 px text face
export const l = (x, y, txt, cls = '') => `<b class="t l ${cls}" style="${px(x, y)}">${esc(txt)}</b>`;     // 8 px label face
export const n = (x, y, k) => `<u class="n" style="${px(x, y)}">${k}</u>`;                                  // numbered callout
export const HAMMER = '<svg class="ham" width="10" height="6" viewBox="0 0 10 6" shape-rendering="crispEdges"><rect x="0" y="2" width="6" height="1" fill="#f3ead8"/><rect x="6" y="0" width="3" height="5" fill="#f3ead8"/><rect x="6" y="5" width="3" height="1" fill="#4a3024"/></svg>';
export const stone = (x, y, w, h, inner = '') => b(x, y, w, h, 'st', inner);
export const win = (x, y, w, h, inner = '') => b(x, y, w, h, 'win', inner);
export const thin = (x, y, w, h, inner = '') => b(x, y, w, h, 'thin', inner);
export const plq = (x, y, w, txt, on = false, off = false) => b(x, y, w, 18, 'plq' + (on ? ' on' : '') + (off ? ' off' : ''), (on ? HAMMER : '') + `<b class="t l" style="left:${on ? 16 : 6}px;top:5px">${esc(txt)}</b>`);
export const gauge = (x, y, w, label, frac, col = '#964034', val = '') => l(x, y, label, 'g') + b(x, y + 9, w, 7, 'ga', `<i style="width:${Math.max(0, Math.round((w - 2) * frac))}px;background:${col}"></i>`) + (val ? l(x + w - val.length * 6, y, val) : '');
export const face = (x, y, s, kind = '') => b(x, y, s, s, 'pf ' + kind, `<i class="hd" style="left:${Math.round(s * .34)}px;top:${Math.round(s * .16)}px;width:${Math.round(s * .32)}px;height:${Math.round(s * .36)}px"></i><i class="sh" style="left:${Math.round(s * .14)}px;top:${Math.round(s * .56)}px;width:${Math.round(s * .72)}px;height:${Math.round(s * .44)}px"></i>`);
const KIND = { m: '#a87e4f', f: '#69404d', s: '#4c8a7c', t: '#964034', e: '#7a543c', u: '#5a5048', x: '#411b28' };
// a hand card, 44 x 60: 40 x 40 picture, then ATK over DEF in the label face
export const card = (x, y, kind = 'm', a = '', d = '', cls = '') => b(x, y, 44, 60, 'cd ' + cls, kind === 'x' ? '<i class="bk" style="left:2px;top:2px;width:38px;height:54px"></i>' : `<i class="art" style="left:1px;top:1px;width:40px;height:40px;background-color:${KIND[kind]}"></i>` + (a !== '' ? `<b class="t l" style="left:3px;top:43px">${esc(a)}</b><b class="t l d" style="left:3px;top:51px">${esc(d)}</b>` : `<b class="t l" style="left:3px;top:47px">${kind === 's' ? 'SPELL' : kind === 't' ? 'TRAP' : kind === 'e' ? 'EQUIP' : 'FUEL'}</b>`), `border-color:${KIND[kind]}`);
// a card lying on the table in the 3D window, any size
export const tcard = (x, y, w, h, kind = 'm', cls = '') => b(x, y, w, h, 'cd tc ' + cls, kind === 'x' ? `<i class="bk" style="left:1px;top:1px;width:${w - 4}px;height:${h - 4}px"></i>` : `<i class="art" style="left:1px;top:1px;width:${w - 4}px;height:${h - 4}px;background-color:${KIND[kind]}"></i>`, `border-color:${KIND[kind]}`);
export const med = (x, y, s, col = '#bd7433') => b(x, y, s, s, 'md', `<i style="left:${Math.round(s * .22)}px;top:${Math.round(s * .22)}px;width:${Math.round(s * .5)}px;height:${Math.round(s * .5)}px;background:${col}"></i>`);
export const slot = (x, y, s = 24, inner = '') => b(x, y, s, s, 'sl', inner);
export const torch = (x, y) => b(x, y, 3, 6, 'tor');
// the room seen through the window: wall, floor, fog at the far end. All positions are inside the 312 x 128 view.
export const room = (extra = '', floorTop = 78) => b(0, 0, 312, floorTop, 'wall') + b(0, floorTop, 312, 128 - floorTop, 'flr') + b(0, 0, 312, 14, 'fog') + extra;
export const door = (x, y, w, h, mark = '', cls = '') => b(x, y, w, h, 'dr ' + cls, `<i class="op" style="left:4px;top:8px;width:${w - 8}px;height:${h - 8}px"></i>` + (mark ? `<b class="t l g" style="left:${Math.round(w / 2) - 3}px;top:${Math.round(h / 2)}px">${esc(mark)}</b>` : ''));

// The Frame: two stone pillars, the window, the ledge and the text bar. Each part takes ready-made pieces.
export function frame({ left = '', right = '', view = '', ledge = '', bar = '', calls = '' } = {}) {
  return stone(0, 0, 96, 240) + stone(416, 0, 96, 240) + stone(96, 0, 320, 136) + b(100, 4, 312, 128, 'vw', view) + b(96, 136, 320, 80, 'lg') + win(96, 216, 320, 24, bar) +
    `<i style="left:0;top:0;width:96px;height:240px">${left}</i><i style="left:416px;top:0;width:96px;height:240px">${right}</i><i style="left:96px;top:136px;width:320px;height:80px">${ledge}</i>` + calls;
}
// what the left pillar shows during a run: you
export const you = ({ lp = null, name = 'TARN', sparks = 2, embers = '105', seals = 1, power = false } = {}) =>
  face(16, 6, 64) + l(8, 74, name, 'g') +
  (lp != null ? gauge(8, 86, 80, 'LIFE', lp, '#964034', String(Math.round(lp * 8000))) : '') +
  l(8, lp != null ? 106 : 88, 'SPARKS', 'g') + [0, 1, 2].map(i => b(50 + i * 12, lp != null ? 104 : 86, 8, 10, 'spk' + (i < sparks ? '' : ' out'))).join('') +
  l(8, lp != null ? 120 : 104, 'EMBERS', 'g') + l(88 - embers.length * 6, lp != null ? 120 : 104, embers) +
  (lp != null ? '' : l(8, 118, 'SEALS', 'g') + [0, 1].map(i => b(64 + i * 12, 116, 10, 10, 'seal' + (i < seals ? ' on' : ''))).join('') + gauge(8, 132, 80, 'WEIGHT', .9, '#a87e4f', '128/140') + l(8, 154, 'FORGE LV 2', 'g') + b(8, 164, 80, 5, 'ga', '<i style="width:44px;background:#bd7433"></i>')) +
  (power ? plq(4, 174, 88, 'POWER') : '') + plq(4, 218, 88, 'MENU');

export const MOCK_CSS = `
.mkw{width:100%;aspect-ratio:512/240;overflow:hidden;background:#000;outline:1px solid var(--line)}
.mk{position:relative;width:512px;height:240px;transform-origin:0 0;background:#1a0f12;color:#f3ead8;font:16px/16px 'DotGothic16',ui-monospace,Menlo,monospace;overflow:hidden}
.mk i,.mk b,.mk u{position:absolute;box-sizing:border-box;font-style:normal;font-weight:400;text-decoration:none;white-space:nowrap;display:block}
.mk .l{font:8px/8px 'Silkscreen',ui-monospace,Menlo,monospace}
.mk .g{color:#e9c46a}.mk .d{color:#c2b49c}.mk .r{color:#f08a72}.mk .k{color:#1a0f12}.mk .v{color:#9fd0c0}
.mk .st{background:repeating-conic-gradient(#7a543c 0 25%,#6f4b36 0 50%) 0 0/2px 2px;border:2px solid;border-color:#a87e4f #3a2419 #3a2419 #a87e4f}
.mk .win{background:repeating-conic-gradient(#2d121d 0 25%,#26101a 0 50%) 0 0/2px 2px;border:1px solid #1a0f12;box-shadow:inset 0 0 0 1px #dba459,inset 0 0 0 2px #1a0f12}
.mk .thin{border:1px solid #f3ead8;box-shadow:inset 0 0 0 1px #1a0f12,1px 1px 0 #1a0f12}
.mk .gnd{background:repeating-conic-gradient(#411b28 0 25%,#3a1824 0 50%) 0 0/2px 2px}
.mk .vw{background:#1a0f12;border:1px solid #1a0f12;box-shadow:0 0 0 1px #dba459,0 0 0 2px #3a2419;overflow:hidden}
.mk .lg{background:repeating-conic-gradient(#69404d 0 25%,#5c3743 0 50%) 0 0/2px 2px;border:2px solid;border-color:#3a2419 #a87e4f #a87e4f #3a2419}
.mk .plq{background:repeating-conic-gradient(#a87e4f 0 25%,#9a7347 0 50%) 0 0/2px 2px;border:1px solid;border-color:#c09660 #3a2419 #3a2419 #c09660;color:#1a0f12}
.mk .plq.on{background:repeating-conic-gradient(#bd7433 0 25%,#964034 0 50%) 0 0/2px 2px;border-color:#f3ead8 #4a1c16 #4a1c16 #f3ead8;color:#f3ead8}
.mk .plq.off{background:repeating-conic-gradient(#69404d 0 25%,#5c3743 0 50%) 0 0/2px 2px;color:#3a2419}
.mk .ham{position:absolute;left:3px;top:6px}
.mk .ga{border:1px solid #dba459;background:#1a0f12;box-shadow:0 0 0 1px #3a2419}.mk .ga>i{left:0;top:0;bottom:0}
.mk .pf{border:2px solid #dba459;box-shadow:0 0 0 1px #3a2419,inset 0 0 0 1px #3a2419;background:repeating-conic-gradient(#2d121d 0 25%,#411b28 0 50%) 0 0/2px 2px;overflow:hidden}
.mk .pf .hd{background:#7a543c}.mk .pf .sh{background:#69404d}
.mk .pf.riv .sh{background:#964034}.mk .pf.dark .hd,.mk .pf.dark .sh{background:#1a0f12}
.mk .cd{border:2px solid;background:#1a0f12;box-shadow:0 0 0 1px #1a0f12}
.mk .cd .art{background-image:repeating-conic-gradient(rgba(0,0,0,.28) 0 25%,transparent 0 50%);background-size:2px 2px}
.mk .cd .bk{background:repeating-conic-gradient(#411b28 0 25%,#964034 0 50%) 0 0/4px 4px;border:1px solid #dba459}
.mk .cd.sel{box-shadow:0 0 0 1px #f3ead8,0 0 0 2px #bd7433}.mk .cd.can{box-shadow:0 0 0 1px #e9c46a}
.mk .md{border:2px solid #dba459;border-radius:50%;background:#411b28;box-shadow:0 0 0 1px #3a2419}.mk .md.hex{border-radius:0}
.mk .sl{border:1px solid;border-color:#3a2419 #a87e4f #a87e4f #3a2419;background:#1a0f12}
.mk .wall{background:repeating-linear-gradient(0deg,transparent 0 15px,#7a543c 15px 16px),repeating-linear-gradient(90deg,transparent 0 31px,#7a543c 31px 32px),repeating-conic-gradient(#a87e4f 0 25%,#9c744a 0 50%) 0 0/2px 2px}
.mk .wall.f2{filter:hue-rotate(-18deg) brightness(.8)}.mk .wall.f3{filter:hue-rotate(-30deg) brightness(.6)}
.mk .flr{background:repeating-linear-gradient(0deg,#3a2419 0 1px,transparent 1px 10px),repeating-conic-gradient(#69404d 0 25%,#7a543c 0 50%) 0 0/2px 2px}
.mk .fog{background:repeating-conic-gradient(#1a0f12 0 25%,transparent 0 50%) 0 0/2px 2px}
.mk .dk{background:#1a0f12}
.mk .dr{background:repeating-conic-gradient(#c09660 0 25%,#a87e4f 0 50%) 0 0/2px 2px;border:1px solid #3a2419}.mk .dr .op{background:#1a0f12}
.mk .dr.shut .op{background:repeating-linear-gradient(90deg,#4a3024 0 5px,#3a2419 5px 6px)}
.mk .tbl{background:repeating-conic-gradient(#a87e4f 0 25%,#c09660 0 50%) 0 0/2px 2px;border:1px solid #3a2419}
.mk .zn{border:1px solid #7a543c;background:rgba(26,15,18,.35)}
.mk .tor{background:#e9c46a;box-shadow:0 0 0 1px #bd7433,0 -2px 0 0 #bd7433;animation:mkfl .5s steps(2) infinite}
.mk .spk{background:#bd7433;box-shadow:inset 0 3px 0 #e9c46a,inset 2px 0 0 #1a0f12,inset -2px 0 0 #1a0f12}.mk .spk.out{background:#3a2419;box-shadow:none}
.mk .seal{border:1px solid #dba459;background:#1a0f12}.mk .seal.on{background:#964034}
.mk .prop{background:repeating-conic-gradient(#3a2419 0 25%,#4a3024 0 50%) 0 0/2px 2px;border:1px solid #1a0f12}
.mk .gold{background:repeating-conic-gradient(#dba459 0 25%,#bd7433 0 50%) 0 0/2px 2px}
.mk .bar{background:#000}
.mk .n{left:0;top:0;min-width:11px;height:11px;padding:1px 2px;background:#e9c46a;color:#1a0f12;font:8px/9px 'Silkscreen',ui-monospace,monospace;text-align:center;box-shadow:0 0 0 1px #1a0f12;z-index:5}
@keyframes mkfl{50%{background:#f3ead8}}
@media (prefers-reduced-motion:reduce){.mk .tor{animation:none}}
`;
