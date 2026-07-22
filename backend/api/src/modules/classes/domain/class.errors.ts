import { HttpException, HttpStatus } from "@nestjs/common";

export class ClassNotFoundException extends HttpException {
  constructor(message = "班级不存在") {
    super({ code: "CLASS_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class ClassForbiddenException extends HttpException {
  constructor(message = "无权访问该班级") {
    super({ code: "CLASS_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class ClassUnavailableException extends HttpException {
  constructor(message = "班级数据服务暂不可用") {
    super(
      { code: "CLASS_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class ClassConflictException extends HttpException {
  constructor(message = "班级数据冲突，请刷新后重试") {
    super({ code: "CLASS_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class EnrollmentConflictException extends HttpException {
  constructor(message = "该成员已在此班级中") {
    super({ code: "ENROLLMENT_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}
