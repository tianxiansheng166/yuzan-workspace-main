import {
  firstQueryValue,
  sanitizeInternalRedirect,
} from "../features/auth/utils/redirect";

export default defineNuxtRouteMiddleware((to) => {
  const redirect = firstQueryValue(to.query.redirect);

  if (!redirect) {
    return;
  }

  if (sanitizeInternalRedirect(redirect) === redirect) {
    return;
  }

  const nextQuery = { ...to.query };
  delete nextQuery.redirect;

  return navigateTo(
    {
      path: to.path,
      query: nextQuery,
    },
    {
      replace: true,
    },
  );
});
