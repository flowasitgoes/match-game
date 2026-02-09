/**
 * 遊戲入口：Loading 動畫 → 宣傳影片（指定秒數暫停 + 黑色透明 overlay）→ 開始遊戲
 */
(function () {
  var PAUSE_POINTS = [6, 12, 15, 18, 22, 32, 42, 48, 52, 58];
  var MIN_LOADING_MS = 2000;
  var PAUSE_TOLERANCE = 0.3;

  var wrap = document.getElementById('intro-wrap');
  var loading = document.getElementById('intro-loading');
  var videoScreen = document.getElementById('intro-video-screen');
  var video = document.getElementById('intro-video');
  var clickToStart = document.getElementById('intro-click-to-start');
  var pauseOverlay = document.getElementById('intro-pause-overlay');
  var startBtnWrap = document.getElementById('intro-start-btn-wrap');
  var startBtn = document.getElementById('intro-start-btn');

  var loadingStartTime = Date.now();
  var pauseIndex = 0;
  var hasUnmuted = false;

  function showVideoScreen() {
    loading.style.display = 'none';
    videoScreen.classList.add('visible');
    clickToStart.classList.add('visible');
  }

  function startPlayback() {
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
      pauseOverlay.classList.add('visible');
      pauseIndex += 1;
    }
  }

  function resumeVideo() {
    pauseOverlay.classList.remove('visible');
    video.play();
  }

  function onVideoEnded() {
    pauseOverlay.classList.remove('visible');
    startBtnWrap.classList.add('visible');
  }

  function hideIntro() {
    wrap.style.display = 'none';
    document.body.classList.remove('intro-active');
  }

  video.addEventListener('canplaythrough', function onCanPlay() {
    if (videoScreen.classList.contains('visible')) return;
    var elapsed = Date.now() - loadingStartTime;
    var wait = Math.max(0, MIN_LOADING_MS - elapsed);
    setTimeout(function () {
      if (videoScreen.classList.contains('visible')) return;
      showVideoScreen();
    }, wait);
  }, { once: true });

  video.addEventListener('timeupdate', checkPausePoint);
  video.addEventListener('ended', onVideoEnded);

  clickToStart.addEventListener('click', startPlayback);

  function onResumeOverlay() {
    if (window.resumeGameAudioContext) window.resumeGameAudioContext();
    unmuteOnInteraction();
    resumeVideo();
  }
  pauseOverlay.addEventListener('click', onResumeOverlay);
  pauseOverlay.addEventListener('touchend', function (e) {
    if (wrap.style.display === 'none' || !pauseOverlay.classList.contains('visible')) return;
    e.preventDefault();
    onResumeOverlay();
  }, { passive: false, capture: true });
  clickToStart.addEventListener('touchend', function (e) {
    if (wrap.style.display === 'none' || !clickToStart.classList.contains('visible')) return;
    e.preventDefault();
    startPlayback();
  }, { passive: false, capture: true });

  document.addEventListener('keydown', function (e) {
    if (e.key !== ' ' && e.code !== 'Space') return;
    if (wrap.style.display === 'none' || !videoScreen.classList.contains('visible')) return;
    e.preventDefault();
    if (pauseOverlay.classList.contains('visible')) {
      unmuteOnInteraction();
      resumeVideo();
    } else if (!clickToStart.classList.contains('visible') && !video.paused && !video.ended) {
      video.pause();
      pauseOverlay.classList.add('visible');
    }
  });

  startBtn.addEventListener('click', function () {
    hideIntro();
  });
})();
