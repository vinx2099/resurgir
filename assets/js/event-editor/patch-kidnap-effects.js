(()=>{
 if(window.__resurgirEditorKidnapEffectsPatch) return;
 window.__resurgirEditorKidnapEffectsPatch = true;

 const KIDNAP_ENTRY = { group:'👥 Supervivientes', value:'kidnapSurvivor', label:'🪢 Secuestrar superviviente (desaparece hasta rescate)' };
 const RESCUE_ENTRY = { group:'👥 Supervivientes', value:'rescueKidnappedSurvivor', label:'🔓 Rescatar superviviente secuestrado' };

 function injectEffectType(entry, afterValue='awaySurvivor'){
  if(!Array.isArray(window.EFFECT_TYPES || EFFECT_TYPES)) return;
  const list = window.EFFECT_TYPES || EFFECT_TYPES;
  if(list.some(item => item && item.value === entry.value)) return;
  const idx = list.findIndex(item => item && item.value === afterValue);
  if(idx >= 0) list.splice(idx + 1, 0, entry);
  else list.push(entry);
 }
 injectEffectType(KIDNAP_ENTRY, 'awaySurvivor');
 injectEffectType(RESCUE_ENTRY, 'kidnapSurvivor');

 function buildKidnapPanel(row, type){
  if(row._kidnapPanel && row._kidnapPanel.parentElement) row._kidnapPanel.parentElement.removeChild(row._kidnapPanel);
  row._kidnapPanel = null;
  if(type !== 'kidnapSurvivor' && type !== 'rescueKidnappedSurvivor') return null;

  const panel = document.createElement('div');
  panel.className = 'kidnap-effect-panel';
  panel.style.cssText = 'grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;margin-top:6px;padding:10px;border:1px solid rgba(196,78,78,0.35);background:rgba(138,53,53,0.06);';
  const title = document.createElement('div');
  title.textContent = type === 'kidnapSurvivor' ? 'Configurar secuestro' : 'Configurar rescate';
  title.style.cssText = 'grid-column:1/-1;font-size:11px;font-weight:700;color:var(--danger-bright);letter-spacing:.04em;text-transform:uppercase;margin-bottom:2px;';
  panel.appendChild(title);

  function field(labelText, control){
   const wrap = document.createElement('div');
   wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;';
   const label = document.createElement('label');
   label.textContent = labelText;
   label.style.cssText = 'font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.04em;';
   wrap.appendChild(label);
   wrap.appendChild(control);
   panel.appendChild(wrap);
   control.addEventListener('input', safeUpdatePreview);
   control.addEventListener('change', safeUpdatePreview);
   return control;
  }

  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.className = 'kidnap-key-input';
  keyInput.value = 'default';
  field('Clave del secuestro', keyInput);

  if(type === 'kidnapSurvivor'){
   const reasonInput = document.createElement('input');
   reasonInput.type = 'text';
   reasonInput.className = 'kidnap-reason-input';
   reasonInput.placeholder = 'Ej: secuestro';
   field('Motivo / etiqueta', reasonInput);

   const logInput = document.createElement('input');
   logInput.type = 'text';
   logInput.className = 'kidnap-log-input';
   logInput.placeholder = 'Opcional · usa {name}';
   field('Texto de log', logInput);

   const note = document.createElement('div');
   note.style.cssText = 'grid-column:1/-1;font-size:10px;color:var(--muted);line-height:1.5;';
   note.textContent = 'El superviviente desaparece de la base y queda fuera de juego hasta que un efecto de rescate use la misma clave.';
   panel.appendChild(note);
  } else {
   const chanceInput = document.createElement('input');
   chanceInput.type = 'number';
   chanceInput.className = 'kidnap-return-chance';
   chanceInput.min = '0';
   chanceInput.max = '100';
   chanceInput.value = '35';
   field('% de volver herido', chanceInput);

   const levelSelect = document.createElement('select');
   levelSelect.className = 'kidnap-return-level';
   [['simple','Herida simple'],['seria','Herida seria'],['grave','Herida grave']].forEach(([value,labelText])=>{
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = labelText;
    levelSelect.appendChild(opt);
   });
   field('Nivel de herida', levelSelect);

   const textInput = document.createElement('input');
   textInput.type = 'text';
   textInput.className = 'kidnap-return-text';
   textInput.placeholder = 'Opcional · usa {name}';
   field('Texto de regreso', textInput);

   const note = document.createElement('div');
   note.style.cssText = 'grid-column:1/-1;font-size:10px;color:var(--muted);line-height:1.5;';
   note.textContent = 'Si la clave está vacía o no existe, el juego intentará rescatar al primer secuestrado pendiente.';
   panel.appendChild(note);
  }

  row.appendChild(panel);
  row._kidnapPanel = panel;
  return panel;
 }

 const oldUpdateEffectRowFields = window.updateEffectRowFields;
 window.updateEffectRowFields = function(row, type){
  const result = oldUpdateEffectRowFields.apply(this, arguments);
  if(type === 'kidnapSurvivor'){
   const p1 = row.querySelector('.effect-param1-select');
   const p2 = row.querySelector('.effect-param2-select');
   const amt = row.querySelector('.effect-amount-input');
   if(p1){
    p1.innerHTML = '';
    p1.style.display = '';
    getActorTargetOptions(false).concat([['__by_id__','Elegir por ID…']]).forEach(([value,label])=>{
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      p1.appendChild(opt);
    });
    p1.value = 'random';
   }
   if(p2) p2.style.display = 'none';
   if(amt) amt.style.display = 'none';
   if(typeof attachManualTargetIdPrompt === 'function') attachManualTargetIdPrompt(row);
   buildKidnapPanel(row, type);
  } else if(type === 'rescueKidnappedSurvivor'){
   const p1 = row.querySelector('.effect-param1-select');
   const p2 = row.querySelector('.effect-param2-select');
   const amt = row.querySelector('.effect-amount-input');
   if(p1) p1.style.display = 'none';
   if(p2) p2.style.display = 'none';
   if(amt) amt.style.display = 'none';
   buildKidnapPanel(row, type);
  } else if(row._kidnapPanel){
   row._kidnapPanel.remove();
   row._kidnapPanel = null;
  }
  return result;
 };

 const oldReadEffectRows = window.readEffectRows;
 window.readEffectRows = function(containerId){
  const effects = oldReadEffectRows.apply(this, arguments);
  const rows = document.getElementById(containerId)?.querySelectorAll('.effect-row') || [];
  rows.forEach((row, idx) => {
   const type = row.querySelector('.effect-type-select')?.value || '';
   const effect = effects[idx];
   if(!effect) return;
   if(type === 'kidnapSurvivor'){
    effect.type = 'kidnapSurvivor';
    const p1 = row.querySelector('.effect-param1-select');
    if(p1?.value === '__by_id__' && row.dataset.customTargetId) effect.targetId = row.dataset.customTargetId;
    else if(p1?.value === '__action__') effect.targetMode = 'action';
    else if(/^actor\d$/.test(p1?.value || '') || p1?.value === 'allActors') effect.targetMode = p1.value;
    const panel = row._kidnapPanel;
    const key = panel?.querySelector('.kidnap-key-input')?.value?.trim();
    const reason = panel?.querySelector('.kidnap-reason-input')?.value?.trim();
    const logText = panel?.querySelector('.kidnap-log-input')?.value?.trim();
    if(key) effect.kidnapKey = key;
    if(reason) effect.reason = reason;
    if(logText) effect.logText = logText;
   } else if(type === 'rescueKidnappedSurvivor'){
    effect.type = 'rescueKidnappedSurvivor';
    const panel = row._kidnapPanel;
    const key = panel?.querySelector('.kidnap-key-input')?.value?.trim();
    const chance = Number(panel?.querySelector('.kidnap-return-chance')?.value);
    const level = panel?.querySelector('.kidnap-return-level')?.value || 'simple';
    const returnText = panel?.querySelector('.kidnap-return-text')?.value?.trim();
    if(key) effect.kidnapKey = key;
    if(Number.isFinite(chance)) effect.returnInjuryChance = chance;
    if(level) effect.returnInjuryLevel = level;
    if(returnText) effect.returnText = returnText;
   }
  });
  return effects;
 };

 const oldEffectToString = window.effectToString;
 window.effectToString = function(e){
  if(e?.type === 'kidnapSurvivor') return `🪢 Secuestrar superviviente (${e.targetMode==='action'?'realiza la acción':(e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio'))}) · clave ${e.kidnapKey||'default'}`;
  if(e?.type === 'rescueKidnappedSurvivor') return `🔓 Rescatar secuestrado · clave ${e.kidnapKey||'default'} · ${e.returnInjuryChance ?? 0}%`;
  return oldEffectToString.apply(this, arguments);
 };

 const oldLoadEffectIntoRow = window.loadEffectIntoRow;
 window.loadEffectIntoRow = function(row, eff){
  if(eff?.type === 'kidnapSurvivor' || eff?.type === 'rescueKidnappedSurvivor'){
   const typeSelect = row.querySelector('.effect-type-select');
   typeSelect.value = eff.type;
   updateEffectRowFields(row, eff.type);
   if(eff.type === 'kidnapSurvivor'){
    const p1 = row.querySelector('.effect-param1-select');
    if(eff.targetId){
     row.dataset.customTargetId = eff.targetId;
     const byIdOpt = [...p1.options].find(o => o.value === '__by_id__');
     if(byIdOpt) byIdOpt.textContent = `Por ID: ${eff.targetId}`;
     p1.value = '__by_id__';
    } else if(eff.targetMode === 'action') p1.value = '__action__';
    else if(eff.targetMode && [...p1.options].some(o => o.value === eff.targetMode)) p1.value = eff.targetMode;
    else p1.value = 'random';
    const panel = row._kidnapPanel;
    if(panel){
     const keyInput = panel.querySelector('.kidnap-key-input');
     const reasonInput = panel.querySelector('.kidnap-reason-input');
     const logInput = panel.querySelector('.kidnap-log-input');
     if(keyInput) keyInput.value = eff.kidnapKey || 'default';
     if(reasonInput) reasonInput.value = eff.reason || '';
     if(logInput) logInput.value = eff.logText || '';
    }
   } else {
    const panel = row._kidnapPanel;
    if(panel){
     const keyInput = panel.querySelector('.kidnap-key-input');
     const chanceInput = panel.querySelector('.kidnap-return-chance');
     const levelSelect = panel.querySelector('.kidnap-return-level');
     const textInput = panel.querySelector('.kidnap-return-text');
     if(keyInput) keyInput.value = eff.kidnapKey || 'default';
     if(chanceInput) chanceInput.value = String(eff.returnInjuryChance ?? 35);
     if(levelSelect) levelSelect.value = eff.returnInjuryLevel || eff.injuryLevel || 'simple';
     if(textInput) textInput.value = eff.returnText || '';
    }
   }
   return;
  }
  return oldLoadEffectIntoRow.apply(this, arguments);
 };

 const oldAddEffectRow = window.addEffectRow;
 window.addEffectRow = function(){
  const result = oldAddEffectRow.apply(this, arguments);
  const targetArg = arguments[0];
  const idMap = {direct:'directEffectRows',optionA:'optionAEffectRows',optionB:'optionBEffectRows',optionC:'optionCEffectRows',optionD:'optionDEffectRows',attackVictory:'attackVictoryRows',attackDefeat:'attackDefeatRows',personalOptionA:'personalOptionAEffectRows',personalOptionB:'personalOptionBEffectRows',personalOptionC:'personalOptionCEffectRows'};
  const container = document.getElementById(idMap[targetArg] || targetArg);
  const row = container?.querySelector('.effect-row:last-child');
  const select = row?.querySelector('.effect-type-select');
  if(select){
   const ensureOption = (entry)=>{
    if([...select.options].some(o => o.value === entry.value)) return;
    const optgroup = document.createElement('optgroup');
    optgroup.label = entry.group;
    const opt = document.createElement('option');
    opt.value = entry.value;
    opt.textContent = entry.label;
    optgroup.appendChild(opt);
    select.appendChild(optgroup);
   };
   ensureOption(KIDNAP_ENTRY);
   ensureOption(RESCUE_ENTRY);
  }
  return result;
 };
})();

