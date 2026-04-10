// Extraído de app.js

function getAmbushEventPool(actionType=''){
 const normalizedAction=String(actionType||'').toLowerCase();
 return (gameData.events||[]).filter(e=>{
 if(!e || e.type!=='ambush') return false;
 if(!isEventEligibleBySchedule(e)) return false;
 if(shouldRespectAttackThreatBlock() && activeEventBlocksAttackThreat() && schemaContainsAttackThreat(e)) return false;
 if(!e.repeatable && state.seenEvents?.has(e.id)) return false;
 const related=String(e.relatedAction||'').toLowerCase();
 return !related || related===normalizedAction;
 });
}

function pickAmbushEventSchema(actionType=''){
 const pool=getAmbushEventPool(actionType);
 if(!pool.length) return null;
 const weighted=pool.map(ev=>({...ev,_ambushWeight:Math.max(1, Number(ev.weight||1))}));
 const picked=weightedPickField(weighted,'_ambushWeight');
 if(picked?.id && !picked.repeatable){
 if(!state.seenEvents) state.seenEvents=new Set();
 state.seenEvents.add(picked.id);
 }
 return picked||null;
}

function maybeTriggerGroupActionAmbush(ctx, actionType, contextLabel, forcedChance=null){
 return queueGroupActionAmbush(ctx, actionType, contextLabel, forcedChance);
}

function getExploreGroupModifiers(leader){
 const ctx=getGroupActionContextForSurvivor(leader, 'explorar');
 const mods={ctx:null, positiveMult:1, itemChances:[], ambushChance:0};
 if(!ctx || String(ctx.leader.id)!==String(leader.id)) return mods;
 mods.ctx=ctx;
 const leaderState=getActionStartMoraleState(leader);
 if(leaderState==='high') mods.positiveMult=1.10;
 mods.positiveMult*=getLeaderPositiveGroupBonusMultiplier(ctx);
 mods.itemChances=getGroupActionItemChances(ctx, 'explorar');
 mods.ambushChance=calculateGroupAmbushChance(ctx, 'explorar');
 return mods;
}

function getEventVariableScheduleConfig(){
 const cfg=gameData.config?.events?.variableSchedule;
 return (cfg&&typeof cfg==='object'&&!Array.isArray(cfg)) ? cfg : {};
}

function getQuestEventConfig(){
 const cfg=gameData.config?.events?.questActivation;
 return (cfg&&typeof cfg==='object'&&!Array.isArray(cfg)) ? cfg : {};
}

function activeEventBlocksAttackThreat(options={}){
 const ev=state._activeMultiDayEvent;
 if(!ev||!ev.blockAttackThreatWhileActive) return false;
 if(options.ignorePending&&state.pendingEvent&&state.pendingEvent===ev) return false;
 return Number(ev._daysLeft||0)>0;
}

function schemaContainsNpcInteractionEffect(schema){
 if(!schema) return false;
 const list=[];
 if(Array.isArray(schema.effects)) list.push(...schema.effects);
 if(schema.options){
  Object.values(schema.options).forEach(opt=>{ if(Array.isArray(opt?.effects)) list.push(...opt.effects); });
 }
 if(schema.nodes){
  Object.values(schema.nodes).forEach(node=>{
   if(node?.options){
    Object.values(node.options).forEach(opt=>{ if(Array.isArray(opt?.effects)) list.push(...opt.effects); });
   }
  });
 }
 return list.some(effect=>effect&&['setNpcState','assignNpcToBuilding','modifyNpcTrust','recruitNpc'].includes(String(effect.type||'')));
}

function isNpcExclusiveEvent(schema){
 if(!schema) return false;
 // Los eventos NPC introductorios pueden y deben salir en el pool diario si cumplen condiciones.
 // Solo excluimos eventos marcados de forma explícita como exclusivos de interacción NPC.
 return schema.npcExclusive === true;
}


function getThreatEventSelectionMultiplier(schema){
 if(!schemaContainsAnyThreatPressure(schema)) return 1;
 const free=getFreeThreatSlotsCount();
 if(free<=0) return 0;
 if(free===1) return 0.45;
 return 1;
}

function getEventIntervalConfig(ev){
 if(!ev) return null;
 const sched=ev.schedule||{};
 if(sched.mode==='every_x_plus_y'){
 const base=Math.max(1, Number(sched.baseDays||sched.x||0));
 if(!base) return null;
 const variableCfg=getEventVariableScheduleConfig();
 return {
 mode:'every_x_plus_y',
 baseDays:base,
 useOffset: variableCfg.basePlusRandomOffset !== false,
 minInterval: Math.max(1, Number(variableCfg.minimumIntervalDays ?? 1) || 1),
 enabled: variableCfg.enabled !== false
 };
 }
 return null;
}

function rollEventIntervalJitter(){
 const cfg=getEventVariableScheduleConfig();
 if(cfg.enabled===false || cfg.basePlusRandomOffset===false) return 0;
 const rawPool=Array.isArray(cfg.offsetPool)&&cfg.offsetPool.length ? cfg.offsetPool : [-2,-1,1,2];
 const pool=rawPool.map(Number).filter(Number.isFinite);
 return pool.length ? pick(pool) : 0;
}

function getOrInitScheduledEventDay(ev){
 if(!ev||!ev.id) return null;
 const cfg=getEventIntervalConfig(ev);
 if(!cfg) return null;
 if(!state.eventSchedule) state.eventSchedule={};
 const existing=state.eventSchedule[ev.id];
 if(existing&&Number.isFinite(Number(existing.nextDay))) return Number(existing.nextDay);
 const jitter=rollEventIntervalJitter();
 const interval=Math.max(Number(cfg.minInterval||1), cfg.baseDays + jitter);
 const nextDay=state.day + interval;
 state.eventSchedule[ev.id]={nextDay,jitter,interval,baseDays:cfg.baseDays};
 addTechnicalLog('event_schedule_init', 'Se inicializa programación de evento.', {eventId:ev.id, eventName:ev.name||ev.title||ev.id, baseDays:cfg.baseDays, jitter, interval, nextDay});
 return nextDay;
}

function isEventEligibleBySchedule(ev){
 const cfg=getEventIntervalConfig(ev);
 if(!cfg) return true;
 const nextDay=getOrInitScheduledEventDay(ev);
 return state.day>=Number(nextDay||0);
}

function rescheduleEventInterval(ev){
 if(!ev||!ev.id) return;
 const cfg=getEventIntervalConfig(ev);
 if(!cfg) return;
 if(!state.eventSchedule) state.eventSchedule={};
 const jitter=rollEventIntervalJitter();
 const interval=Math.max(Number(cfg.minInterval||1), cfg.baseDays + jitter);
 const nextDay=state.day + interval;
 state.eventSchedule[ev.id]={nextDay,jitter,interval,baseDays:cfg.baseDays};
 addTechnicalLog('event_schedule_reschedule', 'Evento reprogramado con intervalo X+Y.', {eventId:ev.id, eventName:ev.name||ev.title||ev.id, baseDays:cfg.baseDays, jitter, interval, nextDay});
}

function getExploreEventPhaseWeights(){
 const phases=gameData.config?.exploration?.weightsByPhase;
 if(phases && typeof phases==='object'){
 const ordered=Object.values(phases).filter(Boolean);
 for(const phase of ordered){
 const days=Array.isArray(phase.days)?phase.days:[];
 const start=Number(days[0]??-Infinity);
 const end=Number(days[1]??Infinity);
 if(state.day>=start && state.day<=end && phase.categories && typeof phase.categories==='object'){
 return deepClone(phase.categories);
 }
 }
 }
 if(state.day<=5) return {nothing:25,resources:40,survivor:15,narrative:5,negative:8,danger:7};
 if(state.day>=16) return {nothing:15,resources:20,survivor:8,narrative:7,negative:20,danger:30};
 return {nothing:20,resources:30,survivor:12,narrative:8,negative:15,danger:15};
}

function extractAllEventEffects(ev){
 const direct=Array.isArray(ev?.effects)?ev.effects:[];
 const optionEffects=ev?.options?Object.values(ev.options).flatMap(opt=>Array.isArray(opt?.effects)?opt.effects:[]):[];
 return [...direct,...optionEffects];
}

function eventHasAddSurvivor(ev){
 return extractAllEventEffects(ev).some(e=>['addSurvivor','addSurvivorByRarity','addSurvivorRandom'].includes(e?.type));
}

