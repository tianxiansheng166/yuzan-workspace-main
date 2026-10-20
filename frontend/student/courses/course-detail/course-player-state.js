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
    saving: false,
    submitting: false
  };

  var listeners = [];
  var submitPromise = null;

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
      if (courseCompletion.requiredPracticeCount != null) state.course.progress.requiredPracticeCount = courseCompletion.requiredPracticeCount;
      if (courseCompletion.completedPracticeCount != null) state.course.progress.completedPracticeCount = courseCompletion.completedPracticeCount;
      if (courseCompletion.attainmentStatus != null) state.course.progress.attainmentStatus = courseCompletion.attainmentStatus;
      state.course.progress.completedActivityIds = Array.isArray(courseCompletion.completedActivityIds)
        ? courseCompletion.completedActivityIds.slice()
        : null;
    }
  }

  function _syncActivityIsCompletedFromProgress() {
    if (!state.course || !state.course.units) return;
    var progress = state.course.progress || {};
    var completedIds = Array.isArray(progress.completedActivityIds) ? progress.completedActivityIds : null;
    for (var u = 0; u < state.course.units.length; u++) {
      var unit = state.course.units[u];
      for (var l = 0; l < unit.lessons.length; l++) {
        var lesson = unit.lessons[l];
        for (var a = 0; a < lesson.activities.length; a++) {
          var act = lesson.activities[a];
          var activityProgress = state.activityProgressMap[act.activityId];
          // Recompute both true and false states from the latest server facts.
          // Required IDs come from the course aggregate; optional rows use
          // their own persisted progress record.
          act.isCompleted = act.required && completedIds
            ? completedIds.indexOf(act.activityId) !== -1
            : !!(activityProgress && activityProgress.completed);
        }
      }
    }
  }

  function _buildActivityProgressMap(course) {
    state.activityProgressMap = {};
    state.activityAttemptMap = {};
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
        _syncActivityIsCompletedFromProgress();
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
        return CourseApiAdapter.loadRecommendations(assignmentId)
          .then(function (recommendations) {
            state.recommendations = recommendations || [];
            state.recommendationsError = null;
          })
          .catch(function (err) {
            state.recommendations = [];
            state.recommendationsError = err && err.message ? err.message : '推荐课程暂时无法加载';
          });
      })
      .then(function () {
        return CourseApiAdapter.loadDashboard(assignmentId)
          .then(function (dashboard) {
            state.dashboard = dashboard;
            state.dashboardError = null;
          })
          .catch(function (err) {
            state.dashboard = null;
            state.dashboardError = err && err.message ? err.message : '学习统计暂时无法加载';
          });
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
    var requestedActivityId = new URLSearchParams(window.location.search).get('activityId');
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
    return CourseApiAdapter.loadCourse(state.assignmentId)
      .then(function (course) {
        if (course && course.assignmentId) {
          state.course = course;
          _buildActivityProgressMap(course);
          _syncActivityIsCompletedFromProgress();
          if (course.existingSubmission) {
            state.submissionId = course.existingSubmission.id || state.submissionId;
            state.submissionStatus = course.existingSubmission.status || state.submissionStatus;
            if (course.existingSubmission.revision != null) {
              state.submissionRevision = course.existingSubmission.revision;
            }
          }
          state.currentActivity = _findActivity(state.currentActivityId);
          return course;
        }
        throw new Error('刷新后的课程详情缺少服务端课程记录');
      });
  }

  function applyServerActivityResult(activityId, result) {
    result = result || {};
    if (result.progress) {
      var progress = result.progress;
      state.activityProgressMap[activityId] = {
        revision: progress.revision != null ? progress.revision : _getActivityRevision(activityId),
        completed: progress.completed === true,
        position: progress.position != null ? progress.position : 0
      };
      var activity = _findActivity(activityId);
      if (activity) activity.progress = progress;
    }
    if (result.courseCompletion && result.progress) {
      _updateProgressFromServer(result.courseCompletion);
      _syncActivityIsCompletedFromProgress();
      state.currentActivity = _findActivity(state.currentActivityId);
      _notify(['course', 'activityProgressMap']);
      return Promise.resolve(result);
    }
    return _refreshCourseFromServer().then(function () {
      _notify(['course', 'activityProgressMap']);
      return result;
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
    // Compatibility path for older callers: a local click cannot mark course
    // progress complete. Only a fresh server response can do that.
    return _refreshCourseFromServer().then(function () {
      _notify(['course', 'activityProgressMap']);
      return !!(state.activityProgressMap[activityId] && state.activityProgressMap[activityId].completed);
    });
  }

  function saveActivityAttempt(activityId, kind, value, completed) {
    if (_isSubmitted()) {
      return Promise.reject(new Error('课程已提交，不能修改活动进度'));
    }
    if (!state.submissionId) {
      return Promise.reject(new Error('课程 Submission 尚未创建'));
    }
    if (state.saving) {
      return Promise.reject(new Error('正在保存课程进度，请稍后重试'));
    }

    var expectedRevision = _getActivityRevision(activityId);
    var payload = {
      kind: kind,
      value: value || {},
      completed: !!completed,
      expectedProgressRevision: expectedRevision
    };

    if ((kind === 'AUDIO' || kind === 'VIDEO') && value && typeof value.videoPosition === 'number') {
      payload.videoPosition = Math.max(0, Math.min(1, value.videoPosition));
    }

    state.saving = true;
    _notify(['saving']);

    return CourseApiAdapter.saveActivityAttempt(state.assignmentId, state.submissionId, activityId, payload)
      .then(function (result) {
        state.saving = false;

        if (result.attempt) {
          state.activityAttemptMap[activityId] = result.attempt;
        }
        if (result.progress) {
          state.activityProgressMap[activityId] = {
            revision: result.progress.revision != null ? result.progress.revision : (expectedRevision + 1),
            completed: !!result.progress.completed,
            position: result.progress.position != null ? result.progress.position : 0
          };
          var savedActivity = _findActivity(activityId);
          if (savedActivity) savedActivity.progress = result.progress;
        }
        if (result.courseCompletion) {
          _updateProgressFromServer(result.courseCompletion);
          _syncActivityIsCompletedFromProgress();
        }

        state.currentActivity = _findActivity(state.currentActivityId);
        _syncActivityIsCompletedFromProgress();

        _notify(['saving', 'course', 'activityProgressMap', 'activityAttemptMap']);
        return result;
      })
      .catch(function (err) {
        if (err && err.code === 'REVISION_CONFLICT') {
          return _refreshCourseFromServer().then(function () {
            state.saving = false;
            state.currentActivity = _findActivity(state.currentActivityId);
            _notify(['saving', 'course', 'activityProgressMap']);
            var refreshed = new Error('进度版本冲突，已刷新最新数据，请确认后再次提交');
            refreshed.code = 'REVISION_CONFLICT';
            refreshed.status = 409;
            throw refreshed;
          }).catch(function (refreshError) {
            state.saving = false;
            _notify(['saving']);
            if (refreshError && (refreshError.status === 401 || refreshError.status === 403)) throw refreshError;
            if (refreshError && refreshError.code === 'REVISION_CONFLICT') throw refreshError;
            var unreadable = new Error('进度冲突，刷新最新课程记录失败；请重新加载课程后再提交');
            unreadable.code = 'REVISION_CONFLICT_RELOAD_FAILED';
            unreadable.status = 409;
            throw unreadable;
          });
        }
        state.saving = false;
        _notify(['saving']);
        throw err;
      });
  }

  function submitCourse() {
    if (submitPromise) return submitPromise;
    if (_isSubmitted()) {
      return Promise.resolve({ status: state.submissionStatus });
    }
    if (!state.course || !state.course.progress || state.course.progress.percent !== 100) {
      return Promise.reject(new Error('请先完成服务端确认的全部必修活动和课程练习'));
    }
    if (state.submissionRevision == null) {
      return Promise.reject(new Error('课程 revision 未知，无法提交'));
    }
    if (!state.submissionId) {
      return Promise.reject(new Error('课程 Submission 尚未创建'));
    }

    state.saving = true;
    state.submitting = true;
    _notify(['saving', 'submitting']);

    submitPromise = CourseApiAdapter.submitCourse(state.assignmentId, state.submissionId, state.submissionRevision)
      .then(function (result) {
        state.submissionStatus = result.status || 'SUBMITTED';
        if (result.revision != null) state.submissionRevision = result.revision;
        if (result.courseCompletion) _updateProgressFromServer(result.courseCompletion);
        _notify(['submissionStatus', 'submissionRevision', 'course']);
        return result;
      })
      .catch(function (err) {
        if (err && err.status === 409) {
          return _refreshCourseFromServer().then(function () {
            _notify(['course', 'submissionStatus', 'submissionRevision']);
            if (_isSubmitted()) return { status: state.submissionStatus, alreadySubmitted: true };
            var refreshed = new Error('课程状态已在其他页面更新，已重新读取最新状态；确认后可以再次提交');
            refreshed.status = 409;
            refreshed.code = 'SUBMISSION_REVISION_CONFLICT';
            throw refreshed;
          }).catch(function (refreshError) {
            if (refreshError && (refreshError.status === 401 || refreshError.status === 403)) throw refreshError;
            if (refreshError && refreshError.code === 'SUBMISSION_REVISION_CONFLICT') throw refreshError;
            var unreadable = new Error('提交状态冲突，刷新最新课程记录失败；请重新加载课程');
            unreadable.status = 409;
            unreadable.code = 'SUBMISSION_CONFLICT_RELOAD_FAILED';
            throw unreadable;
          });
        }
        throw err;
      })
      .finally(function () {
        state.saving = false;
        state.submitting = false;
        submitPromise = null;
        _notify(['saving', 'submitting', 'submissionStatus', 'submissionRevision', 'course']);
      });
    return submitPromise;
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
      if (list[i].activityId === state.currentActivityId) {
        for (var nextIndex = i + 1; nextIndex < list.length; nextIndex++) {
          if (!list[nextIndex].isCompleted) return list[nextIndex];
        }
        return null;
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
    applyServerActivityResult: applyServerActivityResult,
    saveActivityAttempt: saveActivityAttempt,
    submitCourse: submitCourse,
    setError: setError,
    setLoading: setLoading,
    getActivityList: getActivityList,
    getNextActivity: getNextActivity,
    getPrevActivity: getPrevActivity,
    restoreFromUrl: restoreFromUrl,
    isSubmitted: _isSubmitted
  };
})();
