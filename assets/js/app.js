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
    const musicNextBtn = document.getElementById('musicNextBtn');
    const musicTrackLabel = document.getElementById('musicTrackLabel');
    const bgMusicTracks = [
      'concreteBAK.mp3',
      'skies.mp3',
      'slide.mp3',
      'V_Disturbed Silence.mp3',
      'V_Echoes of the End.mp3',
      'V_Stellar Void.mp3',
      'warriors.mp3',
      'wasteland.mp3'
    ];
    let currentBgTrack = 'concreteBAK.mp3';
    window.__resurgirBgMusicTracks = bgMusicTracks;

    const getTrackSrc = track => `./data/music/${encodeURIComponent(track)}`;
    const getTrackLabel = track => String(track || 'Música').replace(/\.[^.]+$/, '').replace(/^V_/, '').replaceAll('_', ' ');
    const syncTrackLabel = ()=>{
      if(musicTrackLabel) musicTrackLabel.textContent = getTrackLabel(currentBgTrack);
    };
    const setBgTrack = (track, options={})=>{
      if(!bgMusic || !track) return;
      currentBgTrack = track;
      const wasPlaying = !bgMusic.paused;
      bgMusic.src = getTrackSrc(track);
      bgMusic.load();
      syncTrackLabel();
      if(options.play || (wasPlaying && !bgMusic.muted)) bgMusic.play().catch(()=>{});
    };
    const playRandomBgTrack = ()=>{
      if(!bgMusicTracks.length) return;
      const pool = bgMusicTracks.length > 1 ? bgMusicTracks.filter(track => track !== currentBgTrack) : bgMusicTracks;
      const nextTrack = pool[Math.floor(Math.random() * pool.length)];
      setBgTrack(nextTrack, {play: !bgMusic?.muted});
    };

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
        if(panel){
          panel.classList.remove('open');
          panel.style.display = 'none';
        }
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
    syncTrackLabel();
    musicNextBtn?.addEventListener('click', (ev)=>{
      ev.preventDefault();
      ev.stopImmediatePropagation();
      playRandomBgTrack();
    }, true);
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

  function installCombatResultPopupRenderer(){
    const esc = (value)=>String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;');

    window.openCombatResultPopup = function({
      title,
      text,
      icon='*',
      summary=[],
      effects=[],
      outcome=null,
      settlementScore=null,
      hostileScore=null,
      settlementLabel='ASENTAMIENTO',
      hostileLabel='HOSTILES',
      image=null,
      combatReport=null
    }={}){
      const popup=document.getElementById('combatResultPopup');
      const titleEl=document.getElementById('combatResultTitle');
      const imgEl=document.getElementById('combatResultImg');
      const textEl=document.getElementById('combatResultText');
      const summaryEl=document.getElementById('combatResultSummary');
      const effectsEl=document.getElementById('combatResultEffects');
      if(!popup||!titleEl||!imgEl||!textEl||!summaryEl||!effectsEl) return;

      document.getElementById('technicalLogModal')?.classList.remove('open');

      const summaryList=Array.isArray(summary)?summary:[];
      const resultLine=summaryList.map(String).find(line=>/resultado\s*:\s*\d+\s*vs\s*\d+/i.test(line));
      const resultMatch=resultLine?.match(/resultado\s*:\s*(\d+)\s*vs\s*(\d+)/i);
      const inferredTitle=String(title||'').toLowerCase();
      if((settlementScore===null||settlementScore===undefined) && resultMatch) settlementScore=resultMatch[1];
      if((hostileScore===null||hostileScore===undefined) && resultMatch) hostileScore=resultMatch[2];
      if(!outcome && /victoria|exitosa|superada|repelid/.test(inferredTitle)) outcome='victory';
      if(!outcome && /derrota|fallid|sufrida|fracas/.test(inferredTitle)) outcome='defeat';

      const cleanOutcome=String(outcome||'').trim().toLowerCase();
      const isVictory=['victory','victoria','win'].includes(cleanOutcome);
      const isDefeat=['defeat','derrota','loss'].includes(cleanOutcome);
      const resultImage=image || (isVictory?'./data/pic/victory.jpg':isDefeat?'./data/pic/defeat.jpg':'');
      const hasScore=settlementScore!==null&&settlementScore!==undefined&&hostileScore!==null&&hostileScore!==undefined;

      titleEl.textContent=title||'Resultado de combate';
      titleEl.style.color=isVictory?'var(--ok-bright)':isDefeat?'var(--danger-bright)':'var(--danger-bright)';
      if(imgEl.parentElement){
        imgEl.parentElement.style.gridTemplateColumns='minmax(190px,240px) 1fr';
        imgEl.parentElement.style.gap='14px';
      }
      imgEl.style.width='100%';
      imgEl.style.height='320px';
      imgEl.innerHTML=resultImage
        ? `<img src="${esc(resultImage)}" alt="${esc(title||'Resultado de combate')}" style="width:100%;height:100%;object-fit:cover;display:block;">`
        : esc(icon||'*');
      textEl.textContent=text||'El combate ha terminado.';

      const effectList=Array.isArray(effects)?effects:[];
      const gainLossLines=[...summaryList.filter(line=>!/^\s*resultado\s*:/i.test(String(line||''))), ...effectList];
      summaryEl.innerHTML=gainLossLines.length
        ? '<div style="border:1px solid var(--line2);background:rgba(0,0,0,0.18);padding:10px;margin-top:10px;"><b>Ganancias / perdidas:</b><br>'+gainLossLines.map(s=>`- ${esc(s)}`).join('<br>')+'</div>'
        : '';
      if(hasScore){
        const resultLabel=isVictory?'VICTORIA':isDefeat?'DERROTA':'ENFRENTAMIENTO';
        const resultColor=isVictory?'var(--ok-bright)':isDefeat?'var(--danger-bright)':'var(--amber-bright)';
        const reportFactions=Array.isArray(combatReport?.factions)?combatReport.factions:[];
        const detailHtml=reportFactions.length ? `
          <div style="display:grid;grid-template-columns:repeat(${Math.min(2, reportFactions.length)}, minmax(0,1fr));gap:10px;margin-top:10px;text-align:left;">
            ${reportFactions.map(faction=>{
              const color=faction.accent==='danger'?'var(--danger-bright)':faction.accent==='amber'?'var(--amber-bright)':'var(--ok-bright)';
              const rows=Array.isArray(faction.rows)?faction.rows:[];
              return `<div style="border:1px solid var(--line);background:rgba(0,0,0,0.16);padding:9px;">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:6px;">
                  <b style="font-family:var(--font-display);letter-spacing:0.08em;color:${color};">${esc(faction.label||'Faccion')}</b>
                  <b style="font-family:var(--font-display);font-size:20px;color:${color};">${esc(faction.total ?? '')}</b>
                </div>
                ${rows.map(row=>{
                  const label=Array.isArray(row)?row[0]:row?.label;
                  const value=Array.isArray(row)?row[1]:row?.value;
                  return `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:3px 0;font-size:11px;color:var(--muted);"><span>${esc(label||'')}</span><b style="color:var(--text);">${esc(value ?? 0)}</b></div>`;
                }).join('')}
              </div>`;
            }).join('')}
          </div>` : '';
        summaryEl.innerHTML=`
        <div style="border:1px solid var(--line2);background:rgba(0,0,0,0.18);padding:10px;margin-bottom:10px;">
          <div style="font-family:var(--font-display);font-size:18px;letter-spacing:0.08em;color:${resultColor};text-align:center;margin-bottom:8px;">${esc(resultLabel)}</div>
          <div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:center;text-align:center;">
            <div>
              <div style="font-family:var(--font-display);font-size:12px;letter-spacing:0.12em;color:var(--ok-bright);margin-bottom:6px;">${esc(settlementLabel||'ASENTAMIENTO')}</div>
              <div style="font-family:var(--font-display);font-size:38px;line-height:1;color:var(--ok-bright);">${esc(settlementScore)}</div>
            </div>
            <div style="font-family:var(--font-display);font-size:34px;line-height:1;color:var(--amber-bright);">VS</div>
            <div>
              <div style="font-family:var(--font-display);font-size:12px;letter-spacing:0.12em;color:var(--danger-bright);margin-bottom:6px;">${esc(hostileLabel||'HOSTILES')}</div>
              <div style="font-family:var(--font-display);font-size:38px;line-height:1;color:var(--danger-bright);">${esc(hostileScore)}</div>
            </div>
          </div>
          ${detailHtml}
        </div>`+summaryEl.innerHTML;
      }

      effectsEl.innerHTML='';
      popup.classList.add('open');
    };
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
    installCombatResultPopupRenderer();
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
