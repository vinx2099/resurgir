const DEFAULT_BASE_UPGRADES=[
 {id:'electric_fence',name:'Electrificar muro',cost:4,requires:['muros','generador'],devDays:2,description:'Consume 1⚡ y aporta +1 defensa al asentamiento.',effects:{defenseBonus:1,needsElectricity:true}},
 {id:'auto_irrigation',name:'Riego automático',cost:3,requires:['huerto','pozo'],devDays:2,description:'El Huerto produce +1 comida adicional al día.',effects:{farmFoodBonus:1}},
 {id:'biodiesel',name:'Biodiésel',cost:5,requires:['generador'],devDays:2,description:'El Generador gana +1 de capacidad eléctrica. Preparado para futuros vehículos.',effects:{generatorCapacityBonus:1}}
];

const BUILDING_REQUIREMENT_ALIASES={muro:'muros'};

const DEFAULT_GALLINERO_CONFIG={
 startingChickens:0,
 maxChickens:10,
 foodByChickenCount:[
 {min:0,max:1,food:0},
 {min:2,max:2,food:1},
 {min:3,max:6,food:2},
 {min:7,max:10,food:3}
 ],
 sacrifice:{chickensCost:1,foodGain:2}
};


const FARM_MODE_NONE='none';
const FARM_MODE_A='cultivo_a';
const FARM_MODE_B='cultivo_b';

function ensureFarmState(){
 const farm=state.buildings?.huerto;
 if(!farm) return null;
 if(!farm.farmMode) farm.farmMode=FARM_MODE_NONE;
 return farm;
}

function getFarmModeLabel(mode){
 const clean=String(mode||FARM_MODE_NONE).trim().toLowerCase();
 if(clean===FARM_MODE_A) return 'Cultivo A';
 if(clean===FARM_MODE_B) return 'Cultivo B';
 return 'Sin mejora';
}

function isFarmBHarvestDay(day=state.day){
 const current=Math.max(1, Number(day||state.day||1) || 1);
 return current % 2 === 0;
}

function getFarmProductionBase(building=state.buildings?.huerto, day=state.day){
 const farm=building||state.buildings?.huerto;
 if(!farm?.built||!farm?.active) return 0;
 const level=Math.max(0, Number(farm.level||0) || 0);
 if(level<=0) return 0;
 const mode=String(farm.farmMode||FARM_MODE_NONE).trim().toLowerCase();
 let amount=2;
 if(level>=2){
  if(mode===FARM_MODE_A){
   amount=3;
  }else if(mode===FARM_MODE_B){
   amount=isFarmBHarvestDay(day)?7:0;
  }
 }
 if(level>=3){
  if(mode===FARM_MODE_B){
   amount=isFarmBHarvestDay(day)?9:0;
  }else{
   amount+=2;
  }
 }
 return Math.max(0, amount);
}

function getFarmProduction(building=state.buildings?.huerto, day=state.day){
 const farm=building||state.buildings?.huerto;
 let amount=getFarmProductionBase(farm, day);
 if(state.baseUpgrades?.auto_irrigation && amount>0){
  amount+=Math.max(0, getBaseUpgradeEffectNumber('auto_irrigation','farmFoodBonus',1));
 }
 const threatModifier=getThreatBuildingOutputModifier('huerto','food');
 if(threatModifier!==0) amount=Math.max(0, amount+threatModifier);
 return amount;
}

function getFarmProductionText(building=state.buildings?.huerto, day=state.day){
 const farm=building||state.buildings?.huerto;
 if(!farm?.built) return '+2 comida por día';
 const mode=String(farm.farmMode||FARM_MODE_NONE).trim().toLowerCase();
 const level=Math.max(0, Number(farm.level||0) || 0);
 const irrigationBonus=state.baseUpgrades?.auto_irrigation ? Math.max(0, getBaseUpgradeEffectNumber('auto_irrigation','farmFoodBonus',1)) : 0;
 if(level>=3 && mode===FARM_MODE_B) return `+${9+irrigationBonus} comida cada 2 días`;
 if(level>=2 && mode===FARM_MODE_B) return `+${7+irrigationBonus} comida cada 2 días`;
 if(level>=3 && mode===FARM_MODE_A) return `+${5+irrigationBonus} comida por día`;
 if(level>=2 && mode===FARM_MODE_A) return `+${3+irrigationBonus} comida por día`;
 if(level>=3) return `+${4+irrigationBonus} comida por día`;
 return `+${2+irrigationBonus} comida por día`;
}

function isFarmModeLocked(building=state.buildings?.huerto, day=state.day){
 const farm=building||state.buildings?.huerto;
 const until=Math.max(0, Number(farm?.farmModeLockedUntilDay||0) || 0);
 return until>0 && Number(day||state.day||1) < until;
}

function getFarmModeLockDaysRemaining(building=state.buildings?.huerto, day=state.day){
 const farm=building||state.buildings?.huerto;
 const until=Math.max(0, Number(farm?.farmModeLockedUntilDay||0) || 0);
 const current=Math.max(1, Number(day||state.day||1) || 1);
 return until>current ? until-current : 0;
}

function refreshFarmModeLockForDay(day=state.day){
 const farm=ensureFarmState();
 if(!farm) return false;
 const until=Math.max(0, Number(farm.farmModeLockedUntilDay||0) || 0);
 if(!until) return false;
 const current=Math.max(1, Number(day||state.day||1) || 1);
 if(current < until) return false;
 if(Number(farm._farmModeUnlockLoggedDay||0)!==current){
  addLog(`🌱 El Huerto vuelve a permitir cambiar de cultivo.`);
  farm._farmModeUnlockLoggedDay=current;
 }
  farm.farmModeLockedUntilDay=0;
 return true;
}

