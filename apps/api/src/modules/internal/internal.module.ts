import { Module } from "@nestjs/common";
import { AssessmentModule } from "../assessment/assessment.module.js";
import { InternalController } from "./internal.controller.js";

@Module({
  imports: [AssessmentModule],
  controllers: [InternalController],
})
export class InternalModule {}
