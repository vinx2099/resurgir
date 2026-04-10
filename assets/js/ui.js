// UI split extracted from app.js

function getLogScrollStep(){
  if(!logBox) return 180;
  return Math.max(120, Math.round(logBox.clientHeight * 0.72));
}

function applyLogVirtualOffset(){
  if(!logBox) return;
  const rail = logBox.querySelector('.log-rail');
  if(!rail) return;
  const maxOffset = Math.max(0, rail.scrollHeight - logBox.clientHeight);
  logVirtualOffset = Math.max(0, Math.min(logVirtualOffset, maxOffset));
  rail.style.transform = `translateY(-${logVirtualOffset}px)`;
}

function scrollLogBoxBy(direction=1){
  logVirtualOffset += getLogScrollStep() * direction;
  applyLogVirtualOffset();
}

function closeThreatDecisionPopup(){
 document.getElementById('threatDecisionPopup')?.classList.remove('open');
}

function openThreatDecisionPopup(mode, instanceId=''){
 const popup=document.getElementById('threatDecisionPopup');
 const titleEl=document.getElementById('threatDecisionPopupTitle');
 const imageEl=document.getElementById('threatDecisionPopupImage');
 const metaEl=document.getElementById('threatDecisionPopupMeta');
 const textEl=document.getElementById('threatDecisionPopupText');
 const passiveEl=document.getElementById('threatDecisionPopupPassive');
 const actionsEl=document.getElementById('threatDecisionPopupActions');
 if(!popup||!titleEl||!imageEl||!metaEl||!textEl||!passiveEl||!actionsEl) return;

 if(mode==='attack'){
 const urgencyMeta=getAttackThreatUrgencyMeta();
 titleEl.textContent=`⚔ ${state.attackHostileLabel||'Amenaza de ataque'}`;
 imageEl.innerHTML='<span>⚔</span>';
 metaEl.innerHTML=`<div class="threat-preview-badge attack">Fuerza ${Number(state.attackStrength||0)}</div><div class="threat-preview-badge attack">${escapeHtml(urgencyMeta.text)}</div>`;
 textEl.innerHTML='Un grupo hostil está en camino al asentamiento. Esta amenaza no se resuelve desde aquí: debes asignar supervivientes a <b>Defender</b> antes de que llegue.';
 passiveEl.textContent='Amenaza de ataque: si no preparas la defensa, el asalto se resolverá con la fuerza actual del asentamiento y los defensores asignados.';
 actionsEl.innerHTML=`<div class="threat-popup-note">Acción recomendada: revisa a tus supervivientes y asigna <b>Defender</b> a quienes vayan a enfrentarse al ataque.</div>`;
 popup.classList.add('open');
 return;
 }

 const threat=(state.activeThreats||[]).find(item=>String(item.instanceId)===String(instanceId) && !item.resolved);
 if(!threat) return;
 const def=getThreatDef(threat.templateId)||{};
 const image=getThreatImage(threat);
 titleEl.textContent=`☣ ${getThreatDisplayName(threat)}`;
 imageEl.innerHTML=image
 ? `<img src="${escapeAttr(image)}" alt="">`
 : '<span>☣</span>';
 const escalationDays=Math.max(0, Number(threat.daysUntilEscalation||0));
 const escalationText=Number(threat.severity||0)>=getThreatMaxSeverity(threat) ? 'Punto crítico' : `Escala en ${escalationDays} día${escalationDays!==1?'s':''}`;
 metaEl.innerHTML=`<div class="threat-preview-badge">${escapeHtml(getThreatSeverityText(threat))}</div><div class="threat-preview-badge">${escapeHtml(escalationText)}</div>`;
 textEl.textContent=getThreatDescription(threat);
 passiveEl.textContent=describeThreatPassiveEffects(threat);

 const actions=(def.actions||[]).map(action=>{
 const req=evaluateThreatActionRequirements(threat, action);
 const requiresSurvivor=!!action?.requirements?.survivorAvailable;
 const helper=req.ok ? (getThreatActionSummary(action)||action.description||'') : req.blockers.join(' · ');
 const optionsHtml=requiresSurvivor && req.availableSurvivors.length
 ? `<select class="threat-action-survivor-select" data-threat-actor-select="${escapeAttr(action.id)}" data-threat-id="${escapeAttr(threat.instanceId)}">${req.availableSurvivors.map(s=>`<option value="${escapeAttr(s.id)}">${escapeHtml(getThreatActionSurvivorOptionLabel(s))}</option>`).join('')}</select>`
 : '';
 const disabled=req.ok?'':'disabled';
 return `<div class="threat-action-card" data-threat-action-card="${escapeAttr(action.id)}">${optionsHtml}<button class="btn ${req.ok?'amber':'secondary'}" data-threat-popup-action="${escapeAttr(action.id)}" data-threat-id="${escapeAttr(threat.instanceId)}" ${disabled} style="width:100%;justify-content:flex-start;text-align:left;padding:9px 10px;${req.ok?'':'opacity:0.55;'}">${escapeHtml(action.label||'Actuar')}</button><div class="threat-action-helper" style="color:${req.ok?'var(--muted)':'var(--danger-bright)'};">${escapeHtml(helper)}</div></div>`;
 }).join('');
 actionsEl.innerHTML=actions || '<div class="threat-popup-note">Esta amenaza no tiene acciones directas configuradas.</div>';
 actionsEl.querySelectorAll('[data-threat-popup-action]').forEach(btn=>{
 btn.addEventListener('click',()=>{
 const card=btn.closest('[data-threat-action-card]');
 const actorId=card?.querySelector('[data-threat-actor-select]')?.value || '';
 executeThreatAction(btn.dataset.threatId, btn.dataset.threatPopupAction, actorId);
 });
 });
 popup.classList.add('open');
}

function render(){
 maybeLogStabilityTierChange();
 renderTopbar();
 renderSurvivors();
 renderBuildings();
 renderThreats();
 renderLog();
 renderPersistentEvent();
 try{
  const hasPersistentThreats=Array.isArray(state.activeThreats)
   ? state.activeThreats.some(threat=>threat && !threat.resolved)
   : false;
  if(typeof setCombatMusic==='function') setCombatMusic(!!(state.attackThreat || hasPersistentThreats));
 }catch(e){}
 checkGameOver();
}

function renderTopbar(){
 const stabilityMods=getStabilityModifiers();
 const stabilityTier=stabilityMods.tier;
 const stabilityText=stabilityTierLabel(stabilityTier);
 const stabilityTip=stabilityTier==='collapse'
 ? 'Colapso: defensa -1, +eventos negativos, +abandono, menos reclutas, construcción/investigación más lentas.'
 : stabilityTier==='unstable'
 ? 'Inestable: +eventos negativos y menos reclutas.'
 : stabilityTier==='strong'
 ? 'Fuerte: defensa +1, +eventos positivos, más reclutas, descanso con posible +1 moral.'
 : 'Normal: sin modificadores globales.';
 ensureCampInventory();
 const campHeader=document.getElementById('campTopbarIndicator');
 const extCount=getExteriorSurvivorCount();
 if(campHeader){
 campHeader.style.display=extCount>0?'flex':'none';
 if(extCount>0){
 const campSummary=getCampInventoryEntries().map(item=>`${item.icon}${item.amount}`).join(' ');
 campHeader.innerHTML=`<span style="font-size:9px;color:var(--ok-bright);letter-spacing:0.08em;">⛺ CAMP</span><span style="font-size:14px;font-weight:600;">${campSummary}</span>`;
 }
 }
const cardMap={
 day:['Día','📅',state.day,false],
 stability:['Estabilidad','🏛',stabilityText,false,stabilityTip],
 survivors:['Supervivientes','👥',aliveSurvivors().length,false],
 electricity:(()=>{
 const cap=getElectricityCapacity();
 const used=getElectricityUsed();
 const label=cap>0?`${used}/${cap} ⚡`:'--';
 return ['Electricidad','⚡',cap>0?label:'--',cap<=0];
 })(),
 food:['Comida','🌽',state.food,false],
 chickens:['Gallinas','🐔',state.chickens,false],
 materials:['Materiales','🔧',state.materials,false],
 fuel:['Combustible','⛽',state.fuel,false],
 meds:['Medicamentos','💊',state.meds,false]
};
const order=Array.isArray(gameData.config?.ui?.resourceOrder)&&gameData.config.ui.resourceOrder.length
 ? gameData.config.ui.resourceOrder
 : ['day','stability','survivors','electricity','food','chickens','materials','fuel','meds'];
const labelOverrides=gameData.config?.ui?.resourceLabels||{};
const cards=order.map(key=>{
 const card=cardMap[key];
 if(!card) return null;
 const clone=[...card];
 if(labelOverrides[key]) clone[0]=labelOverrides[key];
 return clone;
}).filter(Boolean);
 topbar.innerHTML=cards.map(([label,icon,value,locked,tip])=>`<div class="stat ${locked?'locked':''} ${label==='Estabilidad'&&stabilityTier==='collapse'?'locked':''}" ${tip?`title="${escapeAttr(tip)}"`:''}><div class="label"><span style="margin-right:3px;font-size:13px">${icon}</span>${label}</div><div class="value">${value}</div></div>`).join('');
}

