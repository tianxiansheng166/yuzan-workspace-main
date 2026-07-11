# Schema Change Request — b31-104

**Branch:** `task/b31-104-volunteer-tools-community`
**Author:** TRAE-5 Implementation
**Date:** 2026-07-11

## Summary

Add Prisma models for 7 new NestJS modules: Volunteers, Training, Support-Pairings, Tools, Translations, Community, and Cooperation.

---

## New Enums

```prisma
enum VolunteerStatus {
  APPLIED
  SCREENING
  ACCEPTED
  TRAINING_REQUIRED
  TRAINING_IN_PROGRESS
  EXAM_READY
  QUALIFIED
  ACTIVE
  SUSPENDED
  LEFT
}

enum ServiceType {
  TUTORING
  COUNSELING
  TRANSLATION_SUPPORT
  OTHER
}

enum TrainingProgramStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum TrainingEnrollmentStatus {
  ENROLLED
  IN_PROGRESS
  COMPLETED
  FAILED
  CANCELLED
}

enum TrainingExamStatus {
  SCHEDULED
  IN_PROGRESS
  PASSED
  FAILED
}

enum ConsentStatus {
  PENDING
  GRANTED
  DENIED
  REVOKED
}

enum PairingStatus {
  PENDING_CONSENT
  ACTIVE
  PAUSED
  ENDED
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum TeacherReviewStatus {
  PENDING
  REVIEWED
  FLAGGED
}

enum IntegrationKey {
  MINDMATE
  MINDGRAPH
  TIBETAN_TRANSLATION
}

enum IntegrationMode {
  DISABLED
  INFO_PAGE
  EXTERNAL_LINK
}

enum IntegrationStatus {
  OPERATIONAL
  DEGRADED
  PROVIDER_UNAVAILABLE
  OFFLINE
}

enum MindGraphJobStatus {
  CREATED
  QUEUED
  RUNNING
  READY
  PROVIDER_UNAVAILABLE
  FAILED
  CANCELLED
}

enum TranslationStatus {
  CREATED
  QUEUED
  PROCESSING
  COMPLETED
  PROVIDER_UNAVAILABLE
  FAILED
}

enum SupportedLanguage {
  BO
  ZH
}

enum ContentStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  HIDDEN
  REJECTED
}

enum ContentType {
  TEXT
  AUDIO
  VIDEO
  IMAGE
}

enum ReportReason {
  INAPPROPRIATE
  OFFENSIVE
  PRIVACY_VIOLATION
  MISINFORMATION
  OTHER
}

enum ReportStatus {
  PENDING
  REVIEWED
  DISMISSED
}

enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  NEGOTIATING
  CLOSED_WON
  CLOSED_LOST
}

enum ApplicationStatus {
  PENDING
  UNDER_REVIEW
  APPROVED
  REJECTED
  WITHDRAWN
}

enum VolunteerAppStatus {
  PENDING
  SCREENING
  ACCEPTED
  REJECTED
}
```

---

## New Models

### Volunteer

```prisma
model Volunteer {
  id              String         @id @default(uuid()) @db.Uuid
  schoolId        String         @db.Uuid
  userId          String         @db.Uuid
  displayName     String
  phone           String
  email           String?
  experience      String?
  qualifications  String[]
  status          VolunteerStatus @default(APPLIED)
  appliedAt       DateTime       @default(now())
  qualifiedAt     DateTime?
  suspendedReason String?
  revision        Int            @default(1)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  school          School         @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@unique([schoolId, id])
  @@unique([schoolId, userId])
  @@index([schoolId, status])
}

model VolunteerServiceTask {
  id                   String      @id @default(uuid()) @db.Uuid
  schoolId             String      @db.Uuid
  title                String
  serviceType          ServiceType
  classId              String?     @db.Uuid
  studentScope         String
  supervisorTeacherId  String      @db.Uuid
  requiredQualification String
  assignedVolunteerId  String?     @db.Uuid
  status               String      @default("OPEN")
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt

  @@unique([schoolId, id])
  @@index([schoolId, assignedVolunteerId])
  @@index([schoolId, status])
}

model IncidentReport {
  id                String   @id @default(uuid()) @db.Uuid
  schoolId          String   @db.Uuid
  type              String
  severity          String
  description       String
  immediateAction   String?
  studentRef        String?
  assignedReviewerId String?  @db.Uuid
  status            String   @default("OPEN")
  resolution        String?
  reportedBy        String   @db.Uuid
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([schoolId, id])
  @@index([schoolId, severity, status])
}
```

### Training

