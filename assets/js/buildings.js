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

function normalizeBuildingOutputResource(resource){
 const key=String(resource||'').trim().toLowerCase();
 const aliases={comida:'food',alimento:'food',alimentos:'food',material:'materials',materiales:'materials',medicamento:'meds',medicamentos:'meds',medicina:'meds',medicinas:'meds',combustible:'fuel',electricidad:'electricity',gallina:'chickens',gallinas:'chickens',defensa:'defense',capacidad:'capacity',moral:'morale'};
 return aliases[key]||key;
}

function getBuildingOutputRows(building, level=building?.level){
 if(!building) return [];
 const lvl=Math.max(1, Number(level||building.level||1) || 1);
 const src=building.outputsByLevel||building.outputs||{};
 let raw=null;
 if(Array.isArray(src)) raw=src[lvl-1];
 else if(src&&typeof src==='object') raw=src[String(lvl)]??src[lvl]??null;
 if(!raw) return [];
 const rows=Array.isArray(raw)?raw:[raw];
 return rows.map(row=>({
  resource:normalizeBuildingOutputResource(row?.resource||row?.type||row?.id),
  amount:Number(row?.amount??row?.value??0)||0,
  timing:String(row?.timing||row?.frequency||row?.when||'daily').trim().toLowerCase()||'daily'
 })).filter(row=>row.resource&&Number.isFinite(row.amount)&&row.amount!==0);
}

function getBuildingDailyOutputAmount(building, resource, level=building?.level){
 const clean=normalizeBuildingOutputResource(resource);
 const rows=getBuildingOutputRows(building, level).filter(row=>row.resource===clean && row.timing==='daily');
 if(!rows.length) return null;
 return rows.reduce((sum,row)=>sum+Number(row.amount||0),0);
}

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
 const configuredFood=getBuildingDailyOutputAmount(farm,'food',level);
 let amount=configuredFood!==null?configuredFood:2;
 if(level>=2){
  if(mode===FARM_MODE_A){
   amount=configuredFood!==null?configuredFood:3;
  }else if(mode===FARM_MODE_B){
   amount=isFarmBHarvestDay(day)?7:0;
  }
 }
 if(level>=3){
  if(mode===FARM_MODE_B){
   amount=isFarmBHarvestDay(day)?9:0;
  }else if(configuredFood===null){
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
 const displayLevel=Math.max(1, Number(farm?.level||1) || 1);
 const configuredFood=getBuildingDailyOutputAmount(farm,'food',displayLevel);
 const baseFood=configuredFood!==null?configuredFood:2;
 if(!farm?.built) return `+${baseFood} comida por día`;
 const mode=String(farm.farmMode||FARM_MODE_NONE).trim().toLowerCase();
 const level=Math.max(0, Number(farm.level||0) || 0);
 const irrigationBonus=state.baseUpgrades?.auto_irrigation ? Math.max(0, getBaseUpgradeEffectNumber('auto_irrigation','farmFoodBonus',1)) : 0;
 if(level>=3 && mode===FARM_MODE_B) return `+${9+irrigationBonus} comida cada 2 días`;
 if(level>=2 && mode===FARM_MODE_B) return `+${7+irrigationBonus} comida cada 2 días`;
 if(configuredFood!==null && mode!==FARM_MODE_B) return `+${configuredFood+irrigationBonus} comida por día`;
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
 electricityCost:Math.max(0, Number(up.cost?.electricity ?? up.electricityCost ?? up.costElectricity ?? 0)||0),
 skillRequired:String(up.skillRequired||up.requiredSkill||up.skill||'').trim(),
 buildingId:String(up.buildingId||up.appliesToBuilding||up.appliesTo||up.building||'').trim(),
 requires:rawRequires.map(normalizeBuildingRequirementId).filter(Boolean),
 description:String(up.description||'').trim(),
 devDays:Math.max(1, Number(up.devDays ?? up.developmentDays ?? up.days ?? 2) || 2),
 effects:deepClone(up.effects||{})
 };
}