function renderSurvivors(){
 survivorList.innerHTML='';
 ensureCampInventory();
 const threatBanner=document.getElementById('attackThreatBanner');
 if(threatBanner){
 threatBanner.style.display='none';
 threatBanner.innerHTML='';
 }

 if(activeMapTab==='exterior'){
 const campHeader=document.createElement('div');
 const campSummary=getCampInventoryEntries().map(item=>`<span>${item.icon} <b>${item.amount}</b> ${item.label}</span>`).join('');
 const extCount=getExteriorSurvivorCount();
 const campCount=getExteriorCampSurvivors().length;
 campHeader.innerHTML=`
 <div style="border:1px solid var(--ok);border-left:3px solid var(--ok-bright);padding:8px 10px;background:rgba(74,138,53,0.06);margin-bottom:8px;">
 <div style="font-family:var(--font-display);font-size:12px;letter-spacing:0.1em;color:var(--ok-bright);margin-bottom:4px;">⛺ CAMPAMENTO EXTERIOR · ${escapeHtml(getExteriorZoneName())}</div>
 <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text);">${campSummary}<span style="color:var(--muted);">${extCount} superviviente${extCount!==1?'s':''} · ${campCount} en campamento</span></div>
 </div>`;
 survivorList.appendChild(campHeader);
 }

 const tabFilter = activeMapTab==='exterior'
 ? s => s.status!=='muerto' && isExteriorSurvivor(s)
 : s => s.status!=='muerto' && !isExteriorSurvivor(s);

 state.survivors.filter(tabFilter).forEach(s=>{
 const canAct=s.status!=='muerto';
 const actions=getAvailableActions(s);
 const isExteriorCard=activeMapTab==='exterior'&&isExteriorSurvivor(s)&&s.location!=='travelling';
 const _img=getSurvivorImage(s);
 const _filter=s.status==='muerto'?'grayscale(1) brightness(0.6)':hasActiveInjury(s)?'grayscale(30%) sepia(30%) brightness(0.85)':'';
 const avatarInner = _img ? `<img src="${escapeAttr(_img)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;filter:${_filter}">` : '<span style="color:var(--muted);font-size:11px">Sin<br>imagen</span>';
 const card=document.createElement('div');
 card.className='survivor-card';
 const dog=getDogForSurvivor(s);
 const bonds=getSurvivorRelationshipBadges(s);
 const bondIndicator=bonds.length ? `<span class="survivor-link-indicator" title="Tiene vínculos. Consulta la biografía.">⛓</span>` : '';
 const loreBtn=`<button class="survivor-slot lore-btn" title="Biografía de ${escapeAttr(s.name)}">📖</button>`;
 const invBtn=`<button class="survivor-slot inv-btn" title="Mochila de ${escapeAttr(s.name)}">🎒</button>`;
 const dogBtn=`<button class="survivor-slot dog-btn ${dog?'occupied':'empty'}" title="${escapeAttr(dog?`Perro: ${dog.name}`:'Espacio reservado para perro')}" ${dog?'':'disabled'}>🐕</button>`;
 const futureBtn=`<button class="survivor-slot future-btn empty" title="Espacio reservado" disabled>▣</button>`;
 const statusClass=hasActiveInjury(s)?'herido':s.status;
 const injuryName=hasActiveInjury(s)?injuryDisplayName(s.injuryLevel||'simple'):'';
 const statusText=hasActiveInjury(s)?`Herida ${injuryName}`:statusLabel(s.status);
 const statusTitle=hasActiveInjury(s) ? ` title="Herida: ${escapeAttr(injuryName)}"` : '';
 const noteHtml=s.location==='travelling'
 ? `<div class="survivor-note"><span style="color:var(--amber-bright);">🧭 En tránsito</span><br>${escapeHtml(s.travelArrivalDay&&s.travelArrivalDay>state.day?'Llega día '+s.travelArrivalDay:s.travelReturnDay?'Regresa día '+s.travelReturnDay:'Viajando')}</div>`
 : isExteriorCard
 ? `<div class="survivor-note"><span style="color:var(--ok-bright);">📍 ${escapeHtml(getLocationDisplayName(s.location)||'Exterior')}</span><br><span style="color:var(--amber-bright);">🏚 ${escapeHtml(getExteriorSiteLabel(s.exteriorSiteId)||'Zona activa')}</span></div>`
 : ``;
 const skillLabels=getSurvivorSkills(s)
 .map(skill=>String(getSurvivorSkillLabel({skill})||skill).replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/,'').split('—')[0].trim())
 .filter(Boolean);
 const skillsLineHtml=skillLabels.length
 ? `<div class="survivor-health-line ok"><span style="color:var(--ok-bright);">✦ Habilidades:</span> <b style="color:var(--text);">${escapeHtml(skillLabels.join(', '))}</b></div>`
 : `<div class="survivor-health-line ok"><span style="color:var(--muted);">✦ Sin habilidades</span></div>`;

 card.innerHTML=`
 <div class="avatar ${hasActiveInjury(s)?'injured':''}">${avatarInner}</div>
 <div class="survivor-head-row">
 <div class="survivor-name-wrap">
 <div class="survivor-name">${escapeHtml(s.name)}</div>
 ${bondIndicator}
 </div>
 <div class="badge ${statusClass}"${statusTitle}>${statusText}</div>
 </div>
 <div class="survivor-meta-line">
 <span class="meta-fatigue"><span style="color:var(--ok)">⚡</span> ${s.fatigue}/${s.maxFatigue}</span>
 <span class="meta-morale" style="color:${getMoraleColor(s)};font-weight:700;">${getMoraleEmoji(s)} ${getMoraleLabel(s,false)}</span>
 </div>
 ${skillsLineHtml}
 ${noteHtml}
 <div class="action-bar" id="actionbar-${s.id}">
 ${SURVIVOR_PANEL_ACTIONS.map(a=>{
 const available=actions.includes(a);
 const assigned=s.action?.type===a;
 const info=getActionIcons()[a]||{icon:'?',label:a};
 let cls='action-icon-btn';
 if(assigned) cls+=' assigned';
 else if(available&&canAct&&s.status!=='ocupado') cls+=' available';
 else cls+=' unavailable';
 return `<button class="${cls}" data-action="${a}" data-sid="${s.id}" title="${info.label}" ${((!available||!canAct||s.status==='ocupado')&&!assigned)?'disabled':''}>${info.icon}</button>`;
 }).join('')}
 </div>
 <div class="survivor-slot-grid">
 ${loreBtn}
 ${invBtn}
 ${dogBtn}
 ${futureBtn}
 </div>`;

 card.querySelectorAll('.action-icon-btn').forEach(btn=>{
 btn.addEventListener('click',()=>{
 const sid=btn.dataset.sid;
 const action=btn.dataset.action;
 const surv=state.survivors.find(x=>x.id===sid);
 if(!surv) return;
 const isLockedBuilder=surv.action?.type==='construir'&&surv.action?.target;
 if(isLockedBuilder){
 addLog(`${surv.name} está construyendo ${state.buildings[surv.action.target]?.name||'un edificio'} y no puede cambiar de acción.`);
 render();
 return;
 }
 if(surv.action?.type===action&&surv.status==='ocupado'){
 surv.status='activo'; surv.action=null;
 addLog(`${surv.name} cancela la acción.`);
 render(); return;
 }
 assignAction(sid, action);
 });
 });
 card.querySelector('.lore-btn').addEventListener('click',()=>openLoreModal(s));
 card.querySelector('.inv-btn').addEventListener('click',()=>openInventoryModal(s.id));
 const dogBtnNode=card.querySelector('.dog-btn');
 if(dogBtnNode && dog){
 dogBtnNode.addEventListener('click',()=>openDogPopup(s.id));
 }
 survivorList.appendChild(card);
 });
}

function renderBuildings(){
 const mapArea=document.getElementById('mapArea');
 if(!mapArea) return;
 const title=mapArea.querySelector('.map-title')?.outerHTML||'<div class="map-title">⬡ SECTOR ALFA — BASE</div>';
 const rawBuildings=getBaseMapBuildings();
 const canonicalGarage=rawBuildings.find(def=>String(def?.id||'').trim().toLowerCase()==='garaje') || rawBuildings.find(def=>String(def?.id||'').trim().toLowerCase()==='garage') || null;
 const seenGarageIds=new Set();
 const buildings=rawBuildings.filter(def=>{
 const id=String(def?.id||'').trim().toLowerCase();
 const name=String(def?.name||'').trim().toLowerCase();
 const isGarage=id==='garaje'||id==='garage'||name==='garaje'||name==='garage'||id.includes('garaj')||id.includes('garage')||name.includes('garaj')||name.includes('garage');
 if(!isGarage) return true;
 if(canonicalGarage && def!==canonicalGarage) return false;
 if(seenGarageIds.size) return false;
 seenGarageIds.add(String(def?.id||'garage'));
 return true;
 });
 const buttons=buildings.map(def=>{
 const b=state.buildings[def.id];
 if(!b||!def.map) return '';
 const style=`left:${def.map.left}; top:${def.map.top}; width:${def.map.width}; height:${def.map.height};${def.map.specialStyle?def.map.specialStyle:''}`;
 const classes=['building'];
 if(b.built&&!b.active) classes.push('inactive');
 if(!b.built) classes.push('unknown');
 const label=b.built?(b.id==='cementerio'?`${String(b.name||'Cementerio').replace(/\s*N\d+$/i,'')}`:`${b.name} N${b.level}`):`${b.name} `;
 return `<button class="${classes.join(' ')}" style="${style}" data-building="${escapeAttr(b.id)}">${escapeHtml(label)}</button>`;
 }).join('');
 mapArea.innerHTML=title+buttons;
 mapArea.querySelectorAll('.building').forEach(btn=>{
 btn.addEventListener('click',()=>{
 const buildingId=btn.dataset.building;
 if(buildingId==='cementerio'){
 showCemeteryDetail();
 return;
 }
 showBuildingDetail(buildingId);
 });
 });
}

function formatLogLine(line){
 const raw=String(line||'');
 const tokens=[];
 let safe=raw.replace(/<span class="log-item">([\s\S]*?)<\/span>/gi,(_,content)=>{
 const key=`__LOGITEM_${tokens.length}__`;
 tokens.push(`<span class="log-item">${escapeHtml(content)}</span>`);
 return key;
 });
 safe=escapeHtml(safe);
 safe=safe.replace(/(\+\d+)/g,'<span class="log-positive">$1</span>');
 safe=safe.replace(/(^|[\s(])(-\d+)(?=[\s).,]|$)/g,'$1<span class="log-negative">$2</span>');
 safe=safe.replace(/\b(forrajea|recicla|construye|construyendo|explora|descansa|ataca|defiende|investiga|viaja|saquea|desarrolla|vigila)\b/gi,'<span class="log-action">$1</span>');
 tokens.forEach((html,i)=>{ safe=safe.replace(`__LOGITEM_${i}__`, html); });
 return safe;
}

function renderLog(){
  const logBox=document.getElementById('logBox');
  if(!logBox) return;
  let html='';
  let lastDay=null;
  state.log.forEach(x=>{
    const dayMatch=String(x).match(/^Día (\d+):/);
    const day=dayMatch?Number(dayMatch[1]):null;
    if(day!==null && day!==lastDay){
      html+=`<div class="log-day-separator">📅 Día ${day}</div>`;
      lastDay=day;
    }
    x = replaceDynamicNameTokens(String(x));
    let cls='log-entry';
    const t=String(x).toLowerCase();
    if(String(x).includes('👍')||t.includes('amenaza superada')||t.includes('amenaza resuelta con éxito')) cls+=' log-threat-success';
    else if(String(x).includes('👎')||t.includes('amenaza fallida')||t.includes('amenaza no superada')||t.includes('fracasa frente a la amenaza')) cls+=' log-threat-failure';
    else if(String(x).includes('💀')||t.includes('muere')||t.includes('muerto')||t.includes('fallece')) cls+=' log-muerto';
    else if(String(x).includes('🩸')||t.includes('herido')) cls+=' log-herido';
    else if(String(x).startsWith('★')) cls+=' log-skill';
    else if(String(x).includes('🧭')||String(x).includes('🗺')) cls+=' log-explore';
    else if(t.includes('forraje')) cls+=' log-forraje';
    else if(t.includes('recicla')) cls+=' log-reciclar';
    else if(t.includes('constru')) cls+=' log-construir';
    else if(t.includes('descans')) cls+=' log-descansar';
    else if(t.includes('ataca')||t.includes('ataque')||t.includes('emboscada')||t.includes('combate')||t.includes('defensa')||t.includes('repelido')) cls+=' log-atacar';
    const plainText=String(x).replace(/^Día \d+: /,'');
    html+=`<div class="${cls}">${formatLogLine(plainText)}</div>`;
  });
  logBox.innerHTML=`<div class="log-rail">${html}</div>`;
  applyLogVirtualOffset();
}

