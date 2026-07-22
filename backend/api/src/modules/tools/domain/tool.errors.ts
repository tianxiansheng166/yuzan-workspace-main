import { HttpException, HttpStatus } from "@nestjs/common";

export class IntegrationNotFoundException extends HttpException {
  constructor(message = "集成不存在") {
    super({ code: "INTEGRATION_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class IntegrationForbiddenException extends HttpException {
  constructor(message = "无权访问该集成") {
    super({ code: "INTEGRATION_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class IntegrationUnavailableException extends HttpException {
  constructor(message = "集成服务暂不可用") {
    super(
      { code: "INTEGRATION_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class MindGraphJobNotFoundException extends HttpException {
  constructor(message = "MindGraph 任务不存在") {
    super({ code: "MINDGRAPH_JOB_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class MindGraphProviderUnavailableException extends HttpException {
  constructor(message = "MindGraph 提供方不可用，无法创建任务") {
    super(
      { code: "MINDGRAPH_PROVIDER_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
