import { HttpException, HttpStatus } from "@nestjs/common";

export class PlanNotFoundException extends HttpException {
  constructor(message = "产品方案未找到") {
    super({ code: "PLAN_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class PlanConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "PLAN_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class PlanVersionConflictException extends HttpException {
  constructor(message = "产品方案版本冲突，请刷新后重试") {
    super({ code: "PLAN_VERSION_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}
