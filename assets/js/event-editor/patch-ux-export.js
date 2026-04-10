(()=>{
  if(window.__resurgirEditorUxExportFixesPatch) return;
  window.__resurgirEditorUxExportFixesPatch = true;

  const style = document.createElement('style');
  style.textContent = `
    #exportArea{display:none !important;}
    #currentJsonOutput{
      white-space:pre-wrap !important;
      word-break:break-word !important;
      overflow-wrap:anywhere !important;
      max-width:100%;
    }
  `;
  document.head.appendChild(style);

  function ensureActionValue(select, value){
    const clean = String(value || '').trim();
    if(!select || !clean) return '';
    const existing = [...select.options].find(opt => opt.value === clean);
    if(existing) return clean;
    const opt = document.createElement('option');
    opt.value = clean;
    opt.textContent = `✍ ${clean}`;
    select.appendChild(opt);
    return clean;
  }

  const prevLoadEffectIntoRow = window.loadEffectIntoRow;
  if(typeof prevLoadEffectIntoRow === 'function'){
    window.loadEffectIntoRow = function(row, eff){
      const out = prevLoadEffectIntoRow.apply(this, arguments);
      if(eff && (eff.type === 'bonusAction' || eff.type === 'penaltyAction')){
        const panel = row?.querySelector('.action-modifier-panel') || (typeof ensureActionModifierPanel === 'function' ? ensureActionModifierPanel(row) : null);
        const actionSel = panel?.querySelector('.action-modifier-target');
        const actionValue = String(eff.action || '').trim() || 'related';
        if(actionSel){
          ensureActionValue(actionSel, actionValue);
          actionSel.value = actionValue;
        }
      }
      return out;
    };
  }

  const prevReadEffectRows = window.readEffectRows;
  if(typeof prevReadEffectRows === 'function'){
    window.readEffectRows = function(containerId){
      const effects = prevReadEffectRows.apply(this, arguments) || [];
      const rows = document.getElementById(containerId)?.querySelectorAll('.effect-row') || [];
      effects.forEach((effect, idx) => {
        if(!effect || (effect.type !== 'bonusAction' && effect.type !== 'penaltyAction')) return;
        const row = rows[idx];
        const actionSel = row?.querySelector('.action-modifier-panel .action-modifier-target');
        if(actionSel && actionSel.value) effect.action = actionSel.value;
      });
      return effects;
    };
  }

  window.startNewEvent = function(){
    const dirty = !!(
      document.getElementById('f-id')?.value?.trim() ||
      document.getElementById('f-name')?.value?.trim() ||
      document.getElementById('f-story')?.value?.trim() ||
      document.getElementById('f-imgurl')?.value?.trim() ||
      document.querySelector('.effect-row')
    );
    if(dirty && !window.confirm('Se limpiará el formulario actual para crear un evento nuevo. ¿Continuar?')) return;
    if(typeof clearForm === 'function') clearForm();
    const idInput = document.getElementById('f-id');
    if(idInput) idInput.focus();
    if(typeof showToast === 'function') showToast('Formulario listo para un evento nuevo');
  };

  function patchButtons(){
    const clearBtn = document.querySelector('button[onclick="clearForm()"]');
    if(clearBtn){
      clearBtn.textContent = '＋ Nuevo evento';
      clearBtn.setAttribute('onclick', 'startNewEvent()');
      clearBtn.classList.add('amber');
      clearBtn.removeAttribute('title');
    }

    const headerActions = document.querySelector('.header-actions');
    if(headerActions && !document.getElementById('newEventTopBtn')){
      const btn = document.createElement('button');
      btn.id = 'newEventTopBtn';
      btn.className = 'btn amber';
      btn.textContent = '＋ Nuevo evento';
      btn.addEventListener('click', window.startNewEvent);
      headerActions.insertBefore(btn, headerActions.firstChild);
    }
  }

  const prevExportJSON = window.exportJSON;
  window.exportJSON = function(){
    if(typeof events === 'undefined' || !events || !events.length){
      if(typeof showToast === 'function') showToast('No hay eventos para exportar', true);
      return;
    }
    if(typeof downloadJSON === 'function') downloadJSON(events, 'events.json');
    const area = document.getElementById('exportArea');
    if(area){
      area.textContent = '';
      area.style.display = 'none';
    }
    if(typeof showToast === 'function') showToast(`events.json descargado (${events.length} eventos) ✓`);
  };

  const prevUpdatePreview = window.updatePreview;
  if(typeof prevUpdatePreview === 'function'){
    window.updatePreview = function(){
      const out = prevUpdatePreview.apply(this, arguments);
      try{
        const jsonOut = document.getElementById('currentJsonOutput');
        if(jsonOut && typeof buildEventObject === 'function'){
          jsonOut.textContent = JSON.stringify(buildEventObject(), null, 2);
        }
      }catch(_e){}
      return out;
    };
  }

  patchButtons();
  if(typeof safeUpdatePreview === 'function') safeUpdatePreview();
})();
