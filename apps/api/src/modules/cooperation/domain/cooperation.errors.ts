import { HttpException, HttpStatus } from "@nestjs/common";

export class LeadNotFoundException extends HttpException {
  constructor(message = "线索不存在") {
    super({ code: "LEAD_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class LeadForbiddenException extends HttpException {
  constructor(message = "无权访问该线索") {
    super({ code: "LEAD_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class LeadUnavailableException extends HttpException {
  constructor(message = "线索数据服务暂不可用") {
    super(
      { code: "LEAD_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class SupportApplicationNotFoundException extends HttpException {
  constructor(message = "申请不存在") {
    super({ code: "SUPPORT_APPLICATION_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class SupportApplicationForbiddenException extends HttpException {
  constructor(message = "无权访问该申请") {
    super({ code: "SUPPORT_APPLICATION_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class SupportApplicationUnavailableException extends HttpException {
  constructor(message = "申请数据服务暂不可用") {
    super(
      { code: "SUPPORT_APPLICATION_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class VolunteerApplicationNotFoundException extends HttpException {
  constructor(message = "志愿者申请不存在") {
    super({ code: "VOLUNTEER_APPLICATION_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class VolunteerApplicationForbiddenException extends HttpException {
  constructor(message = "无权访问该志愿者申请") {
    super({ code: "VOLUNTEER_APPLICATION_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class VolunteerApplicationUnavailableException extends HttpException {
  constructor(message = "志愿者申请数据服务暂不可用") {
    super(
      { code: "VOLUNTEER_APPLICATION_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class ConsentRequiredException extends HttpException {
  constructor(message = "必须同意授权才能提交") {
    super({ code: "CONSENT_REQUIRED", message }, HttpStatus.BAD_REQUEST);
  }
}

export class RateLimitExceededException extends HttpException {
  constructor(message = "提交过于频繁，请稍后再试") {
    super({ code: "RATE_LIMIT_EXCEEDED", message }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
