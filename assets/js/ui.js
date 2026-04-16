// UI split extracted from app.js


function normalizeMojibakeEmojiText(value){
 let out=String(value??'');
 const pairs=[
  ['ðŸŽ“','\u{1F393}'],['ðŸŽ’','\u{1F392}'],['âœ…','\u2705'],['ðŸ”§','\u{1F527}'],['Â·','\u00B7'],['âš¡','\u26A1'],['â±','\u23F1'],['â—‹','\u25CB'],['â—','\u25CF'],['â˜…','\u2605'],['â€¢','\u2022'],['â€”','\u2014'],
  ['ðŸ˜Š','\u{1F60A}'],['ðŸ˜','\u{1F610}'],['ðŸ˜ž','\u{1F61E}'],['ðŸ›','\u{1F3DB}'],['ðŸ“…','\u{1F4C5}'],['ðŸ•','\u{1F415}'],['ðŸ‘¤','\u{1F464}'],['ðŸ“»','\u{1F4FB}'],['ðŸ§­','\u{1F9ED}'],['ðŸ“','\u{1F4CD}'],['ðŸš','\u{1F3DA}'],['ðŸ”','\u{1F414}'],['ðŸŒ½','\u{1F33D}'],['ðŸ‘¥','\u{1F465}'],
  ['ðŸ½','\u{1F37D}'],['ðŸ’Š','\u{1F48A}'],['ðŸ”¨','\u{1F528}'],['ðŸšª','\u{1F6AA}'],['ðŸ¤','\u{1F91D}'],['ðŸ“','\u{1F4DD}'],['ðŸ“¦','\u{1F4E6}'],['ðŸ§°','\u{1F9F0}'],['ðŸ”«','\u{1F52B}'],['ðŸ’€','\u{1F480}'],['ðŸ©¸','\u{1FA78}'],['ðŸ”¬','\u{1F52C}'],
  ['âš ï¸','\u26A0'],['âš ','\u26A0'],['âš™','\u2699'],['âš”','\u2694'],['âŒ','\u274C'],['â›º','\u26FA'],['â›½','\u26FD'],['â­','\u2B50'],['âœ','\u271D'],['â˜£','\u2623'],['â–£','\u25A3'],['â†’','\u2192'],
  ['Ã­a','Ã­a'],['Ã³','Ã³'],['Ã¡','Ã¡'],['Ã©','Ã©'],['Ãº','Ãº'],['Ã±','Ã±'],['Ã','Ã'],['Ã‰','Ã‰'],['Ã','Ã'],['Ã“','Ã“'],['Ãš','Ãš'],['Ã‘','Ã‘']
 ];
 pairs.forEach(([bad,good])=>{ out=out.split(bad).join(good); });
 return out;
}

function normalizeMojibakeEmojiDom(root=document.body){
 if(!root) return;
 const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
 const nodes=[];
 while(walker.nextNode()) nodes.push(walker.currentNode);
 nodes.forEach(node=>{
  const fixed=normalizeMojibakeEmojiText(node.nodeValue);
  if(fixed!==node.nodeValue) node.nodeValue=fixed;
 });
 root.querySelectorAll?.('[title],[aria-label],[alt]').forEach(el=>{
  ['title','aria-label','alt'].forEach(attr=>{
   if(!el.hasAttribute(attr)) return;
   const val=el.getAttribute(attr);
   const fixed=normalizeMojibakeEmojiText(val);
   if(fixed!==val) el.setAttribute(attr,fixed);
  });
 });
}

function normalizeMojibakeEmojiText(value){
 let out=String(value??'');
 const reverse1252={
  0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F
 };
 const decoder=typeof TextDecoder!=='undefined' ? new TextDecoder('utf-8',{fatal:false}) : null;
 function decodeOnce(text){
  if(!decoder) return text;
  let result='';
  let bytes=[];
  let changed=false;
  const flush=()=>{
   if(!bytes.length) return;
   const decoded=decoder.decode(new Uint8Array(bytes));
   if(decoded.includes('\uFFFD')) result+=String.fromCharCode(...bytes);
   else { result+=decoded; changed=changed || decoded!==String.fromCharCode(...bytes); }
   bytes=[];
  };
  for(const ch of text){
   const cp=ch.codePointAt(0);
   if(cp<=0xFF) bytes.push(cp);
   else if(reverse1252[cp]!=null) bytes.push(reverse1252[cp]);
   else { flush(); result+=ch; }
  }
  flush();
  return changed ? result : text;
 }
 for(let i=0;i<3;i++){
  const next=decodeOnce(out);
  if(next===out) break;
  out=next;
 }
 return out;
}

function initMojibakeEmojiNormalizer(){
 if(window.__mojibakeEmojiNormalizerInstalled) return;
 window.__mojibakeEmojiNormalizerInstalled=true;
 const run=()=>normalizeMojibakeEmojiDom(document.body);
 if(document.body) run();
 let pending=false;
 const observer=new MutationObserver(()=>{
  if(pending) return;
  pending=true;
  requestAnimationFrame(()=>{ pending=false; run(); });
 });
 if(document.body) observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','alt']});
}
setTimeout(initMojibakeEmojiNormalizer,0);

let survivorReorderMode=false;

function toggleSurvivorReorderMode(){
 survivorReorderMode=!survivorReorderMode;
 render();
}

function syncSurvivorReorderToggleButton(){
 const btn=document.getElementById('survivorReorderToggleBtn');
 if(!btn) return;
 const disabled=activeMapTab==='exterior';
 if(disabled) survivorReorderMode=false;
 btn.disabled=disabled;
 btn.textContent=survivorReorderMode?'Terminar orden':'Ordenar supervivientes';
 btn.title=disabled?'Disponible en la vista Base':'Recolocar supervivientes en la lista';
 btn.classList.toggle('amber', survivorReorderMode);
 btn.classList.toggle('secondary', !survivorReorderMode);
}

function getCampSurvivorOrderList(){
 return state.survivors.filter(s=>s.status!=='muerto'&&!isExteriorSurvivor(s));
}

function moveSurvivorOrder(id, direction){
 const visible=getCampSurvivorOrderList();
 const currentIndex=visible.findIndex(s=>String(s.id)===String(id));
 const target=visible[currentIndex+Number(direction||0)];
 if(currentIndex<0||!target) return;
 const a=state.survivors.findIndex(s=>String(s.id)===String(id));
 const b=state.survivors.findIndex(s=>String(s.id)===String(target.id));
 if(a<0||b<0) return;
 const moving=state.survivors[a];
 state.survivors[a]=state.survivors[b];
 state.survivors[b]=moving;
 render();
}

