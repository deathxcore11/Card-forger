// Bounded announcement, independent of the AI's nonexhaustive candidate list.
import {fail} from './protocol-fault.mjs';
export function humanCommand(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==3||value.kind!=='cast'||!Number.isSafeInteger(value.instanceId)||value.instanceId<1||!['auto','manual'].includes(value.payment))fail('BAD_HUMAN_COMMAND');
 return {kind:'cast',instanceId:value.instanceId,payment:value.payment};
}
export function submitHumanCommand(engine,value){
 const command=humanCommand(value),state=engine.get_filtered_game_state(0).state;
 const object=state.objects?.[command.instanceId];
 if(!state.players?.[0]?.hand?.includes(command.instanceId)||object?.zone!=='Hand'||object.controller!==0||object.display_visible_to_viewer!==true||object.face_down)return false;
 const result=engine.submit_action(0,{type:'CastSpell',data:{object_id:command.instanceId,card_id:command.instanceId,targets:[],payment_mode:{type:command.payment==='auto'?'Auto':'Manual'}}});
 if(['applied','Applied'].includes(result.status))return true;
 if(['rejected','Rejected'].includes(result.status))return false;
 fail('INVALID_ENGINE_RESPONSE');
}
