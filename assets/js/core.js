const gameData={events:[],story_events:[],survivors:[],buildings:[],config:null,locationTemplates:[],hostiles:[],zones:[],loot:{},items:[],dogs:[],threats:[],names:{},npcs:[],baseUpgrades:[]};
let groupActionSequence=0;
let selectedGameMode='normal';
const state={day:1,food:0,materials:0,stability:5,meds:1,fuel:3,electricity:0,chickens:0,gameMode:'normal',unlocked:{meds:true,electricity:false},electricityCapacity:0,electricityUsed:0,vallaElectrica:false,baseUpgrades:{electric_fence:false,auto_irrigation:false,biodiesel:false},activeThreats:[],threatCooldowns:{},buildingDisableTimers:{},_oneDayOutputMods:[],attackThreat:false,attackHostileType:"raiders",attackHostileVariant:"random",attackHostileLabel:"Raiders",attackHostileIcon:"ðŸ’€ ",attackHostileNpc:false,attackHostileNpcEventId:null,attackStrength:3,attackArrivalDay:0,attackEffectVictory:[],attackEffectDefeat:[],attackPopupVictory:null,attackPopupDefeat:null,pendingEvent:null,eventDaysLeft:0,eventTotalDays:1,_activeMultiDayEvent:null,_lastDayActions:{},seenEvents:new Set(),cemetery:[],actionXP:{},inventory:[],junk:[],dog:null,locations:[],activeZone:null,discoveredZones:{},camp:{food:0,materials:0,meds:0,fuel:0},values:{},restEffects:{moraleChanceBonus:0,moraleAmount:1,injuryRollBonus:0},npcContinuousEffects:{},_processingDay:false,survivors:[],buildings:{},delayedQueue:[],actionLimits:{},_queuedEventSchemas:[],log:[],currentDetail:null,_pendingTreatmentQueue:null,_currentTreatmentSurvivorId:null,eventSchedule:{},baseUpgradeProjects:{},technicalLog:[],departureQueue:[],graveWarningQueue:[],_deferStartOfDayEvent:false,_pendingChickenSacrifice:null,_foodPhaseStarted:false,relationships:{},_relationshipProgressDay:0,_gameInitialized:false,npcs:{}};
const dataLoadState={errors:[],loaded:[]};

window.gameData=gameData;
window.state=state;
window.dataLoadState=dataLoadState;

let activeMapTab='base';
window.activeMapTab=activeMapTab;



