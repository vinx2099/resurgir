function ensureCampInventory(){
 if(!state.camp||typeof state.camp!=='object') state.camp={};
 ['food','materials','meds','fuel'].forEach(key=>{
 if(typeof state.camp[key]!=='number') state.camp[key]=0;
 });
 return state.camp;
}
function isExteriorLocationId(locationId){
 return !!(locationId&&Array.isArray(state.locations)&&state.locations.some(loc=>loc.instanceId===locationId));
}
function isExteriorSurvivor(s){
 const loc=s?.location;
 return loc==='travelling'||loc==='exterior'||(loc&&loc!=='base'&&isExteriorLocationId(loc));
}
function getLocationByInstanceId(locationId){
 return (state.locations||[]).find(loc=>loc.instanceId===locationId)||null;
}
function getExteriorZoneName(){
 return state.activeZone?.name||'Exterior';
}
function getLocationDisplayName(locationId){
 if(locationId==='base') return 'Base';
 if(locationId==='travelling') return 'En tránsito';
 if(locationId==='exterior') return getExteriorZoneName();
 const loc=getLocationByInstanceId(locationId);
 return loc?loc.name:'Exterior';
}
function getExteriorSiteLabel(siteId){
 if(!siteId) return 'Campamento exterior';
 const loc=getLocationByInstanceId(siteId);
 return loc?loc.name:'Ubicación exterior';
}
function getExteriorSurvivorCount(){
 return state.survivors.filter(s=>s.status!=='muerto'&&isExteriorSurvivor(s)).length;
}
function normalizeAmountRange(range, fallbackMax=1){
 if(Array.isArray(range)) return [Number(range[0]??0), Number(range[1]??range[0]??0)];
 if(typeof range==='number') return [range, range];
 return [0, fallbackMax];
}
function normalizeResourceRangeMap(map){
 const out={};
 Object.entries(map||{}).forEach(([key, value])=>{
 const [min,max]=normalizeAmountRange(value);
 out[key]=[Math.max(0, min), Math.max(Math.max(0, min), max)];
 });
 return out;
}
function hasAnyPositiveResources(map){
 return Object.values(map||{}).some(v=>Number(v||0)>0);
}
function inferLocationResourceMode(tpl){
 const explicit=(tpl?.resourceMode||tpl?.lootMode||'').toString().trim().toLowerCase();
 if(['respawn','fixed','once'].includes(explicit)) return explicit;
 if(Number(tpl?.respawnDays||tpl?.regenerateDays||0)>0) return 'respawn';
 if(tpl?.exhaustible===false) return 'fixed';
 return 'once';
}
function isLocationOnRespawnCooldown(loc){
 return !!(loc&&loc.respawnReadyDay&&state.day<loc.respawnReadyDay);
}
function getLocationRespawnDaysLeft(loc){
 return Math.max(0, Number(loc?.respawnReadyDay||0)-state.day);
}
function getLocationAvailableResourcesText(loc){
 if(!loc) return '';
 if(loc.resourceMode==='fixed'){
 const preview=Object.entries(loc.lootYield||loc.maxResources||{}).map(([k,[min,max]])=>{
 if(max<=0) return null;
 return `<span style="color:var(--ok-bright)">+${min===max?max:(min+'-'+max)} ${resourceLabel(k)}</span>`;
 }).filter(Boolean).join(' · ');
 return preview?`♾ Recurso fijo: ${preview}`:'';
 }
 const res=Object.entries(loc.resources||{}).filter(([,v])=>Number(v||0)>0).map(([k,v])=>`<span style="color:var(--ok-bright)">${v} ${resourceLabel(k)}</span>`).join(' · ');
 return res?`📦 Recursos disponibles: ${res}`:'';
}
function getLocationStatusMeta(loc){
 if(!loc) return {text:'', color:'var(--muted)'};
 if(loc.status==='undiscovered') return {text:'Sin observar', color:'var(--muted)'};
 if(loc.hasRaiders) return {text:`⚔ ${loc.hostileLabel||'Hostiles'}`, color:'var(--danger-bright)'};
 if(loc.resourceMode==='fixed') return {text:'Recurso fijo', color:'var(--ok-bright)'};
 if(isLocationOnRespawnCooldown(loc)) return {text:`Reponiendo (${getLocationRespawnDaysLeft(loc)}d)`, color:'var(--amber-bright)'};
 if(hasAnyPositiveResources(loc.resources)) return {text:loc.status==='explored'?'Visitado':'Observado', color:'var(--ok-bright)'};
 if(loc.resourceMode==='respawn') return {text:`Vacío (${loc.respawnDays||0}d respawn)`, color:'var(--dim)'};
 return {text:'Agotado', color:'var(--dim)'};
}
function getSurvivorsAtExteriorSite(siteId){
 return state.survivors.filter(s=>s.status!=='muerto'&&s.location==='exterior'&&s.exteriorSiteId===siteId);
}
function getExteriorCampSurvivors(){
 return state.survivors.filter(s=>s.status!=='muerto'&&s.location==='exterior'&&!s.exteriorSiteId);
}
function getCampInventoryEntries(){
 ensureCampInventory();
 return [['food','🍽','comida'],['materials','🔧','materiales'],['meds','💊','meds'],['fuel','⛽','combustible']].map(([key,icon,label])=>({key,icon,label,amount:Number(state.camp[key]||0)}));
}
function addCampResource(resource, amount, sourceLabel){
 const qty=Number(amount||0);
 if(!resource||qty<=0) return;
 ensureCampInventory();
 if(typeof state.camp[resource]!=='number') state.camp[resource]=0;
 state.camp[resource]+=qty;
 if(sourceLabel) addLog(`⛺ ${sourceLabel}: +${qty} ${resourceLabel(resource)} al campamento.`);
}
function transferCampInventoryToBase(){
 ensureCampInventory();
 const moved=[];
 Object.entries(state.camp).forEach(([resource, amount])=>{
 const qty=Number(amount||0);
 if(qty<=0) return;
 if(typeof state[resource]!=='number') state[resource]=0;
 state[resource]+=qty;
 moved.push(`${qty} ${resourceLabel(resource)}`);
 state.camp[resource]=0;
 });
 if(moved.length) addLog(`🎒 El campamento exterior regresa a la base con ${moved.join(', ')}.`);
}



function generateMapPositions(count){
 // Fixed grid cells that fit within the 280px height map
 // x: 2% to 86% (leaving 76px width + margins), y: 8% to 60%
 const cols=4, rows=3;
 const cells=[];
 for(let r=0;r<rows;r++){
 for(let col=0;col<cols;col++){
 cells.push({
 x: 4 + col * 23, // 4, 27, 50, 73
 y: 8 + r * 28, // 8, 36, 64
 });
 }
 }
 const shuffled=[...cells].sort(()=>Math.random()-0.5);
 return shuffled.slice(0,count);
}

