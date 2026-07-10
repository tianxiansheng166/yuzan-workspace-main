import { HttpException, HttpStatus } from "@nestjs/common";

export class LearningForbiddenException extends HttpException {
  constructor(message = "无权访问该学习资源") {
    super({ code: "LEARNING_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class LearningNotFoundException extends HttpException {
  constructor(message = "学习资源不存在") {
    super({ code: "LEARNING_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class LearningConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "LEARNING_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class LearningValidationException extends HttpException {
  constructor(message: string) {
    super({ code: "LEARNING_VALIDATION", message }, HttpStatus.BAD_REQUEST);
  }
}

export class LearningUnavailableException extends HttpException {
  constructor(message = "学习服务暂不可用") {
    super(
      { code: "LEARNING_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class LearningPreconditionFailedException extends HttpException {
  constructor(message: string) {
    super(
      { code: "LEARNING_PRECONDITION_FAILED", message },
      HttpStatus.PRECONDITION_FAILED,
    );
  }
}
