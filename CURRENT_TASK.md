# CURRENT TASK

Task: QB-003B — Next source-to-manifest checkpoint
Status: TODO

## Recovery state

QB-003A-F is complete and pushed in the preceding checkpoint. The strict question
importer now produces a source-traceable manifest, binds Answer DOCX groups and
rubrics into `scoringSpec`, and has synthetic behavioral coverage. No QB-003B
implementation has started.

The current source remains structurally incomplete at Level 2 `READ_ALOUD`: the
structure expects 3 questions and the authored body contains 2. Preserve the
fail-closed behavior and do not invent a third question.

## Next task boundary

When QB-003B is explicitly started, first load its task-specific requirements and
the live Git state. Do not perform database writes, MinIO writes, formal
`QuestionBankItem` creation, media upload, or Level 1 Practice creation as part of
this recovery note.

## Protected paths

Continue protecting the existing dirty `pnpm-workspace.yaml` and the unrelated
paths listed in the previous handoff. Use path-scoped staging only.
