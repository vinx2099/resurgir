// Threats and ambushes split from app.js

function getHostileTypeDef(type){
 return (gameData.hostiles||[]).find(h=>h.id===type)||null;
}
function getHostileDef(type){
 return getHostileTypeDef(type);
}
function resolveHostileVariant(typeDef, variantId='random'){
 if(!typeDef) return {typeDef:null, variantDef:null};
 const variants=Array.isArray(typeDef.variants)?typeDef.variants.filter(Boolean):[];
 if(!variants.length) return {typeDef, variantDef:null};
 if(variantId && variantId!=='random' && variantId!=='aleatorio'){
 const found=variants.find(v=>v.id===variantId || v.key===variantId || v.name===variantId);
 if(found) return {typeDef, variantDef:found};
 }
 return {typeDef, variantDef:pick(variants)};
}

function getHostileLabel(type, variantId=null){
 if(state.attackHostileType===type && (!variantId || state.attackHostileVariant===variantId)) return state.attackHostileLabel || type;
 const info=resolveHostileThreat({hostileType:type, hostileVariant:variantId||'random'});
 return info.label || type;
}

function getHostileWeaponBonus(typeDef){
 if(!typeDef || !Array.isArray(typeDef.weapons)) return 0;
 const breakdown=getHostileWeaponBreakdown(typeDef);
 return breakdown.melee+breakdown.ranged;
}

function getHostileWeaponBreakdown(typeDef, variantDef=null){
 const weapons=[...(Array.isArray(typeDef?.weapons)?typeDef.weapons:[]), ...(Array.isArray(variantDef?.weapons)?variantDef.weapons:[])];
 const breakdown={melee:0,ranged:0};
 weapons.forEach(weapon => {
  if(Math.random() < (weapon.chance || 0)){
   const itemDef = getItemDef(weapon.itemId);
   if(itemDef && Array.isArray(itemDef.effects)){
    itemDef.effects.forEach(effect => {
     if(normalizeItemEffectKind(effect) === 'ranged'){
      const dieSize = getItemEffectAmount(effect, 0);
      if(dieSize > 0){
       breakdown.ranged += roll(1, dieSize);
      }
     } else if(normalizeItemEffectKind(effect) === 'melee'){
      breakdown.melee += getItemEffectAmount(effect, 0);
     }
    });
   }
  }
 });
 return breakdown;
}

function getHostileSkillBonus(typeDef, variantDef=null){
 return Number(variantDef?.skillBonus ?? variantDef?.combatSkillBonus ?? variantDef?.attackSkillBonus ?? typeDef?.skillBonus ?? typeDef?.combatSkillBonus ?? typeDef?.attackSkillBonus ?? 0) || 0;
}

function getAtalayaLevel(){
 const atalaya=state.buildings?.atalaya;
 return atalaya?.built&&atalaya?.active ? Number(atalaya.level||0) : 0;
}

function canUseAtalayaBinoculars(){
 return getAtalayaLevel()>=2;
}

function isThreatHostile(threat){
 if(!threat) return false;
 const def=threat.templateId ? getThreatDef(threat.templateId) : threat;
 const type=String(def?.type||'').toLowerCase();
 const tags=Array.isArray(def?.tags)?def.tags.map(tag=>String(tag).toLowerCase()):[];
 return type==='hostile'||tags.includes('hostile');
}

function getThreatAttackEffect(def){
 const pools=[def?.onMaxSeverity, def?.effects, def?.randomEffects];
 const bySeverity=def?.onEscalateBySeverity||{};
 Object.values(bySeverity).forEach(list=>pools.push(list));
 const flat=[];
 const scan=node=>{
  if(!node) return;
  if(Array.isArray(node)){ node.forEach(scan); return; }
  if(typeof node==='object'){
   flat.push(node);
   ['effects','success','failure'].forEach(key=>scan(node[key]));
  }
 };
 pools.forEach(scan);
 return flat.find(effect=>effect&&['trigger_attack','setAttackThreat'].includes(effect.type))||null;
}

function getAtalayaThreatHostileInfo(mode='attack', instanceId=''){
 if(mode==='attack'||state.attackThreat&&!instanceId){
  const info=resolveHostileThreat({hostileType:state.attackHostileType||'raiders', hostileVariant:state.attackHostileVariant||'random'});
  return {...info, strength:Number(state.attackStrength||info.strength||1), label:state.attackHostileLabel||info.label};
 }
 const threat=(state.activeThreats||[]).find(item=>String(item.instanceId)===String(instanceId)&&!item.resolved);
 if(!threat||!isThreatHostile(threat)) return null;
 const def=getThreatDef(threat.templateId)||{};
 const attackEffect=getThreatAttackEffect(def)||{};
 const info=resolveHostileThreat({
  hostileType:attackEffect.hostileType||attackEffect.attackType||attackEffect.hostile||def.hostileType||'raiders',
  hostileVariant:attackEffect.hostileVariant||attackEffect.variant||def.hostileVariant||'random',
  hostilePool:attackEffect.hostilePool||def.hostilePool||'hostile',
  hostileNpcId:attackEffect.hostileNpcId||def.hostileNpcId||''
 });
 return {...info, strength:Number(attackEffect.strength||def.force||info.strength||threat.severity||1), label:info.label||getThreatDisplayName(threat)};
}

function describeAtalayaHostileWeapons(info){
 const weapons=[...(info?.typeDef?.weapons||[]), ...(info?.variantDef?.weapons||[])].filter(Boolean);
 if(!weapons.length) return {armed:false, names:'Sin armas conocidas'};
 const names=weapons.map(weapon=>{
  const item=getItemDef(weapon.itemId);
  const chance=Number(weapon.chance||0);
  return `${item?.name||weapon.itemId||'Arma'}${chance>0&&chance<1?` (${Math.round(chance*100)}%)`:''}`;
 }).join(', ');
 return {armed:true, names};
}

function getAtalayaHostileAttackDice(info){
 return info?.variantDef?.attackDice || info?.variantDef?.attackDie || info?.typeDef?.attackDice || info?.typeDef?.attackDie || '1d6';
}

function openAtalayaBinoculars(mode='', instanceId=''){
 if(!canUseAtalayaBinoculars()){
  addLog('La Atalaya necesita nivel 2 para usar prismáticos.');
  return;
 }
 let info=null;
 let label='';
 if(mode==='persistent'&&instanceId){
  info=getAtalayaThreatHostileInfo('persistent', instanceId);
 }else if(mode==='attack'||state.attackThreat){
  info=getAtalayaThreatHostileInfo('attack');
 }else{
  const threat=(state.activeThreats||[]).find(th=>th&&!th.resolved&&isThreatHostile(th));
  if(threat) info=getAtalayaThreatHostileInfo('persistent', threat.instanceId);
 }
 if(!info){
  addLog('No hay amenaza hostil que observar con prismáticos.');
  return;
 }
 const weaponInfo=describeAtalayaHostileWeapons(info);
 label=info.label||'Amenaza hostil';
 openLogPopup(`Prismáticos · ${label}\nEstado armado: ${weaponInfo.armed?'Lleva armas':'No se aprecian armas'}\nArmas: ${weaponInfo.names}\nDado de ataque: ${getAtalayaHostileAttackDice(info)}\nFuerza estimada: ${Number(info.strength||1)}`);
}

function checkAttackArrival(){
 if(!state.attackThreat) return;
 if(state.attackArrivalDay>0&&state.day>state.attackArrivalDay){
 // Attackers arrived and nobody stopped them — destroy a building
 const built=Object.values(state.buildings).filter(b=>b.built&&b.level>0);
 if(built.length){
 const b=pick(built);
 b.level=Math.max(0,b.level-1);
 if(b.level===0) b.built=false;
 addLog(`\u{1F4A5} El grupo hostil no fue repelido. ${b.name} ha sido destruida (nivel ${b.level}).`);
 }
 state.stability=Math.max(0,state.stability-2);
 addLog('\u{1F4A5} -2 estabilidad por no defender el asentamiento.');
 state.attackThreat=false;
 state.attackHostileVariant='random';
 state.attackHostileLabel='Raiders';
 state.attackHostileIcon='💀 ';
 state.attackHostileNpc=false;
 state.attackHostileNpcEventId=null;
 state.attackStrength=3;
 state.attackArrivalDay=0;
 state.attackEffectVictory=[];
 applyEffectList(state.attackEffectDefeat||[]);
 state.attackEffectDefeat=[];
 state.attackPopupVictory=null;
 state.attackPopupDefeat=null;
 }
}

