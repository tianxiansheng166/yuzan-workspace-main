(function () {
  'use strict';

  var Api = window.YuzanApi;

  function _handleError(err) {
    var status = (err && err.status) || 0;
    var message = (err && err.message) || 'Unknown error';
    var code = (err && err.code) || '';

    if (status === 401) {
      window.location.href = '/login';
      message = message || '登录已过期';
      code = code || 'UNAUTHORIZED';
    }
    if (status === 403) {
      message = message || '无权访问当前课程';
      code = code || 'FORBIDDEN';
    }
    if (!status && err instanceof TypeError) {
      message = '网络连接失败，请检查网络后重试';
      code = code || 'NETWORK_ERROR';
    }
    var normalized = err instanceof Error ? err : new Error(message);
    normalized.message = message;
    normalized.status = status;
    normalized.code = code;
    throw normalized;
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
        submissionStatus: '',
        submissionRevision: null,
        isFavorite: false
      };
    }

    var assignment = raw.assignment || {};
    var course = raw.course || {};
    var courseVersion = raw.courseVersion || {};
    var existingSubmission = raw.existingSubmission || raw.submission || null;
    var practiceReferences = Array.isArray(raw.practiceReferences) ? raw.practiceReferences : [];
    var rawUnits = raw.units || [];
    var units = rawUnits.map(function (u) {
      var rawLessons = u.lessons || [];
      var lessons = rawLessons.map(function (l) {
        var rawActivities = l.activities || [];
        var activities = rawActivities.map(function (a) {
          var activityId = a.activityId || a.id || '';
          var practiceReference = a.practiceReference || practiceReferences.find(function (reference) {
            return reference.activityId === activityId;
          }) || null;
          var activityContent = a.content && typeof a.content === 'object' ? a.content : {};
          return {
            activityId: activityId,
            title: a.title || '',
            activityType: a.activityType || a.type || '',
            sortOrder: a.sortOrder != null ? a.sortOrder : 0,
            duration: a.duration || 0,
            videoUrl: a.videoUrl || '',
            posterUrl: a.posterUrl || '',
            subtitleZhUrl: a.subtitleZhUrl || '',
            subtitleBoUrl: a.subtitleBoUrl || '',
            description: a.description || activityContent.description || '',
            objectives: a.objectives || activityContent.objectives || [],
            keyPoints: a.keyPoints || activityContent.keyPoints || [],
            instruction: a.instruction || '',
            content: a.content || null,
            resources: Array.isArray(a.resources) ? a.resources : [],
            progress: a.progress || null,
            attempt: a.attempt || null,
            practiceReference: practiceReference,
            required: a.required !== false,
            completionRule: a.completionRule || null,
            studentNotes: a.studentNotes || null,
            personalNotes: Array.isArray(a.personalNotes) ? a.personalNotes : [],
            questions: a.questions || activityContent.questions || [],
            name: a.name || (practiceReference && practiceReference.title) || a.title || '',
            demoText: a.demoText || activityContent.demoText || activityContent.targetText || '',
            isCompleted: a.isCompleted === true || !!(a.progress && a.progress.completed)
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

    var progress = raw.studentProgress || raw.courseCompletion || raw.progress || {};
    var normalizedProgress = {
      percent: progress.progressPercent != null ? progress.progressPercent : (progress.percent != null ? progress.percent : 0),
      completedActivities: progress.completedRequiredCount != null ? progress.completedRequiredCount : (progress.completedActivities || progress.completed || 0),
      totalActivities: progress.requiredActivityCount != null ? progress.requiredActivityCount : (progress.totalActivities || progress.total || 0),
      attainmentStatus: progress.attainmentStatus || 'PENDING',
      requiredPracticeCount: progress.requiredPracticeCount || 0,
      completedPracticeCount: progress.completedPracticeCount || 0,
      completedActivityIds: progress.completedActivityIds || []
    };

    var cover = courseVersion.coverAsset || course.coverAsset || raw.coverUrl || raw.cover || '';
    if (cover && typeof cover === 'object') {
      cover = cover.url || cover.src || '';
    }
    return {
      assignmentId: assignment.id || raw.assignmentId || raw.id || '',
      courseVersionId: courseVersion.id || raw.courseVersionId || raw.versionId || '',
      courseId: course.id || '',
      title: courseVersion.title || assignment.title || course.title || raw.title || '',
      description: courseVersion.description || course.description || raw.description || '',
      coverUrl: cover,
      teacher: assignment.teacher || raw.teacher || '',
      duration: courseVersion.estimatedMinutes || raw.duration || 0,
      gradeBand: courseVersion.gradeBand || raw.gradeBand || '',
      capabilityTheme: courseVersion.capabilityTheme || raw.capabilityTheme || '',
      taskGroup: courseVersion.taskGroup || raw.taskGroup || '',
      culturalElements: courseVersion.culturalElements || raw.culturalElements || [],
      difficulty: courseVersion.difficulty || raw.difficulty || '',
      tags: courseVersion.tags || raw.tags || [],
      objectives: courseVersion.objectives || [],
      units: units,
      progress: normalizedProgress,
      submissionId: existingSubmission ? existingSubmission.id : (raw.submissionId || null),
      submissionStatus: existingSubmission ? existingSubmission.status : '',
      submissionRevision: existingSubmission && existingSubmission.revision != null ? existingSubmission.revision : null,
      existingSubmission: existingSubmission,
      practiceReferences: practiceReferences,
      isFavorite: !!raw.isFavorite
    };
  }

  function _safeCourseReturnTo(candidate) {
    if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) {
      throw new Error('returnTo must be a same-origin relative course path');
    }
    var parsed = new URL(candidate, window.location.origin);
    if (parsed.origin !== window.location.origin || !parsed.pathname.startsWith('/student/courses/course-detail/')) {
      throw new Error('returnTo must be a same-origin relative course path');
    }
    return parsed.pathname + parsed.search + parsed.hash;
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
        var submission = resp && resp.submission ? resp.submission : resp;
        var submissionId = submission && (submission.id || submission.submissionId);
        if (!submissionId) {
          throw new Error('课程 Submission 响应缺少 id');
        }
        return {
          id: submissionId,
          submissionId: submissionId,
          enrollmentId: submission.enrollmentId || resp.enrollmentId || '',
          status: submission.status || '',
          revision: submission.revision != null ? submission.revision : 0,
          resumed: !!(resp && resp.resumed)
        };
      } catch (err) {
        return _handleError(err);
      }
    },

    startCoursePractice: async function (options) {
      try {
        options = options || {};
        var assignmentId = options.assignmentId || '';
        var submissionId = options.submissionId || '';
        var activityId = options.activityId || '';
        var practiceDefinitionId = options.practiceDefinitionId || '';
        if (!assignmentId || !submissionId || !activityId) {
          throw new Error('课程练习必须同时包含 assignmentId、submissionId 和 activityId');
        }
        if (!practiceDefinitionId) {
          throw new Error('当前课程活动缺少 practiceDefinitionId');
        }
        var returnTo = _safeCourseReturnTo(options.returnTo);
        var resp = await Api.createOrResumePractice(practiceDefinitionId, {
          assignmentId: assignmentId,
          submissionId: submissionId,
          activityId: activityId
        });
        var attemptId = resp && (resp.attemptId || resp.id);
        if (!attemptId) {
          throw new Error('练习 Attempt 响应缺少 attemptId');
        }
        var context = {
          assignmentId: assignmentId,
          submissionId: submissionId,
          activityId: activityId,
          practiceDefinitionId: practiceDefinitionId,
          returnTo: returnTo,
          syncStatus: 'PENDING',
          createdAt: new Date().toISOString()
        };
        window.localStorage.setItem('yuzan-course-practice-context:' + attemptId, JSON.stringify(context));
        return {
          attemptId: attemptId,
          status: resp.status || '',
          resumed: !!resp.resumed,
          navigateTo: '/student/practices/attempts/' + encodeURIComponent(attemptId) + '/prepare/',
          context: context
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
          feedback: resp.feedback || '',
          attempt: resp.attempt || null,
          progress: resp.progress || null,
          courseCompletion: resp.courseCompletion || null
        };
      } catch (err) {
        if (err && err.status === 409) {
          var conflict = err instanceof Error ? err : new Error(err.message || '进度版本冲突');
          conflict.status = 409;
          conflict.code = 'REVISION_CONFLICT';
          throw conflict;
        }
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

    submitCourse: async function (assignmentId, submissionId, revision) {
      try {
        if (revision == null) throw new Error('课程提交缺少当前 revision');
        return await Api.submitStudentCourse(assignmentId, submissionId, revision);
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

    initRecording: async function (blob, context) {
      try {
        var req = {
          mimeType: blob.type || 'audio/webm',
          idempotencyKey: 'oral-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
        };
        if (context && context.enrollmentId) req.enrollmentId = context.enrollmentId;
        if (context && context.submissionId) req.submissionId = context.submissionId;
        var resp = await Api.initSimpleRecording(req);
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