function isPopupOpenForStack(el){
 if(!el) return false;
 if(el.id === 'buildingDetailPanel'){
 return getComputedStyle(el).display !== 'none';
 }
 if(el.classList && el.classList.contains('overlay')){
 return el.classList.contains('open');
 }
 return false;
}

function refreshPopupStack(){
 const popups = [...document.querySelectorAll('.overlay, #buildingDetailPanel')].filter(isPopupOpenForStack);
 popups.sort((a,b)=>Number(a.dataset.stackOrder||0)-Number(b.dataset.stackOrder||0));
 const baseZ = 1500;
 popups.forEach((el, idx)=>{
 el.style.zIndex = String(baseZ + idx);
 });
}

function initPopupStacking(){
 const popups = document.querySelectorAll('.overlay, #buildingDetailPanel');
 const observer = new MutationObserver((mutations)=>{
 let needsRefresh = false;
 const seen = new Set();
 mutations.forEach(mutation=>{
 const el = mutation.target;
 if(!el || seen.has(el)) return;
 seen.add(el);
 const isOpen = isPopupOpenForStack(el);
 const hasOrder = !!el.dataset.stackOrder;
 if(isOpen && !hasOrder){
 el.dataset.stackOrder = String(++popupStackCounter);
 needsRefresh = true;
 } else if(!isOpen && hasOrder){
 delete el.dataset.stackOrder;
 el.style.zIndex = '';
 needsRefresh = true;
 } else if(isOpen){
 needsRefresh = true;
 }
 });
 if(needsRefresh) refreshPopupStack();
 });

 popups.forEach(el=>{
 observer.observe(el, { attributes:true, attributeFilter:['class','style'] });
 if(isPopupOpenForStack(el) && !el.dataset.stackOrder){
 el.dataset.stackOrder = String(++popupStackCounter);
 }
 });

 refreshPopupStack();
}

function openBuildingPopup(){
 const panel=document.getElementById('buildingDetailPanel');
 if(panel) panel.style.display='flex';
}

function closeBuildingPopup(){
 const panel=document.getElementById('buildingDetailPanel');
 if(panel) panel.style.display='none';
 state.currentDetail=null;
}

