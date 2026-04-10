// ── STATE ──
let mode = 'direct';
let events = [];
let activeEventTab = 'all';
let activeEventTag = 'all';
let eventSearchQuery = '';
const EVENT_TABS = [
  { key:'all', label:'Todos' },
  { key:'city', label:'Diario' },
  { key:'weekly', label:'Semanal' },
  { key:'story', label:'Historia' },
  { key:'quest', label:'Quest' },
  { key:'explore', label:'Exploración' },
  { key:'ambush', label:'Emboscada' },
  { key:'personal', label:'Personal' }
];
// storyEvents merged into events (distinguished by type='story')
let uploadedImageUrl = '';
let hostileDefs = [];
let buildingDefs = [];
let itemDefs = [];
let threatDefs = [];
let survivorDefs = [];
let skillDefs = [];
const dataLoadWarnings = new Map();
function renderDataWarnings(){
  const el = document.getElementById('dataWarningBanner');
  if(!el) return;
  if(!dataLoadWarnings.size){ el.style.display='none'; el.innerHTML=''; return; }
  const items = [...dataLoadWarnings.entries()].map(([file,msg])=>`• <strong>${file}</strong>: ${msg}`).join('<br>');
  const hint = window.location.protocol==='file:'
    ? '<br><span style="color:#ffd8a8">Estás abriendo el editor con file://. Muchos navegadores bloquean la lectura de JSON locales en ese modo. Usa un servidor local o la versión web.</span>'
    : '<br><span style="color:#ffd8a8">Comprueba que events.json, hostiles.json, buildings.json, items.json, threats.json y survivors.json existen dentro de /data y que contienen arrays JSON válidos.</span>';
  el.innerHTML = `<strong>ERROR DE DATOS</strong> — No se han cargado los datos correctos.<br>${items}${hint}`;
  el.style.display='block';
}
function setDataWarning(file, msg){ dataLoadWarnings.set(file, msg); renderDataWarnings(); }
function clearDataWarning(file){ dataLoadWarnings.delete(file); renderDataWarnings(); }


function normalizeEventType(type){
  return type || 'city';
}
function getEventTypeLabel(type){
  const key = normalizeEventType(type);
  if(key==='city') return '📋 Diario';
  if(key==='weekly') return '📅 Semanal';
  if(key==='story') return '📖 Historia';
  if(key==='quest') return '📜 Quest';
  if(key==='explore') return '🧭 Exploración';
  if(key==='ambush') return '🚨 Emboscada';
  if(key==='personal') return '🗣 Personal';
  return key;
}
function matchesActiveEventTab(ev){
  const key = activeEventTab || 'all';
  if(key==='all') return true;
  return normalizeEventType(ev?.type) === key;
}
function getTabCount(key){
  if(key==='all') return events.length;
  return events.filter(ev => normalizeEventType(ev?.type) === key).length;
}
function ensureValidActiveEventTab(){
  if(activeEventTab==='all') return;
  if(getTabCount(activeEventTab)>0) return;
  activeEventTab='all';
}
function setActiveEventTab(key){
  activeEventTab = key || 'all';
  renderEventTabs();
  renderEventList();
}
function renderEventTabs(){
  const wrap = document.getElementById('eventTabs');
  if(!wrap) return;
  wrap.innerHTML = '';
  EVENT_TABS.forEach(tab => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'event-tab' + ((activeEventTab||'all')===tab.key ? ' active' : '');
    btn.textContent = `${tab.label} (${getTabCount(tab.key)})`;
    btn.addEventListener('click', () => setActiveEventTab(tab.key));
    wrap.appendChild(btn);
  });
}
function normalizeTagValue(tag){
  return String(tag || '').trim().toLowerCase();
}
function getAvailableEventTags(){
  return [...new Set(
    events.flatMap(ev => Array.isArray(ev?.tags) ? ev.tags : [])
      .map(normalizeTagValue)
      .filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b,'es'));
}
function renderEventTagFilter(){
  const sel = document.getElementById('eventTagFilter');
  if(!sel) return;
  const current = activeEventTag || 'all';
  const tags = getAvailableEventTags();
  sel.innerHTML = '<option value="all">Todos los tags</option>';
  tags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = `#${tag}`;
    sel.appendChild(opt);
  });
  sel.value = tags.includes(current) ? current : 'all';
  activeEventTag = sel.value || 'all';
}
function matchesActiveEventTag(ev){
  const key = activeEventTag || 'all';
  if(key==='all') return true;
  const tags = Array.isArray(ev?.tags) ? ev.tags.map(normalizeTagValue) : [];
  return tags.includes(key);
}
function matchesEventSearch(ev){
  const q = String(eventSearchQuery || '').trim().toLowerCase();
  if(!q) return true;
  const hay = `${ev?.name || ''} ${ev?.id || ''}`.toLowerCase();
  return hay.includes(q);
}
function getListFilteredEvents(){
  return events.filter(ev => matchesActiveEventTab(ev) && matchesActiveEventTag(ev) && matchesEventSearch(ev));
}

function getSurvivorDefs(){
  return Array.isArray(survivorDefs) ? survivorDefs.filter(Boolean) : [];
}
function getSurvivorById(id){
  const clean = String(id || '').trim();
  if(!clean) return null;
  return getSurvivorDefs().find(s => String(s.id || '').trim() === clean) || null;
}

function getActorTargetOptions(includeAllActors=false){
  const opts = [
    ['random', 'Superviviente aleatorio'],
    ['actor1', 'Actor 1 ({actor1})'],
    ['actor2', 'Actor 2 ({actor2})'],
    ['actor3', 'Actor 3 ({actor3})'],
    ['actor4', 'Actor 4 ({actor4})'],
    ['__action__', 'Quien realizó la acción']
  ];
  if(includeAllActors) opts.splice(5, 0, ['allActors', 'Todos los actores']);
  return opts;
}
function getSkillOptions(){
  const base = Array.isArray(skillDefs) ? skillDefs.filter(Boolean) : [];
  if(base.length) return base;
  const fromSurvivors = [...new Set(
    getSurvivorDefs().flatMap(s => Array.isArray(s.skills) ? s.skills : [])
      .map(x => typeof x === 'string' ? x : (x?.name || x?.id || ''))
      .map(x => String(x || '').trim())
      .filter(Boolean)
  )];
  return fromSurvivors.sort((a,b)=>a.localeCompare(b,'es'));
}
function populateSkillRequirementSelects(){
  const skills = getSkillOptions();
  ['A','B','C','D'].forEach(letter => {
    const sel = document.getElementById(`f-reqSkill${letter}`);
    if(!sel) return;
    const current = sel.value || '';
    sel.innerHTML = '<option value="">Selecciona habilidad…</option>' + skills.map(skill => `<option value="${skill.replace(/"/g,'&quot;')}">${skill}</option>`).join('');
    if(skills.includes(current)) sel.value = current;
  });
}
function resolveEventPreviewImage(ev){
  if(ev?.image) return ev.image;
  if((ev?.type || '') === 'personal'){
    const fixedId = ev.personalSurvivorId || ev.survivorId || '';
    return fixedId ? (getSurvivorById(fixedId)?.image || '') : '';
  }
  return '';
}

function updatePersonalSurvivorUI(){
  const isPersonal = (document.getElementById('f-type')?.value || '') === 'personal';
  const useFixed = !!document.getElementById('f-personalUseFixedSurvivor')?.checked;
  const modeField = document.getElementById('personalModeField');
  const survivorField = document.getElementById('personalSurvivorField');
  const participantsInput = document.getElementById('f-participants');
  if(modeField) modeField.style.display = isPersonal ? '' : 'none';
  if(survivorField) survivorField.style.display = (isPersonal && useFixed) ? '' : 'none';
  if(isPersonal && participantsInput){
    const current = Number(participantsInput.value || 0) || 0;
    if(current < 1) participantsInput.value = 1;
  }
}

