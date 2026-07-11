# Backend binding map

| Area | Binding status | Boundary |
| --- | --- | --- |
| Login/session | EXISTING_API_NEEDS_REVIEW | existing auth/session gateways retained |
| School selection | WAITING_BACKEND_V31 | route absent at baseline; do not import static source schools |
| Course drafts/studio | EXISTING_API_NEEDS_REVIEW | existing curriculum gateway retained |
| Teacher assignments/classes/review | EXISTING_API_NEEDS_REVIEW | existing domain adapters retained |
| Student today | TEMPORARY_FIXTURE | fixture remains isolated under feature demo data |
| Learning player | TEMPORARY_FIXTURE | demo adapter remains separate from gateway |
| Speech capture | READY_REAL_API | browser recorder/local store exists; provider processing still unavailable |
| Assessment submission | EXISTING_API_NEEDS_REVIEW | current assessment gateway retained |
| AI assessment result | PROVIDER_NOT_CONFIGURED | never show formal score from source static report |
| Reports/growth | TEMPORARY_FIXTURE | demo is explicitly labelled; real binding pending |
| Admin | WAITING_BACKEND_V31 | most routes absent; no fields guessed |
| Volunteer | WAITING_BACKEND_V31 | training shell exists; service workflow pending |
| MindMate/MindGraph | PROVIDER_NOT_CONFIGURED | provider health must control availability |
| Tibetan translation | EXISTING_API_NEEDS_REVIEW | existing translation gateway retained |

No backend, OpenAPI, contracts, or database file was changed.