function normalizeNpcStateValue(value){
 const clean=String(value||'available').trim().toLowerCase();
 if(['known','available','recruited','gone','hostile','assigned'].includes(clean)) return clean==='assigned' ? 'recruited' : clean;
 return 'available';
}
function cloneNpcData(def){
 if(!def||typeof def!=='object') return null;
 return JSON.parse(JSON.stringify(def));
}
function getNpcDefs(){
 return Array.isArray(gameData.npcs)?gameData.npcs:[];
}
function ensureNpcRuntimeState(){
 if(!state.npcs||typeof state.npcs!=='object') state.npcs={};
 getNpcDefs().forEach(def=>{
  const id=String(def?.id||'').trim();
  if(!id) return;
  if(!state.npcs[id]){
   state.npcs[id]={
    id,
    state: normalizeNpcStateValue(def.state||'available'),
    trust: Number(def.trust||0)||0,
    buildingId: null,
    assignedBuilding: null,
    lastInteractionDay: null
   };
  }
 });
 return state.npcs;
}
function getNpcDefById(id){
 const clean=String(id||'').trim();
 if(!clean) return null;
 return getNpcDefs().find(n=>String(n?.id||'').trim()===clean)||null;
}
function getNpcStateEntry(id){
 const clean=String(id||'').trim();
 if(!clean) return null;
 ensureNpcRuntimeState();
 return state.npcs[clean]||null;
}
function getNpcById(id){
 const def=getNpcDefById(id);
 if(!def) return null;
 const runtime=getNpcStateEntry(id)||{};
 return Object.assign({}, cloneNpcData(def)||{}, runtime, {
  id:String(def.id||id).trim(),
  name:def.name||runtime.name||id,
  portrait:def.portrait||def.image||runtime.portrait||runtime.image||'',
  trust:Number(runtime.trust ?? def.trust ?? 0)||0,
  buildingId:String(runtime.buildingId||runtime.assignedBuilding||'').trim()||null,
  state:normalizeNpcStateValue(runtime.state||def.state||'available'),
  _usedToday: hasNpcActedToday(id)
 });
}
function getBuildingNpcList(buildingId){
 const clean=String(buildingId||'').trim();
 if(!clean) return [];
 ensureNpcRuntimeState();
 return getNpcDefs().map(def=>getNpcById(def.id)).filter(npc=>npc && npc.buildingId===clean && ['available','recruited'].includes(npc.state));
}
function getNpcsForBuilding(buildingId){
 return getBuildingNpcList(buildingId);
}
function ensureNpcContinuousEffectState(){
 if(!state.npcContinuousEffects || typeof state.npcContinuousEffects!=='object' || Array.isArray(state.npcContinuousEffects)) state.npcContinuousEffects={};
 return state.npcContinuousEffects;
}
function normalizeNpcContinuousResource(resource){
 const key=String(resource||'').trim();
 const aliases={material:'materials',mat:'materials',comida:'food',medicina:'meds',medicinas:'meds',electricidad:'electricity',combustible:'fuel'};
 return aliases[key]||key;
}
function npcContinuousEffectMatches(npc, effect){
 if(!npc || !effect || typeof effect!=='object') return false;
 const buildingId=String(effect.buildingId||effect.building||'').trim();
 return !buildingId || buildingId===npc.buildingId;
}
function getAssignedNpcContinuousEffectsByType(type){
 const cleanType=String(type||'').trim();
 const out=[];
 getNpcDefs().forEach(def=>{
  const npc=getNpcById(def.id);
  if(!npc || !npc.buildingId || !['available','recruited'].includes(npc.state)) return;
  const effects=Array.isArray(def.continuousEffects) ? def.continuousEffects : [];
  effects.forEach((effect,idx)=>{
   if(effect?.type!==cleanType || !npcContinuousEffectMatches(npc, effect)) return;
   out.push({npc, effect, idx});
  });
 });
 return out;
}
function getAssignedNpcRestEffectTotals(){
 const moraleEntries=getAssignedNpcContinuousEffectsByType('restMoraleBonus');
 const injuryEntries=getAssignedNpcContinuousEffectsByType('injuryRollBonus');
 return {
  moraleChanceBonus:moraleEntries.reduce((sum,entry)=>sum+(Number(entry.effect.chancePercent ?? entry.effect.chance ?? 0)||0),0),
  moraleAmount:moraleEntries.reduce((max,entry)=>Math.max(max, Number(entry.effect.amount||1)||1),1),
  injuryRollBonus:injuryEntries.reduce((sum,entry)=>sum+(Number(entry.effect.amount ?? entry.effect.bonus ?? 0)||0),0)
 };
}
function processNpcContinuousEffects(){
 const store=ensureNpcContinuousEffectState();
 getNpcDefs().forEach(def=>{
  const npc=getNpcById(def.id);
  if(!npc || !npc.buildingId || !['available','recruited'].includes(npc.state)) return;
  const effects=Array.isArray(def.continuousEffects) ? def.continuousEffects : [];
  effects.forEach((effect,idx)=>{
   if(!effect || typeof effect!=='object') return;
   if(!npcContinuousEffectMatches(npc, effect)) return;
   if(effect.type!=='resourceInterval' && effect.type!=='itemChance') return;
   const interval=Math.max(1, Number(effect.intervalDays||effect.days||1)||1);
   const key=`${npc.id}:${idx}:${String(effect.buildingId||effect.building||npc.buildingId)}`;
   const lastDay=Number(store[key]||0)||0;
   if(lastDay && Number(state.day||1)-lastDay<interval) return;
   if(!lastDay && interval>1){
    store[key]=Number(state.day||1);
    return;
   }
   if(effect.type==='resourceInterval'){
    const resource=normalizeNpcContinuousResource(effect.resource);
    const amount=Number(effect.amount||0)||0;
    if(resource && amount && typeof state[resource]==='number'){
     state[resource]=Math.max(0, state[resource]+amount);
     store[key]=Number(state.day||1);
     const label=typeof resourceLabel==='function' ? resourceLabel(resource) : resource;
     if(typeof addLog==='function') addLog(`${npc.name} aporta ${amount>0?'+':''}${amount} ${label} desde ${npc.buildingId}.`);
    }
   }else if(effect.type==='itemChance'){
    const chance=Math.max(0, Math.min(100, Number(effect.chancePercent ?? effect.chance ?? 0)||0));
    if(chance<=0) return;
    store[key]=Number(state.day||1);
    if(Math.random()*100>=chance) return;
    if(typeof applyEffect==='function'){
     applyEffect({type:'addItem', target:'base', amount:1, randomTier:effect.randomTier||effect.tier||''}, false);
     if(typeof addLog==='function') addLog(`${npc.name} encuentra equipo desde ${npc.buildingId}.`);
    }
   }
  });
 });
}
function hasNpcActedToday(id){
 const entry=getNpcStateEntry(id);
 if(!entry) return false;
 return Number(entry.lastInteractionDay||0)===Number(state.day||0);
}
function markNpcInteractionUsedToday(id){
 const entry=getNpcStateEntry(id);
 if(!entry) return null;
 entry.lastInteractionDay=Number(state.day||0);
 return getNpcById(id);
}
function clampNpcTrustValue(value){
 return Math.max(-1, Math.min(2, Number(value||0)||0));
}
function modifyNpcTrust(id, amount){
 const entry=getNpcStateEntry(id);
 if(!entry) return null;
 const before=Number(entry.trust||0)||0;
 entry.trust=clampNpcTrustValue(before+(Number(amount||0)||0));
 return {npc:getNpcById(id), previous:before, current:entry.trust};
}
function getBuildingNpcCapacity(buildingId){
 const id=String(buildingId||'').trim();
 if(!id) return null;
 const def=(gameData.buildings||[]).find(b=>String(b?.id||'')===id)||{};
 const value=def.maxNpcs ?? def.maxNpc ?? def.npcCapacity ?? def.npcSlots;
 if(value===''||value==null) return null;
 const capacity=Number(value);
 return Number.isFinite(capacity) ? Math.max(0, Math.floor(capacity)) : null;
}
function getBuildingNpcOccupancy(buildingId, exceptNpcId=null){
 const id=String(buildingId||'').trim();
 const except=String(exceptNpcId||'').trim();
 if(!id) return 0;
 return getNpcDefs().map(def=>getNpcById(def.id)).filter(npc=>{
  if(!npc||String(npc.id||'')===except) return false;
  if(String(npc.buildingId||npc.assignedBuilding||'')!==id) return false;
  return ['available','recruited'].includes(String(npc.state||''));
 }).length;
}
function assignNpcToBuildingState(id, buildingId){
 const entry=getNpcStateEntry(id);
 if(!entry) return null;
 const cleanBuildingId=String(buildingId||'').trim()||null;
 if(cleanBuildingId){
  const capacity=getBuildingNpcCapacity(cleanBuildingId);
  if(capacity!==null && getBuildingNpcOccupancy(cleanBuildingId, id)>=capacity){
   if(typeof addLog==='function') addLog(`ℹ ${cleanBuildingId} no tiene espacio libre para más NPC.`);
   return null;
  }
 }
 entry.buildingId=cleanBuildingId;
 entry.assignedBuilding=cleanBuildingId;
 if(cleanBuildingId) entry.state='available';
 return Object.assign({}, getNpcById(id)||{}, {assignedBuilding:cleanBuildingId});
}
function setNpcStateValue(id, nextState){
 const entry=getNpcStateEntry(id);
 if(!entry) return null;
 entry.state=normalizeNpcStateValue(nextState||'available');
 if(entry.state==='gone' || entry.state==='hostile'){
  entry.buildingId=null;
  entry.assignedBuilding=null;
 }else if(entry.buildingId){
  entry.assignedBuilding=entry.buildingId;
 }
 return Object.assign({}, getNpcById(id)||{}, {assignedBuilding:entry.buildingId||null});
}
function launchNpcInteraction(npcId){
 const npc=getNpcById(npcId);
 if(!npc){
  if(typeof addLog==='function') addLog('âŒ NPC no encontrado.');
  return false;
 }
 if(hasNpcActedToday(npcId)){
  if(typeof addLog==='function') addLog(`â„¹ ${npc.name} ya ha actuado hoy.`);
  return false;
 }
 const eventId=resolveNpcEventId(npc);
 if(!eventId){
  if(typeof addLog==='function') addLog(`â„¹ ${npc.name} no tiene evento asignado para confianza ${npc.trust}.`);
  return false;
 }
 if(!triggerNpcEventById(eventId, npc)){
  if(typeof addLog==='function') addLog(`âŒ No existe el evento ${eventId} para ${npc.name}.`);
  return false;
 }
 return true;
}

