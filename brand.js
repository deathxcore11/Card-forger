// One original vector emblem for the app, assistant and install artwork: a coral deck box with three
// card backs rising out of it, each drawn in our own way after one game's card back: a blue back with
// a split orb (Pokémon), a brown back with a bronze oval and five colour gems (Magic) and an umber back
// with a gold-rimmed vortex (Yu-Gi-Oh!). Nothing is copied from the games' own marks.
// Gradients are defined per instance (the emblem often lives inside hidden menus, where a shared
// gradient id would stop rendering), so every call returns its own ids.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" class="stashy-logo" aria-hidden="true">
<defs>
<linearGradient id="bfG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2a8"/><stop offset=".35" stop-color="#c99a4b"/><stop offset=".55" stop-color="#fff2cc"/><stop offset=".75" stop-color="#b8843a"/><stop offset="1" stop-color="#ecd29a"/></linearGradient>
<linearGradient id="bfP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f63c4"/><stop offset="1" stop-color="#132f72"/></linearGradient>
<radialGradient id="bfW" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#3f6a9e"/><stop offset=".55" stop-color="#3a2a22"/><stop offset="1" stop-color="#22150d"/></radialGradient>
<radialGradient id="bfV" cx=".5" cy=".5" r=".55"><stop offset="0" stop-color="#140a06"/><stop offset=".5" stop-color="#6b3a16"/><stop offset="1" stop-color="#2a170b"/></radialGradient>
<linearGradient id="bfB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f58a72"/><stop offset="1" stop-color="#c24f39"/></linearGradient>
<linearGradient id="bfL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset=".55" stop-color="#ffe9f6" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="bfK"><rect x="39" y="19" width="50" height="76" rx="7"/></clipPath>
</defs>
<rect class="brand-backplate" x="2" y="2" width="124" height="124" rx="29" fill="#11141b" stroke="#d8bb7c" stroke-opacity=".22"/>
<path d="M27 74h74v6H27z" fill="#8e3626"/>
<g class="brand-card brand-left" transform="translate(8 0) rotate(-12 64 98)" style="--fan-from:-12deg;--fan-to:-12deg">
<rect x="24" y="25" width="48" height="69" rx="6.5" fill="url(#bfP)" stroke="#0b1f4d" stroke-width="2"/>
<rect x="28" y="29" width="40" height="61" rx="4" fill="none" stroke="#8fb6ff" stroke-opacity=".35"/>
<path d="M30 46q18-12 36 0M30 70q18 12 36 0" fill="none" stroke="#8fb6ff" stroke-opacity=".4" stroke-width="1.4"/>
<path d="M38 57a10 10 0 0 1 20 0z" fill="#f2795f"/><path d="M38 57a10 10 0 0 0 20 0z" fill="#f4eee0"/>
<path d="M38 57h20" stroke="#14213d" stroke-width="2"/><circle cx="48" cy="57" r="10" fill="none" stroke="#14213d" stroke-width="1.6"/>
<path d="m48 52.6 1.3 3.1 3.1 1.3-3.1 1.3-1.3 3.1-1.3-3.1-3.1-1.3 3.1-1.3z" fill="#ffe7a3" stroke="#14213d" stroke-width=".6"/>
</g>
<g class="brand-card brand-right" transform="translate(-8 0) rotate(12 64 98)" style="--fan-from:12deg;--fan-to:12deg">
<rect x="56" y="25" width="48" height="69" rx="6.5" fill="#1d120b" stroke="#6e4a22" stroke-width="2"/>
<rect x="60" y="29" width="40" height="61" rx="4" fill="none" stroke="#c9963f" stroke-opacity=".3"/>
<ellipse cx="80" cy="59" rx="15" ry="22" fill="url(#bfV)" stroke="#d9a94c" stroke-width="1.4"/>
<path d="M80 59c0-3 3-4.5 5-3 3 2.2 2 7.5-2.5 8.5-6 1.3-10-4-8.5-9.5 2-7 11.5-9 17-3.5M80 59c0 3-3 4.5-5 3-3-2.2-2-7.5 2.5-8.5 6-1.3 10 4 8.5 9.5-2 7-11.5 9-17 3.5" fill="none" stroke="#e7a54e" stroke-width="1.3" stroke-linecap="round" stroke-opacity=".9"/>
</g>
<g class="brand-card brand-center" style="--fan-from:0deg;--fan-to:0deg">
<rect x="39" y="19" width="50" height="76" rx="7" fill="#3b2416" stroke="url(#bfG)" stroke-width="2.4"/>
<rect x="43.5" y="23.5" width="41" height="67" rx="4.5" fill="none" stroke="#e4c78e" stroke-opacity=".28"/>
<ellipse cx="64" cy="55" rx="16" ry="25" fill="url(#bfW)" stroke="url(#bfG)" stroke-width="1.4"/>
<circle cx="64" cy="38.5" r="2.6" fill="#efe6c6"/><circle cx="55.5" cy="42" r="2.6" fill="#5b8fd0"/><circle cx="72.5" cy="42" r="2.6" fill="#2a2430" stroke="#b39371" stroke-width=".6"/><circle cx="52.5" cy="50" r="2.6" fill="#d0563c"/><circle cx="75.5" cy="50" r="2.6" fill="#5c9f62"/>
<g clip-path="url(#bfK)"><rect class="brand-sheen" x="-11" y="15" width="70" height="84" fill="url(#bfL)"/></g>
</g>
<g class="brand-box">
<path d="M26 76h76v26a10 10 0 0 1-10 10H36a10 10 0 0 1-10-10z" fill="url(#bfB)"/>
<path d="M26 76h76v7H26z" fill="#ffc0b0" opacity=".45"/>
<rect x="52" y="92" width="24" height="6" rx="3" fill="#2a1410" opacity=".45"/>
</g>
</svg>`;
let seq = 0;
// Gives one emblem its own gradient and clip ids.
const own = svg => { const n = (++seq).toString(36); return svg.replace(/\bbf([A-Z])\b/g, `bf${n}$1`); };
const frontCopy = side => SVG.match(new RegExp(`<g class="brand-card brand-${side}"[\\s\\S]*?<\\/g>`))[0]
  .replace(`brand-card brand-${side}`, `brand-cycle brand-cycle-${side}`);
// The moving copies sit behind the box front, so the cards always come out of the box.
const animatedSVG = SVG.replace('<g class="brand-box">', `${frontCopy('left')}${frontCopy('right')}<g class="brand-box">`);
export const brandStaticMark = () => own(SVG);
export const brandMark = (mode = '') => own(animatedSVG.replace('class="stashy-logo"',
  `class="stashy-logo ${mode.replace(/[^a-z -]/g, '')} brand-breathing"`));
