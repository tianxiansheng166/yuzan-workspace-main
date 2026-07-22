import { HttpException, HttpStatus } from "@nestjs/common";

export class OfflinePackageNotFoundException extends HttpException {
  constructor(message = "离线内容包不存在") {
    super({ code: "OFFLINE_PACKAGE_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class OfflinePackageForbiddenException extends HttpException {
  constructor(message = "无权访问该离线内容包") {
    super({ code: "OFFLINE_PACKAGE_FORBIDDEN", message }, HttpStatus.FORBIDDEN);
  }
}

export class SyncBatchNotFoundException extends HttpException {
  constructor(message = "同步批次不存在") {
    super({ code: "SYNC_BATCH_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class SyncBatchConflictException extends HttpException {
  constructor(message = "同步批次已存在") {
    super({ code: "SYNC_BATCH_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}
