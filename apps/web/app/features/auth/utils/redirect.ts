import type { UserRole } from "../models";

export function firstQueryValue(
  value: string | null | (string | null)[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

export function sanitizeInternalRedirect(
  input: string | undefined,
): string | undefined {
  if (!input) {
    return undefined;
  }

  const value = input.trim();

  if (!value.startsWith("/")) {
    return undefined;
  }

  if (value.startsWith("//")) {
    return undefined;
  }

  const lowerCaseValue = value.toLowerCase();

  if (
    lowerCaseValue.startsWith("/http:") ||
    lowerCaseValue.startsWith("/https:") ||
    lowerCaseValue.startsWith("/javascript:")
  ) {
    return undefined;
  }

  return value;
}

export function resolvePostLoginRedirect(
  _role: UserRole,
  redirectTo: string | undefined,
): string {
  return sanitizeInternalRedirect(redirectTo) ?? "/select-school";
}