function showBuildingDetail(id){
 if(id==='cementerio'){
 showCemeteryDetail();
 return;
 }
 if(typeof renderAbandonedDetail==='function' && renderAbandonedDetail(id)) return;
 if(/^cantina_/.test(String(id||'')) && typeof showCantinaDetail==='function' && showCantinaDetail(id)) return;
 if(/^sala_comun_/.test(String(id||'')) && typeof showSalaComunDetail==='function' && showSalaComunDetail(id)) return;
 const b=state.buildings[id];
 if(!b) return;
 state.currentDetail=id;
 const def=getBuildingDef(id)||{};
 const capacity=id==='barracones'?barracksCapacity():null;
 const overflow=id==='barracones'?Math.max(0,aliveSurvivors().length-capacity):null;
 const statusStr=b._underConstruction?`🔨 En construcción (${b._constructionDaysLeft||0} día${(b._constructionDaysLeft||0)!==1?'s':''} restante${(b._constructionDaysLeft||0)!==1?'s':''})`:b.built?(b.active?'✅ Activo':'⚠️ Inactivo'):'🔒 Sin construir';

 function getLevelEffect(id, level){
 const lvl=level||1;
 const levelEffects=def?.levelEffects||b.levelEffects||{};
 const jsonLevelEffect=levelEffects?.[String(lvl)] ?? levelEffects?.[lvl];
 if(jsonLevelEffect) return String(jsonLevelEffect);
 if(id==='huerto') return (typeof getFarmProductionText==='function') ? getFarmProductionText(b, state.day) : `+${lvl} comida por día`; 
 if(id==='taller') return `+${lvl} material por día`;
 if(id==='barracones') return `${lvl*4} espacios para supervivientes`;
 if(id==='muros') return `+${lvl>=2?2:1} defensa pasiva`;
 if(id==='atalaya') return `+${lvl>=2?3:2} defensa con Vigilar`;
 const biodieselBonus=state.baseUpgrades?.biodiesel?getBaseUpgradeEffectNumber('biodiesel','generatorCapacityBonus',1):0;
 if(id==='generador') return `${lvl>=3?5:lvl===2?4:3}${biodieselBonus?`+${biodieselBonus}`:''}⚡ de capacidad eléctrica`;
 if(id==='pozo') return `Requisito para mejorar el Huerto a nivel 3`;
 if(id==='gallinero') return `0-1 gallinas: 0 comida · 2: +1 · 3-6: +2 · 7-10: +3`;
 if(id==='almacen') return 'Capacidad: 4 objetos fabricados';
 return b.desc||'';
 }

 const effectDesc=b.built?getLevelEffect(id,b.level):(b.desc||getLevelEffect(id,1));
 const buildingImage=b.image||def.image||'';
 const buildingDescription=(b.description||def.description||def.text||def.effectDescription||def.effect||b.desc||'Sin descripción adicional.').trim();
 const imageHtml=buildingImage
 ? `<img src="${escapeAttr(buildingImage)}" alt="${escapeAttr(b.name)}" style="width:100%;height:100%;object-fit:cover;display:block;">`
 : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">Sin imagen</div>';

 let extraMetrics='';
 let actionButtons='';
 if(id==='huerto'){
 const modeLabel=(typeof getFarmModeLabel==='function') ? getFarmModeLabel(b.farmMode) : 'Sin mejora';
 const prodLabel=(typeof getFarmProductionText==='function') ? getFarmProductionText(b, state.day) : '+2 comida por día';
 extraMetrics+=`<div class="metric"><span>Producción actual</span><b>${escapeHtml(prodLabel)}</b></div>`;
 if(Number(b.level||0)>=2){
  extraMetrics+=`<div class="metric"><span>Modo de cultivo</span><b>${escapeHtml(modeLabel)}</b></div>`;
  actionButtons+=`<button class="secondary" onclick="setFarmMode('cultivo_a')" ${String(b.farmMode||'').toLowerCase()==='cultivo_a'?'disabled':''}>Cultivo A</button>`;
  actionButtons+=`<button class="secondary" onclick="setFarmMode('cultivo_b')" ${String(b.farmMode||'').toLowerCase()==='cultivo_b'?'disabled':''}>Cultivo B</button>`;
 }
 }
 if(id==='gallinero'){
 const prod=getChickenProduction(state.chickens);
 const chickenMax=getGallineroMaxChickens();
 const sacrificeCfg=getChickenSacrificeConfig();
 extraMetrics+=`<div class="metric"><span>Gallinas</span><b>${state.chickens} / ${chickenMax}</b></div><div class="metric"><span>Producción actual</span><b>${prod>0?`+${prod} comida/día`:'Sin producción'}</b></div>`;
 if(b.built){
 actionButtons+=`<button class="secondary" onclick="sacrificeChicken()" ${state.chickens<sacrificeCfg.chickensCost?'disabled':''}>Sacrificar gallina (+${sacrificeCfg.foodGain} comida)</button>`;
 }
 }
 if(id==='taller'&&b.built&&Number(b.level||0)>=2){
 const baseUpgrades=getBaseUpgradesCatalog();
 const built=baseUpgrades.filter(up=>state.baseUpgrades?.[up.id]).map(up=>up.name).join(', ')||'Ninguna';
 const inProgress=baseUpgrades.map(up=>({up,project:getBaseUpgradeProject(up.id)})).filter(x=>x.project?.active).map(x=>`${x.up.name} (${x.project.daysLeft}d)`).join(', ')||'Ninguna';
 extraMetrics+=`<div class="metric"><span>Mejoras de base</span><b>${escapeHtml(built)}</b></div><div class="metric"><span>En desarrollo</span><b>${escapeHtml(inProgress)}</b></div>`;
 actionButtons+=`<button class="secondary" onclick="openBaseUpgradesModal()">Mejoras de base</button>`;
 }
 if(id==='barracon_medico'&&b.built){
 const curableLevel=getMedicalBarracksCurableLevel();
 const targetCount=curableLevel?getMedicalBarracksTargets(curableLevel).length:0;
 const actionLabel=curableLevel?`Curar herida ${curableLevel}`:'Acción no disponible';
 const actionDisabled=(!b.active||!curableLevel||b._usedToday)?'disabled':'';
 const actionNote=!b.active?'Sin energía':(b._usedToday?'Ya usado hoy':(curableLevel?`${targetCount} objetivo${targetCount!==1?'s':''} disponible${targetCount!==1?'s':''}`:'Nivel insuficiente'));
 extraMetrics+=`<div class="metric"><span>Acción diaria</span><b>${escapeHtml(actionNote)}</b></div>`;
 actionButtons+=`<button class="secondary" onclick="openMedicalBarracksTreatment()" ${actionDisabled}>${escapeHtml(actionLabel)}</button>`;
 }
 if(id==='almacen'&&b.built){
 actionButtons+=`<button class="secondary" onclick="openStorageModal()">Abrir almacén</button>`;
 }
 if(id==='cementerio'){
 actionButtons+=`<button class="secondary" onclick="showCemeteryDetail()">Abrir cementerio</button>`;
 }
 const buildingNpcs=(typeof getNpcsForBuilding==='function') ? getNpcsForBuilding(id) : [];
 const npcHtml=buildingNpcs.length?`<div class="metric" style="grid-column:1/-1;display:block;"><span style="display:block;margin-bottom:8px;">Personal asignado</span><b style="display:block;"><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">${buildingNpcs.map(npc=>`<button type="button" onclick="launchNpcInteraction('${escapeAttr(String(npc.id||''))}')" title="${escapeAttr(npc.name||'NPC')} · confianza ${Number(npc.trust||0)}" style="width:52px;height:52px;border:1px solid var(--line2);background:var(--panel2);padding:0;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center;">${npc.portrait||npc.image?`<img src="${escapeAttr(npc.portrait||npc.image)}" alt="${escapeAttr(npc.name||'NPC')}" style="width:100%;height:100%;object-fit:cover;display:block;">`:`<span style="font-size:20px;color:var(--amber-bright);">👤</span>`}</button>`).join('')}</div></b></div>`:'';

 detailBox.innerHTML=`
 <div style="display:grid;grid-template-columns:minmax(220px,260px) 1fr;gap:16px;align-items:start;">
 <div>
 <div style="border:1px solid var(--line2);background:var(--panel2);min-height:220px;overflow:hidden;">${imageHtml}</div>
 <div style="margin-top:10px;border:1px solid var(--line2);background:rgba(255,255,255,0.02);padding:12px 14px;font-family:var(--font-worn);font-size:13px;line-height:1.7;color:var(--text);">${escapeHtml(buildingDescription)}</div>
 </div>
 <div class="detail-grid">
 <div class="metric"><span>Edificio</span><b>${escapeHtml(b.name)}</b></div>
 <div class="metric"><span>Estado</span><b>${statusStr}</b></div>
 <div class="metric"><span>Nivel</span><b>${b.level} / ${b.maxLevel||5}</b></div>
 <div class="metric"><span>Efecto actual</span><b>${escapeHtml(effectDesc)}</b></div>
 <div class="metric"><span>Coste mejora</span><b>${b.constructible ? getBuildingCost(b.id)+' 🔧' : '— bloqueado'}</b></div>
 ${capacity!==null?`<div class="metric"><span>Capacidad</span><b>${capacity} personas</b></div>`:''}
 ${overflow!==null&&overflow>0?`<div class="metric"><span style="color:var(--danger-bright)">⚠ Saturado</span><b style="color:var(--danger-bright)">+${overflow} sin espacio</b></div>`:''}
 ${extraMetrics}
 ${npcHtml}
 ${actionButtons?`<div class="metric" style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">${actionButtons}</div>`:''}
 </div>
 </div>`;
 openBuildingPopup();
}

function openBuildModal(survivorId){
 const s=state.survivors.find(x=>x.id===survivorId);
 buildOptions.innerHTML='';
 (gameData.buildings||[]).forEach(def=>{
 const current=state.buildings[def.id];
 // Constructible: check base flag + special unlock conditions
 let constructible=current?.constructible===true;
 // Generador requires taller level >= 2
 if(def.id==='generador'&&(state.buildings.taller?.level||0)<2) constructible=false;

 const maxLevel=Number(def.maxLevel||5);
 const currentLevel=current?.level||0;
 const atCap=currentLevel>=maxLevel;
 const buildCost=getBuildingCost(def.id);

 // Electricity requirement check
 const elecReq=getBuildingElectricityCost(def.id)||0;
 const hasElec=elecReq===0||(getElectricityFree()>=elecReq)||current?.built;
 const elecLabel=elecReq>0&&!current?.built?` · Requiere ${elecReq}⚡ (libre: ${getElectricityFree()})` : elecReq>0&&current?.built?` · Usando ${elecReq}⚡`:'';

const nextLevel=(current?.level||0)+1;
const upgradeReqs=getBuildingUpgradeRequirements(def.id, nextLevel);
const missingReqs=upgradeReqs.filter(req=>!buildingIsReady(req));
const blocked=!constructible||missingReqs.length>0;
const blockReason=missingReqs.length
 ? `Requiere: ${missingReqs.map(req=>formatBuildingRequirement(req)).join(', ')}`
 : def.id==='generador'&&(state.buildings.taller?.level||0)<2?'Requiere Taller nivel 2':'';

 const label=blocked?`${def.name} (bloqueado)`:current?.built?`Mejorar ${def.name}`:`Construir ${def.name}`;
 const displayCost=blocked?Number(def.cost||0):buildCost;
 const box=document.createElement('div');
 box.className='build-option';
 const constructDays=getBuildingConstructionDays(def.id, nextLevel);
 const timeLabel=constructDays===1?'1 día':`${constructDays} días`;
 box.innerHTML=`<div><div><b>${escapeHtml(label)}</b></div><div class="mini">Coste: ${displayCost} 🔧${elecLabel} · ⏱ ${timeLabel} · ${blockReason?`<span style="color:var(--warn-bright)">${blockReason}</span> · `:''}${escapeHtml(def.effect||'')} · Nivel máx. ${maxLevel}</div></div><button ${blocked||atCap||state.materials<buildCost||!hasElec?'disabled':''}>${atCap?'Máximo':'Elegir'}</button>`;
 box.querySelector('button').addEventListener('click',()=>{
 if(blocked||atCap) return;
 const cost=getBuildingCost(def.id);
 const ingenieroBonus=getSkillBonus(s,'build');
 const finalCost=Math.max(1,cost-(ingenieroBonus.costReduction||0));
 if(state.materials<finalCost) return;
 if(elecReq>0&&getElectricityFree()<elecReq){ addLog('No hay suficiente electricidad libre.'); return; }
 // Deduct resources immediately
 state.materials-=finalCost;
 if(ingenieroBonus.costReduction) addLog(`⚙ ${s.name} (Ingeniero) reduce el coste en ${ingenieroBonus.costReduction} material.`);
 // Don't mark as built yet — track construction in progress
 const days=getBuildingConstructionDays(def.id, nextLevel);
 if(getStabilityModifiers().extraBuildDays>0){
 addLog('⚠ La baja estabilidad del asentamiento ralentiza el trabajo. +1 día.');
 }
 state.buildings[def.id]._constructionCost=finalCost;
 state.buildings[def.id]._lastConstructionCost=finalCost;
 state.buildings[def.id]._constructionDays=days;
 state.buildings[def.id]._constructionDaysLeft=days;
 state.buildings[def.id]._underConstruction=true;
 s.action={type:'construir',target:def.id};
 s.status='ocupado';
 const dayStr=days===1?'1 día':`${days} días`;
 addLog(`🔨 ${s.name} comienza a construir ${state.buildings[def.id].name}. -${finalCost} mat. Tiempo: ${dayStr}.`);
 buildModalWrap.classList.remove('open');
 render();
 });
 buildOptions.appendChild(box);
 });
 buildModalWrap.classList.add('open');
}

function openFoodChoicePopup(){
 const {canFeed,survivors,npcs}=state._pendingFoodChoice;
 const popup=document.getElementById('foodChoicePopup');
 const text=document.getElementById('foodChoiceText');
 const list=document.getElementById('foodChoiceList');
 const npcList=Array.isArray(npcs)?npcs:[];

 text.textContent=`Solo hay ${canFeed} ración${canFeed!==1?'es':''} para ${survivors.length + npcList.length} bocas. Elige quién come (máx. ${canFeed}):`;

 list.innerHTML='';
 const selected=new Set();

 survivors.forEach(s=>{
 const item=document.createElement('div');
 item.style.cssText='display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line2);cursor:pointer;background:var(--panel2);';
 const moraleColor=getMoraleColor(s);
 item.innerHTML=`<div style="width:44px;height:44px;overflow:hidden;border:1px solid var(--line2);flex-shrink:0;">${getSurvivorImage(s)?`<img src="${escapeAttr(getSurvivorImage(s))}" style="width:100%;height:100%;object-fit:cover;filter:grayscale(20%);">`:'<div style="width:44px;height:44px;background:var(--panel3);"></div>'}</div><div style="flex:1;"><div style="font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:0.06em;">${escapeHtml(s.name)}</div><div style="font-size:11px;color:var(--muted);margin-top:2px;">${s.status}</div><div style="font-size:12px;color:${moraleColor};margin-top:2px;">${getMoraleEmoji(s)} ${getMoraleLabel(s)}</div></div><div id="food-check-${s.id}" style="font-size:20px;color:var(--muted);">○</div>`;
 item.addEventListener('click',()=>{
 if(selected.has(s.id)){
 selected.delete(s.id);
 item.style.borderColor='var(--line2)';
 item.style.background='var(--panel2)';
 document.getElementById('food-check-'+s.id).textContent='○';
 document.getElementById('food-check-'+s.id).style.color='var(--muted)';
 } else if(selected.size<canFeed){
 selected.add(s.id);
 item.style.borderColor='var(--ok)';
 item.style.background='var(--ok-glow)';
 document.getElementById('food-check-'+s.id).textContent='●';
 document.getElementById('food-check-'+s.id).style.color='var(--ok-bright)';
 }
 });
 list.appendChild(item);
 });

 npcList.forEach(npc=>{
 const item=document.createElement('div');
 item.style.cssText='display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line2);cursor:pointer;background:var(--panel2);';
 const portrait=npc.portrait||npc.image||'';
 item.innerHTML=`<div style="width:44px;height:44px;overflow:hidden;border:1px solid var(--line2);flex-shrink:0;">${portrait?`<img src="${escapeAttr(portrait)}" style="width:100%;height:100%;object-fit:cover;filter:grayscale(20%);">`:'<div style="width:44px;height:44px;background:var(--panel3);display:flex;align-items:center;justify-content:center;color:var(--amber-bright);font-size:18px;">👤</div>'}</div><div style="flex:1;"><div style="font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:0.06em;">${escapeHtml(npc.name||'NPC')}</div><div style="font-size:11px;color:var(--muted);margin-top:2px;">NPC reclutado</div><div style="font-size:12px;color:var(--amber-bright);margin-top:2px;">Confianza ${Number(npc.trust||0)}</div></div><div id="food-check-${npc.id}" style="font-size:20px;color:var(--muted);">○</div>`;
 item.addEventListener('click',()=>{
  if(selected.has(npc.id)){
   selected.delete(npc.id);
   item.style.borderColor='var(--line2)';
   item.style.background='var(--panel2)';
   document.getElementById('food-check-'+npc.id).textContent='○';
   document.getElementById('food-check-'+npc.id).style.color='var(--muted)';
  } else if(selected.size<canFeed){
   selected.add(npc.id);
   item.style.borderColor='var(--ok)';
   item.style.background='var(--ok-glow)';
   document.getElementById('food-check-'+npc.id).textContent='●';
   document.getElementById('food-check-'+npc.id).style.color='var(--ok-bright)';
  }
 });
 list.appendChild(item);
 });

 popup.classList.add('open');

 document.getElementById('foodChoiceConfirm').onclick=()=>{
 popup.classList.remove('open');
 resolveFoodChoice([...selected]);
 maybeContinueEndDayAfterPause();
 };
}

function openTechnicalLogModal(){
 const modal = document.getElementById('technicalLogModal');
 const box = document.getElementById('technicalLogText');
 if(box) box.value = getTechnicalLogText();
 if(modal) modal.classList.add('open');
}

function closeTechnicalLogModal(){
 const modal=document.getElementById('technicalLogModal');
 if(modal) modal.classList.remove('open');
}

function downloadTechnicalLog(){
 const txt = getTechnicalLogText();
 const blob = new Blob([txt], {type:'text/plain;charset=utf-8'});
 const a = document.createElement('a');
 a.href = URL.createObjectURL(blob);
 a.download = `resurgir_log_tecnico_dia_${state.day}.txt`;
 document.body.appendChild(a);
 a.click();
 setTimeout(() => {
 URL.revokeObjectURL(a.href);
 a.remove();
 }, 0);
}

function openInventoryModal(survivorId){
 const survivor=state.survivors.find(s=>s.id===survivorId);
 if(!survivor) return;
 survivor.inventory = normalizeInventoryList(survivor.inventory||[]);
 const modal=document.getElementById('inventoryModal');
 const title=document.getElementById('inventoryModalTitle');
 const summary=document.getElementById('inventoryModalSummary');
 const list=document.getElementById('inventoryModalList');
 const tools=document.getElementById('inventoryModalTools');
 if(!modal||!title||!summary||!list||!tools) return;
 title.textContent = `🎒 Mochila · ${survivor.name}`;
 const equippedNames = getEquippedItems(survivor).map(it=>it.name);
 summary.textContent = `${getInventorySummaryText(survivor.inventory, survivor.inventorySlots||3)}${equippedNames.length ? ` · Equipado: ${equippedNames.join(', ')}` : ''}`;
 tools.innerHTML = `
 <button class="btn secondary" onclick="equipAllSurvivorItems('${survivor.id}')">Equipar todo</button>
 <button class="btn secondary" onclick="unequipAllSurvivorItems('${survivor.id}')">Desequipar todo</button>`;
 if(!survivor.inventory.length){
 list.innerHTML = '<div style="color:var(--dim);text-align:center;padding:12px 0;">// Mochila vacía.</div>';
 } else {
 const transferTargets=getTransferableSurvivorTargets(survivor.id);
 list.innerHTML = survivor.inventory.map((raw,i)=>{
 const item=materializeItem(raw);
 const disabledMove=isExteriorSurvivor(survivor);
 const canEquip=canEquipItem(survivor, item) && (item.itemType==='consumable' || item.quality>0);
 const equipped=isItemEquippedBySurvivor(survivor,item);
 const transferControl=transferTargets.length
 ? `<div class="item-transfer-inline"><button class="btn secondary" onclick="transferSurvivorItemToSurvivor('${survivor.id}',${i},document.getElementById('itemTransferTarget_${escapeAttr(survivor.id)}_${i}').value)">Entregar a</button><select id="itemTransferTarget_${escapeAttr(survivor.id)}_${i}">${transferTargets.map(target=>`<option value="${escapeAttr(target.id)}">${escapeHtml(target.name)}</option>`).join('')}</select></div>`
 : '<span class="item-transfer-empty">No hay otros supervivientes disponibles.</span>';
 return `<div class="item-card">
 <div class="item-title">${escapeHtml(item.name)}</div>
 <div class="item-meta">${escapeHtml(item.description||'')} · ${getItemTypeLabel(item)} · ${escapeHtml(getQualityText(item))}${item.repairSkill?` · Reparación: ${escapeHtml(item.repairSkill)}`:''}${equipped?' · Equipado':''}</div>
 <div class="item-actions">
 <button class="btn secondary" onclick="useSurvivorItem('${survivor.id}',${i})" ${canEquip?'':'disabled'}>${item.itemType==='consumable'?'Usar':(equipped?'Quitar':'Equipar')}</button>
 <button class="btn secondary" onclick="moveSurvivorItemToBase('${survivor.id}',${i})" ${disabledMove?'disabled':''}>Guardar en base</button>
 ${transferControl}
 </div>
 </div>`;
 }).join('');
 }
 modal.classList.add('open');
}

function closeInventoryModal(){
 const modal=document.getElementById('inventoryModal');
 if(modal) modal.classList.remove('open');
}

function openStorageModal(){
 closeBuildingPopup();
 state.inventory = normalizeInventoryList(state.inventory||[]);
 const modal=document.getElementById('storageModal');
 const summary=document.getElementById('storageModalSummary');
 const list=document.getElementById('storageModalList');
 if(!modal||!summary||!list) return;
 const slots=4 + (state.buildings.almacen?.level||1)*2;
 summary.textContent = `${(state.inventory||[]).length} / ${slots} objetos guardados.`;
 if(!state.inventory.length){
 list.innerHTML='<div style="color:var(--dim);text-align:center;padding:12px 0;">// Almacén vacío.</div>';
 } else {
 const baseSurvivors=getBaseSurvivorsForInventory();
 list.innerHTML = state.inventory.map((raw,i)=>{
 const item=materializeItem(raw);
 const assignBtns=baseSurvivors.map(s=>{
 const disabled = inventoryUsedSlots(s.inventory||[]) >= Number(s.inventorySlots||3) || !canEquipItem(s, item);
 const title = !canEquipItem(s,item) ? `Requiere ${item.requiredSkill}` : '';
 return `<button class="btn secondary" onclick="moveBaseItemToSurvivor(${i},'${s.id}')" ${disabled?'disabled':''} title="${escapeAttr(title)}">Dar a ${escapeHtml(s.name)}</button>`;
 }).join(' ');
 const baseUseBtn = item.itemType==='consumable' ? `<button class="btn secondary" onclick="useBaseInventoryItem(${i})">Usar en base</button>` : '';
 return `<div class="item-card">
 <div class="item-title">${escapeHtml(item.name)}</div>
 <div class="item-meta">${escapeHtml(item.description||'')} · ${getItemTypeLabel(item)} · ${escapeHtml(getQualityText(item))}</div>
 <div class="item-actions">${assignBtns || '<span style="color:var(--dim);font-size:11px;">No hay survivors en base disponibles.</span>'} ${baseUseBtn}</div>
 </div>`;
 }).join('');
 }
 modal.classList.add('open');
}

function closeStorageModal(){
 const modal=document.getElementById('storageModal');
 if(modal) modal.classList.remove('open');
}

function openRepairModal(){
 const modal=document.getElementById('repairModal');
 const summary=document.getElementById('repairModalSummary');
 const list=document.getElementById('repairModalList');
 if(!modal||!summary||!list) return;
 const rows=collectRepairableItems();
 const hasManitas=aliveSurvivors().some(s=>!isExteriorSurvivor(s)&&survivorHasSkill(s,'manitas'));
 summary.textContent = `Materiales: ${state.materials} · ${hasManitas?'Hay un survivor con manitas en base.':'No hay nadie con manitas en base.'}`;
 if(!rows.length){
 list.innerHTML='<div style="color:var(--dim);text-align:center;padding:12px 0;">// No hay objetos reparables.</div>';
 } else {
 list.innerHTML = rows.map(row=>{
 const item=row.item;
 const cost=getRepairCost(item);
 const disabled=!canRepairItemWithCurrentBase(item);
 return `<div class="item-card">
 <div class="item-title">${escapeHtml(item.name)}${row.owner?` · ${escapeHtml(row.owner.name)}`:' · Almacén'}</div>
 <div class="item-meta">${getItemTypeLabel(item)} · ${item.quality}/${item.maxQuality} · Coste ${cost} materiales${item.repairSkill?` · Requiere ${escapeHtml(item.repairSkill)}`:''}</div>
 <div class="item-actions"><button class="btn secondary" onclick="repairItemFromRow('${row.scope}','${row.owner?row.owner.id:''}',${row.index})" ${disabled?'disabled':''}>Reparar</button></div>
 </div>`;
 }).join('');
 }
 modal.classList.add('open');
}

function closeRepairModal(){
 const modal=document.getElementById('repairModal');
 if(modal) modal.classList.remove('open');
}

// ── UI extracted in phase C from legacy-app.js ──

function openDogPopup(ownerId){
 if(!state.dog){ addLog('🐕 No hay perro en el asentamiento.'); render(); return; }
 const popup=document.getElementById('decidePopup');
 const promptEl=document.getElementById('decidePrompt');
 const optionsEl=document.getElementById('decideOptions');
 if(!popup||!promptEl||!optionsEl) return;
 const owner=getAliveSurvivorById(ownerId)||ensureDogOwner();
 const dog=state.dog;
 const targets=getDogPopupTargets(owner?.id||null);
 promptEl.innerHTML=`<div style="font-family:var(--font-display);font-size:16px;letter-spacing:0.08em;color:var(--ok-bright);margin-bottom:6px;">🐕 ${escapeHtml(dog.name||'Perro')}</div><div style="font-size:12px;line-height:1.6;color:var(--text);">${escapeHtml(dog.description||'Compañero canino del asentamiento.')}</div><div style="margin-top:8px;font-size:11px;color:var(--muted);">Ahora mismo sigue a <b style="color:var(--text);">${escapeHtml(owner?.name||'nadie')}</b>.</div>`;
 optionsEl.innerHTML='';
 if(targets.length){
 targets.forEach(target=>{
 const btn=document.createElement('button');
 btn.className='btn secondary';
 btn.style.cssText='text-align:left;padding:10px 14px;line-height:1.5;';
 btn.innerHTML=`<div style="font-family:var(--font-display);font-size:13px;letter-spacing:0.05em;">Seguir a ${escapeHtml(target.name)}</div><div style="font-size:10px;color:var(--muted);margin-top:3px;">Activo · ${getMoraleLabel(target)} · fatiga ${target.fatigue}/${target.maxFatigue}</div>`;
 btn.addEventListener('click',()=>assignDogToSurvivor(target.id));
 optionsEl.appendChild(btn);
 });
 }else{
 const empty=document.createElement('div');
 empty.style.cssText='border:1px solid var(--line2);padding:10px 12px;font-size:11px;color:var(--muted);background:rgba(255,255,255,0.03);line-height:1.6;';
 empty.textContent='No hay otro superviviente activo al que asignar el perro ahora mismo.';
 optionsEl.appendChild(empty);
 }
 const cancelBtn=document.createElement('button');
 cancelBtn.className='btn';
 cancelBtn.textContent='Cancelar';
 cancelBtn.addEventListener('click',()=>popup.classList.remove('open'));
 optionsEl.appendChild(cancelBtn);
 popup.classList.add('open');
}

function closeDeparturePopup(){
 document.getElementById('departurePopup')?.classList.remove('open');
 if(Array.isArray(state.departureQueue) && state.departureQueue.length) state.departureQueue.shift();
 if(Array.isArray(state.departureQueue) && state.departureQueue.length) openNextDeparturePopup();
}

function openNextDeparturePopup(){
 const entry=Array.isArray(state.departureQueue) ? state.departureQueue[0] : null;
 if(!entry) return;
 const popup=document.getElementById('departurePopup');
 const portrait=document.getElementById('departurePopupPortrait');
 const nameEl=document.getElementById('departurePopupName');
 const titleEl=document.getElementById('departurePopupTitle');
 const textEl=document.getElementById('departurePopupText');
 const effectsEl=document.getElementById('departurePopupEffects');
 if(!popup||!portrait||!nameEl||!titleEl||!textEl||!effectsEl) return;
 titleEl.textContent = entry.betrayed ? 'Traición y abandono' : 'Abandono del asentamiento';
 nameEl.textContent = entry.name || 'Superviviente';
 portrait.innerHTML = entry.imageUrl ? `<img src="${escapeAttr(entry.imageUrl)}" style="width:100%;height:100%;object-fit:cover;">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:42px;">🚪</div>';
 textEl.textContent = entry.text || `${entry.name} abandona la base por baja moral.`;
 effectsEl.innerHTML = formatLogLine(entry.effectsText || '-2 estabilidad');
 popup.classList.add('open');
}

