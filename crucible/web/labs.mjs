// The Lab switches of the test page, as engine config. Shared by the page (app.mjs) and by the tool that
// writes saved games for the click bot (tools/crucible/make-saves.mjs), so the two can never drift apart.
import { FEAT_GIFTS, LONG_GIFTS } from '../engine/meta.mjs';
import { LINK_GIFTS } from '../engine/relics.mjs';

export const LAB_POOL = ['tomb_ledger', 'grave_call', 'second_burial', 'bone_tithe', 'deep_grave', 'last_rites', 'static_field', 'overcharge', 'chain_lightning', 'thorn_veil', 'long_watch', 'deep_shade', 'spite', 'false_floor', 'ossuary', 'grave_ward', 'grounding_rod', 'snare', 'banked_coals', 'cinder_fall', 'quench'];
export const LAB_DEFAULTS = { five: true, lean: true, heat: true, kits: true, items: true };

export function labConfig(labs) {
  return {
    freeCast: labs.free ? 1 : labs.lone ? 'lone' : labs.trap ? 'trap' : 0, freeCastRival: !labs.free && (labs.lone || labs.trap) ? 'boss' : null,
    rivalStyles: labs.styles ? 1 : 0, soloArrival: labs.solo ? 1 : 0,
    labPool: (labs.five ? LAB_POOL : FEAT_GIFTS).concat(labs.long ? LONG_GIFTS : []).concat(labs.links ? LINK_GIFTS : []), leanOffers: labs.lean ? (labs.links ? 2 : 1) : 0, giftRerolls: labs.lean ? 1 : 0,
    giftXpScale: labs.five ? 2 : 0, bossAces: labs.five ? 1 : 0, endTurns: labs.five ? 6 : 0,
    bossBand: labs.five ? [0, 0, -300] : null, rivalBand: labs.five ? [0, -200, -400] : 0,
    heatRules: labs.heat ? 1 : 0, kitTune: labs.kits ? 1 : 0, itemTune: labs.items ? 1 : 0, forgerTune: labs.veilSet ? { veilSet: 2 } : null,
    testRelics: labs.tombStart ? ['tomb_ledger', 'grave_call', 'second_burial'] : null,
  };
}