function classifyExploreEvent(ev){
 const effects=extractAllEventEffects(ev);
 const tone=String(ev?.tone||'').toLowerCase();
 const title=[ev?.id, ev?.name, ev?.title, ev?.text].filter(Boolean).join(' ').toLowerCase();
 if(eventHasAddSurvivor(ev)) return 'survivor';
 if(!effects.length) return 'nothing';
 const hasThreat=effects.some(e=>e&&['setAttackThreat','injureExplorer','injureActionSurvivor','injureSurvivor','injureRandom'].includes(e.type));
 if(hasThreat||tone==='negative'&&effects.some(e=>e&&['destroyBuilding','disableBuilding','limitAction'].includes(e.type))) return 'danger';
 const resourceGain=effects.some(e=>e&&e.type==='addResource'&&['food','materials','meds','fuel','chickens'].includes(e.resource));
 if(resourceGain) return 'resources';
 const mildNegative=effects.some(e=>e&&((e.type==='removeResource'&&['food','materials','meds','fuel','chickens'].includes(e.resource))||e.type==='fatigueAll'||e.type==='addFatigue'||(e.type==='moraleAll'&&Number(e.amount)<0)||(e.type==='moraleSurvivor'&&Number(e.amount)<0)||e.type==='stabilityChange'&&Number(e.amount)<0));
 if(mildNegative||tone==='negative') return 'negative';
 return 'narrative';
}

function getExploreCategoryMultiplier(category){
 const base={nothing:30,resources:30,survivor:10,narrative:10,negative:10,danger:10};
 const phase=getExploreEventPhaseWeights();
 return Math.max(0.1, Number((phase[category]||10)/(base[category]||10)));
}

function getDueStoryEventsForDay(dayNumber=state.day){
 return (gameData.story_events||[]).filter(ev=>ev&&Number(ev.day)===Number(dayNumber||0));
}

function getEligibleForcedStoryEventsForDay(dayNumber=state.day){
 if(!Array.isArray(state.deferredStoryEventIds)) state.deferredStoryEventIds=[];
 const due=getDueStoryEventsForDay(dayNumber);
 if(!due.length) return [];
 const eligible=[];
 for(const ev of due){
  if(!ev) continue;
  if(state.attackThreat&&ev.skipWhenAttackActive){
   if(ev.id && !state.deferredStoryEventIds.includes(ev.id)) state.deferredStoryEventIds.push(ev.id);
   addLog(`📖 ${ev.name||ev.id} se aplaza: hay amenaza de ataque activa.`);
   continue;
  }
  if(shouldRespectAttackThreatBlock()&&activeEventBlocksAttackThreat()&&schemaContainsAttackThreat(ev)){
   if(ev.id && !state.deferredStoryEventIds.includes(ev.id)) state.deferredStoryEventIds.push(ev.id);
   addLog(`📖 ${ev.name||ev.id} se aplaza: un efecto activo bloquea amenazas de ataque.`);
   continue;
  }
  if(!schemaHasEnoughEventActors(ev)) continue;
  if(ev.condition&&!evaluateCondition(ev.condition)) continue;
  eligible.push(ev);
 }
 return eligible;
}

function pickForcedStoryEventForDay(dayNumber=state.day){
 const eligible=getEligibleForcedStoryEventsForDay(dayNumber);
 if(!eligible.length) return null;
 const priorityPool=eligible.filter(ev=>!!(ev.forceOnDay||ev.priority));
 const finalPool=priorityPool.length ? priorityPool : eligible;
 const weightedPool=finalPool.map(ev=>({
  ...ev,
  _storyPriorityWeight: Math.max(0, Number(ev.weight||0))
 }));
 return weightedPickField(weightedPool,'_storyPriorityWeight') || finalPool[0] || null;
}

function checkStoryEvent(){
 if(!Array.isArray(state.deferredStoryEventIds)) state.deferredStoryEventIds=[];
 // First, try deferred story events that were postponed in previous days
 for(let i=0;i<state.deferredStoryEventIds.length;i++){
 const deferredId=state.deferredStoryEventIds[i];
 const deferredEv=(gameData.story_events||[]).find(x=>x.id===deferredId);
 if(!deferredEv){
 state.deferredStoryEventIds.splice(i,1);
 i--;
 continue;
 }
 if(state.attackThreat&&deferredEv.skipWhenAttackActive) continue;
 if(shouldRespectAttackThreatBlock()&&activeEventBlocksAttackThreat()&&schemaContainsAttackThreat(deferredEv)) continue;
 if(!schemaHasEnoughEventActors(deferredEv)) continue;
 if(deferredEv.condition&&!evaluateCondition(deferredEv.condition)) continue;
 state.deferredStoryEventIds.splice(i,1);
 addLog(`📖 Evento de historia aplazado activado: ${deferredEv.name||deferredEv.id}.`);
 return buildAndSetEvent(deferredEv);
 }
 const ev=pickForcedStoryEventForDay(state.day);
 if(!ev) return false;
 if(ev.id && !ev.repeatable) state.seenEvents.add(ev.id);
 return buildAndSetEvent(ev);
}


function checkPriorityEvent(){
 // Priority events: type='city' or 'survivor' with priority:true
 // These fire before normal daily events when their condition is met
 const priorityPool=(gameData.events||[]).filter(e=>{
 if(!e||e.type==='weekly'||e.type==='explore'||e.type==='story'||e.type==='quest'||e.type==='ambush') return false;
 if(isNpcExclusiveEvent(e)) return false;
 if(!e.priority) return false;
 if(state.seenEvents.has(e.id)) return false;
 if(!isEventEligibleBySchedule(e)) return false;
 if(state.attackThreat&&e.skipWhenAttackActive) return false;
 if(shouldRespectAttackThreatBlock()&&activeEventBlocksAttackThreat()&&schemaContainsAttackThreat(e)) return false;
 if(e.type==='personal'){
 const protagonistId=e.personalSurvivorId||e.survivorId||e.targetSurvivorId||'';
 if(!protagonistId || !getAliveSurvivorById(protagonistId)) return false;
 }
 if(!schemaHasEnoughEventActors(e)) return false;
 if(!evaluateCondition(e.condition)) return false;
 return true;
 });
 if(!priorityPool.length) return false;
 // Pick weighted among priority events
 const picked=weightedPick(priorityPool);
 if(!picked) return false;
 if(picked.id&&!picked.repeatable) state.seenEvents.add(picked.id);
 return buildAndSetEvent(picked);
}


function checkWeeklyEvent(){
 if(state.day%7!==0) return false;
 const week=Math.floor(state.day/7);
 // Find the weekly event for this week number, or fall back to any weekly event (cycling)
 const weeklyPool=(gameData.events||[]).filter(e=>e&&e.type==='weekly'&&!isNpcExclusiveEvent(e));
 if(!weeklyPool.length) return false;
 // Try to match exact week number, else cycle through pool
 const eligibleWeekly=weeklyPool.filter(e=>!(state.attackThreat&&e.skipWhenAttackActive)&&!(shouldRespectAttackThreatBlock()&&activeEventBlocksAttackThreat()&&schemaContainsAttackThreat(e)));
 if(!eligibleWeekly.length) return false;
 const ev=eligibleWeekly.find(e=>Number(e.week)===week)||eligibleWeekly[(week-1)%eligibleWeekly.length];
 if(!ev) return false;
 if(!schemaHasEnoughEventActors(ev)) return false;
 addLog(`Evento semanal (semana ${week}): ${ev.name||ev.title||ev.id}.`);
 return buildAndSetEvent(ev);
}


