import { HttpException, HttpStatus } from "@nestjs/common";

export class SupportPairingNotFoundException extends HttpException {
  constructor(message = "配对不存在") {
    super({ code: "SUPPORT_PAIRING_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class SupportPairingForbiddenException extends HttpException {
  constructor(message = "无权访问该配对") {
    super(
      { code: "SUPPORT_PAIRING_FORBIDDEN", message },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class SupportPairingUnavailableException extends HttpException {
  constructor(message = "配对数据服务暂不可用") {
    super(
      { code: "SUPPORT_PAIRING_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class SupportSessionNotFoundException extends HttpException {
  constructor(message = "支持会话不存在") {
    super(
      { code: "SUPPORT_SESSION_NOT_FOUND", message },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ConsentRequiredException extends HttpException {
  constructor(message = "配对需要同意后才能激活") {
    super(
      { code: "CONSENT_REQUIRED", message },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class HighRiskEventException extends HttpException {
  constructor(message = "高风险事件需由教师或管理员处理") {
    super(
      { code: "HIGH_RISK_EVENT_REQUIRES_TEACHER", message },
      HttpStatus.FORBIDDEN,
    );
  }
}