function openGroupActionPopup(){
 resetGroupActionDraft(false);
 if(!getGroupActionEligibleSurvivors().length){
 addLog('🤝 No hay supervivientes activos en la base disponibles para una acción grupal.');
 render();
 return;
 }
 renderGroupActionPopup();
 document.getElementById('groupActionPopup')?.classList.add('open');
}

function closeGroupActionPopup(){
 document.getElementById('groupActionPopup')?.classList.remove('open');
}

function setGroupAction(action){
 const available=getAvailableGroupActions();
 if(!available.includes(action)) return;
 state._groupActionDraft={action,members:[]};
 renderGroupActionPopup();
}

function toggleGroupActionMember(survivorId){
 if(!state._groupActionDraft?.action) return;
 const eligible=getGroupActionEligibleSurvivors(state._groupActionDraft.action).map(s=>String(s.id));
 const id=String(survivorId);
 if(!eligible.includes(id)) return;
 const members=Array.isArray(state._groupActionDraft.members)?[...state._groupActionDraft.members]:[];
 const idx=members.findIndex(x=>String(x)===id);
 if(idx>=0) members.splice(idx,1);
 else members.push(id);
 state._groupActionDraft.members=members;
 renderGroupActionPopup();
}

function renderGroupActionPopup(){
 resetGroupActionDraft(false);
 const iconsWrap=document.getElementById('groupActionIcons');
 const listWrap=document.getElementById('groupActionSurvivorList');
 const summary=document.getElementById('groupActionSummary');
 const confirmBtn=document.getElementById('groupActionConfirm');
 if(!iconsWrap||!listWrap||!summary||!confirmBtn) return;
 const availableActions=getAvailableGroupActions();
 const selectedAction=state._groupActionDraft?.action;
 iconsWrap.innerHTML=availableActions.map(action=>{
 const info=getActionIcons()[action]||{icon:'?',label:actionLabel(action)};
 const isSelected=selectedAction===action;
 return `<button class="action-icon-btn ${isSelected?'assigned':'available'}" style="width:42px;height:42px;font-size:21px;" data-group-action="${escapeAttr(action)}" title="${escapeAttr(info.label)}">${info.icon}</button>`;
 }).join('');
 iconsWrap.querySelectorAll('[data-group-action]').forEach(btn=>btn.addEventListener('click',()=>setGroupAction(btn.dataset.groupAction)));

 const survivors=getGroupActionEligibleSurvivors(selectedAction);
 const selectedIds=Array.isArray(state._groupActionDraft?.members)?state._groupActionDraft.members.map(String):[];
 summary.textContent=selectedIds.length ? `★ líder: ${((state.survivors.find(s=>String(s.id)===selectedIds[0])||{}).name||'')} · apoyo: ${Math.max(0, selectedIds.length-1)}` : 'Selecciona primero al líder';

 if(!selectedAction){
 listWrap.innerHTML='<div class="group-action-empty">No hay acciones grupales disponibles.</div>';
 confirmBtn.disabled=true;
 return;
 }
 if(!survivors.length){
 listWrap.innerHTML='<div class="group-action-empty">No hay supervivientes compatibles con esa acción.</div>';
 confirmBtn.disabled=true;
 return;
 }
 listWrap.innerHTML=survivors.map(s=>{
 const selectedIndex=selectedIds.findIndex(id=>id===String(s.id));
 const isSelected=selectedIndex>=0;
 const isLeader=selectedIndex===0;
 const img=getSurvivorImage(s);
 const avatar=img?`<img src="${escapeAttr(img)}" alt="" style="width:56px;height:56px;object-fit:cover;display:block;filter:${hasActiveInjury(s)?'grayscale(30%) sepia(20%) brightness(0.85)':'grayscale(20%)'}">`:'<div class="avatar" style="width:56px;height:56px;">Sin<br>imagen</div>';
 return `<div class="group-action-survivor ${isSelected?'selected':''} ${isLeader?'leader':''}" data-group-survivor="${escapeAttr(s.id)}">
 <div style="width:56px;height:56px;overflow:hidden;border:1px solid var(--line2);background:var(--panel3);">${avatar}</div>
 <div>
 <div style="font-family:var(--font-display);font-size:14px;letter-spacing:0.05em;color:var(--text);">${escapeHtml(s.name)}</div>
 <div style="font-size:11px;color:var(--muted);margin-top:2px;">Fatiga ${s.fatigue}/${s.maxFatigue} · ${hasActiveInjury(s)?'Herida '+escapeHtml(injuryDisplayName(s.injuryLevel||'simple')):'Sin herida'} · <span style="color:${getMoraleColor(s)};">${getMoraleEmoji(s)} ${getMoraleLabel(s,false)}</span></div>
 </div>
 <div class="group-action-star">${isLeader?'★':(isSelected?'•':'○')}</div>
 </div>`;
 }).join('');
 listWrap.querySelectorAll('[data-group-survivor]').forEach(node=>node.addEventListener('click',()=>toggleGroupActionMember(node.dataset.groupSurvivor)));
 confirmBtn.disabled=selectedIds.length===0;
}

