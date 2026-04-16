// Inventory and item systems extracted from legacy-app.js

function getItemDef(itemOrId){
 const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.itemId || itemOrId?.id;
 return (gameData.items||[]).find(x => x.id === id) || null;
}

function materializeItem(item){
 const def=getItemDef(item)||{};
 const out={...deepClone(def), ...deepClone(item||{})};
 out.itemId = out.itemId || out.id;
 out.id = out.itemId;
 out.name = out.name || def.name || out.itemId || 'Objeto';
 out.category = out.category || def.category || 'equipment';
 out.type = out.type || def.type || out.itemType || def.itemType || 'consumable';
 out.itemType = out.type;
 out.subtype = out.subtype || def.subtype || '';
 out.stackable = out.stackable ?? def.stackable ?? false;
 out.qty = Number(out.qty ?? 1);
 out.requiredSkill = '';
 out.repairSkill = out.repairSkill || def.repairSkill || '';
 out.effects = deepClone(out.effects || def.effects || []);
 out.description = out.description || def.description || '';
 out.slot = out.slot || def.slot || '';
 out.usableIn = deepClone(out.usableIn || def.usableIn || ['base','event']);
 out.use = out.use || def.use || '';
 out.combatBonus = Number(out.combatBonus ?? def.combatBonus ?? 0);
 out.repairable = out.repairable !== false && def.repairable !== false;
 if(out.itemType!=='consumable'){
 out.maxQuality = Number(out.maxQuality ?? out.maxDurability ?? def.maxQuality ?? def.maxDurability ?? def.quality ?? def.durability ?? 1);
 out.quality = Number(out.quality ?? out.durability ?? out.maxQuality);
 out.maxDurability = out.maxQuality;
 out.durability = out.quality;
 } else {
 out.maxQuality = 0;
 out.quality = 0;
 out.maxDurability = 0;
 out.durability = 0;
 }
 return out;
}

function normalizeInventoryList(list){
 return (list||[]).map(materializeItem);
}

function inventoryUsedSlots(list){
 return (list||[]).reduce((sum,it)=>sum + (materializeItem(it).itemType==='junk' ? 0 : 1), 0);
}
function ensureBaseJunkStorage(){
 if(!Array.isArray(state.junk)) state.junk=[];
 state.junk=normalizeInventoryList(state.junk);
 if(Array.isArray(state.inventory)){
 const keep=[];
 state.inventory.forEach(raw=>{
  const item=materializeItem(raw);
  if(item.itemType==='junk') state.junk.push(item);
  else keep.push(raw);
 });
 if(keep.length!==state.inventory.length) state.inventory=keep;
 }
 return state.junk;
}
function addJunkToBaseStorage(item, qty=1){
 const junk=ensureBaseJunkStorage();
 const mat=materializeItem(item);
 if(mat.itemType!=='junk') return false;
 for(let i=0;i<Math.max(1,Number(qty)||1);i++) junk.push(materializeItem(mat));
 return true;
}

function getQualityText(item){
 const it=materializeItem(item);
 if(it.itemType==='consumable') return it.stackable ? `x${it.qty}` : 'Un solo uso';
 return `${Math.max(0,it.quality)}/${Math.max(1,it.maxQuality)}`;
}

function getItemTypeLabel(item){
 const it=materializeItem(item);
 if(it.itemType==='weapon') return 'Arma';
 if(it.itemType==='consumable') return 'Consumible';
 if(it.itemType==='tool') return 'Herramienta';
 if(it.itemType==='junk') return 'Junk';
 if(it.itemType==='equipment') return 'Equipo';
 return it.itemType || 'Objeto';
}

function isSurvivorBuildingSomething(survivor){
 if(!survivor||survivor.status==='muerto') return false;
 if(String(survivor.action?.type||'')!=='construir') return false;
 const targetId=String(survivor.action?.target||'').trim();
 if(!targetId) return false;
 const building=state.buildings?.[targetId];
 return !!(building&&building._underConstruction);
}

function isToolItemLockedForConstruction(survivor, item){
 const it=materializeItem(item);
 if(it.itemType!=='tool') return false;
 return isSurvivorBuildingSomething(survivor);
}

