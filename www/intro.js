/**
 * 遊戲入口：Loading 動畫 → 宣傳影片（指定秒數暫停 + 黑色透明 overlay）→ 開始遊戲
 */
(function () {
  var PAUSE_POINTS = [6, 12, 22, 42, 52, 58];
  var MIN_LOADING_MS = 2000;
  var PAUSE_TOLERANCE = 0.3;

  var wrap = document.getElementById('intro-wrap');
  var loading = document.getElementById('intro-loading');
  var videoScreen = document.getElementById('intro-video-screen');
  var video = document.getElementById('intro-video');
  var clickToStart = document.getElementById('intro-click-to-start');
  var pauseOverlay = document.getElementById('intro-pause-overlay');
  var dialogueEls = [
    document.getElementById('intro-dialogue-6s'),
    document.getElementById('intro-dialogue-12s'),
    document.getElementById('intro-dialogue-22s'),
    document.getElementById('intro-dialogue-42s'),
    document.getElementById('intro-dialogue-52s'),
    document.getElementById('intro-dialogue-58s')
  ];
  var continueHint = pauseOverlay ? pauseOverlay.querySelector('.continue-hint') : null;
  var startHint = clickToStart ? clickToStart.querySelector('.start-hint') : null;
  var enterGameBtn = clickToStart ? clickToStart.querySelector('.intro-enter-btn') : null;
  var watchVideoBtn = document.getElementById('intro-watch-video-btn');
  var startBtnWrap = document.getElementById('intro-start-btn-wrap');
  var startBtn = document.getElementById('intro-start-btn');
  var skipBtn = document.getElementById('intro-skip-btn');
  var volumeBtn = document.getElementById('intro-volume-btn');
  var volumeBtnIcon = volumeBtn ? volumeBtn.querySelector('i') : null;
// mobile 優化 02/10, 改個什麼覆蓋, 手機poster覆蓋用
  var loadingStartTime = Date.now();
  var pauseIndex = 0;
  var hasUnmuted = false;
  var introGateConsumed = false;
  var pauseSound = new Audio('./public/pause-sound-1.mp3');
  var clickSound = new Audio('./public/click-sound.mp3');
  clickSound.volume = 1;
  var transitSound = new Audio('./public/cute-transit-sound-for-skip.mp3');
  var clickSoundGain = 1.8;
  var beforeStartSong = new Audio('./public/game-before-start-song.mp3');
  beforeStartSong.loop = true;
  var aboutToStartSong = new Audio('./public/game-about-to-start.mp3');
  aboutToStartSong.loop = true;
  var audioUnlocked = false;
  var pauseAudioCtx = null;
  var pauseSoundBuffer = null;

  var DURATION_ANIMATION_CIRCLE = 700;
  /** 與 .page-transition-skip-down-glow 的 animation-delay 對齊，避免提早進遊戲截斷動畫 */
  var SKIP_DOWN_GLOW_DELAY_MS = 18;
  var GAME_URL = './game.html';

  function navigateFromIntroToGame() {
    if (typeof window.__eggDismissIntroBootLayer === 'function') {
      window.__eggDismissIntroBootLayer();
    } else {
      window.location.href = GAME_URL;
    }
  }

  function logGameStart(entry) {
    try {
      if (typeof window.__eggLogAnalytics === 'function') {
        window.__eggLogAnalytics('game_start', { entry: entry });
      }
    } catch (e) {}
  }

  /** Skip：由視窗中央展開，再往下移出並淡出（不依點擊座標） */
  function createSkipCenterSlideDownTransition(onComplete) {
    var wrapper = document.createElement('div');
    wrapper.className = 'page-transition-skip-down-wrapper';
    var glow = document.createElement('div');
    glow.className = 'page-transition-skip-down-glow';
    var sheet = document.createElement('div');
    sheet.className = 'page-transition-skip-down-sheet';
    wrapper.appendChild(glow);
    wrapper.appendChild(sheet);
    document.body.appendChild(wrapper);
    wrapper.style.setProperty('--skip-down-duration', DURATION_ANIMATION_CIRCLE + 'ms');
    setTimeout(function () {
      if (typeof onComplete === 'function') onComplete();
    }, DURATION_ANIMATION_CIRCLE + SKIP_DOWN_GLOW_DELAY_MS);
  }

  function ensurePauseAudioContext() {
    if (pauseAudioCtx || !(window.AudioContext || window.webkitAudioContext)) return;
    try {
      pauseAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      pauseAudioCtx = null;
    }
  }

  function loadPauseSoundBuffer() {
    ensurePauseAudioContext();
    if (!pauseAudioCtx || pauseSoundBuffer) return;
    fetch('./public/pause-sound-1.mp3')
      .then(function (res) { return res.arrayBuffer(); })
      .then(function (buf) {
        return pauseAudioCtx.decodeAudioData(buf);
      })
      .then(function (decoded) {
        pauseSoundBuffer = decoded;
      })
      .catch(function () {
        // 靜默失敗，之後會退回 HTMLAudio 播放
      });
  }

  function playPauseSound() {
    // 優先使用已解鎖的 Web Audio，較符合 iOS Safari 規則
    if (pauseAudioCtx && pauseSoundBuffer) {
      try {
        if (pauseAudioCtx.state === 'suspended') {
          pauseAudioCtx.resume().catch(function () {});
        }
        var src = pauseAudioCtx.createBufferSource();
        src.buffer = pauseSoundBuffer;
        var gainNode = pauseAudioCtx.createGain();
        gainNode.gain.value = 1;
        src.connect(gainNode);
        gainNode.connect(pauseAudioCtx.destination);
        src.start(0);
        return;
      } catch (e) {
        // 若 Web Audio 播放失敗，改用 HTMLAudio
      }
    }
    // 備援：維持原本的 HTMLAudio 播放方式
    try {
      pauseSound.currentTime = 0;
      var p = pauseSound.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {});
      }
    } catch (e2) {}
  }

  function unlockAllAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    ensurePauseAudioContext();
    loadPauseSoundBuffer();
    // 只對「效果音」做 play-then-pause 解鎖，不要對 BGM 做，否則會把 volume 按鈕剛啟動的音樂立刻關掉
    [pauseSound, clickSound].forEach(function (audio) {
      if (!audio) return;
      var originalVolume = audio.volume;
      audio.volume = 0.01;
      audio.muted = false;
      try {
        var playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.then(function () {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = originalVolume;
          }).catch(function () {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = originalVolume;
          });
        } else {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = originalVolume;
        }
      } catch (e) {
        try {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = originalVolume;
        } catch (e2) {}
      }
    });
    // BGM 只設 muted=false，不 play-then-pause，避免與 volume 按鈕的 startBeforeStartSong() 衝突
    [beforeStartSong, aboutToStartSong, transitSound].forEach(function (audio) {
      if (!audio) return;
      audio.muted = false;
    });
  }

  function startBeforeStartSong() {
    unlockAllAudioOnce();
    beforeStartSong.currentTime = 0;
    beforeStartSong.play().catch(function () {});
    if (volumeBtn) {
      volumeBtn.classList.add('sound-on');
      volumeBtn.setAttribute('title', '音樂播放中');
      volumeBtn.setAttribute('aria-label', '音樂播放中');
      if (volumeBtnIcon) {
        volumeBtnIcon.classList.remove('fa-volume-xmark');
        volumeBtnIcon.classList.add('fa-volume-high');
      }
    }
  }

  function showVideoScreen() {
    loading.style.display = 'none';
    videoScreen.classList.add('visible');
    clickToStart.classList.add('visible');
    beforeStartSong.currentTime = 0;
    beforeStartSong.play().catch(function () {});
  }

  if (volumeBtn) {
    volumeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      startBeforeStartSong();
    });
    volumeBtn.addEventListener('touchend', function (e) {
      e.preventDefault();
      e.stopPropagation();
      startBeforeStartSong();
    }, { passive: false });
  }

  function startPlayback() {
    if (window.resumeGameAudioContext) window.resumeGameAudioContext();
    unmuteOnInteraction();
    clickToStart.classList.remove('visible');
    video.play().catch(function () {});
  }

  function doStartAfterClickSound() {
    if (startHint) startHint.classList.remove('playing');
    if (watchVideoBtn) watchVideoBtn.classList.remove('watch-video-ack');
    if (window.resumeGameAudioContext) window.resumeGameAudioContext();
    unmuteOnInteraction();
    clickToStart.classList.remove('visible');
    if (skipBtn) skipBtn.style.display = 'inline-flex';
    video.play().catch(function () {});
  }

  function unmuteOnInteraction() {
    if (hasUnmuted) return;
    hasUnmuted = true;
    video.muted = false;
  }

  function checkPausePoint() {
    var t = video.currentTime;
    if (pauseIndex >= PAUSE_POINTS.length) return;
    var target = PAUSE_POINTS[pauseIndex];
    if (t >= target - PAUSE_TOLERANCE) {
      video.pause();
      playPauseSound();
      if (dialogueEls[pauseIndex]) dialogueEls[pauseIndex].classList.add('visible');
      pauseIndex += 1;
    }
  }

  function hideAllDialogues() {
    var i;
    for (i = 0; i < dialogueEls.length; i++) {
      if (dialogueEls[i]) dialogueEls[i].classList.remove('visible');
    }
  }

  function resumeVideo() {
    pauseOverlay.classList.remove('visible');
    hideAllDialogues();
    video.play();
  }

  function onVideoEnded() {
    pauseOverlay.classList.remove('visible');
    hideAllDialogues();
    startBtnWrap.classList.add('visible');
    beforeStartSong.pause();
    beforeStartSong.currentTime = 0;
    aboutToStartSong.currentTime = 0;
    aboutToStartSong.play().catch(function () {});
  }

  function hideIntro() {
    wrap.style.display = 'none';
    document.body.classList.remove('intro-active');
  }

  function onVideoReady() {
    if (videoScreen.classList.contains('visible')) return;
    var elapsed = Date.now() - loadingStartTime;
    var wait = Math.max(0, MIN_LOADING_MS - elapsed);
    setTimeout(function () {
      if (videoScreen.classList.contains('visible')) return;
      showVideoScreen();
    }, wait);
  }

  // 桌機多半會觸發 canplaythrough，但在某些手機瀏覽器上不一定可靠
  // 因此同時監聽 loadeddata 作為備援，避免永遠卡在 loading 畫面
  video.addEventListener('canplaythrough', onVideoReady, { once: true });
  video.addEventListener('loadeddata', onVideoReady, { once: true });

  // 最後保險機制：若影片事件完全沒被觸發（某些手機節省流量不預載影片），
  // 在一段安全時間後仍強制切到影片畫面，至少讓使用者看到入口提示與按鈕
  setTimeout(function () {
    if (videoScreen.classList.contains('visible')) return;
    showVideoScreen();
  }, MIN_LOADING_MS + 4000);

  video.addEventListener('timeupdate', checkPausePoint);
  video.addEventListener('ended', onVideoEnded);

  function playClickSoundThenStart() {
    unlockAllAudioOnce();
    beforeStartSong.pause();
    beforeStartSong.currentTime = 0;
    if (volumeBtn) volumeBtn.classList.add('hidden');
    var ctx = null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      clickSound.currentTime = 0;
      clickSound.addEventListener('ended', function onEnd() {
        clickSound.removeEventListener('ended', onEnd);
        doStartAfterClickSound();
      }, { once: true });
      clickSound.play().catch(function () { doStartAfterClickSound(); });
      return;
    }
    var startPlayDecoded = function (decoded) {
      var src = ctx.createBufferSource();
      src.buffer = decoded;
      var gainNode = ctx.createGain();
      gainNode.gain.value = clickSoundGain;
      src.connect(gainNode);
      gainNode.connect(ctx.destination);
      src.onended = function () {
        doStartAfterClickSound();
      };
      src.start(0);
    };
    fetch('./public/click-sound.mp3')
      .then(function (res) { return res.arrayBuffer(); })
      .then(function (buf) { return ctx.decodeAudioData(buf); })
      .then(function (decoded) {
        if (ctx.state === 'suspended') {
          ctx.resume().then(function () { startPlayDecoded(decoded); }).catch(function () { doStartAfterClickSound(); });
        } else {
          startPlayDecoded(decoded);
        }
      })
      .catch(function () {
        clickSound.currentTime = 0;
        clickSound.addEventListener('ended', function onEnd() {
          clickSound.removeEventListener('ended', onEnd);
          doStartAfterClickSound();
        }, { once: true });
        clickSound.play().catch(function () { doStartAfterClickSound(); });
      });
  }

  function playClickSoundThenFadeToGame(entry, options) {
    var opts = options || {};
    unlockAllAudioOnce();
    try {
      beforeStartSong.pause();
      beforeStartSong.currentTime = 0;
    } catch (e0) {}
    try {
      aboutToStartSong.pause();
      aboutToStartSong.currentTime = 0;
    } catch (e1) {}
    if (startBtn && !opts.skipStartBtnOverlap) startBtn.classList.add('vertical-overlap');
    var ctx = null;
    var done = function () {
      fadeOutThenGoToGame(entry);
    };
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      clickSound.currentTime = 0;
      clickSound.addEventListener('ended', function onEnd() {
        clickSound.removeEventListener('ended', onEnd);
        done();
      }, { once: true });
      clickSound.play().catch(function () { done(); });
      return;
    }
    var startPlayDecoded = function (decoded) {
      var src = ctx.createBufferSource();
      src.buffer = decoded;
      var gainNode = ctx.createGain();
      gainNode.gain.value = clickSoundGain;
      src.connect(gainNode);
      gainNode.connect(ctx.destination);
      src.onended = function () {
        done();
      };
      src.start(0);
    };
    fetch('./public/click-sound.mp3')
      .then(function (res) { return res.arrayBuffer(); })
      .then(function (buf) { return ctx.decodeAudioData(buf); })
      .then(function (decoded) {
        if (ctx.state === 'suspended') {
          ctx.resume().then(function () { startPlayDecoded(decoded); }).catch(function () { done(); });
        } else {
          startPlayDecoded(decoded);
        }
      })
      .catch(function () {
        clickSound.currentTime = 0;
        clickSound.addEventListener('ended', function onEnd() {
          clickSound.removeEventListener('ended', onEnd);
          done();
        }, { once: true });
        clickSound.play().catch(function () { done(); });
      });
  }

  function tryConsumeIntroGate() {
    if (introGateConsumed) return false;
    introGateConsumed = true;
    if (clickToStart) clickToStart.classList.add('intro-gate-consumed');
    return true;
  }

  function onEnterGameClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!enterGameBtn || !tryConsumeIntroGate()) return;
    if (volumeBtn) volumeBtn.classList.add('hidden');
    playClickSoundThenFadeToGame('enter_button', { skipStartBtnOverlap: true });
  }

  function onWatchVideoClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!watchVideoBtn || !tryConsumeIntroGate()) return;
    watchVideoBtn.classList.add('watch-video-ack');
    playClickSoundThenStart();
  }

  if (enterGameBtn) {
    enterGameBtn.addEventListener('click', onEnterGameClick);
    enterGameBtn.addEventListener('touchend', function (e) {
      if (wrap.style.display === 'none' || !clickToStart.classList.contains('visible')) return;
      e.preventDefault();
      e.stopPropagation();
      onEnterGameClick(e);
    }, { passive: false, capture: true });
  }

  if (watchVideoBtn) {
    watchVideoBtn.addEventListener('click', onWatchVideoClick);
    watchVideoBtn.addEventListener('touchend', function (e) {
      if (wrap.style.display === 'none' || !clickToStart.classList.contains('visible')) return;
      e.preventDefault();
      e.stopPropagation();
      onWatchVideoClick(e);
    }, { passive: false, capture: true });
  }

  function doResumeAfterClickSound() {
    var okBtns;
    if (continueHint) continueHint.classList.remove('playing');
    okBtns = document.querySelectorAll('.intro-dialogue-ok');
    okBtns.forEach(function (btn) { btn.classList.remove('playing'); });
    if (window.resumeGameAudioContext) window.resumeGameAudioContext();
    unmuteOnInteraction();
    resumeVideo();
  }

  function playClickSoundLouderThenResume() {
    unlockAllAudioOnce();
    var okBtns;
    if (continueHint) continueHint.classList.add('playing');
    okBtns = document.querySelectorAll('.intro-dialogue-ok');
    okBtns.forEach(function (btn) { btn.classList.add('playing'); });
    var ctx = null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      clickSound.currentTime = 0;
      clickSound.addEventListener('ended', function onEnd() {
        clickSound.removeEventListener('ended', onEnd);
        doResumeAfterClickSound();
      }, { once: true });
      clickSound.play().catch(function () { doResumeAfterClickSound(); });
      return;
    }
    var startPlay = function (decoded) {
      var src = ctx.createBufferSource();
      src.buffer = decoded;
      var gainNode = ctx.createGain();
      gainNode.gain.value = clickSoundGain;
      src.connect(gainNode);
      gainNode.connect(ctx.destination);
      src.onended = function () {
        doResumeAfterClickSound();
      };
      src.start(0);
    };
    fetch('./public/click-sound.mp3')
      .then(function (res) { return res.arrayBuffer(); })
      .then(function (buf) { return ctx.decodeAudioData(buf); })
      .then(function (decoded) {
        if (ctx.state === 'suspended') {
          ctx.resume().then(function () { startPlay(decoded); }).catch(function () { doResumeAfterClickSound(); });
        } else {
          startPlay(decoded);
        }
      })
      .catch(function () {
        clickSound.currentTime = 0;
        clickSound.addEventListener('ended', function onEnd() {
          clickSound.removeEventListener('ended', onEnd);
          doResumeAfterClickSound();
        }, { once: true });
        clickSound.play().catch(function () { doResumeAfterClickSound(); });
      });
  }

  function onResumeOverlay() {
    playClickSoundLouderThenResume();
  }
  pauseOverlay.addEventListener('click', onResumeOverlay);
  pauseOverlay.addEventListener('touchend', function (e) {
    if (wrap.style.display === 'none' || !pauseOverlay.classList.contains('visible')) return;
    e.preventDefault();
    onResumeOverlay();
  }, { passive: false, capture: true });
  videoScreen.addEventListener('click', function (e) {
    if (e.target.closest('.intro-dialogue-ok')) {
      e.preventDefault();
      e.stopPropagation();
      onResumeOverlay();
    }
  });
  videoScreen.addEventListener('touchend', function (e) {
    if (e.target.closest('.intro-dialogue-ok')) {
      if (wrap.style.display === 'none') return;
      e.preventDefault();
      e.stopPropagation();
      onResumeOverlay();
    }
  }, { passive: false, capture: true });
  document.addEventListener('keydown', function (e) {
    var anyDialogueVisible;
    if (e.key !== ' ' && e.code !== 'Space') return;
    if (wrap.style.display === 'none' || !videoScreen.classList.contains('visible')) return;
    e.preventDefault();
    anyDialogueVisible = document.querySelector('[id^="intro-dialogue-"].visible');
    if (anyDialogueVisible) {
      onResumeOverlay();
    } else if (pauseOverlay.classList.contains('visible')) {
      onResumeOverlay();
    } else if (!clickToStart.classList.contains('visible') && !video.paused && !video.ended) {
      video.pause();
      pauseOverlay.classList.add('visible');
    }
  });

  function fadeOutThenGoToGame(entry) {
    var analyticsEntry = entry == null ? 'start_button' : entry;
    wrap.classList.add('intro-fade-out');
    wrap.addEventListener('transitionend', function onEnd(e) {
      if (e.propertyName !== 'opacity') return;
      wrap.removeEventListener('transitionend', onEnd);
      logGameStart(analyticsEntry);
      navigateFromIntroToGame();
    }, { once: true });
  }

  function skipIntroAndGoToGame(clickEvent) {
    if (!wrap || wrap.style.display === 'none') return;
    if (skipBtn) {
      skipBtn.classList.add('skip-clicked');
      skipBtn.disabled = true;
    }
    unlockAllAudioOnce();
    try {
      clickSound.currentTime = 0;
      clickSound.volume = 1;
      clickSound.play().catch(function () {});
    } catch (e) {}
    setTimeout(function () {
      try {
        transitSound.currentTime = 0;
        transitSound.volume = 1;
        transitSound.play().catch(function () {});
      } catch (e2) {}
    }, 62);
    try {
      video.pause();
    } catch (e) {}
    hideAllDialogues();
    if (pauseOverlay) pauseOverlay.classList.remove('visible');
    try {
      beforeStartSong.pause();
      beforeStartSong.currentTime = 0;
    } catch (e2) {}
    try {
      aboutToStartSong.pause();
      aboutToStartSong.currentTime = 0;
    } catch (e3) {}
    if (wrap) {
      wrap.classList.add('intro-fade-out-skip');
      wrap.classList.add('intro-fade-out');
    }
    document.body.style.backgroundColor = '#fe7f70';
    createSkipCenterSlideDownTransition(function () {
      logGameStart('skip');
      navigateFromIntroToGame();
    });
  }

  function playClickSoundThenGoToGame() {
    playClickSoundThenFadeToGame('start_button');
  }

  startBtn.addEventListener('click', function (e) {
    e.preventDefault();
    playClickSoundThenGoToGame();
  });

  if (skipBtn) {
    var onSkip = function (e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      skipBtn.disabled = true;
      skipIntroAndGoToGame(e);
    };
    skipBtn.addEventListener('click', onSkip);
    skipBtn.addEventListener('touchend', function (e) {
      if (wrap.style.display === 'none') return;
      e.preventDefault();
      e.stopPropagation();
      onSkip(e);
    }, { passive: false, capture: true });
  }
})();