async function loadItemsForEditor(){
  try{
    const res = await fetch('./data/items.json', {cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    itemDefs = await res.json();
    clearDataWarning('items.json');
  }catch(err){
    setDataWarning('items.json', err?.message || 'No se pudo cargar');
  }
}

async function loadSkillsForEditor(){
  try{
    const res = await fetch('./data/skills.json', {cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const incoming = await res.json();
    const bucket = [];
    const collect = (value) => {
      if(Array.isArray(value)){
        value.forEach(item => {
          if(typeof item === 'string') bucket.push(item);
          else if(item && (item.name || item.id || item.label)) bucket.push(item.name || item.label || item.id);
        });
      }
    };
    if(Array.isArray(incoming)) collect(incoming);
    else if(incoming && typeof incoming === 'object'){
      Object.values(incoming).forEach(collect);
    }
    skillDefs = [...new Set(bucket.map(x => String(x || '').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    clearDataWarning('skills.json');
  }catch(err){
    setDataWarning('skills.json', err?.message || 'No se pudo cargar');
    skillDefs = [];
  }
  populateSkillRequirementSelects();
}
const EMBEDDED_EVENTS = [];
const EMBEDDED_HOSTILES = [];
const EMBEDDED_ITEMS = [];
const EMBEDDED_THREATS = [];

// ── BUILDINGS & RESOURCES (matching the game) ──
const RESOURCES = ['food','chickens','materials','fuel','meds','electricity'];
const RESOURCE_LABELS = {
  food:'Comida',
  chickens:'Gallinas',
  materials:'Materiales',
  fuel:'Combustible',
  meds:'Medicamentos',
  electricity:'Electricidad',
  morale:'Estabilidad (legacy)',
  stability:'Estabilidad'
};
const DEFAULT_BUILDINGS = [
  { id:'huerto', name:'Huerto', category:'Base' },
  { id:'atalaya', name:'Atalaya', category:'Base' },
  { id:'muros', name:'Muros', category:'Base' },
  { id:'barracones', name:'Barracones', category:'Base' },
  { id:'taller', name:'Taller', category:'Base' },
  { id:'hospital', name:'Hospital', category:'Base' },
  { id:'generador', name:'Generador', category:'Base' },
  { id:'pozo', name:'Pozo de Agua', category:'Base' },
  { id:'gallinero', name:'Gallinero', category:'Base' },
  { id:'almacen', name:'Almacén', category:'Base' },
  { id:'cementerio', name:'⛼ Cementerio', category:'Base' }
];

function getBaseBuildings(){
  const source = (buildingDefs && buildingDefs.length ? buildingDefs : DEFAULT_BUILDINGS)
    .filter(b => !b || !b.category || b.category === 'Base');
  const unique = [];
  const seen = new Set();
  source.forEach(b => {
    if(!b || !b.id || seen.has(b.id)) return;
    seen.add(b.id);
    unique.push(b);
  });
  return unique;
}

function getBuildingLabel(id){
  const found = getBaseBuildings().find(b => b.id === id);
  return found?.name || id;
}

function populateBuildingSelects(){
  const baseBuildings = getBaseBuildings();
  const options = baseBuildings.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  const condSelect = document.getElementById('f-condBuilding');
  if(condSelect){
    const current = condSelect.value;
    condSelect.innerHTML = options;
    if(baseBuildings.some(b => b.id === current)) condSelect.value = current;
  }
}

function appendBuildingOptions(selectEl){
  if(!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = '';
  getBaseBuildings().forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.name;
    selectEl.appendChild(opt);
  });
  if([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
}


function getThreatDefs(){
  const source = Array.isArray(threatDefs) && threatDefs.length ? threatDefs : EMBEDDED_THREATS;
  return source.filter(th => th && (th.id || th.templateId));
}

function getThreatLabel(id){
  const found = getThreatDefs().find(th => String(th.id || th.templateId) === String(id));
  return found?.name || found?.label || id;
}

function appendThreatOptions(selectEl){
  if(!selectEl) return;
  const current = selectEl.value;
  const defs = getThreatDefs();
  selectEl.innerHTML = '';
  if(defs.length){
    defs.forEach(th => {
      const opt = document.createElement('option');
      const threatId = th.id || th.templateId;
      opt.value = threatId;
      const type = th.type ? ` · ${th.type}` : '';
      opt.textContent = `${th.name || th.label || threatId}${type}`;
      selectEl.appendChild(opt);
    });
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— Sin amenazas cargadas —';
    selectEl.appendChild(opt);
  }
  const manual = document.createElement('option');
  manual.value = '__manual_threat__';
  manual.textContent = selectEl.dataset.manualThreatLabel || '✍ ID manual…';
  selectEl.appendChild(manual);
  if([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
  else if(selectEl.dataset.manualThreatId) selectEl.value = '__manual_threat__';
  else if(defs.length) selectEl.value = defs[0].id || defs[0].templateId;
}


function getAvailableEventDefs(){
  const source = Array.isArray(events) && events.length ? events : EMBEDDED_EVENTS;
  const unique = [];
  const seen = new Set();
  source.forEach(ev => {
    const eventId = String(ev?.id || '').trim();
    if(!eventId || seen.has(eventId)) return;
    seen.add(eventId);
    unique.push(ev);
  });
  return unique.sort((a,b) => String(a?.name || a?.id || '').localeCompare(String(b?.name || b?.id || ''), 'es'));
}

function appendEventOptions(selectEl, options={}){
  if(!selectEl) return;
  const current = selectEl.value;
  const onlyType = options?.onlyType || '';
  const emptyLabel = options?.emptyLabel || '— Sin eventos cargados —';
  let defs = getAvailableEventDefs();
  if(onlyType) defs = defs.filter(ev => normalizeEventType(ev?.type) === onlyType);
  selectEl.innerHTML = '';
  if(defs.length){
    defs.forEach(ev => {
      const opt = document.createElement('option');
      opt.value = ev.id;
      opt.textContent = `${ev.name || ev.id} · ${ev.id}`;
      selectEl.appendChild(opt);
    });
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = emptyLabel;
    selectEl.appendChild(opt);
  }
  const manual = document.createElement('option');
  manual.value = '__manual_event__';
  manual.textContent = selectEl.dataset.manualEventLabel || '✍ ID manual…';
  selectEl.appendChild(manual);
  if([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
  else if(selectEl.dataset.manualEventId) selectEl.value = '__manual_event__';
  else if(defs.length) selectEl.value = defs[0].id;
}

function ensureActivateEventPanel(row){
  if(row._activateEventPanel) return row._activateEventPanel;
  const panel = document.createElement('div');
  panel.className = 'activate-event-panel';
  panel.style.cssText = 'grid-column:1/-1;display:grid;grid-template-columns:minmax(220px,1.4fr) repeat(3,minmax(120px,0.7fr));gap:8px;margin-top:6px;padding:10px;border:1px solid rgba(106,184,158,0.35);background:rgba(106,184,158,0.06);';

  const heading = document.createElement('div');
  heading.textContent = 'Configurar activación de la quest';
  heading.style.cssText = 'grid-column:1/-1;font-size:11px;font-weight:700;color:var(--accent-bright);letter-spacing:.04em;text-transform:uppercase;margin-bottom:2px;';
  panel.appendChild(heading);

  const eventSelect = document.createElement('select');
  eventSelect.className = 'activate-event-target';
  appendEventOptions(eventSelect, { onlyType:'quest', emptyLabel:'— Sin quests cargadas —' });

  const minDays = document.createElement('input');
  minDays.className = 'activate-event-min';
  minDays.type = 'number';
  minDays.min = '0';
  minDays.max = '999';
  minDays.value = '3';

  const maxDays = document.createElement('input');
  maxDays.className = 'activate-event-max';
  maxDays.type = 'number';
  maxDays.min = '0';
  maxDays.max = '999';
  maxDays.value = '6';

  const leadSelect = document.createElement('select');
  leadSelect.className = 'activate-event-lead';
  [
    ['', 'Sin protagonista fijo'],
    ['actor1', 'Mantener Actor 1'],
    ['actor2', 'Mantener Actor 2'],
    ['actor3', 'Mantener Actor 3'],
    ['actor4', 'Mantener Actor 4'],
    ['__action__', 'Quien realizó la acción'],
    ['__by_id__', 'Por ID manual…']
  ].forEach(([value,labelText]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = labelText;
    leadSelect.appendChild(opt);
  });

  const leaveNow = document.createElement('input');
  leaveNow.className = 'activate-event-leave';
  leaveNow.type = 'checkbox';

  const leaveDays = document.createElement('input');
  leaveDays.className = 'activate-event-leave-days';
  leaveDays.type = 'number';
  leaveDays.min = '1';
  leaveDays.max = '999';
  leaveDays.value = '3';

  const leaveChance = document.createElement('input');
  leaveChance.className = 'activate-event-leave-chance';
  leaveChance.type = 'number';
  leaveChance.min = '0';
  leaveChance.max = '100';
  leaveChance.value = '35';

  [
    ['Quest a activar', eventSelect],
    ['Días mínimo', minDays],
    ['Días máximo', maxDays],
    ['Protagonista persistente', leadSelect],
    ['Sale del campamento al activarse', leaveNow],
    ['Días fuera', leaveDays],
    ['% de volver herido', leaveChance]
  ].forEach(([labelText, control]) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;';
    if(control.type === 'checkbox') control.style.width = '16px';
    else control.style.width = '100%';
    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.cssText = 'font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.04em;';
    control.addEventListener('input', updatePreview);
    control.addEventListener('change', updatePreview);
    wrap.appendChild(label);
    wrap.appendChild(control);
    panel.appendChild(wrap);
  });

  eventSelect.addEventListener('change', () => {
    if(eventSelect.value !== '__manual_event__') return;
    const previous = row.dataset.manualEventId || '';
    const entered = window.prompt('ID o nombre del evento a activar:', previous);
    const clean = String(entered || '').trim();
    if(clean){
      row.dataset.manualEventId = clean;
      eventSelect.dataset.manualEventId = clean;
      eventSelect.dataset.manualEventLabel = `✍ ${clean}`;
      const manualOpt = [...eventSelect.options].find(o => o.value === '__manual_event__');
      if(manualOpt) manualOpt.textContent = `✍ ${clean}`;
      eventSelect.value = '__manual_event__';
    } else {
      delete row.dataset.manualEventId;
      eventSelect.dataset.manualEventId = '';
      eventSelect.dataset.manualEventLabel = '✍ ID manual…';
      const manualOpt = [...eventSelect.options].find(o => o.value === '__manual_event__');
      if(manualOpt) manualOpt.textContent = '✍ ID manual…';
      const firstReal = [...eventSelect.options].find(o => o.value && o.value !== '__manual_event__');
      eventSelect.value = firstReal ? firstReal.value : '';
    }
    safeUpdatePreview();
  });
  leadSelect.addEventListener('change', () => {
    if(leadSelect.value !== '__by_id__') return;
    const previous = row.dataset.manualLeadSurvivorId || '';
    const entered = window.prompt('ID del superviviente que actuará como protagonista persistente:', previous);
    const clean = String(entered || '').trim();
    if(clean){
      row.dataset.manualLeadSurvivorId = clean;
      const manualOpt = [...leadSelect.options].find(o => o.value === '__by_id__');
      if(manualOpt) manualOpt.textContent = `Por ID: ${clean}`;
      leadSelect.value = '__by_id__';
    } else {
      delete row.dataset.manualLeadSurvivorId;
      const manualOpt = [...leadSelect.options].find(o => o.value === '__by_id__');
      if(manualOpt) manualOpt.textContent = 'Por ID manual…';
      leadSelect.value = '';
    }
    safeUpdatePreview();
  });

  row.appendChild(panel);
  row._activateEventPanel = panel;
  return panel;
}

function removeActivateEventPanel(row){
  if(row._activateEventPanel){
    row._activateEventPanel.remove();
    row._activateEventPanel = null;
  }
}

function populateHostileSelect(){
  const sel=document.getElementById('f-attackHostile');
  if(!sel) return;
  const current=sel.value||'random';
  const opts=[`<option value="random">🎲 Aleatorio (de hostiles.json)</option>`];
  const hostiles=(hostileDefs||[]).filter(h=>h&&h.id);
  hostiles.forEach(h=>{
    const icon=h.icon?`${h.icon} `:'';
    const label=(String(h.label||'').toLowerCase()==='npc' ? `🎭 ${h.name||h.id}` : (h.name||h.id));
    opts.push(`<option value="${h.id}">${icon}${label}</option>`);
  });
  sel.innerHTML=opts.join('');
  sel.value=[...sel.options].some(o=>o.value===current)?current:'random';
  updateAttackVariantOptions();
}

const EFFECT_TYPES = [
  { group: '📦 Recursos', value: 'modifyResource',     label: '📦 Recurso (+/-)' },
  { group: '🙂 Estado del grupo', value: 'fatigueAll', label: '⚡ Fatiga a todos (+/-)' },
  { group: '🙂 Estado del grupo', value: 'fatigueAllPermanent', label: '🧬 Fatiga máxima permanente a todos (+/-)' },
  { group: '🙂 Estado del grupo', value: 'fatigueSurvivorPermanent', label: '🧬 Fatiga máxima permanente de un superviviente (+/- · por ID)' },
  { group: '🙂 Estado del grupo', value: 'modifyFatigue', label: '😮 Fatiga de un superviviente (+/- · aleatorio / por ID / realiza la acción)' },
  { group: '🙂 Estado del grupo', value: 'moraleAll',  label: '😊 Moral a todos (+/-)' },
  { group: '🙂 Estado del grupo', value: 'moraleAllPermanent',  label: '🧬 Moral máxima permanente a todos (+/-)' },
  { group: '🙂 Estado del grupo', value: 'moraleSurvivorPermanent', label: '🧬 Moral máxima permanente de un superviviente (+/- · por ID)' },
  { group: '🙂 Estado del grupo', value: 'moraleSurvivor', label: '😐 Moral a un superviviente (+/- · aleatorio / por ID / realiza la acción)' },
  { group: '🏚 Base y construcciones', value: 'stabilityChange', label: '🏛 Cambiar estabilidad de la base (+/-)' },
  { group: '🏚 Base y construcciones', value: 'disableBuilding', label: '🚧 Inhabilitar edificio (X días)' },
  { group: '🏚 Base y construcciones', value: 'destroyBuilding', label: '💥 Destruir edificio' },
  { group: '👥 Supervivientes', value: 'addSurvivor', label: '🧲 Añadir superviviente' },
  { group: '👥 Supervivientes', value: 'healSurvivor', label: '🩹 Curar superviviente herido (aleatorio / por ID / realiza la acción)' },
  { group: '👥 Supervivientes', value: 'disableSurvivor', label: '🚫 Inhabilitar superviviente (aleatorio / por ID / realiza la acción)' },
  { group: '👥 Supervivientes', value: 'awaySurvivor', label: '🚶 Ausentar superviviente del campamento (X días + % de volver herido)' },
  { group: '👥 Supervivientes', value: 'removeSurvivor', label: '👋 Quitar superviviente (aleatorio / por ID / realiza la acción)' },
  { group: '👥 Supervivientes', value: 'injureSurvivor', label: '🩸 Herir superviviente (aleatorio / por ID / realiza la acción)' },
  { group: '👥 Supervivientes', value: 'injureExplorer', label: '🧭 Herir al explorador' },
  { group: '👥 Supervivientes', value: 'injureActionSurvivor', label: '🎯 Herir a quien realizó la acción relacionada' },
  { group: '🎒 Equipo', value: 'addItem', label: '🎒 Encontrar equipo (concreto / por tipo / aleatorio)' },
  { group: '🎒 Equipo', value: 'damageItem', label: '🛠 Dañar equipo' },
  { group: '🎒 Equipo', value: 'removeItem', label: '📦 Perder equipo' },
  { group: '⚔ Riesgo y restricciones', value: 'setAttackThreat', label: '⚔ Activar amenaza de ataque' },
  { group: '⚔ Riesgo y restricciones', value: 'createThreat', label: '🧨 Activar amenaza persistente' },
  { group: '⚔ Riesgo y restricciones', value: 'limitAction', label: '🚫 Inhabilitar acción (X días)' },
  { group: '🎭 Narrativa', value: 'decide', label: '🎭 DECIDIR — el jugador elige entre opciones personalizadas' },
  { group: '🎭 Narrativa', value: 'activateQuest', label: '📜 Activar quest futura' },
  { group: '🎭 Narrativa', value: 'unlockBuilding', label: '🏗 Desbloquear edificio' },
];

// ── MODE ──

// ── CONDITION UI ──
function updateConditionUI(){
  const type=document.getElementById('f-condType').value;
  const simple=document.getElementById('condSimpleParams');
  const compound=document.getElementById('condCompoundParams');
  const idField=document.getElementById('condIdField');
  const valueField=document.getElementById('condValueField');
  const buildingField=document.getElementById('condBuildingField');
  const idLabel=document.getElementById('condIdLabel');
  const valueLabel=document.getElementById('condValueLabel');

  simple.style.display='none';
  compound.style.display='none';
  idField.style.display='none';
  valueField.style.display='none';
  buildingField.style.display='none';

  if(!type) return;

  if(type==='and'||type==='or'){
    compound.style.display='block';
    refreshCompoundConditionLogicLabels();
  } else {
    simple.style.display='block';
    if(type==='survivor'||type==='not_survivor'){
      idField.style.display='';
      idLabel.textContent=type==='survivor'?'ID del superviviente (debe estar vivo)':'ID del superviviente (debe estar ausente/muerto)';
    }
    if(type==='building'||type==='not_building'||type==='building_level'){
      buildingField.style.display='';
    }
    if(type==='building_level'){
      valueField.style.display='';
      valueLabel.textContent='Nivel mínimo requerido';
    }
    if(type==='stability_min'||type==='stability_max'){
      valueField.style.display='';
      valueLabel.textContent=type==='stability_min'?'Estabilidad mínima':'Estabilidad máxima';
    }
    if(type==='day_min'||type==='day_max'){
      valueField.style.display='';
      valueLabel.textContent=type==='day_min'?'Día mínimo':'Día máximo';
    }
  }
}



function getHostileVariantDefs(hostileType){
  if(!hostileType || hostileType==='random') return [];
  const def = (hostileDefs||[]).find(h => h.id === hostileType);
  const variants = Array.isArray(def?.variants) ? def.variants : [];
  return variants.filter(Boolean);
}
function updateAttackVariantOptions(){
  const hostileSel = document.getElementById('f-attackHostile');
  const variantSel = document.getElementById('f-attackVariant');
  if(!hostileSel || !variantSel) return;
  const hostileType = hostileSel.value || 'random';
  variantSel.innerHTML = '';
  const first = document.createElement('option');
  first.value = 'random';
  first.textContent = '🎲 Aleatorio';
  variantSel.appendChild(first);
  getHostileVariantDefs(hostileType).forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id || v.key || v.name || 'variant';
    const modVal = Number(v.strengthMod ?? v.forceBonus ?? v.variantForce);
    const forceTxt = Number.isFinite(modVal)
      ? ` · fuerza ${modVal>=0?'+':''}${modVal}`
      : Number.isFinite(Number(v.force ?? v.strength))
        ? ` · fuerza ${Number(v.force ?? v.strength)}`
        : '';
    const labelType = String(v.label||v.labelType||'').toLowerCase()==='npc' ? '🎭 ' : '';
    opt.textContent = `${labelType}${v.name || v.label || opt.value}${forceTxt}`;
    variantSel.appendChild(opt);
  });
}

function getItemDefs(){
  const source = (itemDefs && itemDefs.length ? itemDefs : EMBEDDED_ITEMS).filter(Boolean);
  const unique=[]; const seen=new Set();
  source.forEach(it=>{ const id=it.id||it.itemId; if(!id||seen.has(id)) return; seen.add(id); unique.push({...it, id}); });
  return unique;
}
function appendItemOptions(select){
  select.innerHTML='';
  const defs=getItemDefs();
  if(!defs.length){
    const o=document.createElement('option'); o.value='bandage'; o.textContent='bandage'; select.appendChild(o); return;
  }
  defs.forEach(it=>{
    const o=document.createElement('option');
    o.value=it.id;
    const t=it.type||it.itemType||'item';
    o.textContent=`${it.name||it.id} · ${t}`;
    select.appendChild(o);
  });
}
function appendItemTargetOptions(select){
  select.innerHTML='';
  [
    ['base','Almacén de la base'],
    ['explorer','Explorador / protagonista del evento'],
    ['randomSurvivor','Superviviente aleatorio'],
    ['actor1','Actor 1 ({actor1})'],
    ['actor2','Actor 2 ({actor2})'],
    ['actor3','Actor 3 ({actor3})'],
    ['actor4','Actor 4 ({actor4})'],
    ['survivorById','Superviviente por ID'],
    ['actionSurvivor','Quien realizó la acción relacionada']
  ].forEach(([value,label])=>{ const o=document.createElement('option'); o.value=value; o.textContent=label; select.appendChild(o); });
}
function normalizeTierValue(value){
  const clean=String(value||'').trim().toUpperCase();
  return /^T[1-4]$/.test(clean)?clean:'';
}
function promptForItemTier(previous=''){
  const entered=window.prompt('Tier del objeto aleatorio (T1, T2, T3 o T4):', normalizeTierValue(previous) || 'T1');
  return normalizeTierValue(entered);
}


function createCompoundConditionTypeOptions(){
  return `
    <option value="survivor">👤 Superviviente presente (por ID)</option>
    <option value="not_survivor">👻 Superviviente ausente/muerto</option>
    <option value="building">🏗 Edificio construido</option>
    <option value="building_level">📈 Edificio en nivel mínimo</option>
    <option value="not_building">🚫 Edificio NO construido</option>
    <option value="stability_min">🏛 Estabilidad mínima</option>
    <option value="stability_max">🏛 Estabilidad máxima</option>
    <option value="day_min">📅 Día mínimo</option>
    <option value="day_max">📅 Día máximo</option>
  `;
}
function addCompoundConditionRow(cond){
  const wrap = document.getElementById('condCompoundRows');
  if(!wrap) return;
  const row = document.createElement('div');
  row.className = 'compound-condition-row';
  row.innerHTML = `
    <div class="compound-condition-row-top">
      <span class="logic-chip ${wrap.children.length===0 ? 'first' : ''}">${wrap.children.length===0 ? '1ª' : (document.getElementById('f-condType')?.value || 'and').toUpperCase()}</span>
      <button type="button" class="remove-effect-btn" style="margin-left:auto;">✕</button>
    </div>
    <div class="compound-condition-grid">
      <select class="compound-cond-type">${createCompoundConditionTypeOptions()}</select>
      <select class="compound-cond-building" style="display:none;"></select>
      <input type="text" class="compound-cond-id" placeholder="ID del superviviente" style="display:none;" />
      <input type="number" class="compound-cond-value" placeholder="Valor" style="display:none;" />
      <button type="button" class="btn" style="padding:6px 10px;font-size:10px;">Actualizar</button>
    </div>`;
  wrap.appendChild(row);
  const typeSel = row.querySelector('.compound-cond-type');
  const removeBtn = row.querySelector('.remove-effect-btn');
  const refreshBtn = row.querySelector('.btn');
  typeSel.addEventListener('change', ()=>{ updateCompoundConditionRow(row); updatePreview(); });
  removeBtn.addEventListener('click', ()=>{ row.remove(); refreshCompoundConditionLogicLabels(); updatePreview(); });
  refreshBtn.addEventListener('click', ()=>{ updateCompoundConditionRow(row); updatePreview(); });
  appendBuildingOptions(row.querySelector('.compound-cond-building'));
  updateCompoundConditionRow(row, cond);
  refreshCompoundConditionLogicLabels();
}
function refreshCompoundConditionLogicLabels(){
  const logic = (document.getElementById('f-condType')?.value || 'and').toUpperCase();
  document.querySelectorAll('#condCompoundRows .compound-condition-row').forEach((row, idx) => {
    const chip = row.querySelector('.logic-chip');
    if(!chip) return;
    chip.textContent = idx === 0 ? '1ª' : logic;
    chip.classList.toggle('first', idx === 0);
  });
}
function updateCompoundConditionRow(row, cond){
  const typeSel = row.querySelector('.compound-cond-type');
  const buildingSel = row.querySelector('.compound-cond-building');
  const idInput = row.querySelector('.compound-cond-id');
  const valueInput = row.querySelector('.compound-cond-value');
  if(cond?.type) typeSel.value = cond.type;
  const type = typeSel.value;
  buildingSel.style.display = ['building','building_level','not_building'].includes(type) ? '' : 'none';
  idInput.style.display = ['survivor','not_survivor'].includes(type) ? '' : 'none';
  valueInput.style.display = ['building_level','stability_min','stability_max','day_min','day_max'].includes(type) ? '' : 'none';
  idInput.placeholder = type === 'not_survivor' ? 'ID ausente o muerto' : 'ID del superviviente';
  valueInput.placeholder = type === 'building_level' ? 'Nivel mínimo' : (type.includes('day') ? 'Día' : 'Valor');
  if(cond){
    if(typeof cond.id !== 'undefined') idInput.value = cond.id;
    if(typeof cond.id !== 'undefined' && ['building','building_level','not_building'].includes(type)) buildingSel.value = cond.id;
    const value = cond.minLevel ?? cond.value ?? '';
    valueInput.value = value;
  }
}
function readCompoundConditionRows(){
  const rows = document.querySelectorAll('#condCompoundRows .compound-condition-row');
  const out = [];
  rows.forEach(row => {
    const type = row.querySelector('.compound-cond-type')?.value || '';
    if(!type) return;
    const cond = { type };
    if(['survivor','not_survivor'].includes(type)){
      const id = row.querySelector('.compound-cond-id')?.value?.trim();
      if(!id) return;
      cond.id = id;
    } else if(['building','building_level','not_building'].includes(type)){
      const id = row.querySelector('.compound-cond-building')?.value;
      if(!id) return;
      cond.id = id;
      if(type === 'building_level') cond.minLevel = Number(row.querySelector('.compound-cond-value')?.value) || 1;
    } else if(['stability_min','stability_max','day_min','day_max'].includes(type)){
      cond.value = Number(row.querySelector('.compound-cond-value')?.value) || 0;
    }
    out.push(cond);
  });
  return out;
}
function loadCompoundConditionRows(conditions){
  const wrap = document.getElementById('condCompoundRows');
  if(!wrap) return;
  wrap.innerHTML = '';
  (Array.isArray(conditions) ? conditions : []).forEach(cond => addCompoundConditionRow(cond));
  refreshCompoundConditionLogicLabels();
}
function readCondition(){
  const type=document.getElementById('f-condType').value;
  if(!type) return undefined;
  if(type==='and'||type==='or'){
    const subs = readCompoundConditionRows();
    return subs.length ? {type, conditions:subs} : undefined;
  }
  const cond={type};
  if(type==='survivor'||type==='not_survivor'){
    cond.id=document.getElementById('f-condId').value.trim();
    if(!cond.id) return undefined;
  }
  if(type==='building'||type==='not_building'||type==='building_level'){
    cond.id=document.getElementById('f-condBuilding').value;
  }
  if(type==='building_level'){
    cond.minLevel=Number(document.getElementById('f-condValue').value)||1;
  }
  if(type==='stability_min'||type==='stability_max'||type==='day_min'||type==='day_max'){
    cond.value=Number(document.getElementById('f-condValue').value)||0;
  }
  return cond;
}

function loadConditionIntoUI(cond){
  if(!cond){ document.getElementById('f-condType').value=''; updateConditionUI(); return; }
  const type=cond.type||'';
  document.getElementById('f-condType').value=type;
  updateConditionUI();
  if(type==='and'||type==='or'){
    loadCompoundConditionRows(cond.conditions || []);
  } else {
    if(cond.id&&(type==='survivor'||type==='not_survivor')) document.getElementById('f-condId').value=cond.id;
    if(cond.id&&(type==='building'||type==='not_building'||type==='building_level')) document.getElementById('f-condBuilding').value=cond.id;
    if(cond.minLevel) document.getElementById('f-condValue').value=cond.minLevel;
    if(cond.value!==undefined) document.getElementById('f-condValue').value=cond.value;
  }
}


function parseTags(raw){
  return String(raw || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx);
}

function splitDayRangeCondition(cond){
  if(!cond) return { dayMin: undefined, dayMax: undefined, condition: undefined };
  if(cond.type==='day_min') return { dayMin: Number(cond.value)||1, dayMax: undefined, condition: undefined };
  if(cond.type==='day_max') return { dayMin: undefined, dayMax: Number(cond.value)||1, condition: undefined };
  if(cond.type!=='and'||!Array.isArray(cond.conditions)) return { dayMin: undefined, dayMax: undefined, condition: cond };

  let dayMin, dayMax;
  const rest=[];
  cond.conditions.forEach(c=>{
    if(c?.type==='day_min'){
      const v=Number(c.value)||1;
      dayMin=dayMin===undefined?v:Math.max(dayMin,v);
    } else if(c?.type==='day_max'){
      const v=Number(c.value)||1;
      dayMax=dayMax===undefined?v:Math.min(dayMax,v);
    } else if(c){
      rest.push(c);
    }
  });

  let condition;
  if(rest.length===1) condition=rest[0];
  else if(rest.length>1) condition={type:'and',conditions:rest};
  return { dayMin, dayMax, condition };
}


function addDecideOption(wrapper){
  const idx = wrapper._optCount++;
  const box = document.createElement('div');
  box.className = 'decide-option-box';
  box.style.cssText = 'border:1px solid var(--line2);padding:8px 10px;background:var(--panel2);position:relative;';
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-size:10px;color:var(--amber-bright);font-family:var(--font-mono);letter-spacing:0.1em;">OPCIÓN ${String.fromCharCode(65+idx)}</span>
      <button type="button" onclick="this.closest('.decide-option-box').remove();updatePreview();" style="background:none;border:none;color:var(--danger-bright);cursor:pointer;font-size:14px;padding:0 4px;">×</button>
    </div>
    <div class="form-grid" style="gap:6px;">
      <div class="field full">
        <label style="font-size:9px;">Etiqueta del botón</label>
        <input type="text" class="decide-opt-label" placeholder="Ej: Negociar con los raiders" />
      </div>
      <div class="field full">
        <label style="font-size:9px;">Descripción (opcional)</label>
        <input type="text" class="decide-opt-desc" placeholder="Texto explicativo bajo el botón" />
      </div>
      <div class="field full">
        <label style="font-size:9px;">Línea de registro (opcional)</label>
        <input type="text" class="decide-opt-log" placeholder="Texto que aparece en el log al elegir esta opción" />
      </div>
    </div>
    <div class="decide-opt-effects" style="margin-top:6px;display:flex;flex-direction:column;gap:4px;"></div>
    <button type="button" class="btn" style="font-size:10px;padding:3px 8px;margin-top:5px;" onclick="addEffectRow(this.previousElementSibling);updatePreview();">+ Efecto</button>
  `;
  wrapper.appendChild(box);
}

function readDecideOptions(row){
  if(!row._decideWrapper) return [];
  const boxes = row._decideWrapper.querySelectorAll('.decide-option-box');
  return Array.from(boxes).map(box => {
    const label = box.querySelector('.decide-opt-label')?.value?.trim()||'Opción';
    const description = box.querySelector('.decide-opt-desc')?.value?.trim()||undefined;
    const log = box.querySelector('.decide-opt-log')?.value?.trim()||undefined;
    const effectContainer = box.querySelector('.decide-opt-effects');
    const effects = effectContainer ? readEffectRows(effectContainer) : [];
    const opt = { label };
    if(description) opt.description = description;
    if(log) opt.log = log;
    if(effects.length) opt.effects = effects;
    return opt;
  });
}

function setMode(m) {
  mode = m;
  document.getElementById('modeDirectBtn').classList.toggle('active', m === 'direct');
  document.getElementById('modeChoiceBtn').classList.toggle('active', m === 'choice');
  document.getElementById('modeAttackBtn').classList.toggle('active', m === 'attack');
  document.getElementById('modeDirectPanel').classList.toggle('hidden', m !== 'direct');
  document.getElementById('modeChoicePanel').classList.toggle('hidden', m !== 'choice');
  document.getElementById('modeAttackPanel').classList.toggle('hidden', m !== 'attack');
  updatePreview();
}

function updateChoiceRequirementUI(letter) {
  const typeEl = document.getElementById(`f-reqType${letter}`);
  const opEl = document.getElementById(`f-reqOp${letter}`);
  const valueEl = document.getElementById(`f-reqValue${letter}`);
  const skillEl = document.getElementById(`f-reqSkill${letter}`);
  if (!typeEl || !opEl || !valueEl || !skillEl) return;
  const type = typeEl.value;
  const numeric = type === 'morale' || type === 'stability';
  const skill = type === 'skill';
  opEl.classList.toggle('choice-req-hidden', !numeric);
  valueEl.classList.toggle('choice-req-hidden', !numeric);
  skillEl.classList.toggle('choice-req-hidden', !skill);
}

function readChoiceRequirement(letter) {
  const type = document.getElementById(`f-reqType${letter}`)?.value || '';
  if (!type) return undefined;
  if (type === 'skill') {
    const skill = document.getElementById(`f-reqSkill${letter}`)?.value?.trim();
    return skill ? { type: 'skill', skill } : undefined;
  }
  const valueRaw = document.getElementById(`f-reqValue${letter}`)?.value;
  const value = Number(valueRaw);
  if (!Number.isFinite(value)) return undefined;
  const operator = document.getElementById(`f-reqOp${letter}`)?.value || '>=';
  return { type, operator, value };
}

function applyChoiceRequirementToForm(letter, requirement) {
  const typeEl = document.getElementById(`f-reqType${letter}`);
  const opEl = document.getElementById(`f-reqOp${letter}`);
  const valueEl = document.getElementById(`f-reqValue${letter}`);
  const skillEl = document.getElementById(`f-reqSkill${letter}`);
  if (!typeEl || !opEl || !valueEl || !skillEl) return;
  typeEl.value = requirement?.type || '';
  opEl.value = requirement?.operator || '>=';
  valueEl.value = requirement && typeof requirement.value !== 'undefined' ? requirement.value : '';
  skillEl.value = requirement?.skill || '';
  updateChoiceRequirementUI(letter);
}

function requirementToString(requirement) {
  if (!requirement || !requirement.type) return '';
  if (requirement.type === 'skill') return `[${requirement.skill || 'Habilidad'}]`;
  const name = requirement.type === 'morale' ? 'Moral' : 'Estabilidad';
  const opMap = { '>=': '≥', '<=': '≤', '=': '=' };
  return `[${name} ${opMap[requirement.operator] || requirement.operator || '≥'} ${requirement.value}]`;
}

function buildChoiceOption(letter, fallbackLabel) {
  const label = document.getElementById(`f-label${letter}`)?.value?.trim() || fallbackLabel;
  const effects = readEffectRows(`option${letter}EffectRows`);
  const requirement = readChoiceRequirement(letter);
  const option = { label, effects };
  if (requirement) option.requirement = requirement;
  return option;
}

function choiceOptionHasContent(letter) {
  const label = document.getElementById(`f-label${letter}`)?.value?.trim();
  const requirement = readChoiceRequirement(letter);
  const effects = readEffectRows(`option${letter}EffectRows`);
  return Boolean(label || requirement || effects.length);
}

// ── EFFECT ROWS ──
function addEffectRow(target) {
  // Support dynamic IDs (for legacy inline panels) as well as named targets
  const idMap = {
    direct: 'directEffectRows',
    optionA: 'optionAEffectRows',
    optionB: 'optionBEffectRows',
    optionC: 'optionCEffectRows',
    optionD: 'optionDEffectRows',
    attackVictory: 'attackVictoryRows',
    attackDefeat: 'attackDefeatRows',
    personalOptionA: 'personalOptionAEffectRows',
    personalOptionB: 'personalOptionBEffectRows',
    personalOptionC: 'personalOptionCEffectRows',
  };
  const container = document.getElementById(idMap[target] || target);
  const row = document.createElement('div');
  row.className = 'effect-row';
  row.innerHTML = buildEffectRowHTML();
  container.appendChild(row);
  row.querySelector('.effect-type-select').addEventListener('change', e => {
    updateEffectRowFields(row, e.target.value);
    safeUpdatePreview();
  });
  row.querySelector('.remove-effect-btn').addEventListener('click', () => {
    if (row._attackPanel) row._attackPanel.remove();
    row.remove();
    safeUpdatePreview();
  });
  updateEffectRowFields(row, 'modifyResource');
  // Listen all inputs
  row.querySelectorAll('input,select').forEach(el => el.addEventListener('input', updatePreview));
  updatePreview();
}

function buildEffectRowHTML() {
  const groups = [];
  EFFECT_TYPES.forEach(t => {
    const last = groups[groups.length - 1];
    if (!last || last.group !== t.group) groups.push({ group: t.group, items: [t] });
    else last.items.push(t);
  });
  const typeOpts = groups.map(g => `<optgroup label="${g.group}">${g.items.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}</optgroup>`).join('');
  return `
    <select class="effect-type-select">${typeOpts}</select>
    <select class="effect-param1-select"></select>
    <select class="effect-param2-select" style="display:none;"></select>
    <input type="number" class="effect-amount-input" placeholder="Cantidad" min="1" max="99" value="1" style="display:none;" />
    <button class="remove-effect-btn" title="Eliminar">✕</button>
  `;
}

function updateEffectRowFields(row, type) {
  const p1 = row.querySelector('.effect-param1-select');
  const p2 = row.querySelector('.effect-param2-select');
  const amt = row.querySelector('.effect-amount-input');

  p1.innerHTML = '';
  p2.innerHTML = '';
  p1.style.display = 'none';
  p2.style.display = 'none';
  amt.style.display = 'none';
  removeActivateEventPanel(row);

  if (type === 'modifyResource') {
    p1.style.display = '';
    amt.style.display = '';
    amt.placeholder = 'Cantidad (+/-)';
    amt.value = 1;
    amt.min = -99; amt.max = 99;
    RESOURCES.forEach(r => {
      const o = document.createElement('option');
      o.value = r; o.textContent = RESOURCE_LABELS[r];
      p1.appendChild(o);
    });
  } else if (type === 'modifyFatigue') {
    amt.style.display = '';
    amt.placeholder = 'Fatiga +/- (ej: 1 o -1)';
    amt.value = 1;
    amt.min = -10; amt.max = 10;
    p1.style.display = '';
    getActorTargetOptions(false).concat([['__by_id__','Elegir por ID…']]).forEach(([value,label])=>{
      const opt=document.createElement('option'); opt.value=value; opt.textContent=label; p1.appendChild(opt);
    });
  } else if (type === 'fatigueAll') {
    amt.style.display = '';
    amt.placeholder = 'Fatiga +/- (ej: 1 o -1)';
    amt.value = 1;
    amt.min = -10; amt.max = 10;
  } else if (type === 'fatigueAllPermanent') {
    amt.style.display = '';
    amt.placeholder = 'Fatiga máxima permanente +/-';
    amt.value = 1;
    amt.min = -10; amt.max = 10;
  } else if (type === 'fatigueSurvivorPermanent') {
    p1.style.display = '';
    [['__by_id__','Elegir por ID…']].forEach(([value,label])=>{
      const opt=document.createElement('option'); opt.value=value; opt.textContent=label; p1.appendChild(opt);
    });
    amt.style.display = '';
    amt.placeholder = 'Fatiga máxima permanente +/-';
    amt.value = 1;
    amt.min = -10; amt.max = 10;
  } else if (type === 'disableBuilding') {
    p1.style.display = '';
    amt.style.display = '';
    amt.placeholder = 'Días';
    appendBuildingOptions(p1);
  } else if (type === 'destroyBuilding') {
    p1.style.display = '';
    appendBuildingOptions(p1);
  } else if (type === 'addSurvivor') {
    p1.style.display = '';
    const any = document.createElement('option');
    any.value = 'any'; any.textContent = '🎲 Totalmente aleatorio';
    p1.appendChild(any);
    [1,2,3,4].forEach(r => {
      const o = document.createElement('option');
      o.value = r; o.textContent = `Rareza ${r}${ r===4?' (común)':r===3?' (poco común)':r===2?' (raro)':' (legendario)'}`;
      p1.appendChild(o);
    });
    p1.value = 'any';
  } else if (type === 'healSurvivor' || type === 'injureSurvivor' || type === 'disableSurvivor' || type === 'removeSurvivor' || type === 'awaySurvivor') {
    p1.style.display = '';
    getActorTargetOptions(false).concat([['__by_id__','Elegir por ID…']]).forEach(([value,label])=>{
      const opt=document.createElement('option'); opt.value=value; opt.textContent=label; p1.appendChild(opt);
    });
    if (type === 'healSurvivor') {
      p2.style.display = '';
      [
        ['simple', 'Curar herida simple'],
        ['seria', 'Curar herida seria'],
        ['grave', 'Curar herida grave'],
      ].forEach(([value, label]) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        p2.appendChild(opt);
      });
      p2.value = 'simple';
    }
  } else if (type === 'injureExplorer') {
    // No params — always targets the survivor who triggered the explore event
  } else if (type === 'injureActionSurvivor') {
    p1.style.display = '';
    [
      ['related', 'Acción relacionada del evento'],
      ['forraje', 'Forrajear'],
      ['explorar', 'Explorar'],
      ['reciclar', 'Reciclar'],
      ['defender', 'Defender'],
      ['atacar', 'Atacar'],
    ].forEach(([value,label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      p1.appendChild(opt);
    });
    p1.value = 'related';
    p2.style.display = '';
    [
      ['', 'Nivel según contexto'],
      ['simple', 'Forzar herida simple'],
      ['seria', 'Forzar herida seria'],
      ['grave', 'Forzar herida grave'],
    ].forEach(([value,label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      p2.appendChild(opt);
    });
    p2.value = '';
  } else if (type === 'decide') {
    // Build dynamic decide option boxes
    const wrapper = document.createElement('div');
    wrapper.className = 'decide-wrapper';
    wrapper.style.cssText = 'grid-column:1/-1;margin-top:6px;display:flex;flex-direction:column;gap:8px;';
    // Add initial 2 options
    wrapper._optCount = 0;
    row._decideWrapper = wrapper;
    row.appendChild(wrapper);
    // Add option button
    const addOptBtn = document.createElement('button');
    addOptBtn.type = 'button';
    addOptBtn.textContent = '+ Añadir opción';
    addOptBtn.className = 'btn';
    addOptBtn.style.cssText = 'font-size:10px;padding:4px 10px;margin-top:4px;grid-column:1/-1;';
    addOptBtn.onclick = () => { addDecideOption(wrapper); updatePreview(); };
    row.appendChild(addOptBtn);
    addDecideOption(wrapper);
    addDecideOption(wrapper);
  } else if (type === 'activateQuest' || type === 'activateEvent') {
    ensureActivateEventPanel(row);
  } else if (type === 'unlockBuilding') {
    p1.style.display = '';
    appendBuildingOptions(p1);
  } else if (type === 'addItem') {
    p1.style.display = '';
    p2.style.display = '';
    amt.style.display = '';
    [
      ['__random__','🎲 Aleatorio total'],
      ['__type__','🗂 Aleatorio por tipo…'],
      ['__tier__','🏷 Aleatorio por tier…'],
      ['__type_tier__','🗂🏷 Tipo + tier…'],
      ['__specific__','📦 Item concreto…']
    ].forEach(([value,label])=>{
      const opt=document.createElement('option'); opt.value=value; opt.textContent=label; p1.appendChild(opt);
    });
    appendItemTargetOptions(p2);
    amt.placeholder = 'Cantidad';
    amt.value = 1;
    amt.min = 1; amt.max = 99;
  } else if (type === 'damageItem' || type === 'removeItem') {
    p1.style.display = '';
    p2.style.display = '';
    amt.style.display = '';
    appendItemOptions(p1);
    appendItemTargetOptions(p2);
    amt.placeholder = type === 'damageItem' ? 'Daño / calidad' : 'Cantidad';
    amt.value = 1;
    amt.min = 1; amt.max = 99;
  } else if (type === 'moraleAll' || type === 'moraleAllPermanent' || type === 'moraleSurvivorPermanent' || type === 'moraleSurvivor' || type === 'stabilityChange') {
    amt.style.display = '';
    amt.placeholder = type === 'stabilityChange'
      ? 'Cantidad (+/-)'
      : ((type === 'moraleAllPermanent' || type === 'moraleSurvivorPermanent') ? 'Moral máxima permanente +/-' : 'Moral +/- (ej: 1 o -1)');
    amt.value = 1;
    amt.min = -10; amt.max = 10;
    if (type === 'moraleSurvivor') {
      p1.style.display = '';
      getActorTargetOptions(false).concat([['__by_id__','Elegir por ID…']]).forEach(([value,label])=>{
        const opt=document.createElement('option'); opt.value=value; opt.textContent=label; p1.appendChild(opt);
      });
    } else if (type === 'moraleSurvivorPermanent') {
      p1.style.display = '';
      [['__by_id__','Elegir por ID…']].forEach(([value,label])=>{
        const opt=document.createElement('option'); opt.value=value; opt.textContent=label; p1.appendChild(opt);
      });
    }
  } else if (type === 'createThreat') {
    p1.style.display = '';
    p2.style.display = '';
    appendThreatOptions(p1);
    p2.innerHTML = '';
    [
      ['', 'Severidad inicial automática'],
      ['1', 'Severidad 1'],
      ['2', 'Severidad 2'],
      ['3', 'Severidad 3']
    ].forEach(([value,label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      p2.appendChild(opt);
    });
  } else if (type === 'setAttackThreat') {
    p1.style.display = '';
    p2.style.display = '';
    amt.style.display = 'none';
    p1.innerHTML = '<option value="1">Llega en 1 día</option><option value="2">Llega en 2 días</option><option value="3">Llega en 3 días</option><option value="0">¡Inmediato!</option>';
    p2.innerHTML = '';
    const hostileDefault = document.createElement('option');
    hostileDefault.value = 'random';
    hostileDefault.textContent = '🎲 Hostil aleatorio';
    p2.appendChild(hostileDefault);
    (Array.isArray(hostileDefs)?hostileDefs:[]).forEach(h=>{
      const opt=document.createElement('option');
      opt.value = h.id || 'random';
      opt.textContent = `${h.icon || ''} ${h.label || h.name || h.id}`.trim();
      p2.appendChild(opt);
    });
    let p3 = row.querySelector('.effect-param3-select');
    if(!p3){
      p3 = document.createElement('select');
      p3.className = 'effect-param3-select';
      row.insertBefore(p3, row.querySelector('.remove-effect-btn'));
    }
    p3.style.display = '';
    const populateVariantSelect = ()=>{
      const hostileId = p2.value || 'random';
      p3.innerHTML = '';
      const baseOpt = document.createElement('option');
      baseOpt.value = 'random';
      baseOpt.textContent = '🎲 Variante aleatoria';
      p3.appendChild(baseOpt);
      const def = (Array.isArray(hostileDefs)?hostileDefs:[]).find(h => String(h.id) === String(hostileId));
      const vars = Array.isArray(def?.variants) ? def.variants : [];
      vars.forEach(v=>{
        const opt = document.createElement('option');
        opt.value = v.id || v.key || v.name || 'variant';
        const modVal = Number(v.strengthMod);
        const modTxt = Number.isFinite(modVal) ? ` · ${modVal>=0?'+':''}${modVal}` : '';
        opt.textContent = `${v.label || v.name || opt.value}${modTxt}`;
        p3.appendChild(opt);
      });
    };
    p2.onchange = ()=>{ populateVariantSelect(); updatePreview(); };
    populateVariantSelect();
    if (row._attackPanel && row._attackPanel.parentElement) {
      row._attackPanel.parentElement.removeChild(row._attackPanel);
    }
    row._attackPanel = null;
  } else if (type === 'limitAction') {
    p1.style.display = '';
    amt.style.display = '';
    amt.placeholder = 'Días';
    const ACTIONS = {forraje:'Forrajear', reciclar:'Reciclar', explorar:'Explorar', vigilar:'Vigilar', construir:'Construir', ataque:'Ataque', descansar:'Descansar'};
    Object.entries(ACTIONS).forEach(([v, label]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      p1.appendChild(o);
    });
  }
  if (['modifyFatigue','fatigueSurvivorPermanent','moraleSurvivor','moraleSurvivorPermanent','healSurvivor','injureSurvivor','disableSurvivor','awaySurvivor','removeSurvivor','addItem','createThreat'].includes(type)) {
    attachManualTargetIdPrompt(row);
  }
}

function attachManualTargetIdPrompt(row){
  const p1 = row.querySelector('.effect-param1-select');
  if(!p1 || p1._hasManualTargetHook) return;
  p1.addEventListener('change', () => {
    if (p1.value === '__action__') {
      safeUpdatePreview();
      return;
    }
    if (p1.value === '__manual_threat__') {
      const previous = row.dataset.customThreatId || '';
      const entered = window.prompt('ID de la amenaza:', previous);
      const clean = String(entered || '').trim();
      if (clean) {
        row.dataset.customThreatId = clean;
        p1.dataset.manualThreatId = clean;
        p1.dataset.manualThreatLabel = `✍ ${clean}`;
        const manualOpt = [...p1.options].find(o => o.value === '__manual_threat__');
        if (manualOpt) manualOpt.textContent = `✍ ${clean}`;
        p1.value = '__manual_threat__';
      } else if (previous) {
        p1.value = '__manual_threat__';
      } else if (p1.options.length) {
        p1.value = p1.options[0].value;
      }
      safeUpdatePreview();
      return;
    }
    if (p1.value === '__type__') {
      const previous = row.dataset.randomItemType || '';
      const entered = window.prompt('Tipo de item aleatorio (weapon, consumable, tool, equipment, etc.):', previous);
      const clean = String(entered || '').trim();
      if(clean){
        row.dataset.randomItemType = clean;
        delete row.dataset.randomItemTier;
        const opt = [...p1.options].find(o=>o.value==='__type__');
        if(opt) opt.textContent = `🗂 ${clean}`;
      } else {
        p1.value='__random__';
      }
      safeUpdatePreview();
      return;
    }
    if (p1.value === '__tier__') {
      const clean = promptForItemTier(row.dataset.randomItemTier || '');
      if(clean){
        row.dataset.randomItemTier = clean;
        delete row.dataset.randomItemType;
        const opt = [...p1.options].find(o=>o.value==='__tier__');
        if(opt) opt.textContent = `🏷 ${clean}`;
      } else {
        p1.value='__random__';
      }
      safeUpdatePreview();
      return;
    }
    if (p1.value === '__type_tier__') {
      const previousType = row.dataset.randomItemType || '';
      const enteredType = window.prompt('Tipo de item aleatorio (weapon, consumable, tool, equipment, etc.):', previousType);
      const cleanType = String(enteredType || '').trim();
      const cleanTier = cleanType ? promptForItemTier(row.dataset.randomItemTier || '') : '';
      if(cleanType && cleanTier){
        row.dataset.randomItemType = cleanType;
        row.dataset.randomItemTier = cleanTier;
        const opt = [...p1.options].find(o=>o.value==='__type_tier__');
        if(opt) opt.textContent = `🗂 ${cleanType} · ${cleanTier}`;
      } else {
        p1.value='__random__';
      }
      safeUpdatePreview();
      return;
    }
    if (p1.value === '__specific__') {
      const entered = window.prompt('ID del item concreto:', row.dataset.specificItemId || '');
      const clean = String(entered || '').trim();
      if(clean){
        row.dataset.specificItemId = clean;
        const opt = [...p1.options].find(o=>o.value==='__specific__');
        if(opt) opt.textContent = `📦 ${clean}`;
      } else {
        p1.value='__random__';
      }
      safeUpdatePreview();
      return;
    }
    if (p1.value !== '__by_id__') return;
    const previous = row.dataset.customTargetId || '';
    const entered = window.prompt('ID del survivor objetivo:', previous);
    const clean = String(entered || '').trim();
    if (clean) {
      row.dataset.customTargetId = clean;
      const byIdOpt = [...p1.options].find(o => o.value === '__by_id__');
      if (byIdOpt) byIdOpt.textContent = `Por ID: ${clean}`;
      p1.value = '__by_id__';
    } else if (previous) {
      p1.value = '__by_id__';
    } else {
      p1.value = 'random';
    }
    safeUpdatePreview();
  });
  p1._hasManualTargetHook = true;
}

function readEffectRows(containerId) {
  const rows = document.getElementById(containerId).querySelectorAll('.effect-row');
  const effects = [];
  rows.forEach(row => {
    const type = row.querySelector('.effect-type-select').value;
    const p1 = row.querySelector('.effect-param1-select');
    const p2 = row.querySelector('.effect-param2-select');
    const amt = row.querySelector('.effect-amount-input');
    const effect = { type };
    if (type === 'modifyResource') {
      effect.resource = p1.value;
      const signedAmount = Number(amt.value);
      const finalAmount = Number.isFinite(signedAmount) && signedAmount !== 0 ? signedAmount : 1;
      effect.type = finalAmount >= 0 ? 'addResource' : 'removeResource';
      effect.amount = Math.abs(finalAmount);
    } else if (type === 'modifyFatigue') {
      if (p1.value === '__by_id__' && row.dataset.customTargetId) effect.targetId = row.dataset.customTargetId;
      else if (p1.value === '__action__') effect.targetMode = 'action';
      else if (/^actor\d$/.test(p1.value) || p1.value === 'allActors') effect.targetMode = p1.value;
      const signedAmount = Number(amt.value);
      const finalAmount = Number.isFinite(signedAmount) && signedAmount !== 0 ? signedAmount : 1;
      effect.type = finalAmount >= 0 ? 'addFatigue' : 'removeFatigue';
      effect.amount = Math.abs(finalAmount);
    } else if (type === 'fatigueAll') {
      const signedAmount = Number(amt.value);
      effect.amount = Number.isFinite(signedAmount) && signedAmount !== 0 ? signedAmount : 1;
    } else if (type === 'fatigueAllPermanent') {
      const signedAmount = Number(amt.value);
      effect.amount = Number.isFinite(signedAmount) && signedAmount !== 0 ? signedAmount : 1;
    } else if (type === 'fatigueSurvivorPermanent') {
      if (p1.value === '__by_id__' && row.dataset.customTargetId) effect.targetId = row.dataset.customTargetId;
      const signedAmount = Number(amt.value);
      effect.amount = Number.isFinite(signedAmount) && signedAmount !== 0 ? signedAmount : 1;
    } else if (type === 'disableBuilding') {
      effect.building = p1.value;
      effect.days = Number(amt.value) || 1;
    } else if (type === 'destroyBuilding') {
      effect.building = p1.value;
    } else if (type === 'addSurvivor') {
      if (p1.value === 'any') {
        effect.type = 'addSurvivorRandom';
      } else {
        effect.type = 'addSurvivorByRarity';
        effect.rarity = Number(p1.value) || 4;
      }
    } else if (type === 'healSurvivor' || type === 'injureSurvivor' || type === 'disableSurvivor' || type === 'removeSurvivor' || type === 'awaySurvivor') {
      if (p1.value === '__by_id__' && row.dataset.customTargetId) effect.targetId = row.dataset.customTargetId;
      else if (p1.value === '__action__') effect.targetMode = 'action';
      else if (/^actor\d$/.test(p1.value) || p1.value === 'allActors') effect.targetMode = p1.value;
      if (type === 'healSurvivor') effect.injuryLevel = p2.value || 'simple';
      if (type === 'disableSurvivor') effect.days = Number(amt.value) || 1;
      if (type === 'awaySurvivor') {
        effect.days = Number(amt.value) || 3;
        effect.returnInjuryChance = Number(p2.value) || 0;
      }
    } else if (type === 'injureExplorer') {
      // no extra params
    } else if (type === 'injureActionSurvivor') {
      if (p1.value && p1.value !== 'related') effect.action = p1.value;
      if (p2.value) effect.injuryLevel = p2.value;
    } else if (type === 'addItem') {
      effect.target = p2.value || 'base';
      effect.amount = Number(amt.value) || 1;
      if (p1.value === '__random__') {
        effect.randomType = 'any';
      } else if (p1.value === '__type__') {
        effect.randomType = row.dataset.randomItemType || 'any';
      } else if (p1.value === '__tier__') {
        const cleanTier = normalizeTierValue(row.dataset.randomItemTier || '');
        if (cleanTier) effect.randomTier = cleanTier;
        else effect.randomType = 'any';
      } else if (p1.value === '__type_tier__') {
        effect.randomType = row.dataset.randomItemType || 'any';
        const cleanTier = normalizeTierValue(row.dataset.randomItemTier || '');
        if (cleanTier) effect.randomTier = cleanTier;
      } else {
        effect.itemId = row.dataset.specificItemId || p1.value;
      }
    } else if (type === 'damageItem' || type === 'removeItem') {
      effect.itemId = p1.value;
      effect.target = p2.value || 'base';
      effect.amount = Number(amt.value) || 1;
    } else if (type === 'decide') {
      effect.options = readDecideOptions(row);
    } else if (type === 'activateQuest' || type === 'activateEvent') {
      const panel = row._activateEventPanel;
      if (panel) {
        const eventSelect = panel.querySelector('.activate-event-target');
        const minDays = Number(panel.querySelector('.activate-event-min')?.value);
        const maxDays = Number(panel.querySelector('.activate-event-max')?.value);
        const leadSelect = panel.querySelector('.activate-event-lead');
        effect.questId = eventSelect?.value === '__manual_event__' ? (row.dataset.manualEventId || '') : (eventSelect?.value || '');
        effect.minDays = Number.isFinite(minDays) ? minDays : 0;
        effect.maxDays = Number.isFinite(maxDays) ? maxDays : effect.minDays;
        if (effect.maxDays < effect.minDays) [effect.minDays, effect.maxDays] = [effect.maxDays, effect.minDays];
        if (leadSelect?.value === '__by_id__' && row.dataset.manualLeadSurvivorId) effect.forcedSurvivorId = row.dataset.manualLeadSurvivorId;
        else if (leadSelect?.value === '__action__') effect.leadTargetMode = 'action';
        else if (/^actor\d$/.test(leadSelect?.value || '')) effect.leadTargetMode = leadSelect.value;
        const leaveNow = panel.querySelector('.activate-event-leave');
        const leaveDays = Number(panel.querySelector('.activate-event-leave-days')?.value);
        const leaveChance = Number(panel.querySelector('.activate-event-leave-chance')?.value);
        if (leaveNow?.checked) {
          effect.leaveCamp = true;
          effect.leaveDays = Number.isFinite(leaveDays) ? leaveDays : 3;
          effect.returnInjuryChance = Number.isFinite(leaveChance) ? leaveChance : 35;
        }
        effect.priority = true;
      }
    } else if (type === 'unlockBuilding') {
      effect.building = p1.value;
    } else if (type === 'createThreat') {
      effect.threatId = p1.value === '__manual_threat__' ? (row.dataset.customThreatId || '') : p1.value;
      if (p2.value) effect.severity = Number(p2.value) || undefined;
    } else if (type === 'moraleAll' || type === 'moraleAllPermanent' || type === 'moraleSurvivorPermanent' || type === 'moraleSurvivor' || type === 'stabilityChange') {
      effect.amount = Number(amt.value) || 1;
      if ((type === 'moraleSurvivor' || type === 'moraleSurvivorPermanent') && p1.value === '__by_id__' && row.dataset.customTargetId) {
        effect.targetId = row.dataset.customTargetId;
      }
      if (type === 'moraleSurvivor' && p1.value === '__action__') {
        effect.targetMode = 'action';
      }
    } else if (type === 'setAttackThreat') {
      effect.arrivalDays = Number(p1.value) || 1;
      effect.hostileType = p2.value || 'random';
      const p3 = row.querySelector('.effect-param3-select');
      effect.hostileVariant = p3?.value || 'random';
    } else if (type === 'limitAction') {
      effect.action = p1.value;
      effect.days = Number(amt.value) || 1;
    }
    effects.push(effect);
  });
  return effects;
}

function effectToString(e) {
  if (e.type === 'addResource') return `📦 +${e.amount} ${RESOURCE_LABELS[e.resource]||e.resource}`;
  if (e.type === 'removeResource') return `📦 -${e.amount} ${RESOURCE_LABELS[e.resource]||e.resource}`;
  if (e.type === 'addFatigue') return `😮 +${e.amount} fatiga (${e.targetMode==='action'?'realiza la acción':(e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio'))})`;
  if (e.type === 'removeFatigue') return `😌 -${e.amount} fatiga (${e.targetMode==='action'?'realiza la acción':(e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio'))})`;
  if (e.type === 'fatigueAll') return `⚡ Fatiga todos ${e.amount>0?'+':''}${e.amount}`;
  if (e.type === 'fatigueAllPermanent') return `🧬 Fatiga máxima permanente todos ${e.amount>0?'+':''}${e.amount}`;
  if (e.type === 'fatigueSurvivorPermanent') return `🧬 Fatiga máxima permanente ${e.amount>0?'+':''}${e.amount} (${e.targetId||'sin ID'})`;
  if (e.type === 'disableBuilding') return `🚧 Inhabilitar ${getBuildingLabel(e.building)} ${e.days}d`;
  if (e.type === 'destroyBuilding') return `💥 Destruir ${getBuildingLabel(e.building)}`;
  if (e.type === 'addSurvivorRandom') return `🎲 Nuevo superviviente totalmente aleatorio`;
  if (e.type === 'addSurvivor' || e.type === 'addSurvivorByRarity') return `🧲 Nuevo superviviente (rareza ${e.rarity})`;
  if (e.type === 'healSurvivor') return `Curar herida ${(e.injuryLevel||'simple')} (${e.targetId||'aleatorio'})`;
  if (e.type === 'injureSurvivor') return `Herir superviviente (${e.targetMode==='action'?'realiza la acción':(e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio'))})`;
  if (e.type === 'injureExplorer') return `🩸 Herir al explorador`;
  if (e.type === 'injureActionSurvivor') return `🩸 Herir por acción (${e.action||'relacionada'})${e.injuryLevel?` [${e.injuryLevel}]`:''}`;
  if (e.type === 'addItem') {
    const itemLabel = e.itemId
      ? ((getItemDefs().find(it=>it.id===e.itemId)?.name)||e.itemId)
      : (e.randomType&&e.randomType!=='any'&&e.randomTier
          ? `aleatorio (${e.randomType} · ${e.randomTier})`
          : e.randomType&&e.randomType!=='any'
            ? `aleatorio (${e.randomType})`
            : e.randomTier
              ? `aleatorio (${e.randomTier})`
              : 'aleatorio total');
    return `🎒 Encontrar ${itemLabel} → ${e.target||'base'} x${e.amount||1}`;
  }
  if (e.type === 'damageItem') return `🛠 Dañar ${(getItemDefs().find(it=>it.id===e.itemId)?.name)||e.itemId||'equipo'} → ${e.target||'base'} (${e.amount||1})`;
  if (e.type === 'removeItem') return `📦 Perder ${(getItemDefs().find(it=>it.id===e.itemId)?.name)||e.itemId||'equipo'} → ${e.target||'base'} x${e.amount||1}`;
  if (['createThreat','addThreat','spawnThreat'].includes(e.type)) {
    return `🧨 Activar amenaza: ${getThreatLabel(e.threatId||e.templateId||e.id||'')}${e.severity?` · sev ${e.severity}`:''}`;
  }
  if (e.type === 'setAttackThreat') {
    const hostileDef = hostileDefs.find(h=>h.id===(e.hostileType||e.hostile||''));
    const hostile = (e.hostileType||e.hostile)==='random'
      ? 'hostil aleatorio'
      : (hostileDef?.label || hostileDef?.name || e.hostileType || e.hostile || 'raiders');
    const variantDef = (hostileDef?.variants||[]).find(v => (v.id||v.key||v.name) === (e.hostileVariant||e.variant));
    const variantTxt = (e.hostileVariant||e.variant) && (e.hostileVariant||e.variant)!=='random'
      ? ` · ${variantDef?.label || variantDef?.name || e.hostileVariant || e.variant}`
      : '';
    return `⚔ Amenaza (${hostile}${variantTxt}) · ${Number(e.arrivalDays||0)===0?'¡Inmediata!':`Llega en ${e.arrivalDays||1}d`}`;
  }
  if (e.type === 'limitAction') return `🚫 Inhabilitar acción: ${e.action} (${e.days||1}d)`;
  if (e.type === 'moraleAll') return `${e.amount>0?'😊':'😞'} Moral todos ${e.amount>0?'+':''}${e.amount}`;
  if (e.type === 'moraleAllPermanent') return `🧬 Moral máxima permanente todos ${e.amount>0?'+':''}${e.amount}`;
  if (e.type === 'moraleSurvivorPermanent') return `🧬 Moral máxima permanente ${e.amount>0?'+':''}${e.amount} (${e.targetId||'sin ID'})`;
  if (e.type === 'moraleSurvivor') return `${e.amount>0?'😊':'😞'} Moral superviviente ${e.amount>0?'+':''}${e.amount} (${e.targetMode==='action'?'realiza la acción':(e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio'))})`;
  if (e.type === 'stabilityChange') return `🏛 Estabilidad ${e.amount>0?'+':''}${e.amount}`;
  if (e.type === 'decide') return `🎭 DECIDIR (${(e.options||[]).length} opciones)`;
  if (e.type === 'activateQuest' || e.type === 'activateEvent') return `📜 Activar quest ${e.questId || e.eventId || 'sin ID'} en ${e.minDays ?? 0}-${e.maxDays ?? 0} día(s)${e.forcedSurvivorId?` · ${e.forcedSurvivorId}`:(e.leadTargetMode?` · ${e.leadTargetMode.toUpperCase()}`:'')}${e.leaveCamp?` · sale ${e.leaveDays||3}d · ${e.returnInjuryChance||0}%`:''}`;
  if (e.type === 'disableSurvivor') return `🚫 Inhabilitar superviviente (${e.targetMode==='action'?'realiza la acción':(e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio'))}) ${e.days||1}d`;
  if (e.type === 'awaySurvivor') return `🚶 Ausentar superviviente (${e.targetMode==='action'?'realiza la acción':(e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio'))}) ${e.days||1}d · ${e.returnInjuryChance||0}%`;
  if (e.type === 'removeSurvivor') return `👋 Quitar superviviente (${e.targetMode==='action'?'realiza la acción':(e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio'))})`;
  if (e.type === 'unlockBuilding') return `🏗 Desbloquear: ${e.building||'?'}`;
  return e.type;
}

// ── BUILD EVENT OBJECT ──
function buildEventObject() {
  const id = document.getElementById('f-id').value.trim();
  const name = document.getElementById('f-name').value.trim();
  const story = document.getElementById('f-story').value.trim();
  const days = Number(document.getElementById('f-days').value) || 1;
  const weight = Number(document.getElementById('f-weight').value) || 8;
  const imgUrl = document.getElementById('f-imgurl').value.trim() || uploadedImageUrl || '';

  const type = document.getElementById('f-type').value || 'city';
  const week = type==='weekly' ? (Number(document.getElementById('f-week').value)||1) : undefined;
  const day  = type==='story'  ? (Number(document.getElementById('f-day').value)||1)  : undefined;
  const dayMin = Number(document.getElementById('f-dayMin')?.value||0) || undefined;
  const dayMax = Number(document.getElementById('f-dayMax')?.value||0) || undefined;
  const relatedAction = document.getElementById('f-relatedAction')?.value || '';
  const tags = parseTags(document.getElementById('f-tags')?.value || '');
  const rawParticipants = Math.max(0, Number(document.getElementById('f-participants')?.value || 0) || 0);
  const useFixedPersonalSurvivor = !!document.getElementById('f-personalUseFixedSurvivor')?.checked;
  const personalSurvivorId = document.getElementById('f-personalSurvivorId')?.value.trim() || '';
  const personalStartNode = document.getElementById('f-personalStartNode')?.value.trim() || 'intro';

  let condition=readCondition();
  const dayRangeConds=[];
  const skipWhenAttackActive = document.getElementById('f-skipWhenAttackActive')?.checked || false;
  if(dayMin!==undefined) dayRangeConds.push({type:'day_min',value:dayMin});
  if(dayMax!==undefined) dayRangeConds.push({type:'day_max',value:dayMax});
  if(dayRangeConds.length){
    const dayRangeCond=dayRangeConds.length===1 ? dayRangeConds[0] : {type:'and',conditions:dayRangeConds};
    condition = condition ? {type:'and',conditions:[condition,dayRangeCond]} : dayRangeCond;
  }
  const priority=document.getElementById('f-priority')?.checked||false;
  const subtitle = document.getElementById('f-subtitle')?.value.trim()||undefined;
  const ev = { id, name, image: imgUrl, text: story, days, weight: (type==='weekly'||type==='story'||type==='quest')?0:weight, type };
  if(subtitle) ev.subtitle = subtitle;
  if(condition) ev.condition=condition;
  if(priority) ev.priority=true;
  if(skipWhenAttackActive) ev.skipWhenAttackActive=true;
  if(week!==undefined) ev.week=week;
  if(day!==undefined)  ev.day=day;
  if(relatedAction) ev.relatedAction=relatedAction;
  if(tags.length) ev.tags = tags;
  const finalParticipants = type==='personal' ? Math.max(1, rawParticipants || 1) : rawParticipants;
  if(finalParticipants>0) ev.participants = finalParticipants;
  if(isRepeatable) ev.repeatable=true;
  if(type==='personal'){
    if(useFixedPersonalSurvivor && personalSurvivorId) ev.personalSurvivorId = personalSurvivorId;
    ev.startNode = personalStartNode || 'intro';
    const nodeId = ev.startNode;
    const nodeTitle = document.getElementById('f-personalNodeTitle')?.value?.trim() || '';
    const nodeText = document.getElementById('f-personalNodeText')?.value?.trim() || story || 'Conversación personal.';
    if(!ev.text) ev.text = nodeText;
    const personalLabelA = document.getElementById('f-personalLabelA')?.value?.trim() || 'Opción A';
    const personalLabelB = document.getElementById('f-personalLabelB')?.value?.trim() || 'Opción B';
    const personalLabelC = document.getElementById('f-personalLabelC')?.value?.trim() || '';
    ev.nodes = {};
    ev.nodes[nodeId] = {
      text: nodeText,
      options: {
        A: { label: personalLabelA, effects: readEffectRows('personalOptionAEffectRows') },
        B: { label: personalLabelB, effects: readEffectRows('personalOptionBEffectRows') }
      }
    };
    if(nodeTitle) ev.nodes[nodeId].title = nodeTitle;
    if(personalLabelC){
      ev.nodes[nodeId].options.C = { label: personalLabelC, effects: readEffectRows('personalOptionCEffectRows') };
    }
  }

  if (mode === 'direct') {
    ev.choiceMode = 'direct';
    ev.effects = readEffectRows('directEffectRows');
  } else if (mode === 'attack') {
    ev.choiceMode = 'direct';
    ev.effects = [{
      type: 'setAttackThreat',
      hostileType: document.getElementById('f-attackHostile')?.value || 'random',
      hostileVariant: document.getElementById('f-attackVariant')?.value || 'random',
      arrivalDays: Number(document.getElementById('f-attackArrival').value) || 1,
      combatPopupVictory: {
        title: document.getElementById('f-attackPopupVictoryTitle')?.value?.trim() || undefined,
        text: document.getElementById('f-attackPopupVictoryText')?.value?.trim() || undefined,
        icon: document.getElementById('f-attackPopupVictoryIcon')?.value?.trim() || undefined,
      },
      combatPopupDefeat: {
        title: document.getElementById('f-attackPopupDefeatTitle')?.value?.trim() || undefined,
        text: document.getElementById('f-attackPopupDefeatText')?.value?.trim() || undefined,
        icon: document.getElementById('f-attackPopupDefeatIcon')?.value?.trim() || undefined,
      },
      effectOnVictory: readEffectRows('attackVictoryRows'),
      effectOnDefeat: readEffectRows('attackDefeatRows'),
    }];
  } else {
    ev.choiceMode = 'choice';
    ev.options = {
      A: buildChoiceOption('A', 'Opción A'),
      B: buildChoiceOption('B', 'Opción B'),
      ...(choiceOptionHasContent('C') ? { C: buildChoiceOption('C', 'Opción C') } : {}),
      ...(choiceOptionHasContent('D') ? { D: buildChoiceOption('D', 'Opción D') } : {})
    };
  }

  if(type==='personal') ev.choiceMode='personal';
  removeLegacyExploreAttackEffectsFromEvent(ev);
  return ev;
}

// ── PREVIEW ──
function updatePreview() {
  const previewTitleEl = document.getElementById('previewTitle');
  const previewTextEl = document.getElementById('previewText');
  try {
    let ev;
    try {
      ev = buildEventObject();
    } catch (err) {
      if (previewTitleEl) previewTitleEl.textContent = 'Error en evento personal';
      if (previewTextEl) previewTextEl.textContent = err?.message || 'JSON inválido';
      return;
    }

    const exploreDangerNote = '';

    const previewImg = document.getElementById('previewImg');
    const previewImgWrap = document.getElementById('previewImgWrap');
    const resolvedPreviewImage = resolveEventPreviewImage(ev);
    if (previewImg && previewImgWrap) {
      if (resolvedPreviewImage) {
        previewImg.src = resolvedPreviewImage;
        previewImg.style.display = 'block';
        previewImgWrap.querySelector('.no-img') && (previewImgWrap.querySelector('.no-img').style.display = 'none');
      } else {
        previewImg.style.display = 'none';
        if (previewImgWrap.querySelector('.no-img')) previewImgWrap.querySelector('.no-img').style.display = '';
      }
    }

    if (previewTitleEl) previewTitleEl.textContent = ev.name || 'Nombre del evento';
    if (previewTextEl) {
      if(ev.type==='personal' && ev.nodes){
        const startNode = ev.nodes[ev.startNode || 'intro'] || {};
        previewTextEl.textContent = startNode.text || ev.text || 'Conversación personal…';
      } else {
        previewTextEl.textContent = (ev.text || 'El texto narrativo del evento aparecerá aquí…') + exploreDangerNote;
      }
    }

    const modalTopbar = document.getElementById('previewModalTopbar');
    if(modalTopbar) modalTopbar.textContent = `EVENTO - Día ${ev.day || ev.dayMin || 'X'}`;

    const durEl = document.getElementById('previewDuration');
    if (durEl) {
      if (ev.days > 1) {
        durEl.textContent = `⏱ Duración: ${ev.days} días — el efecto permanece activo`;
        durEl.style.display = '';
      } else {
        durEl.style.display = 'none';
      }
    }

    const optionsEl = document.getElementById('previewOptions');
    const directTag = document.getElementById('previewEffectsDirect');
    if (optionsEl && directTag) {
      optionsEl.innerHTML = '';
      optionsEl.appendChild(directTag);
      directTag.style.display = 'none';

      if (ev.choiceMode === 'direct' || mode === 'attack') {
        if (ev.effects && ev.effects.length > 0) {
          directTag.style.display = '';
          directTag.textContent = (mode==='attack'?'':'⚡ ') + ev.effects.map(effectToString).join('  ·  ');
        }
      } else {
        ['A','B','C','D'].forEach(letter => {
          const opt = ev.options?.[letter];
          if (!opt || !opt.label) return;
          const btn = document.createElement('button');
          btn.className = 'preview-opt-btn' + (letter === 'B' ? ' b' : '');
          const req = requirementToString(opt.requirement);
          const effectsText = opt.effects?.length ? '  →  ' + opt.effects.map(effectToString).join(', ') : '';
          btn.textContent = `${req ? req + ' ' : ''}${opt.label || ('Opción ' + letter)}${effectsText}`;
          optionsEl.appendChild(btn);
        });
      }
    }

    const typeStr = ev.type==='story'?`📖 Historia — día ${ev.day||'?'}`:ev.type==='weekly'?`📅 Semanal — semana ${ev.week||1}`:ev.type==='explore'?'🗺 Exploración':ev.type==='ambush'?'🚨 Emboscada':ev.type==='personal'?'🗣 Personal':'📋 Diario';
    const actionStr = ev.relatedAction ? `  ·  Relacionado con: ${ev.relatedAction}` : '';
    const participantsStr = ev.participants ? `  ·  👥 ${ev.participants} participante${ev.participants!==1?'s':''}` : '';
    const repeatStr = ev.repeatable ? '  ·  ↺ Repetible' : '';
    const skipAttackStr = ev.skipWhenAttackActive ? '  ·  🚫 con ataque activo' : '';
    const rangeFromCond=(cond,type)=>cond?.type===type?cond.value:undefined;
    const extractRange=(cond)=>{
      if(!cond) return {};
      if(cond.type==='and'&&Array.isArray(cond.conditions)){
        const mins=cond.conditions.filter(c=>c?.type==='day_min').map(c=>Number(c.value)||0).filter(v=>v>0);
        const maxs=cond.conditions.filter(c=>c?.type==='day_max').map(c=>Number(c.value)||0).filter(v=>v>0);
        return {dayMin:mins.length?Math.min(...mins):undefined,dayMax:maxs.length?Math.max(...maxs):undefined};
      }
      return {dayMin:rangeFromCond(cond,'day_min'),dayMax:rangeFromCond(cond,'day_max')};
    };
    const {dayMin:metaDayMin,dayMax:metaDayMax}=extractRange(ev.condition);
    const rangeStr=(metaDayMin||metaDayMax)?`  ·  Día ${metaDayMin??'?'}-${metaDayMax??'∞'}`:'';
    const metaEl = document.getElementById('previewMeta');
    if(metaEl) metaEl.textContent = `${typeStr}${actionStr}${participantsStr}${repeatStr}${skipAttackStr}${rangeStr}`;

    const tagsEl = document.getElementById('previewTags');
    if(tagsEl){
      if (ev.tags?.length) {
        tagsEl.style.display = '';
        tagsEl.textContent = '🏷 ' + ev.tags.join(' · ');
      } else {
        tagsEl.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('updatePreview error', err);
    if (previewTitleEl) previewTitleEl.textContent = 'Vista previa no disponible';
    if (previewTextEl) previewTextEl.textContent = err?.message || 'Error inesperado en la vista previa';
  }
}

// ── IMGBB UPLOAD ──
document.getElementById('uploadBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('f-apikey').value.trim();
  const fileInput = document.getElementById('f-imgfile');
  const status = document.getElementById('uploadStatus');

  if (!apiKey) { showToast('Introduce tu API key de ImgBB', true); return; }
  if (!fileInput.files.length) { showToast('Selecciona un archivo de imagen', true); return; }

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('image', file);

  status.textContent = '⬆ Subiendo imagen…';
  status.className = 'upload-status';

  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      uploadedImageUrl = data.data.url;
      document.getElementById('f-imgurl').value = uploadedImageUrl;
      document.getElementById('uploadedImg').src = uploadedImageUrl;
      document.getElementById('uploadedImg').style.display = 'block';
      document.getElementById('uploadPreview').querySelector('.placeholder').style.display = 'none';
      status.textContent = '✓ Imagen subida correctamente';
      status.className = 'upload-status ok';
      safeUpdatePreview();
      showToast('Imagen subida a ImgBB ✓');
    } else {
      throw new Error(data.error?.message || 'Error desconocido');
    }
  } catch (err) {
    status.textContent = '✗ Error: ' + err.message;
    status.className = 'upload-status err';
    showToast('Error al subir imagen: ' + err.message, true);
  }
});

// URL manual update triggers preview
document.getElementById('f-imgurl').addEventListener('input', () => {
  uploadedImageUrl = '';
  updatePreview();
});

// ── WEIGHT HINT ──
function updateWeightHint(v){
  v=Number(v)||0;
  let label,color,bar;
  if(v<=0){label='—';color='var(--dim)';bar=0;}
  else if(v<=3){label='Rarísimo — aparece ocasionalmente, evento especial';color='var(--accent-bright)';bar=1;}
  else if(v<=6){label='Poco frecuente — menos común que la media';color='var(--ok-bright)';bar=2;}
  else if(v<=10){label='Normal — aparece con regularidad';color='var(--amber-bright)';bar=3;}
  else if(v<=15){label='Frecuente — más probable que la mayoría';color='var(--warn-bright)';bar=4;}
  else{label='Muy frecuente — sale constantemente';color='var(--danger-bright)';bar=5;}
  const pips=Array.from({length:5},(_,i)=>
    `<span style="display:inline-block;width:14px;height:8px;margin-right:2px;clip-path:polygon(0 0,calc(100% - 3px) 0,100% 3px,100% 100%,0 100%);background:${i<bar?color:'var(--line2)'};"></span>`
  ).join('');
  const el=document.getElementById('weightHint');
  if(el) el.innerHTML=`<span style="color:${color}">${pips} ${label}</span>`;
}

// ── REPEATABLE TOGGLE ──
let isRepeatable = false;
function setRepeatable(val) {
  isRepeatable = val;
  document.getElementById('repeatNo').classList.toggle('active', !val);
  document.getElementById('repeatYes').classList.toggle('active', val);
  updatePreview();
}

// ── TYPE CHANGE ──
function onTypeChange(){
  const t=document.getElementById('f-type').value;
  const isPersonal=t==='personal';
  const isAmbush=t==='ambush';
  const setDisplay=(id,show)=>{ const el=document.getElementById(id); if(el) el.style.display=show?'':'none'; };
  setDisplay('weekField', t==='weekly');
  setDisplay('dayField', t==='story');
  setDisplay('dayMinField', t!=='story');
  setDisplay('dayMaxField', t!=='story');
  setDisplay('weightField', !(t==='weekly'||t==='story'||t==='quest'));
  setDisplay('relatedActionField', !((t==='weekly'||t==='story'||t==='quest'||t==='explore'||isPersonal) && !isAmbush));
  setDisplay('repeatableField', !(t==='weekly'||t==='story'||t==='quest'));
  setDisplay('personalStartNodeField', isPersonal);
  setDisplay('personalNodesField', isPersonal);
  updatePersonalSurvivorUI();
  safeUpdatePreview();
}


function safeUpdatePreview(){
  try{ updatePreview(); }catch(err){ console.error('safeUpdatePreview', err); }
}

function sanitizeExploreEncounterMode(raw){
  return ['random','threat','ambush'].includes(raw) ? raw : 'random';
}

function stripLegacyAttackEffects(effectList){
  return (Array.isArray(effectList) ? effectList : []).filter(e => e && e.type !== 'setAttackThreat');
}

function removeLegacyExploreAttackEffectsFromEvent(ev){
  if(!ev || ev.type !== 'explore') return ev;
  if(Array.isArray(ev.effects)) ev.effects = stripLegacyAttackEffects(ev.effects);
  if(ev.options){
    ['A','B','C','D'].forEach(letter => {
      if(ev.options?.[letter]?.effects) ev.options[letter].effects = stripLegacyAttackEffects(ev.options[letter].effects);
    });
  }
  if(ev.nodes && typeof ev.nodes === 'object'){
    Object.values(ev.nodes).forEach(node => {
      if(node?.options){
        ['A','B','C','D'].forEach(letter => {
          if(node.options?.[letter]?.effects) node.options[letter].effects = stripLegacyAttackEffects(node.options[letter].effects);
        });
      }
    });
  }
  return ev;
}

function validateExploreFields(ev){
  return true;
}

// ── ALL FORM INPUTS → PREVIEW ──
['f-id','f-name','f-story','f-days','f-weight','f-labelA','f-labelB','f-labelC','f-labelD','f-week','f-day','f-dayMin','f-dayMax','f-relatedAction','f-tags','f-personalSurvivorId','f-personalStartNode','f-personalNodeTitle','f-personalNodeText','f-personalLabelA','f-personalLabelB','f-personalLabelC','f-reqTypeA','f-reqOpA','f-reqValueA','f-reqSkillA','f-reqTypeB','f-reqOpB','f-reqValueB','f-reqSkillB','f-reqTypeC','f-reqOpC','f-reqValueC','f-reqSkillC','f-reqTypeD','f-reqOpD','f-reqValueD','f-reqSkillD'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', safeUpdatePreview);
});
['A','B','C','D'].forEach(updateChoiceRequirementUI);
const attackStrengthInput=document.getElementById('f-attackStrength');
if(attackStrengthInput) attackStrengthInput.addEventListener('input', safeUpdatePreview);
['f-attackHostile','f-attackVariant','f-attackArrival','f-attackPopupVictoryTitle','f-attackPopupVictoryText','f-attackPopupVictoryIcon','f-attackPopupDefeatTitle','f-attackPopupDefeatText','f-attackPopupDefeatIcon'].forEach(id=>{
  const el=document.getElementById(id);
  if(el){
    el.addEventListener('change', safeUpdatePreview);
    el.addEventListener('input', safeUpdatePreview);
  }
});

// ── ADD EVENT ──
function addEvent() {
  let ev;
  try{ ev = buildEventObject(); }catch(err){ console.error(err); showToast(err.message || 'Error al construir el evento', true); return; }
  if (!ev.id) { showToast('El ID es obligatorio', true); return; }
  if (!ev.name) { showToast('El nombre es obligatorio', true); return; }
  if (!ev.text && ev.type !== 'personal') { showToast('El texto narrativo es obligatorio', true); return; }
  if (!validateExploreFields(ev)) return;
  const useFixedPersonalSurvivor = !!document.getElementById('f-personalUseFixedSurvivor')?.checked;
  if (ev.type === 'personal' && useFixedPersonalSurvivor && !ev.personalSurvivorId) { showToast('Has marcado survivor concreto, pero no has indicado su ID', true); return; }

  if (events.find(e => e.id === ev.id)) {
    showToast(`Ya existe un evento con el ID "${ev.id}"`, true); return;
  }

  events.push(ev);
  renderEventList();
  showToast(`Evento "${ev.name}" añadido ✓`);
  updateEventCount();
}


function renderEventList() {
  const el = document.getElementById('eventList');
  const total = events.length;
  if (!total) {
    activeEventTab = 'all';
    activeEventTag = 'all';
    renderEventTabs();
    renderEventTagFilter();
    el.innerHTML = '<div style="color:var(--dim);font-size:12px;text-align:center;padding:20px 0;">Aún no has creado ningún evento.</div>';
    document.getElementById('listCount').textContent = '0 eventos';
    return;
  }

  ensureValidActiveEventTab();
  renderEventTabs();
  renderEventTagFilter();

  const filteredEvents = getListFilteredEvents();
  const activeTabDef = EVENT_TABS.find(t => t.key === (activeEventTab || 'all')) || EVENT_TABS[0];
  const activeTagLabel = activeEventTag && activeEventTag !== 'all' ? ` · tag #${activeEventTag}` : '';
  const activeSearchLabel = eventSearchQuery ? ` · búsqueda "${eventSearchQuery}"` : '';
  document.getElementById('listCount').textContent = `${total} eventos · vista: ${activeTabDef.label}${activeTagLabel}${activeSearchLabel}`;
  el.innerHTML = '';

  if (!filteredEvents.length) {
    const parts = [activeTabDef.label];
    if(activeEventTag && activeEventTag !== 'all') parts.push(`#${activeEventTag}`);
    if(eventSearchQuery) parts.push(`"${eventSearchQuery}"`);
    el.innerHTML = `<div class="event-tab-empty">No hay eventos para los filtros activos: <strong>${parts.join(' · ')}</strong>.</div>`;
    return;
  }

  filteredEvents.forEach((ev) => {
    const idx = events.indexOf(ev);
    const item = document.createElement('div');
    item.className = 'event-list-item';

    const typeKey = normalizeEventType(ev.type);
    if (typeKey === 'story') item.style.borderLeftColor = 'var(--amber)';
    else if (typeKey === 'quest') item.style.borderLeftColor = 'var(--amber-bright)';
    else if (typeKey === 'ambush') item.style.borderLeftColor = 'var(--danger)';
    else if (typeKey === 'explore') item.style.borderLeftColor = 'var(--accent-bright)';
    else if (typeKey === 'personal') item.style.borderLeftColor = 'var(--ok-bright)';

    const thumb = document.createElement('div');
    thumb.className = 'event-list-thumb';
    const resolvedThumbImage = resolveEventPreviewImage(ev);
    if (resolvedThumbImage) {
      const img = document.createElement('img');
      img.src = resolvedThumbImage;
      img.style.display = 'block';
      thumb.appendChild(img);
    } else {
      const icon = typeKey === 'story' ? '📖' : typeKey === 'quest' ? '📜' : typeKey === 'weekly' ? '📅' : typeKey === 'explore' ? '🧭' : typeKey === 'ambush' ? '🚨' : typeKey === 'personal' ? '🗣' : '📋';
      thumb.innerHTML = `<span class="no-img-sm">${icon}</span>`;
    }

    const info = document.createElement('div');
    info.className = 'event-list-info';
    const modeTag = ev.choiceMode === 'direct' ? '⚡ Directo' : ev.choiceMode === 'personal' ? '🗣 Personal' : '⚖ Elección';
    const effectCount = ev.choiceMode === 'direct'
      ? (ev.effects?.length || 0) + ' efecto(s)'
      : (typeKey === 'personal'
          ? `A: ${ev.nodes?.[ev.startNode || 'intro']?.options?.A?.effects?.length||0} · B: ${ev.nodes?.[ev.startNode || 'intro']?.options?.B?.effects?.length||0} · C: ${ev.nodes?.[ev.startNode || 'intro']?.options?.C?.effects?.length||0}`
          : `A: ${ev.options?.A?.effects?.length||0} · B: ${ev.options?.B?.effects?.length||0} · C: ${ev.options?.C?.effects?.length||0} · D: ${ev.options?.D?.effects?.length||0}`);
    const typeTag = typeKey==='weekly'
      ? `📅 Semanal (semana ${ev.week||'?'})`
      : typeKey==='story'
        ? `📖 Historia (día ${ev.day||'?'})`
        : typeKey==='quest'
          ? '📜 Quest'
          : typeKey==='explore'
            ? '🧭 Exploración'
            : typeKey==='ambush'
              ? '🚨 Emboscada'
              : typeKey==='personal'
                ? '🗣 Personal'
                : '📋 Diario';
    const actionTag = ev.relatedAction ? `  ·  ⚡ ${ev.relatedAction}` : '';
    const participantsTag = ev.participants ? `  ·  👥 ${ev.participants}` : '';
    const repeatTag = ev.repeatable ? '  ·  ↺' : '';
    const tagsTag = Array.isArray(ev.tags) && ev.tags.length ? `  ·  #${ev.tags.join(' #')}` : '';
    info.innerHTML = `<div class="event-list-name">${ev.name}</div><div class="event-list-meta">${ev.id}  ·  ${typeTag}  ·  ${modeTag}  ·  ${effectCount}  ·  ${ev.days}d${(typeKey!=='weekly'&&typeKey!=='quest')?' · peso '+ev.weight:''}${actionTag}${participantsTag}${repeatTag}${tagsTag}</div>`;

    const editBtn = document.createElement('button');
    editBtn.className = 'btn';
    editBtn.style.fontSize = '11px';
    editBtn.style.padding = '6px 10px';
    editBtn.textContent = '✎';
    editBtn.title = 'Cargar para editar';
    editBtn.addEventListener('click', () => {
      if (typeKey === 'story') loadStoryEventForEditing(idx);
      else loadEventForEditing(idx);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn danger';
    delBtn.style.fontSize = '11px';
    delBtn.style.padding = '6px 10px';
    delBtn.textContent = '✕';
    delBtn.title = 'Eliminar';
    delBtn.addEventListener('click', () => {
      events.splice(idx, 1);
      renderEventList();
      updateEventCount();
      showToast(typeKey === 'story' ? 'Evento de historia eliminado' : 'Evento eliminado');
    });

    item.appendChild(thumb);
    item.appendChild(info);
    item.appendChild(editBtn);
    item.appendChild(delBtn);
    el.appendChild(item);
  });
}

function loadEventForEditing(idx) {
  const ev = events[idx];
  document.getElementById('f-id').value = ev.id || '';
  document.getElementById('f-name').value = ev.name || '';
  document.getElementById('f-story').value = ev.text || '';
  document.getElementById('f-days').value = ev.days || 1;
  document.getElementById('f-weight').value = ev.weight || 8;
  document.getElementById('f-imgurl').value = ev.image || '';
  if(document.getElementById('f-type')) document.getElementById('f-type').value = ev.type || 'city';
  if(document.getElementById('f-week')) document.getElementById('f-week').value = ev.week || 1;
  if(document.getElementById('f-day'))  document.getElementById('f-day').value  = ev.day  || 7;
  const {dayMin,dayMax,condition}=splitDayRangeCondition(ev.condition);
  if(document.getElementById('f-dayMin')) document.getElementById('f-dayMin').value = dayMin??'';
  if(document.getElementById('f-dayMax')) document.getElementById('f-dayMax').value = dayMax??'';
  loadConditionIntoUI(condition);
  if(document.getElementById('f-relatedAction')) document.getElementById('f-relatedAction').value = ev.relatedAction || '';
  if(document.getElementById('f-tags')) document.getElementById('f-tags').value = Array.isArray(ev.tags) ? ev.tags.join(', ') : '';
  if(document.getElementById('f-participants')) document.getElementById('f-participants').value = Number(ev.participants || ev.actorCount || 0) || 0;
  if(document.getElementById('f-personalUseFixedSurvivor')) document.getElementById('f-personalUseFixedSurvivor').checked = !!(ev.personalSurvivorId || ev.survivorId);
  if(document.getElementById('f-personalSurvivorId')) document.getElementById('f-personalSurvivorId').value = ev.personalSurvivorId || ev.survivorId || '';
  if(document.getElementById('f-personalStartNode')) document.getElementById('f-personalStartNode').value = ev.startNode || 'intro';
  const personalNode = ev.nodes ? (ev.nodes[ev.startNode || 'intro'] || Object.values(ev.nodes)[0]) : null;
  if(document.getElementById('f-personalNodeTitle')) document.getElementById('f-personalNodeTitle').value = personalNode?.title || '';
  if(document.getElementById('f-personalNodeText')) document.getElementById('f-personalNodeText').value = personalNode?.text || ev.text || '';
  if(document.getElementById('f-personalLabelA')) document.getElementById('f-personalLabelA').value = personalNode?.options?.A?.label || '';
  if(document.getElementById('f-personalLabelB')) document.getElementById('f-personalLabelB').value = personalNode?.options?.B?.label || '';
  if(document.getElementById('f-personalLabelC')) document.getElementById('f-personalLabelC').value = personalNode?.options?.C?.label || '';
  if(document.getElementById('f-labelD')) document.getElementById('f-labelD').value = '';
  ['A','B','C','D'].forEach(letter => applyChoiceRequirementToForm(letter, null));
  if(document.getElementById('f-skipWhenAttackActive')) document.getElementById('f-skipWhenAttackActive').checked = !!ev.skipWhenAttackActive;
  setRepeatable(!!ev.repeatable);
  onTypeChange();

  // Remove from list so it can be re-added
  events.splice(idx, 1);
  renderEventList();
  updateEventCount();

  const hasAttackEffect = (ev.effects||[]).some(e=>e.type==='setAttackThreat');
  if (hasAttackEffect) {
    setMode('attack');
    const atk = ev.effects.find(e=>e.type==='setAttackThreat');
    if(atk) {
      if(document.getElementById('f-attackHostile')) document.getElementById('f-attackHostile').value = (atk.hostileType || atk.hostile || 'random');
      updateAttackVariantOptions();
      if(document.getElementById('f-attackVariant')) document.getElementById('f-attackVariant').value = (atk.hostileVariant || atk.variant || 'random');
      document.getElementById('f-attackArrival').value = String(atk.arrivalDays ?? 1);
      if(document.getElementById('f-attackPopupVictoryTitle')) document.getElementById('f-attackPopupVictoryTitle').value = atk.combatPopupVictory?.title || '';
      if(document.getElementById('f-attackPopupVictoryText')) document.getElementById('f-attackPopupVictoryText').value = atk.combatPopupVictory?.text || '';
      if(document.getElementById('f-attackPopupVictoryIcon')) document.getElementById('f-attackPopupVictoryIcon').value = atk.combatPopupVictory?.icon || '';
      if(document.getElementById('f-attackPopupDefeatTitle')) document.getElementById('f-attackPopupDefeatTitle').value = atk.combatPopupDefeat?.title || '';
      if(document.getElementById('f-attackPopupDefeatText')) document.getElementById('f-attackPopupDefeatText').value = atk.combatPopupDefeat?.text || '';
      if(document.getElementById('f-attackPopupDefeatIcon')) document.getElementById('f-attackPopupDefeatIcon').value = atk.combatPopupDefeat?.icon || '';
      ['attackVictoryRows','attackDefeatRows'].forEach(id => { document.getElementById(id).innerHTML=''; });
      (atk.effectOnVictory||[]).forEach(eff => { addEffectRow('attackVictory'); const rows=document.getElementById('attackVictoryRows').querySelectorAll('.effect-row'); loadEffectIntoRow(rows[rows.length-1],eff); });
      (atk.effectOnDefeat||[]).forEach(eff => { addEffectRow('attackDefeat'); const rows=document.getElementById('attackDefeatRows').querySelectorAll('.effect-row'); loadEffectIntoRow(rows[rows.length-1],eff); });
    }
  } else {
    setMode(ev.choiceMode === 'choice' ? 'choice' : 'direct');
  }

  // Clear effect rows
  ['directEffectRows','optionAEffectRows','optionBEffectRows','optionCEffectRows','optionDEffectRows','personalOptionAEffectRows','personalOptionBEffectRows','personalOptionCEffectRows'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });

  if (ev.choiceMode === 'direct' && ev.effects) {
    ev.effects.forEach(eff => {
      addEffectRow('direct');
      const rows = document.getElementById('directEffectRows').querySelectorAll('.effect-row');
      loadEffectIntoRow(rows[rows.length - 1], eff);
    });
  } else if (ev.choiceMode === 'choice' && ev.options) {
    document.getElementById('f-labelA').value = ev.options.A?.label || '';
    document.getElementById('f-labelB').value = ev.options.B?.label || '';
    (ev.options.A?.effects || []).forEach(eff => {
      addEffectRow('optionA');
      const rows = document.getElementById('optionAEffectRows').querySelectorAll('.effect-row');
      loadEffectIntoRow(rows[rows.length - 1], eff);
    });
    (ev.options.B?.effects || []).forEach(eff => {
      addEffectRow('optionB');
      const rows = document.getElementById('optionBEffectRows').querySelectorAll('.effect-row');
      loadEffectIntoRow(rows[rows.length - 1], eff);
    });
    document.getElementById('f-labelC').value = ev.options.C?.label || '';
    (ev.options.C?.effects || []).forEach(eff => {
      addEffectRow('optionC');
      const rows = document.getElementById('optionCEffectRows').querySelectorAll('.effect-row');
      loadEffectIntoRow(rows[rows.length - 1], eff);
    });
  }

  if(ev.type === 'personal' && personalNode?.options){
    (personalNode.options.A?.effects || []).forEach(eff => {
      addEffectRow('personalOptionA');
      const rows = document.getElementById('personalOptionAEffectRows').querySelectorAll('.effect-row');
      loadEffectIntoRow(rows[rows.length - 1], eff);
    });
    (personalNode.options.B?.effects || []).forEach(eff => {
      addEffectRow('personalOptionB');
      const rows = document.getElementById('personalOptionBEffectRows').querySelectorAll('.effect-row');
      loadEffectIntoRow(rows[rows.length - 1], eff);
    });
    (personalNode.options.C?.effects || []).forEach(eff => {
      addEffectRow('personalOptionC');
      const rows = document.getElementById('personalOptionCEffectRows').querySelectorAll('.effect-row');
      loadEffectIntoRow(rows[rows.length - 1], eff);
    });
  }

  safeUpdatePreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Evento cargado para editar');
}

function loadStoryEventForEditing(idx) {
  const ev = events[idx];
  events.splice(idx, 1);
  renderEventList(); updateEventCount();
  document.getElementById('f-id').value = ev.id || '';
  document.getElementById('f-name').value = ev.name || '';
  document.getElementById('f-story').value = ev.text || '';
  document.getElementById('f-days').value = ev.days || 1;
  document.getElementById('f-imgurl').value = ev.image || '';
  document.getElementById('f-type').value = 'story';
  document.getElementById('f-day').value = ev.day || 7;
  if(document.getElementById('f-participants')) document.getElementById('f-participants').value = Number(ev.participants || ev.actorCount || 0) || 0;
  if(document.getElementById('f-dayMin')) document.getElementById('f-dayMin').value = '';
  if(document.getElementById('f-dayMax')) document.getElementById('f-dayMax').value = '';
  if(document.getElementById('f-tags')) document.getElementById('f-tags').value = Array.isArray(ev.tags) ? ev.tags.join(', ') : '';
  if(document.getElementById('f-labelD')) document.getElementById('f-labelD').value = '';
  ['A','B','C','D'].forEach(letter => applyChoiceRequirementToForm(letter, null));
  loadConditionIntoUI(ev.condition);
  if(document.getElementById('f-skipWhenAttackActive')) document.getElementById('f-skipWhenAttackActive').checked = !!ev.skipWhenAttackActive;
  setRepeatable(!!ev.repeatable);
  onTypeChange();

  const hasAttackEffect = (ev.effects||[]).some(e=>e.type==='setAttackThreat');
  if (hasAttackEffect) {
    setMode('attack');
    const atk = ev.effects.find(e=>e.type==='setAttackThreat');
    if(atk) {
      if(document.getElementById('f-attackHostile')) document.getElementById('f-attackHostile').value = (atk.hostileType || atk.hostile || 'random');
      document.getElementById('f-attackArrival').value = String(atk.arrivalDays ?? 1);
      if(document.getElementById('f-attackPopupVictoryTitle')) document.getElementById('f-attackPopupVictoryTitle').value = atk.combatPopupVictory?.title || '';
      if(document.getElementById('f-attackPopupVictoryText')) document.getElementById('f-attackPopupVictoryText').value = atk.combatPopupVictory?.text || '';
      if(document.getElementById('f-attackPopupVictoryIcon')) document.getElementById('f-attackPopupVictoryIcon').value = atk.combatPopupVictory?.icon || '';
      if(document.getElementById('f-attackPopupDefeatTitle')) document.getElementById('f-attackPopupDefeatTitle').value = atk.combatPopupDefeat?.title || '';
      if(document.getElementById('f-attackPopupDefeatText')) document.getElementById('f-attackPopupDefeatText').value = atk.combatPopupDefeat?.text || '';
      if(document.getElementById('f-attackPopupDefeatIcon')) document.getElementById('f-attackPopupDefeatIcon').value = atk.combatPopupDefeat?.icon || '';
      ['attackVictoryRows','attackDefeatRows'].forEach(id => { document.getElementById(id).innerHTML=''; });
      (atk.effectOnVictory||[]).forEach(eff => { addEffectRow('attackVictory'); const rows=document.getElementById('attackVictoryRows').querySelectorAll('.effect-row'); loadEffectIntoRow(rows[rows.length-1],eff); });
      (atk.effectOnDefeat||[]).forEach(eff => { addEffectRow('attackDefeat'); const rows=document.getElementById('attackDefeatRows').querySelectorAll('.effect-row'); loadEffectIntoRow(rows[rows.length-1],eff); });
    }
  } else {
    setMode(ev.choiceMode === 'choice' ? 'choice' : 'direct');
  }

  ['directEffectRows','optionAEffectRows','optionBEffectRows','optionCEffectRows','optionDEffectRows','personalOptionAEffectRows','personalOptionBEffectRows','personalOptionCEffectRows'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });

  if (ev.choiceMode === 'direct' && ev.effects && !hasAttackEffect) {
    ev.effects.forEach(eff => { addEffectRow('direct'); const rows = document.getElementById('directEffectRows').querySelectorAll('.effect-row'); loadEffectIntoRow(rows[rows.length-1], eff); });
  } else if (ev.choiceMode === 'choice' && ev.options) {
    document.getElementById('f-labelA').value = ev.options.A?.label || '';
    document.getElementById('f-labelB').value = ev.options.B?.label || '';
    document.getElementById('f-labelC').value = ev.options.C?.label || '';
    document.getElementById('f-labelD').value = ev.options.D?.label || '';
    ['A','B','C','D'].forEach(letter => applyChoiceRequirementToForm(letter, ev.options?.[letter]?.requirement));
    (ev.options.A?.effects||[]).forEach(eff => { addEffectRow('optionA'); const rows = document.getElementById('optionAEffectRows').querySelectorAll('.effect-row'); loadEffectIntoRow(rows[rows.length-1], eff); });
    (ev.options.B?.effects||[]).forEach(eff => { addEffectRow('optionB'); const rows = document.getElementById('optionBEffectRows').querySelectorAll('.effect-row'); loadEffectIntoRow(rows[rows.length-1], eff); });
    (ev.options.C?.effects||[]).forEach(eff => { addEffectRow('optionC'); const rows = document.getElementById('optionCEffectRows').querySelectorAll('.effect-row'); loadEffectIntoRow(rows[rows.length-1], eff); });
    (ev.options.D?.effects||[]).forEach(eff => { addEffectRow('optionD'); const rows = document.getElementById('optionDEffectRows').querySelectorAll('.effect-row'); loadEffectIntoRow(rows[rows.length-1], eff); });
  }
  safeUpdatePreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Evento de historia cargado para editar');
}

function loadEffectIntoRow(row, eff) {
  const typeSelect = row.querySelector('.effect-type-select');
  const p1 = row.querySelector('.effect-param1-select');
  const p2 = row.querySelector('.effect-param2-select');
  const amt = row.querySelector('.effect-amount-input');

  let uiType = eff.type;
  if (eff.type === 'addResource' || eff.type === 'removeResource') uiType = 'modifyResource';
  else if (eff.type === 'addFatigue' || eff.type === 'removeFatigue') uiType = 'modifyFatigue';
  else if (eff.type === 'addSurvivorByRarity' || eff.type === 'addSurvivorRandom') uiType = 'addSurvivor';
  else if (eff.type === 'fatigueSurvivorPermanent' || eff.type === 'moraleSurvivorPermanent') uiType = eff.type;
  else if (['createThreat','addThreat','spawnThreat'].includes(eff.type)) uiType = 'createThreat';
  else if (eff.type === 'activateEvent' || eff.type === 'activateQuest') uiType = 'activateQuest';
  else if (eff.type === 'awaySurvivor') uiType = 'awaySurvivor';

  typeSelect.value = uiType;
  updateEffectRowFields(row, uiType);

  if (eff.type === 'addResource' || eff.type === 'removeResource') {
    p1.value = eff.resource || 'food';
    amt.value = eff.type === 'removeResource' ? -(eff.amount || 1) : (eff.amount || 1);
  } else if (eff.type === 'addFatigue' || eff.type === 'removeFatigue') {
    if (eff.targetId) {
      row.dataset.customTargetId = eff.targetId;
      const byIdOpt = [...p1.options].find(o => o.value === '__by_id__');
      if (byIdOpt) byIdOpt.textContent = `Por ID: ${eff.targetId}`;
      p1.value = '__by_id__';
    } else p1.value = 'random';
    amt.value = eff.type === 'removeFatigue' ? -(eff.amount || 1) : (eff.amount || 1);
  } else if (eff.type === 'fatigueAll') {
    amt.value = (eff.amount ?? 1);
  } else if (eff.type === 'fatigueAllPermanent') {
    amt.value = (eff.amount ?? 1);
  } else if (eff.type === 'fatigueSurvivorPermanent') {
    if (eff.targetId) {
      row.dataset.customTargetId = eff.targetId;
      const byIdOpt = [...p1.options].find(o => o.value === '__by_id__');
      if (byIdOpt) byIdOpt.textContent = `Por ID: ${eff.targetId}`;
      p1.value = '__by_id__';
    }
    amt.value = (eff.amount ?? 1);
  } else if (eff.type === 'disableBuilding') {
    p1.value = eff.building || 'huerto';
    amt.value = eff.days || 1;
  } else if (eff.type === 'destroyBuilding') {
    p1.value = eff.building || 'huerto';
  } else if (eff.type === 'addSurvivor' || eff.type === 'addSurvivorByRarity') {
    p1.value = String(eff.rarity || 4);
  } else if (eff.type === 'addSurvivorRandom') {
    p1.value = 'any';
  } else if (eff.type === 'healSurvivor' || eff.type === 'injureSurvivor' || eff.type === 'disableSurvivor' || eff.type === 'awaySurvivor' || eff.type === 'removeSurvivor') {
    if (eff.targetId) {
      row.dataset.customTargetId = eff.targetId;
      const byIdOpt = [...p1.options].find(o => o.value === '__by_id__');
      if (byIdOpt) byIdOpt.textContent = `Por ID: ${eff.targetId}`;
      p1.value = '__by_id__';
    } else if (eff.targetMode === 'action') p1.value = '__action__';
    else if (eff.targetMode && [...p1.options].some(o => o.value === eff.targetMode)) p1.value = eff.targetMode;
    else p1.value = 'random';
    if (eff.type === 'healSurvivor' && p2) {
      p2.value = eff.injuryLevel || 'simple';
    }
    if (eff.type === 'disableSurvivor') amt.value = eff.days || 1;
    if (eff.type === 'awaySurvivor') {
      if (p2) p2.value = String(eff.returnInjuryChance ?? 35);
      amt.value = eff.days || 3;
    }
  } else if (eff.type === 'injureActionSurvivor') {
    p1.value = eff.action || 'related';
    if (p2) p2.value = eff.injuryLevel || '';
  } else if (eff.type === 'addItem') {
    if (eff.itemId) {
      p1.value = '__specific__';
      row.dataset.specificItemId = eff.itemId;
      const specificOpt = [...p1.options].find(o => o.value === '__specific__');
      if (specificOpt) specificOpt.textContent = `📦 ${eff.itemId}`;
    } else if (eff.randomType && eff.randomType !== 'any' && eff.randomTier) {
      p1.value = '__type_tier__';
      row.dataset.randomItemType = eff.randomType;
      row.dataset.randomItemTier = normalizeTierValue(eff.randomTier);
      const typeTierOpt = [...p1.options].find(o => o.value === '__type_tier__');
      if (typeTierOpt) typeTierOpt.textContent = `🗂 ${eff.randomType} · ${normalizeTierValue(eff.randomTier)}`;
    } else if (eff.randomType && eff.randomType !== 'any') {
      p1.value = '__type__';
      row.dataset.randomItemType = eff.randomType;
      const typeOpt = [...p1.options].find(o => o.value === '__type__');
      if (typeOpt) typeOpt.textContent = `🗂 ${eff.randomType}`;
    } else if (eff.randomTier) {
      p1.value = '__tier__';
      row.dataset.randomItemTier = normalizeTierValue(eff.randomTier);
      const tierOpt = [...p1.options].find(o => o.value === '__tier__');
      if (tierOpt) tierOpt.textContent = `🏷 ${normalizeTierValue(eff.randomTier)}`;
    } else {
      p1.value = '__random__';
    }
    if (p2) p2.value = eff.target || 'base';
    amt.value = eff.amount || 1;
  } else if (eff.type === 'damageItem' || eff.type === 'removeItem') {
    p1.value = eff.itemId || p1.value;
    if (p2) p2.value = eff.target || 'base';
    amt.value = eff.amount || 1;
  } else if (['createThreat','addThreat','spawnThreat'].includes(eff.type)) {
    const threatId = eff.threatId || eff.templateId || eff.id || '';
    if ([...p1.options].some(o => o.value === threatId)) {
      p1.value = threatId;
    } else if (threatId) {
      row.dataset.customThreatId = threatId;
      p1.dataset.manualThreatId = threatId;
      p1.dataset.manualThreatLabel = `✍ ${threatId}`;
      const manualOpt = [...p1.options].find(o => o.value === '__manual_threat__');
      if (manualOpt) manualOpt.textContent = `✍ ${threatId}`;
      p1.value = '__manual_threat__';
    }
    if (p2) p2.value = eff.severity ? String(eff.severity) : '';
  } else if (eff.type === 'limitAction') {
    p1.value = eff.action || 'forraje';
    amt.value = eff.days || 1;
  } else if (eff.type === 'activateQuest' || eff.type === 'activateEvent') {
    const questId = eff.questId || eff.eventId || '';
    const panel = ensureActivateEventPanel(row);
    const target = panel.querySelector('.activate-event-target');
    const lead = panel.querySelector('.activate-event-lead');
    if ([...target.options].some(o => o.value === questId)) {
      target.value = questId;
    } else if (questId) {
      row.dataset.manualEventId = questId;
      target.dataset.manualEventId = questId;
      target.dataset.manualEventLabel = `✍ ${questId}`;
      const manualOpt = [...target.options].find(o => o.value === '__manual_event__');
      if (manualOpt) manualOpt.textContent = `✍ ${questId}`;
      target.value = '__manual_event__';
    }
    panel.querySelector('.activate-event-min').value = eff.minDays ?? 0;
    panel.querySelector('.activate-event-max').value = eff.maxDays ?? eff.minDays ?? 0;
    const leaveNow = panel.querySelector('.activate-event-leave');
    const leaveDays = panel.querySelector('.activate-event-leave-days');
    const leaveChance = panel.querySelector('.activate-event-leave-chance');
    if (leaveNow) leaveNow.checked = eff.leaveCamp === true;
    if (leaveDays) leaveDays.value = eff.leaveDays ?? 3;
    if (leaveChance) leaveChance.value = eff.returnInjuryChance ?? 35;
    if (eff.forcedSurvivorId) {
      row.dataset.manualLeadSurvivorId = eff.forcedSurvivorId;
      const manualLead = [...lead.options].find(o => o.value === '__by_id__');
      if (manualLead) manualLead.textContent = `Por ID: ${eff.forcedSurvivorId}`;
      lead.value = '__by_id__';
    } else if (eff.leadTargetMode === 'action') {
      lead.value = '__action__';
    } else if (eff.leadTargetMode && [...lead.options].some(o => o.value === eff.leadTargetMode)) {
      lead.value = eff.leadTargetMode;
    }
  } else if (eff.type === 'moraleAll' || eff.type === 'moraleAllPermanent' || eff.type === 'moraleSurvivorPermanent' || eff.type === 'moraleSurvivor' || eff.type === 'stabilityChange') {
    amt.value = eff.amount || 1;
    if (eff.type === 'moraleSurvivor' || eff.type === 'moraleSurvivorPermanent') {
      if (eff.targetId) {
        row.dataset.customTargetId = eff.targetId;
        const byIdOpt = [...p1.options].find(o => o.value === '__by_id__');
        if (byIdOpt) byIdOpt.textContent = `Por ID: ${eff.targetId}`;
        p1.value = '__by_id__';
      } else if (eff.targetMode === 'action') {
        p1.value = '__action__';
      } else if (eff.targetMode && [...p1.options].some(o => o.value === eff.targetMode)) {
        p1.value = eff.targetMode;
      } else if (eff.type === 'moraleSurvivor') {
        p1.value = 'random';
      }
    }
  }
}

// ── CLEAR ──
function clearForm() {
  ['f-id','f-name','f-story','f-labelA','f-labelB','f-labelC','f-labelD','f-imgurl','f-tags','f-reqValueA','f-reqSkillA','f-reqValueB','f-reqSkillB','f-reqValueC','f-reqSkillC','f-reqValueD','f-reqSkillD'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-days').value = 1;
  ['A','B','C','D'].forEach(letter => {
    const typeEl = document.getElementById(`f-reqType${letter}`);
    const opEl = document.getElementById(`f-reqOp${letter}`);
    if (typeEl) typeEl.value = '';
    if (opEl) opEl.value = '>=';
    applyChoiceRequirementToForm(letter, null);
  });
  document.getElementById('f-weight').value = 8;
  if(document.getElementById('f-day')) document.getElementById('f-day').value = 7;
  if(document.getElementById('f-dayMin')) document.getElementById('f-dayMin').value = '';
  if(document.getElementById('f-dayMax')) document.getElementById('f-dayMax').value = '';
  setRepeatable(false);
  if(document.getElementById('f-subtitle')) document.getElementById('f-subtitle').value='';
  document.getElementById('f-condType').value='';
  updateConditionUI();
  if(document.getElementById('f-condJson')) document.getElementById('f-condJson').value='';
  if(document.getElementById('f-condId')) document.getElementById('f-condId').value='';
  if(document.getElementById('f-priority')) document.getElementById('f-priority').checked=false;
  if(document.getElementById('f-skipWhenAttackActive')) document.getElementById('f-skipWhenAttackActive').checked=false;
  if(document.getElementById('f-attackHostile')) document.getElementById('f-attackHostile').value = 'random';
  updateAttackVariantOptions();
  if(document.getElementById('f-attackVariant')) document.getElementById('f-attackVariant').value = 'random';
  if(document.getElementById('f-attackArrival')) document.getElementById('f-attackArrival').value = '1';
  if(document.getElementById('f-attackPopupVictoryTitle')) document.getElementById('f-attackPopupVictoryTitle').value = '';
  if(document.getElementById('f-attackPopupVictoryText')) document.getElementById('f-attackPopupVictoryText').value = '';
  if(document.getElementById('f-attackPopupVictoryIcon')) document.getElementById('f-attackPopupVictoryIcon').value = '';
  if(document.getElementById('f-attackPopupDefeatTitle')) document.getElementById('f-attackPopupDefeatTitle').value = '';
  if(document.getElementById('f-attackPopupDefeatText')) document.getElementById('f-attackPopupDefeatText').value = '';
  if(document.getElementById('f-attackPopupDefeatIcon')) document.getElementById('f-attackPopupDefeatIcon').value = '';
  ['attackVictoryRows','attackDefeatRows'].forEach(id => { const el=document.getElementById(id); if(el) el.innerHTML=''; });
  ['directEffectRows','optionAEffectRows','optionBEffectRows','optionCEffectRows','optionDEffectRows','personalOptionAEffectRows','personalOptionBEffectRows','personalOptionCEffectRows'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
  uploadedImageUrl = '';
  document.getElementById('uploadedImg').style.display = 'none';
  document.getElementById('uploadPreview').querySelector('.placeholder').style.display = '';
  document.getElementById('uploadStatus').textContent = '';
  setMode('direct');
  ['A','B','C','D'].forEach(updateChoiceRequirementUI);
  updatePreview();
}

function importJSON(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const incoming = Array.isArray(parsed) ? parsed : [];
      if (!incoming.length) { showToast('El archivo no contiene eventos válidos', true); return; }
      let added = 0, skipped = 0;
      incoming.forEach(ev => {
        if (!ev.id) { skipped++; return; }
        // Normalise: some JSONs use 'title' instead of 'name'
        if (!ev.name && ev.title) ev.name = ev.title;
        if (!ev.name) { skipped++; return; }
        if (events.find(x => x.id === ev.id)) { skipped++; return; }
        events.push(ev);
        added++;
      });
      renderEventList();
      updateEventCount();
      showToast(`Importados ${added} evento${added!==1?'s':''} · ${skipped} omitido${skipped!==1?'s':''} (ID duplicado o inválido)`);
    } catch {
      showToast('El archivo no es un JSON válido', true);
    }
    // Reset so same file can be imported again if needed
    input.value = '';
  };
  reader.readAsText(file);
}

function clearAll() {
  if (!events.length) { showToast('No hay eventos que limpiar', true); return; }
  if (!confirm(`¿Eliminar los ${events.length} evento(s) creados? Esta acción no se puede deshacer.`)) return;
  events = [];
  activeEventTab = 'all';
  activeEventTag = 'all';
  eventSearchQuery = '';
  const tagFilter = document.getElementById('eventTagFilter'); if(tagFilter) tagFilter.value = 'all';
  const searchInput = document.getElementById('eventSearchInput'); if(searchInput) searchInput.value = '';
  renderEventList();
  updateEventCount();
  document.getElementById('exportArea').style.display = 'none';
  showToast('Lista vaciada');
}

// ── EXPORT ──
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function exportJSON() {
  if (!events.length) { showToast('No hay eventos para exportar', true); return; }
  downloadJSON(events, 'events.json');
  showToast(`events.json descargado (${events.length} eventos) ✓`);
  const area = document.getElementById('exportArea');
  area.textContent = JSON.stringify(events, null, 2);
  area.style.display = 'block';
}

function copyJSON() {
  if (!events.length) { showToast('No hay eventos para copiar', true); return; }
  navigator.clipboard.writeText(JSON.stringify(events, null, 2)).then(() => {
    showToast('JSON copiado al portapapeles ✓');
  });
}


function openPreviewModal(){
  updatePreview();
  const modal = document.getElementById('previewModal');
  if(!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}
function closePreviewModal(){
  const modal = document.getElementById('previewModal');
  if(!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}
// ── UTILS ──
function updateEventCount() {
  document.getElementById('eventCount').textContent = events.length;
}

function showToast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (isErr ? ' err' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 2800);
}

// ── INIT ──
updateWeightHint(8);
setRepeatable(false);
renderEventTabs();
renderEventTagFilter();
const eventTagFilterEl = document.getElementById('eventTagFilter');
if(eventTagFilterEl){
  eventTagFilterEl.addEventListener('change', (e) => {
    activeEventTag = e.target.value || 'all';
    renderEventList();
  });
}
const eventSearchInputEl = document.getElementById('eventSearchInput');
if(eventSearchInputEl){
  eventSearchInputEl.addEventListener('input', (e) => {
    eventSearchQuery = String(e.target.value || '').trim();
    renderEventList();
  });
}
updatePersonalSurvivorUI();
populateBuildingSelects();
populateHostileSelect();
  loadItemsForEditor();
  loadSkillsForEditor();
safeUpdatePreview();

// Auto-load JSONs from /data/ on startup (works on Netlify/server)
async function autoLoadFromServer() {
  try {
    const res = await fetch('./data/events.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const incoming = await res.json();
    if (!Array.isArray(incoming)) throw new Error('events.json no contiene un array');
    let added = 0;
    incoming.forEach(ev => {
      if (!ev.id) return;
      if (!ev.name && ev.title) ev.name = ev.title;
      if (!ev.name) return;
      if (events.find(x => x.id === ev.id)) return;
      events.push(ev);
      added++;
    });
    if (added > 0) {
      clearDataWarning('events.json');
      renderEventList();
      updateEventCount();
      showToast(`${added} evento${added !== 1 ? 's' : ''} cargado${added !== 1 ? 's' : ''} desde /data/events.json ✓`);
    }
  } catch(e) {
    setDataWarning('events.json', e?.message || 'No se pudo cargar');
    showToast('No se han cargado los datos correctos: events.json. Revisa /data o abre el editor desde un servidor local.', true);
  }

  try {
    const resHostiles = await fetch('./data/hostiles.json');
    if (!resHostiles.ok) throw new Error(`HTTP ${resHostiles.status}`);
    const incomingHostiles = await resHostiles.json();
    if (Array.isArray(incomingHostiles)) {
      hostileDefs = incomingHostiles;
      clearDataWarning('hostiles.json');
    try{ updateAttackVariantOptions(); }catch(e){};
      populateHostileSelect();
      safeUpdatePreview();
    } else {
      throw new Error('hostiles.json no contiene un array');
    }
  } catch(e) {
    setDataWarning('hostiles.json', e?.message || 'No se pudo cargar');
    populateHostileSelect();
    safeUpdatePreview();
  }

  try {
    const resBuildings = await fetch('./data/buildings.json');
    if (!resBuildings.ok) throw new Error(`HTTP ${resBuildings.status}`);
    const incomingBuildings = await resBuildings.json();
    if (Array.isArray(incomingBuildings)) {
      buildingDefs = incomingBuildings;
      clearDataWarning('buildings.json');
      populateBuildingSelects();
      safeUpdatePreview();
    } else {
      throw new Error('buildings.json no contiene un array');
    }
  } catch(e) {
    setDataWarning('buildings.json', e?.message || 'No se pudo cargar');
    populateBuildingSelects();
    safeUpdatePreview();
  }

  try {
    const resThreats = await fetch('./data/threats.json');
    if (!resThreats.ok) throw new Error(`HTTP ${resThreats.status}`);
    const incomingThreats = await resThreats.json();
    const normalizedThreats = Array.isArray(incomingThreats)
      ? incomingThreats
      : (Array.isArray(incomingThreats?.threats) ? incomingThreats.threats : null);
    if (Array.isArray(normalizedThreats)) {
      threatDefs = normalizedThreats;
      clearDataWarning('threats.json');
      safeUpdatePreview();
    } else {
      throw new Error('threats.json no contiene un array ni un objeto con threats');
    }
  } catch(e) {
    setDataWarning('threats.json', e?.message || 'No se pudo cargar');
    safeUpdatePreview();
  }

  try {
    const resSurvivors = await fetch('./data/survivors.json');
    if (!resSurvivors.ok) throw new Error(`HTTP ${resSurvivors.status}`);
    const incomingSurvivors = await resSurvivors.json();
    if (Array.isArray(incomingSurvivors)) {
      survivorDefs = incomingSurvivors;
      clearDataWarning('survivors.json');
      populateSkillRequirementSelects();
      renderEventList();
      safeUpdatePreview();
    } else {
      throw new Error('survivors.json no contiene un array');
    }
  } catch(e) {
    setDataWarning('survivors.json', e?.message || 'No se pudo cargar');
    renderEventList();
    safeUpdatePreview();
  }

  safeUpdatePreview();
}

document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') closePreviewModal();
});
document.getElementById('previewModal')?.addEventListener('click', (e) => {
  if(e.target.id === 'previewModal') closePreviewModal();
});

autoLoadFromServer().catch(err => { console.error('autoLoadFromServer', err); showToast('Error al cargar datos automáticos', true); safeUpdatePreview(); });
