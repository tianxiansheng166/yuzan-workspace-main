import { HttpException, HttpStatus } from "@nestjs/common";

export class RuleNotFoundException extends HttpException {
  constructor(message = "推荐规则未找到") {
    super({ code: "RULE_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class RuleConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "RULE_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class RuleVersionConflictException extends HttpException {
  constructor(message = "推荐规则版本冲突，请刷新后重试") {
    super({ code: "RULE_VERSION_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}