function getEquippedToolIds(survivor){
 const equippedGear=Array.isArray(survivor?.equippedGear) ? survivor.equippedGear : [];
 const ids=[];
 equippedGear.forEach(id=>{
  const raw=(survivor?.inventory||[]).find(entry=>String(materializeItem(entry).itemId)===String(id));
  const item=materializeItem(raw||{itemId:id});
  if(item.itemType==='tool') ids.push(String(item.itemId));
 });
 return ids;
}

function hasAnotherEquippedTool(survivor, item){
 const it=materializeItem(item);
 if(it.itemType!=='tool') return false;
 const equippedToolIds=getEquippedToolIds(survivor);
 return equippedToolIds.some(id=>id!==String(it.itemId));
}

function canEquipItem(survivor, item){
 const it=materializeItem(item);
 if(it.itemType==='junk') return false;
 if(it.itemType!=='consumable' && it.quality<=0) return false;
 if(it.itemType==='tool' && hasAnotherEquippedTool(survivor, it)) return false;
 return true;
}

function normalizeItemEffectKind(effect){
 const raw=String(effect?.kind || effect?.type || effect?.effect || '').trim().toLowerCase();
 const aliases={
 melee:'melee',
 ranged:'ranged',
 armor:'armor',
 heal:'heal',
 food:'food',
 fun:'fun',
 morale:'fun',
 worker:'worker',
 combat_bonus:'melee',
 restorefatigue:'fatigue'
 };
 return aliases[raw] || raw;
}

function getItemEffectAmount(effect, fallback=1){
 const amt = Number(effect?.amount ?? effect?.value ?? fallback);
 return Number.isFinite(amt) ? amt : fallback;
}

function getItemEffects(item){
 return (materializeItem(item).effects || []).slice(0,2);
}

function isItemEquippedBySurvivor(survivor, item){
 const it=materializeItem(item);
 if(it.itemType==='weapon') return survivor.equippedWeapon===it.itemId;
 return Array.isArray(survivor.equippedGear) && survivor.equippedGear.includes(it.itemId);
}

function getEquippedItems(survivor){
 const inv=normalizeInventoryList(survivor.inventory||[]);
 const equipped = [];
 const seenIds=new Set();
 if(survivor.equippedWeapon){
 const weaponId=String(survivor.equippedWeapon);
 const w = inv.find(it=>String(materializeItem(it).itemId)===weaponId);
 if(w){
 equipped.push(materializeItem(w));
 seenIds.add(weaponId);
 }
 }
 (survivor.equippedGear||[]).forEach(id=>{
 const itemId=String(id);
 if(seenIds.has(itemId)) return;
 const gear=inv.find(it=>String(materializeItem(it).itemId)===itemId);
 if(gear){
 equipped.push(materializeItem(gear));
 seenIds.add(itemId);
 }
 });
 return equipped;
}

function getEquippedEffectTotal(survivor, kind){
 const target=String(kind);
 let total=0;
 getEquippedItems(survivor).forEach(item=>{
 getItemEffects(item).forEach(effect=>{
 if(normalizeItemEffectKind(effect)===target) total += getItemEffectAmount(effect, 1);
 });
 });
 return total;
}

function getEquippedRangedDiceBonus(survivor){
 let sides=0;
 getEquippedItems(survivor).forEach(item=>{
 getItemEffects(item).forEach(effect=>{
 if(normalizeItemEffectKind(effect)==='ranged'){
 sides = Math.max(sides, getItemEffectAmount(effect, 4));
 }
 });
 });
 return sides;
}

function findHealingItemForSurvivor(survivor){
 const inv=normalizeInventoryList(survivor.inventory||[]);
 const idx=inv.findIndex(it=>getItemEffects(it).some(e=>normalizeItemEffectKind(e)==='heal'));
 return idx>=0 ? {owner:'survivor', survivor, index:idx, item:materializeItem(inv[idx])} : null;
}

