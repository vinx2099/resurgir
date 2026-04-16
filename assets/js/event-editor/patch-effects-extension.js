(()=>{
  if(window.__resurgirEditorEffectsExtensionPatch) return;
  window.__resurgirEditorEffectsExtensionPatch = true;

  const EXTRA_EFFECTS = [
    { after:'disableBuilding', entry:{ group:'🏚 Base y construcciones', value:'enableBuilding', label:'🛠 Habilitar edificio' } },
    { after:'disableSurvivor', entry:{ group:'👥 Supervivientes', value:'enableSurvivor', label:'✅ Habilitar superviviente (aleatorio / por ID / realiza la acción)' } },
    { after:'createThreat', entry:{ group:'⚔ Riesgo y restricciones', value:'cancelThreat', label:'🧹 Cancelar amenaza persistente' } },
    { after:'cancelThreat', entry:{ group:'⚔ Riesgo y restricciones', value:'modifyThreatSeverity', label:'📈 Modificar severidad de amenaza (+/-)' } },
    { after:'activateQuest', entry:{ group:'🎭 Narrativa', value:'completeQuest', label:'✅ Completar quest' } },
    { after:'completeQuest', entry:{ group:'🎭 Narrativa', value:'failQuest', label:'❌ Fallar quest' } },
    { after:'limitAction', entry:{ group:'⚔ Riesgo y restricciones', value:'bonusAction', label:'🟢 Bonificar acción (Forrajear/Reciclar) (plano durante X días)' } },
    { after:'bonusAction', entry:{ group:'⚔ Riesgo y restricciones', value:'penaltyAction', label:'🔴 Penalizar acción (Forrajear/Reciclar) (plano durante X días)' } }
  ];

  function insertEffectOption(afterValue, entry){
    if(!Array.isArray(EFFECT_TYPES) || EFFECT_TYPES.some(t => t.value === entry.value)) return;
    const idx = EFFECT_TYPES.findIndex(t => t.value === afterValue);
    if(idx >= 0) EFFECT_TYPES.splice(idx + 1, 0, entry);
    else EFFECT_TYPES.push(entry);
  }
  EXTRA_EFFECTS.forEach(item => insertEffectOption(item.after, item.entry));

  const ACTION_OPTIONS = [
    ['forraje', 'Forrajear'],
    ['reciclar', 'Reciclar']
  ];

  function ensureAllTypeSelectsHaveExtras(){
    document.querySelectorAll('.effect-type-select').forEach(select => {
      EXTRA_EFFECTS.forEach(({entry}) => {
        if([...select.options].some(o => o.value === entry.value)) return;
        let group = [...select.querySelectorAll('optgroup')].find(g => g.label === entry.group);
        if(!group){
          group = document.createElement('optgroup');
          group.label = entry.group;
          select.appendChild(group);
        }
        const opt = document.createElement('option');
        opt.value = entry.value;
        opt.textContent = entry.label;
        group.appendChild(opt);
      });
    });
  }

  function fillSurvivorTargetSelect(select){
    if(!select) return;
    select.innerHTML = '';
    getActorTargetOptions(false).concat([['__by_id__','Elegir por ID…']]).forEach(([value,label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    });
    select.value = 'random';
  }

  function fillActionSelect(select){
    if(!select) return;
    select.innerHTML = '';
    ACTION_OPTIONS.forEach(([value,label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    });
    select.value = 'forraje';
  }

  function ensureManualEventPrompt(row){
    const p1 = row.querySelector('.effect-param1-select');
    if(!p1 || p1._hasManualEventPrompt) return;
    p1.addEventListener('change', () => {
      const type = row.querySelector('.effect-type-select')?.value;
      if(!['completeQuest','failQuest'].includes(type)) return;
      if(p1.value !== '__manual_event__') return;
      const previous = row.dataset.manualEventId || '';
      const entered = window.prompt('ID de la quest:', previous);
      const clean = String(entered || '').trim();
      const manualOpt = [...p1.options].find(o => o.value === '__manual_event__');
      if(clean){
        row.dataset.manualEventId = clean;
        if(manualOpt) manualOpt.textContent = `✍ ${clean}`;
        p1.value = '__manual_event__';
      } else if(previous) {
        p1.value = '__manual_event__';
      } else if (p1.options.length) {
        p1.value = p1.options[0].value;
      }
      safeUpdatePreview();
    });
    p1._hasManualEventPrompt = true;
  }

  function removeAwayPanel(row){
    row.querySelector('.away-survivor-panel')?.remove();
  }

  function ensureAwayPanel(row){
    let panel = row.querySelector('.away-survivor-panel');
    if(panel) return panel;
    panel = document.createElement('div');
    panel.className = 'away-survivor-panel';
    panel.style.cssText = 'grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:8px;margin-top:6px;';

    const daysWrap = document.createElement('div');
    daysWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    const daysLabel = document.createElement('label');
    daysLabel.textContent = 'Días fuera';
    const daysInput = document.createElement('input');
    daysInput.type = 'number';
    daysInput.min = '1';
    daysInput.max = '999';
    daysInput.value = row.dataset.awayDays || '3';
    daysInput.className = 'away-survivor-days';
    daysWrap.append(daysLabel, daysInput);

    const chanceWrap = document.createElement('div');
    chanceWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    const chanceLabel = document.createElement('label');
    chanceLabel.textContent = '% de volver herido';
    const chanceInput = document.createElement('input');
    chanceInput.type = 'number';
    chanceInput.min = '0';
    chanceInput.max = '100';
    chanceInput.value = row.dataset.awayChance || '35';
    chanceInput.className = 'away-survivor-chance';
    chanceWrap.append(chanceLabel, chanceInput);

    [daysInput, chanceInput].forEach(el => {
      el.addEventListener('input', () => {
        row.dataset.awayDays = daysInput.value || '3';
        row.dataset.awayChance = chanceInput.value || '35';
        safeUpdatePreview();
      });
    });

    panel.append(daysWrap, chanceWrap);
    row.appendChild(panel);
    return panel;
  }

  function removeActionModifierPanel(row){
    row.querySelector('.action-modifier-panel')?.remove();
  }

  function ensureActionModifierPanel(row){
    let panel = row.querySelector('.action-modifier-panel');
    if(panel) return panel;
    panel = document.createElement('div');
    panel.className = 'action-modifier-panel';
    panel.style.cssText = 'grid-column:1/-1;display:grid;grid-template-columns:minmax(160px,1.2fr) repeat(2,minmax(110px,0.8fr));gap:8px;margin-top:6px;';

    const actionWrap = document.createElement('div');
    actionWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    const actionLabel = document.createElement('label');
    actionLabel.textContent = 'Acción';
    const actionSelect = document.createElement('select');
    actionSelect.className = 'action-modifier-target';
    fillActionSelect(actionSelect);
    actionWrap.append(actionLabel, actionSelect);

    const percentWrap = document.createElement('div');
    percentWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    const percentLabel = document.createElement('label');
    percentLabel.textContent = 'Modificador plano';
    const percentInput = document.createElement('input');
    percentInput.type = 'number';
    percentInput.min = '-999';
    percentInput.max = '999';
    percentInput.value = row.dataset.actionModifierFlat || '0';
    percentInput.className = 'action-modifier-flat';
    percentWrap.append(percentLabel, percentInput);

    const daysWrap = document.createElement('div');
    daysWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    const daysLabel = document.createElement('label');
    daysLabel.textContent = 'Duración (días)';
    const daysInput = document.createElement('input');
    daysInput.type = 'number';
    daysInput.min = '1';
    daysInput.max = '999';
    daysInput.value = row.dataset.actionModifierDays || '1';
    daysInput.className = 'action-modifier-days';
    daysWrap.append(daysLabel, daysInput);

    actionSelect.addEventListener('change', () => {
      safeUpdatePreview();
    });
    [percentInput, daysInput].forEach(el => el.addEventListener('input', () => {
      row.dataset.actionModifierFlat = percentInput.value || '0';
      row.dataset.actionModifierDays = daysInput.value || '1';
      safeUpdatePreview();
    }));

    panel.append(actionWrap, percentWrap, daysWrap);
    row.appendChild(panel);
    return panel;
  }

  function ensureQuestTimingEnhancement(row){
    const panel = ensureActivateEventPanel(row);
    if(panel._timingEnhanced) return panel;

    const targetWrap = panel.querySelector('.activate-event-target')?.parentElement;
    const minWrap = panel.querySelector('.activate-event-min')?.parentElement;
    const maxWrap = panel.querySelector('.activate-event-max')?.parentElement;
    if(!targetWrap || !minWrap || !maxWrap) return panel;

    const timingWrap = document.createElement('div');
    timingWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;';
    const timingLabel = document.createElement('label');
    timingLabel.textContent = 'Momento de activación';
    timingLabel.style.cssText = 'font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.04em;';
    const timingSelect = document.createElement('select');
    timingSelect.className = 'activate-event-timing';
    [
      ['range','Dentro de un rango'],
      ['next_day','Al día siguiente'],
      ['immediate','Inmediato']
    ].forEach(([value,label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      timingSelect.appendChild(opt);
    });
    timingWrap.append(timingLabel, timingSelect);
    panel.insertBefore(timingWrap, minWrap);

    const syncTimingUI = () => {
      const mode = timingSelect.value || 'range';
      const minInput = panel.querySelector('.activate-event-min');
      const maxInput = panel.querySelector('.activate-event-max');
      minWrap.style.display = mode === 'range' ? '' : 'none';
      maxWrap.style.display = mode === 'range' ? '' : 'none';
      if(mode === 'immediate'){
        minInput.value = '0';
        maxInput.value = '0';
      } else if(mode === 'next_day'){
        minInput.value = '1';
        maxInput.value = '1';
      }
    };

    timingSelect.addEventListener('change', () => {
      syncTimingUI();
      safeUpdatePreview();
    });
    timingSelect.addEventListener('input', updatePreview);
    syncTimingUI();
    panel._timingEnhanced = true;
    panel._syncTimingUI = syncTimingUI;
    return panel;
  }

  function getTimingModeFromEffect(effect){
    if(effect?.timing === 'immediate' || effect?.timing === 'next_day' || effect?.timing === 'range') return effect.timing;
    const min = Number(effect?.minDays ?? 0);
    const max = Number(effect?.maxDays ?? min);
    if(min === 0 && max === 0) return 'immediate';
    if(min === 1 && max === 1) return 'next_day';
    return 'range';
  }

  const oldUpdateEffectRowFields = window.updateEffectRowFields;
  window.updateEffectRowFields = function(row, type){
    removeAwayPanel(row);
    removeActionModifierPanel(row);
    const result = oldUpdateEffectRowFields.apply(this, arguments);
    const p1 = row.querySelector('.effect-param1-select');
    const p2 = row.querySelector('.effect-param2-select');
    const amt = row.querySelector('.effect-amount-input');

    if(type === 'awaySurvivor'){
      if(p1) fillSurvivorTargetSelect(p1);
      if(p2) { p2.style.display = 'none'; p2.innerHTML = ''; }
      if(amt) { amt.style.display = 'none'; amt.value = row.dataset.awayDays || '3'; }
      ensureAwayPanel(row);
      attachManualTargetIdPrompt(row);
    } else if (type === 'enableSurvivor') {
      if(p1){ p1.style.display = ''; fillSurvivorTargetSelect(p1); }
      if(p2){ p2.style.display = 'none'; p2.innerHTML = ''; }
      if(amt){ amt.style.display = 'none'; }
      attachManualTargetIdPrompt(row);
    } else if (type === 'enableBuilding') {
      if(p1){ p1.style.display = ''; appendBuildingOptions(p1); }
      if(p2){ p2.style.display = 'none'; p2.innerHTML = ''; }
      if(amt){ amt.style.display = 'none'; }
    } else if (type === 'cancelThreat') {
      if(p1){ p1.style.display = ''; appendThreatOptions(p1); }
      if(p2){ p2.style.display = 'none'; p2.innerHTML = ''; }
      if(amt){ amt.style.display = 'none'; }
      attachManualTargetIdPrompt(row);
    } else if (type === 'modifyThreatSeverity') {
      if(p1){ p1.style.display = ''; appendThreatOptions(p1); }
      if(p2){ p2.style.display = 'none'; p2.innerHTML = ''; }
      if(amt){
        amt.style.display = '';
        amt.placeholder = 'Severidad +/-';
        amt.min = -10;
        amt.max = 10;
        amt.value = row.dataset.modifyThreatAmount || '1';
      }
      attachManualTargetIdPrompt(row);
    } else if (type === 'completeQuest' || type === 'failQuest') {
      if(p1){ p1.style.display = ''; appendEventOptions(p1, { onlyType:'quest', emptyLabel:'— Sin quests cargadas —' }); }
      if(p2){ p2.style.display = 'none'; p2.innerHTML = ''; }
      if(amt){ amt.style.display = 'none'; }
      ensureManualEventPrompt(row);
    } else if (type === 'bonusAction' || type === 'penaltyAction') {
      if(p1){ p1.style.display = 'none'; p1.innerHTML = ''; }
      if(p2){ p2.style.display = 'none'; p2.innerHTML = ''; }
      if(amt){ amt.style.display = 'none'; }
      ensureActionModifierPanel(row);
    } else if (type === 'activateQuest' || type === 'activateEvent') {
      ensureQuestTimingEnhancement(row);
    }

    ensureAllTypeSelectsHaveExtras();
    return result;
  };

  const oldReadEffectRows = window.readEffectRows;
  window.readEffectRows = function(containerId){
    const effects = oldReadEffectRows.apply(this, arguments) || [];
    const rows = document.getElementById(containerId)?.querySelectorAll('.effect-row') || [];
    effects.forEach((effect, idx) => {
      const row = rows[idx];
      if(!row || !effect) return;
      const type = row.querySelector('.effect-type-select')?.value;
      const p1 = row.querySelector('.effect-param1-select');
      const amt = row.querySelector('.effect-amount-input');

      if(type === 'awaySurvivor'){
        const panel = row.querySelector('.away-survivor-panel');
        if(panel){
          effect.days = Number(panel.querySelector('.away-survivor-days')?.value) || 3;
          effect.returnInjuryChance = Number(panel.querySelector('.away-survivor-chance')?.value) || 0;
        }
      } else if(type === 'enableSurvivor'){
        effect.type = 'enableSurvivor';
        if (p1?.value === '__by_id__' && row.dataset.customTargetId) effect.targetId = row.dataset.customTargetId;
        else if (p1?.value === '__action__') effect.targetMode = 'action';
        else if (/^actor\d$/.test(p1?.value || '') || p1?.value === 'allActors') effect.targetMode = p1.value;
      } else if(type === 'enableBuilding'){
        effect.type = 'enableBuilding';
        effect.building = p1?.value || '';
      } else if(type === 'cancelThreat'){
        effect.type = 'cancelThreat';
        effect.threatId = p1?.value === '__manual_threat__' ? (row.dataset.customThreatId || '') : (p1?.value || '');
      } else if(type === 'modifyThreatSeverity'){
        effect.type = 'modifyThreatSeverity';
        effect.threatId = p1?.value === '__manual_threat__' ? (row.dataset.customThreatId || '') : (p1?.value || '');
        effect.amount = Number(amt?.value);
        if(!Number.isFinite(effect.amount) || effect.amount === 0) effect.amount = 1;
      } else if(type === 'completeQuest' || type === 'failQuest'){
        effect.type = type;
        effect.questId = p1?.value === '__manual_event__' ? (row.dataset.manualEventId || '') : (p1?.value || '');
      } else if(type === 'bonusAction' || type === 'penaltyAction'){
        const panel = row.querySelector('.action-modifier-panel');
        effect.type = type;
        effect.action = panel?.querySelector('.action-modifier-target')?.value || 'forraje';
        effect.flat = Number(panel?.querySelector('.action-modifier-flat')?.value) || 0;
        effect.days = Number(panel?.querySelector('.action-modifier-days')?.value) || 1;
      } else if(type === 'activateQuest' || type === 'activateEvent'){
        const panel = ensureQuestTimingEnhancement(row);
        const timing = panel.querySelector('.activate-event-timing')?.value || 'range';
        effect.timing = timing;
        if(timing === 'immediate'){
          effect.minDays = 0;
          effect.maxDays = 0;
        } else if(timing === 'next_day'){
          effect.minDays = 1;
          effect.maxDays = 1;
        }
      }
    });
    return effects;
  };

  const oldEffectToString = window.effectToString;
  window.effectToString = function(e){
    if(e?.type === 'enableSurvivor') return `✅ Habilitar superviviente (${e.targetMode==='action'?'realiza la acción':(e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio'))})`;
    if(e?.type === 'enableBuilding') return `🛠 Habilitar ${getBuildingLabel(e.building||'?')}`;
    if(e?.type === 'cancelThreat') return `🧹 Cancelar amenaza: ${getThreatLabel(e.threatId||'')}`;
    if(e?.type === 'modifyThreatSeverity') return `📈 Severidad de amenaza ${e.amount>0?'+':''}${e.amount||1} · ${getThreatLabel(e.threatId||'')}`;
    if(e?.type === 'completeQuest') return `✅ Completar quest: ${e.questId || e.eventId || 'sin ID'}`;
    if(e?.type === 'failQuest') return `❌ Fallar quest: ${e.questId || e.eventId || 'sin ID'}`;
    if(e?.type === 'bonusAction') return `🟢 Bonificar ${e.action||'acción'} +${e.flat||0} plano (${e.days||1}d)`;
    if(e?.type === 'penaltyAction') return `🔴 Penalizar ${e.action||'acción'} -${e.flat||0} plano (${e.days||1}d)`;
    if(e?.type === 'awaySurvivor') return `🚶 Ausentar superviviente (${e.targetMode==='action'?'realiza la acción':(e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio'))}) ${e.days||1}d · ${e.returnInjuryChance||0}%`;
    if(e?.type === 'activateQuest' || e?.type === 'activateEvent'){
      const timing = getTimingModeFromEffect(e);
      const whenText = timing === 'immediate'
        ? 'inmediato'
        : timing === 'next_day'
          ? 'al día siguiente'
          : `en ${e.minDays ?? 0}-${e.maxDays ?? 0} día(s)`;
      return `📜 Activar quest ${e.questId || e.eventId || 'sin ID'} ${whenText}${e.forcedSurvivorId?` · ${e.forcedSurvivorId}`:(e.leadTargetMode?` · ${e.leadTargetMode.toUpperCase()}`:'')}${e.leaveCamp?` · sale ${e.leaveDays||3}d · ${e.returnInjuryChance||0}%`:''}`;
    }
    return oldEffectToString.apply(this, arguments);
  };

  const oldLoadEffectIntoRow = window.loadEffectIntoRow;
  window.loadEffectIntoRow = function(row, eff){
    ensureAllTypeSelectsHaveExtras();
    if(eff && ['enableSurvivor','enableBuilding','cancelThreat','modifyThreatSeverity','completeQuest','failQuest','bonusAction','penaltyAction'].includes(eff.type)){
      const typeSelect = row.querySelector('.effect-type-select');
      const p1 = row.querySelector('.effect-param1-select');
      const amt = row.querySelector('.effect-amount-input');
      if(typeSelect) typeSelect.value = eff.type;
      window.updateEffectRowFields(row, eff.type);

      if(eff.type === 'enableSurvivor'){
        if(eff.targetId){
          row.dataset.customTargetId = eff.targetId;
          const byIdOpt = [...p1.options].find(o => o.value === '__by_id__');
          if(byIdOpt) byIdOpt.textContent = `Por ID: ${eff.targetId}`;
          p1.value = '__by_id__';
        } else if(eff.targetMode === 'action') p1.value = '__action__';
        else if(eff.targetMode && [...p1.options].some(o => o.value === eff.targetMode)) p1.value = eff.targetMode;
        else p1.value = 'random';
      } else if(eff.type === 'enableBuilding'){
        p1.value = eff.building || p1.value;
      } else if(eff.type === 'cancelThreat'){
        const threatId = eff.threatId || eff.templateId || eff.id || '';
        if([...p1.options].some(o => o.value === threatId)) p1.value = threatId;
        else if(threatId){
          row.dataset.customThreatId = threatId;
          const manualOpt = [...p1.options].find(o => o.value === '__manual_threat__');
          if(manualOpt) manualOpt.textContent = `✍ ${threatId}`;
          p1.value = '__manual_threat__';
        }
      } else if(eff.type === 'modifyThreatSeverity'){
        const threatId = eff.threatId || eff.templateId || eff.id || '';
        if([...p1.options].some(o => o.value === threatId)) p1.value = threatId;
        else if(threatId){
          row.dataset.customThreatId = threatId;
          const manualOpt = [...p1.options].find(o => o.value === '__manual_threat__');
          if(manualOpt) manualOpt.textContent = `✍ ${threatId}`;
          p1.value = '__manual_threat__';
        }
        amt.value = eff.amount ?? eff.delta ?? 1;
      } else if(eff.type === 'completeQuest' || eff.type === 'failQuest'){
        const questId = eff.questId || eff.eventId || '';
        if([...p1.options].some(o => o.value === questId)) p1.value = questId;
        else if(questId){
          row.dataset.manualEventId = questId;
          const manualOpt = [...p1.options].find(o => o.value === '__manual_event__');
          if(manualOpt) manualOpt.textContent = `✍ ${questId}`;
          p1.value = '__manual_event__';
        }
      } else if(eff.type === 'bonusAction' || eff.type === 'penaltyAction'){
        const panel = ensureActionModifierPanel(row);
        const actionSel = panel.querySelector('.action-modifier-target');
        const percentInput = panel.querySelector('.action-modifier-percent');
        const flatInput = panel.querySelector('.action-modifier-flat');
        const daysInput = panel.querySelector('.action-modifier-days');
        if(actionSel && [...actionSel.options].some(o => o.value === (eff.action || 'forraje'))) actionSel.value = eff.action || 'forraje';
        if(percentInput) percentInput.value = eff.percent ?? eff.amount ?? '';
        if(flatInput) flatInput.value = eff.flat ?? eff.modifier ?? '';
        if(daysInput) daysInput.value = eff.days ?? 1;
      }
      return;
    }

    const result = oldLoadEffectIntoRow.apply(this, arguments);

    if(eff?.type === 'awaySurvivor'){
      const panel = ensureAwayPanel(row);
      panel.querySelector('.away-survivor-days').value = eff.days ?? 3;
      panel.querySelector('.away-survivor-chance').value = eff.returnInjuryChance ?? 35;
    }
    if(eff?.type === 'activateQuest' || eff?.type === 'activateEvent'){
      const panel = ensureQuestTimingEnhancement(row);
      const timingSel = panel.querySelector('.activate-event-timing');
      if(timingSel){
        timingSel.value = getTimingModeFromEffect(eff);
        panel._syncTimingUI?.();
      }
    }
    return result;
  };

  const oldAddEffectRow = window.addEffectRow;
  window.addEffectRow = function(){
    const result = oldAddEffectRow.apply(this, arguments);
    ensureAllTypeSelectsHaveExtras();
    return result;
  };

  ensureAllTypeSelectsHaveExtras();
})();