function resolveGroupAttack(){
 if(!state.attackThreat) return;

 // ── Check if this is a preemptive strike ──
 const attackers=state.survivors.filter(s=>s.action?.type==='atacar'&&s.status!=='muerto'&&!isExteriorSurvivor(s));
 const isPreemptive=attackers.length>0;

 let totalDef, totalAtk, diff, defRoll, atkRoll, combatReport=null;
 let ownBreakdown='', enemyBreakdown='';
 const hostileLabel=state.attackHostileLabel || getHostileLabel(state.attackHostileType||'raiders', state.attackHostileVariant||null);

 if(isPreemptive){
 // ── PREEMPTIVE STRIKE ──
 // (attackers × 1) + skill bonuses (combatiente/explorador +1 each) + 1 emboscada + 1d6
 const skillBonus=attackers.reduce((sum,s)=>{
 const skills=getSurvivorSkills(s);
 return sum+(skills.includes('combatiente')?1:0)+(skills.includes('explorador')?1:0);
 },0);
 const weaponBonus=attackers.reduce((sum,s)=>{
 const item=(s.inventory||[]).map(materializeItem).find(it=>it.itemId===s.equippedWeapon && it.itemType==='weapon' && it.quality>0 && canEquipItem(s,it));
 return sum + Number(item?.combatBonus||0) + getEquippedEffectTotal(s,'melee');
 },0);
 const rangedDiceBonus=attackers.reduce((sum,s)=>{
 const die=getEquippedRangedDiceBonus(s);
 return sum + (die>0 ? roll(1,die) : 0);
 },0);
 const emboscadaBonus=1;
 const relationshipBonus=getCombatRelationshipModifier(attackers);
 defRoll=roll(1,6);
 atkRoll=roll(1,4);
 const hostileInfo=resolveHostileThreat({hostileType:state.attackHostileType||'raiders', hostileVariant:state.attackHostileVariant||'random'});
 const hostileDef = hostileInfo?.typeDef || getHostileTypeDef(state.attackHostileType || 'raiders');
 const hostileVariant = hostileInfo?.variantDef || null;
 const hostileSkillBonus=getHostileSkillBonus(hostileDef, hostileVariant);
 const hostileWeapons=getHostileWeaponBreakdown(hostileDef, hostileVariant);
 totalDef=attackers.length+skillBonus+weaponBonus+rangedDiceBonus+emboscadaBonus+defRoll+relationshipBonus;
 totalAtk=state.attackStrength+hostileSkillBonus+hostileWeapons.melee+hostileWeapons.ranged+atkRoll;
 diff=totalAtk-totalDef;
 ownBreakdown=`Atacantes ${attackers.length}, habilidades +${skillBonus}, armas +${weaponBonus}, distancia +${rangedDiceBonus}, emboscada +${emboscadaBonus}${relationshipBonus?`, vinculos ${relationshipBonus>0?'+':''}${relationshipBonus}`:''}, 1d6 (${defRoll}) = ${totalDef}`;
 enemyBreakdown=`${hostileLabel}: fuerza ${state.attackStrength}, habilidades +${hostileSkillBonus}, melee +${hostileWeapons.melee}, distancia +${hostileWeapons.ranged}, 1d4 (${atkRoll}) = ${totalAtk}`;
 combatReport={factions:[
  {label:'ASENTAMIENTO',total:totalDef,accent:'ok',rows:[['Fuerza',attackers.length],['Bonus habilidad',skillBonus],['Arma melee',weaponBonus],['Arma distancia',rangedDiceBonus],['Emboscada',emboscadaBonus],['Vinculos',relationshipBonus],['Dado',`d6 = ${defRoll}`]]},
  {label:hostileLabel,total:totalAtk,accent:'danger',rows:[['Fuerza',Number(state.attackStrength||0)],['Bonus habilidad',hostileSkillBonus],['Arma melee',hostileWeapons.melee],['Arma distancia',hostileWeapons.ranged],['Emboscada',0],['Dado',`d4 = ${atkRoll}`]]}
 ]};
 addLog(`[COMBATE] EMBOSCADA: ${attackers.length} atacantes +${skillBonus} habilidades +${weaponBonus} armas +${rangedDiceBonus} distancia +${emboscadaBonus} emboscada${relationshipBonus?` ${relationshipBonus>0?'+':''}${relationshipBonus} vinculos`:''} +${defRoll}(d6) = ${totalDef}`);
 addLog(`[COMBATE] RAIDERS: ${state.attackStrength} fuerza +${hostileSkillBonus} habilidades +${hostileWeapons.melee} melee +${hostileWeapons.ranged} distancia +${atkRoll}(d4) = ${totalAtk}`);
 } else {
 // ── DEFENSIVE BATTLE ──
 const defenders=state.survivors.filter(s=>s.action?.type==='defender'&&s.status!=='muerto'&&!isExteriorSurvivor(s));
 const defCount=defenders.length;
 const skillBonus=defenders.reduce((sum,s)=>{
 const skills=getSurvivorSkills(s);
 return sum+(skills.includes('combatiente')?1:0);
 },0);
 const weaponBonus=defenders.reduce((sum,s)=>{
 const item=(s.inventory||[]).map(materializeItem).find(it=>it.itemId===s.equippedWeapon && it.itemType==='weapon' && it.quality>0 && canEquipItem(s,it));
 return sum + Number(item?.combatBonus||0) + getEquippedEffectTotal(s,'melee');
 },0);
 const rangedDiceBonus=defenders.reduce((sum,s)=>{
 const die=getEquippedRangedDiceBonus(s);
 return sum + (die>0 ? roll(1,die) : 0);
 },0);
 const atalayaBonus=getAtalayaLevel()>=1?1:0;
 const murosLevel=state.buildings.muros?.built?state.buildings.muros.level:0;
 const murosBonus=murosLevel>=2?2:murosLevel>=1?1:0;
 const vallaBonus=state.vallaElectrica&&getElectricityFree()>=0?getBaseUpgradeEffectNumber('electric_fence','defenseBonus',1):0;
 const stabilityDefenseBonus=Number(getStabilityModifiers().defenseBonus||0);
 const relationshipBonus=getCombatRelationshipModifier(defenders);
 defRoll=roll(1,6);
 atkRoll=roll(1,6); // Raiders prepared when attacking — roll 1d6
 const hostileInfo=resolveHostileThreat({hostileType:state.attackHostileType||'raiders', hostileVariant:state.attackHostileVariant||'random'});
 const hostileDef = hostileInfo?.typeDef || getHostileTypeDef(state.attackHostileType || 'raiders');
 const hostileVariant = hostileInfo?.variantDef || null;
 const hostileSkillBonus=getHostileSkillBonus(hostileDef, hostileVariant);
 const hostileWeapons=getHostileWeaponBreakdown(hostileDef, hostileVariant);
 totalDef=defCount+skillBonus+weaponBonus+rangedDiceBonus+atalayaBonus+murosBonus+vallaBonus+defRoll+stabilityDefenseBonus+relationshipBonus;
 totalAtk=state.attackStrength+hostileSkillBonus+hostileWeapons.melee+hostileWeapons.ranged+atkRoll;
 diff=totalAtk-totalDef;
 ownBreakdown=`Defensores ${defCount}, habilidades +${skillBonus}, Armas +${weaponBonus}, Distancia +${rangedDiceBonus}, Muro +${murosBonus}, Atalaya +${atalayaBonus}${vallaBonus?`, Valla +${vallaBonus}`:''}${stabilityDefenseBonus?`, Estabilidad ${stabilityDefenseBonus>0?'+':''}${stabilityDefenseBonus}`:''}${relationshipBonus?`, Vinculos ${relationshipBonus>0?'+':''}${relationshipBonus}`:''}, 1d6 (${defRoll}) = ${totalDef}`;
 enemyBreakdown=`${hostileLabel}: fuerza ${state.attackStrength}, habilidades +${hostileSkillBonus}, melee +${hostileWeapons.melee}, distancia +${hostileWeapons.ranged}, 1d6 (${atkRoll}) = ${totalAtk}`;
 combatReport={factions:[
  {label:'ASENTAMIENTO',total:totalDef,accent:'ok',rows:[['Fuerza',defCount],['Bonus habilidad',skillBonus],['Arma melee',weaponBonus],['Arma distancia',rangedDiceBonus],['Emboscada',0],['Defensas base',murosBonus+atalayaBonus+vallaBonus+stabilityDefenseBonus],['Vinculos',relationshipBonus],['Dado',`d6 = ${defRoll}`]]},
  {label:hostileLabel,total:totalAtk,accent:'danger',rows:[['Fuerza',Number(state.attackStrength||0)],['Bonus habilidad',hostileSkillBonus],['Arma melee',hostileWeapons.melee],['Arma distancia',hostileWeapons.ranged],['Emboscada',0],['Dado',`d6 = ${atkRoll}`]]}
 ]};
 addLog(`[COMBATE] DEFENSA: ${defCount} defensores +${skillBonus} habilidades +${weaponBonus} armas +${rangedDiceBonus} distancia +${murosBonus} muros +${atalayaBonus} atalaya${vallaBonus?` +${vallaBonus} valla electrica`:''}${stabilityDefenseBonus?` ${stabilityDefenseBonus>0?'+':''}${stabilityDefenseBonus} estabilidad`:''}${relationshipBonus?` ${relationshipBonus>0?'+':''}${relationshipBonus} vinculos`:''} +${defRoll}(d6) = ${totalDef}`);
 addLog(`[COMBATE] RAIDERS: ${state.attackStrength} fuerza +${hostileSkillBonus} habilidades +${hostileWeapons.melee} melee +${hostileWeapons.ranged} distancia +${atkRoll}(d6) = ${totalAtk}`);
 }

 const alive=aliveSurvivors().filter(s=>!isExteriorSurvivor(s));

 if(totalDef>=totalAtk){
 // ── VICTORIA ──
 state.attackThreat=false;
 state.stability=Math.min(10,state.stability+1);
 if(isPreemptive){
 addLog(`[OK] Los raiders han sido eliminados antes de llegar. +1 estabilidad.`);
 if(typeof setCombatMusic==='function') setCombatMusic(false);
 // Injury risk even on victory
 attackers.forEach(s=>{
 if(Math.random()<0.35) injureSurvivor(s,`[HERIDA] ${s.name} resulta {injuryLabel} en la emboscada.`,{source:'ambush'});
 });
 openCombatResultPopup(attackPopupPayload('victory',{
 title:'Emboscada exitosa',
 icon:'*',
 text:`El grupo elimina a ${getHostileLabel(state.attackHostileType||'raiders')} antes de que lleguen al asentamiento.`,
 summary:[`Resultado: ${totalDef} vs ${totalAtk}`,'+1 estabilidad'],
 effects:(state.attackEffectVictory||[]).map(combatEffectSummary).filter(Boolean),
 outcome:'victory',
 settlementScore:totalDef,
 hostileScore:totalAtk,
 settlementLabel:'ASENTAMIENTO',
 hostileLabel:hostileLabel,
 combatReport,
 }));
 } else {
 addLog(`[OK] Ataque repelido (${totalDef} vs ${totalAtk}). +1 estabilidad.`);
 openCombatResultPopup(attackPopupPayload('victory',{
 title:'Ataque repelido',
 icon:'*',
 text:`La defensa del asentamiento resiste el ataque de ${getHostileLabel(state.attackHostileType||'raiders')}.`,
 summary:[`Resultado: ${totalDef} vs ${totalAtk}`,'+1 estabilidad'],
 effects:(state.attackEffectVictory||[]).map(combatEffectSummary).filter(Boolean),
 outcome:'victory',
 settlementScore:totalDef,
 hostileScore:totalAtk,
 settlementLabel:'ASENTAMIENTO',
 hostileLabel:hostileLabel,
 combatReport,
 }));
 }
 applyEffectList(state.attackEffectVictory||[]);
 } else {
 // ── DERROTA ──
 if(isPreemptive){
 addLog(`[FALLO] La emboscada fracaso (${totalDef} vs ${totalAtk}). Los raiders siguen avanzando.`);
 attackers.forEach(s=>{
 if(Math.random()<0.6) injureSurvivor(s,`[HERIDA] ${s.name} resulta {injuryLabel} en la emboscada fallida.`,{source:'ambush'});
 });
 // Raiders still coming — arrive next day
 state.attackArrivalDay=state.day+1;
 state.stability=Math.max(0,state.stability-1);
 addLog('\u{1F4A5} -1 estabilidad. Los raiders se reorganizan y atacaran manana.');
 applyEffectList(state.attackEffectDefeat||[]);
 openCombatResultPopup(attackPopupPayload('defeat',{
 title:'Emboscada fallida',
 icon:'*',
 text:'El ataque preventivo no logro frenar al enemigo. El asalto llegara al dia siguiente.',
 summary:[`Resultado: ${totalDef} vs ${totalAtk}`,'-1 estabilidad','El ataque enemigo continua'],
 effects:(state.attackEffectDefeat||[]).map(combatEffectSummary).filter(Boolean),
 outcome:'defeat',
 settlementScore:totalDef,
 hostileScore:totalAtk,
 settlementLabel:'ASENTAMIENTO',
 hostileLabel:hostileLabel,
 combatReport,
 }));
 // Don't clear threat, don't reset attack state
 return; // return without resetting state.attackThreat
 }

 addLog(`[FALLO] El asentamiento no pudo resistir el ataque (${totalDef} vs ${totalAtk}). Diferencia: ${diff}.`);
 const injureChance=Math.min(0.3+diff*0.12, 0.95);
 const deathChance=diff>=5 ? Math.min((diff-4)*0.12, 0.5) : diff>=3 ? 0.05 : 0;

 const candidates=[...alive];
 const maxCasualties=Math.max(1,Math.floor(diff/2));
 let casualtyCount=0;
 const shuffled=[...candidates].sort(()=>Math.random()-0.5);
 for(const s of shuffled){
 if(casualtyCount>=maxCasualties) break;
 if(s.status==='muerto') continue;
 const r=Math.random();
 if(r<deathChance){
 killSurvivor(s,`[MUERTE] ${s.name} muere durante el ataque.`);
 casualtyCount++;
 } else if(r<injureChance){
 injureSurvivor(s,`[HERIDA] ${s.name} resulta {injuryLabel} durante el ataque.`,{source:'combat'});
 casualtyCount++;
 }
 }
 if(casualtyCount===0) addLog('El ataque causo danos pero no hubo bajas personales.');

 const moralPenalty=Math.min(diff,4);
 state.stability=Math.max(0,state.stability-moralPenalty);
 addLog(`\u{1F4A5} -${moralPenalty} estabilidad por el ataque.`);

 applyEffectList(state.attackEffectDefeat||[]);
 // Apply hostile lootOnDefeat
 const defHostileDef=getHostileDef(state.attackHostileType||'raiders');
 applyLootList(defHostileDef?.lootOnDefeat||[]);
 openCombatResultPopup(attackPopupPayload('defeat',{
 title:'Derrota en combate',
 icon:'*',
 text:`El asentamiento no resistio el ataque de ${getHostileLabel(state.attackHostileType||'raiders')}.`,
 summary:[`Resultado: ${totalDef} vs ${totalAtk}`,`-${moralPenalty} estabilidad`],
 effects:(state.attackEffectDefeat||[]).map(combatEffectSummary).filter(Boolean),
 outcome:'defeat',
 settlementScore:totalDef,
 hostileScore:totalAtk,
 settlementLabel:'ASENTAMIENTO',
 hostileLabel:hostileLabel,
 combatReport,
 }));
 }

 // Reset attack state
 state.attackThreat=false;
 state.attackHostileType="raiders";
 state.attackStrength=3;
 state.attackArrivalDay=0;
 state.attackEffectVictory=[];
 state.attackEffectDefeat=[];
 state.attackPopupVictory=null;
 state.attackPopupDefeat=null;
 if(typeof setCombatMusic==='function') setCombatMusic(false);
}

