import { HttpException, HttpStatus } from "@nestjs/common";

export class TeacherForbiddenException extends HttpException {
  constructor(message = "无权访问教师端数据") {
    super({ code: "TEACHER_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class NotificationNotFoundException extends HttpException {
  constructor(message = "通知不存在") {
    super({ code: "NOTIFICATION_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}