window.toggleSurvivorReorderMode=toggleSurvivorReorderMode;
window.moveSurvivorOrder=moveSurvivorOrder;
window.syncSurvivorReorderToggleButton=syncSurvivorReorderToggleButton;

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
 const hostileIcon=String(state.attackHostileIcon||'\u2694').trim()||'\u2694';
 const hasAtalayaIntel=typeof canUseAtalayaBinoculars==='function'&&canUseAtalayaBinoculars();
 titleEl.textContent=`${hostileIcon} ${state.attackHostileLabel||'Amenaza de ataque'}`;
 imageEl.innerHTML=`<span>${escapeHtml(hostileIcon)}</span>`;
 metaEl.innerHTML=`${hasAtalayaIntel?`<div class="threat-preview-badge attack">Fuerza ${Number(state.attackStrength||0)}</div>`:''}<div class="threat-preview-badge attack">${escapeHtml(urgencyMeta.text)}</div>`;
 textEl.innerHTML='Un grupo hostil est\u00e1 en camino al asentamiento. Esta amenaza no se resuelve desde aqu\u00ed: debes asignar supervivientes a <b>Defender</b> antes de que llegue.';
 passiveEl.textContent='Amenaza de ataque: si no preparas la defensa, el asalto se resolver\u00e1 con la fuerza actual del asentamiento y los defensores asignados.';
 actionsEl.innerHTML=`<div class="threat-popup-note">Consejo: Revisa a tus supervivientes y m\u00e1ndalos en un ataque preventivo o espera que lleguen a la base y asigna a tus defensores.</div>`;
 if(hasAtalayaIntel){
  actionsEl.insertAdjacentHTML('afterbegin','<button class="btn secondary" type="button" id="attackBinocularsBtn" style="width:100%;justify-content:flex-start;">Prism\u00e1ticos</button>');
  document.getElementById('attackBinocularsBtn')?.addEventListener('click',()=>openAtalayaBinoculars('attack'));
 }
 popup.classList.add('open');
 return;
 }

 const threat=(state.activeThreats||[]).find(item=>String(item.instanceId)===String(instanceId) && !item.resolved);
 if(!threat) return;
 const def=getThreatDef(threat.templateId)||{};
 const image=getThreatImage(threat);
 titleEl.textContent=`\u2623 ${getThreatDisplayName(threat)}`;
 imageEl.innerHTML=image
 ? `<img src="${escapeAttr(image)}" alt="">`
 : '<span>\u2623</span>';
 const escalationDays=Math.max(0, Number(threat.daysUntilEscalation||0));
 const escalationText=Number(threat.severity||0)>=getThreatMaxSeverity(threat) ? 'Punto crÃ­tico' : `Escala en ${escalationDays} dÃ­a${escalationDays!==1?'s':''}`;
 metaEl.innerHTML=`<div class="threat-preview-badge">${escapeHtml(getThreatSeverityText(threat))}</div><div class="threat-preview-badge">${escapeHtml(escalationText)}</div>`;
 textEl.textContent=getThreatDescription(threat);
 passiveEl.textContent=describeThreatPassiveEffects(threat);

 const actions=(def.actions||[]).map(action=>{
 const req=evaluateThreatActionRequirements(threat, action);
 const requiresSurvivor=!!action?.requirements?.survivorAvailable;
 const helper=req.ok ? (getThreatActionSummary(action)||action.description||'') : req.blockers.join(' Â· ');
 const optionsHtml=requiresSurvivor && req.availableSurvivors.length
 ? `<select class="threat-action-survivor-select" data-threat-actor-select="${escapeAttr(action.id)}" data-threat-id="${escapeAttr(threat.instanceId)}">${req.availableSurvivors.map(s=>`<option value="${escapeAttr(s.id)}">${escapeHtml(getThreatActionSurvivorOptionLabel(s))}</option>`).join('')}</select>`
 : '';
 const disabled=req.ok?'':'disabled';
 return `<div class="threat-action-card" data-threat-action-card="${escapeAttr(action.id)}">${optionsHtml}<button class="btn ${req.ok?'amber':'secondary'}" data-threat-popup-action="${escapeAttr(action.id)}" data-threat-id="${escapeAttr(threat.instanceId)}" ${disabled} style="width:100%;justify-content:flex-start;text-align:left;padding:9px 10px;${req.ok?'':'opacity:0.55;'}">${escapeHtml(action.label||'Actuar')}</button><div class="threat-action-helper" style="color:${req.ok?'var(--muted)':'var(--danger-bright)'};">${escapeHtml(helper)}</div></div>`;
 }).join('');
 actionsEl.innerHTML=actions || '<div class="threat-popup-note">Esta amenaza no tiene acciones directas configuradas.</div>';
 if(typeof canUseAtalayaBinoculars==='function'&&canUseAtalayaBinoculars()&&typeof isThreatHostile==='function'&&isThreatHostile(threat)){
  actionsEl.insertAdjacentHTML('afterbegin','<div class="threat-action-card"><button class="btn secondary" type="button" id="persistentBinocularsBtn" style="width:100%;justify-content:flex-start;">PrismÃ¡ticos</button><div class="threat-action-helper">Inspecciona armas y dado de ataque desde la Atalaya.</div></div>');
  document.getElementById('persistentBinocularsBtn')?.addEventListener('click',()=>openAtalayaBinoculars('persistent', threat.instanceId));
 }
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
 if(typeof renderEventResourceStrip==='function') renderEventResourceStrip();
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
 ? 'Colapso: defensa -1, +eventos negativos, +abandono, menos reclutas, construcciÃ³n/investigaciÃ³n mÃ¡s lentas.'
 : stabilityTier==='unstable'
 ? 'Inestable: +eventos negativos y menos reclutas.'
 : stabilityTier==='strong'
 ? 'Fuerte: defensa +1, +eventos positivos, mÃ¡s reclutas, descanso con posible +1 moral.'
 : 'Normal: sin modificadores globales.';
 ensureCampInventory();
 const campHeader=document.getElementById('campTopbarIndicator');
 const extCount=getExteriorSurvivorCount();
 if(campHeader){
 campHeader.style.display=extCount>0?'flex':'none';
 if(extCount>0){
 const campSummary=getCampInventoryEntries().map(item=>`${item.icon}${item.amount}`).join(' ');
 campHeader.innerHTML=`<span style="font-size:9px;color:var(--ok-bright);letter-spacing:0.08em;">â›º CAMP</span><span style="font-size:14px;font-weight:600;">${campSummary}</span>`;
 }
 }
