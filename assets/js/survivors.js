// Extracted survivor systems

function getMoraleTables(){
 return gameData?.config?.morale?.tables||DEFAULT_MORALE_TABLES;
}

function normalizeMoraleTableKey(value){
 const key=String(value||'A').trim().toUpperCase();
 const tables=getMoraleTables();
 return tables[key]?key:'A';
}

function clampMoraleValue(value,max=10){
 const num=Math.round(Number(value));
 if(!Number.isFinite(num)) return 0;
 return Math.max(0, Math.min(max, num));
}

function mapLegacyMoraleValue(value){
 const num=Math.max(0, Math.min(2, Math.round(Number(value)||0)));
 if(num<=0) return 3;
 if(num===1) return 7;
 return 9;
}

function getNormalizedMoraleMeta(raw={}){
 const table=normalizeMoraleTableKey(raw.moraleTable??raw.moralTable??raw.morale_profile??'A');
 const hasModernTable=!!(raw.moraleTable??raw.moralTable??raw.morale_profile);
 const rawCurrent=raw.moraleStart??raw.moralStart??raw.moralCurrent??raw.morale;
 const rawMax=Number(raw.maxMorale??raw.moralMax??10);
 const legacyLike=!hasModernTable && rawMax<=2 && Number(rawCurrent??2)<=2;
 const max=Math.max(10, clampMoraleValue(rawMax||10, 20)||10);
 const current=legacyLike
 ? mapLegacyMoraleValue(raw.moralCurrent??raw.morale??2)
 : clampMoraleValue(raw.moralCurrent??raw.morale??7, max);
 const start=legacyLike
 ? mapLegacyMoraleValue(raw.moraleStart??raw.moralStart??raw.moralCurrent??raw.morale??2)
 : clampMoraleValue(raw.moraleStart??raw.moralStart??raw.moralCurrent??raw.morale??current, max);
 return {table,current,start:start||current,max};
}

function getNormalizedMoraleState(raw={}){
 const meta=getNormalizedMoraleMeta(raw);
 return {
 moraleTable:meta.table,
 morale:meta.current,
 moraleStart:meta.start,
 maxMorale:meta.max
 };
}

function getMoraleMax(s){
 return Math.max(10, clampMoraleValue(s?.maxMorale??s?.moralMax??10, 20)||10);
}

function canIncreaseMorale(s){
 return Number(s?.morale??0) < getMoraleMax(s);
}

function getSurvivorHunger(s){
 return Math.max(0, Math.min(8, Number(s?.hunger??0)||0));
}

function setSurvivorHunger(s, value){
 if(!s) return 0;
 s.hunger=Math.max(0, Math.min(8, Number(value||0)||0));
 return s.hunger;
}

function changeSurvivorHunger(s, delta){
 return setSurvivorHunger(s, getSurvivorHunger(s)+Number(delta||0));
}

function hasSevereHunger(s){
 return getSurvivorHunger(s)>=5;
}

function getDailyMoraleGainRemaining(s){
 return Math.max(0, 1-Number(s?._moraleGainedToday||0));
}

function notePositiveMoraleDay(s){
 if(s) s._moralePositiveToday=true;
}

function getMoraleGainConditionModifier(s){
 const injured=!!(s&&hasActiveInjury(s));
 const hungry=hasSevereHunger(s);
 if(injured&&hungry) return 0;
 if(injured||hungry) return 0.5;
 return 1;
}

function adjustSurvivorMorale(s, delta){
 if(!s||s.status==='muerto') return 0;
 const current=Number(s.morale??0);
 const amount=Number(delta||0);
 if(amount>0){
 const allowed=Math.min(amount, getDailyMoraleGainRemaining(s), Math.max(0, getMoraleMax(s)-current));
 if(allowed<=0) return current;
 s.morale=clampMoraleValue(current+allowed, getMoraleMax(s));
 s._moraleGainedToday=Number(s._moraleGainedToday||0)+allowed;
 notePositiveMoraleDay(s);
 return s.morale;
 }
 s.morale=clampMoraleValue(current+amount, getMoraleMax(s));
 return s.morale;
}

