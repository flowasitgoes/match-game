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
  var entranceClickIcon = clickToStart ? clickToStart.querySelector('.entrance-click-icon') : null;
  var startBtnWrap = document.getElementById('intro-start-btn-wrap');
  var startBtn = document.getElementById('intro-start-btn');
  var volumeBtn = document.getElementById('intro-volume-btn');
  var volumeBtnIcon = volumeBtn ? volumeBtn.querySelector('i') : null;
// mobile 優化 02/10
  var loadingStartTime = Date.now();
  var pauseIndex = 0;
  var hasUnmuted = false;
  var pauseSound = new Audio('/public/pause-sound-1.mp3');
  var clickSound = new Audio('/public/click-sound.mp3');
  clickSound.volume = 1;
  var clickSoundGain = 1.8;
  var beforeStartSong = new Audio('/public/game-before-start-song.mp3');
  beforeStartSong.loop = true;
  var aboutToStartSong = new Audio('/public/game-about-to-start.mp3');
  aboutToStartSong.loop = true;

  function startBeforeStartSong() {
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
    if (window.resumeGameAudioContext) window.resumeGameAudioContext();
    unmuteOnInteraction();
    clickToStart.classList.remove('visible');
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
      pauseSound.currentTime = 0;
      pauseSound.play().catch(function () {});
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
  // 在一段安全時間後仍強制切到影片畫面，至少讓使用者看到「天空很美」提示與開始按鈕
  setTimeout(function () {
    if (videoScreen.classList.contains('visible')) return;
    showVideoScreen();
  }, MIN_LOADING_MS + 4000);

  video.addEventListener('timeupdate', checkPausePoint);
  video.addEventListener('ended', onVideoEnded);

  function playClickSoundThenStart() {
    beforeStartSong.pause();
    beforeStartSong.currentTime = 0;
    if (volumeBtn) volumeBtn.classList.add('hidden');
    if (startHint) startHint.classList.add('playing');
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
    fetch('/public/click-sound.mp3')
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

  clickToStart.addEventListener('click', function (e) {
    e.preventDefault();
    playClickSoundThenStart();
  });
  if (entranceClickIcon) {
    entranceClickIcon.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      playClickSoundThenStart();
    });
    entranceClickIcon.addEventListener('touchend', function (e) {
      if (wrap.style.display === 'none' || !clickToStart.classList.contains('visible')) return;
      e.preventDefault();
      e.stopPropagation();
      playClickSoundThenStart();
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
    fetch('/public/click-sound.mp3')
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
  clickToStart.addEventListener('touchend', function (e) {
    if (wrap.style.display === 'none' || !clickToStart.classList.contains('visible')) return;
    e.preventDefault();
    playClickSoundThenStart();
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

  function fadeOutThenGoToGame() {
    wrap.classList.add('intro-fade-out');
    wrap.addEventListener('transitionend', function onEnd(e) {
      if (e.propertyName !== 'opacity') return;
      wrap.removeEventListener('transitionend', onEnd);
      window.location.href = '/game';
    }, { once: true });
  }

  function playClickSoundThenGoToGame() {
    aboutToStartSong.pause();
    aboutToStartSong.currentTime = 0;
    startBtn.classList.add('vertical-overlap');
    var ctx = null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      clickSound.currentTime = 0;
      clickSound.addEventListener('ended', function onEnd() {
        clickSound.removeEventListener('ended', onEnd);
        fadeOutThenGoToGame();
      }, { once: true });
      clickSound.play().catch(function () { fadeOutThenGoToGame(); });
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
        fadeOutThenGoToGame();
      };
      src.start(0);
    };
    fetch('/public/click-sound.mp3')
      .then(function (res) { return res.arrayBuffer(); })
      .then(function (buf) { return ctx.decodeAudioData(buf); })
      .then(function (decoded) {
        if (ctx.state === 'suspended') {
          ctx.resume().then(function () { startPlayDecoded(decoded); }).catch(function () { fadeOutThenGoToGame(); });
        } else {
          startPlayDecoded(decoded);
        }
      })
      .catch(function () {
        clickSound.currentTime = 0;
        clickSound.addEventListener('ended', function onEnd() {
          clickSound.removeEventListener('ended', onEnd);
          fadeOutThenGoToGame();
        }, { once: true });
        clickSound.play().catch(function () { fadeOutThenGoToGame(); });
      });
  }

  startBtn.addEventListener('click', function (e) {
    e.preventDefault();
    playClickSoundThenGoToGame();
  });
})();
