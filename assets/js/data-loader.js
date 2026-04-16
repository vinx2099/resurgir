// ── Runtime JSON import (drag & drop or file picker) ──

function getNameTokenAliases(key){
 const clean=String(key||'').trim().toLowerCase();
 if(!clean) return [];
 const aliases=[clean];
 if(clean==='item') aliases.push('items');
 else if(clean==='items') aliases.push('item');
 if(clean==='location') aliases.push('locations');
 else if(clean==='locations') aliases.push('location');
 return [...new Set(aliases)];
}
function getNameTokenSource(container, key){
 const aliases=getNameTokenAliases(key);
 for(const alias of aliases){
  const raw=container?.[alias];
  let source=[];
  if(Array.isArray(raw)) source=raw;
  else if(raw && typeof raw==='object'){
   if(Array.isArray(raw.entries)) source=raw.entries;
   else if(Array.isArray(raw.items)) source=raw.items;
   else if(Array.isArray(raw.list)) source=raw.list;
   else if(Array.isArray(raw.options)) source=raw.options;
  }
  if(source.length) return source;
 }
 return [];
}
function normalizeNameTokenEntry(entry){
 if(typeof entry==='string') return entry.trim();
 if(entry && typeof entry==='object') return String(entry.text||entry.name||entry.label||entry.value||'').trim();
 return '';
}
function getNameTokenPool(key){
 const clean=String(key||'').trim().toLowerCase();
 if(!clean) return [];
 const source=getNameTokenSource(gameData.names||{}, clean);
 return source.map(normalizeNameTokenEntry).filter(Boolean);
}
function pickNameTokenValue(key){
 const pool=getNameTokenPool(key);
 if(!pool.length) return null;
 return pool[Math.floor(Math.random()*pool.length)] || null;
}
function replaceDynamicNameTokens(text, extraMap={}){
 const source=String(text??'');
 if(!source) return source;
 return source.replace(/\{([a-zA-Z0-9_]+)\}/g,(match,key)=>{
  const clean=String(key||'').trim();
  const lowered=clean.toLowerCase();
  if(Object.prototype.hasOwnProperty.call(extraMap, clean)) return String(extraMap[clean] ?? '');
  if(Object.prototype.hasOwnProperty.call(extraMap, lowered)) return String(extraMap[lowered] ?? '');
  const picked=pickNameTokenValue(lowered);
  return picked!=null ? picked : match;
 });
}

const DATA_FILE_LABELS={events:'events.json',story:'story_events.json',survivors:'survivors.json',buildings:'buildings.json',config:'config.json',locations:'locations.json',hostiles:'hostiles.json',zones:'zones.json',loot:'loot.json',items:'items.json',dogs:'dogs.json',threats:'threats.json',names:'names.json',npcs:'npc.json',baseUpgrades:'base_upgrades.json'};
const OPTIONAL_DATA_TYPES=new Set(['loot','items','dogs','threats','names','npcs','baseUpgrades']);

const REQUIRED_GAME_DATA=[
 {type:'events',label:'events.json',validate:v=>Array.isArray(v)&&v.length>0,reason:'vacío o no válido'},
 {type:'survivors',label:'survivors.json',validate:v=>Array.isArray(v)&&v.length>0,reason:'vacío o no válido'},
 {type:'buildings',label:'buildings.json',validate:v=>Array.isArray(v)&&v.length>0,reason:'vacío o no válido'},
 {type:'config',label:'config.json',validate:v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length>0,reason:'vacío o no válido'},
 {type:'locations',label:'locations.json',validate:v=>Array.isArray(v)&&v.length>0,reason:'vacío o no válido'},
 {type:'hostiles',label:'hostiles.json',validate:v=>Array.isArray(v)&&v.length>0,reason:'vacío o no válido'},
 {type:'zones',label:'zones.json',validate:v=>Array.isArray(v)&&v.length>0,reason:'vacío o no válido'},
];

function normalizeEventConditionShape(ev){
 if(!ev || typeof ev !== 'object' || Array.isArray(ev)) return ev;
 if(!ev.condition && Array.isArray(ev.conditions)){
  ev.condition={type:'and',conditions:ev.conditions};
 }
 return ev;
}
function normalizeEventConditionList(list){
 return Array.isArray(list) ? list.map(ev=>normalizeEventConditionShape(ev)) : list;
}

