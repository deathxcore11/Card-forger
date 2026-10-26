#!/usr/bin/env python3
"""Explicit sanitized evidence allowlist. Raw traces/logs/source are never copied."""
import json, math, pathlib, shutil, sys, collections, re
from payment_artifacts import payment_proof, action_event
raw,out,code,stage=pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]),int(sys.argv[3]),sys.argv[4]
out.mkdir(parents=True,exist_ok=True)
assert not any(out.iterdir()), 'artifact output must begin empty'
summary={'schema':'forge-existing-play-ci.v1','result':'passed' if code==0 else 'failed','processExitCode':code,'stage':stage,'scope':'existing Play handlers, synthetic account/cache, reviewed source host and visibility-native descendant; image/release acceptance separate; no production login/deployment or physical-device claim','cases':{}}
pngs={'setup.png','opening.png','resolved.png','terminal.png','complete.png','failure.png'}
def bounded_number(v,low=0,high=10000):return type(v) in [int,float] and math.isfinite(v) and low<=v<=high
def rectangle(v):return {k:v[k] for k in ['x','y','width','height']} if isinstance(v,dict) and all(bounded_number(v.get(k),-10000) for k in ['x','y','width','height']) else None
diagnostic_allowlist=json.loads((pathlib.Path(__file__).resolve().parent/'action-diagnostics.json').read_text())
stages=set(diagnostic_allowlist['stages'])|{'native '+v for v in diagnostic_allowlist['inputTypes']+diagnostic_allowlist['promptMethods']}
def safe_stage(v):return v if isinstance(v,str) and v in stages else 'unknown'
def action_diagnostic(v):
 if not isinstance(v,dict):return None
 def member(key,value,fallback='unknown'):return value if isinstance(value,str) and value in diagnostic_allowlist[key] else fallback
 def number(value):return value if type(value) is int and 0<=value<=9007199254740991 else None
 def digest(value):return value if isinstance(value,str) and re.fullmatch('[a-f0-9]{64}',value) else None
 status=v.get('httpStatus');status=status if type(status) is int and 100<=status<=599 else None
 command=digest(v.get('commandHash'));receipt_command=digest(v.get('receiptCommandHash'))
 bound=command is not None and command==receipt_command
 rejected=status in [400,409] and bound and v.get('state')=='rejected'
 return {'stage':safe_stage(v.get('stage')),'inputType':member('inputTypes',v.get('inputType')),
  **{key:number(v.get(key)) for key in ['decisionId','observedRevision','requestRevision','requestDecisionId']},
  'operation':member('operations',v.get('operation')),
  **{key:digest(v.get(key)) for key in ['commandHash','receiptCommandHash','generationHash']},
  'httpStatus':status,'state':'rejected' if rejected else v.get('state') if status==202 and bound and v.get('state') in ['accepted','pending_outcome_unknown'] else 'unknown',
  'reason':member('reasons',v.get('reason'),'native_action_rejected') if rejected else None,
  'bodyRead':v.get('bodyRead') if v.get('bodyRead') in ['parsed','unavailable','timeout','malformed','oversized'] else 'unknown',
  'receiptSource':v.get('receiptSource') if v.get('receiptSource') in ['browser-response','fixture-forwarded-response'] else 'unknown'}
checks={'one Mimic stack entry and payment; rendered controls resume', 'real native seven-card opening after existing setup', 'hand fits touch viewport; no horizontal pan required', 'explicit Rematch creates a new allocation/generation with exact decks and acknowledged native opening', 'explicit concession waits for native result and returns to existing Play', 'hand and both HUDs visible; compact canonical controls reachable; visible card images ready', 'existing Play menu selects concrete human and CPU decks through actual handlers', 'real rendered land action reaches native battlefield', 'actual natural native result reaches dedicated immutable match result', 'Home navigation after resource cleanup', 'actual touch pan reaches rightmost card through native handler without sending an action', 'real difficulty menu cycles Easy/Hard/Medium without allocating; only Medium native policy is exercised', 'Exit cancellation returns to the unchanged native match', 'Smart / Full buttons reflect actual native acknowledgements', 'exact snapshots admitted by real host with native Smart policy', 'real native creature cast, Smart payment, creature-type choice and resolution'}

def result_record(v):
 if not isinstance(v,dict) or type(v.get('draw')) is not bool:return None
 winner=v.get('winnerPlayerId')
 return {'draw':v['draw'],'winnerPlayerId':winner if type(winner) is int and 0<=winner<=1024 else None}
