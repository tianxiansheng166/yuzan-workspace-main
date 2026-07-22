'use strict';

window.CoursePlayerState = (function () {
  var state = {
    assignmentId: '',
    course: null,
    submissionId: '',
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
    practiceCompleted: {}
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

  function _recalculateProgress() {
    if (!state.course || !state.course.units) return;
    var total = 0;
    var completed = 0;
    for (var u = 0; u < state.course.units.length; u++) {
      var unit = state.course.units[u];
      var unitTotal = 0;
      var unitCompleted = 0;
      for (var l = 0; l < unit.lessons.length; l++) {
        var lesson = unit.lessons[l];
        var lessonTotal = lesson.activities.length;
        var lessonCompleted = 0;
        for (var a = 0; a < lesson.activities.length; a++) {
          total++;
          unitTotal++;
          if (lesson.activities[a].isCompleted) {
            completed++;
            unitCompleted++;
            lessonCompleted++;
          }
        }
        lesson.progress = lessonTotal > 0 ? Math.round((lessonCompleted / lessonTotal) * 100) : 0;
      }
      unit.progress = unitTotal > 0 ? Math.round((unitCompleted / unitTotal) * 100) : 0;
    }
    state.course.progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  function init(assignmentId) {
    state.assignmentId = assignmentId;
    state.loading = true;
    state.error = null;

    return CourseApiAdapter.loadCourse(assignmentId)
      .then(function (course) {
        state.course = course;
        return CourseApiAdapter.createSubmission(assignmentId);
      })
      .then(function (submission) {
        state.submissionId = submission.id || submission.submissionId || '';
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
        _setInitialActivity();
        state.loading = false;
        _notify(['assignmentId', 'course', 'submissionId', 'notes', 'recommendations', 'dashboard', 'currentActivityId', 'currentActivity', 'loading']);
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
    if (!state.course || !state.course.units) return;

    for (var u = 0; u < state.course.units.length; u++) {
      var unit = state.course.units[u];
      for (var l = 0; l < unit.lessons.length; l++) {
        var lesson = unit.lessons[l];
        for (var a = 0; a < lesson.activities.length; a++) {
          if (lesson.activities[a].activityId === activityId) {
            lesson.activities[a].isCompleted = true;
          }
        }
      }
    }

    state.practiceCompleted[activityId] = true;
    _recalculateProgress();
    _notify(['course', 'practiceCompleted']);
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
    setError: setError,
    setLoading: setLoading,
    getActivityList: getActivityList,
    getNextActivity: getNextActivity,
    getPrevActivity: getPrevActivity,
    restoreFromUrl: restoreFromUrl
  };
})();