function clearDataLoadErrors(){
 dataLoadState.errors=[];
 dataLoadState.loaded=[];
 updateDataErrorUI();
}
function clearDataLoadErrorFor(fileName){
 dataLoadState.errors=dataLoadState.errors.filter(err=>err.file!==fileName);
 if(!dataLoadState.loaded.includes(fileName)) dataLoadState.loaded.push(fileName);
 updateDataErrorUI();
}
function handleDataLoadError(fileName, reason){
 const msg=reason||'No se pudo cargar';
 const existing=dataLoadState.errors.find(err=>err.file===fileName);
 if(existing) existing.reason=msg;
 else dataLoadState.errors.push({file:fileName,reason:msg});
 updateDataErrorUI();
}
function getMissingRequiredData(){
 const missing=[];
 REQUIRED_GAME_DATA.forEach(req=>{
 const value = req.type==='events'
 ? ([...(gameData.events||[]), ...(gameData.story_events||[])])
 : req.type==='locations'
 ? (gameData.locationTemplates||[])
 : gameData[req.type];
 if(!req.validate(value)) missing.push({file:req.label, reason:req.reason});
 });
 return missing;
}
function isGameDataReady(){
 const missing=getMissingRequiredData();
 missing.forEach(item=>handleDataLoadError(item.file,item.reason));
 return missing.length===0 && dataLoadState.errors.length===0;
}
function updateDataErrorUI(){
 const banner=document.getElementById('dataErrorBanner');
 const overlay=document.getElementById('dataErrorOverlay');
 const list=document.getElementById('dataErrorOverlayList');
 const hint=document.getElementById('dataErrorOverlayHint');
 const intro=document.getElementById('introOverlay');
 if(!banner || !overlay || !list || !hint) return;
 if(!dataLoadState.errors.length){
 banner.style.display='none';
 overlay.style.display='none';
 list.innerHTML='';
 hint.textContent='';
 return;
 }
 const lines=dataLoadState.errors
 .map(err=>`• <strong>${escapeHtml(err.file)}</strong>: ${escapeHtml(err.reason)}`)
 .join('<br>');
 banner.innerHTML=`<strong>ERROR DE DATOS</strong> — No se han cargado los datos correctos y la partida no puede iniciarse.<br>${lines}`;
 banner.style.display='block';
 list.innerHTML=lines;
 hint.textContent = window.location.protocol==='file:'
 ? 'Estás abriendo el HTML con file://. Muchos navegadores bloquean la carga de JSON locales en ese modo. Abre el juego desde un servidor local o desde la versión publicada en web para que pueda leer la carpeta /data.'
 : 'Comprueba que los archivos existen dentro de /data, que sus nombres son correctos y que contienen JSON válido. Sin esos archivos, la partida no puede arrancar.';
 overlay.style.display='flex';
 if(intro) intro.style.display='none';
}

function importGameJSON(type, jsonData, silent=false){
 try{
 const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
 if(type==='events'){
 if(!Array.isArray(data)) throw new Error('events.json no contiene un array');
 const normalizedEvents=normalizeEventConditionList(data);
 gameData.story_events=normalizedEvents.filter(e=>e.type==='story');
 gameData.events=normalizedEvents.filter(e=>e.type!=='story');
 clearDataLoadErrorFor('events.json');
 if(!silent){
  const questCount=gameData.events.filter(e=>e&&e.type==='quest').length;
  addLog(`events.json importado: ${gameData.events.length} eventos · ${gameData.story_events.length} historia · ${questCount} quest.`);
 }
 }
 else if(type==='story') { if(!Array.isArray(data)) throw new Error('story_events.json no contiene un array'); gameData.story_events=normalizeEventConditionList(data); clearDataLoadErrorFor('story_events.json'); if(!silent) addLog(`story_events.json importado: ${data.length} eventos.`); }
 else if(type==='survivors'){ if(!Array.isArray(data)) throw new Error('survivors.json no contiene un array'); gameData.survivors=data; clearDataLoadErrorFor('survivors.json'); if(!silent) addLog(`survivors.json importado: ${data.length} supervivientes.`); }
 else if(type==='buildings'){ if(!Array.isArray(data)) throw new Error('buildings.json no contiene un array'); gameData.buildings=data; clearDataLoadErrorFor('buildings.json'); if(!silent) addLog(`buildings.json importado: ${data.length} edificios.`); }
 else if(type==='config') { if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error('config.json no contiene un objeto'); gameData.config=data; clearDataLoadErrorFor('config.json'); try{ if(typeof applyAudioSettingsFromConfig==='function') applyAudioSettingsFromConfig(); }catch(audioErr){ console.warn('No se pudieron aplicar los ajustes de audio desde config:', audioErr); } if(!silent) addLog('config.json importado.'); }
 else if(type==='locations'){
 const normalized = Array.isArray(data)
 ? data
 : Array.isArray(data?.locations)
 ? data.locations
 : Array.isArray(data?.locationTemplates)
 ? data.locationTemplates
 : null;
 if(!Array.isArray(normalized)) throw new Error('locations.json debe contener un array o un objeto con "locations" o "locationTemplates"');
 gameData.locationTemplates=normalized;
 clearDataLoadErrorFor('locations.json');
 if(!silent) addLog(`locations.json importado: ${normalized.length} tipos.`);
 }
 else if(type==='hostiles') { if(!Array.isArray(data)) throw new Error('hostiles.json no contiene un array'); gameData.hostiles=data; clearDataLoadErrorFor('hostiles.json'); if(!silent) addLog(`hostiles.json importado: ${data.length} tipos.`); }
 else if(type==='zones') { if(!Array.isArray(data)) throw new Error('zones.json no contiene un array'); gameData.zones=data; clearDataLoadErrorFor('zones.json'); if(!silent) addLog(`zones.json importado: ${data.length} zonas.`); }
 else if(type==='loot') { if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error('loot.json no contiene un objeto'); gameData.loot=data; clearDataLoadErrorFor('loot.json'); if(!silent) addLog(`loot.json importado: ${Object.keys(data).length} niveles.`); }
 else if(type==='items') { if(!Array.isArray(data)) throw new Error('items.json no contiene un array'); gameData.items=data; clearDataLoadErrorFor('items.json'); if(!silent) addLog(`items.json importado: ${data.length} objetos.`); }
 else if(type==='dogs') { if(!Array.isArray(data)) throw new Error('dogs.json no contiene un array'); gameData.dogs=data; clearDataLoadErrorFor('dogs.json'); if(!silent) addLog(`dogs.json importado: ${data.length} perros.`); }
 else if(type==='threats') {
 const normalized = Array.isArray(data)
 ? data
 : Array.isArray(data?.threats)
 ? data.threats
 : null;
 if(!Array.isArray(normalized)) throw new Error('threats.json debe contener un array o un objeto con "threats"');
 gameData.threats=normalized;
 clearDataLoadErrorFor('threats.json');
 if(!silent) addLog(`threats.json importado: ${normalized.length} amenazas.`);
 }
 else if(type==='names') {
 if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error('names.json debe contener un objeto');
 gameData.names=data;
 clearDataLoadErrorFor('names.json');
 if(!silent) addLog(`names.json importado: ${Object.keys(data).length} categorías.`);
 }
 else if(type==='npcs') { if(!Array.isArray(data)) throw new Error('npc.json no contiene un array'); gameData.npcs=data; clearDataLoadErrorFor('npc.json'); if(typeof ensureNpcRuntimeState==='function') ensureNpcRuntimeState(); if(!silent) addLog(`npc.json importado: ${data.length} NPCs.`); }
 else if(type==='baseUpgrades') { if(!Array.isArray(data)) throw new Error('base_upgrades.json no contiene un array'); gameData.baseUpgrades=data; clearDataLoadErrorFor('base_upgrades.json'); if(!silent) addLog(`base_upgrades.json importado: ${data.length} mejoras.`); }
 if(!silent) render();
 } catch(e) {
 handleDataLoadError(DATA_FILE_LABELS[type]||type, e.message);
 if(!silent) addLog('Error al importar JSON: ' + e.message);
 }
}


