#!/usr/bin/env python3
"""Explicit sanitized evidence allowlist. Raw traces/logs/source are never copied."""
import json, math, pathlib, shutil, sys, collections, re
raw,out,code,stage=pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]),int(sys.argv[3]),sys.argv[4]
out.mkdir(parents=True,exist_ok=True)
assert not any(out.iterdir()), 'artifact output must begin empty'
summary={'schema':'forge-existing-play-ci.v1','result':'passed' if code==0 else 'failed','processExitCode':code,'stage':stage,'scope':'existing Play handlers, synthetic account/cache, actual host and frozen0146 Forge; no production login/deployment or physical-device claim','cases':{}}
pngs={'setup.png','opening.png','resolved.png','terminal.png','complete.png','failure.png'}
safe_fields={'schema','result','case','scope','browser','viewport','checks','actions','creates','privacyChecks','externalCredentialViolations','unexpectedRequests','terminal','concession','selectedDigests','handPan'}
for name in ['desktop','touch750']:
 source=raw/name
 if not source.exists():
  summary['cases'][name]={'result':'not-run'};continue
 target=out/name;target.mkdir()
 report=source/'summary.json'
 if report.is_file() and not report.is_symlink():
  original=json.loads(report.read_text());clean={k:v for k,v in original.items() if k in safe_fields}
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
   if isinstance(loc,dict) and isinstance(loc.get('file'),str) and re.fullmatch(r'[A-Za-z0-9_.-]{1,100}\.(?:js|mjs)',loc['file']) and all(type(loc.get(k)) is int and 0<loc[k]<=10000000 for k in ['line','column']):
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
  if 'failure' in original:
   error=original['failure'];clean['failure']={'stage':str(error.get('stage','unknown'))[:80],'class':error.get('name') if error.get('name') in ['Error','TimeoutError','AssertionError','TypeError'] else 'Error'}
  if 'failedAction' in original:
   a=original['failedAction'];clean['failedAction']={k:a[k] for k in ['stage','clickSettled','responseSettled','nativePosts','reason','geometry'] if k in a}
 else:clean={'result':'failed','failure':{'stage':'browser-ended-before-report','class':'ProcessExit'}}
 lifecycle=source/'lifecycle.json'
 clean['cleanup']=json.loads(lifecycle.read_text()) if lifecycle.is_file() and not lifecycle.is_symlink() else {'confirmed':False}
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