function tryGainMoraleWithChance(s, baseChance, logText=''){
 if(!s||s.status==='muerto') return false;
 if(!canIncreaseMorale(s) || getDailyMoraleGainRemaining(s)<=0) return false;
 const finalChance=Math.max(0, Math.min(1, Number(baseChance||0) * getMoraleGainConditionModifier(s)));
 if(finalChance<=0) return false;
 if(Math.random()>=finalChance) return false;
 const before=Number(s.morale||0);
 const after=adjustSurvivorMorale(s,1);
 if(after>before){
 if(logText) addLog(logText);
 return true;
 }
 return false;
}
function tryGainMoraleAmountWithChance(s, baseChance, amount=1, logText=''){
 if(!s||s.status==='muerto') return false;
 const times=Math.max(1, Number(amount||1)||1);
 const finalChance=Math.max(0, Math.min(1, Number(baseChance||0) * getMoraleGainConditionModifier(s)));
 if(finalChance<=0 || Math.random()>=finalChance) return false;
 const before=Number(s.morale||0);
 const gained=Math.min(times, Math.max(0, getMoraleMax(s)-before));
 if(gained>0){
  s.morale=clampMoraleValue(before+gained, getMoraleMax(s));
  s._moraleGainedToday=Number(s._moraleGainedToday||0)+gained;
  notePositiveMoraleDay(s);
 }
 if(gained>0){
  addLog(logText || `😊 ${s.name} recupera ${gained} moral.`);
  return true;
 }
 return false;
}

function applyStartOfDayHungerAndMorale(){
 aliveSurvivors().forEach(s=>{
 if(hasSevereHunger(s)){
 adjustSurvivorMorale(s,-2);
 addLog(`🍽 ${s.name} lleva demasiado tiempo pasando hambre. -2 moral.`);
 }
 if(getMoraleStateKey(s)==='high'){
 if(s._moralePositiveToday){
 s._highMoraleDryDays=0;
 } else {
 s._highMoraleDryDays=Number(s._highMoraleDryDays||0)+1;
 if(s._highMoraleDryDays>=3){
 adjustSurvivorMorale(s,-1);
 s._highMoraleDryDays=0;
 addLog(`😐 ${s.name} no vive nada bueno desde hace días y su moral empieza a bajar.`);
 }
 }
 } else {
 s._highMoraleDryDays=0;
 }
 s._moraleGainedToday=0;
 s._moralePositiveToday=false;
 });
}

function getMoraleTableDef(s){
 const tables=getMoraleTables();
 return tables[normalizeMoraleTableKey(s?.moraleTable??s?.moralTable??'A')]||tables.A;
}

function getMoraleStateKey(s){
 const value=Number(s?.morale??0);
 const table=getMoraleTableDef(s);
 if(value>=Number(table.high?.[0]??9)) return 'high';
 if(value>=Number(table.normal?.[0]??6)) return 'normal';
 return 'low';
}

function getMoraleStateInfo(s){
 const key=getMoraleStateKey(s);
 if(key==='high') return {key,label:'Moral: Alta',short:'Alta',color:'var(--ok-bright)',emoji:'\u{1F60A}'};
 if(key==='normal') return {key,label:'Moral: Normal',short:'Normal',color:'var(--warn-bright)',emoji:'\u{1F610}'};
 return {key,label:'Moral: Baja',short:'Baja',color:'var(--danger-bright)',emoji:'\u{1F61E}'};
}

function getMoraleLabel(s, includePrefix=true){
 const info=getMoraleStateInfo(s);
 return includePrefix?info.label:info.short;
}

function getMoraleColor(s){
 return getMoraleStateInfo(s).color;
}

function ensureRelationshipStore(){
 if(!state.relationships||typeof state.relationships!=='object') state.relationships={};
 return state.relationships;
}

function getRelationshipPairKey(aId,bId){
 const ids=[String(aId),String(bId)].sort();
 return ids.join('__');
}

function ensureRelationshipEntry(aId,bId){
 if(aId==null||bId==null||String(aId)===String(bId)) return null;
 const store=ensureRelationshipStore();
 const key=getRelationshipPairKey(aId,bId);
 if(!store[key]){
 const [a,b]=[String(aId),String(bId)].sort();
 store[key]={a,b,positive:0,negative:0,careAB:0,careBA:0,type:null,protectorAB:false,protectorBA:false,lastProgressDay:0};
 }
 return store[key];
}

function getRelationshipEntry(aId,bId){
 return ensureRelationshipStore()[getRelationshipPairKey(aId,bId)]||null;
}

function getRelationshipParticipant(entry, slot){
 if(!entry) return null;
 const id=slot==='a'?entry.a:entry.b;
 return state.survivors.find(s=>String(s.id)===String(id))||null;
}

function getRelationshipOther(entry, survivorId){
 if(!entry) return null;
 const sid=String(survivorId);
 const otherId=String(entry.a)===sid ? entry.b : entry.a;
 return state.survivors.find(s=>String(s.id)===String(otherId))||null;
}

function getRelationshipEntriesForSurvivor(survivorId){
 const sid=String(survivorId);
 return Object.values(ensureRelationshipStore()).filter(entry=>String(entry.a)===sid||String(entry.b)===sid);
}

function isProtectorOf(protectorId,targetId){
 const entry=getRelationshipEntry(protectorId,targetId);
 if(!entry) return false;
 const aSide=String(entry.a)===String(protectorId);
 return aSide ? !!entry.protectorAB : !!entry.protectorBA;
}