(function(){
 const NPC_DISCOVER_ENTRY = { group:'👥 NPC', value:'discoverNpc', label:'👤 Descubrir NPC' };
 const NPC_RECRUIT_ENTRY = { group:'👥 NPC', value:'recruitNpc', label:'🏠 Reclutar NPC' };
 const NPC_TRUST_ENTRY = { group:'👥 NPC', value:'modifyNpcTrust', label:'🤝 Confianza NPC (+/-)' };
 const NPC_STATE_ENTRY = { group:'👥 NPC', value:'setNpcState', label:'🎭 Cambiar estado NPC' };
 const NPC_ASSIGN_ENTRY = { group:'👥 NPC', value:'assignNpcToBuilding', label:'🏚 Asignar NPC a edificio' };

 window.npcDefs = Array.isArray(window.npcDefs) ? window.npcDefs : [];

 const ensureNpcEntries = ()=>{
  if(!Array.isArray(EFFECT_TYPES)) return;
  [NPC_DISCOVER_ENTRY, NPC_RECRUIT_ENTRY, NPC_TRUST_ENTRY, NPC_STATE_ENTRY, NPC_ASSIGN_ENTRY].forEach(entry=>{
   if(EFFECT_TYPES.some(item => item && item.value === entry.value)) return;
   EFFECT_TYPES.push(entry);
  });
 };

 const getNpcDefs = ()=>{
  const source = Array.isArray(window.npcDefs) ? window.npcDefs.filter(Boolean) : [];
  const unique = [];
  const seen = new Set();
  source.forEach(npc=>{
   const id = String(npc?.id || '').trim();
   if(!id || seen.has(id)) return;
   seen.add(id);
   unique.push(npc);
  });
  return unique.sort((a,b)=>String(a?.name || a?.id || '').localeCompare(String(b?.name || b?.id || ''), 'es'));
 };

 const getNpcLabel = (id)=>{
  const clean = String(id || '').trim();
  if(!clean) return '';
  const found = getNpcDefs().find(npc => String(npc.id || '').trim() === clean);
  return found?.name || clean;
 };

 const appendNpcOptions = (selectEl, options={})=>{
  if(!selectEl) return;
  const current = selectEl.value || '';
  const defs = getNpcDefs();
  const includeNone = options?.includeNone === true;
  selectEl.innerHTML = '';
  if(includeNone){
   const empty = document.createElement('option');
   empty.value = '';
   empty.textContent = options?.emptyLabel || '— Ninguno —';
   selectEl.appendChild(empty);
  }
  if(defs.length){
   defs.forEach(npc=>{
    const opt = document.createElement('option');
    opt.value = npc.id;
    const state = npc.state ? ` · ${npc.state}` : '';
    const type = npc.type ? ` · ${npc.type}` : '';
    opt.textContent = `${npc.name || npc.id}${type}${state}`;
    selectEl.appendChild(opt);
   });
  } else if(!includeNone){
   const empty = document.createElement('option');
   empty.value = '';
   empty.textContent = '— Sin NPCs cargados —';
   selectEl.appendChild(empty);
  }
  const manual = document.createElement('option');
  manual.value = '__manual_npc__';
  manual.textContent = selectEl.dataset.manualNpcLabel || '✍ ID manual…';
  selectEl.appendChild(manual);
  if([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
  else if(selectEl.dataset.manualNpcId) selectEl.value = '__manual_npc__';
  else if(includeNone) selectEl.value = '';
  else if(defs.length) selectEl.value = defs[0].id;
 };

 const attachNpcPrompt = (row, selectEl)=>{
  if(!selectEl || selectEl._npcPromptHook) return;
  selectEl.addEventListener('change', ()=>{
   if(selectEl.value !== '__manual_npc__') return;
   const previous = row.dataset.customNpcId || '';
   const entered = window.prompt('ID del NPC:', previous);
   const clean = String(entered || '').trim();
   if(clean){
    row.dataset.customNpcId = clean;
    selectEl.dataset.manualNpcId = clean;
    selectEl.dataset.manualNpcLabel = `✍ ${clean}`;
    const manualOpt = [...selectEl.options].find(o => o.value === '__manual_npc__');
    if(manualOpt) manualOpt.textContent = `✍ ${clean}`;
    selectEl.value = '__manual_npc__';
   } else if(previous){
    selectEl.value = '__manual_npc__';
   } else {
    const firstReal = [...selectEl.options].find(o => o.value && o.value !== '__manual_npc__');
    selectEl.value = firstReal ? firstReal.value : '';
   }
   if(typeof safeUpdatePreview === 'function') safeUpdatePreview();
  });
  selectEl._npcPromptHook = true;
 };

 const oldUpdateEffectRowFields = window.updateEffectRowFields;
 window.updateEffectRowFields = function(row, type){
  const result = oldUpdateEffectRowFields.apply(this, arguments);
  const p1 = row.querySelector('.effect-param1-select');
  const p2 = row.querySelector('.effect-param2-select');
  const amt = row.querySelector('.effect-amount-input');
  if(['discoverNpc','recruitNpc','modifyNpcTrust','setNpcState','assignNpcToBuilding'].includes(type)){
   if(p1){
    p1.style.display = '';
    appendNpcOptions(p1, { includeNone:false });
    attachNpcPrompt(row, p1);
   }
   if(p2){ p2.innerHTML = ''; p2.style.display = 'none'; }
   if(amt){ amt.style.display = 'none'; }
  }
  if(type === 'modifyNpcTrust'){
   if(amt){
    amt.style.display = '';
    amt.placeholder = 'Confianza +/-';
    amt.value = 1;
    amt.min = -10;
    amt.max = 10;
   }
  } else if(type === 'setNpcState'){
   if(p2){
    p2.style.display = '';
    [
     ['known','Conocido'],
     ['available','Disponible'],
     ['recruited','Reclutado'],
     ['gone','Se ha ido'],
     ['hostile','Hostil']
    ].forEach(([value,label])=>{
     const opt = document.createElement('option');
     opt.value = value;
     opt.textContent = label;
     p2.appendChild(opt);
    });
   }
  } else if(type === 'assignNpcToBuilding'){
   if(p2){
    p2.style.display = '';
    appendBuildingOptions(p2);
   }
  }
  return result;
 };

 const oldReadEffectRows = window.readEffectRows;
 window.readEffectRows = function(containerId){
  const effects = oldReadEffectRows.apply(this, arguments);
  const rows = document.getElementById(containerId)?.querySelectorAll('.effect-row') || [];
  rows.forEach((row, idx)=>{
   const type = row.querySelector('.effect-type-select')?.value || '';
   const effect = effects[idx];
   if(!effect) return;
   if(['discoverNpc','recruitNpc','modifyNpcTrust','setNpcState','assignNpcToBuilding'].includes(type)){
    effect.type = type;
    const p1 = row.querySelector('.effect-param1-select');
    const p2 = row.querySelector('.effect-param2-select');
    const amt = row.querySelector('.effect-amount-input');
    const npcId = p1?.value === '__manual_npc__' ? (row.dataset.customNpcId || '') : (p1?.value || '');
    if(npcId) effect.npcId = npcId;
    if(type === 'modifyNpcTrust'){
      const signed = Number(amt?.value);
      effect.amount = Number.isFinite(signed) && signed !== 0 ? signed : 1;
    }
    if(type === 'setNpcState'){
      effect.state = p2?.value || 'available';
    }
    if(type === 'assignNpcToBuilding'){
      effect.buildingId = p2?.value || '';
    }
   }
  });
  return effects;
 };

 const oldEffectToString = window.effectToString;
 window.effectToString = function(e){
  if(e?.type === 'discoverNpc') return `👤 Descubrir NPC: ${getNpcLabel(e.npcId||'') || e.npcId || '?'}`;
  if(e?.type === 'recruitNpc') return `🏠 Reclutar NPC: ${getNpcLabel(e.npcId||'') || e.npcId || '?'}`;
  if(e?.type === 'modifyNpcTrust') return `🤝 Confianza NPC ${Number(e.amount||0) >= 0 ? '+' : ''}${Number(e.amount||0)} · ${getNpcLabel(e.npcId||'') || e.npcId || '?'}`;
  if(e?.type === 'setNpcState') return `🎭 Estado NPC → ${e.state || 'available'} · ${getNpcLabel(e.npcId||'') || e.npcId || '?'}`;
  if(e?.type === 'assignNpcToBuilding') return `🏚 Asignar ${getNpcLabel(e.npcId||'') || e.npcId || '?'} a ${typeof getBuildingLabel === 'function' ? getBuildingLabel(e.buildingId||'') : (e.buildingId||'?')}`;
  return oldEffectToString.apply(this, arguments);
 };

 const oldLoadEffectIntoRow = window.loadEffectIntoRow;
 window.loadEffectIntoRow = function(row, eff){
  if(['discoverNpc','recruitNpc','modifyNpcTrust','setNpcState','assignNpcToBuilding'].includes(eff?.type)){
   const typeSelect = row.querySelector('.effect-type-select');
   if(typeSelect) typeSelect.value = eff.type;
   updateEffectRowFields(row, eff.type);
   const p1 = row.querySelector('.effect-param1-select');
   const p2 = row.querySelector('.effect-param2-select');
   const amt = row.querySelector('.effect-amount-input');
   const npcId = String(eff.npcId || '').trim();
   if(p1){
    if(npcId && [...p1.options].some(o => o.value === npcId)) p1.value = npcId;
    else if(npcId){
      row.dataset.customNpcId = npcId;
      p1.dataset.manualNpcId = npcId;
      p1.dataset.manualNpcLabel = `✍ ${npcId}`;
      const manualOpt = [...p1.options].find(o => o.value === '__manual_npc__');
      if(manualOpt) manualOpt.textContent = `✍ ${npcId}`;
      p1.value = '__manual_npc__';
    }
   }
   if(eff.type === 'modifyNpcTrust' && amt) amt.value = Number.isFinite(Number(eff.amount)) ? Number(eff.amount) : 1;
   if(eff.type === 'setNpcState' && p2) p2.value = eff.state || 'available';
   if(eff.type === 'assignNpcToBuilding' && p2 && eff.buildingId) p2.value = eff.buildingId;
   return;
  }
  return oldLoadEffectIntoRow.apply(this, arguments);
 };

 const oldAddEffectRow = window.addEffectRow;
 window.addEffectRow = function(){
  const result = oldAddEffectRow.apply(this, arguments);
  const targetArg = arguments[0];
  const idMap = {direct:'directEffectRows',optionA:'optionAEffectRows',optionB:'optionBEffectRows',optionC:'optionCEffectRows',optionD:'optionDEffectRows',attackVictory:'attackVictoryRows',attackDefeat:'attackDefeatRows',personalOptionA:'personalOptionAEffectRows',personalOptionB:'personalOptionBEffectRows',personalOptionC:'personalOptionCEffectRows'};
  const container = document.getElementById(idMap[targetArg] || targetArg);
  const row = container?.querySelector('.effect-row:last-child');
  const select = row?.querySelector('.effect-type-select');
  if(select){
   const ensureOption = (entry)=>{
    if([...select.options].some(o => o.value === entry.value)) return;
    let optgroup = [...select.children].find(child => child.tagName === 'OPTGROUP' && child.label === entry.group);
    if(!optgroup){
      optgroup = document.createElement('optgroup');
      optgroup.label = entry.group;
      select.appendChild(optgroup);
    }
    const opt = document.createElement('option');
    opt.value = entry.value;
    opt.textContent = entry.label;
    optgroup.appendChild(opt);
   };
   [NPC_DISCOVER_ENTRY, NPC_RECRUIT_ENTRY, NPC_TRUST_ENTRY, NPC_STATE_ENTRY, NPC_ASSIGN_ENTRY].forEach(ensureOption);
  }
  return result;
 };

 const originalAutoLoadFromServer = window.autoLoadFromServer;
 window.autoLoadFromServer = async function(){
  if(typeof originalAutoLoadFromServer === 'function'){
   await originalAutoLoadFromServer.apply(this, arguments);
  }
  try{
   const resNpc = await fetch('./data/npcs.json', {cache:'no-store'});
   if(!resNpc.ok){
    if(resNpc.status === 404) return;
    throw new Error(`HTTP ${resNpc.status}`);
   }
   const incomingNpc = await resNpc.json();
   if(Array.isArray(incomingNpc)){
    window.npcDefs = incomingNpc;
    if(typeof clearDataWarning === 'function') clearDataWarning('npcs.json');
    if(typeof safeUpdatePreview === 'function') safeUpdatePreview();
   } else {
    throw new Error('npcs.json no contiene un array');
   }
  } catch(e){
   if(typeof setDataWarning === 'function') setDataWarning('npcs.json', e?.message || 'No se pudo cargar');
  }
 };

 ensureNpcEntries();

 const loadNpcDefsNow = async()=>{
  try{
   const resNpc = await fetch('./data/npcs.json', {cache:'no-store'});
   if(!resNpc.ok){
    if(resNpc.status === 404) return;
    throw new Error(`HTTP ${resNpc.status}`);
   }
   const incomingNpc = await resNpc.json();
   if(Array.isArray(incomingNpc)){
    window.npcDefs = incomingNpc;
    if(typeof clearDataWarning === 'function') clearDataWarning('npcs.json');
    if(typeof safeUpdatePreview === 'function') safeUpdatePreview();
   }
  } catch(err){
   if(typeof setDataWarning === 'function') setDataWarning('npcs.json', err?.message || 'No se pudo cargar');
  }
 };
 loadNpcDefsNow();

 document.querySelectorAll('.effect-row .effect-type-select').forEach(select=>{
  const ensureOption = (entry)=>{
   if([...select.options].some(o => o.value === entry.value)) return;
   let optgroup = [...select.children].find(child => child.tagName === 'OPTGROUP' && child.label === entry.group);
   if(!optgroup){
    optgroup = document.createElement('optgroup');
    optgroup.label = entry.group;
    select.appendChild(optgroup);
   }
   const opt = document.createElement('option');
   opt.value = entry.value;
   opt.textContent = entry.label;
   optgroup.appendChild(opt);
  };
  [NPC_DISCOVER_ENTRY, NPC_RECRUIT_ENTRY, NPC_TRUST_ENTRY, NPC_STATE_ENTRY, NPC_ASSIGN_ENTRY].forEach(ensureOption);
 });
})();
