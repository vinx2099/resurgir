(()=>{
  if(window.__resurgirEditorDrunkAbandonedPatch) return;
  window.__resurgirEditorDrunkAbandonedPatch=true;

  const ABANDONED_UNLOCK_OPTIONS=[
    ['cantina','🍺 Cantina'],
    ['sala_comun','🪑 Sala común']
  ];

  if(Array.isArray(window.EFFECT_TYPES||EFFECT_TYPES)){
    const list=(window.EFFECT_TYPES||EFFECT_TYPES);
    if(!list.some(e=>e.value==='modifyDrunk')){
      list.splice(5,0,{ group:'🙂 Estado del grupo', value:'modifyDrunk', label:'🍺 Drunk de un superviviente (+/- · aleatorio / por ID / actor)' });
    }
    if(!list.some(e=>e.value==='unlockAbandonedBuilding')){
      list.push({ group:'🏚 Base y construcciones', value:'unlockAbandonedBuilding', label:'🏚 Desbloquear adaptación de edificio abandonado' });
    }
  }

  function appendAbandonedUnlockOptions(selectEl){
    if(!selectEl) return;
    selectEl.innerHTML='';
    ABANDONED_UNLOCK_OPTIONS.forEach(([value,label])=>{
      const opt=document.createElement('option');
      opt.value=value;
      opt.textContent=label;
      selectEl.appendChild(opt);
    });
  }

  const oldUpdate=window.updateEffectRowFields;
  window.updateEffectRowFields=function(row,type){
    oldUpdate(row,type);
    const p1=row.querySelector('.effect-param1-select');
    const p2=row.querySelector('.effect-param2-select');
    const amt=row.querySelector('.effect-amount-input');
    if(type==='modifyDrunk'){
      p1.style.display='';
      p2.style.display='none';
      amt.style.display='';
      amt.placeholder='Drunk +/- (ej: 1 o -1)';
      amt.value=1;
      amt.min=-20; amt.max=20;
      p1.innerHTML='';
      getActorTargetOptions(false).concat([['__by_id__','Elegir por ID…']]).forEach(([value,label])=>{
        const opt=document.createElement('option'); opt.value=value; opt.textContent=label; p1.appendChild(opt);
      });
      if(![...p1.options].some(o=>o.value==='random')){
        const opt=document.createElement('option'); opt.value='random'; opt.textContent='Superviviente aleatorio'; p1.insertBefore(opt,p1.firstChild);
      }
      p1.value='random';
    } else if(type==='unlockAbandonedBuilding'){
      p1.style.display='';
      p2.style.display='none';
      amt.style.display='none';
      appendAbandonedUnlockOptions(p1);
    }
  };

  const oldRead=window.readEffectRows;
  window.readEffectRows=function(containerId){
    const effects=oldRead(containerId);
    const rows=document.getElementById(containerId)?.querySelectorAll('.effect-row')||[];
    rows.forEach((row,idx)=>{
      const type=row.querySelector('.effect-type-select')?.value;
      const p1=row.querySelector('.effect-param1-select');
      const amt=row.querySelector('.effect-amount-input');
      if(type==='modifyDrunk'){
        const signedAmount=Number(amt?.value);
        const finalAmount=Number.isFinite(signedAmount)&&signedAmount!==0?signedAmount:1;
        const effect={ type: finalAmount>=0 ? 'addDrunk' : 'removeDrunk', amount: Math.abs(finalAmount) };
        if(p1?.value==='__by_id__' && row.dataset.customTargetId) effect.targetId=row.dataset.customTargetId;
        else if(/^actor\d$/.test(p1?.value||'')) effect.targetMode=p1.value;
        effects[idx]=effect;
      } else if(type==='unlockAbandonedBuilding'){
        effects[idx]={ type:'unlockAbandonedBuilding', building:p1?.value||'cantina' };
      }
    });
    return effects;
  };

  const oldEffectToString=window.effectToString;
  window.effectToString=function(e){
    if(e?.type==='addDrunk') return `🍺 +${e.amount||1} drunk (${e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio')})`;
    if(e?.type==='removeDrunk') return `💧 -${e.amount||1} drunk (${e.targetMode&&e.targetMode.startsWith('actor')?e.targetMode.toUpperCase():(e.targetId||'aleatorio')})`;
    if(e?.type==='unlockAbandonedBuilding') return `🏚 Desbloquea adaptación: ${e.building==='sala_comun' ? 'Sala común' : (e.building||'cantina')}`;
    return oldEffectToString(e);
  };

  const oldLoadEffectIntoRow=window.loadEffectIntoRow;
  window.loadEffectIntoRow=function(row, eff){
    if(eff && (eff.type==='addDrunk' || eff.type==='removeDrunk' || eff.type==='unlockAbandonedBuilding')){
      const translated = eff.type==='unlockAbandonedBuilding'
        ? { ...eff, type:'unlockAbandonedBuilding' }
        : { ...eff, type:'modifyDrunk' };
      const typeSelect = row.querySelector('.effect-type-select');
      const p1 = row.querySelector('.effect-param1-select');
      const amt = row.querySelector('.effect-amount-input');
      typeSelect.value = translated.type;
      window.updateEffectRowFields(row, translated.type);
      if(translated.type==='unlockAbandonedBuilding'){
        p1.value = translated.building || 'cantina';
      } else {
        if(eff.targetId){
          row.dataset.customTargetId = eff.targetId;
          const byIdOpt = [...p1.options].find(o => o.value === '__by_id__');
          if (byIdOpt) byIdOpt.textContent = `Por ID: ${eff.targetId}`;
          p1.value='__by_id__';
        } else if (eff.targetMode && [...p1.options].some(o => o.value === eff.targetMode)) {
          p1.value = eff.targetMode;
        } else {
          p1.value='random';
        }
        amt.value = eff.type==='removeDrunk' ? -(eff.amount||1) : (eff.amount||1);
      }
      return;
    }
    return oldLoadEffectIntoRow(row, eff);
  };
})();