function getSurvivorRelationshipBadges(s){
 return getRelationshipEntriesForSurvivor(s?.id).map(entry=>{
 const other=getRelationshipOther(entry,s?.id);
 if(!other||other.status==='muerto') return null;
 const sid=String(s.id);
 const badges=[];
 if(entry.type==='love') badges.push({icon:'❤️',text:`Amor con ${other.name}`,color:'var(--danger-bright)'});
 if(entry.type==='friend') badges.push({icon:'🤝',text:`Amigo/a de ${other.name}`,color:'var(--ok-bright)'});
 if(entry.type==='rival') badges.push({icon:'⚔',text:`Rival de ${other.name}`,color:'var(--danger-bright)'});
 if(String(entry.a)===sid&&entry.protectorAB) badges.push({icon:'🛡',text:`Protege a ${other.name}`,color:'var(--accent-bright)'});
 if(String(entry.b)===sid&&entry.protectorBA) badges.push({icon:'🛡',text:`Protege a ${other.name}`,color:'var(--accent-bright)'});
 if(String(entry.a)===sid&&entry.protectorBA) badges.push({icon:'🫂',text:`Protegido por ${other.name}`,color:'var(--amber-bright)'});
 if(String(entry.b)===sid&&entry.protectorAB) badges.push({icon:'🫂',text:`Protegido por ${other.name}`,color:'var(--amber-bright)'});
 return badges;
 }).flat().filter(Boolean);
}

function getRelationshipRestBonus(s){
 const actionType=s?.action?.type;
 if(actionType!=='descansar'&&actionType!=='descansar_exterior') return 0;
 const related=getRelationshipEntriesForSurvivor(s?.id);
 const hasFriendlyRest=related.some(entry=>{
 if(!['friend','love'].includes(entry.type)) return false;
 const other=getRelationshipOther(entry,s.id);
 return !!(other&&other.status!=='muerto'&&other.action?.type===actionType);
 });
 return hasFriendlyRest ? 1 : 0;
}

function getInjuryRulesConfig(){
 const cfg=gameData.config?.rules;
 return (cfg&&typeof cfg==='object'&&!Array.isArray(cfg)) ? cfg : {};
}

function getInjuryConfig(){
 const cfg=gameData.config?.injuries;
 return (cfg&&typeof cfg==='object'&&!Array.isArray(cfg)) ? cfg : {};
}

function getInjuryRollLabel(){
 return String(getInjuryConfig().restNoMedicineRoll || '1d6').trim() || '1d6';
}

function getUntreatedInjuryTable(){
 const configured=getInjuryConfig().restNoMedicineTable;
 if(configured&&typeof configured==='object'&&!Array.isArray(configured)){
 const normalized={};
 for(let i=1;i<=6;i++){
 const raw=String(configured[i] ?? configured[String(i)] ?? '').trim().toLowerCase();
 normalized[i]=['worsen','same','improve'].includes(raw) ? raw : (INJURY_NO_MEDS_TABLE[i]||'same');
 }
 return normalized;
 }
 return INJURY_NO_MEDS_TABLE;
}

function getInjuryTreatmentChoiceRequired(level){
 const injuryLevel=String(level||'').toLowerCase();
 const rules=getInjuryRulesConfig();
 if(injuryLevel==='simple') return rules.simpleInjuryNeedsMedicine === true;
 if(injuryLevel==='seria' || injuryLevel==='grave') return rules.seriousOrGraveInjuryNeedsMedicineChoice !== false;
 return false;
}

function applyMedicineToInjuryLevel(level){
 if(level==null) return null;
 const current=String(level).toLowerCase();
 const improveOneLevel=getInjuryRulesConfig().medicineImprovesOneLevel !== false;
 if(!improveOneLevel) return null;
 if(current==='grave') return 'seria';
 if(current==='seria') return 'simple';
 if(current==='simple') return null;
 return null;
}

function improveInjuryLevel(level){
 if(level==null) return null;
 const current=String(level).toLowerCase();
 if(current==='grave') return 'seria';
 if(current==='seria') return 'simple';
 if(current==='simple') return null;
 return null;
}

function getExploreRandomInjuryDistribution(){
 const configured=gameData.config?.exploration?.randomInjuryDistribution;
 if(configured&&typeof configured==='object'&&!Array.isArray(configured)){
 const simple=Math.max(0, Number(configured.simple ?? 50) || 0);
 const seria=Math.max(0, Number(configured.seria ?? 35) || 0);
 const grave=Math.max(0, Number(configured.grave ?? 15) || 0);
 const total=simple+seria+grave;
 if(total>0) return {simple:simple/total, seria:seria/total, grave:grave/total};
 }
 return {simple:0.50, seria:0.35, grave:0.15};
}