function chooseEvent(){
 const murosLvl=state.buildings.muros?.built?state.buildings.muros.level:0;
 const pool=(gameData.events||[]).filter(e=>{
 if(!e||e.type==='weekly'||e.type==='explore'||e.type==='quest'||e.type==='ambush') return false;
 if(isNpcExclusiveEvent(e)) return false;
 if(state.seenEvents.has(e.id)) return false;
 if(!isEventEligibleBySchedule(e)) return false;
 if(!isEventEligibleBySchedule(e)) return false;
 if(state.attackThreat&&e.skipWhenAttackActive) return false;
 if(e.id==='sabotaje'&&murosLvl>=3&&Math.random()<0.30) return false;
 const isRaiderEvent=schemaContainsAttackThreat(e);
 if(isRaiderEvent&&shouldRespectAttackThreatBlock()&&activeEventBlocksAttackThreat()) return false;
 // Evaluate condition if present
 if(e.type==='personal'){
 const protagonistId=e.personalSurvivorId||e.survivorId||e.targetSurvivorId||'';
 if(!protagonistId || !getAliveSurvivorById(protagonistId)) return false;
 }
 if(!schemaHasEnoughEventActors(e)) return false;
 if(e.condition&&!evaluateCondition(e.condition)) return false;
 return true;
 });
 if(!pool.length){
 // All events seen — reset and start again
 state.seenEvents=new Set();
 addLog('Se han agotado los eventos disponibles. El ciclo se reinicia.');
 const fullPool=(gameData.events||[]).filter(e=>e&&e.type!=='weekly'&&e.type!=='explore'&&e.type!=='quest'&&e.type!=='ambush'&&!isNpcExclusiveEvent(e));
 if(!fullPool.length){closeEvent();return}
 }
 const activePool=(gameData.events||[]).filter(e=>{
 if(!e||e.type==='weekly'||e.type==='explore'||e.type==='quest'||e.type==='ambush') return false;
 if(isNpcExclusiveEvent(e)) return false;
 if(state.seenEvents.has(e.id)) return false;
 if(!isEventEligibleBySchedule(e)) return false;
 if(state.attackThreat&&e.skipWhenAttackActive) return false;
 if(e.id==='sabotaje'&&murosLvl>=3&&Math.random()<0.30) return false;
 if(e.type==='personal'){
 const protagonistId=e.personalSurvivorId||e.survivorId||e.targetSurvivorId||'';
 if(!protagonistId || !getAliveSurvivorById(protagonistId)) return false;
 }
 if(!schemaHasEnoughEventActors(e)) return false;
 if(e.condition&&!evaluateCondition(e.condition)) return false;
 return true;
 });
 if(!activePool.length){closeEvent();return}
 // Build weighted pool: boost events whose relatedAction was used today
 const actionCounts=state._lastDayActions||{};
 // Skill bonuses: Explorador boosts positive events, Precavido reduces negative ones
 const exploradoresCount=aliveSurvivors().filter(s=>s.action?.type&&(s.skill||'').toLowerCase()==='explorador').length;
 const precavidosCount=aliveSurvivors().filter(s=>s.action?.type&&(s.skill||'').toLowerCase()==='precavido').length;
 const stabilityMods=getStabilityModifiers();
 const boostedPool=activePool.map(ev=>{
 let w=Number(ev.weight||1);
 // Action-related boost
 if(ev.relatedAction&&actionCounts[ev.relatedAction]){
 const boost=Math.min(actionCounts[ev.relatedAction],4)*0.5;
 w=Math.round(w*(1+boost));
 }
 // Positive/negative event skill modifiers
 const tone=(ev.tone||'neutral').toLowerCase();
 const isPositive=tone==='positive'||['hallazgo','nada','lluvia'].includes(ev.id);
 const isNegative=tone==='negative'||['sabotaje','plaga','incendio','accidente'].includes(ev.id);
 if(isPositive&&stabilityMods.positiveEventWeightBonus>0) w=Math.round(w*(1+stabilityMods.positiveEventWeightBonus));
 if(isNegative&&stabilityMods.negativeEventWeightBonus>0) w=Math.round(w*(1+stabilityMods.negativeEventWeightBonus));
 if(isPositive&&exploradoresCount>0) w=Math.round(w*(1+exploradoresCount*0.10));
 if(isNegative&&precavidosCount>0) w=Math.round(w*(1-precavidosCount*0.10));
 return{...ev,_effectiveWeight:Math.max(1,w)};
 });
 // weightedPick using _effectiveWeight
 const picked=weightedPickField(boostedPool,'_effectiveWeight');
 if(!picked){closeEvent();return}
 buildAndSetEvent(picked);
}


function triggerExploreEvent(survivor){
 const groupMods=getExploreGroupModifiers(survivor);
 // Pull explore events from events.json type='explore' only
 const pool=(gameData.events||[]).filter(e=>e&&e.type==='explore'&&isEventEligibleBySchedule(e)&&schemaHasEnoughEventActors(e, survivor)&&!(activeEventBlocksAttackThreat()&&schemaContainsAttackThreat(e)));

 // Exclude already seen unless repeatable, cycle when exhausted
 const available=pool.filter(e=>e.repeatable||!state._seenExplore?.has(e.id));
 if(available.length===0&&pool.length>0){
 state._seenExplore=new Set();
 }
 const finalPool=available.length?available:pool;

 // Pick schema in two stages:
 // 1) category using config phase weights
 // 2) concrete event by its own weight inside that category
 let schema;
 if(!finalPool.length){
 schema={id:'explore_nothing',name:'Sin novedad',type:'explore',effects:[],repeatable:true};
 } else {
 const categoryWeights=getExploreEventPhaseWeights();
 const rastreadorBonus=getSkillBonus(survivor,'explore_survivor');
 const grouped=new Map();
 for(const ev of finalPool){
 const category=classifyExploreEvent(ev);
 if(!grouped.has(category)) grouped.set(category, []);
 grouped.get(category).push({...ev,_category:category});
 }
 const availableCategories=[...grouped.keys()];
 const weightedCategories=availableCategories.map(category=>{
 let w=Math.max(0, Number(categoryWeights?.[category]??0));
 if(category==='survivor' && rastreadorBonus.categoryBonus){
 w+=Number(rastreadorBonus.categoryBonus||0);
 }
 if(groupMods.positiveMult>1 && ['resources','survivor','narrative'].includes(category)){
 w=Math.round(w*groupMods.positiveMult);
 }
 return {category, weight:Math.max(0,w)};
 }).filter(item=>item.weight>0);

 let chosenCategory=null;
 if(weightedCategories.length){
 const totalCat=weightedCategories.reduce((sum,item)=>sum+item.weight,0);
 let r=Math.random()*totalCat;
 chosenCategory=weightedCategories[0]?.category||null;
 for(const item of weightedCategories){
 r-=item.weight;
 if(r<=0){ chosenCategory=item.category; break; }
 }
 } else {
 chosenCategory=availableCategories[0]||null;
 }

 const categoryPool=(grouped.get(chosenCategory)||finalPool).map(ev=>{
 let w=Math.max(1, Number(ev.weight||1));
 const tone=String(ev?.tone||'').toLowerCase();
 const positiveBonus=getSkillBonus(survivor,'event_positive');
 const negativeBonus=getSkillBonus(survivor,'event_negative');
 const isPositive = chosenCategory==='resources' || chosenCategory==='survivor' || chosenCategory==='narrative' || tone==='positive';
 const isNegative = chosenCategory==='negative' || chosenCategory==='danger' || tone==='negative';
 if(isPositive && positiveBonus.weightMult) w=Math.round(w*positiveBonus.weightMult);
 if(isNegative && negativeBonus.weightMult) w=Math.round(w*negativeBonus.weightMult);
 return {...ev,_w:Math.max(1,w)};
 });

 const total=categoryPool.reduce((s,e)=>s+e._w,0);
 let r=Math.random()*total;
 schema=categoryPool[0];
 for(const e of categoryPool){
 r-=e._w;
 if(r<=0){schema=e;break;}
 }

 if(schema.id&&!schema.repeatable){
 if(!state._seenExplore) state._seenExplore=new Set();
 state._seenExplore.add(schema.id);
 }

 addTechnicalLog('explore_pick', 'Selección de evento de exploración.', {
 survivorId:survivor.id,
 survivorName:survivor.name,
 availableCategories: weightedCategories,
 chosenCategory,
 chosenEventId: schema?.id || null,
 chosenEventName: schema?.name || schema?.title || null
 });
 }

 // ── Auto-resolve: apply effects directly, log result ──
 const name=schema.name||schema.title||'Sin novedad';
 const survivorName=survivor.name;

 // Resolve effects (option A if choice, direct effects otherwise)
 let effects=[];
 if(schema.choiceMode==='choice'||schema.options){
 // Auto-pick option A for choice events (no player input needed)
 // But for explore we want direct resolution — use effects from the event directly
 // If it has directEffects (legacy) or effects array, use those
 const opts=schema.options;
 if(opts&&opts.A) effects=normaliseEffects(opts.A.effects||opts.A.directEffects||[]);
 else effects=normaliseEffects(schema.effects||[]);
 } else {
 effects=normaliseEffects(schema.effects||[]);
 }

 // Inject explorer so injureExplorer targets the right person
 effects=injectExplorer(effects, survivor.id);

 // Apply and collect result descriptions
 const resultParts=[];
 for(const ef of effects){
 if(ef.type==='addResource'){
 const key=ef.resource;
 let val=Number(ef.amount)||0;
 const recolectorBonus=getSkillBonus(survivor,'explore_resource');
 const cazadorBonus=getSkillBonus(survivor,'explore_food');
 if(key==='food'&&cazadorBonus.bonus) val+=Number(cazadorBonus.bonus||0);
 if(['food','materials','meds','fuel','chickens'].includes(key)&&recolectorBonus.bonus) val+=Number(recolectorBonus.bonus||0);
 applyEffectList([{type:'addResource',resource:key,amount:val}], false);
 resultParts.push(`${resourceLabel(key)} +${val}`);
 }else if(ef.type==='removeResource'){
 const key=ef.resource; const val=Number(ef.amount)||0;
 applyEffectList([ef], false);
 resultParts.push(`${resourceLabel(key)} -${val}`);
 }else if(ef.type==='addSurvivorByRarity'||ef.type==='addSurvivorRandom'||ef.type==='addSurvivor'){
 applyEffectList([ef], false);
 resultParts.push('nuevo superviviente');
 }else if(ef.type==='setAttackThreat'){
 applyEffectList([ef], false);
 resultParts.push('¡amenaza detectada!');
 }else if(['addDog','addPerro','addCompanionDog','addSettlementDog','giveDog'].includes(ef.type)){
 applyEffectList([ef], false);
 resultParts.push('perro');
 }else if(['injureExplorer','injureActionSurvivor','injureRandom','injureSurvivor'].includes(ef.type)){
 applyEffectList([ef], false);
 resultParts.push('herido');
 }else{
 applyEffectList([ef], false);
 }
 }

 const desc=(schema.description||schema.text||'').trim();
 const summary=resultParts.length?` [${resultParts.join(' · ')}]`:'';
 addLog(`🧭 ${survivorName} → ${name}${desc?`: ${desc}`:''}${summary}`);

 (groupMods.itemChances||[]).forEach(entry=>{
 if(Math.random()<Number(entry.chance||0)) grantRandomGroupItem(entry.survivor, 'la expedición de exploración');
 });
 if(Number(groupMods.ambushChance||0)>0){
 maybeTriggerGroupActionAmbush(groupMods.ctx, 'explorar', 'la expedición de exploración', groupMods.ambushChance);
 }

 if(schema.id&&!schema.repeatable){
 if(!state.seenEvents) state.seenEvents=new Set();
 state.seenEvents.add(schema.id);
 }
}




