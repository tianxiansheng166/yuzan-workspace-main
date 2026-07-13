# Contract Change Request

- Request ID: CCR-INITIAL-PRODUCT-002-P1-ROUTE-DRIFT
- Requester / Task: integration controller / INITIAL_PRODUCT_RECOVERY_AND_INTEGRATION_002
- Date: 2026-07-13
- Status: PARTIALLY_RESOLVED

## Current contract

`docs/09-operations/backend-v31-wave/FRONTEND-BINDING.md` and API readiness name `/learning/today`, `GET /learning/activities/:activityId`, POST progress, PATCH class/assignment and `/course-versions/:versionId/publish`.

The executable controllers at base `ed8d5d4c5682b52400b97e207a02a6aba4860ba7` expose `/learning/tasks`, `/learning/tasks/:assignmentId`, GET/PUT `/learning/activities/:activityId/progress`, POST class/assignment updates and originally exposed the unreachable `/course-versions/:versionId:publish` form. Generated OpenAPI does not cover all READY modules.

## Problem

A frontend following the written binding document cannot call several current controllers. Guessing aliases would conceal a real shared-fact conflict and break browser smoke verification.

## Proposed change

Contract owner decides the canonical P1 route/method set, then updates controllers, generated OpenAPI and frontend binding together. Until then, this task records and uses executable controller paths in isolated live adapters without editing shared contract files.

## Compatibility

- Breaking: potentially, if a canonical path replaces an already consumed controller path.
- Existing clients: unknown; search required before decision.
- Data migration: none.
- Feature flag: not applicable.

## Affected tasks/files

Learning, classes, assignments, curriculum publish, generated OpenAPI, frontend live adapters and smoke tests.

## Alternatives considered

Creating frontend-only fake aliases was rejected because it would not represent the running backend. Editing shared controller/OpenAPI facts in this integration task was rejected pending owner approval.

## Decision

CP7 aligned curriculum publication to the documented and generated `/:courseVersionId/publish` path and added controller coverage. Learning and class/assignment method drift remains pending Contract Owner / Domain Owner review. Publication still returns truthful 503 because resource lookup is provider-unavailable; route alignment does not imply functional readiness.
