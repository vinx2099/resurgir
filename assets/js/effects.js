// effects.js
// Efectos, recompensas y utilidades relacionadas con efectos/eventos.

// ── Normalise any effect format into the unified [{type,...}] array ──
function normaliseEffects(raw){
 if(!raw) return [];
 // Already an array (editor format)
 if(Array.isArray(raw)) return raw.map(e=>{
 if(!e||!e.type) return e;
 if(e.type==='addSurvivor'&&String(e.rarity).toLowerCase()==='any') return {...e,type:'addSurvivorRandom'};
 if(e.type==='activateEvent') return {...e, type:'activateQuest', questId:e.questId||e.eventId||''};
 return e;
 });
 // Legacy key-value object: { food:-2, morale:1, injureRandom:true, disableRandomBuilding:true, setAttackThreat:true, addSurvivor:1, forageMax:1 }
 const out=[];
 const KNOWN_RESOURCES=['food','materials','morale','stability','meds','electricity','chickens','fuel'];
 Object.entries(raw).forEach(([k,v])=>{
 if(KNOWN_RESOURCES.includes(k)){
 out.push(v>0?{type:'addResource',resource:k,amount:v}:{type:'removeResource',resource:k,amount:Math.abs(v)});
 } else if(k==='injureRandom'&&v) out.push({type:'injureRandom'});
 else if(k==='healInjured'&&v) out.push({type:'healInjured'});
 else if(k==='disableRandomBuilding'&&v) out.push({type:'disableRandomBuilding'});
 else if(k==='setAttackThreat'&&v) out.push({type:'setAttackThreat'});
 else if(k==='addSurvivor') out.push({type:'addSurvivorByRarity',count:Number(v)||1});
 else if(k==='forageMax') out.push({type:'modifyActionEffect',action:'forraje',modifier:Number(v)||1});
 else if(k==='unlockBuilding') out.push({type:'unlockBuilding',building:v});
 });
 return out;
}

function normalizeRequirementOperator(op){
 const raw=String(op||'>=').trim();
 if(['>=','>','<=','<','==','=','!='].includes(raw)) return raw==='='?'==':raw;
 return '>=';
}
function compareRequirementValue(left, operator, right){
 const a=Number(left||0), b=Number(right||0);
 if(operator==='>') return a>b;
 if(operator==='>=') return a>=b;
 if(operator==='<') return a<b;
 if(operator==='<=') return a<=b;
 if(operator==='!=') return a!==b;
 return a===b;
}
function normalizeSkillLookupName(value){
 return String(value||'').trim().toLowerCase();
}
function replacePersonalVars(text, survivor){
 return String(text||'').replaceAll('{survivor}', survivor?.name||'Alguien');
}

function handleLegacyFlags(effects){
 if(!effects||typeof effects!=='object'||Array.isArray(effects)) return;
 if(effects.setAttackThreat){
 const legacyStrength=Math.max(1, Number(effects.attackStrength)||3);
 if(shouldRespectAttackThreatBlock() && activeEventBlocksAttackThreat({ignorePending:true})){
 addLog('🚫 Una amenaza de ataque no puede activarse mientras un efecto activo la bloquea.');
 } else if(state.attackThreat && shouldPreventNewAttackThreatIfActive()){
 const extra=roll(1,4);
 state.attackStrength=Math.max(1, Number(state.attackStrength)||legacyStrength)+extra;
 addLog(`⚠ Ya había una amenaza en camino. Su fuerza aumenta en +${extra} (total: ${state.attackStrength}).`);
 }else{
 state.attackThreat=true;
 state.attackStrength=legacyStrength;
 }
 }
 if(effects.disableRandomBuilding){
 const built=Object.values(state.buildings).filter(b=>b.built&&b.active);
 if(built.length){ const b=pick(built); b.active=false; addLog(`${b.name} queda inhabilitada.`); }
 }
}