function switchMapTab(tab){
 activeMapTab=tab;
 const mapArea=document.getElementById('mapArea');
 const extMap=document.getElementById('exteriorMap');
 document.querySelectorAll('.map-tab').forEach(btn=>btn.classList.remove('active'));
 if(tab==='base'){
 mapArea.style.display='';
 extMap.classList.remove('active');
 document.querySelector('[data-map-tab="base"]')?.classList.add('active');
 } else {
 mapArea.style.display='none';
 extMap.classList.add('active');
 document.querySelector('[data-map-tab="exterior"]')?.classList.add('active');
 renderExteriorMap();
 }
 renderSurvivors();
 const persistentPanel=document.getElementById('persistentEventPanel');
 const attackBanner=document.getElementById('attackThreatBanner');
 if(tab==='exterior'){
  if(persistentPanel) persistentPanel.style.display='none';
  if(attackBanner) attackBanner.innerHTML='';
 }else{
  if(typeof renderPersistentEventPanel==='function') try{ renderPersistentEventPanel(); }catch(_err){}
 }
 try{ if(typeof renderThreats==='function') renderThreats(); }catch(_err){}
}

function renderExteriorMap(){
 const map=document.getElementById('exteriorMap');
 if(!map) return;
 map.innerHTML='';
 // Map title bar
 const title=document.createElement('div');
 title.className='map-title';
 const zoneName=state.activeZone?.name||'ZONA EXTERIOR';
 title.textContent='◎ '+zoneName.toUpperCase();
 map.appendChild(title);
 // Zone flavor text
 if(state.activeZone?.flavor){
 const flavor=document.createElement('div');
 flavor.style.cssText='position:absolute;bottom:6px;left:10px;right:10px;font-size:9px;color:var(--dim);font-family:var(--font-worn);font-style:italic;z-index:0;pointer-events:none;line-height:1.5;';
 flavor.textContent=state.activeZone.flavor;
 map.appendChild(flavor);
 }
 state.locations.forEach(loc=>{
 const btn=document.createElement('button');
 btn.className='loc-btn';
 if(loc.status==='undiscovered') btn.classList.add('undiscovered');
 else if(loc.hasRaiders) btn.classList.add('has-raiders');
 else if(!hasAnyPositiveResources(loc.resources)&&loc.resourceMode!=='fixed') btn.classList.add('exhausted');
 const survivorsHere=getSurvivorsAtExteriorSite(loc.instanceId);
 if(survivorsHere.length) btn.classList.add('has-survivors');
 btn.style.cssText=`left:${loc.x}%;top:${loc.y}%;position:absolute;`;
 const statusMeta=getLocationStatusMeta(loc);
 const survivorPips=survivorsHere.map(()=>`<span style="color:var(--ok-bright);font-size:9px;">●</span>`).join('');
 btn.innerHTML=`<span class="loc-icon">${loc.status==='undiscovered'?'❓':loc.icon}</span>
 <span class="loc-name">${loc.status==='undiscovered'?'???':escapeHtml(loc.name)}</span>
 <span class="loc-status" style="color:${statusMeta.color}">${statusMeta.text}</span>
 ${survivorPips?`<span style="display:block;margin-top:2px;">${survivorPips}</span>`:''}`;
 btn.addEventListener('click',()=>showLocationDetail(loc.instanceId));
 map.appendChild(btn);
 });
}

