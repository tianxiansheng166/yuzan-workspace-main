import { HttpException, HttpStatus } from "@nestjs/common";

export class FeedbackNotFoundException extends HttpException {
  constructor(message = "反馈不存在") {
    super({ code: "FEEDBACK_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class FeedbackForbiddenException extends HttpException {
  constructor(message = "无权访问该反馈") {
    super({ code: "FEEDBACK_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class FeedbackUnavailableException extends HttpException {
  constructor(message = "反馈数据服务暂不可用") {
    super(
      { code: "FEEDBACK_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class FeedbackConflictException extends HttpException {
  constructor(message = "反馈数据冲突，请刷新后重试") {
    super({ code: "FEEDBACK_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class SubmissionNotReviewableException extends HttpException {
  constructor(message = "提交尚未处于待审核状态") {
    super(
      { code: "SUBMISSION_NOT_REVIEWABLE", message },
      HttpStatus.CONFLICT,
    );
  }
}
