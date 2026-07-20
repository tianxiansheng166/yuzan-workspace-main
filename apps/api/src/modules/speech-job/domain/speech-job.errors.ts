import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * SpeechJob module stable error codes (P0-CONTRACT-CONVERGENCE-001).
 *
 * 历史上 SpeechJobController 直接 `throw new Error(...)` 或 `throw new NotFoundException(...)`，
 * 前者会被全局过滤器转成 500 INTERNAL_ERROR，后者无稳定 code 字段。
 * 现统一为带稳定 code 的 HttpException。
 */
export class SpeechJobNotFoundException extends HttpException {
  constructor(message = "语音评分任务不存在") {
    super({ code: "SPEECH_JOB_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class SpeechJobForbiddenException extends HttpException {
  constructor(message = "无权访问该语音评分任务") {
    super({ code: "FORBIDDEN_RESOURCE", message }, HttpStatus.FORBIDDEN);
  }
}

/**
 * worker 回写接口（PUT /speech-jobs/:jobId/result）鉴权失败。
 * 内部 API 必须.fail closed：未携带有效凭据一律拒绝，避免任意客户端篡改评分结果。
 */
export class SpeechJobCallbackUnauthorizedException extends HttpException {
  constructor(message = "语音评分回写接口鉴权失败") {
    super({ code: "UNAUTHENTICATED", message }, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * 语音服务提供方未配置（SPEECH_PROVIDER=disabled）。
 * job 会以 CREATED 状态落库但不分发到队列，前端轮询应感知此状态。
 */
export class SpeechProviderNotConfiguredException extends HttpException {
  constructor(message = "语音评分服务未配置，任务已创建但暂不会处理") {
    super({ code: "PROVIDER_NOT_CONFIGURED", message }, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

/**
 * 语音评分服务暂时不可用（队列未连接、provider 超时等）。
 */
export class SpeechProviderUnavailableException extends HttpException {
  constructor(message = "语音评分服务暂时不可用，请稍后重试") {
    super({ code: "PROVIDER_UNAVAILABLE", message }, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