function normalizeEffectType(type){
 const raw=String(type||'').trim();
 if(!raw) return '';
 const compact=raw.toLowerCase().replace(/[^a-z0-9]/g,'');
 const aliasMap={
  addskill:'addSkill',
  giveskill:'addSkill',
  learnskill:'addSkill'
 };
 return aliasMap[compact] || raw;
}
function normalizeEffectShape(effect){
 if(!effect || typeof effect!=='object') return effect;
 const normalizedType=normalizeEffectType(effect.type);
 return normalizedType===effect.type ? effect : {...effect, type:normalizedType};
}
function applyEffectList(list){
 (list||[]).forEach(rawEffect=>{
  const effect=normalizeEffectShape(rawEffect);
  if(typeof window!=='undefined' && typeof window.applyEffect==='function' && window.applyEffect!==applyEffect){
   window.applyEffect(effect,false);
   return;
  }
  applyEffect(effect,false);
 });
}
function queueDelayedEffects(list){(list||[]).forEach(effect=>{const normalized=normalizeEffectShape(effect);const delay=clamp(Number(normalized?.delayDays||1),1,3);state.delayedQueue.push({day:state.day+delay,effect:deepClone(normalized)});addLog(`Se programa un efecto para dentro de ${delay} día(s).`)})}


function normalizeItemTierValue(value){
 const clean=String(value||'').trim().toUpperCase();
 return /^T[1-4]$/.test(clean) ? clean : '';
}
function getItemTierRank(value){
 const tier=normalizeItemTierValue(value);
 return tier ? Number(tier.slice(1)) : 0;
}
function getItemDefsForRewards(){
 return (gameData.items||[]).map(materializeItem).filter(it=>it&&it.itemId&&!it.disabled&&!it.hidden);
}
function findRewardItemDef(effect){
 const requestedId=String(effect?.itemId||'').trim();
 if(requestedId) return getItemDef(requestedId);
 const requestedType=String(effect?.randomType||effect?.itemType||'').trim().toLowerCase();
 const requestedTier=normalizeItemTierValue(effect?.randomTier||effect?.tier||'');
 let pool=getItemDefsForRewards();
 if(requestedType && requestedType!=='any') pool=pool.filter(it=>String(it.itemType||it.type||'').trim().toLowerCase()===requestedType);
 if(requestedTier) pool=pool.filter(it=>normalizeItemTierValue(it.tier)===requestedTier);
 if(!pool.length && requestedTier){
  const wantedRank=getItemTierRank(requestedTier);
  pool=getItemDefsForRewards().filter(it=>{
   const typeOk=!requestedType||requestedType==='any'||String(it.itemType||it.type||'').trim().toLowerCase()===requestedType;
   return typeOk && getItemTierRank(it.tier)<=wantedRank;
  });
 }
 if(!pool.length && requestedType && requestedType!=='any'){
  pool=getItemDefsForRewards().filter(it=>String(it.itemType||it.type||'').trim().toLowerCase()===requestedType);
 }
 if(!pool.length) pool=getItemDefsForRewards();
 if(!pool.length) return null;
 return pick(pool);
}
function getInventoryTarget(effect){
 const mode=(effect.target||effect.scope||'base');
 if(mode==='base') return {kind:'base', list:state.inventory};
 if(mode==='explorer'){
 const s=getAliveSurvivorById(effect.targetId) || getAliveSurvivorById(state.pendingEvent?._explorerId);
 return s?{kind:'survivor', survivor:s, list:s.inventory}:null;
 }
 if(mode==='randomSurvivor'){
 const s=pick(aliveSurvivors());
 return s?{kind:'survivor', survivor:s, list:s.inventory}:null;
 }
 if(mode==='survivorById'){
 const s=getAliveSurvivorById(effect.targetId);
 return s?{kind:'survivor', survivor:s, list:s.inventory}:null;
 }
 if(mode==='actionSurvivor'){
 const action = effect.action || state.pendingEvent?.relatedAction || 'related';
 let candidates=[];
 if(action==='related' && state.pendingEvent?.relatedAction){
 candidates=(state._lastDayActionSurvivors?.[state.pendingEvent.relatedAction]||[]).map(getAliveSurvivorById).filter(Boolean);
 } else {
 candidates=(state._lastDayActionSurvivors?.[action]||[]).map(getAliveSurvivorById).filter(Boolean);
 }
 const s=pick(candidates);
 return s?{kind:'survivor', survivor:s, list:s.inventory}:null;
 }
 return {kind:'base', list:state.inventory};
}
function addItemEntryToList(list, itemId, qty=1, overrides={}){
 if(!Array.isArray(list)) return false;
 const base=materializeItem({itemId, ...overrides});
 if(base.itemType==='consumable' && base.stackable){
 const existing=list.find(it=>materializeItem(it).itemId===base.itemId && materializeItem(it).itemType==='consumable');
 if(existing){ existing.qty = Number(existing.qty||1) + qty; return true; }
 list.push({...base, qty});
 return true;
 }
 for(let i=0;i<qty;i++) list.push(materializeItem({itemId, ...overrides}));
 return true;
}
function removeItemEntryFromList(list, itemId=null, qty=1){
 if(!Array.isArray(list) || !list.length) return 0;
 let removed=0;
 for(let i=list.length-1;i>=0 && removed<qty;i--){
 const it=materializeItem(list[i]);
 if(itemId && it.itemId!==itemId) continue;
 if(it.itemType==='consumable' && it.stackable && Number(list[i].qty||1)>1){
 const take=Math.min(qty-removed, Number(list[i].qty||1));
 list[i].qty -= take;
 removed += take;
 if(list[i].qty<=0) list.splice(i,1);
 } else {
 list.splice(i,1);
 removed += 1;
 }
 }
 return removed;
}
function damageItemInList(list, itemId=null, amount=1){
 if(!Array.isArray(list) || !list.length) return null;
 const idx = itemId ? list.findIndex(it=>materializeItem(it).itemId===itemId) : list.findIndex(it=>materializeItem(it).itemType!=='consumable');
 if(idx<0) return null;
 const it=materializeItem(list[idx]);
 if(it.itemType==='consumable'){
 removeItemEntryFromList(list, it.itemId, Math.max(1, amount));
 return {item:it, broke:true, consumable:true};
 }
 list[idx]=degradeItem(it, amount);
 return {item:materializeItem(list[idx]), broke:materializeItem(list[idx]).quality<=0};
}
function formatInventoryTargetLabel(targetInfo){
 if(!targetInfo) return 'sin destino';
 if(targetInfo.kind==='base') return 'el almacén';
 return targetInfo.survivor?.name || 'un superviviente';
}

