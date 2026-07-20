import type {
  AssessmentMode,
  AssessmentReport,
  ReadingAttemptMeta,
  WrittenDraft,
} from "./assessment-types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const reportStoreKey = "assessment:student:reports";
const readingAttemptKey = "assessment:student:reading-attempt";
const writtenDraftKeyPrefix = "assessment:student:written-draft:";

export function createMemoryStorage(
  seed: Record<string, string> = {},
): StorageLike & { dump(): Record<string, string> } {
  const data = { ...seed };

  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key)
        ? data[key]!
        : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      delete data[key];
    },
    dump() {
      return { ...data };
    },
  };
}

export function getBrowserLocalStorage(): StorageLike | null {
  return import.meta.client ? window.localStorage : null;
}

export function getBrowserSessionStorage(): StorageLike | null {
  return import.meta.client ? window.sessionStorage : null;
}

function readJson<T>(storage: StorageLike | null, key: string, fallback: T): T {
  if (!storage) {
    return fallback;
  }

  try {
    const value = storage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage: StorageLike | null, key: string, value: unknown) {
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

function sortReports(reports: AssessmentReport[]): AssessmentReport[] {
  return [...reports].sort(
    (left, right) =>
      Date.parse(right.createdAt || right.updatedAt) -
      Date.parse(left.createdAt || left.updatedAt),
  );
}

function writtenDraftKey(mode: AssessmentMode) {
  return `${writtenDraftKeyPrefix}${mode}`;
}

export function readWrittenDraft(
  mode: AssessmentMode,
  storage = getBrowserLocalStorage(),
): WrittenDraft | null {
  return readJson<WrittenDraft | null>(storage, writtenDraftKey(mode), null);
}

export function saveWrittenDraft(
  mode: AssessmentMode,
  draft: WrittenDraft,
  storage = getBrowserLocalStorage(),
) {
  writeJson(storage, writtenDraftKey(mode), draft);
}

export function clearWrittenDraft(
  mode: AssessmentMode,
  storage = getBrowserLocalStorage(),
) {
  storage?.removeItem(writtenDraftKey(mode));
}

export function readReadingAttemptMeta(
  storage = getBrowserSessionStorage(),
): ReadingAttemptMeta | null {
  return readJson<ReadingAttemptMeta | null>(storage, readingAttemptKey, null);
}

export function saveReadingAttemptMeta(
  meta: ReadingAttemptMeta,
  storage = getBrowserSessionStorage(),
) {
  writeJson(storage, readingAttemptKey, meta);
}

export function clearReadingAttemptMeta(storage = getBrowserSessionStorage()) {
  storage?.removeItem(readingAttemptKey);
}

export function listStoredReports(
  storage = getBrowserLocalStorage(),
): AssessmentReport[] {
  const reports = readJson<AssessmentReport[]>(storage, reportStoreKey, []);
  return sortReports(reports);
}

export function findStoredReport(
  reportId: string,
  storage = getBrowserLocalStorage(),
): AssessmentReport | null {
  return (
    listStoredReports(storage).find((report) => report.reportId === reportId) ??
    null
  );
}

export function upsertStoredReport(
  report: AssessmentReport,
  storage = getBrowserLocalStorage(),
) {
  const current = listStoredReports(storage);
  const index = current.findIndex((item) => item.reportId === report.reportId);

  if (index >= 0) {
    current.splice(index, 1, report);
  } else {
    current.unshift(report);
  }

  writeJson(storage, reportStoreKey, sortReports(current));
}
