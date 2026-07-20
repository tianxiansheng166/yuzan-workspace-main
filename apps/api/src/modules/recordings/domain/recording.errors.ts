import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Recordings module stable error codes (P0-CONTRACT-CONVERGENCE-001).
 *
 * 所有异常携带稳定 `code` 字段，前端按 code 分支而非 message。
 * 历史上这些异常继承自 NestJS 内置异常（NotFoundException 等），
 * 导致响应体没有 `code` 字段，前端只能靠 HTTP 状态码猜测。
 * 现统一改为 HttpException + `{ code, message }` 载荷。
 */
export class RecordingNotFoundException extends HttpException {
  constructor(message = "录音不存在") {
    super({ code: "RECORDING_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class RecordingForbiddenException extends HttpException {
  constructor(message = "无权访问此录音") {
    super({ code: "FORBIDDEN_RESOURCE", message }, HttpStatus.FORBIDDEN);
  }
}

export class RecordingConflictException extends HttpException {
  constructor(message = "录音操作冲突") {
    super({ code: "CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class RecordingUnavailableException extends HttpException {
  constructor(message: string) {
    super({ code: "PROVIDER_UNAVAILABLE", message }, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

export class RecordingStatusException extends HttpException {
  constructor(message: string) {
    super({ code: "VALIDATION_FAILED", message }, HttpStatus.BAD_REQUEST);
  }
}

/**
 * 上传录音音质被服务方拒绝（如时长过短、静音、格式不支持）。
 * 由 worker 回写或 storage 校验触发。
 */
export class AudioQualityRejectedException extends HttpException {
  constructor(message = "录音音质不达标，请重新录制", details?: Record<string, unknown>) {
    super({ code: "AUDIO_QUALITY_REJECTED", message, ...(details ? { details } : {}) }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

/**
 * 语音/存储服务提供方未配置（如 SPEECH_PROVIDER=disabled、storage port 未注入）。
 * 黄金闭环中此错误明确告知前端"功能未启用"，而非返回演示数据。
 */
export class ProviderNotConfiguredException extends HttpException {
  constructor(message = "服务提供方未配置，该功能暂不可用") {
    super({ code: "PROVIDER_NOT_CONFIGURED", message }, HttpStatus.SERVICE_UNAVAILABLE);
  }
}