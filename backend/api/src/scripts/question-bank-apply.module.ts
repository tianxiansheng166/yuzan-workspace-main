import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnvironment } from "../config/environment.js";
import { QuestionBankRuntimeImportService } from "../modules/assessment/question-bank-runtime-import.service.js";
import { DatabaseModule } from "../shared/database/index.js";
import { StorageModule } from "../shared/storage/storage.module.js";

/**
 * Minimal application context for the trusted question-bank import command.
 * It deliberately reuses the production database and StoragePort modules
 * without booting HTTP controllers or duplicating S3/MinIO configuration.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    StorageModule,
  ],
  providers: [QuestionBankRuntimeImportService],
})
export class QuestionBankApplyModule {}
