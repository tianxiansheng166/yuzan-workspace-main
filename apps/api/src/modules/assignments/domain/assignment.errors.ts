import { HttpException, HttpStatus } from "@nestjs/common";

export class AssignmentForbiddenException extends HttpException {
  constructor(message = "无权访问该任务") {
    super({ code: "ASSIGNMENT_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class AssignmentNotFoundException extends HttpException {
  constructor(message = "任务不存在") {
    super({ code: "ASSIGNMENT_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class AssignmentConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "ASSIGNMENT_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class AssignmentValidationException extends HttpException {
  constructor(message: string) {
    super({ code: "ASSIGNMENT_VALIDATION", message }, HttpStatus.BAD_REQUEST);
  }
}

export class AssignmentUnavailableException extends HttpException {
  constructor(message = "任务服务暂不可用") {
    super(
      { code: "ASSIGNMENT_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
