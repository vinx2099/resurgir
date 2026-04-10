// Survivors logic deduplicated: moved to survivors.js
const DEFAULT_MORALE_TABLES=Object.freeze({
 A:{low:[1,5],normal:[6,8],high:[9,10]},
 B:{low:[1,7],normal:[8,9],high:[10,10]},
 C:{low:[1,4],normal:[5,7],high:[8,10]}
});
/* dedup:getMoraleTables moved to survivors.js */

/* dedup:normalizeMoraleTableKey moved to survivors.js */

/* dedup:clampMoraleValue moved to survivors.js */

/* dedup:mapLegacyMoraleValue moved to survivors.js */

/* dedup:getNormalizedMoraleMeta moved to survivors.js */

/* dedup:getNormalizedMoraleState moved to survivors.js */

/* dedup:getMoraleMax moved to survivors.js */

/* dedup:canIncreaseMorale moved to survivors.js */

/* dedup:getSurvivorHunger moved to survivors.js */

/* dedup:setSurvivorHunger moved to survivors.js */

/* dedup:changeSurvivorHunger moved to survivors.js */

/* dedup:hasSevereHunger moved to survivors.js */

/* dedup:getDailyMoraleGainRemaining moved to survivors.js */

/* dedup:notePositiveMoraleDay moved to survivors.js */

/* dedup:getMoraleGainConditionModifier moved to survivors.js */

/* dedup:adjustSurvivorMorale moved to survivors.js */

/* dedup:tryGainMoraleWithChance moved to survivors.js */

/* dedup:applyStartOfDayHungerAndMorale moved to survivors.js */

/* dedup:getMoraleTableDef moved to survivors.js */

/* dedup:getMoraleStateKey moved to survivors.js */

/* dedup:getMoraleStateInfo moved to survivors.js */

/* dedup:getMoraleLabel moved to survivors.js */

/* dedup:getMoraleColor moved to survivors.js */


/* dedup:ensureRelationshipStore moved to survivors.js */

/* dedup:getRelationshipPairKey moved to survivors.js */

/* dedup:ensureRelationshipEntry moved to survivors.js */

/* dedup:getRelationshipEntry moved to survivors.js */

/* dedup:getRelationshipParticipant moved to survivors.js */

/* dedup:getRelationshipOther moved to survivors.js */

/* dedup:getRelationshipEntriesForSurvivor moved to survivors.js */

/* dedup:isProtectorOf moved to survivors.js */

/* dedup:getSurvivorRelationshipBadges moved to survivors.js */

/* dedup:getRelationshipRestBonus moved to survivors.js */


function getActionStartMoraleState(survivor){
 return survivor?._moraleStateAtActionStart || getMoraleStateKey(survivor);
}
function getGroupActionContextForSurvivor(survivor, expectedAction=null){
 if(!survivor?._groupActionId) return null;
 const actionType=expectedAction || survivor.action?.type || null;
 const members=state.survivors.filter(s=>
 s&&s.status!=='muerto'&&String(s._groupActionId)===String(survivor._groupActionId)&&(!actionType || s.action?.type===actionType)
 );
 if(members.length<2) return null;
 const leader=members.find(s=>s._groupActionRole==='leader')||members[0];
 const supports=members.filter(s=>String(s.id)!==String(leader.id));
 return {groupId:String(survivor._groupActionId), action:actionType||leader.action?.type||null, members, leader, supports};
}
function isPassiveSupportGroupAction(survivor){
 const ctx=getGroupActionContextForSurvivor(survivor, survivor?.action?.type);
 if(!ctx) return false;
 return survivor._groupActionRole==='support' && ['forraje','reciclar','explorar'].includes(survivor.action?.type);
}
function getRandomItemWeight(item){
 const base=Number(item?.weight);
 if(Number.isFinite(base)&&base>0) return base;
 const rarity=Number(item?.rarity ?? item?.dropRarity ?? 4);
 if(rarity<=1) return 1;
 if(rarity===2) return 3;
 if(rarity===3) return 6;
 return 10;
}
function pickRandomGroupItem(){
 const pool=(gameData.items||[]).filter(it=>it&&it.id&&it.disabled!==true&&it.hidden!==true&&it.obtainable!==false);
 if(!pool.length) return null;
 const weighted=pool.map(it=>({item:it, weight:Math.max(1, getRandomItemWeight(it))}));
 const total=weighted.reduce((sum,entry)=>sum+entry.weight,0);
 let r=Math.random()*total;
 for(const entry of weighted){
 r-=entry.weight;
 if(r<=0) return materializeItem(entry.item);
 }
 return materializeItem(weighted[0]?.item||null);
}
function grantRandomGroupItem(foundBy, contextLabel='la acción grupal'){
 const item=pickRandomGroupItem();
 if(!item) return null;
 state.inventory=normalizeInventoryList(state.inventory||[]);
 state.inventory.push(materializeItem(item));
 addLog(`📦 ${foundBy?.name||'El grupo'} encuentra <span class="log-item">${escapeHtml(item.name)}</span> durante ${contextLabel}. Se guarda en el almacén.`);
 return item;
}

function getLeaderPositiveGroupBonusMultiplier(ctx){
 if(!ctx||!ctx.leader||!(ctx.supports||[]).length) return 1;
 return survivorHasSkill(ctx.leader,'lider') ? 1.10 : 1;
}
function applyLeaderPositiveGroupBonus(ctx, value, sourceSurvivor=null){
 const numeric=Number(value||0);
 if(!(numeric>0)) return 0;
 if(!ctx||!ctx.leader||!(ctx.supports||[]).length) return numeric;
 if(sourceSurvivor && String(sourceSurvivor.id)===String(ctx.leader.id)) return numeric;
 return numeric * getLeaderPositiveGroupBonusMultiplier(ctx);
}
function getGroupActionItemChances(ctx, actionType){
 if(!ctx||ctx.members.length<2) return [];
 const chances=[];
 if(actionType==='forraje' || actionType==='reciclar'){
 ctx.supports.forEach(member=>{
 const stateKey=getActionStartMoraleState(member);
 if(stateKey==='high') chances.push({survivor:member, chance:applyLeaderPositiveGroupBonus(ctx,0.10,member)});
 else if(stateKey==='normal') chances.push({survivor:member, chance:applyLeaderPositiveGroupBonus(ctx,0.05,member)});
 });
 }else if(actionType==='explorar'){
 const leaderState=getActionStartMoraleState(ctx.leader);
 if(leaderState==='normal') chances.push({survivor:ctx.leader, chance:0.10});
 ctx.supports.forEach(member=>{
 if(getActionStartMoraleState(member)==='high') chances.push({survivor:member, chance:applyLeaderPositiveGroupBonus(ctx,0.05,member)});
 });
 }
 return chances;
}
function getHostileImageFromInfo(hostileInfo){
 return hostileInfo?.variantDef?.image
 || hostileInfo?.variantDef?.img
 || hostileInfo?.variantDef?.picture
 || hostileInfo?.variantDef?.portrait
 || hostileInfo?.variantDef?.illustration
 || hostileInfo?.typeDef?.image
 || hostileInfo?.typeDef?.img
 || hostileInfo?.typeDef?.picture
 || hostileInfo?.typeDef?.portrait
 || hostileInfo?.typeDef?.illustration
 || '';
}


function applyGroupForageRecycleBonuses(leader, actionType){
 const ctx=getGroupActionContextForSurvivor(leader, actionType);
 if(!ctx || String(ctx.leader.id)!==String(leader.id)) return;
 const leaderState=getActionStartMoraleState(leader);
 const contextLabel=actionType==='forraje' ? 'la salida de forrajeo' : 'la salida de reciclaje';
 const leaderPositiveMult=getLeaderPositiveGroupBonusMultiplier(ctx);
 if(actionType==='forraje'){
 let bonusChance=leaderState==='high' ? 0.10 : leaderState==='normal' ? 0.05 : 0;
 if(bonusChance>0) bonusChance=Math.min(1, bonusChance*leaderPositiveMult);
 if(bonusChance>0 && Math.random()<bonusChance){
 state.food+=1;
 addLog(`🤝 ${leader.name} aprovecha bien al grupo y consigue +1 comida extra.`);
 }
 }else if(actionType==='reciclar'){
 let bonusChance=leaderState==='high' ? 0.10 : leaderState==='normal' ? 0.05 : 0;
 if(bonusChance>0) bonusChance=Math.min(1, bonusChance*leaderPositiveMult);
 if(bonusChance>0 && Math.random()<bonusChance){
 state.materials+=1;
 addLog(`🤝 ${leader.name} coordina al grupo y consigue +1 material extra.`);
 }
 }
 getGroupActionItemChances(ctx, actionType).forEach(entry=>{
 if(Math.random()<entry.chance) grantRandomGroupItem(entry.survivor, contextLabel);
 });
 maybeTriggerGroupActionAmbush(ctx, actionType, contextLabel);
}
function getRestRomanceChanceForSurvivor(survivor){
 const stateKey=getActionStartMoraleState(survivor);
 if(stateKey==='high') return 0.10;
 if(stateKey==='normal') return 0.05;
 return 0;
}
function maybeApplyRestGroupMoraleBonus(survivor){
 const ctx=getGroupActionContextForSurvivor(survivor, survivor?.action?.type);
 if(!ctx) return;
 const stateKey=getActionStartMoraleState(survivor);
 const chance=(stateKey==='high' || stateKey==='low') ? 0.10 : 0;
 tryGainMoraleWithChance(survivor, chance, `💤 ${survivor.name} encuentra algo de paz al descansar en grupo. +1 moral.`);
}
function processGroupRestRomance(){
 const groups={};
 state.survivors.forEach(s=>{
 if(!s?._groupActionId || !['descansar','descansar_exterior'].includes(s.action?.type) || s.status==='muerto') return;
 if(!groups[s._groupActionId]) groups[s._groupActionId]=[];
 groups[s._groupActionId].push(s);
 });
 Object.values(groups).forEach(members=>{
 if((members||[]).length<2) return;
 for(let i=0;i<members.length;i++){
 for(let j=i+1;j<members.length;j++){
 const a=members[i], b=members[j];
 const chance=Math.max(getRestRomanceChanceForSurvivor(a), getRestRomanceChanceForSurvivor(b));
 if(chance<=0) continue;
 const entry=getRelationshipEntry(a.id,b.id);
 if(entry?.type==='rival' || entry?.type==='love') continue;
 if(Math.random()<chance) establishRelationshipType(a.id,b.id,'love');
 }
 }
 });
}
function getGroupMembersForSurvivor(survivor){
 if(!survivor?._groupActionId) return [];
 return state.survivors.filter(s=>s.status!=='muerto'&&String(s._groupActionId)===String(survivor._groupActionId));
}
function getRelationshipRiskModifier(survivor){
 const mates=getGroupMembersForSurvivor(survivor).filter(other=>String(other.id)!==String(survivor.id));
 if(!mates.length) return 0;
 let modifier=0;
 mates.forEach(other=>{
 const entry=getRelationshipEntry(survivor.id,other.id);
 if(!entry) return;
 if(entry.type==='rival') modifier+=0.08;
 if(isProtectorOf(other.id,survivor.id)) modifier-=0.10;
 });
 return modifier;
}
function getCombatRelationshipModifier(participants=[]){
 let total=0;
 const seen=new Set();
 for(let i=0;i<participants.length;i++){
 for(let j=i+1;j<participants.length;j++){
 const a=participants[i], b=participants[j];
 if(!a||!b||a.status==='muerto'||b.status==='muerto') continue;
 const key=getRelationshipPairKey(a.id,b.id);
 if(seen.has(key)) continue;
 seen.add(key);
 const entry=getRelationshipEntry(a.id,b.id);
 if(!entry) continue;
 if(entry.type==='friend') total+=1;
 if(entry.type==='love') total+=2;
 if(entry.type==='rival') total-=1;
 if(isProtectorOf(a.id,b.id)||isProtectorOf(b.id,a.id)) total+=1;
 }
 }
 return Math.max(-2, Math.min(3,total));
}
function establishRelationshipType(aId,bId,type){
 const entry=ensureRelationshipEntry(aId,bId);
 if(!entry||entry.type===type) return false;
 entry.type=type;
 const a=getRelationshipParticipant(entry,'a');
 const b=getRelationshipParticipant(entry,'b');
 if(a&&b){
 if(type==='friend') addLog(`🤝 ${a.name} y ${b.name} forjan una amistad.`);
 else if(type==='love') addLog(`❤️ ${a.name} y ${b.name} desarrollan un vínculo de amor.`);
 else addLog(`⚔ ${a.name} y ${b.name} desarrollan una rivalidad.`);
 }
 return true;
}
function establishProtectorRelationship(protectorId,targetId){
 const entry=ensureRelationshipEntry(protectorId,targetId);
 if(!entry) return false;
 const protectorIsA=String(entry.a)===String(protectorId);
 const flag=protectorIsA?'protectorAB':'protectorBA';
 if(entry[flag]) return false;
 entry[flag]=true;
 const protector=state.survivors.find(s=>String(s.id)===String(protectorId));
 const target=state.survivors.find(s=>String(s.id)===String(targetId));
 if(protector&&target) addLog(`🛡 ${protector.name} decide proteger a ${target.name}.`);
 return true;
}
function progressRelationshipPair(aId,bId,{positive=0,negative=0}={}){
 const entry=ensureRelationshipEntry(aId,bId);
 if(!entry) return;
 entry.positive=Math.max(0,Number(entry.positive||0)+Number(positive||0));
 entry.negative=Math.max(0,Number(entry.negative||0)+Number(negative||0));
 if(!entry.type&&entry.positive>=3&&entry.negative<=1) establishRelationshipType(aId,bId,'friend');
 else if(!entry.type&&entry.negative>=2&&entry.positive<3) establishRelationshipType(aId,bId,'rival');
}
function noteProtectiveProgress(helperId,targetId){
 const entry=ensureRelationshipEntry(helperId,targetId);
 if(!entry) return;
 const helperIsA=String(entry.a)===String(helperId);
 const field=helperIsA?'careAB':'careBA';
 entry[field]=Math.max(0,Number(entry[field]||0)+1);
 if(entry[field]>=2) establishProtectorRelationship(helperId,targetId);
}
function processRelationshipProgressAfterActions(){
 if(state._relationshipProgressDay===state.day) return;
 const groups={};
 state.survivors.forEach(s=>{
 if(s?._groupActionId&&s.action?.type){
 if(!groups[s._groupActionId]) groups[s._groupActionId]={action:s.action.type,members:[]};
 groups[s._groupActionId].members.push(s);
 }
 });
 Object.values(groups).forEach(group=>{
 const members=group.members||[];
 if(members.length<2) return;
 const hadIncident=members.some(s=>s._injuredTodayDay===state.day||s._diedTodayDay===state.day);
 for(let i=0;i<members.length;i++){
 for(let j=i+1;j<members.length;j++){
 progressRelationshipPair(members[i].id,members[j].id, hadIncident?{negative:1}:{positive:1});
 }
 }
 if(hadIncident){
 const injured=members.filter(s=>s._injuredTodayDay===state.day||s._diedTodayDay===state.day);
 injured.forEach(target=>{
 members.filter(other=>String(other.id)!==String(target.id)&&other._injuredTodayDay!==state.day&&other._diedTodayDay!==state.day&&other.status!=='muerto')
 .forEach(helper=>noteProtectiveProgress(helper.id,target.id));
 });
 }
 });
 state._relationshipProgressDay=state.day;
}
function applyRelationshipShock(survivor, reason='loss'){
 const subject=state.survivors.find(x=>String(x.id)===String(survivor?.id))||survivor;
 if(!subject) return;
 getRelationshipEntriesForSurvivor(subject.id).forEach(entry=>{
 const other=getRelationshipOther(entry,subject.id);
 if(!other||other.status==='muerto') return;
 let penalty=0;
 if(entry.type==='love') penalty=Math.max(penalty,3);
 if(entry.type==='friend') penalty=Math.max(penalty,2);
 if(isProtectorOf(other.id,subject.id)||isProtectorOf(subject.id,other.id)) penalty=Math.max(penalty,2);
 if(penalty>0){
 adjustSurvivorMorale(other,-penalty);
 addLog(`💔 ${other.name} pierde ${penalty} de moral por ${reason==='dead'?'la muerte':'la pérdida'} de ${subject.name}.`);
 }
 });
}
function applySeedRelationshipsForSurvivor(survivor){
 if(!survivor||!Array.isArray(survivor.relationshipSeeds)||!survivor.relationshipSeeds.length) return;
 survivor.relationshipSeeds.forEach(rel=>{
 const target=state.survivors.find(other=>String(other.id)===String(rel?.targetId) || (rel?.targetName && other.name===rel.targetName));
 if(!target||String(target.id)===String(survivor.id)) return;
 const type=String(rel?.type||'').toLowerCase().trim();
 if(type==='friend'||type==='amistad') establishRelationshipType(survivor.id,target.id,'friend');
 if(type==='rival'||type==='rivalidad') establishRelationshipType(survivor.id,target.id,'rival');
 if(type==='protector'||type==='protect') establishProtectorRelationship(survivor.id,target.id);
 });
}
function initializeSeedRelationships(){
 state.survivors.forEach(applySeedRelationshipsForSurvivor);
}

const topbar=document.getElementById('topbar'),survivorList=document.getElementById('survivorList'),detailBox=document.getElementById('detailBox'),logBox=document.getElementById('logBox'),logScrollUpBtn=document.getElementById('logScrollUpBtn'),logScrollDownBtn=document.getElementById('logScrollDownBtn'),eventImage=document.getElementById('eventImage'),eventTitle=document.getElementById('eventTitle'),eventText=document.getElementById('eventText'),eventOptions=document.getElementById('eventOptions'),buildModalWrap=document.getElementById('buildModalWrap'),buildOptions=document.getElementById('buildOptions'),gameOverWrap=document.getElementById('gameOverWrap');


let logVirtualOffset = 0;
if(logScrollUpBtn) logScrollUpBtn.addEventListener('click', ()=>scrollLogBoxBy(-1));
if(logScrollDownBtn) logScrollDownBtn.addEventListener('click', ()=>scrollLogBoxBy(1));
const logWheelBox=document.getElementById('logBox');
if(logWheelBox){
 logWheelBox.addEventListener('wheel', (ev)=>{
  const rail=logWheelBox.querySelector('.log-rail');
  if(!rail) return;
  const maxOffset=Math.max(0, rail.scrollHeight-logWheelBox.clientHeight);
  if(maxOffset<=0) return;
  ev.preventDefault();
  logVirtualOffset += Number(ev.deltaY||0);
  applyLogVirtualOffset();
 }, {passive:false});
}

document.getElementById('endDayBtn').addEventListener('click',endDay);
document.getElementById('activateAllBuildingsBtn')?.addEventListener('click',activateAllBuildingsForTesting);
document.getElementById('resetAssignmentsBtn').addEventListener('click',resetAssignments);
const _groupActionBtn=document.getElementById('groupActionBtn');
if(_groupActionBtn){
 _groupActionBtn.style.display='inline-flex';
 _groupActionBtn.style.alignItems='center';
 _groupActionBtn.style.justifyContent='center';
 _groupActionBtn.addEventListener('click',openGroupActionPopup);
}
document.getElementById('groupActionCancel')?.addEventListener('click',closeGroupActionPopup);
document.getElementById('groupActionCloseX')?.addEventListener('click',closeGroupActionPopup);
document.getElementById('groupActionConfirm')?.addEventListener('click',confirmGroupAction);
document.getElementById('closeBuildModal').addEventListener('click',()=>buildModalWrap.classList.remove('open'));
document.getElementById('closeBaseUpgradesModal').addEventListener('click',()=>document.getElementById('baseUpgradesModal').classList.remove('open'));
document.getElementById('groupActionPopup')?.addEventListener('click',(e)=>{ if(e.target?.id==='groupActionPopup') closeGroupActionPopup(); });
document.getElementById('ambushCombatBtn')?.addEventListener('click', resolvePendingAmbushCombat);
document.getElementById('departurePopupConfirm')?.addEventListener('click',closeDeparturePopup);
document.getElementById('closeThreatDecisionPopup')?.addEventListener('click',closeThreatDecisionPopup);
document.getElementById('closeThreatDecisionPopupX')?.addEventListener('click',closeThreatDecisionPopup);
document.getElementById('threatDecisionPopup')?.addEventListener('click',(e)=>{ if(e.target?.id==='threatDecisionPopup') closeThreatDecisionPopup(); });

document.getElementById('openTechnicalLogBtn')?.addEventListener('click',openTechnicalLogModal);
document.getElementById('copyTechnicalLogBtn')?.addEventListener('click',copyTechnicalLog);
document.getElementById('downloadTechnicalLogBtn')?.addEventListener('click',downloadTechnicalLog);
document.getElementById('copyTechnicalLogBtnModal')?.addEventListener('click',copyTechnicalLog);
document.getElementById('downloadTechnicalLogBtnModal')?.addEventListener('click',downloadTechnicalLog);
document.getElementById('closeTechnicalLogBtn')?.addEventListener('click',closeTechnicalLogModal);
document.getElementById('closeTechnicalLogBtnFooter')?.addEventListener('click',closeTechnicalLogModal);
document.getElementById('technicalLogModal')?.addEventListener('click',(e)=>{ if(e.target?.id==='technicalLogModal') closeTechnicalLogModal(); });


function deepClone(v){return JSON.parse(JSON.stringify(v))}

/* phaseA:data file labels + optional data types moved to data-loader.js */
const DEFAULT_STABILITY_TIERS=[
 {id:'collapse',min:0,max:2,label:'Colapso'},
 {id:'unstable',min:3,max:4,label:'Inestable'},
 {id:'normal',min:5,max:7,label:'Normal'},
 {id:'strong',min:8,max:10,label:'Fuerte'}
];
const DEFAULT_STABILITY_MODIFIERS_BY_TIER={
 collapse:{defenseBonus:-1,negativeEventWeightBonus:0.25,abandonChanceBonus:0.15,recruitChanceBonus:-20,extraBuildDays:1,extraResearchDays:1},
 unstable:{negativeEventWeightBonus:0.10,recruitChanceBonus:-10},
 normal:{},
 strong:{defenseBonus:1,positiveEventWeightBonus:0.10,recruitChanceBonus:10,restMoraleRecoveryChance:0.25}
};
function getStartingSurvivorRarity(){
 return Math.max(1, Number(gameData.config?.starting?.startingSurvivorRarity ?? 4) || 4);
}