function showLocationDetail(instanceId){
 const loc=state.locations.find(l=>l.instanceId===instanceId);
 if(!loc) return;
 state.currentDetail='location_'+instanceId;

 const riskLabel=['✅ Seguro','⚠ Bajo','⚠⚠ Medio','⚠⚠⚠ Alto','💀 Extremo'][Math.min(loc.riskLevel||0,4)];
 const survivorsHere=getSurvivorsAtExteriorSite(instanceId);
 const campSurvivors=getExteriorCampSurvivors();
 const travellingHere=state.survivors.filter(s=>s.travelDest==='exterior'&&s.location==='travelling');
 const canTravelFromBase=state.survivors.filter(s=>s.status==='activo'&&s.location==='base'&&(s.negativeSkill||'').toLowerCase()!=='miedoso');
 const eligibleReturn=state.survivors.filter(s=>s.location==='exterior'&&s.exteriorSiteId===instanceId&&s.status!=='muerto'&&!s._exteriorActionLocked&&!hasLowMoraleRestRestriction(s)&&s.status!=='ocupado');
 const eligibleLoot=getEligibleExteriorSurvivors(instanceId,'loot');
 const eligibleRest=getEligibleExteriorSurvivors(instanceId,'rest');
 const eligibleAttack=getEligibleExteriorSurvivors(instanceId,'attack');
 const eligibleExploit=getEligibleExteriorSurvivors(instanceId,'exploit');
 const eligibleMove=getEligibleExteriorSurvivors(instanceId,'move');
 const statusMeta=getLocationStatusMeta(loc);
 const zoneName=getExteriorZoneName();

 let html=`<div class="loc-detail-header">${loc.status==='undiscovered'?'❓ Edificio no observado':loc.icon+' '+escapeHtml(loc.name)}</div>`;
 html+=`<div class="loc-risk">${riskLabel} · Zona exterior: ${escapeHtml(zoneName)}</div>`;
 html+=`<div style="font-size:11px;color:${statusMeta.color};margin-bottom:6px;">${statusMeta.text}</div>`;

 if(loc.status!=='undiscovered'&&loc.description){
 html+=`<div style="font-size:11px;color:var(--text);margin-bottom:6px;line-height:1.5;">${escapeHtml(loc.description)}</div>`;
 } else if(loc.status==='undiscovered'){
 html+=`<div style="font-size:11px;color:var(--muted);margin-bottom:6px;">Todavía no se ha observado este edificio. Usa <b>Observar</b> para revelar su información antes de entrar.</div>`;
 }

 if(loc.hasRaiders&&loc.status!=='undiscovered'){
 const hLabel=loc.hostileLabel||'Hostiles';
 const hStr=loc.hostileStrength?` · Fuerza: ${loc.hostileStrength}`:'';
 html+=`<div style="color:var(--danger-bright);font-size:11px;margin-bottom:6px;border-left:2px solid var(--danger);padding-left:6px;">⚔ ${escapeHtml(hLabel)}${hStr}. No se puede saquear.</div>`;
 }

 if(loc.status!=='undiscovered'){
 const resText=getLocationAvailableResourcesText(loc);
 if(resText){
 html+=`<div style="font-size:11px;margin-bottom:6px;">${resText}</div>`;
 } else if(loc.resourceMode==='respawn'&&isLocationOnRespawnCooldown(loc)){
 html+=`<div style="font-size:11px;color:var(--amber-bright);margin-bottom:6px;">⏳ Reposición en ${getLocationRespawnDaysLeft(loc)} día${getLocationRespawnDaysLeft(loc)!==1?'s':''}.</div>`;
 } else if(loc.resourceMode!=='fixed'){
 html+=`<div style="font-size:11px;color:var(--dim);margin-bottom:6px;">No quedan recursos ahora mismo.</div>`;
 }
 }

 if(campSurvivors.length){
 html+=`<div style="font-size:11px;color:var(--ok-bright);margin-bottom:6px;">⛺ En campamento exterior: ${campSurvivors.map(s=>escapeHtml(s.name)).join(', ')}</div>`;
 }
 if(survivorsHere.length){
 html+=`<div style="font-size:11px;color:var(--ok-bright);margin-bottom:6px;">👤 En este edificio: ${survivorsHere.map(s=>escapeHtml(s.name)).join(', ')}</div>`;
 }
 if(travellingHere.length){
 html+=`<div style="font-size:11px;color:var(--amber-bright);margin-bottom:6px;">🧭 En camino al exterior: ${travellingHere.map(s=>escapeHtml(s.name)+' (día '+s.travelArrivalDay+')').join(', ')}</div>`;
 }

 html+=`<div class="loc-actions" id="locActions"></div>`;
 detailBox.innerHTML=html;
 openBuildingPopup();

 const actionsEl=document.getElementById('locActions');

 const travelBtn=document.createElement('button');
 travelBtn.className='btn primary';
 travelBtn.innerHTML=`🧭 Viajar a ${escapeHtml(zoneName)}`;
 travelBtn.disabled=!canTravelFromBase.length;
 travelBtn.title=!canTravelFromBase.length?'Sin supervivientes disponibles en base':'';
 travelBtn.onclick=()=>openTravelPopup(null, instanceId);
 actionsEl.appendChild(travelBtn);

 if(loc.status==='undiscovered'){
 const observeBtn=document.createElement('button');
 observeBtn.className='btn amber';
 observeBtn.innerHTML='👁 Observar';
 observeBtn.disabled=!campSurvivors.length&&!survivorsHere.length;
 observeBtn.title=(!campSurvivors.length&&!survivorsHere.length)?'Necesitas a alguien en el exterior para observar este edificio':'';
 observeBtn.onclick=()=>observeExteriorLocation(instanceId);
 actionsEl.appendChild(observeBtn);
 } else {
 const moveBtn=document.createElement('button');
 moveBtn.className='btn secondary';
 moveBtn.innerHTML='🥾 Ir a este edificio';
 moveBtn.disabled=!eligibleMove.length;
 moveBtn.title=!eligibleMove.length?'Nadie puede moverse a este edificio hoy':'';
 moveBtn.onclick=()=>openExteriorMovePopup(instanceId);
 actionsEl.appendChild(moveBtn);
 }

 if(survivorsHere.length){
 const returnBtn=document.createElement('button');
 returnBtn.className='btn secondary';
 returnBtn.innerHTML='↩ Volver a base';
 returnBtn.disabled=!eligibleReturn.length;
 returnBtn.title=!eligibleReturn.length?'Nadie puede volver ahora mismo':'';
 returnBtn.onclick=()=>openTravelReturnPopup(instanceId);
 actionsEl.appendChild(returnBtn);
 }

 const lootAvailable = loc.status!=='undiscovered' && !loc.hasRaiders && (
 loc.resourceMode==='fixed' ? hasAnyPositiveResources(Object.fromEntries(Object.entries(loc.lootYield||{}).map(([k,v])=>[k, Array.isArray(v)?v[1]:v])))
 : hasAnyPositiveResources(loc.resources)
 ) && !isLocationOnRespawnCooldown(loc);

 if(survivorsHere.length&&lootAvailable){
 const lootBtn=document.createElement('button');
 lootBtn.className='btn primary';
 lootBtn.innerHTML='📦 Saquear';
 lootBtn.disabled=!eligibleLoot.length;
 lootBtn.title=!eligibleLoot.length?'Nadie puede saquear hoy en este edificio':'';
 lootBtn.onclick=()=>openLootPopup(instanceId);
 actionsEl.appendChild(lootBtn);
 }

 if(survivorsHere.length&&!loc.hasRaiders&&eligibleRest.length){
 const btn=document.createElement('button');
 btn.className='btn secondary';
 btn.innerHTML='🛏 Descansar';
 btn.onclick=()=>openExteriorRestPopup(instanceId);
 actionsEl.appendChild(btn);
 }

 if(survivorsHere.length&&!loc.hasRaiders&&!isLocationOnRespawnCooldown(loc)&&loc.exploitResources&&loc.status!=='undiscovered'&&hasAnyPositiveResources(loc.resources)){
 const er=Object.entries(loc.exploitResources).map(([k,[min,max]])=>`+${max} ${resourceLabel(k)}`).join(', ');
 const btn=document.createElement('button');
 btn.className='btn amber';
 btn.innerHTML=`💥 Explotar (${er})`;
 btn.disabled=!eligibleExploit.length;
 btn.title=!eligibleExploit.length?'Nadie puede explotar esta zona hoy':'';
 btn.onclick=()=>openExploitPopup(instanceId);
 actionsEl.appendChild(btn);
 }

 if(loc.hasRaiders&&loc.status!=='undiscovered'&&survivorsHere.length){
 const btn=document.createElement('button');
 btn.className='btn danger';
 btn.innerHTML='⚔ Atacar hostiles';
 btn.disabled=!eligibleAttack.length;
 btn.title=!eligibleAttack.length?'Nadie puede atacar hoy en esta ubicación':'';
 btn.onclick=()=>openLocationRaiderAttack(instanceId);
 actionsEl.appendChild(btn);
 }
}

function resolveLocationExploration(){
 state.locations.forEach(loc=>{
 if(!loc.exploringBy) return;
 const daysSpent=state.day-loc.exploreStartDay;
 if(daysSpent<loc.exploreDays) return;
 const s=state.survivors.find(sv=>sv.id===loc.exploringBy);
 const mode=loc.exploreMode||'explore';

 if(mode==='explore'||mode==='loot'){
 if(loc.status==='undiscovered'){
 loc.status='discovered';
 addLog(`🧭 ${s?s.name:'Alguien'} descubre: ${loc.name}. ${loc.hasRaiders?'⚔ Hay raiders.':''}`);
 }
 if(loc.status==='discovered'||loc.status==='explored'){
 // Apply resources
 Object.entries(loc.resources).forEach(([k,v])=>{
 addCampResource(k, v, `${s?s.name:'Alguien'} obtiene recursos de ${loc.name}`);
 });
 if(loc.survivorChance&&Math.random()<loc.survivorChance&&!state._pendingSurvivor){
 const newSurv=pickSurvivorByRarity();
 if(newSurv) attemptRecruitmentOffer(newSurv,'exploración');
 }
 loc.status='explored';
 if(loc.exhaustible) loc.exhausted=true;
 }
 // Injury risk based on riskLevel
 const injChance=loc.riskLevel*0.12;
 if(Math.random()<injChance) injureSurvivor(s,`🩸 ${s?s.name:'Alguien'} resulta {injuryLabel} explorando ${loc.name}.`,{source:'explore'});
 } else if(mode==='attack'){
 // Simple raider combat at location
 const atkRoll=roll(1,6);
 const defRoll=roll(1,4);
 const total=atkRoll+(s?1:0);
 if(total>defRoll+loc.riskLevel){
 loc.hasRaiders=false;
 addLog(`✅ ${s?s.name:'El grupo'} elimina a los raiders de ${loc.name}.`);
 state.stability=Math.min(10,state.stability+1);
 } else {
 if(s) injureSurvivor(s,`🩸 ${s.name} fracasa y resulta {injuryLabel} en el intento.`,{source:'explore'});
 addLog(`❌ No se pudo limpiar ${loc.name} de raiders.`);
 }
 }

 loc.exploringBy=null;
 loc.exploreStartDay=null;
 loc.exploreMode=null;
 if(s){ s.status='activo'; s.action=null; }
 });
}