function buildNpcThreatIntroEvent(hostileInfo){
 const schemaId = hostileInfo?.preAttackEventId;
 if(schemaId){
 const schema=[...(gameData.events||[]), ...(gameData.story_events||[])].find(ev=>ev.id===schemaId);
 if(schema){
 const built=buildEventFromSchema(schema);
 if(built){
 built.subtitle = built.subtitle || 'Némesis';
 built._npcThreat = true;
 built._npcThreatType = hostileInfo.type;
 built._npcThreatVariant = hostileInfo.variant;
 return built;
 }
 }
 }
 return {
 title: hostileInfo?.label || 'Némesis',
 subtitle: 'Némesis',
 text: `${hostileInfo?.label || 'Un enemigo conocido'} se presenta antes del ataque. Sus intenciones no dejan lugar a dudas.`,
 image: '',
 days: 1,
 _npcThreat: true,
 _npcThreatType: hostileInfo?.type || 'raiders',
 _npcThreatVariant: hostileInfo?.variant || 'random',
 options: [
 {label:'Prepararse', className:'primary', action:()=>closeEvent()},
 {label:'Responder a la amenaza', className:'secondary', action:()=>{ addLog(`💢 ${hostileInfo?.label || 'El enemigo'} deja clara su enemistad con el asentamiento.`); closeEvent(); }}
 ]
 };
}


function openExploreAssignPopup(instanceId, mode='explore'){
 const loc=state.locations.find(l=>l.instanceId===instanceId);
 if(!loc) return;
 const explorers=aliveSurvivors().filter(s=>s.status==='activo'&&!s.action&&(s.negativeSkill||'').toLowerCase()!=='miedoso');
 if(!explorers.length){addLog('No hay supervivientes disponibles para explorar.');return;}
 // Simple: just pick first available or show a quick select
 // For now auto-assign first available — full popup to be added
 const s=explorers[0];
 assignLocationExplore(s.id, instanceId, mode);
}


function assignLocationExplore(survivorId, instanceId, mode='explore'){
 const loc=state.locations.find(l=>l.instanceId===instanceId);
 const s=state.survivors.find(sv=>sv.id===survivorId);
 if(!loc||!s) return;
 loc.exploringBy=survivorId;
 loc.exploreStartDay=state.day;
 loc.exploreMode=mode;
 s.action={type:'explorar_zona',target:instanceId};
 s.status='ocupado';
 addLog(`🧭 ${s.name} se dirige a ${loc.status==='undiscovered'?'una ubicación desconocida':loc.name}.`);
 renderExteriorMap();
 render();
}


function queueEventById(eventId, forcedSurvivor){
 if(!eventId) return false;
 const schema=[...(gameData.events||[]), ...(gameData.story_events||[])].find(e=>e&&e.id===eventId);
 if(!schema) return false;
 if(!Array.isArray(state._queuedEventSchemas)) state._queuedEventSchemas=[];
 state._queuedEventSchemas.push({eventId, forcedSurvivorId:forcedSurvivor?.id||null});
 return true;
}

function getQuestSchemaById(questId){
 if(!questId) return null;
 return ([...(gameData.events||[]), ...(gameData.story_events||[])]).find(e=>e&&e.id===questId&&e.type==='quest')||null;
}

function scheduleQuestActivation(questId, minDays=0, maxDays=0, forcedSurvivor=null){
 const schema=getQuestSchemaById(questId);
 if(!schema){
  addLog(`❌ No se ha podido activar la quest ${questId||'sin ID'}: no existe o no es de tipo QUEST.`);
  return false;
 }
 const cfg=getQuestEventConfig();
 const fallbackMin=Math.max(0, Number(cfg.defaultMinDays ?? 0) || 0);
 const fallbackMax=Math.max(fallbackMin, Number(cfg.defaultMaxDays ?? fallbackMin) || fallbackMin);
 let min=Math.max(0, Number.isFinite(Number(minDays)) ? Number(minDays) : fallbackMin);
 let max=Math.max(0, Number.isFinite(Number(maxDays)) ? Number(maxDays) : fallbackMax);
 if(max<min){ const tmp=min; min=max; max=tmp; }
 const offset = min + Math.floor(Math.random() * ((max - min) + 1));
 const scheduledDay=state.day + offset;
 if(!Array.isArray(state.delayedQueue)) state.delayedQueue=[];
 state.delayedQueue.push({day:scheduledDay,effect:{type:'_queueQuestEvent',questId:schema.id,forcedSurvivorId:forcedSurvivor?.id||null}});
 addLog(`📜 Quest activada: ${schema.name||schema.id}. Queda programada para el día ${scheduledDay} (${min}-${max} días).`);
 addTechnicalLog('quest_scheduled', 'Quest programada por efecto.', {questId:schema.id, questName:schema.name||schema.id, currentDay:state.day, minDays:min, maxDays:max, scheduledDay});
 return true;
}


function consumeQueuedPriorityEvent(){
 if(!Array.isArray(state._queuedEventSchemas)||!state._queuedEventSchemas.length) return false;
 while(state._queuedEventSchemas.length){
 const queued=state._queuedEventSchemas.shift();
 const schema=[...(gameData.events||[]), ...(gameData.story_events||[])].find(e=>e&&e.id===queued.eventId);
 if(!schema) continue;
 const forcedSurvivor=queued.forcedSurvivorId?state.survivors.find(s=>s.id===queued.forcedSurvivorId&&s.status!=='muerto'):null;
 buildAndSetEvent(schema, forcedSurvivor||pick(aliveSurvivors())||{name:'Alguien'});
 return true;
 }
 return false;
}


function showQueuedOrDailyEvent(){
 if(consumeQueuedPriorityEvent()) return true;
 // Los eventos de historia de día exacto tienen prioridad total sobre el resto.
 if(!checkStoryEvent()&&!checkWeeklyEvent()&&!checkPriorityEvent()) chooseEvent();
 return !!state.pendingEvent;
}



