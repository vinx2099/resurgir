(()=>{
 if(window.__eventEditorBondThreatPatch) return;
 window.__eventEditorBondThreatPatch=true;
 if(Array.isArray(EFFECT_TYPES) && !EFFECT_TYPES.some(t=>t.value==='modifyBond')){
  const idx = EFFECT_TYPES.findIndex(t=>t.value==='activateQuest');
  const entry = { group:'🎭 Narrativa', value:'modifyBond', label:'⛓ Vínculo entre supervivientes' };
  if(idx>=0) EFFECT_TYPES.splice(idx+1, 0, entry); else EFFECT_TYPES.push(entry);
 }
 function actorTargetPairs(){
  return [
   ['actor1','Actor 1'],['actor2','Actor 2'],['actor3','Actor 3'],['actor4','Actor 4'],
   ['__action__','Realiza la acción'],['__by_id__','Elegir por ID…']
  ];
 }
 function ensureThreatChancePanel(row){
  let panel = row.querySelector('.threat-chance-panel');
  if(panel) return panel;
  panel=document.createElement('div');
  panel.className='threat-chance-panel';
  panel.style.cssText='grid-column:1/-1;display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap;';
  panel.innerHTML='<span style="font-size:11px;color:var(--muted);">Probabilidad de que ocurra</span><input type="number" class="threat-chance-input" min="0" max="100" value="100" style="width:92px;"/><span style="font-size:11px;color:var(--muted);">%</span>';
  row.appendChild(panel);
  panel.querySelector('input')?.addEventListener('input',()=>updatePreview());
  return panel;
 }
 function clearThreatChancePanel(row){ row.querySelector('.threat-chance-panel')?.remove(); }
 function ensureBondPanel(row){
  let panel=row.querySelector('.bond-effect-panel');
  if(panel) return panel;
  panel=document.createElement('div');
  panel.className='bond-effect-panel';
  panel.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:6px;';
  panel.innerHTML='\
   <select class="bond-operation">\
    <option value="set">Añadir / fijar</option>\
    <option value="remove">Retirar</option>\
   </select>\
   <select class="bond-type">\
    <option value="friend">Amistad</option>\
    <option value="love">Amor</option>\
    <option value="rival">Rivalidad</option>\
    <option value="protector">Protector</option>\
   </select>\
   <select class="bond-actor-a"></select>\
   <select class="bond-actor-b"></select>';
  row.appendChild(panel);
  [panel.querySelector('.bond-actor-a'), panel.querySelector('.bond-actor-b')].forEach((sel, idx)=>{
   sel.innerHTML='';
   actorTargetPairs().forEach(([value,label])=>{
    const opt=document.createElement('option'); opt.value=value; opt.textContent=`${idx===0?'A':'B'} · ${label}`; sel.appendChild(opt);
   });
   sel.addEventListener('change',()=>{
    if(sel.value==='__by_id__'){
      const key = idx===0 ? 'bondActorAId' : 'bondActorBId';
      const entered = window.prompt('ID del superviviente objetivo:', row.dataset[key] || '');
      const clean = String(entered||'').trim();
      if(clean) row.dataset[key]=clean; else sel.value='actor1';
    }
    safeUpdatePreview();
   });
  });
  panel.querySelectorAll('select').forEach(el=>el.addEventListener('input',()=>updatePreview()));
  return panel;
 }
 function clearBondPanel(row){ row.querySelector('.bond-effect-panel')?.remove(); }

 const originalUpdate = window.updateEffectRowFields;
 window.updateEffectRowFields=function(row, type){
  const result = originalUpdate.apply(this, arguments);
  clearThreatChancePanel(row);
  clearBondPanel(row);
  if(type==='setAttackThreat') ensureThreatChancePanel(row);
  if(type==='modifyBond') ensureBondPanel(row);
  return result;
 };

 const originalRead = window.readEffectRows;
 window.readEffectRows=function(containerId){
  const effects = originalRead.apply(this, arguments) || [];
  const rows = document.getElementById(containerId)?.querySelectorAll('.effect-row') || [];
  effects.forEach((effect, idx)=>{
   const row = rows[idx];
   if(!row || !effect) return;
   if(effect.type==='setAttackThreat'){
    const chanceInput = row.querySelector('.threat-chance-input');
    if(chanceInput) effect.chancePercent = Math.max(0, Math.min(100, Number(chanceInput.value||100)||100));
   }
   if(row.querySelector('.bond-effect-panel')){
    const panel = row.querySelector('.bond-effect-panel');
    effect.type='modifyBond';
    effect.operation = panel.querySelector('.bond-operation')?.value || 'set';
    effect.bondType = panel.querySelector('.bond-type')?.value || 'friend';
    const a = panel.querySelector('.bond-actor-a')?.value || 'actor1';
    const b = panel.querySelector('.bond-actor-b')?.value || 'actor2';
    effect.actorA = a==='__action__' ? 'action' : a;
    effect.actorB = b==='__action__' ? 'action' : b;
    if(a==='__by_id__' && row.dataset.bondActorAId) effect.actorAId = row.dataset.bondActorAId;
    if(b==='__by_id__' && row.dataset.bondActorBId) effect.actorBId = row.dataset.bondActorBId;
   }
  });
  return effects;
 };

 const originalEffectToString = window.effectToString;
 window.effectToString=function(e){
  if(e?.type==='setAttackThreat'){
    const base = originalEffectToString.call(this, e);
    return `${base} · ${Math.max(0, Math.min(100, Number(e.chancePercent ?? e.chance ?? 100)||100))}%`;
  }
  if(e?.type==='modifyBond'){
    const a = e.actorAId || e.actorA || 'A';
    const b = e.actorBId || e.actorB || 'B';
    if(String(e.operation||'set')==='remove') return `⛓ Retirar vínculo entre ${a} y ${b}`;
    return `⛓ Vínculo ${e.bondType||'friend'} entre ${a} y ${b}`;
  }
  return originalEffectToString.apply(this, arguments);
 };

 const originalLoadEffectIntoRow = window.loadEffectIntoRow;
 window.loadEffectIntoRow=function(row, eff){
  const result = originalLoadEffectIntoRow.apply(this, arguments);
  if(!row || !eff) return result;
  if(eff.type==='setAttackThreat'){
    updateEffectRowFields(row, 'setAttackThreat');
    const chanceInput = row.querySelector('.threat-chance-input');
    if(chanceInput) chanceInput.value = Math.max(0, Math.min(100, Number(eff.chancePercent ?? eff.chance ?? 100)||100));
  }
  if(eff.type==='modifyBond'){
    const typeSelect = row.querySelector('.effect-type-select');
    if(typeSelect) typeSelect.value='modifyBond';
    updateEffectRowFields(row, 'modifyBond');
    const panel=row.querySelector('.bond-effect-panel');
    if(panel){
      panel.querySelector('.bond-operation').value = eff.operation || 'set';
      panel.querySelector('.bond-type').value = eff.bondType || eff.relationshipType || 'friend';
      const selA = panel.querySelector('.bond-actor-a');
      const selB = panel.querySelector('.bond-actor-b');
      if(eff.actorAId){ row.dataset.bondActorAId = eff.actorAId; selA.value='__by_id__'; }
      else selA.value = eff.actorA === 'action' ? '__action__' : (eff.actorA || 'actor1');
      if(eff.actorBId){ row.dataset.bondActorBId = eff.actorBId; selB.value='__by_id__'; }
      else selB.value = eff.actorB === 'action' ? '__action__' : (eff.actorB || 'actor2');
    }
  }
  return result;
 };

 // Make the new effect available in newly created rows even if HTML was built before patch
 const originalAddEffectRow = window.addEffectRow;
 window.addEffectRow=function(){
  const result = originalAddEffectRow.apply(this, arguments);
  const targetArg = arguments[0];
  const idMap = {direct:'directEffectRows',optionA:'optionAEffectRows',optionB:'optionBEffectRows',optionC:'optionCEffectRows',optionD:'optionDEffectRows',attackVictory:'attackVictoryRows',attackDefeat:'attackDefeatRows',personalOptionA:'personalOptionAEffectRows',personalOptionB:'personalOptionBEffectRows',personalOptionC:'personalOptionCEffectRows'};
  const container = document.getElementById(idMap[targetArg] || targetArg);
  const row = container?.querySelector('.effect-row:last-child');
  const select = row?.querySelector('.effect-type-select');
  if(select && ![...select.options].some(o=>o.value==='modifyBond')){
    const optgroup = document.createElement('optgroup');
    optgroup.label = '🎭 Narrativa';
    const opt = document.createElement('option');
    opt.value='modifyBond'; opt.textContent='⛓ Vínculo entre supervivientes';
    optgroup.appendChild(opt);
    select.appendChild(optgroup);
  }
  return result;
 };
})();
