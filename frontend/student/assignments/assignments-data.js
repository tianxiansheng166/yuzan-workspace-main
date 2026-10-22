(function (global) {
  "use strict";

  var STATUS_LABELS = {
    NOT_STARTED: "待开始",
    IN_PROGRESS: "进行中",
    RESULT_PENDING: "结果处理中",
    COMPLETED: "已完成",
  };

  function safeCover(value) {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
      return "/assets/cover-spring.png";
    }
    return value;
  }

  function normalize(payload) {
    var rows = Array.isArray(payload && payload.courses)
      ? payload.courses
      : Array.isArray(payload)
        ? payload
        : [];
    return rows
      .filter(function (course) {
        return course && typeof course.assignmentId === "string" && course.assignmentId;
      })
      .map(function (course) {
        var status = STATUS_LABELS[course.status] ? course.status : "NOT_STARTED";
        var percent = Number(course.progressPercent);
        percent = Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0;
        return {
          assignmentId: course.assignmentId,
          title: typeof course.title === "string" && course.title.trim() ? course.title.trim() : "课程任务",
          description: typeof course.description === "string" ? course.description : "",
          theme: typeof course.capabilityTheme === "string" ? course.capabilityTheme : "课程学习",
          gradeBand: typeof course.gradeBand === "string" ? course.gradeBand : "",
          estimatedMinutes: Number.isFinite(Number(course.estimatedMinutes)) ? Number(course.estimatedMinutes) : null,
          coverAsset: safeCover(course.coverAsset),
          status: status,
          statusLabel: STATUS_LABELS[status],
          progressPercent: percent,
          nextActivity: course.nextActivity && typeof course.nextActivity.title === "string"
            ? course.nextActivity.title
            : "",
        };
      });
  }

  function filter(courses, status, query) {
    var needle = String(query || "").trim().toLocaleLowerCase();
    return (Array.isArray(courses) ? courses : []).filter(function (course) {
      var matchesStatus = status === "ALL" ||
        (status === "IN_PROGRESS" && ["IN_PROGRESS", "RESULT_PENDING"].includes(course.status)) ||
        course.status === status;
      var text = [course.title, course.description, course.theme].join(" ").toLocaleLowerCase();
      return matchesStatus && (!needle || text.includes(needle));
    });
  }

  function detailHref(assignmentId) {
    return "/student/courses/course-detail/?id=" + encodeURIComponent(assignmentId);
  }

  global.YuzanAssignmentsData = {
    filter: filter,
    normalize: normalize,
    detailHref: detailHref,
    statusLabels: STATUS_LABELS,
  };
})(window);
