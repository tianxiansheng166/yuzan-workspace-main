import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { markRootHealthRoutesPublic } from "./bootstrap/public-health.js";
import { applyRootRouteCompatibility } from "./bootstrap/route-compatibility.js";
import { validateEnvironment } from "./config/environment.js";
import { AssignmentsModule } from "./modules/assignments/assignments.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { ClassesModule } from "./modules/classes/classes.module.js";
import { CommunityModule } from "./modules/community/community.module.js";
import { CooperationModule } from "./modules/cooperation/cooperation.module.js";
import { CurriculumModule } from "./modules/curriculum/curriculum.module.js";
import { FeedbackModule } from "./modules/feedback/feedback.module.js";
import { HealthModule } from "./modules/health/health.module";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { LearningModule } from "./modules/learning/learning.module.js";
import { OfflineModule } from "./modules/offline/offline.module.js";
import { OperationsModule } from "./modules/operations/operations.module.js";
import { OrganizationsModule } from "./modules/organizations/organizations.module.js";
import { ReportingModule } from "./modules/reporting/reporting.module.js";
import { SubmissionsModule } from "./modules/submissions/submissions.module.js";
import { SupportPairingsModule } from "./modules/support-pairings/support-pairings.module.js";
import { ToolsModule } from "./modules/tools/tools.module.js";
import { TrainingModule } from "./modules/training/training.module.js";
import { TranslationsModule } from "./modules/translations/translations.module.js";
import { VolunteersModule } from "./modules/volunteers/volunteers.module.js";
import { MvpGapsModule } from "./modules/mvp-gaps/mvp-gaps.module.js";
import { TeacherModule } from "./modules/teacher/teacher.module.js";
import { RecordingsModule } from "./modules/recordings/recordings.module.js";
import { SpeechJobModule } from "./modules/speech-job/speech-job.module.js";
import { StudentDashboardModule } from "./modules/student-dashboard/student-dashboard.module.js";
import { AssessmentModule } from "./modules/assessment/assessment.module.js";
import { SyncModule } from "./modules/sync/sync.module.js";
import { TeacherToolsModule } from "./modules/teacher-tools/teacher-tools.module.js";
import { InternalModule } from "./modules/internal/internal.module.js";
import { DatabaseModule } from "./shared/database/index.js";

markRootHealthRoutesPublic();
applyRootRouteCompatibility();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    IdentityModule,
    OrganizationsModule,
    ClassesModule,
    CurriculumModule,
    AssignmentsModule,
    SubmissionsModule,
    FeedbackModule,
    LearningModule,
    VolunteersModule,
    TrainingModule,
    SupportPairingsModule,
    ToolsModule,
    TranslationsModule,
    CommunityModule,
    CooperationModule,
    ReportingModule,
    OfflineModule,
    OperationsModule,
    TeacherModule,
    RecordingsModule,
    SpeechJobModule,
    StudentDashboardModule,
    AssessmentModule,
    SyncModule,
    TeacherToolsModule,
    InternalModule,
    // P2 stub modules expose routes but return PERSISTENCE_PENDING /
    // UNAVAILABLE / PROVIDER_NOT_CONFIGURED so they cannot block MVP.
    MvpGapsModule,
    // Keep security last so its APP_GUARD providers execute in the documented
    // authentication -> tenant -> policy order after feature composition.
    AuthModule,
  ],
})
export class AppModule {}