function getAverageMorale(){
 const alive=aliveSurvivors();
 if(!alive.length) return 0;
 return alive.reduce((sum,s)=>sum+Number(s.morale||0),0)/alive.length;
}

function queueGraveInjuryWarningsForNewDay(){
 state.graveWarningQueue = aliveSurvivors()
 .filter(s => hasActiveInjury(s) && s.injuryLevel === 'grave')
 .map(s => s.id);
 state._deferStartOfDayEvent = !!state.graveWarningQueue.length;
}

function runFoodAndMoralePhase(){
 if(state._foodPhaseStarted) return;
 state._foodPhaseStarted=true;
 applyFoodConsumption();
 if(state._pendingFoodChoice){
 openFoodChoicePopup();
 return;
 }
 applyBarracksPenalty();
 applyDailyMoraleDecay();
 finalizeEndDayAfterPauses();
 render();
}

function closeInjuryTreatmentPopup(){
 const popup=document.getElementById('injuryTreatmentPopup');
 if(popup) popup.classList.remove('open');
}

function openInjuryTreatmentPopup(){
 const survivor=getNextTreatmentSurvivor();
 if(!survivor){
 closeInjuryTreatmentPopup();
 finalizeInjuriesEndOfDay();
 maybeContinueEndDayAfterPause();
 return;
 }
 const popup=document.getElementById('injuryTreatmentPopup');
 const portrait=document.getElementById('injuryTreatmentPortrait');
 const nameEl=document.getElementById('injuryTreatmentName');
 const metaEl=document.getElementById('injuryTreatmentMeta');
 const textEl=document.getElementById('injuryTreatmentText');
 const stockEl=document.getElementById('injuryTreatmentStock');
 const confirmBtn=document.getElementById('injuryTreatmentConfirm');
 const declineBtn=document.getElementById('injuryTreatmentDecline');
 if(!popup||!portrait||!nameEl||!metaEl||!textEl||!stockEl||!confirmBtn||!declineBtn){ addTechnicalLog('injury_popup_missing','No se ha podido abrir el popup de tratamiento porque faltan nodos del DOM.'); return; }

 const img=getSurvivorImage(survivor);
 portrait.innerHTML=img
 ? `<img src="${escapeAttr(img)}" style="width:100%;height:100%;object-fit:cover;filter:grayscale(18%) sepia(12%);">`
 : '<div style="width:100%;height:100%;background:var(--panel3);"></div>';

 const level=injuryDisplayName(survivor.injuryLevel||'simple');
 addTechnicalLog('injury_popup_open','Se abre el popup de tratamiento.', {survivorId: survivor.id, survivorName: survivor.name, injuryLevel: survivor.injuryLevel, meds: state.meds});
 const restNeeded=Math.max(0,(INJURY_REST_DAYS[survivor.injuryLevel]||1)-Number(survivor.injuryRestDays||0));
 nameEl.textContent=survivor.name;
 metaEl.textContent=`Herida ${level} · Descanso restante: ${restNeeded} día${restNeeded===1?'':'s'}`;
 const noMedsTable=getUntreatedInjuryTable();
 const rollLabel=getInjuryRollLabel();
 const outcomeSummary=`1 ${noMedsTable[1]==='worsen'?'empeora':noMedsTable[1]==='improve'?'mejora':'sigue igual'}, 2-4 ${[2,3,4].every(n=>noMedsTable[n]==='same')?'sigue igual':'resultado variable'}, 5-6 ${[5,6].every(n=>noMedsTable[n]==='improve')?'baja un nivel':(noMedsTable[5]===noMedsTable[6] ? (noMedsTable[5]==='same'?'sigue igual':noMedsTable[5]==='worsen'?'empeora':'mejora') : 'resultado variable')}`;
 textEl.textContent=`${survivor.name} necesita medicamentos para tratar su herida ${level}. Si recibe tratamiento, ${getInjuryRulesConfig().medicineImprovesOneLevel===false?'se cura por completo':'baja un nivel de herida'}. Si no recibe medicina, se tira ${rollLabel}: ${outcomeSummary}.`;
 stockEl.textContent=`Medicamentos disponibles: ${state.meds}`;

 confirmBtn.disabled=state.meds<=0;
 confirmBtn.onclick=()=>{
 if(state.meds<=0) return;
 state.meds=Math.max(0,state.meds-1);
 survivor._injuryTreatedToday=true;
 const prevLevel=survivor.injuryLevel;
 survivor.injuryLevel = applyMedicineToInjuryLevel(prevLevel);
 survivor.injuryRestDays=0;
 const afterLabel=survivor.injuryLevel ? injuryDisplayName(survivor.injuryLevel) : 'curada';
 addLog(`💊 ${survivor.name} recibe tratamiento: ${injuryDisplayName(prevLevel)} → ${afterLabel} (-1 medicamento).`);
 addTechnicalLog('injury_treated','Se ha administrado medicina.', {survivorId: survivor.id, survivorName: survivor.name, from: prevLevel, to: survivor.injuryLevel, meds: state.meds});
 if(Array.isArray(state._pendingTreatmentQueue)) state._pendingTreatmentQueue.shift();
 advanceTreatmentFlow();
 };
 declineBtn.onclick=()=>{
 addLog(`⚠ Decides no tratar la herida de ${survivor.name}.`);
 addTechnicalLog('injury_declined','Se decide no administrar medicina.', {survivorId: survivor.id, survivorName: survivor.name, injuryLevel: survivor.injuryLevel, meds: state.meds});
 applyUntreatedInjuryOutcome(survivor,{fromChoice:true});
 if(Array.isArray(state._pendingTreatmentQueue)) state._pendingTreatmentQueue.shift();
 advanceTreatmentFlow();
 };

 popup.classList.add('open');
}

