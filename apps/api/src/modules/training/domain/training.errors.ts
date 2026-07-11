import { HttpException, HttpStatus } from "@nestjs/common";

export class TrainingProgramNotFoundException extends HttpException {
  constructor(message = "培训项目不存在") {
    super({ code: "TRAINING_PROGRAM_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class TrainingEnrollmentNotFoundException extends HttpException {
  constructor(message = "培训报名不存在") {
    super(
      { code: "TRAINING_ENROLLMENT_NOT_FOUND", message },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class TrainingExamNotFoundException extends HttpException {
  constructor(message = "培训考试不存在") {
    super({ code: "TRAINING_EXAM_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class TrainingForbiddenException extends HttpException {
  constructor(message = "无权操作该培训资源") {
    super({ code: "TRAINING_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class TrainingConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "TRAINING_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class TrainingUnavailableException extends HttpException {
  constructor(message = "培训数据服务暂不可用") {
    super(
      { code: "TRAINING_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