function setFarmMode(mode){
 const farm=ensureFarmState();
 if(!farm?.built) return false;
 const level=Math.max(0, Number(farm.level||0) || 0);
 if(level<2) return false;
 refreshFarmModeLockForDay(state.day);
 const next=String(mode||FARM_MODE_NONE).trim().toLowerCase();
 if(![FARM_MODE_A,FARM_MODE_B,FARM_MODE_NONE].includes(next)) return false;
 if(next!==FARM_MODE_NONE && isFarmModeLocked(farm, state.day)){
  addLog(`🌱 El Huerto mantiene ${getFarmModeLabel(farm.farmMode)} durante ${getFarmModeLockDaysRemaining(farm, state.day)} día${getFarmModeLockDaysRemaining(farm, state.day)!==1?'s':''} más.`);
  if(state.currentDetail==='huerto' && typeof showBuildingDetail==='function') showBuildingDetail('huerto');
  if(typeof render==='function') render();
  return false;
 }
 farm.farmMode=next;
 if(next===FARM_MODE_A || next===FARM_MODE_B){
  farm.farmModeLockedUntilDay=Math.max(Number(state.day||1)+15, Number(state.day||1)+1);
  delete farm._farmModeUnlockLoggedDay;
  addLog(`🌱 El Huerto pasa a ${getFarmModeLabel(next)}. Queda bloqueado durante 15 días.`);
 } else {
  farm.farmModeLockedUntilDay=0;
  addLog(`🌱 El Huerto pasa a ${getFarmModeLabel(next)}.`);
 }
 if(state.currentDetail==='huerto' && typeof showBuildingDetail==='function') showBuildingDetail('huerto');
 if(typeof render==='function') render();
 return true;
}

function normalizeBuildingRequirementId(id){
 const key=String(id||'').trim().toLowerCase();
 return BUILDING_REQUIREMENT_ALIASES[key]||key;
}

function normalizeBaseUpgradeDefinition(up,index=0){
 if(!up||typeof up!=='object') return null;
 const id=String(up.id||`base_upgrade_${index+1}`).trim();
 if(!id) return null;
 const rawRequires=Array.isArray(up.requiresBuildings)
 ? up.requiresBuildings
 : (Array.isArray(up.requires)?up.requires:[]);
 const costValue=typeof up.cost==='number'
 ? Number(up.cost||0)
 : Number(up.cost?.materials ?? up.materialsCost ?? up.costMaterials ?? 0);
 return {
 id,
 name:String(up.name||id).trim(),
 cost:Math.max(0, costValue||0),
 requires:rawRequires.map(normalizeBuildingRequirementId).filter(Boolean),
 description:String(up.description||'').trim(),
 devDays:Math.max(1, Number(up.devDays ?? up.developmentDays ?? up.days ?? 2) || 2),
 effects:deepClone(up.effects||{})
 };
}

function getBaseUpgradesCatalog(){
 const configured=Array.isArray(gameData.config?.baseUpgrades)
 ? gameData.config.baseUpgrades.map((up,idx)=>normalizeBaseUpgradeDefinition(up,idx)).filter(Boolean)
 : [];
 return configured.length
 ? configured
 : DEFAULT_BASE_UPGRADES.map((up,idx)=>normalizeBaseUpgradeDefinition(up,idx)).filter(Boolean);
}

function getBaseUpgradeDef(id){
 return getBaseUpgradesCatalog().find(up=>up.id===id)||null;
}

function getBaseUpgradeEffectNumber(id,key,fallback=0){
 const value=Number(getBaseUpgradeDef(id)?.effects?.[key]);
 return Number.isFinite(value) ? value : Number(fallback||0);
}

function getGallineroConfig(){
 const configured=gameData.config?.gallinero;
 if(!configured||typeof configured!=='object'||Array.isArray(configured)) return deepClone(DEFAULT_GALLINERO_CONFIG);
 const merged={...DEFAULT_GALLINERO_CONFIG, ...configured};
 const ranges=Array.isArray(configured.foodByChickenCount) && configured.foodByChickenCount.length
 ? configured.foodByChickenCount
 : DEFAULT_GALLINERO_CONFIG.foodByChickenCount;
 merged.foodByChickenCount=ranges.map(range=>({
 min:Number(range?.min ?? 0),
 max:Number(range?.max ?? Number.POSITIVE_INFINITY),
 food:Number(range?.food ?? 0)
 }));
 merged.sacrifice={...DEFAULT_GALLINERO_CONFIG.sacrifice, ...(configured.sacrifice||{})};
 return merged;
}

function getGallineroMaxChickens(){
 return Math.max(1, Number(gameData.config?.resources?.caps?.chickens ?? getGallineroConfig().maxChickens ?? 10) || 10);
}

function getChickenSacrificeConfig(){
 const sacrifice=getGallineroConfig().sacrifice||{};
 return {
 chickensCost:Math.max(1, Number(sacrifice.chickensCost ?? 1) || 1),
 foodGain:Math.max(0, Number(sacrifice.foodGain ?? 2) || 2)
 };
}


function getBuildingDef(id){
 return (gameData.buildings||[]).find(b=>b&&b.id===id)||null;
}

function getBaseMapBuildings(){
 return (gameData.buildings||[]).filter(b=>{
  if(!b) return false;
  const category=String(b.category||'Base').toLowerCase();
  if(category!=='base') return false;
  const id=String(b.id||'').trim().toLowerCase();
  if(b.fromAbandoned || String(b.type||'').toLowerCase()==='adaptation') return false;
  if(id==='cantina' || id==='sala_comun') return false;
  return !!b.map;
 });
}

function getSettlementDefenseValue(){
 let total=0;
 const muros=state.buildings?.muros;
 if(muros?.built&&muros?.active) total+=Number(muros.level||0)>=2?2:1;
 const atalaya=state.buildings?.atalaya;
 if(atalaya?.built&&atalaya?.active) total+=Number(atalaya.level||0)>=2?3:2;
 if(state.baseUpgrades?.electric_fence && state.vallaElectrica && getElectricityFree()>=0){
 total+=getBaseUpgradeEffectNumber('electric_fence','defenseBonus',1);
 }
 total+=Number(getStabilityModifiers().defenseBonus||0);
 return Math.max(0,total);
}


function pushOneDayOutputModifier(effect, threat){
 if(!effect?.building) return;
 if(!Array.isArray(state._oneDayOutputMods)) state._oneDayOutputMods=[];
 state._oneDayOutputMods.push({
 building:String(effect.building),
 resource:normalizeResourceKey(effect.resource),
 amount:Number(effect.amount||0),
 source:threat?.instanceId||null,
 label:getThreatDisplayName(threat)
 });
}
function getOneDayOutputModifier(buildingId, resource){
 return (state._oneDayOutputMods||[]).reduce((sum,entry)=>{
 if(String(entry.building)!==String(buildingId)) return sum;
 if(normalizeResourceKey(entry.resource)!==normalizeResourceKey(resource)) return sum;
 return sum + Number(entry.amount||0);
 },0);
}
function clearOneDayOutputModifiers(){
 state._oneDayOutputMods=[];
}

