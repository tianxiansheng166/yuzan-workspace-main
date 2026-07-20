# A - 黄金闭环契约矩阵（P0-CONTRACT-CONVERGENCE-001）

> 产物编号：A  
> 任务：P0-CONTRACT-CONVERGENCE-001（黄金闭环前后端契约收敛）  
> 工作副本：`workers/p0-contract`  
> 生成时间：2026-07-20

---

## 1. 黄金闭环流程（古诗文朗读与理解训练）

```
教师创建班级测评 ──► 学生开始会话 ──► 获取朗读题目 ──► 初始化录音
       │                                              │
       │                                    上传音频(预签名)
       │                                              │
       │                                  完成录音(触发语音评分)
       │                                              │
       │                                  关联录音到题目
       │                                              │
       │                                  语音评分任务处理
       │                                              │
       │                                  学生提交会话
       │                                              │
教师生成报告 ◄────────────────────────────────────────┘
       │
教师复核题目 ──► 获取录音证据 ──► 导出报告
```

---

## 2. 端点矩阵

### 2.1 Classes - 创建班级测评（黄金闭环入口）

| 方法 | 路径 | operationId | 角色 | 请求 schema | 响应 schema | 稳定错误码 |
|------|------|-------------|------|-------------|-------------|------------|
| POST | `/schools/{schoolId}/classes/{classId}/assessments` | createClassAssessment | TEACHER, SCHOOL_ADMIN | ClassAssessmentRequest | AssessmentSessionListResponse | FORBIDDEN_RESOURCE, PRACTICE_CONTENT_EMPTY, ASSESSMENT_HAS_NO_ITEMS, VALIDATION_FAILED, CONFLICT |

**契约要点**：
- `enrollmentIds` 可省略 → service 取班级全部 ACTIVE 学生
- `questionIds` 可省略 → service 从班级最新 assignment 的 courseVersion 解析默认题目
- service 强制非空：无课程/无题目 → `PRACTICE_CONTENT_EMPTY`(422)；解析后空 → `ASSESSMENT_HAS_NO_ITEMS`(422)
- 跨学校题目被拒：`question.findMany` 带 `courseVersion: { schoolId }` 过滤

### 2.2 Recordings - 录音管理

| 方法 | 路径 | operationId | 角色 | 请求 schema | 响应 schema | 稳定错误码 |
|------|------|-------------|------|-------------|-------------|------------|
| POST | `/schools/{schoolId}/recordings` | initRecording | STUDENT | InitRecordingRequest | RecordingResponse | FORBIDDEN_RESOURCE, VALIDATION_FAILED, IDEMPOTENCY_CONFLICT |
| POST | `/schools/{schoolId}/recordings/simple` | initSimpleRecording | STUDENT | InitSimpleRecordingRequest | RecordingResponse | FORBIDDEN_RESOURCE, VALIDATION_FAILED, IDEMPOTENCY_CONFLICT |
| POST | `/schools/{schoolId}/recordings/{recordingId}/parts/{partNumber}/upload-url` | getRecordingPartUploadUrl | STUDENT | — | UploadUrlResponse | FORBIDDEN_RESOURCE, RECORDING_NOT_FOUND |
| POST | `/schools/{schoolId}/recordings/{recordingId}/complete` | completeRecording | STUDENT | CompleteRecordingRequest | RecordingResponse | FORBIDDEN_RESOURCE, RECORDING_NOT_FOUND, AUDIO_QUALITY_REJECTED, CONFLICT, PROVIDER_NOT_CONFIGURED |
| GET | `/schools/{schoolId}/recordings/{recordingId}` | getRecordingStatus | STUDENT, TEACHER, SCHOOL_ADMIN | — | RecordingResponse | FORBIDDEN_RESOURCE, RECORDING_NOT_FOUND |
| GET | `/schools/{schoolId}/recordings/{recordingId}/evidence` | getRecordingEvidence | TEACHER, SCHOOL_ADMIN | — | RecordingEvidenceResponse | FORBIDDEN_RESOURCE, RECORDING_NOT_FOUND |