function normalizeChoiceRequirement(requirement){
 if(!requirement) return null;
 const source=(requirement && typeof requirement==='object' && !Array.isArray(requirement))
 ? (requirement.requirement||requirement.requires||requirement)
 : null;
 if(!source || typeof source!=='object') return null;
 const type=String(source.type||source.kind||'').trim().toLowerCase();
 if(type==='skill'||type==='habilidad'||type==='ability'){
 const skill=String(source.skill||source.value||source.name||'').trim();
 return skill?{type:'skill',skill}:null;
 }
 if(type==='morale'||type==='moral'){
 const value=Number(source.value ?? source.amount ?? source.min ?? source.morale);
 if(!Number.isFinite(value)) return null;
 return {type:'morale', operator:normalizeRequirementOperator(source.operator||source.op||'>='), value};
 }
 if(type==='stability'||type==='estabilidad'){
 const value=Number(source.value ?? source.amount ?? source.min ?? source.stability);
 if(!Number.isFinite(value)) return null;
 return {type:'stability', operator:normalizeRequirementOperator(source.operator||source.op||'>='), value};
 }
 return null;
}

function getEventOptionContext(ev,opt){
 const alive=aliveSurvivors();
 const eventActors=getEventActors(ev);
 const ids=[];
 const primaryId=ev?._personalSurvivorId || ev?._explorerId || eventActors[0]?.id || opt?._survivorId || null;
 if(primaryId!=null) ids.push(primaryId);
 ids.push(...eventActors.map(actor=>actor.id));
 const relatedAction=opt?.relatedAction || ev?.relatedAction || null;
 if(relatedAction && state._lastDayActionSurvivors?.[relatedAction]) ids.push(...state._lastDayActionSurvivors[relatedAction]);
 if(Array.isArray(opt?._groupMemberIds)) ids.push(...opt._groupMemberIds);
 const uniqueIds=[...new Set(ids.map(id=>String(id)))];
 const participants=uniqueIds.map(id=>getAliveSurvivorById(id)).filter(Boolean);
 const primarySurvivor=(primaryId!=null?getAliveSurvivorById(primaryId):null) || participants[0] || alive[0] || null;
 return {
 primarySurvivor,
 participants: participants.length?participants:alive,
 alive,
 stability:Number(state.stability||0)
 };
}

function optionRequirementMet(requirement, ev, opt){
 const req=normalizeChoiceRequirement(requirement||opt?.requirement||opt?.requires);
 if(!req) return true;
 const ctx=getEventOptionContext(ev,opt);
 if(req.type==='skill'){
 const needed=normalizeSkillLookupName(req.skill);
 return (ctx.participants||[]).some(s=>survivorHasSkill(s, needed) || getSurvivorSkills(s).some(skill=>normalizeSkillLookupName(skill)===needed));
 }
 if(req.type==='morale'){
 const moraleValue=Number(ctx.primarySurvivor?.morale ?? -999);
 if(!Number.isFinite(moraleValue)) return false;
 return compareRequirementValue(moraleValue, req.operator, req.value);
 }
 if(req.type==='stability'){
 return compareRequirementValue(ctx.stability, req.operator, req.value);
 }
 return true;
}

function getChoiceRequirementText(requirement){
 const req=normalizeChoiceRequirement(requirement);
 if(!req) return '';
 if(req.type==='skill') return `[${req.skill}]`;
 if(req.type==='morale') return `[Moral ${req.operator} ${req.value}]`;
 if(req.type==='stability') return `[Estabilidad ${req.operator} ${req.value}]`;
 return '';
}

function getOptionBlockState(opt, ev){
 const requirement=normalizeChoiceRequirement(opt?.requirement||opt?.requires);
 const requirementMet=requirement?optionRequirementMet(requirement, ev, opt):true;
 const missing=getMissingResourcesForEffects([...(opt?.cost||[]), ...(opt?.effects||[])]);
 return {requirement, requirementMet, missing, blocked:!requirementMet || missing.length>0};
}

// ── Normalise options into [{label, effects[], className}] array ──

function normaliseOptions(schema, survivor){
 const raw = schema.options;
 if(!raw) return [];

 // Editor/object format: options.A / B / C / D
 if(!Array.isArray(raw) && (raw.A||raw.B||raw.C||raw.D)){
 const opts=[];
 ['A','B','C','D'].forEach((slot,idx)=>{
 const data=raw[slot];
 if(!data) return;
 const label=String(data.label||'').trim();
 const effects=normaliseEffects(data.effects||data.directEffects||[]).map(e=>e?.resource?{...e,resource:normalizeResourceKey(e.resource)}:e);
 const cost=normaliseEffects(data.cost||[]).map(e=>e?.resource?{...e,resource:normalizeResourceKey(e.resource)}:e);
 const fallback=normaliseEffects(data.fallback||[]).map(e=>e?.resource?{...e,resource:normalizeResourceKey(e.resource)}:e);
 const delayed=Array.isArray(data.delayedEffects)?data.delayedEffects:(Array.isArray(data.delayed)?data.delayed:[]);
 const requirement=normalizeChoiceRequirement(data.requirement||data.requires||null);
 if(!label && !effects.length && !cost.length && !fallback.length && !requirement) return;
 opts.push({
 label:label||`Opción ${slot}`,
 className:idx===0?'primary':'secondary',
 effects,
 cost,
 fallback,
 delayed,
 requirement,
 _slot:slot
 });
 });
 return opts;
 }

 // Legacy format: array of {label, cost, effects, fallback, requirement}
 if(Array.isArray(raw)){
 return raw.map((opt,i)=>({
 label:opt.label||`Opción ${i+1}`,
 className:i===0?'primary':'secondary',
 effects:normaliseEffects(opt.effects||[]).map(e=>e?.resource?{...e,resource:normalizeResourceKey(e.resource)}:e),
 cost:normaliseEffects(opt.cost||[]).map(e=>e?.resource?{...e,resource:normalizeResourceKey(e.resource)}:e),
 fallback:normaliseEffects(opt.fallback||[]).map(e=>e?.resource?{...e,resource:normalizeResourceKey(e.resource)}:e),
 delayed:Array.isArray(opt.delayedEffects)?opt.delayedEffects:(Array.isArray(opt.delayed)?opt.delayed:[]),
 requirement:normalizeChoiceRequirement(opt.requirement||opt.requires||null),
 _slot:opt._slot || String.fromCharCode(65+i)
 }));
 }
 return [];
}



function getEligibleEventSurvivors(){
 return state.survivors.filter(s=>{
 if(!s) return false;
 const status=String(s.status||'').trim().toLowerCase();
 if(status==='muerto' || status==='ausente') return false;
 if((s.location||'base')!=='base') return false;
 if(s._temporaryAway || s._exteriorActionLocked) return false;
 return true;
 });
}

function isEligiblePersonalEventSurvivor(survivor){
 if(!survivor) return false;
 const status=String(survivor.status||'').trim().toLowerCase();
 if(status==='muerto' || status==='ausente') return false;
 if((survivor.location||'base')!=='base') return false;
 if(survivor._temporaryAway || survivor._exteriorActionLocked) return false;
 return true;
}

function getPersonalEventSurvivorById(id){
 const clean=String(id||'').trim();
 if(!clean) return null;
 const survivor=state.survivors.find(s=>String(s?.id)===clean);
 return isEligiblePersonalEventSurvivor(survivor) ? survivor : null;
}

function pickPersonalEventSurvivor(){
 return pick(getEligibleEventSurvivors()) || null;
}

function getSchemaEventActorCount(schema){
 const raw=Number(schema?.participants ?? schema?.actorCount ?? schema?.eventActors ?? 0);
 return Number.isFinite(raw)&&raw>0 ? Math.max(0, Math.floor(raw)) : 0;
}

function getPersonalEventActorCount(schema){
 return Math.max(1, getSchemaEventActorCount(schema));
}

function schemaHasEnoughEventActors(schema, forcedSurvivor=null){
 const needed=getSchemaEventActorCount(schema);
 if(!needed) return true;
 if(schema?.type==='personal'){
 const lead=isEligiblePersonalEventSurvivor(forcedSurvivor) ? forcedSurvivor : null;
 const leadId=lead?.id!=null ? String(lead.id) : null;
 const pool=getEligibleEventSurvivors().filter(s=>!leadId || String(s.id)!==leadId);
 return (lead ? 1 : 0) + pool.length >= getPersonalEventActorCount(schema);
 }
 const forcedId=forcedSurvivor?.id!=null ? String(forcedSurvivor.id) : null;
 const pool=getEligibleEventSurvivors().filter(s=>!forcedId || String(s.id)!==forcedId);
 return pool.length>=needed;
}