function applyEffect(effect,delayed){
 effect=normalizeEffectShape(effect);
 if(!effect||!effect.type) return;
 switch(effect.type){
 case 'addResource':{
 const key=normalizeResourceKey(effect.resource),amt=Number(effect.amount||0);
 if(key==='stability'){ state.stability=Math.min(10,state.stability+amt); addLog(`${delayed?'[Retrasado] ':''}🏛 Estabilidad +${amt}.`); break; }
 if(key==='morale'){ aliveSurvivors().forEach(s=>{ adjustSurvivorMorale(s,amt); }); addLog(`${delayed?'[Retrasado] ':''}😊 Moral de todos +${amt}.`); break; }
 if(typeof state[key]==='number'){
 state[key]+=amt;
 addLog(`${delayed?'[Retrasado] ':''}${resourceLabel(key)} +${amt}.`);
 // Auto-unlock meds if we just received some
 if(key==='meds'&&state.meds>0&&!state.unlocked.meds){
 state.unlocked.meds=true;
 addLog('💊 Medicamentos desbloqueados.');
 }
 }
 break;
 }
 case 'removeResource':{
 const key=normalizeResourceKey(effect.resource),amt=Number(effect.amount||0);
 if(key==='stability'){ state.stability=Math.max(0,state.stability-amt); addLog(`${delayed?'[Retrasado] ':''}🏛 Estabilidad -${amt}.`); break; }
 if(key==='morale'){ aliveSurvivors().forEach(s=>{ adjustSurvivorMorale(s,-amt); }); addLog(`${delayed?'[Retrasado] ':''}😞 Moral de todos -${amt}.`); break; }
 if(typeof state[key]==='number'){state[key]=Math.max(0,state[key]-amt);addLog(`${delayed?'[Retrasado] ':''}${resourceLabel(key)} -${amt}.`)}
 break;
 }

 case 'addSkill':{
 const skillId=String(effect?.skill || effect?.skillId || effect?.value || effect?.name || effect?.id || '').trim();
 if(!skillId) break;
 let targets=[];
 if(effect?.targetId){
  const byId=getAliveSurvivorById(effect.targetId);
  if(byId) targets=[byId];
 }
 if(!targets.length){
  const targetMode=String(effect?.targetMode || effect?.target || '').trim();
  if(targetMode==='allActors' && typeof getEventActors==='function'){
   targets=(getEventActors(state?.pendingEvent)||[]).filter(s=>s&&s.status!=='muerto');
  } else if(/^actor\d$/i.test(targetMode) && typeof getEventActors==='function'){
   const idx=Math.max(0, Number(targetMode.replace(/\D/g,''))-1);
   const actor=(getEventActors(state?.pendingEvent)||[])[idx];
   if(actor && actor.status!=='muerto') targets=[actor];
  } else if((targetMode==='action' || targetMode==='actionSurvivor') && state?._lastDayActionSurvivors){
   const action=effect.action || state?.pendingEvent?.relatedAction;
   targets=((state._lastDayActionSurvivors?.[action]||[]).map(getAliveSurvivorById).filter(Boolean));
  } else if((targetMode==='explorer' || targetMode==='actionExplorer') && state?.pendingEvent?._explorerId){
   const explorer=getAliveSurvivorById(state.pendingEvent._explorerId);
   if(explorer) targets=[explorer];
  } else if(targetMode==='random' || targetMode==='randomSurvivor' || !targetMode){
   const survivor=pick(aliveSurvivors());
   if(survivor) targets=[survivor];
  }
 }
 targets=targets.filter((target,idx,arr)=>target && arr.findIndex(s=>String(s.id)===String(target.id))===idx);
 if(!targets.length) break;
 targets.forEach(target=>{
  if(typeof addSkillToSurvivor==='function') addSkillToSurvivor(target, skillId, delayed);
  else {
   if(!Array.isArray(target.skills)) target.skills=[];
   if(!target.skills.includes(skillId)) target.skills.push(skillId);
   if(!target.skill) target.skill=skillId;
   addLog(`${delayed?'[Retrasado] ':''}🎓 ${target.name} aprende ${skillId}.`);
  }
 });
 break;
 }

 case 'addItem':{
 const targetInfo=getInventoryTarget(effect);
 if(!targetInfo){ addLog(`${delayed?'[Retrasado] ':''}❌ No se ha encontrado destino para el equipo.`); break; }
 const qty=Math.max(1, Number(effect.qty||effect.amount||1));
 const rewardDef=findRewardItemDef(effect);
 if(!rewardDef?.id){ addLog(`${delayed?'[Retrasado] ':''}❌ No hay objetos válidos para ese tier o filtro.`); break; }
 const ok=addItemEntryToList(targetInfo.list, rewardDef.id, qty, effect.itemOverrides||{});
 if(ok){
  const tierTag=normalizeItemTierValue(rewardDef.tier);
  addLog(`${delayed?'[Retrasado] ':''}🎒 Se encuentra ${qty>1?qty+' x ':''}${rewardDef.name}${tierTag?` (${tierTag})`:''} y se guarda en ${formatInventoryTargetLabel(targetInfo)}.`);
 }
 break;
 }
 case 'removeItem':{
 const targetInfo=getInventoryTarget(effect);
 if(!targetInfo) break;
 const qty=Math.max(1, Number(effect.qty||effect.amount||1));
 const removed=removeItemEntryFromList(targetInfo.list, effect.itemId||null, qty);
 if(removed>0){
 addLog(`${delayed?'[Retrasado] ':''}📦 Se pierde ${removed>1?removed+' x ':''}${(getItemDef(effect.itemId)||{}).name||effect.itemId||'equipo'} de ${formatInventoryTargetLabel(targetInfo)}.`);
 } else {
 addLog(`${delayed?'[Retrasado] ':''}ℹ No había equipo que perder en ${formatInventoryTargetLabel(targetInfo)}.`);
 }
 break;
 }
 case 'damageItem':{
 const targetInfo=getInventoryTarget(effect);
 if(!targetInfo) break;
 const result=damageItemInList(targetInfo.list, effect.itemId||null, Math.max(1, Number(effect.amount||1)));
 if(result){
 const name=(getItemDef(effect.itemId)||{}).name||result.item?.name||effect.itemId||'equipo';
 if(result.broke) addLog(`${delayed?'[Retrasado] ':''}💥 ${name} queda roto en ${formatInventoryTargetLabel(targetInfo)}.`);
 else addLog(`${delayed?'[Retrasado] ':''}🔧 ${name} se daña (${result.item.quality}/${result.item.maxQuality}) en ${formatInventoryTargetLabel(targetInfo)}.`);
 } else {
 addLog(`${delayed?'[Retrasado] ':''}ℹ No hay equipo válido que dañar en ${formatInventoryTargetLabel(targetInfo)}.`);
 }
 break;
 }

 case 'moraleAll':{
 const amt=Number(effect.amount||0);
 aliveSurvivors().forEach(s=>{ adjustSurvivorMorale(s,amt); });
 addLog(`${delayed?'[Retrasado] ':''}${amt>0?'😊':'😞'} Moral de todos ${amt>0?'+':''}${amt}.`);
 break;
 }
 case 'fatigueAll':{
 const amt=Number(effect.amount||0);
 aliveSurvivors().forEach(s=>{ s.fatigue=Math.max(0,Math.min(s.maxFatigue??3,s.fatigue+amt)); });
 addLog(`${delayed?'[Retrasado] ':''}⚡ Fatiga de todos ${amt>0?'+':''}${amt}.`);
 break;
 }
 case 'addFatigue':{
 const amt=Number(effect.amount||0);
 const target=effect.targetId?state.survivors.find(s=>s.id===effect.targetId&&s.status!=='muerto'):pick(aliveSurvivors());
 if(target){ target.fatigue=Math.max(0,Math.min(target.maxFatigue??3,target.fatigue+amt)); addLog(`${delayed?'[Retrasado] ':''}⚡ ${target.name} fatiga +${amt}.`); }
 break;
 }
 case 'removeFatigue':{
 const amt=Number(effect.amount||0);
 const target=effect.targetId?state.survivors.find(s=>s.id===effect.targetId&&s.status!=='muerto'):pick(aliveSurvivors());
 if(target){ target.fatigue=Math.max(0,Math.min(target.maxFatigue??3,target.fatigue-amt)); addLog(`${delayed?'[Retrasado] ':''}⚡ ${target.name} fatiga -${amt}.`); }
 break;
 }
 case 'moraleSurvivor':{
 const amt=Number(effect.amount||0);
 const target=effect.targetId?state.survivors.find(s=>s.id===effect.targetId):pick(aliveSurvivors());
 if(target){ adjustSurvivorMorale(target,amt); addLog(`${delayed?'[Retrasado] ':''}${getMoraleEmoji(target)} ${target.name} moral ${amt>0?'+':''}${amt}.`); }
 break;
 }
 case 'stabilityChange':{
 const amt=Number(effect.amount||0);
 state.stability=Math.max(0,Math.min(10,state.stability+amt));
 addLog(`${delayed?'[Retrasado] ':''}🏛 Estabilidad ${amt>0?'+':''}${amt}.`);
 break;
 }
 case 'unlockBuilding':{
 const bid=effect.building;
 if(bid==='hospital'){
 state.hospitalUnlocked=true;
 if(state.buildings.hospital) state.buildings.hospital.constructible=true;
 addLog('🏥 El Hospital ya puede construirse.');
 }
 break;
 }
 case 'discoverNpc':{
  const npc=getNpcById(effect.npcId);
  if(npc){
   if(!npc.state || npc.state==='unknown') npc.state='known';
   addLog(`${delayed?'[Retrasado] ':''}👤 ${npc.name} pasa a ser conocido.`);
  }
  break;
 }
 case 'modifyNpcTrust':{
  const result=typeof modifyNpcTrust==='function' ? modifyNpcTrust(effect.npcId, effect.amount) : null;
  if(result?.npc){
   addLog(`${delayed?'[Retrasado] ':''}🤝 ${result.npc.name} ${Number(effect.amount||0)>=0?'confianza':'confianza'} ${Number(effect.amount||0)>0?'+':''}${Number(effect.amount||0)||0}.`);
  }
  break;
 }
 case 'assignNpcToBuilding':{
  const npc=typeof assignNpcToBuildingState==='function' ? assignNpcToBuildingState(effect.npcId, effect.buildingId||effect.building) : null;
  if(npc){
   addLog(`${delayed?'[Retrasado] ':''}🏚 ${npc.name} queda asignado a ${npc.assignedBuilding||effect.buildingId||effect.building}.`);
  }
  break;
 }
 case 'setNpcState':{
  const npc=typeof setNpcStateValue==='function' ? setNpcStateValue(effect.npcId, effect.state) : null;
  if(npc){
   addLog(`${delayed?'[Retrasado] ':''}👤 ${npc.name} ahora está ${npc.state}.`);
  }
  break;
 }
 case 'recruitNpc':{
  const npc=typeof setNpcStateValue==='function' ? setNpcStateValue(effect.npcId, 'recruited') : null;
  if(npc){
   addLog(`${delayed?'[Retrasado] ':''}🤝 ${npc.name} se une al asentamiento.`);
  }
  break;
 }
 case 'injureExplorer':{
 // Injure the specific survivor who triggered this explore event
 const target=state.survivors.find(s=>s.id===effect.targetId&&s.status!=='muerto');
 const forcedLevel=(effect.injuryLevel==='random'||effect.injuryLevel==='aleatorio') ? rollExplorerRandomInjuryLevel() : effect.injuryLevel;
 if(target) injureSurvivor(target,`${delayed?'[Retrasado] ':''}${target.name} resulta {injuryLabel} durante la exploración.`,{source:'event',level:forcedLevel});
 else {
 const candidate=pick(state.survivors.filter(s=>s.status!=='muerto'));
 if(candidate) injureSurvivor(candidate,`${delayed?'[Retrasado] ':''}${candidate.name} resulta {injuryLabel}.`,{source:'event',level:forcedLevel});
 }
 break;
 }
 case 'injureActionSurvivor':{
 // Injure a survivor who performed the event's relatedAction this day
 const action=effect.action||state.pendingEvent?.relatedAction;
 const ids=action&&state._lastDayActionSurvivors?.[action];
 const pool=ids?.length
 ? state.survivors.filter(s=>ids.includes(s.id)&&s.status!=='muerto')
 : state.survivors.filter(s=>s.status!=='muerto');
 const target=pick(pool);
 if(target) injureSurvivor(target,`${delayed?'[Retrasado] ':''}🩸 ${target.name} resulta {injuryLabel}.`,{source:'event',level:effect.injuryLevel});
 break;
 }
 case 'injureRandom':
 case 'injureSurvivor':{
 const candidate=effect.targetId
 ? state.survivors.find(s=>s.id===effect.targetId&&s.status!=='muerto')
 : pick(state.survivors.filter(s=>s.status!=='muerto'));
 if(candidate) injureSurvivor(candidate,`${delayed?'[Retrasado] ':''}${candidate.name} resulta {injuryLabel}.`,{source:'event',level:effect.injuryLevel});
 break;
 }
 case 'healSurvivor':
 case 'healInjured':{
 const injured=effect.targetId
 ? state.survivors.find(s=>s.id===effect.targetId&&hasActiveInjury(s))
 : state.survivors.find(s=>hasActiveInjury(s));
 if(injured){
 injured.status='activo';
 injured.injuryLevel=null;
 injured.injuryRestDays=0;
 addLog(`${delayed?'[Retrasado] ':''}${injured.name} se cura de sus heridas.`);
 }
 break;
 }
 case 'createThreat':
 case 'addThreat':
 case 'spawnThreat':{
 const threatId=effect.threatId||effect.templateId||effect.id;
 if(!threatId) break;
 const threatDef=getThreatDef(threatId);
 const spawned=spawnThreatInstance(threatId, {force:effect.force===true || threatDef?.force===true, silent:false, severity:effect.severity, source:'event'});
 if(!spawned) addLog(`${delayed?'[Retrasado] ':''}ℹ No se ha podido activar la amenaza ${threatId}.`);
 break;
 }
 case 'activateQuest':
 case 'activateEvent':{
 const questId=effect.questId||effect.eventId||'';
 scheduleQuestActivation(questId, effect.minDays, effect.maxDays, effect.forcedSurvivorId?state.survivors.find(s=>s.id===effect.forcedSurvivorId):null);
 break;
 }
 case '_queueQuestEvent':{
 const questId=effect.questId||effect.eventId||'';
 const schema=getQuestSchemaById(questId);
 if(!schema){
  addLog(`${delayed?'[Retrasado] ':''}❌ No se ha encontrado la quest ${questId||'sin ID'} para lanzarla.`);
  break;
 }
 const queued=queueEventById(schema.id, effect.forcedSurvivorId?state.survivors.find(s=>s.id===effect.forcedSurvivorId):null);
 if(queued){
  addLog(`${delayed?'[Retrasado] ':''}📜 La quest ${schema.name||schema.id} ya está lista para lanzarse.`);
  addTechnicalLog('quest_ready', 'Quest preparada para lanzarse.', {questId:schema.id, questName:schema.name||schema.id, day:state.day});
 } else {
  addLog(`${delayed?'[Retrasado] ':''}❌ No se pudo poner en cola la quest ${schema.name||schema.id}.`);
 }
 break;
 }
 case 'setAttackThreat':{
 if(shouldRespectAttackThreatBlock() && activeEventBlocksAttackThreat({ignorePending:true})){
 addLog(`${delayed?'[Retrasado] ':''}🚫 Una amenaza de ataque no puede activarse mientras un efecto activo la bloquea.`);
 break;
 }
 if(state.attackThreat && shouldPreventNewAttackThreatIfActive()){
 const extra=roll(1,4);
 state.attackStrength=Math.max(1, Number(state.attackStrength)||0)+extra;
 addLog(`${delayed?'[Retrasado] ':''}⚠ Ya había una amenaza en camino. Su fuerza aumenta en +${extra} (total: ${state.attackStrength}).`);
 break;
 }
 if(!state.attackThreat && getFreeThreatSlotsCount()<=0){
 redirectOverflowThreatPressure(`${delayed?'[Retrasado] ':''}`);
 break;
 }
 const hostileInfo=resolveHostileThreat(effect);
 state.attackThreat=true;
 state.attackHostileType=hostileInfo.type;
 state.attackHostileVariant=hostileInfo.variant;
 state.attackHostileLabel=hostileInfo.label;
 state.attackHostileIcon=hostileInfo.icon;
 state.attackHostileNpc=!!hostileInfo.isNpc;
 state.attackHostileNpcEventId=hostileInfo.preAttackEventId||null;
 state.attackStrength=hostileInfo.strength;
 if(effect.effectOnVictory?.length) state.attackEffectVictory=deepClone(effect.effectOnVictory);
 if(effect.effectOnDefeat?.length) state.attackEffectDefeat=deepClone(effect.effectOnDefeat);
 state.attackPopupVictory=effect.combatPopupVictory?deepClone(effect.combatPopupVictory):null;
 state.attackPopupDefeat=effect.combatPopupDefeat?deepClone(effect.combatPopupDefeat):null;
 const arrDays=Number(effect.arrivalDays||0);
 state.attackArrivalDay=arrDays>0?state.day+arrDays:state.day;
 const days=arrDays>0?`en ${arrDays} día${arrDays!==1?'s':''}. Día ${state.attackArrivalDay}.`:'¡inminente!';
 addLog(`${delayed?'[Retrasado] ':''}⚠ ¡Amenaza de ataque detectada! ${state.attackHostileIcon}${state.attackHostileLabel} · Fuerza: ${state.attackStrength}${state.attackHostileVariant && state.attackHostileVariant!=='random'?` · Variante: ${state.attackHostileVariant}`:''} · Llegada: ${days}`);
 if(state.attackHostileNpc){
 addLog(`🎭 ${state.attackHostileLabel} no es un enemigo corriente. Habrá un encuentro antes del ataque.`);
 setEvent(buildNpcThreatIntroEvent(hostileInfo));
 }
 if(typeof setCombatMusic==='function') setCombatMusic(true);
 break;
 }
 case 'disableRandomBuilding':{
 const built=Object.values(state.buildings).filter(b=>b.built&&b.active);
 if(built.length){const b=pick(built);b.active=false;addLog(`${delayed?'[Retrasado] ':''}${b.name} queda inhabilitada.`);}
 break;
 }
 case 'disableBuilding':{
 const b=state.buildings[effect.building];
 if(b&&b.built){
 if(Number(effect.days||0)>0){
 if(!state.buildingDisableTimers||typeof state.buildingDisableTimers!=='object') state.buildingDisableTimers={};
 state.buildingDisableTimers[effect.building]=Math.max(Number(state.buildingDisableTimers[effect.building]||0), state.day+Number(effect.days||1));
 }
 b.active=false;
 addLog(`${delayed?'[Retrasado] ':''}${b.name} queda inhabilitado${Number(effect.days||0)>0?` ${effect.days} día${Number(effect.days)!==1?'s':''}`:''}.`)
 }
 break;
 }
 case 'destroyBuilding':{
 const b=state.buildings[effect.building];
 if(b&&b.built){b.built=false;b.level=0;b.active=true;addLog(`${delayed?'[Retrasado] ':''}${b.name} queda derruido y debe reconstruirse.`);if(state.currentDetail===b.id)showBuildingDetail(b.id)}
 break;
 }
 case 'limitAction':{
 const explicitDays=Math.max(1, Number(effect.days||1));
 const eventWindow=Math.max(1, Number(state.eventDaysLeft||0), Number(state.eventTotalDays||0));
 const totalDays=Math.max(explicitDays, (!delayed&&state.pendingEvent)?eventWindow:1);
 const startDay=delayed?state.day+1:state.day;
 const untilDay=startDay+totalDays-1;
 if(!state.actionLimits) state.actionLimits={};
 state.actionLimits[effect.action]=Math.max(Number(state.actionLimits[effect.action]||0), untilDay);
 addLog(`${delayed?'[Retrasado] ':''}La acción ${actionLabel(effect.action)} queda inhabilitada ${totalDays} día${totalDays!==1?'s':''} (hasta el día ${untilDay}).`);
 break;
 }
 case 'modifyActionEffect':{
 state.delayedQueue.push({day:state.day+(delayed?0:1),effect:{type:'_internalModifyAction',action:effect.action,modifier:Number(effect.modifier||0)}});
 addLog(`${delayed?'[Retrasado] ':''}Se modifica el efecto de ${actionLabel(effect.action)}.`);
 break;
 }
 case 'removeSurvivor':{
 const targetId=effect.targetId||effect.id;
 dismissSurvivorById(targetId, effect.reason||'abandona el asentamiento');
 break;
 }
 case 'addSurvivor':
 case 'addSurvivorByRarity':
 case 'addSurvivorRandom':{
 // Don't open a second popup if one is already pending
 if(state._pendingSurvivor) break;
 const forcedRarity = effect.type==='addSurvivorByRarity' ? Number(effect.rarity||4) : null;
 const newSurvivor=pickSurvivorByRarity(forcedRarity);
 if(newSurvivor){
 state._pendingSurvivor=newSurvivor;
 openSurvivorInvitePopup(newSurvivor);
 } else {
 addLog(`${delayed?'[Retrasado] ':''}No hay supervivientes disponibles para añadir (todos ya están en juego).`);
 }
 break;
 }
 case 'addDog':
 case 'addPerro':
 case 'addCompanionDog':
 case 'addSettlementDog':
 case 'giveDog':{
 addDogToSettlement(effect, delayed);
 break;
 }
 case 'decide':{
 // Show a choice popup to the player with custom options
 if(!effect.options||!effect.options.length) break;
 openDecidePopup(effect.options);
 break;
 }
 case '_internalLimitAction':{
 // Legacy compatibility for older queued limits
 if(!state.actionLimits) state.actionLimits={};
 state.actionLimits[effect.action]=Math.max(Number(state.actionLimits[effect.action]||0), state.day+1);
 break;
 }
 case '_internalModifyAction':{
 if(!window.tempActionMods) window.tempActionMods={};
 window.tempActionMods[effect.action]=Number(effect.modifier||0);
 break;
 }
 }
}