function openExploitPopup(locationId){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc||!loc.exploitResources) return;
 const survivorsHere=getEligibleExteriorSurvivors(locationId,'exploit');
 if(!survivorsHere.length){ addLog('No hay supervivientes disponibles para explotar la zona.'); return; }
 const er=Object.entries(loc.exploitResources).map(([k,[min,max]])=>`+${max} ${resourceLabel(k)}`).join(', ');
 openLocationActionPopup({
 title:'💥 Explotar ubicación',
 info:`<b>${escapeHtml(loc.name)}</b> · Elige quién fuerza el saqueo final. Coste: -1 fatiga. Recompensa máxima: ${er}.`,
 survivors:survivorsHere,
 confirmLabel:'Confirmar explotación',
 onConfirm:(ids)=>exploitLocation(locationId, ids)
 });
}

function exploitLocation(instanceId, survivorIds=[]){
 const loc=state.locations.find(l=>l.instanceId===instanceId);
 if(!loc||!loc.exploitResources) return;
 const selected=state.survivors.filter(s=>survivorIds.includes(s.id)&&s.location==='exterior'&&s.exteriorSiteId===instanceId&&canUseExteriorAction(s));
 if(!selected.length){ addLog('No hay supervivientes válidos para explotar la zona.'); return; }
 lockExteriorImmediateAction(selected,'explotar_exterior',instanceId);
 Object.entries(loc.exploitResources).forEach(([k,[min,max]])=>{
 const amount=Math.floor(Math.random()*(max-min+1))+min;
 addCampResource(k, amount, `Explotación de ${loc.name}`);
 });
 selected.forEach(s=>resolveExteriorRandomEncounter(s, instanceId, `explota ${loc.name}`));
 Object.keys(loc.resources||{}).forEach(k=>{ loc.resources[k]=0; });
 loc.exhausted=true;
 loc.status='explored';
 if(loc.resourceMode==='respawn'&&Number(loc.respawnDays||0)>0){
 loc.respawnReadyDay=state.day+Number(loc.respawnDays||0);
 }
 addLog(`💥 ${selected.map(s=>s.name).join(', ')} agotan ${loc.name}.`);
 renderExteriorMap();
 render();
 showLocationDetail(instanceId);
}

function regenerateLocations(){
 state.locations.forEach(loc=>{
 if(loc.resourceMode!=='respawn'||!loc.respawnReadyDay) return;
 if(state.day>=loc.respawnReadyDay){
 loc.lastRegenDay=state.day;
 loc.respawnReadyDay=null;
 loc.exhausted=false;
 const tpl=(gameData.locationTemplates||[]).find(t=>t.id===loc.templateId);
 if(tpl){
 const fresh={};
 Object.entries(tpl.resources||{}).forEach(([k,[min,max]])=>{
 fresh[k]=Math.floor(Math.random()*(max-min+1))+min;
 });
 loc.resources=fresh;
 loc.maxResources=deepClone(fresh);
 } else {
 loc.resources=deepClone(loc.maxResources||{});
 }
 addLog(`🌿 ${loc.name} vuelve a tener recursos disponibles.`);
 }
 });
}


// ── EVENT CONDITION SYSTEM ──
// Evaluates a condition object against current game state
function evaluateCondition(cond){
 if(!cond) return true; // no condition = always valid
 const type=cond.type||'';

 switch(type){
 case 'survivor':{
 // Requires survivor with this ID to be alive in settlement
 return state.survivors.some(s=>s.id===cond.id&&s.status!=='muerto');
 }
 case 'not_survivor':{
 // Requires survivor with this ID to NOT be present/alive
 return !state.survivors.some(s=>s.id===cond.id&&s.status!=='muerto');
 }
 case 'building':{
 // Requires building to be built and active
 const b=state.buildings[cond.id];
 return !!(b?.built&&b?.active);
 }
 case 'building_level':{
 // Requires building to be at minimum level
 const b=state.buildings[cond.id];
 return !!(b?.built&&b?.active&&(b.level||0)>=(cond.minLevel||1));
 }
 case 'not_building':{
 const b=state.buildings[cond.id];
 return !b?.built;
 }
 case 'stability_min':{
 return state.stability>=(cond.value||0);
 }
 case 'stability_max':{
 return state.stability<=(cond.value||10);
 }
 case 'day_min':{
 return state.day>=(cond.value||0);
 }
 case 'day_max':{
 return state.day<=(cond.value||999);
 }
 case 'valueID':{
 const id=String(cond.id||'').trim();
 if(!id) return false;
 const values=(state.values&&typeof state.values==='object'&&!Array.isArray(state.values)) ? state.values : {};
 return values[id] === (Number(cond.value)===1 ? 1 : 0);
 }
 case 'and':{
 return (cond.conditions||[]).every(c=>evaluateCondition(c));
 }
 case 'or':{
 return (cond.conditions||[]).some(c=>evaluateCondition(c));
 }
 case 'not':{
 return !evaluateCondition(cond.condition);
 }
 default:
 return true;
 }
}


// ── TRAVEL SYSTEM ──