function calculateGroupAmbushChance(ctx, actionType){
 if(!ctx||ctx.members.length<2) return 0;
 let chance=0;
 const leaderState=getActionStartMoraleState(ctx.leader);
 if(actionType==='forraje' || actionType==='reciclar'){
 if(leaderState==='low') chance+=0.10;
 ctx.supports.forEach(member=>{
 if(getActionStartMoraleState(member)==='low') chance+=0.10;
 });
 }else if(actionType==='explorar'){
 if(leaderState==='normal') chance+=0.05;
 else if(leaderState==='low') chance+=0.10;
 ctx.supports.forEach(member=>{
 const stateKey=getActionStartMoraleState(member);
 if(stateKey==='normal') chance+=0.05;
 else if(stateKey==='low') chance+=0.10;
 });
 }
 return Math.max(0, Math.min(0.95, chance));
}


function resolveActionAmbushHostile(actionType='forraje'){
 const info=resolveHostileThreat({hostileType:'random'});
 const typeDef=info?.typeDef||{};
 const variantDef=info?.variantDef||{};
 const strength=Math.max(1, Number(variantDef.force ?? variantDef.strength ?? typeDef.force ?? typeDef.strength ?? info?.strength ?? 3) || 3);
 const skillBonus=Number(variantDef.skillBonus ?? variantDef.combatSkillBonus ?? variantDef.attackSkillBonus ?? typeDef.skillBonus ?? typeDef.combatSkillBonus ?? typeDef.attackSkillBonus ?? 0) || 0;
 const weaponBonus=Number(variantDef.weaponBonus ?? variantDef.combatBonus ?? variantDef.attackWeaponBonus ?? typeDef.weaponBonus ?? typeDef.combatBonus ?? typeDef.attackWeaponBonus ?? 0) || 0;
 const attackDie=Math.max(2, Math.min(12, Number(variantDef.attackDie ?? variantDef.dieSides ?? typeDef.attackDie ?? typeDef.dieSides ?? 6) || 6));
 const image=getHostileImageFromInfo(info);
 return {...info, strength, skillBonus, weaponBonus, attackDie, image};
}


function getAmbushParticipantSkillBonus(participants=[]){
 return participants.reduce((sum,s)=>{
 const skills=getSurvivorSkills(s);
 return sum + (skills.includes('combatiente')?1:0) + (skills.includes('explorador')?1:0) + (skills.includes('rastreador')?1:0);
 },0);
}


function getAmbushParticipantWeaponBonus(participants=[]){
 return participants.reduce((sum,s)=>{
 const item=(s.inventory||[]).map(materializeItem).find(it=>it.itemId===s.equippedWeapon && it.itemType==='weapon' && it.quality>0 && canEquipItem(s,it));
 return sum + Number(item?.combatBonus||0) + getEquippedEffectTotal(s,'melee') + getEquippedEffectTotal(s,'combat');
 },0);
}


function getAmbushSchemaAttackEffect(schema){
 if(!schema) return null;
 const effects=normaliseEffects(schema.effects||[]);
 return effects.find(e=>e&&e.type==='setAttackThreat')||null;
}


function resolveActionAmbushEncounter(actionType='forraje'){
 const schema=pickAmbushEventSchema(actionType);
 const attackEffect=getAmbushSchemaAttackEffect(schema);
 const info=resolveHostileThreat({
 hostileType: attackEffect?.hostileType || attackEffect?.hostile || 'random',
 hostileVariant: attackEffect?.hostileVariant || attackEffect?.variant || 'random'
 });
 const typeDef=info?.typeDef||{};
 const variantDef=info?.variantDef||{};
 const fallbackStrength=Math.max(1, Number(variantDef.force ?? variantDef.strength ?? typeDef.force ?? typeDef.strength ?? info?.strength ?? 3) || 3);
 const strength=Math.max(1, Number(attackEffect?.strength ?? fallbackStrength) || fallbackStrength);
 const skillBonus=Number(variantDef.skillBonus ?? variantDef.combatSkillBonus ?? variantDef.attackSkillBonus ?? typeDef.skillBonus ?? typeDef.combatSkillBonus ?? typeDef.attackSkillBonus ?? 0) || 0;
 const weaponBonus=Number(variantDef.weaponBonus ?? variantDef.combatBonus ?? variantDef.attackWeaponBonus ?? typeDef.weaponBonus ?? typeDef.combatBonus ?? typeDef.attackWeaponBonus ?? 0) || 0;
 const attackDie=Math.max(2, Math.min(12, Number(variantDef.attackDie ?? variantDef.dieSides ?? typeDef.attackDie ?? typeDef.dieSides ?? 6) || 6));
 const image=(schema?.image||'').trim() || getHostileImageFromInfo(info);
 return {
 ...info,
 schema,
 attackEffect,
 strength,
 skillBonus,
 weaponBonus,
 attackDie,
 image,
 eventText:(schema?.text||schema?.story||'').trim(),
 eventName:(schema?.name||schema?.title||'').trim()
 };
}


