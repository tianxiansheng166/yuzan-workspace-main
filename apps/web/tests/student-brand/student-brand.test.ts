import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { studentActionCards,studentStatusCopy } from "../../app/features/student-brand/student-brand-content";
describe("student brand content",()=>{
 it("keeps existing assessment status copy truthful",()=>{expect(studentActionCards).toHaveLength(3);expect(studentActionCards.find(card=>card.id==="recommended-course")?.availabilityNote).toContain("不伪造");});
 it("describes all preview states",()=>{expect(studentStatusCopy("preview").description).toContain("真实任务");expect(studentStatusCopy("offline").description).toContain("同步");});
 it("renders today from live tasks with explicit gaps",()=>{const page=readFileSync(resolve(import.meta.dirname,"../../app/pages/student/today.vue"),"utf8");expect(page).toContain("listLearningTasks");expect(page).toContain("pending / unavailable");expect(page).toContain("不伪装正式学习成果");});
});