```prisma
model TrainingProgram {
  id          String                @id @default(uuid()) @db.Uuid
  schoolId    String                @db.Uuid
  title       String
  description String?
  status      TrainingProgramStatus @default(DRAFT)
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  modules     TrainingModule[]
  enrollments TrainingEnrollment[]

  @@unique([schoolId, id])
  @@index([schoolId, status])
}

model TrainingModule {
  id          String   @id @default(uuid()) @db.Uuid
  programId   String   @db.Uuid
  title       String
  description String?
  sortOrder   Int
  durationMins Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  program     TrainingProgram @relation(fields: [programId], references: [id], onDelete: Cascade)

  @@unique([programId, sortOrder])
}

model TrainingEnrollment {
  id         String                  @id @default(uuid()) @db.Uuid
  schoolId   String                  @db.Uuid
  programId  String                  @db.Uuid
  volunteerId String                 @db.Uuid
  status     TrainingEnrollmentStatus @default(ENROLLED)
  enrolledAt DateTime                @default(now())
  completedAt DateTime?
  createdAt  DateTime                @default(now())
  updatedAt  DateTime                @updatedAt

  program    TrainingProgram         @relation(fields: [programId], references: [id])
  progress   TrainingProgress[]
  exams      TrainingExam[]

  @@unique([schoolId, id])
  @@unique([programId, volunteerId])
  @@index([volunteerId, status])
}

model TrainingProgress {
  id           String   @id @default(uuid()) @db.Uuid
  enrollmentId String   @db.Uuid
  moduleId     String   @db.Uuid
  completed    Boolean  @default(false)
  completedAt  DateTime?
  updatedAt    DateTime @updatedAt

  enrollment   TrainingEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@unique([enrollmentId, moduleId])
}

model TrainingExam {
  id           String             @id @default(uuid()) @db.Uuid
  enrollmentId String             @db.Uuid
  status       TrainingExamStatus @default(SCHEDULED)
  scheduledAt  DateTime
  completedAt  DateTime?
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  enrollment   TrainingEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  attempts     TrainingExamAttempt[]

  @@unique([enrollmentId, id])
}

model TrainingExamAttempt {
  id        String   @id @default(uuid()) @db.Uuid
  examId    String   @db.Uuid
  score     Float?
  passed    Boolean?
  answers   Json?
  createdAt DateTime @default(now())

  exam      TrainingExam @relation(fields: [examId], references: [id], onDelete: Cascade)

  @@index([examId])
}
```

### Support Pairings

```prisma
model SupportPairing {
  id                   String        @id @default(uuid()) @db.Uuid
  schoolId             String        @db.Uuid
  studentUserId        String        @db.Uuid
  volunteerUserId      String        @db.Uuid
  supervisorTeacherId  String        @db.Uuid
  consentStatus        ConsentStatus @default(PENDING)
  goal                 String
  status               PairingStatus @default(PENDING_CONSENT)
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt

  sessions             SupportSession[]

  @@unique([schoolId, id])
  @@index([schoolId, studentUserId])
  @@index([schoolId, volunteerUserId])
}

model SupportSession {
  id                   String               @id @default(uuid()) @db.Uuid
  pairingId            String               @db.Uuid
  scheduledAt          DateTime
  summary              String?
  nextStep             String?
  riskLevel            RiskLevel            @default(LOW)
  teacherReviewStatus  TeacherReviewStatus  @default(PENDING)
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  pairing              SupportPairing       @relation(fields: [pairingId], references: [id], onDelete: Cascade)

  @@unique([pairingId, id])
  @@index([riskLevel, teacherReviewStatus])
}
```

### Tools

```prisma
model IntegrationConfig {
  id            String            @id @default(uuid()) @db.Uuid
  schoolId      String            @db.Uuid
  key           IntegrationKey
  enabled       Boolean           @default(false)
  mode          IntegrationMode    @default(DISABLED)
  publicUrl     String?
  providerKey   String?
  status        IntegrationStatus @default(OPERATIONAL)
  lastCheckedAt DateTime?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  mindGraphJobs MindGraphJob[]

  @@unique([schoolId, key])
  @@index([schoolId, enabled])
}

model MindGraphJob {
  id            String             @id @default(uuid()) @db.Uuid
  schoolId      String             @db.Uuid
  configId      String             @db.Uuid
  status        MindGraphJobStatus @default(CREATED)
  inputPayload  Json?
  resultPayload Json?
  errorCode     String?
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  config        IntegrationConfig  @relation(fields: [configId], references: [id], onDelete: Cascade)

  @@unique([schoolId, id])
  @@index([configId, status])
}

model ClickAuditEntry {
  id              String         @id @default(uuid()) @db.Uuid
  schoolId        String         @db.Uuid
  integrationKey  IntegrationKey
  userId          String         @db.Uuid
  action          String
  targetUrl       String?
  createdAt       DateTime       @default(now())

  @@index([schoolId, integrationKey, createdAt])
}
```

