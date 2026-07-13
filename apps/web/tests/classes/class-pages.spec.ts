import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const pagesDir=join(dirname(fileURLToPath(import.meta.url)),"../../app/pages/teacher/classes");
const readPage=(path:string)=>readFileSync(join(pagesDir,path),"utf8");
describe("class pages",()=>{
  it("list renders live loading, empty and error states",()=>{const source=readPage("index.vue");expect(source).toContain("state==='loading'");expect(source).toContain('"ready" : "empty"');expect(source).toContain("state==='error'");expect(source).toContain("describeLiveFailure");});
  it("gates class creation by server role",()=>{const source=readPage("index.vue");expect(source).toContain("canCreate");expect(source).toContain('context.value?.role === "SCHOOL_ADMIN"');expect(source).toContain("当前角色不可创建班级");});
  it("requires a real term id and never hardcodes one",()=>{const source=readPage("index.vue");expect(source).toContain("termId");expect(source).toContain("不会代填固定学期");expect(source).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);});
  it("keeps the existing detail boundary",()=>{const source=readPage("[classId]/index.vue");expect(source).toContain("route.params.classId");expect(source).toContain("unavailable");});
  it("has mobile and keyboard guardrails",()=>{const source=readPage("index.vue");expect(source).toContain("@media(max-width:");expect(source).toContain("focus-visible");});
});