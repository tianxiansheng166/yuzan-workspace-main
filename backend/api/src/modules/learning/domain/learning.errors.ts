import { HttpException, HttpStatus } from "@nestjs/common";

export class LearningForbiddenException extends HttpException {
  constructor(message = "无权访问该学习资源") {
    super({ code: "LEARNING_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class LearningUnavailableException extends HttpException {
  constructor(message = "学习数据服务暂不可用") {
    super(
      { code: "LEARNING_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class ProgressConflictException extends HttpException {
  constructor(message = "学习进度数据冲突，请刷新后重试") {
    super({ code: "PROGRESS_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}
