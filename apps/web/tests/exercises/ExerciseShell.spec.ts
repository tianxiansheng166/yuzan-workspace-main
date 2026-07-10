import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { ExerciseShell } from "~/features/exercises/index.js";
import { exerciseFixture } from "./fixtures.js";

describe("ExerciseShell", () => {
  it("renders title, notes, and question list", () => {
    const wrapper = mount(ExerciseShell, {
      props: { exercise: exerciseFixture },
    });

    expect(wrapper.find("[id='exercise-title']").text()).toBe(
      "第一单元综合练习",
    );
    expect(wrapper.text()).toContain("请认真审题");
    const questions = wrapper.findAll(".question-card");
    expect(questions.length).toBe(exerciseFixture.questions.length);
  });

  it("disables submit when no answers are present", () => {
    const wrapper = mount(ExerciseShell, {
      props: { exercise: exerciseFixture },
    });

    const submitButton = wrapper.find('button[type="submit"]');
    expect(submitButton.attributes("disabled")).toBeDefined();
  });

  it("emits submit when form is submitted with answers", async () => {
    const wrapper = mount(ExerciseShell, {
      props: {
        exercise: exerciseFixture,
        draftAnswers: {
          "q-single": { kind: "SINGLE_CHOICE", optionId: "opt-a" },
        },
      },
    });

    const submitButton = wrapper.find('button[type="submit"]');
    expect(submitButton.attributes("disabled")).toBeUndefined();

    await wrapper.find("form").trigger("submit");
    expect(wrapper.emitted("submit")?.length).toBe(1);
  });

  it("shows error alert and retry button", async () => {
    const wrapper = mount(ExerciseShell, {
      props: {
        exercise: { ...exerciseFixture, canStart: false, reason: "任务已截止" },
        error: "网络异常，请重试",
      },
    });

    const alert = wrapper.find('[role="alert"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("网络异常，请重试");

    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("retry")?.length).toBe(1);
  });

  it("shows offline status tone", () => {
    const wrapper = mount(ExerciseShell, {
      props: { exercise: exerciseFixture, offline: true },
    });

    expect(wrapper.text()).toContain("离线模式：答案已保存在本地");
  });

  it("shows graded result summary", () => {
    const wrapper = mount(ExerciseShell, {
      props: {
        exercise: exerciseFixture,
        result: {
          attemptId: "att-1",
          assignmentId: "asn-1",
          activityId: "act-1",
          attemptNo: 1,
          status: "GRADED",
          answers: {},
          autoResult: { score: 4, maxScore: 6, details: [] },
          questions: [],
          answerKeyVisible: true,
          submittedAt: "2026-07-10T00:00:00Z",
        },
      },
    });

    expect(wrapper.text()).toContain("得分 4 / 6");
    expect(wrapper.text()).toContain("已提交并自动评分");
  });

  it("shows needs-review status for manual grading", () => {
    const wrapper = mount(ExerciseShell, {
      props: {
        exercise: exerciseFixture,
        result: {
          attemptId: "att-1",
          assignmentId: "asn-1",
          activityId: "act-1",
          attemptNo: 1,
          status: "NEEDS_REVIEW",
          answers: {},
          questions: [],
          answerKeyVisible: false,
          submittedAt: "2026-07-10T00:00:00Z",
        },
      },
    });

    expect(wrapper.text()).toContain("已提交，等待人工复核");
  });
});
