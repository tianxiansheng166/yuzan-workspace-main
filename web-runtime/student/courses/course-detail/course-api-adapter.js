(function () {
  'use strict';

  var Api = window.YuzanApi;

  function _handleError(err) {
    var status = (err && err.status) || 0;
    var message = (err && err.message) || 'Unknown error';

    if (status === 401) {
      window.location.href = '/login';
      return { error: true, message: 'Unauthorized', status: 401 };
    }
    if (status === 403) {
      return { error: true, message: 'Permission denied', status: 403 };
    }
    if (!status && err instanceof TypeError) {
      return { error: true, message: 'Network error', status: 0 };
    }
    return { error: true, message: message, status: status };
  }

  function _normalizeCourse(raw) {
    if (!raw) {
      return {
        assignmentId: '',
        courseVersionId: '',
        title: '',
        description: '',
        coverUrl: '',
        teacher: '',
        duration: 0,
        gradeBand: '',
        capabilityTheme: '',
        taskGroup: '',
        culturalElements: [],
        difficulty: '',
        tags: [],
        units: [],
        progress: { percent: 0, completedActivities: 0, totalActivities: 0 },
        submissionId: null,
        isFavorite: false
      };
    }

    var rawUnits = raw.units || [];
    var units = rawUnits.map(function (u) {
      var rawLessons = u.lessons || [];
      var lessons = rawLessons.map(function (l) {
        var rawActivities = l.activities || [];
        var activities = rawActivities.map(function (a) {
          return {
            activityId: a.activityId || a.id || '',
            title: a.title || '',
            activityType: a.activityType || a.type || '',
            sortOrder: a.sortOrder != null ? a.sortOrder : 0,
            duration: a.duration || 0,
            videoUrl: a.videoUrl || '',
            posterUrl: a.posterUrl || '',
            subtitleZhUrl: a.subtitleZhUrl || '',
            subtitleBoUrl: a.subtitleBoUrl || '',
            description: a.description || '',
            objectives: a.objectives || [],
            keyPoints: a.keyPoints || [],
            isCompleted: !!a.isCompleted
          };
        });
        return {
          lessonId: l.lessonId || l.id || '',
          title: l.title || '',
          sortOrder: l.sortOrder != null ? l.sortOrder : 0,
          activities: activities
        };
      });
      return {
        unitId: u.unitId || u.id || '',
        title: u.title || '',
        sortOrder: u.sortOrder != null ? u.sortOrder : 0,
        lessons: lessons
      };
    });

    var progress = raw.progress || {};
    var normalizedProgress = {
      percent: progress.percent != null ? progress.percent : 0,
      completedActivities: progress.completedActivities || progress.completed || 0,
      totalActivities: progress.totalActivities || progress.total || 0
    };

    return {
      assignmentId: raw.assignmentId || raw.id || '',
      courseVersionId: raw.courseVersionId || raw.versionId || '',
      title: raw.title || '',
      description: raw.description || '',
      coverUrl: raw.coverUrl || raw.cover || '',
      teacher: raw.teacher || '',
      duration: raw.duration || 0,
      gradeBand: raw.gradeBand || '',
      capabilityTheme: raw.capabilityTheme || '',
      taskGroup: raw.taskGroup || '',
      culturalElements: raw.culturalElements || [],
      difficulty: raw.difficulty || '',
      tags: raw.tags || [],
      units: units,
      progress: normalizedProgress,
      submissionId: raw.submissionId || null,
      isFavorite: !!raw.isFavorite
    };
  }

  var adapter = {
    loadCourse: async function (assignmentId) {
      try {
        var resp = await Api.getStudentCourse(assignmentId);
        return _normalizeCourse(resp);
      } catch (err) {
        return _handleError(err);
      }
    },

    createSubmission: async function (assignmentId) {
      try {
        var resp = await Api.createOrResumeCourseSubmission(assignmentId);
        return {
          submissionId: resp.submissionId || resp.id || '',
          status: resp.status || ''
        };
      } catch (err) {
        return _handleError(err);
      }
    },

    saveActivityAttempt: async function (assignmentId, submissionId, activityId, payload) {
      try {
        var resp = await Api.saveCourseActivityAttempt(assignmentId, submissionId, activityId, payload);
        return {
          attemptId: resp.attemptId || resp.id || '',
          isCorrect: resp.isCorrect || false,
          feedback: resp.feedback || ''
        };
      } catch (err) {
        return _handleError(err);
      }
    },

    loadNotes: async function (assignmentId, activityId) {
      try {
        var resp = await Api.listStudentActivityNotes(activityId);
        var list = Array.isArray(resp) ? resp : (resp.items || resp.notes || []);
        return list.map(function (n) {
          return {
            noteId: n.noteId || n.id || '',
            content: n.content || '',
            videoTimestamp: n.videoTimestamp != null ? n.videoTimestamp : 0,
            revision: n.revision != null ? n.revision : 1,
            createdAt: n.createdAt || ''
          };
        });
      } catch (err) {
        return _handleError(err);
      }
    },

    createNote: async function (activityId, content, videoTimestamp) {
      try {
        return await Api.createStudentActivityNote(activityId, content, videoTimestamp);
      } catch (err) {
        return _handleError(err);
      }
    },

    updateNote: async function (activityId, noteId, content, videoTimestamp, revision) {
      try {
        return await Api.updateStudentActivityNote(activityId, noteId, content, videoTimestamp, revision);
      } catch (err) {
        return _handleError(err);
      }
    },

    deleteNote: async function (activityId, noteId) {
      try {
        return await Api.deleteStudentActivityNote(activityId, noteId);
      } catch (err) {
        return _handleError(err);
      }
    },

    toggleFavorite: async function (assignmentId, isFav) {
      try {
        if (isFav) {
          await Api.removeCourseFavorite(assignmentId);
        } else {
          await Api.addCourseFavorite(assignmentId);
        }
        return { isFavorite: !isFav };
      } catch (err) {
        return _handleError(err);
      }
    },

    loadRecommendations: async function (assignmentId) {
      try {
        var resp = await Api.getStudentRecommendationsForCourse(assignmentId);
        var list = Array.isArray(resp) ? resp : (resp.items || resp.recommendations || []);
        return list.map(function (r) {
          return {
            assignmentId: r.assignmentId || r.id || '',
            title: r.title || '',
            coverUrl: r.coverUrl || r.cover || '',
            teacher: r.teacher || '',
            duration: r.duration || 0
          };
        });
      } catch (err) {
        return _handleError(err);
      }
    },

    submitCourse: async function (assignmentId, submissionId) {
      try {
        return await Api.submitStudentCourse(assignmentId, submissionId, 1);
      } catch (err) {
        return _handleError(err);
      }
    },

    completePractice: async function (assignmentId, submissionId, activityId, attemptId) {
      try {
        return await Api.completeCoursePractice(assignmentId, submissionId, activityId, attemptId);
      } catch (err) {
        return _handleError(err);
      }
    },

    initRecording: async function (blob) {
      try {
        var resp = await Api.initSimpleRecording({
          mimeType: blob.type || 'audio/webm',
          idempotencyKey: 'oral-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
        });
        return {
          recordingId: resp.recordingId || resp.id || '',
          uploadUrl: resp.uploadUrl || ''
        };
      } catch (err) {
        return _handleError(err);
      }
    },

    uploadRecording: async function (uploadUrl, blob) {
      try {
        return await Api.uploadBlobToPresignedUrl(uploadUrl, blob);
      } catch (err) {
        return _handleError(err);
      }
    },

    completeRecording: async function (recordingId) {
      try {
        var resp = await Api.completeSimpleRecording(recordingId);
        return { recordingId: resp.recordingId || resp.id || recordingId };
      } catch (err) {
        return _handleError(err);
      }
    },

    linkRecording: async function (assignmentId, submissionId, activityId, recordingId) {
      try {
        return await Api.linkCourseRecording(assignmentId, submissionId, activityId, recordingId);
      } catch (err) {
        return _handleError(err);
      }
    },

    loadDashboard: async function () {
      try {
        var resp = await Api.getStudentCoursesDashboard();
        return {
          weeklyMinutes: resp.weeklyMinutes || 0,
          consecutiveDays: resp.consecutiveDays || 0,
          coursesLearned: resp.coursesLearned || 0,
          badgesEarned: resp.badgesEarned || 0
        };
      } catch (err) {
        return _handleError(err);
      }
    }
  };

  window.CourseApiAdapter = adapter;
})();
