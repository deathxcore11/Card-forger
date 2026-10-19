// Shared, bounded client/server transport for local Commander evidence. Only named
// fields leave the device; source matches and heuristic support are never win proof.
const str = (v, max = 300) => typeof v === 'string' ? v.slice(0, max) : '';
const finite = v => Number.isFinite(v) ? v : null;
const list = (v, max = 10, len = 300) => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).filter(x => typeof x === 'string').slice(0, max).map(x => str(x, len));
const status = v => ['supported', 'partial', 'unsupported', 'unknown', 'conditional', 'inferred'].includes(v) ? v : 'unknown';
const named = (rows, max = 25) => (Array.isArray(rows) ? rows : []).slice(0, max).flatMap(c => typeof c === 'string' ? [{name:str(c,180),qty:null}] : c && typeof c.name === 'string' ? [{name:str(c.name,180),qty:finite(c.qty)}] : []);
const evidence = value => {
  if (typeof value === 'string') return [str(value)];
  if (Array.isArray(value)) return value.slice(0,5).flatMap(e => typeof e === 'string' ? [str(e)] : e && typeof e.text === 'string' ? [{kind:str(e.kind,60),text:str(e.text)}] : []);
  // The plan classifier distinguishes primary participation from secondary themes.
  return value && typeof value === 'object' ? {primary:value.primary === true,support:list(value.support,8,100)} : [];
};
const omitted = (rows, max, prior = 0) => Math.max(Number.isInteger(prior) ? Math.max(0, Math.min(250, prior)) : 0, (Array.isArray(rows) ? rows.length : 0) - max);
const support = rows => (Array.isArray(rows) ? rows : []).slice(0,25).flatMap(c => c && typeof c.name === 'string' ? [{name:str(c.name,180),qty:finite(c.qty),evidence:evidence(c.evidence),...(c.status ? {status:status(c.status)} : {})}] : []);
const effect = e => ({kind:str(e?.kind,60),face:str(e?.face,180),evidence:str(e?.evidence),status:status(e?.status),requirements:list(e?.requirements,6),activationMana:finite(e?.activationMana),outputMana:finite(e?.outputMana),netMana:finite(e?.netMana),oneShot:e?.oneShot===true,tap:e?.tap===true,summoningSickness:e?.summoningSickness===true});
const resources = rows => (Array.isArray(rows) ? rows : []).slice(0,20).flatMap(c => c && typeof c.name === 'string' ? [{name:str(c.name,180),qty:finite(c.qty),effective:finite(c.effective),status:status(c.status),castManaValue:finite(c.castManaValue),activationMana:finite(c.activationMana),requirements:list(c.requirements,6),evidence:evidence(c.evidence),effects:(Array.isArray(c.effects)?c.effects:[]).slice(0,4).map(effect),cantrip:c.cantrip===true,paid:c.paid===true,repeatable:c.repeatable===true}] : []);

export function cleanCriteria(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const P=raw.plan||{}, R=raw.resources||{}, D=R.draw||{}, C=raw.coverage||{};
  return {constructed:cleanConstructed(raw.constructed),strategic:cleanStrategic(raw.strategic),version:str(raw.version,60),goal:str(raw.goal,80),requestedStyle:str(raw.requestedStyle,120),scoreMeaning:str(raw.scoreMeaning,200),structure:{score:finite(raw.structure?.score),label:str(raw.structure?.label,100)},
    plan:{status:status(P.status),label:str(P.label,160),primaryLabel:str(P.primaryLabel,100),primarySupport:support(P.primarySupport),secondarySupport:support(P.secondarySupport),primarySupportOmitted:omitted(P.primarySupport,25,P.primarySupportOmitted),secondarySupportOmitted:omitted(P.secondarySupport,25,P.secondarySupportOmitted),supportedCopies:finite(P.supportedCopies),eligibleCopies:finite(P.eligibleCopies),supportShare:finite(P.supportShare),setup:list(P.setup,8),resilience:{status:status(P.resilience?.status),cards:named(P.resilience?.cards,12),requirements:list(P.resilience?.requirements,6),limitations:list(P.resilience?.limitations,6)},warnings:list(P.warnings),
      routes:(Array.isArray(P.routes)?P.routes:[]).slice(0,8).map(r=>({kind:str(r?.kind,60),label:str(r?.label,180),status:status(r?.status),evidence:evidence(r?.evidence),cards:named(r?.cards,12),cardsOmitted:omitted(r?.cards,12,r?.cardsOmitted),requirements:list(r?.requirements,8)}))},
    resources:{...Object.fromEntries(['rawRamp','effectiveRamp','fixing','conditionalRamp','efficientRamp','expensiveRamp','onPlanRamp','nonResourceSupport','demand'].map(k=>[k,finite(R[k])])),evidence:resources(R.evidence),evidenceOmitted:omitted(R.evidence,20,R.evidenceOmitted),draw:{...Object.fromEntries(['raw','effective','cantrips','paid','conditional'].map(k=>[k,finite(D[k])])),evidence:resources(D.evidence),evidenceOmitted:omitted(D.evidence,20,D.evidenceOmitted)},manaSinks:named(R.manaSinks),largePayoffs:named(R.largePayoffs),warnings:list(R.warnings),meaning:'Effective values are heuristic contribution units, not literal card copies. Evidence lists may be bounded samples; supplied totals cover the assessed deck.'},
    coverage:{known:finite(C.known),total:finite(C.total),ratio:finite(C.ratio),status:str(C.status,60)||'unknown',limitations:list(C.limitations)}};
}

