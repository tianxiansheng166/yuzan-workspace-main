import { Module } from "@nestjs/common";
import { TranslationsController } from "./translations.controller.js";
import { TranslationsService } from "./translations.service.js";
import { TRANSLATION_REPOSITORY } from "./ports/translation-repository.port.js";
import { UnavailableTranslationRepository } from "./ports/unavailable-translation.repository.js";

@Module({
  controllers: [TranslationsController],
  providers: [
    TranslationsService,
    {
      provide: TRANSLATION_REPOSITORY,
      useClass: UnavailableTranslationRepository,
    },
  ],
  exports: [TranslationsService],
})
export class TranslationsModule {}
