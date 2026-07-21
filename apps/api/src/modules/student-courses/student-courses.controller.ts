import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import {
  createAuthContext,
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { ListStudentCoursesQueryDto, SaveActivityAttemptDto, SaveStudentActivityNoteDto, SubmitCourseDto } from "./dto/student-course.dto.js";
import { StudentCoursesService } from "./student-courses.service.js";

@Controller("schools/:schoolId/student/courses")
@RequireRoles(MembershipRole.STUDENT)
export class StudentCoursesController {
  constructor(@Inject(StudentCoursesService) private readonly service: StudentCoursesService) {}

  @Get()
  list(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Query() query: ListStudentCoursesQueryDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.list(createAuthContext("request-id", principal, tenant), schoolId, query);
  }

  @Get(":assignmentId")
  detail(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("assignmentId", ParseUUIDPipe) assignmentId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.detail(createAuthContext("request-id", principal, tenant), schoolId, assignmentId);
  }

  @Post(":assignmentId/submissions")
  createOrResume(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("assignmentId", ParseUUIDPipe) assignmentId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.createOrResumeSubmission(createAuthContext("request-id", principal, tenant), schoolId, assignmentId);
  }

  @Put(":assignmentId/submissions/:submissionId/activities/:activityId/attempt")
  saveAttempt(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("assignmentId", ParseUUIDPipe) assignmentId: string, @Param("submissionId", ParseUUIDPipe) submissionId: string, @Param("activityId", ParseUUIDPipe) activityId: string, @Body() body: SaveActivityAttemptDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.saveActivityAttempt(createAuthContext("request-id", principal, tenant), schoolId, assignmentId, submissionId, activityId, body);
  }

  @Post(":assignmentId/submissions/:submissionId/activities/:activityId/recordings/:recordingId/link")
  linkRecording(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("assignmentId", ParseUUIDPipe) assignmentId: string, @Param("submissionId", ParseUUIDPipe) submissionId: string, @Param("activityId", ParseUUIDPipe) activityId: string, @Param("recordingId", ParseUUIDPipe) recordingId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.linkRecording(createAuthContext("request-id", principal, tenant), schoolId, assignmentId, submissionId, activityId, recordingId);
  }

  @Post(":assignmentId/submissions/:submissionId/submit")
  submit(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("assignmentId", ParseUUIDPipe) assignmentId: string, @Param("submissionId", ParseUUIDPipe) submissionId: string, @Body() body: SubmitCourseDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.submitCourse(createAuthContext("request-id", principal, tenant), schoolId, assignmentId, submissionId, body.revision);
  }
}

@Controller("schools/:schoolId/learning/activities")
@RequireRoles(MembershipRole.STUDENT)
export class StudentActivityNotesController {
  constructor(@Inject(StudentCoursesService) private readonly service: StudentCoursesService) {}

  @Get(":activityId/note")
  getNote(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("activityId", ParseUUIDPipe) activityId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.getNote(createAuthContext("request-id", principal, tenant), schoolId, activityId);
  }

  @Put(":activityId/note")
  saveNote(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("activityId", ParseUUIDPipe) activityId: string, @Body() body: SaveStudentActivityNoteDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.saveNote(createAuthContext("request-id", principal, tenant), schoolId, activityId, body);
  }
}
