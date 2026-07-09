import { checkDemoSession } from "~/features/session/gateway";

/**
 * 受保护页面的 demo session 校验中间件。
 *
 * 仅在页面显式引用时生效，不会全局拦截；服务端安全，不访问 storage。
 * 若 demo session 不存在或已过期，则重定向到登录页。
 */
export default defineNuxtRouteMiddleware(async () => {
  const session = await checkDemoSession();

  if (!session) {
    return navigateTo("/login", { replace: true });
  }
});
