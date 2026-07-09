import { checkDemoSession } from "~/features/session/gateway";

/**
 * 游客页面中间件：已持有 demo session 时跳转会话页。
 *
 * 仅用于登录页等不希望已登录用户访问的页面，不全局生效。
 */
export default defineNuxtRouteMiddleware(async () => {
  const session = await checkDemoSession();

  if (session) {
    return navigateTo("/session", { replace: true });
  }
});
