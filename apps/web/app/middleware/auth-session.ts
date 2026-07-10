export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthSession();
  const session = await auth.restore();
  if (!session) {
    return navigateTo({ path: "/login", query: { redirect: to.fullPath } });
  }
  if (session.memberships.length > 1 && to.path !== "/select-school") {
    return navigateTo("/select-school");
  }
});
