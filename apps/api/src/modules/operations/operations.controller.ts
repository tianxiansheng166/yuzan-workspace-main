import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "../../common/security/public.decorator.js";
import { OperationsService } from "./operations.service.js";
import { toOperationsStatusResponse } from "./dto/operations-response.js";

@Controller("operations")
export class OperationsController {
  constructor(@Inject(OperationsService) private readonly service: OperationsService) {}

  @Get("status")
  @Public()
  async getStatus() {
    const status = await this.service.getStatus();
    return toOperationsStatusResponse(status);
  }
}
