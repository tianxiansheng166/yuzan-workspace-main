import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { STORAGE_PORT } from "./storage.port.js";
import { UnavailableStorageAdapter } from "./unavailable-storage.adapter.js";
import { S3CompatibleStorageAdapter } from "./s3-compatible-storage.adapter.js";

/**
 * StorageModule provides a StoragePort implementation.
 *
 * When S3_ENDPOINT is configured, it uses S3CompatibleStorageAdapter
 * (supports MinIO and standard S3). Otherwise, it falls back to
 * UnavailableStorageAdapter which throws PROVIDER_NOT_CONFIGURED.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PORT,
      useFactory: (config: ConfigService) => {
        const endpoint = config.get<string>("S3_ENDPOINT");
        if (endpoint && endpoint.trim() !== "") {
          return new S3CompatibleStorageAdapter(config);
        }
        return new UnavailableStorageAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