function findHealingItemInBase(){
 state.inventory = normalizeInventoryList(state.inventory||[]);
 const idx=state.inventory.findIndex(it=>getItemEffects(it).some(e=>normalizeItemEffectKind(e)==='heal'));
 return idx>=0 ? {owner:'base', index:idx, item:materializeItem(state.inventory[idx])} : null;
}

function getAvailableHealingStock(){
 let count=Number(state.meds||0);
 state.inventory = normalizeInventoryList(state.inventory||[]);
 state.inventory.forEach(it=>{ if(getItemEffects(it).some(e=>normalizeItemEffectKind(e)==='heal')) count += Number(it.qty||1); });
 state.survivors.forEach(s=>{
 normalizeInventoryList(s.inventory||[]).forEach(it=>{ if(getItemEffects(it).some(e=>normalizeItemEffectKind(e)==='heal')) count += Number(it.qty||1); });
 });
 return count;
}

function consumeHealingItemForTarget(target){
 const baseItem=findHealingItemInBase();
 const survivorItem=findHealingItemForSurvivor(target);
 const choice=survivorItem || baseItem;
 if(!choice) return false;
 const item=materializeItem(choice.item);
 const healAmount=Math.max(1, getItemEffectAmount(getItemEffects(item).find(e=>normalizeItemEffectKind(e)==='heal'),1));
 for(let i=0;i<healAmount;i++){
 if(target.injuryLevel==='grave') target.injuryLevel='seria';
 else if(target.injuryLevel==='seria') target.injuryLevel='simple';
 else if(target.injuryLevel==='simple') target.injuryLevel=null;
 }
 target.injuryRestDays=0;
 if(choice.owner==='base'){
 if(item.stackable && Number(state.inventory[choice.index].qty||1)>1) state.inventory[choice.index].qty -= 1;
 else state.inventory.splice(choice.index,1);
 addLog(`💊 Se usa ${item.name} del almacén para tratar a ${target.name}.`);
 } else {
 const s=choice.survivor;
 s.inventory = normalizeInventoryList(s.inventory||[]);
 if(item.stackable && Number(s.inventory[choice.index].qty||1)>1) s.inventory[choice.index].qty -= 1;
 else s.inventory.splice(choice.index,1);
 addLog(`💊 ${target.name} usa ${item.name} para tratar su herida.`);
 }
 return true;
}

function useBaseInventoryItem(index){
 state.inventory = normalizeInventoryList(state.inventory||[]);
 const item=state.inventory[index];
 if(!item) return;
 const it=materializeItem(item);
 if(it.itemType!=='consumable'){
 addLog(`ℹ ${it.name} debe entregarse o equiparse, no usarse desde el almacén.`);
 return;
 }
 let consumed=false;
 getItemEffects(it).forEach(effect=>{
 const kind=normalizeItemEffectKind(effect);
 const amount=getItemEffectAmount(effect,1);
 if(kind==='food'){
 state.food += amount;
 addLog(`🍖 Se usa ${it.name} desde el almacén. +${amount} comida.`);
 consumed=true;
 } else if(kind==='fun'){
 const target=aliveSurvivors().sort((a,b)=>(a.morale||0)-(b.morale||0))[0];
 if(target){
 adjustSurvivorMorale(target,amount);
 addLog(`🎉 ${target.name} mejora su moral con ${it.name}.`);
 consumed=true;
 }
 } else if(kind==='heal'){
 const target=aliveSurvivors().find(s=>hasActiveInjury(s));
 if(target && consumeHealingItemForTarget(target)) consumed=false;
 }
 });
 if(consumed){
 if(it.stackable && Number(state.inventory[index].qty||1)>1) state.inventory[index].qty -= 1;
 else state.inventory.splice(index,1);
 openStorageModal();
 render();
 }
}

function canRepairItemWithCurrentBase(item){
 const it=materializeItem(item);
 if(it.itemType==='consumable') return false;
 if(it.repairable===false) return false;
 if(it.quality >= it.maxQuality) return false;
 const skill=it.repairSkill || '';
 if(skill && !aliveSurvivors().some(s => !isExteriorSurvivor(s) && survivorHasSkill(s, skill))) return false;
 const cost = it.quality<=0 ? 2 : 1;
 return state.materials >= cost;
}