function openTravelPopup(survivorId=null, presetLocationId=null){
 const popup=document.getElementById('travelPopup');
 const info=document.getElementById('travelDestInfo');
 const list=document.getElementById('travelSurvivorList');
 const confirmBtn=document.getElementById('travelConfirm');
 const foodAvail=document.getElementById('travelFoodAvail');
 const medsAvail=document.getElementById('travelMedsAvail');
 if(foodAvail) foodAvail.textContent=state.food;
 if(medsAvail) medsAvail.textContent=state.meds;

 const eligibleSurvivors=state.survivors.filter(s=>
 s.status==='activo'&&s.location==='base'&&s.status!=='muerto'&&
 (s.negativeSkill||'').toLowerCase()!=='miedoso'
 );
 const zoneName=getExteriorZoneName();

 if(confirmBtn){
 confirmBtn.disabled=true;
 confirmBtn.style.display='none';
 confirmBtn.onclick=null;
 }

 if(survivorId){
 const selected=eligibleSurvivors.find(s=>s.id===survivorId);
 if(!selected){ addLog('No hay supervivientes disponibles para viajar.'); return; }
 info.innerHTML=`🥾 <b>${escapeHtml(selected.name)}</b> · Viajará a <b>${escapeHtml(zoneName)}</b> · Llegada: día ${state.day+1}`;
 list.innerHTML='';
 const item=document.createElement('div');
 item.style.cssText='display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:8px;border:1px solid var(--line2);background:var(--panel2);';
 item.innerHTML=`
 <div>
 <div style="font-family:var(--font-display);font-size:13px;">⛺ ${escapeHtml(zoneName)}</div>
 <div style="font-size:10px;color:var(--muted);">Llegada: día ${state.day+1}</div>
 </div>
 <button class="btn primary" style="font-size:11px;padding:5px 10px;">Viajar</button>`;
 item.querySelector('button').addEventListener('click',()=>{
 travelToZone(selected.id, 'exterior');
 popup.classList.remove('open');
 renderSurvivors();
 renderExteriorMap();
 });
 list.appendChild(item);
 popup.classList.add('open');
 return;
 }

 info.innerHTML=`⛺ <b>${escapeHtml(zoneName)}</b> · Elige 1 o más supervivientes · Llegada: día ${state.day+1}`;
 list.innerHTML='';
 const selectedIds=new Set();
 if(!eligibleSurvivors.length){
 list.innerHTML='<div style="color:var(--muted);font-size:11px;">No hay supervivientes disponibles.</div>';
 }
 eligibleSurvivors.forEach(s=>{
 const item=document.createElement('div');
 item.style.cssText='display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;padding:8px;border:1px solid var(--line2);background:var(--panel2);cursor:pointer;transition:border-color 0.15s, background 0.15s;';
 item.innerHTML=`
 <div style="width:40px;height:40px;overflow:hidden;border:1px solid var(--line2);">
 ${s.imageUrl?`<img src="${escapeAttr(s.imageUrl)}" style="width:100%;height:100%;object-fit:cover;">`:''}</div>
 <div>
 <div style="font-family:var(--font-display);font-size:13px;">${escapeHtml(s.name)}</div>
 <div style="font-size:10px;color:var(--muted);">⚡ ${s.fatigue}/${s.maxFatigue} · ${getMoraleEmoji(s)} ${getMoraleLabel(s,false)}</div>
 </div>
 <div style="font-size:18px;color:var(--muted);" data-check="${s.id}">○</div>`;
 const toggle=()=>{
 if(selectedIds.has(s.id)){
 selectedIds.delete(s.id);
 item.style.borderColor='var(--line2)';
 item.style.background='var(--panel2)';
 item.querySelector('[data-check]').textContent='○';
 item.querySelector('[data-check]').style.color='var(--muted)';
 } else {
 selectedIds.add(s.id);
 item.style.borderColor='var(--ok)';
 item.style.background='rgba(74,138,53,0.08)';
 item.querySelector('[data-check]').textContent='●';
 item.querySelector('[data-check]').style.color='var(--ok-bright)';
 }
 if(confirmBtn) confirmBtn.disabled=selectedIds.size===0;
 };
 item.addEventListener('click',toggle);
 list.appendChild(item);
 });
 if(confirmBtn){
 confirmBtn.style.display='inline-flex';
 confirmBtn.textContent='Enviar expedición';
 confirmBtn.onclick=()=>{
 if(!selectedIds.size) return;
 travelGroupToZone([...selectedIds], 'exterior');
 popup.classList.remove('open');
 renderSurvivors();
 renderExteriorMap();
 };
 }
 popup.classList.add('open');
}

document.getElementById('travelCancel').addEventListener('click',()=>{
 document.getElementById('travelPopup').classList.remove('open');
});
document.getElementById('locationActionCancel').addEventListener('click',closeLocationActionPopup);

function closeLocationActionPopup(){
 const popup=document.getElementById('locationActionPopup');
 if(popup) popup.classList.remove('open');
}

function canUseExteriorAction(s, opts={}){
 const allowForcedRest=!!opts.allowForcedRest;
 const allowZeroFatigue=!!opts.allowZeroFatigue;
 const requireBravery=!!opts.requireBravery;
 const allowLowMoraleRestOnly=!!opts.allowLowMoraleRestOnly;
 if(!s||s.status==='muerto') return false;
 if((s.location||'base')==='base'||s.location==='travelling') return false;
 if(s._exteriorActionLocked||s.status==='ocupado') return false;
 if(requireBravery&&(s.negativeSkill||'').toLowerCase().trim()==='cobarde') return false;
 if(!allowForcedRest&&requiresForcedRest(s)) return false;
 if(!allowLowMoraleRestOnly&&hasLowMoraleRestRestriction(s)) return false;
 if(!allowZeroFatigue&&Number(s.fatigue||0)<=0) return false;
 return true;
}

function getEligibleExteriorSurvivors(locationId, mode='action'){
 return state.survivors.filter(s=>{
 if(s.status==='muerto'||s.location!=='exterior') return false;
 if(mode==='move'){
 if(s.exteriorSiteId===locationId) return false;
 return canUseExteriorAction(s);
 }
 if(s.exteriorSiteId!==locationId) return false;
 if(mode==='rest') return canUseExteriorAction(s,{allowForcedRest:true,allowZeroFatigue:true,allowLowMoraleRestOnly:true});
 if(mode==='attack') return canUseExteriorAction(s,{requireBravery:true});
 if(mode==='return') return !s._exteriorActionLocked&&!hasLowMoraleRestRestriction(s)&&s.status!=='muerto'&&s.status!=='ocupado'&&s.location==='exterior';
 return canUseExteriorAction(s);
 });
}

function getExteriorEncounterChance(loc, survivor){
 const risk=Math.max(0, Math.min(Number(loc?.riskLevel||0), 4));
 let chance=[0.05,0.10,0.15,0.20,0.25][risk]||0.10;
 const skills=getSurvivorSkills(survivor).map(v=>(v||'').toLowerCase().trim());
 if(skills.includes('explorador')) chance-=0.03;
 if(skills.includes('rastreador')) chance-=0.02;
 if(skills.includes('precavido')) chance-=0.02;
 return Math.max(0.02, chance);
}

function resolveExteriorRandomEncounter(survivor, locationId, contextLabel){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!survivor||survivor.status==='muerto'||!loc) return false;
 const chance=getExteriorEncounterChance(loc, survivor);
 if(Math.random()>=chance) return false;

 const fallbackHostiles=(gameData.hostiles||[]).filter(h=>h&&h.id);
 const randomHostile=fallbackHostiles.length ? fallbackHostiles[Math.floor(Math.random()*fallbackHostiles.length)] : null;
 const hostileType=(loc.hostileType&&loc.hostileType!=='none') ? loc.hostileType : (randomHostile?.id||'raiders');
 const hostileDef=getHostileDef(hostileType)||{};
 const hostileLabel=hostileDef.label||getHostileLabel(hostileType)||'un hostil';
 const skills=getSurvivorSkills(survivor).map(v=>(v||'').toLowerCase().trim());
 const survivorPower=roll(1,6)+1+(skills.includes('combatiente')?1:0)+(skills.includes('explorador')?1:0)+(skills.includes('rastreador')?1:0);
 const enemyPower=roll(1,4)+Math.max(1, Number(loc.riskLevel||0));

 addLog(`👣 ${survivor.name} se cruza con ${hostileLabel} mientras ${contextLabel}.`);

 if(survivorPower>=enemyPower){
 addLog(`✅ ${survivor.name} logra evitar el peligro y sigue adelante.`);
 return true;
 }

 injureSurvivor(
 survivor,
 `⚠ ${survivor.name} se encuentra con ${hostileLabel} mientras ${contextLabel} y resulta {injuryLabel}.`,
 {source:'combat'}
 );
 return true;
}