def base_metadata(v):
 clean={'schema':'forge-existing-play-browser.v1','result':v.get('result') if v.get('result') in ['passed','failed','running'] else 'failed','case':v.get('case') if v.get('case') in ['saved-keen','saved-reign','import-keen','import-reign'] else 'unknown','scope':'LOCAL_TEST_NOT_DEPLOYABLE; synthetic account/storage; actual rendered Play controls'}
 browser=v.get('browser');clean['browser']=browser if isinstance(browser,str) and re.fullmatch(r'[0-9]{1,4}(?:\.[0-9]{1,5}){1,3}',browser) else None
 viewport=v.get('viewport') if isinstance(v.get('viewport'),dict) else {}
 clean['viewport']={k:viewport[k] if type(viewport.get(k)) is int and 1<=viewport[k]<=4096 else None for k in ['width','height']};clean['viewport']['hasTouch']=viewport.get('hasTouch') is True
 clean['checks']=[q for q in v.get('checks',[])[:50] if isinstance(q,str) and q in checks] if isinstance(v.get('checks'),list) else []
 for k in ['actions','creates','privacyChecks','externalCredentialViolations','unexpectedRequests']:
  clean[k]=v[k] if type(v.get(k)) is int and 0<=v[k]<=100000 else None
 for k in ['terminal','concession']:clean[k]=result_record(v.get(k))
 d=v.get('selectedDigests') if isinstance(v.get('selectedDigests'),dict) else {}
 clean['selectedDigests']={k:d[k] for k in ['humanDeck','opponentDeck'] if isinstance(d.get(k),str) and re.fullmatch('[a-f0-9]{64}',d[k])}
 pan=v.get('handPan')
 if isinstance(pan,dict) and type(pan.get('overflow')) is bool:
  clean['handPan']={'overflow':pan['overflow']}
  for k in ['before','after']:
   q=pan.get(k)
   if isinstance(q,dict) and all(bounded_number(q.get(x)) for x in ['left','max']):clean['handPan'][k]={x:q[x] for x in ['left','max']}
 return clean