function ensureBuildingCatalog(){
 if(!Array.isArray(gameData.buildings)) gameData.buildings=[];
 const defaults=[
 {id:'huerto',name:'Huerto',cost:3,maxLevel:3,constructible:true,initial:true,category:'Base',constructionDays:2,effect:'Nivel 1: +2 comida. Nivel 2: elige Cultivo A (+3/día) o Cultivo B (+7 cada 2 días). Nivel 3: requiere Pozo y suma +2 comida al estado actual.',upgradeRequirements:{3:['pozo']},map:{left:'10%',top:'18%',width:'15%',height:'12%'}},
 {id:'taller',name:'Taller',cost:5,maxLevel:5,constructible:true,initial:false,category:'Base',constructionDays:3,effect:'Aporta materiales y desbloquea mejoras.',map:{left:'28%',top:'18%',width:'15%',height:'12%'}},
 {id:'almacen',name:'Almacén',cost:4,maxLevel:3,constructible:true,initial:false,category:'Base',constructionDays:2,effect:'Aumenta la capacidad de almacenamiento.',map:{left:'28%',top:'10%',width:'15%',height:'12%'}},
 {id:'barracones',name:'Barracones',cost:4,maxLevel:3,constructible:true,initial:true,category:'Base',constructionDays:2,effect:'Da cobijo al asentamiento.',map:{left:'46%',top:'18%',width:'15%',height:'12%'}},
 {id:'muros',name:'Muros',cost:4,maxLevel:3,constructible:true,initial:true,category:'Base',constructionDays:2,effect:'Defensa pasiva del asentamiento.',map:{left:'64%',top:'18%',width:'15%',height:'12%'}},
 {id:'atalaya',name:'Atalaya',cost:4,maxLevel:3,constructible:true,initial:false,category:'Base',constructionDays:2,effect:'Mejora la defensa cuando se vigila.',map:{left:'82%',top:'18%',width:'12%',height:'12%'}},
 {id:'generador',name:'Generador',cost:6,maxLevel:3,constructible:true,initial:false,category:'Base',constructionDays:3,effect:'Aporta electricidad a la base.',map:{left:'10%',top:'36%',width:'15%',height:'12%'}},
 {id:'pozo',name:'Pozo',cost:2,maxLevel:1,constructible:true,initial:false,category:'Base',constructionDays:2,effect:'Requisito para mejorar el Huerto a nivel 3.',map:{left:'46%',top:'36%',width:'15%',height:'12%'}},
 {id:'gallinero',name:'Gallinero',cost:4,maxLevel:1,constructible:true,initial:false,category:'Base',constructionDays:2,effect:'Produce comida según las gallinas del asentamiento.',map:{left:'24%',top:'34%',width:'15%',height:'12%'}},
 {id:'cementerio',name:'⛼ Cementerio',cost:0,maxLevel:1,constructible:false,initial:true,category:'Base',constructionDays:0,effect:'Memorial para los caídos del asentamiento.',map:{left:'40%',top:'38%',width:'16%',height:'12%',specialStyle:'border-color:rgba(155,84,84,0.5);background:rgba(50,10,10,0.7);color:rgba(200,150,150,0.8);'}}
 ];
 defaults.forEach(def=>{
 const existing=gameData.buildings.find(b=>b&&b.id===def.id);
 if(existing) Object.assign(existing, {...def, ...existing});
 else gameData.buildings.push(def);
 });
}


function activateAllBuildingsForTesting(){
 ensureBuildingCatalog();
 Object.entries(state.buildings||{}).forEach(([id,b])=>{
  const def=getBuildingDef(id)||{};
  const maxLevel=Math.max(1, Number(b?.maxLevel||def?.maxLevel||1) || 1);
  b.constructible=true;
  b.built=true;
  b.active=true;
  b.level=maxLevel;
  b.maxLevel=maxLevel;
  b._underConstruction=false;
  delete b._constructionCost;
  delete b._lastConstructionCost;
  delete b._constructionDays;
  delete b._constructionDaysLeft;
 });
 state.unlocked=state.unlocked||{};
 state.unlocked.meds=true;
 state.unlocked.electricity=true;
 state.electricityCapacity=getElectricityCapacity();
 state.electricityUsed=getElectricityUsed();
 addLog('🧪 Modo pruebas: todos los edificios han sido construidos y activados al máximo nivel.');
 addTechnicalLog('dev_activate_all_buildings','Se activan todos los edificios para pruebas.', {
  buildings:Object.values(state.buildings||{}).map(b=>({id:b.id,name:b.name,level:b.level,built:!!b.built,active:!!b.active}))
 });
 if(state.currentDetail&&state.buildings?.[state.currentDetail]) showBuildingDetail(state.currentDetail);
 render();
}


function applyDailyIncome(){
 if(state.buildings.huerto?.built&&state.buildings.huerto?.active){
 const farmFood=getFarmProduction(state.buildings.huerto, state.day);
 state.food+=farmFood;
 addLog(`El Huerto produce +${farmFood} comida.`)
 }
 if(state.buildings.taller?.built&&state.buildings.taller?.active){state.materials+=state.buildings.taller.level;addLog(`El Taller aporta +${state.buildings.taller.level} materiales.`)}
 if(state.buildings.gallinero?.built&&state.buildings.gallinero?.active){
 const chickenFood=getChickenProduction(state.chickens);
 if(chickenFood>0){
 state.food+=chickenFood;
 addLog(`🐔 El Gallinero produce +${chickenFood} comida (${state.chickens} gallinas).`);
 } else {
 addLog(`🐔 El Gallinero no produce comida (${state.chickens} gallinas).`);
 }
 }
 clearOneDayOutputModifiers();
}


