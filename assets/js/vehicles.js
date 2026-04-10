(()=>{
 if(window.__resurgirExteriorVehiclePatch) return;
 window.__resurgirExteriorVehiclePatch=true;

 const GARAGE_ID='garaje';
 const ZONE_TRAVEL_FALLBACKS={
 outskirts:{fuelCost:0,travelDays:0},
 suburbs:{fuelCost:1,travelDays:0},
 industrial:{fuelCost:1,travelDays:1},
 manhunters:{fuelCost:2,travelDays:2},
 deadzone:{fuelCost:2,travelDays:2}
 };
 const DEFAULT_VEHICLE={
 id:'vehiculo_base',
 name:'Coche destartalado',
 passengers:3,
 cargo:6,
 fuelCapacity:4,
 fuelCurrent:0,
 condition:4,
 maxCondition:4,
 mejorable:true,
 upgraded:false
 };

 const legacy={
 ensureBuildingCatalog:window.ensureBuildingCatalog,
 initGame:window.initGame,
 openBuildModal:window.openBuildModal,
 showBuildingDetail:window.showBuildingDetail,
 renderSurvivors:window.renderSurvivors,
 resolveTravelMovement:window.resolveTravelMovement,
 generateLocations:window.generateLocations,
 getBuildingElectricityCost:window.getBuildingElectricityCost,
 getElectricityUsed:window.getElectricityUsed,
 renderExteriorMap:window.renderExteriorMap
 };

 function silentFetchJson(url, assign){
 fetch(url,{cache:'no-store'})
 .then(r=>r.ok?r.json():null)
 .then(data=>{ if(data) assign(data); })
 .catch(()=>{});
 }
 silentFetchJson('./data/vehicles.json', data=>{
 gameData.vehicles=Array.isArray(data)?data:(Array.isArray(data?.vehicles)?data.vehicles:[]);
 });
 silentFetchJson('./data/npc.json', data=>{
 gameData.npcs=Array.isArray(data)?data:(Array.isArray(data?.npcs)?data.npcs:[]);
 });

 function normalizeVehicle(raw={}){
 const base={...DEFAULT_VEHICLE, ...(raw||{})};
 const fuelCapacity=Math.max(0, Number(base.fuelCapacity ?? base.fuelMax ?? base.maxFuel ?? base.combustibleMax ?? 4) || 0);
 const fuelCurrent=Math.max(0, Math.min(fuelCapacity, Number(base.fuelCurrent ?? base.currentFuel ?? base.combustibleActual ?? 0) || 0));
 const maxCondition=Math.max(1, Number(base.maxCondition ?? base.maxState ?? base.maxEstado ?? 4) || 4);
 const condition=Math.max(0, Math.min(maxCondition, Number(base.condition ?? base.stateValue ?? base.estado ?? maxCondition) || 0));
 return {
 id:String(base.id||DEFAULT_VEHICLE.id),
 name:String(base.name||DEFAULT_VEHICLE.name),
 passengers:Math.max(1, Number(base.passengers ?? base.capacity ?? base.pasajeros ?? 3) || 3),
 cargo:Math.max(0, Number(base.cargo ?? base.carga ?? 6) || 0),
 fuelCapacity,
 fuelCurrent,
 condition,
 maxCondition,
 mejorable:base.mejorable!==false,
 upgraded:!!(base.upgraded||base.improved||base.mejorado)
 };
 }

 function getConfiguredVehicle(){
 const fromJson=Array.isArray(gameData.vehicles)&&gameData.vehicles.length ? gameData.vehicles[0] : null;
 return normalizeVehicle(fromJson||DEFAULT_VEHICLE);
 }

 function ensureVehicleState(){
 if(!state.expedition||typeof state.expedition!=='object'){
 state.expedition={zoneId:null,returnFuelCost:0,returnTravelDays:0,usingVehicle:false};
 }
 ensureGarageStateEntry();
 if(!state.vehicle){
 state.vehicle=getConfiguredVehicle();
 }else{
 const normalized=normalizeVehicle({...getConfiguredVehicle(), ...state.vehicle});
 state.vehicle={...state.vehicle, ...normalized};
 }
 return state.vehicle;
 }

 function getVehicle(){ return ensureVehicleState(); }
 function getGarageBuilding(){ return state.buildings?.[GARAGE_ID] || state.buildings?.garage || null; }
 function getGarageLevel(){ return Number(getGarageBuilding()?.level||0); }
 function garageReady(){ const g=getGarageBuilding(); return !!(g?.built && !g?._underConstruction); }
 function vehicleAway(){
 return state.survivors.some(s=>s&&s.status!=='muerto'&&(s.location==='exterior'||(s.location==='travelling'&&(s.travelDest==='exterior'||s.travelReturnDay))));
 }
 function hasExteriorExpedition(){ return vehicleAway(); }
 function getExteriorZoneById(zoneId){
 return (gameData.zones||[]).find(zone=>String(zone?.id||'')===String(zoneId||''))||null;
 }
 function isExteriorZoneUnlocked(zone){
 if(!zone) return false;
 if(zone.startsUnlocked===true) return true;
 const unlockBuilding=String(zone.unlockBuilding||'').trim().toLowerCase();
 const unlockLevel=Math.max(1, Number(zone.unlockBuildingLevel||1)||1);
 if(unlockBuilding){
 const building=state.buildings?.[unlockBuilding];
 return !!(building?.built && Number(building.level||0)>=unlockLevel);
 }
 return state.day>=(Number(zone.unlockDay||1)||1);
 }
 function getExteriorZoneUnlockReason(zone){
 if(!zone) return 'Zona no disponible';
 if(isExteriorZoneUnlocked(zone)) return '';
 const unlockBuilding=String(zone.unlockBuilding||'').trim().toLowerCase();
 const unlockLevel=Math.max(1, Number(zone.unlockBuildingLevel||1)||1);
 if(unlockBuilding){
 const building=state.buildings?.[unlockBuilding];
 if(!building?.built) return `Requiere ${formatBuildingRequirement(unlockBuilding)}`;
 if(Number(building.level||0)<unlockLevel) return `Requiere ${formatBuildingRequirement(unlockBuilding)} nivel ${unlockLevel}`;
 }
 return `Disponible a partir del día ${Number(zone.unlockDay||1)||1}`;
 }
 function getAvailableExteriorZones(includeLocked=false){
 const zones=(gameData.zones||[]).filter(Boolean);
 return includeLocked ? zones : zones.filter(isExteriorZoneUnlocked);
 }
 function zoneTravelConfig(zone=state.activeZone){
 const fallback=ZONE_TRAVEL_FALLBACKS[String(zone?.id||'').toLowerCase()]||{fuelCost:0,travelDays:1};
 return {
 fuelCost:Math.max(0, Number(zone?.fuelCost ?? zone?.fuel ?? fallback.fuelCost) || 0),
 travelDays:Math.max(0, Number(zone?.travelDays ?? zone?.days ?? zone?.travelTime ?? fallback.travelDays) || 0)
 };
 }
 function zoneNeedsVehicle(zone=state.activeZone){
 return Number(zoneTravelConfig(zone).fuelCost||0)>0;
 }
 function eligibleBaseTravelers(){
 return state.survivors.filter(s=>
 s&&s.status==='activo'&&s.location==='base'&&s.status!=='muerto'&&
 (s.negativeSkill||'').toLowerCase().trim()!=='miedoso'
 );
 }
 function eligibleExteriorCampSurvivors(opts={}){
 const mode=opts.mode||'action';
 return state.survivors.filter(s=>{
 if(!s||s.status==='muerto'||s.location!=='exterior') return false;
 if(mode==='return') return !s._exteriorActionLocked && !hasLowMoraleRestRestriction(s) && s.status!=='ocupado';
 if(mode==='rest') return canUseExteriorAction(s,{allowForcedRest:true,allowZeroFatigue:true,allowLowMoraleRestOnly:true});
 if(mode==='attack') return canUseExteriorAction(s,{requireBravery:true});
 return canUseExteriorAction(s);
 });
 }
 function syncExteriorHubModel(){
 state.survivors.forEach(s=>{
 if(!s) return;
 if(s.location==='exterior') s.exteriorSiteId=null;
 if(s.location==='base' || s.location==='travelling') s.exteriorSiteId=null;
 });
 }
 function ensureExteriorPersistence(){
  if(!state.exteriorPersistence || typeof state.exteriorPersistence!=='object') state.exteriorPersistence={zones:{}};
  if(!state.exteriorPersistence.zones || typeof state.exteriorPersistence.zones!=='object') state.exteriorPersistence.zones={};
  return state.exteriorPersistence.zones;
 }
 function getExteriorZoneSnapshot(zoneId){
  const key=String(zoneId||'').trim();
  if(!key) return null;
  return ensureExteriorPersistence()[key] || null;
 }
 function saveExteriorZoneSnapshot(zoneId=state.activeZone?.id){
  const key=String(zoneId||'').trim();
  if(!key) return null;
  const zone=getExteriorZoneById(key) || state.activeZone || null;
  const snapshot={zoneId:key,zoneName:String(zone?.name||''),savedDay:Number(state.day||1),locations:deepClone(state.locations||[])};
  ensureExteriorPersistence()[key]=snapshot;
  return snapshot;
 }
 function restoreExteriorZoneSnapshot(zoneId){
  const snapshot=getExteriorZoneSnapshot(zoneId);
  if(!snapshot||!Array.isArray(snapshot.locations)||!snapshot.locations.length) return false;
  state.locations=deepClone(snapshot.locations);
  return true;
 }
 function touchExteriorPersistence(){
  if(state.activeZone?.id) saveExteriorZoneSnapshot(state.activeZone.id);
 }
 function getExteriorInventorySummaryHtml(){
  const entries=(typeof getCampInventoryEntries==='function'?getCampInventoryEntries():[]).filter(item=>Number(item.amount||0)>0);
  if(!entries.length) return '<span style="color:var(--dim);">Inventario exterior vacío</span>';
  return entries.map(item=>`<span>${item.icon} <b>${item.amount}</b> ${item.label}</span>`).join(' · ');
 }
 function getExteriorInventorySummaryText(){
  const entries=(typeof getCampInventoryEntries==='function'?getCampInventoryEntries():[]).filter(item=>Number(item.amount||0)>0);
  if(!entries.length) return 'Sin carga';
  return entries.map(item=>`${item.amount} ${item.label}`).join(' · ');
 }
 function openExteriorVehicleInventory(){
  const detailBox=document.getElementById('detailBox');
  if(!detailBox) return;
  const vehicle=getVehicle();
  const entries=(typeof getCampInventoryEntries==='function'?getCampInventoryEntries():[]);
  const inventoryRows=entries.map(item=>`<div class="metric"><span>${item.icon} ${item.label}</span><b>${item.amount}</b></div>`).join('');
  detailBox.innerHTML=`<div class="detail-grid" style="gap:10px;"><div style="font-family:var(--font-display);font-size:18px;letter-spacing:0.08em;color:var(--ok-bright);">📦 Inventario · ${escapeHtml(vehicle.name||'Vehículo')}</div><div style="font-size:11px;color:var(--muted);margin-top:4px;">Carga actual del coche / campamento exterior</div>${inventoryRows || '<div style="font-size:11px;color:var(--dim);">Sin recursos cargados.</div>'}</div>`;
  state.currentDetail='vehicle_exterior_inventory';
  openBuildingPopup();
 }
 function openExteriorVehicleStatus(){
  const detailBox=document.getElementById('detailBox');
  if(!detailBox) return;
  const vehicle=getVehicle();
  detailBox.innerHTML=`<div class="detail-grid" style="gap:10px;"><div style="font-family:var(--font-display);font-size:18px;letter-spacing:0.08em;color:var(--ok-bright);">🚗 Estado del coche</div><div class="metric"><span>Vehículo</span><b>${escapeHtml(vehicle.name||'Vehículo')}</b></div><div class="metric"><span>Combustible</span><b>${vehicle.fuelCurrent}/${vehicle.fuelCapacity}</b></div><div class="metric"><span>Estado</span><b>${vehicle.condition}/${vehicle.maxCondition} · ${escapeHtml(vehicleStatusLabel(vehicle))}</b></div><div class="metric"><span>Capacidad de carga</span><b>+${Number(vehicle.cargo||0)} materiales</b></div></div>`;
  state.currentDetail='vehicle_exterior_status';
  openBuildingPopup();
 }
 function openExteriorVehicleDetail(){
  openExteriorVehicleStatus();
 }

 function getNpcCatalog(){
 const data=gameData.npcs;
 if(Array.isArray(data)) return data;
 if(data && Array.isArray(data.npcs)) return data.npcs;
 return [];
 }
 function findNpcDef(npcId){
 const id=String(npcId||'');
 return getNpcCatalog().find(n=>String(n?.id||'')===id)||null;
 }

 function vehicleStatusLabel(vehicle=getVehicle()){
 if(Number(vehicle.condition||0)<=0) return 'Inutilizado';
 if(vehicle.condition>=Math.max(1, vehicle.maxCondition-1)) return 'Óptimo';
 if(vehicle.condition>=2) return 'Dañado';
 return 'Crítico';
 }
 function vehicleInUseText(){
 return vehicleAway() ? 'Fuera del garaje' : 'En garaje';
 }

 function applyVehicleDamage(amount=1, sourceLabel='', occupants=null){
 const vehicle=getVehicle();
 const before=Number(vehicle.condition||0);
 const dmg=Math.max(1, Number(amount||1) || 1);
 if(before<=0) return false;
 vehicle.condition=Math.max(0, before-dmg);
 addLog(`🚗 El vehículo sufre ${dmg} punto${dmg!==1?'s':''} de daño${sourceLabel?` en ${sourceLabel}`:''}. (${vehicle.condition}/${vehicle.maxCondition})`);
 if(vehicle.condition===0){
 const impacted=(occupants||state.survivors.filter(s=>s&&s.status!=='muerto'&&(s.location==='exterior'||(s.location==='travelling'&&(s.travelDest==='exterior'||s.travelReturnDay))))).filter(Boolean);
 if(Math.random()<0.03){
 addLog('💥 El vehículo explota al quedar reducido a 0. Se pierde toda la carga del campamento exterior.');
 ensureCampInventory();
 Object.keys(state.camp).forEach(key=>state.camp[key]=0);
 impacted.forEach(s=>killSurvivor(s,`💀 ${s.name} muere en la explosión del vehículo.`));
 } else {
 addLog('🧱 El vehículo queda inutilizado. La expedición tendrá que volver andando si quiere regresar.');
 }
 }
 return true;
 }

 function maybeDamageVehicleFromExterior(loc, occupants){
 const vehicle=getVehicle();
 if(!state.expedition?.usingVehicle || Number(vehicle.condition||0)<=0) return;
 const risk=Math.max(0, Number(loc?.riskLevel||0));
 if(risk<=0) return;
 const chance=Math.min(0.28, 0.03 + risk*0.04);
 if(Math.random()<chance){
 const damage=Math.random() < Math.min(0.45, risk*0.08) ? 2 : 1;
 applyVehicleDamage(damage, loc?.name||'la zona exterior', occupants);
 }
 }

 function injectGarageDefinition(){
 if(!Array.isArray(gameData.buildings)) gameData.buildings=[];
 const def={
 id:GARAGE_ID,
 name:'Garaje',
 cost:4,
 maxLevel:2,
 constructible:true,
 initial:false,
 category:'Base',
 electricityCostByLevel:[1,3],
 constructionDays:[3,3],
 effect:'Alberga el vehículo y permite repostar, reparar y mejorar.',
 map:null,
 levelEffects:{'1':'Capacidad: 1 vehículo · Permite repostar y reparar.','2':'Capacidad: 1 vehículo activo · Permite mejorar el vehículo (+1 estado máximo).'}
 };
 const isGarageLike=(item)=>{
  const id=String(item?.id||'').trim().toLowerCase();
  const name=String(item?.name||'').trim().toLowerCase();
  return id==='garaje'||id==='garage'||id.includes('garaj')||id.includes('garage')||name==='garaje'||name==='garage'||name.includes('garaj')||name.includes('garage');
 };
 const hasValidMap=(item)=>{
  const m=item?.map;
  return !!(m && typeof m==='object' && String(m.left||'').trim() && String(m.top||'').trim() && String(m.width||'').trim() && String(m.height||'').trim());
 };
 let canonical=gameData.buildings.find(b=>b&&String(b.id||'').trim().toLowerCase()===GARAGE_ID) || null;
 if(!canonical){
  canonical=gameData.buildings.find(b=>isGarageLike(b) && hasValidMap(b)) || gameData.buildings.find(b=>isGarageLike(b)) || null;
 }
 if(canonical){
  const existingMap=hasValidMap(canonical) ? deepClone(canonical.map) : null;
  Object.assign(canonical, {...canonical, ...def, id:GARAGE_ID, name:'Garaje', category:'Base', maxLevel:def.maxLevel, constructible:true, electricityCostByLevel:deepClone(def.electricityCostByLevel), constructionDays:deepClone(def.constructionDays), effect:def.effect, levelEffects:deepClone(def.levelEffects)});
  if(existingMap) canonical.map=existingMap;
  else delete canonical.map;
 }else{
  canonical=deepClone(def);
  gameData.buildings.push(canonical);
 }
 gameData.buildings=gameData.buildings.filter(item=>{
  if(!isGarageLike(item)) return true;
  return item===canonical;
 });
 }
 function ensureGarageStateEntry(){
 injectGarageDefinition();
 if(!state.buildings||state.buildings[GARAGE_ID]) return;
 const def=getBuildingDef(GARAGE_ID)||gameData.buildings.find(b=>b&&b.id===GARAGE_ID);
 if(!def) return;
 state.buildings[GARAGE_ID]={
 id:def.id,
 name:def.name,
 desc:def.effect||def.description||'',
 description:def.description||def.effect||'',
 image:def.image||'',
 levelEffects:deepClone(def.levelEffects||{}),
 cost:Number(def.cost||0),
 built:!!def.initial,
 level:def.initial?1:0,
 active:true,
 constructible:def.constructible!==false,
 maxLevel:Number(def.maxLevel||2),
 category:def.category||'Base',
 map:deepClone(def.map||null),
 electricityCost:def.electricityCost||0,
 electricityCostByLevel:deepClone(def.electricityCostByLevel||null),
 constructionDays:deepClone(def.constructionDays!=null?def.constructionDays:1),
 upgradeRequirements:deepClone(def.upgradeRequirements||{})
 };
 }

 window.ensureBuildingCatalog=function(){
 if(typeof legacy.ensureBuildingCatalog==='function') legacy.ensureBuildingCatalog();
 injectGarageDefinition();
 };

 window.getBuildingElectricityCost=function(id, targetLevel=null){
 const def=getBuildingDef(id);
 const current=state.buildings?.[id];
 const source=def?.electricityCostByLevel ?? def?.electricityCostLevels ?? current?.electricityCostByLevel ?? null;
 if(Array.isArray(source)){
 const level=Math.max(1, Number(targetLevel ?? current?.level ?? (current?.built?1:1)) || 1);
 const idx=Math.min(source.length-1, Math.max(0, level-1));
 return Math.max(0, Number(source[idx]||0) || 0);
 }
 if(source && typeof source==='object'){
 const level=Math.max(1, Number(targetLevel ?? current?.level ?? 1) || 1);
 return Math.max(0, Number(source[String(level)] ?? source[level] ?? 0) || 0);
 }
 return Number(def?.electricityCost ?? current?.electricityCost ?? 0) || 0;
 };

 window.getElectricityUsed=function(){
 let used=0;
 Object.values(state.buildings||{}).forEach(b=>{
 const level=Math.max(1, Number(b?.level||1)||1);
 const cost=window.getBuildingElectricityCost(b.id, level);
 if(cost>0 && b?.built && b?.active) used+=cost;
 });
 if(state.baseUpgrades?.electric_fence&&state.buildings.generador?.built&&state.buildings.generador?.active){
 const needsElectricity=getBaseUpgradeDef('electric_fence')?.effects?.needsElectricity;
 if(needsElectricity!==false) used+=1;
 }
 return used;
 };

 window.openBuildModal=function(survivorId){
 const s=state.survivors.find(x=>x.id===survivorId);
 const buildOptionsEl=document.getElementById('buildOptions');
 const modalWrap=document.getElementById('buildModalWrap');
 if(!s||!buildOptionsEl||!modalWrap) return;
 buildOptionsEl.innerHTML='';
 (gameData.buildings||[]).forEach(def=>{
 const current=state.buildings[def.id];
 let constructible=current?.constructible===true;
 if(def.id==='generador'&&(state.buildings.taller?.level||0)<2) constructible=false;
 const maxLevel=Math.max(1, Number(def.maxLevel||5)||5);
 const currentLevel=Number(current?.level||0);
 const nextLevel=currentLevel+1;
 const atCap=currentLevel>=maxLevel;
 const buildCost=getBuildingCost(def.id);
 const currentElec=current?.built ? window.getBuildingElectricityCost(def.id, currentLevel) : 0;
 const targetElec=window.getBuildingElectricityCost(def.id, nextLevel);
 const extraElec=Math.max(0, targetElec-currentElec);
 const hasElec=extraElec===0 || getElectricityFree()>=extraElec;
 const elecLabel=targetElec>0
 ? (!current?.built ? ` · Requiere ${targetElec}⚡ permanentes (libre: ${getElectricityFree()})` : ` · Pasará a usar ${targetElec}⚡${extraElec>0?` (+${extraElec} libre)` : ''}`)
 : '';
 const upgradeReqs=getBuildingUpgradeRequirements(def.id, nextLevel);
 const missingReqs=upgradeReqs.filter(req=>!buildingIsReady(req));
 const blocked=!constructible||missingReqs.length>0;
 const blockReason=missingReqs.length
 ? `Requiere: ${missingReqs.map(req=>formatBuildingRequirement(req)).join(', ')}`
 : def.id==='generador'&&(state.buildings.taller?.level||0)<2?'Requiere Taller nivel 2':'';
 const label=blocked?`${def.name} (bloqueado)`:current?.built?`Mejorar ${def.name}`:`Construir ${def.name}`;
 const displayCost=blocked?Number(def.cost||0):buildCost;
 const box=document.createElement('div');
 box.className='build-option';
 const constructDays=getBuildingConstructionDays(def.id, nextLevel);
 const timeLabel=constructDays===1?'1 día':`${constructDays} días`;
 box.innerHTML=`<div><div><b>${escapeHtml(label)}</b></div><div class="mini">Coste: ${displayCost} 🔧${elecLabel} · ⏱ ${timeLabel} · ${blockReason?`<span style="color:var(--warn-bright)">${blockReason}</span> · `:''}${escapeHtml(def.effect||'')} · Nivel máx. ${maxLevel}</div></div><button ${blocked||atCap||state.materials<buildCost||!hasElec?'disabled':''}>${atCap?'Máximo':'Elegir'}</button>`;
 box.querySelector('button').addEventListener('click',()=>{
 if(blocked||atCap) return;
 const cost=getBuildingCost(def.id);
 const ingenieroBonus=getSkillBonus(s,'build');
 const finalCost=Math.max(1,cost-(ingenieroBonus.costReduction||0));
 if(state.materials<finalCost) return;
 if(extraElec>0&&getElectricityFree()<extraElec){ addLog('No hay suficiente electricidad libre.'); return; }
 state.materials-=finalCost;
 if(ingenieroBonus.costReduction) addLog(`⚙ ${s.name} (Ingeniero) reduce el coste en ${ingenieroBonus.costReduction} material.`);
 const days=getBuildingConstructionDays(def.id, nextLevel);
 if(getStabilityModifiers().extraBuildDays>0) addLog('⚠ La baja estabilidad del asentamiento ralentiza el trabajo. +1 día.');
 state.buildings[def.id]._constructionCost=finalCost;
 state.buildings[def.id]._lastConstructionCost=finalCost;
 state.buildings[def.id]._constructionDays=days;
 state.buildings[def.id]._constructionDaysLeft=days;
 state.buildings[def.id]._underConstruction=true;
 s.action={type:'construir',target:def.id};
 s.status='ocupado';
 const dayStr=days===1?'1 día':`${days} días`;
 addLog(`🔨 ${s.name} comienza a construir ${state.buildings[def.id].name}. -${finalCost} mat. Tiempo: ${dayStr}.`);
 modalWrap.classList.remove('open');
 render();
 });
 buildOptionsEl.appendChild(box);
 });
 modalWrap.classList.add('open');
 };

 function refuelVehicle(maxOnly=false){
 const vehicle=getVehicle();
 if(!garageReady()) return addLog('Necesitas un Garaje construido para repostar.');
 if(vehicleAway()) return addLog('El vehículo no está en el garaje.');
 const need=Math.max(0, vehicle.fuelCapacity-vehicle.fuelCurrent);
 if(need<=0) return addLog('El depósito ya está lleno.');
 const amount=Math.min(need, state.fuel, maxOnly?need:1);
 if(amount<=0) return addLog('No hay combustible en la base.');
 state.fuel-=amount;
 vehicle.fuelCurrent+=amount;
 addLog(`⛽ Repostas ${amount} punto${amount!==1?'s':''} de combustible al vehículo.`);
 render();
 if(state.currentDetail===GARAGE_ID) window.showBuildingDetail(GARAGE_ID);
 }
 function withdrawVehicleFuel(){
 const vehicle=getVehicle();
 if(!garageReady()) return addLog('Necesitas un Garaje construido para retirar combustible.');
 if(vehicleAway()) return addLog('El vehículo no está en el garaje.');
 const amount=Math.max(0, Number(vehicle.fuelCurrent||0));
 if(amount<=0) return addLog('El vehículo no tiene combustible almacenado.');
 vehicle.fuelCurrent=0;
 state.fuel+=amount;
 addLog(`⛽ Retiras ${amount} punto${amount!==1?'s':''} de combustible del vehículo a la base.`);
 render();
 if(state.currentDetail===GARAGE_ID) window.showBuildingDetail(GARAGE_ID);
 }
 function repairVehicle(all=false){
 const vehicle=getVehicle();
 if(!garageReady()) return addLog('Necesitas un Garaje construido para reparar el vehículo.');
 if(vehicleAway()) return addLog('El vehículo no está en el garaje.');
 const missing=Math.max(0, vehicle.maxCondition-vehicle.condition);
 if(missing<=0) return addLog('El vehículo no necesita reparaciones.');
 const desired=all?missing:1;
 const repaired=Math.min(desired, missing, Math.floor(Number(state.materials||0)));
 if(repaired<=0) return addLog('No tienes materiales suficientes para reparar el vehículo.');
 state.materials-=repaired;
 vehicle.condition+=repaired;
 addLog(`🔧 Reparas ${repaired} punto${repaired!==1?'s':''} del vehículo. (${vehicle.condition}/${vehicle.maxCondition})`);
 render();
 if(state.currentDetail===GARAGE_ID) window.showBuildingDetail(GARAGE_ID);
 }
 function improveVehicle(){
 const vehicle=getVehicle();
 if(!garageReady()||getGarageLevel()<2) return addLog('Necesitas el Garaje a nivel 2 para mejorar el vehículo.');
 if(vehicleAway()) return addLog('El vehículo no está en el garaje.');
 if(!vehicle.mejorable) return addLog('Este vehículo no se puede mejorar.');
 if(vehicle.upgraded) return addLog('Este vehículo ya ha recibido su mejora permanente.');
 if(Number(state.materials||0)<5) return addLog('Necesitas 5 materiales para mejorar el vehículo.');
 state.materials-=5;
 vehicle.maxCondition+=1;
 vehicle.condition=Math.min(vehicle.condition, vehicle.maxCondition);
 vehicle.upgraded=true;
 addLog(`🛠 El Garaje mejora permanentemente el vehículo. Estado máximo: ${vehicle.maxCondition}.`);
 render();
 if(state.currentDetail===GARAGE_ID) window.showBuildingDetail(GARAGE_ID);
 }

 function injectGarageDetail(){
 const box=document.getElementById('detailBox');
 const garage=getGarageBuilding();
 if(!box||!garage) return;
 const vehicle=getVehicle();
 const currentElec=garage.built ? window.getBuildingElectricityCost(GARAGE_ID, garage.level) : window.getBuildingElectricityCost(GARAGE_ID, 1);
 const panel=document.createElement('div');
 panel.style.cssText='margin-top:10px;border-top:1px solid var(--line2);padding-top:10px;display:grid;gap:6px;';
 panel.innerHTML=`
 <div class="metric"><span>Vehículo</span><b>${escapeHtml(vehicle.name)}</b></div>
 <div class="metric"><span>Pasajeros</span><b>${vehicle.passengers}</b></div>
 <div class="metric"><span>Carga</span><b>${vehicle.cargo}</b></div>
 <div class="metric"><span>Combustible</span><b>${vehicle.fuelCurrent}/${vehicle.fuelCapacity}</b></div>
 <div class="metric"><span>Estado</span><b>${vehicle.condition}/${vehicle.maxCondition} · ${escapeHtml(vehicleStatusLabel(vehicle))}</b></div>
 <div class="metric"><span>Electricidad usada</span><b>${garage.built?`${currentElec}⚡ permanentes`:'—'}</b></div>
 <div class="metric"><span>Disponibilidad</span><b>${escapeHtml(vehicleInUseText())}</b></div>
 <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
 <button class="btn secondary" id="garageRefuelOneBtn" ${!garage.built||garage._underConstruction||vehicleAway()||state.fuel<=0||vehicle.fuelCurrent>=vehicle.fuelCapacity?'disabled':''}>Repostar +1</button>
 <button class="btn secondary" id="garageRefuelFullBtn" ${!garage.built||garage._underConstruction||vehicleAway()||state.fuel<=0||vehicle.fuelCurrent>=vehicle.fuelCapacity?'disabled':''}>Llenar depósito</button>
 <button class="btn secondary" id="garageWithdrawFuelBtn" ${!garage.built||garage._underConstruction||vehicleAway()||vehicle.fuelCurrent<=0?'disabled':''}>Retirar combustible</button>
 <button class="btn amber" id="garageRepairOneBtn" ${!garage.built||garage._underConstruction||vehicleAway()||state.materials<=0||vehicle.condition>=vehicle.maxCondition?'disabled':''}>Reparar +1</button>
 <button class="btn amber" id="garageRepairAllBtn" ${!garage.built||garage._underConstruction||vehicleAway()||state.materials<=0||vehicle.condition>=vehicle.maxCondition?'disabled':''}>Reparar todo</button>
 <button class="btn primary" id="garageImproveBtn" ${!garage.built||garage._underConstruction||vehicleAway()||getGarageLevel()<2||!vehicle.mejorable||vehicle.upgraded||state.materials<5?'disabled':''}>Mejorar vehículo</button>
 <button class="btn primary" id="garageExpeditionBtn" ${!garage.built||garage._underConstruction||hasExteriorExpedition()?'disabled':''}>Preparar expedición</button>
 </div>`;
 box.appendChild(panel);
 document.getElementById('garageRefuelOneBtn')?.addEventListener('click',()=>refuelVehicle(false));
 document.getElementById('garageRefuelFullBtn')?.addEventListener('click',()=>refuelVehicle(true));
 document.getElementById('garageWithdrawFuelBtn')?.addEventListener('click',withdrawVehicleFuel);
 document.getElementById('garageRepairOneBtn')?.addEventListener('click',()=>repairVehicle(false));
 document.getElementById('garageRepairAllBtn')?.addEventListener('click',()=>repairVehicle(true));
 document.getElementById('garageImproveBtn')?.addEventListener('click',improveVehicle);
 document.getElementById('garageExpeditionBtn')?.addEventListener('click',()=>window.openTravelPopup());
 }

 window.showBuildingDetail=function(id){
 if(typeof legacy.showBuildingDetail==='function') legacy.showBuildingDetail(id);
 if(String(id)===GARAGE_ID || String(id)==='garage') injectGarageDetail();
 };

 window.getExteriorCampSurvivors=function(){
 return state.survivors.filter(s=>s&&s.status!=='muerto'&&s.location==='exterior');
 };
 window.getSurvivorsAtExteriorSite=function(){ return []; };
 window.getExteriorSiteLabel=function(siteId){
 if(!siteId) return 'Campamento exterior';
 const loc=getLocationByInstanceId(siteId);
 return loc?loc.name:'Objetivo exterior';
 };
 window.getEligibleExteriorSurvivors=function(locationId, mode='action'){
 return eligibleExteriorCampSurvivors({mode});
 };

 window.generateLocations=function(zoneOverride=null){
 state.locations=[];
 const templates=gameData.locationTemplates||[];
 if(!templates.length) return;
 const availableZones=getAvailableExteriorZones();
 const preferred=zoneOverride || getExteriorZoneById(state.expedition?.zoneId) || state.activeZone || null;
 const zone=(preferred && isExteriorZoneUnlocked(preferred)) ? preferred : (availableZones.length ? availableZones[Math.floor(Math.random()*availableZones.length)] : null);
 state.activeZone=zone||null;
 if(zone && restoreExteriorZoneSnapshot(zone.id)){
  touchExteriorPersistence();
  return;
 }
 const forcedTemplates=templates.filter(t=>t&&(
  t.alwaysSpawn===true ||
  t.fixedLocation===true ||
  t.exteriorFixed===true
 ));
 const forcedIds=new Set(forcedTemplates.map(t=>t.id));
 let picked=[...forcedTemplates];
 const randomTemplates=templates.filter(t=>!forcedIds.has(t?.id));
 if(zone&&zone.slots?.length){
  zone.slots.forEach(slot=>{
   const pool=randomTemplates.filter(t=>(t.riskLevel??0)===slot.riskLevel);
   for(let i=0;i<slot.count;i++){
    if(!pool.length){
     const fallback=[...randomTemplates].sort((a,b)=>Math.abs((a.riskLevel??0)-slot.riskLevel)-Math.abs((b.riskLevel??0)-slot.riskLevel));
     if(fallback.length) picked.push(fallback[0]);
    } else {
     picked.push(pool[Math.floor(Math.random()*pool.length)]);
    }
   }
  });
 } else {
  const shuffled=[...randomTemplates].sort(()=>Math.random()-0.5);
  picked=picked.concat(shuffled.slice(0,Math.min(7,shuffled.length)));
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
  Object.entries(tpl.resources||{}).forEach(([k,[min,max]])=>{ resources[k]=Math.floor(Math.random()*(max-min+1))+min; });
  const maxResources=deepClone(resources);
  const lootYield=normalizeResourceRangeMap(tpl.lootYield||tpl.resourceYield||tpl.lootPerAction||tpl.gatherPerAction||{});
  Object.keys(resources).forEach(key=>{ if(!lootYield[key]){ const fallbackMax=Math.max(1, Math.min(3, Number(maxResources[key]||1))); lootYield[key]=[1, fallbackMax]; } });
  const resourceMode=inferLocationResourceMode(tpl);
  const npcChance=Math.max(0, Math.min(1, Number(tpl.npcChance ?? tpl.npc?.chance ?? 0) || 0));
  const npcCandidates=(Array.isArray(tpl.npcEvents)?tpl.npcEvents:[]).filter(Boolean);
  const npcIdExplicit=tpl.npcId || tpl.npcEventId || tpl.npc?.id || tpl.npc?.eventId || null;
  const pickedNpcId=npcIdExplicit || (npcCandidates.length ? npcCandidates[Math.floor(Math.random()*npcCandidates.length)] : null);
  const hasNPC=!hasRaiders && !!pickedNpcId && (npcChance===0 || Math.random()<npcChance || tpl.npcAlways===true);
  const fixedX=Number.isFinite(Number(tpl.x)) ? Number(tpl.x) : (Number.isFinite(Number(tpl.position?.x)) ? Number(tpl.position.x) : null);
  const fixedY=Number.isFinite(Number(tpl.y)) ? Number(tpl.y) : (Number.isFinite(Number(tpl.position?.y)) ? Number(tpl.position.y) : null);
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
   hasNPC,
   npcId:hasNPC?pickedNpcId:null,
   npcPersistent:tpl.npcPersistent===true,
   npcLeavesAfterTalk:tpl.npcLeavesAfterTalk!==false,
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
   x:fixedX!==null?fixedX:positions[i].x,
   y:fixedY!==null?fixedY:positions[i].y,
  });
 });
 touchExteriorPersistence();
 };

 function openObserveExteriorPopup(locationId){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const survivors=eligibleExteriorCampSurvivors({mode:'observe'});
 if(!survivors.length){ addLog('No hay supervivientes disponibles en el campamento exterior para observar.'); return; }
 openLocationActionPopup({
 title:'👁 Observar edificio',
 info:`<b>${escapeHtml(loc.name)}</b> · Elige quién observa. Coste: -1 fatiga.`,
 survivors,
 confirmLabel:'Observar',
 onConfirm:(ids)=>window.observeExteriorLocation(locationId, ids)
 });
 }

 window.observeExteriorLocation=function(locationId, survivorIds){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const ids=Array.isArray(survivorIds)?survivorIds:[];
 if(!ids.length) return openObserveExteriorPopup(locationId);
 const selected=state.survivors.filter(s=>ids.includes(s.id)&&s.location==='exterior'&&canUseExteriorAction(s));
 if(!selected.length){ addLog('No hay supervivientes válidos para observar.'); return; }
 lockExteriorImmediateAction(selected,'observar_exterior',locationId);
 if(loc.status==='undiscovered'){
 loc.status='discovered';
 loc.observed=true;
 const hostiles=loc.hasRaiders?` Detectas ${loc.hostileLabel||'hostiles'}${loc.hostileStrength?` (fuerza ${loc.hostileStrength})`:''}.`:'';
 const npcText=loc.hasNPC?` Detectas presencia de ${findNpcDef(loc.npcId)?.name||'alguien'} en la zona.`:'';
 const resText=getLocationAvailableResourcesText(loc);
 addLog(`👁 ${selected.map(s=>s.name).join(', ')} observan ${loc.name}.${hostiles}${npcText}${resText?` ${resText.replace(/<[^>]+>/g,'')}.`:''}`);
 } else {
 addLog(`👁 ${selected.map(s=>s.name).join(', ')} revisan de nuevo ${loc.name}.`);
 }
 touchExteriorPersistence();
 render();
 renderExteriorMap();
 window.showLocationDetail(locationId);
 };

 window.openLootPopup=function(locationId){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const survivors=eligibleExteriorCampSurvivors({mode:'loot'});
 if(!survivors.length){ addLog('No hay supervivientes disponibles para saquear en esa ubicación.'); return; }
 openLocationActionPopup({
 title:'📦 Saquear ubicación',
 info:`<b>${escapeHtml(loc.name)}</b> · Elige 1 o más supervivientes para el saqueo. Coste: -1 fatiga. Los recursos irán al campamento exterior.`,
 survivors,
 confirmLabel:'Confirmar saqueo',
 onConfirm:(ids)=>window.lootLocation(locationId, ids)
 });
 };

 window.lootLocation=function(locationId, survivorIds){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const selected=state.survivors.filter(s=>survivorIds.includes(s.id)&&s.location==='exterior'&&canUseExteriorAction(s));
 if(!selected.length){ addLog('No hay supervivientes válidos para saquear.'); return; }
 if(loc.status==='undiscovered'){ addLog('Primero debes observar este edificio.'); return; }
 if(loc.hasRaiders){ addLog('Hay hostiles en esa ubicación. Primero debes atacar.'); return; }
 if(loc.resourceMode!=='fixed'&&(!hasAnyPositiveResources(loc.resources)||isLocationOnRespawnCooldown(loc))){
 addLog('No quedan recursos disponibles ahora mismo en esa ubicación.');
 return;
 }
 const gains=rollLocationLoot(loc);
 if(!hasAnyPositiveResources(gains)){ addLog('No se ha podido obtener nada útil en esta pasada.'); return; }
 lockExteriorImmediateAction(selected,'saquear_exterior',locationId);
 Object.entries(gains).forEach(([k, amount])=>{
 addCampResource(k, amount, `${selected.map(s=>s.name).join(', ')} saquean ${loc.name}`);
 if(loc.resourceMode!=='fixed') loc.resources[k]=Math.max(0, Number(loc.resources[k]||0)-amount);
 });
 selected.forEach(s=>{
 resolveExteriorRandomEncounter(s, locationId, `saquea ${loc.name}`);
 if(Math.random()<(loc.riskLevel||0)*0.10) injureSurvivor(s,`🩸 ${s.name} resulta {injuryLabel} saqueando ${loc.name}.`,{source:'combat'});
 });
 maybeDamageVehicleFromExterior(loc, selected);
 loc.status='explored';
 const depleted=loc.resourceMode!=='fixed' && !hasAnyPositiveResources(loc.resources);
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
 touchExteriorPersistence();
 render();
 renderExteriorMap();
 window.showLocationDetail(locationId);
 };

 window.openLocationRaiderAttack=function(locationId){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const survivors=eligibleExteriorCampSurvivors({mode:'attack'});
 if(!survivors.length){ addLog('No hay supervivientes disponibles para atacar.'); return; }
 openLocationActionPopup({
 title:'⚔ Atacar hostiles',
 info:`<b>${escapeHtml(loc.name)}</b> · Elige 1 o más supervivientes para atacar. Coste: -1 fatiga.`,
 survivors,
 confirmLabel:'Iniciar ataque',
 onConfirm:(ids)=>window.attackLocationRaiders(locationId, ids)
 });
 };

 window.attackLocationRaiders=function(locationId, survivorIds){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const selected=state.survivors.filter(s=>survivorIds.includes(s.id)&&s.location==='exterior'&&canUseExteriorAction(s,{requireBravery:true}));
 if(!selected.length){ addLog('No hay supervivientes válidos para atacar.'); return; }
 lockExteriorImmediateAction(selected,'atacar_exterior',locationId);
 const skillBonus=selected.reduce((sum,s)=>{
 const skills=getSurvivorSkills(s);
 return sum+(skills.includes('combatiente')?1:0)+(skills.includes('explorador')?1:0);
 },0);
 const atkRoll=roll(1,6);
 const defRoll=roll(1,4);
 const totalAtk=selected.length+skillBonus+atkRoll;
 const baseHostileStr=loc.hostileStrength||(loc.riskLevel||1)*2;
 const totalDef=baseHostileStr+defRoll;
 addLog(`⚔ ATAQUE: ${selected.length} atacantes +${skillBonus} habilidades +${atkRoll}(d6) = ${totalAtk}`);
 addLog(`⚔ ${loc.hostileLabel||'Hostiles'}: fuerza ${baseHostileStr} +${defRoll}(d4) = ${totalDef}`);
 const hostileDef=getHostileDef(loc.hostileType);
 const injBonus=hostileDef?.injuryChanceBonus||0;
 if(totalAtk>totalDef){
 const fleeChance=hostileDef?.fleeChance||0;
 const fled=fleeChance>0&&Math.random()<fleeChance;
 loc.hasRaiders=false;
 loc.hostileStrength=0;
 if(fled){
 addLog(`🏃 Los ${loc.hostileLabel||'hostiles'} huyen de ${loc.name}.`);
 applyLootList(hostileDef?.lootOnFlee||[], 'camp');
 openCombatResultPopup({title:'✅ Enemigos en retirada',icon:'🏃',text:`Los ${loc.hostileLabel||'hostiles'} huyen de ${loc.name}.`,summary:[`Resultado: ${totalAtk} vs ${totalDef}`],effects:(hostileDef?.lootOnFlee||[]).map(l=>`${Math.round((l.chance||0)*100)}%: +${(l.amount||[]).join('-')} ${resourceLabel(l.resource)}`)});
 } else {
 addLog(`✅ ${selected.map(s=>s.name).join(', ')} eliminan a los ${loc.hostileLabel||'hostiles'} de ${loc.name}.`);
 applyLootList(hostileDef?.lootOnVictory||[], 'camp');
 state.stability=Math.min(10,state.stability+1);
 openCombatResultPopup({title:'✅ Victoria en incursión',icon:'⚔',text:`${selected.map(s=>s.name).join(', ')} limpian ${loc.name} de hostiles.`,summary:[`Resultado: ${totalAtk} vs ${totalDef}`,'+1 estabilidad'],effects:(hostileDef?.lootOnVictory||[]).map(l=>`${Math.round((l.chance||0)*100)}%: +${(l.amount||[]).join('-')} ${resourceLabel(l.resource)}`)});
 }
 selected.forEach(s=>{ if(Math.random()<(0.20+injBonus)) injureSurvivor(s,`🩸 ${s.name} resulta {injuryLabel} combatiendo en ${loc.name}.`,{source:'combat'}); });
 } else {
 addLog(`❌ ${selected.map(s=>s.name).join(', ')} no consiguen limpiar ${loc.name}.`);
 selected.forEach(s=>injureSurvivor(s,`🩸 ${s.name} resulta {injuryLabel} en el combate de ${loc.name}.`,{source:'combat'}));
 openCombatResultPopup({title:'❌ Combate fallido',icon:'💥',text:`Los hostiles resisten en ${loc.name}.`,summary:[`Resultado: ${totalAtk} vs ${totalDef}`],effects:['Los atacantes sufren heridas.']});
 }
 maybeDamageVehicleFromExterior(loc, selected);
 touchExteriorPersistence();
 render();
 renderExteriorMap();
 window.showLocationDetail(locationId);
 };

 function openLocationTalkPopup(locationId){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 const survivors=eligibleExteriorCampSurvivors({mode:'talk'});
 if(!survivors.length){ addLog('No hay supervivientes disponibles para hablar.'); return; }
 openLocationActionPopup({
 title:'💬 Hablar',
 info:`<b>${escapeHtml(loc.name)}</b> · Elige quién se acerca a hablar. Coste: -1 fatiga.`,
 survivors,
 confirmLabel:'Hablar',
 onConfirm:(ids)=>talkToExteriorNpc(locationId, ids)
 });
 }

 function talkToExteriorNpc(locationId, survivorIds){
 const loc=state.locations.find(l=>l.instanceId===locationId);
 if(!loc) return;
 if(loc.status==='undiscovered'){ addLog('Primero debes observar este edificio.'); return; }
 if(loc.hasRaiders){ addLog('Hay hostiles en la zona. No puedes hablar mientras siga siendo peligrosa.'); return; }
 if(!loc.hasNPC||!loc.npcId){ addLog('No hay nadie con quien hablar en esa ubicación.'); return; }
 const selected=state.survivors.filter(s=>survivorIds.includes(s.id)&&s.location==='exterior'&&canUseExteriorAction(s));
 if(!selected.length){ addLog('No hay supervivientes válidos para hablar.'); return; }
 lockExteriorImmediateAction(selected,'hablar_exterior',locationId);
 const speaker=selected[0];
 const npc=findNpcDef(loc.npcId);
 const eventId=npc?.eventId || npc?.linkedEventId || loc.npcId;
 if(queueEventById(eventId, speaker)){
 consumeQueuedPriorityEvent();
 addLog(`💬 ${speaker.name} entabla conversación en ${loc.name}.`);
 }else{
 addLog(`💬 ${speaker.name} intenta hablar en ${loc.name}, pero no hay un evento asociado disponible todavía.`);
 }
 if(loc.npcLeavesAfterTalk && !loc.npcPersistent){
 loc.hasNPC=false;
 loc.npcId=null;
 }
 touchExteriorPersistence();
 render();
 renderExteriorMap();
 window.showLocationDetail(locationId);
 }

 function openExteriorCampRestPopup(){
 const survivors=eligibleExteriorCampSurvivors({mode:'rest'});
 if(!survivors.length){ addLog('No hay supervivientes disponibles para descansar en el campamento exterior.'); return; }
 openLocationActionPopup({
 title:'⛺ Descansar en campamento',
 info:'Elige quién descansa en el campamento exterior. Recuperarán la fatiga al final del día usando los recursos del campamento.',
 survivors,
 confirmLabel:'Asignar descanso',
 onConfirm:(ids)=>{
 const selected=state.survivors.filter(s=>ids.includes(s.id)&&s.location==='exterior'&&canUseExteriorAction(s,{allowForcedRest:true,allowZeroFatigue:true,allowLowMoraleRestOnly:true}));
 if(!selected.length){ addLog('No hay supervivientes válidos para descansar.'); return; }
 selected.forEach(s=>{
 s.action={type:'descansar_exterior',target:'camp'};
 s.status='ocupado';
 s._exteriorActionLocked=true;
 s._actionResolved=false;
 });
 addLog(`🛏 ${selected.map(s=>s.name).join(', ')} descansan en el campamento exterior.`);
 render();
 }
 });
 }

 function returnSurvivorsInstantly(ids){
 const names=[];
 ids.forEach(id=>{
 const s=state.survivors.find(x=>x.id===id&&x.location==='exterior');
 if(!s) return;
 s.location='base';
 s.travelDest=null;
 s.travelArrivalDay=null;
 s.travelReturnDay=null;
 s.status='activo';
 s.action=null;
 s.exteriorSiteId=null;
 delete s._returnOnFoot;
 names.push(s.name);
 });
 if(names.length){
 addLog(`🏠 ${names.join(', ')} regresan a la base.`);
 const stillOutside=state.survivors.filter(x=>x.status!=='muerto'&&x.location==='exterior').length;
 if(stillOutside===0) transferCampInventoryToBase();
 }
 }

 window.openTravelPopup=function(survivorId=null, presetLocationId=null){
 ensureVehicleState();
 const popup=document.getElementById('travelPopup');
 const info=document.getElementById('travelDestInfo');
 const list=document.getElementById('travelSurvivorList');
 const confirmBtn=document.getElementById('travelConfirm');
 const foodInput=document.getElementById('travelFood');
 const medsInput=document.getElementById('travelMeds');
 const fuelInput=document.getElementById('travelFuel');
 const materialsInput=document.getElementById('travelMaterials');
 const foodLabel=document.getElementById('travelFoodLabel');
 const medsLabel=document.getElementById('travelMedsLabel');
 const fuelLabel=document.getElementById('travelFuelLabel');
 const materialsLabel=document.getElementById('travelMaterialsLabel');
 if(!popup||!info||!list||!confirmBtn) return;
 const eligible=eligibleBaseTravelers();
 const zones=getAvailableExteriorZones(true);
 const unlockedZones=zones.filter(isExteriorZoneUnlocked);
 let selectedZoneId=String((state.activeZone && isExteriorZoneUnlocked(state.activeZone) ? state.activeZone.id : unlockedZones[0]?.id)||'');
 const vehicle=getVehicle();
 const selectedIds=new Set();
 if(survivorId && eligible.some(s=>s.id===survivorId)) selectedIds.add(survivorId);

 function getCurrentZone(){ return getExteriorZoneById(selectedZoneId) || null; }
 function getDisabledReason(zone){
 const cfg=zoneTravelConfig(zone);
 const usingVehicle=zoneNeedsVehicle(zone);
 if(hasExteriorExpedition()) return 'Ya hay una expedición exterior en curso.';
 if(!zone) return 'No hay una zona exterior disponible.';
 if(!isExteriorZoneUnlocked(zone)) return getExteriorZoneUnlockReason(zone);
 if(usingVehicle && !garageReady()) return 'Necesitas un Garaje construido para viajar a esta zona.';
 if(usingVehicle && Number(vehicle.condition||0)<=0) return 'El vehículo está inutilizado.';
 if(usingVehicle && Number(vehicle.fuelCurrent||0)<cfg.fuelCost) return `El vehículo necesita ${cfg.fuelCost} combustible para la ida.`;
 return '';
 }
 function refreshTravelSupplyUI(){
 const zone=getCurrentZone();
 const cfg=zoneTravelConfig(zone);
 const usingVehicle=zoneNeedsVehicle(zone);
 const capacity=usingVehicle ? vehicle.passengers : eligible.length;
 const selectedCount=selectedIds.size;
 const tooMany=usingVehicle && selectedCount>capacity;
 const disabledReason=getDisabledReason(zone);
 const maxFood=selectedCount*5;
 const maxMeds=selectedCount*5;
 const maxFuel=selectedCount*2;
 const maxMaterials=(selectedCount*2) + (usingVehicle ? Number(vehicle.cargo||0) : 0);
 if(foodInput){ const max=Math.min(state.food,maxFood); foodInput.max=String(max); if(Number(foodInput.value||0)>max) foodInput.value=String(max); }
 if(medsInput){ const max=Math.min(state.meds,maxMeds); medsInput.max=String(max); if(Number(medsInput.value||0)>max) medsInput.value=String(max); }
 if(fuelInput){ const max=Math.min(state.fuel,maxFuel); fuelInput.max=String(max); if(Number(fuelInput.value||0)>max) fuelInput.value=String(max); }
 if(materialsInput){ const max=Math.min(state.materials,maxMaterials); materialsInput.max=String(max); if(Number(materialsInput.value||0)>max) materialsInput.value=String(max); }
 if(foodLabel) foodLabel.innerHTML=`🍽 COMIDA (disp.: <span id="travelFoodAvail">${state.food}</span> · máx.: ${maxFood})`;
 if(medsLabel) medsLabel.innerHTML=`💊 MEDS (disp.: <span id="travelMedsAvail">${state.meds}</span> · máx.: ${maxMeds})`;
 if(fuelLabel) fuelLabel.innerHTML=`⛽ COMBUSTIBLE (disp.: <span id="travelFuelAvail">${state.fuel}</span> · máx.: ${maxFuel})`;
 if(materialsLabel) materialsLabel.innerHTML=`🔧 MATERIALES (disp.: <span id="travelMaterialsAvail">${state.materials}</span> · máx.: ${maxMaterials}${usingVehicle?` · +${vehicle.cargo} por vehículo`:''})`;
 const travelModeText = usingVehicle
 ? `🚗 Vehículo: ${escapeHtml(vehicle.name)} · Plazas ${vehicle.passengers} · Carga +${vehicle.cargo} materiales · Combustible ${vehicle.fuelCurrent}/${vehicle.fuelCapacity} · Estado ${vehicle.condition}/${vehicle.maxCondition}`
 : '🥾 Se puede llegar andando a esta zona.';
 const arrivalText = cfg.travelDays===0 ? 'Llegada inmediata' : `Llegada: día ${state.day+cfg.travelDays}`;
 const options=zones.map(zoneItem=>`<option value="${escapeAttr(zoneItem.id)}" ${String(zoneItem.id)===String(selectedZoneId)?'selected':''} ${isExteriorZoneUnlocked(zoneItem)?'':'disabled'}>${escapeHtml(zoneItem.name)}${isExteriorZoneUnlocked(zoneItem)?'':` — ${escapeHtml(getExteriorZoneUnlockReason(zoneItem))}`}</option>`).join('');
 info.innerHTML=`<div style="display:grid;gap:8px;"><div><label style="font-size:10px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:0.08em;text-transform:uppercase;">Destino</label><select id="travelZoneSelect" style="width:100%;padding:7px 10px;border:1px solid var(--line2);background:var(--panel2);color:var(--text);">${options}</select></div><div><b>${escapeHtml(zone?.name||'Exterior')}</b> · ${arrivalText}<br>${travelModeText}<br>Ida: ${cfg.fuelCost}⛽ · Vuelta prevista: ${cfg.fuelCost}⛽${disabledReason?`<br><span style="color:var(--danger-bright)">${escapeHtml(disabledReason)}</span>`:''}${tooMany?`<br><span style="color:var(--danger-bright)">Has seleccionado más supervivientes que plazas (${capacity}).</span>`:''}</div></div>`;
 document.getElementById('travelZoneSelect')?.addEventListener('change',e=>{ selectedZoneId=String(e.target.value||''); refreshTravelSupplyUI(); });
 confirmBtn.disabled=!!disabledReason || selectedCount===0 || tooMany;
 }

 list.innerHTML='';
 eligible.forEach(s=>{
 const item=document.createElement('div');
 item.style.cssText='display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;padding:8px;border:1px solid var(--line2);background:var(--panel2);cursor:pointer;transition:border-color 0.15s, background 0.15s;';
 item.innerHTML=`<div style="width:40px;height:40px;overflow:hidden;border:1px solid var(--line2);">${getSurvivorImage(s)?`<img src="${escapeAttr(getSurvivorImage(s))}" style="width:100%;height:100%;object-fit:cover;">`:''}</div><div><div style="font-family:var(--font-display);font-size:13px;">${escapeHtml(s.name)}</div><div style="font-size:10px;color:var(--muted);">⚡ ${s.fatigue}/${s.maxFatigue} · ${getMoraleEmoji(s)} ${getMoraleLabel(s,false)}</div></div><div style="font-size:18px;color:${selectedIds.has(s.id)?'var(--ok-bright)':'var(--muted)'};" data-check="${s.id}">${selectedIds.has(s.id)?'●':'○'}</div>`;
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
 refreshTravelSupplyUI();
 };
 item.addEventListener('click',toggle);
 if(selectedIds.has(s.id)){
 item.style.borderColor='var(--ok)';
 item.style.background='rgba(74,138,53,0.08)';
 }
 list.appendChild(item);
 });
 confirmBtn.textContent='Enviar expedición';
 confirmBtn.style.display='inline-flex';
 [foodInput,medsInput,fuelInput,materialsInput].forEach(input=>{ if(input) input.oninput=refreshTravelSupplyUI; });
 refreshTravelSupplyUI();
 confirmBtn.onclick=()=>{
 if(confirmBtn.disabled) return;
 window.travelGroupToZone([...selectedIds], presetLocationId||'exterior', selectedZoneId);
 popup.classList.remove('open');
 render();
 renderExteriorMap();
 };
 popup.classList.add('open');
 };

 window.travelGroupToZone=function(survivorIds, locationId, zoneIdOverride=null){
 ensureVehicleState();
 const ids=(Array.isArray(survivorIds)?survivorIds:[survivorIds]).filter(Boolean);
 if(!ids.length) return;
 if(hasExteriorExpedition()){ addLog('Ya hay una expedición exterior en curso.'); return; }
 const zone=getExteriorZoneById(zoneIdOverride) || state.activeZone;
 if(!zone){ addLog('No hay una zona exterior disponible ahora mismo.'); return; }
 if(!isExteriorZoneUnlocked(zone)){ addLog(getExteriorZoneUnlockReason(zone)); return; }
 const cfg=zoneTravelConfig(zone);
 const usingVehicle=zoneNeedsVehicle(zone);
 const vehicle=getVehicle();
 const selected=state.survivors.filter(s=>ids.includes(s.id)&&s.location==='base'&&s.status==='activo'&&s.status!=='muerto'&&(s.negativeSkill||'').toLowerCase().trim()!=='miedoso');
 if(!selected.length){ addLog('No hay supervivientes válidos para viajar.'); return; }
 if(usingVehicle){
 if(!garageReady()) return addLog('Necesitas un Garaje construido para viajar a esa zona.');
 if(Number(vehicle.condition||0)<=0) return addLog('El vehículo está inutilizado.');
 if(selected.length>vehicle.passengers) return addLog(`El vehículo solo tiene ${vehicle.passengers} plaza${vehicle.passengers!==1?'s':''}.`);
 if(Number(vehicle.fuelCurrent||0)<cfg.fuelCost) return addLog(`El vehículo necesita ${cfg.fuelCost} combustible para la ida.`);
 vehicle.fuelCurrent=Math.max(0, Number(vehicle.fuelCurrent||0)-cfg.fuelCost);
 }
 ensureCampInventory();
 const requestedFood=Number(document.getElementById('travelFood')?.value||0);
 const requestedMeds=Number(document.getElementById('travelMeds')?.value||0);
 const requestedFuel=Number(document.getElementById('travelFuel')?.value||0);
 const requestedMaterials=Number(document.getElementById('travelMaterials')?.value||0);
 const maxFood=selected.length*5;
 const maxMeds=selected.length*5;
 const maxFuel=selected.length*2;
 const maxMaterials=(selected.length*2) + (usingVehicle ? Number(vehicle.cargo||0) : 0);
 const foodToTake=Math.min(requestedFood, state.food, maxFood);
 const medsToTake=Math.min(requestedMeds, state.meds, maxMeds);
 const fuelToTake=Math.min(requestedFuel, state.fuel, maxFuel);
 const materialsToTake=Math.min(requestedMaterials, state.materials, maxMaterials);
 if(foodToTake>0){ state.food-=foodToTake; state.camp.food+=foodToTake; }
 if(medsToTake>0){ state.meds-=medsToTake; state.camp.meds+=medsToTake; }
 if(fuelToTake>0){ state.fuel-=fuelToTake; state.camp.fuel+=fuelToTake; }
 if(materialsToTake>0){ state.materials-=materialsToTake; state.camp.materials+=materialsToTake; }
 state.expedition={zoneId:zone.id||null,returnFuelCost:cfg.fuelCost,returnTravelDays:cfg.travelDays,usingVehicle};
 const movedNames=[];
 const packed=[];
 if(foodToTake>0) packed.push(`${foodToTake} comida`);
 if(medsToTake>0) packed.push(`${medsToTake} meds`);
 if(fuelToTake>0) packed.push(`${fuelToTake} combustible`);
 if(materialsToTake>0) packed.push(`${materialsToTake} materiales`);
 if(cfg.travelDays===0){
 window.generateLocations(zone);
 state.activeZone=zone;
 selected.forEach(s=>{
 s.location='exterior';
 s.travelDest=null;
 s.travelArrivalDay=null;
 s.travelReturnDay=null;
 s.exteriorSiteId=null;
 s.status='activo';
 s.action=null;
 movedNames.push(s.name);
 });
 syncExteriorHubModel();
 if(packed.length) addLog(`🎒 La expedición lleva ${packed.join(', ')} al campamento.`);
 addLog(`🧭 ${movedNames.join(', ')} parten hacia ${zone.name}. Llegan automáticamente al campamento exterior.`);
 render();
 renderExteriorMap();
 return;
 }
 selected.forEach(s=>{
 s.location='travelling';
 s.travelDest='exterior';
 s.travelArrivalDay=state.day+cfg.travelDays;
 s.travelReturnDay=null;
 s.exteriorSiteId=null;
 s.status='ocupado';
 s.action={type:'viajar',target:zone.id||'exterior'};
 movedNames.push(s.name);
 });
 if(packed.length) addLog(`🎒 La expedición lleva ${packed.join(', ')} al campamento.`);
 addLog(`🧭 ${movedNames.join(', ')} parten hacia ${zone.name}. Llegarán el día ${state.day+cfg.travelDays}.`);
 };
 window.travelToZone=function(survivorId, locationId){ window.travelGroupToZone([survivorId], locationId); };
 window.sendOnExpedition=window.travelToZone;

 window.openTravelReturnPopup=function(locationOrSurvivorId){
 ensureVehicleState();
 const survivors=eligibleExteriorCampSurvivors({mode:'return'});
 if(!survivors.length){ addLog('No hay supervivientes disponibles en el campamento exterior para volver.'); return; }
 const zone=state.activeZone;
 const cfg={fuelCost:Math.max(0, Number(state.expedition?.returnFuelCost ?? zoneTravelConfig(zone).fuelCost)||0), travelDays:Math.max(0, Number(state.expedition?.returnTravelDays ?? zoneTravelConfig(zone).travelDays)||0)};
 const vehicle=getVehicle();
 const expeditionUsesVehicle=!!state.expedition?.usingVehicle;
 const canUseVehicle=expeditionUsesVehicle && Number(vehicle.condition||0)>0 && Number(vehicle.fuelCurrent||0)>=cfg.fuelCost;
 const mustWalk=expeditionUsesVehicle && !canUseVehicle;
 const returnDays=mustWalk ? Math.max(1, cfg.travelDays+1) : cfg.travelDays;
 const infoText=mustWalk
 ? `<b>Campamento exterior</b> · El vehículo no puede usarse. El regreso será andando: ${returnDays===0?'inmediato':`${returnDays} día${returnDays!==1?'s':''}`} · <span style="color:var(--danger-bright)">-4 moral al grupo</span>`
 : `<b>Campamento exterior</b> · Regreso ${returnDays===0?'inmediato':`${returnDays} día${returnDays!==1?'s':''}`} · Coste: ${cfg.fuelCost}⛽${expeditionUsesVehicle?` · Vehículo ${vehicle.fuelCurrent}/${vehicle.fuelCapacity}`:''}`;
 openLocationActionPopup({
 title:'↩ Volver a base',
 info:infoText,
 survivors,
 confirmLabel:'Iniciar regreso',
 onConfirm:(ids)=>{
 const selected=state.survivors.filter(s=>ids.includes(s.id)&&s.location==='exterior'&&!s._exteriorActionLocked&&!hasLowMoraleRestRestriction(s)&&s.status!=='ocupado');
 if(!selected.length) return addLog('No hay supervivientes válidos para volver.');
 if(!mustWalk && expeditionUsesVehicle) vehicle.fuelCurrent=Math.max(0, Number(vehicle.fuelCurrent||0)-cfg.fuelCost);
 if(mustWalk){
 selected.forEach(s=>{ adjustSurvivorMorale(s,-4); s._returnOnFoot=true; });
 addLog(`🥾 La expedición regresa andando a la base. +1 día de viaje y -4 moral para el grupo.`);
 }
 if(returnDays===0){
 returnSurvivorsInstantly(ids);
 render();
 renderExteriorMap();
 return;
 }
 const names=[];
 selected.forEach(s=>{
 s.location='travelling';
 s.travelDest='base';
 s.travelReturnDay=state.day+returnDays;
 s.travelArrivalDay=null;
 s.status='ocupado';
 s.action={type:'regresar',target:'base'};
 names.push(s.name);
 });
 addLog(`🧭 ${names.join(', ')} emprenden el regreso a la base. Llegarán el día ${state.day+returnDays}.`);
 render();
 renderExteriorMap();
 }
 });
 };

 window.resolveTravelMovement=function(){
 if(typeof legacy.resolveTravelMovement==='function') legacy.resolveTravelMovement();
 state.survivors.forEach(s=>{
 if(s.location==='base'){ delete s._returnOnFoot; s.exteriorSiteId=null; }
 if(s.location==='exterior') s.exteriorSiteId=null;
 });
 syncExteriorHubModel();
 touchExteriorPersistence();
 };

 window.showLocationDetail=function(instanceId){
 const loc=state.locations.find(l=>l.instanceId===instanceId);
 const detailBox=document.getElementById('detailBox');
 if(!loc||!detailBox) return;
 state.currentDetail='location_'+instanceId;
 const riskLabel=['✅ Seguro','⚠ Bajo','⚠⚠ Medio','⚠⚠⚠ Alto','💀 Extremo'][Math.min(loc.riskLevel||0,4)];
 const campSurvivors=window.getExteriorCampSurvivors();
 const travellingHere=state.survivors.filter(s=>s.travelDest==='exterior'&&s.location==='travelling');
 const canTravelFromBase=!hasExteriorExpedition() ? eligibleBaseTravelers() : [];
 const vehicle=getVehicle();
 const zoneCfg=zoneTravelConfig(state.activeZone);
 const statusMeta=getLocationStatusMeta(loc);
 let html=`<div class="loc-detail-header">${loc.status==='undiscovered'?'❓ Edificio no observado':loc.icon+' '+escapeHtml(loc.name)}</div>`;
 html+=`<div class="loc-risk">${riskLabel} · Zona exterior: ${escapeHtml(getExteriorZoneName())}</div>`;
 html+=`<div style="font-size:11px;color:${statusMeta.color};margin-bottom:6px;">${statusMeta.text}</div>`;
 if(loc.status!=='undiscovered'&&loc.description){ html+=`<div style="font-size:11px;color:var(--text);margin-bottom:6px;line-height:1.5;">${escapeHtml(loc.description)}</div>`; }
 if(loc.hasRaiders&&loc.status!=='undiscovered'){
 const hLabel=loc.hostileLabel||'Hostiles';
 const hStr=loc.hostileStrength?` · Fuerza: ${loc.hostileStrength}`:'';
 html+=`<div style="color:var(--danger-bright);font-size:11px;margin-bottom:6px;border-left:2px solid var(--danger);padding-left:6px;">⚔ ${escapeHtml(hLabel)}${hStr}. Solo puede atacarse esta ubicación.</div>`;
 }
 if(loc.status!=='undiscovered'){
 const resText=getLocationAvailableResourcesText(loc);
 if(resText) html+=`<div style="font-size:11px;margin-bottom:6px;">${resText}</div>`;
 else if(loc.resourceMode==='respawn'&&isLocationOnRespawnCooldown(loc)) html+=`<div style="font-size:11px;color:var(--amber-bright);margin-bottom:6px;">⏳ Reposición en ${getLocationRespawnDaysLeft(loc)} día${getLocationRespawnDaysLeft(loc)!==1?'s':''}.</div>`;
 else if(loc.resourceMode!=='fixed') html+=`<div style="font-size:11px;color:var(--dim);margin-bottom:6px;">No quedan recursos ahora mismo.</div>`;
 }
 if(loc.status!=='undiscovered'&&loc.hasNPC&&!loc.hasRaiders){
 const npc=findNpcDef(loc.npcId);
 html+=`<div style="font-size:11px;color:var(--accent-bright);margin-bottom:6px;">💬 Presencia detectada: ${escapeHtml(npc?.name||loc.npcId||'NPC')}</div>`;
 }
 html+=`<div style="font-size:11px;color:var(--ok-bright);margin-bottom:6px;">⛺ En campamento exterior: ${campSurvivors.length?campSurvivors.map(s=>escapeHtml(s.name)).join(', '):'Nadie'}</div>`;
 if(travellingHere.length){ html+=`<div style="font-size:11px;color:var(--amber-bright);margin-bottom:6px;">🧭 En camino al exterior: ${travellingHere.map(s=>escapeHtml(s.name)+' (día '+s.travelArrivalDay+')').join(', ')}</div>`; }
 html+=`<div style="font-size:11px;color:var(--muted);margin-bottom:6px;">🚗 Vehículo: ${escapeHtml(vehicle.name)} · ${vehicle.fuelCurrent}/${vehicle.fuelCapacity}⛽ · Estado ${vehicle.condition}/${vehicle.maxCondition}</div>`;
 html+=`<div class="loc-actions" id="locActions"></div>`;
 detailBox.innerHTML=html;
 openBuildingPopup();
 const actionsEl=document.getElementById('locActions');
 if(!actionsEl) return;
 const campBtn=document.createElement('button');
 campBtn.className='btn secondary';
 campBtn.innerHTML='⛺ Campamento exterior';
 campBtn.onclick=()=>openExteriorVehicleDetail();
 actionsEl.appendChild(campBtn);
 const travelBtn=document.createElement('button');
 travelBtn.className='btn primary';
 travelBtn.innerHTML=`🧭 Viajar a ${escapeHtml(getExteriorZoneName())}`;
 travelBtn.disabled=!canTravelFromBase.length;
 travelBtn.title=!canTravelFromBase.length ? (hasExteriorExpedition()?'Ya hay una expedición exterior activa.':'Sin supervivientes disponibles en base') : `Ida: ${zoneCfg.fuelCost}⛽ · ${zoneCfg.travelDays===0?'inmediato':zoneCfg.travelDays+' día(s)'}`;
 travelBtn.onclick=()=>window.openTravelPopup(null, instanceId);
 actionsEl.appendChild(travelBtn);
 if(loc.status==='undiscovered'){
 const observeBtn=document.createElement('button');
 observeBtn.className='btn amber';
 observeBtn.innerHTML='👁 Observar';
 observeBtn.disabled=!campSurvivors.length;
 observeBtn.title=!campSurvivors.length?'Necesitas supervivientes en el campamento exterior para observar':'Coste: -1 fatiga';
 observeBtn.onclick=()=>openObserveExteriorPopup(instanceId);
 actionsEl.appendChild(observeBtn);
 return;
 }
 if(loc.hasRaiders){
 const attackBtn=document.createElement('button');
 attackBtn.className='btn danger';
 attackBtn.innerHTML='⚔ Atacar';
 attackBtn.disabled=!campSurvivors.length;
 attackBtn.title=!campSurvivors.length?'No hay supervivientes en el campamento exterior':'Coste: -1 fatiga';
 attackBtn.onclick=()=>window.openLocationRaiderAttack(instanceId);
 actionsEl.appendChild(attackBtn);
 return;
 }
 const lootBtn=document.createElement('button');
 lootBtn.className='btn amber';
 lootBtn.innerHTML='📦 Saquear';
 const lootBlocked = !campSurvivors.length || (loc.resourceMode!=='fixed' && (!hasAnyPositiveResources(loc.resources) || isLocationOnRespawnCooldown(loc)));
 lootBtn.disabled=lootBlocked;
 lootBtn.title=!campSurvivors.length?'No hay supervivientes en el campamento exterior':'Coste: -1 fatiga';
 lootBtn.onclick=()=>window.openLootPopup(instanceId);
 actionsEl.appendChild(lootBtn);
 if(loc.hasNPC){
 const talkBtn=document.createElement('button');
 talkBtn.className='btn secondary';
 talkBtn.innerHTML='💬 Hablar';
 talkBtn.disabled=!campSurvivors.length;
 talkBtn.title=!campSurvivors.length?'No hay supervivientes en el campamento exterior':'Coste: -1 fatiga';
 talkBtn.onclick=()=>openLocationTalkPopup(instanceId);
 actionsEl.appendChild(talkBtn);
 }
 };

 function injectExteriorCampControls(){
 if(activeMapTab!=='exterior') return;
 const survivorListEl=document.getElementById('survivorList');
 if(!survivorListEl) return;
 survivorListEl.querySelector('[data-exterior-camp-actions]')?.remove();
 const firstChild=survivorListEl.firstElementChild;
 if(firstChild && !firstChild.classList.contains('survivor-card')) firstChild.remove();
 const extCount=window.getExteriorCampSurvivors().length;
 const vehicle=getVehicle();
 const summaryText=String(getExteriorInventorySummaryHtml()||'Sin carga')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/g,' ')
  .replace(/\s+/g,' ')
  .trim();
 const host=document.createElement('div');
 host.className='survivor-card';
 host.dataset.exteriorCampActions='1';
 host.dataset.vehicleCard='1';
 host.style.setProperty('width','193px','important');
 host.style.setProperty('min-width','193px','important');
 host.style.setProperty('max-width','193px','important');
 host.style.setProperty('height','329px','important');
 host.style.setProperty('min-height','329px','important');
 host.style.setProperty('max-height','329px','important');
 host.style.setProperty('flex','0 0 193px','important');
 host.style.setProperty('display','flex','important');
 host.style.setProperty('flex-direction','column','important');
 host.style.setProperty('gap','6px','important');
 host.style.setProperty('padding','8px','important');
 host.style.setProperty('border-left','1px solid var(--line2)','important');
 host.style.setProperty('background','linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))','important');
 host.style.setProperty('box-shadow','0 0 0 1px rgba(114,196,78,0.04) inset','important');
 host.innerHTML=`
 <div class="avatar" style="width:100%;height:auto;aspect-ratio:1/1;clip-path:none;border-color:var(--line2);overflow:hidden;background:var(--panel2);">
   <img src="data/pic/coche.jpg" alt="${escapeHtml(vehicle.name||'Vehículo')}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none'; this.parentNode.innerHTML='<div style=&quot;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:42px;color:var(--muted);&quot;>🚗</div>'">
 </div>
 <div class="survivor-head-row" style="display:flex;align-items:flex-start;justify-content:space-between;gap:4px;">
   <div class="survivor-name-wrap" style="display:flex;align-items:center;gap:4px;min-width:0;flex:1 1 auto;">
     <div class="survivor-name" style="font-size:11px;line-height:1.15;min-height:auto;color:var(--amber-bright);white-space:normal;overflow:visible;text-overflow:unset;flex:1 1 auto;">${escapeHtml(vehicle.name||'Vehículo')}</div>
   </div>
   <div class="badge activo" style="align-self:auto;font-size:9px;padding:2px 6px;margin-left:auto;">Vehículo</div>
 </div>
 <div class="survivor-meta-line" style="display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:4px;min-height:14px;font-size:10px;color:var(--muted);">
   <span class="meta-fatigue" style="white-space:nowrap;">⛽ ${vehicle.fuelCurrent}/${vehicle.fuelCapacity}</span>
   <span class="meta-morale" style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;">🛠 ${vehicle.condition}/${vehicle.maxCondition}</span>
 </div>
 <div class="survivor-health-line ok" style="min-height:56px;padding:6px;border:1px solid var(--line2);background:rgba(74,138,53,0.04);font-size:9px;line-height:1.4;color:var(--text);overflow:hidden;display:flex;align-items:flex-start;">📦 ${escapeHtml(getExteriorInventorySummaryText())}</div>
 <div class="survivor-slot-grid" style="width:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:auto;">
   <button class="survivor-slot inv-btn" id="campInventoryExteriorBtn" title="Inventario" style="width:100%;min-width:0;height:26px;font-size:14px;">📦</button>
   <button class="survivor-slot future-btn" id="campVehicleStatusBtn" title="Estado del coche" style="width:100%;min-width:0;height:26px;font-size:14px;">🚗</button>
   <button class="survivor-slot future-btn" id="campReturnBaseBtn" title="Regresar a base" ${extCount?'':'disabled'} style="width:100%;min-width:0;height:26px;font-size:14px;">↩</button>
   <button class="survivor-slot future-btn empty" id="campReservedExteriorBtn" title="Reservado" style="width:100%;min-width:0;height:26px;font-size:14px;">◻</button>
 </div>`;
 survivorListEl.prepend(host);
 host.querySelector('#campInventoryExteriorBtn')?.addEventListener('click',openExteriorVehicleInventory);
 host.querySelector('#campVehicleStatusBtn')?.addEventListener('click',openExteriorVehicleStatus);
 host.querySelector('#campReturnBaseBtn')?.addEventListener('click',()=>window.openTravelReturnPopup('exterior'));
 }

 window.renderSurvivors=function(){
 if(typeof legacy.renderSurvivors==='function') legacy.renderSurvivors();
 injectExteriorCampControls();
 };

 const originalRender=window.render;
 window.render=function(){
 if(typeof originalRender==='function') originalRender();
 ensureVehicleState();
 if(state.activeZone?.id) touchExteriorPersistence();
 };

 const originalCheckBuildingUnlocks = window.checkBuildingUnlocks;
 if(typeof originalCheckBuildingUnlocks==='function'){
 window.checkBuildingUnlocks=function(buildTarget){
 originalCheckBuildingUnlocks(buildTarget);
 ensureVehicleState();
 };
 }

 const oldBeginGameInit = window.initGame;
 window.initGame=function(){
 const ok=typeof legacy.initGame==='function' ? legacy.initGame.apply(this, arguments) : false;
 if(ok!==false){
 ensureVehicleState();
 syncExteriorHubModel();
 if(!state.expedition||typeof state.expedition!=='object') state.expedition={zoneId:null,returnFuelCost:0,returnTravelDays:0,usingVehicle:false};
 render();
 }
 return ok;
 };

 window.getVehicle=getVehicle;
 window.getGarageBuilding=getGarageBuilding;
 window.getGarageLevel=getGarageLevel;
 window.garageReady=garageReady;
 window.vehicleAway=vehicleAway;
 window.hasExteriorExpedition=hasExteriorExpedition;
 window.vehicleStatusLabel=vehicleStatusLabel;
 window.vehicleInUseText=vehicleInUseText;
 window.applyVehicleDamage=applyVehicleDamage;
 window.maybeDamageVehicleFromExterior=maybeDamageVehicleFromExterior;

 setTimeout(()=>{
 try{
 if(state && Array.isArray(state.survivors) && state.survivors.length){
 ensureVehicleState();
 syncExteriorHubModel();
 render();
 }
 }catch(_e){}
 },0);
})();