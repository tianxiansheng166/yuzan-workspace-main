import { HttpException, HttpStatus } from "@nestjs/common";

export class AuditForbiddenException extends HttpException {
  constructor(message = "无权访问审计日志") {
    super({ code: "AUDIT_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class AuditNotFoundException extends HttpException {
  constructor(message = "审计日志未找到") {
    super({ code: "AUDIT_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class AuditUnavailableException extends HttpException {
  constructor(message = "审计数据服务暂不可用") {
    super(
      { code: "AUDIT_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