function openGameOver(text){document.getElementById('gameOverText').textContent=text;gameOverWrap.classList.add('open')}

function openCombatResultPopup({title,text,icon='⚔',summary=[],effects=[]}){
 const popup=document.getElementById('combatResultPopup');
 const titleEl=document.getElementById('combatResultTitle');
 const imgEl=document.getElementById('combatResultImg');
 const textEl=document.getElementById('combatResultText');
 const summaryEl=document.getElementById('combatResultSummary');
 const effectsEl=document.getElementById('combatResultEffects');
 titleEl.textContent=title||'⚔ Resultado de combate';
 imgEl.textContent=icon||'⚔';
 textEl.textContent=text||'El combate ha terminado.';
 summaryEl.innerHTML=(summary||[]).length
 ? '<b>Ganancias / pérdidas:</b><br>'+summary.map(s=>`• ${escapeHtml(s)}`).join('<br>')
 : '';
 effectsEl.innerHTML=(effects||[]).length
 ? '<b>Efectos aplicados:</b><br>'+effects.map(s=>`• ${escapeHtml(s)}`).join('<br>')
 : '';
 popup.classList.add('open');
}

function openDecidePopup(options, prompt){
 const popup=document.getElementById('decidePopup');
 const promptEl=document.getElementById('decidePrompt');
 const optionsEl=document.getElementById('decideOptions');
 promptEl.textContent=prompt||'El grupo debe tomar una decisión.';
 optionsEl.innerHTML='';
 options.forEach(opt=>{
 const btn=document.createElement('button');
 btn.className='btn '+(opt.className||'secondary');
 btn.style.cssText='text-align:left;padding:10px 14px;line-height:1.5;';
 btn.innerHTML=`<div style="font-family:var(--font-display);font-size:13px;letter-spacing:0.05em;">${escapeHtml(opt.label||'Opción')}</div>${opt.description?`<div style="font-size:10px;color:var(--muted);margin-top:3px;">${escapeHtml(opt.description)}</div>`:''}`;
 btn.addEventListener('click',()=>{
 popup.classList.remove('open');
 if(opt.effects&&opt.effects.length) applyEffectList(normaliseEffects(opt.effects));
 if(opt.log) addLog(opt.log);
 render();
 });
 optionsEl.appendChild(btn);
 });
 popup.classList.add('open');
}

function openAttackSetupPopup(atkEffect, sourceSchema=null){
 const popup=document.getElementById('attackSetupPopup');
 const list=document.getElementById('attackSetupSurvivorList');
 const eligible=aliveSurvivors().filter(s=>
 s.status==='activo'&&
 (s.negativeSkill||'').toLowerCase()!=='cobarde'
 );
 const selected=new Set();
 list.innerHTML='';
 eligible.forEach(s=>{
 const item=document.createElement('div');
 item.style.cssText='display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line2);cursor:pointer;background:var(--panel2);';
 const skills=getSurvivorSkills(s).filter(sk=>['combatiente','explorador'].includes(sk));
 const bonus=skills.length;
 item.innerHTML=`
 <div style="width:40px;height:40px;overflow:hidden;border:1px solid var(--line2);">
 ${s.imageUrl?`<img src="${escapeAttr(s.imageUrl)}" style="width:100%;height:100%;object-fit:cover;">`:''}</div>
 <div>
 <div style="font-family:var(--font-display);font-size:14px;letter-spacing:0.06em;">${escapeHtml(s.name)}</div>
 <div style="font-size:10px;color:var(--muted);">${getMoraleEmoji(s)} · Fatiga: ${s.fatigue}/${s.maxFatigue}${bonus?` · <span style="color:var(--amber-bright)">+${bonus} combate</span>`:''}
 </div>
 </div>
 <div id="attack-setup-check-${s.id}" style="font-size:20px;color:var(--muted);">○</div>`;
 item.addEventListener('click',()=>{
 if(selected.has(s.id)){
 selected.delete(s.id);
 item.style.borderColor='var(--line2)';
 item.style.background='var(--panel2)';
 document.getElementById('attack-setup-check-'+s.id).textContent='○';
 document.getElementById('attack-setup-check-'+s.id).style.color='var(--muted)';
 } else {
 selected.add(s.id);
 item.style.borderColor='var(--danger-bright)';
 item.style.background='rgba(138,53,53,0.1)';
 document.getElementById('attack-setup-check-'+s.id).textContent='●';
 document.getElementById('attack-setup-check-'+s.id).style.color='var(--danger-bright)';
 }
 });
 list.appendChild(item);
 });
 popup.classList.add('open');

 document.getElementById('attackSetupConfirm').onclick=()=>{
 if(!selected.size){ addLog('Debes elegir al menos un superviviente para el asalto.'); return; }
 popup.classList.remove('open');
 // Assign 'atacar' action to selected survivors
 state.survivors.forEach(s=>{
 if(selected.has(s.id)){
 s.action={type:'atacar',target:'event_attack'};
 s.status='ocupado';
 addLog(`⚔ ${s.name} se prepara para el ataque.`);
 }
 });
 // Activate the configured attack threat
 applyEffect(atkEffect);
 render();
 };

 document.getElementById('attackSetupCancel').onclick=()=>{
 popup.classList.remove('open');
 };
}

