import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Assessment module stable error codes (P0-CONTRACT-CONVERGENCE-001).
 *
 * 前端只根据 `error.code` 分支，不依赖中文 message 判断业务状态。
 * 稳定码覆盖黄金闭环关键失败路径；HTTP 状态码与 OpenAPI 响应一一对应。
 */
export class AssessmentNotFoundException extends HttpException {
  constructor(message = "测评会话不存在") {
    super({ code: "ASSESSMENT_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class AssessmentForbiddenException extends HttpException {
  constructor(message = "无权访问该测评") {
    super({ code: "FORBIDDEN_RESOURCE", message }, HttpStatus.FORBIDDEN);
  }
}

export class AssessmentConflictException extends HttpException {
  constructor(message = "测评状态冲突") {
    super({ code: "CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class AssessmentItemNotFoundException extends HttpException {
  constructor(message = "测评题目不存在") {
    super({ code: "ASSESSMENT_ITEM_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

/**
 * 创建班级测评时未解析出任何题目（questionIds 缺失或解析后为空）。
 * 禁止生成 0 个 AssessmentItem 的空测评。
 */
export class AssessmentHasNoItemsException extends HttpException {
  constructor(message = "测评必须包含至少一道题目，无法创建空测评") {
    super({ code: "ASSESSMENT_HAS_NO_ITEMS", message }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

/**
 * 练习内容为空：班级当前没有可用的练习定义/题目。
 * 与 ASSESSMENT_HAS_NO_ITEMS 区别在于：本错误强调"内容源缺失"，
 * 后者强调"解析后未产生 item"。
 */
export class PracticeContentEmptyException extends HttpException {
  constructor(message = "班级当前没有可用的练习内容，请先配置课程题目") {
    super({ code: "PRACTICE_CONTENT_EMPTY", message }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

/**
 * 请求参数校验失败：DTO 字段类型/格式不合法。
 * 用于 service 层主动校验后抛出（Controller 层由 ValidationPipe 处理）。
 */
export class AssessmentValidationFailedException extends HttpException {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ code: "VALIDATION_FAILED", message, ...(details ? { details } : {}) }, HttpStatus.BAD_REQUEST);
  }
}

/**
 * 服务处于处理中状态，结果尚未就绪。前端应轮询或等待 webhook。
 */
export class AssessmentProcessingPendingException extends HttpException {
  constructor(message = "测评处理中，请稍后查询") {
    super({ code: "PROCESSING_PENDING", message }, HttpStatus.ACCEPTED);
  }
}
