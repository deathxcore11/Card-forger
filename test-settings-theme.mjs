import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {THEME_KEY,SETTINGS_TABS,normalizeTheme,readTheme,applyTheme,initTheme,themeSettings,normalizeSettingsTab,settingsTabs,activateSettingsTab} from './settings-theme.js';

const memory = new Map(), storage = {getItem:key=>memory.get(key) ?? null,setItem:(key,value)=>memory.set(key,value)};
const controls = ['light','dark'].map(value=>({value,checked:false}));
const meta = {setAttribute(name,value){this[name]=value;}};
const document = {documentElement:{dataset:{},style:{}},querySelector:()=>meta,querySelectorAll:()=>controls};
assert.equal(readTheme(storage),'dark','existing users retain the dark appearance');
assert.equal(normalizeTheme('system'),'dark');assert.equal(normalizeTheme('<script>'),'dark');
assert.deepEqual(applyTheme('light',{document,storage}),{theme:'light',saved:true});
assert.deepEqual([...memory],[[THEME_KEY,'light']],'appearance never touches an account or collection key');
assert.equal(document.documentElement.dataset.theme,'light');assert.equal(document.documentElement.style.colorScheme,'light');
assert.equal(meta.content,'#f3f5f8');assert.deepEqual(controls.map(x=>x.checked),[true,false]);
assert.equal(readTheme(storage),'light');assert.match(themeSettings({document,storage}),/value="light" data-change="setTheme" checked/);
const denied = {getItem(){throw Error('denied');},setItem(){throw Error('quota');}};
assert.equal(readTheme(denied),'dark');
assert.deepEqual(applyTheme('light',{document,storage:denied}),{theme:'light',saved:false});
assert.match(themeSettings({document,storage:denied}),/value="light" data-change="setTheme" checked/,'an unsaved theme remains active for this visit');
assert.deepEqual(applyTheme('dark',{document,storage:null}),{theme:'dark',saved:false});
assert.equal(meta.content,'#0f1115');
const listeners = new Map(),window = {addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{assert.equal(listeners.get(name),fn);listeners.delete(name);}};
const stop = initTheme({document,storage,window});assert.equal(document.documentElement.dataset.theme,'light');
memory.set(THEME_KEY,'dark');listeners.get('storage')({key:'other',storageArea:storage});assert.equal(document.documentElement.dataset.theme,'light');
listeners.get('storage')({key:THEME_KEY,storageArea:storage});assert.equal(document.documentElement.dataset.theme,'dark');
memory.set(THEME_KEY,'light');listeners.get('storage')({key:THEME_KEY,storageArea:{}});assert.equal(document.documentElement.dataset.theme,'dark');
memory.clear();listeners.get('storage')({key:null,storageArea:storage});assert.equal(document.documentElement.dataset.theme,'dark');
stop();assert.equal(listeners.size,0);

assert.deepEqual(SETTINGS_TABS.map(x=>x[1]),['Account','Recovery','App Help & Info','App Settings']);
assert.equal(normalizeSettingsTab('backup'),'recovery');assert.equal(normalizeSettingsTab('anything'),'account');
for (const [tab] of SETTINGS_TABS) {
  const html=settingsTabs(tab);assert.equal((html.match(/role="tab"/g)||[]).length,4);
  assert.equal((html.match(/tabindex="0"/g)||[]).length,1);assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
  assert.match(html,new RegExp(`id="settingsTab-${tab}"[^>]+aria-selected="true" tabindex="0"`));
}
const rail={scrollWidth:520,clientWidth:300,offsetLeft:20,scrollLeft:0};
const buttons=SETTINGS_TABS.map(([id],i)=>({dataset:{id},parentElement:rail,offsetLeft:i*130,offsetWidth:130,setAttribute(name,value){this[name]=value;}}));
const panes=SETTINGS_TABS.map(([id])=>({id:'settings-'+id}));
const root={querySelectorAll:selector=>selector==='.settings-pane'?panes:buttons};
assert.equal(activateSettingsTab(root,'app'),'app');assert.deepEqual(panes.map(x=>x.hidden),[true,true,true,false]);
assert.deepEqual(buttons.map(x=>x.tabIndex),[-1,-1,-1,0]);assert.equal(rail.scrollLeft,220);
activateSettingsTab(root,'account');assert.equal(rail.scrollLeft,0);
activateSettingsTab(root,'backup');assert.equal(panes[1].hidden,false);assert.equal(buttons[1]['aria-selected'],'true');

const boot=readFileSync(new URL('./theme-init.js',import.meta.url),'utf8');
for(const value of ['light','dark','unexpected',null]) {
  memory.clear();if(value)memory.set(THEME_KEY,value);
  vm.runInNewContext(boot,{document,localStorage:storage});assert.equal(document.documentElement.dataset.theme,readTheme(storage));
}
vm.runInNewContext(boot,{document,localStorage:denied});assert.equal(document.documentElement.dataset.theme,'dark');

