# B31-103 Schema Change Request

## Requester

- Task: b31-103 (Trae-4)
- Branch: `task/b31-103-admin-products`
- Date: 2026-07-11

## Summary

Add 10 new Prisma models and 7 new enums to support admin dashboard, curriculum governance, assessment content, recommendation rules, assessment links, product plans, privacy audit, and system providers.

## New Enums

```prisma
enum ProductPlanTier {
  INCLUSIVE
  PROFESSIONAL
  FLAGSHIP
}

enum RecommendationRuleStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum AssessmentMaterialType {
  READING
  WRITTEN_FORM
  DIMENSION
}

enum AssessmentMaterialStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum AssessmentLinkStatus {
  ACTIVE
  DISABLED
  EXPIRED
}

enum DeletionRequestStatus {
  PENDING
  APPROVED
  PROCESSING
  COMPLETED
  REJECTED
}

enum ProviderType {
  SPEECH
  LLM
  TRANSLATION
  EMBEDDING
  OTHER
}

enum ProviderHealthStatus {
  UNKNOWN
  HEALTHY
  DEGRADED
  DOWN
}
```

## New Models

### ProductPlan

```prisma
model ProductPlan {
  id              String          @id @default(uuid()) @db.Uuid
  tier            ProductPlanTier
  displayName     String
  description     String?
  priceMinCents   Int             @default(0)
  priceMaxCents   Int             @default(0)
  discountFactor  Int             @default(10000)
  serviceItems    Json?
  fundingSource   String?
  publicVersion   Int             @default(1)
  contractVersion Int             @default(1)
  isActive        Boolean         @default(true)
  effectiveFrom   DateTime?
  effectiveUntil  DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  versions        ProductPlanVersion[]
  schools         School[]

  @@index([tier, isActive])
  @@index([effectiveFrom, effectiveUntil])
}
```

- `discountFactor`: basis points (10000 = 1.0, 8500 = 0.85)
- `publicVersion`: version shown to consumers
- `contractVersion`: version schools sign (decoupled from public)

### ProductPlanVersion

```prisma
model ProductPlanVersion {
  id              String      @id @default(uuid()) @db.Uuid
  planId          String      @db.Uuid
  version         Int
  displayName     String
  priceMinCents   Int         @default(0)
  priceMaxCents   Int         @default(0)
  discountFactor  Int         @default(10000)
  serviceItems    Json?
  publishedAt     DateTime?
  createdAt       DateTime    @default(now())
  plan            ProductPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([planId, version])
  @@index([planId, publishedAt])
}
```

### RecommendationRule

```prisma
model RecommendationRule {
  id              String                  @id @default(uuid()) @db.Uuid
  issueCode       String
  dimensionCode   String
  severityMin     Int
  severityMax     Int
  courseVersionId String                  @db.Uuid
  priority        Int
  sessions        Int                     @default(1)
  reasonTemplate  String?
  validFrom       DateTime?
  validUntil      DateTime?
  version         Int                     @default(1)
  status          RecommendationRuleStatus @default(DRAFT)
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  @@index([issueCode, dimensionCode, status])
  @@index([status, priority])
  @@index([validFrom, validUntil])
}
```

- Conflict: same `issueCode` + `dimensionCode` + overlapping `[severityMin, severityMax]` + same `priority` = conflict (detected at service level, not DB constraint)

### AssessmentMaterial

```prisma
model AssessmentMaterial {
  id          String                  @id @default(uuid()) @db.Uuid
  schoolId    String                  @db.Uuid
  title       String
  type        AssessmentMaterialType
  content     Json?
  version     Int                     @default(1)
  status      AssessmentMaterialStatus @default(DRAFT)
  previewedAt DateTime?
  publishedAt DateTime?
  archivedAt  DateTime?
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt

  @@index([schoolId, type, status])
  @@index([schoolId, status])
}
```

### AssessmentLink

