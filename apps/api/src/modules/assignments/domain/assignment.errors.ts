import { HttpException, HttpStatus } from "@nestjs/common";

export class AssignmentNotFoundException extends HttpException {
  constructor(message = "作业不存在") {
    super({ code: "ASSIGNMENT_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class AssignmentForbiddenException extends HttpException {
  constructor(message = "无权访问该作业") {
    super({ code: "ASSIGNMENT_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class AssignmentUnavailableException extends HttpException {
  constructor(message = "作业数据服务暂不可用") {
    super(
      { code: "ASSIGNMENT_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class AssignmentConflictException extends HttpException {
  constructor(message = "作业数据冲突，请刷新后重试") {
    super({ code: "ASSIGNMENT_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class AssignmentStatusException extends HttpException {
  constructor(message = "作业状态不允许此操作") {
    super({ code: "ASSIGNMENT_STATUS_INVALID", message }, HttpStatus.CONFLICT);
  }
}