function getRepairCost(item){
 const it=materializeItem(item);
 return it.quality<=0 ? 2 : 1;
}

function getBaseSurvivorsForInventory(){
 return aliveSurvivors().filter(s => !isExteriorSurvivor(s) && s.location!=='travelling');
}

function getInventorySummaryText(list, slots){
 return `${inventoryUsedSlots(list)} / ${slots} huecos`;
}

function addItemToSurvivorInventory(survivor, item){
 survivor.inventory = normalizeInventoryList(survivor.inventory||[]);
 if(inventoryUsedSlots(survivor.inventory) >= Number(survivor.inventorySlots||3)) return false;
 survivor.inventory.push(materializeItem(item));
 return true;
}

function moveBaseItemToSurvivor(baseIndex, survivorId){
 const survivor=state.survivors.find(s=>s.id===survivorId);
 if(!survivor) return;
 state.inventory = normalizeInventoryList(state.inventory||[]);
 const raw=state.inventory[baseIndex];
 if(!raw) return;
 const item=materializeItem(raw);
 if(!canEquipItem(survivor, item)){
 }
 if(!addItemToSurvivorInventory(survivor, item)){
 addLog(`❌ ${survivor.name} no tiene hueco en la mochila.`);
 return;
 }
 state.inventory.splice(baseIndex,1);
 addLog(`🎒 ${survivor.name} coge <span class="log-item">${item.name}</span> desde el almacén.`);
 openStorageModal();
 render();
}

function getBaseStorageCapacity(){
 return 4 + (state.buildings.almacen?.level||1)*2;
}

function canStoreItemInBase(item){
 if(materializeItem(item).itemType==='junk') return true;
 state.inventory = normalizeInventoryList(state.inventory||[]);
 return inventoryUsedSlots(state.inventory) < getBaseStorageCapacity();
}

function addItemToBaseStorage(item, options={}){
 if(materializeItem(item).itemType==='junk') return addJunkToBaseStorage(item, Number(item?.qty||options.qty||1)||1);
 state.inventory = normalizeInventoryList(state.inventory||[]);
 if(!canStoreItemInBase(item)) return false;
 state.inventory.push(materializeItem(item));
 return true;
}

function moveSurvivorItemToBase(survivorId, itemIndex){
 const survivor=state.survivors.find(s=>s.id===survivorId);
 if(!survivor) return;
 if(isExteriorSurvivor(survivor)){ addLog(`❌ ${survivor.name} está en el exterior y no puede guardar objetos en la base.`); return; }
 survivor.inventory = normalizeInventoryList(survivor.inventory||[]);
 const item=survivor.inventory[itemIndex];
 if(!item) return;
 const moved=materializeItem(item);
 if(isToolItemLockedForConstruction(survivor, moved)){
  addLog(`❌ ${moved.name} está bloqueada en la mochila de ${survivor.name} mientras sigue construyendo.`);
  openInventoryModal(survivorId);
  render();
  return;
 }
 if(!addItemToBaseStorage(moved)){
  addLog('❌ El almacén no tiene espacio libre.');
  openInventoryModal(survivorId);
  render();
  return;
 }
 survivor.inventory.splice(itemIndex,1);
 if(survivor.equippedWeapon === moved.itemId) survivor.equippedWeapon = null;
 survivor.equippedGear = Array.isArray(survivor.equippedGear) ? survivor.equippedGear.filter(id=>id!==moved.itemId) : [];
 addLog(`📦 ${moved.name} vuelve al almacén.`);
 openInventoryModal(survivorId);
 render();
}

function equipSurvivorWeapon(survivorId, itemIndex){
 const survivor=state.survivors.find(s=>s.id===survivorId);
 if(!survivor) return;
 survivor.inventory = normalizeInventoryList(survivor.inventory||[]);
 const item=survivor.inventory[itemIndex];
 if(!item) return;
 const it=materializeItem(item);
 if(it.itemType!=='weapon'){ addLog(`❌ ${it.name} no es un arma.`); return; }
 if(!canEquipItem(survivor, it)){ return; }
 if(it.quality<=0){ addLog(`❌ ${it.name} está rota.`); return; }
 survivor.equippedWeapon = it.itemId;
 addLog(`🔫 ${survivor.name} equipa ${it.name}.`);
 openInventoryModal(survivorId);
 render();
}