function getRadioTowerCallActionKey(){
 return 'torre_radio_call';
}
function ensureActionLimits(){
 if(!state.actionLimits||typeof state.actionLimits!=='object' || Array.isArray(state.actionLimits)) state.actionLimits={};
 return state.actionLimits;
}
function getRadioTowerCallCooldownDays(){
 if(state.buildings?.taller?.built && Number(state.buildings.taller.level||0) >= 4) return 2;
 return 3;
}
function getRadioTowerCallReadyDay(){
 const store=ensureActionLimits();
 return Number(store[getRadioTowerCallActionKey()]||0);
}
function getRadioTowerCallDaysRemaining(){
 const readyDay=getRadioTowerCallReadyDay();
 const current=Number(state.day||0)||0;
 return readyDay>current ? readyDay-current : 0;
}
function isRadioTowerCallOnCooldown(){
 return getRadioTowerCallDaysRemaining()>0;
}
function setRadioTowerCallCooldown(){
 const store=ensureActionLimits();
 const cooldown=getRadioTowerCallCooldownDays();
 store[getRadioTowerCallActionKey()]=Number(state.day||0)+cooldown;
 return store[getRadioTowerCallActionKey()];
}
function isNpcKnownForRadio(npc){
 return npc && String(npc.state||'').trim().toLowerCase()==='known';
}
function getRadioTowerKnownNpcs(){
 return getNpcDefs().map(def=>getNpcById(def.id)).filter(npc=>npc && isNpcKnownForRadio(npc));
}
function eventExists(eventId){
 const clean=String(eventId||'').trim();
 if(!clean) return false;
 return !![...(gameData.events||[]), ...(gameData.story_events||[])].find(e=>e&&e.id===clean);
}
function resolveNpcRadioEventId(npc){
 if(!npc) return '';
 const candidates=[];
 const trust=Number(npc.trust||0)||0;
 const direct=resolveNpcEventId(npc);
 if(direct) candidates.push(direct);
 if(npc.eventId){
  const base=String(npc.eventId||'').trim();
  const match=base.match(/^(.*?)(?:_\d+)?$/);
  if(match){
   const prefix=match[1];
   candidates.unshift(`${prefix}_${trust}`);
   if(trust!==0) candidates.push(`${prefix}_0`);
  }
 }
 if(Array.isArray(npc.radioEventFallbacks)) candidates.push(...npc.radioEventFallbacks);
 if(npc.eventId) candidates.push(String(npc.eventId).trim());
 for(const candidate of candidates){
  const clean=String(candidate||'').trim();
  if(!clean) continue;
  if(eventExists(clean)) return clean;
 }
 return '';
}
function callRadioNpc(npcId){
 const npc=getNpcById(npcId);
 if(!npc){
  if(typeof addLog==='function') addLog('âŒ NPC no encontrado.');
  return false;
 }
 if(!state.buildings?.torre_radio?.built || !state.buildings.torre_radio.active){
  if(typeof addLog==='function') addLog('â„¹ La Torre de radio no estÃ¡ lista.');
  return false;
 }
 if(isRadioTowerCallOnCooldown()){
  const remaining=getRadioTowerCallDaysRemaining();
  if(typeof addLog==='function') addLog(`â„¹ La Torre de radio estÃ¡ en recarga por ${remaining} dÃ­a${remaining!==1?'s':''}.`);
  return false;
 }
 const eventId=resolveNpcRadioEventId(npc);
 if(!eventId){
  if(typeof addLog==='function') addLog(`â„¹ No hay evento vÃ¡lido para ${npc.name}.`);
  return false;
 }
 if(!triggerNpcEventById(eventId,npc)){
  if(typeof addLog==='function') addLog(`âŒ No se pudo lanzar el evento ${eventId}.`);
  return false;
 }
 setRadioTowerCallCooldown();
 if(typeof render==='function') render();
 return true;
}

