import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { describe, expect, it } from "vitest";

import { YxButton, YxInput, YxLink, YxStatus } from "@yuzan/ui";

async function renderComponent(
  render: () => ReturnType<typeof h>,
): Promise<string> {
  return renderToString(
    createSSRApp(
      defineComponent({
        render,
      }),
    ),
  );
}

describe("public UI exports", () => {
  it("exposes the base primitives from @yuzan/ui", () => {
    expect(YxButton).toBeTruthy();
    expect(YxInput).toBeTruthy();
    expect(YxLink).toBeTruthy();
    expect(YxStatus).toBeTruthy();
  });
});

describe("YxButton SSR contract", () => {
  it("renders loading and disabled semantics through the public API", async () => {
    const html = await renderComponent(() =>
      h(
        YxButton,
        {
          type: "reset",
          loading: true,
          loadingLabel: "保存中",
        },
        () => "同步作业",
      ),
    );

    expect(html).toContain("<button");
    expect(html).toContain('type="reset"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("同步作业");
    expect(html).toContain("保存中");
  });

  it("supports button, submit, and reset types", async () => {
    const html = await renderComponent(() =>
      h("div", [
        h(YxButton, { type: "button" }, () => "button"),
        h(YxButton, { type: "submit" }, () => "submit"),
        h(YxButton, { type: "reset" }, () => "reset"),
      ]),
    );

    expect(html).toContain('type="button"');
    expect(html).toContain('type="submit"');
    expect(html).toContain('type="reset"');
  });
});

describe("YxInput SSR contract", () => {
  it("keeps label, description, error, and native attributes wired together", async () => {
    const html = await renderComponent(() =>
      h(YxInput, {
        label: "练习标题",
        modelValue: "朗读第五课",
        description: "供教师与学生识别当前任务。",
        error: "标题至少需要两个字符。",
        required: true,
        disabled: true,
        readonly: true,
      }),
    );

    const labelFor = html.match(/<label[^>]*\sfor="([^"]+)"/)?.[1];
    const inputId = html.match(/<input[^>]*\sid="([^"]+)"/)?.[1];
    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1] ?? "";

    expect(labelFor).toBeTruthy();
    expect(inputId).toBeTruthy();
    expect(labelFor).toBe(inputId);
    expect(describedBy).toContain(`${inputId}-description`);
    expect(describedBy).toContain(`${inputId}-error`);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("required");
    expect(html).toContain("disabled");
    expect(html).toContain("readonly");
    expect(html).toContain('role="alert"');
  });

  it("generates unique ids when multiple instances omit an explicit id", async () => {
    const html = await renderComponent(() =>
      h("div", [
        h(YxInput, { label: "输入一", modelValue: "甲" }),
        h(YxInput, { label: "输入二", modelValue: "乙" }),
      ]),
    );

    const ids = [...html.matchAll(/<input[^>]*\sid="([^"]+)"/g)].map(
      ([, id]) => id,
    );

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("YxLink SSR contract", () => {
  it("stays a native anchor and preserves explicit external link attributes", async () => {
    const html = await renderComponent(() =>
      h(
        YxLink,
        {
          href: "https://example.com/resource",
          target: "_blank",
          rel: "noopener noreferrer",
          tone: "accent",
        },
        () => "查看资源",
      ),
    );

    expect(html).toContain("<a");
    expect(html).toContain('href="https://example.com/resource"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("<button");
  });
});

describe("YxStatus SSR contract", () => {
  it("renders semantic state data without assertive live-region semantics", async () => {
    const html = await renderComponent(() =>
      h(YxStatus, { tone: "danger" }, () => "提交失败"),
    );

    expect(html).toContain("<span");
    expect(html).toContain('data-tone="danger"');
    expect(html).toContain("提交失败");
    expect(html).not.toContain('role="alert"');
  });
});
