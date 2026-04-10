// Bootstrap limpio de RESURGIR
(function(){
  if(window.__resurgirBootstrapLoaded) return;
  window.__resurgirBootstrapLoaded = true;

  function bindFinalHtmlCleanup(){
    document.querySelectorAll('[data-map-tab]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(typeof window.switchMapTab === 'function') window.switchMapTab(btn.dataset.mapTab || 'base');
      });
    });

    document.getElementById('dataErrorReloadBtn')?.addEventListener('click', ()=>window.location.reload());
    document.getElementById('gameOverRestartBtn')?.addEventListener('click', ()=>window.location.reload());
    document.getElementById('endDayBtn')?.addEventListener('click', ()=>{ setTimeout(syncEventPopupState, 0); setTimeout(syncEventPopupState, 150); }, true);

    const bgMusic = document.getElementById('bgMusic');
    const combatMusic = document.getElementById('combatMusic');
    const musicBtn = document.getElementById('musicBtn');

    bgMusic?.addEventListener('error', ()=>{
      if(musicBtn) musicBtn.title = 'Archivo de música no encontrado';
    });

    const closeMap = {
      closeBuildModal: 'buildModalWrap',
      closeBaseUpgradesModal: 'baseUpgradesModal',
      closeLoreModal: 'survivorLoreModal',
      closeCemeteryBtn: 'cemeteryModal',
      closeThreatDecisionPopup: 'threatDecisionPopup',
      closeThreatDecisionPopupX: 'threatDecisionPopup',
      closeTechnicalLogBtn: 'technicalLogModal',
      closeTechnicalLogBtnFooter: 'technicalLogModal',
      inventoryModalClose: 'inventoryModal',
      storageModalClose: 'storageModal',
      repairModalClose: 'repairModal',
      groupActionCancel: 'groupActionPopup',
      groupActionCloseX: 'groupActionPopup',
      travelCancel: 'travelPopup',
      locationActionCancel: 'locationActionPopup',
      attackSetupCancel: 'attackSetupPopup',
      combatResultClose: 'combatResultPopup',
      closeBuildingDetail: 'buildingDetailPanel'
    };

    document.addEventListener('click', (ev)=>{
      const target = ev.target.closest('[id]');
      if(!target) return;
      const overlayId = closeMap[target.id];
      if(!overlayId) return;
      ev.preventDefault();
      const overlay = document.getElementById(overlayId);
      if(overlay) overlay.classList.remove('open');
      if(target.id === 'closeBuildingDetail'){
        const panel = document.getElementById('buildingDetailPanel');
        if(panel) panel.style.display = 'none';
        if(window.state) window.state.currentDetail = null;
      }
    }, true);

    document.addEventListener('click', (ev)=>{
      const overlay = ev.target.closest('.overlay');
      if(overlay && ev.target === overlay){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        ev.stopPropagation();
        return false;
      }
      const buildingPanel = document.getElementById('buildingDetailPanel');
      if(buildingPanel && ev.target === buildingPanel){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        ev.stopPropagation();
        return false;
      }
    }, true);

    if(bgMusic && musicBtn){
      const setMusicIcon = ()=>{
        musicBtn.textContent = bgMusic.muted ? '🔇' : '🔊';
        musicBtn.title = bgMusic.muted ? 'Activar música' : 'Silenciar música';
      };
      const tryPlayBgMusic = ()=>{
        if(bgMusic.muted) return;
        bgMusic.play().catch(()=>{});
      };
      setMusicIcon();
      const unlockAudio = ()=>{
        tryPlayBgMusic();
        document.removeEventListener('pointerdown', unlockAudio, true);
        document.removeEventListener('keydown', unlockAudio, true);
      };
      document.addEventListener('pointerdown', unlockAudio, true);
      document.addEventListener('keydown', unlockAudio, true);
      musicBtn.addEventListener('click', (ev)=>{
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const nextMuted = !bgMusic.muted;
        bgMusic.muted = nextMuted;
        if(combatMusic) combatMusic.muted = nextMuted;
        setMusicIcon();
        if(!nextMuted) tryPlayBgMusic();
      }, true);
    }
  }


  function getLiveState(){
    if(window.state) return window.state;
    try{ if(typeof state!=='undefined') return state; }catch(_err){}
    return null;
  }

  function syncEventPopupState(){
    const popup=document.getElementById('storyEventPopup');
    const popupBody=document.getElementById('storyEventPopupBody');
    const eventLayout=document.getElementById('eventLayout');
    if(popupBody && eventLayout && eventLayout.parentElement!==popupBody){
      popupBody.appendChild(eventLayout);
    }
    const liveState=getLiveState();
    if(liveState && !window.state) window.state=liveState;
    const pendingEvent=liveState?.pendingEvent || null;
    const hasBlockingEvent=!!(pendingEvent && !pendingEvent._multiDayPassive);
    const combatPopup=document.getElementById('combatResultPopup');
    const combatOpen=!!(combatPopup && combatPopup.classList.contains('open'));
    if(!popup) return;
    if(hasBlockingEvent && !combatOpen){
      popup.classList.add('open');
      document.body.classList.add('event-lock');
    }else{
      popup.classList.remove('open');
      document.body.classList.remove('event-lock');
    }
  }



  function syncThreatPanels(){
    const threatMount=document.getElementById('leftSideThreatMount');
    const persistentMount=document.getElementById('leftSidePersistentEventMount');
    const threatWrap=document.getElementById('threatsPanelWrap');
    const persistentPanel=document.getElementById('persistentEventPanel');
    const liveState=getLiveState();

    if(threatMount && threatWrap && threatWrap.parentElement!==threatMount){
      threatMount.appendChild(threatWrap);
    }
    if(persistentMount && persistentPanel && persistentPanel.parentElement!==persistentMount){
      persistentMount.appendChild(persistentPanel);
    }

    try{
      if(typeof window.renderThreats==='function') window.renderThreats();
    }catch(_err){}
    try{
      if(typeof window.renderPersistentEvent==='function') window.renderPersistentEvent();
    }catch(_err){}

    const hasThreats=!!(liveState && (liveState.attackThreat || (Array.isArray(liveState.activeThreats) && liveState.activeThreats.some(th=>th && !th.resolved))));
    const hasPersistent=!!(liveState && liveState._activeMultiDayEvent && Number(liveState._activeMultiDayEvent._daysLeft||0)>0 && !(liveState.pendingEvent && liveState.pendingEvent===liveState._activeMultiDayEvent));

    if(threatWrap){
      threatWrap.style.display='block';
      const list=document.getElementById('threatsList');
      if(hasThreats && list && !String(list.innerHTML||'').trim()){
        try{ if(typeof window.renderThreats==='function') window.renderThreats(); }catch(_err){}
      }
    }
    if(persistentPanel){
      if(hasPersistent){
        persistentPanel.style.display='block';
        if(!String(persistentPanel.innerHTML||'').trim()){
          try{ if(typeof window.renderPersistentEvent==='function') window.renderPersistentEvent(); }catch(_err){}
        }
      }
    }
  }

  function bootGame(){
    if(window.__resurgirBootDone) return;
    window.__resurgirBootDone = true;
    Promise.resolve(typeof window.loadFromFiles === 'function' ? window.loadFromFiles() : null)
      .then(()=>{
        if(typeof window.isGameDataReady === 'function' && window.isGameDataReady()){
          if(typeof window.startIntro === 'function') window.startIntro();
          else if(typeof window.initGame === 'function') window.initGame();
        }else if(typeof window.initGame === 'function'){
          window.initGame();
        }
      })
      .catch((err)=>{
        if(typeof window.handleDataLoadError === 'function'){
          window.handleDataLoadError('Carga inicial', err?.message || 'Error inesperado');
        }
        if(typeof window.initGame === 'function') window.initGame();
      });
  }

  function init(){
    bindFinalHtmlCleanup();
    syncEventPopupState();
    syncThreatPanels();
    setInterval(syncEventPopupState, 250);
    setInterval(syncThreatPanels, 400);
    bootGame();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, {once:true});
  }else{
    init();
  }
})();
