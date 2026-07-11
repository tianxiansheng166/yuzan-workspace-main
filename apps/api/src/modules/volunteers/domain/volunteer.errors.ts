import { HttpException, HttpStatus } from "@nestjs/common";

export class VolunteerNotFoundException extends HttpException {
  constructor(message = "志愿者不存在") {
    super({ code: "VOLUNTEER_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class VolunteerForbiddenException extends HttpException {
  constructor(message = "无权访问该志愿者信息") {
    super({ code: "VOLUNTEER_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class VolunteerUnavailableException extends HttpException {
  constructor(message = "志愿者数据服务暂不可用") {
    super({ code: "VOLUNTEER_UNAVAILABLE", message }, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

export class VolunteerInvalidTransitionException extends HttpException {
  constructor(message = "志愿者状态转换无效") {
    super({ code: "VOLUNTEER_INVALID_TRANSITION", message }, HttpStatus.CONFLICT);
  }
}

export class VolunteerNotQualifiedException extends HttpException {
  constructor(message = "志愿者尚未获得资格") {
    super({ code: "VOLUNTEER_NOT_QUALIFIED", message }, HttpStatus.FORBIDDEN);
  }
}

export class ServiceTaskNotFoundException extends HttpException {
  constructor(message = "服务任务不存在") {
    super({ code: "SERVICE_TASK_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class ServiceTaskForbiddenException extends HttpException {
  constructor(message = "无权访问该服务任务") {
    super({ code: "SERVICE_TASK_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class IncidentReportNotFoundException extends HttpException {
  constructor(message = "异常事件不存在") {
    super({ code: "INCIDENT_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class IncidentReportForbiddenException extends HttpException {
  constructor(message = "无权访问该异常事件") {
    super({ code: "INCIDENT_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}
