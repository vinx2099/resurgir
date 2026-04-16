(()=>{
  if(window.__resurgirEditorZoneDiscoveryPatch) return;
  window.__resurgirEditorZoneDiscoveryPatch = true;

  const ENTRY = { group:'Exterior', value:'discoverZone', label:'Descubrir zona' };
  if(Array.isArray(EFFECT_TYPES) && !EFFECT_TYPES.some(item => item && item.value === ENTRY.value)){
    const idx = EFFECT_TYPES.findIndex(item => item && item.value === 'activateQuest');
    if(idx >= 0) EFFECT_TYPES.splice(idx + 1, 0, ENTRY);
    else EFFECT_TYPES.push(ENTRY);
  }

  window.zoneDefs = Array.isArray(window.zoneDefs) ? window.zoneDefs : [];
  fetch('./data/zones.json')
    .then(res => res.ok ? res.json() : [])
    .then(data => {
      if(Array.isArray(data)) window.zoneDefs = data.filter(zone => zone && zone.id);
      refreshOpenZoneRows();
    })
    .catch(()=>{});

  function getZoneDefs(){
    const unique = [];
    const seen = new Set();
    (Array.isArray(window.zoneDefs) ? window.zoneDefs : []).forEach(zone => {
      const id = String(zone?.id || '').trim();
      if(!id || seen.has(id)) return;
      seen.add(id);
      unique.push(zone);
    });
    return unique.sort((a,b)=>String(a?.name || a?.id || '').localeCompare(String(b?.name || b?.id || ''), 'es'));
  }

  function getZoneLabel(id){
    const clean = String(id || '').trim();
    if(!clean) return '';
    const found = getZoneDefs().find(zone => String(zone.id || '').trim() === clean);
    return found?.name || clean;
  }

  function appendZoneOptions(select){
    if(!select) return;
    const current = select.value || '';
    const zones = getZoneDefs();
    select.innerHTML = '';
    zones.forEach(zone => {
      const opt = document.createElement('option');
      opt.value = zone.id;
      opt.textContent = zone.name || zone.id;
      select.appendChild(opt);
    });
    if(!zones.length){
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '-- Sin zonas cargadas --';
      select.appendChild(empty);
    }
    const manual = document.createElement('option');
    manual.value = '__manual_zone__';
    manual.textContent = select.dataset.manualZoneLabel || 'ID manual...';
    select.appendChild(manual);
    if([...select.options].some(opt => opt.value === current)) select.value = current;
    else if(select.dataset.manualZoneId) select.value = '__manual_zone__';
    else if(zones.length) select.value = zones[0].id;
  }

  function attachZonePrompt(row, select){
    if(!select || select._zonePromptHook) return;
    select.addEventListener('change', ()=>{
      if(select.value !== '__manual_zone__') return;
      const previous = row.dataset.customZoneId || '';
      const entered = window.prompt('ID de la zona:', previous);
      const clean = String(entered || '').trim();
      if(clean){
        row.dataset.customZoneId = clean;
        select.dataset.manualZoneId = clean;
        select.dataset.manualZoneLabel = `ID: ${clean}`;
        const manualOpt = [...select.options].find(opt => opt.value === '__manual_zone__');
        if(manualOpt) manualOpt.textContent = `ID: ${clean}`;
        select.value = '__manual_zone__';
      } else if(previous){
        select.value = '__manual_zone__';
      } else {
        const firstReal = [...select.options].find(opt => opt.value && opt.value !== '__manual_zone__');
        select.value = firstReal ? firstReal.value : '';
      }
      if(typeof safeUpdatePreview === 'function') safeUpdatePreview();
    });
    select._zonePromptHook = true;
  }

  function refreshOpenZoneRows(){
    document.querySelectorAll('.effect-row').forEach(row => {
      const type = row.querySelector('.effect-type-select')?.value || '';
      if(type !== 'discoverZone') return;
      const p1 = row.querySelector('.effect-param1-select');
      if(!p1) return;
      const currentManualId = row.dataset.customZoneId || '';
      const current = p1?.value || '';
      appendZoneOptions(p1);
      if(currentManualId){
        p1.dataset.manualZoneId = currentManualId;
        p1.dataset.manualZoneLabel = `ID: ${currentManualId}`;
        const manualOpt = [...p1.options].find(opt => opt.value === '__manual_zone__');
        if(manualOpt) manualOpt.textContent = `ID: ${currentManualId}`;
        p1.value = '__manual_zone__';
      } else if([...p1.options].some(opt => opt.value === current)){
        p1.value = current;
      }
    });
  }

  function resolveRowsContainer(target){
    if(target && typeof target.querySelectorAll === 'function') return target;
    if(typeof resolveEffectRowsContainer === 'function') return resolveEffectRowsContainer(target);
    return document.getElementById(target);
  }

  const oldUpdateEffectRowFields = window.updateEffectRowFields || updateEffectRowFields;
  window.updateEffectRowFields = function(row, type){
    const result = oldUpdateEffectRowFields.apply(this, arguments);
    if(type === 'discoverZone'){
      const p1 = row.querySelector('.effect-param1-select');
      const p2 = row.querySelector('.effect-param2-select');
      const amt = row.querySelector('.effect-amount-input');
      if(p1){
        p1.style.display = '';
        appendZoneOptions(p1);
        attachZonePrompt(row, p1);
      }
      if(p2){ p2.innerHTML = ''; p2.style.display = 'none'; }
      if(amt){ amt.style.display = 'none'; }
    }
    return result;
  };

  const oldReadEffectRows = window.readEffectRows || readEffectRows;
  window.readEffectRows = function(containerId){
    const effects = oldReadEffectRows.apply(this, arguments) || [];
    const container = resolveRowsContainer(containerId);
    const rows = container?.querySelectorAll('.effect-row') || [];
    rows.forEach((row, idx)=>{
      const type = row.querySelector('.effect-type-select')?.value || '';
      if(type !== 'discoverZone' || !effects[idx]) return;
      const p1 = row.querySelector('.effect-param1-select');
      const zoneId = p1?.value === '__manual_zone__' ? (row.dataset.customZoneId || '') : (p1?.value || '');
      effects[idx].type = 'discoverZone';
      effects[idx].zoneId = zoneId;
    });
    return effects;
  };

  const oldEffectToString = window.effectToString || effectToString;
  window.effectToString = function(effect){
    if(effect?.type === 'discoverZone') return `Descubrir zona: ${getZoneLabel(effect.zoneId || effect.id || '') || '?'}`;
    return oldEffectToString.apply(this, arguments);
  };

  const oldLoadEffectIntoRow = window.loadEffectIntoRow || loadEffectIntoRow;
  window.loadEffectIntoRow = function(row, effect){
    if(effect?.type === 'discoverZone'){
      const typeSelect = row.querySelector('.effect-type-select');
      if(typeSelect) typeSelect.value = 'discoverZone';
      window.updateEffectRowFields(row, 'discoverZone');
      const p1 = row.querySelector('.effect-param1-select');
      const zoneId = String(effect.zoneId || effect.id || '').trim();
      if(p1){
        if(zoneId && [...p1.options].some(opt => opt.value === zoneId)){
          p1.value = zoneId;
        } else if(zoneId){
          row.dataset.customZoneId = zoneId;
          p1.dataset.manualZoneId = zoneId;
          p1.dataset.manualZoneLabel = `ID: ${zoneId}`;
          const manualOpt = [...p1.options].find(opt => opt.value === '__manual_zone__');
          if(manualOpt) manualOpt.textContent = `ID: ${zoneId}`;
          p1.value = '__manual_zone__';
        }
      }
      return;
    }
    return oldLoadEffectIntoRow.apply(this, arguments);
  };
})();
