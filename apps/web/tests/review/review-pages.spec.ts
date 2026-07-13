import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const pages=join(dirname(fileURLToPath(import.meta.url)),"../../app/pages/teacher/review");const read=(path:string)=>readFileSync(join(pages,path),"utf8");
describe("submission review pages",()=>{
 it("list has live loading, empty and mapped error states",()=>{const source=read("index.vue");expect(source).toContain("state==='loading'");expect(source).toContain("state==='empty'");expect(source).toContain("state==='error'");expect(source).toContain("describeLiveFailure");});
 it("queries submissions by a real assignment",()=>{const source=read("index.vue");expect(source).toContain("listAssignmentSubmissions");expect(source).toContain("selected");expect(source).toContain("没有 demo 提交队列");});
 it("publishes feedback only through the live gateway",()=>{const source=read("index.vue");expect(source).toContain("createFeedback");expect(source).toContain("已由服务器发布");expect(source).toContain("NEEDS_REVIEW");});
 it("retains detailed evidence and feedback routes",()=>{expect(read("[submissionId]/index.vue")).toContain("route.params.submissionId");expect(read("[submissionId]/feedback.vue")).toContain("提交反馈");});
 it("does not access browser-only storage",()=>{const source=[read("index.vue"),read("[submissionId]/index.vue"),read("[submissionId]/feedback.vue")].join("\n");expect(source).not.toContain("window.");expect(source).not.toContain("localStorage");});
});