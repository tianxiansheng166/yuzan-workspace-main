import { Module } from "@nestjs/common";
import { RecordingsController } from "./recordings.controller.js";
import { RecordingsService } from "./recordings.service.js";
import { RECORDING_REPOSITORY } from "./ports/recording-repository.port.js";
import { PrismaRecordingRepository } from "./infra/prisma-recording.repository.js";
import { SpeechJobModule } from "../speech-job/speech-job.module.js";

@Module({
  imports: [SpeechJobModule],
  controllers: [RecordingsController],
  providers: [
    RecordingsService,
    {
      provide: RECORDING_REPOSITORY,
      useClass: PrismaRecordingRepository,
    },
  ],
  exports: [RecordingsService],
})
export class RecordingsModule {}