function getBaseUpgradesCatalog(){
 const source=Array.isArray(gameData.baseUpgrades)&&gameData.baseUpgrades.length
 ? gameData.baseUpgrades
 : (Array.isArray(gameData.config?.baseUpgrades) ? gameData.config.baseUpgrades : []);
 const configured=Array.isArray(source)
 ? source.map((up,idx)=>normalizeBaseUpgradeDefinition(up,idx)).filter(Boolean)
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
function getRemovedAbandonedBuildings(){
 if(typeof state==='undefined'||!state) return {};
 if(!state._removedAbandonedBuildings || typeof state._removedAbandonedBuildings!=='object') state._removedAbandonedBuildings={};
 if(Array.isArray(state._removedAbandonedBuildings)){
  const mapped={};
  state._removedAbandonedBuildings.forEach(id=>{ if(id) mapped[String(id)]=true; });
  state._removedAbandonedBuildings=mapped;
 }
 return state._removedAbandonedBuildings;
}
function isAbandonedBuildingRemoved(id){
 return !!getRemovedAbandonedBuildings()[String(id||'')];
}
function markAbandonedBuildingRemoved(id){
 if(!id) return;
 getRemovedAbandonedBuildings()[String(id)]=true;
}
function isBuildingHiddenUntilUnlocked(def){
 return !!(def?.hiddenUntilUnlocked || def?.hiddenUntilRevealed || def?.mapHiddenUntilUnlocked);
}
function isBuildingRevealedOnMap(def){
 if(!def?.id) return false;
 if(!isBuildingHiddenUntilUnlocked(def)) return true;
 const b=state?.buildings?.[def.id];
 return !!(def.unlocked || def.revealed || b?.mapUnlocked || b?.revealedOnMap);
}
function revealBuildingOnMap(buildingId){
 const def=getBuildingDef(buildingId);
 if(!def) return null;
 const b=ensureBuildingStateEntry(def);
 if(!b) return null;
 b.mapUnlocked=true;
 b.revealedOnMap=true;
 b.constructible=def.constructible!==false;
 def.unlocked=true;
 return b;
}

function getBaseMapBuildings(){
 return (gameData.buildings||[]).filter(b=>{
  if(!b) return false;
  const category=String(b.category||'Base').toLowerCase();
  if(category!=='base') return false;
  const id=String(b.id||'').trim().toLowerCase();
  if(b.abandonedBuilding && isAbandonedBuildingRemoved(id)) return false;
  if(!isBuildingRevealedOnMap(b)) return false;
  if(b.fromAbandoned || String(b.type||'').toLowerCase()==='adaptation') return false;
  if(id==='cantina' || id==='sala_comun') return false;
  return !!b.map;
 });
}

function getSettlementDefenseValue(){
 let total=0;
 const muros=state.buildings?.muros;
 if(muros?.built&&muros?.active) total+=Number(muros.level||0)>=2?2:1;
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

function ensureAbandonedBuildingCatalog(){
 if(!Array.isArray(gameData.config?.camp?.abandonedBuildings)) return;
 const abandonedDefs=gameData.config.camp.abandonedBuildings;
 abandonedDefs.forEach(def=>{
  if(!def||!def.id) return;
  const base={
   id:String(def.id||'').trim(),
   name:def.name||'Edificio abandonado',
   description:def.description||'Una estructura abandonada que puede reciclarse o adaptarse.',
   category:'Base',
   initial:true,
   constructible:false,
   abandonedBuilding:true,
   map:deepClone(def.map||{}),
   recycleDays:Number(def.recycleDays||3)||3,
   recycleYieldMin:Number(def.recycleYieldMin||5)||5,
   recycleYieldMax:Number(def.recycleYieldMax||9)||9,
   effect:'Edificio abandonado. Puede reciclarse para materiales o adaptarse en el futuro.'
  };
  const existing=gameData.buildings.find(b=>b&&b.id===base.id);
  if(existing) Object.assign(existing, {...base, ...existing});
  else gameData.buildings.push(base);
 });
}

function ensureAbandonedAdaptationCatalog(){
 if(!Array.isArray(gameData.buildings)) gameData.buildings=[];
 const defaults=[
  {id:'cantina',name:'Cantina',type:'adaptation',fromAbandoned:true,unlocked:false,cost:6,constructionDays:3,description:'Un espacio social para descansar y ganar moral.',effect:'Permite enviar a un superviviente a la cantina para obtener moral adicional.'},
  {id:'sala_comun',name:'Zona común',type:'adaptation',fromAbandoned:true,unlocked:false,cost:6,constructionDays:3,description:'Un área comunitaria para mejorar la cohesión de la base.',effect:'Mejora el bienestar del asentamiento y ofrece un lugar de descanso.'}
 ];
 defaults.forEach(def=>{
  const existing=gameData.buildings.find(b=>b&&b.id===def.id);
  if(existing) Object.assign(existing, {...def, ...existing});
  else gameData.buildings.push(def);
 });
}

function ensureBuildingCatalog(){
 if(!Array.isArray(gameData.buildings)) gameData.buildings=[];
 const defaults=[
 {id:'huerto',name:'Huerto',cost:3,maxLevel:3,constructible:true,initial:true,category:'Base',constructionDays:2,effect:'Nivel 1: +2 comida. Nivel 2: elige Cultivo A (+3/día) o Cultivo B (+7 cada 2 días). Nivel 3: requiere Pozo y suma +2 comida al estado actual.',outputsByLevel:{1:[{resource:'food',amount:2,timing:'daily'}],2:[{resource:'food',amount:3,timing:'daily'}],3:[{resource:'food',amount:4,timing:'daily'}]},upgradeRequirements:{3:['pozo']},map:{left:'10%',top:'18%',width:'15%',height:'12%'}},
 {id:'taller',name:'Taller',cost:5,maxLevel:5,constructible:true,initial:false,category:'Base',constructionDays:3,effect:'Aporta materiales y desbloquea mejoras.',outputsByLevel:{1:[{resource:'materials',amount:1,timing:'daily'}],2:[{resource:'materials',amount:2,timing:'daily'}],3:[{resource:'materials',amount:3,timing:'daily'}],4:[{resource:'materials',amount:4,timing:'daily'}],5:[{resource:'materials',amount:5,timing:'daily'}]},map:{left:'28%',top:'18%',width:'15%',height:'12%'}},
 {id:'almacen',name:'Almacén',cost:4,maxLevel:3,constructible:true,initial:false,category:'Base',constructionDays:2,effect:'Aumenta la capacidad de almacenamiento.',map:{left:'28%',top:'10%',width:'15%',height:'12%'}},
 {id:'barracones',name:'Barracones',cost:4,maxLevel:3,constructible:true,initial:true,category:'Base',constructionDays:2,effect:'Da cobijo al asentamiento.',map:{left:'46%',top:'18%',width:'15%',height:'12%'}},
 {id:'muros',name:'Muros',cost:4,maxLevel:3,constructible:true,initial:true,category:'Base',constructionDays:2,effect:'Defensa pasiva del asentamiento.',map:{left:'64%',top:'18%',width:'15%',height:'12%'}},
 {id:'atalaya',name:'Atalaya',cost:4,maxLevel:3,constructible:true,initial:false,category:'Base',constructionDays:2,effect:'Nivel 1: +1 defensa total al defender. Nivel 2: prismáticos contra amenazas hostiles. Nivel 3: mejora la vigilancia avanzada del asentamiento.',levelEffects:{1:'+1 defensa total al defender en la base.',2:'+1 defensa al defender y permite usar prismáticos contra amenazas hostiles.',3:'+1 defensa al defender y vigilancia avanzada del asentamiento.'},upgradeRequirements:{3:[{id:'torre_radio',minLevel:2}]},electricityCostByLevel:[0,0,1],map:{left:'82%',top:'18%',width:'12%',height:'12%'}},
 {id:'generador',name:'Generador',cost:6,maxLevel:3,constructible:true,initial:false,category:'Base',constructionDays:3,effect:'Aporta electricidad a la base.',map:{left:'10%',top:'36%',width:'15%',height:'12%'}},
 {id:'pozo',name:'Pozo',cost:2,maxLevel:1,constructible:true,initial:false,category:'Base',constructionDays:2,effect:'Requisito para mejorar el Huerto a nivel 3.',map:{left:'46%',top:'36%',width:'15%',height:'12%'}},
 {id:'gallinero',name:'Gallinero',cost:4,maxLevel:1,constructible:true,initial:false,category:'Base',constructionDays:2,effect:'Produce comida según las gallinas del asentamiento.',map:{left:'24%',top:'34%',width:'15%',height:'12%'}},
 {id:'carcel_improvisada',name:'C\u00e1rcel improvisada',cost:6,maxLevel:1,constructible:true,initial:false,hiddenUntilUnlocked:true,category:'Base',constructionDays:3,effect:'Permite encerrar prisioneros o amenazas capturadas.',description:'Una zona cerrada con refuerzos de fortuna, candados recuperados y vigilancia constante.',map:{left:'66.1%',top:'10.5%',width:'15%',height:'12%'}},
 {id:'cementerio',name:'⛼ Cementerio',cost:0,maxLevel:1,constructible:false,initial:true,category:'Base',constructionDays:0,effect:'Memorial para los caídos del asentamiento.',map:{left:'40%',top:'38%',width:'16%',height:'12%',specialStyle:'border-color:rgba(155,84,84,0.5);background:rgba(50,10,10,0.7);color:rgba(200,150,150,0.8);'}}
 ];
 defaults.forEach(def=>{
 const existing=gameData.buildings.find(b=>b&&b.id===def.id);
 if(existing) Object.assign(existing, {...def, ...existing});
 else gameData.buildings.push(def);
 });
 const medicalBarracks={id:'barracon_medico',name:'Barracón médico',category:'Base',initial:false,constructible:true,cost:5,upgradeCosts:[5,12,25],maxLevel:3,constructionDays:[3,5,5],electricityCost:[1,2,5],effect:'Nivel 1: una vez al día, cura 1 herida simple. Nivel 2: +1 a la tirada de curarse sin medicamento. Nivel 3: una vez al día, cura 1 herida seria.',levelEffects:{1:'Una vez al día, puede curar 1 herida simple.',2:'Añade +1 a la tirada de curarse sin medicamento.',3:'Una vez al día, puede curar 1 herida seria.'},map:{left:'17.4%',top:'44.3%',width:'10.5%',height:'19.2%'}};
 const existingMedical=gameData.buildings.find(b=>b&&b.id===medicalBarracks.id);
 if(existingMedical) Object.assign(existingMedical, {...medicalBarracks, ...existingMedical});
 else gameData.buildings.push(medicalBarracks);
 ensureAbandonedBuildingCatalog();
 ensureAbandonedAdaptationCatalog();
}

function ensureBuildingStateEntry(defOrId){
 const def=typeof defOrId==='string' ? getBuildingDef(defOrId) : defOrId;
 if(!def||!def.id||typeof state==='undefined'||!state.buildings||state.buildings[def.id]){
  return (typeof state!=='undefined'&&state.buildings) ? state.buildings[def?.id] : undefined;
 }
 if(def.abandonedBuilding && isAbandonedBuildingRemoved(def.id)) return undefined;
 state.buildings[def.id]={
  id:def.id,
  name:def.name||def.id,
  desc:def.effect||def.description||'',
  description:def.description||def.effect||'',
  image:def.image||'',
  levelEffects:deepClone(def.levelEffects||{}),
  outputsByLevel:deepClone(def.outputsByLevel||def.outputs||{}),
  cost:Number(def.cost||0),
  built:!!def.initial,
  level:def.initial?1:0,
  active:true,
  constructible:def.constructible!==false,
  maxLevel:Number(def.maxLevel||5),
  category:def.category||'Base',
 map:deepClone(def.map||null),
  hiddenUntilUnlocked:isBuildingHiddenUntilUnlocked(def),
  mapUnlocked:!isBuildingHiddenUntilUnlocked(def) || !!def.unlocked || !!def.initial,
  revealedOnMap:!isBuildingHiddenUntilUnlocked(def) || !!def.unlocked || !!def.initial,
  electricityCost:deepClone(def.electricityCost||0),
  electricityCostByLevel:deepClone(def.electricityCostByLevel||null),
  constructionDays:deepClone(def.constructionDays!=null?def.constructionDays:1),
  upgradeRequirements:deepClone(def.upgradeRequirements||{})
 };
 return state.buildings[def.id];
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
  b.mapUnlocked=true;
  b.revealedOnMap=true;
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
 if(state.buildings.taller?.built&&state.buildings.taller?.active){const workshopMaterials=getBuildingDailyOutputAmount(state.buildings.taller,'materials',state.buildings.taller.level)??state.buildings.taller.level;state.materials+=workshopMaterials;addLog(`El Taller aporta +${workshopMaterials} materiales.`)}
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

function getBuildingElectricityCost(id, targetLevel=null){
 const def=getBuildingDef(id);
 const current=state.buildings?.[id];
 const source=def?.electricityCostByLevel ?? def?.electricityCostLevels ?? (Array.isArray(def?.electricityCost)?def.electricityCost:null) ?? current?.electricityCostByLevel ?? (Array.isArray(current?.electricityCost)?current.electricityCost:null) ?? null;
 if(Array.isArray(source)){
 const level=Math.max(1, Number(targetLevel ?? current?.level ?? 1) || 1);
 const idx=Math.min(source.length-1, Math.max(0, level-1));
 return Math.max(0, Number(source[idx]||0) || 0);
 }
 if(source&&typeof source==='object'){
 const level=Math.max(1, Number(targetLevel ?? current?.level ?? 1) || 1);
 return Math.max(0, Number(source[String(level)] ?? source[level] ?? 0) || 0);
 }
 return Number(def?.electricityCost||current?.electricityCost||0);
}

function getBuildingUpgradeRequirements(buildingId, targetLevel){
 const def=getBuildingDef(buildingId);
 const map=def?.upgradeRequirements||state.buildings[buildingId]?.upgradeRequirements||{};
 const req=map?.[String(targetLevel)] ?? map?.[targetLevel];
 const levelReqs=Array.isArray(req) ? req : [];
 const buildReqs=Number(targetLevel||0)<=1 && Array.isArray(def?.buildRequirements) ? def.buildRequirements : [];
 return [...buildReqs, ...levelReqs];
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
 const cost=getBuildingElectricityCost(b.id, b.level||1);
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
 document.getElementById('decidePopup')?.classList.remove('open');
 if(typeof closeBuildingPopup==='function') closeBuildingPopup();
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
 if(typeof closeBuildingPopup==='function') closeBuildingPopup();
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
 btn.style.cssText='width:100%;text-align:left;padding:8px 10px;line-height:1.5;display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;align-items:center;';
 btn.innerHTML=`<div style="font-family:var(--font-display);font-size:13px;letter-spacing:0.05em;">${escapeHtml(target.name)}</div><div style="font-size:10px;color:var(--muted);margin-top:3px;">Herida ${escapeHtml(curableLevel)} · ${getMoraleLabel(target)} · fatiga ${target.fatigue}/${target.maxFatigue}</div>`;
 const img=typeof getSurvivorImage==='function'?getSurvivorImage(target):'';
 const portrait=img
 ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(target.name)}" style="width:42px;height:42px;object-fit:cover;display:block;">`
 : `<div style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:var(--panel3);color:var(--muted);font-size:9px;">Sin img</div>`;
 btn.innerHTML=`<div style="width:42px;height:42px;border:1px solid var(--line2);overflow:hidden;background:var(--panel3);flex-shrink:0;">${portrait}</div><div style="min-width:0;"><div style="font-family:var(--font-display);font-size:13px;letter-spacing:0.05em;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(target.name)}</div><div style="font-size:10px;color:var(--muted);margin-top:3px;">Herida ${escapeHtml(curableLevel)} · ${getMoraleLabel(target)} · fatiga ${target.fatigue}/${target.maxFatigue}</div></div>`;
 btn.innerHTML=`<div style="width:42px;height:42px;border:1px solid var(--line2);overflow:hidden;background:var(--panel3);flex-shrink:0;">${portrait}</div><div style="min-width:0;"><div style="font-family:var(--font-display);font-size:13px;letter-spacing:0.05em;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(target.name)}</div><div style="font-size:10px;color:var(--muted);margin-top:3px;">Herida ${escapeHtml(curableLevel)} &middot; ${getMoraleLabel(target)} &middot; fatiga ${target.fatigue}/${target.maxFatigue}</div></div>`;
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
 if(Number(up.electricityCost||0)>0&&getElectricityFree()<Number(up.electricityCost||0)) return false;
 if(getBaseUpgradeProject(up.id)?.active) return false;
 return (up.requires||[]).every(req=>buildingIsReady(req));
}

function survivorMeetsBaseUpgradeSkill(survivor, up){
 const required=String(up?.skillRequired||'').trim().toLowerCase();
 if(!required) return true;
 return getSurvivorSkills(survivor).map(sk=>String(sk||'').toLowerCase()).includes(required);
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
 const upgradeDevelopers=availableDevelopers.filter(s=>survivorMeetsBaseUpgradeSkill(s, up));
 const reqs=(up.requires||[]).map(req=>state.buildings[req]?.name||req).join(', ');
 const ready=(up.requires||[]).every(req=>buildingIsReady(req));
 const card=document.createElement('div');
 card.className='build-option';
 const extra=up.id==='electric_fence'?' · Consume 1⚡':up.id==='biodiesel'?' · +1⚡ al Generador actual':' · +1 comida al Huerto';
 const metaExtra=`${Number(up.electricityCost||0)>0?` · Electricidad: ${up.electricityCost}⚡`:''}${up.skillRequired?` · Habilidad: ${escapeHtml(up.skillRequired)}`:''}${up.buildingId?` · Edificio: ${escapeHtml(up.buildingId)}`:''}`;
 const statusLine=built
 ? `<br><span style='color:var(--ok-bright)'>Mejora ya construida.</span>`
 : project?.active
 ? `<br><span style='color:var(--amber-bright)'>En desarrollo por ${escapeHtml(project.developerName||'—')} · ${project.daysLeft}/${project.daysTotal} días restantes.</span>`
 : !ready
 ? `<br><span style='color:var(--warn-bright)'>Faltan requisitos.</span>`
 : up.skillRequired&&!upgradeDevelopers.length
 ? `<br><span style='color:var(--warn-bright)'>No hay supervivientes disponibles con la habilidad requerida.</span>`
 : !availableDevelopers.length
 ? `<br><span style='color:var(--warn-bright)'>No hay supervivientes disponibles para desarrollarla.</span>`
 : `<br><span style='color:var(--muted)'>Elige un superviviente para desarrollarla (${up.devDays} día${up.devDays!==1?'s':''} base).</span>`;
 const selectorHtml=!built&&!project?.active&&ready&&upgradeDevelopers.length
 ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px"><select data-upgrade-dev style="min-width:160px">${upgradeDevelopers.map(s=>`<option value="${escapeAttr(s.id)}">${escapeHtml(s.name)}${getSurvivorSkills(s).map(sk=>(sk||'').toLowerCase()).includes('inventor')?' · Inventor':''}</option>`).join('')}</select><button>Desarrollar</button></div>`
 : `<button ${built||project?.active||!canBuildBaseUpgrade(up)||!upgradeDevelopers.length?'disabled':''}>${built?'Construida':project?.active?'En desarrollo':'Desarrollar'}</button>`;
 card.innerHTML=`<div><div><b>${escapeHtml(up.name)}</b></div><div class='mini'>Coste: ${up.cost} 🔧 · Requiere: ${escapeHtml(reqs||'ninguno')}${extra}${metaExtra}<br>${escapeHtml(up.description)}${statusLine}</div></div>${selectorHtml}`;
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
 if(!survivorMeetsBaseUpgradeSkill(survivor, up)){
 addLog(`${survivor.name} no tiene la habilidad requerida para desarrollar ${up.name}.`);
 return;
 }
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
 const currentElec=current?.built ? getBuildingElectricityCost(def.id, current.level||1) : 0;
 const targetElec=getBuildingElectricityCost(def.id, nextLevel)||0;
 const extraElec=Math.max(0, targetElec-currentElec);
 if(extraElec>0&&getElectricityFree()<extraElec) return {ok:false, reason:`No hay suficiente electricidad libre. Requiere ${extraElec}⚡ adicional.`};
 return {ok:true, cost:buildCost, days:getBuildingConstructionDays(def.id, nextLevel), nextLevel, elecReq:targetElec, extraElec};
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

function getAbandonedDef(id){
 const key=String(id||'').trim();
 if(isAbandonedBuildingRemoved(key)) return null;
 return (gameData?.buildings||[]).find(def=>String(def?.id||'').trim()===key && !!def?.abandonedBuilding) || null;
}
function getAbandonedAdaptationDefs(){
 return (gameData?.buildings||[]).filter(def=>def && def.type==='adaptation' && def.fromAbandoned);
}
function getAbandonedAdaptationDef(id){
 const key=String(id||'').trim().toLowerCase();
 return getAbandonedAdaptationDefs().find(def=>String(def?.id||'').trim().toLowerCase()===key) || null;
}
function appendAbandonedBuildOption(container, def){
 if(!container||!def?.id) return false;
 if(isAbandonedBuildingRemoved(def.id)) return false;
 const building=state?.buildings?.[def.id];
 const busy=!!(building?._underConstruction || building?._abandonedRecycle || building?._abandonedAdaptation);
 const unlocked=getUnlockedAbandonedAdaptations();
 const canAdapt=!busy && unlocked.length>0;
 const box=document.createElement('div');
 box.className='build-option';
 const status=busy?'Trabajo en curso':canAdapt?`${unlocked.length} adaptación${unlocked.length===1?'':'es'} disponible${unlocked.length===1?'':'s'}`:'Sin adaptaciones desbloqueadas';
 box.innerHTML=`<div><div><b>${escapeHtml(def.name||'Edificio abandonado')}</b></div><div class="mini">${escapeHtml(def.description||def.effect||'Puede reciclarse para obtener materiales o adaptarse cuando haya una opción desbloqueada.')} · ${escapeHtml(status)}</div></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;"><button ${busy?'disabled':''} data-action="recycle">Reciclar</button><button ${canAdapt?'':'disabled'} data-action="adapt">Adaptar</button></div>`;
 box.querySelector('[data-action="recycle"]')?.addEventListener('click',()=>{
  if(busy) return;
  document.getElementById('buildModalWrap')?.classList.remove('open');
  openAbandonedRecyclePopup(def.id);
 });
 box.querySelector('[data-action="adapt"]')?.addEventListener('click',()=>{
  if(!canAdapt) return;
  openAbandonedUpgradePopup(def.id);
 });
 container.appendChild(box);
 return true;
}
function getBuiltOrAssignedAbandonedAdaptationIds(){
 const ids=new Set();
 Object.values(state?.buildings||{}).forEach(b=>{
  const pending=String(b?._abandonedAdaptation||'').trim().toLowerCase();
  if(pending) ids.add(pending);
  const builtId=String(b?.id||'').trim().toLowerCase();
  const match=builtId.match(/^(cantina|sala_comun|apartamento)_/);
  if(match) ids.add(match[1]);
 });
 return ids;
}
function getUnlockedAbandonedAdaptations(){
 const used=getBuiltOrAssignedAbandonedAdaptationIds();
 return getAbandonedAdaptationDefs().filter(def=>!!def?.unlocked && !used.has(String(def.id||'').trim().toLowerCase()));
}
function unlockAbandonedBuildingOption(buildingKey, delayed=false){
 const key=String(buildingKey||'').trim().toLowerCase();
 const def=getAbandonedAdaptationDef(key);
 if(!def || def.unlocked) return;
 def.unlocked=true;
 addLog(`${delayed?'[Retrasado] ':''}🏚 Se desbloquea una nueva adaptación de edificio abandonado: ${def.name||def.id}.`);
}
function ensureAdaptationCatalogEntry(oldId, oldB, adaptation){
 const newId=`${adaptation.id}_${oldId}`;
 const oldDef=(gameData?.buildings||[]).find(def=>String(def?.id||'')===String(oldId)) || {};
 const newMap=deepClone(oldDef.map||oldB.map||{});
 if(newMap && typeof newMap==='object' && 'specialStyle' in newMap) delete newMap.specialStyle;
 const description=String(adaptation?.description||'');
 const effect=String(adaptation?.effect||'');
 const newDef={
  id:newId,
  name:adaptation.name,
  category:'Base',
  initial:false,
  constructible:true,
  cost:Math.max(0, Number(adaptation.cost||6)||6),
  maxLevel:Number(adaptation.maxLevel||1),
  map:newMap,
  image:oldB.image||oldDef.image||adaptation.image||'',
  description,
  effect,
  levelEffects:deepClone(adaptation.levelEffects||{1:effect})
 };
 gameData.buildings=(gameData.buildings||[]).filter(def=>String(def?.id||'')!==String(newId));
 gameData.buildings.push(newDef);
 return {newId, description, effect};
}
function startAbandonedRecycle(buildingId, survivorId){
 const b=state?.buildings?.[buildingId];
 const def=getAbandonedDef(buildingId);
 const s=(state?.survivors||[]).find(x=>x && String(x.id)===String(survivorId));
 if(!b || !def || !s) return;
 if(b._underConstruction || b._abandonedAdaptation || b._abandonedRecycle) return;
 if(s.status!=='activo' || s.location!=='base' || s.status==='muerto') return;
 const days=Math.max(1, Number(def.recycleDays||3) || 3);
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
 if(typeof closeBuildingPopup==='function') closeBuildingPopup();
 if(typeof render==='function') render();
}
function startAbandonedAdaptation(buildingId, adaptationId, survivorId){
 const b=state?.buildings?.[buildingId];
 const s=(state?.survivors||[]).find(x=>x && String(x.id)===String(survivorId));
 const adaptation=getAbandonedAdaptationDef(adaptationId);
 if(!b || !s || !adaptation) return;
 if(b._underConstruction || b._abandonedRecycle || b._abandonedAdaptation) return;
 if(s.status!=='activo' || s.location!=='base' || s.status==='muerto') return;
 const adapKey=String(adaptation.id||'').trim().toLowerCase();
 if(getBuiltOrAssignedAbandonedAdaptationIds().has(adapKey)){
  addLog(`❌ Ya existe una ${adaptation.name} en el asentamiento.`);
  return;
 }
 const cost=Math.max(0, Number(adaptation.cost||6) || 6);
 if(Number(state?.materials||0) < cost){
  addLog(`❌ No hay materiales suficientes para adaptar ${b.name}.`);
  return;
 }
 const days=Math.max(1, Number(adaptation.constructionDays||3) || 3);
 state.materials-=cost;
 b._constructionDays=days;
 b._constructionDaysLeft=days;
 b._constructionCost=0;
 b._lastConstructionCost=0;
 b._underConstruction=true;
 b._abandonedAdaptation=adapKey;
 s.action={type:'construir', target:buildingId};
 s.status='ocupado';
 addLog(`🏚 ${s.name} empieza a adaptar ${b.name} en ${adaptation.name}. Coste: ${cost} materiales.`);
 if(typeof closeBuildingPopup==='function') closeBuildingPopup();
 if(typeof render==='function') render();
}
function openAbandonedRecyclePopup(buildingId){
 const def=getAbandonedDef(buildingId);
 if(!def) return;
 openLocationActionPopup({
  title:`Reciclar · ${def.name||'Edificio abandonado'}`,
  info:`<div style="font-size:11px;color:var(--text);line-height:1.6;">Elige <b>1 superviviente</b> para trabajar durante <b>${Math.max(1, Number(def.recycleDays||3) || 3)} días</b>. Al terminar obtendrás entre <b>${Math.max(0, Number(def.recycleYieldMin||5) || 5)}</b> y <b>${Math.max(Math.max(0, Number(def.recycleYieldMin||5) || 5), Number(def.recycleYieldMax||9) || 9)}</b> materiales y el edificio desaparecerá.</div>`,
  survivors:(state?.survivors||[]).filter(s=>s && s.status==='activo' && s.location==='base' && s.status!=='muerto'),
  confirmLabel:'Comenzar reciclaje',
  onConfirm:(ids)=>{ if(ids && ids.length) startAbandonedRecycle(buildingId, ids[0]); }
 });
}
function openAbandonedUpgradePopup(buildingId){
 const unlocked=getUnlockedAbandonedAdaptations();
 if(!unlocked.length){ addLog('🏚 No hay adaptaciones desbloqueadas para este edificio.'); return; }
 const modalWrap=document.getElementById('buildModalWrap');
 const buildOptionsEl=document.getElementById('buildOptions');
 if(!modalWrap || !buildOptionsEl) return;
 buildOptionsEl.innerHTML='';
 unlocked.forEach(def=>{
  const cost=Math.max(0, Number(def.cost||6) || 6);
  const days=Math.max(1, Number(def.constructionDays||3) || 3);
  const effect=String(def.effect||'');
  const disabled=Number(state?.materials||0) < cost;
  const box=document.createElement('div');
  box.className='build-option';
  box.style.opacity=disabled?'0.6':'1';
  box.innerHTML=`<div><div style="font-family:var(--font-display);font-size:16px;color:var(--amber-bright);margin-bottom:6px;">${escapeHtml(def.name||def.id)}</div><div style="font-size:12px;color:var(--text);line-height:1.6;">${escapeHtml(def.description||'')}</div><div style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.6;">Coste: <b>${cost}</b> materiales · Tiempo: <b>${days}</b> días${effect?`<br>Efecto: ${escapeHtml(effect)}`:''}</div></div><div style="margin-top:10px;"><button ${disabled?'disabled':''}>Elegir</button></div>`;
  box.querySelector('button')?.addEventListener('click',()=>{
   modalWrap.classList.remove('open');
   openLocationActionPopup({
    title:`Adaptar edificio · ${def.name}`,
    info:`<div style="font-size:11px;line-height:1.6;">Elige <b>1 superviviente</b> para convertir este edificio abandonado en <b>${escapeHtml(def.name)}</b>.<br>Coste: <b>${cost}</b> materiales · Tiempo: <b>${days}</b> días.</div>`,
    survivors:(state?.survivors||[]).filter(s=>s && s.status==='activo' && s.location==='base' && s.status!=='muerto'),
    confirmLabel:'Comenzar adaptación',
    onConfirm:(ids)=>{ if(ids && ids.length) startAbandonedAdaptation(buildingId, def.id, ids[0]); }
   });
  });
  buildOptionsEl.appendChild(box);
 });
 modalWrap.classList.add('open');
}
function finalizeCompletedAbandonedRecycles(buildingId){
 const b=state?.buildings?.[buildingId];
 if(!b || !b._abandonedRecycle || b._underConstruction) return;
 const minYield=Math.max(0, Number(b._abandonedRecycleMin||5) || 5);
 const maxYield=Math.max(minYield, Number(b._abandonedRecycleMax||9) || 9);
 const materials=minYield + Math.floor(Math.random()*(maxYield-minYield+1));
 state.materials=Number(state.materials||0)+materials;
 addLog(`🧱 ${b.name} ha sido reciclado. +${materials} materiales.`);
 markAbandonedBuildingRemoved(buildingId);
 delete state.buildings[buildingId];
 if(state.currentDetail===buildingId && typeof closeBuildingPopup==='function') closeBuildingPopup();
}
function finalizeCompletedAbandonedAdaptations(buildingId){
 const oldB=state?.buildings[buildingId];
 if(!oldB || !oldB._abandonedAdaptation || oldB._underConstruction) return;
 const adaptation=getAbandonedAdaptationDef(oldB._abandonedAdaptation);
 if(!adaptation) return;
 const {newId, description, effect}=ensureAdaptationCatalogEntry(buildingId, oldB, adaptation);
 delete state.buildings[buildingId];
 state.buildings[newId]={
  id:newId,
  name:adaptation.name,
  desc:effect,
  description,
  image:oldB.image||adaptation.image||'',
  levelEffects:deepClone(adaptation.levelEffects||{1:effect}),
  cost:Math.max(0, Number(adaptation.cost||6) || 6),
  built:true,
  level:1,
  maxLevel:Number(adaptation.maxLevel||1),
  active:true,
  constructible:true
 };
 addLog(`🏗 ${oldB.name} ha sido adaptado y ahora es ${adaptation.name}.`);
 if(state.currentDetail===buildingId && typeof closeBuildingPopup==='function') closeBuildingPopup();
}

 state.electricityUsed=getElectricityUsed();

// ── SKILL SYSTEM ──
// Returns a bonus object depending on the survivor's skill and context
// context: 'build' | 'explore' | 'event_positive' | 'event_negative' | 'explore_survivor' | 'explore_food' | 'explore_resource'

function checkBuildingUnlocks(buildingId){
 const id=String(buildingId||'').trim();
 if(id==='taller'){
  const tallerLevel=Number(state?.buildings?.taller?.level||0);
  const generator=state?.buildings?.generador;
  if(tallerLevel>=2 && generator && !generator.built && !generator._unlockedByTaller){
   generator.constructible=true;
   generator._unlockedByTaller=true;
   addLog('El Taller ha alcanzado nivel 2. El Generador ya puede construirse.');
  }
 }
 state.electricityCapacity=getElectricityCapacity();
 state.electricityUsed=getElectricityUsed();
}

window.getFarmModeLabel=getFarmModeLabel;
window.getFarmProduction=getFarmProduction;
window.getFarmProductionText=getFarmProductionText;
window.setFarmMode=setFarmMode;
window.getBuildingOutputRows=getBuildingOutputRows;
window.getBuildingDailyOutputAmount=getBuildingDailyOutputAmount;
window.checkBuildingUnlocks=checkBuildingUnlocks;
window.ensureBuildingStateEntry=ensureBuildingStateEntry;
window.appendAbandonedBuildOption=appendAbandonedBuildOption;
window.isAbandonedBuildingRemoved=isAbandonedBuildingRemoved;
window.isBuildingHiddenUntilUnlocked=isBuildingHiddenUntilUnlocked;
window.isBuildingRevealedOnMap=isBuildingRevealedOnMap;
window.revealBuildingOnMap=revealBuildingOnMap;

function getBuildingCost(buildingId,targetLevel=null){
 const b=state.buildings[buildingId];
 const def=getBuildingDef(buildingId)||{};
 const nextLevel=Math.max(1, Number(targetLevel ?? (Number(b?.level||0)+1)) || 1);
 const source=def.upgradeCosts ?? b?.upgradeCosts ?? null;
 if(Array.isArray(source)){
  const idx=Math.min(source.length-1, Math.max(0, nextLevel-1));
  const value=Number(source[idx]);
  if(Number.isFinite(value)) return Math.max(0, Math.ceil(value));
 }
 if(source&&typeof source==='object'){
  const value=Number(source[String(nextLevel)] ?? source[nextLevel]);
  if(Number.isFinite(value)) return Math.max(0, Math.ceil(value));
 }
 const base=Number(b?.cost||def.cost||0);
 const currentLevel=Number(b?.level||0);
 return Math.ceil(base*Math.pow(2,currentLevel));
}

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
