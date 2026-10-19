// One original vector emblem for the app, assistant and install artwork.
// Motifs echo the three games without squeezing their wordmarks into an icon.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" class="stashy-logo" aria-hidden="true">
<rect class="brand-backplate" x="2" y="2" width="124" height="124" rx="29" fill="#12161e" stroke="#d8bb7c" stroke-opacity=".22"/>
<path d="M28 103Q64 114 100 103" fill="none" stroke="#d8bb7c" stroke-opacity=".25" stroke-width="1.5"/>
<g class="brand-card brand-left" transform="translate(8 0) rotate(-12 64 98)" style="--fan-from:-12deg;--fan-to:-12deg">
<rect x="24" y="25" width="48" height="69" rx="7" fill="#102f59" stroke="#88b9e3" stroke-width="2"/>
<rect x="28" y="29" width="40" height="61" rx="4" fill="none" stroke="#d3e9fa" stroke-opacity=".25"/>
<path d="M37 76C17 56 45 30 59 43C77 60 51 86 37 68C28 56 45 40 55 50" fill="none" stroke="#d9ecfa" stroke-opacity=".8" stroke-width="2.5"/>
<circle cx="48" cy="59" r="9" fill="#e5e4db" stroke="#142238" stroke-width="1.5"/>
<path d="M39 59a9 9 0 0 1 18 0z" fill="#b94e48"/>
<path d="M39 59h18" stroke="#142238" stroke-width="2"/>
<circle cx="48" cy="59" r="3" fill="#eef4f7" stroke="#142238" stroke-width="1.5"/>
</g>
<g class="brand-card brand-right" transform="translate(-8 0) rotate(12 64 98)" style="--fan-from:12deg;--fan-to:12deg">
<rect x="56" y="25" width="48" height="69" rx="7" fill="#20150f" stroke="#d49b59" stroke-width="2"/>
<rect x="60" y="29" width="40" height="61" rx="4" fill="none" stroke="#e5b46c" stroke-opacity=".25"/>
<ellipse cx="80" cy="59" rx="16" ry="25" transform="rotate(24 80 59)" fill="none" stroke="#be7638" stroke-width="1.5"/>
<ellipse cx="80" cy="59" rx="12" ry="21" transform="rotate(24 80 59)" fill="none" stroke="#e0aa62" stroke-width="1.5"/>
<ellipse cx="80" cy="59" rx="8" ry="16" transform="rotate(24 80 59)" fill="#100f11" stroke="#976032"/>
</g>
<g class="brand-card brand-center" style="--fan-from:0deg;--fan-to:0deg">
<rect x="39" y="19" width="50" height="76" rx="8" fill="#33291e" stroke="#e4c78e" stroke-width="2.5"/>
<rect x="43" y="23" width="42" height="68" rx="5" fill="none" stroke="#e4c78e" stroke-opacity=".35"/>
<ellipse cx="64" cy="57" rx="17" ry="28" fill="#70472f" stroke="#bda474" stroke-width="1.2"/>
<circle cx="64" cy="45" r="3.4" fill="#ece0b3"/>
<circle cx="53" cy="54" r="3.4" fill="#72946a"/>
<circle cx="75" cy="54" r="3.4" fill="#70a6c3"/>
<circle cx="57" cy="67" r="3.4" fill="#bd6a52"/>
<circle cx="71" cy="67" r="3.4" fill="#25212b" stroke="#aa8b6b" stroke-width=".8"/>
<path d="M48 27h9m14 60h9" stroke="#f0dcb1" stroke-opacity=".65" stroke-linecap="round"/>
</g>
<path d="m64 101 2.5 4-2.5 4-2.5-4z" fill="#e4c78e"/>
</svg>`;
const frontCopy = side => SVG.match(new RegExp(`<g class="brand-card brand-${side}"[\\s\\S]*?<\\/g>`))[0]
  .replace(`brand-card brand-${side}`, `brand-cycle brand-cycle-${side}`);
const animatedSVG = SVG.replace('</svg>', `${frontCopy('left')}${frontCopy('right')}</svg>`);
export const brandStaticMark = () => SVG;
export const brandMark = (mode = '') => animatedSVG.replace('class="stashy-logo"',
  `class="stashy-logo ${mode.replace(/[^a-z -]/g, '')} brand-breathing"`);
