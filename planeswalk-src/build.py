import json
import os,re
# Text floor (UI super prompt rule 6): every CSS font size becomes max(11px, size), so nothing renders under 11px.
# Absolute sizes also scale by --pw-ts, the in-game Text size option (1, 1.15, 1.3); em and % sizes inherit it.
MIN='11px'
def sz(v):
  return f'max({MIN},{v})' if re.search(r'(?<!r)em\b|%',v) else f'calc(max({MIN},{v}) * var(--pw-ts,1))'
def floor_css(css):
  def fs(m):
    v=m.group(2).strip()
    if 'max(' in v or re.match(r'^(0|inherit|initial|unset|revert)\b',v):return m.group(0)
    imp=''
    if v.endswith('!important'):v=v[:-10].strip();imp='!important'
    return f'{m.group(1)}{sz(v)}{imp}'
  css=re.sub(r'(font-size:\s*)([^;}]+)',fs,css)
  def fsh(m):
    return f'{m.group(1)}{sz(m.group(2))}{m.group(3)}'
  css=re.sub(r'(font:\s*(?:italic\s+)?(?:\d{3}|bold|normal)?\s*)((?:\d*\.)?\d+(?:px|rem|em|%))((?:/[^\s;}]+)?\s)',fsh,css)
  return css
def floor_styles(html):
  return re.sub(r'(<style[^>]*>)(.*?)(</style>)',lambda m:m.group(1)+floor_css(m.group(2))+m.group(3),html,flags=re.S)
W=os.path.dirname(os.path.abspath(__file__))
# Output: next to the sources by default; PW_OUT=<repo root> writes the served planeswalk.html and planeswalk-art-zen.css there (planeswalk-src/README.md)
OUT=os.path.abspath(os.environ.get('PW_OUT',W))
s=open(W+'/src.html').read();css=open(W+'/planeswalk-skin.css').read()+'\n'+open(W+'/emblem-art.css').read()+'\n'+open(W+'/extra.css').read()+'\n'+open(W+'/kit.css').read()+'\n'+open(W+'/cast.css').read()
# the kit's mana symbols are written into the CSS itself (pw-kit.js also sets them at runtime; a viewer that drops a script-made <style> once showed empty rings on the orb)
_mana=json.loads(re.search(r'const MANA=(\{.*?\}),COLOR',open(W+'/emblem-art.js').read(),re.S).group(1))
assert css.count(':root{--pwk-mana:none;')==1 and css.count('body[data-hero=W]{--pwk-mana:none;')==1
css=css.replace(':root{--pwk-mana:none;',':root{--pwk-mana:url(%s);'%_mana['R']).replace('body[data-hero=W]{--pwk-mana:none;','body[data-hero=W]{--pwk-mana:url(%s);'%_mana['W'])
assert '</style' not in css
# safe-area insets are device px: inside the zoomed #app (tablets scale the phone layout up) they must not scale with it
def unzoom_insets(css):
  out=[]
  for ln in css.split('\n'):
    if 'env(safe-area-inset' in ln and not re.search(r'(^|[\s,{])(\.pw-zoom|\.pw-menu|body>\.pw-menu|\.pw-x|--gutter)',ln):
      ln=re.sub(r'env\(safe-area-inset-(top|right|bottom|left)(?:,\s*[^)]*)?\)',r'calc(env(safe-area-inset-\1,0px) / var(--pw-zoom,1))',ln)
    out.append(ln)
  return '\n'.join(out)