function degradeItem(item, amount=1){
 const it=materializeItem(item);
 if(it.itemType==='consumable') return it;
 it.quality = Math.max(0, Number(it.quality||0) - Number(amount||1));
 return it;
}

function useSurvivorItem(survivorId, itemIndex){
 const survivor=state.survivors.find(s=>s.id===survivorId);
 if(!survivor) return;
 survivor.inventory = normalizeInventoryList(survivor.inventory||[]);
 const item=survivor.inventory[itemIndex];
 if(!item) return;
 const it=materializeItem(item);
 if(it.itemType!=='consumable'){ toggleEquipNonWeapon(survivorId, itemIndex); return; }
 let consumed=false;
 getItemEffects(it).forEach(effect=>{
 const kind=normalizeItemEffectKind(effect);
 const amount=getItemEffectAmount(effect,1);
 if(kind==='heal'){
 if(hasActiveInjury(survivor)){
 ensureInjuryState(survivor);
 for(let i=0;i<amount;i++){
 if(survivor.injuryLevel==='grave') survivor.injuryLevel='seria';
 else if(survivor.injuryLevel==='seria') survivor.injuryLevel='simple';
 else if(survivor.injuryLevel==='simple') survivor.injuryLevel=null;
 }
 survivor.injuryRestDays=0;
 addLog(`💊 ${survivor.name} usa ${it.name} y mejora su estado.`);
 consumed=true;
 }
 }else if(kind==='food'){
 state.food += amount;
 addLog(`🍖 ${survivor.name} usa ${it.name}. +${amount} comida.`);
 consumed=true;
 }else if(kind==='fun'){
 adjustSurvivorMorale(survivor,amount);
 addLog(`🎉 ${survivor.name} usa ${it.name}. +${amount} moral.`);
 consumed=true;
 }else if(kind==='fatigue'){
 survivor.fatigue=Math.min(survivor.maxFatigue||3, survivor.fatigue + amount);
 addLog(`⚡ ${survivor.name} usa ${it.name} y recupera fatiga.`);
 consumed=true;
 }
 });
 if(!consumed){ addLog(`ℹ ${it.name} no tiene efecto útil ahora mismo.`); return; }
 if(it.stackable && Number(survivor.inventory[itemIndex].qty||1)>1) survivor.inventory[itemIndex].qty -= 1;
 else survivor.inventory.splice(itemIndex,1);
 openInventoryModal(survivorId);
 render();
}

function getTransferableSurvivorTargets(sourceSurvivorId){
 return state.survivors.filter(s=>s&&s.status!=='muerto'&&String(s.id)!==String(sourceSurvivorId));
}

function transferSurvivorItemToSurvivor(fromId, itemIndex, toId){
 const from=state.survivors.find(s=>s.id===fromId);
 const to=state.survivors.find(s=>s.id===toId);
 if(!from||!to||String(from.id)===String(to.id)) return;
 from.inventory = normalizeInventoryList(from.inventory||[]);
 to.inventory = normalizeInventoryList(to.inventory||[]);
 const item=from.inventory[itemIndex];
 if(!item) return;
 const moved=materializeItem(item);
 if(isToolItemLockedForConstruction(from, moved)){
  addLog(`❌ ${moved.name} está bloqueada en la mochila de ${from.name} mientras sigue construyendo.`);
  openInventoryModal(fromId);
  render();
  return;
 }
 if(!addItemToSurvivorInventory(to, moved)){
  addLog(`❌ ${to.name} no tiene hueco en la mochila.`);
  return;
 }
 from.inventory.splice(itemIndex,1);
 if(from.equippedWeapon===moved.itemId) from.equippedWeapon=null;
 from.equippedGear = Array.isArray(from.equippedGear) ? from.equippedGear.filter(id=>id!==moved.itemId) : [];
 addLog(`🎒 ${from.name} entrega <span class="log-item">${moved.name}</span> a ${to.name}.`);
 openInventoryModal(fromId);
 render();
}

