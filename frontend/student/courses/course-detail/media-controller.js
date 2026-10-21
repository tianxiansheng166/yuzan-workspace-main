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
  var overlay = null;
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
  var videoError = null;
  var progressSaveError = null;
  var progressSaveErrorMessage = null;
  var progressRetryBtn = null;

  var controlsTimeout = null;
  var duration = 0;
  var lastSavedPosition = 0;
  var mediaActivityId = '';
  var mediaActivityType = '';
  var POSITION_SAVE_INTERVAL = 10;
  var metadataRestoreKey = '';
  var progressSequence = 0;
  var latestProgressByActivity = Object.create(null);
  var queuedProgressByActivity = Object.create(null);
  var failedProgressByActivity = Object.create(null);
  var blockedProgressByActivity = Object.create(null);
  var savedProgressByActivity = Object.create(null);
  var activeProgressSave = null;
  var progressRetryInFlight = false;
  var visibleProgressErrorActivityId = '';

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
      if (overlay) overlay.removeAttribute('hidden');
    } else {
      if (playPauseBtn) playPauseBtn.innerHTML = SVG.pause;
      if (playBtn) playBtn.classList.add('hidden');
      if (overlay) overlay.setAttribute('hidden', 'hidden');
    }
  }

  function updateVolumeUI() {
    if (!video || !volumeBtn) return;
    volumeBtn.innerHTML = video.muted ? SVG.mute : SVG.volume;
  }

  function clearVideoError() {
    if (!videoError) return;
    videoError.textContent = '';
    videoError.hidden = true;
  }

  function showVideoError(message) {
    if (!videoError) return;
    videoError.textContent = message || '视频加载失败，请检查网络后重试。';
    videoError.hidden = false;
  }

  function onVideoError() {
    if (!video || !(video.currentSrc || video.src)) return;
    showVideoError('视频加载失败，请检查网络后重试。');
  }

  function onLoadedMetadata() {
    duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    if (totalTimeEl) totalTimeEl.textContent = formatTime(duration);
    if (progressBar) progressBar.max = duration || 0;

    if (!duration || typeof CoursePlayerState === 'undefined') return;
    var s = CoursePlayerState.getState();
    var activityId = mediaActivityId || s.currentActivityId;
    if (!activityId || (mediaActivityId && s.currentActivityId && s.currentActivityId !== mediaActivityId)) return;
    var sourceKey = activityId + '|' + (video.currentSrc || video.src || '');
    if (sourceKey === metadataRestoreKey) return;
    metadataRestoreKey = sourceKey;

    var progress = s.activityProgressMap && s.activityProgressMap[activityId];
    var fraction = progress && typeof progress.position === 'number' && isFinite(progress.position)
      ? Math.min(1, Math.max(0, progress.position))
      : 0;
    var restoredPosition = Math.min(duration, Math.max(0, fraction * duration));
    try {
      video.currentTime = restoredPosition;
    } catch (error) {
      return;
    }
    lastSavedPosition = restoredPosition;
    if (progressBar) progressBar.value = restoredPosition;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(restoredPosition);
    if (CoursePlayerState.updateVideoProgress) {
      CoursePlayerState.updateVideoProgress(fraction * 100, restoredPosition, duration);
    }
  }

  function _makeProgressSnapshot(position, completed) {
    if (typeof CoursePlayerState === 'undefined') return;
    var s = CoursePlayerState.getState();
    var activityId = mediaActivityId || s.currentActivityId;
    if (!activityId || !s.submissionId) return null;
    if (s.submissionStatus && ['SUBMITTED', 'PROCESSING', 'NEEDS_REVIEW', 'REVIEWED', 'ACCEPTED'].indexOf(s.submissionStatus) !== -1) return;
    var activityKind = mediaActivityType || (s.currentActivity ? s.currentActivity.activityType : 'VIDEO');
    var videoPosition = isFinite(duration) && duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
    var savedProgress = s.activityProgressMap && s.activityProgressMap[activityId];
    var completedOnServer = !!(savedProgress && savedProgress.completed);
    return {
      activityId: activityId,
      kind: activityKind,
      videoPosition: videoPosition,
      completed: isFinite(duration) && duration > 0 && (completed === true || videoPosition >= 1 || completedOnServer),
      sequence: ++progressSequence,
      baseRevision: savedProgress && savedProgress.revision != null ? savedProgress.revision : 0
    };
  }

  function _sameProgress(left, right) {
    return !!left && !!right && left.videoPosition === right.videoPosition && left.completed === right.completed;
  }

  function _progressSaveFailureMessage(error) {
    var status = error && Number(error.status);
    var code = error && error.code;
    if (status === 403) return '当前账号无权保存此课程的学习进度。';
    if (status === 409 || code === 'REVISION_CONFLICT') return '进度已在其他页面更新，服务器最新记录已刷新；尚未确认本次进度。';
    if (status >= 500 || status === 0 || code === 'NETWORK_ERROR' || error instanceof TypeError) {
      return '网络或服务暂时不可用，学习进度尚未确认保存。';
    }
    return '学习进度保存失败，服务器尚未确认本次记录。';
  }

  function _renderProgressError(activityId, error) {
    if (!progressSaveError || !progressSaveErrorMessage) return;
    visibleProgressErrorActivityId = activityId || '';
    progressSaveErrorMessage.textContent = _progressSaveFailureMessage(error);
    progressSaveError.hidden = false;
    if (progressRetryBtn) progressRetryBtn.hidden = !activityId;
  }

  function _renderNextProgressError() {
    var ids = Object.keys(failedProgressByActivity);
    if (!ids.length) {
      visibleProgressErrorActivityId = '';
      if (progressSaveError) progressSaveError.hidden = true;
      if (progressSaveErrorMessage) progressSaveErrorMessage.textContent = '';
      if (progressRetryBtn) progressRetryBtn.hidden = true;
      return;
    }
    if (ids.indexOf(visibleProgressErrorActivityId) === -1) {
      visibleProgressErrorActivityId = ids[0];
      _renderProgressError(visibleProgressErrorActivityId, failedProgressByActivity[visibleProgressErrorActivityId].error);
    }
  }

  function _clearProgressFailure(activityId) {
    delete failedProgressByActivity[activityId];
    delete blockedProgressByActivity[activityId];
    if (visibleProgressErrorActivityId === activityId) visibleProgressErrorActivityId = '';
    _renderNextProgressError();
  }

  function _handleProgressSaveFailure(snapshot, error) {
    var activityId = snapshot.activityId;
    var latest = latestProgressByActivity[activityId];
    var queued = queuedProgressByActivity[activityId];
    var pending = snapshot;
    if (queued && queued.sequence > pending.sequence) pending = queued;
    if (latest && latest.sequence > pending.sequence) pending = latest;
    delete queuedProgressByActivity[activityId];
    failedProgressByActivity[activityId] = { snapshot: pending, error: error };
    blockedProgressByActivity[activityId] = true;
    _renderProgressError(activityId, error);
  }

  function _pumpProgressSaves() {
    if (activeProgressSave || typeof CoursePlayerState === 'undefined') return;
    var candidates = Object.keys(queuedProgressByActivity)
      .filter(function (activityId) { return !blockedProgressByActivity[activityId]; })
      .sort(function (left, right) {
        return queuedProgressByActivity[left].sequence - queuedProgressByActivity[right].sequence;
      });
    if (!candidates.length) return;

    var activityId = candidates[0];
    var snapshot = queuedProgressByActivity[activityId];
    delete queuedProgressByActivity[activityId];
    activeProgressSave = snapshot;

    var save;
    try {
      save = CoursePlayerState.saveActivityAttempt(
        snapshot.activityId,
        snapshot.kind,
        { videoPosition: snapshot.videoPosition },
        snapshot.completed,
      );
    } catch (error) {
      save = Promise.reject(error);
    }

    Promise.resolve(save).then(function (result) {
      var progress = result && result.progress;
      savedProgressByActivity[snapshot.activityId] = progress ? {
        videoPosition: progress.position != null ? progress.position : snapshot.videoPosition,
        completed: progress.completed != null ? !!progress.completed : snapshot.completed
      } : snapshot;
      if (failedProgressByActivity[snapshot.activityId]) _clearProgressFailure(snapshot.activityId);
      else _renderNextProgressError();
    }, function (error) {
      _handleProgressSaveFailure(snapshot, error);
    }).finally(function () {
      activeProgressSave = null;
      _pumpProgressSaves();
    });
  }

  function _queueProgressSave(snapshot) {
    if (!snapshot) return;
    var activityId = snapshot.activityId;
    if (_sameProgress(savedProgressByActivity[activityId], snapshot)) return;
    if (activeProgressSave && activeProgressSave.activityId === activityId && _sameProgress(activeProgressSave, snapshot)) return;
    if (queuedProgressByActivity[activityId] && _sameProgress(queuedProgressByActivity[activityId], snapshot)) return;
    if (blockedProgressByActivity[activityId]) return;
    queuedProgressByActivity[activityId] = snapshot;
    _pumpProgressSaves();
  }

  function _saveVideoPosition(position, completed) {
    var snapshot = _makeProgressSnapshot(position, completed);
    if (!snapshot) return;
    latestProgressByActivity[snapshot.activityId] = snapshot;
    _queueProgressSave(snapshot);
  }

  function retryProgressSave() {
    if (progressRetryInFlight || !visibleProgressErrorActivityId) return;
    var activityId = visibleProgressErrorActivityId;
    var failure = failedProgressByActivity[activityId];
    if (!failure || typeof CoursePlayerState === 'undefined' || !CoursePlayerState.refreshActivityProgress) return;

    progressRetryInFlight = true;
    if (progressRetryBtn) progressRetryBtn.disabled = true;
    if (progressSaveErrorMessage) progressSaveErrorMessage.textContent = '正在核对服务器进度…';

    Promise.resolve(CoursePlayerState.refreshActivityProgress(activityId)).then(function (serverProgress) {
      var latest = latestProgressByActivity[activityId];
      var candidate = latest && latest.sequence >= failure.snapshot.sequence ? latest : failure.snapshot;
      var serverPosition = serverProgress && typeof serverProgress.position === 'number' ? Math.min(1, Math.max(0, serverProgress.position)) : 0;
      var serverCompleted = !!(serverProgress && serverProgress.completed);

      if (serverCompleted || (serverPosition > candidate.videoPosition && !candidate.completed) ||
          (serverPosition === candidate.videoPosition && (!candidate.completed || serverCompleted))) {
        savedProgressByActivity[activityId] = { videoPosition: serverPosition, completed: serverCompleted };
        _clearProgressFailure(activityId);
        return;
      }

      var retrySnapshot = {
        activityId: candidate.activityId,
        kind: candidate.kind,
        videoPosition: candidate.completed ? Math.max(candidate.videoPosition, serverPosition) : candidate.videoPosition,
        completed: candidate.completed,
        sequence: ++progressSequence,
        baseRevision: serverProgress && serverProgress.revision != null ? serverProgress.revision : 0
      };
      delete failedProgressByActivity[activityId];
      delete blockedProgressByActivity[activityId];
      queuedProgressByActivity[activityId] = retrySnapshot;
      if (progressSaveErrorMessage) progressSaveErrorMessage.textContent = '正在重试保存学习进度…';
      _pumpProgressSaves();
    }, function (error) {
      _renderProgressError(activityId, error);
    }).finally(function () {
      progressRetryInFlight = false;
      if (progressRetryBtn) progressRetryBtn.disabled = false;
    });
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
    var latest = _makeProgressSnapshot(cur, false);
    if (latest) latestProgressByActivity[latest.activityId] = latest;
    if (cur - lastSavedPosition >= POSITION_SAVE_INTERVAL) {
      lastSavedPosition = cur;
      _queueProgressSave(latest);
    }
  }

  function onPlay() {
    clearVideoError();
    updatePlayPauseUI();
  }

  function onPause() {
    updatePlayPauseUI();
    if (video && video.currentTime > 0) {
      _saveVideoPosition(video.currentTime);
    }
  }

  function onEnded() {
    updatePlayPauseUI();
    if (progressBar) progressBar.value = duration;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(duration);
    if (typeof CoursePlayerState !== 'undefined' && CoursePlayerState.updateVideoProgress) {
      CoursePlayerState.updateVideoProgress(duration > 0 ? 100 : 0, duration, duration);
    }
    _saveVideoPosition(duration, true);
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

  function togglePlay() {
    if (!video) return;
    if (video.paused) {
      playVideo();
    } else {
      video.pause();
    }
  }

  function playVideo() {
    if (!video) return;
    try {
      var result = video.play();
      if (result && typeof result.catch === 'function') {
        result.catch(function () {
          showVideoError('视频无法播放，请重新点击播放。');
        });
      }
    } catch (error) {
      showVideoError('视频无法播放，请重新点击播放。');
    }
  }

  window.MediaController = {
    init: function (videoElementId) {
      video = document.getElementById(videoElementId || 'cpVideo');
      if (!video) return;

      playBtn = document.getElementById('cpPlayBig');
      overlay = document.getElementById('cpVideoOverlay');
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
      videoError = document.getElementById('cpVideoError');
      progressSaveError = document.getElementById('cpProgressError');
      progressSaveErrorMessage = document.getElementById('cpProgressErrorMessage');
      progressRetryBtn = document.getElementById('cpProgressRetryBtn');

      // Bind video events
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('ended', onEnded);
      video.addEventListener('error', onVideoError);

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
      if (progressRetryBtn) progressRetryBtn.addEventListener('click', retryProgressSave);

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

      if (!video.paused) video.pause();
      lastSavedPosition = 0;
      duration = 0;
      metadataRestoreKey = '';
      video.poster = posterUrl || '';

      if (videoUrl) {
        clearVideoError();
        video.src = videoUrl;
      } else {
        video.removeAttribute('src');
        if (typeof video.load === 'function') video.load();
        showVideoError('本节暂无可播放的视频。');
      }

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

    setActivityContext: function (activityId, activityType) {
      if (!video) return;
      var nextActivityId = activityId || '';
      var nextActivityType = activityType || 'VIDEO';
      if (mediaActivityId === nextActivityId && mediaActivityType === nextActivityType) return;

      // Pause while the previous activity ID is still bound so its final
      // position cannot be written against the newly selected activity.
      if (!video.paused) video.pause();
      video.removeAttribute('src');
      if (typeof video.load === 'function') video.load();
      video.poster = '';
      lastSavedPosition = 0;
      duration = 0;
      metadataRestoreKey = '';
      mediaActivityId = nextActivityId;
      mediaActivityType = nextActivityType;
      clearVideoError();
    },

    showError: function (message) {
      showVideoError(message);
    },

    play: function () {
      playVideo();
    },

    pause: function () {
      if (video) video.pause();
    },

    togglePlay: function () {
      if (!video) return;
      if (video.paused) {
        playVideo();
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
        if (document.exitFullscreen) document.exitFullscreen();
      } else if (container.requestFullscreen) {
        container.requestFullscreen().catch(function () {});
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
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
      video.removeEventListener('error', onVideoError);

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
      if (progressRetryBtn) progressRetryBtn.removeEventListener('click', retryProgressSave);

      var container = video.parentElement;
      if (container) container.removeEventListener('mousemove', onContainerMouseMove);

      document.removeEventListener('click', onDocumentClick);

      video.pause();
      clearTimeout(controlsTimeout);

      video = null;
      overlay = null;
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
      videoError = null;
      progressSaveError = null;
      progressSaveErrorMessage = null;
      progressRetryBtn = null;
      duration = 0;
      mediaActivityId = '';
      mediaActivityType = '';
      metadataRestoreKey = '';
    }
  };
})();
