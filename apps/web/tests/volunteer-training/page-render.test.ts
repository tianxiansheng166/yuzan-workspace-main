import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readPage = (relativePath: string) =>
  readFileSync(
    resolve(import.meta.dirname, "../../app", relativePath),
    "utf-8",
  );

describe("volunteer training page", () => {
  it("imports VolunteerTraining explicitly so the page does not render blank", () => {
    const page = readPage("pages/training/volunteer.vue");

    expect(page).toContain("import VolunteerTraining");
    expect(page).toContain("<VolunteerTraining />");
  });

  it("keeps demo content, localStorage progress and pending certificate labels", () => {
    const component = readPage(
      "features/volunteer-training/components/VolunteerTraining.vue",
    );

    expect(component).toContain("志愿者培训");
    expect(component).toContain("培训证书");
    expect(component).toContain("证书功能待接入");
    expect(component).toContain("reset-progress");
  });
});
