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
    dashboard: null,
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
    var completedIds = (state.course.progress && state.course.progress.completedActivityIds) || [];
    for (var u = 0; u < state.course.units.length; u++) {
      var unit = state.course.units[u];
      for (var l = 0; l < unit.lessons.length; l++) {
        var lesson = unit.lessons[l];
        for (var a = 0; a < lesson.activities.length; a++) {
          var act = lesson.activities[a];
          if (completedIds.indexOf(act.activityId) !== -1) {
            act.isCompleted = true;
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
        return CourseApiAdapter.loadRecommendations(assignmentId);
      })
      .then(function (recommendations) {
        state.recommendations = recommendations || [];
        return CourseApiAdapter.loadDashboard(assignmentId);
      })
      .then(function (dashboard) {
        state.dashboard = dashboard;
        state.loading = false;
        _notify(['assignmentId', 'course', 'enrollmentId', 'submissionId', 'submissionStatus', 'submissionRevision', 'notes', 'recommendations', 'dashboard', 'currentActivityId', 'currentActivity', 'loading']);
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
        }
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

    _loadNotesForCurrentActivity().then(function () {
      _notify(['currentActivityId', 'currentActivity', 'notes']);
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
    var payload = {
      kind: kind,
      value: value || {},
      completed: !!completed,
      expectedProgressRevision: expectedRevision
    };

    if (kind === 'AUDIO' && state.videoProgress > 0) {
      payload.videoPosition = state.videoProgress;
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
        }
        if (result.courseCompletion) {
          _updateProgressFromServer(result.courseCompletion);
          _syncActivityIsCompletedFromProgress();
        }

        if (completed) {
          var activity = _findActivity(activityId);
          if (activity) activity.isCompleted = true;
        }

        _notify(['saving', 'course', 'activityProgressMap', 'activityAttemptMap']);
        return result;
      })
      .catch(function (err) {
        state.saving = false;
        if (err && err.code === 'REVISION_CONFLICT') {
          return _refreshCourseFromServer().then(function () {
            _notify(['saving', 'course', 'activityProgressMap']);
            var refreshed = new Error('进度版本冲突，已刷新最新数据，请重试');
            refreshed.code = 'REVISION_CONFLICT';
            refreshed.status = 409;
            throw refreshed;
          });
        }
        _notify(['saving']);
        throw err;
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
    isSubmitted: _isSubmitted
  };
})();
