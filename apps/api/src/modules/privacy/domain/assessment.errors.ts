import { HttpException, HttpStatus } from "@nestjs/common";

export class MaterialNotFoundException extends HttpException {
  constructor(message = "测评材料未找到") {
    super({ code: "MATERIAL_NOT_FOUND", message }, HttpStatus.NOT_FOUND);
  }
}

export class MaterialConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "MATERIAL_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}

export class MaterialVersionConflictException extends HttpException {
  constructor(message: string) {
    super({ code: "MATERIAL_VERSION_CONFLICT", message }, HttpStatus.CONFLICT);
  }
}
