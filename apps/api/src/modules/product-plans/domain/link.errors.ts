import { HttpException, HttpStatus } from "@nestjs/common";

export class LinkNotFoundException extends HttpException {
  constructor(message = "测评链接未找到") {
    super({ code: "LINK_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class LinkRegenerationException extends HttpException {
  constructor(message = "测评链接重新生成失败") {
    super(
      { code: "LINK_REGENERATION_FAILED", message },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class LinkTokenExpiredException extends HttpException {
  constructor(message = "测评链接已过期") {
    super({ code: "LINK_TOKEN_EXPIRED", message }, HttpStatus.GONE);
  }
}
