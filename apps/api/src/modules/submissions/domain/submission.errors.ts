import { HttpException, HttpStatus } from "@nestjs/common";

export class SubmissionNotFoundException extends HttpException {
  constructor(message = "提交不存在") {
    super({ code: "SUBMISSION_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class SubmissionForbiddenException extends HttpException {
  constructor(message = "无权访问该提交") {
    super({ code: "SUBMISSION_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class SubmissionUnavailableException extends HttpException {
  constructor(message = "提交数据服务暂不可用") {
    super(
      { code: "SUBMISSION_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class SubmissionConflictException extends HttpException {
  constructor(message = "提交数据冲突，请刷新后重试") {
    super({ code: "SUBMISSION_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class SubmissionStatusException extends HttpException {
  constructor(message = "提交状态不允许此操作") {
    super({ code: "SUBMISSION_STATUS_INVALID", message }, HttpStatus.CONFLICT);
  }
}