/* dedup:getInjuryRulesConfig moved to survivors.js */

/* dedup:getInjuryConfig moved to survivors.js */

/* dedup:getInjuryRollLabel moved to survivors.js */

/* dedup:getUntreatedInjuryTable moved to survivors.js */

/* dedup:getInjuryTreatmentChoiceRequired moved to survivors.js */

/* dedup:applyMedicineToInjuryLevel moved to survivors.js */

/* dedup:improveInjuryLevel moved to survivors.js */

/* dedup:getExploreRandomInjuryDistribution moved to survivors.js */

function getStabilityTierDefinitions(){
 const configured=Array.isArray(gameData.config?.stability?.tiers)
 ? gameData.config.stability.tiers.map((tier,idx)=>({
 id:String(tier?.id||`tier_${idx+1}`).trim(),
 min:Number(tier?.min ?? 0),
 max:Number(tier?.max ?? 10),
 label:String(tier?.label||tier?.name||tier?.id||`Tier ${idx+1}`)
 })).filter(tier=>tier.id)
 : [];
 return configured.length ? configured : deepClone(DEFAULT_STABILITY_TIERS);
}
function getStabilityDefenseModifierByRange(value=state.stability){
 const ranges=Array.isArray(gameData.config?.stability?.defenseModifierByRange)
 ? gameData.config.stability.defenseModifierByRange
 : [];
 if(!ranges.length) return null;
 const current=Math.max(0, Math.min(10, Number(value)||0));
 const match=ranges.find(range=>current>=Number(range?.min ?? Number.NEGATIVE_INFINITY) && current<=Number(range?.max ?? Number.POSITIVE_INFINITY));
 if(!match) return null;
 const modifier=Number(match?.modifier);
 return Number.isFinite(modifier) ? modifier : null;
}


/* dedup:getAverageMorale moved to survivors.js */

/* phaseA:getSettlementDefenseValue + one-day output modifiers moved to buildings.js */


/* phaseA:required game data rules moved to data-loader.js */

