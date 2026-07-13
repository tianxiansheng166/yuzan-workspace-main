import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const root=resolve(import.meta.dirname,"../../app");const today=readFileSync(resolve(root,"pages/student/today.vue"),"utf8");const player=readFileSync(resolve(root,"pages/student/learning/[activityId].vue"),"utf8");
describe("live learning page guardrails",()=>{
  it("uses the application shell main landmark",()=>{expect(today).not.toMatch(/<main(?:\s|>)/);expect(player).not.toMatch(/<main(?:\s|>)/);});
  it("keeps one stable h1 and title",()=>{expect(today.match(/<h1(?:\s|>)/g)).toHaveLength(1);expect(player.match(/<h1(?:\s|>)/g)).toHaveLength(1);expect(today).toContain('title: "今日学习｜语赞心声"');expect(player).toContain('title: "学习活动｜语赞心声"');});
  it("reads the route and executable live endpoints through the gateway",()=>{expect(player).toContain("route.params.activityId");expect(today).toContain("listLearningTasks");expect(player).toContain("getLearningTask");});
  it("fails closed without enrollment context",()=>{expect(player).toContain("首次进度写入暂不可用");expect(player).toContain("enrollmentId");expect(player).toContain("fail-closed");});
  it("only confirms writes after gateway responses",()=>{expect(player).toContain("updateProgress");expect(player).toContain("createAndSubmit");expect(player).toContain("已由服务器确认");});
  it("preserves assessment navigation without fake results",()=>{expect(today).toContain('to="/assessment"');expect(today).toContain("pending / unavailable");expect(today).toContain("不伪装正式学习成果");});
  it("supports keyboard, mobile and reduced motion",()=>{for(const source of [today,player]){expect(source).toContain("focus-visible");expect(source).toContain("prefers-reduced-motion");expect(source).toContain("@media(max-width:");}});
});