function observeExteriorLocation(locationId){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 if(loc.status==='undiscovered'){
  loc.status='discovered';
  loc.observed=true;
  loc.observedTemplateId = loc.templateId || loc.observedTemplateId || null;
  loc.observedName = loc.name || loc.observedName || '';
  loc.observedIcon = loc.icon || loc.observedIcon || '📍';
  loc.observedDescription = loc.description || loc.observedDescription || '';
  const hostiles=loc.hasRaiders?` Detectas ${loc.hostileLabel||'hostiles'}${loc.hostileStrength?` (fuerza ${loc.hostileStrength})`:''}.`:'';
  const resText=getLocationAvailableResourcesText(loc);
  addLog(`👁 Observáis ${loc.name}.${hostiles}${resText?` ${resText.replace(/<[^>]+>/g,'')}.`:''}`);
 }
 renderExteriorMap();
 render();
 showLocationDetail(locationId);
}

function openExteriorMovePopup(locationId){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const survivors=getEligibleExteriorSurvivors(locationId,'move');
 if(!survivors.length){ addLog('No hay supervivientes disponibles para moverse a ese edificio.'); return; }
 openLocationActionPopup({
 title:'🥾 Moverse por el exterior',
 info:`<b>${escapeHtml(loc.name)}</b> · Elige quién va a este edificio. Coste: -1 fatiga. Quedarán ocupados hasta mañana.`,
 survivors,
 confirmLabel:'Mover al edificio',
 onConfirm:(ids)=>moveExteriorGroupToLocation(locationId, ids)
 });
}

function moveExteriorGroupToLocation(locationId, survivorIds){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc||loc.status==='undiscovered') return;
 const selected=state.survivors.filter(s=>survivorIds.includes(s.id)&&s.location==='exterior'&&s.exteriorSiteId!==locationId&&canUseExteriorAction(s));
 if(!selected.length){ addLog('No hay supervivientes válidos para moverse.'); return; }
 lockExteriorImmediateAction(selected,'viajar_exterior',locationId);
 selected.forEach(s=>{ s.exteriorSiteId=locationId; });
 if(loc.status==='discovered') loc.status='explored';
 addLog(`🥾 ${selected.map(s=>s.name).join(', ')} se mueven a ${loc.name}.`);
 selected.forEach(s=>resolveExteriorRandomEncounter(s, locationId, `se mueve por ${loc.name}`));
 render();
 renderExteriorMap();
 showLocationDetail(locationId);
}

function lockExteriorImmediateAction(survivors, actionType, locationId){
 const acted=[];
 (survivors||[]).forEach(s=>{
 if(!s||s.status==='muerto'||s._exteriorActionLocked) return;
 s.fatigue=Math.max(0,Math.min(Number(s.maxFatigue??3),Number(s.fatigue||0)-1));
 s.status='ocupado';
 s.action={type:actionType,target:locationId};
 s._actionResolved=true;
 s._exteriorActionLocked=true;
 acted.push(s.name);
 });
 return acted;
}

function openLocationActionPopup({title,info,survivors,confirmLabel,onConfirm}){
 const popup=document.getElementById('locationActionPopup');
 const titleEl=document.getElementById('locationActionTitle');
 const infoEl=document.getElementById('locationActionInfo');
 const listEl=document.getElementById('locationActionList');
 const confirmBtn=document.getElementById('locationActionConfirm');
 if(!popup||!titleEl||!infoEl||!listEl||!confirmBtn) return;
 const selectedIds=new Set();
 titleEl.textContent=title||'Acción en ubicación';
 infoEl.innerHTML=info||'';
 listEl.innerHTML='';
 if(!survivors.length){
 listEl.innerHTML='<div style="color:var(--muted);font-size:11px;">No hay supervivientes disponibles.</div>';
 }
 survivors.forEach(s=>{
 const item=document.createElement('div');
 item.style.cssText='display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;padding:8px;border:1px solid var(--line2);background:var(--panel2);cursor:pointer;transition:border-color 0.15s, background 0.15s;';
 item.innerHTML=`
 <div style="width:40px;height:40px;overflow:hidden;border:1px solid var(--line2);">${getSurvivorImage(s)?`<img src="${escapeAttr(getSurvivorImage(s))}" style="width:100%;height:100%;object-fit:cover;">`:''}</div>
 <div>
 <div style="font-family:var(--font-display);font-size:13px;">${escapeHtml(s.name)}</div>
 <div style="font-size:10px;color:var(--muted);">⚡ ${s.fatigue}/${s.maxFatigue} · ${getMoraleEmoji(s)} ${getMoraleLabel(s,false)}</div>
 </div>
 <div style="font-size:18px;color:var(--muted);" data-check="${s.id}">○</div>`;
 item.addEventListener('click',()=>{
 if(selectedIds.has(s.id)){
 selectedIds.delete(s.id);
 item.style.borderColor='var(--line2)';
 item.style.background='var(--panel2)';
 item.querySelector('[data-check]').textContent='○';
 item.querySelector('[data-check]').style.color='var(--muted)';
 } else {
 selectedIds.add(s.id);
 item.style.borderColor='var(--ok)';
 item.style.background='rgba(74,138,53,0.08)';
 item.querySelector('[data-check]').textContent='●';
 item.querySelector('[data-check]').style.color='var(--ok-bright)';
 }
 confirmBtn.disabled=selectedIds.size===0;
 });
 listEl.appendChild(item);
 });
 confirmBtn.textContent=confirmLabel||'Confirmar';
 confirmBtn.disabled=true;
 confirmBtn.onclick=()=>{
 if(!selectedIds.size) return;
 closeLocationActionPopup();
 onConfirm([...selectedIds]);
 };
 popup.classList.add('open');
}

function travelGroupToZone(survivorIds, locationId){
 const ids=(Array.isArray(survivorIds)?survivorIds:[survivorIds]).filter(Boolean);
 if(!ids.length) return;
 const zoneName=getExteriorZoneName();
 ensureCampInventory();
 const foodToTake=Math.min(Number(document.getElementById('travelFood')?.value||0), state.food);
 const medsToTake=Math.min(Number(document.getElementById('travelMeds')?.value||0), state.meds);
 if(foodToTake>0){ state.food-=foodToTake; state.camp.food+=foodToTake; }
 if(medsToTake>0){ state.meds-=medsToTake; state.camp.meds+=medsToTake; }
 const movedNames=[];
 ids.forEach(survivorId=>{
 const s=state.survivors.find(x=>x.id===survivorId);
 if(!s||s.location!=='base'||s.status==='muerto') return;
 s.location='travelling';
 s.travelDest='exterior';
 s.travelArrivalDay=state.day+1;
 s.travelReturnDay=null;
 s.exteriorSiteId=null;
 s.status='ocupado';
 s.action={type:'viajar',target:'exterior'};
 movedNames.push(s.name);
 });
 if(!movedNames.length) return;
 if(foodToTake>0||medsToTake>0) addLog(`🎒 La expedición lleva ${foodToTake>0?foodToTake+' comida':''}${foodToTake>0&&medsToTake>0?' y ':''}${medsToTake>0?medsToTake+' meds':''} al campamento.`);
 addLog(`🧭 ${movedNames.join(', ')} parten hacia ${zoneName}. Llegarán el día ${state.day+1}.`);
}

function travelToZone(survivorId, locationId){
 travelGroupToZone([survivorId], locationId);
}

// Legacy alias (kept for compatibility with older onclick hooks)
function sendOnExpedition(survivorId, locationId){
 travelToZone(survivorId, locationId);
}

