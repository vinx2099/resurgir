(()=>{
  if(window.__resurgirAttackUnifiedPatch) return;
  window.__resurgirAttackUnifiedPatch = true;

  const oldLoadEffectIntoRow = window.loadEffectIntoRow;
  if(typeof oldLoadEffectIntoRow === 'function'){
    window.loadEffectIntoRow = function(row, eff){
      const result = oldLoadEffectIntoRow.apply(this, arguments);
      if(eff?.type === 'setAttackThreat'){
        try{
          updateEffectRowFields(row, 'setAttackThreat');
          const p1=row.querySelector('.effect-param1-select');
          const p2=row.querySelector('.effect-param2-select');
          const p3=row.querySelector('.effect-param3-select');
          if(p1) p1.value = String(eff.arrivalDays ?? 1);
          if(p2) p2.value = eff.hostileType || eff.hostile || 'random';
          if(p2 && typeof p2.onchange === 'function') p2.onchange();
          if(p3) p3.value = eff.hostileVariant || eff.variant || 'random';
        }catch(_e){}
      }
      return result;
    };
  }

  const oldBuildEventObject = window.buildEventObject;
  if(typeof oldBuildEventObject === 'function'){
    window.buildEventObject = function(){
      const ev = oldBuildEventObject.apply(this, arguments);
      if(ev){
        delete ev.exploreEncounterChance;
        delete ev.exploreEncounterMode;
      }
      return ev;
    };
  }

  const oldUpdatePreview = window.updatePreview;
  if(typeof oldUpdatePreview === 'function'){
    window.updatePreview = function(){
      const out = oldUpdatePreview.apply(this, arguments);
      try{
        const jsonOut = document.getElementById('currentJsonOutput');
        if(jsonOut && jsonOut.textContent){
          const parsed = JSON.parse(jsonOut.textContent);
          delete parsed.exploreEncounterChance;
          delete parsed.exploreEncounterMode;
          jsonOut.textContent = JSON.stringify(parsed, null, 2);
        }
      }catch(_e){}
      return out;
    };
  }
})();