function assignPersonalEventActorsForSchema(schema, survivor=null){
 const needed=getPersonalEventActorCount(schema);
 const lead=isEligiblePersonalEventSurvivor(survivor) ? survivor : null;
 const leadId=lead?.id!=null ? String(lead.id) : null;
 const pool=getEligibleEventSurvivors().filter(s=>!leadId || String(s.id)!==leadId);
 const extraNeeded=Math.max(0, needed - (lead ? 1 : 0));
 if(pool.length<extraNeeded) return [];
 const extra=[...pool].sort(()=>Math.random()-0.5).slice(0, extraNeeded).map(s=>s.id);
 return lead ? [lead.id, ...extra] : extra;
}

function assignEventActorsForSchema(schema, forcedSurvivor=null){
 const needed=getSchemaEventActorCount(schema);
 if(schema?.type==='personal') return assignPersonalEventActorsForSchema(schema, forcedSurvivor);
 if(!needed) return [];
 const forcedId=forcedSurvivor?.id!=null ? String(forcedSurvivor.id) : null;
 const pool=getEligibleEventSurvivors().filter(s=>!forcedId || String(s.id)!==forcedId);
 if(pool.length<needed) return [];
 return [...pool].sort(()=>Math.random()-0.5).slice(0, needed).map(s=>s.id);
}

function resolvePersonalEventSurvivor(schema, forcedSurvivor=null){
 if(isEligiblePersonalEventSurvivor(forcedSurvivor)) return forcedSurvivor;
 const personalSurvivorId=schema?.personalSurvivorId||schema?.survivorId||schema?.targetSurvivorId||null;
 return getPersonalEventSurvivorById(personalSurvivorId) || pickPersonalEventSurvivor() || null;
}

function getEventActors(ev){
 const ids=Array.isArray(ev?._eventActorIds)?ev._eventActorIds:[];
 return ids.map(id=>state.survivors.find(s=>String(s.id)===String(id))).filter(Boolean);
}

function getSurvivorEventImage(survivor){
 return String(
 survivor?.imageUrl
 || survivor?.image?.url
 || survivor?.portrait
 || survivor?.image
 || ''
 ).trim();
}

function resolveEventDisplayImage(ev){
 const explicit=String(ev?.image||'').trim();
 if(explicit) return explicit;
 const actors=getEventActors(ev);
 for(const actor of actors){
 const image=getSurvivorEventImage(actor);
 if(image) return image;
 }
 return '';
}

function resolveEventTemplateVars(text, ev){
 let out=String(text||'');
 const actors=getEventActors(ev);
 actors.forEach((actor,idx)=>{
 out=out.replaceAll(`{actor${idx+1}}`, actor?.name||`Superviviente ${idx+1}`);
 });
 out=out.replaceAll('{actors}', actors.map(actor=>actor?.name||'').filter(Boolean).join(', '));
 return out;
}

function resolveEventTargetRef(effect, ev){
 const ref=String(effect?.targetRef||'').trim().toLowerCase();
 if(!ref) return null;
 const actors=getEventActors(ev);
 if(!actors.length) return null;
 if(ref==='randomeventactor'||ref==='anyeventactor') return pick(actors)||null;
 const match=ref.match(/^eventactor(\d+)$/);
 if(match){
 const idx=Math.max(0, Number(match[1])-1);
 return actors[idx]||null;
 }
 return null;
}

function injectEventActors(effects, ev){
 return (effects||[]).flatMap(effect=>{
 if(!effect||typeof effect!=='object') return effect?[effect]:[];
 if(!effect.targetRef) return [effect];
 const ref=String(effect.targetRef||'').trim().toLowerCase();
 if(ref==='alleventactors'){
 const actors=getEventActors(ev);
 return actors.map(actor=>({ ...effect, targetId:actor.id, targetRef:undefined }));
 }
 const target=resolveEventTargetRef(effect, ev);
 if(!target) return [{ ...effect, targetRef:undefined }];
 return [{ ...effect, targetId:target.id, targetRef:undefined }];
 });
}

function injectEventTargetModes(effects, ev){
 return (effects||[]).flatMap(effect=>{
 if(!effect || typeof effect!=='object') return effect?[effect]:[];
 const mode=String(effect.targetMode||'').trim();
 if(!mode) return [effect];
 const actors=getEventActors(ev);
 if(mode==='allActors'){
 return actors.map(actor=>({ ...effect, targetId:actor.id, targetMode:undefined }));
 }
 const match=mode.match(/^actor(\d)$/);
 if(match){
 const idx=Math.max(0, Number(match[1])-1);
 const actor=actors[idx]||null;
 if(!actor) return [{ ...effect }];
 return [{ ...effect, targetId:actor.id, targetMode:undefined }];
 }
 return [effect];
 });
}

function injectEventContextEffects(effects, ev, explorerId=null){
 return injectEventTargetModes(injectEventActors(injectExplorer(effects, explorerId), ev), ev);
}


function normalisePersonalNodeOptions(node){
 const raw=node?.options;
 if(!raw) return [];
 if(Array.isArray(raw)){
 return raw
 .map((opt,i)=>({...opt, requirement:normalizeChoiceRequirement(opt.requirement||opt.requires||null), _slot:opt._slot||String.fromCharCode(65+i)}))
 .filter(opt=>opt && (opt.label || (opt.effects&&opt.effects.length) || opt.requirement));
 }
 const arr=[];
 ['A','B','C','D'].forEach(key=>{
 const data=raw[key];
 if(!data) return;
 const requirement=normalizeChoiceRequirement(data.requirement||data.requires||null);
 const hasEffects=Array.isArray(data.effects)&&data.effects.length;
 if(data.label || hasEffects || requirement){
 arr.push({...data, requirement, _slot:key});
 }
 });
 return arr;
}


function buildPersonalEventNode(schema, survivor, nodeId){
 const nodes=schema.nodes||{};
 const resolvedNodeId=nodeId||schema.startNode||'intro';
 const node=nodes[resolvedNodeId]||{};
 const fallbackText=schema.text||'';
 const eventActorIds=assignEventActorsForSchema(schema, survivor);
 const ev={
 title: node.title||schema.name||schema.title||'Evento personal',
 text: replacePersonalVars(node.text||fallbackText, survivor),
 image:(node.image||schema.image||survivor?.image||''),
 days:1,
 relatedAction:schema.relatedAction||null,
 _schemaId:schema.id||null,
 _personal:true,
 _personalNodeId:resolvedNodeId,
 _personalSurvivorId:survivor?.id||null,
 _personalSurvivorName:survivor?.name||null,
 _eventActorIds:eventActorIds,
 subtitle: node.subtitle || (survivor ? `Evento personal — ${survivor.name}` : 'Evento personal'),
 options:[]
 };
 ev.title=resolveEventTemplateVars(ev.title, ev);
 ev.text=resolveEventTemplateVars(ev.text, ev);
 ev.subtitle=resolveEventTemplateVars(ev.subtitle, ev);
 const options=normalisePersonalNodeOptions(node);
 if(!options.length){
 ev.options=[{label:'Continuar', className:'primary', action:()=>closeEvent()}];
 return ev;
 }
 ev.options=options.map((opt,idx)=>({
 label: resolveEventTemplateVars(opt.label || `Opción ${opt._slot||idx+1}`, ev),
 className: idx===0 ? 'primary' : 'secondary',
 requirement: normalizeChoiceRequirement(opt.requirement||opt.requires||null),
 relatedAction: ev.relatedAction,
 _survivorId: survivor?.id||null,
 effects: injectEventContextEffects(normaliseEffects(opt.effects||[]), ev, survivor?.id||null),
 action:()=>{
 const requirement=normalizeChoiceRequirement(opt.requirement||opt.requires||null);
 if(requirement && !optionRequirementMet(requirement, ev, {_survivorId:survivor?.id||null, relatedAction:ev.relatedAction, requirement})){
 addLog(`⚠ No cumples el requisito para "${resolveEventTemplateVars(opt.label || `Opción ${opt._slot||idx+1}`, ev)}".`);
 return;
 }
 const effects=injectEventContextEffects(normaliseEffects(opt.effects||[]), ev, survivor?.id||null);
 if(effects.length) applyEffectList(effects);
 if(opt.next){
 setEvent(buildPersonalEventNode(schema, survivor, opt.next));
 } else {
 closeEvent();
 }
 }
 }));
 return ev;
}


