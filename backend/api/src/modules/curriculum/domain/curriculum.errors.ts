import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

export interface PublishValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export class CurriculumValidationException extends BadRequestException {
  public readonly errors: readonly PublishValidationError[];

  constructor(errors: readonly PublishValidationError[]) {
    super({
      code: "COURSE_VERSION_INVALID",
      message: "课程版本校验失败",
      errors,
    });
    this.errors = errors;
  }
}

export class CurriculumNotFoundException extends NotFoundException {
  constructor(message = "课程版本不存在") {
    super({ code: "COURSE_VERSION_NOT_FOUND", message });
  }
}

export class CurriculumForbiddenException extends ForbiddenException {
  constructor(message = "无权操作该课程") {
    super({ code: "COURSE_VERSION_FORBIDDEN", message });
  }
}

export class CurriculumConflictException extends ConflictException {
  constructor(message: string) {
    super({ code: "COURSE_VERSION_CONFLICT", message });
  }
}

export class CurriculumRepositoryUnavailableException extends ServiceUnavailableException {
  constructor(message = "课程版本存储暂不可用") {
    super({ code: "COURSE_REPOSITORY_UNAVAILABLE", message });
  }
}
