# Remaining API lint debt after T055

The unmodified full API lint command reports 1,213 errors, 0 warnings, and 0 parser errors. The complete rule, location, and message record is in [api-lint-after.json](api-lint-after.json).

| File | Errors | Rule counts |
|---|---:|---|
| `src/modules/curriculum/ports/prisma-course-version.repository.ts` | 1 | no-empty-object-type 1 |
| `test/ai-lesson-planning/ai-lesson-planning.spec.ts` | 42 | no-unsafe-argument 23, no-unsafe-assignment 7, no-explicit-any 4, no-unsafe-return 2, no-unsafe-call 2, no-unused-vars 2, no-unsafe-function-type 1, require-await 1 |
| `test/auth/helpers/fake-adapters.ts` | 13 | require-await 13 |
| `test/auth/helpers/mock-execution-context.ts` | 3 | no-unused-vars 3 |
| `test/auth/identity.controller.spec.ts` | 4 | no-unsafe-assignment 3, require-await 1 |
| `test/auth/identity.service.spec.ts` | 1 | no-unused-vars 1 |
| `test/classes/classes.supplementary-practice.spec.ts` | 53 | no-unsafe-member-access 20, no-unsafe-assignment 14, no-explicit-any 9, require-await 5, no-unsafe-argument 3, no-unsafe-return 1, no-unused-vars 1 |
| `test/curriculum/curriculum.controller.spec.ts` | 13 | unbound-method 8, no-unsafe-assignment 3, no-unused-vars 1, no-unnecessary-type-assertion 1 |
| `test/curriculum/curriculum.service.spec.ts` | 1 | no-unused-vars 1 |
| `test/curriculum/fakes/fake-course-version.repository.ts` | 5 | require-await 5 |
| `test/curriculum/fakes/fake-resource-lookup.adapter.ts` | 2 | require-await 2 |
| `test/curriculum/fixtures/course-versions.ts` | 1 | no-unnecessary-type-assertion 1 |
| `test/curriculum/publishing.validator.spec.ts` | 1 | no-unsafe-assignment 1 |
| `test/database/database-runtime.integration.spec.ts` | 1 | require-await 1 |
| `test/helpers/fake-prisma.service.ts` | 6 | no-unnecessary-type-assertion 3, no-redundant-type-constituents 1, no-unused-vars 1, require-await 1 |
| `test/helpers/fake-storage.port.ts` | 5 | require-await 5 |
| `test/integration/identity/prisma-identity.repository.spec.ts` | 103 | no-unsafe-member-access 45, no-unsafe-call 34, no-unsafe-assignment 17, no-unsafe-argument 4, no-unsafe-return 3 |
| `test/modules/admin/admin-stub.controller.spec.ts` | 406 | no-unsafe-member-access 175, no-unsafe-call 105, no-unsafe-assignment 65, no-unsafe-argument 43, no-explicit-any 13, no-unsafe-return 2, no-unused-vars 2, require-await 1 |
| `test/modules/admin/assessment-link.controller.spec.ts` | 21 | no-unsafe-member-access 8, no-unsafe-assignment 4, no-unsafe-call 4, no-explicit-any 2, no-unsafe-argument 2, no-unsafe-return 1 |
| `test/modules/admin/audit-stub.controller.spec.ts` | 13 | no-unsafe-assignment 4, no-explicit-any 3, no-unsafe-argument 3, no-unsafe-member-access 3 |
| `test/modules/admin/invite-redeem.controller.spec.ts` | 11 | no-unsafe-argument 4, no-explicit-any 4, no-unsafe-assignment 3 |
| `test/modules/admin/plans-stub.controller.spec.ts` | 5 | no-unsafe-assignment 2, no-explicit-any 1, no-unsafe-argument 1, no-unsafe-member-access 1 |
| `test/modules/assignments/assignments.service.spec.ts` | 17 | require-await 8, no-unsafe-member-access 4, no-explicit-any 2, no-unsafe-return 1, no-unsafe-call 1, no-unsafe-assignment 1 |
| `test/modules/assignments/fakes/fake-assignment.repository.ts` | 9 | require-await 7, no-unused-vars 2 |
| `test/modules/assignments/prisma-assignment.repository.spec.ts` | 4 | no-unsafe-assignment 2, no-unsafe-member-access 2 |
| `test/modules/assignments/publishing.spec.ts` | 7 | require-await 5, no-unused-vars 1, no-unsafe-member-access 1 |
| `test/modules/community/community.service.spec.ts` | 5 | no-unused-vars 3, no-unnecessary-type-assertion 2 |
| `test/modules/community/fakes/fake-community.repository.ts` | 12 | require-await 11, prefer-const 1 |
| `test/modules/cooperation/cooperation.service.spec.ts` | 1 | no-unused-vars 1 |
| `test/modules/cooperation/fakes/fake-cooperation.repository.ts` | 12 | require-await 12 |
| `test/modules/cooperation/fixtures/users.ts` | 1 | no-unused-vars 1 |
| `test/modules/feedback/fakes/fake-feedback.repository.ts` | 4 | require-await 4 |
| `test/modules/feedback/feedback.service.spec.ts` | 3 | require-await 3 |
| `test/modules/learning/fakes/fake-learning.repository.ts` | 3 | require-await 3 |
| `test/modules/learning/learning.service.spec.ts` | 8 | require-await 7, no-unused-vars 1 |
| `test/modules/pilot/pilot-feedback.service.spec.ts` | 3 | no-unsafe-assignment 2, no-unsafe-member-access 1 |
| `test/modules/pilot/pilot-health.spec.ts` | 2 | require-await 1, no-unsafe-return 1 |
| `test/modules/pilot/pilot-observability.service.spec.ts` | 2 | require-await 2 |
| `test/modules/submissions/fakes/fake-submission-lookup.repository.ts` | 3 | require-await 2, no-unused-vars 1 |
| `test/modules/submissions/fakes/fake-submission.repository.ts` | 6 | require-await 6 |
| `test/modules/submissions/submissions.service.spec.ts` | 6 | no-explicit-any 2, require-await 2, no-unsafe-member-access 2 |
| `test/modules/support-pairings/fakes/fake-support-pairing.repository.ts` | 9 | require-await 9 |
| `test/modules/support-pairings/fixtures/users.ts` | 1 | no-unused-vars 1 |
| `test/modules/tools/fakes/fake-tool.repository.ts` | 9 | require-await 9 |
| `test/modules/tools/fixtures/users.ts` | 1 | no-unused-vars 1 |
| `test/modules/training/fakes/fake-training.repository.ts` | 16 | require-await 16 |
| `test/modules/training/fixtures/users.ts` | 1 | no-unused-vars 1 |
| `test/modules/training/training.service.spec.ts` | 7 | no-unsafe-argument 2, no-unnecessary-type-assertion 2, no-explicit-any 2, no-unused-vars 1 |
| `test/modules/translations/fakes/fake-translation.repository.ts` | 10 | require-await 8, no-unused-vars 2 |
| `test/modules/translations/fixtures/users.ts` | 1 | no-unused-vars 1 |
| `test/modules/translations/translations.service.spec.ts` | 14 | no-unused-vars 8, require-await 6 |
| `test/modules/volunteers/fakes/fake-volunteer.repository.ts` | 11 | require-await 11 |
| `test/modules/volunteers/fixtures/users.ts` | 1 | no-unused-vars 1 |
| `test/modules/volunteers/volunteers.service.spec.ts` | 6 | no-unused-vars 6 |
| `test/offline/offline.service.spec.ts` | 4 | unbound-method 4 |
| `test/operations/__mocks__/@yuzan/database.ts` | 9 | no-unsafe-assignment 3, no-unsafe-call 3, no-unsafe-member-access 3 |
| `test/organizations/classes.controller.spec.ts` | 7 | no-unused-vars 3, no-unsafe-assignment 1, unbound-method 1, require-await 1, no-unsafe-argument 1 |
| `test/organizations/classes.teacher-scope.spec.ts` | 24 | no-explicit-any 9, no-unsafe-argument 9, no-unsafe-assignment 3, no-unsafe-member-access 3 |
| `test/organizations/fakes/fake-class.repository.ts` | 5 | require-await 4, no-unsafe-enum-comparison 1 |
| `test/organizations/fakes/fake-membership.repository.ts` | 5 | require-await 3, no-unused-vars 2 |
| `test/organizations/fakes/fake-school.repository.ts` | 2 | require-await 2 |
| `test/organizations/fixtures/memberships.ts` | 2 | no-unused-vars 2 |
| `test/organizations/organizations.controller.spec.ts` | 9 | unbound-method 4, no-unused-vars 3, require-await 1, no-unsafe-assignment 1 |
| `test/pilot/pilot.runtime.integration.spec.ts` | 4 | prefer-const 2, require-await 2 |
| `test/root/app-composition.spec.ts` | 1 | unbound-method 1 |
| `test/student-courses/student-courses.service.spec.ts` | 62 | no-explicit-any 25, no-unsafe-argument 17, no-unsafe-member-access 11, no-unsafe-assignment 4, no-unsafe-call 4, no-unnecessary-type-assertion 1 |
| `test/teacher-invitations/teacher-invitations.service.spec.ts` | 124 | no-unsafe-member-access 45, no-unsafe-argument 26, no-unsafe-call 24, no-unsafe-assignment 22, no-explicit-any 5, require-await 1, no-unsafe-return 1 |
| `test/teacher/teacher-dashboard.service.spec.ts` | 49 | no-unsafe-member-access 22, no-unsafe-call 12, no-unsafe-argument 6, no-explicit-any 5, no-unsafe-assignment 3, no-unsafe-return 1 |