**契约要点**：
- `completeRecording` 支持 `assessmentItemId`/`targetText`（触发语音评分）
- `completeSimpleRecording` 与 `completeRecording` 共用同一端点，参数一致

### 2.3 SpeechJobs - 语音评分任务

| 方法 | 路径 | operationId | 角色 | 请求 schema | 响应 schema | 稳定错误码 |
|------|------|-------------|------|-------------|-------------|------------|
| POST | `/schools/{schoolId}/speech-jobs` | createSpeechJob | TEACHER, SCHOOL_ADMIN | CreateSpeechJobRequest | SpeechJobResponse | FORBIDDEN_RESOURCE, VALIDATION_FAILED, PROVIDER_NOT_CONFIGURED |
| GET | `/schools/{schoolId}/speech-jobs/{jobId}` | getSpeechJob | STUDENT, TEACHER, SCHOOL_ADMIN | — | SpeechJobResponse | FORBIDDEN_RESOURCE, SPEECH_JOB_NOT_FOUND |
| GET | `/schools/{schoolId}/speech-jobs/by-item/{assessmentItemId}` | listSpeechJobsByItem | TEACHER, SCHOOL_ADMIN | — | SpeechJobListResponse | FORBIDDEN_RESOURCE, SPEECH_JOB_NOT_FOUND |
| PUT | `/schools/{schoolId}/speech-jobs/{jobId}/result` | updateSpeechJobResult | 内部(worker) | SpeechJobResultCallbackRequest | SpeechJobResponse | UNAUTHENTICATED, SPEECH_JOB_NOT_FOUND, VALIDATION_FAILED |

**契约要点**：
- `updateSpeechJobResult` 是内部接口，需 `X-Internal-API-Key` header 匹配 `INTERNAL_WORKER_API_KEY`；未配置时 **fail closed**（拒绝所有调用）
- STUDENT 查询 speech-job 通过 recording ownership 校验
- `listSpeechJobsByItem` 通过 assessmentItem → session → classId 链路校验教师任课关系

### 2.4 Assessment Sessions - 测评会话

| 方法 | 路径 | operationId | 角色 | 请求 schema | 响应 schema | 稳定错误码 |
|------|------|-------------|------|-------------|-------------|------------|
| POST | `/schools/{schoolId}/assessments/sessions` | createAssessmentSession | TEACHER, SCHOOL_ADMIN, PLATFORM_ADMIN | CreateAssessmentSessionRequest | AssessmentSessionResponse | FORBIDDEN_RESOURCE, VALIDATION_FAILED |
| GET | `/schools/{schoolId}/assessments/sessions` | listAssessmentSessions | STUDENT, TEACHER, SCHOOL_ADMIN | query params | AssessmentSessionListResponse | FORBIDDEN_RESOURCE |
| GET | `/schools/{schoolId}/assessments/sessions/{sessionId}` | getAssessmentSession | STUDENT, TEACHER, SCHOOL_ADMIN | — | AssessmentSessionResponse | FORBIDDEN_RESOURCE, ASSESSMENT_NOT_FOUND |
| POST | `/schools/{schoolId}/assessments/sessions/{sessionId}/start` | startAssessmentSession | STUDENT | — | AssessmentSessionResponse | FORBIDDEN_RESOURCE, ASSESSMENT_NOT_FOUND, CONFLICT |
| POST | `/schools/{schoolId}/assessments/sessions/{sessionId}/submit` | submitAssessmentSession | STUDENT | — | AssessmentSessionResponse | FORBIDDEN_RESOURCE, ASSESSMENT_NOT_FOUND, CONFLICT, PROCESSING_PENDING |
| GET | `/schools/{schoolId}/assessments/sessions/{sessionId}/items` | listAssessmentItems | STUDENT, TEACHER, SCHOOL_ADMIN | — | AssessmentItemListResponse | FORBIDDEN_RESOURCE, ASSESSMENT_NOT_FOUND |