function escapeHtml(str){
 return String(str??'').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
/* phaseA:data load state helpers moved to data-loader.js */


const DEFAULT_ACTION_RISK_CHANCE=Object.freeze({
 forraje:0.08,
 reciclar:0.12,
 explorar:0.18,
 defender:0.10,
 outside:0.10
});
const DEFAULT_RARITY_WEIGHTS=Object.freeze({1:1,2:3,3:6,4:12});
const DEFAULT_ACTION_SKILL_MAP=Object.freeze({
 forraje:['recolector','cazador'],
 reciclar:['chatarrero'],
 construir:['ingeniero','inventor'],
 explorar:['rastreador','explorador','precavido','combatiente']
});
const DEFAULT_ACTION_ICONS=Object.freeze({
 forraje:{icon:'🌿',label:'Forrajear'},
 reciclar:{icon:'⚙',label:'Reciclar'},
 construir:{icon:'🔨',label:'Construir'},
 explorar:{icon:'🧭',label:'Explorar'},
 viajar:{icon:'🥾',label:'Viajar'},
 vigilar:{icon:'👁',label:'Vigilar'},
 defender:{icon:'🛡',label:'Defender'},
 atacar:{icon:'⚔',label:'Atacar'},
 descansar:{icon:'💤',label:'Descansar'},
 investigar:{icon:'🔬',label:'Investigar'}
});
const DEFAULT_AUDIO_CONFIG=Object.freeze({bgVolume:0.18, combatVolume:0.25});
const DEFAULT_INTRO_LINES=Object.freeze(['War...','War never changes.']);

function getActionRiskChanceMap(){
 const configured=gameData.config?.rules?.actionRiskChance;
 return (configured && typeof configured==='object' && !Array.isArray(configured)) ? configured : DEFAULT_ACTION_RISK_CHANCE;
}
function getRarityWeightsConfig(){
 const configured=gameData.config?.rules?.rarityWeights;
 if(configured && typeof configured==='object' && !Array.isArray(configured)) return configured;
 return DEFAULT_RARITY_WEIGHTS;
}
function getActionSkillMap(){
 const configured=gameData.config?.skills?.actionSkillMap;
 return (configured && typeof configured==='object' && !Array.isArray(configured)) ? configured : DEFAULT_ACTION_SKILL_MAP;
}
function getActionIcons(){
 const configured=gameData.config?.ui?.actionIcons;
 return (configured && typeof configured==='object' && !Array.isArray(configured)) ? configured : DEFAULT_ACTION_ICONS;
}
function getAudioConfig(){
 const configured=gameData.config?.audio;
 return (configured && typeof configured==='object' && !Array.isArray(configured)) ? configured : DEFAULT_AUDIO_CONFIG;
}
function clampMediaVolume(value, fallback){
 const num=Number(value);
 if(!Number.isFinite(num)) return fallback;
 return Math.max(0, Math.min(1, num));
}
function applyAudioSettingsFromConfig(){
 const cfg=getAudioConfig();
 const bg=document.getElementById('bgMusic');
 const combat=document.getElementById('combatMusic');
 if(bg) bg.volume=clampMediaVolume(cfg.bgVolume, DEFAULT_AUDIO_CONFIG.bgVolume);
 if(combat) combat.volume=clampMediaVolume(cfg.combatVolume, DEFAULT_AUDIO_CONFIG.combatVolume);
}
function getIntroLines(){
 const lines=gameData.config?.ui?.introLines;
 if(Array.isArray(lines)){
  const clean=lines.map(line=>String(line??'')).filter(Boolean);
  if(clean.length) return clean;
 }
 return [...DEFAULT_INTRO_LINES];
}
function getWeightedRarityMap(forcedRarity){
 if(forcedRarity!=null && forcedRarity!=='') return { [Number(forcedRarity)]: 1 };
 const source=getRarityWeightsConfig();
 const normalized={};
 Object.entries(source||{}).forEach(([key,value])=>{
  const rarity=Number(key);
  const weight=Math.max(0, Number(value)||0);
  if(Number.isFinite(rarity) && weight>0) normalized[rarity]=weight;
 });
 return Object.keys(normalized).length ? normalized : DEFAULT_RARITY_WEIGHTS;
}

function initGame(){
 state._gameInitialized=false;
 if(!isGameDataReady()){
 const status=document.getElementById('headerStatus');
 if(status) status.textContent='ERROR DE DATOS ■ ■ ■';
 eventTitle.textContent='Error de carga';
 eventText.textContent='No se han cargado los datos correctos. Revisa los JSON obligatorios de la carpeta /data antes de iniciar la partida.';
 eventOptions.innerHTML='';
 return false;
 }
 state.day=Number(gameData.config?.starting?.day??1);
 state.food=Number(gameData.config?.starting?.food??5);
 state.materials=Number(gameData.config?.starting?.materials??5);
 state.stability=Number(gameData.config?.starting?.stability??gameData.config?.starting?.morale??5);
 state.meds=Number(gameData.config?.starting?.meds??1);
 state.fuel=Number(gameData.config?.starting?.fuel??gameData.config?.starting?.combustible??3);
 state.electricity=Number(gameData.config?.starting?.electricity??0);
 state.unlocked=deepClone(gameData.config?.rules?.resources||{meds:true,electricity:false});
 const medsUnlockedFromStart=gameData.config?.buildings?.medsUnlockedFromStart !== false;
 state.unlocked.meds=medsUnlockedFromStart || Number(state.meds||0)>0;
 state.gameMode=selectedGameMode;
 if(state.gameMode==='dev'){
 state.food=100;
 state.materials=100;
 state.stability=100;
 state.meds=100;
 state.fuel=100;
 state.electricity=100;
 state.chickens=100;
 state.unlocked.electricity=true;
 }
 state.electricityCapacity=0;
 state.electricityUsed=0;
 state.vallaElectrica=false;
 state.attackThreat=false;
 state.attackHostileType="raiders";
 state.attackHostileVariant="random";
 state.attackHostileLabel="Raiders";
 state.attackHostileIcon="💀 ";
 state.attackHostileNpc=false;
 state.attackHostileNpcEventId=null;
 state.attackStrength=3;
 state.attackArrivalDay=0;
 state.attackEffectVictory=[];
 state.attackEffectDefeat=[];
 state.attackPopupVictory=null;
 state.attackPopupDefeat=null;
 state.pendingEvent=null;
 state.eventDaysLeft=0;
 state.eventTotalDays=1;
 state._activeMultiDayEvent=null;
 state.seenEvents=new Set();
 state.eventSchedule={};
 state.cemetery=[];
 state.actionXP={};
 state.inventory=[];
 state.dog=null;
 state.activeThreats=[];
 state.threatCooldowns={};
 state.buildingDisableTimers={};
 state._oneDayOutputMods=[];
 state._processingDay=false;
 state.locations=[];
 state._seenExplore=new Set();
 state.delayedQueue=[];
 state.actionLimits={};
 state.log=[];
 state.currentDetail=null;
 state._lastStabilityTier=getStabilityTier();

 if(!Array.isArray(gameData.items)) gameData.items=[];
 const starterInventory = Array.isArray(gameData.config?.starting?.inventory)
 ? deepClone(gameData.config.starting.inventory)
 : [
 { itemId:'melee_knife', quality:4, maxQuality:4 },
 { itemId:'ranged_pistol', quality:4, maxQuality:4 },
 { itemId:'armor_jacket', quality:4, maxQuality:4 },
 { itemId:'medkit' },
 { itemId:'worker_toolkit', quality:5, maxQuality:5 }
 ];
 state.inventory = normalizeInventoryList(starterInventory);

 const starterCount=Math.max(1, Number(gameData.config?.starting?.survivors??3) || 3);
 state.relationships={};
 state._relationshipProgressDay=0;
 state.npcs=typeof normalizeNpcStateList==='function' ? normalizeNpcStateList(gameData.npcs||[]) : [];
 const starters=pickStartingSurvivors(starterCount);
 if(starters.length===0){
 handleDataLoadError('survivors.json', 'no contiene supervivientes válidos para iniciar la partida');
 updateDataErrorUI();
 return false;
 }
 state.survivors=starters.map((s,idx)=>({
 id:s.id||idx+1,
 name:s.name||`Superviviente ${idx+1}`,
 fatigue:Number(s.fatigueCurrent??s.fatigue??s.fatigueMax??s.maxFatigue??3),
 maxFatigue:Number(s.fatigueMax??s.maxFatigue??3),
 rarity:Number(s.rarity??4),
 imageUrl:s.image?.url||'',
 imageUrlInjured:s.imageInjured?.url||s.imageUrlInjured||'',
 imageUrlDead:'', // always uses gravestone SVG
 story:s.story||'',
 skill:s.skill||'ninguna',
 skill2:s.skill2||'ninguna',
 negativeSkill:s.negativeSkill||'ninguna',
 relationshipSeeds:deepClone(s.relationships||s.links||[]),
 ...getNormalizedMoraleState(s),
 hunger:Math.max(0, Number(s.hunger??0)||0),
 _moraleGainedToday:0,
 _moralePositiveToday:false,
 _highMoraleDryDays:0,
 fed:true,
 status:'activo',
 action:null,
 location:'base',
 travelDest:null,
 travelArrivalDay:null,
 travelReturnDay:null,
 inventory:normalizeInventoryList(deepClone(s.inventory||[])),
 inventorySlots:Number(s.inventorySlots||3),
 equippedWeapon:s.equippedWeapon||null
 }));
 initializeSeedRelationships();

 ensureBuildingCatalog();
 if(state.gameMode!=='dev') state.chickens=Number(gameData.config?.starting?.chickens ?? gameData.config?.gallinero?.startingChickens ?? 0);
 state.baseUpgrades=Object.fromEntries(getBaseUpgradesCatalog().map(up=>[up.id,false]));
 state.baseUpgradeProjects={};
 state.buildings={};
(gameData.buildings||[]).forEach(b=>{
 state.buildings[b.id]={
 id:b.id,
 name:b.name,
 desc:b.effect||b.effectDescription||b.description||b.text||'',
 description:b.description||b.text||b.effectDescription||b.effect||'',
 image:b.image||b.imageUrl||'',
 levelEffects:deepClone(b.levelEffects||{}),
 cost:Number(b.cost||0),
 built:(b.id==='almacen'?true:!!b.initial),
 level:(b.id==='almacen'?1:(b.initial?1:0)),
 active:true,
 constructible:b.constructible!==false,
 maxLevel:Number(b.maxLevel||5),
 category:b.category||'Base',
 map:deepClone(b.map||null),
 electricityCost:Number(b.electricityCost||0),
 constructionDays:deepClone(b.constructionDays!=null?b.constructionDays:1),
 upgradeRequirements:deepClone(b.upgradeRequirements||{}),
 actions:deepClone(b.actions||[]),
 type:b.type||'',
 fromAbandoned:!!b.fromAbandoned,
 unlocked:!!b.unlocked,
 abandonedBuilding:!!b.abandonedBuilding,
 recycleDays:Number(b.recycleDays||0),
 recycleYieldMin:Number(b.recycleYieldMin||0),
 recycleYieldMax:Number(b.recycleYieldMax||0)
 };
});

 generateLocations();
 state._gameInitialized=true;
 addLog('Comienza la partida.');
 addTechnicalLog('game_start', 'Comienza la partida.', {mode:state.gameMode,survivors: aliveSurvivors().map(s=>({id:s.id,name:s.name,skills:getSurvivorSkills(s)})), resources:{food:state.food,materials:state.materials,meds:state.meds,fuel:state.fuel,electricity:state.electricity,chickens:state.chickens,stability:state.stability}});
 const bdp=document.getElementById('buildingDetailPanel');
 if(bdp) bdp.style.display='none';
 closeEvent();
 render();
 return true;
}

function getStabilityTier(value=state.stability){
 const v=Math.max(0,Math.min(10,Number(value)||0));
 const tiers=getStabilityTierDefinitions();
 const found=tiers.find(tier=>v>=Number(tier.min ?? 0) && v<=Number(tier.max ?? 10));
 return found?.id || tiers[tiers.length-1]?.id || 'normal';
}
function getStabilityModifiers(){
 const tier=getStabilityTier();
 const base={
 tier,
 defenseBonus:0,
 negativeEventWeightBonus:0,
 positiveEventWeightBonus:0,
 abandonChanceBonus:0,
 recruitChanceBonus:0,
 extraBuildDays:0,
 extraResearchDays:0,
 restMoraleRecoveryChance:0
 };
 const fallback=DEFAULT_STABILITY_MODIFIERS_BY_TIER[tier]||{};
 const configured=(gameData.config?.stability?.modifiersByTier?.[tier]&&typeof gameData.config.stability.modifiersByTier[tier]==='object')
 ? gameData.config.stability.modifiersByTier[tier]
 : {};
 const merged={...base, ...fallback, ...configured, tier};
 const rangeDefense=getStabilityDefenseModifierByRange();
 if(rangeDefense!==null) merged.defenseBonus=rangeDefense;
 return merged;
}
function stabilityTierLabel(tier=getStabilityTier()){
 return getStabilityTierDefinitions().find(def=>def.id===tier)?.label||'Normal';
}
function maybeLogStabilityTierChange(){
 const tier=getStabilityTier();
 if(!state._lastStabilityTier){ state._lastStabilityTier=tier; return; }
 if(state._lastStabilityTier===tier) return;
 if(tier==='collapse') addLog('💥 El asentamiento está al borde del colapso.');
 else if(tier==='unstable') addLog('⚠ El asentamiento entra en estado inestable.');
 else if(tier==='normal') addLog('✅ El asentamiento recupera una estabilidad normal.');
 else if(tier==='strong') addLog('🏛 El asentamiento está fuerte y unido.');
 state._lastStabilityTier=tier;
}

let popupStackCounter = 0;

function assignAction(id,type){
 if(!type) return;
 const s=state.survivors.find(x=>x.id===id);
 if(!s||s.status==='muerto'||s.status==='ocupado') return;
 if(s.action?.type==='construir'&&s.action?.target){
 addLog(`${s.name} ya está comprometido/a con una construcción y no puede cambiar de acción.`);
 render();
 return;
 }
 const neg2=(s.negativeSkill||'').toLowerCase().trim();
 if(type==='explorar'&&neg2==='miedoso'){addLog(`${s.name} tiene miedo de salir a explorar.`);render();return}
 if(type==='defender'&&neg2==='cobarde'){addLog(`${s.name} es cobarde y no puede defender.`);render();return}
 if(hasActiveInjury(s)&&type!=='descansar'){
 addLog(`${s.name} está herido/a y solo puede descansar.`);render();return;
 }
 if(hasLowMoraleRestRestriction(s)&&type!=='descansar'){
 addLog(`${s.name} no quiere hacer nada más que descansar.`);render();return;
 }
 if(Number(s.fatigue||0)<=0&&type!=='descansar'){addLog(`${s.name} no tiene fatiga disponible.`);render();return}
 if(isActionLimited(type)){addLog(`La acción ${actionLabel(type)} está limitada temporalmente.`);render();return}
 if(type==='vigilar'&&(!state.buildings.atalaya?.built||!state.buildings.atalaya?.active)){addLog('Necesitas una Atalaya activa para vigilar.');render();return}
 if(type==='defender'&&!state.attackThreat){addLog('No hay grupo hostil cercano para atacar.');render();return}
 if((type==='defender'||type==='atacar')&&isExteriorSurvivor(s)){addLog(`${s.name} está en el exterior y no puede participar en amenazas de la base.`);render();return}
 if(type==='viajar'){openTravelPopup(id);render();return}
 if(type==='construir'){openBuildModal(id);render();return}
 s.action={type};s.status='ocupado';addLog(`${s.name} ha sido asignado a ${actionLabel(type)}.`);render();
}

/* dedup:queueGraveInjuryWarningsForNewDay moved to survivors.js */

function continueStartOfDayAfterWarnings(){
 state._deferStartOfDayEvent = false;
 // Handle multi-day active event persistence
 if(state._activeMultiDayEvent){
 state._activeMultiDayEvent._daysLeft-=1;
 if(state._activeMultiDayEvent._daysLeft>0){
 const carried=state._activeMultiDayEvent;
 state.eventDaysLeft=carried._daysLeft;
 state.eventTotalDays=carried._totalDays;
 carried._continuing=true;
 carried._multiDayPassive=true;
 showQueuedOrDailyEvent();
 if(!state.pendingEvent){
 setEvent(carried);
 }
 } else {
 state._activeMultiDayEvent=null;
 showQueuedOrDailyEvent();
 }
 } else {
 showQueuedOrDailyEvent();
 }
}
function openNextGraveWarningPopup(){
 const id = Array.isArray(state.graveWarningQueue) ? state.graveWarningQueue[0] : null;
 if(!id){ continueStartOfDayAfterWarnings(); render(); return; }
 const s = state.survivors.find(x => x.id === id && x.status !== 'muerto');
 if(!s){ state.graveWarningQueue.shift(); openNextGraveWarningPopup(); return; }
 const popup = document.getElementById('graveWarningPopup');
 const portrait = document.getElementById('graveWarningPortrait');
 const nameEl = document.getElementById('graveWarningName');
 const textEl = document.getElementById('graveWarningText');
 const stockEl = document.getElementById('graveWarningStock');
 if(!popup || !portrait || !nameEl || !textEl || !stockEl){ continueStartOfDayAfterWarnings(); render(); return; }
 nameEl.textContent = s.name;
 portrait.innerHTML = getSurvivorImage(s)
 ? `<img src="${escapeAttr(getSurvivorImage(s))}" style="width:100%;height:100%;object-fit:cover;">`
 : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:42px;">🩸</div>';
 textEl.textContent = state.meds > 0
 ? `${s.name} tiene una herida grave. Si no recibe tratamiento y descanso adecuados, podría no sobrevivir esta noche.`
 : `${s.name} tiene una herida grave y no quedan medicamentos en la base. Si no consigues tratarl@, podría no sobrevivir esta noche.`;
 stockEl.textContent = `Medicamentos disponibles: ${state.meds}`;
 addTechnicalLog('grave_warning_popup','Aviso de herida grave al comenzar el día.', {
 survivorId:s.id,
 survivorName:s.name,
 meds:state.meds
 });
 popup.classList.add('open');
}
function closeGraveWarningPopup(){
 const popup = document.getElementById('graveWarningPopup');
 if(popup) popup.classList.remove('open');
 if(Array.isArray(state.graveWarningQueue) && state.graveWarningQueue.length) state.graveWarningQueue.shift();
 if(Array.isArray(state.graveWarningQueue) && state.graveWarningQueue.length){
 openNextGraveWarningPopup();
 } else {
 continueStartOfDayAfterWarnings();
 render();
 }
}

function finalizeEndDayAfterPauses(){
 checkLowMorale();
 // +1 stability every 7 days survived
 if(state.day>0 && state.day%7===0){
 state.stability=Math.min(10,state.stability+1);
 addLog(`🏛 Semana ${Math.floor(state.day/7)} completada. +1 estabilidad.`);
 }
 // +1 stability every 3 days if all survivors have high morale
 if(state.day%3===0){
 const allHappy=aliveSurvivors();
 if(allHappy.length>0&&allHappy.every(s=>getMoraleStateKey(s)==='high')){
 state.stability=Math.min(10,state.stability+1);
 addLog(`🏛 El grupo lleva días con la moral alta. +1 estabilidad.`);
 }
 }
 state.day+=1;
 resetForNewDay();
 queueGraveInjuryWarningsForNewDay();
 if(state.graveWarningQueue && state.graveWarningQueue.length){
 openNextGraveWarningPopup();
 return;
 }
 continueStartOfDayAfterWarnings();
}

function maybeContinueEndDayAfterPause(){
 if(state._pendingTreatmentQueue&&state._pendingTreatmentQueue.length){
 openInjuryTreatmentPopup();
 return;
 }
 if(state._pendingChickenSacrifice){
 openChickenSacrificePopup();
 return;
 }
 if(!state._foodPhaseStarted){
 runFoodAndMoralePhase();
 return;
 }
 if(state._pendingFoodChoice){
 openFoodChoicePopup();
 return;
 }
 finalizeEndDayAfterPauses();
 render();
}

function endDay(){
 addTechnicalLog('end_day_start', 'Se ha solicitado finalizar el día.', {pendingEvent: state.pendingEvent ? state.pendingEvent.id || true : null, processing: !!state._processingDay, survivors: aliveSurvivors().map(s=>({id:s.id,name:s.name,status:s.status,action:s.action||null,injury:s.injury||s.injuryLevel||null,location:s.location||'base'}))});
 if(state.pendingEvent&&state.pendingEvent.options?.length>0&&!state.pendingEvent._multiDayPassive){
 addLog('⚠ Debes resolver el evento actual antes de finalizar el día.');
 render();
 return;
 }
 if(state._processingDay){
 addLog('⏳ El día ya se está procesando. Espera un momento.');
 return;
 }
 state._processingDay=true;
 try{
 state._pendingTreatmentQueue=null;
 state._currentTreatmentSurvivorId=null;
 state._pendingChickenSacrifice=null;
 state._foodPhaseStarted=false;
 state._relationshipProgressDay=0;
 state.survivors.forEach(s=>{ delete s._injuredTodayDay; delete s._diedTodayDay; });
 state._lastDayActions={};
 state._lastDayActionSurvivors={};
 state.survivors.forEach(s=>{
 if(s.action?.type&&s.status!=='muerto'){
 state._lastDayActions[s.action.type]=(state._lastDayActions[s.action.type]||0)+1;
 if(!state._lastDayActionSurvivors[s.action.type]) state._lastDayActionSurvivors[s.action.type]=[];
 state._lastDayActionSurvivors[s.action.type].push(s.id);
 }
 });
 resolveTravelMovement();
 resolveLocationExploration();
 checkAttackArrival();
 resolveActions();
 if(Array.isArray(state._pendingAmbushQueue) && state._pendingAmbushQueue.length){
 state._dayPauseAfterActions=true;
 openNextAmbushPopup();
 return;
 }
 continueEndDayAfterActions();
 } catch(err){
 console.error('Error al finalizar día:', err);
 addLog(`❌ Error al finalizar día: ${err?.message||err}`);
 } finally {
 state._processingDay=false;
 render();
 }
}

function continueEndDayAfterActions(){
 processRelationshipProgressAfterActions();
 applyDailyIncome();
 processInjuriesEndOfDay();
 processActiveThreatsEndOfDay();
 regenerateLocations();
 processDelayedEffects();
 if(state._pendingTreatmentQueue&&state._pendingTreatmentQueue.length){
 openInjuryTreatmentPopup();
 return;
 }
 if(maybePrepareChickenSacrifice()){
 openChickenSacrificePopup();
 return;
 }
 runFoodAndMoralePhase();
}

function resolveActions(){
 state.survivors.forEach(s=>{
 if(!s.action||s.status==='muerto') return;
 if(s._actionResolved) return; // prevent double-processing
 s._moraleStateAtActionStart=getMoraleStateKey(s);
 const type=s.action.type;
 const isRestAction=type==='descansar'||type==='descansar_exterior';
 if(requiresForcedRest(s)&&!isRestAction){
 addLog(`⚠ ${s.name} tiene herida ${injuryDisplayName(s.injuryLevel)} y solo puede descansar.`);
 s.action={type:isExteriorSurvivor(s)?'descansar_exterior':'descansar',target:s.action?.target};
 s.status='ocupado';
 }
 if(hasLowMoraleRestRestriction(s)&&!isRestAction){
 addLog(`😶 ${s.name} no quiere hacer nada más que descansar.`);
 s.action={type:isExteriorSurvivor(s)?'descansar_exterior':'descansar',target:s.action?.target};
 s.status='ocupado';
 }
 s._actionResolved=true;
 const resolvedType=s.action.type;
 if(resolvedType!=='descansar'&&resolvedType!=='descansar_exterior') s.fatigue=Math.max(0,Math.min(s.maxFatigue??3,s.fatigue-1));
 if(isPassiveSupportGroupAction(s)){
 trackActionXP(s,resolvedType);
 if(Math.random()<outsideRiskChance(s,resolvedType)){
 const actionLabelText=resolvedType==='forraje' ? 'durante la salida de forrajeo' : resolvedType==='reciclar' ? 'mientras acompaña al grupo de reciclaje' : 'mientras acompaña al grupo de exploración';
 injureSurvivor(s, `🩸 ${s.name} resulta {injuryLabel} ${actionLabelText}.`, {source:resolvedType});
 }
 return;
 }
 if(resolvedType==='forraje'){
 const ctx=getGroupActionContextForSurvivor(s,'forraje');
 const members=(ctx&&String(ctx.leader.id)===String(s.id)) ? ctx.members : [s];
 const perMemberFound=Math.max(0,1+getActionModifier('forraje'));
 const recolectorBonusTotal=members.reduce((sum,member)=>sum+(getSkillBonus(member,'forraje').bonus||0),0);
 const rawFound=(perMemberFound*members.length)+recolectorBonusTotal;
 const found=applyActionModifierToTotal('forraje', rawFound);
 state.food+=found;
 addLog(`${members.length>1?`${s.name} y su grupo forrajean`:s.name+' forrajea'} y consiguen ${found} comida.${recolectorBonusTotal?` (📦+${recolectorBonusTotal})`:''}${members.length>1?` (${members.length} miembros)` : ''}`);
 trackActionXP(s,'forraje');
 if(Math.random()<outsideRiskChance(s,'forraje')) injureSurvivor(s,`🩸 Durante el forrajeo, ${s.name} resulta {injuryLabel}.`,{source:'forage'});
 applyGroupForageRecycleBonuses(s,'forraje');
 }else if(resolvedType==='reciclar'){
 const ctx=getGroupActionContextForSurvivor(s,'reciclar');
 const members=(ctx&&String(ctx.leader.id)===String(s.id)) ? ctx.members : [s];
 const perMemberValue=Math.max(0,Number(gameData.config?.rules?.recycleValue??1)+getActionModifier('reciclar'));
 const chatarBonusTotal=members.reduce((sum,member)=>sum+(getSkillBonus(member,'reciclar').bonus||0),0);
 const rawMaterials=(perMemberValue*members.length)+chatarBonusTotal;
 const totalMaterials=applyActionModifierToTotal('reciclar', rawMaterials);
 state.materials+=totalMaterials;
 addLog(`${members.length>1?`${s.name} y su grupo reciclan`:s.name+' recicla'} y obtienen ${totalMaterials} materiales.${chatarBonusTotal?` (⛏+${chatarBonusTotal})`:''}${members.length>1?` · ${members.length} miembros` : ''}`);
 trackActionXP(s,'reciclar');
 if(Math.random()<outsideRiskChance(s,'reciclar')) injureSurvivor(s,`🩸 Reciclando fuera del asentamiento, ${s.name} resulta {injuryLabel}.`,{source:'recycle'});
 applyGroupForageRecycleBonuses(s,'reciclar');
 }else if(resolvedType==='vigilar'){
 addLog(`${s.name} vigila desde la Atalaya.`);
 }else if(resolvedType==='descansar'||resolvedType==='descansar_exterior'){
 const usesCamp=resolvedType==='descansar_exterior';
 s.fatigue=Number(s.maxFatigue??3);
 addLog(`${s.name} descansa${usesCamp?' en el exterior':''} y recupera toda la fatiga.`);
 const restState=getActionStartMoraleState(s);
 const restChance=restState==='low' ? 0.25 : restState==='normal' ? 0.10 : 0;
 tryGainMoraleWithChance(s, restChance, `😊 ${s.name} consigue recomponerse un poco al descansar. +1 moral.`);
 maybeApplyRestGroupMoraleBonus(s);
 if(s.morale>0) s._lowMoraleRestOnly=false;
 }else if(resolvedType==='construir'){
 const buildTarget=s.action.target;
 const bld=buildTarget?state.buildings[buildTarget]:null;
 if(bld&&bld._underConstruction){
 const workerBonus=Math.max(0,getEquippedEffectTotal(s,'worker')); bld._constructionDaysLeft=Math.max(0,(bld._constructionDaysLeft||1)-1-workerBonus);
 if(bld._constructionDaysLeft>0){
 // Still building — keep survivor occupied
 s._keepBuilding=true;
 addLog(`🔨 ${s.name} continúa construyendo ${bld.name}. (${bld._constructionDaysLeft} día${bld._constructionDaysLeft!==1?'s':''} restante${bld._constructionDaysLeft!==1?'s':''})`);
 } else {
 // Construction complete!
 bld._underConstruction=false;
 bld._constructionCost=0;
 bld._lastConstructionCost=0;
 bld.built=true;
 bld.level+=1;
 bld.active=true;
 checkBuildingUnlocks(buildTarget);
 if(buildTarget==='generador'){ state.electricityCapacity=getElectricityCapacity(); addLog(`⚡ Generador activo. ${state.electricityCapacity} de electricidad disponible.`); }
 addLog(`✅ ${s.name} termina de construir ${bld.name}.`);
 trackActionXP(s,'construir');
 state.stability=Math.min(10,state.stability+1);
 addLog(`🏛 Construcción completada. +1 estabilidad.`);
 }
 } else {
 // Fallback for legacy
 addLog(`${s.name} termina su trabajo de construcción.`);
 trackActionXP(s,'construir');
 state.stability=Math.min(10,state.stability+1);
 addLog(`🏛 Construcción completada. +1 estabilidad.`);
 }
 }else if(resolvedType==='desarrollar_mejora'){
 const upgradeId=s.action?.target;
 const project=getBaseUpgradeProject(upgradeId);
 const up=getBaseUpgradeDef(upgradeId);
 if(project&&project.active&&up){
 project.daysLeft=Math.max(0, Number(project.daysLeft||1)-1);
 if(project.daysLeft>0){
 s._keepUpgradeDevelopment=true;
 addLog(`🛠 ${s.name} continúa desarrollando ${up.name}. (${project.daysLeft} día${project.daysLeft!==1?'s':''} restante${project.daysLeft!==1?'s':''})`);
 } else {
 buildBaseUpgrade(upgradeId);
 addLog(`✅ ${s.name} completa el desarrollo de ${up.name}.`);
 addTechnicalLog('base_upgrade_finish', 'Mejora de base completada.', {upgradeId, upgradeName:up.name, survivorId:s.id, survivorName:s.name});
 }
 }
 }else if(resolvedType==='defender'){
 // resolved collectively after all actions
 }else if(resolvedType==='explorar'){
 trackActionXP(s,'explorar');
 triggerExploreEvent(s); // auto-resolves and logs result
 }else if(resolvedType==='investigar'){
 const neededDays=Number(s._investigationDaysNeeded||0)||Math.max(1,2+Number(getStabilityModifiers().extraResearchDays||0));
 const currentDays=Number(s._investigationDaysDone||0);
 if(currentDays+1>=neededDays){
 // Research complete
 state.meds+=1;
 s._investigationDaysDone=0;
 s._investigationDaysNeeded=0;
 addLog(`💊 ${s.name} completa la investigación en el Hospital. +1 medicamento.`);
 } else {
 s._investigationDaysNeeded=neededDays;
 s._investigationDaysDone=currentDays+1;
 if(currentDays===0&&getStabilityModifiers().extraResearchDays>0){
 addLog('⚠ La baja estabilidad del asentamiento ralentiza el trabajo de investigación. +1 día.');
 }
 addLog(`🔬 ${s.name} investiga en el Hospital (${s._investigationDaysDone}/${neededDays} días).`);
 // Keep occupied next day too
 s._keepInvestigating=true;
 }
 }
 });
 processGroupRestRomance();
 state.survivors.forEach(s=>{ delete s._moraleStateAtActionStart; });
 // Collective attack resolution — only when attack day has arrived
 const hasAttackers=state.survivors.some(s=>s.action?.type==='atacar'&&s.status!=='muerto'&&!isExteriorSurvivor(s));
 // Only resolve once: preemptive takes priority, otherwise check arrival day
 if(state.attackThreat&&(hasAttackers||(state.attackArrivalDay>0&&state.day>=state.attackArrivalDay))) resolveGroupAttack();
}

/* moved to threats.js: checkAttackArrival/resolveGroupAttack */
function outsideRiskChance(survivor, actionType='outside'){
 const outsideCount=state.survivors.filter(s=>['forraje','reciclar','defender','explorar'].includes(s.action?.type)).length;
 const baseMap=getActionRiskChanceMap();
 let base = Number(baseMap[actionType] ?? baseMap.outside ?? DEFAULT_ACTION_RISK_CHANCE.outside) || 0;

 // Ligero aumento si hay mucha gente expuesta fuera a la vez, pero más suave que antes
 if(outsideCount > 1) base += Math.min((outsideCount-1)*0.01, 0.03);

 // Precavido skill: -40% of base risk for that specific survivor
 if(survivor&&getSurvivorSkills(survivor).includes('precavido')) base=base*0.60;
 // Torpe negative trait: +5% injury chance
 if(survivor&&(survivor.negativeSkill||'').toLowerCase()==='torpe') base=Math.min(0.95, base+0.05);
 const armorReduction=getEquippedEffectTotal(survivor,'armor');
 if(armorReduction>0) base=Math.max(0, base*(1-(0.15*armorReduction)));
 base=Math.max(0, Math.min(0.95, base + getRelationshipRiskModifier(survivor)));

 return Math.max(0, base);
}

function applyFoodConsumption(){
 const foodPer=Number(gameData.config?.rules?.foodPerSurvivor??1);
 // Exterior survivors eat from camp inventory
 const extSurvivors=state.survivors.filter(s=>s.status!=='muerto'&&isExteriorSurvivor(s));
 if(extSurvivors.length>0){
 const campNeeded=extSurvivors.length*foodPer;
 if(state.camp.food>=campNeeded){
 state.camp.food-=campNeeded;
 addLog(`⛺ El campamento consume ${campNeeded} comida.`);
 extSurvivors.forEach(s=>{ s.fed=true; changeSurvivorHunger(s,-1); });
 } else {
 addLog(`⛺ Sin comida en el campamento. Los supervivientes en exterior pasan hambre.`);
 extSurvivors.forEach(s=>{ s.fed=false; changeSurvivorHunger(s,2); });
 state.camp.food=0;
 }
 }
 const alive=aliveSurvivors().filter(s=>!isExteriorSurvivor(s));
 const aliveBase=aliveSurvivors().filter(s=>!isExteriorSurvivor(s));
 const recruitedNpcs=(typeof getRecruitedNpcs==='function' ? getRecruitedNpcs() : []).filter(Boolean);
 // Glotón: counts as 2 food portions
 const glutonCount=aliveBase.filter(s=>(s.negativeSkill||'').toLowerCase()==='glotón').length;
 const npcNeeded=recruitedNpcs.length*foodPer;
 const neededBase=aliveBase.length*foodPer + glutonCount + npcNeeded; // gluton counts double
 const needed=Math.max(0,neededBase);

 if(state.food<=0){
 // Nobody eats — hunger rises and stability drops
 alive.filter(s=>s.location!=='exterior').forEach(s=>{
 s.fed=false;
 changeSurvivorHunger(s,2);
 });
 recruitedNpcs.forEach(npc=>{ if(typeof applyNpcNoFoodConsequence==='function') applyNpcNoFoodConsequence(npc); });
 state.stability=Math.max(0,state.stability-1);
 addLog(`🍽 Sin comida. Todos los supervivientes pasan hambre. Hambre +2 individual, -1 estabilidad.`);
 } else if(state.food<needed){
 // Shortage — need to choose who eats
 const canFeed=Math.floor(state.food/foodPer);
 state.food=Math.max(0,state.food-canFeed*foodPer);
 state._pendingFoodChoice={canFeed,survivors:[...alive],npcs:[...recruitedNpcs]};
 addLog(`🍽 Solo hay ${canFeed} ración${canFeed!==1?'es':''} para ${alive.length + recruitedNpcs.length} bocas.`);
 } else {
 // Everyone eats
 state.food-=needed;
 alive.forEach(s=>{
 s.fed=true;
 changeSurvivorHunger(s,-1);
 });
 recruitedNpcs.forEach(npc=>{ npc.fed=true; });
 addLog(`🍽 El grupo consume ${needed} comida.${recruitedNpcs.length?` (${recruitedNpcs.length} NPC${recruitedNpcs.length!==1?'s':''} incluidos)`:''}`);
 }
}


function maybeDamageEquippedWeapon(survivor, chance=0.2){
 if(!survivor) return;
 survivor.inventory = normalizeInventoryList(survivor.inventory||[]);
 const idx = survivor.inventory.findIndex(it => materializeItem(it).itemId===survivor.equippedWeapon);
 if(idx<0) return;
 const item = materializeItem(survivor.inventory[idx]);
 if(item.itemType!=='weapon' || item.quality<=0) return;
 if(Math.random() < chance){
 survivor.inventory[idx] = degradeItem(item, 1);
 if(survivor.inventory[idx].quality<=0){
 addLog(`💥 ${item.name} de ${survivor.name} se rompe.`);
 survivor.equippedWeapon = null;
 } else {
 addLog(`🔧 ${item.name} de ${survivor.name} pierde calidad (${survivor.inventory[idx].quality}/${survivor.inventory[idx].maxQuality}).`);
 }
 }
}


function normalizeResourceKey(key){
 const raw=String(key||'').trim().toLowerCase();
 const aliases={
 food:'food', comida:'food',
 materials:'materials', material:'materials', materiales:'materials',
 meds:'meds', medicine:'meds', medicines:'meds', medicamento:'meds', medicamentos:'meds',
 fuel:'fuel', gasolina:'fuel', combustible:'fuel',
 chickens:'chickens', chicken:'chickens', gallina:'chickens', gallinas:'chickens',
 electricity:'electricity', electricidad:'electricity',
 stability:'stability', estabilidad:'stability',
 morale:'morale', moral:'morale'
 };
 return aliases[raw] || raw;
}
function getStateResourceValue(key){
 if(key==='combustible') key='fuel';
 if(key==='medicamentos') key='meds';
 if(key==='estabilidad') key='stability';
 if(key==='gallinas') key='chickens';
 return Number(state[key]||0);
}
function getMissingResourcesForEffects(effects){
 const missing=[];
 (effects||[]).forEach(e=>{
 if(!e||e.type!=='removeResource') return;
 const key=normalizeResourceKey(e.resource);
 const need=Number(e.amount||0);
 const have=getStateResourceValue(key);
 if(have<need){
 missing.push({resource:key, need, have, missing:need-have});
 }
 });
 return missing;
}
function optionIsAffordable(opt){
 return getMissingResourcesForEffects([...(opt?.cost||[]), ...(opt?.effects||[])]).length===0;
}
/* dedup:runFoodAndMoralePhase moved to survivors.js */


function resolveFoodChoice(fedIds){
 const alive=(state._pendingFoodChoice?.survivors||aliveSurvivors().filter(s=>!isExteriorSurvivor(s)));
 const npcs=(state._pendingFoodChoice?.npcs||[]);
 alive.forEach(s=>{
 if(fedIds.includes(s.id)){
 s.fed=true;
 changeSurvivorHunger(s,-1);
 addLog(`🍽 ${s.name} recibe una ración.`);
 } else {
 s.fed=false;
 changeSurvivorHunger(s,2);
 addLog(`🍽 ${s.name} no ha comido hoy. Hambre +2.`);
 }
 });
 npcs.forEach(npc=>{
  if(fedIds.includes(npc.id)){
   npc.fed=true;
   addLog(`🍽 ${npc.name} recibe una ración.`);
  } else {
   npc.fed=false;
   if(typeof applyNpcNoFoodConsequence==='function') applyNpcNoFoodConsequence(npc);
  }
 });
 state._pendingFoodChoice=null;
 render();
}


function getNextTreatmentSurvivor(){
 const queue=Array.isArray(state._pendingTreatmentQueue)?state._pendingTreatmentQueue:[];
 while(queue.length){
 const id=queue[0];
 const s=state.survivors.find(x=>x.id===id);
 if(!s||!hasActiveInjury(s)){
 queue.shift();
 continue;
 }
 ensureInjuryState(s);
 if((s.injuryLevel!=='seria'&&s.injuryLevel!=='grave')||s._injuryTreatedToday){
 queue.shift();
 continue;
 }
 if(state.meds<=0){
 applyUntreatedInjuryOutcome(s);
 queue.shift();
 continue;
 }
 state._currentTreatmentSurvivorId=s.id;
 return s;
 }
 state._currentTreatmentSurvivorId=null;
 return null;
}

/* dedup:closeInjuryTreatmentPopup moved to survivors.js */


function advanceTreatmentFlow(){
 const next=getNextTreatmentSurvivor();
 if(next){
 openInjuryTreatmentPopup();
 return;
 }
 closeInjuryTreatmentPopup();
 finalizeInjuriesEndOfDay();
 maybeContinueEndDayAfterPause();
}

/* dedup:openInjuryTreatmentPopup moved to survivors.js */


function applyBarracksPenalty(){
 const overflow=Math.max(0,aliveSurvivors().length-barracksCapacity());
 if(overflow>0){state.stability=Math.max(0,state.stability-overflow);addLog(`Los barracones están saturados. -${overflow} estabilidad.`)}
}

function processDelayedEffects(){
 const due=state.delayedQueue.filter(item=>item.day===state.day);
 state.delayedQueue=state.delayedQueue.filter(item=>item.day!==state.day);
 due.forEach(item=>applyEffect(item.effect,true));
}


function dismissSurvivorById(targetId, reason='abandona el asentamiento'){
 if(!targetId) return false;
 const idx=(state.survivors||[]).findIndex(s=>s&&s.id===targetId);
 if(idx<0){
 addLog(`No se pudo despedir al superviviente ${targetId}: no existe en la partida.`);
 addTechnicalLog('remove_survivor_missing', 'No se encontró el superviviente a despedir.', {targetId});
 return false;
 }
 const survivor=state.survivors[idx];
 cancelConstructionForSurvivor(survivor, 'abandono del asentamiento');
 cancelBaseUpgradeDevelopmentForSurvivor(survivor, 'abandono del asentamiento');
 if(Array.isArray(state._pendingTreatmentQueue)) state._pendingTreatmentQueue=state._pendingTreatmentQueue.filter(id=>id!==targetId);
 if(state._currentTreatmentSurvivorId===targetId) state._currentTreatmentSurvivorId=null;
 if(state._pendingSurvivor?.id===targetId) state._pendingSurvivor=null;
 state.survivors.splice(idx,1);
 addLog(`👋 ${survivor.name} ${reason}.`);
 addTechnicalLog('remove_survivor', 'Superviviente eliminado de la partida.', {targetId, survivorName:survivor.name, reason});
 render();
 return true;
}

function weightedPickField(items,field){
 const total=items.reduce((sum,i)=>sum+Number(i[field]||0),0);
 if(!total) return items[0]||null;
 let r=Math.random()*total;
 for(const item of items){r-=Number(item[field]||0);if(r<=0)return item}
 return items[0]||null;
}

function addTechnicalLog(type, message, extra = {}){
 if(!Array.isArray(state.technicalLog)) state.technicalLog = [];
 const entry = {
 ts: new Date().toISOString(),
 day: state.day,
 phase: getPhaseLabel(),
 type: type || 'info',
 message: message || '',
 extra: extra || {}
 };
 state.technicalLog.push(entry);
 if(state.technicalLog.length > 800) state.technicalLog.shift();
}

function getPhaseLabel(){
 if(state._processingDay) return 'procesando_fin_dia';
 if(state.pendingEvent) return 'evento_activo';
 return 'esperando_acciones';
}

function getTechnicalLogText(){
 const lines = [];
 lines.push('=== RESURGIR · LOG TÉCNICO DE PARTIDA ===');
 lines.push(`Generado: ${new Date().toISOString()}`);
 lines.push(`Día actual: ${state.day}`);
 lines.push(`Supervivientes vivos: ${aliveSurvivors().length}`);
 lines.push(`Recursos base: comida=${state.food} | materiales=${state.materials} | meds=${state.meds} | combustible=${state.fuel} | electricidad=${state.electricity} | gallinas=${state.chickens} | estabilidad=${state.stability}`);
 lines.push(`Procesando día: ${state._processingDay ? 'sí' : 'no'}`);
 lines.push('');
 (state.technicalLog || []).forEach((entry, idx) => {
 lines.push(`#${String(idx+1).padStart(4,'0')} | ${entry.ts} | día=${entry.day} | fase=${entry.phase} | tipo=${entry.type}`);
 if(entry.message) lines.push(entry.message);
 if(entry.extra && Object.keys(entry.extra).length){
 try {
 lines.push(JSON.stringify(entry.extra, null, 2));
 } catch(e) {
 lines.push(String(entry.extra));
 }
 }
 lines.push('');
 });
 return lines.join('\n');
}

async function copyTechnicalLog(){
 const txt = getTechnicalLogText();
 try{
 await navigator.clipboard.writeText(txt);
 addLog('📋 Log técnico copiado al portapapeles.');
 }catch(e){
 addLog('⚠ No se pudo copiar el log técnico.');
 }
}

function maxSkillsForRarity(rarity){
 const r = Number(rarity || 4);
 if (r <= 1) return 4; // muy raro
 if (r === 2) return 3; // raro
 if (r === 3) return 2; // común
 return 1; // básico
}

function trackActionXP(survivor, actionType){
 const possible=getActionSkillMap()[actionType];
 if(!possible) return;

 const key=`${survivor.id}_${actionType}`;
 if(!state.actionXP[key]) state.actionXP[key]=0;
 state.actionXP[key]++;

 // Every 10 uses: 1 chance to unlock a skill
 if(state.actionXP[key]%10!==0) return;

 const currentSkills=getSurvivorSkills(survivor);
 const maxSkills=maxSkillsForRarity(survivor.rarity);

 if(currentSkills.length>=maxSkills) return; // already at cap

 // Pick a skill from the possible ones not already owned
 const candidates=possible.filter(sk=>!currentSkills.includes(sk));
 if(!candidates.length) return;

 const newSkill=candidates[Math.floor(Math.random()*candidates.length)];

 // Add to skills array
 if(!Array.isArray(survivor.skills)) survivor.skills=[...currentSkills];
 survivor.skills.push(newSkill);
 survivor.skill=survivor.skills[0]; // keep legacy field in sync

 addLog(`★ ${survivor.name} ha aprendido: ${getSurvivorSkillLabel({skill:newSkill})}!`);
}


// ── ACTION ICONS ──
// All possible actions in display order
const ALL_ACTIONS = ['vigilar','forraje','reciclar','construir','explorar','viajar','atacar','defender','investigar','descansar'];
const SURVIVOR_PANEL_ACTIONS = ['forraje','reciclar','construir','explorar','viajar','atacar','defender','descansar'];
const ALL_ACTIONS_EXTERIOR = []; // exterior actions shown in location detail, not in card

// ── BUILDING CATALOG HELPERS ──
function getDogPopupTargets(currentOwnerId){
 return aliveSurvivors().filter(s=>String(s.id)!==String(currentOwnerId) && s.status==='activo');
}
function assignDogToSurvivor(targetId){
 if(!state.dog){ addLog('🐕 No hay perro asignado en el asentamiento.'); render(); return; }
 const target=getAliveSurvivorById(targetId);
 if(!target){ addLog('🐕 No se ha encontrado al superviviente seleccionado.'); render(); return; }
 if(target.status!=='activo'){
 addLog(`🐕 ${target.name} no está activo y el perro no puede seguirle ahora.`);
 render();
 return;
 }
 state.dog.ownerId=target.id;
 const popup=document.getElementById('decidePopup');
 if(popup) popup.classList.remove('open');
 addLog(`🐕 ${state.dog.name} ahora sigue a ${target.name}.`);
 addTechnicalLog('dog_reassigned','El perro cambia de superviviente.', {dogId:state.dog.id,dogName:state.dog.name,targetId:target.id,targetName:target.name});
 render();
}
function getSkillBonus(survivor, context){
 // Check all skills (array or legacy single)
 const skills=getSurvivorSkills(survivor).map(s=>s.toLowerCase().trim());
 // Run through each skill and merge bonuses
 let merged={};
 for(const skill of skills.length?skills:[(survivor.skill||'ninguna').toLowerCase().trim()]){
 const b=_getSingleSkillBonus(skill,context);
 Object.assign(merged,b);
 }
 return merged;
}
function _getSingleSkillBonus(skill, context){
 switch(skill){
 case 'ingeniero':
 // Building costs -1 material (min 1)
 if(context==='build') return {costReduction:1};
 break;
 case 'inventor':
 if(context==='develop_upgrade') return {daysReduction:Number(gameData.config?.rules?.inventorUpgradeTimeReduction??1)};
 break;
 case 'explorador':
 // +10% weight to positive explore events
 if(context==='event_positive') return {weightMult:1.10};
 break;
 case 'precavido':
 // -10% weight to negative explore events
 if(context==='event_negative') return {weightMult:0.90};
 break;
 case 'rastreador':
 // Bonus to survivor category when exploring
 if(context==='explore_survivor') return {categoryBonus:Number(gameData.config?.rules?.trackerAddsSurvivorEventWeight??5)};
 break;
 case 'recolector':
 // +1 food when foraging
 if(context==='forraje') return {bonus:1};
 break;
 case 'cazador':
 // +1 food when exploring
 if(context==='explore_food') return {bonus:1};
 break;
 case 'chatarrero':
 // +1 material when recycling
 if(context==='reciclar') return {bonus:1};
 break;
 case 'combatiente':
 if(context==='ataque_preventivo') return {attackBonus:1};
 break;
 case 'lider':
 if(context==='group_positive') return {mult:1.10};
 break;
 case 'resolutivo':
 if(context==='threat_action') return {chanceBonus:10};
 break;
 }
 return {};
}

// Helper: get all active (non-dead) survivor skills for a context
function getActiveSkillBonuses(context){
 return aliveSurvivors()
 .filter(s=>s.action?.type!==undefined||true)
 .map(s=>getSkillBonus(s,context))
 .filter(b=>Object.keys(b).length>0);
}


// Helper: get all skills declared on a survivor, keeping legacy compatibility
/* dedup:getSurvivorSkills moved to survivors.js */


// Helper: get skill bonus for a specific survivor
/* dedup:getSurvivorSkillLabel moved to survivors.js */


// ── LOCATION SYSTEM ──


function applyLootList(lootArr,target='base'){
 (lootArr||[]).forEach(entry=>{
 if(Math.random()<(entry.chance||0)){
 const [min,max]=entry.amount||[1,1];
 const amount=Math.floor(Math.random()*(max-min+1))+min;
 if(target==='camp'){
 addCampResource(entry.resource, amount, 'Botín exterior');
 } else if(typeof state[entry.resource]==='number'){
 state[entry.resource]+=amount;
 addLog(`📦 +${amount} ${resourceLabel(entry.resource)}.`);
 }
 }
 });
}

/* moved to threats.js: getHostileTypeDef/getHostileDef/resolveHostileVariant/getHostileLabel */
function generateLocations(){
 const templates=gameData.locationTemplates||[];
 if(!templates.length) return;
 state.locations=[];
 const availableZones=(gameData.zones||[]).filter(z=>state.day>=(z.unlockDay||1));
 const zone=availableZones.length
 ? availableZones[Math.floor(Math.random()*availableZones.length)]
 : null;
 state.activeZone=zone||null;
 let picked=[];
 if(zone&&zone.slots?.length){
 zone.slots.forEach(slot=>{
 const pool=templates.filter(t=>(t.riskLevel??0)===slot.riskLevel);
 for(let i=0;i<slot.count;i++){
 if(!pool.length){
 const fallback=[...templates].sort((a,b)=>Math.abs((a.riskLevel??0)-slot.riskLevel)-Math.abs((b.riskLevel??0)-slot.riskLevel));
 if(fallback.length) picked.push(fallback[0]);
 } else {
 picked.push(pool[Math.floor(Math.random()*pool.length)]);
 }
 }
 });
 } else {
 const shuffled=[...templates].sort(()=>Math.random()-0.5);
 picked=shuffled.slice(0,Math.min(7,shuffled.length));
 }
 const positions=generateMapPositions(picked.length);
 picked.forEach((tpl,i)=>{
 const adj=tpl.adjectives?.length?tpl.adjectives[Math.floor(Math.random()*tpl.adjectives.length)]:'';
 const rawName=(tpl.name||'Ubicación exterior');
 const name=rawName.replace('{adj}',adj).trim();
 const hostileChance=tpl.hostilesChance??tpl.raidersChance??0;
 const hasRaiders=Math.random()<hostileChance;
 const hostileTypes=tpl.hostileTypes||['raiders'];
 const pickedHostileType=hostileTypes[Math.floor(Math.random()*hostileTypes.length)]||'raiders';
 const hostileStrMin=tpl.hostileStrength?.[0]??tpl.attackStrength??2;
 const hostileStrMax=tpl.hostileStrength?.[1]??hostileStrMin+2;
 const hostileStrength=Math.floor(Math.random()*(hostileStrMax-hostileStrMin+1))+hostileStrMin;
 const resources={};
 Object.entries(tpl.resources||{}).forEach(([k,[min,max]])=>{
 resources[k]=Math.floor(Math.random()*(max-min+1))+min;
 });
 const maxResources=deepClone(resources);
 const lootYield=normalizeResourceRangeMap(tpl.lootYield||tpl.resourceYield||tpl.lootPerAction||tpl.gatherPerAction||{});
 Object.keys(resources).forEach(key=>{
 if(!lootYield[key]){
 const fallbackMax=Math.max(1, Math.min(3, Number(maxResources[key]||1)));
 lootYield[key]=[1, fallbackMax];
 }
 });
 const resourceMode=inferLocationResourceMode(tpl);
 state.locations.push({
 instanceId:'loc_'+Math.random().toString(36).slice(2,8),
 templateId:tpl.id,
 name,
 icon:tpl.icon||'📍',
 description:tpl.description||'',
 riskLevel:tpl.riskLevel||0,
 status:'undiscovered',
 hasRaiders,
 hostileType:hasRaiders?pickedHostileType:'none',
 hostileStrength:hasRaiders?hostileStrength:0,
 hostileLabel:hasRaiders?getHostileLabel(pickedHostileType):'',
 exhaustible:tpl.exhaustible!==false,
 exhausted:false,
 resourceMode,
 resources,
 maxResources,
 lootYield,
 exploitResources:tpl.exploitResources||null,
 regenerateDays:tpl.regenerateDays||null,
 respawnDays:Number(tpl.respawnDays||tpl.regenerateDays||0)||null,
 respawnReadyDay:null,
 lastRegenDay:0,
 exploreDays:tpl.exploreDays||1,
 survivorSpawn:tpl.survivorSpawn||null,
 survivorChance:tpl.survivorSpawn?.chance||tpl.survivorChance||0,
 exploringBy:null,
 exploreStartDay:null,
 observed:false,
 x:positions[i].x,
 y:positions[i].y,
 });
 });
}

// ── SURVIVOR MORALE SYSTEM ──
/* dedup:hasLowMoraleRestRestriction moved to survivors.js */


function queueDeparturePopup(entry){
 if(!Array.isArray(state.departureQueue)) state.departureQueue=[];
 state.departureQueue.push(entry);
}
function checkLowMorale(){
 aliveSurvivors().forEach(s=>{
 if(s.morale>0){
 s._lowMoraleRestOnly=false;
 return;
 }
 if(s.status==='muerto') return;
 // Can recover by resting if food available
 if((s.action?.type==='descansar'&&state.food>0)||(s.action?.type==='descansar_exterior'&&state.camp.food>0)){
 s.morale=1;
 s.fed=true;
 s._lowMoraleRestOnly=false;
 if(s.action?.type==='descansar_exterior') state.camp.food=Math.max(0,state.camp.food-1);
 else state.food=Math.max(0,state.food-1);
 addLog(`${s.name} descansa y recupera la moral gracias a una ración extra.`);
 return;
 }

 const roll=Math.random();
 if(roll<0.20){
 s._lowMoraleRestOnly=false;
 triggerSurvivorLeaving(s,{forceBetrayal:true});
 return;
 }
 if(roll<0.50){
 s._lowMoraleRestOnly=false;
 triggerSurvivorLeaving(s,{forceBetrayal:false});
 return;
 }
 if(roll<0.90){
 s._lowMoraleRestOnly=false;
 if(queueEventById('lowmorale',s)) addLog(`😞 ${s.name} entra en crisis y activará el evento lowmorale.`);
 else addLog(`⚠ ${s.name} entra en crisis, pero no existe el evento lowmorale.`);
 return;
 }

 s._lowMoraleRestOnly=true;
 addLog(`😶 ${s.name} se niega a hacer nada salvo descansar.`);
 });
}

function triggerSurvivorLeaving(s, opts={}){
 const stabilityAbandonBonus=Number(getStabilityModifiers().abandonChanceBonus||0);
 const betrayChance=Math.max(0,Math.min(1,0.4+stabilityAbandonBonus));
 const forcedBetrayal=typeof opts.forceBetrayal==='boolean'?opts.forceBetrayal:null;
 const betrays=forcedBetrayal!==null?forcedBetrayal:(Math.random()<betrayChance);
 let popupText=`La tensión, el hambre y el miedo han podido con ${s.name}. Aprovecha la noche para marcharse sin mirar atrás.`;
 if(betrays){
 addLog(`💢 ${s.name} ha traicionado al asentamiento antes de marcharse.`);
 const betrayalType=Math.floor(Math.random()*3);
 if(betrayalType===0){
 const built=Object.values(state.buildings).filter(b=>b.built&&b.active);
 if(built.length){
 const b=pick(built);
 b.built=false; b.level=0;
 addLog(`🔥 ${s.name} destruyó ${b.name} antes de irse.`);
 popupText=`${s.name} abandona la base en plena crisis moral y, antes de irse, destruye ${b.name}.`;
 }
 } else if(betrayalType===1){
 const built=Object.values(state.buildings).filter(b=>b.built&&b.active);
 if(built.length){
 const b=pick(built);
 b.active=false;
 addLog(`⚠ ${s.name} saboteó ${b.name} antes de irse.`);
 popupText=`${s.name} abandona la base con resentimiento y sabotea ${b.name} antes de desaparecer.`;
 }
 } else {
 const stolen=Math.min(state.food,Math.floor(Math.random()*3)+1);
 state.food=Math.max(0,state.food-stolen);
 const stolenMat=Math.min(state.materials,Math.floor(Math.random()*3)+1);
 state.materials=Math.max(0,state.materials-stolenMat);
 addLog(`💰 ${s.name} robó ${stolen} comida y ${stolenMat} materiales antes de irse.`);
 popupText=`${s.name} huye del asentamiento y se lleva provisiones: ${stolen} comida y ${stolenMat} materiales.`;
 }
 } else {
 addLog(`🚪 ${s.name} ha abandonado el asentamiento.`);
 }
 state.stability=Math.max(0,state.stability-2);
 applyRelationshipShock(s,'left');
 state.cemetery.push({
 id:s.id, name:s.name, imageUrl:s.imageUrl||'',
 story:s.story||'', diedOnDay:state.day,
 departed:true, betrayed:betrays
 });
 s.status='muerto';
 const effectsText=`-2 estabilidad por la ${betrays?'traición':'partida'} de ${s.name}.`;
 addLog(effectsText);
 addTechnicalLog('survivor_departure','Un superviviente abandona el asentamiento por baja moral.', {
 survivorId:s.id,
 survivorName:s.name,
 betrayed:betrays,
 stabilityAfter:state.stability,
 text:popupText
 });
 queueDeparturePopup({
 id:s.id,
 name:s.name,
 imageUrl:s.imageUrl||'',
 betrayed:betrays,
 text:popupText,
 effectsText
 });
 if(document.getElementById('departurePopup') && !document.getElementById('departurePopup').classList.contains('open')){
 openNextDeparturePopup();
 }
}

/* dedup:applyDailyMoraleDecay moved to survivors.js */


/* dedup:applyUntreatedInjuryOutcome moved to survivors.js */


function finalizeInjuriesEndOfDay(){
 aliveSurvivors().forEach(s=>{
 if(!hasActiveInjury(s)){
 delete s._injuryTreatedToday;
 delete s._injuryRestedToday;
 return;
 }
 ensureInjuryState(s);
 const currentNeeded=INJURY_REST_DAYS[s.injuryLevel]||1;
 const treated=!!s._injuryTreatedToday;
 const rested=!!s._injuryRestedToday;
 if(rested && s.injuryRestDays>=currentNeeded && (s.injuryLevel==='simple' || treated)){
 s.injuryLevel=null;
 s.injuryRestDays=0;
 addLog(`✅ ${s.name} se recupera de sus heridas tras descansar.`);
 }
 delete s._injuryTreatedToday;
 delete s._injuryRestedToday;
 });
 state._pendingTreatmentQueue=null;
 state._currentTreatmentSurvivorId=null;
}

function processInjuriesEndOfDay(){
 const treatmentQueue=[];
 aliveSurvivors().forEach(s=>{
 if(!hasActiveInjury(s)) return;
 ensureInjuryState(s);
 s._injuryTreatedToday=false;
 const isResting=s.action?.type==='descansar'||s.action?.type==='descansar_exterior';
 s._injuryRestedToday=isResting;
 const needed=INJURY_REST_DAYS[s.injuryLevel]||1;
 if(isResting){
 s.injuryRestDays=Math.min(needed, Number(s.injuryRestDays||0)+1);
 }
 });

 aliveSurvivors().forEach(s=>{
 if(!hasActiveInjury(s)) return;
 ensureInjuryState(s);
 const level=String(s.injuryLevel||'').toLowerCase();
 if(!s._injuryRestedToday) return;
 if(!getInjuryTreatmentChoiceRequired(level)) return;
 if(state.meds>0 || getAvailableHealingStock()>0){
 treatmentQueue.push(s.id);
 } else {
 applyUntreatedInjuryOutcome(s);
 }
 });

 if(treatmentQueue.length){
 state._pendingTreatmentQueue=treatmentQueue;
 state._currentTreatmentSurvivorId=treatmentQueue[0]||null;
 return;
 }

 finalizeInjuriesEndOfDay();
}


function resetForNewDay(){
 if(!state.actionLimits) state.actionLimits={};
 Object.keys(state.actionLimits).forEach(action=>{
 if(Number(state.actionLimits[action])<state.day) delete state.actionLimits[action];
 });
 applyStartOfDayHungerAndMorale();
 window.tempActionLimits={};window.tempActionMods={};
 state.survivors.forEach(s=>{
 s._actionResolved=false; // clear for next day
 s._exteriorActionLocked=false;
 clearGroupActionMarkers(s);
 if(s._keepInvestigating&&s.status!=='muerto'){
 s._keepInvestigating=false;
 s.action={type:'investigar'};
 s.status='ocupado';
 } else if(s._keepBuilding&&s.status!=='muerto'){
 s._keepBuilding=false;
 // Keep same construir action with same target
 s.status='ocupado';
 // action stays as-is
 } else if(s._keepUpgradeDevelopment&&s.status!=='muerto'){
 s._keepUpgradeDevelopment=false;
 s.status='ocupado';
 // action stays as-is
 } else {
 if(s.location==='travelling'&&s.status!=='muerto'){
 s.status='ocupado';
 } else {
 if(s.status==='ocupado') s.status='activo';
 if(s.status!=='muerto') s.action=null;
 }
 }
 });
 Object.values(state.buildings).forEach(b=>{
 const disabledUntil=Number(state.buildingDisableTimers?.[b.id]||0);
 if(disabledUntil>=state.day) b.active=false;
 else if(b.built) {
 b.active=true;
 if(state.buildingDisableTimers) delete state.buildingDisableTimers[b.id];
 }
 });
 if(state.buildings?.barracon_medico) state.buildings.barracon_medico._usedToday=false;
}

function getGroupActionEligibleSurvivors(selectedAction=null){
 return state.survivors.filter(s=>{
 if(!s||s.status!=='activo') return false;
 if((s.location||'base')!=='base') return false;
 if(s._exteriorActionLocked) return false;
 if(s.action?.type==='construir'&&s.action?.target) return false;
 if(selectedAction && !getAvailableActions(s).includes(selectedAction)) return false;
 return true;
 });
}
function getAvailableGroupActions(){
 const survivors=getGroupActionEligibleSurvivors();
 const set=new Set();
 survivors.forEach(s=>{
 getAvailableActions(s).forEach(action=>{
 if(['vigilar','forraje','reciclar','explorar','atacar','defender','descansar'].includes(action)) set.add(action);
 });
 });
 return ['vigilar','forraje','reciclar','explorar','atacar','defender','descansar'].filter(action=>set.has(action));
}
function resetGroupActionDraft(force=false){
 const available=getAvailableGroupActions();
 const currentAction=!force && state._groupActionDraft?.action && available.includes(state._groupActionDraft.action) ? state._groupActionDraft.action : (available[0]||null);
 const currentMembers=!force && Array.isArray(state._groupActionDraft?.members) ? state._groupActionDraft.members.filter(id=>getGroupActionEligibleSurvivors(currentAction).some(s=>String(s.id)===String(id))) : [];
 state._groupActionDraft={action:currentAction,members:currentMembers};
}
function clearGroupActionMarkers(survivor){
 if(!survivor) return;
 delete survivor._groupActionId;
 delete survivor._groupActionRole;
}
function confirmGroupAction(){
 const draft=state._groupActionDraft||{};
 const action=draft.action;
 const memberIds=Array.isArray(draft.members)?draft.members.map(String):[];
 if(!action||!memberIds.length){ renderGroupActionPopup(); return; }
 const eligible=getGroupActionEligibleSurvivors(action).map(s=>String(s.id));
 const survivors=memberIds.map(id=>state.survivors.find(s=>String(s.id)===id)).filter(Boolean).filter(s=>eligible.includes(String(s.id)));
 if(!survivors.length){ renderGroupActionPopup(); return; }
 const groupId=`grp_${state.day}_${++groupActionSequence}`;
 survivors.forEach((s,idx)=>{
 s.action={type:action, groupId, role:idx===0?'leader':'support'};
 s.status='ocupado';
 s._actionResolved=false;
 s._groupActionId=groupId;
 s._groupActionRole=idx===0?'leader':'support';
 });
 const leader=survivors[0];
 const supportNames=survivors.slice(1).map(s=>s.name);
 addLog(`🤝 Acción grupal asignada: ${actionLabel(action)} · ★ líder ${leader.name}${supportNames.length?` · apoyo ${supportNames.join(', ')}`:''}.`);
 closeGroupActionPopup();
 render();
}
function getGroupActionMini(s){
 if(!s?._groupActionId || !s?.action) return '';
 const text=s._groupActionRole==='leader' ? `★ Líder · ${actionLabel(s.action.type)}` : `🤝 Apoyo · ${actionLabel(s.action.type)}`;
 const color=s._groupActionRole==='leader' ? 'var(--amber-bright)' : 'var(--accent-bright)';
 return `<div class="mini" style="color:${color};font-weight:700;">${text}</div>`;
}

function resetAssignments(){
 state.survivors.forEach(s=>{
 if(s.status==='muerto'){ clearGroupActionMarkers(s); return; }
 const isLockedBuilder=s.action?.type==='construir'&&s.action?.target;
 if(isLockedBuilder||s._exteriorActionLocked) return;
 if(s.location==='travelling') return;
 if(s.status==='ocupado') s.status='activo';
 s.action=null;
 s._actionResolved=false;
 clearGroupActionMarkers(s);
 });
 addLog('Se han limpiado las asignaciones del día.');
 render();
}

function getAvailableActions(s){
 if(s.status==='muerto') return [];
 if(hasLowMoraleRestRestriction(s)) return ['descansar'];
 if(requiresForcedRest(s)||Number(s.fatigue||0)<=0) return ['descansar'];
 const neg=(s.negativeSkill||'').toLowerCase().trim();
 const arr=['forraje','reciclar','construir'];
 if(neg!=='miedoso') arr.push('explorar');
 if((s.location||'base')==='base') arr.push('viajar');
 if(state.buildings.atalaya?.built&&state.buildings.atalaya?.active) arr.unshift('vigilar');
 if((s.location||'base')==='base'&&state.attackThreat&&neg!=='cobarde'){
 const daysLeft=Math.max(0,state.attackArrivalDay-state.day);
 if(daysLeft<=0) arr.push('defender'); // arrival day: defend only
 else arr.push('atacar'); // before arrival: preemptive strike
 }
 arr.push('descansar');
 return arr.filter(a=>!isActionLimited(a));
}

function isActionLimited(action){
 const hardLimit=Number(state.actionLimits?.[action]||0)>=state.day;
 const tempLimit=!!(window.tempActionLimits&&window.tempActionLimits[action]);
 return hardLimit||tempLimit;
}
function getActionModifierState(action){
 const raw=window.tempActionMods?.[action];
 if(raw && typeof raw==='object'){
  const flat=Number(raw.flat||0);
  const percent=Number(raw.percent||0);
  return {flat:Number.isFinite(flat)?flat:0, percent:Number.isFinite(percent)?percent:0};
 }
 const legacy=Number(raw||0);
 return {flat:Number.isFinite(legacy)?legacy:0, percent:0};
}
function getActionModifier(action){return getActionModifierState(action).flat}
function getActionPercentModifier(action){return getActionModifierState(action).percent}
function applyActionModifierToTotal(action,total){
 const base=Math.max(0, Number(total||0)||0);
 const percent=getActionPercentModifier(action);
 if(!percent) return base;
 return Math.max(0, Math.round(base*(1+(percent/100))));
}
function actionLabel(type){return({vigilar:'Vigilar',forraje:'Forrajear',reciclar:'Reciclar',descansar:'Descansar',descansar_exterior:'Descansar (exterior)',construir:'Construir',desarrollar_mejora:'Desarrollar mejora',defender:'Defender',explorar:'Explorar',viajar:'Viajar',viajar_exterior:'Moverse por exterior',investigar:'Investigar',atacar:'Atacar (preventivo)',saquear_exterior:'Saquear',explotar_exterior:'Explotar',atacar_exterior:'Atacar exterior',regresar:'Volver a base'})[type]||type}
function actionSummary(s){
 if(s.status==='muerto') return 'No disponible.';
 if(hasLowMoraleRestRestriction(s)&&!s.action) return 'Sin moral. Solo quiere descansar.';
 if(requiresForcedRest(s)&&!s.action) return `Tiene herida ${injuryDisplayName(s.injuryLevel||'simple')}. Solo puede descansar.`;
 if(hasActiveInjury(s)&&!s.action) return `Está herido (${injuryDisplayName(s.injuryLevel||'simple')}).`;
 if(Number(s.fatigue||0)<=0&&!s.action) return 'Sin fatiga disponible. Solo puede descansar.';
 if(!s.action) return 'Sin acción asignada.';

 if(s.action.type==='construir'&&s.action.target){
 const bld=state.buildings?.[s.action.target];
 const daysLeft=Math.max(0,Number(bld?._constructionDaysLeft??0));
 const daysText=daysLeft>0?` · ${daysLeft} día${daysLeft!==1?'s':''} restante${daysLeft!==1?'s':''}`:' · completando';
 return `Acción asignada: ${actionLabel(s.action.type)} → ${s.action.target}${daysText}`;
 }

 if(s.action.target) return `Acción asignada: ${actionLabel(s.action.type)} → ${s.action.target}`;
 return `Acción asignada: ${actionLabel(s.action.type)}`;
}
function statusLabel(status){return({activo:'Activo',ocupado:'Ocupado',herido:'Herido',muerto:'Muerto'})[status]||status}


function getSurvivorImage(s){
 if(s.status==='muerto') return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%230a0c09'/%3E%3Crect x='35' y='60' width='30' height='28' rx='2' fill='%23222' stroke='%23444' stroke-width='1.5'/%3E%3Crect x='40' y='65' width='20' height='4' rx='1' fill='%23444'/%3E%3Cpath d='M30 60 Q50 20 70 60 Z' fill='%23222' stroke='%23444' stroke-width='1.5'/%3E%3Ctext x='50' y='52' text-anchor='middle' font-size='14' fill='%23556' font-family='serif'%3E%E2%9C%9D%3C/text%3E%3Cpath d='M44 72 h12 M50 68 v8' stroke='%23445' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E`;
 if(hasActiveInjury(s)&&s.imageUrlInjured) return s.imageUrlInjured;
 return s.imageUrl||'';
}

const INJURY_REST_DAYS={simple:1,seria:2,grave:3};
const INJURY_NO_MEDS_TABLE={
 1:'worsen',
 2:'same',
 3:'same',
 4:'same',
 5:'improve',
 6:'improve',
};
const INJURY_LEVEL_RULES={
 generic:{simple:0.7, seria:0.22, grave:0.08},
 outside:{simple:0.65, seria:0.25, grave:0.10},
 forage:{simple:0.90, seria:0.10, grave:0.00},
 recycle:{simple:0.80, seria:0.18, grave:0.02},
 explore:{simple:0.60, seria:0.30, grave:0.10},
 combat:{simple:0.5, seria:0.32, grave:0.18},
 ambush:{simple:0.55, seria:0.30, grave:0.15},
 event:{simple:0.7, seria:0.23, grave:0.07},
};
function injuryDisplayName(level){
 return ({simple:'simple',seria:'seria',grave:'grave'})[level]||'simple';
}
/* dedup:nextInjuryLevel moved to survivors.js */

/* dedup:hasActiveInjury moved to survivors.js */

/* dedup:ensureInjuryState moved to survivors.js */

function requiresForcedRest(s){
 if(!hasActiveInjury(s)) return false;
 ensureInjuryState(s);
 return true;
}
function injuredLabel(s){
 const level=s?.injuryLevel||'simple';
 return `herido/a (${injuryDisplayName(level)})`;
}
/* dedup:normalizeForcedInjuryLevel moved to survivors.js */

/* dedup:rollInjuryLevel moved to survivors.js */


/* dedup:getMoraleEmoji moved to survivors.js */

function resourceLabel(key){return({food:'Comida',materials:'Materiales',morale:'Moral',stability:'Estabilidad',meds:'Medicamentos',electricity:'Electricidad',chickens:'Gallinas',fuel:'Combustible'})[key]||key}
/* dedup:aliveSurvivors moved to survivors.js */

/* dedup:getAliveSurvivorById moved to survivors.js */


function barracksCapacity(){const base=Number(gameData.config?.rules?.barracksCapacity??4);return state.buildings.barracones?.built?state.buildings.barracones.level*base:0}
/* dedup:injureSurvivor moved to survivors.js */


/* dedup:killSurvivor moved to survivors.js */


function _doKill(s, msg){
 cancelConstructionForSurvivor(s, 'superviviente muerto');
 cancelBaseUpgradeDevelopmentForSurvivor(s, 'superviviente muerto');
 if(isExteriorSurvivor(s) && Array.isArray(s.inventory) && s.inventory.length){
 const loc=state.locations.find(l=>l.instanceId===s.exteriorSiteId);
 if(loc){
 if(!Array.isArray(loc.droppedItems)) loc.droppedItems=[];
 loc.droppedItems.push(...normalizeInventoryList(s.inventory));
 addLog(`🎒 ${s.name} deja atrás su equipo en ${loc.name}.`);
 }
 }
 s._diedTodayDay=state.day;
 applyRelationshipShock(s,'dead');
 s.status='muerto';
 s.inventory=[];
 s.equippedWeapon=null;
 state.cemetery.push({
 id:s.id,
 name:s.name,
 imageUrl:s.imageUrl||'',
 story:s.story||'',
 diedOnDay:state.day
 });
 const deathMsg=(msg||`${s.name} ha muerto.`);
 addLog(deathMsg);
 addTechnicalLog('survivor_dead','Un superviviente ha muerto.', {survivorId:s.id,survivorName:s.name,message:deathMsg});
}
function addLog(text){
 const resolvedText=replaceDynamicNameTokens(text);
 state.log.unshift(`Día ${state.day}: ${resolvedText}`);
 state.log=state.log.slice(0,80);
 try{ renderLog(); }catch(e){}
}
function checkGameOver(){if(!state._gameInitialized)return false;if(aliveSurvivors().length<=0)return openGameOver('No queda ningún superviviente con vida.');if(state.stability<=0)return openGameOver('La estabilidad del asentamiento ha caído a cero. El grupo se disuelve.');return false}
function pickStartingSurvivors(count){
 const all=(gameData.survivors||[]).filter(Boolean);
 const preferredRarity=getStartingSurvivorRarity();
 const rarityOrder=[preferredRarity,4,3,2,1].filter((rarity,index,array)=>array.indexOf(rarity)===index);
 const pool=[];
 rarityOrder.forEach(rarity=>{
 pool.push(...all.filter(s=>Number(s.rarity??4)===rarity).sort(()=>Math.random()-0.5));
 });
 const remaining=all.filter(s=>!rarityOrder.includes(Number(s.rarity??4))).sort(()=>Math.random()-0.5);
 pool.push(...remaining);
 return pool.slice(0,count);
}
function pickSurvivorByRarity(forcedRarity){
 const existingIds=new Set((state.survivors||[]).map(s=>s.id).filter(Boolean));
 const pool=(gameData.survivors||[]).filter(s=>s&&s.id&&!existingIds.has(s.id));
 if(!pool.length) return null;
 const rarityWeights=getWeightedRarityMap(forcedRarity);
 const rarities=Object.keys(rarityWeights).map(Number).filter(r=>pool.some(s=>Number(s.rarity||4)===r));
 if(!rarities.length) return pick(pool);
 const weighted=[];
 rarities.forEach(r=>{ for(let i=0;i<(rarityWeights[r]||1);i++) weighted.push(r); });
 const pickedRarity=pick(weighted);
 const rarityPool=pool.filter(s=>Number(s.rarity||4)===pickedRarity);
 return pick(rarityPool.length?rarityPool:pool);
}
function pickDogByRarity(forcedRarity, forcedId){
 const allDogs=(gameData.dogs||[]).filter(Boolean);
 if(!allDogs.length) return null;
 if(forcedId){
 const exact=allDogs.find(d=>String(d.id||'')===String(forcedId));
 if(exact) return deepClone(exact);
 }
 const usedIds=new Set([state.dog?.id].filter(Boolean));
 const pool=allDogs.filter(d=>d&&d.id&&!usedIds.has(d.id));
 if(!pool.length) return null;
 const rarityWeights=getWeightedRarityMap(forcedRarity);
 const rarities=Object.keys(rarityWeights).map(Number).filter(r=>pool.some(d=>Number(d.rarity||4)===r));
 if(!rarities.length) return deepClone(pick(pool));
 const weighted=[];
 rarities.forEach(r=>{ for(let i=0;i<(rarityWeights[r]||1);i++) weighted.push(r); });
 const pickedRarity=pick(weighted);
 const rarityPool=pool.filter(d=>Number(d.rarity||4)===pickedRarity);
 return deepClone(pick(rarityPool.length?rarityPool:pool));
}
function ensureDogOwner(){
 if(!state.dog) return null;
 const currentOwner=state.dog.ownerId?getAliveSurvivorById(state.dog.ownerId):null;
 if(currentOwner) return currentOwner;
 const fallback=aliveSurvivors()[0]||null;
 state.dog.ownerId=fallback?.id||null;
 return fallback;
}
/* dedup:getDogForSurvivor moved to survivors.js */

function addDogToSettlement(effect={}, delayed=false){
 if(state.dog){
 addLog(`${delayed?'[Retrasado] ':''}🐕 Ya hay un perro en el asentamiento.`);
 return null;
 }
 const dog=pickDogByRarity(effect.rarity||null, effect.dogId||effect.id||null);
 if(!dog){
 addLog(`${delayed?'[Retrasado] ':''}🐕 No hay perros disponibles para añadir.`);
 return null;
 }
 const owner=effect.targetId?getAliveSurvivorById(effect.targetId):aliveSurvivors()[0]||null;
 state.dog={...deepClone(dog), ownerId:owner?.id||null, joinedOnDay:state.day};
 const ownerText=owner?` y se une a ${owner.name}`:'';
 addLog(`${delayed?'[Retrasado] ':''}🐕 ${dog.name} llega al asentamiento${ownerText}.`);
 addTechnicalLog('dog_added','Se añade un perro al asentamiento.', {dogId:dog.id,dogName:dog.name,ownerId:owner?.id||null,ownerName:owner?.name||null,effect});
 return state.dog;
}
function weightedPick(items){const total=items.reduce((sum,i)=>sum+Number(i.weight||0),0);let r=Math.random()*total;for(const item of items){r-=Number(item.weight||0);if(r<=0)return item}return items[0]||null}
function clamp(v,min,max){return Math.min(max,Math.max(min,v))}
function roll(min,max){return Math.floor(Math.random()*(max-min+1))+min}
function rollDiceString(expr,fallback='1d6'){
 const source=String(expr||fallback).trim();
 const m=source.match(/^(\d+)d(\d+)$/i);
 const fb=String(fallback||'1d6').match(/^(\d+)d(\d+)$/i);
 const count=Math.max(1, Number(m?.[1]||fb?.[1]||1));
 const sides=Math.max(2, Number(m?.[2]||fb?.[2]||6));
 let total=0;
 for(let i=0;i<count;i++) total+=roll(1,sides);
 return total;
}
function pick(arr){return arr.length?arr[Math.floor(Math.random()*arr.length)]:null}
function escapeHtml(str){return String(str??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function escapeAttr(str){return escapeHtml(str)}

function combatEffectSummary(e){
 if(!e||!e.type) return '';
 if(e.type==='addResource') return `+${e.amount||0} ${resourceLabel(e.resource)}`;
 if(e.type==='removeResource') return `-${e.amount||0} ${resourceLabel(e.resource)}`;
 if(e.type==='stabilityChange') return `${(e.amount||0)>=0?'+':''}${e.amount||0} estabilidad`;
 if((e.type==='addResource'||e.type==='removeResource')&&e.resource==='chickens') return `${e.type==='addResource'?'+':'-'}${Math.abs(e.amount||0)} gallinas`;
 if(e.type==='moraleAll') return `${(e.amount||0)>=0?'+':''}${e.amount||0} moral (todos)`;
 if(e.type==='moraleSurvivor') return `${(e.amount||0)>=0?'+':''}${e.amount||0} moral (1 superviviente)`;
 if(e.type==='injureSurvivor') return '1 superviviente herido';
 if(e.type==='healSurvivor'||e.type==='healInjured') return '1 superviviente curado';
 if(e.type==='unlockBuilding') return `Desbloquea ${e.building||'edificio'}`;
 if(['createThreat','addThreat','spawnThreat'].includes(e.type)) return `Activa amenaza ${e.threatId||e.templateId||e.id||''}`.trim();
 if(e.type==='trigger_attack') return `Lanza ataque ${e.attackType||e.hostileType||'hostil'}`;
 return e.type;
}

function attackPopupPayload(side, payload){
 const cfg=side==='victory'?state.attackPopupVictory:state.attackPopupDefeat;
 if(!cfg) return payload;
 return {
 ...payload,
 title:cfg.title||payload.title,
 text:cfg.text||payload.text,
 icon:cfg.icon||payload.icon,
 };
}


document.getElementById('inviteYes').addEventListener('click',()=>{
 const btn=document.getElementById('inviteYes');
 if(btn.disabled) return;
 btn.disabled=true;
 const s=state._pendingSurvivor;
 if(s) joinSurvivor(s);
 document.getElementById('survivorInvitePopup').classList.remove('open');
 setTimeout(()=>{ btn.disabled=false; }, 500);
 render();
});
document.getElementById('inviteNo').addEventListener('click',()=>{
 const s=state._pendingSurvivor;
 if(s) addLog('🚪 '+s.name+' se marcha. El grupo sigue su camino.');
 state._pendingSurvivor=null;
 document.getElementById('survivorInvitePopup').classList.remove('open');
 render();
});
document.getElementById('combatResultClose').addEventListener('click',()=>{
 document.getElementById('combatResultPopup').classList.remove('open');
 if(state._afterCombatResult==='ambush'){
 state._afterCombatResult=null;
 finishAmbushQueueFlow();
 return;
 }
});
/* dedup:survivorHasSkill moved to survivors.js */

function joinSurvivor(s){
 // Prevent adding same survivor twice
 if(state.survivors.some(x=>x.id===s.id||x.name===s.name)){
 addLog(`${s.name} ya está en el asentamiento.`);
 state._pendingSurvivor=null;
 return;
 }
 const cap=barracksCapacity();
 const current=aliveSurvivors().length;
 state.survivors.push({
 id:s.id||('s_'+Date.now()),
 name:s.name,
 fatigue:Number(s.fatigueCurrent??s.fatigue??s.fatigueMax??s.maxFatigue??3),
 maxFatigue:Number(s.fatigueMax??s.maxFatigue??3),
 rarity:Number(s.rarity??4),
 imageUrl:s.image?.url||s.imageUrl||'',
 imageUrlInjured:s.imageInjured?.url||s.imageUrlInjured||'',
 imageUrlDead:'',
 story:s.story||'',
 skill:s.skill||'ninguna',
 skill2:s.skill2||'ninguna',
 negativeSkill:s.negativeSkill||'ninguna',
 skills:s.skills||[],
 relationshipSeeds:deepClone(s.relationships||s.links||[]),
 ...getNormalizedMoraleState(s),
 hunger:Math.max(0, Number(s.hunger??0)||0),
 _moraleGainedToday:0,
 _moralePositiveToday:false,
 _highMoraleDryDays:0,
 fed:true, status:'activo', action:null,
 location:'base', travelDest:null, travelArrivalDay:null, travelReturnDay:null, inventory:deepClone(s.inventory||[]), inventorySlots:Number(s.inventorySlots||3), equippedWeapon:s.equippedWeapon||null, equippedGear:deepClone(s.equippedGear||[]), equippedGear:deepClone(s.equippedGear||[]),
 });
 addLog('✅ '+s.name+' se une al asentamiento.');
 const joined=state.survivors[state.survivors.length-1];
 applySeedRelationshipsForSurvivor(joined);
 // Desconfiado: -1 moral for each survivor with that trait
 aliveSurvivors().forEach(existing=>{
 if((existing.negativeSkill||'').toLowerCase()==='desconfiado'){
 adjustSurvivorMorale(existing,-1);
 addLog('😟 '+existing.name+' (Desconfiado) pierde 1 de moral con el nuevo integrante.');
 }
 });
 if(cap>0&&current>=cap){
 state.stability=Math.max(0,state.stability-1);
 addLog('⚠ Los barracones están llenos. '+s.name+' se queda en condiciones precarias. -1 estabilidad.');
 }
 state._pendingSurvivor=null;
}

function attemptRecruitmentOffer(s, source='evento'){
 if(!s) return false;
 const recruitBonus=Number(getStabilityModifiers().recruitChanceBonus||0);
 const chance=Math.max(0,Math.min(100,70+recruitBonus));
 if(Math.random()*100>chance){
 addLog(`🚪 ${s.name} no confía en la situación del asentamiento y decide no quedarse (${source}).`);
 return false;
 }
 state._pendingSurvivor=s;
 openSurvivorInvitePopup(s);
 return true;
}

loadDefaults();
// Try to load from /data/ (works on Netlify/server). Falls back to embedded data if not found.


// ── MUSIC ──
function getBgMusicEl(){
 return document.getElementById('bgMusic');
}
function getCombatMusicEl(){
 const el=document.getElementById('combatMusic');
 if(el){
  const wanted='./data/music/wasteland.mp3';
  try{
   const sourceEl=el.querySelector('source');
   const currentSrc=(el.getAttribute('src')||sourceEl?.getAttribute('src')||'').trim();
   if(currentSrc!==wanted){
    if(sourceEl) sourceEl.setAttribute('src', wanted);
    else el.setAttribute('src', wanted);
    if(!el.currentSrc || !String(el.currentSrc).includes('wasteland.mp3')) el.load();
   }
  }catch(_err){}
 }
 return el;
}
function getMusicBtnEl(){
 return document.getElementById('musicBtn');
}
var musicMuted = !!getBgMusicEl()?.muted;
var combatMusicActive = false;

applyAudioSettingsFromConfig();

function syncMusicButton(){
 const musicBtn=getMusicBtnEl();
 const bgMusic=getBgMusicEl();
 if(!musicBtn || !bgMusic) return;
 musicBtn.textContent = musicMuted ? '🔇' : '🔊';
 musicBtn.title = musicMuted ? 'Activar música' : 'Silenciar música';
}

function startMusic(){
 const bgMusic=getBgMusicEl();
 const musicBtn=getMusicBtnEl();
 if(!bgMusic) return;
 bgMusic.muted = musicMuted;
 bgMusic.play().then(()=>{
 if(musicBtn) musicBtn.style.borderColor='var(--ok)';
 syncMusicButton();
 }).catch(err=>{
 console.warn('Audio bloqueado:', err.message);
 syncMusicButton();
 });
}

function setCombatMusic(active){
 const bgMusic=getBgMusicEl();
 const combatMusic=getCombatMusicEl();
 if(!bgMusic || !combatMusic) return;
 if(!!musicMuted){
  try{ combatMusic.pause(); }catch(_err){}
  return;
 }
 if(active && !combatMusicActive){
 combatMusicActive = true;
 bgMusic.pause();
 combatMusic.currentTime = 0;
 combatMusic.play().catch(()=>{});
 } else if(!active && combatMusicActive){
 combatMusicActive = false;
 combatMusic.pause();
 bgMusic.play().catch(()=>{});
 }
}

syncMusicButton();
const __musicBtnInit=getMusicBtnEl();
if(__musicBtnInit){
 __musicBtnInit.addEventListener('click', ()=>{
  const bgMusic=getBgMusicEl();
  const combatMusic=getCombatMusicEl();
  if(!bgMusic) return;
  musicMuted = !musicMuted;
  bgMusic.muted = musicMuted;
  if(combatMusic) combatMusic.muted = musicMuted;
  syncMusicButton();
  if(!musicMuted){
   if(combatMusicActive && combatMusic){ combatMusic.play().catch(()=>{}); }
   else { bgMusic.play().catch(()=>{}); }
  }
 });
}

// ── INTRO ──

function startIntro(){
 const overlay=document.getElementById('introOverlay');
 const textEl=document.getElementById('introText');
 const btn=document.getElementById('introContinueBtn');
 const modePanel=document.getElementById('gameModePanel');
 const normalBtn=document.getElementById('modeNormalBtn');
 const devBtn=document.getElementById('modeDevBtn');
 if(!overlay) return;
 const params = new URLSearchParams(window.location.search);
 const skipIntro = params.get('skipIntro') === '1';
 const INTRO_LINES=getIntroLines();
 let introEnded = false;
 let forceFinishTimer = null;

 let lineIdx=0;
 let charIdx=0;
 let fullText='';
 let typing=true;

 function endIntro(){
 if(introEnded) return;
 introEnded = true;
 if(forceFinishTimer) clearTimeout(forceFinishTimer);
 overlay.style.transition='opacity 0.8s';
 overlay.style.opacity='0';
 setTimeout(()=>{ overlay.style.display='none'; }, 800);
 startMusic();
 }

 function beginGame(mode='normal'){
 selectedGameMode=mode==='dev'?'dev':'normal';
 if(!initGame()) return;
 endIntro();
 }

 if(skipIntro){
 beginGame('normal');
 return;
 }

 // Click anywhere to skip to end
 overlay.addEventListener('click', ()=>{
 if(typing){
 typing=false;
 textEl.textContent=INTRO_LINES.join('\n\n');
 showIntroBtn();
 }
 }, {once:false});

 function showIntroBtn(){
 if(modePanel && modePanel.style.display==='flex') return;
 btn.style.display='block';
 btn.style.opacity='0';
 btn.style.transition='opacity 1s';
 setTimeout(()=>{ btn.style.opacity='1'; }, 50);
 }

 function showModePanel(){
 if(!modePanel) return;
 btn.style.display='none';
 modePanel.style.display='flex';
 modePanel.style.opacity='0';
 modePanel.style.transition='opacity 0.5s';
 setTimeout(()=>{ modePanel.style.opacity='1'; }, 30);
 }

 function typeNextChar(){
 if(!typing) return;
 const currentLine=INTRO_LINES[lineIdx];
 if(charIdx<currentLine.length){
 fullText+=currentLine[charIdx];
 textEl.textContent=fullText;
 charIdx++;
 const delay=currentLine[charIdx-1]==='.'?400:currentLine[charIdx-1]===','?250:60;
 setTimeout(typeNextChar, delay);
 } else {
 // Line done
 lineIdx++;
 if(lineIdx<INTRO_LINES.length){
 fullText+='\n\n';
 textEl.style.whiteSpace='pre';
 charIdx=0;
 setTimeout(typeNextChar, 800);
 } else {
 typing=false;
 showIntroBtn();
 }
 }
 }

 setTimeout(typeNextChar, 600);

 btn.addEventListener('click', (e)=>{
 e.stopPropagation();
 showModePanel();
 });
 if(normalBtn) normalBtn.addEventListener('click', (e)=>{
 e.stopPropagation();
 beginGame('normal');
 });
 if(devBtn) devBtn.addEventListener('click', (e)=>{
 e.stopPropagation();
 beginGame('dev');
 });
}

// Startup moved to assets/js/app.js bootstrap.
document.getElementById('closeBuildingDetail').addEventListener('click',()=>{
 document.getElementById('buildingDetailPanel').style.display='none';
 state.currentDetail=null;
});
document.getElementById('closeCemeteryBtn').addEventListener('click',()=>{
 document.getElementById('cemeteryModal').classList.remove('open');
});
document.getElementById('cemeteryModal').addEventListener('click',(e)=>{
 if(e.target===document.getElementById('cemeteryModal')) document.getElementById('cemeteryModal').classList.remove('open');
});
document.getElementById('closeLoreModal').addEventListener('click',()=>{
 document.getElementById('survivorLoreModal').classList.remove('open');
});
document.getElementById('survivorLoreModal').addEventListener('click',(e)=>{
 if(e.target===e.currentTarget) e.currentTarget.classList.remove('open');
});


window.addEventListener('DOMContentLoaded',()=>{
 try{ initPopupStacking(); }catch(e){}
 document.getElementById('inventoryModalClose')?.addEventListener('click',closeInventoryModal);
 document.getElementById('storageModalClose')?.addEventListener('click',closeStorageModal);
 document.getElementById('repairModalClose')?.addEventListener('click',closeRepairModal);
 try{ renderLog(); }catch(e){}
});


window.addEventListener('DOMContentLoaded',()=>{
 const graveBtn=document.getElementById('graveWarningConfirm');
 if(graveBtn) graveBtn.onclick = closeGraveWarningPopup;
});

(function(){
 function initResurgirUIV2(){
 const layout=document.querySelector('.layout');
 if(!layout||layout.dataset.uiV2Ready==='1') return;
 layout.dataset.uiV2Ready='1';

 const threatMount=document.getElementById('leftSideThreatMount');
 const persistentMount=document.getElementById('leftSidePersistentEventMount');
 const threatWrap=document.getElementById('threatsPanelWrap');
 const persistentPanel=document.getElementById('persistentEventPanel');
 if(threatMount&&threatWrap&&threatWrap.parentElement!==threatMount) threatMount.appendChild(threatWrap);
 if(persistentMount&&persistentPanel&&persistentPanel.parentElement!==persistentMount) persistentMount.appendChild(persistentPanel);

 const popupBody=document.getElementById('storyEventPopupBody');
 const eventLayout=document.getElementById('eventLayout');
 if(popupBody&&eventLayout&&eventLayout.parentElement!==popupBody) popupBody.appendChild(eventLayout);

 const legacyEventPanel=document.querySelector('.map-area .ui-v2-legacy-panel');
 if(legacyEventPanel) legacyEventPanel.style.display='none';

 const survivorHeaderMount=document.getElementById('survivorHeaderActionsMount');
 const mapFooter=document.querySelector('.ui-v2-map-panel .map-footer');
 if(survivorHeaderMount&&mapFooter&&mapFooter.parentElement!==survivorHeaderMount){
 survivorHeaderMount.appendChild(mapFooter);
 mapFooter.classList.add('ui-v2-map-toolbar');
 }

 const popup=document.getElementById('storyEventPopup');
 if(popup){
 popup.addEventListener('click',(e)=>{ e.stopPropagation(); });
 }
 }

 function updateUIV2Meta(){
 initResurgirUIV2();
 const meta=document.getElementById('uiV2SurvivorMeta');
 const list=document.getElementById('survivorList');
 if(meta){
 const visibleCards=(state.survivors||[]).filter(s=>{
 if(!s||s.status==='muerto') return false;
 return activeMapTab==='exterior' ? isExteriorSurvivor(s) : !isExteriorSurvivor(s);
 }).length;
 meta.textContent=activeMapTab==='exterior'
 ? `Exterior · ${visibleCards} visible${visibleCards!==1?'s':''}`
 : `Base · ${visibleCards} visible${visibleCards!==1?'s':''}`;
 }
 if(list){
 Array.from(list.children).forEach((child, idx)=>{
 if(idx===0 && activeMapTab==='exterior' && !child.classList.contains('survivor-card')){
 child.classList.add('survivor-wide-banner');
 }
 });
 }
 const popupHeader=document.getElementById('storyEventPopupHeader');
 const popupSub=document.getElementById('storyEventPopupSubheader');
 if(popupHeader&&state.pendingEvent){
 const dayValue = Number.isFinite(Number(state?.day)) ? Number(state.day) : 1;
 popupHeader.textContent=`EVENTO - Día ${dayValue}`;
 popupSub.textContent='Hasta que no decidas, la partida queda en pausa.';
 }else if(popupHeader){
 const dayValue = Number.isFinite(Number(state?.day)) ? Number(state.day) : 1;
 popupHeader.textContent=`EVENTO - Día ${dayValue}`;
 popupSub.textContent='Hasta que no decidas, la partida queda en pausa.';
 }
 }

 if(window.setEvent && !window._uiV2WrappedSetEvent){
 const originalSetEvent=window.setEvent;
 window.setEvent=function(ev){
 initResurgirUIV2();
 const result=originalSetEvent.apply(this, arguments);
 const popup=document.getElementById('storyEventPopup');
 if(popup) popup.classList.add('open');
 document.body.classList.add('event-lock');
 updateUIV2Meta();
 return result;
 };
 window._uiV2WrappedSetEvent=true;
 }

 if(window.closeEvent && !window._uiV2WrappedCloseEvent){
 const originalCloseEvent=window.closeEvent;
 window.closeEvent=function(){
 const result=originalCloseEvent.apply(this, arguments);
 const popup=document.getElementById('storyEventPopup');
 if(popup) popup.classList.remove('open');
 document.body.classList.remove('event-lock');
 updateUIV2Meta();
 return result;
 };
 window._uiV2WrappedCloseEvent=true;
 }

 if(window.render && !window._uiV2WrappedRender){
 const originalRender=window.render;
 window.render=function(){
 initResurgirUIV2();
 const result=originalRender.apply(this, arguments);
 updateUIV2Meta();
 return result;
 };
 window._uiV2WrappedRender=true;
 }

 if(document.readyState==='loading'){
 document.addEventListener('DOMContentLoaded', initResurgirUIV2, {once:true});
 }else{
 initResurgirUIV2();
 }
 setTimeout(()=>{
 initResurgirUIV2();
 updateUIV2Meta();
 },0);
})();

(()=>{
 if(window.__resurgirExteriorAbandonedUiFix) return;
 window.__resurgirExteriorAbandonedUiFix=true;

 function isGarageLike(def){
  if(!def) return false;
  const id=String(def.id||'').trim().toLowerCase();
  const name=String(def.name||'').trim().toLowerCase();
  return id==='garage' || id==='garaje' || name==='garage' || name==='garaje';
 }

 function dedupeGarageBuildings(){
  if(!Array.isArray(gameData.buildings)) return;
  let kept=null;
  gameData.buildings=gameData.buildings.filter(def=>{
   if(!isGarageLike(def)) return true;
   if(!kept){ kept=def; return true; }
   return false;
  });
 }

 function getAbandonedDef(id){
  const key=String(id||'');
  const live=state?.buildings?.[key]||null;
  const catalog=(gameData.buildings||[]).find(def=>String(def?.id||'')===key && !!def?.abandonedBuilding) || null;
  if(catalog) return catalog;
  if(live?.abandonedBuilding){
   return {
    id:live.id,
    name:live.name,
    description:live.description||live.desc||'',
    image:live.image||'',
    map:deepClone(live.map||null),
    category:live.category||'Base',
    abandonedBuilding:true,
    recycleDays:Number(live.recycleDays||live._constructionDays||0),
    recycleYieldMin:Number(live.recycleYieldMin||live._abandonedRecycleMin||0),
    recycleYieldMax:Number(live.recycleYieldMax||live._abandonedRecycleMax||0)
   };
  }
  return null;
 }

 function getBaseActiveSurvivors(){
  return (state.survivors||[]).filter(s=>s && s.status==='activo' && s.location==='base' && s.status!=='muerto');
 }
 window.getAbandonedDef=getAbandonedDef;
 window.getBaseActiveSurvivors=getBaseActiveSurvivors;

 function startAbandonedRecycle(buildingId, survivorId){
  const b=state.buildings?.[buildingId];
  const def=getAbandonedDef(buildingId);
  const s=(state.survivors||[]).find(x=>x && x.id===survivorId);
  if(!b || !def || !s) return;
  if(b._underConstruction || b._abandonedRecycle) return;
  if(s.status!=='activo' || s.location!=='base' || s.status==='muerto') return;
  const days=Math.max(1, Number(def.recycleDays||4) || 4);
  b._constructionDays=days;
  b._constructionDaysLeft=days;
  b._constructionCost=0;
  b._lastConstructionCost=0;
  b._underConstruction=true;
  b._abandonedRecycle=true;
  b._abandonedRecycleMin=Math.max(0, Number(def.recycleYieldMin||5) || 5);
  b._abandonedRecycleMax=Math.max(b._abandonedRecycleMin, Number(def.recycleYieldMax||9) || 9);
  s.action={type:'construir', target:buildingId};
  s.status='ocupado';
  addLog(`🧱 ${s.name} comienza a reciclar ${b.name}. Tiempo: ${days} días.`);
  closeBuildingPopup();
  render();
 }
  window.startAbandonedRecycle=startAbandonedRecycle;

 function finalizeCompletedAbandonedRecycles(){
  if(!state || !state.buildings) return;
  const ids=Object.keys(state.buildings).filter(id=>{
   const b=state.buildings[id];
   return b && b._abandonedRecycle && !b._underConstruction;
  });
  ids.forEach(id=>{
   const b=state.buildings[id];
   if(!b) return;
   const minYield=Math.max(0, Number(b._abandonedRecycleMin||5) || 5);
   const maxYield=Math.max(minYield, Number(b._abandonedRecycleMax||9) || 9);
   const materials=minYield + Math.floor(Math.random()*(maxYield-minYield+1));
   state.materials=(Number(state.materials||0)+materials);
   addLog(`🧱 ${b.name} ha sido reciclado. +${materials} materiales.`);
   delete state.buildings[id];
   if(Array.isArray(gameData.buildings)) gameData.buildings=gameData.buildings.filter(def=>String(def?.id||'')!==String(id));
   if(state.currentDetail===id) closeBuildingPopup();
  });
 }

 const previousGetBaseMapBuildings=window.getBaseMapBuildings;
 if(typeof previousGetBaseMapBuildings==='function' && !previousGetBaseMapBuildings.__garageDedupeWrapped){
  window.getBaseMapBuildings=function(){
   dedupeGarageBuildings();
   const list=(previousGetBaseMapBuildings.apply(this, arguments)||[]).filter(Boolean);
   let keptGarage=false;
   return list.filter(def=>{
    if(!isGarageLike(def)) return true;
    if(keptGarage) return false;
    keptGarage=true;
    return true;
   });
  };
  window.getBaseMapBuildings.__garageDedupeWrapped=true;
 }


 function injectExteriorVehicleCard(){
  if(activeMapTab!=='exterior') return;
  const list=document.getElementById('survivorList');
  if(!list) return;
  list.querySelector('[data-exterior-camp-actions]')?.remove();
  const first=list.firstElementChild;
  if(first && !first.classList.contains('survivor-card')) first.remove();
  list.querySelector('[data-vehicle-card]')?.remove();
  const vehicle=getVehicle();
  const extCount=(window.getExteriorCampSurvivors?.()||[]).length;
  const resources=(typeof getCampInventoryEntries==='function'?getCampInventoryEntries():[])
   .map(item=>`<span>${item.icon} <b>${item.amount}</b> ${item.label}</span>`)
   .join(' · ');
  const card=document.createElement('div');
  card.className='survivor-card';
  card.dataset.vehicleCard='1';
  card.innerHTML=`
   <div class="avatar"><div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:26px;">🚗</div></div>
   <div class="survivor-head-row">
    <div class="survivor-name-wrap"><div class="survivor-name">${escapeHtml(vehicle.name||'Vehículo')}</div></div>
    <div class="badge activo">Vehículo</div>
   </div>
   <div class="survivor-meta-line">
    <span class="meta-fatigue"><span style="color:var(--ok)">⛽</span> ${vehicle.fuelCurrent}/${vehicle.fuelCapacity}</span>
    <span class="meta-morale" style="color:var(--ok-bright);font-weight:700;">Estado ${vehicle.condition}/${vehicle.maxCondition} · ${escapeHtml(vehicleStatusLabel(vehicle))}</span>
   </div>
   <div class="survivor-health-line ok"><span style="color:var(--ok-bright);">⛺ Campamento exterior:</span> <b style="color:var(--text);">${resources||'Sin recursos'}</b></div>
   <div class="survivor-note"><span style="color:var(--ok-bright);">📍 ${escapeHtml(getExteriorZoneName())}</span><br><span style="color:var(--muted);">${extCount} superviviente${extCount!==1?'s':''} en campamento</span></div>
   <div class="action-bar" style="display:flex;gap:8px;flex-wrap:wrap;">
    <button class="btn secondary" id="vehicleExteriorRestBtn" ${extCount?'':'disabled'}>🛏 Descansar</button>
    <button class="btn primary" id="vehicleExteriorReturnBtn" ${extCount?'':'disabled'}>↩ Volver a base</button>
   </div>
   <div class="survivor-slot-grid">
    <button class="survivor-slot lore-btn" disabled title="Ficha de vehículo">🚗</button>
    <button class="survivor-slot inv-btn" disabled title="Campamento exterior">⛺</button>
    <button class="survivor-slot dog-btn empty" disabled title="Sin acción adicional">—</button>
    <button class="survivor-slot future-btn empty" disabled title="Espacio reservado">▣</button>
   </div>`;
  list.insertBefore(card, list.firstChild||null);
  document.getElementById('vehicleExteriorRestBtn')?.addEventListener('click',openExteriorCampRestPopup);
  document.getElementById('vehicleExteriorReturnBtn')?.addEventListener('click',()=>window.openTravelReturnPopup('exterior'));
  const meta=document.getElementById('uiV2SurvivorMeta');
  if(meta){
   const visibleCards=list.querySelectorAll('.survivor-card:not([data-vehicle-card])').length;
   meta.textContent=`Exterior · ${visibleCards} visible${visibleCards!==1?'s':''}`;
  }
 }

 const previousRenderSurvivors=window.renderSurvivors;
 if(typeof previousRenderSurvivors==='function' && !previousRenderSurvivors.__vehicleCardWrapped2){
  window.renderSurvivors=function(){
   const result=previousRenderSurvivors.apply(this, arguments);
   injectExteriorVehicleCard();
   return result;
  };
  window.renderSurvivors.__vehicleCardWrapped2=true;
 }

 const previousRender=window.render;
 if(typeof previousRender==='function' && !previousRender.__abandonedFinalizeWrapped2){
  window.render=function(){
   dedupeGarageBuildings();
   finalizeCompletedAbandonedRecycles();
   const result=previousRender.apply(this, arguments);
   if(activeMapTab==='exterior'){
    const list=document.getElementById('survivorList');
    const meta=document.getElementById('uiV2SurvivorMeta');
    if(list && meta){
     const visibleCards=list.querySelectorAll('.survivor-card:not([data-vehicle-card])').length;
     meta.textContent=`Exterior · ${visibleCards} visible${visibleCards!==1?'s':''}`;
    }
   }
   return result;
  };
  window.render.__abandonedFinalizeWrapped2=true;
 }

 setTimeout(()=>{ try{ dedupeGarageBuildings(); finalizeCompletedAbandonedRecycles(); if(state._gameInitialized && typeof render==='function') render(); }catch(_e){} },0);
})();

(()=>{
 if(window.__resurgirDrunkCantinaPatch) return;
 window.__resurgirDrunkCantinaPatch=true;

 function getAbandonedAdaptationDefs(){
  return (gameData?.buildings||[]).filter(def=>def && def.type==='adaptation' && def.fromAbandoned);
 }
 function getAbandonedAdaptationDef(id){
  const key=String(id||'').trim().toLowerCase();
  return getAbandonedAdaptationDefs().find(def=>String(def?.id||'').trim().toLowerCase()===key) || null;
 }
 function getAbandonedAdaptationName(id){
  return getAbandonedAdaptationDef(id)?.name || String(id||'');
 }
 function getAbandonedAdaptationCost(def){
  return Number(def?.cost||10);
 }
 function getAbandonedAdaptationDays(def){
  return Number(def?.constructionDays||def?.days||3);
 }
 function getAbandonedAdaptationEffect(def){
  return String(def?.effect || def?.levelEffects?.['1'] || def?.levelEffects?.[1] || '');
 }
 function getAbandonedAdaptationDescription(def){
  if(!def) return '';
  if(def?.description) return String(def.description);
  const lvl=Array.isArray(def?.levels) ? def.levels.find(x=>Number(x?.level||0)===1) : null;
  return String(lvl?.description || '');
 }
 function getBuiltOrAssignedAbandonedAdaptationIds(){
  const ids=new Set();
  Object.values(state?.buildings||{}).forEach(b=>{
   const adaptationId=String(b?._abandonedAdaptation || '').trim().toLowerCase();
   if(adaptationId) ids.add(adaptationId);
   const bid=String(b?.id||'').trim().toLowerCase();
   const match=bid.match(/^(cantina|sala_comun)_/);
   if(match) ids.add(match[1]);
  });
  return ids;
 }
 function ensureDrunkArrays(s){
  if(!s || typeof s!=='object') return s;
  s.drunk=Math.max(0, Number(s.drunk||0)||0);
  if(!Array.isArray(s.states)) s.states=[];
  if(!Array.isArray(s.traitsExtra)) s.traitsExtra=[];
  return s;
 }
 function ensureAllDrunkData(){ (state?.survivors||[]).forEach(ensureDrunkArrays); }
 function hasStateFlag(s,key){ return Array.isArray(s?.states) && s.states.includes(key); }
 function addStateFlag(s,key){ ensureDrunkArrays(s); if(!s.states.includes(key)) s.states.push(key); }
 function removeStateFlag(s,key){ if(Array.isArray(s?.states)) s.states=s.states.filter(x=>x!==key); }
 function syncBorrachoState(s){
  ensureDrunkArrays(s);
  const until=Number(s.borrachoUntilDay||0)||0;
  if(until>0 && Number(state?.day||0)>until){
   s.borrachoUntilDay=0;
   removeStateFlag(s,'borracho');
  }
 }
/* dedup:hasSurvivorAlertStatus moved to survivors.js */

 function getStatusButtonMarkup(s){
  const active=hasSurvivorAlertStatus(s);
  return `<button class="survivor-slot future-btn ${active?'occupied':'empty'}" title="${escapeAttr(active?'Estados y efectos activos':'Sin estados activos')}" ${active?'':'disabled'}>${active?'❗':'▣'}</button>`;
 }
 function ensureStatusModal(){
  if(document.getElementById('survivorStatusModal')) return;
  const div=document.createElement('div');
  div.className='overlay';
  div.id='survivorStatusModal';
  div.innerHTML=`<div class="modal" style="width:min(760px,100%);"><div class="modal-header" id="survivorStatusModalTitle">Estado del superviviente</div><div class="modal-body"><div id="survivorStatusModalBody"></div></div><div class="modal-footer"><button class="secondary" id="survivorStatusModalClose">Cerrar</button></div></div>`;
  document.body.appendChild(div);
  div.addEventListener('click',e=>{ if(e.target===div) div.classList.remove('open'); });
  document.getElementById('survivorStatusModalClose').addEventListener('click',()=>div.classList.remove('open'));
 }
 window.openSurvivorStatusModal=function(survivorId){
  ensureStatusModal();
  const s=(state?.survivors||[]).find(x=>x.id===survivorId);
  if(!s) return;
  ensureDrunkArrays(s); syncBorrachoState(s);
  document.getElementById('survivorStatusModalTitle').textContent=`Estado · ${s.name||'Superviviente'}`;
  const injuries=[];
  if(hasActiveInjury(s)) injuries.push(`🩸 Herida ${escapeHtml(injuryDisplayName(s.injuryLevel||'simple'))}`);
  const statesRows=[];
  if(s.drunk>0) statesRows.push(`🍺 Drunk acumulado: <b>${s.drunk}</b>`);
  (s.states||[]).forEach(st=>{
   if(st==='borracho') statesRows.push(`🥴 Estado: <b>Borracho</b>${s.borrachoUntilDay?` · hasta el día ${s.borrachoUntilDay}`:''}`);
   else statesRows.push(`❗ Estado: <b>${escapeHtml(String(st))}</b>`);
  });
  const bonuses=[];
  if(Number(s.maxFatigueMod||0)!==0) bonuses.push(`⚡ Fatiga máxima ${s.maxFatigueMod>0?'+':''}${s.maxFatigueMod}`);
  if(Number(s.maxMoraleMod||0)!==0) bonuses.push(`😊 Moral máxima ${s.maxMoraleMod>0?'+':''}${s.maxMoraleMod}`);
  const html = renderStatusRows('Estados', statesRows) + renderStatusRows('Lesiones', injuries) + renderStatusRows('Mejoras y modificadores', bonuses);
  document.getElementById('survivorStatusModalBody').innerHTML=html;
  document.getElementById('survivorStatusModal').classList.add('open');
 };

 function getEventActorsSafe(ev){
  try{ return typeof getEventActors==='function' ? (getEventActors(ev)||[]) : []; }catch(_e){ return []; }
 }
 function resolveEffectTargetByMode(effect){
  ensureAllDrunkData();
  if(effect?.targetId){
   return (state?.survivors||[]).find(s=>s.id===effect.targetId && s.status!=='muerto') || null;
  }
  const mode=String(effect?.targetMode||'').trim();
  if(mode==='action'){
   const action=effect.action || state?.pendingEvent?.relatedAction;
   const ids=action && state?._lastDayActionSurvivors?.[action];
   const pool=(ids||[]).map(id=>(state?.survivors||[]).find(s=>s.id===id && s.status!=='muerto')).filter(Boolean);
   return pool.length ? pick(pool) : null;
  }
  const match=mode.match(/^actor(\d)$/);
  if(match){
   const idx=Math.max(0, Number(match[1])-1);
   return getEventActorsSafe(state?.pendingEvent)[idx] || null;
  }
  const alive=(state?.survivors||[]).filter(s=>s.status!=='muerto');
  return alive.length ? pick(alive) : null;
 }
/* dedup:modifySurvivorDrunk moved to survivors.js */

 function unlockAbandonedBuildingOption(buildingKey, delayed=false){
  const key=String(buildingKey||'').trim().toLowerCase();
  if(!key) return;
  const def=getAbandonedAdaptationDef(key);
  if(!def) return;
  if(!def.unlocked){
   def.unlocked=true;
   addLog(`${delayed?'[Retrasado] ':''}🏚 Se desbloquea una nueva adaptación de edificio abandonado: ${def.name||key}.`);
  }
 }
 function getUnlockedAbandonedAdaptations(){
  const used=getBuiltOrAssignedAbandonedAdaptationIds();
  return getAbandonedAdaptationDefs().filter(def=>!!def?.unlocked && !used.has(String(def.id||'').trim().toLowerCase()));
 }
 window.getAbandonedAdaptationDef=getAbandonedAdaptationDef;
 window.getAbandonedAdaptationCost=getAbandonedAdaptationCost;
 window.getAbandonedAdaptationDays=getAbandonedAdaptationDays;
 window.getAbandonedAdaptationEffect=getAbandonedAdaptationEffect;
 window.getAbandonedAdaptationDescription=getAbandonedAdaptationDescription;
 window.getUnlockedAbandonedAdaptations=getUnlockedAbandonedAdaptations;
 function startAbandonedAdaptation(buildingId, adaptationId, survivorId){
  const b=state.buildings?.[buildingId];
  const s=(state.survivors||[]).find(x=>x && x.id===survivorId);
  const adaptation=getAbandonedAdaptationDef(adaptationId);
  if(!b || !s || !adaptation) return;
  const adapKey=String(adaptation.id||'').trim().toLowerCase();
  if(getBuiltOrAssignedAbandonedAdaptationIds().has(adapKey)){
   addLog(`❌ Ya existe una ${adaptation.name} en el asentamiento.`);
   return;
  }
  const cost=getAbandonedAdaptationCost(adaptation);
  const days=getAbandonedAdaptationDays(adaptation);
  if(Number(state.materials||0) < cost){
   addLog(`❌ No hay materiales suficientes para adaptar ${b.name}.`);
   return;
  }
  state.materials-=cost;
  b._constructionDays=days;
  b._constructionDaysLeft=days;
  b._constructionCost=0;
  b._lastConstructionCost=0;
  b._underConstruction=true;
  b._abandonedAdaptation=adaptation.id;
  s.action={type:'construir', target:buildingId};
  s.status='ocupado';
  addLog(`🏚 ${s.name} empieza a adaptar ${b.name} en ${adaptation.name}. Coste: ${cost} materiales.`);
  closeBuildingPopup();
  render();
 }
 window.startAbandonedAdaptation=startAbandonedAdaptation;
 function finalizeCompletedAbandonedAdaptations(){
  if(!state || !state.buildings) return;
  const ids=Object.keys(state.buildings).filter(id=>{
   const b=state.buildings[id];
   return b && b._abandonedAdaptation && !b._underConstruction;
  });
  ids.forEach(oldId=>{
   const oldB=state.buildings[oldId];
   const adaptation=getAbandonedAdaptationDef(oldB._abandonedAdaptation);
   if(!adaptation) return;
   const newId=`${adaptation.id}_${oldId}`;
   const oldDef=(gameData.buildings||[]).find(def=>String(def?.id||'')===String(oldId)) || {};
   const effect=getAbandonedAdaptationEffect(adaptation);
   const description=getAbandonedAdaptationDescription(adaptation);
   const newMap=deepClone(oldDef.map||oldB.map||{});
   if(newMap && typeof newMap==='object' && 'specialStyle' in newMap) delete newMap.specialStyle;
   const newDef={
    id:newId,
    name:adaptation.name,
    category:'Base',
    initial:false,
    constructible:true,
    cost:getAbandonedAdaptationCost(adaptation),
    maxLevel:Number(adaptation.maxLevel||1),
    map:newMap,
    image:oldB.image||oldDef.image||adaptation.image||'',
    description,
    effect,
    actions:deepClone(adaptation.actions||[]),
    levelEffects:deepClone(adaptation.levelEffects||{1:effect})
   };
   gameData.buildings=(gameData.buildings||[]).filter(def=>String(def?.id||'')!==String(oldId));
   gameData.buildings.push(newDef);
   delete state.buildings[oldId];
   state.buildings[newId]={
    id:newId,
    name:adaptation.name,
    desc:effect,
    description,
    image:oldB.image||oldDef.image||adaptation.image||'',
    levelEffects:deepClone(adaptation.levelEffects||{1:effect}),
    cost:getAbandonedAdaptationCost(adaptation),
    built:true,
    level:1,
    maxLevel:Number(adaptation.maxLevel||1),
    active:true,
    constructible:true,
    actions:deepClone(adaptation.actions||[])
   };
   addLog(`🏗 ${oldB.name} ha sido adaptado y ahora es ${adaptation.name}.`);
   if(state.currentDetail===oldId) closeBuildingPopup();
  });
 }

 const oldApplyEffect=window.applyEffect;
 window.applyEffect=function(effect, delayed){
  ensureAllDrunkData();
  if(effect && ['addFatigue','removeFatigue','moraleSurvivor'].includes(effect.type) && !effect.targetId && effect.targetMode){
   const target=resolveEffectTargetByMode(effect);
   if(target) effect={...effect, targetId:target.id};
  }
  const abandonedUnlockKey=String(effect?.building||effect?.id||'').trim().toLowerCase();
  if(effect?.type==='unlockAbandonedBuilding'){
   unlockAbandonedBuildingOption(abandonedUnlockKey||'cantina', delayed);
   return;
  }
  if(effect?.type==='unlockBuilding' && getAbandonedAdaptationDef(abandonedUnlockKey)){
   unlockAbandonedBuildingOption(abandonedUnlockKey, delayed);
   return;
  }
  if(effect?.type==='addDrunk' || effect?.type==='removeDrunk'){
   const target=resolveEffectTargetByMode(effect);
   if(target) modifySurvivorDrunk(target, effect.type==='addDrunk' ? Number(effect.amount||1) : -Number(effect.amount||1), delayed);
   return;
  }
  return oldApplyEffect(effect, delayed);
 };


 const oldResolveActions=window.resolveActions;
 window.resolveActions=function(){
  ensureAllDrunkData();
  const cantinaWorkers=(state?.survivors||[]).filter(s=>s?.action?.type==='cantina' && s.status!=='muerto').map(s=>({s, action:deepClone(s.action)}));
  const resters=(state?.survivors||[]).filter(s=>['descansar','descansar_exterior'].includes(s?.action?.type) && s.status!=='muerto');
  cantinaWorkers.forEach(({s})=>{ s._cantinaHold=true; s._cantinaOriginalAction=deepClone(s.action); s.action=null; if(s.status==='ocupado') s.status='activo'; });
  const result=oldResolveActions.apply(this, arguments);
  resters.forEach(s=>{
   ensureDrunkArrays(s); syncBorrachoState(s);
   if(s.drunk>0){
    if(Math.random()<0.10){
     const removed=s.drunk;
     s.drunk=0;
     addLog(`💧 ${s.name} descansa y elimina todo el drunk acumulado (${removed}).`);
    } else {
     s.drunk=Math.max(0,s.drunk-1);
     addLog(`💧 ${s.name} descansa y reduce su drunk en 1. (${s.drunk})`);
    }
   }
  });
  cantinaWorkers.forEach(({s,action})=>{
   s.action=action;
   s.status='ocupado';
   adjustSurvivorMorale(s,1);
   addLog(`🍺 ${s.name} pasa por la cantina. +1 moral.`);
   const drunkBefore=Math.max(0, Number(s.drunk||0)||0);
   const drunkGainChance=Math.min(100, 40 + (5*drunkBefore));
   if(Math.random()*100 < drunkGainChance){
    s.drunk=drunkBefore+1;
    addLog(`🍺 ${s.name} gana +1 drunk. (Total: ${s.drunk})`);
    const borrachoChance=Math.min(100, 20 + (10*drunkBefore));
    if(Math.random()*100 < borrachoChance){
     addStateFlag(s,'borracho');
     s.borrachoUntilDay=(Number(state?.day||0)+1);
     addLog(`🥴 ${s.name} acaba borracho/a.`);
    }
   }
   delete s._cantinaHold;
   delete s._cantinaOriginalAction;
  });
  return result;
 };

 const oldResetForNewDay=window.resetForNewDay;
 window.resetForNewDay=function(){
  ensureAllDrunkData();
  (state?.survivors||[]).forEach(syncBorrachoState);
  return oldResetForNewDay.apply(this, arguments);
 };

 const oldRenderSurvivors=window.renderSurvivors;
 window.renderSurvivors=function(){
  ensureAllDrunkData();
  const result=oldRenderSurvivors.apply(this, arguments);
  document.querySelectorAll('#survivorList > .survivor-card:not([data-vehicle-card])').forEach(card=>{
   const actionBtn=card.querySelector('.action-icon-btn[data-sid]');
   if(!actionBtn) return;
   const sid=actionBtn.dataset.sid;
   const s=(state?.survivors||[]).find(x=>x.id===sid);
   if(!s) return;
   const slotGrid=card.querySelector('.survivor-slot-grid');
   const futureBtn=slotGrid?.querySelector('.future-btn');
   if(futureBtn){
    futureBtn.outerHTML=getStatusButtonMarkup(s);
    const newBtn=slotGrid.querySelector('.future-btn');
    if(newBtn && hasSurvivorAlertStatus(s)) newBtn.addEventListener('click',()=>window.openSurvivorStatusModal(sid));
   }
  });
  return result;
 };

 const oldRender=window.render;
 window.render=function(){
  ensureAllDrunkData();
  finalizeCompletedAbandonedAdaptations();
  return oldRender.apply(this, arguments);
 };

 setTimeout(()=>{ try{ ensureAllDrunkData(); finalizeCompletedAbandonedAdaptations(); if(typeof render==='function') render(); }catch(_e){} },0);
})();

(()=>{
 if(window.__resurgirAbandonedEventExplorePatch) return;
 window.__resurgirAbandonedEventExplorePatch=true;

 function countFreeAbandonedBuildings(){
  return Object.keys(state?.buildings||{}).filter(id=>{
   const b=state?.buildings?.[id];
   const def=(typeof getAbandonedDef==='function') ? getAbandonedDef(id) : null;
   return !!(b && def && !b._underConstruction && !b._abandonedAdaptation);
  }).length;
 }
 function eventNeedsAbandonedBuilding(ev){
  const effects=(typeof extractAllEventEffects==='function') ? extractAllEventEffects(ev) : [];
  return effects.some(e=>{
   if(!e) return false;
   const key=String(e.building||e.id||'').trim().toLowerCase();
   return ['cantina','sala_comun'].includes(key) && (e.type==='unlockAbandonedBuilding' || (e.type==='unlockBuilding' && !!getAbandonedAdaptationDef(key)));
  });
 }
 function isEventEligibleForAbandonedBuildings(ev){
  return !eventNeedsAbandonedBuilding(ev) || countFreeAbandonedBuildings()>0;
 }
 function withFilteredEventPools(fn){
  const originalEvents=gameData.events;
  const originalStory=gameData.story_events;
  try{
   if(Array.isArray(originalEvents)) gameData.events=originalEvents.filter(isEventEligibleForAbandonedBuildings);
   if(Array.isArray(originalStory)) gameData.story_events=originalStory.filter(isEventEligibleForAbandonedBuildings);
   return fn();
  } finally {
   gameData.events=originalEvents;
   gameData.story_events=originalStory;
  }
 }

 const oldBuildAndSetEvent=window.buildAndSetEvent;
 window.buildAndSetEvent=function(schema, forcedSurvivor){
  if(schema && !isEventEligibleForAbandonedBuildings(schema)) return false;
  return oldBuildAndSetEvent.apply(this, arguments);
 };

 ['checkStoryEvent','checkPriorityEvent','checkWeeklyEvent','chooseEvent','consumeQueuedPriorityEvent'].forEach(name=>{
  const original=window[name];
  if(typeof original==='function'){
   window[name]=function(){ return withFilteredEventPools(()=>original.apply(this, arguments)); };
  }
 });


 window.triggerExploreEvent=function(survivor){
  const groupMods=getExploreGroupModifiers(survivor);
  const pool=(gameData.events||[]).filter(e=>e&&e.type==='explore'&&isEventEligibleBySchedule(e)&&schemaHasEnoughEventActors(e, survivor)&&isEventEligibleForAbandonedBuildings(e));

  const available=pool.filter(e=>e.repeatable||!state._seenExplore?.has(e.id));
  if(available.length===0&&pool.length>0){
   state._seenExplore=new Set();
  }
  const finalPool=available.length?available:pool;

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

  const name=schema.name||schema.title||'Sin novedad';
  const survivorName=survivor.name;

  let effects=[];
  if(schema.choiceMode==='choice'||schema.options){
   const opts=schema.options;
   if(opts&&opts.A) effects=normaliseEffects(opts.A.effects||opts.A.directEffects||[]);
   else effects=normaliseEffects(schema.effects||[]);
  } else {
   effects=normaliseEffects(schema.effects||[]);
  }

  effects=injectExplorer(effects, survivor.id);

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
 };
})();

(()=>{
 if(window.__resurgirActionModifiersAndSkillEffectPatch) return;
 window.__resurgirActionModifiersAndSkillEffectPatch = true;

 function toNumberOrNull(value){
  if(value===null || value===undefined) return null;
  const text=String(value).trim();
  if(!text) return null;
  const num=Number(text);
  return Number.isFinite(num) ? num : null;
 }
 function getActionModDescriptor(action, flat, percent){
  const bits=[];
  const flatNum=Number(flat||0)||0;
  const percentNum=Number(percent||0)||0;
  if(percentNum) bits.push(`${percentNum>0?'+':''}${percentNum}%`);
  if(flatNum) bits.push(`${flatNum>0?'+':''}${flatNum} plano`);
  return `${actionLabel(action)}${bits.length?` (${bits.join(' · ')})`:''}`;
 }
 function resolveEffectTargets(effect){
  if(effect?.targetId){
   const byId=(state?.survivors||[]).find(s=>String(s?.id||'')===String(effect.targetId||'') && s.status!=='muerto');
   return byId ? [byId] : [];
  }
  const mode=String(effect?.targetMode||'').trim();
  const alive=(state?.survivors||[]).filter(s=>s && s.status!=='muerto');
  if(mode==='action'){
   const action=effect.action || state?.pendingEvent?.relatedAction;
   const ids=action && state?._lastDayActionSurvivors?.[action];
   return (ids||[]).map(id=>alive.find(s=>String(s.id)===String(id))).filter(Boolean);
  }
  if(mode==='allActors'){
   const actors=(typeof getEventActors==='function' ? (getEventActors(state?.pendingEvent)||[]) : []).filter(Boolean);
   return actors.filter(s=>s && s.status!=='muerto');
  }
  const match=mode.match(/^actor(\d)$/);
  if(match){
   const idx=Math.max(0, Number(match[1])-1);
   const actor=(typeof getEventActors==='function' ? (getEventActors(state?.pendingEvent)||[]) : [])[idx] || null;
   return actor && actor.status!=='muerto' ? [actor] : [];
  }
  if(mode==='random' || !mode){
   return alive.length ? [pick(alive)] : [];
  }
  return alive.length ? [pick(alive)] : [];
 }
/* dedup:survivorHasSkillLocal moved to survivors.js */

/* dedup:addSkillToSurvivor moved to survivors.js */

 function queueActionModifier(effect, delayed, sign){
  const action=String(effect?.action || state?.pendingEvent?.relatedAction || '').trim();
  if(!action) return false;
  const percent=Math.abs(Number(effect?.percent||0) || 0);
  const flat=Math.abs(Number(effect?.flat ?? effect?.modifier ?? 0) || 0);
  if(!percent && !flat) return false;
  const days=Math.max(1, Number(effect?.days||1) || 1);
  const startDay=state.day + (delayed ? 0 : 1);
  const signedPercent=sign<0 ? -percent : percent;
  const signedFlat=sign<0 ? -flat : flat;
  if(!Array.isArray(state.delayedQueue)) state.delayedQueue=[];
  for(let offset=0; offset<days; offset++){
   state.delayedQueue.push({day:startDay+offset,effect:{type:'_internalModifyAction',action,percent:signedPercent,flat:signedFlat}});
  }
  addLog(`${delayed?'[Retrasado] ':''}${sign<0?'🔴':'🟢'} ${sign<0?'Penalizada':'Bonificada'} la acción ${getActionModDescriptor(action, signedFlat, signedPercent)} durante ${days} día${days!==1?'s':''}.`);
  return true;
 }

 const prevApplyEffect=window.applyEffect;
 window.applyEffect=function(effect, delayed){
  if(effect?.type==='bonusAction'){
   if(queueActionModifier(effect, delayed, 1)) return;
  }
  if(effect?.type==='penaltyAction'){
   if(queueActionModifier(effect, delayed, -1)) return;
  }
  if(effect?.type==='addSkill'){
   const skillId=String(effect?.skill || effect?.skillId || '').trim();
   if(!skillId) return;
   const targets=resolveEffectTargets(effect);
   if(!targets.length) return;
   targets.forEach(target=>addSkillToSurvivor(target, skillId, delayed));
   return;
  }
  if(effect?.type==='_internalModifyAction'){
   if(!window.tempActionMods) window.tempActionMods={};
   const action=String(effect?.action||'').trim();
   if(!action) return;
   const currentRaw=window.tempActionMods[action];
   const current=(currentRaw && typeof currentRaw==='object')
    ? {flat:Number(currentRaw.flat||0)||0, percent:Number(currentRaw.percent||0)||0}
    : {flat:Number(currentRaw||0)||0, percent:0};
   const addFlat=Number(effect?.flat ?? effect?.modifier ?? 0) || 0;
   const addPercent=Number(effect?.percent||0) || 0;
   window.tempActionMods[action]={flat:current.flat+addFlat, percent:current.percent+addPercent};
   return;
  }
  return prevApplyEffect.apply(this, arguments);
 };
})();

(()=>{
 if(window.__resurgirAcidRainRepeatFix) return;
 window.__resurgirAcidRainRepeatFix=true;

 /* dedup: normalizeAcidText moved to events.js */

 function seedAcidRainCooldown(
){
  try{
   const events=Array.isArray(window.gameData?.events) ? window.gameData.events : [];
   const acidEvent=events.find(isAcidRainEvent);
   if(!acidEvent?.id || typeof window.getOrInitScheduledEventDay!=='function') return;
   if(!window.state) return;
   if(!window.state.eventSchedule || typeof window.state.eventSchedule!=='object') window.state.eventSchedule={};
   const existing=window.state.eventSchedule[acidEvent.id];
   if(existing && Number.isFinite(Number(existing.nextDay))) return;
   const jitter=(typeof window.rollEventIntervalJitter==='function') ? Number(window.rollEventIntervalJitter()||0) : 0;
   const interval=Math.max(4, 6 + jitter);
   const day=Number(window.state.day||1) || 1;
   window.state.eventSchedule[acidEvent.id]={
    nextDay: day + interval,
    jitter,
    interval,
    baseDays: 6
   };
  }catch(_e){}
 }

 setTimeout(seedAcidRainCooldown,0);
})();

(()=>{
 if(window.__resurgirTemporaryAwayPatch) return;
 window.__resurgirTemporaryAwayPatch=true;

 const AWAY_EFFECT_TYPES=new Set([
  'absentSurvivor','absentActionSurvivor','awaySurvivor','sendAwaySurvivor','temporarilyRemoveSurvivor',
  'survivorAway','leaveCampForDays','ausentarSuperviviente','ausentarSurvivor'
 ]);
 const DIRECT_SURVIVOR_EFFECT_TYPES=new Set([
  'addFatigue','removeFatigue','moraleSurvivor','injureExplorer','injureActionSurvivor','injureRandom','injureSurvivor',
  'healSurvivor','healInjured','addDrunk','removeDrunk'
 ]);

/* dedup:isTemporarilyAwaySurvivor moved to survivors.js */

 function getLivingRoster(){
  return (state?.survivors||[]).filter(s=>s && s.status!=='muerto');
 }
 function getAvailableRoster(){
  return getLivingRoster().filter(s=>!isTemporarilyAwaySurvivor(s));
 }
 function getAwayTargetPoolByAction(action){
  const key=String(action||'').trim();
  const ids=key && state?._lastDayActionSurvivors?.[key];
  const pool=(ids||[]).map(id=>(state?.survivors||[]).find(s=>s && s.id===id && s.status!=='muerto' && !isTemporarilyAwaySurvivor(s))).filter(Boolean);
  return pool;
 }
 function pickFromPool(pool){
  return Array.isArray(pool) && pool.length ? pool[Math.floor(Math.random()*pool.length)] : null;
 }
 function resolveAwayEffectTarget(effect){
  if(effect?.targetId){
   const direct=(state?.survivors||[]).find(s=>s && s.id===effect.targetId && s.status!=='muerto');
   return direct && !isTemporarilyAwaySurvivor(direct) ? direct : null;
  }
  const actionPool=getAwayTargetPoolByAction(effect?.action || state?.pendingEvent?.relatedAction);
  if(actionPool.length) return pickFromPool(actionPool);
  const mode=String(effect?.targetMode||'').trim();
  if(/^actor(\d)$/.test(mode) && typeof window.getEventActors==='function'){
   const idx=Math.max(0, Number(mode.slice(-1))-1);
   const actor=(window.getEventActors(state?.pendingEvent||null)||[])[idx]||null;
   if(actor && actor.status!=='muerto' && !isTemporarilyAwaySurvivor(actor)) return actor;
  }
  return pickFromPool(getAvailableRoster());
 }
 function normalizeAwayDays(effect){
  const rawMin=Number(effect?.minDays ?? effect?.daysMin ?? effect?.awayDaysMin ?? effect?.days ?? effect?.duration ?? effect?.awayDays ?? effect?.absentDays ?? 1);
  const rawMax=Number(effect?.maxDays ?? effect?.daysMax ?? effect?.awayDaysMax ?? effect?.days ?? effect?.duration ?? effect?.awayDays ?? effect?.absentDays ?? rawMin);
  let min=Math.max(1, Math.round(Number.isFinite(rawMin)?rawMin:1));
  let max=Math.max(1, Math.round(Number.isFinite(rawMax)?rawMax:min));
  if(max<min){ const swap=min; min=max; max=swap; }
  return min===max ? min : (min + Math.floor(Math.random()*(max-min+1)));
 }
 function normalizePercent(value){
  const num=Number(value||0);
  if(!Number.isFinite(num) || num<=0) return 0;
  if(num<=1) return Math.max(0, Math.min(100, num*100));
  return Math.max(0, Math.min(100, num));
 }
/* dedup:markSurvivorTemporaryAway moved to survivors.js */

 function processTemporaryAwayReturns(){
  getLivingRoster().forEach(s=>{
   const info=s?._temporaryAway;
   if(!info) return;
   if(Number(state?.day||0) < Number(info.returnDay||0)) return;
   delete s._temporaryAway;
   s.location=info.originalLocation || 'base';
   s.status='activo';
   s.action=null;
   s.travelDest=null;
   s.travelArrivalDay=null;
   s.travelReturnDay=null;
   s.exteriorSiteId=null;
   const customText=String(info.logReturnText||'').trim();
   if(customText){
    addLog(customText.replaceAll('{name}', s.name).replaceAll('{day}', String(state?.day||'')));
   } else {
    addLog(`↩ ${s.name} vuelve al campamento.`);
   }
   const chance=normalizePercent(info.returnInjuryChance);
   if(chance>0 && Math.random()*100 < chance && typeof window.injureSurvivor==='function'){
    window.injureSurvivor(s, `🩸 ${s.name} regresa {injuryLabel} tras pasar varios días fuera del campamento.`, {source:'event', level: info.returnInjuryLevel || 'simple'});
   }
  });
 }

 const oldPick=window.pick;
 if(typeof oldPick==='function' && !oldPick.__temporaryAwayWrapped){
  window.pick=function(arr){
   if(Array.isArray(arr) && arr.length){
    const filtered=arr.filter(item=>!isTemporarilyAwaySurvivor(item));
    if(filtered.length && filtered.length!==arr.length) return oldPick.call(this, filtered);
   }
   return oldPick.apply(this, arguments);
  };
  window.pick.__temporaryAwayWrapped=true;
 }

 const oldAliveSurvivors=window.aliveSurvivors;
 if(typeof oldAliveSurvivors==='function' && !oldAliveSurvivors.__temporaryAwayWrapped){
  window.aliveSurvivors=function(){
   return oldAliveSurvivors.apply(this, arguments).filter(s=>!isTemporarilyAwaySurvivor(s));
  };
  window.aliveSurvivors.__temporaryAwayWrapped=true;
 }

 const oldGetAliveSurvivorById=window.getAliveSurvivorById;
 if(typeof oldGetAliveSurvivorById==='function' && !oldGetAliveSurvivorById.__temporaryAwayWrapped){
  window.getAliveSurvivorById=function(id){
   const survivor=oldGetAliveSurvivorById.apply(this, arguments);
   return isTemporarilyAwaySurvivor(survivor) ? null : survivor;
  };
  window.getAliveSurvivorById.__temporaryAwayWrapped=true;
 }

 const oldInjureSurvivor=window.injureSurvivor;
 if(typeof oldInjureSurvivor==='function' && !oldInjureSurvivor.__temporaryAwayWrapped){
  window.injureSurvivor=function(s){
   if(isTemporarilyAwaySurvivor(s)) return false;
   return oldInjureSurvivor.apply(this, arguments);
  };
  window.injureSurvivor.__temporaryAwayWrapped=true;
 }

 const oldCheckGameOver=window.checkGameOver;
 if(typeof oldCheckGameOver==='function' && !oldCheckGameOver.__temporaryAwayWrapped){
  window.checkGameOver=function(){
   if(!state?._gameInitialized) return false;
   const stillAlive=(state?.survivors||[]).filter(s=>s && s.status!=='muerto');
   if(stillAlive.length<=0) return openGameOver('No queda ningún superviviente con vida.');
   if(state.stability<=0) return openGameOver('La estabilidad del asentamiento ha caído a cero. El grupo se disuelve.');
   return false;
  };
  window.checkGameOver.__temporaryAwayWrapped=true;
 }

 const oldApplyEffect=window.applyEffect;
 if(typeof oldApplyEffect==='function' && !oldApplyEffect.__temporaryAwayWrapped){
  window.applyEffect=function(effect, delayed){
   const type=String(effect?.type||'').trim();
   if(AWAY_EFFECT_TYPES.has(type)){
    const target=resolveAwayEffectTarget(effect);
    if(!target){
     addLog(`${delayed?'[Retrasado] ':''}ℹ No hay superviviente válido para ausentar temporalmente.`);
     return;
    }
    markSurvivorTemporaryAway(target, effect, delayed);
    return;
   }
   if(effect?.targetId && DIRECT_SURVIVOR_EFFECT_TYPES.has(type)){
    const target=(state?.survivors||[]).find(s=>s && s.id===effect.targetId);
    if(isTemporarilyAwaySurvivor(target)){
      addLog(`${delayed?'[Retrasado] ':''}ℹ ${target.name} está fuera del campamento y no se ve afectad@.`);
      return;
    }
   }
   return oldApplyEffect.apply(this, arguments);
  };
  window.applyEffect.__temporaryAwayWrapped=true;
 }

 const oldResetForNewDay=window.resetForNewDay;
 if(typeof oldResetForNewDay==='function' && !oldResetForNewDay.__temporaryAwayWrapped){
  window.resetForNewDay=function(){
   processTemporaryAwayReturns();
   return oldResetForNewDay.apply(this, arguments);
  };
  window.resetForNewDay.__temporaryAwayWrapped=true;
 }

 const oldRenderSurvivors=window.renderSurvivors;
 if(typeof oldRenderSurvivors==='function' && !oldRenderSurvivors.__temporaryAwayWrapped){
  window.renderSurvivors=function(){
   const result=oldRenderSurvivors.apply(this, arguments);
   document.querySelectorAll('#survivorList > .survivor-card:not([data-vehicle-card])').forEach(card=>{
    const sid=card.querySelector('.action-icon-btn[data-sid]')?.dataset?.sid;
    const survivor=sid ? (state?.survivors||[]).find(s=>s && s.id===sid) : null;
    if(isTemporarilyAwaySurvivor(survivor)) card.remove();
   });
   const meta=document.getElementById('uiV2SurvivorMeta');
   const list=document.getElementById('survivorList');
   if(meta && list){
    const visibleCards=list.querySelectorAll('.survivor-card:not([data-vehicle-card])').length;
    meta.textContent=activeMapTab==='exterior'
     ? `Exterior · ${visibleCards} visible${visibleCards!==1?'s':''}`
     : `Base · ${visibleCards} visible${visibleCards!==1?'s':''}`;
   }
   return result;
  };
  window.renderSurvivors.__temporaryAwayWrapped=true;
 }

 window.isTemporarilyAwaySurvivor=isTemporarilyAwaySurvivor;
 setTimeout(()=>{ try{ processTemporaryAwayReturns(); if(typeof render==='function') render(); }catch(_e){} },0);
})();

(()=>{
 if(window.__resurgirKidnapEffectsPatch) return;
 window.__resurgirKidnapEffectsPatch = true;

 const KIDNAP_EFFECT_TYPES = new Set([
  'kidnapSurvivor','abductSurvivor','secuestrarSurvivor','capturarSurvivor'
 ]);
 const RESCUE_EFFECT_TYPES = new Set([
  'rescueKidnappedSurvivor','returnKidnappedSurvivor','restoreKidnappedSurvivor','rescatarSurvivorSecuestrado'
 ]);

 function isAway(s){
  return !!(s && typeof window.isTemporarilyAwaySurvivor === 'function' && window.isTemporarilyAwaySurvivor(s));
 }
 function livingRoster(){
  return (state?.survivors||[]).filter(s => s && s.status !== 'muerto');
 }
 function availableRoster(){
  return livingRoster().filter(s => !isAway(s));
 }
 function randomPick(pool){
  if(typeof window.pick === 'function') return window.pick(pool);
  return Array.isArray(pool) && pool.length ? pool[Math.floor(Math.random()*pool.length)] : null;
 }
 function normalizePercent(value){
  const num = Number(value || 0);
  if(!Number.isFinite(num) || num <= 0) return 0;
  if(num <= 1) return Math.max(0, Math.min(100, num * 100));
  return Math.max(0, Math.min(100, num));
 }
 function resolveEffectTarget(effect){
  if(!effect) return null;
  if(effect.targetId){
   const direct = (state?.survivors||[]).find(s => s && s.id === effect.targetId && s.status !== 'muerto');
   return direct && !isAway(direct) ? direct : null;
  }
  const targetMode = String(effect.targetMode || '').trim();
  if(targetMode === 'action' || targetMode === '__action__'){
   const action = String(effect.action || state?.pendingEvent?.relatedAction || '').trim();
   const ids = action && state?._lastDayActionSurvivors?.[action];
   const pool = (ids||[]).map(id => (state?.survivors||[]).find(s => s && s.id === id && s.status !== 'muerto' && !isAway(s))).filter(Boolean);
   return randomPick(pool);
  }
  if(/^actor(\d)$/.test(targetMode) && typeof window.getEventActors === 'function'){
   const idx = Math.max(0, Number(targetMode.slice(-1)) - 1);
   const actor = (window.getEventActors(state?.pendingEvent || null) || [])[idx] || null;
   if(actor && actor.status !== 'muerto' && !isAway(actor)) return actor;
  }
  const action = String(effect.action || state?.pendingEvent?.relatedAction || '').trim();
  if(action){
   const ids = state?._lastDayActionSurvivors?.[action];
   const pool = (ids||[]).map(id => (state?.survivors||[]).find(s => s && s.id === id && s.status !== 'muerto' && !isAway(s))).filter(Boolean);
   if(pool.length) return randomPick(pool);
  }
  return randomPick(availableRoster());
 }
 function getKidnapKey(effect){
  return String(effect?.kidnapKey || effect?.key || effect?.slot || effect?.storyKey || effect?.questId || effect?.eventId || 'default').trim() || 'default';
 }
 function getKidnapStore(){
  if(!state.kidnappedSurvivors || typeof state.kidnappedSurvivors !== 'object') state.kidnappedSurvivors = {};
  return state.kidnappedSurvivors;
 }
 function clearTravelState(target){
  target.location = 'away';
  target.action = null;
  target.status = 'ausente';
  target.travelDest = null;
  target.travelArrivalDay = null;
  target.travelReturnDay = null;
  target.exteriorSiteId = null;
  if(typeof window.clearGroupActionMarkers === 'function') window.clearGroupActionMarkers(target);
 }
 function markKidnapped(target, effect, delayed=false){
  if(!target || target.status === 'muerto') return false;
  if(isAway(target)) return false;
  const key = getKidnapKey(effect);
  const store = getKidnapStore();
  store[key] = {
   survivorId: target.id,
   originalLocation: target.location || 'base',
   originalStatus: target.status || 'activo',
   kidnappedDay: Number(state?.day || 1),
   reason: String(effect?.reason || effect?.label || effect?.name || 'secuestro').trim() || 'secuestro'
  };
  target._temporaryAway = {
   returnDay: Number.MAX_SAFE_INTEGER,
   awayDays: Number.MAX_SAFE_INTEGER,
   originalLocation: target.location || 'base',
   originalStatus: target.status || 'activo',
   reason: store[key].reason,
   returnInjuryChance: 0,
   returnInjuryLevel: 'simple',
   logReturnText: '',
   kidnapped: true,
   kidnapKey: key
  };
  clearTravelState(target);
  const customLog = String(effect?.logText || effect?.kidnapText || '').trim();
  if(customLog){
   addLog(customLog.replaceAll('{name}', target.name).replaceAll('{key}', key));
  } else {
   addLog(`${delayed?'[Retrasado] ':''}🪢 ${target.name} desaparece del campamento sin dejar rastro.`);
  }
  if(typeof window.addTechnicalLog === 'function'){
   window.addTechnicalLog('survivor_kidnapped', 'Un superviviente ha sido marcado como secuestrado.', {
    survivorId: target.id,
    survivorName: target.name,
    kidnapKey: key,
    day: state?.day
   });
  }
  return true;
 }
 function resolveKidnappedEntry(effect){
  const store = getKidnapStore();
  const wantedKey = getKidnapKey(effect);
  if(store[wantedKey]) return { key: wantedKey, entry: store[wantedKey] };
  const firstKey = Object.keys(store)[0];
  if(firstKey) return { key: firstKey, entry: store[firstKey] };
  return { key: '', entry: null };
 }
 function rescueKidnapped(effect, delayed=false){
  const found = resolveKidnappedEntry(effect);
  if(!found.entry){
   addLog(`${delayed?'[Retrasado] ':''}ℹ No hay ningún superviviente secuestrado que rescatar.`);
   return false;
  }
  const target = (state?.survivors||[]).find(s => s && s.id === found.entry.survivorId);
  delete getKidnapStore()[found.key];
  if(state.kidnappedSurvivors && !Object.keys(state.kidnappedSurvivors).length) delete state.kidnappedSurvivors;
  if(!target || target.status === 'muerto'){
   addLog(`${delayed?'[Retrasado] ':''}ℹ El superviviente secuestrado ya no está disponible.`);
   return false;
  }
  delete target._temporaryAway;
  target.location = found.entry.originalLocation || 'base';
  target.status = 'activo';
  target.action = null;
  target.travelDest = null;
  target.travelArrivalDay = null;
  target.travelReturnDay = null;
  target.exteriorSiteId = null;
  const customText = String(effect?.returnText || effect?.logReturnText || '').trim();
  if(customText){
   addLog(customText.replaceAll('{name}', target.name).replaceAll('{key}', found.key));
  } else {
   addLog(`${delayed?'[Retrasado] ':''}↩ ${target.name} regresa al campamento tras el rescate.`);
  }
  const chance = normalizePercent(effect?.returnInjuryChance ?? effect?.injuryChance ?? effect?.hurtChance ?? 0);
  const level = String(effect?.returnInjuryLevel || effect?.injuryLevel || 'simple').trim().toLowerCase() || 'simple';
  if(chance > 0 && Math.random() * 100 < chance && typeof window.injureSurvivor === 'function'){
   window.injureSurvivor(target, `🩸 ${target.name} regresa {injuryLabel} tras el rescate.`, { source:'event', level });
  }
  if(typeof window.addTechnicalLog === 'function'){
   window.addTechnicalLog('survivor_rescued', 'Un superviviente secuestrado ha vuelto al campamento.', {
    survivorId: target.id,
    survivorName: target.name,
    kidnapKey: found.key,
    day: state?.day
   });
  }
  return true;
 }

 const oldApplyEffect = window.applyEffect;
 if(typeof oldApplyEffect === 'function' && !oldApplyEffect.__kidnapEffectsWrapped){
  window.applyEffect = function(effect, delayed){
   const type = String(effect?.type || '').trim();
   if(KIDNAP_EFFECT_TYPES.has(type)){
    const target = resolveEffectTarget(effect);
    if(!target){
     addLog(`${delayed?'[Retrasado] ':''}ℹ No hay superviviente válido para secuestrar.`);
     return;
    }
    markKidnapped(target, effect, delayed);
    return;
   }
   if(RESCUE_EFFECT_TYPES.has(type)){
    rescueKidnapped(effect, delayed);
    return;
   }
   return oldApplyEffect.apply(this, arguments);
  };
  window.applyEffect.__kidnapEffectsWrapped = true;
 }

 window.getKidnappedSurvivorEntry = resolveKidnappedEntry;
})();
