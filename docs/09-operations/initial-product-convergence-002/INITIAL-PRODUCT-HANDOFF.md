# Initial product handoff

## Delivered

- CP0 preserved the dirty main checkout and recovered b31-102, b31-105 and every discovered dirty worktree before integration.
- CP1-CP3 selectively adopted auth, school selection and teacher/student core pages onto the backend base without merging the complete frontend branch.
- CP4 adjudicated all seven VM routes, ported five route compositions and five controlled assets, and rejected VM business data and standalone runtime code.
- CP5 formed public, student, teacher and operations navigation families. CP6 classified recovered backend work without integrating unavailable assessment scaffolds.
- CP7 repaired live curriculum routing, assignment target persistence, reporting reads and feedback ownership, then passed web/API/contracts builds and the recorded browser route/viewport smoke.

## Delivery state

The result is a startable initial product with real authentication, school context, plans, teacher/student reads and several real writes. It is not `INITIAL_PRODUCT_RECOVERY_AND_INTEGRATION_002_READY`: volunteer persistence is absent and the full teacher-student loop needs test-only state transitions. Admin, research and assessment remain deliberately truthful gaps.

No whole frontend merge, destructive Git command, image generation, ZIP commit, schema/migration change, package-manifest change or lockfile change was made. The dirty main checkout remains outside this worktree.

## Next wave, in order

1. Implement volunteer/training/support-pairing PostgreSQL repositories and migrations, with school scope and module tests.
2. Add explicit assignment scheduling and submission review transitions; expand class targets to enrollments.
3. Define first-progress creation context and repair the teacher feedback form dispatch, then rerun the uninterrupted browser loop.
4. Replace curriculum resource lookup unavailable adapter or make empty-resource publication contractually valid.
5. Restore only the five `READY_FOR_RESTORE` images after live-binding blockers, then the three `WAITING_LIVE_BINDING` items. Do not regenerate images.

Recommended ownership is one backend worker for volunteer persistence, one backend worker for learning/assignment state transitions, one frontend worker for feedback/progress UI, and this integration controller as the sole consumer of exact reviewed commits.
