import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { SingleChoiceQuestion } from "~/features/exercises/index.js";
import { singleChoiceQuestion } from "./fixtures.js";

describe("SingleChoiceQuestion", () => {
  it("renders prompt and options with accessible roles", () => {
    const wrapper = mount(SingleChoiceQuestion, {
      props: { question: singleChoiceQuestion },
    });

    expect(wrapper.text()).toContain("请选择正确的声母");
    expect(wrapper.text()).toContain("b");
    expect(wrapper.text()).toContain("p");

    const radiogroup = wrapper.find('[role="radiogroup"]');
    expect(radiogroup.exists()).toBe(true);
    expect(radiogroup.attributes("aria-label")).toBe("请选择正确的声母");

    const radios = wrapper.findAll('[role="radio"]');
    expect(radios.length).toBe(2);
    radios.forEach((radio) => {
      expect(radio.attributes("tabindex")).toBe("0");
      expect(radio.attributes("aria-checked")).toBe("false");
    });
  });

  it("emits update:modelValue on click", async () => {
    const wrapper = mount(SingleChoiceQuestion, {
      props: { question: singleChoiceQuestion },
    });

    const options = wrapper.findAll('[role="radio"]');
    await options[0].trigger("click");

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([
      { kind: "SINGLE_CHOICE", optionId: "opt-a" },
    ]);
  });

  it("supports keyboard selection with Enter and Space", async () => {
    const wrapper = mount(SingleChoiceQuestion, {
      props: { question: singleChoiceQuestion },
    });

    const options = wrapper.findAll('[role="radio"]');
    await options[1].trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([
      { kind: "SINGLE_CHOICE", optionId: "opt-b" },
    ]);

    await options[0].trigger("keydown", { key: " " });
    expect(wrapper.emitted("update:modelValue")?.[1]).toEqual([
      { kind: "SINGLE_CHOICE", optionId: "opt-a" },
    ]);
  });

  it("does not emit when disabled or readonly", async () => {
    const wrapper = mount(SingleChoiceQuestion, {
      props: { question: singleChoiceQuestion, disabled: true, readOnly: true },
    });

    const options = wrapper.findAll('[role="radio"]');
    await options[0].trigger("click");
    await options[0].trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("reflects selected value with aria-checked", async () => {
    const wrapper = mount(SingleChoiceQuestion, {
      props: {
        question: singleChoiceQuestion,
        modelValue: { optionId: "opt-b" },
      },
    });

    const radios = wrapper.findAll('[role="radio"]');
    expect(radios[0].attributes("aria-checked")).toBe("false");
    expect(radios[1].attributes("aria-checked")).toBe("true");
  });
});
