import { HttpException, HttpStatus } from "@nestjs/common";

export type IdentityErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_SESSION_EXPIRED"
  | "AUTH_SESSION_REVOKED"
  | "AUTH_MEMBERSHIP_INACTIVE"
  | "AUTH_TENANT_NOT_ALLOWED"
  | "AUTH_ROLE_UNSUPPORTED"
  | "AUTH_SERVICE_UNAVAILABLE"
  | "AUTH_IDENTIFIER_CONFLICT";

const STATUS_BY_CODE: Record<IdentityErrorCode, number> = {
  AUTH_INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  AUTH_SESSION_EXPIRED: HttpStatus.UNAUTHORIZED,
  AUTH_SESSION_REVOKED: HttpStatus.UNAUTHORIZED,
  AUTH_MEMBERSHIP_INACTIVE: HttpStatus.FORBIDDEN,
  AUTH_TENANT_NOT_ALLOWED: HttpStatus.FORBIDDEN,
  AUTH_ROLE_UNSUPPORTED: HttpStatus.FORBIDDEN,
  AUTH_SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  AUTH_IDENTIFIER_CONFLICT: HttpStatus.CONFLICT,
};

const MESSAGE_BY_CODE: Record<IdentityErrorCode, string> = {
  AUTH_INVALID_CREDENTIALS: "登录凭证无效",
  AUTH_SESSION_EXPIRED: "会话已过期，请重新登录",
  AUTH_SESSION_REVOKED: "会话已被吊销，请重新登录",
  AUTH_MEMBERSHIP_INACTIVE: "成员身份未激活",
  AUTH_TENANT_NOT_ALLOWED: "无法访问指定学校",
  AUTH_ROLE_UNSUPPORTED: "当前角色不支持",
  AUTH_SERVICE_UNAVAILABLE: "身份服务暂不可用",
  AUTH_IDENTIFIER_CONFLICT: "该手机号已注册",
};

/**
 * Identity-domain exception.
 *
 * Exposes a safe, non-leaking message to clients. Internal details such as
 * whether a user exists or whether the password matched must not be disclosed.
 */
export class IdentityException extends HttpException {
  public readonly code: IdentityErrorCode;

  constructor(code: IdentityErrorCode, message?: string) {
    super(
      {
        code,
        message: message ?? MESSAGE_BY_CODE[code],
      },
      STATUS_BY_CODE[code],
    );
    this.code = code;
  }
}

export function throwIdentity(
  code: IdentityErrorCode,
  message?: string,
): never {
  throw new IdentityException(code, message);
}