function equipAllSurvivorItems(survivorId){
 const survivor=state.survivors.find(s=>s.id===survivorId);
 if(!survivor) return;
 survivor.inventory = normalizeInventoryList(survivor.inventory||[]);
 survivor.equippedGear = [];
 let equippedWeapon=null;
 let toolEquipped=false;
 let changed=0;
 survivor.inventory.forEach(raw=>{
  const item=materializeItem(raw);
  if(!canEquipItem(survivor,item)) return;
  if(item.itemType==='consumable' || item.quality<=0) return;
  if(item.itemType==='weapon'){
   if(!equippedWeapon){
    equippedWeapon=item.itemId;
    changed++;
   }
  }else if(item.itemType==='tool'){
   if(!toolEquipped){
    survivor.equippedGear.push(item.itemId);
    toolEquipped=true;
    changed++;
   }
  }else if(!survivor.equippedGear.includes(item.itemId)){
   survivor.equippedGear.push(item.itemId);
   changed++;
  }
 });
 survivor.equippedWeapon=equippedWeapon;
 addLog(changed>0
  ? `🧰 ${survivor.name} equipa todo su equipo posible.`
  : `ℹ ${survivor.name} no tiene equipo que pueda equiparse.`);
 openInventoryModal(survivorId);
 render();
}

function unequipAllSurvivorItems(survivorId){
 const survivor=state.survivors.find(s=>s.id===survivorId);
 if(!survivor) return;
 const hadAnything=!!survivor.equippedWeapon || (Array.isArray(survivor.equippedGear)&&survivor.equippedGear.length);
 survivor.equippedWeapon=null;
 survivor.equippedGear=[];
 addLog(hadAnything
  ? `📦 ${survivor.name} desequipa todo su equipo.`
  : `ℹ ${survivor.name} no llevaba nada equipado.`);
 openInventoryModal(survivorId);
 render();
}

function collectRepairableItems(){
 const rows=[];
 (state.inventory||[]).forEach((it,i)=> rows.push({scope:'base', index:i, item:materializeItem(it), owner:null}));
 getBaseSurvivorsForInventory().forEach(s=>{
 (s.inventory||[]).forEach((it,i)=> rows.push({scope:'survivor', index:i, item:materializeItem(it), owner:s}));
 });
 return rows.filter(row => row.item.itemType!=='consumable' && row.item.repairable!==false && row.item.quality < row.item.maxQuality);
}

function repairItemFromRow(scope, ownerId, idx){
 const rows=collectRepairableItems();
 let target=null;
 if(scope==='base'){
 state.inventory = normalizeInventoryList(state.inventory||[]);
 target=state.inventory[idx];
 } else {
 const s=state.survivors.find(x=>x.id===ownerId);
 if(!s) return;
 s.inventory = normalizeInventoryList(s.inventory||[]);
 target=s.inventory[idx];
 }
 if(!target) return;
 const item=materializeItem(target);
 const skill=item.repairSkill||'';
 if(skill && !aliveSurvivors().some(s => !isExteriorSurvivor(s) && survivorHasSkill(s, skill))){
 addLog(`❌ No hay nadie en la base con ${skill} para reparar ${item.name}.`);
 return;
 }
 const cost=getRepairCost(item);
 if(state.materials < cost){
 addLog(`❌ No hay materiales suficientes para reparar ${item.name}.`);
 return;
 }
 state.materials -= cost;
 if(item.quality<=0) item.quality = 1;
 else item.quality = Math.min(item.maxQuality, item.quality + 1);
 if(scope==='base') state.inventory[idx]=item;
 else {
 const s=state.survivors.find(x=>x.id===ownerId);
 s.inventory[idx]=item;
 }
 addLog(`🛠 ${item.name} ha sido reparado. (${item.quality}/${item.maxQuality})`);
 openRepairModal();
 render();
}