```prisma
model AssessmentLink {
  id                String             @id @default(uuid()) @db.Uuid
  schoolId          String             @db.Uuid
  assignmentId      String             @db.Uuid
  tokenHash         String             @unique
  status            AssessmentLinkStatus @default(ACTIVE)
  usageCount        Int                @default(0)
  expiresAt         DateTime?
  disabledAt        DateTime?
  regeneratedFromId String?            @db.Uuid
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@index([schoolId, assignmentId])
  @@index([schoolId, status])
  @@index([tokenHash])
  @@index([expiresAt])
}
```

- `tokenHash`: SHA-256 of the raw token; raw token never stored
- `regeneratedFromId`: tracks regeneration chain for audit

### RetentionPolicy

```prisma
model RetentionPolicy {
  id            String   @id @default(uuid()) @db.Uuid
  resourceType  String
  retentionDays Int
  description   String?
  effectiveFrom DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([resourceType])
  @@index([effectiveFrom])
}
```

### ConsentVersion

```prisma
model ConsentVersion {
  id           String   @id @default(uuid()) @db.Uuid
  purpose      String
  version      Int
  contentHash  String
  contentUrl   String?
  effectiveFrom DateTime @default(now())
  createdAt    DateTime @default(now())

  @@unique([purpose, version])
  @@index([purpose, effectiveFrom])
}
```

- Immutable once created; new versions are additive

### DataDeletionRequest

```prisma
model DataDeletionRequest {
  id          String               @id @default(uuid()) @db.Uuid
  userId      String               @db.Uuid
  schoolId    String?              @db.Uuid
  status      DeletionRequestStatus @default(PENDING)
  requestedAt DateTime             @default(now())
  approvedAt  DateTime?
  completedAt DateTime?
  notes       String?
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  @@index([userId, status])
  @@index([schoolId, status])
  @@index([status, requestedAt])
}
```

- State machine: PENDING → APPROVED → PROCESSING → COMPLETED (or PENDING → REJECTED)

### SystemProvider

```prisma
model SystemProvider {
  id            String              @id @default(uuid()) @db.Uuid
  type          ProviderType
  enabled       Boolean             @default(false)
  endpointAlias String?
  model         String?
  healthStatus  ProviderHealthStatus @default(UNKNOWN)
  configured    Boolean             @default(false)
  lastCheckedAt DateTime?
  lastError     String?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  secrets       SystemProviderSecret[]

  @@index([type, enabled])
  @@index([healthStatus])
}
```

### SystemProviderSecret

```prisma
model SystemProviderSecret {
  id         String         @id @default(uuid()) @db.Uuid
  providerId String         @db.Uuid
  secretKey  String
  createdAt  DateTime       @default(now())
  provider   SystemProvider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@index([providerId])
}
```

- NEVER returned by API; only used server-side for provider authentication

## Existing Model Changes

### School

Add `planId` field and relation:

```prisma
model School {
  // ... existing fields ...
  planId     String?       @db.Uuid
  plan       ProductPlan?  @relation(fields: [planId], references: [id])
  // ... existing relations ...

  @@index([planId])
}
```

## Backward Compatibility

- All new models are additive; no existing fields are removed or changed
- School.planId is optional (String?) — existing rows default to null
- Existing AuditLog model is not modified; audit module uses it read-only
- Existing CourseVersion + CourseReview models are not modified; governance module uses them read-write within existing fields

## Indexes

All indexes are listed inline with model definitions above. Key composite indexes:
- `ProductPlan`: [tier, isActive] for filtering by tier
- `RecommendationRule`: [issueCode, dimensionCode, status] for conflict detection queries
- `AssessmentMaterial`: [schoolId, type, status] for school-scoped content listing
- `AssessmentLink`: [schoolId, assignmentId] for link lookup by assignment
- `DataDeletionRequest`: [userId, status] for user-scoped deletion tracking

## Test Requirements

- All new models need CRUD integration tests against PostgreSQL
- Conflict detection for RecommendationRule tested at service level
- AssessmentLink token security tested at API level (no raw token in response)
- SystemProviderSecret never returned in any API response
- DataDeletionRequest state machine transitions tested
- ProductPlan monetary fields (cents) tested with boundary values