function showCemeteryDetail(){
 state.currentDetail='cementerio';
 const deadOnly=state.cemetery.filter(s=>!s.departed);
 const departed=state.cemetery.filter(s=>s.departed);
 let html='';
 if(!deadOnly.length&&!departed.length){
 html='<div style="color:var(--dim);font-size:12px;text-align:center;padding:12px 0;">// Ningún superviviente ha caído todavía.</div>';
 } else {
 if(deadOnly.length){
 html+='<div style="font-size:10px;color:var(--danger-bright);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">✝ Caídos ('+deadOnly.length+')</div>';
 html+=deadOnly.map(s=>{
 const img=getSurvivorImage({...s,status:'muerto'});
 return '<div style="display:grid;grid-template-columns:36px 1fr;gap:8px;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--line);">'
 +'<img src="'+escapeAttr(img)+'" style="width:36px;height:36px;object-fit:cover;filter:grayscale(1) brightness(0.6);border:1px solid var(--danger);">'
 +'<div><div style="font-family:var(--font-display);font-size:13px;color:var(--danger-bright);">'+escapeHtml(s.name)+'</div>'
 +'<div style="font-size:10px;color:var(--muted);">✝ Día '+s.diedOnDay+(s.story?' · '+escapeHtml(s.story.slice(0,40)):'')+'</div></div></div>';
 }).join('');
 }
 if(departed.length){
 html+='<div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin:8px 0 6px;">🚪 Marchados ('+departed.length+')</div>';
 html+=departed.map(s=>'<div style="font-size:11px;color:var(--muted);padding:3px 0;">'+escapeHtml(s.name)+' — día '+s.diedOnDay+(s.betrayed?' (traición)':'')+'</div>').join('');
 }
 }
 detailBox.innerHTML=html;
 openBuildingPopup();
}

function toggleEquipNonWeapon(survivorId, itemIndex){
 const survivor=state.survivors.find(s=>s.id===survivorId);
 if(!survivor) return;
 survivor.inventory = normalizeInventoryList(survivor.inventory||[]);
 survivor.equippedGear = Array.isArray(survivor.equippedGear) ? survivor.equippedGear : [];
 const item=survivor.inventory[itemIndex];
 if(!item) return;
 const it=materializeItem(item);
 if(it.itemType==='consumable'){ useSurvivorItem(survivorId,itemIndex); return; }
 if(!canEquipItem(survivor, it)){
 }
 if(it.quality<=0){
 addLog(`❌ ${it.name} está roto.`);
 return;
 }
 if(it.itemType==='weapon'){
 survivor.equippedWeapon = survivor.equippedWeapon===it.itemId ? null : it.itemId;
 addLog(survivor.equippedWeapon===it.itemId ? `🔫 ${survivor.name} equipa <span class="log-item">${it.name}</span>.` : `📦 ${survivor.name} guarda <span class="log-item">${it.name}</span>.`);
 } else {
 if(survivor.equippedGear.includes(it.itemId)){
 survivor.equippedGear = survivor.equippedGear.filter(x=>x!==it.itemId);
 addLog(`📦 ${survivor.name} guarda <span class="log-item">${it.name}</span>.`);
 } else {
 survivor.equippedGear.push(it.itemId);
 addLog(`🧰 ${survivor.name} equipa <span class="log-item">${it.name}</span>.`);
 }
 }
 openInventoryModal(survivorId);
 render();
}

function renderInventoryPanel(selectedSurvivorId=null){
 const panel=document.getElementById('inventoryPanel');
 const hint=document.getElementById('inventoryPanelHint');
 if(!panel) return;
 const survivors=aliveSurvivors();
 if(!survivors.length){
 panel.style.display='none';
 if(hint) hint.textContent='No hay supervivientes vivos.';
 return;
 }
 panel.style.display='grid';
 panel.innerHTML = survivors.map(s=>{
 s.inventory = normalizeInventoryList(s.inventory||[]);
 const selected = selectedSurvivorId && String(selectedSurvivorId)===String(s.id);
 const items = s.inventory.length
 ? s.inventory.map(raw=>{
 const item=materializeItem(raw);
 const eq = s.equippedWeapon===item.itemId ? ' · Equipada' : '';
 const req = '';
 return `<div class="inventory-panel-item">${escapeHtml(item.name)} · ${escapeHtml(getItemTypeLabel(item))} · ${escapeHtml(getQualityText(item))}${escapeHtml(eq)}${escapeHtml(req)}</div>`;
 }).join('')
 : '<div class="inventory-panel-item empty">// Mochila vacía.</div>';
 return `<div class="inventory-panel-card"${selected?' style="border-color:var(--amber);"':''}>
 <div class="inventory-panel-head">
 <span>${selected?'🎒 ':''}${escapeHtml(s.name)}</span>
 <span class="inventory-panel-slots">${inventoryUsedSlots(s.inventory)} / ${Number(s.inventorySlots||3)} huecos</span>
 </div>
 <div class="inventory-panel-items">${items}</div>
 </div>`;
 }).join('');
 if(hint){
 hint.textContent = selectedSurvivorId
 ? 'Además del popup, la mochila seleccionada queda visible aquí para pruebas.'
 : 'Haz clic en el icono 🎒 de un superviviente para ver su mochila.';
 }
}

function openSurvivorInvitePopup(s){
 const popup=document.getElementById('survivorInvitePopup');
 const img=document.getElementById('inviteImg');
 const url=s.image?.url||s.imageUrl||'';
 if(url){img.src=url;img.style.display='block';}else{img.style.display='none';}
 document.getElementById('inviteName').textContent=s.name||'Desconocido';
 document.getElementById('inviteStory').textContent=s.story||'No dice mucho de sí mismo.';
 const rarityLabel={1:'⭐⭐⭐⭐ Legendario',2:'⭐⭐⭐ Raro',3:'⭐⭐ Poco común',4:'⭐ Común'};
 document.getElementById('inviteStats').textContent=(rarityLabel[s.rarity??4]||'')+(s.skill&&s.skill!=='ninguna'?' · Habilidad: '+s.skill:'');
 popup.classList.add('open');
}

function openCemetery(){
 const list=document.getElementById('cemeteryList');
 if(!state.cemetery.length){
 list.innerHTML='<div class="cemetery-empty">// Ningún superviviente ha caído todavía.</div>';
 } else {
 const deadOnly=state.cemetery.filter(s=>!s.departed);
 list.innerHTML=deadOnly.map(s=>{
 const _cImg=getSurvivorImage({...s,status:'muerto'});
 const img=`<img class="cemetery-avatar" src="${escapeAttr(_cImg)}" alt="" style="filter:grayscale(1) brightness(0.6);">`;
 return `<div class="cemetery-card">
 ${img}
 <div>
 <div class="cemetery-name">${escapeHtml(s.name)}</div>
 <div class="cemetery-rip">✝ R.I.P. · Murió el día ${s.diedOnDay}</div>
 ${s.story?`<div class="cemetery-story">${escapeHtml(s.story)}</div>`:''}
 </div>
 </div>`;
 }).join('');
 if(!deadOnly.length) list.innerHTML='<div class="cemetery-empty">// Ningún superviviente ha caído todavía.</div>';
 }
 document.getElementById('cemeteryModal').classList.add('open');
}