function buildEventFromSchema(schema,forcedSurvivor){
 const personalSurvivorId=schema.personalSurvivorId||schema.survivorId||schema.targetSurvivorId||null;
 const survivor=schema.type==='personal'
 ? resolvePersonalEventSurvivor(schema, forcedSurvivor)
 : (forcedSurvivor||getAliveSurvivorById(personalSurvivorId)||pick(aliveSurvivors())||{name:'Alguien'});
 if(schema.type==='personal' && !survivor) return null;
 const eventActorCount=getSchemaEventActorCount(schema);
 const actorPoolSource=(schema.type==='explore') ? survivor : null;
 if(eventActorCount>0 && !schemaHasEnoughEventActors(schema, schema.type==='personal' ? survivor : actorPoolSource)) return null;
 // Mark as seen only if not repeatable
 if(schema.id && schema.type!=='story' && schema.type!=='weekly' && !schema.repeatable) state.seenEvents.add(schema.id);
 rescheduleEventInterval(schema);
 const days=Number(schema.days||1);
 const eventActorIds=assignEventActorsForSchema(schema, actorPoolSource);
 const title=schema.name||schema.title||'Evento';
 const rawText=(schema.text||'').replaceAll('{survivor}',survivor?.name||'Alguien');

 // Direct-effect events (no options)
 const choiceMode = schema.choiceMode||( schema.options ? 'choice' : 'direct' );
 const directEffects = choiceMode==='direct' ? normaliseEffects(schema.effects) : [];
 const normOpts = choiceMode==='choice' ? normaliseOptions(schema, survivor) : [];
 const allDirect = directEffects;

 const ev={
 title,
 text:rawText,
 image:schema.image||'',
 days,
 relatedAction:schema.relatedAction||null,
 _schemaId:schema.id||null,
 _explorerId: forcedSurvivor?.id || null,
 _personalSurvivorId: schema.type==='personal' ? survivor?.id||null : null,
 _eventActorIds: eventActorIds,
 subtitle: schema.subtitle || undefined,
 options:[]
 };
 ev.title=resolveEventTemplateVars(ev.title, ev);
 ev.text=resolveEventTemplateVars(ev.text, ev);
 ev.subtitle=resolveEventTemplateVars(ev.subtitle, ev);

 if(schema.type==='personal'){
 return buildPersonalEventNode(schema, survivor, schema.startNode||'intro');
 }

 if(choiceMode==='direct'||normOpts.length===0){
 ev.autoResolve=true;
 if(allDirect.length>0){
 ev.options=[{
 label:'Continuar',
 className:'primary',
 action:()=>{
 applyEffectList(injectEventContextEffects(allDirect, ev, ev._explorerId));
 handleLegacyFlags(schema.effects||{});
 // If multi-day, register as active so it persists
 if(days>1&&!ev._continuing){
 ev._daysLeft=days-1;
 ev._totalDays=days;
 state._activeMultiDayEvent=ev;
 } else {
 state._activeMultiDayEvent=null;
 }
 closeEvent();
 }
 }];
 } else {
 ev.options=[{
 label:'Continuar',
 className:'primary',
 action:()=>{
 if(days>1&&!ev._continuing){
 ev._daysLeft=days-1;
 ev._totalDays=days;
 state._activeMultiDayEvent=ev;
 } else {
 state._activeMultiDayEvent=null;
 }
 closeEvent();
 }
 }];
 }
 } else {
 ev.options = normOpts.map(opt=>({
 label:resolveEventTemplateVars(opt.label, ev),
 className:opt.className,
 effects:opt.effects||[],
 cost:opt.cost||[],
 fallback:opt.fallback||[],
 delayed:opt.delayed||[],
 requirement: normalizeChoiceRequirement(opt.requirement||opt.requires||null),
 relatedAction: ev.relatedAction,
 action:()=>{
 const expId=ev._explorerId;
 const requirement=normalizeChoiceRequirement(opt.requirement||opt.requires||null);
 if(requirement && !optionRequirementMet(requirement, ev, opt)){
 addLog(`⚠ No cumples el requisito para "${resolveEventTemplateVars(opt.label, ev)}".`);
 return;
 }
 const combinedEffects=[...(opt.cost||[]), ...(opt.effects||[])];
 const missing=getMissingResourcesForEffects(combinedEffects);
 if(missing.length){
 if(opt.fallback?.length){
 applyEffectList(injectEventContextEffects(opt.fallback, ev, expId));
 addLog(`No había recursos suficientes para "${resolveEventTemplateVars(opt.label, ev)}".`);
 state._activeMultiDayEvent=null;
 closeEvent();
 return;
 }
 addLog(`⚠ No tienes recursos suficientes para "${resolveEventTemplateVars(opt.label, ev)}".`);
 return;
 }
 if(opt.cost?.length){
 applyEffectList(injectEventContextEffects(opt.cost, ev, expId));
 }
 applyEffectList(injectEventContextEffects(opt.effects, ev, expId));
 queueDelayedEffects(injectEventContextEffects(opt.delayed||[], ev, expId));
 handleLegacyFlags(schema.effects||{});
 state._activeMultiDayEvent=null;
 closeEvent();
 }
 }));
 }

 if(days>1){
 ev._totalDays=days;
 ev._daysLeft=days;
 state._activeMultiDayEvent=ev;
 }
 return ev;
}


function buildAndSetEvent(schema, forcedSurvivor){
 const built=buildEventFromSchema(schema, forcedSurvivor);
 if(!built) return false;
 setEvent(built);
 return true;
}

// Convert injureRandom/injureExplorer to target the specific explorer if known

function injectExplorer(effects, explorerId){
 if(!explorerId) return effects;
 return (effects||[]).map(e=>{
 if(e.type==='injureExplorer'||(e.type==='injureRandom'&&explorerId)){
 return {...e, type:'injureExplorer', targetId:explorerId};
 }
 return e;
 });
}

// Handle legacy boolean flags in the effects object that affect game state directly

