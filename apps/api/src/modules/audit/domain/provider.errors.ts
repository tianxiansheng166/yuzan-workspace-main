import { HttpException, HttpStatus } from "@nestjs/common";

export class ProviderNotFoundException extends HttpException {
  constructor(message = "Provider 未找到") {
    super({ code: "PROVIDER_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class ProviderConflictException extends HttpException {
  constructor(message = "Provider 冲突") {
    super({ code: "PROVIDER_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class ProviderSecretForbiddenException extends HttpException {
  constructor(message = "Provider 密钥不可通过 API 返回") {
    super({ code: "PROVIDER_SECRET_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class ProviderForbiddenException extends HttpException {
  constructor(message = "无权访问 Provider 资源") {
    super({ code: "PROVIDER_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class ProviderUnavailableException extends HttpException {
  constructor(message = "Provider 数据服务暂不可用") {
    super(
      { code: "PROVIDER_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
