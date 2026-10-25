// Bounded Smart-mode response proof for the pinned shipped runtime. This is not
// an assertion that its AI recommendations exhaust legal actions. Unknown rule
// carriers stop. It reads own hand/public objects only, never library identities.
const RUNTIME='a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee';
const STATE_FIELDS=new Set('activated_abilities_this_game activated_abilities_this_turn active_interaction_slots active_player all_creature_types allows_cancel_cast alt_cost_grant_permissions_used attacked_defenders_last_turn attacked_defenders_this_turn attacker_declarations_this_turn attacking_creatures_this_turn attribution battlefield battlefield_entries_this_turn cancelled_casts cards_discarded_this_turn_by_player cards_drawn_this_turn combat combat_phase_skip_next_turn command_zone commander_cast_count commander_cast_owners commander_damage creature_attacked_defenders_this_turn creature_blocked_attackers_this_turn creatures_attacked_this_turn creatures_blocked_this_turn crew_activated_this_turn crew_resolved_this_turn current_combat_attacker_restriction current_combat_attacker_restriction_source current_starting_player damage_dealt_this_turn day_night debug_mode debug_permitted deck_pools delayed_triggers eliminated_players exerted_this_turn exile exile_cast_permissions_used exile_links exile_play_permissions_used exile_play_single_use_consumed extra_loyalty_activations_this_turn extra_phase_resume extra_phases extra_turn_sequence_anchor extra_turns first_card_drawn_this_turn format_config game_number graveyard_cast_permissions_used graveyard_cast_permissions_used_per_type hand_cast_free_permissions_used has_pending_cast interaction_session_id lands_played_this_turn lands_played_this_turn_by_player last_effect_amount last_effect_count last_vote_ballots loop_detection lki_by_incarnation lki_cache lki_copiable_values lki_copiable_values_by_incarnation loyalty_abilities_activated_this_turn mana_spent_on_spells_this_turn match_config match_phase match_score max_lands_per_turn modal_modes_chosen_this_game modal_modes_chosen_this_turn next_continuous_effect_id next_delayed_trigger_instance next_delayed_trigger_token next_end_effect_group_id next_extra_phase_id next_game_chooser next_interaction_serial next_logical_zone_change_group_id next_object_id next_pip_id next_resolution_cast_offer_id next_resolve_all_consent_epoch next_return_result_occurrence_id next_spell_announcement next_timestamp next_tracked_set_id object_tap_count_this_turn objects objects_that_dealt_damage pending_replacement pending_trigger phase player_actions_this_turn players players_attacked_this_step players_attacked_this_turn players_who_created_token_this_turn players_who_discarded_card_this_turn players_who_sacrificed_artifact_this_turn players_who_searched_library_this_turn priority_pass_count priority_passes priority_player public_revealed_cards resolution_frames resolution_state_version resolved_rules_journal revealed_cards ring_bearer ring_level rng_seed rng_word_pos scheduled_turn_controls seat_order sideboard_submitted spells_cast_last_turn spells_cast_this_game spells_cast_this_game_by_player spells_cast_this_turn spells_cast_this_turn_by_player stack stack_paid_facts steps_started_this_turn steps_to_skip top_of_library_cast_permissions_used tracked_object_sets transient_continuous_effects triggered_abilities_added_mana_this_turn triggers_fired_this_game triggers_fired_this_turn triggers_fired_this_turn_per_opponent turn_direction turn_number turns_to_skip viewer_projection waiting_for wire_projection zone_changes_this_turn'.split(' '));
const PLAYER_FIELDS=new Set('attraction_deck bending_types_this_turn can_look_at_top_of_library cards_drawn_this_step cards_drawn_this_turn commander_color_identity contraption_crank_sprocket contraption_deck crimes_committed_this_turn descended_this_turn drew_from_empty_library energy graveyard hand has_drawn_this_turn id is_eliminated lands_played_this_turn library life life_gained_this_turn life_lost_last_turn life_lost_this_turn mana_pool poison_counters speed_trigger_used_this_turn status turns_taken'.split(' '));
const STATIC_FIELDS=new Set('mode affected modifications condition affected_zone effect_zone active_zones characteristic_defining description'.split(' '));
const PASSIVE_KEYWORDS=new Set(['Flying','Reach','FirstStrike','DoubleStrike','Deathtouch','Trample','Lifelink','Vigilance','Menace','Haste','Defender','Indestructible','Hexproof','Shroud','Protection','Ward','Fear','Intimidate','Horsemanship','Shadow','Unblockable']);
const OBJECT_FIELDS=new Set('summoning_sick has_summoning_sickness is_commander commander_tax is_token display_source cast_from_zone cast_occurrence spell_announcement cast_controller cast_spell_keywords mana_spent_to_cast colors_spent_to_cast mana_spent_to_cast_amount phyrexian_life_paid mana_spent_source_snapshots mana_spent_to_activate phase_status blocked_abilities layer_base_power layer_base_toughness base_static_definitions base_trigger_definitions abilities attached_to attachments available_mana_pips base_abilities base_card_types base_characteristics_initialized base_color base_controller base_keywords base_mana_cost base_name base_power base_printed_ref base_toughness card_id card_types color controller counters damage_marked dealt_deathtouch_damage display_visible_to_viewer entered_battlefield_turn face_down flipped has_mana_ability id incarnation keywords loyalty mana_ability_index mana_cost name owner played_from_zone power printed_ref replacement_definitions static_definitions tapped timestamp toughness transformed trigger_definitions zone'.split(' '));
const empty=x=>Array.isArray(x)&&x.length===0;
const passiveStatics=rows=>Array.isArray(rows)&&rows.every(row=>{
 const d=row?.definition??row;
 if(!d||Object.keys(d).some(k=>!STATIC_FIELDS.has(k)))return false;
 if(d?.mode&&typeof d.mode==='object'&&Object.keys(d.mode).length===1&&d.mode.ModifyCost&&empty(d.modifications))return true;
 return d?.mode==='Continuous'&&Array.isArray(d.modifications)&&d.modifications.every(m=>{
  if(['SetPower','SetToughness','ModifyPower','ModifyToughness','SetDynamicPower','SetDynamicToughness','AssignDamageFromToughness'].includes(m?.type))return true;
  // Combat/crew calculation changes do not grant a response action. Keep this
  // exact: other AddStaticMode values can change casting permissions.
  const crew=m?.mode?.CrewContribution;
  return m?.type==='AddStaticMode'&&Object.keys(m.mode||{}).length===1&&crew?.kind==='ToughnessInsteadOfPower'&&Array.isArray(crew.actions)&&crew.actions.length>0&&crew.actions.every(a=>['Crew','Station'].includes(a))&&Object.keys(crew).every(k=>['kind','actions'].includes(k));
 });
});
const pureMana=a=>a?.kind==='Activated'&&a.is_mana_ability===true&&a.effect?.type==='Mana'&&!a.sub_ability&&!a.else_ability&&['Tap','Mana'].includes(a.cost?.type);
function objectSafe(o,seat,zone){
 if(!o||o.zone!==zone||o.display_visible_to_viewer!==true||o.face_down!==false||o.transformed===true||o.flipped===true)return false;
 if(Object.keys(o).some(k=>!OBJECT_FIELDS.has(k)))return false;
 if(!Array.isArray(o.keywords)||o.keywords.some(k=>!PASSIVE_KEYWORDS.has(typeof k==='string'?k:k?.type)))return false;
 if(!Array.isArray(o.abilities)||!Array.isArray(o.trigger_definitions)||o.trigger_definitions.some(t=>(t?.definition??t)?.mode!=='ChangesZone')||!empty(o.replacement_definitions)||!passiveStatics(o.static_definitions))return false;
 const owned=o.controller===seat||o.owner===seat;
 for(const a of o.abilities){
  if(a?.kind!=='Activated')return false;
  const activationZone=a.activation_zone??'Battlefield';
  if(activationZone!==zone)continue;
  if((o.controller===seat||zone!=='Battlefield'&&o.owner===seat||a.activator_filter!=null)&&!pureMana(a))return false;
 }
 // Hand/command casts need priority outside our own main phase only for an
 // instant, flash, or a special permission. All such carriers are excluded.
 if(owned&&(zone==='Hand'||zone==='Command')){
  const types=o.card_types?.core_types;
  if(!Array.isArray(types)||!types.length||types.some(t=>!['Creature','Land','Artifact','Enchantment','Planeswalker','Sorcery','Battle','Kindred','Tribal'].includes(t)))return false;
 }
 return true;
}
export function shippedResponseAbsent(state,seat=0,{allowMain=false}={}){
 if(!state||Object.keys(state).some(k=>!STATE_FIELDS.has(k)))return false;
 if(seat!==0||state?.viewer_projection!==seat||state?.waiting_for?.type!=='Priority'||state.waiting_for.data?.player!==seat||state.priority_player!==seat)return false;
 if(!Array.isArray(state.players)||state.players.length!==2||![0,1].includes(state.active_player)||!['Standard','Commander'].includes(state.format_config?.format)||state.format_config.team_based!==false)return false;
 if(state.turn_decision_controller!=null||state.active_casting_permission_index!=null||state.has_pending_cast!==false||state.pending_trigger!=null||state.pending_replacement!=null||state.resolution_frames!=null)return false;
 if(!empty(state.transient_continuous_effects)||!empty(state.scheduled_turn_controls)||!empty(state.delayed_triggers))return false;
 if(!Array.isArray(state.stack))return false;
 // Keep our main phase for land/sorcery actions. With a spell on the stack,
 // only responses are possible and the same bounded proof applies.
 if(!allowMain&&state.active_player===seat&&['PreCombatMain','PostCombatMain'].includes(state.phase)&&state.stack.length===0)return false;
 if(state.players.some(p=>!p||Object.keys(p).some(k=>!PLAYER_FIELDS.has(k))))return false;
 const p=state.players[seat];
 if(p?.status?.type!=='Active'||p.can_look_at_top_of_library!==false||!empty(p.attraction_deck)||!empty(p.contraption_deck)||!empty(p.mana_pool?.mana))return false;
 if(!Array.isArray(p.hand)||!Array.isArray(state.battlefield)||!Array.isArray(state.command_zone)||!Array.isArray(state.exile)||!state.objects)return false;
 // Never iterate the object map: private-zone stubs need not be read at all.
 for(const id of p.hand)if(!objectSafe(state.objects[id],seat,'Hand'))return false;
 for(const [ids,zone]of [[state.battlefield,'Battlefield'],[state.command_zone,'Command'],[state.exile,'Exile'],...state.players.map(p=>[p.graveyard,'Graveyard'])]){
  if(!Array.isArray(ids))return false;
  for(const id of ids)if(!objectSafe(state.objects[id],seat,zone))return false;
 }
 return true;
}
export function readShippedResponseProof(engine,seat,runtimeIdentity){
 if(runtimeIdentity!==RUNTIME||typeof engine?.preview_action_js!=='function')return null;
 try{
  const state=engine.get_filtered_game_state(seat)?.state;
  if(seat===0&&state?.active_player===seat&&state.waiting_for?.type==='DeclareAttackers'){
   const interaction=engine.get_viewer_snapshot_js?.(seat)?.viewerInteraction;
   if(!interaction?.canSubmit||!interaction.authorizedSubmitters?.includes(seat)||!Array.isArray(state.battlefield))return null;
   for(const id of state.battlefield){const o=state.objects?.[id];if(!o||o.display_visible_to_viewer!==true)return null;if(o.controller!==seat)continue;
    if(!Array.isArray(o.card_types?.core_types)||!Array.isArray(o.keywords))return null;
    if(o.card_types.core_types.includes('Creature')&&!o.tapped&&!(o.has_summoning_sickness===true&&!o.keywords.some(k=>(typeof k==='string'?k:k?.type)==='Haste')))return null;
   }
   if(engine.preview_action_js(seat,{type:'DeclareAttackers',data:{attacks:[],bands:[]}})?.status!=='applied')return null;
   return {version:1,status:'no-attackers',source:'shipped-response-v1',actor:seat,priorityHolder:seat,floatingMana:false,passVerified:true};
  }
  if(!shippedResponseAbsent(state,seat,{allowMain:true}))return null;
  if(state.active_player===seat&&['PreCombatMain','PostCombatMain'].includes(state.phase)&&state.stack.length===0){
   // Only advance an exhausted main phase. With any usable mana source, leave
   // payment planning to the player. This avoids treating auto-pay search as
   // an exhaustive proof of all possible manual mana combinations.
   for(const id of state.battlefield){const o=state.objects[id];if(o.controller!==seat||o.tapped)continue;
    if(o.card_types?.core_types?.includes('Creature')&&o.has_summoning_sickness===true&&!o.keywords.some(k=>(typeof k==='string'?k:k?.type)==='Haste'))continue;
    if(o.abilities.some(a=>a.kind==='Activated'))return null;
   }
   for(const id of [...state.players[seat].hand,...state.command_zone.filter(id=>state.objects[id].owner===seat)]){
    const o=state.objects[id];
    // Targeted spells need a separate complete target search. Restrict this
    // exhausted-main proof to ordinary creature casts and land plays.
    if(!o.card_types.core_types.some(t=>t==='Creature'||t==='Land'))return null;
    const action=o.card_types.core_types.includes('Land')?{type:'PlayLand',data:{object_id:id,card_id:id}}:{type:'CastSpell',data:{object_id:id,card_id:id,targets:[],payment_mode:{type:'Auto'}}};
    // The object guard above excludes alternate actions and permissions. Every
    // remaining hand/commander action must be explicitly rejected by the reducer.
    if(engine.preview_action_js(seat,action)?.status!=='rejected')return null;
   }
  }
  // Preview is a disposable reducer clone; never submit-and-restore here.
  if(engine.preview_action_js(seat,{type:'PassPriority'})?.status!=='applied')return null;
  return {version:1,status:'no-response',source:'shipped-response-v1',actor:seat,priorityHolder:seat,floatingMana:false,passVerified:true};
 }catch{return null;}
}