function queueGroupActionAmbush(ctx, actionType, contextLabel, forcedChance=null){
 const chance=forcedChance==null ? calculateGroupAmbushChance(ctx, actionType) : Math.max(0, Math.min(0.95, Number(forcedChance||0)));
 if(chance<=0 || Math.random()>=chance) return false;
 const members=(ctx?.members||[]).filter(s=>s&&s.status!=='muerto');
 if(!members.length) return false;
 const hostileInfo=resolveActionAmbushEncounter(actionType);
 if(!Array.isArray(state._pendingAmbushQueue)) state._pendingAmbushQueue=[];
 const encounter={
 id:`ambush_${state.day}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
 actionType,
 contextLabel,
 participantIds:members.map(s=>s.id),
 hostileType:hostileInfo.type||'raiders',
 hostileVariant:hostileInfo.variant||'random',
 hostileLabel:hostileInfo.label||'Hostiles',
 hostileIcon:(hostileInfo.icon||'\u{1F480}').trim()||'\u{1F480}',
 hostileImage:hostileInfo.image||'',
 hostileStrength:hostileInfo.strength||3,
 hostileSkillBonus:hostileInfo.skillBonus||0,
 hostileWeaponBonus:hostileInfo.weaponBonus||0,
 hostileAttackDie:hostileInfo.attackDie||6,
 schemaId: hostileInfo.schema?.id || null,
 schemaName: hostileInfo.eventName || '',
 eventText: hostileInfo.eventText || '',
 combatPopupVictory: hostileInfo.attackEffect?.combatPopupVictory ? deepClone(hostileInfo.attackEffect.combatPopupVictory) : null,
 combatPopupDefeat: hostileInfo.attackEffect?.combatPopupDefeat ? deepClone(hostileInfo.attackEffect.combatPopupDefeat) : null,
 effectOnVictory: hostileInfo.attackEffect?.effectOnVictory ? deepClone(hostileInfo.attackEffect.effectOnVictory) : [],
 effectOnDefeat: hostileInfo.attackEffect?.effectOnDefeat ? deepClone(hostileInfo.attackEffect.effectOnDefeat) : []
 };
 state._pendingAmbushQueue.push(encounter);
 addLog(`[ALERTA] ${encounter.hostileLabel} sorprenden al grupo durante ${contextLabel}. EMBOSCADA!`);
 return true;
}


function openNextAmbushPopup(){
 const queue=Array.isArray(state._pendingAmbushQueue)?state._pendingAmbushQueue:[];
 const encounter=queue[0]||null;
 state._activeAmbushCombat=encounter||null;
 if(!encounter){
 state._activeAmbushCombat=null;
 if(state._dayPauseAfterActions){
 state._dayPauseAfterActions=false;
 continueEndDayAfterActions();
 }
 return;
 }
 const popup=document.getElementById('ambushPopup');
 const imageWrap=document.getElementById('ambushPopupHostileImage');
 const textEl=document.getElementById('ambushPopupText');
 const metaEl=document.getElementById('ambushPopupMeta');
 if(!popup||!imageWrap||!textEl||!metaEl){
 resolvePendingAmbushCombat();
 return;
 }
 const participants=(encounter.participantIds||[]).map(id=>state.survivors.find(s=>String(s.id)===String(id))).filter(Boolean).filter(s=>s.status!=='muerto');
 const participantNames=participants.map(s=>s.name).join(', ')||'El grupo';
 if(encounter.hostileImage){
 imageWrap.innerHTML=`<img src="${escapeAttr(encounter.hostileImage)}" style="width:100%;height:100%;object-fit:cover;filter:grayscale(20%) contrast(1.05);">`;
 }else{
 imageWrap.textContent=encounter.hostileIcon||'*';
 }
 const fallbackText=`<b style="color:var(--danger-bright);">${escapeHtml(encounter.hostileLabel)}</b> ataca directamente a <b>${escapeHtml(participantNames)}</b> durante ${escapeHtml(encounter.contextLabel)}.`;
 textEl.innerHTML=(encounter.eventText||'').trim() ? escapeHtml(replaceDynamicNameTokens(encounter.eventText)).replace(/\n/g,'<br>') : fallbackText;
 metaEl.innerHTML=`${encounter.schemaName?`Evento: <b>${escapeHtml(encounter.schemaName)}</b><br>`:''}Fuerza hostil: <b style="color:var(--danger-bright);">${encounter.hostileStrength}</b> · Participantes: <b>${participants.length}</b><br>El turno queda en pausa hasta resolver este combate.`;
 popup.classList.add('open');
}


function finishAmbushQueueFlow(){
 state._activeAmbushCombat=null;
 if(Array.isArray(state._pendingAmbushQueue) && state._pendingAmbushQueue.length){
 openNextAmbushPopup();
 render();
 return;
 }
 if(state._dayPauseAfterActions){
 state._dayPauseAfterActions=false;
 continueEndDayAfterActions();
 return;
 }
 render();
}


function resolvePendingAmbushCombat(){
 const popup=document.getElementById('ambushPopup');
 const encounter=state._activeAmbushCombat || (Array.isArray(state._pendingAmbushQueue)?state._pendingAmbushQueue[0]:null);
 if(popup) popup.classList.remove('open');
 if(!encounter){
 finishAmbushQueueFlow();
 return;
 }
 const participants=(encounter.participantIds||[]).map(id=>state.survivors.find(s=>String(s.id)===String(id))).filter(Boolean).filter(s=>s.status!=='muerto');
 const hostileLabel=encounter.hostileLabel||'Hostiles';
 const survivorRoll=roll(1,6);
 const hostileRoll=roll(1, encounter.hostileAttackDie||6);
 const skillBonus=getAmbushParticipantSkillBonus(participants);
 const weaponBonus=getAmbushParticipantWeaponBonus(participants);
 const survivorsTotal=participants.length + skillBonus + weaponBonus + survivorRoll;
 const hostileTotal=(encounter.hostileStrength||3) + (encounter.hostileWeaponBonus||0) + (encounter.hostileSkillBonus||0) + hostileRoll;
 addLog(`[COMBATE] EMBOSCADA: ${participants.map(s=>s.name).join(', ')} se enfrentan a ${hostileLabel}.`);
 addLog(`[COMBATE] SUPERVIVIENTES: ${participants.length} participantes +${skillBonus} habilidades +${weaponBonus} armas +${survivorRoll}(d6) = ${survivorsTotal}`);
 addLog(`[COMBATE] HOSTILES: ${encounter.hostileStrength||3} fuerza +${encounter.hostileSkillBonus||0} habilidades +${encounter.hostileWeaponBonus||0} armas +${hostileRoll}(d${encounter.hostileAttackDie||6}) = ${hostileTotal}`);
 const summary=[`Supervivientes: ${survivorsTotal}`,`${hostileLabel}: ${hostileTotal}`];
 const participantNames=participants.map(s=>s.name).join(', ')||'El grupo';
 let popupPayload;
 let postEffects=[];
 if(survivorsTotal>=hostileTotal){
 participants.forEach(s=>{
 if(Math.random()<0.25) injureSurvivor(s, `[HERIDA] ${s.name} resulta {injuryLabel} en la emboscada.`, {source:'ambush'});
 });
 const victoryEffects=normaliseEffects(encounter.effectOnVictory||[]);
 if(victoryEffects.length) applyEffectList(victoryEffects, false);
 postEffects=victoryEffects.map(combatEffectSummary).filter(Boolean);
 popupPayload={
 title:'Emboscada superada',
 icon:encounter.hostileIcon||'*',
 text:`${participantNames} logra imponerse a ${hostileLabel}.`,
 summary,
 effects:postEffects,
 outcome:'victory',
 settlementScore:survivorsTotal,
 hostileScore:hostileTotal,
 settlementLabel:'ASENTAMIENTO',
 hostileLabel:hostileLabel,
 };
 if(encounter.combatPopupVictory){
 popupPayload={
 ...popupPayload,
 title: encounter.combatPopupVictory.title || popupPayload.title,
 text: encounter.combatPopupVictory.text || popupPayload.text,
 icon: encounter.combatPopupVictory.icon || popupPayload.icon
 };
 }
 } else {
 let injuredCount=0;
 participants.forEach(s=>{
 if(Math.random()<0.55){
 injureSurvivor(s, `[HERIDA] ${s.name} resulta {injuryLabel} en la emboscada.`, {source:'ambush'});
 injuredCount++;
 }
 });
 if(!injuredCount && participants[0]){
 injureSurvivor(participants[0], `[HERIDA] ${participants[0].name} resulta {injuryLabel} en la emboscada.`, {source:'ambush'});
 }
 const defeatEffects=normaliseEffects(encounter.effectOnDefeat||[]);
 if(defeatEffects.length) applyEffectList(defeatEffects, false);
 postEffects=defeatEffects.map(combatEffectSummary).filter(Boolean);
 const effectLines=['Varios supervivientes pueden resultar heridos', ...postEffects];
 popupPayload={
 title:'Emboscada sufrida',
 icon:encounter.hostileIcon||'*',
 text:`${hostileLabel} golpea al grupo de ${participantNames} y logra imponer su ataque.`,
 summary,
 effects:effectLines,
 outcome:'defeat',
 settlementScore:survivorsTotal,
 hostileScore:hostileTotal,
 settlementLabel:'ASENTAMIENTO',
 hostileLabel:hostileLabel,
 };
 if(encounter.combatPopupDefeat){
 popupPayload={
 ...popupPayload,
 title: encounter.combatPopupDefeat.title || popupPayload.title,
 text: encounter.combatPopupDefeat.text || popupPayload.text,
 icon: encounter.combatPopupDefeat.icon || popupPayload.icon
 };
 }
 }
 openCombatResultPopup(popupPayload);
 if(Array.isArray(state._pendingAmbushQueue) && state._pendingAmbushQueue.length) state._pendingAmbushQueue.shift();
 state._afterCombatResult='ambush';
 render();
}


function getAttackThreatConfig(){
 const cfg=gameData.config?.events?.attackThreats;
 return (cfg&&typeof cfg==='object'&&!Array.isArray(cfg)) ? cfg : {};
}


function shouldRespectAttackThreatBlock(){
 return getAttackThreatConfig().respectBlockingEventFlag !== false;
}


function shouldPreventNewAttackThreatIfActive(){
 return getAttackThreatConfig().preventNewThreatIfOneIsActive !== false;
}


function getThreatCatalog(){
 const raw=gameData.threats;
 if(Array.isArray(raw)) return raw.filter(Boolean);
 if(raw&&Array.isArray(raw.threats)) return raw.threats.filter(Boolean);
 return [];
}


function getThreatDef(threatId){
 return getThreatCatalog().find(th=>String(th.id)===String(threatId))||null;
}


function getThreatConfig(){
 const cfg=gameData.config?.threats;
 return (cfg&&typeof cfg==='object'&&!Array.isArray(cfg)) ? cfg : {};
}


function getThreatCooldownConfig(){
 const cfg=getThreatConfig().cooldownOnResolve;
 return (cfg&&typeof cfg==='object'&&!Array.isArray(cfg)) ? cfg : {};
}


function ensureThreatCooldownStore(){
 if(!state.threatCooldowns||typeof state.threatCooldowns!=='object'||Array.isArray(state.threatCooldowns)) state.threatCooldowns={};
 return state.threatCooldowns;
}


function getThreatCooldownEntry(templateId){
 if(!templateId) return null;
 const store=ensureThreatCooldownStore();
 const entry=store[String(templateId)];
 if(!entry) return null;
 const readyDay=Math.max(0, Number(entry.readyDay||0) || 0);
 if(!readyDay) return null;
 return {...entry, readyDay};
}


function getThreatCooldownReadyDay(templateId){
 return Number(getThreatCooldownEntry(templateId)?.readyDay||0);
}


function getThreatCooldownDaysRemaining(templateId){
 const readyDay=getThreatCooldownReadyDay(templateId);
 return readyDay>state.day ? (readyDay-state.day) : 0;
}


function isThreatTemplateOnCooldown(templateId){
 return getThreatCooldownDaysRemaining(templateId)>0;
}


function clearThreatCooldown(templateId){
 if(!templateId) return;
 const store=ensureThreatCooldownStore();
 delete store[String(templateId)];
}


function getThreatResolveCooldownRange(threatOrDef){
 const def=threatOrDef?.templateId ? getThreatDef(threatOrDef.templateId) : threatOrDef;
 const cfg=getThreatCooldownConfig();
 if(cfg.enabled===false) return [0,0];
 const spawn=def?.spawn||{};
 let min=Number(spawn.cooldownOnResolveMinDays ?? cfg.defaultMinDays ?? 7);
 let max=Number(spawn.cooldownOnResolveMaxDays ?? cfg.defaultMaxDays ?? 10);
 if(!Number.isFinite(min)) min=0;
 if(!Number.isFinite(max)) max=min;
 min=Math.max(0, Math.round(min));
 max=Math.max(0, Math.round(max));
 if(max<min) [min,max]=[max,min];
 return [min,max];
}


function applyThreatResolveCooldown(threat){
 const def=threat?.templateId ? getThreatDef(threat.templateId) : threat;
 if(!def?.id) return 0;
 const [min,max]=getThreatResolveCooldownRange(def);
 if(max<=0){
  clearThreatCooldown(def.id);
  return 0;
 }
 const delay=roll(min,max);
 const readyDay=state.day + Math.max(1, delay);
 ensureThreatCooldownStore()[String(def.id)]={readyDay, delay, resolvedDay:Number(state.day||0)};
 return delay;
}


function getThreatEligibilityState(def, options={}){
 if(!def||def.enabled===false) return {ok:false, reason:'disabled', cooldown:false, readyDay:0};
 const spawn=def.spawn||{};
 const minDay=Number(spawn.minDay ?? 1) || 1;
 const maxDay=Number(spawn.maxDay ?? 999) || 999;
 if(state.day<minDay||state.day>maxDay) return {ok:false, reason:'day', cooldown:false, readyDay:0};
 if(spawn.requiresBuilding && !buildingIsReady(spawn.requiresBuilding)) return {ok:false, reason:'building', cooldown:false, readyDay:0};
 const maxActive=Math.max(1, Number(spawn.maxActiveInstances ?? 1) || 1);
 if(getThreatTemplateActiveCount(def.id)>=maxActive) return {ok:false, reason:'maxActive', cooldown:false, readyDay:0};
 const readyDay=getThreatCooldownReadyDay(def.id);
 if(!options.ignoreCooldown && readyDay>state.day) return {ok:false, reason:'cooldown', cooldown:true, readyDay};
 return {ok:true, reason:'ok', cooldown:false, readyDay};
}


function getNearestCooldownThreatFallback(){
 const allowFallback=getThreatCooldownConfig().fallbackToNearestExpiryWhenAllCoolingDown !== false;
 if(!allowFallback) return null;
 const cooling=getThreatCatalog()
 .map(def=>({def, state:getThreatEligibilityState(def), base:getThreatEligibilityState(def,{ignoreCooldown:true})}))
 .filter(entry=>entry.base.ok && entry.state.reason==='cooldown' && entry.state.readyDay>state.day)
 .sort((a,b)=>{
  const byDay=Number(a.state.readyDay||0)-Number(b.state.readyDay||0);
  if(byDay) return byDay;
  return Math.max(1, Number(b.def?.spawn?.weight||1)||1)-Math.max(1, Number(a.def?.spawn?.weight||1)||1);
 });
 return cooling[0]?.def || null;
}


function getThreatSpawnChance(){
 const configured=Number(gameData.config?.threats?.dailySpawnChance ?? gameData.config?.threats?.spawnChance ?? 0.35);
 return Math.max(0, Math.min(1, configured||0));
}


function getThreatDaysToEscalate(threat){
 const def=getThreatDef(threat?.templateId);
 return Math.max(1, Number(threat?.daysToEscalate ?? def?.instance?.daysToEscalate ?? 2) || 2);
}


function getThreatMaxSeverity(threat){
 const def=getThreatDef(threat?.templateId);
 return Math.max(1, Number(threat?.maxSeverity ?? def?.instance?.maxSeverity ?? 3) || 3);
}


function getThreatCurrentPassiveEffects(threat){
 const def=getThreatDef(threat?.templateId);
 if(!def) return [];
 const block=def.passiveEffectsBySeverity?.[String(threat.severity)] ?? def.passiveEffectsBySeverity?.[threat.severity] ?? [];
 return Array.isArray(block)?block:[];
}


function getThreatEscalationEffects(threat,nextSeverity){
 const def=getThreatDef(threat?.templateId);
 if(!def) return [];
 const block=def.onEscalateBySeverity?.[String(nextSeverity)] ?? def.onEscalateBySeverity?.[nextSeverity] ?? [];
 return Array.isArray(block)?block:[];
}


function getThreatOnResolveEffects(threat){
 const def=getThreatDef(threat?.templateId);
 return Array.isArray(def?.onResolve)?def.onResolve:[];
}


function getThreatOnMaxSeverityEffects(threat){
 const def=getThreatDef(threat?.templateId);
 return Array.isArray(def?.onMaxSeverity)?def.onMaxSeverity:[];
}


function getThreatAction(threat, actionId){
 const def=getThreatDef(threat?.templateId);
 return (def?.actions||[]).find(action=>String(action.id)===String(actionId))||null;
}


function getThreatTemplateActiveCount(templateId){
 return (state.activeThreats||[]).filter(th=>String(th.templateId)===String(templateId) && !th.resolved).length;
}


function isThreatEligibleByRequirements(def, options={}){
 return getThreatEligibilityState(def, options).ok;
}


function buildThreatInstance(def, overrides={}){
 const instance=def?.instance||{};
 const initialSeverity=Math.max(1, Number(overrides.severity ?? instance.initialSeverity ?? 1) || 1);
 const maxSeverity=Math.max(initialSeverity, Number(instance.maxSeverity ?? 3) || 3);
 const daysToEscalate=Math.max(1, Number(overrides.daysToEscalate ?? instance.daysToEscalate ?? 2) || 2);
 return {
 instanceId: overrides.instanceId || `threat_${Date.now()}_${Math.floor(Math.random()*100000)}`,
 templateId: def.id,
 severity: Math.min(initialSeverity, maxSeverity),
 maxSeverity,
 daysToEscalate,
 daysUntilEscalation: Math.max(1, Number(overrides.daysUntilEscalation ?? daysToEscalate) || daysToEscalate),
 daysActive: Math.max(0, Number(overrides.daysActive ?? 0) || 0),
 createdDay: Number(overrides.createdDay ?? state.day),
 source: overrides.source || 'system',
 maxSeverityTriggered: !!overrides.maxSeverityTriggered,
 resolved: false
 };
}


function spawnThreatInstance(threatId, options={}){
 const def=typeof threatId==='object' ? threatId : getThreatDef(threatId);
 if(!def) return null;
 if(!options.force && !isThreatEligibleByRequirements(def)) return null;
 if(!options.force && getFreeThreatSlotsCount()<=0){
  redirectOverflowThreatPressure('⚠ ');
  return null;
 }
 clearThreatCooldown(def.id);
 const instance=buildThreatInstance(def, options);
 if(!Array.isArray(state.activeThreats)) state.activeThreats=[];
 state.activeThreats.push(instance);
 if(options.silent!==true){
  addLog(`\u2623 Nueva amenaza: ${def.name}. ${def.description||''}`.trim());
 }
 return instance;
}


function resolveThreatInstance(threat, options={}){
 if(!threat||threat.resolved) return;
 threat.resolved=true;
 if(options.applyCooldown!==false) applyThreatResolveCooldown(threat);
 if(options.applyResolveEffects!==false){
  applyThreatEffectList(getThreatOnResolveEffects(threat), {threat, silentLogs:false});
 }
 if(options.log!==false) addLog(`✅ Amenaza resuelta: ${getThreatDisplayName(threat)}.`);
 state.activeThreats=(state.activeThreats||[]).filter(item=>item&&item.instanceId!==threat.instanceId);
}


function getThreatDisplayName(threat){
 const def=getThreatDef(threat?.templateId);
 return def?.name || threat?.name || 'Amenaza';
}


function getThreatDescription(threat){
 const def=getThreatDef(threat?.templateId);
 return def?.description || '';
}


function getThreatImage(threat){
 const def=getThreatDef(threat?.templateId);
 return def?.image || '';
}


function getThreatSeverityText(threat){
 return `Nivel ${Number(threat?.severity||1)}`;
}


function getThreatActionAvailableSurvivors(){
 return state.survivors.filter(s=>s&&s.status==='activo'&&!s.action&&!isExteriorSurvivor(s)&&!hasActiveInjury(s)&&!hasLowMoraleRestRestriction(s)&&Number(s.fatigue||0)>0);
}


function getThreatActionRequiredSkill(action){
 return String(action?.requirements?.requiredSkill || action?.requirements?.survivorSkill || '').trim().toLowerCase();
}


function getThreatActionRequiredSkillLabel(action){
 const skill=getThreatActionRequiredSkill(action);
 if(!skill) return '';
 const raw=getSurvivorSkillLabel({skill});
 return String(raw||skill).replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/,'').split('—')[0].trim() || skill;
}


function getThreatActionSurvivorMinMorale(action){
 return Math.max(0, Number(action?.requirements?.survivorMinMorale ?? action?.requirements?.minSurvivorMorale ?? 0) || 0);
}


function evaluateThreatActionSurvivorRequirements(survivor, action){
 const blockers=[];
 const requiredSkill=getThreatActionRequiredSkill(action);
 const minMorale=getThreatActionSurvivorMinMorale(action);
 if(requiredSkill && !survivorHasSkill(survivor, requiredSkill)) blockers.push(`Habilidad: ${getThreatActionRequiredSkillLabel(action)}`);
 if(minMorale>0 && Number(survivor?.morale||0)<minMorale) blockers.push(`Moral >= ${minMorale}`);
 return {ok:blockers.length===0, blockers};
}


function getThreatActionValidSurvivors(action){
 if(!action?.requirements?.survivorAvailable) return [];
 return getThreatActionAvailableSurvivors().filter(s=>evaluateThreatActionSurvivorRequirements(s, action).ok);
}


function getThreatActionSurvivorOptionLabel(survivor){
 const moraleInfo=getMoraleStateInfo(survivor);
 const skills=getSurvivorSkills(survivor).slice(0,2).map(skill=>getSurvivorSkillLabel({skill}).replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/,'').split('—')[0].trim()).filter(Boolean);
 const skillText=skills.length ? ` · ${skills.join(', ')}` : '';
 return `${survivor.name} · Moral ${moraleInfo.short} · Fatiga ${Number(survivor.fatigue||0)}${skillText}`;
}


function evaluateThreatActionRequirements(threat, action, actorId=''){
 const requirements=action?.requirements||{};
 const blockers=[];
 const availableSurvivors=requirements.survivorAvailable ? getThreatActionValidSurvivors(action) : [];
 if(requirements.survivorAvailable && !availableSurvivors.length){
 const baseCandidates=getThreatActionAvailableSurvivors();
 if(!baseCandidates.length) blockers.push('Sin supervivientes disponibles');
 else {
 if(getThreatActionRequiredSkill(action)) blockers.push(`Requiere ${getThreatActionRequiredSkillLabel(action)}`);
 if(getThreatActionSurvivorMinMorale(action)>0) blockers.push(`Requiere superviviente con moral >= ${getThreatActionSurvivorMinMorale(action)}`);
 if(blockers.length===0) blockers.push('Ningún superviviente válido');
 }
 }
 if(Number(requirements.minDefense||0)>0 && getSettlementDefenseValue()<Number(requirements.minDefense||0)) blockers.push(`Defensa < ${requirements.minDefense}`);
 if(Number(requirements.minStability||0)>0 && Number(state.stability||0)<Number(requirements.minStability||0)) blockers.push(`Estabilidad < ${requirements.minStability}`);
 if(Number(requirements.minMorale||0)>0 && getAverageMorale()<Number(requirements.minMorale||0)) blockers.push(`Moral media < ${requirements.minMorale}`);
 const buildingReq=requirements.requiresBuilding || requirements.requiredBuilding || requirements.building;
 if(buildingReq && !buildingIsReady(buildingReq)) blockers.push(`Requiere ${formatBuildingRequirement(buildingReq)}`);
 const resourceReq=requirements.resource||{};
 Object.entries(resourceReq).forEach(([resource, need])=>{
 const key=normalizeResourceKey(resource);
 const have=getStateResourceValue(key);
 if(have<Number(need||0)) blockers.push(`Falta ${Number(need||0)-have} ${resourceLabel(key)}`);
 });
 let selectedActor=null;
 if(requirements.survivorAvailable && actorId){
 selectedActor=availableSurvivors.find(s=>String(s.id)===String(actorId))||null;
 if(!selectedActor) blockers.push('El superviviente elegido ya no es válido');
 }
 return {ok:blockers.length===0, blockers, availableSurvivors, selectedActor};
}


function getThreatBuildingOutputModifier(buildingId, resource){
 const passive=(state.activeThreats||[]).reduce((sum,threat)=>{
 if(!threat||threat.resolved) return sum;
 const effects=getThreatCurrentPassiveEffects(threat);
 return sum + effects.reduce((inner,effect)=>{
 if(!effect||effect.type!=='building_output_modifier') return inner;
 if(String(effect.building)!==String(buildingId)) return inner;
 if(normalizeResourceKey(effect.resource)!==normalizeResourceKey(resource)) return inner;
 return inner + Number(effect.amount||0);
 },0);
 },0);
 return passive + getOneDayOutputModifier(buildingId, resource);
}


function applyThreatEffect(effect, context={}){
 if(!effect||!effect.type) return false;
 const threat=context.threat||null;
 const actor=context.actor||null;
 const delayed=!!context.delayed;
 switch(String(effect.type)){
 case 'resource_delta':{
 const key=normalizeResourceKey(effect.resource);
 const amount=Number(effect.amount||0);
 if(key==='morale'){
 aliveSurvivors().forEach(s=>adjustSurvivorMorale(s, amount));
 addLog(`${delayed?'[Retrasado] ':''}${amount>=0?'😊':'😞'} Moral de todos ${amount>=0?'+':''}${amount}.`);
 }else if(key==='stability'){
 state.stability=Math.max(0, Math.min(10, Number(state.stability||0)+amount));
 addLog(`${delayed?'[Retrasado] ':''}🏛 Estabilidad ${amount>=0?'+':''}${amount}.`);
 }else if(typeof state[key]==='number'){
 if(amount<0) state[key]=Math.max(0, Number(state[key]||0)+amount);
 else state[key]=Number(state[key]||0)+amount;
 addLog(`${delayed?'[Retrasado] ':''}${resourceLabel(key)} ${amount>=0?'+':''}${amount}.`);
 }
 return true;
 }
 case 'morale_delta':
 return applyThreatEffect({type:'resource_delta', resource:'morale', amount:Number(effect.amount||0)}, context);
 case 'stability_delta':
 return applyThreatEffect({type:'resource_delta', resource:'stability', amount:Number(effect.amount||0)}, context);
 case 'fatigue_all_delta':{
 const amount=Number(effect.amount||0);
 aliveSurvivors().forEach(s=>{ s.fatigue=Math.max(0, Math.min(s.maxFatigue??3, Number(s.fatigue||0)+amount)); });
 addLog(`${delayed?'[Retrasado] ':''}⚡ Fatiga de todos ${amount>=0?'+':''}${amount}.`);
 return true;
 }
 case 'fatigue_random_available':{
 const amount=Math.max(0, Number(effect.amount||1)||1);
 const target=actor || pick(getThreatActionAvailableSurvivors());
 if(!target) return false;
 target.fatigue=Math.max(0, Math.min(target.maxFatigue??3, Number(target.fatigue||0)-amount));
 addLog(`⚡ ${target.name} gasta ${amount} fatiga atendiendo ${getThreatDisplayName(threat)}.`);
 return true;
 }
 case 'random_injury':{
 const chance=Math.max(0, Math.min(1, Number(effect.chance ?? 100)/100));
 if(Math.random()>=chance) return false;
 const target=pick(aliveSurvivors());
 if(!target) return false;
 injureSurvivor(target,`${target.name} resulta {injuryLabel} por ${getThreatDisplayName(threat).toLowerCase()}.`,{source:'threat',level:effect.severity||effect.injuryLevel||'simple'});
 return true;
 }
 case 'disable_building':{
 const buildingId=String(effect.building||'');
 const days=Math.max(1, Number(effect.days||1) || 1);
 const building=state.buildings?.[buildingId];
 if(!building||!building.built) return false;
 if(!state.buildingDisableTimers||typeof state.buildingDisableTimers!=='object') state.buildingDisableTimers={};
 state.buildingDisableTimers[buildingId]=Math.max(Number(state.buildingDisableTimers[buildingId]||0), state.day+days);
 building.active=false;
 addLog(`🏚 ${building.name} queda inhabilitado ${days} día${days!==1?'s':''}.`);
 return true;
 }
 case 'building_output_modifier':{
 pushOneDayOutputModifier(effect, threat);
 const building=state.buildings?.[String(effect.building||'')];
 addLog(`🌾 ${building?.name||effect.building||'Edificio'} modificará su producción ${Number(effect.amount||0)>=0?'+':''}${Number(effect.amount||0)} ${resourceLabel(normalizeResourceKey(effect.resource||''))} este día.`);
 return true;
 }
 case 'trigger_attack':{
 applyEffect({type:'setAttackThreat', hostileType:effect.attackType||effect.hostileType||effect.hostile||'raiders', hostileVariant:effect.hostileVariant||effect.variant||'random', arrivalDays:Number(effect.arrivalDays||0)||0}, delayed);
 return true;
 }
 case 'threat_reduce_severity':{
 if(!threat) return false;
 threat.severity=Math.max(0, Number(threat.severity||1)-Math.max(1, Number(effect.amount||1)||1));
 if(threat.severity<=0){
 resolveThreatInstance(threat, {applyResolveEffects:true, log:false});
 }else{
 threat.maxSeverityTriggered = Number(threat.severity||0) >= getThreatMaxSeverity(threat) ? threat.maxSeverityTriggered : false;
 addLog(`\u2623 ${getThreatDisplayName(threat)} baja a ${getThreatSeverityText(threat)}.`);
 }
 return true;
 }
 case 'threat_remove':{
 if(!threat) return false;
 resolveThreatInstance(threat, {applyResolveEffects:true, log:false});
 return true;
 }
 case 'reset_escalation_timer':{
 if(!threat) return false;
 threat.daysUntilEscalation=getThreatDaysToEscalate(threat);
 return true;
 }
 case 'log':{
 if(effect.text) addLog(`${delayed?'[Retrasado] ':''}${effect.text}`);
 return true;
 }
 }
 return false;
}


function applyThreatEffectList(effects, context={}){
 (effects||[]).forEach(effect=>applyThreatEffect(effect, context));
}


function maybeSpawnDailyThreat(){
 if(getFreeThreatSlotsCount()<=0) return null;
 const pool=getThreatCatalog().filter(def=>isThreatEligibleByRequirements(def)).map(def=>({...def,_weight:Math.max(1, Number(def?.spawn?.weight||1)||1)}));
 if(pool.length){
  if(Math.random()>=getThreatSpawnChance()) return null;
  const picked=weightedPickField(pool,'_weight');
  return picked ? spawnThreatInstance(picked, {source:'daily'}) : null;
 }
 const fallback=getNearestCooldownThreatFallback();
 return fallback ? spawnThreatInstance(fallback, {source:'cooldown_fallback'}) : null;
}


function processActiveThreatsEndOfDay(){
 const threats=[...(state.activeThreats||[])];
 threats.forEach(threat=>{
 if(!threat||threat.resolved) return;
 const passiveEffects=getThreatCurrentPassiveEffects(threat).filter(effect=>effect&&effect.type!=='building_output_modifier');
 if(passiveEffects.length) applyThreatEffectList(passiveEffects, {threat, delayed:false});
 threat.daysActive=Number(threat.daysActive||0)+1;
 threat.daysUntilEscalation=Math.max(0, Number(threat.daysUntilEscalation||getThreatDaysToEscalate(threat))-1);
 if(threat.daysUntilEscalation<=0){
 if(Number(threat.severity||1) < getThreatMaxSeverity(threat)){
 threat.severity=Math.min(getThreatMaxSeverity(threat), Number(threat.severity||1)+1);
 threat.daysUntilEscalation=getThreatDaysToEscalate(threat);
 addLog(`\u2623 ${getThreatDisplayName(threat)} empeora a ${getThreatSeverityText(threat)}.`);
 applyThreatEffectList(getThreatEscalationEffects(threat, threat.severity), {threat, delayed:false});
 }
 if(Number(threat.severity||1) >= getThreatMaxSeverity(threat) && !threat.maxSeverityTriggered){
 threat.maxSeverityTriggered=true;
 addLog(`\u2623 ${getThreatDisplayName(threat)} alcanza su punto crítico.`);
 applyThreatEffectList(getThreatOnMaxSeverityEffects(threat), {threat, delayed:false});
 }
 }
 });
 state.activeThreats=(state.activeThreats||[]).filter(threat=>threat&&!threat.resolved);
 maybeSpawnDailyThreat();
}


function normalizeThreatFacilitatorType(value){
 return String(value||'').trim().toLowerCase();
}


function getThreatActionFacilitators(action){
 return Array.isArray(action?.facilitators) ? action.facilitators.filter(Boolean) : [];
}


function getThreatFacilitatorBonusValue(facilitator){
 return Math.max(0, Number(facilitator?.bonus ?? facilitator?.bonusPercent ?? facilitator?.chanceBonus ?? 0) || 0);
}


function getThreatFacilitatorBuildingRequirement(facilitator){
 const buildingId=String(facilitator?.buildingId || facilitator?.building || facilitator?.id || '').trim();
 if(!buildingId) return null;
 return {id: buildingId, minLevel: Math.max(1, Number(facilitator?.minLevel ?? facilitator?.level ?? 1) || 1)};
}


function getThreatFacilitatorMatchingEquippedItems(actor, facilitator){
 if(!actor) return [];
 const equipped=getEquippedItems(actor);
 const requiredId=String(facilitator?.itemId||'').trim();
 const requiredTag=String(facilitator?.itemTag || facilitator?.tag || '').trim().toLowerCase();
 return equipped.filter(item=>{
  const it=materializeItem(item);
  if(requiredId && String(it.itemId||it.id)!==requiredId) return false;
  if(!requiredTag) return true;
  const tags=new Set([
   String(it.itemType||'').toLowerCase(),
   String(it.type||'').toLowerCase(),
   String(it.category||'').toLowerCase(),
   String(it.subtype||'').toLowerCase(),
   ...((Array.isArray(it.tags)?it.tags:[]).map(tag=>String(tag).toLowerCase()))
  ].filter(Boolean));
  if(requiredTag==='weapon') return it.itemType==='weapon' || tags.has('weapon');
  return tags.has(requiredTag);
 });
}


function describeThreatFacilitator(facilitator){
 const type=normalizeThreatFacilitatorType(facilitator?.type);
 const bonus=getThreatFacilitatorBonusValue(facilitator);
 if(type==='equipped_item_tag'){
  const rawTag=String(facilitator?.itemTag || facilitator?.tag || '').trim().toLowerCase();
  const label=facilitator?.itemId ? `objeto equipado: ${facilitator.itemId}` : (rawTag==='weapon' ? 'arma equipada' : `${rawTag||'objeto'} equipado`);
  return `${label}${bonus?` +${bonus}%`:''}`;
 }
 if(type==='survivor_skill'){
  const skill=String(facilitator?.skill || facilitator?.skillId || facilitator?.survivorSkill || '').trim().toLowerCase();
  const label=getThreatActionRequiredSkillLabel({requirements:{requiredSkill:skill}}) || skill || 'habilidad';
  return `${label}${bonus?` +${bonus}%`:''}`;
 }
 if(type==='building_level'){
  const req=getThreatFacilitatorBuildingRequirement(facilitator);
  const label=req ? formatBuildingRequirement(req) : 'edificio';
  return `${label}${bonus?` +${bonus}%`:''}`;
 }
 return '';
}


function getThreatActionFacilitatorState(action, actor=null){
 const available=[];
 const applied=[];
 let totalBonus=0;
 getThreatActionFacilitators(action).forEach(facilitator=>{
  const type=normalizeThreatFacilitatorType(facilitator?.type);
  const bonus=getThreatFacilitatorBonusValue(facilitator);
  const desc=describeThreatFacilitator(facilitator);
  if(desc) available.push(desc);
  let enabled=false;
  if(type==='equipped_item_tag'){
   enabled=!!getThreatFacilitatorMatchingEquippedItems(actor, facilitator).length;
  }else if(type==='survivor_skill'){
   const skill=String(facilitator?.skill || facilitator?.skillId || facilitator?.survivorSkill || '').trim().toLowerCase();
   enabled=!!(actor && skill && survivorHasSkill(actor, skill));
  }else if(type==='building_level'){
   const req=getThreatFacilitatorBuildingRequirement(facilitator);
   enabled=!!(req && buildingIsReady(req));
  }
  if(enabled && bonus>0){
   totalBonus+=bonus;
   if(desc) applied.push(desc);
  }
 });
 return {totalBonus, applied, available};
}

function formatThreatFacilitatorsForLog(applied){
 return (Array.isArray(applied)?applied:[]).map((desc, index)=>{
  const text=String(desc||'').trim();
  if(!text) return '';
  const match=text.match(/^(.*?)(\s+\+\d+%.*)?$/);
  const label=(match?.[1]||text).trim();
  const bonus=match?.[2]||'';
  const prefix=index===0 ? 'Facilitadores: ' : '';
  return `<span class="log-facilitator">${prefix}${label}</span>${bonus}`;
 }).filter(Boolean).join(', ');
}


function getThreatActionSummary(action){
 const bits=[];
 if(action?.requirements?.resource){
 Object.entries(action.requirements.resource).forEach(([resource, amount])=>bits.push(`Req. ${amount} ${resourceLabel(normalizeResourceKey(resource))}`));
 }
 if(action?.requirements?.survivorAvailable) bits.push('Usa 1 superviviente válido');
 if(getThreatActionRequiredSkill(action)) bits.push(`Habilidad: ${getThreatActionRequiredSkillLabel(action)}`);
 if(getThreatActionSurvivorMinMorale(action)>0) bits.push(`Moral surv. >= ${getThreatActionSurvivorMinMorale(action)}`);
 const costs=Array.isArray(action?.costs)?action.costs:[];
 costs.forEach(cost=>{
 if(cost.type==='resource_delta'&&Number(cost.amount||0)<0) bits.push(`Coste ${Math.abs(Number(cost.amount||0))} ${resourceLabel(normalizeResourceKey(cost.resource))}`);
 if(cost.type==='fatigue_random_available') bits.push(`Coste ${Math.max(1, Number(cost.amount||1)||1)} fatiga`);
 });
 const facilitatorState=getThreatActionFacilitatorState(action, null);
 if(facilitatorState.available.length) bits.push(`Facilita: ${facilitatorState.available.join(', ')}`);
 if(Number(action?.success?.chance||0)>0) bits.push(`Éxito ${Number(action.success.chance||0)}%`);
 return bits.join(' · ');
}


function describeThreatPassiveEffects(threat){
 const effects=getThreatCurrentPassiveEffects(threat);
 if(!effects.length) return 'Sin efectos pasivos.';
 return effects.map(effect=>{
 if(effect.type==='stability_delta') return `${Number(effect.amount||0)>=0?'+':''}${Number(effect.amount||0)} estabilidad/día`;
 if(effect.type==='morale_delta') return `${Number(effect.amount||0)>=0?'+':''}${Number(effect.amount||0)} moral/día`;
 if(effect.type==='fatigue_all_delta') return `${Number(effect.amount||0)>=0?'+':''}${Number(effect.amount||0)} fatiga a todos`;
 if(effect.type==='random_injury') return `${Number(effect.chance||0)}% herida ${effect.severity||'simple'}`;
 if(effect.type==='building_output_modifier') return `${effect.building}: ${Number(effect.amount||0)>=0?'+':''}${Number(effect.amount||0)} ${resourceLabel(normalizeResourceKey(effect.resource))}`;
 return effect.type;
 }).join(' · ');
}


function getAttackThreatUrgencyMeta(){
 const daysLeft=Math.max(0, Number(state.attackArrivalDay||state.day)-Number(state.day||1));
 const urgency=daysLeft<=0?'var(--danger-bright)':daysLeft===1?'var(--warn-bright)':'var(--amber-bright)';
 const text=daysLeft<=0?'\u00a1ATAQUE INMINENTE!':`Llega en ${daysLeft} d\u00eda${daysLeft!==1?'s':''}`;
 return {daysLeft, urgency, text};
}


function renderThreats(){
 const wrap=document.getElementById('threatsPanelWrap');
 const list=document.getElementById('threatsList');
 if(!wrap||!list) return;

 const threats=(state.activeThreats||[]).filter(threat=>threat&&!threat.resolved);
 const cards=[];

 if(state.attackThreat){
 const urgencyMeta=getAttackThreatUrgencyMeta();
 const hostileIcon=String(state.attackHostileIcon||'\u2694').trim()||'\u2694';
 const hasAtalayaIntel=typeof canUseAtalayaBinoculars==='function'&&canUseAtalayaBinoculars();
 cards.push(`<button type="button" class="threat-card-preview attack" data-threat-open="attack">
 <div class="threat-preview-top">
 <div class="threat-preview-title attack">${escapeHtml(hostileIcon)} ${escapeHtml(state.attackHostileLabel||'Amenaza de ataque')}</div>
 ${hasAtalayaIntel?`<div class="threat-preview-badge attack">Fuerza ${Number(state.attackStrength||0)}</div>`:''}
 </div>
 <div class="threat-preview-desc">Una amenaza hostil est\u00e1 en camino al asentamiento. Haz clic para ver qu\u00e9 debes hacer.</div>
 <div class="threat-preview-escalation" style="color:${urgencyMeta.urgency};">${escapeHtml(urgencyMeta.text)}</div>
 </button>`);
 }

 threats.forEach(threat=>{
 const escalationDays=Math.max(0, Number(threat.daysUntilEscalation||0));
 const escalationText=Number(threat.severity||0)>=getThreatMaxSeverity(threat) ? 'Punto crítico' : `Escala en ${escalationDays} día${escalationDays!==1?'s':''}`;
 cards.push(`<button type="button" class="threat-card-preview" data-threat-open="persistent" data-threat-id="${escapeAttr(threat.instanceId)}">
 <div class="threat-preview-top">
 <div class="threat-preview-title">${escapeHtml(getThreatDisplayName(threat))}</div>
 <div class="threat-preview-badge">${escapeHtml(getThreatSeverityText(threat))}</div>
 </div>
 <div class="threat-preview-desc">${escapeHtml(getThreatDescription(threat))}</div>
 <div class="threat-preview-meta">${escapeHtml(describeThreatPassiveEffects(threat))}</div>
 <div class="threat-preview-escalation">${escapeHtml(escalationText)}</div>
 </button>`);
 });

 wrap.style.display='block';
 list.innerHTML=cards.length
 ? cards.join('')
 : `<div style="border:1px dashed var(--line2);background:rgba(0,0,0,0.18);padding:12px;font-size:11px;color:var(--muted);line-height:1.6;">Sin amenazas activas.</div>`;

 list.querySelectorAll('[data-threat-open]').forEach(btn=>{
 btn.addEventListener('click',()=>openThreatDecisionPopup(btn.dataset.threatOpen, btn.dataset.threatId||''));
 });
}


function executeThreatAction(instanceId, actionId, actorId=''){
 const threat=(state.activeThreats||[]).find(item=>String(item.instanceId)===String(instanceId));
 if(!threat) return;
 const action=getThreatAction(threat, actionId);
 if(!action) return;
 const requirementState=evaluateThreatActionRequirements(threat, action, actorId);
 if(!requirementState.ok){
  addLog(`\u2623 No puedes actuar contra ${getThreatDisplayName(threat)}: ${requirementState.blockers.join(', ')}.`);
  render();
  return;
 }
 const actor=action?.requirements?.survivorAvailable ? (requirementState.selectedActor || null) : null;
 if(action?.requirements?.survivorAvailable && !actor){
  addLog(`\u2623 Debes elegir un superviviente v\u00e1lido para actuar contra ${getThreatDisplayName(threat)}.`);
  render();
  return;
 }
 if(actor){
  actor.status='ocupado';
  actor.action={type:'amenaza', target:threat.instanceId};
 }
 applyThreatEffectList(action.costs||[], {threat, actor});
 const baseChance=Math.max(0, Math.min(100, Number(action?.success?.chance ?? 100) || 100));
 const facilitatorState=getThreatActionFacilitatorState(action, actor);
 const resolutivoBonus=Math.max(0, Number(actor ? (getSkillBonus(actor,'threat_action').chanceBonus||0) : 0) || 0);
 const chance=Math.max(0, Math.min(100, baseChance + facilitatorState.totalBonus + resolutivoBonus));
 const success=Math.random()*100 < chance;
 const skillBits=[];
 if(facilitatorState.applied.length) skillBits.push(`${formatThreatFacilitatorsForLog(facilitatorState.applied)}.`);
 if(resolutivoBonus>0) skillBits.push(`Resolutivo +${resolutivoBonus}%.`);
 addLog(`${actor?actor.name:'El asentamiento'} intenta ${action.label.toLowerCase()} frente a ${getThreatDisplayName(threat)}.${skillBits.length?` ${skillBits.join(' ')}`:''} (${chance}% de éxito)`);
 if(success){
  applyThreatEffectList(action?.success?.effects||[], {threat, actor});
  if(!threat.resolved) addLog(`👍 Amenaza superada: la acción contra ${getThreatDisplayName(threat)} tiene éxito.`);
 }else{
  applyThreatEffectList(action?.failure?.effects||[], {threat, actor});
  if(!threat.resolved) addLog(`👎 Amenaza fallida: la acción contra ${getThreatDisplayName(threat)} falla.`);
 }
 state.activeThreats=(state.activeThreats||[]).filter(item=>item&&!item.resolved);
 closeThreatDecisionPopup();
 render();
}



function getThreatSlotLimit(){
 return Math.max(1, Number(getThreatConfig().slotLimit ?? 3) || 3);
}


function getPersistentThreatCount(){
 return Array.isArray(state.activeThreats)
 ? state.activeThreats.filter(th=>th&&!th.resolved).length
 : 0;
}


function getActiveThreatSlotsCount(){
 return getPersistentThreatCount() + (state.attackThreat ? 1 : 0);
}


function getFreeThreatSlotsCount(){
 return Math.max(0, getThreatSlotLimit() - getActiveThreatSlotsCount());
}


function schemaContainsAnyThreatPressure(schema){
 const seen=new Set();
 const scan=(node)=>{
 if(!node) return false;
 if(Array.isArray(node)) return node.some(scan);
 if(typeof node!=='object') return false;
 if(seen.has(node)) return false;
 seen.add(node);
 if(['setAttackThreat','createThreat','addThreat','spawnThreat'].includes(node.type)) return true;
 if(scan(node.effects)) return true;
 if(scan(node.randomEffects)) return true;
 if(scan(node.effectOnVictory)) return true;
 if(scan(node.effectOnDefeat)) return true;
 if(scan(node.delayed)) return true;
 if(node.options){
 const values=Array.isArray(node.options)?node.options:Object.values(node.options);
 if(scan(values)) return true;
 }
 return false;
 };
 return scan(schema);
}


function redirectOverflowThreatPressure(messagePrefix=''){
 const active=Array.isArray(state.activeThreats)
 ? state.activeThreats.filter(th=>th&&!th.resolved)
 : [];
 if(active.length){
 active.sort((a,b)=>{
 const sev=(Number(b.severity||1)-Number(a.severity||1));
 if(sev) return sev;
 return Number(a.daysUntilEscalation||99)-Number(b.daysUntilEscalation||99);
 });
 const target=active[0];
 const name=getThreatDisplayName(target);
 const maxSeverity=Math.max(1, Number(target.maxSeverity||3) || 3);
 const currentSeverity=Math.max(1, Number(target.severity||1) || 1);
 if(currentSeverity<maxSeverity){
 target.severity=currentSeverity+1;
 target.daysUntilEscalation=Math.max(1, Math.min(Number(target.daysUntilEscalation||1) || 1, 1));
 addLog(`${messagePrefix}En vez de abrir un nuevo frente, empeora ${name} (nivel ${target.severity}).`);
 } else {
 target.daysUntilEscalation=Math.max(0, Math.min(Number(target.daysUntilEscalation||0) || 0, 1));
 addLog(`${messagePrefix}En vez de abrir un nuevo frente, ${name} queda a punto de escalar.`);
 }
 return true;
 }
 if(state.attackThreat){
 const extra=1;
 state.attackStrength=Math.max(1, Number(state.attackStrength)||0)+extra;
 addLog(`${messagePrefix}No cabe otra amenaza. La amenaza de ataque actual gana +${extra} fuerza.`);
 return true;
 }
 addLog(`${messagePrefix}No cabe una nueva amenaza ahora mismo.`);
 return false;
}



function schemaContainsAttackThreat(schema){
 const seen=new Set();
 const scan=(node)=>{
 if(!node) return false;
 if(Array.isArray(node)) return node.some(scan);
 if(typeof node!=='object') return false;
 if(seen.has(node)) return false;
 seen.add(node);
 if(node.type==='setAttackThreat') return true;
 if(scan(node.effects)) return true;
 if(scan(node.randomEffects)) return true;
 if(scan(node.effectOnVictory)) return true;
 if(scan(node.effectOnDefeat)) return true;
 if(scan(node.delayed)) return true;
 if(node.options){
 const values=Array.isArray(node.options)?node.options:Object.values(node.options);
 if(scan(values)) return true;
 }
 return false;
 };
 return scan(schema);
}




function resolveHostileThreat(effect={}){
 const npcCandidates=[];
 (gameData.hostiles||[]).forEach(typeDef=>{
 const typeId=typeDef?.id;
 if(!typeId) return;
 const typeIsNpc=String(typeDef?.labelType||'').toLowerCase()==='npc';
 if(typeIsNpc) npcCandidates.push({typeId, variantId:'random', typeDef, variantDef:null});
 (Array.isArray(typeDef?.variants)?typeDef.variants:[]).forEach(variant=>{
 const variantId=variant?.id||variant?.key;
 if(!variantId) return;
 const isNpc=String(variant?.labelType||'').toLowerCase()==='npc';
 if(isNpc) npcCandidates.push({typeId, variantId, typeDef, variantDef:variant});
 });
 });
 let hostileType = effect.hostileType || effect.typeId || state.attackHostileType || 'raiders';
 let forcedVariant = effect.hostileVariant || effect.variant || 'random';
 if(String(effect?.hostilePool||'').toLowerCase()==='npc'){
 const specific=String(effect?.hostileNpcId||'').trim();
 if(specific){
 const [typeId, variantId='random'] = specific.split('::');
 const match = npcCandidates.find(entry => entry.typeId===typeId && String(entry.variantId||'random')===String(variantId||'random'));
 if(match){
 hostileType=match.typeId;
 forcedVariant=match.variantId||'random';
 }
 } else if(npcCandidates.length){
 const pickedNpc=pick(npcCandidates);
 hostileType=pickedNpc.typeId;
 forcedVariant=pickedNpc.variantId||'random';
 }
 }
 if(hostileType==='random'){
 const ids=(gameData.hostiles||[]).map(h=>h.id).filter(Boolean);
 hostileType=ids.length?pick(ids):'raiders';
 }
 const typeDef=getHostileTypeDef(hostileType) || getHostileTypeDef('raiders') || null;
 if(!typeDef) return {type:'raiders', variant:'random', label:'Raiders', icon:'\u{1F480} ', strength:3, isNpc:false, preAttackEventId:null, typeDef:null, variantDef:null};
 const picked=resolveHostileVariant(typeDef, forcedVariant);
 const variantDef=picked.variantDef;
 const typeForce=Number(typeDef.force ?? typeDef.strength ?? typeDef.baseForce ?? 3);
 const variantAbsolute=Number.isFinite(Number(variantDef?.force ?? variantDef?.strength)) ? Number(variantDef.force ?? variantDef.strength) : null;
 const variantBonus=Number(variantDef?.forceBonus ?? variantDef?.variantForce ?? 0);
 const finalStrength = Math.max(1, variantAbsolute ?? (typeForce + variantBonus));
 const label = variantDef?.label || variantDef?.name || typeDef.label || typeDef.name || hostileType;
 const icon = (variantDef?.icon || typeDef.icon || '\u{1F480}') + ' ';
 const isNpc = String(variantDef?.labelType || variantDef?.label || typeDef.labelType || typeDef.label || '').toLowerCase()==='npc';
 const preAttackEventId = variantDef?.preAttackEventId || typeDef.preAttackEventId || null;
 return {
 type: hostileType,
 variant: variantDef?.id || variantDef?.key || effect.hostileVariant || 'random',
 label,
 icon,
 strength: finalStrength,
 isNpc,
 preAttackEventId,
 typeDef,
 variantDef
 };
}
