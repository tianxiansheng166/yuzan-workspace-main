import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service.js";
import { StorageModule } from "../../shared/storage/storage.module.js";

@Module({ imports: [StorageModule], controllers: [HealthController], providers: [HealthService], exports: [HealthService] })
export class HealthModule {}