function openTravelReturnPopup(locationOrSurvivorId){
 const survivorDirect=state.survivors.find(x=>x.id===locationOrSurvivorId&&x.location==='exterior'&&x.status!=='muerto');
 const locationId=survivorDirect?(survivorDirect.exteriorSiteId||'exterior'):locationOrSurvivorId;
 const loc=getLocationByInstanceId(locationId);
 const survivors=(locationId==='exterior')
 ? state.survivors.filter(s=>s.location==='exterior'&&s.status!=='muerto'&&!s._exteriorActionLocked&&!hasLowMoraleRestRestriction(s)&&s.status!=='ocupado')
 : state.survivors.filter(s=>s.location==='exterior'&&s.exteriorSiteId===locationId&&s.status!=='muerto'&&!s._exteriorActionLocked&&!hasLowMoraleRestRestriction(s)&&s.status!=='ocupado');
 if(!survivors.length) return;
 openLocationActionPopup({
 title:'↩ Volver a base',
 info:`<b>${escapeHtml(loc?.name||'Campamento exterior')}</b> · Elige qué supervivientes regresan hoy a la base.`,
 survivors,
 confirmLabel:'Iniciar regreso',
 onConfirm:(ids)=>{
 const names=[];
 ids.forEach(id=>{
 const s=state.survivors.find(x=>x.id===id&&x.location==='exterior');
 if(!s) return;
 s.location='travelling';
 s.travelDest='base';
 s.travelReturnDay=state.day+1;
 s.travelArrivalDay=null;
 s.status='ocupado';
 s.action={type:'regresar',target:'base'};
 names.push(s.name);
 });
 if(names.length){
 const sourceLoc=(locationId&&locationId!=='exterior') ? locationId : (survivors[0]?.exteriorSiteId||null);
 ids.forEach(id=>{
 const sx=state.survivors.find(x=>x.id===id);
 if(sx&&sourceLoc) resolveExteriorRandomEncounter(sx, sourceLoc, 'abandona la zona para volver a la base');
 });
 addLog(`🧭 ${names.join(', ')} emprenden el regreso a la base. Llegarán el día ${state.day+1}.`);
 renderSurvivors();
 renderExteriorMap();
 if(locationId&&locationId!=='exterior') showLocationDetail(locationId);
 }
 }
 });
}

function openLootPopup(locationId){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const survivorsHere=getEligibleExteriorSurvivors(locationId,'loot');
 if(!survivorsHere.length){ addLog('No hay supervivientes disponibles para saquear en esa ubicación.'); return; }
 openLocationActionPopup({
 title:'📦 Saquear ubicación',
 info:`<b>${escapeHtml(loc.name)}</b> · Elige 1 o más supervivientes para hacer el saqueo. Coste: -1 fatiga. Los recursos irán al campamento exterior.`,
 survivors:survivorsHere,
 confirmLabel:'Confirmar saqueo',
 onConfirm:(ids)=>lootLocation(locationId, ids)
 });
}

function rollLocationLoot(loc){
 const gains={};
 if(!loc) return gains;
 if(loc.resourceMode==='fixed'){
 Object.entries(loc.lootYield||loc.maxResources||{}).forEach(([k, range])=>{
 const [min,max]=normalizeAmountRange(range,1);
 const amount=Math.floor(Math.random()*(max-min+1))+min;
 if(amount>0) gains[k]=amount;
 });
 return gains;
 }
 Object.entries(loc.resources||{}).forEach(([k, current])=>{
 const available=Number(current||0);
 if(available<=0) return;
 const [min,max]=normalizeAmountRange((loc.lootYield||{})[k]||[1,Math.min(3,available)],1);
 const desired=Math.floor(Math.random()*(max-min+1))+min;
 const amount=Math.max(0, Math.min(available, desired));
 if(amount>0) gains[k]=amount;
 });
 return gains;
}

function lootLocation(locationId, survivorIds){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const selected=state.survivors.filter(s=>survivorIds.includes(s.id)&&s.location==='exterior'&&s.exteriorSiteId===locationId&&canUseExteriorAction(s));
 if(!selected.length){ addLog('No hay supervivientes válidos para saquear.'); return; }
 if(loc.status==='undiscovered'){ addLog('Primero debes observar este edificio.'); return; }
 if(loc.resourceMode!=='fixed'&&(!hasAnyPositiveResources(loc.resources)||isLocationOnRespawnCooldown(loc))){
 addLog('No quedan recursos disponibles ahora mismo en esa ubicación.');
 return;
 }
 const gains=rollLocationLoot(loc);
 if(!hasAnyPositiveResources(gains)){ addLog('No se ha podido obtener nada útil en esta pasada.'); return; }
 lockExteriorImmediateAction(selected,'saquear_exterior',locationId);
 Object.entries(gains).forEach(([k, amount])=>{
 addCampResource(k, amount, `${selected.map(s=>s.name).join(', ')} saquean ${loc.name}`);
 if(loc.resourceMode!=='fixed'){
 loc.resources[k]=Math.max(0, Number(loc.resources[k]||0)-amount);
 }
 });
 selected.forEach(s=>{
 resolveExteriorRandomEncounter(s, locationId, `saquea ${loc.name}`);
 if(Math.random()<(loc.riskLevel||0)*0.10){
 injureSurvivor(s,`🩸 ${s.name} resulta {injuryLabel} saqueando ${loc.name}.`,{source:'combat'});
 }
 });
 loc.status='explored';
 const depleted = loc.resourceMode!=='fixed' && !hasAnyPositiveResources(loc.resources);
 if(depleted){
 loc.exhausted=true;
 if(loc.resourceMode==='respawn'&&Number(loc.respawnDays||0)>0){
 loc.respawnReadyDay=state.day+Number(loc.respawnDays||0);
 addLog(`⏳ ${loc.name} queda vacía. Volverá a dar recursos en ${loc.respawnDays} día${loc.respawnDays!==1?'s':''}.`);
 } else {
 addLog(`📭 ${loc.name} ha quedado agotada.`);
 }
 } else if(loc.resourceMode!=='fixed'){
 const left=Object.entries(loc.resources).filter(([,v])=>Number(v||0)>0).map(([k,v])=>`${v} ${resourceLabel(k)}`).join(', ');
 if(left) addLog(`📦 Quedan en ${loc.name}: ${left}.`);
 }
 addLog(`📦 Saqueo completado en ${loc.name} por ${selected.map(s=>s.name).join(', ')}.`);
 render();
 renderExteriorMap();
 showLocationDetail(locationId);
}

function openExteriorRestPopup(locationId){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const survivorsHere=getEligibleExteriorSurvivors(locationId,'rest');
 if(!survivorsHere.length){ addLog('No hay supervivientes disponibles para descansar en esta ubicación.'); return; }
 openLocationActionPopup({
 title:'🛏 Descansar en la ubicación',
 info:`<b>${escapeHtml(loc.name)}</b> · Elige quién descansa hoy aquí. Funciona igual que la acción de descansar, usando los recursos del campamento exterior.`,
 survivors:survivorsHere,
 confirmLabel:'Asignar descanso',
 onConfirm:(ids)=>assignExteriorRest(locationId, ids)
 });
}

