import { HttpException, HttpStatus } from "@nestjs/common";

export class AdminForbiddenException extends HttpException {
  constructor(message = "无权执行管理操作") {
    super({ code: "ADMIN_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class AdminNotFoundException extends HttpException {
  constructor(resource: string, message?: string) {
    super(
      { code: "ADMIN_NOT_FOUND", message: message ?? `${resource}未找到` },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class AdminConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "ADMIN_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class AdminBadRequestException extends HttpException {
  constructor(message: string) {
    super({ code: "ADMIN_BAD_REQUEST", message }, HttpStatus.BAD_REQUEST);
  }
}

export class UserAlreadyExistsException extends HttpException {
  constructor(loginIdentifier: string) {
    super(
      { code: "USER_ALREADY_EXISTS", message: `用户 ${loginIdentifier} 已存在` },
      HttpStatus.CONFLICT,
    );
  }
}

export class AdminUnavailableException extends HttpException {
  constructor(message = "管理服务暂不可用") {
    super(
      { code: "ADMIN_UNAVAILABLE", message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
