import { Module } from "@nestjs/common";
import { StudentTeacherInvitationsController, TeacherInvitationsController } from "./teacher-invitations.controller.js";
import { TeacherInvitationsService } from "./teacher-invitations.service.js";

@Module({
  controllers: [TeacherInvitationsController, StudentTeacherInvitationsController],
  providers: [TeacherInvitationsService],
  exports: [TeacherInvitationsService],
})
export class TeacherInvitationsModule {}