function maybePrepareChickenSacrifice(){
 const aliveBase=aliveSurvivors().filter(s=>!isExteriorSurvivor(s));
 const foodPer=Number(gameData.config?.rules?.foodPerSurvivor??1);
 const glutonCount=aliveBase.filter(s=>(s.negativeSkill||'').toLowerCase()==='glotón').length;
 const neededBase=aliveBase.length*foodPer + glutonCount;
 if(Number(state.chickens||0)>0 && Number(state.food||0)<neededBase){
 state._pendingChickenSacrifice={needed:neededBase, currentFood:Number(state.food||0), chickens:Number(state.chickens||0)};
 return true;
 }
 state._pendingChickenSacrifice=null;
 return false;
}

function openChickenSacrificePopup(){
 const data=state._pendingChickenSacrifice;
 if(!data){ maybeContinueEndDayAfterPause(); return; }
 const popup=document.getElementById('chickenSacrificePopup');
 const textEl=document.getElementById('chickenSacrificeText');
 const stockEl=document.getElementById('chickenSacrificeStock');
 if(!popup||!textEl||!stockEl){ state._pendingChickenSacrifice=null; maybeContinueEndDayAfterPause(); return; }
 const sacrificeCfg=getChickenSacrificeConfig();
 textEl.textContent=`No hay comida suficiente para el grupo (${data.currentFood}/${data.needed}). ¿Quieres sacrificar ${sacrificeCfg.chickensCost} gallina${sacrificeCfg.chickensCost!==1?'s':''} para obtener +${sacrificeCfg.foodGain} comida antes de repartir las raciones?`;
 stockEl.textContent=`Gallinas: ${state.chickens} · Comida actual: ${state.food}`;
 popup.classList.add('open');
 document.getElementById('chickenSacrificeConfirm').onclick=()=>{
 popup.classList.remove('open');
 state.chickens=Math.max(0, Number(state.chickens||0)-sacrificeCfg.chickensCost);
 state.food=Number(state.food||0)+sacrificeCfg.foodGain;
 addLog(`🐔 Se sacrifican ${sacrificeCfg.chickensCost} gallina${sacrificeCfg.chickensCost!==1?'s':''} → +${sacrificeCfg.foodGain} comida.`);
 state._pendingChickenSacrifice=null;
 maybeContinueEndDayAfterPause();
 };
 document.getElementById('chickenSacrificeDecline').onclick=()=>{
 popup.classList.remove('open');
 state._pendingChickenSacrifice=null;
 maybeContinueEndDayAfterPause();
 };
}


function cancelConstructionForSurvivor(survivor, reason='cancelada'){
 if(!survivor||survivor.action?.type!=='construir') return false;
 const buildTarget=survivor.action.target;
 const bld=buildTarget?state.buildings[buildTarget]:null;
 if(!bld||!bld._underConstruction) return false;
 const isRecycle=!!bld._recycleToMaterials;
 const refunded=isRecycle ? 0 : Math.max(1, Number(bld._lastConstructionCost||bld._constructionCost||0));
 if(refunded>0){
 state.materials+=refunded;
 addLog(`↩ Se devuelven ${refunded} materiales a la base por construcción cancelada.`);
 }
 bld._underConstruction=false;
 bld._constructionDays=0;
 bld._constructionDaysLeft=0;
 bld._lastConstructionCost=0;
 bld._constructionCost=0;
 delete bld._recycleToMaterials;
 delete bld._recycleYieldMaterials;
 survivor._keepBuilding=false;
 survivor.action=null;
 if(survivor.status!=='muerto') survivor.status='activo';
 addLog(`${isRecycle?'🧱 El reciclaje':'🔨 La construcción'} de ${bld.name} se cancela (${reason}).`);
 addTechnicalLog('construction_cancelled', 'Construcción cancelada.', {survivorId:survivor.id, survivorName:survivor.name, buildingId:buildTarget, refunded, recycle:isRecycle});
 return true;
}

function getBaseUpgradeProject(upgradeId){
 if(!state.baseUpgradeProjects) state.baseUpgradeProjects={};
 return state.baseUpgradeProjects[upgradeId]||null;
}

function cancelBaseUpgradeDevelopmentForSurvivor(survivor, reason='cancelada'){
 if(!survivor||survivor.action?.type!=='desarrollar_mejora') return false;
 const upgradeId=survivor.action.target;
 const project=getBaseUpgradeProject(upgradeId);
 if(!project||!project.active) return false;
 const refunded=Math.max(1, Number(project.cost||0));
 if(refunded>0){
 state.materials+=refunded;
 addLog(`↩ Se devuelven ${refunded} materiales a la base por mejora cancelada.`);
 }
 delete state.baseUpgradeProjects[upgradeId];
 survivor._keepUpgradeDevelopment=false;
 survivor.action=null;
 if(survivor.status!=='muerto') survivor.status='activo';
 const up=getBaseUpgradeDef(upgradeId);
 addLog(`🛠 El desarrollo de ${up?.name||upgradeId} se cancela (${reason}).`);
 addTechnicalLog('base_upgrade_cancelled', 'Mejora de base cancelada.', {survivorId:survivor.id, survivorName:survivor.name, upgradeId, refunded});
 return true;
}

function getBuildingConstructionDays(id, targetLevel=null){
 const def=getBuildingDef(id);
 const current=state.buildings[id];
 const source=(def&&def.constructionDays!=null)?def.constructionDays:current?.constructionDays;
 let base=1;
 if(Array.isArray(source)){
 const fallbackLevel=Number(current?.level||0)+1;
 const level=Math.max(1, Number(targetLevel||fallbackLevel||1));
 const idx=Math.min(source.length-1, Math.max(0, level-1));
 base=Number(source[idx]);
 }else{
 base=Number(source||1);
 }
 if(!Number.isFinite(base)||base<0) base=1;
 return base + Number(getStabilityModifiers().extraBuildDays||0);
}

function getBuildingElectricityCost(id){
 const def=getBuildingDef(id);
 return Number(def?.electricityCost||state.buildings[id]?.electricityCost||0);
}

function getBuildingUpgradeRequirements(buildingId, targetLevel){
 const def=getBuildingDef(buildingId);
 const map=def?.upgradeRequirements||state.buildings[buildingId]?.upgradeRequirements||{};
 const req=map?.[String(targetLevel)] ?? map?.[targetLevel];
 return Array.isArray(req) ? req : [];
}


