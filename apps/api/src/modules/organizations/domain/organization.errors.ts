import { HttpException, HttpStatus } from "@nestjs/common";

export class OrganizationNotFoundException extends HttpException {
  constructor(message = "学校或成员不存在") {
    super({ code: "ORG_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class OrganizationForbiddenException extends HttpException {
  constructor(message = "无权访问该学校资源") {
    super({ code: "ORG_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class OrganizationUnavailableException extends HttpException {
  constructor(message = "学校数据服务暂不可用") {
    super({ code: "ORG_UNAVAILABLE", message }, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
