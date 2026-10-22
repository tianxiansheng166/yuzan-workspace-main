(function (global) {
  "use strict";

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function courseHref(id) {
    return "/student/courses/course-detail/?id=" + encodeURIComponent(id);
  }

  function render(courses) {
    var root = document.getElementById("root");
    if (!root || !Array.isArray(courses)) return;
    var old = document.getElementById("growth-course-progress");
    if (old) old.remove();
    if (!courses.length) return;

    var section = element("section", "growth-course-progress");
    section.id = "growth-course-progress";
    var heading = element("div", "growth-course-progress-heading");
    var copy = element("div");
    copy.append(element("p", "growth-course-progress-kicker", "CURRENT LEARNING"));
    copy.append(element("h2", "", "当前课程进度"));
    copy.append(element("p", "growth-course-progress-subtitle", "来自当前学校的课程安排与服务端进度"));
    heading.append(copy);
    var count = element("span", "growth-course-count", courses.length + " 门课程");
    heading.append(count);
    section.append(heading);

    var grid = element("div", "growth-course-grid");
    courses.forEach(function (course) {
      var card = element("a", "growth-course-card");
      card.href = courseHref(course.assignmentId);
      var cover = element("div", "growth-course-cover");
      var image = element("img", "", "");
      image.src = global.YuzanVisualAssets && typeof global.YuzanVisualAssets.courseCover === "function"
        ? global.YuzanVisualAssets.courseCover(course)
        : course.coverAsset;
      image.alt = course.title + "课程封面";
      image.loading = "lazy";
      image.addEventListener("error", function () {
        image.src = "/assets/generated-covers/course-spring-reading.png";
      }, { once: true });
      cover.append(image);
      cover.append(element("span", "growth-course-status", course.statusLabel));

      var details = element("div", "growth-course-details");
      if (course.theme) details.append(element("span", "growth-course-theme", course.theme));
      details.append(element("h3", "", course.title));
      if (course.description) details.append(element("p", "growth-course-description", course.description));
      if (course.nextActivity) details.append(element("p", "growth-course-next", "下一步：" + course.nextActivity));
      var progressCopy = element("div", "growth-course-progress-copy");
      progressCopy.append(element("span", "", "课程进度"));
      progressCopy.append(element("strong", "", course.progressPercent + "%"));
      details.append(progressCopy);
      var track = element("div", "growth-course-track");
      var fill = element("span", "", "");
      fill.style.width = course.progressPercent + "%";
      track.append(fill);
      details.append(track);
      card.append(cover, details);
      grid.append(card);
    });
    section.append(grid);
    var link = element("a", "growth-course-all", "查看全部课程 →");
    link.href = "/student/courses/";
    section.append(link);
    root.prepend(section);
  }

  global.YuzanGrowthCourseProgress = { render: render };
})(window);
