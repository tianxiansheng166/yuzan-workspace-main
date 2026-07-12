# MVP Gaps — Backend V3.1 Integration

> These scopes are intentionally **not wired to real persistence** in the MVP integration branch.  
> Every listed endpoint is exposed and returns an explicit gap code so the frontend can render proper unavailable states.  
> **No fake success.**

---

## Gap response contract

All P2 endpoints return HTTP `503 Service Unavailable` with:

```json
{
  "error": {
    "code": "PERSISTENCE_PENDING" | "UNAVAILABLE" | "PROVIDER_NOT_CONFIGURED",
    "message": "Human-readable reason",
    "scope": "admin | audit | assessment | research | plans"
  },
  "meta": {
    "requestId": "mvp-gap-<scope>"
  }
}
```

---

## 1. Admin write persistence

**Scope:** `admin`  
**Gap code:** `PERSISTENCE_PENDING`

| Method | Path | Why stubbed |
|--------|------|-------------|
| GET | `/admin/schools` | School CRUD admin UI persistence pending |
| POST | `/admin/schools` | |
| GET | `/admin/schools/:id` | |
| PATCH | `/admin/schools/:id` | |
| DELETE | `/admin/schools/:id` | |
| GET | `/admin/users` | User/membership admin UI persistence pending |
| POST | `/admin/users/invitations` | |
| PATCH | `/admin/users/:id/membership` | |

**Frontend impact:** Admin pages render a placeholder/banner; writes are disabled.

---

## 2. Audit / provider real persistence

**Scope:** `audit`  
**Gap codes:** `PERSISTENCE_PENDING` (logs), `PROVIDER_NOT_CONFIGURED` (providers)

| Method | Path | Why stubbed |
|--------|------|-------------|
| GET | `/audit/logs` | Audit log search backend not yet integrated |
| GET | `/audit/providers` | External provider registry not configured |
| POST | `/audit/providers` | |
| GET | `/audit/providers/:id/health` | |
| PATCH | `/audit/providers/:id` | |

**Frontend impact:** Audit dashboard and provider management show "未配置" state.

---

## 3. Assessment incomplete persistence

**Scope:** `assessment`  
**Gap code:** `PERSISTENCE_PENDING`

| Method | Path | Why stubbed |
|--------|------|-------------|
| GET | `/assessments` | Assessment bank persistence incomplete |
| GET | `/assessments/:id` | |
| POST | `/assessments/:id/responses` | |
| GET | `/assessments/:id/results` | |

**Frontend impact:** Assessment pages are hidden or show "评估模块待接入".

---

## 4. Research governance persistence

**Scope:** `research`  
**Gap code:** `PERSISTENCE_PENDING`

| Method | Path | Why stubbed |
|--------|------|-------------|
| GET | `/research/governance/versions` | Research governance versioning backend pending |
| GET | `/research/governance/versions/:id` | |
| POST | `/research/governance/versions/:id/reviews` | |
| GET | `/research/governance/versions/:id/reviews` | |

**Frontend impact:** Research governance UI shows placeholder.

---

## 5. Plans public read

**Scope:** `plans`  
**Status:** READY (empty list)

`GET /plans` is implemented and returns an empty paginated list. It does not block MVP because no public plans are required for the first teaching loop.

---

## Resolution order (post-MVP)

1. Admin write persistence + invite flow
2. Audit log storage + provider registry
3. Assessment bank + response/results persistence
4. Research governance versioning + review workflow
5. Seed public plans content when product is ready