### Translations

```prisma
model TranslationJob {
  id                  String            @id @default(uuid()) @db.Uuid
  schoolId            String            @db.Uuid
  sourceLanguage      SupportedLanguage
  targetLanguage      SupportedLanguage
  sourceTextHash      String
  sourceTextEncrypted String
  status              TranslationStatus @default(CREATED)
  provider            String?
  resultText          String?
  glossaryVersion     Int               @default(1)
  errorCode           String?
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  @@unique([schoolId, id])
  @@index([schoolId, status])
  @@index([sourceTextHash])
}

model GlossaryEntry {
  id              String            @id @default(uuid()) @db.Uuid
  schoolId        String            @db.Uuid
  term            String
  sourceLanguage  SupportedLanguage
  targetLanguage  SupportedLanguage
  translation     String
  category        String
  version         Int               @default(1)
  createdAt       DateTime          @default(now())

  @@unique([schoolId, term, sourceLanguage, targetLanguage])
  @@index([schoolId, category])
}
```

### Community

```prisma
model CommunityPost {
  id                   String        @id @default(uuid()) @db.Uuid
  schoolId             String        @db.Uuid
  authorUserId         String        @db.Uuid
  title                String
  contentType          ContentType
  content              String
  attachmentObjectKey  String?
  status               ContentStatus @default(DRAFT)
  publishedAt          DateTime?
  reviewedBy           String?       @db.Uuid
  reviewedAt           DateTime?
  reviewNote           String?
  visibilityScope      String
  revision             Int           @default(1)
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt

  comments             PostComment[]
  reports              ContentReport[]

  @@unique([schoolId, id])
  @@index([schoolId, status, createdAt])
  @@index([authorUserId])
}

model PostComment {
  id        String   @id @default(uuid()) @db.Uuid
  postId    String   @db.Uuid
  authorUserId String @db.Uuid
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  post      CommunityPost @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([postId, id])
  @@index([postId, createdAt])
}

model ContentReport {
  id             String       @id @default(uuid()) @db.Uuid
  schoolId       String       @db.Uuid
  postId         String       @db.Uuid
  reporterUserId String       @db.Uuid
  reason         ReportReason
  description    String?
  status         ReportStatus @default(PENDING)
  reviewedBy     String?      @db.Uuid
  reviewedAt     DateTime?
  createdAt      DateTime     @default(now())

  post           CommunityPost @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([schoolId, id])
  @@index([schoolId, status])
}
```

### Cooperation

```prisma
model CooperationLead {
  id                  String     @id @default(uuid()) @db.Uuid
  organizationName    String
  contactName         String
  contactChannel      String
  region              String?
  schoolType          String?
  interestedPlan      String?
  needs               String?
  consent             Boolean
  status              LeadStatus @default(NEW)
  assignedOperatorId  String?    @db.Uuid
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt

  @@index([status, createdAt])
}

model SupportApplication {
  id                String            @id @default(uuid()) @db.Uuid
  schoolId          String?           @db.Uuid
  organizationName  String?
  guardianName       String
  guardianContact    String
  needCategory      String
  description       String
  consent           Boolean
  status            ApplicationStatus @default(PENDING)
  reviewedBy        String?          @db.Uuid
  reviewedAt        DateTime?
  reviewNote        String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([schoolId, status])
  @@index([needCategory])
}

model VolunteerApplication {
  id            String              @id @default(uuid()) @db.Uuid
  applicantName String
  contactInfo   String
  experience    String?
  availability  String?
  motivation    String?
  consent       Boolean
  status        VolunteerAppStatus  @default(PENDING)
  reviewedBy    String?             @db.Uuid
  reviewedAt    DateTime?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  @@index([status, createdAt])
}
```

---

## School Model Updates

Add these relations to the existing `School` model:

```prisma
model School {
  // ... existing fields ...
  volunteers           Volunteer[]
  serviceTasks         VolunteerServiceTask[]
  incidentReports      IncidentReport[]
  trainingPrograms     TrainingProgram[]
  supportPairings      SupportPairing[]
  integrationConfigs   IntegrationConfig[]
  translationJobs      TranslationJob[]
  glossaryEntries      GlossaryEntry[]
  communityPosts       CommunityPost[]
  contentReports       ContentReport[]
}
```
