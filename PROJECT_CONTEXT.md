# 语赞心声 project context

## Product

语赞心声 is a learning, practice, and leveled assessment platform for Tibetan primary
and secondary students learning the national common language and Mandarin. Students are
the core users; teachers, volunteers, and administrators support them. Its distinction
is Tibetan–Chinese bilingual support, language-background adaptation, culturally
relevant contexts, and a learning → practice → assessment → feedback loop.

The current product priority is a real question bank with student practice and
assessment—not community, commerce, or a general agent platform.

## Current architecture

Keep the existing stack: `frontend/`, NestJS API (`backend/api/`), Prisma/PostgreSQL,
Redis/BullMQ, MinIO, `backend/worker/`, and `backend/speech-scoring/`. Do not replace
the stack as part of ordinary feature work.

Question-bank execution is deliberately versioned:

```text
QuestionBankItem → QuestionBankItemVersion → Resource
PracticeDefinition → PracticeVersion → PracticeSection → PracticeItemRef
AssessmentSession → AssessmentItem → Answer / Recording → Scoring → Report
```

Items have stable identities and immutable versions. A practice is composition; an
`AssessmentItem` is an execution snapshot.

## Speech diagnostics and human review

Speech task strategy is authoritative in the published question-version
`scoringSpec`. `SPEECH_READING` may use the experimental local read-aloud
diagnostic, while `SPEECH_OPEN_RESPONSE` (picture speaking) must use a separate
open-response diagnostic with no target text and no target-relative semantic
score. Both paths retain only bounded student-safe evidence and leave the
formal `AssessmentItem.scoredScore` null until review.

The generic teacher review workflow is limited to `RUBRIC_TEXT`,
`SPEECH_READING`, and `SPEECH_OPEN_RESPONSE`. Review authorization is
same-school and class-scoped; formal scores are bounded by the persisted item
maximum, repeat submissions are idempotent, and a Question Bank session is
finalized only when every required item has a formal score. Completed reports
aggregate authored points rather than legacy item averages.

## Student delivery and runner

`deliverySpec` is browser-safe. `scoringSpec`, standard answers, rubrics, and
`correctAnswer` are server-only and must never enter student payloads.

The unified student runner composes each question from a stimulus and a response rather
than creating a page per question type:

- Stimulus: `TEXT`, `IMAGE`, `AUDIO`
- Response: `CHOICE`, `TEXT`, `SPEECH`

Current formal question families, in learning order:

| Skill | Families |
| --- | --- |
| Listen | Listen-and-choose-picture; sentence dictation |
| Speak | Read aloud; picture description |
| Read | Word recognition; sentence comprehension |
| Write | Picture-to-word; sentence completion/rewrite |

## Content sources

The question Word document, answer/rubric Word document, and media ZIP are authoring
and import sources. Runtime content lives in the database plus `Resource`/MinIO; it
must not directly depend on Word or ZIP files.
