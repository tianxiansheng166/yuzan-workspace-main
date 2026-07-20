import { HttpException, HttpStatus } from "@nestjs/common";

export class AssessmentNotFoundException extends HttpException {
  constructor(message = "测评会话不存在") {
    super({ code: "ASSESSMENT_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class AssessmentForbiddenException extends HttpException {
  constructor(message = "无权访问该测评") {
    super({ code: "ASSESSMENT_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class AssessmentConflictException extends HttpException {
  constructor(message = "测评状态冲突") {
    super({ code: "ASSESSMENT_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class AssessmentItemNotFoundException extends HttpException {
  constructor(message = "测评题目不存在") {
    super({ code: "ASSESSMENT_ITEM_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}