function assignExteriorRest(locationId, survivorIds){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const selected=state.survivors.filter(s=>survivorIds.includes(s.id)&&s.location==='exterior'&&s.exteriorSiteId===locationId&&canUseExteriorAction(s,{allowForcedRest:true,allowZeroFatigue:true}));
 if(!selected.length){ addLog('No hay supervivientes válidos para descansar.'); return; }
 selected.forEach(s=>{
 s.action={type:'descansar_exterior',target:locationId};
 s.status='ocupado';
 s._exteriorActionLocked=true;
 s._actionResolved=false;
 resolveExteriorRandomEncounter(s, locationId, `se prepara para descansar en ${loc.name}`);
 });
 addLog(`🛏 ${selected.map(s=>s.name).join(', ')} descansan en ${loc.name}.`);
 render();
 renderExteriorMap();
 showLocationDetail(locationId);
}

function openLocationRaiderAttack(locationId){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const survivorsHere=getEligibleExteriorSurvivors(locationId,'attack');
 if(!survivorsHere.length){ addLog('No hay supervivientes disponibles para atacar.'); return; }
 openLocationActionPopup({
 title:'⚔ Atacar hostiles',
 info:`<b>${escapeHtml(loc.name)}</b> · Elige 1 o más supervivientes para atacar. Coste: -1 fatiga.`,
 survivors:survivorsHere,
 confirmLabel:'Iniciar ataque',
 onConfirm:(ids)=>attackLocationRaiders(locationId, ids)
 });
}

function attackLocationRaiders(locationId, survivorIds){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const survivorsHere=state.survivors.filter(s=>survivorIds.includes(s.id)&&s.location==='exterior'&&s.exteriorSiteId===locationId&&canUseExteriorAction(s,{requireBravery:true}));
 if(!survivorsHere.length){ addLog('No hay supervivientes válidos para atacar.'); return; }
 lockExteriorImmediateAction(survivorsHere,'atacar_exterior',locationId);
 // Fight! Each survivor contributes +1, skill bonuses apply
 const skillBonus=survivorsHere.reduce((sum,s)=>{
 const skills=getSurvivorSkills(s);
 return sum+(skills.includes('combatiente')?1:0)+(skills.includes('explorador')?1:0);
 },0);
 const atkRoll=roll(1,6);
 const defRoll=roll(1,4); // raiders surprised at their own location
 const totalAtk=survivorsHere.length+skillBonus+atkRoll;
 // Use stored hostile strength or fall back to riskLevel-based
 const baseHostileStr=loc.hostileStrength||(loc.riskLevel||1)*2;
 const totalDef=baseHostileStr+defRoll;
 addLog(`⚔ ATAQUE: ${survivorsHere.length} atacantes +${skillBonus} habilidades +${atkRoll}(d6) = ${totalAtk}`);
 addLog(`⚔ ${loc.hostileLabel||'Hostiles'}: fuerza ${baseHostileStr} +${defRoll}(d4) = ${totalDef}`);
 const hostileDef=getHostileDef(loc.hostileType);
 const injBonus=hostileDef?.injuryChanceBonus||0;
 if(totalAtk>totalDef){
 // Check flee
 const fleeChance=hostileDef?.fleeChance||0;
 const fled=fleeChance>0&&Math.random()<fleeChance;
 loc.hasRaiders=false;
 if(fled){
 addLog(`🏃 Los ${loc.hostileLabel||'hostiles'} huyen de ${loc.name}.`);
 applyLootList(hostileDef?.lootOnFlee||[], 'camp');
 openCombatResultPopup({
 title:'✅ Enemigos en retirada',
 icon:'🏃',
 text:`Los ${loc.hostileLabel||'hostiles'} huyen de ${loc.name}.`,
 summary:[`Resultado: ${totalAtk} vs ${totalDef}`],
 effects:(hostileDef?.lootOnFlee||[]).map(l=>`${Math.round((l.chance||0)*100)}%: +${(l.amount||[]).join('-')} ${resourceLabel(l.resource)}`),
 });
 } else {
 addLog(`✅ ${survivorsHere.map(s=>s.name).join(', ')} eliminan a los ${loc.hostileLabel||'hostiles'} de ${loc.name}.`);
 applyLootList(hostileDef?.lootOnVictory||[], 'camp');
 state.stability=Math.min(10,state.stability+1);
 openCombatResultPopup({
 title:'✅ Victoria en incursión',
 icon:'⚔',
 text:`${survivorsHere.map(s=>s.name).join(', ')} limpian ${loc.name} de hostiles.`,
 summary:[`Resultado: ${totalAtk} vs ${totalDef}`,'+1 estabilidad'],
 effects:(hostileDef?.lootOnVictory||[]).map(l=>`${Math.round((l.chance||0)*100)}%: +${(l.amount||[]).join('-')} ${resourceLabel(l.resource)}`),
 });
 }
 survivorsHere.forEach(s=>{ if(Math.random()<0.25+injBonus) injureSurvivor(s,`🩸 ${s.name} resulta {injuryLabel} en el combate.`,{source:'combat'}); });
 } else {
 addLog(`❌ El ataque fracasó. Los ${loc.hostileLabel||'hostiles'} siguen en ${loc.name}.`);
 survivorsHere.forEach(s=>{ if(Math.random()<0.5+injBonus) injureSurvivor(s,`🩸 ${s.name} resulta {injuryLabel} en el combate.`,{source:'combat'}); });
 openCombatResultPopup({
 title:'❌ Ataque fallido',
 icon:'💥',
 text:`El grupo no consigue expulsar a los ${loc.hostileLabel||'hostiles'} de ${loc.name}.`,
 summary:[`Resultado: ${totalAtk} vs ${totalDef}`],
 effects:[],
 });
 }
 render();
 renderExteriorMap();
 showLocationDetail(locationId);
}

// ── Resolve travel each day ──
function resolveTravelMovement(){
 ensureCampInventory();
 state.survivors.forEach(s=>{
 if(s.location!=='travelling') return;
 if(s.travelArrivalDay&&state.day>=s.travelArrivalDay){
 const destination=s.travelDest||'base';
 if(destination==='exterior'){
 s.location='exterior';
 s.exteriorSiteId=null;
 } else {
 s.location=destination;
 }
 s.travelArrivalDay=null;
 s.travelDest=null;
 s.status='activo';
 s.action=null;
 const loc=state.locations.find(l=>l.instanceId===destination);
 addLog(`📍 ${s.name} llega a ${destination==='base'?'la base':destination==='exterior'?('el campamento exterior de '+getExteriorZoneName()):(loc?loc.name:'destino')}.`);
 }
 else if(s.travelReturnDay&&state.day>=s.travelReturnDay){
 s.location='base';
 s.exteriorSiteId=null;
 s.travelDest=null;
 s.travelArrivalDay=null;
 s.travelReturnDay=null;
 s.status='activo';
 s.action=null;
 addLog(`🏠 ${s.name} regresa a la base.`);
 const stillOutside=state.survivors.filter(x=>x.id!==s.id&&x.status!=='muerto'&&isExteriorSurvivor(x)).length;
 if(stillOutside===0){
 transferCampInventoryToBase();
 }
 }
 });
}
