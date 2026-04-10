const gameData={events:[],story_events:[],survivors:[],buildings:[],config:null,locationTemplates:[],hostiles:[],zones:[],items:[],dogs:[],threats:[],names:{},npcs:[]};
let groupActionSequence=0;
let selectedGameMode='normal';
const state={day:1,food:0,materials:0,stability:5,meds:1,fuel:3,electricity:0,chickens:0,gameMode:'normal',unlocked:{meds:true,electricity:false},electricityCapacity:0,electricityUsed:0,vallaElectrica:false,baseUpgrades:{electric_fence:false,auto_irrigation:false,biodiesel:false},activeThreats:[],threatCooldowns:{},buildingDisableTimers:{},_oneDayOutputMods:[],attackThreat:false,attackHostileType:"raiders",attackHostileVariant:"random",attackHostileLabel:"Raiders",attackHostileIcon:"💀 ",attackHostileNpc:false,attackHostileNpcEventId:null,attackStrength:3,attackArrivalDay:0,attackEffectVictory:[],attackEffectDefeat:[],attackPopupVictory:null,attackPopupDefeat:null,pendingEvent:null,eventDaysLeft:0,eventTotalDays:1,_activeMultiDayEvent:null,_lastDayActions:{},seenEvents:new Set(),cemetery:[],actionXP:{},inventory:[],dog:null,locations:[],activeZone:null,camp:{food:0,materials:0,meds:0,fuel:0},_processingDay:false,survivors:[],buildings:{},delayedQueue:[],actionLimits:{},_queuedEventSchemas:[],log:[],currentDetail:null,_pendingTreatmentQueue:null,_currentTreatmentSurvivorId:null,eventSchedule:{},baseUpgradeProjects:{},technicalLog:[],departureQueue:[],graveWarningQueue:[],_deferStartOfDayEvent:false,_pendingChickenSacrifice:null,_foodPhaseStarted:false,relationships:{},_relationshipProgressDay:0,_gameInitialized:false,npcs:[]};
const dataLoadState={errors:[],loaded:[]};

window.gameData=gameData;
window.state=state;
window.dataLoadState=dataLoadState;

let activeMapTab='base';
window.activeMapTab=activeMapTab;