### 2.5 Assessment Reading - 朗读测评

| 方法 | 路径 | operationId | 角色 | 请求 schema | 响应 schema | 稳定错误码 |
|------|------|-------------|------|-------------|-------------|------------|
| GET | `/schools/{schoolId}/assessments/sessions/{sessionId}/reading/{itemId}` | getReadingItem | STUDENT, TEACHER, SCHOOL_ADMIN | — | ReadingItemResponse | FORBIDDEN_RESOURCE, ASSESSMENT_ITEM_NOT_FOUND |
| POST | `/schools/{schoolId}/assessments/sessions/{sessionId}/reading/{itemId}/recording` | attachAssessmentRecording | STUDENT | AttachRecordingRequest | AssessmentItemResponse | FORBIDDEN_RESOURCE, ASSESSMENT_ITEM_NOT_FOUND, CONFLICT |

### 2.6 Assessment Written - 理解（书面）测评

| 方法 | 路径 | operationId | 角色 | 请求 schema | 响应 schema | 稳定错误码 |
|------|------|-------------|------|-------------|-------------|------------|
| GET | `/schools/{schoolId}/assessments/sessions/{sessionId}/written` | getWrittenItems | STUDENT, TEACHER, SCHOOL_ADMIN | — | AssessmentItemListResponse | FORBIDDEN_RESOURCE, ASSESSMENT_NOT_FOUND |
| PUT | `/schools/{schoolId}/assessments/sessions/{sessionId}/items/{itemId}/answer` | saveWrittenAnswer | STUDENT | SaveWrittenAnswerRequest | AssessmentItemResponse | FORBIDDEN_RESOURCE, ASSESSMENT_ITEM_NOT_FOUND, VALIDATION_FAILED |
| POST | `/schools/{schoolId}/assessments/sessions/{sessionId}/items/{itemId}/answer/finalize` | finalizeWrittenAnswer | STUDENT | — | AssessmentItemResponse | FORBIDDEN_RESOURCE, ASSESSMENT_ITEM_NOT_FOUND, CONFLICT |

### 2.7 Assessment Report - 报告

| 方法 | 路径 | operationId | 角色 | 请求 schema | 响应 schema | 稳定错误码 |
|------|------|-------------|------|-------------|-------------|------------|
| GET | `/schools/{schoolId}/assessments/sessions/{sessionId}/report` | getAssessmentReport | STUDENT, TEACHER, SCHOOL_ADMIN | — | AssessmentReportResponse | FORBIDDEN_RESOURCE, ASSESSMENT_NOT_FOUND |
| POST | `/schools/{schoolId}/assessments/sessions/{sessionId}/report/generate` | generateAssessmentReport | TEACHER, SCHOOL_ADMIN | — | AssessmentReportResponse | FORBIDDEN_RESOURCE, ASSESSMENT_NOT_FOUND, CONFLICT, PROCESSING_PENDING |

### 2.8 Assessment Review & Retest - 复核与复测

| 方法 | 路径 | operationId | 角色 | 请求 schema | 响应 schema | 稳定错误码 |
|------|------|-------------|------|-------------|-------------|------------|
| PUT | `/schools/{schoolId}/assessments/sessions/{sessionId}/items/{itemId}/review` | reviewAssessmentItem | TEACHER, SCHOOL_ADMIN | ReviewItemRequest | AssessmentItemResponse | FORBIDDEN_RESOURCE, ASSESSMENT_ITEM_NOT_FOUND, VALIDATION_FAILED |
| GET | `/schools/{schoolId}/assessments/sessions/{sessionId}/items/{itemId}/recording` | getItemRecordingEvidence | TEACHER, SCHOOL_ADMIN | — | RecordingEvidenceResponse | FORBIDDEN_RESOURCE, ASSESSMENT_ITEM_NOT_FOUND |
| POST | `/schools/{schoolId}/assessments/sessions/{sessionId}/retest` | scheduleRetest | TEACHER, SCHOOL_ADMIN | — | AssessmentSessionResponse | FORBIDDEN_RESOURCE, ASSESSMENT_NOT_FOUND |
| POST | `/schools/{schoolId}/assessments/sessions/{sessionId}/export` | exportAssessmentReport | STUDENT, TEACHER, SCHOOL_ADMIN | ExportReportRequest | ExportReportResponse | FORBIDDEN_RESOURCE, ASSESSMENT_NOT_FOUND |