function callRadioQuest(){
 if(!state.buildings?.torre_radio?.built || !state.buildings.torre_radio.active){
  if(typeof addLog==='function') addLog('â„¹ La Torre de radio no estÃ¡ lista.');
  return false;
 }
 if(isRadioTowerCallOnCooldown()){
  const remaining=getRadioTowerCallDaysRemaining();
  if(typeof addLog==='function') addLog(`â„¹ La Torre de radio estÃ¡ en recarga por ${remaining} dÃ­a${remaining!==1?'s':''}.`);
  return false;
 }
 const trustLevel = Math.floor((state.stability || 5) / 2); // Nivel de confianza basado en estabilidad (0-5 -> 0-2, etc.)
 const repeatableQuests = (gameData.events || []).filter(e => e && e.type === 'quest' && e.repeatable);
 if(!repeatableQuests.length){
  if(typeof addLog==='function') addLog('â„¹ No hay quests repetibles disponibles.');
  return false;
 }
 // Elegir quest segÃºn trustLevel (simplificado: usar el Ã­ndice)
 const questIndex = Math.min(trustLevel, repeatableQuests.length - 1);
 const selectedQuest = repeatableQuests[questIndex];
 if(!selectedQuest){
  if(typeof addLog==='function') addLog('â„¹ No se pudo seleccionar una quest.');
  return false;
 }
 if(!triggerQuestEventById(selectedQuest.id)){
  if(typeof addLog==='function') addLog(`âŒ No se pudo lanzar la quest ${selectedQuest.id}.`);
  return false;
 }
 setRadioTowerCallCooldown();
 if(typeof render==='function') render();
 return true;
}

