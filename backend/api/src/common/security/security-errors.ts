import { HttpException, HttpStatus } from "@nestjs/common";

export type SecurityErrorCode =
  | "UNAUTHENTICATED"
  | "MISSING_TENANT"
  | "UNKNOWN_ROLE"
  | "FORBIDDEN_TENANT"
  | "FORBIDDEN_ROLE"
  | "FORBIDDEN_PERMISSION"
  | "FORBIDDEN_OWNERSHIP";

const STATUS_BY_CODE: Record<SecurityErrorCode, number> = {
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  MISSING_TENANT: HttpStatus.UNAUTHORIZED,
  UNKNOWN_ROLE: HttpStatus.UNAUTHORIZED,
  FORBIDDEN_TENANT: HttpStatus.FORBIDDEN,
  FORBIDDEN_ROLE: HttpStatus.FORBIDDEN,
  FORBIDDEN_PERMISSION: HttpStatus.FORBIDDEN,
  FORBIDDEN_OWNERSHIP: HttpStatus.FORBIDDEN,
};

const MESSAGE_BY_CODE: Record<SecurityErrorCode, string> = {
  UNAUTHENTICATED: "未认证，请先登录",
  MISSING_TENANT: "缺少租户上下文",
  UNKNOWN_ROLE: "未知或无效的角色",
  FORBIDDEN_TENANT: "不允许访问该租户资源",
  FORBIDDEN_ROLE: "当前角色无权执行此操作",
  FORBIDDEN_PERMISSION: "缺少所需权限",
  FORBIDDEN_OWNERSHIP: "无权访问该资源",
};

/**
 * Unified security exception.
 *
 * Both 401 and 403 variants use the same shape so that the global
 * HttpExceptionFilter can render them consistently.
 */
export class SecurityException extends HttpException {
  public readonly code: SecurityErrorCode;

  constructor(code: SecurityErrorCode, message?: string) {
    const status = STATUS_BY_CODE[code];
    super(
      {
        code,
        message: message ?? MESSAGE_BY_CODE[code],
      },
      status,
    );
    this.code = code;
  }
}

export function throwSecurity(
  code: SecurityErrorCode,
  message?: string,
): never {
  throw new SecurityException(code, message);
}
