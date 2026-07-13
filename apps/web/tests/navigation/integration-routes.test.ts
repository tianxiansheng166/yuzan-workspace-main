import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { roleNavigationGroups } from "../../app/features/role-navigation/role-navigation.config";
const readPage=(path:string)=>readFileSync(resolve(import.meta.dirname,"../../app",path),"utf8");
describe("integration entry points",()=>{
 it("default layout delegates navigation to AppShell",()=>expect(readPage("layouts/default.vue")).toContain("<AppShell>"));
 it("role navigation retains existing product areas",()=>{const links=roleNavigationGroups.flatMap(group=>group.items.map(item=>item.to));expect(links).toEqual(expect.arrayContaining(["/assessment","/student/today","/teacher","/teacher-tools","/products"]));});
 it("home retains public product links",()=>{const home=readPage("pages/index.vue");expect(home).toContain('to="/assessment"');expect(home).toContain('to="/teacher-tools"');expect(home).toContain('to="/products"');});
 it("student entry links courses, assessment and history",()=>{const source=readPage("pages/student/today.vue");expect(source).toContain('to="/student/courses"');expect(source).toContain('to="/assessment"');expect(source).toContain('to="/assessment/history"');});
 it("teacher entry links all core work areas",()=>{const source=readPage("pages/teacher/index.vue");for(const path of ["/teacher/classes","/teacher/assignments","/teacher/review","/reports","/teacher/assessments","/teacher-tools"]){expect(source).toContain(`to="${path}"`);}});
});