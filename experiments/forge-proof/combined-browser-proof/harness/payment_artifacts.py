"""Pure allowlists for sampled browser payment and event evidence."""
import json, pathlib, re
diagnostic_allowlist=json.loads((pathlib.Path(__file__).resolve().parent/'action-diagnostics.json').read_text())

def payment_proof(v):
 if not isinstance(v,dict):return None
 clean={'schema':'cardstashy.mimic-payment-browser.v1'}
 for key in ['seed','stackEntries','uniqueStackItems','maxStackCopies','castRequests','castAccepted','autoPayments','tappedLands','lifeSpent']:
  value=v.get(key);clean[key]=value if type(value) is int and 0<=value<=99999999 else None
 clean['sequence']=v.get('sequence') if v.get('sequence')=='saved-keen-mimic-v1' else 'unknown'
 clean['controlMode']=v.get('controlMode') if v.get('controlMode')=='smart' else 'unknown'
 for key in ['spellOnBattlefield','controlsResumed']:clean[key]=v.get(key) is True
 valid=v.get('schema')==clean['schema'] and v.get('result')=='passed' and clean['seed']==20261025 and clean['sequence']=='saved-keen-mimic-v1' and clean['controlMode']=='smart'
 valid=valid and all(clean[k]==1 for k in ['stackEntries','uniqueStackItems','maxStackCopies','castRequests','castAccepted','autoPayments']) and clean['tappedLands']==2 and clean['lifeSpent']==0 and clean['spellOnBattlefield'] and clean['controlsResumed']
 clean['result']='passed' if valid else 'incomplete'
 return clean

def action_event(v):
 if not isinstance(v,dict):return None
 def number(value):return value if type(value) is int and 0<=value<=9007199254740991 else None
 def digest(value):return value if isinstance(value,str) and re.fullmatch('[a-f0-9]{64}',value) else None
 def member(value,values):return value if isinstance(value,str) and value in values else 'unknown'
 return {'order':number(v.get('order')),'event':member(v.get('event'),['action-submitted','action-receipt-read','viewer-state-observed']),
  **{key:number(v.get(key)) for key in ['revision','observedRevision','requestRevision','decisionId','requestDecisionId']},
  'inputType':member(v.get('inputType'),diagnostic_allowlist['inputTypes']),'operation':member(v.get('operation'),diagnostic_allowlist['operations']),
  'busy':v.get('busy') if type(v.get('busy')) is bool else None,
  **{key:digest(v.get(key)) for key in ['commandHash','generationHash']},
  'state':member(v.get('state'),['accepted','rejected','pending_outcome_unknown']),
  'httpStatus':v.get('httpStatus') if type(v.get('httpStatus')) is int and 100<=v['httpStatus']<=599 else None}

