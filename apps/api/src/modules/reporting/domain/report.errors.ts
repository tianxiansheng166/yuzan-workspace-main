import { HttpException, HttpStatus } from "@nestjs/common";

export class ReportNotFoundException extends HttpException {
  constructor(message = "报表不存在") {
    super({ code: "REPORT_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class ReportForbiddenException extends HttpException {
  constructor(message = "无权访问该报表") {
    super({ code: "REPORT_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class ReportConflictException extends HttpException {
  constructor(message = "报表正在生成中") {
    super({ code: "REPORT_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}
