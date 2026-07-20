import { ForbiddenException } from "@nestjs/common";

export class StudentDashboardForbiddenException extends ForbiddenException {
  constructor(message = "无权访问学生端数据") {
    super(message);
  }
}