function getElectricityCapacity(){
 const gen=state.buildings.generador;
 if(!gen?.built||!gen?.active) return 0;
 const lvl=gen.level||1;
 let cap=lvl>=3?5:lvl===2?4:3;
 if(state.baseUpgrades?.biodiesel) cap+=getBaseUpgradeEffectNumber('biodiesel','generatorCapacityBonus',1);
 return cap;
}


function getElectricityUsed(){
 let used=0;
 Object.values(state.buildings).forEach(b=>{
 const cost=getBuildingElectricityCost(b.id);
 if(cost>0&&b?.built&&b?.active) used+=cost;
 });
 if(state.baseUpgrades?.electric_fence&&state.buildings.generador?.built&&state.buildings.generador?.active){
 const needsElectricity=getBaseUpgradeDef('electric_fence')?.effects?.needsElectricity;
 if(needsElectricity!==false) used+=1;
 }
 return used;
}


function getElectricityFree(){
 return Math.max(0, getElectricityCapacity()-getElectricityUsed());
}


function hasBaseUpgrade(id){ return !!state.baseUpgrades?.[id]; }

function formatBuildingRequirement(req){
 if(req&&typeof req==='object'){
 const buildingId=req.id;
 const name=state.buildings[buildingId]?.name||getBuildingDef(buildingId)?.name||buildingId;
 const minLevel=Number(req.minLevel||0);
 return minLevel>1 ? `${name} nivel ${minLevel}` : name;
 }
 return state.buildings[req]?.name||getBuildingDef(req)?.name||req;
}

function buildingIsReady(req){
 if(req&&typeof req==='object'){
 const buildingId=req.id;
 const building=state.buildings[buildingId];
 if(!building?.built||!building?.active) return false;
 const minLevel=Number(req.minLevel||1);
 return Number(building.level||0)>=minLevel;
 }
 return !!(state.buildings[req]?.built&&state.buildings[req]?.active);
}

function getChickenProduction(chickens=state.chickens){
 const current=Math.max(0, Number(chickens||0));
 const ranges=getGallineroConfig().foodByChickenCount||[];
 const match=ranges.find(range=>current>=Number(range?.min ?? 0) && current<=Number(range?.max ?? Number.POSITIVE_INFINITY));
 return Math.max(0, Number(match?.food ?? 0) || 0);
}

function sacrificeChicken(){
 if(!buildingIsReady('gallinero')){ addLog('Necesitas un Gallinero construido.'); render(); return; }
 const sacrificeCfg=getChickenSacrificeConfig();
 if(Number(state.chickens||0)<sacrificeCfg.chickensCost){ addLog('No tienes gallinas suficientes para sacrificar.'); render(); return; }
 state.chickens=Math.max(0,Number(state.chickens||0)-sacrificeCfg.chickensCost);
 state.food+=sacrificeCfg.foodGain;
 addLog(`🐔 Se sacrifica ${sacrificeCfg.chickensCost} gallina${sacrificeCfg.chickensCost!==1?'s':''}. +${sacrificeCfg.foodGain} comida inmediata.`);
 if(state.currentDetail==='gallinero') showBuildingDetail('gallinero');
 render();
}


function getMedicalBarracksCurableLevel(){
 const building=state.buildings?.barracon_medico;
 if(!building?.built) return null;
 const level=Number(building.level||0);
 if(level>=3) return 'seria';
 if(level>=1) return 'simple';
 return null;
}

function getMedicalBarracksTargets(curableLevel=null){
 const level=curableLevel||getMedicalBarracksCurableLevel();
 if(!level) return [];
 return aliveSurvivors().filter(s=>!isExteriorSurvivor(s)&&hasActiveInjury(s)&&String(s.injuryLevel||'')===level);
}

function applyMedicalBarracksTreatment(survivorId){
 const building=state.buildings?.barracon_medico;
 const curableLevel=getMedicalBarracksCurableLevel();
 const survivor=state.survivors.find(s=>s.id===survivorId);
 if(!building?.built||!building?.active||!curableLevel||building._usedToday){ render(); return; }
 if(!survivor||isExteriorSurvivor(survivor)||!hasActiveInjury(survivor)||String(survivor.injuryLevel||'')!==curableLevel){
 addLog('🏥 Ese superviviente ya no puede ser tratado por el Barracón médico.');
 if(state.currentDetail==='barracon_medico') showBuildingDetail('barracon_medico');
 render();
 return;
 }
 survivor.injuryLevel=null;
 survivor.injuryRestDays=0;
 survivor._injuryTreatedToday=true;
 const hadRestAction=survivor.action?.type==='descansar';
 if(curableLevel==='seria'){
  survivor.action={type:'descansar', target:'barracon_medico'};
  survivor.status='ocupado';
  survivor._injuryRestedToday=true;
 } else if(hadRestAction){
  survivor.action=null;
  survivor.status='activo';
 } else if(survivor.status!=='muerto' && !survivor.action){
  survivor.status='activo';
 }
 building._usedToday=true;
 addLog(`🏥 El Barracón médico trata a ${survivor.name} y elimina su herida ${curableLevel}.`);
 if(curableLevel==='seria'){
  addLog(`🏥 ${survivor.name} queda ocupado/a el resto del día, como si estuviera descansando.`);
 } else if(hadRestAction){
  addLog(`🏥 ${survivor.name} ya no está limitado/a a descansar y puede elegir cualquier acción.`);
 }
 document.getElementById('decidePopup')?.classList.remove('open');
 if(state.currentDetail==='barracon_medico') showBuildingDetail('barracon_medico');
 render();
}