function resolveNpcEventId(npc){
 if(!npc) return '';
 const trust=clampNpcTrustValue(npc.trust);
 const direct=npc.trustLevels||npc.trustlevels;
 if(direct && typeof direct==='object' && !Array.isArray(direct)){
  const exact=direct[String(trust)]||direct[trust];
  if(exact) return String(exact).trim();
  const zero=direct['0']||direct[0];
  if(zero) return String(zero).trim();
 }
 const table=Array.isArray(npc.trustEventTable)?npc.trustEventTable:[];
 const row=table.find(entry=>trust>=Number(entry?.min ?? trust)&&trust<=Number(entry?.max ?? trust));
 return row?.eventId?String(row.eventId).trim():'';
}
function triggerQuestEventById(eventId){
 const clean=String(eventId||'').trim();
 if(!clean) return false;
 const schema=[...(gameData.events||[]), ...(gameData.story_events||[])].find(e=>e&&e.id===clean);
 if(!schema) return false;
 try{
  if(typeof buildAndSetEvent==='function'){
   buildAndSetEvent(schema, pick(aliveSurvivors())||{name:'Alguien'});
   if(typeof render==='function') render();
   return true;
  }
 }catch(err){
  console.error('triggerQuestEventById error:', err);
 }
 return false;
}
function triggerNpcEventById(eventId, npc){
 const clean=String(eventId||'').trim();
 if(!clean) return false;
 const schema=[...(gameData.events||[]), ...(gameData.story_events||[])].find(e=>e&&e.id===clean);
 if(!schema) return false;
 try{
  if(typeof buildAndSetEvent==='function'){
   const schemaWithNpc=Object.assign({}, schema, {
    _npcId: npc?.id || null,
    _npcName: npc?.name || ''
   });
   buildAndSetEvent(schemaWithNpc, pick(aliveSurvivors())||{name:'Alguien'});
   if(state.pendingEvent){
    state.pendingEvent._npcId = npc?.id || null;
    state.pendingEvent._npcName = npc?.name || '';
   }
   if(typeof render==='function') render();
   return true;
  }
 }catch(err){ console.warn('No se pudo lanzar evento de NPC', err); }
 return false;
}
window.ensureNpcRuntimeState=ensureNpcRuntimeState;
window.getNpcStateEntry=getNpcStateEntry;
window.getNpcById=getNpcById;
window.getBuildingNpcList=getBuildingNpcList;
window.getNpcsForBuilding=getNpcsForBuilding;
window.processNpcContinuousEffects=processNpcContinuousEffects;
window.getAssignedNpcRestEffectTotals=getAssignedNpcRestEffectTotals;
window.hasNpcActedToday=hasNpcActedToday;
window.markNpcInteractionUsedToday=markNpcInteractionUsedToday;
window.resolveNpcEventId=resolveNpcEventId;
window.triggerNpcEventById=triggerNpcEventById;
window.callRadioNpc=callRadioNpc;
window.getRadioTowerKnownNpcs=getRadioTowerKnownNpcs;
window.clampNpcTrustValue=clampNpcTrustValue;
window.modifyNpcTrust=modifyNpcTrust;
window.assignNpcToBuildingState=assignNpcToBuildingState;
window.getBuildingNpcCapacity=getBuildingNpcCapacity;
window.getBuildingNpcOccupancy=getBuildingNpcOccupancy;
window.setNpcStateValue=setNpcStateValue;
window.launchNpcInteraction=launchNpcInteraction;
