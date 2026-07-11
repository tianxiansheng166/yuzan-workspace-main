import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { Public } from "../../common/security/index.js";

@Controller("api/v1/plans")
export class PlansStubController {
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  listPublicPlans() {
    return {
      data: {
        items: [],
        nextCursor: null,
        hasMore: false,
      },
      meta: { requestId: "plans-public-list" },
    };
  }
}