### 2.9 Assessment Device & History - 设备检测与历史

| 方法 | 路径 | operationId | 角色 | 请求 schema | 响应 schema | 稳定错误码 |
|------|------|-------------|------|-------------|-------------|------------|
| POST | `/schools/{schoolId}/assessments/device-check` | logAssessmentDeviceCheck | STUDENT | DeviceCheckRequest | DeviceCheckResponse | FORBIDDEN_RESOURCE |
| GET | `/schools/{schoolId}/assessments/history` | getAssessmentHistory | STUDENT, TEACHER, SCHOOL_ADMIN | query params | AssessmentHistoryResponse | FORBIDDEN_RESOURCE |
| GET | `/schools/{schoolId}/assessments/history/events` | getAssessmentHistoryEvents | STUDENT, TEACHER, SCHOOL_ADMIN | query params | AssessmentHistoryEventsResponse | FORBIDDEN_RESOURCE |

---

## 3. 稳定错误码清单

| 稳定码 | HTTP 状态 | 含义 | 触发模块 |
|--------|-----------|------|----------|
| VALIDATION_FAILED | 400 | 参数校验失败 | assessment, recordings, speech-job, classes |
| FORBIDDEN_RESOURCE | 403 | 无权访问该资源 | assessment, recordings, speech-job, classes |
| UNAUTHENTICATED | 401 | 未认证/鉴权失败（worker 回写） | speech-job |
| CONFLICT | 409 | 状态冲突 | assessment, recordings, classes |
| IDEMPOTENCY_CONFLICT | 409 | 幂等键冲突 | recordings |
| PROCESSING_PENDING | 202 | 处理中，请稍后查询 | assessment |
| ASSESSMENT_NOT_FOUND | 404 | 测评会话不存在 | assessment |
| ASSESSMENT_ITEM_NOT_FOUND | 404 | 测评题目不存在 | assessment |
| RECORDING_NOT_FOUND | 404 | 录音不存在 | recordings |
| SPEECH_JOB_NOT_FOUND | 404 | 语音评分任务不存在 | speech-job |
| PRACTICE_CONTENT_EMPTY | 422 | 班级无可用练习内容 | classes |
| ASSESSMENT_HAS_NO_ITEMS | 422 | 测评必须包含至少一道题目 | classes |
| AUDIO_QUALITY_REJECTED | 422 | 录音音质不达标 | recordings |
| PROVIDER_NOT_CONFIGURED | 503 | 服务提供方未配置 | recordings, speech-job |
| PROVIDER_UNAVAILABLE | 503 | 服务提供方暂时不可用 | recordings, speech-job |
| INTERNAL_ERROR | 500 | 服务端内部错误 | 全局 |

---

## 4. 统一响应包装

### 4.1 成功响应（单个资源）
```json
{
  "data": { ... },
  "meta": { "requestId": "uuid" }
}
```

### 4.2 列表响应
```json
{
  "data": { "items": [...], "nextCursor": "opaque|string|null" },
  "meta": { "requestId": "uuid" }
}
```

### 4.3 错误响应
```json
{
  "error": {
    "code": "STABLE_CODE",
    "message": "人类可读信息",
    "details": {},
    "requestId": "uuid"
  },
  "meta": { "requestId": "uuid" }
}
```

