import type { AuthenticatedSession, SessionSnapshot } from "../models";
import type { SessionGateway } from "../ports/session-gateway";
import { normalizeRole } from "../utils/roles";
import { createSafeStorage } from "../utils/storage";

const SESSION_STORAGE_KEY = "yuzan.identity.session";

interface StoredSessionRecord {
  status: "authenticated";
  role: string;
  serviceMode: "demo" | "pending" | "unavailable" | "live";
  expiresAt?: string;
}

function parseRecord(value: string | null): StoredSessionRecord | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredSessionRecord>;

    if (parsed.status !== "authenticated" || typeof parsed.role !== "string") {
      return undefined;
    }

    return {
      status: "authenticated",
      role: parsed.role,
      serviceMode:
        parsed.serviceMode === "live" ||
        parsed.serviceMode === "demo" ||
        parsed.serviceMode === "pending" ||
        parsed.serviceMode === "unavailable"
          ? parsed.serviceMode
          : "demo",
      expiresAt:
        typeof parsed.expiresAt === "string" ? parsed.expiresAt : undefined,
    };
  } catch {
    return undefined;
  }
}

export function createBrowserSessionGateway(): SessionGateway {
  const storage = createSafeStorage();

  return {
    async restore(): Promise<SessionSnapshot> {
      const record = parseRecord(storage.getItem(SESSION_STORAGE_KEY));

      if (!record) {
        return {
          status: "unavailable",
          serviceMode: "demo",
          message: "当前环境未接入统一登录，会话仅保留占位边界。",
        };
      }

      const role = normalizeRole(record.role);

      if (!role) {
        storage.removeItem(SESSION_STORAGE_KEY);

        return {
          status: "error",
          serviceMode: record.serviceMode,
          message: "检测到未知角色，会话已清理，等待服务侧修正。",
        };
      }

      if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
        storage.removeItem(SESSION_STORAGE_KEY);

        return {
          status: "expired",
          serviceMode: record.serviceMode,
          message: "会话已过期，请重新登录。",
        };
      }

      return {
        status: "authenticated",
        role,
        serviceMode: record.serviceMode,
        expiresAt: record.expiresAt,
      };
    },
    async persist(session: AuthenticatedSession) {
      storage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          status: "authenticated",
          role: session.role,
          serviceMode: session.serviceMode,
          expiresAt: session.expiresAt,
        } satisfies StoredSessionRecord),
      );
    },
    async clear() {
      storage.removeItem(SESSION_STORAGE_KEY);
    },
  };
}
