import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
  BadRequestException,
} from "@nestjs/common";

export class RecordingNotFoundException extends NotFoundException {
  constructor() {
    super("录音不存在");
  }
}

export class RecordingForbiddenException extends ForbiddenException {
  constructor() {
    super("无权访问此录音");
  }
}

export class RecordingConflictException extends ConflictException {
  constructor() {
    super("录音操作冲突");
  }
}

export class RecordingUnavailableException extends ServiceUnavailableException {
  constructor(message: string) {
    super(message);
  }
}

export class RecordingStatusException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}
