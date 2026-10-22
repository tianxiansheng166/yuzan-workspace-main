(function (global) {
  "use strict";

  function unwrap(value) {
    return value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "data")
      ? value.data
      : value;
  }

  function finiteCount(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? Math.floor(value)
      : 0;
  }

  function validDate(value) {
    return Boolean(value && Number.isFinite(new Date(value).getTime()));
  }

  function formatDate(value) {
    if (!validDate(value)) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  }

  function withinCurrentWeek(value, now) {
    if (!validDate(value)) return false;
    var date = new Date(value);
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    return date >= start && date <= now;
  }

  function readIdentity(api) {
    var user = api.getStoredUser ? api.getStoredUser() || {} : {};
    return {
      hasToken: Boolean(api.getToken && api.getToken()),
      schoolId: api.getActiveSchoolId ? api.getActiveSchoolId() || "" : "",
      userId: user.id || user.userId || "",
    };
  }

  function sameIdentity(api, expected) {
    var current = readIdentity(api);
    return (
      current.hasToken &&
      current.schoolId === expected.schoolId &&
      (!expected.userId || current.userId === expected.userId)
    );
  }

  function fail(message) {
    var error = new Error(message);
    error.growthDataError = true;
    return error;
  }

  async function loadReports(api, history, identity, enrollmentId) {
    var candidates = history.sessions
      .filter(function (item) {
        return (
          item &&
          item.purpose === "STANDARD" &&
          typeof item.sessionId === "string" &&
          item.sessionId
        );
      })
      .slice(0, 8);

    var results = await Promise.all(
      candidates.map(async function (item) {
        try {
          var pair = await Promise.all([
            api.getAssessmentSession(item.sessionId),
            api.getAssessmentReport(item.sessionId),
          ]);
          var source = unwrap(pair[0]);
          var report = unwrap(pair[1]);
          var linked =
            source &&
            source.id === item.sessionId &&
            source.schoolId === identity.schoolId &&
            source.enrollmentId === enrollmentId &&
            source.purpose === "STANDARD" &&
            report &&
            typeof report.id === "string" &&
            report.id &&
            report.sessionId === source.id &&
            report.schoolId === identity.schoolId;
          var complete =
            linked &&
            source.status === "COMPLETED" &&
            validDate(source.completedAt) &&
            validDate(report.generatedAt) &&
            report.dataCompleteness === 100;
          var validScore =
            report &&
            (report.overallScore === null ||
              (typeof report.overallScore === "number" &&
                Number.isFinite(report.overallScore) &&
                report.overallScore >= 0 &&
                report.overallScore <= 100));
          if (!complete || !validScore) return null;
          return { source: source, report: report, history: item };
        } catch (error) {
          if (error && (error.status === 401 || error.status === 403))
            throw error;
          return null;
        }
      }),
    );

    return results.filter(Boolean).sort(function (left, right) {
      return (
        new Date(left.source.completedAt) - new Date(right.source.completedAt)
      );
    });
  }

  function makeJourney(profile, history, reports, events, progress, courseProgress) {
    var completedActivities = finiteCount(profile.completedActivities);
    var completedAttempts = history.sessions.length;
    var feedbackCount = events.filter(function (event) {
      return (
        event.type === "FEEDBACK" &&
        typeof event.description === "string" &&
        event.description.trim()
      );
    }).length;
    var remediationCount = Array.isArray(progress.remediation)
      ? progress.remediation.reduce(function (total, entry) {
          return (
            total + (Array.isArray(entry.rounds) ? entry.rounds.length : 0)
          );
        }, 0)
      : 0;
    var counts = [
      completedActivities,
      completedAttempts,
      reports.length,
      feedbackCount,
      remediationCount,
    ];
    var latestActive = -1;
    counts.forEach(function (count, index) {
      if (count > 0) latestActive = index;
    });

    var definitions = [
      ["course", "课程学习", "已完成课程活动"],
      ["task", "练习记录", "已完成练习或测评"],
      ["work", "正式测评", "已有完整正式报告"],
      ["feedback", "教师反馈", "已有已发布反馈"],
      ["retest", "专项巩固", "已有专项巩固记录"],
    ];
    var journey = definitions.map(function (definition, index) {
      var count = counts[index];
      var status =
        count > 0
          ? index === latestActive
            ? "current"
            : "complete"
          : "locked";
      var label = count > 0 ? "有记录" : "暂无记录";
      var evidence =
        count > 0
          ? definition[2] + " " + count + " 项。"
          : "当前学籍还没有可核实的" + definition[1] + "。";
      return {
        id: definition[0],
        title: definition[1],
        description:
          count > 0 ? definition[2] + " " + count + " 项" : "等待真实学习记录",
        status: status,
        progressLabel: label,
        progress: count,
        evidenceTitle: definition[1] + "情况",
        evidenceSummary: evidence,
      };
    });
    if (courseProgress.length > 0 && completedActivities === 0) {
      journey[0] = {
        id: "course",
        title: "课程学习",
        description: courseProgress.length + " 门课程安排，学习活动进度会在服务端确认后记录",
        status: "current",
        progressLabel: "课程安排",
        progress: courseProgress.length,
        evidenceTitle: "当前课程情况",
        evidenceSummary:
          "当前学籍有 " + courseProgress.length + " 门开放课程；已完成活动只按服务端确认的记录计数。",
      };
    }
    return journey;
  }

  function makeTrend(reports) {
    var scored = reports
      .filter(function (entry) {
        return (
          typeof entry.report.overallScore === "number" &&
          Number.isFinite(entry.report.overallScore) &&
          entry.report.overallScore >= 0 &&
          entry.report.overallScore <= 100
        );
      })
      .slice(-5);
    return scored.map(function (entry, index) {
      var previous = index > 0 ? scored[index - 1].report.overallScore : null;
      var score = entry.report.overallScore;
      var change =
        previous === null
          ? "首条可用正式结果"
          : score === previous
            ? "与上次持平"
            : (score > previous ? "较上次提高 " : "较上次下降 ") +
              Math.abs(score - previous) +
              " 分";
      var type =
        entry.source.type === "READING"
          ? "朗读"
          : entry.source.type === "WRITTEN"
            ? "书面"
            : "综合";
      return {
        id: entry.source.id,
        label: "第" + (index + 1) + "次",
        score: score,
        level: type + "测评",
        date: formatDate(entry.source.completedAt),
        stage: "正式测评",
        change: change,
        evidence: "正式报告 " + entry.report.id,
        journeyId: "work",
      };
    });
  }

  function makeFeedback(events) {
    var values = [];
    events.forEach(function (event) {
      var text =
        typeof event.description === "string" ? event.description.trim() : "";
      if (event.type === "FEEDBACK" && text && validDate(event.timestamp)) {
        values.push({ text: text, timestamp: event.timestamp });
      }
    });
    var unique = new Map();
    values
      .sort(function (left, right) {
        return new Date(right.timestamp) - new Date(left.timestamp);
      })
      .forEach(function (entry) {
        unique.set(entry.text, entry);
      });
    return Array.from(unique.values())
      .slice(0, 4)
      .map(function (entry) {
        return entry.text;
      });
  }

  function normalizeCourseProgress(value) {
    var source = Array.isArray(value)
      ? value
      : value && Array.isArray(value.courses)
        ? value.courses
        : [];
    return source
      .filter(function (course) {
        return course && typeof course.assignmentId === "string" && course.assignmentId;
      })
      .map(function (course) {
        var percent = Number(course.progressPercent);
        var status = typeof course.status === "string" ? course.status : "UNKNOWN";
        var cover = typeof course.coverAsset === "string" && course.coverAsset.startsWith("/") && !course.coverAsset.startsWith("//")
          ? course.coverAsset
          : "/assets/cover-spring.png";
        return {
          assignmentId: course.assignmentId,
          title: typeof course.title === "string" && course.title.trim() ? course.title.trim() : "课程学习",
          description: typeof course.description === "string" ? course.description : "",
          theme: typeof course.capabilityTheme === "string" ? course.capabilityTheme : "",
          coverAsset: cover,
          status: status,
          statusLabel: {
            NOT_STARTED: "待开始",
            IN_PROGRESS: "进行中",
            RESULT_PENDING: "结果处理中",
            COMPLETED: "已完成",
          }[status] || "状态待同步",
          progressPercent: Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0,
          nextActivity: course.nextActivity && typeof course.nextActivity.title === "string"
            ? course.nextActivity.title
            : "",
        };
      });
  }

  async function loadCourseProgress(api) {
    if (typeof api.listStudentCourses !== "function") return [];
    try {
      return normalizeCourseProgress(unwrap(await api.listStudentCourses({ limit: 100 })));
    } catch (error) {
      if (error && (error.status === 401 || error.status === 403)) throw error;
      return [];
    }
  }

  async function loadAudio(api, history, identity, enrollmentId) {
    if (!api.listMyAssessmentRecordings || !api.getRecordingEvidence) {
      return { audio: null, message: "当前版本没有可用的授权录音读取接口。" };
    }
    var archive;
    try {
      archive = unwrap(await api.listMyAssessmentRecordings());
    } catch (error) {
      if (error && (error.status === 401 || error.status === 403)) throw error;
      return { audio: null, message: "录音证据暂时无法读取。" };
    }
    var items = Array.isArray(archive)
      ? archive
      : archive && Array.isArray(archive.items)
        ? archive.items
        : [];
    var ownCompletedSessions = new Set(
      history.sessions.map(function (item) {
        return item.sessionId;
      }),
    );
    var candidate = items.find(function (item) {
      return (
        item &&
        item.recordingId &&
        ownCompletedSessions.has(item.sessionId) &&
        ["COMPLETE", "READY"].includes(item.recordingStatus) &&
        typeof item.durationMs === "number" &&
        Number.isFinite(item.durationMs) &&
        item.durationMs > 0
      );
    });
    if (!candidate) {
      return {
        audio: null,
        message: items.length
          ? "已找到录音记录，但当前没有可播放且已完成的音频。"
          : "当前学籍没有已完成的可播放录音。",
      };
    }
    try {
      var evidence = unwrap(
        await api.getRecordingEvidence(candidate.recordingId),
      );
      if (!sameIdentity(api, identity))
        throw fail("登录身份已变化，请重新读取成长记录。");
      if (
        !evidence ||
        evidence.id !== candidate.recordingId ||
        typeof evidence.downloadUrl !== "string" ||
        !evidence.downloadUrl
      ) {
        return { audio: null, message: "录音授权地址暂时不可用。" };
      }
      return {
        audio: {
          url: evidence.downloadUrl,
          title: candidate.label || "本人朗读录音",
          duration:
            evidence.durationMs > 0
              ? evidence.durationMs / 1000
              : candidate.durationMs / 1000,
          transcript: [],
          annotations: [],
        },
        message: "",
      };
    } catch (error) {
      if (error && (error.status === 401 || error.status === 403)) throw error;
      return { audio: null, message: "录音授权地址暂时不可用。" };
    }
  }

  async function loadData() {
    var api = global.YuzanApi;
    if (!api) throw fail("当前无法读取学习服务。");
    var identity = readIdentity(api);
    if (!identity.hasToken) {
      global.location.href = "/login/";
      return { state: "error" };
    }
    if (!identity.schoolId) {
      global.location.href = "/select-school/";
      return { state: "error" };
    }

    var values = await Promise.all([
      api.getStudentProfile(),
      api.getAssessmentHistory({ range: "all" }),
      api.getQuestionBankProgress(),
      api.listPractices({ sort: "RECOMMENDED" }).catch(function () {
        return { items: [] };
      }),
      loadCourseProgress(api),
    ]);
    var profileValue = unwrap(values[0]);
    var profile = (profileValue && profileValue.profile) || profileValue;
    var history = unwrap(values[1]);
    var progress = unwrap(values[2]);
    var practiceResult = unwrap(values[3]);
    var courseProgress = values[4];
    var enrollmentId = history && history.enrollmentId;

    if (
      !profile ||
      typeof profile.userId !== "string" ||
      !Array.isArray(history && history.sessions) ||
      !enrollmentId ||
      !progress ||
      progress.version !== "qb-progress-v1"
    ) {
      throw fail("成长数据响应不完整，暂时无法显示真实学习记录。");
    }
    if (identity.userId && identity.userId !== profile.userId)
      throw fail("登录身份已变化，请重新读取成长记录。");
    if (!sameIdentity(api, identity))
      throw fail("当前账号或学校已变化，请重新读取成长记录。");

    var eventResult = unwrap(
      await api.getAssessmentHistoryEvents(enrollmentId),
    );
    if (!Array.isArray(eventResult && eventResult.events))
      throw fail("教师反馈事件响应不可用。");
    var reports = await loadReports(api, history, identity, enrollmentId);
    if (!sameIdentity(api, identity))
      throw fail("当前账号或学校已变化，请重新读取成长记录。");
    var audioResult = await loadAudio(api, history, identity, enrollmentId);
    if (!sameIdentity(api, identity))
      throw fail("当前账号或学校已变化，请重新读取成长记录。");
    var events = eventResult.events.filter(function (event) {
      return event && typeof event.type === "string";
    });
    var latestReport = reports[reports.length - 1] || null;
    var latestEvent =
      events
        .filter(function (event) {
          return validDate(event.timestamp);
        })
        .sort(function (left, right) {
          return new Date(right.timestamp) - new Date(left.timestamp);
        })[0] || null;
    var latestAt = latestEvent && latestEvent.timestamp;
    if (
      latestReport &&
      (!latestAt ||
        new Date(latestReport.source.completedAt) > new Date(latestAt))
    ) {
      latestAt = latestReport.source.completedAt;
    }
    var weeklyCount = history.sessions.filter(function (item) {
      return withinCurrentWeek(item.completedAt, new Date());
    }).length;
    var practices = Array.isArray(practiceResult && practiceResult.items)
      ? practiceResult.items
      : [];
    var firstPractice =
      practices.find(function (item) {
        return item && typeof item.id === "string" && item.id;
      }) || null;
    var feedback = makeFeedback(events);
    var hasAnyRecord =
      history.sessions.length > 0 ||
      events.length > 0 ||
      finiteCount(profile.completedActivities) > 0 ||
      courseProgress.length > 0;
    var headline = latestReport
      ? "你已有 " + reports.length + " 份完整正式报告"
      : hasAnyRecord
        ? "你的学习记录正在累积"
        : "成长记录将汇集你的学习进展";
    var summary = latestReport
      ? "最近一次正式测评完成于 " +
        formatDate(latestReport.source.completedAt) +
        (typeof latestReport.report.overallScore === "number"
          ? "，得分 " + latestReport.report.overallScore + " 分。"
          : "，报告暂未提供总分。")
      : hasAnyRecord
        ? courseProgress.length
          ? "这里汇总当前学籍的课程安排与已确认学习进度；测评分数只在正式报告生成后显示。"
          : "页面只展示当前学籍中可以核实的课程活动、测评和已发布反馈。"
        : "完成课程、练习或正式测评后，真实记录会显示在这里。";

    var result = {
      state: hasAnyRecord ? "normal" : "empty",
      updatedAt: latestAt ? formatDate(latestAt) : "暂无学习记录",
      headline: headline,
      summary: summary,
      studentName: profile.displayName || "",
      currentStage: latestReport
        ? "正式测评"
        : feedback.length
          ? "教师反馈"
          : "课程学习",
      journey: makeJourney(profile, history, reports, events, progress, courseProgress),
      courseProgress: courseProgress,
      trend: makeTrend(reports),
      audio: audioResult.audio,
      audioMessage: audioResult.message,
      teacherFeedback: feedback,
      plan: {
        completedThisWeek: weeklyCount,
        practiceTitle: firstPractice ? firstPractice.title : "打开练习中心",
        practiceDescription: firstPractice
          ? firstPractice.summary || "当前学籍开放的真实练习。"
          : "当前没有可展示的开放练习；可在练习中心查看。",
        practiceHref: firstPractice
          ? "/student/practices/" + encodeURIComponent(firstPractice.id) + "/"
          : "/student/practices/",
      },
    };
    if (global.YuzanGrowthCourseProgress && typeof global.YuzanGrowthCourseProgress.render === "function") {
      global.YuzanGrowthCourseProgress.render(courseProgress);
    }
    return result;
  }

  async function load() {
    try {
      return await loadData();
    } catch (error) {
      if (error && error.status === 401) global.location.href = "/login/";
      if (error && error.status === 403)
        global.location.href = "/select-school/";
      return { state: "error" };
    }
  }

  global.YuzanGrowthData = { load: load, normalizeCourseProgress: normalizeCourseProgress };
})(window);