function deepCloneNpc(value){
 try{return JSON.parse(JSON.stringify(value));}catch(_err){return null;}
}
function normalizeNpcStateList(list){
 return (Array.isArray(list)?list:[]).map(npc=>{
  const clone=deepCloneNpc(npc)||{};
  clone.id=String(clone.id||'').trim();
  clone.name=String(clone.name||clone.label||clone.id||'NPC').trim();
  clone.portrait=String(clone.portrait||clone.image||'').trim();
  clone.image=clone.portrait||String(clone.image||'').trim();
  clone.buildingId=String(clone.assignedBuilding||clone.buildingId||'').trim();
  clone.assignedBuilding=clone.buildingId;
  clone.state=String(clone.state||'known').trim().toLowerCase();
  clone.trust=Math.max(-1, Math.min(2, Number(clone.trust||0)||0));
  if(clone.trustLevels && typeof clone.trustLevels==='object' && !Array.isArray(clone.trustLevels)) clone.trustLevels=Object.assign({}, clone.trustLevels);
  else clone.trustLevels={};
  clone.trustEventTable=Array.isArray(clone.trustEventTable)?clone.trustEventTable.map(row=>({min:Number(row?.min??0)||0,max:Number(row?.max??0)||0,eventId:String(row?.eventId||'').trim()})).filter(row=>row.eventId):[];
  return clone;
 }).filter(npc=>npc.id);
}
function getNpcStateList(){
 if(!Array.isArray(state.npcs)) state.npcs=[];
 return state.npcs;
}
function getNpcById(npcId){
 const clean=String(npcId||'').trim();
 if(!clean) return null;
 return getNpcStateList().find(npc=>String(npc.id||'')===clean)||null;
}
function getNpcsForBuilding(buildingId){
 const clean=String(buildingId||'').trim();
 if(!clean) return [];
 const allowedStates=new Set(['available','recruited']);
 return getNpcStateList().filter(npc=>{
  if(String(npc.assignedBuilding||npc.buildingId||'').trim()!==clean) return false;
  const stateName=String(npc.state||'').toLowerCase();
  return allowedStates.has(stateName);
 });
}
function getRecruitedNpcs(){
 return getNpcStateList().filter(npc=>String(npc.state||'').toLowerCase()==='recruited');
}
function clampNpcTrustValue(value){
 return Math.max(-1, Math.min(2, Number(value||0)||0));
}
function setNpcTrust(npc, value){
 if(!npc) return 0;
 npc.trust=clampNpcTrustValue(value);
 return npc.trust;
}
function modifyNpcTrust(npcId, amount){
 const npc=getNpcById(npcId);
 if(!npc) return null;
 const before=Number(npc.trust||0)||0;
 const after=setNpcTrust(npc, before + (Number(amount||0)||0));
 return {npc,before,after};
}
function setNpcStateValue(npcId, nextState){
 const npc=getNpcById(npcId);
 if(!npc) return null;
 npc.state=String(nextState||'known').trim().toLowerCase()||'known';
 return npc;
}
function assignNpcToBuildingState(npcId, buildingId){
 const npc=getNpcById(npcId);
 if(!npc) return null;
 npc.assignedBuilding=String(buildingId||'').trim();
 npc.buildingId=npc.assignedBuilding;
 return npc;
}
function getNpcInteractionEventId(npc){
 if(!npc) return '';
 const trust=clampNpcTrustValue(npc.trust);
 if(npc.trustLevels && typeof npc.trustLevels==='object' && !Array.isArray(npc.trustLevels)){
  const exact=npc.trustLevels[String(trust)]||npc.trustLevels[trust];
  if(exact) return String(exact).trim();
 }
 const rows=Array.isArray(npc.trustEventTable)?npc.trustEventTable:[];
 const match=rows.find(row=>trust>=Number(row.min||0) && trust<=Number(row.max||0) && row.eventId);
 return match?String(match.eventId).trim():'';
}
function launchNpcInteraction(npcId){
 const npc=getNpcById(npcId);
 if(!npc) return false;
 if(Number(npc._usedInteractionDay||0)===Number(state.day||0)){
  if(typeof addLog==='function') addLog(`ℹ ${npc.name} ya ha actuado hoy.`);
  return false;
 }
 const eventId=getNpcInteractionEventId(npc);
 if(!eventId){ if(typeof addLog==='function') addLog(`ℹ ${npc.name} no tiene ningún evento para confianza ${npc.trust}.`); return false; }
 if(state.pendingEvent && !state.pendingEvent._multiDayPassive){ if(typeof addLog==='function') addLog(`ℹ Resuelve primero el evento actual antes de hablar con ${npc.name}.`); return false; }
 const schema=[...(gameData.events||[]), ...(gameData.story_events||[])].find(e=>e&&e.id===eventId);
 if(!schema){ if(typeof addLog==='function') addLog(`❌ No existe el evento ${eventId} para ${npc.name}.`); return false; }
 if(schema.condition && typeof evaluateCondition==='function' && !evaluateCondition(schema.condition)){
  if(typeof addLog==='function') addLog(`ℹ ${npc.name} aún no cumple los requisitos para este evento.`);
  return false;
 }
 if(typeof buildAndSetEvent==='function'){
  const ok=buildAndSetEvent(schema);
  if(ok && state.pendingEvent){
   state.pendingEvent._npcInteractionId=npc.id;
   state.pendingEvent._npcName=npc.name;
  }
  if(ok && typeof render==='function') render();
  return !!ok;
 }
 if(typeof queueEventById==='function'){
  const queued=queueEventById(eventId);
  if(queued && typeof consumeQueuedPriorityEvent==='function') consumeQueuedPriorityEvent();
  if(queued && typeof render==='function') render();
  return !!queued;
 }
 return false;
}
function applyNpcNoFoodConsequence(npc){
 if(!npc) return;
 const before=Number(npc.trust||0)||0;
 const after=setNpcTrust(npc, before-1);
 if(typeof addLog==='function'){
  addLog(`🍽 ${npc.name} no ha comido hoy. Confianza ${after>before?'+':''}${after-before}.`);
 }
}
window.normalizeNpcStateList=normalizeNpcStateList;
window.getNpcStateList=getNpcStateList;
window.getNpcById=getNpcById;
window.getNpcsForBuilding=getNpcsForBuilding;
window.getRecruitedNpcs=getRecruitedNpcs;
window.modifyNpcTrust=modifyNpcTrust;
window.setNpcStateValue=setNpcStateValue;
window.assignNpcToBuildingState=assignNpcToBuildingState;
window.getNpcInteractionEventId=getNpcInteractionEventId;
window.launchNpcInteraction=launchNpcInteraction;
window.applyNpcNoFoodConsequence=applyNpcNoFoodConsequence;