function openMedicalBarracksTreatment(){
 const building=state.buildings?.barracon_medico;
 const curableLevel=getMedicalBarracksCurableLevel();
 if(!building?.built||!curableLevel){ addLog('El Barracón médico no puede usarse con su nivel actual.'); render(); return; }
 if(!building.active){ addLog('El Barracón médico está inactivo y no puede usarse.'); render(); return; }
 if(building._usedToday){ addLog('El Barracón médico ya ha usado su acción de hoy.'); render(); return; }
 const targets=getMedicalBarracksTargets(curableLevel);
 if(!targets.length){
 addLog(`🏥 No hay supervivientes en la base con herida ${curableLevel} para tratar.`);
 if(state.currentDetail==='barracon_medico') showBuildingDetail('barracon_medico');
 render();
 return;
 }
 const popup=document.getElementById('decidePopup');
 const promptEl=document.getElementById('decidePrompt');
 const optionsEl=document.getElementById('decideOptions');
 if(!popup||!promptEl||!optionsEl) return;
 promptEl.textContent=`Elige a quién tratar con el Barracón médico. Esta acción solo puede usarse una vez hoy y elimina 1 herida ${curableLevel}.`;
 optionsEl.innerHTML='';
 targets.forEach(target=>{
 const btn=document.createElement('button');
 btn.className='btn secondary';
 btn.style.cssText='text-align:left;padding:10px 14px;line-height:1.5;';
 btn.innerHTML=`<div style="font-family:var(--font-display);font-size:13px;letter-spacing:0.05em;">${escapeHtml(target.name)}</div><div style="font-size:10px;color:var(--muted);margin-top:3px;">Herida ${escapeHtml(curableLevel)} · ${getMoraleLabel(target)} · fatiga ${target.fatigue}/${target.maxFatigue}</div>`;
 btn.addEventListener('click',()=>applyMedicalBarracksTreatment(target.id));
 optionsEl.appendChild(btn);
 });
 const cancelBtn=document.createElement('button');
 cancelBtn.className='btn';
 cancelBtn.textContent='Cancelar';
 cancelBtn.addEventListener('click',()=>popup.classList.remove('open'));
 optionsEl.appendChild(cancelBtn);
 popup.classList.add('open');
}

function canAssignUpgradeDeveloper(s){
 if(!s||s.status==='muerto'||s.status==='ocupado') return false;
 if(hasActiveInjury(s)||hasLowMoraleRestRestriction(s)) return false;
 if(Number(s.fatigue||0)<=0) return false;
 return true;
}

function canBuildBaseUpgrade(up){
 if(!up||hasBaseUpgrade(up.id)) return false;
 if(!(state.buildings.taller?.built&&Number(state.buildings.taller?.level||0)>=2)) return false;
 if(Number(state.materials||0)<Number(up.cost||0)) return false;
 if(getBaseUpgradeProject(up.id)?.active) return false;
 return (up.requires||[]).every(req=>buildingIsReady(req));
}

function getBaseUpgradeDevelopmentDays(survivor, up=null){
 const inventorBonus=Number(getSkillBonus(survivor,'develop_upgrade')?.daysReduction||0);
 const baseDays=Math.max(1, Number(up?.devDays ?? 2) || 2);
 return Math.max(1, baseDays - inventorBonus);
}

function openBaseUpgradesModal(){
 const body=document.getElementById('baseUpgradesBody');
 if(!body) return;
 try{
  if(typeof closeBuildingPopup==='function') closeBuildingPopup();
  const panel=document.getElementById('buildingDetailPanel');
  if(panel) panel.style.display='none';
  if(window.state) window.state.currentDetail=null;
 }catch(_err){}
 body.innerHTML='';
 const availableDevelopers=aliveSurvivors().filter(canAssignUpgradeDeveloper);
 const baseUpgrades=getBaseUpgradesCatalog();
 baseUpgrades.forEach(up=>{
 const built=hasBaseUpgrade(up.id);
 const project=getBaseUpgradeProject(up.id);
 const reqs=(up.requires||[]).map(req=>state.buildings[req]?.name||req).join(', ');
 const ready=(up.requires||[]).every(req=>buildingIsReady(req));
 const card=document.createElement('div');
 card.className='build-option';
 const extra=up.id==='electric_fence'?' · Consume 1⚡':up.id==='biodiesel'?' · +1⚡ al Generador actual':' · +1 comida al Huerto';
 const statusLine=built
 ? `<br><span style='color:var(--ok-bright)'>Mejora ya construida.</span>`
 : project?.active
 ? `<br><span style='color:var(--amber-bright)'>En desarrollo por ${escapeHtml(project.developerName||'—')} · ${project.daysLeft}/${project.daysTotal} días restantes.</span>`
 : !ready
 ? `<br><span style='color:var(--warn-bright)'>Faltan requisitos.</span>`
 : !availableDevelopers.length
 ? `<br><span style='color:var(--warn-bright)'>No hay supervivientes disponibles para desarrollarla.</span>`
 : `<br><span style='color:var(--muted)'>Elige un superviviente para desarrollarla (${up.devDays} día${up.devDays!==1?'s':''} base).</span>`;
 const selectorHtml=!built&&!project?.active&&ready&&availableDevelopers.length
 ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px"><select data-upgrade-dev style="min-width:160px">${availableDevelopers.map(s=>`<option value="${escapeAttr(s.id)}">${escapeHtml(s.name)}${getSurvivorSkills(s).map(sk=>(sk||'').toLowerCase()).includes('inventor')?' · Inventor':''}</option>`).join('')}</select><button>Desarrollar</button></div>`
 : `<button ${built||project?.active||!canBuildBaseUpgrade(up)||!availableDevelopers.length?'disabled':''}>${built?'Construida':project?.active?'En desarrollo':'Desarrollar'}</button>`;
 card.innerHTML=`<div><div><b>${escapeHtml(up.name)}</b></div><div class='mini'>Coste: ${up.cost} 🔧 · Requiere: ${escapeHtml(reqs)}${extra}<br>${escapeHtml(up.description)}${statusLine}</div></div>${selectorHtml}`;
 const btn=card.querySelector('button');
 if(btn){
 btn.addEventListener('click',()=>{
 const sel=card.querySelector('select[data-upgrade-dev]');
 const survivorId=sel?.value||'';
 startBaseUpgradeDevelopment(up.id, survivorId);
 });
 }
 body.appendChild(card);
 });
 const modal=document.getElementById('baseUpgradesModal');
 if(modal) modal.classList.add('open');
 try{
  if(typeof refreshPopupStack==='function') refreshPopupStack();
 }catch(_err){}
}
window.openBaseUpgradesModal=openBaseUpgradesModal;

