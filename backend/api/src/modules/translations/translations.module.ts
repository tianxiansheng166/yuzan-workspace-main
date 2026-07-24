import { Module } from "@nestjs/common";
import {
  TranslationsController,
  InternalTranslationsController,
} from "./translations.controller.js";
import { TranslationsService } from "./translations.service.js";
import { TRANSLATION_REPOSITORY } from "./ports/translation-repository.port.js";
import { PrismaTranslationRepository } from "./ports/prisma-translation.repository.js";
import { TRANSLATION_CRYPTO } from "./crypto/aes-gcm.crypto.js";
import { AesGcmCrypto } from "./crypto/aes-gcm.crypto.js";
import { TRANSLATION_RATE_LIMITER } from "./rate-limit/translation-rate-limit.js";
import { TranslationRateLimiter } from "./rate-limit/translation-rate-limit.js";
import { TRANSLATION_PROVIDER } from "./provider/translation-provider.adapter.js";
import { ConfigurableTranslationProvider } from "./provider/translation-provider.adapter.js";

@Module({
  controllers: [TranslationsController, InternalTranslationsController],
  providers: [
    TranslationsService,
    {
      provide: TRANSLATION_REPOSITORY,
      useClass: PrismaTranslationRepository,
    },
    {
      provide: TRANSLATION_CRYPTO,
      useClass: AesGcmCrypto,
    },
    {
      provide: TRANSLATION_RATE_LIMITER,
      useClass: TranslationRateLimiter,
    },
    {
      provide: TRANSLATION_PROVIDER,
      useClass: ConfigurableTranslationProvider,
    },
  ],
  exports: [TranslationsService],
})
export class TranslationsModule {}
