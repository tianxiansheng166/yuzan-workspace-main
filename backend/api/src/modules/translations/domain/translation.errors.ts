import { HttpException, HttpStatus } from "@nestjs/common";

export class TranslationNotFoundException extends HttpException {
  constructor(message = "翻译任务不存在") {
    super({ code: "TRANSLATION_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class TranslationForbiddenException extends HttpException {
  constructor(message = "无权访问该翻译任务") {
    super({ code: "TRANSLATION_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class TranslationUnavailableException extends HttpException {
  constructor(message = "翻译服务暂不可用") {
    super(
      { code: "TRANSLATION_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class TranslationInputTooLongException extends HttpException {
  constructor(message = "输入文本过长，最大支持5000字符") {
    super(
      { code: "TRANSLATION_INPUT_TOO_LONG", message },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class TranslationRateLimitedException extends HttpException {
  constructor(message = "翻译请求过于频繁，请稍后再试") {
    super(
      { code: "TRANSLATION_RATE_LIMITED", message },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
