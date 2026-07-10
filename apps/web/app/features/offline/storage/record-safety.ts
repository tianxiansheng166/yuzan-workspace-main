import { SENSITIVE_FIELD_PATTERN } from "../constants";

function walkValue(value: unknown, visit: (segment: string) => void) {
  if (typeof value === "string") {
    visit(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => walkValue(item, visit));
    return;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, nestedValue]) => {
      visit(key);
      walkValue(nestedValue, visit);
    });
  }
}

export function assertOfflineValueIsNonSensitive(value: unknown) {
  let matchedSegment: string | undefined;

  walkValue(value, (segment) => {
    if (!matchedSegment && SENSITIVE_FIELD_PATTERN.test(segment)) {
      matchedSegment = segment;
    }
  });

  if (matchedSegment) {
    throw new Error(
      `Sensitive data is not allowed in offline storage: ${matchedSegment}`,
    );
  }
}
