'use strict';

(function () {
  var SVG = {
    play: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    volume: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    mute: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    expand: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
    cc: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M10 9a3 3 0 1 0 0 6M14 9a3 3 0 1 1 0 6"/></svg>'
  };

  var VALID_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  var video = null;
  var playBtn = null;
  var controls = null;
  var playPauseBtn = null;
  var progressBar = null;
  var currentTimeEl = null;
  var totalTimeEl = null;
  var speedBtn = null;
  var speedMenu = null;
  var subtitleZh = null;
  var subtitleBo = null;
  var fullscreenBtn = null;
  var volumeBtn = null;

  var controlsTimeout = null;
  var duration = 0;

  // Bound handler references for cleanup
  var handlers = {};

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    if (h > 0) {
      return h + ':' + pad(m) + ':' + pad(s);
    }
    return m + ':' + pad(s);
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function showControls() {
    if (controls) controls.classList.add('visible');
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(function () {
      if (controls && video && !video.paused) {
        controls.classList.remove('visible');
      }
    }, 3000);
  }

  function hideControls() {
    if (controls) controls.classList.remove('visible');
  }

  function updatePlayPauseUI() {
    if (!video) return;
    if (video.paused) {
      if (playPauseBtn) playPauseBtn.innerHTML = SVG.play;
      if (playBtn) playBtn.classList.remove('hidden');
    } else {
      if (playPauseBtn) playPauseBtn.innerHTML = SVG.pause;
      if (playBtn) playBtn.classList.add('hidden');
    }
  }

  function updateVolumeUI() {
    if (!video || !volumeBtn) return;
    volumeBtn.innerHTML = video.muted ? SVG.mute : SVG.volume;
  }

  function onLoadedMetadata() {
    duration = video.duration;
    if (totalTimeEl) totalTimeEl.textContent = formatTime(duration);
    if (progressBar) progressBar.max = duration;
  }

  function onTimeUpdate() {
    if (!video) return;
    var cur = video.currentTime;
    if (progressBar) progressBar.value = cur;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(cur);
    if (typeof CoursePlayerState !== 'undefined' && CoursePlayerState.updateVideoProgress) {
      var pct = duration > 0 ? (cur / duration) * 100 : 0;
      CoursePlayerState.updateVideoProgress(pct, cur, duration);
    }
  }

  function onPlay() {
    updatePlayPauseUI();
  }

  function onPause() {
    updatePlayPauseUI();
  }

  function onEnded() {
    updatePlayPauseUI();
    if (progressBar) progressBar.value = 0;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(0);
  }

  function onProgressInput() {
    if (video && progressBar) {
      video.currentTime = parseFloat(progressBar.value);
    }
  }

  function onSpeedBtnClick(e) {
    e.stopPropagation();
    if (speedMenu) speedMenu.hidden = !speedMenu.hidden;
  }

  function onSpeedOptionClick(e) {
    var rate = parseFloat(e.target.getAttribute('data-speed'));
    setSpeed(rate);
    if (speedBtn) speedBtn.textContent = rate + 'x';
    if (speedMenu) speedMenu.hidden = true;
  }

  function onSubtitleZhClick() {
    setSubtitle('zh');
  }

  function onSubtitleBoClick() {
    setSubtitle('bo');
  }

  function onFullscreenBtnClick() {
    toggleFullscreen();
  }

  function onVolumeBtnClick() {
    toggleMute();
  }

  function onContainerMouseMove() {
    showControls();
  }

  function onDocumentClick(e) {
    if (speedMenu && !speedMenu.contains(e.target) && e.target !== speedBtn) {
      speedMenu.hidden = true;
    }
  }

  function onPlayBtnClick() {
    togglePlay();
  }

  function onPlayPauseBtnClick() {
    togglePlay();
  }

  window.MediaController = {
    init: function (videoElementId) {
      video = document.getElementById(videoElementId || 'cpVideo');
      if (!video) return;

      playBtn = document.getElementById('cpPlayBig');
      controls = document.getElementById('cpVideoControls');
      playPauseBtn = document.getElementById('cpPlayBtn');
      progressBar = document.getElementById('cpProgressInput');
      currentTimeEl = document.getElementById('cpTimeCurrent');
      totalTimeEl = document.getElementById('cpTimeDuration');
      speedBtn = document.getElementById('cpSpeedBtn');
      speedMenu = document.getElementById('cpSpeedMenu');
      subtitleZh = document.getElementById('cpSubZhBtn');
      subtitleBo = document.getElementById('cpSubBoBtn');
      fullscreenBtn = document.getElementById('cpFullscreenBtn');
      volumeBtn = document.getElementById('cpVolumeBtn');

      // Bind video events
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('ended', onEnded);

      // Bind progress bar
      if (progressBar) progressBar.addEventListener('input', onProgressInput);

      // Bind play overlay
      if (playBtn) playBtn.addEventListener('click', onPlayBtnClick);

      // Bind play/pause in control bar
      if (playPauseBtn) playPauseBtn.addEventListener('click', onPlayPauseBtnClick);

      // Bind speed controls
      if (speedBtn) speedBtn.addEventListener('click', onSpeedBtnClick);
      if (speedMenu) {
        var speedOptions = speedMenu.querySelectorAll('[data-speed]');
        for (var i = 0; i < speedOptions.length; i++) {
          speedOptions[i].addEventListener('click', onSpeedOptionClick);
        }
      }

      // Bind subtitle buttons
      if (subtitleZh) subtitleZh.addEventListener('click', onSubtitleZhClick);
      if (subtitleBo) subtitleBo.addEventListener('click', onSubtitleBoClick);

      // Bind fullscreen
      if (fullscreenBtn) fullscreenBtn.addEventListener('click', onFullscreenBtnClick);

      // Bind volume
      if (volumeBtn) volumeBtn.addEventListener('click', onVolumeBtnClick);

      // Bind container mouse move for controls auto-hide
      var container = video.parentElement;
      if (container) container.addEventListener('mousemove', onContainerMouseMove);

      // Close speed menu on outside click
      document.addEventListener('click', onDocumentClick);

      // Initial UI state
      updatePlayPauseUI();
      updateVolumeUI();
    },

    loadSource: function (videoUrl, posterUrl, subtitleZhUrl, subtitleBoUrl) {
      if (!video) return;

      video.src = videoUrl || '';
      video.poster = posterUrl || '';

      // Remove existing tracks
      var existingTracks = video.querySelectorAll('track');
      for (var i = 0; i < existingTracks.length; i++) {
        video.removeChild(existingTracks[i]);
      }

      // Add subtitle tracks
      if (subtitleZhUrl) {
        var trackZh = document.createElement('track');
        trackZh.kind = 'subtitles';
        trackZh.srclang = 'zh';
        trackZh.src = subtitleZhUrl;
        trackZh.label = '汉语字幕';
        video.appendChild(trackZh);
      }

      if (subtitleBoUrl) {
        var trackBo = document.createElement('track');
        trackBo.kind = 'subtitles';
        trackBo.srclang = 'bo';
        trackBo.src = subtitleBoUrl;
        trackBo.label = '藏语字幕';
        video.appendChild(trackBo);
      }
    },

    play: function () {
      if (video) video.play();
    },

    pause: function () {
      if (video) video.pause();
    },

    togglePlay: function () {
      if (!video) return;
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    },

    seekTo: function (seconds) {
      if (video) video.currentTime = seconds;
    },

    setSpeed: function (rate) {
      if (!video) return;
      if (VALID_SPEEDS.indexOf(rate) === -1) return;
      video.playbackRate = rate;
    },

    setSubtitle: function (lang) {
      if (!video) return;
      var tracks = video.textTracks;
      for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        if (lang === 'off') {
          track.mode = 'hidden';
        } else if (track.language === lang) {
          track.mode = 'showing';
        } else {
          track.mode = 'hidden';
        }
      }

      // Update button active states
      if (subtitleZh) {
        subtitleZh.classList.toggle('active', lang === 'zh');
      }
      if (subtitleBo) {
        subtitleBo.classList.toggle('active', lang === 'bo');
      }
    },

    toggleFullscreen: function () {
      if (!video) return;
      var container = video.parentElement;
      if (!container) return;

      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        container.requestFullscreen();
      }
    },

    toggleMute: function () {
      if (!video) return;
      video.muted = !video.muted;
      updateVolumeUI();
    },

    getProgress: function () {
      if (!video) return { current: 0, duration: 0, percent: 0 };
      var cur = video.currentTime || 0;
      var dur = video.duration || 0;
      var pct = dur > 0 ? (cur / dur) * 100 : 0;
      return { current: cur, duration: dur, percent: pct };
    },

    destroy: function () {
      if (!video) return;

      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);

      if (progressBar) progressBar.removeEventListener('input', onProgressInput);
      if (playBtn) playBtn.removeEventListener('click', onPlayBtnClick);
      if (playPauseBtn) playPauseBtn.removeEventListener('click', onPlayPauseBtnClick);
      if (speedBtn) speedBtn.removeEventListener('click', onSpeedBtnClick);
      if (speedMenu) {
        var speedOptions = speedMenu.querySelectorAll('[data-speed]');
        for (var i = 0; i < speedOptions.length; i++) {
          speedOptions[i].removeEventListener('click', onSpeedOptionClick);
        }
      }
      if (subtitleZh) subtitleZh.removeEventListener('click', onSubtitleZhClick);
      if (subtitleBo) subtitleBo.removeEventListener('click', onSubtitleBoClick);
      if (fullscreenBtn) fullscreenBtn.removeEventListener('click', onFullscreenBtnClick);
      if (volumeBtn) volumeBtn.removeEventListener('click', onVolumeBtnClick);

      var container = video.parentElement;
      if (container) container.removeEventListener('mousemove', onContainerMouseMove);

      document.removeEventListener('click', onDocumentClick);

      video.pause();
      clearTimeout(controlsTimeout);

      video = null;
      playBtn = null;
      controls = null;
      playPauseBtn = null;
      progressBar = null;
      currentTimeEl = null;
      totalTimeEl = null;
      speedBtn = null;
      speedMenu = null;
      subtitleZh = null;
      subtitleBo = null;
      fullscreenBtn = null;
      volumeBtn = null;
      duration = 0;
    }
  };
})();
