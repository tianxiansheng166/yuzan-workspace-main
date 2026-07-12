import { HttpException, HttpStatus } from "@nestjs/common";

export class GovernanceForbiddenException extends HttpException {
  constructor(message = "无权执行课程治理操作") {
    super({ code: "GOVERNANCE_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class GovernanceNotFoundException extends HttpException {
  constructor(message = "课程版本未找到") {
    super({ code: "GOVERNANCE_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class GovernanceConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "GOVERNANCE_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class ReviewNotFoundException extends HttpException {
  constructor(message = "审核记录未找到") {
    super({ code: "REVIEW_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}
