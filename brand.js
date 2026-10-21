// One original vector emblem for the app, assistant and install artwork: three fanned cards with foil
// rims (silver-blue, gold, copper), echoing the three games without borrowing their marks.
// Gradients are defined per instance (the emblem often lives inside hidden menus, where a shared
// gradient id would stop rendering), so every call returns its own ids.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" class="stashy-logo" aria-hidden="true">
<defs>
<linearGradient id="bfG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2a8"/><stop offset=".35" stop-color="#c99a4b"/><stop offset=".55" stop-color="#fff2cc"/><stop offset=".75" stop-color="#b8843a"/><stop offset="1" stop-color="#ecd29a"/></linearGradient>
<linearGradient id="bfS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dcebf7"/><stop offset=".4" stop-color="#6f9cc7"/><stop offset=".6" stop-color="#e9f4ff"/><stop offset="1" stop-color="#7ea8d1"/></linearGradient>
<linearGradient id="bfC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0c08a"/><stop offset=".45" stop-color="#9c5d2b"/><stop offset=".65" stop-color="#f6cf9c"/><stop offset="1" stop-color="#b5733c"/></linearGradient>
<linearGradient id="bfF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2f22"/><stop offset="1" stop-color="#1e1913"/></linearGradient>
<radialGradient id="bfM" cx=".42" cy=".35" r=".75"><stop offset="0" stop-color="#7b5236"/><stop offset="1" stop-color="#4a2f1f"/></radialGradient>
<linearGradient id="bfL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset=".55" stop-color="#ffe9f6" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="bfK"><rect x="39" y="19" width="50" height="76" rx="7"/></clipPath>
</defs>
<rect class="brand-backplate" x="2" y="2" width="124" height="124" rx="29" fill="#11141b" stroke="#d8bb7c" stroke-opacity=".22"/>
<path d="M30 104Q64 113 98 104" fill="none" stroke="#d8bb7c" stroke-opacity=".28" stroke-width="1.2" stroke-linecap="round"/>
<g class="brand-card brand-left" transform="translate(8 0) rotate(-12 64 98)" style="--fan-from:-12deg;--fan-to:-12deg">
<rect x="24" y="25" width="48" height="69" rx="6.5" fill="#0f2442" stroke="url(#bfS)" stroke-width="2"/>
<rect x="28.5" y="29.5" width="39" height="60" rx="4" fill="none" stroke="#cfe3f5" stroke-opacity=".18"/>
<g fill="none" stroke="#bcd8ef" stroke-width="1.6"><circle cx="41" cy="60" r="15" stroke-opacity=".8"/><circle cx="41" cy="60" r="10" stroke-opacity=".6"/><circle cx="41" cy="60" r="5" stroke-opacity=".45"/></g>
</g>
<g class="brand-card brand-right" transform="translate(-8 0) rotate(12 64 98)" style="--fan-from:12deg;--fan-to:12deg">
<rect x="56" y="25" width="48" height="69" rx="6.5" fill="#1d140e" stroke="url(#bfC)" stroke-width="2"/>
<rect x="60.5" y="29.5" width="39" height="60" rx="4" fill="none" stroke="#e5b46c" stroke-opacity=".18"/>
<ellipse cx="80" cy="59" rx="15" ry="23" transform="rotate(20 80 59)" fill="none" stroke="#c98a4f" stroke-opacity=".8" stroke-width="1.3"/>
<ellipse cx="80" cy="59" rx="9.5" ry="16" transform="rotate(20 80 59)" fill="none" stroke="#e7b874" stroke-opacity=".75" stroke-width="1.3"/>
<ellipse cx="80" cy="59" rx="4" ry="8" transform="rotate(20 80 59)" fill="#0e0c0c" stroke="#9a6334"/>
</g>
<g class="brand-card brand-center" style="--fan-from:0deg;--fan-to:0deg">
<rect x="39" y="19" width="50" height="76" rx="7" fill="url(#bfF)" stroke="url(#bfG)" stroke-width="2.4"/>
<rect x="43.5" y="23.5" width="41" height="67" rx="4.5" fill="none" stroke="#e4c78e" stroke-opacity=".28"/>
<ellipse cx="64" cy="57" rx="16" ry="26" fill="url(#bfM)" stroke="url(#bfG)" stroke-width="1.1"/>
<circle cx="64" cy="45.5" r="2.9" fill="#efe4c0"/><circle cx="54" cy="54" r="2.9" fill="#7fa27a"/><circle cx="74" cy="54" r="2.9" fill="#7fb0cc"/><circle cx="57.5" cy="66" r="2.9" fill="#c97c63"/><circle cx="70.5" cy="66" r="2.9" fill="#2a2530" stroke="#b39371" stroke-width=".7"/>
<path d="M48.5 27.5h7m16.5 59h7" stroke="#f0dcb1" stroke-opacity=".55" stroke-linecap="round"/>
<g clip-path="url(#bfK)"><rect class="brand-sheen" x="-11" y="15" width="70" height="84" fill="url(#bfL)"/></g>
</g>
<path d="m64 100.5 2.4 3.8-2.4 3.8-2.4-3.8z" fill="url(#bfG)"/>
</svg>`;
let seq = 0;
// Gives one emblem its own gradient and clip ids.
const own = svg => { const n = (++seq).toString(36); return svg.replace(/\bbf([A-Z])\b/g, `bf${n}$1`); };
const frontCopy = side => SVG.match(new RegExp(`<g class="brand-card brand-${side}"[\\s\\S]*?<\\/g>`))[0]
  .replace(`brand-card brand-${side}`, `brand-cycle brand-cycle-${side}`);
const animatedSVG = SVG.replace('</svg>', `${frontCopy('left')}${frontCopy('right')}</svg>`);
export const brandStaticMark = () => own(SVG);
export const brandMark = (mode = '') => own(animatedSVG.replace('class="stashy-logo"',
  `class="stashy-logo ${mode.replace(/[^a-z -]/g, '')} brand-breathing"`));