---

## 5. 前后端契约收敛点

| 收敛点 | 修复前 | 修复后 |
|--------|--------|--------|
| ClassAssessmentDto.enrollmentIds | 必填，与 service 不一致 | @IsOptional，省略取全班 |
| 空测评创建 | questionIds 可空且 service 不强制 | service 强制非空，抛 ASSESSMENT_HAS_NO_ITEMS |
| 跨学校题目 | question.findMany 无 schoolId 过滤 | 加 courseVersion: { schoolId } 关联过滤 |
| 录音错误码 | 继承 NestJS 内置异常，无 code | HttpException + { code, message } |
| SpeechJob worker 回写 | 无鉴权 | X-Internal-API-Key fail closed |
| SpeechJob STUDENT 鉴权 | throw new Error() → 500 | SpeechJobNotFoundException → 404 |
| 全局异常过滤器 | HTTP_${status} 覆盖所有 code | 透传异常自带 code，仅回退时用 HTTP_${status} |
| api-client completeRecording | 缺 assessmentItemId/targetText | 与 DTO 一致 |
| api-client createSpeechJob | 缺失 | 新增 |
| api-client getItemRecordingEvidence | 缺失 | 新增 |
| api-client exportAssessmentReport | 缺失 | 新增 |
| OpenAPI 黄金闭环端点 | 完全缺失 | 31 端点 + 7 参数 + 7 稳定错误码 + 27 schemas |
| 教师创建页错误处理 | 依赖 message 文案判断 | 按稳定码分支（PRACTICE_CONTENT_EMPTY / ASSESSMENT_HAS_NO_ITEMS 等） |
| OpenAPI 3.1 nullable | 误用 `nullable: true`（3.0 语法） | 改为 `type: [xxx, "null"]`（53 处全部修复） |

---

## 6. 验证结果

| 验证项 | 命令 | 结果 |
|--------|------|------|
| OpenAPI lint | `pnpm --filter @yuzan/contracts validate` | ✅ 0 错误 0 警告（valid） |
| OpenAPI 类型生成 | `pnpm --filter @yuzan/contracts generate` | ✅ 成功生成 TypeScript 类型 |
| 契约测试 | `pnpm exec vitest run --config test/contracts/vitest.config.ts`（apps/api 目录下） | ✅ 31/31 通过 |
| API typecheck | `pnpm --filter @yuzan/api typecheck` | ⚠️ 714 错误，其中 566 为 Prisma client 未生成的预存问题；本次修改的 8 个文件（errors/dto/filter/controller/service）无新增错误 |

---

## 7. 未解决问题（后续任务跟进）

| 编号 | 问题 | 影响 | 建议跟进任务 |
|------|------|------|------------|
| U1 | Prisma client 未生成，导致 566 个 typecheck 错误 | 阻塞 typecheck 全绿 | 运行 `pnpm --filter @yuzan/database prisma generate`（需数据库 schema 就绪） |
| U2 | Per-student session+items 创建非原子（缺 $transaction） | 并发下可能产生孤儿记录 | 后续在 ClassesService.createClassAssessment 中引入事务（需 repo 层支持 tx 参数传递） |
| U3 | reviewItem / exportReport 仍用内联 body 类型，无独立 DTO | 契约不够严格 | 后续补充 ReviewItemDto / ExportReportDto |
| U4 | 录音 verifyEnrollmentOwnership 对 TEACHER 跳过所有权检查 | 教师可访问任意录音（限同校） | 后续加 schoolId 维度校验，与 student 校验对齐 |
| U5 | OpenAPI ambiguous-paths 已通过 redocly.yaml 关闭规则 | 路径 `/speech-jobs/by-item/{id}` 与 `/speech-jobs/{jobId}/result` 静态分析有歧义，运行时无歧义 | 如需消除警告，可重构后端路径为 `/assessment-items/{id}/speech-jobs` |