function setEvent(ev){
 state.pendingEvent=ev;
 if(ev.relatedAction){
 const count=state._lastDayActions?.[ev.relatedAction]||0;
 if(count>0) addLog(`El evento "${ev.title}" está relacionado con la acción ${actionLabel(ev.relatedAction)} (${count} superviviente${count!==1?'s':''} activo${count!==1?'s':''}).`);
 }
 const days=Number(ev.days||1);
 state.eventTotalDays=days;
 if(!ev._continuing) state.eventDaysLeft=days;
 renderEventDurationBar();

 // Image — show/hide left column
 const eventImage=document.getElementById('eventImage');
 const eventLayout=document.getElementById('eventLayout');
 const displayImage=resolveEventDisplayImage(ev);
 if(displayImage){
 eventImage.innerHTML=`<img src="${escapeAttr(displayImage)}" alt="">`;
 eventImage.style.display='';
 if(eventLayout) eventLayout.classList.remove('no-image');
 } else {
 eventImage.innerHTML='';
 eventImage.style.display='none';
 if(eventLayout) eventLayout.classList.add('no-image');
 }

 // Title
 document.getElementById('eventTitle').textContent=ev.title||'Evento';

 // Subtitle — from ev.subtitle field (free text set in editor)
 const subEl=document.getElementById('eventSubtitle');
 if(ev.subtitle){
 subEl.textContent=ev.subtitle; subEl.style.display='';
 } else { subEl.style.display='none'; }

 // Text
 document.getElementById('eventText').innerHTML=escapeHtml(ev.text||'').replace(/\n/g,'<br>');

 // Options
 const eventOptions=document.getElementById('eventOptions');
 if(eventOptions){
  eventOptions.dataset.busy='0';
 }
 eventOptions.innerHTML='';
 (ev.options||[]).forEach(opt=>{
 const btn=document.createElement('button');
 btn.className=opt.className||'primary';

 const blockState=getOptionBlockState(opt, ev);
 const requirementText=getChoiceRequirementText(blockState.requirement);
 const prefix=requirementText?`${requirementText} `:'';
 const reasons=[];
 if(!blockState.requirementMet && requirementText){
 reasons.push(requirementText.replace(/^\[|\]$/g,''));
 }
 if(blockState.missing.length){
 reasons.push(`Falta ${blockState.missing.map(m=>`${m.missing} ${resourceLabel(m.resource)}`).join(', ')}`);
 }
 btn.textContent=reasons.length ? `${prefix}${opt.label} · ${reasons.join(' · ')}` : `${prefix}${opt.label}`;

 if(blockState.blocked){
 btn.disabled=true;
 btn.classList.add('disabled');
 const tips=[];
 if(!blockState.requirementMet && requirementText){
 tips.push(`Requisito no cumplido: ${requirementText.replace(/^\[|\]$/g,'')}`);
 }
 if(blockState.missing.length){
 tips.push(`No tienes recursos suficientes: ${blockState.missing.map(m=>`${m.have}/${m.need} ${resourceLabel(m.resource)}`).join(', ')}`);
 }
 btn.title=tips.join(' | ');
 } else {
 btn.addEventListener('click',()=>{
 if(btn.dataset.busy==='1' || eventOptions.dataset.busy==='1') return;
 btn.dataset.busy='1';
 eventOptions.dataset.busy='1';
 Array.from(eventOptions.querySelectorAll('button')).forEach(node=>{
  node.disabled=true;
  node.classList.add('disabled');
 });
 if(opt.requirement && !optionRequirementMet(opt.requirement, ev, opt)){
  btn.title=`Requisito no cumplido: ${getChoiceRequirementText(opt.requirement).replace(/^\[|\]$/g,'')}`;
  eventOptions.dataset.busy='0';
  render();
  const popup=document.getElementById('storyEventPopup');
  if(popup && !state.pendingEvent) popup.classList.remove('open');
  if(!state.pendingEvent) document.body.classList.remove('event-lock');
  return;
 }
 if(!optionIsAffordable(opt)){
  const nowMissing=getMissingResourcesForEffects([...(opt.cost||[]), ...(opt.effects||[])]);
  btn.title=`No tienes recursos suficientes: ${nowMissing.map(m=>`${m.have}/${m.need} ${resourceLabel(m.resource)}`).join(', ')}`;
  eventOptions.dataset.busy='0';
  render();
  const popup=document.getElementById('storyEventPopup');
  if(popup && !state.pendingEvent) popup.classList.remove('open');
  if(!state.pendingEvent) document.body.classList.remove('event-lock');
  return;
 }
 opt.action();
 render();
 const popup=document.getElementById('storyEventPopup');
 if(state.pendingEvent && !state.pendingEvent._multiDayPassive){
  if(popup) popup.classList.add('open');
  document.body.classList.add('event-lock');
 }else{
  if(popup) popup.classList.remove('open');
  document.body.classList.remove('event-lock');
 }
 });
 }
 eventOptions.appendChild(btn);
 });
}


function renderEventDurationBar(){
 const bar=document.getElementById('eventDurationBar');
 if(!state.pendingEvent||state.eventTotalDays<=1){bar.style.display='none';return;}
 const left=state.eventDaysLeft;
 const total=state.eventTotalDays;
 const pips=Array.from({length:total},(_,i)=>
 `<div class="dur-pip${i>=left?' empty':''}"></div>`
 ).join('');
 bar.innerHTML=`<span>⏱ DURACIÓN: ${left} día${left!==1?'s':''} restante${left!==1?'s':''}</span><div class="dur-pips">${pips}</div>`;
 bar.style.display='flex';
}



function closeEvent(){
 state.pendingEvent=null;
 state.eventDaysLeft=0;
 state.eventTotalDays=1;
 const eventImage=document.getElementById('eventImage');
 if(eventImage) eventImage.innerHTML='';
 const t=document.getElementById('eventTitle'); if(t) t.textContent='Sin evento';
 const tx=document.getElementById('eventText'); if(tx) tx.innerHTML='Asigna acciones y pulsa Finalizar día.';
 const eo=document.getElementById('eventOptions'); if(eo){ eo.innerHTML=''; eo.dataset.busy='0'; }
 const bar=document.getElementById('eventDurationBar'); if(bar) bar.style.display='none';
 const sub=document.getElementById('eventSubtitle'); if(sub) sub.style.display='none';
}



function renderPersistentEvent(){
 const panel=document.getElementById('persistentEventPanel');
 if(!panel) return;
 const ev=state._activeMultiDayEvent;
 const showPanel=!!(ev&&ev._daysLeft>0&&!(state.pendingEvent&&state.pendingEvent===ev));
 if(!showPanel){ panel.style.display='none'; return; }
 panel.style.display='block';
 let html='';

 if(ev&&ev._daysLeft>0&&!(state.pendingEvent&&state.pendingEvent===ev)){
 const left=ev._daysLeft;
 const total=ev._totalDays||1;
 const pips=Array.from({length:total},(_,i)=>`<div class="dur-pip${i>=left?' empty':''}"></div>`).join('');
 const attackBlockNote=ev.blockAttackThreatWhileActive
 ? '<div style="font-size:10px;color:var(--danger-bright);margin:0 0 8px 0;letter-spacing:0.06em;">🚫 Mientras este efecto siga activo, no pueden activarse amenazas de ataque.</div>'
 : '';
 html+=`<div style="font-size:10px;color:var(--amber-bright);letter-spacing:0.12em;text-transform:uppercase;font-family:var(--font-display);margin-bottom:6px;">⏱ Efecto activo</div>
 <div style="border:1px solid var(--amber);border-left:3px solid var(--amber-bright);padding:10px 12px;background:rgba(184,124,42,0.06);">
 <div style="font-family:var(--font-display);font-size:14px;font-weight:600;color:var(--amber-bright);margin-bottom:4px;">${escapeHtml(ev.title||'Evento activo')}</div>
 <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:8px;">${escapeHtml(ev.text||'')}</div>
 ${attackBlockNote}
 <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--amber);">
 <div class="dur-pips">${pips}</div>
 <span>${left} día${left!==1?'s':''} restante${left!==1?'s':''}</span>
 </div>
 </div>`;
 }
 panel.innerHTML=html;
}


function renderActiveEvents(){
 const list=document.getElementById('activeEventsList');
 if(!list) return;
 const active=[];
 if(state._activeMultiDayEvent&&state._activeMultiDayEvent._daysLeft>0) active.push(state._activeMultiDayEvent);
 if(!active.length){ list.innerHTML='<div class="no-active-events">// Sin efectos activos.</div>'; return; }
 list.innerHTML=active.map(ev=>{
 const left=ev._daysLeft||1;
 const total=ev._totalDays||1;
 const pips=Array.from({length:total},(_,i)=>`<span class="active-event-pip${i>=left?' empty':''}"></span>`).join('');
 return `<div class="active-event-item" onclick="setEvent(state._activeMultiDayEvent)">
 <div class="active-event-name">${escapeHtml(ev.title||'Evento')}</div>
 <div class="active-event-days">${pips}<span>${left} día${left!==1?'s':''} restante${left!==1?'s':''}</span></div>${ev.blockAttackThreatWhileActive?'<div style="font-size:10px;color:var(--danger-bright);margin-top:6px;">🚫 Bloquea amenazas de ataque</div>':''}
 </div>`;
 }).join('');
}


function rollExplorerRandomInjuryLevel(){
 const dist=getExploreRandomInjuryDistribution();
 const r=Math.random();
 if(r<dist.simple) return 'simple';
 if(r<(dist.simple+dist.seria)) return 'seria';
 return 'grave';
}

 function normalizeAcidText(value){
  return String(value||'')
   .normalize('NFD')
   .replace(/[\u0300-\u036f]/g,'')
   .toLowerCase();
 }

 function isAcidRainEvent(ev){
  if(!ev) return false;
  const blob=normalizeAcidText([
   ev.id,
   ev.name,
   ev.title,
   ev.text,
   ev.description
  ].filter(Boolean).join(' '));
  return blob.includes('lluvia') && (blob.includes('acida') || blob.includes('acid rain'));
 }

 const originalGetEventIntervalConfig=window.getEventIntervalConfig;
 if(typeof originalGetEventIntervalConfig==='function'){
  window.getEventIntervalConfig=function(ev){
   const baseCfg=originalGetEventIntervalConfig.apply(this, arguments);
   if(baseCfg) return baseCfg;
   if(isAcidRainEvent(ev)){
    return {
     mode:'every_x_plus_y',
     baseDays:6,
     useOffset:true,
     minInterval:4,
     enabled:true
    };
   }
   return null;
  };
 }


