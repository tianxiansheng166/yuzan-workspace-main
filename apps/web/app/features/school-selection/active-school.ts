import { createSafeStorage } from "~/features/auth/utils/storage";
import type { ActiveSchoolContext } from "./types";

export const ACTIVE_SCHOOL_KEY = "yuzan.school.active";

export function createActiveSchoolStore() {
  const storage = createSafeStorage();
  return {
    read(): ActiveSchoolContext | null {
      const raw = storage.getItem(ACTIVE_SCHOOL_KEY);
      if (!raw) return null;
      try {
        const value = JSON.parse(raw) as Partial<ActiveSchoolContext>;
        if (
          !value.schoolId ||
          !value.schoolName ||
          !value.role ||
          !value.selectedAt
        )
          return null;
        return value as ActiveSchoolContext;
      } catch {
        return null;
      }
    },
    write(context: ActiveSchoolContext) {
      storage.setItem(ACTIVE_SCHOOL_KEY, JSON.stringify(context));
    },
    clear() {
      storage.removeItem(ACTIVE_SCHOOL_KEY);
    },
  };
}