const cardMap={
 day:['DÃ­a','ðŸ“…',state.day,false],
 stability:['Estabilidad','ðŸ›',stabilityText,false,stabilityTip],
 survivors:['Supervivientes','ðŸ‘¥',aliveSurvivors().length,false],
 electricity:(()=>{
 const cap=getElectricityCapacity();
 const used=getElectricityUsed();
 const label=cap>0?`${used}/${cap} âš¡`:'--';
 return ['Electricidad','âš¡',cap>0?label:'--',cap<=0];
 })(),
 food:['Comida','ðŸŒ½',state.food,false],
 chickens:['Gallinas','ðŸ”',state.chickens,false],
 materials:['Materiales','ðŸ”§',state.materials,false],
 fuel:['Combustible','â›½',state.fuel,false],
 meds:['Medicamentos','ðŸ’Š',state.meds,false]
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
 <div style="font-family:var(--font-display);font-size:12px;letter-spacing:0.1em;color:var(--ok-bright);margin-bottom:4px;">â›º CAMPAMENTO EXTERIOR Â· ${escapeHtml(getExteriorZoneName())}</div>
 <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text);">${campSummary}<span style="color:var(--muted);">${extCount} superviviente${extCount!==1?'s':''} Â· ${campCount} en campamento</span></div>
 </div>`;
 survivorList.appendChild(campHeader);
 }

 const tabFilter = activeMapTab==='exterior'
 ? s => s.status!=='muerto' && isExteriorSurvivor(s)
 : s => s.status!=='muerto' && !isExteriorSurvivor(s);
 const visibleSurvivors=state.survivors.filter(tabFilter);
 syncSurvivorReorderToggleButton();

 visibleSurvivors.forEach((s,visibleIndex)=>{
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
 const bondIndicator=bonds.length ? `<span class="survivor-link-indicator" title="Tiene vinculos. Consulta la biografia.">\u26D3</span>` : '';
 const loreBtn=`<button class="survivor-slot lore-btn" title="Biografia de ${escapeAttr(s.name)}">\u{1F4D6}</button>`;
 const invBtn=`<button class="survivor-slot inv-btn" title="Mochila de ${escapeAttr(s.name)}">\u{1F392}</button>`;
 const dogBtn=`<button class="survivor-slot dog-btn ${dog?'occupied':'empty'}" title="${escapeAttr(dog?`Perro: ${dog.name}`:'Espacio reservado para perro')}" ${dog?'':'disabled'}>\u{1F415}</button>`;
 const futureBtn=`<button class="survivor-slot future-btn empty" title="Espacio reservado" disabled>\u25A3</button>`;
 const reorderControls=survivorReorderMode&&activeMapTab!=='exterior'
 ? `<div class="survivor-reorder-controls" style="display:flex;gap:6px;margin-bottom:6px;">
 <button class="btn secondary survivor-order-btn" type="button" data-order-dir="-1" data-sid="${escapeAttr(s.id)}" ${visibleIndex===0?'disabled':''} style="padding:4px 8px;font-size:11px;">&uarr; Subir</button>
 <button class="btn secondary survivor-order-btn" type="button" data-order-dir="1" data-sid="${escapeAttr(s.id)}" ${visibleIndex===visibleSurvivors.length-1?'disabled':''} style="padding:4px 8px;font-size:11px;">&darr; Bajar</button>
 </div>`
 : '';
 const statusClass=hasActiveInjury(s)?'herido':s.status;
 const injuryName=hasActiveInjury(s)?injuryDisplayName(s.injuryLevel||'simple'):'';
 const statusText=hasActiveInjury(s)?`Herida ${injuryName}`:statusLabel(s.status);
 const statusTitle=hasActiveInjury(s) ? ` title="Herida: ${escapeAttr(injuryName)}"` : '';
 const noteHtml=s.location==='travelling'
 ? `<div class="survivor-note"><span style="color:var(--amber-bright);">ðŸ§­ En trÃ¡nsito</span><br>${escapeHtml(s.travelArrivalDay&&s.travelArrivalDay>state.day?'Llega dÃ­a '+s.travelArrivalDay:s.travelReturnDay?'Regresa dÃ­a '+s.travelReturnDay:'Viajando')}</div>`
 : isExteriorCard
 ? `<div class="survivor-note"><span style="color:var(--ok-bright);">ðŸ“ ${escapeHtml(getLocationDisplayName(s.location)||'Exterior')}</span><br><span style="color:var(--amber-bright);">ðŸš ${escapeHtml(getExteriorSiteLabel(s.exteriorSiteId)||'Zona activa')}</span></div>`
 : ``;
 const positiveSkillLabels=getSurvivorSkills(s)
 .map(skill=>typeof getSurvivorSkillName==='function'?getSurvivorSkillName(skill):String(skill||'').trim())
 .filter(Boolean);
 const negativeSkillKey=String(s.negativeSkill||'').trim();
 const hasNegativeSkill=negativeSkillKey&&negativeSkillKey.toLowerCase()!=='ninguna';
 const negativeSkillLabel=hasNegativeSkill
 ? ((typeof getSurvivorSkillName==='function'?getSurvivorSkillName(negativeSkillKey):negativeSkillKey)||negativeSkillKey).replace(/^./, ch=>ch.toUpperCase())
 : '';
 const skillBits=[
  ...positiveSkillLabels.map(label=>`<span style="color:var(--ok-bright);">${escapeHtml(label)}</span>`),
  ...(negativeSkillLabel?[`<span style="color:var(--danger-bright);">${escapeHtml(negativeSkillLabel)}</span>`]:[])
 ];
 const skillsLineHtml=skillBits.length
 ? `<div class="survivor-health-line ok"><span style="color:var(--muted);">\u2726</span> <b>${skillBits.join(', ')}</b></div>`
 : `<div class="survivor-health-line ok"><span style="color:var(--muted);">\u2726 Sin habilidades</span></div>`;

 card.innerHTML=`
 <div class="avatar ${hasActiveInjury(s)?'injured':''}">${avatarInner}</div>
 ${reorderControls}
 <div class="survivor-head-row">
 <div class="survivor-name-wrap">
 <div class="survivor-name">${escapeHtml(s.name)}</div>
 ${bondIndicator}
 </div>
 <div class="badge ${statusClass}"${statusTitle}>${statusText}</div>
 </div>
 <div class="survivor-meta-line">
 <span class="meta-fatigue"><span style="color:var(--ok)">âš¡</span> ${s.fatigue}/${s.maxFatigue}</span>
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
 addLog(`${surv.name} estÃ¡ construyendo ${state.buildings[surv.action.target]?.name||'un edificio'} y no puede cambiar de acciÃ³n.`);
 render();
 return;
 }
 if(surv.action?.type===action&&surv.status==='ocupado'){
 surv.status='activo'; surv.action=null;
 addLog(`${surv.name} cancela la acciÃ³n.`);
 render(); return;
 }
 assignAction(sid, action);
 });
 });
 card.querySelectorAll('.survivor-order-btn').forEach(btn=>{
 btn.addEventListener('click',event=>{
 event.stopPropagation();
 moveSurvivorOrder(btn.dataset.sid, Number(btn.dataset.orderDir||0));
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
 const title=mapArea.querySelector('.map-title')?.outerHTML||'<div class="map-title">â¬¡ SECTOR ALFA â€” BASE</div>';
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
 const npcList=(typeof window.getBuildingNpcList==='function')?(window.getBuildingNpcList(def.id)||[]):[];
 const npcIndicator=npcList.length ? '<span style="color:var(--ok-bright);margin-left:6px;">ðŸ‘¤</span>' : '';
 const label=b.built?(b.id==='cementerio'?`${String(b.name||'Cementerio').replace(/\s*N\d+$/i,'')}`:`${b.name} N${b.level}`):`${b.name} `;
 return `<button class="${classes.join(' ')}" style="${style}" data-building="${escapeAttr(b.id)}">${escapeHtml(label)}${npcIndicator}</button>`;
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
 let safe=raw.replace(/<span class="(log-item|log-facilitator)">([\s\S]*?)<\/span>/gi,(_,cls,content)=>{
 const key=`__LOGITEM_${tokens.length}__`;
 tokens.push(`<span class="${cls}">${escapeHtml(content)}</span>`);
 return key;
 });
 safe=escapeHtml(safe);
 safe=safe.replace(/(\+\d+)/g,'<span class="log-positive">$1</span>');
 safe=safe.replace(/(^|[\s(])(-\d+)(?=[\s).,]|$)/g,'$1<span class="log-negative">$2</span>');
 safe=safe.replace(/\b(forrajea|recicla|construye|construyendo|explora|descansa|ataca|defiende|investiga|viaja|saquea|desarrolla|vigila)\b/gi,'<span class="log-action">$1</span>');
 tokens.forEach((html,i)=>{ safe=safe.replace(`__LOGITEM_${i}__`, html); });
 return safe;
}

function isExploreLogLine(text){
 const raw=String(text||'');
 const t=raw.toLowerCase();
 return raw.includes('ðŸ§­') ||
 raw.includes('ðŸ—º') ||
 t.includes('explora') ||
 t.includes('exploraci') ||
 t.includes('expedici') ||
 t.includes('campamento exterior') ||
 t.includes('zona exterior') ||
 t.includes('parten hacia') ||
 t.includes('observan') ||
 t.includes('revisan de nuevo') ||
 t.includes('saqueo') ||
 t.includes('saquea') ||
 t.includes('ubicaci');
}

function renderLog(){
  const logBox=document.getElementById('logBox');
  if(!logBox) return;
  let html='';
  let lastDay=null;
  state.log.forEach(x=>{
    x = typeof normalizeLogText==='function' ? normalizeLogText(String(x)) : String(x);
    const dayMatch=String(x).match(/^D(?:ia|Ã­a|Ã­a|\u00eda) (\d+):/);
    const day=dayMatch?Number(dayMatch[1]):null;
    if(day!==null && day!==lastDay){
      html+=`<div class="log-day-separator">\u{1F4C5} D\u00eda ${day}</div>`;
      lastDay=day;
    }
    x = typeof normalizeLogText==='function' ? normalizeLogText(replaceDynamicNameTokens(String(x))) : replaceDynamicNameTokens(String(x));
    let cls='log-entry';
    const t=String(x).toLowerCase();
    if(String(x).includes('ðŸ‘')||t.includes('amenaza superada')||t.includes('amenaza resuelta con Ã©xito')) cls+=' log-threat-success';
    else if(String(x).includes('ðŸ‘Ž')||t.includes('amenaza fallida')||t.includes('amenaza no superada')||t.includes('fracasa frente a la amenaza')) cls+=' log-threat-failure';
    else if(String(x).includes('ðŸ’€')||t.includes('muere')||t.includes('muerto')||t.includes('fallece')) cls+=' log-muerto';
    else if(String(x).includes('ðŸ©¸')||t.includes('herido')) cls+=' log-herido';
    else if(String(x).startsWith('â˜…')) cls+=' log-skill';
    else if(String(x).includes('ðŸ§­')||String(x).includes('ðŸ—º')) cls+=' log-explore';
    else if(isExploreLogLine(x)) cls+=' log-explore log-explorar';
    else if(t.includes('forraje')) cls+=' log-forraje';
    else if(t.includes('recicla')) cls+=' log-reciclar';
    else if(t.includes('constru')) cls+=' log-construir';
    else if(t.includes('descans')) cls+=' log-descansar';
    else if(t.includes('ataca')||t.includes('ataque')||t.includes('emboscada')||t.includes('combate')||t.includes('defensa')||t.includes('repelido')) cls+=' log-atacar';
    const plainText=String(x).replace(/^D(?:ia|Ã­a|Ã­a|Ã­a|\u00eda) \d+: /,'');
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
 if(panel){
  panel.classList.add('open');
  panel.style.display = 'flex';
 }
}

function closeBuildingPopup(){
 const panel=document.getElementById('buildingDetailPanel');
 if(panel){
  panel.classList.remove('open');
  panel.style.display = 'none';
 }
 state.currentDetail=null;
}

function renderAbandonedDetail(id){
 const b=state.buildings[id];
 const def=getBuildingDef(id)||{};
 if(!b || !def) return false;
 state.currentDetail=id;
 const daysLeft=Math.max(0, Number(b._constructionDaysLeft||0));
 const recycling=!!b._abandonedRecycle && !!b._underConstruction;
 const adapting=!!b._abandonedAdaptation && !!b._underConstruction;
 const minYield=Math.max(0, Number(def.recycleYieldMin||5)||5);
 const maxYield=Math.max(minYield, Number(def.recycleYieldMax||9)||9);
 const desc=(b.description||def.description||def.effect||'Edificio abandonado.').trim();
 const image=(b.image||def.image||'');
 const imageHtml=image
  ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(b.name||def.name||'Edificio abandonado')}" style="width:100%;height:100%;object-fit:cover;display:block;">`
  : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--amber-bright);font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">Edificio abandonado</div>';
 const unlocked=(typeof getUnlockedAbandonedAdaptations==='function') ? (getUnlockedAbandonedAdaptations()||[]) : [];
 const canRecycle=!recycling && !adapting;
 const canUpgrade=!!unlocked.length && !recycling && !adapting;
 const statusStr=recycling
  ? `ðŸ”¨ Reciclaje en curso (${daysLeft} dÃ­a${daysLeft!==1?'s':''} restante${daysLeft!==1?'s':''})`
  : adapting
    ? `ðŸ— AdaptÃ¡ndose (${daysLeft} dÃ­a${daysLeft!==1?'s':''} restante${daysLeft!==1?'s':''})`
    : 'âš  Abandonado';
 const detailBox=document.getElementById('detailBox');
 if(!detailBox) return false;
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
 <div class="metric"><span>Tiempo de trabajo</span><b>${Math.max(1, Number(def.recycleDays||3)||3)} dÃ­as</b></div>
 <div class="metric"><span>Adaptaciones</span><b>${unlocked.length?`${unlocked.length} disponible${unlocked.length!==1?'s':''}`:'Ninguna desbloqueada'}</b></div>
 <div class="metric"><span>Resultado</span><b>${canUpgrade?'Puede adaptarse o reciclarse':'Puede reciclarse para sacar materiales'}</b></div>
 <div class="metric" style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
 <button class="secondary" id="abandonedRecycleBtn" ${canRecycle?'':'disabled'}>Reciclar</button>
 <button class="secondary" id="abandonedUpgradeBtn" ${canUpgrade?'':'disabled'}>${unlocked.length?`Adaptar (${unlocked.length})`:'Adaptar'}</button>
 </div>
 </div>
 </div>`;
 if(typeof openBuildingPopup==='function') openBuildingPopup();
 document.getElementById('abandonedRecycleBtn')?.addEventListener('click',()=>openAbandonedRecyclePopup(id));
 document.getElementById('abandonedUpgradeBtn')?.addEventListener('click',()=>openAbandonedUpgradePopup(id));
 return true;
}

function getElectricityConsumerRows(){
 const rows=[];
 Object.values(state.buildings||{}).forEach(b=>{
  if(!b?.id||b.id==='generador'||!b.built||!b.active) return;
  const cost=typeof getBuildingElectricityCost==='function' ? getBuildingElectricityCost(b.id, b.level||1) : Number(b.electricityCost||0);
  if(cost>0){
   rows.push({
    id:b.id,
    name:b.name||getBuildingDef(b.id)?.name||b.id,
    level:Number(b.level||1),
    cost
   });
  }
 });
 if(state.baseUpgrades?.electric_fence&&state.buildings?.generador?.built&&state.buildings?.generador?.active){
  const needsElectricity=typeof getBaseUpgradeDef==='function' ? getBaseUpgradeDef('electric_fence')?.effects?.needsElectricity : true;
  if(needsElectricity!==false){
   const def=typeof getBaseUpgradeDef==='function' ? getBaseUpgradeDef('electric_fence') : null;
   rows.push({id:'electric_fence', name:def?.name||'Muro electrificado', level:0, cost:1});
  }
 }
 return rows;
}

function renderElectricityConsumersPanel(){
 const consumers=getElectricityConsumerRows();
 const capacity=typeof getElectricityCapacity==='function' ? getElectricityCapacity() : Number(state.electricityCapacity||0);
 const used=typeof getElectricityUsed==='function' ? getElectricityUsed() : consumers.reduce((sum,row)=>sum+Number(row.cost||0),0);
 const free=Math.max(0, capacity-used);
 const rowsHtml=consumers.length
  ? consumers.map(row=>`<div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);"><span>${escapeHtml(row.name)}${row.level?` · Nivel ${row.level}`:''}</span><b>${Number(row.cost||0)}⚡</b></div>`).join('')
  : '<div style="color:var(--dim);font-size:11px;line-height:1.6;">Ningún edificio está consumiendo electricidad ahora mismo.</div>';
 return `
 <div class="metric"><span>Capacidad eléctrica</span><b>${capacity}⚡</b></div>
 <div class="metric"><span>Electricidad usada</span><b>${used}⚡</b></div>
 <div class="metric"><span>Electricidad libre</span><b>${free}⚡</b></div>
 <div class="metric" style="grid-column:1/-1;display:block;">
 <span style="display:block;margin-bottom:8px;">Consumo actual</span>
 <b style="display:block;font-weight:400;text-align:left;">${rowsHtml}</b>
 </div>`;
}

function showBuildingDetail(id){
 if(id==='cementerio'){
 showCemeteryDetail();
 return;
 }
 const b=state.buildings[id];
 if(!b) return;
 state.currentDetail=id;
 const detailBox=document.getElementById('detailBox');
 if(!detailBox) return;
 const def=getBuildingDef(id)||{};
 if(def.abandonedBuilding){
  renderAbandonedDetail(id);
  return;
 }
 const capacity=id==='barracones'?barracksCapacity():null;
 const overflow=id==='barracones'?Math.max(0,aliveSurvivors().length-capacity):null;
 const statusStr=b._underConstruction?`\u{1F528} En construcciÃ³n (${b._constructionDaysLeft||0} dÃ­a${(b._constructionDaysLeft||0)!==1?'s':''} restante${(b._constructionDaysLeft||0)!==1?'s':''})`:b.built?(b.active?'\u2705 Activo':'\u26A0 Inactivo'):'\u{1F512} Sin construir';

 function getLevelEffect(id, level){
 const lvl=level||1;
 const levelEffects=def?.levelEffects||b.levelEffects||{};
 const jsonLevelEffect=levelEffects?.[String(lvl)] ?? levelEffects?.[lvl];
 if(jsonLevelEffect) return String(jsonLevelEffect);
 if(typeof getBuildingOutputRows==='function'){
  const labels={food:'comida',materials:'materiales',meds:'medicamentos',fuel:'combustible',electricity:'electricidad',chickens:'gallinas',stability:'estabilidad',defense:'defensa',capacity:'capacidad',morale:'moral'};
  const timing={daily:'por día',built:'al construirse',defense:'al defender',passive:'pasivo'};
  const outputs=getBuildingOutputRows(b,lvl);
  if(outputs.length) return outputs.map(row=>`${row.amount>0?'+':''}${row.amount} ${labels[row.resource]||row.resource} ${timing[row.timing]||row.timing}`).join(' · ');
 }
 if(id==='huerto') return (typeof getFarmProductionText==='function') ? getFarmProductionText(b, state.day) : `+${lvl} comida por dÃ­a`; 
 if(id==='taller') return `+${lvl} material por dÃ­a`;
 if(id==='barracones') return `${lvl*4} espacios para supervivientes`;
 if(id==='muros') return `+${lvl>=2?2:1} defensa pasiva`;
 if(id==='atalaya'){
 if(lvl>=3) return '+1 defensa al defender Â· PrismÃ¡ticos Â· Vigilancia avanzada';
  if(lvl>=2) return '+1 defensa al defender Â· PrismÃ¡ticos contra amenazas hostiles';
  return '+1 defensa total al defender';
 }
 const biodieselBonus=state.baseUpgrades?.biodiesel?getBaseUpgradeEffectNumber('biodiesel','generatorCapacityBonus',1):0;
 if(id==='generador') return `${lvl>=3?5:lvl===2?4:3}${biodieselBonus?`+${biodieselBonus}`:''}âš¡ de capacidad elÃ©ctrica`;
 if(id==='pozo') return `Requisito para mejorar el Huerto a nivel 3`;
 if(id==='gallinero') return `0-1 gallinas: 0 comida Â· 2: +1 Â· 3-6: +2 Â· 7-10: +3`;
 if(id==='almacen') return 'Capacidad: 4 objetos fabricados';
 return b.desc||'';
 }

 const effectDesc=b.built?getLevelEffect(id,b.level):(b.desc||getLevelEffect(id,1));
 const buildingImage=b.image||def.image||'';
 const buildingDescription=(b.description||def.description||def.text||def.effectDescription||def.effect||b.desc||'Sin descripciÃ³n adicional.').trim();
 const imageHtml=buildingImage
 ? `<img src="${escapeAttr(buildingImage)}" alt="${escapeAttr(b.name)}" style="width:100%;height:100%;object-fit:cover;display:block;">`
 : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">Sin imagen</div>';

 let extraMetrics='';
 let actionButtons='';
 if(id==='huerto'){
 const modeLabel=(typeof getFarmModeLabel==='function') ? getFarmModeLabel(b.farmMode) : 'Sin mejora';
 const prodLabel=(typeof getFarmProductionText==='function') ? getFarmProductionText(b, state.day) : '+2 comida por dÃ­a';
 extraMetrics+=`<div class="metric"><span>ProducciÃ³n actual</span><b>${escapeHtml(prodLabel)}</b></div>`;
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
 extraMetrics+=`<div class="metric"><span>Gallinas</span><b>${state.chickens} / ${chickenMax}</b></div><div class="metric"><span>ProducciÃ³n actual</span><b>${prod>0?`+${prod} comida/dÃ­a`:'Sin producciÃ³n'}</b></div>`;
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
 const actionLabel=curableLevel?`Curar herida ${curableLevel}`:'AcciÃ³n no disponible';
 const actionDisabled=(!b.active||!curableLevel||b._usedToday)?'disabled':'';
 const actionNote=!b.active?'Sin energÃ­a':(b._usedToday?'Ya usado hoy':(curableLevel?`${targetCount} objetivo${targetCount!==1?'s':''} disponible${targetCount!==1?'s':''}`:'Nivel insuficiente'));
 extraMetrics+=`<div class="metric"><span>AcciÃ³n diaria</span><b>${escapeHtml(actionNote)}</b></div>`;
 actionButtons+=`<button class="secondary" onclick="openMedicalBarracksTreatment()" ${actionDisabled}>${escapeHtml(actionLabel)}</button>`;
 }
 if(id==='atalaya'&&b.built){
 const level=Number(b.level||0);
 const hostileCount=(state.attackThreat?1:0)+(state.activeThreats||[]).filter(th=>th&&!th.resolved&&typeof isThreatHostile==='function'&&isThreatHostile(th)).length;
 extraMetrics+=`<div class="metric"><span>Nivel de guardia</span><b>${level} / 3</b></div>`;
 if(level>=2){
  extraMetrics+=`<div class="metric"><span>Amenazas hostiles</span><b>${hostileCount}</b></div>`;
  actionButtons+=`<button class="secondary" onclick="openAtalayaBinoculars()" ${hostileCount?'':'disabled'}>PrismÃ¡ticos</button>`;
 }
 }
 if(id==='almacen'&&b.built){
 actionButtons+=`<button class="secondary" onclick="openStorageModal()">Abrir almacÃ©n</button>`;
 }
 if(id==='generador'){
 extraMetrics+=renderElectricityConsumersPanel();
 }
 const npcCapacity=(typeof getBuildingNpcCapacity==='function') ? getBuildingNpcCapacity(id) : null;
 if(npcCapacity!==null){
  const npcOccupancy=(typeof getBuildingNpcOccupancy==='function') ? getBuildingNpcOccupancy(id) : ((typeof getBuildingNpcList==='function' ? getBuildingNpcList(id) : [])||[]).length;
  extraMetrics+=`<div class="metric"><span>Capacidad NPC</span><b>${npcOccupancy} / ${npcCapacity}</b></div>`;
 }
 if(id==='cementerio'){
 actionButtons+=`<button class="secondary" onclick="showCemeteryDetail()">Abrir cementerio</button>`;
 }
 if(id==='torre_radio'&&b.built){
 const radioReadyDays=(typeof window.getRadioTowerCallDaysRemaining==='function') ? window.getRadioTowerCallDaysRemaining() : 0;
 const radioStatus = radioReadyDays>0 ? `Recargando (${radioReadyDays} dÃ­a${radioReadyDays!==1?'s':''})` : 'Listo para llamar';
 const workshopBonus = (state.buildings?.taller?.built && Number(state.buildings.taller.level||0)>=4) ? 'Taller mejorado: recarga 2 dÃ­as' : 'Recarga normal: 3 dÃ­as';
 extraMetrics+=`<div class="metric"><span>Estado de radio</span><b>${escapeHtml(radioStatus)}</b></div>`;
 extraMetrics+=`<div class="metric"><span>Mejora del Taller</span><b>${escapeHtml(workshopBonus)}</b></div>`;
 }
 const towerKnownRadioNpcs=(id==='torre_radio' && typeof window.getRadioTowerKnownNpcs==='function') ? window.getRadioTowerKnownNpcs() : [];
 const buildingNpcs=(towerKnownRadioNpcs.length ? towerKnownRadioNpcs : (typeof window.getBuildingNpcList==='function' ? (window.getBuildingNpcList(id)||[]) : []));
 const npcAction = (id==='torre_radio' && towerKnownRadioNpcs.length) ? 'window.callRadioNpc' : 'window.launchNpcInteraction';
 const assignedNpcHtml=buildingNpcs.length?`<div class="metric" style="grid-column:1/-1;display:block;"><span style="display:block;margin-bottom:8px;">${id==='torre_radio'&&towerKnownRadioNpcs.length ? 'Contactos de radio' : 'Personal asignado'}</span><b style="display:block;"><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">${buildingNpcs.map(npc=>`<button type="button" onclick="${npcAction} && ${npcAction}('${escapeAttr(String(npc.id||''))}')" title="${escapeAttr(npc.name||'NPC')} Â· confianza ${Number(npc.trust||0)}" style="width:52px;height:52px;border:1px solid var(--line2);background:var(--panel2);padding:0;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center;">${npc.portrait||npc.image?`<img src="${escapeAttr(npc.portrait||npc.image)}" alt="${escapeAttr(npc.name||'NPC')}" style="width:100%;height:100%;object-fit:cover;display:block;">`:`<span style="font-size:20px;color:var(--amber-bright);">${id==='torre_radio' ? 'ðŸ“»' : 'ðŸ‘¤'}</span>`}</button>`).join('')}</div></b></div>`:'';
 if(id==='torre_radio'&&b.built){
 const callReady = !(typeof window.isRadioTowerCallOnCooldown==='function' && window.isRadioTowerCallOnCooldown());
 const disabled = !callReady ? 'disabled' : '';
 if(!buildingNpcs.length){
 actionButtons+=`<button class="secondary" onclick="window.callRadioQuest && window.callRadioQuest()" ${disabled}>Buscar quest repetible</button>`;
 }
 }

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
 <div class="metric"><span>Coste mejora</span><b>${b.constructible ? getBuildingCost(b.id)+' \u{1F527}' : '\u2014 bloqueado'}</b></div>
 ${capacity!==null?`<div class="metric"><span>Capacidad</span><b>${capacity} personas</b></div>`:''}
 ${overflow!==null&&overflow>0?`<div class="metric"><span style="color:var(--danger-bright)">âš  Saturado</span><b style="color:var(--danger-bright)">+${overflow} sin espacio</b></div>`:''}
 ${extraMetrics}
 ${assignedNpcHtml}
 ${actionButtons?`<div class="metric" style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">${actionButtons}</div>`:''}
 </div>
 </div>`;
 openBuildingPopup();
}

function openBuildModal(survivorId){
 const s=state.survivors.find(x=>x.id===survivorId);
 buildOptions.innerHTML='';
 (gameData.buildings||[]).forEach(def=>{
 if(!def||!def.id) return;
 if(def.showInBuildMenu===false || def.hideFromBuildMenu===true) return;
 if(def?.abandonedBuilding && typeof isAbandonedBuildingRemoved==='function' && isAbandonedBuildingRemoved(def.id)) return;
 if(typeof isBuildingHiddenUntilUnlocked==='function' && isBuildingHiddenUntilUnlocked(def)){
  const current=state.buildings?.[def.id];
  if(!(current?.mapUnlocked || current?.revealedOnMap || def.unlocked || def.revealed)) return;
 }
 const defId=String(def?.id||'').trim().toLowerCase();
 if(def?.fromAbandoned || String(def?.type||'').toLowerCase()==='adaptation' || defId==='cantina' || defId==='sala_comun') return;
 if(!state.buildings[def.id]&&typeof ensureBuildingStateEntry==='function') ensureBuildingStateEntry(def);
 const current=state.buildings[def.id];
 if(def?.abandonedBuilding || current?.abandonedBuilding){
  if(typeof appendAbandonedBuildOption==='function') appendAbandonedBuildOption(buildOptions, def);
  return;
 }
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
 const elecLabel=elecReq>0&&!current?.built?` Â· Requiere ${elecReq}âš¡ (libre: ${getElectricityFree()})` : elecReq>0&&current?.built?` Â· Usando ${elecReq}âš¡`:'';

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
 const timeLabel=constructDays===1?'1 dÃ­a':`${constructDays} dÃ­as`;
 box.innerHTML=`<div><div><b>${escapeHtml(label)}</b></div><div class="mini">Coste: ${displayCost} ðŸ”§${elecLabel} Â· â± ${timeLabel} Â· ${blockReason?`<span style="color:var(--warn-bright)">${blockReason}</span> Â· `:''}${escapeHtml(def.effect||'')} Â· Nivel mÃ¡x. ${maxLevel}</div></div><button ${blocked||atCap||state.materials<buildCost||!hasElec?'disabled':''}>${atCap?'MÃ¡ximo':'Elegir'}</button>`;
 box.querySelector('button').addEventListener('click',()=>{
 if(blocked||atCap) return;
 const cost=getBuildingCost(def.id);
 const ingenieroBonus=getSkillBonus(s,'build');
 const finalCost=Math.max(1,cost-(ingenieroBonus.costReduction||0));
 if(state.materials<finalCost) return;
 if(elecReq>0&&getElectricityFree()<elecReq){ addLog('No hay suficiente electricidad libre.'); return; }
 // Deduct resources immediately
 state.materials-=finalCost;
 if(ingenieroBonus.costReduction) addLog(`âš™ ${s.name} (Ingeniero) reduce el coste en ${ingenieroBonus.costReduction} material.`);
 // Don't mark as built yet â€” track construction in progress
 const days=getBuildingConstructionDays(def.id, nextLevel);
 if(getStabilityModifiers().extraBuildDays>0){
 addLog('âš  La baja estabilidad del asentamiento ralentiza el trabajo. +1 dÃ­a.');
 }
 state.buildings[def.id]._constructionCost=finalCost;
 state.buildings[def.id]._lastConstructionCost=finalCost;
 state.buildings[def.id]._constructionDays=days;
 state.buildings[def.id]._constructionDaysLeft=days;
 state.buildings[def.id]._underConstruction=true;
 s.action={type:'construir',target:def.id};
 s.status='ocupado';
 const dayStr=days===1?'1 dÃ­a':`${days} dÃ­as`;
 addLog(`ðŸ”¨ ${s.name} comienza a construir ${state.buildings[def.id].name}. -${finalCost} mat. Tiempo: ${dayStr}.`);
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

 text.textContent=`Solo hay ${canFeed} raciÃ³n${canFeed!==1?'es':''} para ${survivors.length + npcList.length} bocas. Elige quiÃ©n come (mÃ¡x. ${canFeed}):`;

 list.innerHTML='';
 const selected=new Set();

 survivors.forEach(s=>{
 const item=document.createElement('div');
 item.style.cssText='display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line2);cursor:pointer;background:var(--panel2);';
 const moraleColor=getMoraleColor(s);
 item.innerHTML=`<div style="width:44px;height:44px;overflow:hidden;border:1px solid var(--line2);flex-shrink:0;">${getSurvivorImage(s)?`<img src="${escapeAttr(getSurvivorImage(s))}" style="width:100%;height:100%;object-fit:cover;filter:grayscale(20%);">`:'<div style="width:44px;height:44px;background:var(--panel3);"></div>'}</div><div style="flex:1;"><div style="font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:0.06em;">${escapeHtml(s.name)}</div><div style="font-size:11px;color:var(--muted);margin-top:2px;">${s.status}</div><div style="font-size:12px;color:${moraleColor};margin-top:2px;">${getMoraleEmoji(s)} ${getMoraleLabel(s)}</div></div><div id="food-check-${s.id}" style="font-size:20px;color:var(--muted);">â—‹</div>`;
 item.addEventListener('click',()=>{
 if(selected.has(s.id)){
 selected.delete(s.id);
 item.style.borderColor='var(--line2)';
 item.style.background='var(--panel2)';
 document.getElementById('food-check-'+s.id).textContent='â—‹';
 document.getElementById('food-check-'+s.id).style.color='var(--muted)';
 } else if(selected.size<canFeed){
 selected.add(s.id);
 item.style.borderColor='var(--ok)';
 item.style.background='var(--ok-glow)';
 document.getElementById('food-check-'+s.id).textContent='â—';
 document.getElementById('food-check-'+s.id).style.color='var(--ok-bright)';
 }
 });
 list.appendChild(item);
 });

 npcList.forEach(npc=>{
 const item=document.createElement('div');
 item.style.cssText='display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line2);cursor:pointer;background:var(--panel2);';
 const portrait=npc.portrait||npc.image||'';
 item.innerHTML=`<div style="width:44px;height:44px;overflow:hidden;border:1px solid var(--line2);flex-shrink:0;">${portrait?`<img src="${escapeAttr(portrait)}" style="width:100%;height:100%;object-fit:cover;filter:grayscale(20%);">`:'<div style="width:44px;height:44px;background:var(--panel3);display:flex;align-items:center;justify-content:center;color:var(--amber-bright);font-size:18px;">ðŸ‘¤</div>'}</div><div style="flex:1;"><div style="font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:0.06em;">${escapeHtml(npc.name||'NPC')}</div><div style="font-size:11px;color:var(--muted);margin-top:2px;">NPC reclutado</div><div style="font-size:12px;color:var(--amber-bright);margin-top:2px;">Confianza ${Number(npc.trust||0)}</div></div><div id="food-check-${npc.id}" style="font-size:20px;color:var(--muted);">â—‹</div>`;
 item.addEventListener('click',()=>{
  if(selected.has(npc.id)){
   selected.delete(npc.id);
   item.style.borderColor='var(--line2)';
   item.style.background='var(--panel2)';
   document.getElementById('food-check-'+npc.id).textContent='â—‹';
   document.getElementById('food-check-'+npc.id).style.color='var(--muted)';
  } else if(selected.size<canFeed){
   selected.add(npc.id);
   item.style.borderColor='var(--ok)';
   item.style.background='var(--ok-glow)';
   document.getElementById('food-check-'+npc.id).textContent='â—';
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
 title.textContent = `\u{1F392} Mochila \u00B7 ${survivor.name}`;
 const equippedNames = getEquippedItems(survivor).map(it=>it.name);
 summary.textContent = `${getInventorySummaryText(survivor.inventory, survivor.inventorySlots||3)}${equippedNames.length ? ` Â· Equipado: ${equippedNames.join(', ')}` : ''}`;
 tools.innerHTML = `
 <button class="btn secondary" onclick="equipAllSurvivorItems('${survivor.id}')">Equipar todo</button>
 <button class="btn secondary" onclick="unequipAllSurvivorItems('${survivor.id}')">Desequipar todo</button>`;
 if(!survivor.inventory.length){
 list.innerHTML = '<div style="color:var(--dim);text-align:center;padding:12px 0;">// Mochila vacÃ­a.</div>';
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
 <div class="item-meta">${escapeHtml(item.description||'')} Â· ${getItemTypeLabel(item)} Â· ${escapeHtml(getQualityText(item))}${item.repairSkill?` Â· ReparaciÃ³n: ${escapeHtml(item.repairSkill)}`:''}${equipped?' Â· Equipado':''}</div>
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
 if(typeof ensureBaseJunkStorage==='function') ensureBaseJunkStorage();
 const modal=document.getElementById('storageModal');
 const summary=document.getElementById('storageModalSummary');
 const list=document.getElementById('storageModalList');
 if(!modal||!summary||!list) return;
 const slots=4 + (state.buildings.almacen?.level||1)*2;
 const normalInventory=(state.inventory||[]).filter(raw=>materializeItem(raw).itemType!=='junk');
 const junkInventory=(state.junk||[]).map(materializeItem);
 summary.innerHTML = `${inventoryUsedSlots(normalInventory)} / ${slots} objetos guardados. <button class="btn secondary" style="margin-left:8px;padding:3px 8px;font-size:10px;" onclick="openJunkStorageModal()">Junk (${junkInventory.length})</button>`;
 if(!normalInventory.length){
 list.innerHTML='<div style="color:var(--dim);text-align:center;padding:12px 0;">// Almacén vacío.</div>';
 } else {
 const baseSurvivors=getBaseSurvivorsForInventory();
 list.innerHTML = state.inventory.map((raw,i)=>{
 const item=materializeItem(raw);
 if(item.itemType==='junk') return '';
 const assignBtns=baseSurvivors.map(s=>{
 const disabled = inventoryUsedSlots(s.inventory||[]) >= Number(s.inventorySlots||3) || !canEquipItem(s, item);
 const title = !canEquipItem(s,item) ? `Requiere ${item.requiredSkill}` : '';
 return `<button class="btn secondary" onclick="moveBaseItemToSurvivor(${i},'${s.id}')" ${disabled?'disabled':''} title="${escapeAttr(title)}">Dar a ${escapeHtml(s.name)}</button>`;
 }).join(' ');
 const baseUseBtn = item.itemType==='consumable' ? `<button class="btn secondary" onclick="useBaseInventoryItem(${i})">Usar en base</button>` : '';
 return `<div class="item-card">
 <div class="item-title">${escapeHtml(item.name)}</div>
 <div class="item-meta">${escapeHtml(item.description||'')} · ${getItemTypeLabel(item)} · ${escapeHtml(getQualityText(item))}</div>
 <div class="item-actions">${assignBtns || '<span style="color:var(--dim);font-size:11px;">No hay supervivientes en base disponibles.</span>'} ${baseUseBtn}</div>
 </div>`;
 }).join('');
 }
 modal.classList.add('open');
}

function openJunkStorageModal(){
 closeBuildingPopup();
 if(typeof ensureBaseJunkStorage==='function') ensureBaseJunkStorage();
 const modal=document.getElementById('storageModal');
 const summary=document.getElementById('storageModalSummary');
 const list=document.getElementById('storageModalList');
 if(!modal||!summary||!list) return;
 const junk=(state.junk||[]).map(materializeItem);
 summary.innerHTML = `Junk guardado: ${junk.length}. <button class="btn secondary" style="margin-left:8px;padding:3px 8px;font-size:10px;" onclick="openStorageModal()">Objetos</button>`;
 list.innerHTML = junk.length ? junk.map(item=>`<div class="item-card">
 <div class="item-title">${escapeHtml(item.name)}</div>
 <div class="item-meta">${escapeHtml(item.description||'')} · Junk${item.questTag?` · ${escapeHtml(item.questTag)}`:''}</div>
 </div>`).join('') : '<div style="color:var(--dim);text-align:center;padding:12px 0;">// No hay junk guardado.</div>';
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
 summary.textContent = `Materiales: ${state.materials} Â· ${hasManitas?'Hay un survivor con manitas en base.':'No hay nadie con manitas en base.'}`;
 if(!rows.length){
 list.innerHTML='<div style="color:var(--dim);text-align:center;padding:12px 0;">// No hay objetos reparables.</div>';
 } else {
 list.innerHTML = rows.map(row=>{
 const item=row.item;
 const cost=getRepairCost(item);
 const disabled=!canRepairItemWithCurrentBase(item);
 return `<div class="item-card">
 <div class="item-title">${escapeHtml(item.name)}${row.owner?` Â· ${escapeHtml(row.owner.name)}`:' Â· AlmacÃ©n'}</div>
 <div class="item-meta">${getItemTypeLabel(item)} Â· ${item.quality}/${item.maxQuality} Â· Coste ${cost} materiales${item.repairSkill?` Â· Requiere ${escapeHtml(item.repairSkill)}`:''}</div>
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

// â”€â”€ UI extracted in phase C from legacy-app.js â”€â”€

function openDogPopup(ownerId){
 if(!state.dog){ addLog('ðŸ• No hay perro en el asentamiento.'); render(); return; }
 const popup=document.getElementById('decidePopup');
 const promptEl=document.getElementById('decidePrompt');
 const optionsEl=document.getElementById('decideOptions');
 if(!popup||!promptEl||!optionsEl) return;
 const owner=getAliveSurvivorById(ownerId)||ensureDogOwner();
 const dog=state.dog;
 const targets=getDogPopupTargets(owner?.id||null);
 promptEl.innerHTML=`<div style="font-family:var(--font-display);font-size:16px;letter-spacing:0.08em;color:var(--ok-bright);margin-bottom:6px;">ðŸ• ${escapeHtml(dog.name||'Perro')}</div><div style="font-size:12px;line-height:1.6;color:var(--text);">${escapeHtml(dog.description||'CompaÃ±ero canino del asentamiento.')}</div><div style="margin-top:8px;font-size:11px;color:var(--muted);">Ahora mismo sigue a <b style="color:var(--text);">${escapeHtml(owner?.name||'nadie')}</b>.</div>`;
 optionsEl.innerHTML='';
 if(targets.length){
 targets.forEach(target=>{
 const btn=document.createElement('button');
 btn.className='btn secondary';
 btn.style.cssText='text-align:left;padding:10px 14px;line-height:1.5;';
 btn.innerHTML=`<div style="font-family:var(--font-display);font-size:13px;letter-spacing:0.05em;">Seguir a ${escapeHtml(target.name)}</div><div style="font-size:10px;color:var(--muted);margin-top:3px;">Activo \u00B7 ${getMoraleLabel(target)} \u00B7 fatiga ${target.fatigue}/${target.maxFatigue}</div>`;
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
 titleEl.textContent = entry.betrayed ? 'TraiciÃ³n y abandono' : 'Abandono del asentamiento';
 nameEl.textContent = entry.name || 'Superviviente';
 portrait.innerHTML = entry.imageUrl ? `<img src="${escapeAttr(entry.imageUrl)}" style="width:100%;height:100%;object-fit:cover;">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:42px;">ðŸšª</div>';
 textEl.textContent = entry.text || `${entry.name} abandona la base por baja moral.`;
 effectsEl.innerHTML = formatLogLine(entry.effectsText || '-2 estabilidad');
 popup.classList.add('open');
}

function openGroupActionPopup(){
 resetGroupActionDraft(false);
 if(!getGroupActionEligibleSurvivors().length){
 addLog('ðŸ¤ No hay supervivientes activos en la base disponibles para una acciÃ³n grupal.');
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
 summary.textContent=selectedIds.length ? `â˜… lÃ­der: ${((state.survivors.find(s=>String(s.id)===selectedIds[0])||{}).name||'')} Â· apoyo: ${Math.max(0, selectedIds.length-1)}` : 'Selecciona primero al lÃ­der';

 if(!selectedAction){
 listWrap.innerHTML='<div class="group-action-empty">No hay acciones grupales disponibles.</div>';
 confirmBtn.disabled=true;
 return;
 }
 if(!survivors.length){
 listWrap.innerHTML='<div class="group-action-empty">No hay supervivientes compatibles con esa acciÃ³n.</div>';
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
 <div style="font-size:11px;color:var(--muted);margin-top:2px;">Fatiga ${s.fatigue}/${s.maxFatigue} Â· ${hasActiveInjury(s)?'Herida '+escapeHtml(injuryDisplayName(s.injuryLevel||'simple')):'Sin herida'} Â· <span style="color:${getMoraleColor(s)};">${getMoraleEmoji(s)} ${getMoraleLabel(s,false)}</span></div>
 </div>
 <div class="group-action-star">${isLeader?'â˜…':(isSelected?'â€¢':'â—‹')}</div>
 </div>`;
 }).join('');
 listWrap.querySelectorAll('[data-group-survivor]').forEach(node=>node.addEventListener('click',()=>toggleGroupActionMember(node.dataset.groupSurvivor)));
 confirmBtn.disabled=selectedIds.length===0;
}

function openGameOver(text){document.getElementById('gameOverText').textContent=text;gameOverWrap.classList.add('open')}

function openCombatResultPopup({title,text,icon='âš”',summary=[],effects=[]}){
 const popup=document.getElementById('combatResultPopup');
 const titleEl=document.getElementById('combatResultTitle');
 const imgEl=document.getElementById('combatResultImg');
 const textEl=document.getElementById('combatResultText');
 const summaryEl=document.getElementById('combatResultSummary');
 const effectsEl=document.getElementById('combatResultEffects');
 titleEl.textContent=title||'âš” Resultado de combate';
 imgEl.textContent=icon||'âš”';
 textEl.textContent=text||'El combate ha terminado.';
 summaryEl.innerHTML=(summary||[]).length
 ? '<b>Ganancias / pÃ©rdidas:</b><br>'+summary.map(s=>`â€¢ ${escapeHtml(s)}`).join('<br>')
 : '';
 effectsEl.innerHTML=(effects||[]).length
 ? '<b>Efectos aplicados:</b><br>'+effects.map(s=>`â€¢ ${escapeHtml(s)}`).join('<br>')
 : '';
 popup.classList.add('open');
}

function openCombatResultPopup({title,text,icon='*',summary=[],effects=[],outcome=null,settlementScore=null,hostileScore=null,settlementLabel='ASENTAMIENTO',hostileLabel='HOSTILES',image=null}){
 const popup=document.getElementById('combatResultPopup');
 const titleEl=document.getElementById('combatResultTitle');
 const imgEl=document.getElementById('combatResultImg');
 const textEl=document.getElementById('combatResultText');
 const summaryEl=document.getElementById('combatResultSummary');
 const effectsEl=document.getElementById('combatResultEffects');
 const summaryList=Array.isArray(summary)?summary:[];
 const resultLine=summaryList.map(String).find(line=>/resultado\s*:\s*\d+\s*vs\s*\d+/i.test(line));
 const resultMatch=resultLine?.match(/resultado\s*:\s*(\d+)\s*vs\s*(\d+)/i);
 const inferredTitle=String(title||'').toLowerCase();
 if((settlementScore===null||settlementScore===undefined) && resultMatch) settlementScore=resultMatch[1];
 if((hostileScore===null||hostileScore===undefined) && resultMatch) hostileScore=resultMatch[2];
 if(!outcome && /victoria|exitosa|superada|repelid/.test(inferredTitle)) outcome='victory';
 if(!outcome && /derrota|fallid|sufrida|fracas/.test(inferredTitle)) outcome='defeat';
 const cleanOutcome=String(outcome||'').trim().toLowerCase();
 const isVictory=cleanOutcome==='victory'||cleanOutcome==='victoria'||cleanOutcome==='win';
 const isDefeat=cleanOutcome==='defeat'||cleanOutcome==='derrota'||cleanOutcome==='loss';
 const resultImage=image || (isVictory?'./data/pic/victory.jpg':isDefeat?'./data/pic/defeat.jpg':'');
 if(imgEl.parentElement){
  imgEl.parentElement.style.gridTemplateColumns='minmax(190px,240px) 1fr';
  imgEl.parentElement.style.gap='14px';
 }
 imgEl.style.width='100%';
 imgEl.style.height='320px';
 titleEl.textContent=title||'Resultado de combate';
 titleEl.style.color=isVictory?'var(--ok-bright)':isDefeat?'var(--danger-bright)':'var(--danger-bright)';
 imgEl.innerHTML=resultImage
 ? `<img src="${escapeAttr(resultImage)}" alt="${escapeAttr(title||'Resultado de combate')}" style="width:100%;height:100%;object-fit:cover;display:block;">`
 : escapeHtml(icon||'*');
 textEl.textContent=text||'El combate ha terminado.';
 const hasScore=settlementScore!==null&&settlementScore!==undefined&&hostileScore!==null&&hostileScore!==undefined;
 const effectList=Array.isArray(effects)?effects:[];
 const gainLossLines=[...summaryList, ...effectList];
 summaryEl.innerHTML=gainLossLines.length
 ? '<b>Ganancias / perdidas:</b><br>'+gainLossLines.map(s=>`- ${escapeHtml(s)}`).join('<br>')
 : '';
 if(hasScore){
  const resultLabel=isVictory?'VICTORIA':isDefeat?'DERROTA':'ENFRENTAMIENTO';
  const resultColor=isVictory?'var(--ok-bright)':isDefeat?'var(--danger-bright)':'var(--amber-bright)';
  const scoreHtml=`
  <div style="border:1px solid var(--line2);background:rgba(0,0,0,0.18);padding:10px;margin-bottom:10px;">
   <div style="font-family:var(--font-display);font-size:18px;letter-spacing:0.08em;color:${resultColor};text-align:center;margin-bottom:8px;">${escapeHtml(resultLabel)}</div>
   <div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:center;text-align:center;">
    <div>
     <div style="font-family:var(--font-display);font-size:12px;letter-spacing:0.12em;color:var(--ok-bright);margin-bottom:6px;">${escapeHtml(settlementLabel||'ASENTAMIENTO')}</div>
     <div style="font-family:var(--font-display);font-size:38px;line-height:1;color:var(--ok-bright);">${escapeHtml(settlementScore)}</div>
    </div>
    <div style="font-family:var(--font-display);font-size:34px;line-height:1;color:var(--amber-bright);">VS</div>
    <div>
     <div style="font-family:var(--font-display);font-size:12px;letter-spacing:0.12em;color:var(--danger-bright);margin-bottom:6px;">${escapeHtml(hostileLabel||'HOSTILES')}</div>
     <div style="font-family:var(--font-display);font-size:38px;line-height:1;color:var(--danger-bright);">${escapeHtml(hostileScore)}</div>
    </div>
   </div>
  </div>`;
  summaryEl.innerHTML=scoreHtml+summaryEl.innerHTML;
 }
 effectsEl.innerHTML='';
 popup.classList.add('open');
}

function openDecidePopup(options, prompt){
 const popup=document.getElementById('decidePopup');
 const promptEl=document.getElementById('decidePrompt');
 const optionsEl=document.getElementById('decideOptions');
 promptEl.textContent=prompt||'El grupo debe tomar una decisiÃ³n.';
 optionsEl.innerHTML='';
 options.forEach(opt=>{
 const btn=document.createElement('button');
 btn.className='btn '+(opt.className||'secondary');
 btn.style.cssText='text-align:left;padding:10px 14px;line-height:1.5;';
 btn.innerHTML=`<div style="font-family:var(--font-display);font-size:13px;letter-spacing:0.05em;">${escapeHtml(opt.label||'OpciÃ³n')}</div>${opt.description?`<div style="font-size:10px;color:var(--muted);margin-top:3px;">${escapeHtml(opt.description)}</div>`:''}`;
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

function openLogPopup(text, imageUrl=null){
 const popup=document.getElementById('logPopup');
 const imgEl=document.getElementById('logPopupImg');
 const textEl=document.getElementById('logPopupText');
 textEl.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
 const rawImage=String(imageUrl||'').trim();
 const baseImage=rawImage||'log';
 const hasPath=/[\/\\]/.test(baseImage);
 const hasExtension=/\.[a-z0-9]+$/i.test(baseImage);
 const primary=hasPath ? `${baseImage}${hasExtension?'':'.jpg'}` : `./data/pic/${baseImage}${hasExtension?'':'.jpg'}`;
 const fallback=!hasExtension || /\.jpe?g$/i.test(baseImage)
  ? (hasPath ? baseImage.replace(/\.[^/.\\]+$/,'')+'.jfif' : `./data/pic/${baseImage.replace(/\.[^/.\\]+$/,'')}.jfif`)
  : '';
 imgEl.innerHTML = '';
 const img=document.createElement('img');
 img.src=primary;
 img.style.cssText='width:100%;height:100%;object-fit:cover;display:block;';
 if(fallback&&fallback!==primary) img.onerror=()=>{ img.onerror=null; img.src=fallback; };
 imgEl.appendChild(img);
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
 <div style="font-size:10px;color:var(--muted);">${getMoraleEmoji(s)} Â· Fatiga: ${s.fatigue}/${s.maxFatigue}${bonus?` Â· <span style="color:var(--amber-bright)">+${bonus} combate</span>`:''}
 </div>
 </div>
 <div id="attack-setup-check-${s.id}" style="font-size:20px;color:var(--muted);">â—‹</div>`;
 item.addEventListener('click',()=>{
 if(selected.has(s.id)){
 selected.delete(s.id);
 item.style.borderColor='var(--line2)';
 item.style.background='var(--panel2)';
 document.getElementById('attack-setup-check-'+s.id).textContent='â—‹';
 document.getElementById('attack-setup-check-'+s.id).style.color='var(--muted)';
 } else {
 selected.add(s.id);
 item.style.borderColor='var(--danger-bright)';
 item.style.background='rgba(138,53,53,0.1)';
 document.getElementById('attack-setup-check-'+s.id).textContent='â—';
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
 addLog(`âš” ${s.name} se prepara para el ataque.`);
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

function getCemeteryDaysLived(s){
 const saved=Number(s?.daysLived||0);
 if(saved>0) return Math.max(1, saved);
 const died=Number(s?.diedOnDay||state.day||1);
 const joined=Number(s?.joinedOnDay||1);
 return Math.max(1, died-joined+1);
}

function getCemeteryRipLine(s){
 const days=getCemeteryDaysLived(s);
 return `R.I.P. · Vivió ${days} día${days!==1?'s':''}`;
}

function getCemeteryLoveLine(s){
 const love=s?.loveMemorial;
 if(!love) return '';
 const label=love.name||love.id||'';
 return label ? `💐 ${escapeHtml(label)} no te olvida.` : '';
}

function showCemeteryDetail(){
 state.currentDetail='cementerio';
 const deadOnly=state.cemetery.filter(s=>!s.departed);
 const departed=state.cemetery.filter(s=>s.departed);
 let html='';
 if(!deadOnly.length&&!departed.length){
 html='<div style="color:var(--dim);font-size:12px;text-align:center;padding:12px 0;">// NingÃºn superviviente ha caÃ­do todavÃ­a.</div>';
 } else {
 if(deadOnly.length){
 html+='<div style="font-size:10px;color:var(--danger-bright);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">âœ CaÃ­dos ('+deadOnly.length+')</div>';
 html+=deadOnly.map(s=>{
 const img=getSurvivorImage({...s,status:'muerto'});
 const loveLine=getCemeteryLoveLine(s);
 return '<div style="display:grid;grid-template-columns:36px 1fr;gap:8px;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--line);">'
 +'<img src="'+escapeAttr(img)+'" style="width:36px;height:36px;object-fit:cover;filter:grayscale(1) brightness(0.6);border:1px solid var(--danger);">'
 +'<div><div style="font-family:var(--font-display);font-size:13px;color:var(--danger-bright);">'+escapeHtml(s.name)+'</div>'
 +'<div style="font-size:10px;color:var(--muted);">✝ '+escapeHtml(getCemeteryRipLine(s))+'</div>'
 +(loveLine?'<div style="font-size:10px;color:var(--muted);">'+loveLine+'</div>':'')+'</div></div>';
 }).join('');
 }
 if(departed.length){
 html+='<div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin:8px 0 6px;">ðŸšª Marchados ('+departed.length+')</div>';
 html+=departed.map(s=>'<div style="font-size:11px;color:var(--muted);padding:3px 0;">'+escapeHtml(s.name)+' â€” dÃ­a '+s.diedOnDay+(s.betrayed?' (traiciÃ³n)':'')+'</div>').join('');
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
 addLog(`âŒ ${it.name} estÃ¡ roto.`);
 return;
 }
 if(it.itemType==='weapon'){
 survivor.equippedWeapon = survivor.equippedWeapon===it.itemId ? null : it.itemId;
 addLog(survivor.equippedWeapon===it.itemId ? `ðŸ”« ${survivor.name} equipa <span class="log-item">${it.name}</span>.` : `ðŸ“¦ ${survivor.name} guarda <span class="log-item">${it.name}</span>.`);
 } else {
 if(survivor.equippedGear.includes(it.itemId)){
 survivor.equippedGear = survivor.equippedGear.filter(x=>x!==it.itemId);
 addLog(`ðŸ“¦ ${survivor.name} guarda <span class="log-item">${it.name}</span>.`);
 } else {
 survivor.equippedGear.push(it.itemId);
 addLog(`ðŸ§° ${survivor.name} equipa <span class="log-item">${it.name}</span>.`);
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
 const eq = s.equippedWeapon===item.itemId ? ' Â· Equipada' : '';
 const req = '';
 return `<div class="inventory-panel-item">${escapeHtml(item.name)} Â· ${escapeHtml(getItemTypeLabel(item))} Â· ${escapeHtml(getQualityText(item))}${escapeHtml(eq)}${escapeHtml(req)}</div>`;
 }).join('')
 : '<div class="inventory-panel-item empty">// Mochila vacÃ­a.</div>';
 return `<div class="inventory-panel-card"${selected?' style="border-color:var(--amber);"':''}>
 <div class="inventory-panel-head">
 <span>${selected?'ðŸŽ’ ':''}${escapeHtml(s.name)}</span>
 <span class="inventory-panel-slots">${inventoryUsedSlots(s.inventory)} / ${Number(s.inventorySlots||3)} huecos</span>
 </div>
 <div class="inventory-panel-items">${items}</div>
 </div>`;
 }).join('');
 if(hint){
 hint.textContent = selectedSurvivorId
 ? 'AdemÃ¡s del popup, la mochila seleccionada queda visible aquÃ­ para pruebas.'
 : 'Haz clic en el icono ðŸŽ’ de un superviviente para ver su mochila.';
 }
}

function openSurvivorInvitePopup(s){
 const popup=document.getElementById('survivorInvitePopup');
 const img=document.getElementById('inviteImg');
 const url=s.image?.url||s.imageUrl||'';
 if(url){img.src=url;img.style.display='block';}else{img.style.display='none';}
 document.getElementById('inviteName').textContent=s.name||'Desconocido';
 document.getElementById('inviteStory').textContent=s.story||'No dice mucho de sÃ­ mismo.';
 const rarityLabel={1:'â­â­â­â­ Legendario',2:'â­â­â­ Raro',3:'â­â­ Poco comÃºn',4:'â­ ComÃºn'};
 document.getElementById('inviteStats').textContent=(rarityLabel[s.rarity??4]||'')+(s.skill&&s.skill!=='ninguna'?' Â· Habilidad: '+s.skill:'');
 popup.classList.add('open');
}

function openCemetery(){
 const list=document.getElementById('cemeteryList');
 if(!state.cemetery.length){
 list.innerHTML='<div class="cemetery-empty">// NingÃºn superviviente ha caÃ­do todavÃ­a.</div>';
 } else {
 const deadOnly=state.cemetery.filter(s=>!s.departed);
 list.innerHTML=deadOnly.map(s=>{
 const _cImg=getSurvivorImage({...s,status:'muerto'});
 const img=`<img class="cemetery-avatar" src="${escapeAttr(_cImg)}" alt="" style="filter:grayscale(1) brightness(0.6);">`;
 const loveLine=getCemeteryLoveLine(s);
 return `<div class="cemetery-card">
 ${img}
 <div>
 <div class="cemetery-name">${escapeHtml(s.name)}</div>
 <div class="cemetery-rip">✝ ${escapeHtml(getCemeteryRipLine(s))}</div>
 ${loveLine?`<div class="cemetery-story">${loveLine}</div>`:''}
 </div>
 </div>`;
 }).join('');
 if(!deadOnly.length) list.innerHTML='<div class="cemetery-empty">// NingÃºn superviviente ha caÃ­do todavÃ­a.</div>';
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
 const skills=getSurvivorSkills(s);
 const skillHtml=skills.length ? `<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--line2);font-family:var(--font-mono);font-size:12px;line-height:1.8;"><div style="color:var(--ok-bright);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">Habilidades</div>${skills.map(skill=>`<div style="margin-bottom:8px;"><b style="color:var(--text);">${escapeHtml(typeof getSurvivorSkillName==='function'?getSurvivorSkillName(skill):skill)}</b><div style="color:var(--muted);margin-top:2px;">${escapeHtml(typeof getSurvivorSkillDescription==='function'?getSurvivorSkillDescription(skill):'')}</div></div>`).join('')}</div>` : '';
 loreStory.innerHTML=`<div>${escapeHtml(s.story||'Sin historia registrada.')}</div>${skillHtml}${bonds.length?`<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--line2);font-family:var(--font-mono);font-size:12px;line-height:1.8;">${bonds.map(rel=>`<div style="color:${rel.color};">${escapeHtml(rel.text)}</div>`).join('')}</div>`:''}`;
 document.getElementById('survivorLoreModal').classList.add('open');
}

 function renderStatusRows(title, rows){
  return `<div style="margin-top:12px;"><div style="font-size:11px;color:var(--amber-bright);letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(title)}</div>${rows.length?rows.map(row=>`<div style="border:1px solid var(--line2);padding:8px 10px;margin-bottom:6px;background:rgba(255,255,255,.02);font-size:12px;line-height:1.5;">${row}</div>`).join(''):'<div style="color:var(--dim);font-size:12px;">Sin datos.</div>'}</div>`;
 }