for name in ['desktop','touch750']:
 source=raw/name
 if not source.exists():
  summary['cases'][name]={'result':'not-run'};continue
 target=out/name;target.mkdir()
 report=source/'summary.json'
 if report.is_file() and not report.is_symlink():
  original=json.loads(report.read_text());clean=base_metadata(original)
  clean['pageErrorCount']=len(original.get('errors',[]))
  classes={'Error','TypeError','AssertionError','TimeoutError','ReferenceError','SyntaxError','SecurityError','DataCloneError','InvalidStateError','NotSupportedError','AbortError','Other'}
  clean['observedErrorClassCounts']=dict(collections.Counter(n if n in classes else 'Other' for n in original.get('errors',[])))
  diagnostics=[]
  categories={'resize-observer-loop','stack-limit','not-defined','not-function','null-property','json-decode','assertion','response-body-unavailable','context-closed','aborted','network-failure','other'}
  for value in original.get('errorDiagnostics',[])[:20]:
   if not isinstance(value,dict) or value.get('source') not in {'page','response-observer','request-observer'}:continue
   d={'source':value['source'],'class':value.get('class') if value.get('class') in classes else 'Other','category':value.get('category') if value.get('category') in categories else 'other'}
   count=value.get('count');d['count']=count if type(count) is int and 0<count<=100000 else 1
   loc=value.get('location')
   if isinstance(loc,dict) and isinstance(loc.get('file'),str) and loc['file'] in {'app.js','forge-session.mjs','native-panel.mjs','match-table.mjs','forge-host-client.mjs','play-setup.mjs','forge-play-browser.mjs'} and all(type(loc.get(k)) is int and 0<loc[k]<=10000000 for k in ['line','column']):
    d['location']={k:loc[k] for k in ['file','line','column']}
   diagnostics.append(d)
  if diagnostics:clean['errorDiagnostics']=diagnostics
  # Metadata only: never copy cached bodies, bearer, match IDs or generations.
  observed=original.get('observation')
  if isinstance(observed,dict) and observed.get('method')=='fixture-forwarded-viewer-response-cache' and type(observed.get('intervalMs')) is int and observed['intervalMs']==250:
   safe_observation={'method':'fixture-forwarded-viewer-response-cache','intervalMs':250}
   for key in ['reads','accepted']:
    value=observed.get(key)
    if type(value) is int and 0<=value<=100000:safe_observation[key]=value
   value=observed.get('lastHttpStatus')
   safe_observation['lastHttpStatus']=value if type(value) is int and 100<=value<=599 else None
   clean['observation']=safe_observation
  if original.get('difficultySelections')==['Easy','Hard','Medium']:clean['difficultySelections']=['Easy','Hard','Medium']
  else:clean['result']='failed'
  # Combined acceptance adds only fixed booleans and bounded geometry/counts.
  for key in ['naturalFinish','rematchVerified']:
   clean[key]=original.get(key) is True
  visuals=[]
  def rect(value):
   return isinstance(value,dict) and all(type(value.get(k)) in [int,float] and math.isfinite(value[k]) and -10000<=value[k]<=10000 for k in ['x','y','width','height'])
  for value in original.get('visualChecks',[])[:2]:
   if not isinstance(value,dict) or value.get('stage') not in ['first-main','resolved']:continue
   if any(not rect(value.get(k)) for k in ['hand','you','cpu','dock']):continue
   if any(type(value.get(k)) is not int or not 0<=value[k]<=10000 for k in ['width','height','visibleHandCards','imageCount','imagesReady']):continue
   exposure=value.get('exposure');life=value.get('lifeVisible')
   if not isinstance(exposure,dict) or not isinstance(life,list) or life!=[True,True]:continue
   if any(not isinstance(exposure.get(k),dict) or exposure[k].get('visible') is not True or any(type(exposure[k].get(q)) not in [int,float] or not math.isfinite(exposure[k][q]) for q in ['opacity','areaRatio']) or not .5<=exposure[k]['opacity']<=1 or not .98<exposure[k]['areaRatio']<=1.001 or type(exposure[k].get('hits')) is not int or not 1<=exposure[k]['hits']<=5 for k in ['hand','you','cpu','dock']):continue
   controls=value.get('controls')
   if not isinstance(controls,list) or not 3<=len(controls)<=8 or any(not rect(c) or c.get('receivesPointer') is not True for c in controls):continue
   visuals.append({'stage':value['stage'],**{k:value[k] for k in ['width','height','visibleHandCards','imageCount','imagesReady']},'compact':value.get('compact') is True,**{k:{q:value[k][q] for q in ['x','y','width','height']} for k in ['hand','you','cpu','dock']},'lifeVisible':[True,True],'exposure':{k:{q:exposure[k][q] for q in ['visible','opacity','areaRatio','hits']} for k in ['hand','you','cpu','dock']},'controls':[{**{q:c[q] for q in ['x','y','width','height']},'receivesPointer':True} for c in controls]})
  clean['visualChecks']=visuals
  if len(visuals)!=2 or {v['stage'] for v in visuals}!={'first-main','resolved'} or any(v['imageCount']!=v['imagesReady'] or not v['imageCount'] for v in visuals):clean['result']='failed'
  if name=='desktop' and not(clean['naturalFinish'] and clean['rematchVerified'] and original.get('creates')==2):clean['result']='failed'
  clean['paymentProof']=payment_proof(original.get('paymentProof'))
  if not clean['paymentProof'] or clean['paymentProof']['result']!='passed':clean['result']='failed'
  events=original.get('actionEvents')
  if isinstance(events,list):clean['actionEvents']=[d for v in events[:256] if (d:=action_event(v)) is not None]
  clean['actionEventsTruncated']=original.get('actionEventsTruncated') is True
  trail=original.get('actionDiagnostics')
  if isinstance(trail,list):clean['actionDiagnostics']=[d for v in trail[:64] if (d:=action_diagnostic(v)) is not None]
  if 'actionRejection' in original:
   clean['actionRejection']=action_diagnostic(original['actionRejection'])
   clean['result']='failed'
  if 'failure' in original:
   error=original['failure'];clean['failure']={'stage':safe_stage(error.get('stage')),'class':error.get('name') if error.get('name') in ['Error','TimeoutError','AssertionError','TypeError'] else 'Error'}
  if 'failedAction' in original:
   a=original['failedAction'];clean['failedAction']={'stage':safe_stage(a.get('stage')),'clickSettled':a.get('clickSettled') if a.get('clickSettled') in ['fulfilled','rejected'] else 'unknown','responseSettled':a.get('responseSettled') if a.get('responseSettled') in ['fulfilled','rejected'] else 'unknown','nativePosts':a.get('nativePosts') if type(a.get('nativePosts')) is int and 0<=a['nativePosts']<=100000 else None,'reason':a.get('reason') if a.get('reason') in ['pointer-intercepted','click-failed','native-post-timeout'] else 'unknown'}
   g=a.get('geometry')
   if isinstance(g,dict):clean['failedAction']['geometry']={'matches':g.get('matches') if type(g.get('matches')) is int and 0<=g['matches']<=1000 else None,'rect':rectangle(g.get('rect')),'centerReceivesPointer':g.get('centerReceivesPointer') is True}
 else:clean={'result':'failed','failure':{'stage':'browser-ended-before-report','class':'ProcessExit'}}
 required_pngs={'setup.png','opening.png','resolved.png','complete.png'}|({'terminal.png'} if name=='desktop' else set())
 if any(not(source/p).is_file() or (source/p).is_symlink() for p in required_pngs):clean['result']='failed'
 lifecycle=source/'lifecycle.json'
 life=json.loads(lifecycle.read_text()) if lifecycle.is_file() and not lifecycle.is_symlink() else {}
 clean['cleanup']={'confirmed':life.get('confirmed') is True,'privateInputRemoved':life.get('privateInputRemoved') is True,**{k:life[k] if type(life.get(k)) is int and 0<=life[k]<=3 else None for k in ['starts','destroys']}}
 expected_allocations=2 if name=='desktop' else 1
 lc=life.get('lifecycle') if isinstance(life.get('lifecycle'),dict) else {}
 alloc=lc.get('allocations') if isinstance(lc.get('allocations'),list) else []
 image_ok=lambda v:isinstance(v,str) and re.fullmatch(r'sha256:[a-f0-9]{64}',v) is not None
 container_ok=lambda v:isinstance(v,str) and re.fullmatch(r'[a-f0-9]{64}',v) is not None
 allocation_keys=['sameImage','confirmed','removed','privateInputRemoved','forced','oomKilled','running','status','exitCode','starts','destroys']
 clean['cleanup']['imageId']=lc.get('imageId') if image_ok(lc.get('imageId')) else None
 clean['cleanup']['allocations']=[]
 good_allocations=lc.get('confirmed') is True and image_ok(lc.get('imageId')) and len(alloc)==expected_allocations
 seen_containers=set()
 for a in alloc[:2]:
  if not isinstance(a,dict):good_allocations=False;continue
  valid=a.get('scope')=='LOCAL_TEST_NOT_DEPLOYABLE' and a.get('imageId')==lc.get('imageId') and container_ok(a.get('containerId')) and a.get('containerId') not in seen_containers
  valid=valid and all(a.get(k) is True for k in ['sameImage','confirmed','removed','privateInputRemoved']) and all(a.get(k) is False for k in ['forced','oomKilled','running']) and a.get('status')=='exited' and type(a.get('exitCode')) is int and a['exitCode']==0 and a.get('starts')==a.get('destroys')==1
  good_allocations=good_allocations and valid
  if container_ok(a.get('containerId')):seen_containers.add(a['containerId'])
  clean['cleanup']['allocations'].append({'imageId':a.get('imageId') if image_ok(a.get('imageId')) else None,'confirmed':bool(valid),'status':'exited' if a.get('status')=='exited' else 'unconfirmed','exitCode':a.get('exitCode') if type(a.get('exitCode')) is int and 0<=a['exitCode']<=255 else None,'forced':a.get('forced') is not False,'oomKilled':a.get('oomKilled') is not False,'removed':a.get('removed') is True,'privateInputRemoved':a.get('privateInputRemoved') is True})
 if not good_allocations:clean['result']='failed';clean['cleanup']['confirmed']=False
 if not(clean['cleanup']['privateInputRemoved'] and clean['cleanup']['starts']==expected_allocations and clean['cleanup']['destroys']==expected_allocations):clean['result']='failed'
 if clean.get('result')!='passed' or clean['cleanup'].get('confirmed') is not True:summary['result']='failed'
 (target/'summary.json').write_text(json.dumps(clean,indent=2)+'\n');summary['cases'][name]={'result':clean.get('result','failed'),'cleanupConfirmed':clean['cleanup'].get('confirmed') is True,'actions':clean.get('actions',0)}
 for filename in pngs:
  p=source/filename
  if p.exists():
   assert p.is_file() and not p.is_symlink() and p.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
   shutil.copyfile(p,target/filename)
if summary['cases']['touch750']['result']=='not-run' or summary['cases']['desktop']['result']=='not-run':summary['result']='failed'
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
files=[p for p in out.rglob('*') if p.is_file()]
assert sum(p.stat().st_size for p in files)<=10*1024*1024
for p in files:
 assert not p.is_symlink()
 data=p.read_bytes();assert b'forge-browser-fixture-owner' not in data and b'Bearer ' not in data
print(json.dumps(summary))