function openLoreModal(s){
 document.getElementById('loreModalName').textContent=s.name||'';
 const img=document.getElementById('loreModalImg');
 const loreImg=getSurvivorImage(s);
 if(loreImg){img.src=loreImg;img.style.display='block';img.style.filter=s.status==='muerto'?'grayscale(1) brightness(0.6)':hasActiveInjury(s)?'grayscale(20%) sepia(20%)':'';}
 else{img.style.display='none';}
 const loreStory=document.getElementById('loreModalStory');
 const bonds=getSurvivorRelationshipBadges(s);
 loreStory.innerHTML=`<div>${escapeHtml(s.story||'Sin historia registrada.')}</div>${bonds.length?`<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--line2);font-family:var(--font-mono);font-size:12px;line-height:1.8;">${bonds.map(rel=>`<div style="color:${rel.color};">${rel.icon} ${escapeHtml(rel.text)}</div>`).join('')}</div>`:''}`;
 document.getElementById('survivorLoreModal').classList.add('open');
}

 function openAbandonedRecyclePopup(buildingId){
  const def=getAbandonedDef(buildingId);
  if(!def) return;
  const available=getBaseActiveSurvivors();
  openLocationActionPopup({
   title:`Reciclar edificio · ${def.name||'Edificio abandonado'}`,
   info:`<div style="font-size:11px;color:var(--text);line-height:1.6;">Elige <b>1 superviviente</b> para trabajar durante <b>${Math.max(1, Number(def.recycleDays||4)||4)} días</b>. Al terminar obtendrás entre <b>${Math.max(0, Number(def.recycleYieldMin||5)||5)}</b> y <b>${Math.max(Math.max(0, Number(def.recycleYieldMin||5)||5), Number(def.recycleYieldMax||9)||9)}</b> materiales y el edificio desaparecerá.</div>`,
   survivors:available,
   confirmLabel:'Comenzar reciclaje',
   onConfirm:(ids)=>{ if(ids && ids.length) startAbandonedRecycle(buildingId, ids[0]); }
  });
 }

 function renderAbandonedDetail(id){
  const b=state.buildings?.[id];
  if(typeof getAbandonedDef!=='function') return false;
  const def=getAbandonedDef(id);
  const detailBox=document.getElementById('detailBox');
  if(!b || !def || !detailBox) return false;
  state.currentDetail=id;
  const daysLeft=Math.max(0, Number(b._constructionDaysLeft||0));
  const recycling=!!b._abandonedRecycle && !!b._underConstruction;
  const minYield=Math.max(0, Number(def.recycleYieldMin||5)||5);
  const maxYield=Math.max(minYield, Number(def.recycleYieldMax||9)||9);
  const desc=(b.description||def.description||def.effect||'Edificio abandonado.').trim();
  const image=(b.image||def.image||'');
  const imageHtml=image
   ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(b.name||def.name||'Edificio abandonado')}" style="width:100%;height:100%;object-fit:cover;display:block;">`
   : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--amber-bright);font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">Edificio abandonado</div>';
  const statusStr=recycling
   ? `🔨 Reciclándose (${daysLeft} día${daysLeft!==1?'s':''} restante${daysLeft!==1?'s':''})`
   : '⚠ Abandonado';
  detailBox.innerHTML=`
  <div style="display:grid;grid-template-columns:minmax(220px,260px) 1fr;gap:16px;align-items:start;">
   <div>
    <div style="border:1px solid rgba(184,124,42,0.55);background:rgba(65,45,20,0.58);min-height:220px;overflow:hidden;">${imageHtml}</div>
    <div style="margin-top:10px;border:1px solid var(--line2);background:rgba(255,255,255,0.02);padding:12px 14px;font-family:var(--font-worn);font-size:13px;line-height:1.7;color:var(--text);">${escapeHtml(desc)}</div>
   </div>
   <div class="detail-grid">
    <div class="metric"><span>Edificio</span><b>${escapeHtml(b.name||def.name||'Edificio abandonado')}</b></div>
    <div class="metric"><span>Estado</span><b>${statusStr}</b></div>
    <div class="metric"><span>Reciclaje</span><b>+${minYield} a +${maxYield} materiales</b></div>
    <div class="metric"><span>Tiempo de trabajo</span><b>${Math.max(1, Number(def.recycleDays||4)||4)} días</b></div>
    <div class="metric"><span>Resultado</span><b>El edificio desaparece</b></div>
    <div class="metric"><span>Adaptación</span><b>${(typeof getUnlockedAbandonedAdaptations==='function' && getUnlockedAbandonedAdaptations().length)?'Disponible':'Bloqueada'}</b></div>
    <div class="metric" style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
     <button class="secondary" id="abandonedRecycleBtn" ${recycling?'disabled':''}>Derrumbar</button>
     <button class="secondary" id="abandonedUpgradeBtn" ${(typeof getUnlockedAbandonedAdaptations==='function' && getUnlockedAbandonedAdaptations().length && !recycling)?'':'disabled'}>Adaptar</button>
    </div>
   </div>
  </div>`;
  openBuildingPopup();
  document.getElementById('abandonedRecycleBtn')?.addEventListener('click',()=>{
   try{ closeBuildingPopup(); }catch(e){}
   setTimeout(()=>{ try{ openAbandonedRecyclePopup(id); }catch(e){ console.error(e); } }, 0);
  });
  document.getElementById('abandonedUpgradeBtn')?.addEventListener('click',()=>{
   try{ closeBuildingPopup(); }catch(e){}
   setTimeout(()=>{ try{ openAbandonedUpgradePopup(id); }catch(e){ console.error(e); } }, 0);
  });
  return true;
 }

 function renderStatusRows(title, rows){
  return `<div style="margin-top:12px;"><div style="font-size:11px;color:var(--amber-bright);letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(title)}</div>${rows.length?rows.map(row=>`<div style="border:1px solid var(--line2);padding:8px 10px;margin-bottom:6px;background:rgba(255,255,255,.02);font-size:12px;line-height:1.5;">${row}</div>`).join(''):'<div style="color:var(--dim);font-size:12px;">Sin datos.</div>'}</div>`;
 }

 function openCantinaAssignPopup(buildingId){
  const survivors=(state?.survivors||[]).filter(s=>s.status==='activo' && s.location==='base' && s.status!=='muerto');
  openLocationActionPopup({
   title:'Cantina',
   info:'Elige quién pasa el día en la cantina. Ganará +1 moral, pero puede aumentar su drunk y acabar borracho.',
   survivors,
   confirmLabel:'Enviar a la cantina',
   onConfirm:(ids)=>{
    (ids||[]).forEach(id=>{
      const s=(state.survivors||[]).find(x=>x.id===id);
      if(!s) return;
      s.action={type:'cantina', target:buildingId};
      s.status='ocupado';
      addLog(`🍺 ${s.name} pasa el día en la cantina.`);
    });
    closeBuildingPopup();
    render();
   }
  });
 }

 function showCantinaDetail(id){
  const b=state?.buildings?.[id];
  if(!b) return false;
  state.currentDetail=id;
  const detailBox=document.getElementById('detailBox');
  if(!detailBox) return false;
  const statusStr=b._underConstruction?`🔨 En construcción (${b._constructionDaysLeft||0} días restantes)`:b.built?(b.active?'✅ Activa':'⚠️ Inactiva'):'🔒 Sin construir';
  detailBox.innerHTML=`<div style="display:grid;grid-template-columns:minmax(220px,260px) 1fr;gap:16px;align-items:start;"><div><div style="border:1px solid var(--line2);background:var(--panel2);min-height:220px;display:flex;align-items:center;justify-content:center;font-size:72px;">🍺</div><div style="margin-top:10px;border:1px solid var(--line2);background:rgba(255,255,255,0.02);padding:12px 14px;font-family:var(--font-worn);font-size:13px;line-height:1.7;color:var(--text);">${escapeHtml(b.description||ABANDONED_ADAPTATIONS.cantina.description)}</div></div><div class="detail-grid"><div class="metric"><span>Edificio</span><b>${escapeHtml(b.name||'Cantina')}</b></div><div class="metric"><span>Estado</span><b>${statusStr}</b></div><div class="metric"><span>Efecto</span><b>+1 moral</b></div><div class="metric"><span>Riesgo</span><b>40% + 5% por drunk de ganar drunk +1</b></div><div class="metric"><span>Borrachera</span><b>20% + 10% por drunk actual</b></div><div class="metric"><span>Fatiga</span><b>No recupera</b></div><div class="metric" style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="secondary" id="cantinaUseBtn" ${b.built&&b.active?'':'disabled'}>Enviar a la cantina</button></div></div></div>`;
  openBuildingPopup();
  document.getElementById('cantinaUseBtn')?.addEventListener('click',()=>openCantinaAssignPopup(id));
  return true;
 }

 function showSalaComunDetail(id){
  const b=state?.buildings?.[id];
  if(!b) return false;
  state.currentDetail=id;
  const detailBox=document.getElementById('detailBox');
  if(!detailBox) return false;
  const def=getAbandonedAdaptationDef('sala_comun');
  const statusStr=b._underConstruction?`🔨 En construcción (${b._constructionDaysLeft||0} días restantes)`:b.built?(b.active?'✅ Activa':'⚠️ Inactiva'):'🔒 Sin construir';
  detailBox.innerHTML=`<div style="display:grid;grid-template-columns:minmax(220px,260px) 1fr;gap:16px;align-items:start;"><div><div style="border:1px solid var(--line2);background:var(--panel2);min-height:220px;display:flex;align-items:center;justify-content:center;font-size:72px;">🪑</div><div style="margin-top:10px;border:1px solid var(--line2);background:rgba(255,255,255,0.02);padding:12px 14px;font-family:var(--font-worn);font-size:13px;line-height:1.7;color:var(--text);">${escapeHtml(b.description||getAbandonedAdaptationDescription(def))}</div></div><div class="detail-grid"><div class="metric"><span>Edificio</span><b>${escapeHtml(b.name||'Sala común')}</b></div><div class="metric"><span>Estado</span><b>${statusStr}</b></div><div class="metric"><span>Función</span><b>Espacio social del asentamiento</b></div><div class="metric"><span>Efecto</span><b>${escapeHtml(getAbandonedAdaptationEffect(def)||'Sin acción directa por ahora.')}</b></div><div class="metric"><span>Uso</span><b>Preparada para futuras acciones y eventos sociales</b></div></div></div>`;
  openBuildingPopup();
  return true;
 }

 function openAbandonedUpgradePopup(buildingId){
  const unlocked=getUnlockedAbandonedAdaptations();
  if(!unlocked.length){ addLog('ℹ No hay adaptaciones de edificio abandonado desbloqueadas.'); return; }
  const buildOptionsEl=document.getElementById('buildOptions');
  const modalWrap=document.getElementById('buildModalWrap');
  const modalHeader=modalWrap?.querySelector('.modal-header');
  if(!buildOptionsEl || !modalWrap) return;
  const resetBuildModalHeader=()=>{ if(modalHeader) modalHeader.textContent='Construcción'; };
  buildOptionsEl.innerHTML='';
  if(modalHeader) modalHeader.textContent='Adaptar edificio abandonado';
  document.getElementById('closeBuildModal')?.addEventListener('click', resetBuildModalHeader, {once:true});
  unlocked.forEach(def=>{
   const cost=getAbandonedAdaptationCost(def);
   const days=getAbandonedAdaptationDays(def);
   const effect=getAbandonedAdaptationEffect(def);
   const box=document.createElement('div');
   box.className='build-option';
   box.innerHTML=`<div><div style="font-family:var(--font-display);font-size:16px;color:var(--amber-bright);margin-bottom:6px;">${escapeHtml(def.name||def.id)}</div><div style="font-size:12px;color:var(--text);line-height:1.6;">${escapeHtml(getAbandonedAdaptationDescription(def))}</div><div style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.6;">Coste: <b>${cost}</b> materiales · Tiempo: <b>${days}</b> días${effect?`<br>Efecto: ${escapeHtml(effect)}`:''}</div></div><div style="margin-top:10px;"><button data-adaptation-id="${escapeAttr(def.id)}">Elegir</button></div>`;
   box.querySelector('button')?.addEventListener('click',()=>{
    modalWrap.classList.remove('open');
    resetBuildModalHeader();
    const survivors=(state?.survivors||[]).filter(s=>s.status==='activo' && s.location==='base' && s.status!=='muerto');
    openLocationActionPopup({
     title:`Adaptar edificio · ${def.name}`,
     info:`<div style="font-size:11px;line-height:1.6;">Elige <b>1 superviviente</b> para convertir este edificio abandonado en <b>${escapeHtml(def.name)}</b>.<br>Coste: <b>${cost}</b> materiales · Tiempo: <b>${days}</b> días.</div>`,
     survivors,
     confirmLabel:'Comenzar adaptación',
     onConfirm:(ids)=>{ if(ids && ids.length) startAbandonedAdaptation(buildingId, def.id, ids[0]); }
    });
   });
   buildOptionsEl.appendChild(box);
  });
  modalWrap.classList.add('open');
 }
