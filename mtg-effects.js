// Small, inspectable rules-text evidence. This is not a rules simulator: unknown
// targets, variable output and game-state requirements stay conditional/unsupported.
const lower = (s) => String(s || '').toLowerCase();
const unique = (xs) => [...new Set(xs.filter(Boolean))];
const resourceMemo = new WeakMap(), effectMemo = new WeakMap();
const withoutReminder = (s) => String(s || '').replace(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '').trim();
const facesOf = (c) => c?.card_faces?.length ? c.card_faces : [c || {}];
const ownHaste = (c,face) => /(?:^|\n)(?:[a-z -]+, )*haste(?:, [a-z -]+)*(?:\s*\([^)]*\))?(?:\n|$)/i.test(face.oracle_text || '') || (!face.oracle_text && (c?.keywords || []).includes('Haste'));
const sagaChapter = (line) => /^(?:[IVX]+(?:,\s*[IVX]+)*)\s*—/.test(line);
const creationController = (before) => /(?:its|their|that creature's|target creature's) controller\s*$/.test(before)?'target-controller':/(?:an?|each|target) opponent(?: of your choice)?\s*$|your opponents?(?: each)?\s*$/.test(before)?'opponent':/(?:target|that|each|defending|attacking) player\s*$/.test(before)?'unspecified-player':'self';
const amount = (s) => ({a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,ten:10}[lower(s)] ?? (/^\d+$/.test(s) ? Number(s) : null));
export function manaCostValue(text) {
  const symbols = [...String(text || '').matchAll(/\{([^}]+)\}/g)].map(m => m[1].toUpperCase());
  if (symbols.some(s => /[XYZ]/.test(s))) return null;
  return symbols.reduce((n, s) => n + (/^\d+$/.test(s) ? Number(s) : /^(T|Q|E)$/.test(s) ? 0 : /^2\//.test(s) ? 2 : 1), 0);
}
const castValue = (c) => Number.isFinite(Number(c?.cmc)) && c?.cmc != null ? Number(c.cmc) : c?.mana_cost || c?.card_faces?.[0]?.mana_cost ? manaCostValue(c?.mana_cost || c?.card_faces?.[0]?.mana_cost) : null;
const requirementsFor = (line, face, index, c) => {
  const t = lower(line), cost = line.includes(':') ? line.split(':')[0].trim() : '', requirements = [];
  if (index > 0) requirements.push('Requires access to the alternate face');
  if (sagaChapter(line)) requirements.push('Requires reaching the stated Saga chapter');
  if (/\bif\b/.test(t)) requirements.push((line.match(/\bif\b[^,.]*/i) || [])[0] || 'Conditional game state');
  if (/\bwhenever\b|\bat the beginning\b/.test(t)) requirements.push((line.match(/^(?:.*?—\s*)?((?:Whenever|At the beginning)[^,]*)/i) || [])[1] || 'Requires its trigger');
  if (cost) requirements.push('Activation: ' + cost);
  if (/\bsacrifice\b/.test(lower(cost))) requirements.push('Requires the object to sacrifice');
  if (/\bdiscard\b/.test(lower(cost))) requirements.push('Requires the card to discard');
  if (/\bremove\b[^:]*counter/.test(lower(cost))) requirements.push('Requires counters to remove');
  if (/among legendary/.test(t)) requirements.push('Requires a legendary creature or planeswalker with an eligible color');
  if (/could produce/.test(t)) requirements.push('Requires an eligible land with an available mana color/type');
  if (/exiled card|metalcraft|threshold|delirium/.test(t)) requirements.push('Requires the stated card or game-state prerequisite');
  if (/\bspend this mana only\b/.test(t)) requirements.push((line.match(/Spend this mana only[^.]*/i) || [])[0]);
  if (/\bactivate only\b/.test(t)) requirements.push((line.match(/Activate only[^.]*/i) || [])[0]);
  if (/\benters(?: the battlefield)? tapped\b/.test(lower(face.oracle_text))) requirements.push('Enters tapped');
  if (/\{t\}|\{q\}/i.test(cost) && /\bCreature\b/.test(face.type_line || c?.type_line || '') && !ownHaste(c,face)) requirements.push('Creature tap ability requires haste or control since turn began');
  return unique(requirements);
};
const outputOf = (text) => {
  const t = lower(text);
  if (/\bfor each\b|\bequal to\b/.test(t)) return null;
  const symbols = t.match(/^\s*((?:\{[wubrgc]\})+)/);
  if (symbols) return (symbols[1].match(/\{/g) || []).length;
  const fixed = t.match(/^\s*(a|an|one|two|three|four|five|six|seven|ten|\d+) mana\b/);
  return fixed ? amount(fixed[1]) : null;
};
const variableCondition = (t) => /\b(for each|equal to|that much|x mana|number of|of that color|in any combination)\b/.test(t);

// Recognize printed/granted keywords without treating a removal/protection
// target mentioning a keyword as a source of that ability. This establishes
// capability, not that its costs or strategic dependencies are satisfied.
export function mtgAbilityEvidence(c,ability) {
  const escaped=String(ability).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),word=new RegExp('\\b'+escaped+'(?=$|\\W)','i'),out=[];
  for(const [index,face] of facesOf(c).entries())for(const raw of String(face.oracle_text||'').split('\n')){
    const line=withoutReminder(raw),t=lower(line);if(!word.test(line))continue;
    const native=new RegExp('^(?:[a-z -]+, )*'+escaped+'(?=$|[\\s,{.—])','i').test(line),
      // Commander ninjutsu is a variant of the requested base mechanic, not
      // evidence that regular ninjutsu can activate from the command zone.
      commanderNinjutsu=lower(ability)==='ninjutsu'&&/^Commander ninjutsu(?=$|[\s{])/i.test(line),
      // Satoru grants an activated ability to cards in the controller's hand.
      // Keep that scope explicit; this is not a battlefield-native keyword.
      handGrant=lower(ability)==='ninjutsu'&&/^(?:Each creature card|Creature cards) in your hand (?:has|have|gain|gains)\b/i.test(line)&&!/(?:opponent|loses?|without|can't have|can't gain)/.test(t),
      grant=handGrant||/(?:creatures? you control|this creature|this card|equipped creature|enchanted creature|target creature)[^.]*\b(?:has|have|gain|gains)\b/i.test(line)&&!/(?:opponent|loses?|without|can't have|can't gain)/.test(t);
    if(native||commanderNinjutsu||grant)out.push({ability,face:face.name||c?.name,evidence:line,status:'conditional',...(commanderNinjutsu?{variant:'Commander ninjutsu'}:{}),...(handGrant?{recipientZone:'hand'}:{}),requirements:[...requirementsFor(line,face,index,c),...(handGrant?['Requires the grant to be active and an eligible creature card in your hand']:grant?['Requires an eligible recipient of the granted ability']:[]),...(lower(ability)==='ninjutsu'?['Requires the stated ninjutsu cost and an unblocked attacking creature you control']:[]),'Keyword capability alone does not establish an executable synergy']});
  }
  return out;
}

/** Net acceleration is distinct from filtering. Effects preserve costs and limits;
 * conditional acceleration is possible capability, not a guaranteed mana amount. */
export function mtgResourceProfile(c) {
  if (c && typeof c === 'object' && resourceMemo.has(c)) return resourceMemo.get(c);
  const faces = facesOf(c), castManaValue = castValue(c), effects = [], unsupported = [];
  const isLand = /\bLand\b/.test(faces[0]?.type_line || String(c?.type_line || '').split(' // ')[0]);
  faces.forEach((face, index) => {
    const type = face.type_line || c?.type_line || '', oneShotSpell = /\b(?:Instant|Sorcery)\b/.test(type), isLandFace=/\bLand\b/.test(type);
    const setupRequirements=String(face.oracle_text || '').split('\n').filter(line=>/as an additional cost to cast|would enter[^.]*discard|would enter[^.]*sacrifice/i.test(line)).map(line=>'Setup: '+withoutReminder(line));
    const noUntap=/doesn't untap during your untap step/.test(lower(face.oracle_text));
    const renewalLine=String(face.oracle_text || '').split('\n').find(line=>!(/doesn't untap/i.test(line))&&/\buntap (?:this|[A-Z])/i.test(line));
    const renewalCost=renewalLine?.match(/((?:\{[^}]+\})+)[^:]*:|pay ((?:\{[^}]+\})+)/i);
    const renewalMana=renewalCost?manaCostValue(renewalCost[1]||renewalCost[2]):null;
    for (const raw of String(face.oracle_text || '').split('\n')) {
      const line = withoutReminder(raw), t = lower(line);
      if (!line) continue;
      const cost = line.includes(':') ? line.split(':')[0] : '';
      const base = {face: face.name || c?.name || '', evidence: line, castManaValue, controller:'self',
        activationMana: cost ? manaCostValue(cost) : 0, isLandFace, automaticUntap:!noUntap, renewalMana, tap: /\{t\}/i.test(cost),
        summoningSickness: /\{t\}|\{q\}/i.test(cost) && /\bCreature\b/.test(type) && !ownHaste(c,face),
        requiresCasting: !/exile (?:this card|[^:]+) from your hand/i.test(cost), oneShot: oneShotSpell || /exile (?:this card|[^:]+) from your hand/i.test(cost) || /sacrifice (?:this|~)/i.test(cost) || (!!face.name && lower(cost).includes('sacrifice '+lower(face.name))), requirements: requirementsFor(line, face, index, c)};
      base.requirements.push(...setupRequirements);
      if (noUntap && base.tap) base.requirements.push('Does not untap during your untap step; '+(renewalLine || 'requires a separate untap effect'));
      if (isLandFace && index>0) base.requirements.push('Uses a land play instead of casting the spell face');
      const add = t.match(/\badds?\s+((?:\{[wubrgc]\}|(?:a|an|one|two|three|four|five|six|seven|ten|\d+|x|that much|an amount of|mana of any)\b)[^.]*)/);
      if (add) {
        const outputMana = /for each/.test(t) ? null : outputOf(add[1]), initialMana = oneShotSpell ? castManaValue : 0;
        const netMana = outputMana !== null && base.activationMana !== null && initialMana !== null ? outputMana - base.activationMana - initialMana : null;
        const opponentOnly = /(?:opponent|opponents) adds?\b|each other player adds?\b/.test(t);
        const granted = /(?:enchanted|equipped) (?:land|creature|permanent) has|(?:lands|creatures|permanents) you control have/.test(t);
        const equipCost=/equipped creature has/.test(t)?String(face.oracle_text || '').match(/(?:^|\n)Equip ((?:\{[^}]+\})+)/i):null;
        const equipMana=equipCost?manaCostValue(equipCost[1]):null;
        const grantedCreatureTap=granted&&/creature/.test(t)&&/\{t\}/.test(t);
        const conditional = index > 0 || base.summoningSickness || noUntap || setupRequirements.length>0 || sagaChapter(line) || /tap (?:an?|one|two|three|\d+) untapped|exile [^:]+from your hand|among legendary|could produce/.test(t) || /\bif\b|\bwhenever\b|\bat the beginning\b|\bsacrifice\b|\bdiscard\b|\bremove\b[^:]*counter/.test(t) || variableCondition(add[1]) || netMana === null || granted || /spend this mana only|activate only|exiled card|metalcraft|threshold|delirium/.test(t);
        const acceleration = !isLandFace && !opponentOnly && (netMana === null || netMana > 0);
        const fixing = !isLandFace && !opponentOnly && /any colou?r|\{[wubrg]\}/.test(add[1]);
        const effect = {...base, equipMana, summoningSickness:base.summoningSickness||grantedCreatureTap, kind: isLandFace?'land-mana':netMana !== null && netMana <= 0 ? 'mana-filter' : 'mana', outputMana, netMana,
          acceleration, fixing, controller:opponentOnly?'opponent':'self', status: opponentOnly ? 'unsupported' : conditional ? 'conditional' : 'supported'};
        if (opponentOnly) effect.requirements.push('Mana is provided only to an opponent');
        if (netMana === null) effect.requirements.push('Mana output or net gain depends on game state');
        if (granted) effect.requirements.push('Requires the object receiving the mana ability');
        if (equipMana!==null) effect.requirements.push(`Equip cost: ${equipCost[1]}; requires a creature to equip`);
        if (grantedCreatureTap) effect.requirements.push('The creature receiving this tap ability requires haste or control since turn began');
        effects.push(effect);
        if (opponentOnly) unsupported.push(effect);
      }
      if (!(/put this (?:artifact|creature|enchantment|permanent) onto the battlefield/.test(t)&&!/search your library/.test(t)) && /\b(?:search your library|put|play)\b/.test(t) && (/\b(?:land|plains|island|swamp|mountain|forest)\b/.test(t)) && /onto the battlefield|play (?:an?|one|two|\d+) additional lands?/.test(t)) {
        const recipientUnknown = /(?:its|their) controller (?:may )?(?:search|put|play)|(?:target|that|each) player (?:may )?(?:search|put|play)|(?:target|each|an?) opponent (?:may )?(?:search|put|play)/.test(t);
        const ownSource = /search your library|put[^.]*land[^.]*from your (?:hand|graveyard)|you may play[^.]*additional lands?/.test(t);
        const faceText = lower(withoutReminder(face.oracle_text));
        const sacrificed = faceText.match(/sacrifice (a|an|one|two|three|\d+) lands?\b/);
        const variableSacrifice=/sacrifice any number of lands/.test(faceText);
        const sacrificeLands = sacrificed ? amount(sacrificed[1]) : 0;
        const direct = t.match(/put (a|an|one|two|three|\d+|it|that card) (?:[^.]*?)onto the battlefield/);
        const searched = t.match(/search your library for (?:up to )?(a|an|one|two|three|\d+) (?:basic )?land cards?/);
        const putLands = direct ? (/^(it|that card)$/.test(direct[1]) ? 1 : amount(direct[1])) : /put (?:them|those cards) onto the battlefield/.test(t) && searched ? amount(searched[1]) : null;
        const netLands = variableSacrifice && /that many land cards/.test(t)?0:putLands !== null ? putLands - sacrificeLands : null;
        const unsupportedRecipient = recipientUnknown && !ownSource;
        const unknownExchange = (sacrificeLands > 0 || variableSacrifice) && netLands === null;
        const conditional = index > 0 || /\bif\b|\bwhenever\b|from your hand|additional land/.test(t) || sacrificeLands > 0 || variableSacrifice;
        const requirements = [...base.requirements];
        if (/search your library/.test(t)) requirements.push('Requires an eligible land in the library');
        if (/from your hand|additional land/.test(t)) requirements.push('Requires a land available to play or put onto the battlefield');
        if (sacrificeLands) requirements.push(`Requires sacrificing ${sacrificeLands} land${sacrificeLands===1?'':'s'}; net land gain is ${netLands===null?'unquantified':netLands}`);
        if (variableSacrifice) requirements.push('Replaces the sacrificed lands; does not add to land count');
        if (unsupportedRecipient) requirements.push('Land is provided to a target controller/player, not guaranteed to you');
        const exchange = (sacrificeLands > 0 || variableSacrifice) && netLands !== null && netLands <= 0;
        const effect = {...base, requirements, controller:unsupportedRecipient?'target-controller':'self', kind:exchange?'land-exchange':'land-acceleration', outputMana:null, netMana:null, netLands, acceleration:!isLandFace&&!unsupportedRecipient&&!unknownExchange&&!exchange, fixing:exchange&&!unsupportedRecipient, status:unsupportedRecipient||unknownExchange?'unsupported':conditional?'conditional':'supported'};
        effects.push(effect);
        if(effect.status==='unsupported') unsupported.push(effect);
      }
      const treasure = t.match(/\bcreates?\b[^.]*\btreasure tokens?\b/);
      if (treasure) {
        const controller=creationController(t.slice(0,treasure.index));
        const effect={...base, controller, kind:'treasure', outputMana:null, netMana:null, acceleration:!isLandFace&&controller==='self', fixing:controller==='self', oneShot:true, status:controller==='self'?'conditional':'unsupported', requirements:unique([...base.requirements, controller==='self'?'Requires creating and sacrificing a Treasure; net gain depends on creation costs':'Treasure is not guaranteed to be under your control'])};
        effects.push(effect); if(effect.status==='unsupported')unsupported.push(effect);
      }
      if (!/this spell costs|spells? your opponents? cast/.test(t) && /spells?[^.]*cost(?:s)?[^.]*less to cast|spells?[^.]*cost(?:s)? \{\d+\} less|spells? you cast have (?:improvise|convoke)/.test(t)) {
        effects.push({...base, kind:'cost-reduction', outputMana:null, netMana:null, acceleration:!isLandFace, fixing:false, status:'conditional', requirements:unique([...base.requirements, /improvise/.test(t)?'Requires untapped artifacts and eligible nonartifact spells':/convoke/.test(t)?'Requires available creatures and eligible spells':'Requires eligible spells and payable costs'])});
      }
      if (/\b(?:double|twice|triple|additional)\b[^.]*\bmana\b/.test(t) && !add && !/spells?[^.]*cost/.test(t)) {
        const effect = {...base, kind:'mana-modifier', outputMana:null, netMana:null, acceleration:false, fixing:false, status:'unsupported', requirements:unique([...base.requirements,'Mana modification is not quantified by this parser'])};
        effects.push(effect); unsupported.push(effect);
      }
    }
  });
  const usable = effects.filter(e => e.status !== 'unsupported');
  const result = {isLand, landFlexibility:!isLand&&faces.some(f=>/\bLand\b/.test(f.type_line || '')), castManaValue, acceleration:usable.some(e=>e.acceleration), fixing:usable.some(e=>e.fixing),
    status:usable.some(e=>e.status==='supported')?'supported':usable.length?'conditional':unsupported.length?'unsupported':'none', effects, unsupported};
  if (c && typeof c === 'object') resourceMemo.set(c, result);
  return result;
}

/** Structured provider/consumer evidence for only the constraints we recognize. */
export function mtgEffectProfile(c) {
  if (c && typeof c === 'object' && effectMemo.has(c)) return effectMemo.get(c);
  const provides = [], needs = [], unsupported = [], selfEffects = [];
  const push = (list, tag, evidence, extra = {}) => list.push({tag, evidence, status:'supported', requirements:[], ...extra});
  facesOf(c).forEach((face, index) => {
    const faceName = face.name || c?.name || '', type = face.type_line || c?.type_line || '', text = String(face.oracle_text || '');
    const add = (list, tag, raw, extra = {}) => {
      const requirements = unique([...requirementsFor(raw, face, index, c), ...(extra.requirements || [])]);
      const conditional = index > 0 || sagaChapter(raw) || /\bif\b|\bwhenever\b|\bat the beginning\b|:|\bwhere x\b/i.test(raw) || extra.status === 'conditional';
      push(list, tag, raw, {face:faceName, status:conditional?'conditional':'supported', controller:'self', ...extra, requirements});
    };
    if (/\bArtifact\b/.test(type)) add(provides,'artifact','Card type — '+type);
    for (const raw of text.split('\n')) {
      const line = withoutReminder(raw), t = lower(line);
      if (!line) continue;
      // Life gain has a recipient and an event. Opponent replacement effects,
      // costs and reminder text do not provide our life-gain events.
      if (/\byou (?:may )?gain (?:\d+|x|that much|life equal to)[^.]*\blife\b|\byou (?:may )?gain life equal to\b/.test(t))
        add(provides,'lifegain',line,{status:'conditional',requirements:['Requires resolving the printed life-gain effect']});
      if (/\blifelink\b/.test(t) && !/(?:loses?|lose|without|doesn.t have|can.t (?:have|gain))[^.]*\blifelink\b/.test(t)) {
        const native=/^(?:[a-z -]+, )*lifelink(?:, [a-z -]+)*[.]?$/.test(t);
        const ownGrant=/(?:creatures? you control|this creature|this card|equipped creature|enchanted creature|target creature)[^.]*\b(?:has|have|gains?|gain)\b[^.]*\blifelink\b/.test(t) && !/opponent[^.]*\blifelink\b/.test(t);
        if(native||ownGrant)for(const tag of ['lifelink','lifegain'])add(provides,tag,line,{status:'conditional',requirements:[native?'Requires dealing damage with this source':'Requires an eligible creature receiving lifelink and dealing damage']});
      }
      if (/\bwhenever you gain life\b|\bif you gained (?:\d+ or more )?life\b/.test(t))add(needs,'lifegain',line,{status:'conditional'});
      if (/\bpopulate\b/.test(t)) {
        const extra = {status:'conditional', requirements:['Requires an existing creature token you control']};
        for (const tag of ['token','creature_token','fodder']) add(provides,tag,line,extra);
        add(needs,'creature_token',line,extra);
      }
      if (/\binvestigate\b/.test(t)) {
        for (const tag of ['token','artifact','noncreature_token']) add(provides,tag,line,{tokenType:'Clue'});
      }
      for (const match of line.matchAll(/\bcreates?\b([^.]*)/gi)) {
        const content = lower(match[1]), before = lower(line.slice(0, match.index));
        if (!/\btoken/.test(content)) continue;
        const recipient = creationController(before);
        if (recipient !== 'self') {
          unsupported.push({tag:'token', face:faceName, evidence:line, status:'unsupported', controller:recipient, requirements:['Token is not guaranteed to be under your control']});
          continue;
        }
        const creature = /\bcreature tokens?\b/.test(content), noncreature = /\b(treasure|clue|food|blood|map|powerstone|gold|shard) tokens?\b/.test(content);
        const variable = /\bx\b|copy|copies/.test(content), requirements=[];
        if (/charge counters?/.test(content)) requirements.push('Requires charge counters to create one or more tokens');
        if (/charge counters?/.test(content) && /-1\/-1 counters/.test(text)) requirements.push('Charge counters require -1/-1 counters to be put on a creature');
        if (/\bx\b/.test(content) && !requirements.length) requirements.push('Requires X to be greater than zero');
        if (/copy|copies/.test(content)) requirements.push('Requires an eligible object to copy');
        const extra = {status:variable?'conditional':undefined, requirements};
        // Do not overwrite the inferred status with undefined.
        if (!extra.status) delete extra.status;
        add(provides,'token',line,extra);
        if (creature) for (const tag of ['creature_token','fodder']) add(provides,tag,line,extra);
        else if (noncreature || /noncreature/.test(content)) add(provides,'noncreature_token',line,extra);
        if (noncreature || /artifact/.test(content)) add(provides,'artifact',line,extra);
      }
      if (/creature tokens? you control|creatures you control get \+|whenever (?:a|one or more) creature tokens?/.test(t)) add(needs,'creature_token',line);
      else if (/whenever (?:a|one or more) tokens?|tokens you control/.test(t)) add(needs,'token',line);
      if (/\bcreature\b/i.test(type) && /\bwhen\b[^.]* enters\b/.test(t) && !/when(?:ever)? (?:another|an?|one or more|a nontoken) (?:artifact|creature|permanent|token)/.test(t)) add(provides,'etb',line,{targetType:type});
      if (/\bexile\b/.test(t) && /\breturn\b[^.]*\b(?:to|onto) the battlefield/.test(t)) {
        const target = t.match(/exile (?:up to (?:one|two|\d+) )?target ([^,.]+)|exile (?:any number of|all|one or more) ([^,.]+)/);
        if (target && /creature|permanent|artifact|enchantment/.test(target[1] || target[2])) {
          const targetText = target[1] || target[2];
          if (/opponent controls/.test(targetText)) unsupported.push({tag:'blink',face:faceName,evidence:line,status:'unsupported',requirements:['Only targets an opponent\'s permanent']});
          else { add(provides,'blink',line,{target:'other',targetText}); add(needs,'etb',line,{target:'other',targetText}); }
        } else selfEffects.push({kind:'self-return',face:faceName,evidence:line,target:'self',status:'conditional',requirements:requirementsFor(line,face,index,c)});
      }
    }
  });
  const resources = mtgResourceProfile(c);
  for (const effect of resources.effects.filter(e=>e.acceleration && e.status!=='unsupported')) {
    push(provides,'ramp',effect.evidence,effect);
    if (effect.kind==='land-acceleration') push(provides,'extra_land',effect.evidence,effect);
  }
  const result = {provides,needs,unsupported,selfEffects,resources,typeLine:facesOf(c).map(f=>f.type_line || c?.type_line || '').join(' // '),manaCost:c?.mana_cost || c?.card_faces?.[0]?.mana_cost || ''};
  if (c && typeof c === 'object') effectMemo.set(c, result);
  return result;
}

// The graph and pair ranking use the same compatibility check and explanations.
export function mtgLinkEvidence(need, providerTags, payoffTags) {
  let providers = (providerTags?.effects?.provides || []).filter(e=>e.tag===need);
  const consumers = (payoffTags?.effects?.needs || []).filter(e=>e.tag===need);
  if (!providerTags?.provides?.has(need)) return {status:'unsupported',evidence:[],requirements:['No recognized provider']};
  if (need==='ramp' && providers.length) {
    const payoffType=lower(payoffTags?.effects?.typeLine).split(' // ')[0];
    providers=providers.filter(p=>{
      const t=lower(p.evidence);
      if (/spend this mana only to activate/.test(t)) return false;
      if (/spend this mana only to cast (?:a )?legendary/.test(t) && !/legendary/.test(payoffType)) return false;
      if (/^noncreature spells/.test(t) && /creature/.test(payoffType)) return false;
      if (/^creature spells/.test(t) && !/creature/.test(payoffType)) return false;
      if (/nonartifact spells you cast have improvise/.test(t) && /artifact/.test(payoffType)) return false;
      if (/spend this mana only to cast creature spells/.test(t) && !/creature/.test(payoffType)) return false;
      if (/spend this mana only to cast artifact spells/.test(t) && !/artifact/.test(payoffType)) return false;
      if (/can't be spent to cast a nonartifact spell/.test(t) && !/artifact/.test(payoffType)) return false;
      return true;
    });
    if (!providers.length) return {status:'unsupported',evidence:[],requirements:['The resource restriction does not cover this spell']};
  }
  // Alternative ways of providing the same thing are not all prerequisites. An
  // artifact's own type does not require making its conditional artifact tokens.
  if (providers.some(p=>p.status==='supported')) providers=providers.filter(p=>p.status==='supported');
  if (need==='etb' && consumers.length && providers.length) {
    const valid = providers.some(p=>consumers.some(n=>{
      const type=lower(p.targetType), target=lower(n.targetText);
      return (!/nonartifact/.test(target)||!/artifact/.test(type)) && (!/nonenchantment/.test(target)||!/enchantment/.test(type)) && (!/\bartifact\b/.test(target)||/artifact/.test(type)||/or/.test(target)) && (!/\benchantment\b/.test(target)||/enchantment/.test(type)||/or/.test(target));
    }));
    if (!valid) return {status:'unsupported',evidence:[...providers,...consumers].map(e=>e.evidence),requirements:['The blink target restriction does not match this permanent']};
  }
  const conditional = (providers.length && providers.every(e=>e.status==='conditional')) || consumers.some(e=>e.status==='conditional');
  return {status:conditional?'conditional':providers.length && consumers.length?'supported':'inferred', evidence:unique([...providers,...consumers].map(e=>e.evidence)), requirements:unique([...providers,...consumers].flatMap(e=>e.requirements || []))};
}

// Coexistence warnings, not blanket bans: sequencing/removing a blocker can
// restore the route. Only these printed restrictions are modeled here.
export function mtgSelfConflicts(cards=[]) {
  const rows=[...new Map(cards.filter(Boolean).map(c=>[c.name,c])).values()],out=[];
  const text=c=>facesOf(c).map(f=>withoutReminder(f.oracle_text)).join('\n').toLowerCase().replace(/[’‘]/g,"'");
  for(const blocker of rows){
    const t=text(blocker),enter=/creatures entering(?: the battlefield)?(?: or dying)? don't cause abilities[^.]*trigger/.test(t),
      life=/\b(?:players|you) can't gain life\b/.test(t),pay=/players can't pay life/.test(t);
    // No recognized restriction means no pair can emit a conflict.
    if(!enter&&!life&&!pay)continue;
    for(const provider of rows){
      const p=text(provider),effects=mtgEffectProfile(provider).provides;
      if(enter&&/(?:when|whenever) [^\n,.]*\benters?\b/.test(p)&&(/\bcreature\b/i.test(provider.type_line||'')||/\bcreature[^\n,.]*\benters?\b/.test(p)))
        out.push({blocker:blocker.name,provider:provider.name,kind:'creature-enter-trigger',status:'conditional',reason:`${blocker.name} suppresses creature-entering triggers while present; ${provider.name}'s affected route needs sequencing or removal of the blocker.`});
      if(life&&effects.some(e=>e.tag==='lifegain'))out.push({blocker:blocker.name,provider:provider.name,kind:'life-gain',status:'conditional',reason:`${blocker.name} prevents your life gain while present.`});
      if(pay&&/(?:pay \d+ life[^:]*:|^[^:\n]*\bpay \d+ life\b[^:\n]*:)/m.test(p))out.push({blocker:blocker.name,provider:provider.name,kind:'life-payment',status:'conditional',reason:`${blocker.name} prevents paying life to activate ${provider.name}'s affected ability while present.`});
    }
  }
  return out;
}