// Test the actual shared renderer in every game, preserving the original actions.
const {S,blank}=await import('./store.js'),{settings}=await import('./views.js');
for (const game of ['mtg','ptcg','ygo']) for (const [tab] of SETTINGS_TABS) {
  S.state=blank();S.state.settings.game=game;S.ui.settingsTab=tab;const before=JSON.stringify(S.state),html=settings({popup:true});
  assert.equal(JSON.stringify(S.state),before,'rendering Settings cannot change a collection');
  assert.match(html,new RegExp(`id="settings-${tab}"[^>]+aria-labelledby="settingsTab-${tab}" >`));
  for(const action of ['exportBackup','undoRestore','persist','reset','loadExample','install','replayTour','resetOnboarding','recoveryRefresh']) assert(html.includes(`data-act="${action}"`),action+' remains reachable');
  for(const change of ['restoreBackup','checkBackup','setGlass','setFinishEffects','setHaptics','setTheme'])assert(html.includes(`data-change="${change}"`),change+' remains reachable');
  assert.equal((html.match(/id="recoverySnapshots"/g)||[]).length,1);assert.match(html,/id="recoveryStatus"[^>]+role="status"/);
  assert.match(html,/id="settings-info"[\s\S]+Replay tutorials[\s\S]+Card databases & prices[\s\S]+About CardStashy/);
}

// Small and secondary text, status ink and all game accents exceed AA contrast
// on the light mode's darkest standard surface. Photo overlays keep white ink.
const luminance=hex=>hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};
for(const ink of ['172337','33445a','3e5068','674407','922a24','603199','125334'])assert(contrast(ink,'e7ecf3')>=4.5,ink+' light mode contrast');
const css=readFileSync(new URL('./settings-theme.css',import.meta.url),'utf8');
assert.match(css,/overflow-x:auto/);assert.match(css,/min-width:max-content/);assert.match(css,/prefers-reduced-transparency/);
assert.doesNotMatch(css,/filter\s*:\s*invert|img\s*\{[^}]*filter/,'artwork pixels must not be inverted');
const titleFade=css.match(/:root\[data-theme="light"\] \.cs-banner > \.cs-title::before \{([^}]+)\}/)?.[1];
assert(titleFade,'title fade is scoped to Light mode only');
for(const rule of ['inset:-80px calc(var(--gutter) * -1) 0','border-radius:0','linear-gradient','rgba(243,245,248,.92) 80px','rgba(243,245,248,.92) calc(100% - 18px)','pointer-events:none'])assert(titleFade.includes(rule),rule+' keeps the fade full-bleed and covers every wrapped text line');
assert.doesNotMatch(titleFade,/rgba\(23,35,55|border-radius:14px/,'no detached dark title rectangle');
assert.match(css,/\.cs-title :is\(h2,\.type-line,\.hp,\.lvl\) \{color:var\(--text\);text-shadow:none;/,'light title uses readable dark ink, not white text over a pale fade');
const hex=rgb=>rgb.map(v=>Math.floor(v).toString(16).padStart(2,'0')).join('');
const worstTitle=hex([243,245,248].map(v=>v*.92));
for(const ink of ['172337','33445a','3e5068'])assert(contrast(ink,worstTitle)>=4.5,'title/subtitle dark ink retains AA even over pure-black artwork');
// The ambient floor is the original light backdrop behind 80% black artwork,
// followed by the least-opaque 74% light wash. All small/status ink is checked
// here, not just against an opaque white panel. Glass panels only lighten it.
const worstAmbient=hex([243,245,248].map(v=>v*(1-.8)* (1-.74)+v*.74));
for(const ink of ['172337','33445a','3e5068','674407','922a24','603199','125334'])assert(contrast(ink,worstAmbient)>=4.5,ink+' AA on worst-case Light ambient art');
const worstSheet=hex([246,249,253].map(v=>v*.78));
for(const ink of ['172337','33445a','3e5068','674407','922a24','603199','125334'])assert(contrast(ink,worstSheet)>=4.5,ink+' AA even when the translucent sheet covers pure-black content');
assert.match(css,/--glass:rgba\(255,255,255,\.58\);--glass-2:rgba\(241,245,251,\.68\)/,'Light panels transmit the artwork instead of repainting it white');
assert.match(css,/body\.glass dialog\.sheet \{background:[^}]+rgba\(246,249,253,\.78\)/,'glass sheet remains genuinely translucent');
assert.match(css,/body\.glass #ambient \.amb-art \{[^}]+opacity:\.8/,'the real ambient art is not reduced to invisibility');
assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/background:var\(--surface\);backdrop-filter:none/,'reduced transparency remains solid');
assert.doesNotMatch(css,/mask-image\s*:/,'Light fade must not change artwork/foil masks');
console.log('PASS: four accessible Settings tabs, recovery hooks, all-game action preservation, theme persistence/storage failure, cross-tab sync, first-paint boot and AA light ink.');
// The same intrinsic header applies in both themes. No truncated title or font shrink.
const sharedHeaderCSS=readFileSync('style.css','utf8');
assert.match(sharedHeaderCSS,/--banner-art-height:clamp\(280px,74vw,420px\); display:grid; grid-template-columns:minmax\(0,1fr\); min-height:var\(--banner-art-height\)/);
assert.match(sharedHeaderCSS,/\.cs-banner > \.cs-hero:not\(\.compact\) \{ position:absolute; inset:0; width:100%; height:100%/);
assert.match(sharedHeaderCSS,/\.cs-banner.no-art \{ --banner-art-height:150px/);
assert.match(sharedHeaderCSS,/\.cs-banner > \.cs-title \{ grid-area:1 \/ 1; position:relative; inset:auto; align-self:end; margin:56px var\(--gutter\) 0; min-width:0; \}/);
