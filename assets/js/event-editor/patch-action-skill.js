(()=>{
 if(window.__resurgirEditorActionFlatSkillPatch) return;
 window.__resurgirEditorActionFlatSkillPatch = true;

 const ADD_SKILL_ENTRY = { group:'👥 Supervivientes', value:'addSkill', label:'🎓 Añadir skill a superviviente' };

 function insertEffectType(entry, afterValue){
  try{
   if(!Array.isArray(EFFECT_TYPES)) return;
   if(EFFECT_TYPES.some(item=>item && item.value===entry.value)) return;
   const idx=EFFECT_TYPES.findIndex(item=>item && item.value===afterValue);
   if(idx>=0) EFFECT_TYPES.splice(idx+1, 0, entry);
   else EFFECT_TYPES.push(entry);
  }catch(_e){}
 }
 insertEffectType(ADD_SKILL_ENTRY, 'enableSurvivor');

 function ensureEffectTypeOptions(){
  document.querySelectorAll('.effect-type-select').forEach(select=>{
   let group=[...select.querySelectorAll('optgroup')].find(g=>g.label===ADD_SKILL_ENTRY.group);
   if(!group){
    group=document.createElement('optgroup');
    group.label=ADD_SKILL_ENTRY.group;
    select.appendChild(group);
   }
   if(![...select.options].some(opt=>opt.value===ADD_SKILL_ENTRY.value)){
    const opt=document.createElement('option');
    opt.value=ADD_SKILL_ENTRY.value;
    opt.textContent=ADD_SKILL_ENTRY.label;
    group.appendChild(opt);
   }
   const bonus=[...select.options].find(opt=>opt.value==='bonusAction');
   if(bonus) bonus.textContent='🟢 Bonificar acción (Forrajear/Reciclar) (% / plano durante X días)';
   const penalty=[...select.options].find(opt=>opt.value==='penaltyAction');
   if(penalty) penalty.textContent='🔴 Penalizar acción (Forrajear/Reciclar) (% / plano durante X días)';
  });
 }
 function toNumberOrNull(value){
  if(value===null || value===undefined) return null;
  const text=String(value).trim();
  if(!text) return null;
  const num=Number(text);
  return Number.isFinite(num) ? num : null;
 }
 function getTargetOptions(includeAllActors=false){
  if(typeof getActorTargetOptions==='function') return getActorTargetOptions(includeAllActors);
  const opts=[['random','Superviviente aleatorio'],['actor1','Actor 1 ({actor1})'],['actor2','Actor 2 ({actor2})'],['actor3','Actor 3 ({actor3})'],['actor4','Actor 4 ({actor4})'],['__action__','Quien realizó la acción']];
  if(includeAllActors) opts.splice(5,0,['allActors','Todos los actores']);
  return opts;
 }
 function fillActionSelect(select){
  if(!select) return;
  select.innerHTML='';
  [['forraje','Forrajear'],['reciclar','Reciclar']].forEach(([value,label])=>{
   const opt=document.createElement('option');
   opt.value=value;
   opt.textContent=label;
   select.appendChild(opt);
  });
  select.value='forraje';
 }
 function fillTargetSelect(select, includeAllActors=false){
  if(!select) return;
  select.innerHTML='';
  getTargetOptions(includeAllActors).concat([['__by_id__','Elegir por ID…']]).forEach(([value,label])=>{
   const opt=document.createElement('option');
   opt.value=value;
   opt.textContent=label;
   select.appendChild(opt);
  });
  select.value='random';
 }
 function fillSkillSelect(select, current=''){
  if(!select) return;
  const skills=(typeof getSkillOptions==='function' ? getSkillOptions() : []).filter(Boolean);
  select.innerHTML='';
  const empty=document.createElement('option');
  empty.value='';
  empty.textContent='Selecciona skill…';
  select.appendChild(empty);
  skills.forEach(skill=>{
   const clean=String(skill||'').trim();
   if(!clean) return;
   const opt=document.createElement('option');
   opt.value=clean;
   opt.textContent=clean;
   select.appendChild(opt);
  });
  if(current && [...select.options].some(opt=>opt.value===current)) select.value=current;
 }
 function ensureActionModifierPanel(row){
  let panel=row.querySelector('.action-modifier-panel');
  if(panel?.dataset.patchVersion==='2') return panel;
  if(panel) panel.remove();
  panel=document.createElement('div');
  panel.className='action-modifier-panel';
  panel.dataset.patchVersion='2';
  panel.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:minmax(160px,1.2fr) repeat(3,minmax(110px,0.8fr));gap:8px;margin-top:6px;';

  const wrap=(labelText, className, type='number')=>{
   const box=document.createElement('div');
   box.style.cssText='display:flex;flex-direction:column;gap:4px;';
   const label=document.createElement('label');
   label.textContent=labelText;
   const input=document.createElement(type==='select'?'select':'input');
   if(type!=='select') input.type=type;
   input.className=className;
   box.append(label, input);
   return {box, input};
  };

  const actionWrap=wrap('Acción', 'action-modifier-target', 'select');
  if(typeof fillActionSelect==='function') fillActionSelect(actionWrap.input);

  const percentWrap=wrap('% modificador', 'action-modifier-percent');
  percentWrap.input.min='-999';
  percentWrap.input.max='999';
  percentWrap.input.placeholder='vacío = no';
  percentWrap.input.value=row.dataset.actionModifierPercent ?? '';

  const flatWrap=wrap('Plano', 'action-modifier-flat');
  flatWrap.input.min='-999';
  flatWrap.input.max='999';
  flatWrap.input.placeholder='vacío = no';
  flatWrap.input.value=row.dataset.actionModifierFlat ?? '';

  const daysWrap=wrap('Duración (días)', 'action-modifier-days');
  daysWrap.input.min='1';
  daysWrap.input.max='999';
  daysWrap.input.value=row.dataset.actionModifierDays || '1';

  [actionWrap.input, percentWrap.input, flatWrap.input, daysWrap.input].forEach(el=>el.addEventListener('input', ()=>{
   row.dataset.actionModifierPercent=percentWrap.input.value ?? '';
   row.dataset.actionModifierFlat=flatWrap.input.value ?? '';
   row.dataset.actionModifierDays=daysWrap.input.value || '1';
   if(typeof safeUpdatePreview==='function') safeUpdatePreview();
  }));

  panel.append(actionWrap.box, percentWrap.box, flatWrap.box, daysWrap.box);
  row.appendChild(panel);
  return panel;
 }

 const prevUpdateEffectRowFields=window.updateEffectRowFields;
 window.updateEffectRowFields=function(row, type){
  const result=prevUpdateEffectRowFields.apply(this, arguments);
  ensureEffectTypeOptions();
  const p1=row.querySelector('.effect-param1-select');
  const p2=row.querySelector('.effect-param2-select');
  const amt=row.querySelector('.effect-amount-input');
  if(type==='bonusAction' || type==='penaltyAction'){
   if(p1){ p1.style.display='none'; p1.innerHTML=''; }
   if(p2){ p2.style.display='none'; p2.innerHTML=''; }
   if(amt){ amt.style.display='none'; }
   ensureActionModifierPanel(row);
  } else if(type==='addSkill'){
   if(p1){ p1.style.display=''; fillTargetSelect(p1, true); }
   if(p2){ p2.style.display=''; fillSkillSelect(p2, row.dataset.addSkillId || ''); }
   if(amt){
    amt.style.display='';
    amt.type='number';
    amt.min='0';
    amt.max='100';
    amt.step='1';
    amt.placeholder='% aprender';
    amt.title='Porcentaje de aprender la skill';
    amt.value=row.dataset.addSkillChance ?? '100';
    amt.oninput=()=>{
     row.dataset.addSkillChance=amt.value || '100';
     if(typeof safeUpdatePreview==='function') safeUpdatePreview();
    };
   }
   if(typeof attachManualTargetIdPrompt==='function') attachManualTargetIdPrompt(row);
  }
  return result;
 };

 const prevReadEffectRows=window.readEffectRows;
 window.readEffectRows=function(containerId){
  const effects=prevReadEffectRows.apply(this, arguments) || [];
  const rows=document.getElementById(containerId)?.querySelectorAll('.effect-row') || [];
  effects.forEach((effect, idx)=>{
   const row=rows[idx];
   if(!row || !effect) return;
   const type=row.querySelector('.effect-type-select')?.value;
   const p1=row.querySelector('.effect-param1-select');
   const p2=row.querySelector('.effect-param2-select');
   if(type==='bonusAction' || type==='penaltyAction'){
    const panel=ensureActionModifierPanel(row);
    effect.type=type;
    effect.action=panel.querySelector('.action-modifier-target')?.value || 'related';
    const percent=toNumberOrNull(panel.querySelector('.action-modifier-percent')?.value);
    const flat=toNumberOrNull(panel.querySelector('.action-modifier-flat')?.value);
    if(percent!==null) effect.percent=percent; else delete effect.percent;
    if(flat!==null) effect.flat=flat; else delete effect.flat;
    effect.days=Math.max(1, Number(panel.querySelector('.action-modifier-days')?.value||1) || 1);
   } else if(type==='addSkill'){
   effect.type='addSkill';
   effect.skill=p2?.value?.trim() || '';
   const chance=Number(row.querySelector('.effect-amount-input')?.value);
   effect.chancePercent=Number.isFinite(chance) ? Math.max(0, Math.min(100, chance)) : 100;
   if(p1?.value === '__by_id__' && row.dataset.customTargetId) effect.targetId=row.dataset.customTargetId;
    else if(p1?.value === '__action__') effect.targetMode='action';
    else if(/^actor\d$/.test(p1?.value||'') || p1?.value === 'allActors') effect.targetMode=p1.value;
   }
  });
  return effects;
 };

 const prevEffectToString=window.effectToString;
 window.effectToString=function(e){
  if(e?.type==='bonusAction' || e?.type==='penaltyAction'){
   const bits=[];
   const percent=toNumberOrNull(e.percent);
   const flat=toNumberOrNull(e.flat ?? e.modifier);
   if(percent!==null && percent!==0) bits.push(`${e.type==='penaltyAction'&&percent>0?'-':percent>0?'+':''}${Math.abs(percent)}%`);
   if(flat!==null && flat!==0) bits.push(`${e.type==='penaltyAction'&&flat>0?'-':flat>0?'+':''}${Math.abs(flat)} plano`);
   return `${e.type==='bonusAction'?'🟢':'🔴'} ${e.type==='bonusAction'?'Bonificar':'Penalizar'} ${e.action||'acción'} ${bits.join(' · ') || '(sin cambio)'} (${e.days||1}d)`;
  }
  if(e?.type==='addSkill'){
   const target=e.targetMode==='action' ? 'realiza la acción' : (e.targetMode==='allActors' ? 'todos los actores' : (e.targetMode&&e.targetMode.startsWith('actor') ? e.targetMode.toUpperCase() : (e.targetId || 'aleatorio')));
   const chance=Number(e.chancePercent ?? e.chance ?? 100);
   const chanceText=Number.isFinite(chance) && chance!==100 ? ` · ${Math.max(0, Math.min(100, chance))}%` : '';
   return `🎓 Añadir skill ${e.skill||'sin skill'} (${target})${chanceText}`;
  }
  return prevEffectToString.apply(this, arguments);
 };

 const prevLoadEffectIntoRow=window.loadEffectIntoRow;
 window.loadEffectIntoRow=function(row, eff){
  ensureEffectTypeOptions();
  if(eff && (eff.type==='bonusAction' || eff.type==='penaltyAction' || eff.type==='addSkill')){
   const typeSelect=row.querySelector('.effect-type-select');
   const p1=row.querySelector('.effect-param1-select');
   const p2=row.querySelector('.effect-param2-select');
   if(typeSelect) typeSelect.value=eff.type;
   window.updateEffectRowFields(row, eff.type);
   if(eff.type==='bonusAction' || eff.type==='penaltyAction'){
    const panel=ensureActionModifierPanel(row);
    const actionSel=panel.querySelector('.action-modifier-target');
    const percentInput=panel.querySelector('.action-modifier-percent');
    const flatInput=panel.querySelector('.action-modifier-flat');
    const daysInput=panel.querySelector('.action-modifier-days');
    if(actionSel && [...actionSel.options].some(opt=>opt.value===(eff.action||'related'))) actionSel.value=eff.action||'related';
    if(percentInput) percentInput.value=eff.percent ?? '';
    if(flatInput) flatInput.value=eff.flat ?? eff.modifier ?? '';
    if(daysInput) daysInput.value=eff.days ?? 1;
   } else if(eff.type==='addSkill'){
    if(eff.targetId){
     row.dataset.customTargetId=eff.targetId;
     const byIdOpt=[...p1.options].find(opt=>opt.value==='__by_id__');
     if(byIdOpt) byIdOpt.textContent=`Por ID: ${eff.targetId}`;
     p1.value='__by_id__';
    } else if(eff.targetMode === 'action') p1.value='__action__';
    else if(eff.targetMode && [...p1.options].some(opt=>opt.value===eff.targetMode)) p1.value=eff.targetMode;
    else p1.value='random';
    fillSkillSelect(p2, eff.skill || eff.skillId || '');
    if(p2 && [...p2.options].some(opt=>opt.value===(eff.skill||eff.skillId||''))) p2.value=eff.skill||eff.skillId||'';
    const amt=row.querySelector('.effect-amount-input');
    if(amt){
     amt.value=eff.chancePercent ?? eff.chance ?? 100;
     row.dataset.addSkillChance=amt.value || '100';
    }
   }
   return;
  }
  return prevLoadEffectIntoRow.apply(this, arguments);
 };

 ensureEffectTypeOptions();
})();
