/**
 * 登录表单与 demo session 类型。
 *
 * STACKED_PROVISIONAL：GOV-002 尚未最终批准，当前所有会话均为本地 demo，
 * 不接入正式后端，不存储真实 token 或明文密码。
 */

export interface LoginCredentials {
  identifier: string;
  password: string;
  remember?: boolean;
}

export interface DemoUser {
  id: string;
  name: string;
  role: string;
}

export interface DemoSession {
  user: DemoUser;
  token: string;
  createdAt: number;
  expiresAt: number;
  demo: true;
}

export type LoginResult =
  | { kind: "success"; session: DemoSession }
  | { kind: "error"; message: string };

export interface AuthGateway {
  login(credentials: LoginCredentials): Promise<LoginResult>;
  logout(): Promise<void>;
  getSession(): Promise<DemoSession | null>;
}
