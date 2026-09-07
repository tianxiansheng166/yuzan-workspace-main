import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnvironment } from "../config/environment.js";
import { DatabaseModule } from "../shared/database/index.js";
import { StorageModule } from "../shared/storage/storage.module.js";

/** Minimal context for the trusted, local COMP-DEMO-03 importer. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    StorageModule,
  ],
})
export class CourseImportModule {}
