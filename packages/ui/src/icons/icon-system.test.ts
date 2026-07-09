import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { describe, expect, it } from "vitest";

import YxIconBase from "./YxIconBase.vue";
import YxIconHome from "./YxIconHome.vue";
import YxIconPath from "./YxIconPath.vue";
import YxIconAssessment from "./YxIconAssessment.vue";
import YxIconRecord from "./YxIconRecord.vue";
import YxIconPractice from "./YxIconPractice.vue";
import YxIconReport from "./YxIconReport.vue";
import YxIconHistory from "./YxIconHistory.vue";
import YxIconTask from "./YxIconTask.vue";
import YxIconClass from "./YxIconClass.vue";
import YxIconCourse from "./YxIconCourse.vue";
import YxIconTranslate from "./YxIconTranslate.vue";
import YxIconTraining from "./YxIconTraining.vue";
import YxIconSettings from "./YxIconSettings.vue";
import YxIconStatus from "./YxIconStatus.vue";
import YxIconSuccess from "./YxIconSuccess.vue";
import YxIconWarning from "./YxIconWarning.vue";
import YxIconDanger from "./YxIconDanger.vue";
import YxIconInformation from "./YxIconInformation.vue";

const icons = [
  YxIconHome,
  YxIconPath,
  YxIconAssessment,
  YxIconRecord,
  YxIconPractice,
  YxIconReport,
  YxIconHistory,
  YxIconTask,
  YxIconClass,
  YxIconCourse,
  YxIconTranslate,
  YxIconTraining,
  YxIconSettings,
  YxIconStatus,
  YxIconSuccess,
  YxIconWarning,
  YxIconDanger,
  YxIconInformation,
];

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

describe("icon system base contract", () => {
  it("renders a base svg with the shared geometric rules", async () => {
    const html = await renderComponent(() => h(YxIconBase));

    expect(html).toContain("<svg");
    expect(html).toMatch(/viewbox="0 0 24 24"/i);
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="2"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain('stroke-linejoin="round"');
    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');
  });

  it("hides decorative icons from assistive technologies by default", async () => {
    const html = await renderComponent(() => h(YxIconHome));

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain("<title>");
  });

  it("exposes semantic information when a title is provided", async () => {
    const html = await renderComponent(() =>
      h(YxIconHome, { title: "返回首页" }),
    );

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="返回首页"');
    expect(html).toContain("<title>返回首页</title>");
    expect(html).not.toContain('aria-hidden="true"');
  });

  it("supports numeric and string size props", async () => {
    const numeric = await renderComponent(() => h(YxIconHome, { size: 32 }));
    const string = await renderComponent(() =>
      h(YxIconHome, { size: "1.5em" }),
    );

    expect(numeric).toContain('width="32"');
    expect(numeric).toContain('height="32"');
    expect(string).toContain('width="1.5em"');
    expect(string).toContain('height="1.5em"');
  });
});

describe("icon set coverage", () => {
  it.each(icons)("renders an svg for each icon component", async (icon) => {
    const html = await renderComponent(() => h(icon));

    expect(html).toContain("<svg");
    expect(html).toContain('stroke="currentColor"');
  });
});
