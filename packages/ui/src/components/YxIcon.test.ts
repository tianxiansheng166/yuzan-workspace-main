import { describe, expect, it } from "vitest";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { ICON_NAMES } from "../icon-types";
import YxIcon from "./YxIcon.vue";

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

describe("YxIcon", () => {
  it("renders a known icon", async () => {
    const html = await renderComponent(() => h(YxIcon, { name: "success" }));

    expect(html).toContain("<svg");
    expect(html).toContain("<path");
  });

  it("supports custom size", async () => {
    const html = await renderComponent(() =>
      h(YxIcon, { name: "warning", size: 32 }),
    );

    expect(html).toContain('width="32px"');
    expect(html).toContain('height="32px"');
  });

  it("supports string size", async () => {
    const html = await renderComponent(() =>
      h(YxIcon, { name: "warning", size: "1.5rem" }),
    );

    expect(html).toContain('width="1.5rem"');
    expect(html).toContain('height="1.5rem"');
  });

  it("exposes a title for accessible names", async () => {
    const html = await renderComponent(() =>
      h(YxIcon, { name: "copy", title: "复制链接" }),
    );

    expect(html).toContain("复制链接");
    expect(html).toContain('role="img"');
    expect(html).not.toContain('aria-hidden="true"');
  });

  it("can be aria-hidden for decorative use", async () => {
    const html = await renderComponent(() =>
      h(YxIcon, { name: "settings", ariaHidden: true }),
    );

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<title>");
  });

  it("falls back safely for unknown icon names at runtime", async () => {
    const html = await renderComponent(() =>
      h(YxIcon, { name: "not-an-icon" as "settings" }),
    );

    expect(html).toContain("<svg");
    expect(html).toContain("<path");
  });

  it("renders every registered icon", async () => {
    for (const name of ICON_NAMES) {
      const html = await renderComponent(() => h(YxIcon, { name }));
      expect(html, `${name} should render`).toContain("<svg");
      expect(html, `${name} should render paths`).toContain("<path");
    }
  });
});