function startBaseUpgradeDevelopment(upgradeId, survivorId){
 const up=getBaseUpgradeDef(upgradeId);
 const survivor=state.survivors.find(x=>x.id===survivorId);
 if(!up||!survivor||!canBuildBaseUpgrade(up)||!canAssignUpgradeDeveloper(survivor)) return;
 state.materials-=Number(up.cost||0);
 const days=getBaseUpgradeDevelopmentDays(survivor, up);
 if(!state.baseUpgradeProjects) state.baseUpgradeProjects={};
 state.baseUpgradeProjects[upgradeId]={
 active:true,
 developerId:survivor.id,
 developerName:survivor.name,
 daysTotal:days,
 daysLeft:days,
 cost:Number(up.cost||0)
 };
 survivor.action={type:'desarrollar_mejora',target:upgradeId};
 survivor.status='ocupado';
 const inventorBonus=Number(getSkillBonus(survivor,'develop_upgrade')?.daysReduction||0);
 if(inventorBonus>0){
 addLog(`💡 ${survivor.name} (Inventor) reduce en ${inventorBonus} día el desarrollo de la mejora.`);
 }
 addLog(`🛠 ${survivor.name} comienza a desarrollar ${up.name}. -${up.cost} mat. Tiempo: ${days} día${days!==1?'s':''}.`);
 addTechnicalLog('base_upgrade_start', 'Comienza el desarrollo de mejora de base.', {upgradeId, upgradeName:up.name, survivorId:survivor.id, survivorName:survivor.name, days, cost:Number(up.cost||0)});
 openBaseUpgradesModal();
 if(state.currentDetail==='taller') showBuildingDetail('taller');
 render();
}

function buildBaseUpgrade(upgradeId){
 const up=getBaseUpgradeDef(upgradeId);
 if(!up||hasBaseUpgrade(upgradeId)) return;
 state.baseUpgrades[upgradeId]=true;
 delete state.baseUpgradeProjects[upgradeId];
 if(upgradeId==='electric_fence') state.vallaElectrica=true;
 state.electricityCapacity=getElectricityCapacity();
 state.electricityUsed=getElectricityUsed();
 const logs={
 electric_fence:'⚡ El muro ha sido electrificado. +1 defensa mientras haya 1⚡ disponible.',
 auto_irrigation:'💧 Se instala riego automático. El Huerto dará +1 comida adicional.',
 biodiesel:'🛢 Se instala biodiésel. El Generador gana +1 de capacidad eléctrica.'
 };
 addLog(logs[upgradeId]||`Mejora completada: ${up.name}.`);
 openBaseUpgradesModal();
 if(state.currentDetail==='taller') showBuildingDetail('taller');
 render();
}

function getSpecificBuildingUpgradeStatus(buildingId){
 const def=getBuildingDef(buildingId);
 const current=state.buildings?.[buildingId];
 if(!def||!current) return {ok:false, reason:'Edificio no encontrado.'};
 const maxLevel=Number(def.maxLevel||current.maxLevel||1);
 const nextLevel=Number(current.level||0)+1;
 if(!current.built) return {ok:false, reason:'El edificio no está construido.'};
 if(current._underConstruction) return {ok:false, reason:'Ya está en construcción.'};
 if(nextLevel>maxLevel) return {ok:false, reason:'Ya está al nivel máximo.'};
 let constructible=current.constructible===true;
 if(def.id==='generador'&&(state.buildings.taller?.level||0)<2) constructible=false;
 if(!constructible) return {ok:false, reason:'Edificio bloqueado.'};
 const upgradeReqs=getBuildingUpgradeRequirements(def.id, nextLevel);
 const missingReqs=upgradeReqs.filter(req=>!buildingIsReady(req));
 if(missingReqs.length) return {ok:false, reason:`Requiere: ${missingReqs.map(req=>formatBuildingRequirement(req)).join(', ')}`};
 const buildCost=getBuildingCost(def.id);
 const elecReq=getBuildingElectricityCost(def.id)||0;
 if(elecReq>0&&getElectricityFree()<elecReq) return {ok:false, reason:'No hay suficiente electricidad libre.'};
 return {ok:true, cost:buildCost, days:getBuildingConstructionDays(def.id, nextLevel), nextLevel, elecReq};
}

function canStartSpecificBuildingUpgrade(buildingId){
 return getSpecificBuildingUpgradeStatus(buildingId);
}

function startSpecificBuildingUpgrade(buildingId, survivorId){
 const s=state.survivors.find(x=>x.id===survivorId);
 const def=getBuildingDef(buildingId);
 const current=state.buildings?.[buildingId];
 const status=getSpecificBuildingUpgradeStatus(buildingId);
 if(!s||!def||!current||!status.ok) return false;
 const ingenieroBonus=getSkillBonus(s,'build');
 const finalCost=Math.max(1, Number(status.cost||0) - Number(ingenieroBonus.costReduction||0));
 if(state.materials<finalCost){ addLog('❌ No hay materiales suficientes.'); return false; }
 state.materials-=finalCost;
 if(ingenieroBonus.costReduction) addLog(`⚙ ${s.name} (Ingeniero) reduce el coste en ${ingenieroBonus.costReduction} material.`);
 const days=Math.max(1, Number(status.days||1) || 1);
 current._constructionCost=finalCost;
 current._lastConstructionCost=finalCost;
 current._constructionDays=days;
 current._constructionDaysLeft=days;
 current._underConstruction=true;
 delete current._recycleToMaterials;
 delete current._recycleYieldMaterials;
 s.action={type:'construir',target:def.id};
 s.status='ocupado';
 const dayStr=days===1?'1 día':`${days} días`;
 addLog(`🔨 ${s.name} comienza a actualizar ${current.name}. -${finalCost} mat. Tiempo: ${dayStr}.`);
 closeBuildingPopup();
 if(typeof render==='function') render();
 return true;
}

function openSpecificBuildingUpgradePopup(buildingId){
 const status=getSpecificBuildingUpgradeStatus(buildingId);
 if(!status.ok){ addLog(`ℹ ${status.reason}`); if(typeof render==='function') render(); return; }
 const survivors=(state?.survivors||[]).filter(s=>s.status==='activo' && s.location==='base' && s.status!=='muerto');
 openLocationActionPopup({
  title:`Actualizar edificio · ${(state.buildings?.[buildingId]?.name)||buildingId}`,
  info:`<div style="font-size:11px;color:var(--text);line-height:1.6;">Elige <b>1 superviviente</b> para actualizar el edificio. Coste: <b>${status.cost}</b> materiales · Tiempo: <b>${status.days}</b> días.</div>`,
  survivors,
  confirmLabel:'Comenzar actualización',
  onConfirm:(ids)=>{ if(ids && ids.length) startSpecificBuildingUpgrade(buildingId, ids[0]); }
 });
}