// Route scenario metrics are separate axes, never a competitive rating or win odds.
export function cleanStrategic(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const ratio = v => Number.isFinite(v) ? Math.max(0,Math.min(1,v)) : null;
  const metric = (source,keys) => Object.fromEntries(keys.map(k=>[k,finite(source?.[k])]));
  return {version:str(raw.version,60),score:finite(raw.score),status:str(raw.status,60)||'unknown',confidence:str(raw.confidence,60)||'insufficient',ratingStatus:['provisional-estimate','diagnostic-only'].includes(raw.ratingStatus)?raw.ratingStatus:'unknown',bestRoute:str(raw.bestRoute,60)||null,backupRoute:str(raw.backupRoute,60)||null,
    routes:(Array.isArray(raw.routes)?raw.routes:[]).slice(0,4).map(r=>({kind:str(r?.kind,60),label:str(r?.label,180),status:status(r?.status),access:ratio(r?.access),deployment:ratio(r?.deployment),conversion:ratio(r?.conversion),execution:ratio(r?.execution),cards:named(r?.cards,12),cardsOmitted:omitted(r?.cards,12,r?.cardsOmitted),evidence:list(r?.evidence,6),requirements:list(r?.requirements,8)})),
    dimensions:(Array.isArray(raw.dimensions)?raw.dimensions:[]).slice(0,8).map(d=>({key:str(d?.key,60),label:str(d?.label,180),ratio:ratio(d?.ratio),weight:finite(d?.weight),why:str(d?.why,500)})),
    coverage:metric(raw.coverage,['mappedPressureCopies','unmappedPressureCopies','knownLibrary','library']),scenario:metric(raw.scenario,['library','developmentDraws','controlDraws','expectedResourceUnits','effectiveRamp']),limitations:list(raw.limitations,10,500),meaning:'Provisional, uncalibrated route heuristic. Access, deployment and conversion are component evidence, not win probability or competitive strength. Null score means unavailable, not zero.'};
}

// Printed facts and arithmetic stay distinguishable from the app's strategic
// judgments. Retaining a model estimate never makes disagreement impermissible.
export function cleanConstructed(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const state=v=>v==='none'?'none':status(v), value=v=>typeof v==='string'?str(v,30):finite(v);
  const req=r=>({kind:str(r?.kind,60),evidence:str(r?.evidence,500),status:state(r?.status),cards:named(r?.cards,10),cardsOmitted:omitted(r?.cards,10,r?.cardsOmitted),subtype:str(r?.subtype,60),minimumMana:finite(r?.minimumMana),activationMana:finite(r?.activationMana),tap:r?.tap===true,discard:r?.discard===true,exert:r?.exert===true,note:str(r?.note,400)});
  const flowEffect=e=>({kind:str(e?.kind,60),mode:str(e?.mode,60),evidence:str(e?.evidence,500),castManaValue:finite(e?.castManaValue),activationMana:finite(e?.activationMana),effectMana:finite(e?.effectMana),effective:finite(e?.effective),cheap:e?.cheap===true,status:state(e?.status),requirements:list(e?.requirements,6)});
  const C=raw.coverage||{};
  return {version:str(raw.version,60),scoreMeaning:str(raw.scoreMeaning,200),cards:(Array.isArray(raw.cards)?raw.cards:[]).slice(0,35).flatMap(c=>{
    if(!c||typeof c.name!=='string')return [];
    const F=c.flow||{},I=c.interaction||{},T=c.threat||{};
    return [{name:str(c.name,180),qty:finite(c.qty),flow:{raw:F.raw===true,effective:finite(F.effective),cheap:F.cheap===true,status:state(F.status),effects:(Array.isArray(F.effects)?F.effects:[]).slice(0,5).map(flowEffect),effectsOmitted:omitted(F.effects,5,F.effectsOmitted)},interaction:{kind:['answer','tempo','none'].includes(I.kind)?I.kind:'unknown',effective:finite(I.effective),evidence:list(I.evidence,6,500),limitations:list(I.limitations,6)},threat:{quality:finite(T.quality),body:finite(T.body),power:value(T.power),toughness:value(T.toughness),manaValue:finite(T.manaValue),positive:list(T.positive,8),evidence:list(T.evidence,6,500),status:state(T.status)},requirements:(Array.isArray(c.requirements)?c.requirements:[]).slice(0,12).map(req),requirementsOmitted:omitted(c.requirements,12,c.requirementsOmitted),unsupported:(Array.isArray(c.unsupported)?c.unsupported:[]).slice(0,8).map(u=>({kind:str(u?.kind,60),evidence:str(u?.evidence,500),reason:str(u?.reason,400)}))}];
  }),cardsOmitted:omitted(raw.cards,35,raw.cardsOmitted),coverage:{status:state(C.status),unknownCopies:finite(C.unknownCopies),quantifiedCreatures:finite(C.quantifiedCreatures),creatureCopies:finite(C.creatureCopies),limitations:list(C.limitations,8,500)},evidencePolicy:'Printed card text, quantities and stated arithmetic checks are facts within their declared inputs. Effective flow, interaction weights, threat quality and strategic relevance are bounded heuristics, not authoritative conclusions. Explain disagreements with card text, costs, sequencing or deck context; do not invent replacement scores or win rates. A missing mapped effect is unknown, not proof the card has no value.'};
}
