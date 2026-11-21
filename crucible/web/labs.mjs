// The Lab switches of the test page, as engine config. Shared by the page (app.mjs) and by the tool that
// writes saved games for the click bot (tools/crucible/make-saves.mjs), so the two can never drift apart.
import { FEAT_GIFTS, LONG_GIFTS } from '../engine/meta.mjs';
import { LINK_GIFTS } from '../engine/relics.mjs';

export const LAB_POOL = ['tomb_ledger', 'grave_call', 'second_burial', 'bone_tithe', 'deep_grave', 'last_rites', 'static_field', 'overcharge', 'chain_lightning', 'thorn_veil', 'long_watch', 'deep_shade', 'spite', 'false_floor', 'ossuary', 'grave_ward', 'grounding_rod', 'snare', 'banked_coals', 'cinder_fall', 'quench'];
// Equips that differ (switch `equips`): what a fitted Equip adds on and off its kind, and the two shapes, as [ATK, DEF].
export const EQUIP_KINDS = { fit: 800, off: 300, edge: [800, 0], ward: [0, 1000] };
export const LAB_DEFAULTS = { five: true, lean: true, heat: true, kits: true, items: true };

// The order the home screen shows the switches in. A switch with words in the page but no place here is shown last,
// so a new switch can never be left off the screen (Equips that differ and Two builds a run were, in Versions 30 and 31).
export const LAB_ORDER = ['depth', 'equips', 'builds', 'trap', 'five', 'lean', 'heat', 'allHeat', 'kits', 'items', 'early', 'long', 'links', 'lone', 'veilSet', 'styles', 'free', 'solo', 'tombStart'];
// The depth set (switch `depth`): the three strategy pieces measured together.
export const DEPTH_SET = ['equips', 'builds', 'trap'];

export function labConfig(labs0) {
  const labs = labs0.depth ? { ...labs0, ...Object.fromEntries(DEPTH_SET.map(k => [k, true])) } : labs0;
  return {
    freeCast: labs.free ? 1 : labs.lone ? 'lone' : labs.trap ? 'trap' : 0, freeCastRival: !labs.free && (labs.lone || labs.trap) ? 'boss' : null,
    rivalStyles: labs.styles ? 1 : 0, soloArrival: labs.solo ? 1 : 0,
    labPool: (labs.five ? LAB_POOL : FEAT_GIFTS).concat(labs.long ? LONG_GIFTS : []).concat(labs.links ? LINK_GIFTS : []), leanOffers: labs.lean ? (labs.links ? 2 : 1) : 0, giftRerolls: labs.lean ? 1 : 0,
    giftXpScale: labs.five ? 2 : 0, bossAces: labs.five ? 1 : 0, endTurns: labs.five ? 6 : 0,
    bossBand: labs.five ? [0, 0, -300] : null, rivalBand: labs.five ? [0, -200, -400] : 0,
    bossBandBy: labs.five ? { kiln_warden: -350 } : null, giftFirstXp: labs.early ? 10 : 0,
    heatRules: labs.heat ? 1 : 0, kitTune: labs.kits ? 1 : 0, itemTune: labs.items ? 1 : 0, forgerTune: labs.veilSet ? { veilSet: 2 } : null,
    equipKinds: labs.equips ? EQUIP_KINDS : null,
    runBuilds: labs.builds ? 2 : 0,
    kitTraps: labs.trap ? 2 : 0, // Free Trap also puts two Traps in every kit: with about one Trap a kit the free set was used once in two duels
    testRelics: labs.tombStart ? ['tomb_ledger', 'grave_call', 'second_burial'] : null,
  };
}