function getConstructedBuildingRecycleInfo(buildingId){
 const def=getBuildingDef(buildingId);
 const building=state.buildings?.[buildingId];
 if(!def||!building||!building.built) return {ok:false, reason:'Edificio no encontrado.'};
 if(building._underConstruction) return {ok:false, reason:'Ya está ocupado.'};
 const level=Math.max(1, Number(building.level||1) || 1);
 const baseCost=Math.max(1, Number(building._lastConstructionCost||building.cost||def.cost||1) || 1);
 const yieldMaterials=Math.max(1, Math.floor((baseCost*level)/2));
 const baseDays=Math.max(1, Number(def.recycleDays || Math.ceil((Number(def.constructionDays||2)||2)/2) || 1) || 1);
 return {ok:true, yieldMaterials, days:baseDays};
}

function canRecycleConstructedBuilding(buildingId){
 return getConstructedBuildingRecycleInfo(buildingId);
}

function startConstructedBuildingRecycle(buildingId, survivorId){
 const s=state.survivors.find(x=>x.id===survivorId);
 const building=state.buildings?.[buildingId];
 const info=getConstructedBuildingRecycleInfo(buildingId);
 if(!s||!building||!info.ok) return false;
 building._constructionDays=info.days;
 building._constructionDaysLeft=info.days;
 building._underConstruction=true;
 building._recycleToMaterials=true;
 building._recycleYieldMaterials=info.yieldMaterials;
 building._constructionCost=0;
 building._lastConstructionCost=0;
 s.action={type:'construir', target:buildingId};
 s.status='ocupado';
 addLog(`🧱 ${s.name} comienza a reciclar ${building.name}. Tiempo: ${info.days} día${info.days!==1?'s':''}.`);
 closeBuildingPopup();
 if(typeof render==='function') render();
 return true;
}

function openConstructedBuildingRecyclePopup(buildingId){
 const info=getConstructedBuildingRecycleInfo(buildingId);
 if(!info.ok){ addLog(`ℹ ${info.reason}`); if(typeof render==='function') render(); return; }
 const survivors=(state?.survivors||[]).filter(s=>s.status==='activo' && s.location==='base' && s.status!=='muerto');
 openLocationActionPopup({
  title:`Reciclar edificio · ${(state.buildings?.[buildingId]?.name)||buildingId}`,
  info:`<div style="font-size:11px;color:var(--text);line-height:1.6;">Elige <b>1 superviviente</b> para reciclar el edificio. Tiempo: <b>${info.days}</b> días · Materiales recuperados al terminar: <b>${info.yieldMaterials}</b>.</div>`,
  survivors,
  confirmLabel:'Comenzar reciclaje',
  onConfirm:(ids)=>{ if(ids && ids.length) startConstructedBuildingRecycle(buildingId, ids[0]); }
 });
}

// Called whenever a building levels up

function checkBuildingUnlocks(buildingId){
 // Generador unlocks when Taller reaches level 2
 if(buildingId==='taller'){
 const lvl=state.buildings.taller?.level||0;
 if(lvl>=2&&!state.buildings.generador?.built){
 state.buildings.generador.constructible=true;
 addLog('⚡ El Taller ha alcanzado nivel 2. El Generador ya puede construirse.');
 }
 }
 // Update electricity capacity display
 state.electricityCapacity=getElectricityCapacity();
 state.electricityUsed=getElectricityUsed();
}

// ── SKILL SYSTEM ──
// Returns a bonus object depending on the survivor's skill and context
// context: 'build' | 'explore' | 'event_positive' | 'event_negative' | 'explore_survivor' | 'explore_food' | 'explore_resource'

window.getFarmModeLabel=getFarmModeLabel;
window.getFarmProduction=getFarmProduction;
window.getFarmProductionText=getFarmProductionText;
window.setFarmMode=setFarmMode;

function getBuildingCost(buildingId){const b=state.buildings[buildingId];const base=Number(b?.cost||0);const level=Number(b?.level||0);return Math.ceil(base*Math.pow(2,level))}

function showAlmacenDetail(){
 openStorageModal();
 return;

 state.currentDetail='almacen';
 const b=state.buildings.almacen;
 const built=b&&b.built;
 let html='<div class="metric"><span>Edificio</span><b>Almacén</b></div>';
 html+='<div class="metric"><span>Estado</span><b>'+(built?'✅ Activo':'🔒 Sin construir')+'</b></div>'; if(built) html+='<div class="metric"><span>Modo</span><b>Pruebas de inventario activas</b></div>';
 if(built){
 const slots=4;
 html+='<div class="metric"><span>Capacidad</span><b>'+(state.inventory||[]).length+'/'+slots+' objetos</b></div>';
 const inv=state.inventory||[];
 if(inv.length){
 html+='<div style="margin-top:8px;font-size:10px;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Inventario</div>';
 html+=inv.map(raw=>{
 const item=materializeItem(raw);
 const assignee=item.assignedTo?state.survivors.find(s=>s.id===item.assignedTo):null;
 return '<div style="border:1px solid var(--line2);padding:6px 8px;margin-bottom:4px;font-size:11px;">'
 +'<div style="font-family:var(--font-display);color:var(--amber-bright);">'+escapeHtml(item.name)+'</div>'
 +'<div style="color:var(--muted);margin-top:2px;">'+escapeHtml(item.description||'')+' · '+escapeHtml(getItemTypeLabel(item))+' · '+escapeHtml(getQualityText(item))+'</div>'
 +(assignee?'<div style="color:var(--ok-bright);margin-top:2px;">👤 '+escapeHtml(assignee.name)+'</div>':'<div style="color:var(--dim);margin-top:2px;">Sin asignar</div>')
 +'</div>';
 }).join('');
 html+='<div style="margin-top:10px;"><button class="btn secondary" onclick="openStorageModal()">Gestionar almacén</button></div>';
 } else {
 html+='<div style="color:var(--dim);font-size:11px;text-align:center;padding:12px 0;">// Almacén vacío.</div>';
 }
 }
 detailBox.innerHTML=html;
 openBuildingPopup();
}


