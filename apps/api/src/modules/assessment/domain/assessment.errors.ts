import { HttpException, HttpStatus } from "@nestjs/common";

export class AssessmentForbiddenException extends HttpException {
  constructor(message = "无权访问该测评") {
    super({ code: "ASSESSMENT_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class AssessmentNotFoundException extends HttpException {
  constructor(message = "测评不存在") {
    super({ code: "ASSESSMENT_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class AssessmentConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "ASSESSMENT_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class AssessmentValidationException extends HttpException {
  constructor(message: string) {
    super({ code: "ASSESSMENT_VALIDATION", message }, HttpStatus.BAD_REQUEST);
  }
}

export class AssessmentUnavailableException extends HttpException {
  constructor(message = "测评服务暂不可用") {
    super(
      { code: "ASSESSMENT_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class AssessmentPreconditionFailedException extends HttpException {
  constructor(message: string) {
    super(
      { code: "ASSESSMENT_PRECONDITION_FAILED", message },
      HttpStatus.PRECONDITION_FAILED,
    );
  }
}
