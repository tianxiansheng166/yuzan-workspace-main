'use strict';

window.CoursePlayerState = (function () {
  var SUBMITTED_STATUSES = ['SUBMITTED', 'PROCESSING', 'NEEDS_REVIEW', 'REVIEWED', 'ACCEPTED'];

  var state = {
    assignmentId: '',
    course: null,
    enrollmentId: '',
    submissionId: '',
    submissionStatus: '',
    submissionRevision: null,
    currentActivityId: '',
    currentActivity: null,
    notes: [],
    recommendations: [],
    recommendationsError: null,
    dashboard: null,
    dashboardError: null,
    loading: true,
    error: null,
    videoProgress: 0,
    videoTimestamp: 0,
    videoDuration: 0,
    videoPlaying: false,
    videoSpeed: 1,
    activeSubtitle: 'zh',
    practiceCompleted: {},
    activityProgressMap: {},
    activityAttemptMap: {},
    saving: false
  };

  var listeners = [];
  var progressSaveSequence = 0;
  var latestCourseCompletionSequence = 0;
  var courseRefreshSequence = 0;
  var latestCourseRefreshSequence = 0;
  var progressSavesInFlight = 0;

  function _notify(keys) {
    for (var i = 0; i < listeners.length; i++) {
      listeners[i](_shallowCopy(state), keys);
    }
  }

  function _shallowCopy(obj) {
    var copy = {};
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        copy[key] = obj[key];
      }
    }
    return copy;
  }

  function _findActivity(activityId) {
    if (!state.course || !state.course.units) return null;
    for (var u = 0; u < state.course.units.length; u++) {
      var unit = state.course.units[u];
      for (var l = 0; l < unit.lessons.length; l++) {
        var lesson = unit.lessons[l];
        for (var a = 0; a < lesson.activities.length; a++) {
          if (lesson.activities[a].activityId === activityId) {
            return lesson.activities[a];
          }
        }
      }
    }
    return null;
  }

  function _isSubmitted() {
    return SUBMITTED_STATUSES.indexOf(state.submissionStatus) !== -1;
  }

  function _getActivityRevision(activityId) {
    var p = state.activityProgressMap[activityId];
    return p && p.revision != null ? p.revision : 0;
  }

  function _updateProgressFromServer(courseCompletion) {
    if (!courseCompletion) return;
    if (!state.course) return;

    if (courseCompletion.progressPercent != null) {
      state.course.progress = state.course.progress || {};
      state.course.progress.percent = courseCompletion.progressPercent;
      state.course.progress.completedActivities = courseCompletion.completedRequiredCount != null ? courseCompletion.completedRequiredCount : state.course.progress.completedActivities;
      state.course.progress.totalActivities = courseCompletion.requiredActivityCount != null ? courseCompletion.requiredActivityCount : state.course.progress.totalActivities;
      state.course.progress.attainmentStatus = courseCompletion.attainmentStatus || state.course.progress.attainmentStatus;
      state.course.progress.completedActivityIds = courseCompletion.completedActivityIds || state.course.progress.completedActivityIds;
    }
  }

  function _syncActivityIsCompletedFromProgress() {
    if (!state.course || !state.course.units) return;
    var completedIds = state.course.progress && state.course.progress.completedActivityIds;
    var hasServerCompletionList = Array.isArray(completedIds);
    for (var u = 0; u < state.course.units.length; u++) {
      var unit = state.course.units[u];
      for (var l = 0; l < unit.lessons.length; l++) {
        var lesson = unit.lessons[l];
        for (var a = 0; a < lesson.activities.length; a++) {
          var act = lesson.activities[a];
          var progress = state.activityProgressMap[act.activityId];
          if (hasServerCompletionList && act.required !== false) {
            act.isCompleted = completedIds.indexOf(act.activityId) !== -1;
          } else if (progress && typeof progress.completed === 'boolean') {
            act.isCompleted = progress.completed;
          }
        }
      }
    }
  }

  function _buildActivityProgressMap(course) {
    state.activityProgressMap = {};
    if (!course || !course.units) return;
    for (var u = 0; u < course.units.length; u++) {
      var unit = course.units[u];
      for (var l = 0; l < unit.lessons.length; l++) {
        var lesson = unit.lessons[l];
        for (var a = 0; a < lesson.activities.length; a++) {
          var act = lesson.activities[a];
          if (act.progress) {
            state.activityProgressMap[act.activityId] = {
              revision: act.progress.revision != null ? act.progress.revision : 0,
              completed: !!act.progress.completed,
              position: act.progress.position != null ? act.progress.position : 0
            };
          }
          if (act.attempt) {
            state.activityAttemptMap[act.activityId] = act.attempt;
          }
        }
      }
    }
  }

  function init(assignmentId) {
    state.assignmentId = assignmentId;
    state.loading = true;
    state.error = null;

    return CourseApiAdapter.loadCourse(assignmentId)
      .then(function (course) {
        if (!course || !course.assignmentId) {
          throw new Error('课程详情响应缺少 assignmentId');
        }
        state.course = course;
        _buildActivityProgressMap(course);
        _setInitialActivity();
        return CourseApiAdapter.createSubmission(assignmentId);
      })
      .then(function (submission) {
        state.submissionId = submission.id || submission.submissionId || '';
        state.submissionStatus = submission.status || '';
        state.submissionRevision = submission.revision != null ? submission.revision : null;
        state.enrollmentId = submission.enrollmentId || '';
        if (!state.submissionId) {
          throw new Error('课程 Submission 响应缺少 id');
        }
        return _loadNotesForCurrentActivity();
      })
      .then(function () {
        return Promise.all([
          CourseApiAdapter.loadRecommendations(assignmentId)
            .then(function (recommendations) {
              state.recommendations = recommendations || [];
              state.recommendationsError = null;
            })
            .catch(function (err) {
              state.recommendations = [];
              state.recommendationsError = err && err.message ? err.message : '推荐课程暂时无法加载';
            }),
          CourseApiAdapter.loadDashboard(assignmentId)
            .then(function (dashboard) {
              state.dashboard = dashboard;
              state.dashboardError = null;
            })
            .catch(function (err) {
              state.dashboard = null;
              state.dashboardError = err && err.message ? err.message : '学习统计暂时无法加载';
            })
        ]);
      })
      .then(function () {
        state.loading = false;
        _notify(['assignmentId', 'course', 'enrollmentId', 'submissionId', 'submissionStatus', 'submissionRevision', 'notes', 'recommendations', 'recommendationsError', 'dashboard', 'dashboardError', 'currentActivityId', 'currentActivity', 'loading']);
        return _shallowCopy(state);
      })
      .catch(function (err) {
        state.error = err && err.message ? err.message : String(err);
        state.loading = false;
        _notify(['error', 'loading']);
        return _shallowCopy(state);
      });
  }

  function _setInitialActivity() {
    var list = getActivityList();
    var requestedActivityId = new URLSearchParams(window.location.search || '').get('activityId');
    var requestedActivity = requestedActivityId ? _findActivity(requestedActivityId) : null;
    if (requestedActivity) {
      state.currentActivityId = requestedActivityId;
      state.currentActivity = requestedActivity;
      return;
    }
    var firstIncomplete = null;
    var firstActivity = null;
    for (var i = 0; i < list.length; i++) {
      if (!firstActivity) {
        firstActivity = list[i];
      }
      if (!list[i].isCompleted && !firstIncomplete) {
        firstIncomplete = list[i];
        break;
      }
    }
    var target = firstIncomplete || firstActivity;
    if (target) {
      state.currentActivityId = target.activityId;
      state.currentActivity = target;
    }
  }

  function _loadNotesForCurrentActivity() {
    if (!state.currentActivityId) {
      state.notes = [];
      return Promise.resolve();
    }
    return CourseApiAdapter.loadNotes(state.assignmentId, state.currentActivityId)
      .then(function (notes) {
        state.notes = notes || [];
      });
  }

  function _refreshCourseFromServer() {
    var refreshSequence = ++courseRefreshSequence;
    var progressSequenceAtRefreshStart = progressSaveSequence;
    return CourseApiAdapter.loadCourse(state.assignmentId)
      .then(function (course) {
        if (course && course.assignmentId && refreshSequence >= latestCourseRefreshSequence) {
          latestCourseRefreshSequence = refreshSequence;
          latestCourseCompletionSequence = Math.max(latestCourseCompletionSequence, progressSequenceAtRefreshStart);
          state.course = course;
          _buildActivityProgressMap(course);
          _syncActivityIsCompletedFromProgress();
          state.currentActivity = state.currentActivityId ? _findActivity(state.currentActivityId) : null;
          _notify(['course', 'activityProgressMap', 'currentActivity']);
        }
      });
  }

  function refreshActivityProgress(activityId) {
    if (!activityId) return Promise.reject(new Error('活动 ID 缺失，无法核对学习进度'));
    return _refreshCourseFromServer().then(function () {
      var progress = state.activityProgressMap[activityId];
      if (!progress) return { revision: 0, position: 0, completed: false };
      return {
        revision: progress.revision != null ? progress.revision : 0,
        position: progress.position != null ? progress.position : 0,
        completed: !!progress.completed
      };
    });
  }

  function getState() {
    return _shallowCopy(state);
  }

  function subscribe(listener) {
    if (typeof listener === 'function' && listeners.indexOf(listener) === -1) {
      listeners.push(listener);
    }
  }

  function unsubscribe(listener) {
    var idx = listeners.indexOf(listener);
    if (idx !== -1) {
      listeners.splice(idx, 1);
    }
  }

  function setCurrentActivity(activityId) {
    var activity = _findActivity(activityId);
    if (!activity) return;

    state.currentActivityId = activityId;
    state.currentActivity = activity;

    var url = new URL(window.location.href);
    url.searchParams.set('activityId', activityId);
    window.history.replaceState(null, '', url.toString());

    _notify(['currentActivityId', 'currentActivity']);
    _loadNotesForCurrentActivity().then(function () {
      _notify(['notes']);
    }).catch(function () {
      state.notes = [];
      _notify(['notes']);
    });
  }

  function updateVideoProgress(percent, timestamp, duration) {
    state.videoProgress = percent;
    state.videoTimestamp = timestamp;
    state.videoDuration = duration;
    _notify(['videoProgress', 'videoTimestamp', 'videoDuration']);
  }

  function setVideoPlaying(playing) {
    state.videoPlaying = playing;
    _notify(['videoPlaying']);
  }

  function setVideoSpeed(speed) {
    state.videoSpeed = speed;
    _notify(['videoSpeed']);
  }

  function setActiveSubtitle(lang) {
    state.activeSubtitle = lang;
    _notify(['activeSubtitle']);
  }

  function addNote(note) {
    state.notes.push(note);
    _notify(['notes']);
  }

  function updateNote(noteId, content, videoTimestamp, revision) {
    for (var i = 0; i < state.notes.length; i++) {
      if ((state.notes[i].noteId || state.notes[i].id) === noteId) {
        state.notes[i].content = content;
        state.notes[i].videoTimestamp = videoTimestamp;
        if (revision != null) state.notes[i].revision = revision;
        break;
      }
    }
    _notify(['notes']);
  }

  function removeNote(noteId) {
    state.notes = state.notes.filter(function (n) {
      return (n.noteId || n.id) !== noteId;
    });
    _notify(['notes']);
  }

  function setActivityCompleted(activityId) {
    var activity = _findActivity(activityId);
    if (activity) {
      activity.isCompleted = true;
    }
    state.practiceCompleted[activityId] = true;
    _notify(['course', 'practiceCompleted']);
  }

  function saveActivityAttempt(activityId, kind, value, completed) {
    if (_isSubmitted()) {
      return Promise.reject(new Error('课程已提交，不能修改活动进度'));
    }
    if (!state.submissionId) {
      return Promise.reject(new Error('课程 Submission 尚未创建'));
    }

    var expectedRevision = _getActivityRevision(activityId);
    var requestSequence = ++progressSaveSequence;
    var payload = {
      kind: kind,
      value: value || {},
      completed: !!completed,
      expectedProgressRevision: expectedRevision
    };

    if ((kind === 'VIDEO' || kind === 'AUDIO') && value &&
        typeof value.videoPosition === 'number' && Number.isFinite(value.videoPosition) &&
        value.videoPosition >= 0 && value.videoPosition <= 1) {
      payload.videoPosition = value.videoPosition;
    }

    state.saving = true;
    progressSavesInFlight += 1;
    _notify(['saving']);

    return CourseApiAdapter.saveActivityAttempt(state.assignmentId, state.submissionId, activityId, payload)
      .then(function (result) {
        if (result.attempt) {
          state.activityAttemptMap[activityId] = result.attempt;
        }
        if (result.progress) {
          var currentProgress = state.activityProgressMap[activityId];
          var returnedProgress = {
            revision: result.progress.revision != null ? result.progress.revision : (expectedRevision + 1),
            completed: !!result.progress.completed,
            position: result.progress.position != null ? result.progress.position : 0
          };
          if (!currentProgress || returnedProgress.revision >= currentProgress.revision) {
            state.activityProgressMap[activityId] = returnedProgress;
            var activity = _findActivity(activityId);
            if (activity) activity.isCompleted = returnedProgress.completed;
          }
        }
        if (result.courseCompletion && requestSequence >= latestCourseCompletionSequence) {
          latestCourseCompletionSequence = requestSequence;
          _updateProgressFromServer(result.courseCompletion);
          _syncActivityIsCompletedFromProgress();
        }
        _notify(['course', 'activityProgressMap', 'activityAttemptMap']);
        return result;
      })
      .catch(function (err) {
        if (err && (err.code === 'REVISION_CONFLICT' || err.status === 409)) {
          return _refreshCourseFromServer().then(function () {
            var refreshed = new Error('进度版本冲突，已刷新最新数据，请核对后重试');
            refreshed.code = 'REVISION_CONFLICT';
            refreshed.status = 409;
            throw refreshed;
          }, function () {
            var refreshFailed = new Error('进度版本冲突，暂时无法刷新服务器记录，请重新加载课程');
            refreshFailed.code = 'REVISION_CONFLICT';
            refreshFailed.status = 409;
            throw refreshFailed;
          });
        }
        throw err;
      })
      .finally(function () {
        progressSavesInFlight = Math.max(0, progressSavesInFlight - 1);
        state.saving = progressSavesInFlight > 0;
        _notify(['saving']);
      });
  }

  function submitCourse() {
    if (_isSubmitted()) {
      return Promise.resolve({ status: state.submissionStatus });
    }
    if (state.submissionRevision == null) {
      return Promise.reject(new Error('课程 revision 未知，无法提交'));
    }
    if (!state.submissionId) {
      return Promise.reject(new Error('课程 Submission 尚未创建'));
    }

    state.saving = true;
    _notify(['saving']);

    return CourseApiAdapter.submitCourse(state.assignmentId, state.submissionId, state.submissionRevision)
      .then(function (result) {
        state.saving = false;
        state.submissionStatus = result.status || 'SUBMITTED';
        _notify(['saving', 'submissionStatus']);
        return result;
      })
      .catch(function (err) {
        state.saving = false;
        _notify(['saving']);
        throw err;
      });
  }

  function setError(message) {
    state.error = message;
    state.loading = false;
    _notify(['error', 'loading']);
  }

  function setLoading(loading) {
    state.loading = loading;
    _notify(['loading']);
  }

  function getActivityList() {
    var list = [];
    if (!state.course || !state.course.units) return list;

    for (var u = 0; u < state.course.units.length; u++) {
      var unit = state.course.units[u];
      for (var l = 0; l < unit.lessons.length; l++) {
        var lesson = unit.lessons[l];
        for (var a = 0; a < lesson.activities.length; a++) {
          var activity = lesson.activities[a];
          activity._unitTitle = unit.title;
          activity._lessonTitle = lesson.title;
          list.push(activity);
        }
      }
    }
    return list;
  }

  function getNextActivity() {
    var list = getActivityList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].activityId === state.currentActivityId && i < list.length - 1) {
        return list[i + 1];
      }
    }
    return null;
  }

  function getPrevActivity() {
    var list = getActivityList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].activityId === state.currentActivityId && i > 0) {
        return list[i - 1];
      }
    }
    return null;
  }

  function restoreFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var activityId = params.get('activityId');
    if (activityId && _findActivity(activityId)) {
      setCurrentActivity(activityId);
    }
  }

  return {
    init: init,
    getState: getState,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    setCurrentActivity: setCurrentActivity,
    updateVideoProgress: updateVideoProgress,
    setVideoPlaying: setVideoPlaying,
    setVideoSpeed: setVideoSpeed,
    setActiveSubtitle: setActiveSubtitle,
    addNote: addNote,
    updateNote: updateNote,
    removeNote: removeNote,
    setActivityCompleted: setActivityCompleted,
    saveActivityAttempt: saveActivityAttempt,
    submitCourse: submitCourse,
    setError: setError,
    setLoading: setLoading,
    getActivityList: getActivityList,
    getNextActivity: getNextActivity,
    getPrevActivity: getPrevActivity,
    restoreFromUrl: restoreFromUrl,
    refreshActivityProgress: refreshActivityProgress,
    isSubmitted: _isSubmitted
  };
})();
