import type { DemoSession, LoginCredentials, LoginResult } from "../auth/types";
import {
  createLocalStorageAdapter,
  createReadOnlyCombinedStorageAdapter,
  createSessionStorageAdapter,
  REMEMBER_KEY,
  SESSION_KEY,
} from "../auth/storage";

/**
 * Session gateway 抽象。
 *
 * 当前实现为 DemoSessionGateway，仅在本地 storage 中维护 demo 会话，
 * 不调用真实后端，不依赖 GOV-002 contracts。GOV-002 批准后可替换为
 * 正式 API gateway，而页面与中间件无需改动。
 */
export interface SessionGateway {
  login(credentials: LoginCredentials): Promise<LoginResult>;
  logout(): Promise<void>;
  getSession(): Promise<DemoSession | null>;
}

function generateDemoToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `yuzan-demo-token-${timestamp}-${random}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function checkDemoSession(): Promise<DemoSession | null> {
  const gateway = new DemoSessionGateway();
  return gateway.getSession();
}

export class DemoSessionGateway implements SessionGateway {
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    await delay(400);

    const identifier = credentials.identifier.trim();
    const password = credentials.password;

    if (!identifier || !password) {
      return { kind: "error", message: "请输入邮箱/账号和密码" };
    }

    if (password.length < 4) {
      return { kind: "error", message: "演示密码至少 4 位" };
    }

    const now = Date.now();
    const sessionDuration = credentials.remember
      ? 7 * 24 * 60 * 60 * 1000
      : 30 * 60 * 1000;

    const session: DemoSession = {
      user: {
        id: "demo-user",
        name: identifier.split("@")[0] || identifier || "Demo User",
        role: "teacher",
      },
      token: generateDemoToken(),
      createdAt: now,
      expiresAt: now + sessionDuration,
      demo: true,
    };

    const storage = credentials.remember
      ? createLocalStorageAdapter()
      : createSessionStorageAdapter();

    storage.setItem(SESSION_KEY, JSON.stringify(session));
    storage.setItem(REMEMBER_KEY, JSON.stringify(Boolean(credentials.remember)));

    return { kind: "success", session };
  }

  async logout(): Promise<void> {
    await delay(120);
    const storage = createReadOnlyCombinedStorageAdapter();
    storage.removeItem(SESSION_KEY);
    storage.removeItem(REMEMBER_KEY);
  }

  async getSession(): Promise<DemoSession | null> {
    await delay(80);
    const storage = createReadOnlyCombinedStorageAdapter();
    const raw = storage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as DemoSession;
      if (!parsed.demo) {
        return null;
      }
      if (parsed.expiresAt < Date.now()) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
