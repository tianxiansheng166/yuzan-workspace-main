import { describe, it, expect } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import { MultipleChoiceQuestion } from "~/features/exercises/index.js";
import { multipleChoiceQuestion } from "./fixtures.js";

describe("MultipleChoiceQuestion", () => {
  it("renders checkboxes with aria-checked", () => {
    const wrapper = mount(MultipleChoiceQuestion, {
      props: { question: multipleChoiceQuestion },
    });

    const checkboxes = wrapper.findAll('[role="checkbox"]');
    expect(checkboxes.length).toBe(3);
    checkboxes.forEach((box) => {
      expect(box.attributes("aria-checked")).toBe("false");
      expect(box.attributes("tabindex")).toBe("0");
    });
  });

  it("toggles selection and emits combined option ids", async () => {
    const modelValue = ref<{ optionIds: string[] }>({ optionIds: [] });
    const wrapper = mount(MultipleChoiceQuestion, {
      props: {
        question: multipleChoiceQuestion,
        modelValue: modelValue.value,
        "onUpdate:modelValue": (value) => {
          modelValue.value = value as { optionIds: string[] };
          wrapper.setProps({ modelValue: modelValue.value });
        },
      },
    });

    const checkboxes = wrapper.findAll('[role="checkbox"]');
    await checkboxes[0].trigger("click");
    await checkboxes[2].trigger("click");

    const events = wrapper.emitted("update:modelValue");
    expect(events?.[0]).toEqual([
      { kind: "MULTIPLE_CHOICE", optionIds: ["opt-an"] },
    ]);
    expect(events?.[1]).toEqual([
      { kind: "MULTIPLE_CHOICE", optionIds: ["opt-an", "opt-en"] },
    ]);
  });

  it("supports keyboard toggle", async () => {
    const wrapper = mount(MultipleChoiceQuestion, {
      props: { question: multipleChoiceQuestion },
    });

    await wrapper.findAll('[role="checkbox"]')[1].trigger("keydown", {
      key: " ",
    });

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([
      { kind: "MULTIPLE_CHOICE", optionIds: ["opt-ang"] },
    ]);
  });
});