css=unzoom_insets(css);s=unzoom_insets(s)
s=s.replace('<!--PW-SKIN-->','<style id="pw-skin">\n'+css+'\n</style>')
# figure keys that have frames: a registry row with figure:'key' (e.g. Kozilek's Drone) stays out of the rolls until its frames land (ruling 10)
_castj=next(p for p in (W+'/planeswalk-cast/cast.json',OUT+'/planeswalk-cast/cast.json',os.path.dirname(W)+'/planeswalk-cast/cast.json') if os.path.exists(p))  # w/ keeps its own copy; in the repo it sits at the root
_figs=sorted({e['key'] for e in json.load(open(_castj))})
assert s.count('<script id="pw-game">')==1
# art registries (no placeholders): a card whose name has no [data-n] art rule, and a UI piece (token, exile pile...) with no [data-ui] rule, stay out until their art lands
_cardart=sorted(set(re.findall(r'\[data-n="([^"]+)"\]\{--img',css)))
_uiart=sorted(set(re.findall(r'\[data-ui="([^"]+)"\]\{--img',css)))
_pdir=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','planeswalk-art','patrons')
_patrons=sorted(f[:-5] for f in os.listdir(_pdir) if f.endswith('.webp')) if os.path.isdir(_pdir) else []  # a patron rolls only once its portrait is in
s=s.replace('<script id="pw-game">','<script id="pw-figs">window.PW_FIGS='+json.dumps(_figs)+';window.PW_CARDART='+json.dumps(_cardart)+';window.PW_UIART='+json.dumps(_uiart)+';window.PW_PATRONS='+json.dumps(_patrons)+';</script>\n<script id="pw-game">')
# the ink map reads the classic mana symbols from the emblem art file
mana=re.search(r'const MANA=(\{.*?\}),COLOR',open(W+'/emblem-art.js').read(),re.S).group(1)
open(W+'/pw-mana.js','w').write('window.PW_MANA='+mana+';')
for n,f in (('pw-emb-art','emblem-art.js'),('pw-touch','planeswalk-touch.js'),('pw-motion','planeswalk-motion.js'),('pw-mana','pw-mana.js'),('pw-ink-map','planeswalk-ink-map.js'),('pw-tips','pw-tips.js'),('pw-kit','pw-kit.js'),('pw-cast','pw-cast.js')):
  js=open(W+'/'+f).read();assert '</script' not in js;s=s+'\n<script id="%s">\n'%n+js+'\n</script>'
# Boot veil (Randall 31 Oct: "shows the old map and then immediately the new map"): the game renders during parsing, and the
# modules after it (touch, ink map, kit, cast) restyle that first frame; on a slow phone the browser paints in between.
# The app stays invisible until the last module has run (a 4 s cap keeps a broken module from hiding the game).
s=s+'\n<script id="pw-boot-done">document.documentElement.classList.remove(\'pw-boot\')</script>'
i=s.index('<div id="app">')
out=('<!doctype html>\n<html lang="en" class="pw-boot">\n<head>\n<style>html.pw-boot #app{visibility:hidden}</style><script>setTimeout(function(){document.documentElement.classList.remove(\'pw-boot\')},4000)</script>\n'+s[:i]+'<script type="module" src="./app-errors.js"></script>\n<script type="module" src="./planeswalk-cloud.js"></script>\n</head>\n<body>\n'+s[i:]+'\n<script type="module" src="./planeswalk-audio.js"></script>\n</body>\n</html>\n')
# Act art (idea 16): Zendikar's backdrops and Act 2 enemy art move to planeswalk-art-zen.css, which the game
# loads near the end of Act 1 (loadActArt), so the first load on a phone skips them.
ZEN_FOES=['spawn','scion','intruder','skyfisher','wolf','herder','baloth','ranger','drana','kozilek','omnath','ob']
cardNames=set(re.findall(r"^ [a-z0-9]+:\{name:(?:'([^']*)'|\"([^\"]*)\")",s[s.index('const C={'):s.index('\n};',s.index('const C={'))],re.M))
cardNames={a or b for a,b in cardNames}
zen=[]
def cut(m):
  zen.append(m.group(0).rstrip(';'));return ''
out=re.sub(r'--pw-x-zen-[a-z0-9-]+:url\(data:[^)]*\);?',cut,out)
rules=[]
for k in ZEN_FOES:
  m=re.search(r"[ ,{]"+k+r":\{name:(?:'([^']*)'|\"([^\"]*)\")",s)
  if not m:print('build: WARN act-2 monster %r is not in E, skipped'%k);continue# a renamed key never crashes the build
  n=m.group(1) or m.group(2)
  if n in cardNames:continue
  r=re.compile(r'\[data-n="'+re.escape(n)+r'"\]\{--img:url\(data:[^)]*\)\}')
  f=r.search(out)
  if f:rules.append(f.group(0));out=out[:f.start()]+out[f.end():]
if len(zen)<10:print('build: WARN only %d Zendikar backdrops found'%len(zen))
open(OUT+'/planeswalk-art-zen.css','w').write(':root{'+';'.join(zen)+'}\n'+'\n'.join(rules)+'\n')
import os
open(OUT+'/planeswalk.html.tmp','w').write(floor_styles(out));os.replace(OUT+'/planeswalk.html.tmp',OUT+'/planeswalk.html')
