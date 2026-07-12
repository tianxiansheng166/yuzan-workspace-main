import { HttpException, HttpStatus } from "@nestjs/common";

export class PrivacyForbiddenException extends HttpException {
  constructor(message = "无权限执行隐私管理操作") {
    super({ code: "PRIVACY_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class RetentionPolicyNotFoundException extends HttpException {
  constructor(message = "数据保留策略未找到") {
    super({ code: "RETENTION_POLICY_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class ConsentVersionNotFoundException extends HttpException {
  constructor(message = "同意版本未找到") {
    super({ code: "CONSENT_VERSION_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class DeletionRequestNotFoundException extends HttpException {
  constructor(message = "数据删除请求未找到") {
    super({ code: "DELETION_REQUEST_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class ConsentVersionConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "CONSENT_VERSION_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class DeletionConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "DELETION_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class RetentionPolicyConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "RETENTION_POLICY_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}