async function loadFromFiles(){
 clearDataLoadErrors();
 const files = [
 ['events', ['./data/events.json']],
 ['survivors', ['./data/survivors.json']],
 ['buildings', ['./data/buildings.json']],
 ['config', ['./data/config.json']],
 ['locations', ['./data/locations.json','./data/location.json','./data/Locations.json']],
 ['hostiles', ['./data/hostiles.json']],
 ['zones', ['./data/zones.json']],
 ['loot', ['./data/loot.json']],
 ['items', ['./data/items.json']],
 ['dogs', ['./data/dogs.json']],
 ['threats', ['./data/threats.json']],
 ['names', ['./data/names.json']],
 ['npcs', ['./data/npc.json','./data/npcs.json']],
 ['baseUpgrades', ['./data/base_upgrades.json']],
 ];

 async function fetchJsonFromCandidates(paths){
 let lastError = null;
 for(const path of paths){
 try{
 const r = await fetch(path, {cache:'no-store'});
 if(!r.ok) throw new Error(`HTTP ${r.status}`);
 const data = await r.json();
 return {data, path};
 }catch(err){
 lastError = {path, message: err?.message || 'No se pudo cargar'};
 }
 }
 throw new Error(lastError ? `${lastError.message} (${lastError.path})` : 'No se pudo cargar');
 }

 const results = await Promise.allSettled(
 files.map(([,paths]) => fetchJsonFromCandidates(paths))
 );
 const loaded = [];
 results.forEach(({status, value, reason}, i) => {
 const [type, paths] = files[i];
 const primaryName = paths[0].split('/').pop();
 if(status === 'fulfilled'){
 importGameJSON(type, value.data, true);
 loaded.push(value.path.split('/').pop());
 } else if(!OPTIONAL_DATA_TYPES.has(type)) {
 handleDataLoadError(primaryName, reason?.message || 'No se pudo cargar');
 }
 });
 if(loaded.length) addLog(`Cargado desde /data: ${loaded.join(', ')}.`);
 if(dataLoadState.errors.length) addLog('Error de datos: no se han cargado los JSON obligatorios.');
}


function loadDefaults(){
 gameData.events=[];
 gameData.story_events=[];
 gameData.survivors=[];
 gameData.buildings=[];
 gameData.config=null;
 gameData.locationTemplates=[];
 gameData.hostiles=[];
 gameData.zones=[];
 gameData.loot={};
 gameData.items=[];
 gameData.dogs=[];
 gameData.threats=[];
 gameData.names={};
 gameData.npcs=[];
 gameData.baseUpgrades=[];
 if(state && state.npcs) state.npcs={};
 if(state && state.npcContinuousEffects) state.npcContinuousEffects={};
}

loadDefaults();