function stripSkillDiacritics(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function normalizeSkillToken(value){
 return stripSkillDiacritics(String(value||'').trim().toLowerCase());
}

function getSkillCatalog(){
 return Array.isArray(gameData?.skills) ? gameData.skills.filter(Boolean) : [];
}

function canonicalizeSkillId(value){
 const raw=String(value||'').trim();
 if(!raw) return '';
 const normalized=normalizeSkillToken(raw);
 if(!normalized || normalized==='ninguna') return '';
 const catalog=getSkillCatalog();
 const exactById=catalog.find(sk=>normalizeSkillToken(sk?.id||'')===normalized);
 if(exactById?.id) return String(exactById.id).trim().toLowerCase();
 const exactByName=catalog.find(sk=>normalizeSkillToken(sk?.name||'')===normalized);
 if(exactByName?.id) return String(exactByName.id).trim().toLowerCase();
 const exactByLabel=catalog.find(sk=>normalizeSkillToken(sk?.label||'')===normalized);
 if(exactByLabel?.id) return String(exactByLabel.id).trim().toLowerCase();
 return normalized;
}
window.canonicalizeSkillId = canonicalizeSkillId;
window.normalizeSkillToken = normalizeSkillToken;

function getSurvivorSkills(survivor){
 if(!survivor) return [];
 const arr = Array.isArray(survivor.skills) ? survivor.skills.slice() : [];
 const legacy = typeof survivor.skill === 'string' ? survivor.skill.trim() : '';
 if(legacy && !arr.includes(legacy)) arr.unshift(legacy);
 return arr
 .map(v => canonicalizeSkillId(v))
 .filter(v => v && v !== 'ninguna')
 .filter((v, i, a) => a.indexOf(v) === i);
}

function getSurvivorSkillLabel(s){
 const builtInLabels={
 'ingeniero':'\u2699 Ingeniero - edificios -1 recurso',
 'explorador':'\u{1F5FA} Explorador - +10% eventos positivos',
 'precavido':'\u{1F6E1} Precavido - -10% eventos negativos',
 'rastreador':'\u{1F441} Rastreador - +5 peso al encontrar supervivientes',
 'inventor':'\u{1F4A1} Inventor - desarrollo de mejoras -1 dia',
 'recolector':'\u{1F4E6} Recolector - +1 comida al forrajear',
 'cazador':'\u{1F3F9} Cazador - +1 comida al explorar',
 'combatiente':'\u2694 Combatiente - +1 en combate',
 'chatarrero':'\u{1F9F0} Chatarrero - +1 material al reciclar',
 'lider':'\u2B50 Lider - +10% a positivos grupales de apoyo',
 'resolutivo':'\u{1F525} Resolutivo - +10% frente a amenazas',
 'trader':'\u{1F525} Comerciante - mejores opciones de negociacion',
 'ninguna':'\u2014',
 };
 const raw=((Array.isArray(s?.skills)&&s.skills[0]) || s?.skill || 'ninguna');
 const key=canonicalizeSkillId(raw) || 'ninguna';
 const fromJson=getSkillCatalog().find(sk => canonicalizeSkillId(sk?.id||sk?.name||'')===key);
 return builtInLabels[key] || fromJson?.name || fromJson?.label || String(raw||'---');
}
function getSurvivorSkillName(skill){
 const key=canonicalizeSkillId(skill) || 'ninguna';
 const builtInNames={
  ingeniero:'Ingeniero',
  explorador:'Explorador',
  precavido:'Precavido',
  rastreador:'Rastreador',
  inventor:'Inventor',
  recolector:'Recolector',
  cazador:'Cazador',
  combatiente:'Combatiente',
  chatarrero:'Chatarrero',
  lider:'Lider',
  resolutivo:'Resolutivo',
  trader:'Comerciante',
  ninguna:'Ninguna'
 };
 const fromJson=getSkillCatalog().find(sk => canonicalizeSkillId(sk?.id||sk?.name||'')===key);
 return builtInNames[key] || fromJson?.name || String(skill||'Ninguna');
}
function getSurvivorSkillDescription(skill){
 const key=canonicalizeSkillId(skill) || 'ninguna';
 const builtInDescriptions={
  ingeniero:'Reduce en 1 el coste de materiales al construir o mejorar edificios.',
  explorador:'Reduce ligeramente la probabilidad de sucesos negativos al explorar.',
  precavido:'Reduce el riesgo de encontrarse problemas al explorar.',
  rastreador:'Aumenta el peso de encontrar supervivientes al explorar.',
  inventor:'Reduce en 1 dia el tiempo de desarrollo de una mejora de base.',
  recolector:'Obtiene 1 comida extra al forrajear.',
  cazador:'Cuando obtiene comida explorando, suma 1 adicional.',
  combatiente:'Aporta +1 en acciones de ataque preventivo y defensa.',
  chatarrero:'Obtiene 1 material extra al reciclar.',
  lider:'Aumenta los efectos positivos de apoyo en acciones grupales.',
  resolutivo:'Aumenta la probabilidad de exito al actuar contra amenazas.',
  trader:'Mejores opciones de negociacion en eventos y con NPC.',
  ninguna:'Sin habilidad especial.'
 };
 const fromJson=getSkillCatalog().find(sk => canonicalizeSkillId(sk?.id||sk?.name||'')===key);
 return builtInDescriptions[key] || fromJson?.description || '';
}
window.getSurvivorSkillName=getSurvivorSkillName;
window.getSurvivorSkillDescription=getSurvivorSkillDescription;

function hasLowMoraleRestRestriction(s){
 return !!(s&&s.status!=='muerto'&&s._lowMoraleRestOnly&&Number(s.morale||0)<=0);
}

function applyDailyMoraleDecay(){
 // Morale naturally decreases for unfed survivors handled in food consumption
 // Also: injured survivors without treatment lose morale
 aliveSurvivors().forEach(s=>{
 if(hasActiveInjury(s)&&s.action?.type!=='descansar'&&s.action?.type!=='descansar_exterior'){
 adjustSurvivorMorale(s,-1);
 if(s.morale<=0) addLog(`😞 ${s.name} está herido y desmoralizado.`);
 }
 });
}

function applyUntreatedInjuryOutcome(s, opts={}){
 if(!s||!hasActiveInjury(s)) return;
 ensureInjuryState(s);
 const level=String(s.injuryLevel||'').toLowerCase();
 const restEffects=(state.restEffects&&typeof state.restEffects==='object') ? state.restEffects : {};
 const npcRestEffects=typeof getAssignedNpcRestEffectTotals==='function' ? getAssignedNpcRestEffectTotals() : {};
 const bonus=Number(opts.rollBonus ?? ((Number(restEffects.injuryRollBonus||0)||0)+(Number(npcRestEffects.injuryRollBonus||0)||0)))||0;
 const baseRoll=Number(opts.roll||0)||Math.floor(Math.random()*6)+1;
 const roll=clamp(baseRoll+bonus,1,6);
 const outcome=getUntreatedInjuryTable()[roll]||'same';
 const prev=level;
 const rollLabel=getInjuryRollLabel();
 if(outcome==='worsen'){
 if(level==='grave'){
 addLog(`🩸 ${s.name} no recibe tratamiento para su herida grave.`);
 addLog(`🎲 Tirada de supervivencia por herida grave (${rollLabel}): ${roll}.`);
 addTechnicalLog('injury_survival_roll','Tirada de supervivencia por herida grave sin tratamiento.', {
 survivorId:s.id,
 survivorName:s.name,
 roll,
 injuryLevel:level
 });
 killSurvivor(s,`[MUERTE] ${s.name} no sobrevive a la herida grave sin tratamiento.`);
 return;
 }
 s.injuryLevel = level==='simple' ? 'seria' : 'grave';
 s.injuryRestDays=0;
 addLog(`⚠ Descanso sin medicina (${rollLabel}: ${roll}): la herida de ${s.name} empeora de ${injuryDisplayName(prev)} a ${injuryDisplayName(s.injuryLevel)}.`);
 } else if(outcome==='improve'){
 s.injuryLevel = level==='grave' ? 'seria' : level==='seria' ? 'simple' : null;
 s.injuryRestDays=0;
 if(s.injuryLevel){
 addLog(`✅ Descanso sin medicina (${rollLabel}: ${roll}): la herida de ${s.name} baja de ${injuryDisplayName(prev)} a ${injuryDisplayName(s.injuryLevel)}.`);
 } else {
 addLog(`✅ Descanso sin medicina (${rollLabel}: ${roll}): ${s.name} se recupera de su herida ${injuryDisplayName(prev)}.`);
 }
 } else {
 addLog(`⚠ Descanso sin medicina (${rollLabel}: ${roll}): la herida de ${s.name} sigue en ${injuryDisplayName(level)}.`);
 }
}

function nextInjuryLevel(level){
 return level==='simple'?'seria':level==='seria'?'grave':'muerte';
}

function hasActiveInjury(s){
 return !!(s && s.status!=='muerto' && s.injuryLevel && INJURY_REST_DAYS[String(s.injuryLevel).toLowerCase()]);
}

function ensureInjuryState(s){
 if(!hasActiveInjury(s) && s?.status!=='herido') return;
 if(!s.injuryLevel) s.injuryLevel='simple';
 if(typeof s.injuryRestDays!=='number') s.injuryRestDays=0;
}

function normalizeForcedInjuryLevel(level, source='generic'){
 if(!level) return undefined;
 const value=String(level).toLowerCase();
 if(INJURY_REST_DAYS[value]) return value;
 if(value==='random' || value==='aleatorio'){
 return source==='explorer_random' ? rollExplorerRandomInjuryLevel() : undefined;
 }
 return undefined;
}

function rollInjuryLevel(source='generic', forcedLevel){
 const normalizedForced=normalizeForcedInjuryLevel(forcedLevel, source);
 if(normalizedForced) return normalizedForced;
 const rules=INJURY_LEVEL_RULES[source]||INJURY_LEVEL_RULES.generic;
 const r=Math.random();
 const sCut=Number(rules.simple||0.7);
 const seCut=sCut+Number(rules.seria||0.22);
 if(r<=sCut) return 'simple';
 if(r<=seCut) return 'seria';
 return 'grave';
}

function getMoraleEmoji(s){
 return getMoraleStateInfo(s).emoji;
}

function aliveSurvivors(){
 return state.survivors.filter(s=>s && s.status!=='muerto' && !isTemporarilyAwaySurvivor(s));
}

function getAliveSurvivorById(id){
 return aliveSurvivors().find(s=>s.id===id)||null;
}

function injureSurvivor(s,msg,opts={}){
 if(!s || s.status==='muerto' || isTemporarilyAwaySurvivor(s)) return;
 if(hasActiveInjury(s)){
 ensureInjuryState(s);
 const prev=s.injuryLevel;
 const next=nextInjuryLevel(s.injuryLevel);
 if(next==='muerte'){
 killSurvivor(s, `[MUERTE] La herida grave de ${s.name} empeora y no sobrevive.`);
 return;
 }
 s.injuryLevel=next;
 s.injuryRestDays=0;
 addLog(`[ALERTA] La herida de ${s.name} empeora: ${injuryDisplayName(prev)} -> ${injuryDisplayName(s.injuryLevel)}.`);
 } else {
 s.injuryLevel=rollInjuryLevel(opts.source||'generic', opts.level);
 s.injuryRestDays=0;
 }
 cancelConstructionForSurvivor(s, 'superviviente herido');
 cancelBaseUpgradeDevelopmentForSurvivor(s, 'superviviente herido');
 const armorReduction=getEquippedEffectTotal(s,'armor');
 if(armorReduction>0 && (s.injuryLevel==='grave' || s.injuryLevel==='seria') && Math.random() < Math.min(0.5, armorReduction*0.20)){
 s.injuryLevel = improveInjuryLevel(s.injuryLevel);
 addLog(`🦺 El equipo de protección de ${s.name} reduce la gravedad de la herida.`);
 }
 const finalLevel=injuryDisplayName(s.injuryLevel||'simple');
 const finalLabel=`herido/a (${finalLevel})`;
 const finalMsg=typeof msg==='function'
 ? msg(s, finalLabel, finalLevel)
 : String(msg||`${s.name} resulta ${finalLabel}.`)
 .replaceAll('{injuryLabel}', finalLabel)
 .replaceAll('{injuryLevel}', finalLevel);
 addLog(finalMsg);
 s._injuredTodayDay=state.day;
 addTechnicalLog('injury_applied','Se aplica una herida a un superviviente.', {
 survivorId:s.id,
 survivorName:s.name,
 source:opts.source||'generic',
 forcedLevel:opts.level||null,
 injuryLevel:s.injuryLevel,
 message:finalMsg
 });
}

function killSurvivor(s,msg){
 if(s.status==='muerto') return;
 _doKill(s, msg);
}

function getDogForSurvivor(survivor){
 if(!survivor||!state.dog) return null;
 const owner=ensureDogOwner();
 if(!owner) return null;
 return owner.id===survivor.id ? state.dog : null;
}

function survivorHasSkill(survivor, skill){
 if(!skill) return true;
 return getSurvivorSkills(survivor).includes(canonicalizeSkillId(skill));
}

function ensureDrunkArrays(s){
 if(!s || typeof s!=='object') return s;
 s.drunk=Math.max(0, Number(s.drunk||0)||0);
 if(!Array.isArray(s.states)) s.states=[];
 if(!Array.isArray(s.traitsExtra)) s.traitsExtra=[];
 return s;
}

function syncBorrachoState(s){
 ensureDrunkArrays(s);
 const until=Number(s.borrachoUntilDay||0)||0;
 if(until>0 && Number(state?.day||0)>until){
  s.borrachoUntilDay=0;
  if(Array.isArray(s?.states)) s.states=s.states.filter(x=>x!=='borracho');
 }
}

function hasSurvivorAlertStatus(s){
  ensureDrunkArrays(s); syncBorrachoState(s);
  return hasActiveInjury(s) || s.drunk>0 || (Array.isArray(s.states)&&s.states.length>0) || Number(s.maxFatigueMod||0)!==0 || Number(s.maxMoraleMod||0)!==0;
 }

function modifySurvivorDrunk(s, delta, delayed=false){
  ensureDrunkArrays(s); syncBorrachoState(s);
  const amount=Math.max(0, Math.abs(Number(delta||0)||0));
  if(!amount) return;
  if(delta>0){
   s.drunk=Math.max(0, s.drunk + amount);
   addLog(`${delayed?'[Retrasado] ':''}🍺 ${s.name} gana ${amount} drunk. (Total: ${s.drunk})`);
  } else {
   const before=s.drunk;
   s.drunk=Math.max(0, s.drunk - amount);
   const removed=before-s.drunk;
   addLog(`${delayed?'[Retrasado] ':''}💧 ${s.name} pierde ${removed} drunk. (Total: ${s.drunk})`);
  }
 }

function survivorHasSkillLocal(survivor, skillId){
  if(!survivor || !skillId) return false;
  const clean=canonicalizeSkillId(skillId);
  if(!clean) return false;
  const list=[];
  if(Array.isArray(survivor.skills)) list.push(...survivor.skills);
  if(survivor.skill) list.push(survivor.skill);
  return list.some(entry=>canonicalizeSkillId(typeof entry==='string'?entry:(entry?.id||entry?.name||''))===clean);
 }

function addSkillToSurvivor(survivor, skillId, delayed){
  const clean=canonicalizeSkillId(skillId);
  if(!survivor || !clean) return false;
  if(survivorHasSkillLocal(survivor, clean)) return false;
  if(!Array.isArray(survivor.skills)){
   const seed=[];
   if(survivor.skill && canonicalizeSkillId(survivor.skill)) seed.push(canonicalizeSkillId(survivor.skill));
   survivor.skills=seed;
  }
  survivor.skills=[...new Set(survivor.skills.map(canonicalizeSkillId).concat([clean]).filter(Boolean))];
  if(!survivor.skill || !canonicalizeSkillId(survivor.skill)) survivor.skill=clean;
  addLog(`${delayed?'[Retrasado] ':''}\u{1F393} ${survivor.name} aprende la habilidad ${getSurvivorSkillLabel({skill:clean})}.`);
  return true;
 }

function isTemporarilyAwaySurvivor(s){
  return !!(s && s._temporaryAway && s.status!=='muerto');
 }

function markSurvivorTemporaryAway(target, effect, delayed=false){
  if(!target || target.status==='muerto') return false;
  if(isTemporarilyAwaySurvivor(target)) return false;
  const days=normalizeAwayDays(effect);
  const returnDay=Number(state?.day||1)+days;
  target._temporaryAway={
   returnDay,
   awayDays:days,
   originalLocation:target.location||'base',
   originalStatus:(target.status==='muerto'?'activo':(target.status||'activo')),
   reason:String(effect?.reason || effect?.label || effect?.name || 'ausencia temporal').trim(),
   returnInjuryChance:normalizePercent(effect?.returnInjuryChance ?? effect?.injuryChanceOnReturn ?? effect?.returnHurtChance ?? effect?.returnWoundedChance ?? effect?.hurtChance ?? effect?.injuryChance ?? 0),
   returnInjuryLevel:String(effect?.returnInjuryLevel || effect?.injuryLevel || 'simple').trim().toLowerCase() || 'simple',
   logReturnText:String(effect?.returnText || '').trim()
  };
  target.location='away';
  target.action=null;
  target.status='ausente';
  target.travelDest=null;
  target.travelArrivalDay=null;
  target.travelReturnDay=null;
  target.exteriorSiteId=null;
  if(typeof clearGroupActionMarkers==='function') clearGroupActionMarkers(target);
  addLog(`${delayed?'[Retrasado] ':''}🚶 ${target.name} abandona temporalmente el campamento durante ${days} día${days!==1?'s':''}. Regresará el día ${returnDay}.`);
  return true;
 }
//test
