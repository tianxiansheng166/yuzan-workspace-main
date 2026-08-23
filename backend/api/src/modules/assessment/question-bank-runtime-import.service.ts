import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import path from "node:path";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../shared/database/prisma.service.js";
import {
  STORAGE_PORT,
  type HeadObjectResult,
  type StoragePort,
} from "../../shared/storage/storage.port.js";

const LEVELS = [1, 2, 3, 4, 5, 6] as const;
const LEVEL_NAMES = ["", "一", "二", "三", "四", "五", "六"] as const;
const LEGACY_AUDIO_VERIFICATION_TITLE = "语赞心声 Question Bank v1 · 听写音频验证";

const SECTION_DEFINITIONS = [
  { domain: "LISTEN", title: "听", description: "听音选图、听写句子", estimatedMinutes: 7 },
  { domain: "SPEAK", title: "说", description: "朗读句子、看图说话", estimatedMinutes: 8 },
  { domain: "READ", title: "读", description: "单词认读、句子理解", estimatedMinutes: 7 },
  { domain: "WRITE", title: "写", description: "看图写词、句子补全", estimatedMinutes: 8 },
] as const;

const ITEM_METADATA: Record<string, { itemType: string; abilityCategory: string }> = {
  LISTEN_IMAGE_CHOICE: { itemType: "CHOICE", abilityCategory: "听辨训练" },
  DICTATION: { itemType: "TEXT", abilityCategory: "听写句子" },
  READ_ALOUD: { itemType: "SPEECH", abilityCategory: "独立朗读" },
  PICTURE_SPEAKING: { itemType: "SPEECH", abilityCategory: "口语交际" },
  WORD_RECOGNITION: { itemType: "CHOICE", abilityCategory: "阅读理解" },
  SENTENCE_COMPREHENSION: { itemType: "CHOICE", abilityCategory: "阅读理解" },
  PICTURE_WORD: { itemType: "TEXT", abilityCategory: "书面表达" },
  SENTENCE_COMPLETION: { itemType: "TEXT", abilityCategory: "书面表达" },
};

type JsonRecord = Record<string, unknown>;
type MediaKind = "IMAGE" | "AUDIO";

export type CanonicalMediaBinding = {
  kind: MediaKind;
  zipPath: string;
  sha256: string;
  sourceOccurrence?: number;
  match?: string;
};

export type CanonicalQuestion = {
  stableKey: string;
  level: number;
  domain: string;
  family: string;
  sourceOrder: number;
  maxScore: number;
  deliverySpec: JsonRecord;
  scoringSpec: JsonRecord;
  scoringBinding?: { status?: string };
  mediaBindings: { images: CanonicalMediaBinding[]; audio?: CanonicalMediaBinding };
  sourceTrace: JsonRecord;
  provenance?: JsonRecord;
};

export type CanonicalManifest = {
  levels: Array<{ level: number; questions: CanonicalQuestion[] }>;
  issues: Array<{ severity?: string; code?: string }>;
};

export type SourceDocumentIdentity = {
  fileName: string;
  sha256: string;
};

export type QuestionBankRuntimeApplyInput = {
  schoolId: string;
  classId: string;
  manifest: CanonicalManifest;
  sourceDocuments: {
    questionDocx: SourceDocumentIdentity;
    answerDocx: SourceDocumentIdentity;
    mediaArchive: SourceDocumentIdentity;
  };
  readMedia(zipPath: string): Promise<Uint8Array>;
};

export type QuestionBankRuntimeApplyResult = {
  resources: { created: number; reused: number; total: number; images: number; audio: number };
  questionBankItems: { created: number; reused: number };
  questionBankItemVersions: { created: number; reused: number };
  practiceDefinitions: { created: number; reused: number; total: number; ids: string[] };
  practiceVersions: { created: number; reused: number; total: number; ids: string[] };
  practiceSections: { created: number; reused: number };
  practiceItemRefs: { created: number; reused: number };
  practiceDeliveries: { created: number; reused: number; total: number; ids: string[] };
  legacyAudioVerificationDeliveriesClosed: number;
};

type RuntimeMedia = CanonicalMediaBinding & {
  originalName: string;
  objectKey: string;
  mediaType: string;
};

type ResolvedQuestion = {
  question: CanonicalQuestion;
  deliverySpec: JsonRecord;
  scoringSpec: JsonRecord;
  sourceTrace: JsonRecord;
};

type AppliedQuestionVersion = ResolvedQuestion & {
  id: string;
  version: number;
  itemType: string;
};

type ResourceResult = { id: string; created: boolean };

type PracticeApplyResult = {
  practiceDefinition: { created: number; reused: number; id: string };
  practiceVersion: { created: number; reused: number; id: string; contentHash: string };
  practiceSections: { created: number; reused: number };
  practiceItemRefs: { created: number; reused: number };
  practiceDelivery: { created: number; reused: number; id: string };
};

function levelLabel(level: number): string {
  return `水平${LEVEL_NAMES[level] ?? fail(`unsupported level ${level}`)}级`;
}

function practiceMetadata(level: number) {
  const label = levelLabel(level);
  const coverAssets = [
    "/assessment/assets/practice-catalog/morning-valley.png",
    "/assessment/assets/practice-catalog/spring-highland.png",
    "/assessment/assets/practice-catalog/barley-year.png",
    "/assessment/assets/practice-catalog/snow-peak-success.png",
  ];
  return {
    title: `国家通用语言文字能力｜${label}综合测评`,
    summary: `围绕听、说、读、写四项能力进行的${label}综合练习。`,
    coverAsset: coverAssets[(level - 1) % coverAssets.length]!,
    difficulty: label,
    gradeBand: label,
    abilityCategories: ["听辨训练", "独立朗读", "阅读理解", "书面表达"],
    cultureTags: ["国家通用语言文字能力", label],
  };
}

function fail(message: string): never {
  throw new Error(`QB-003B Level 1 apply failed: ${message}`);
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonClone(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  fail("canonical content contains a non-JSON value");
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function mediaKey(kind: MediaKind, checksum: string): string {
  return `${kind}:${checksum}`;
}

function mediaInfo(binding: CanonicalMediaBinding, level: number): RuntimeMedia {
  const extension = path.posix.extname(binding.zipPath).slice(1).toLowerCase();
  const mediaType = ({
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
  } as Record<string, string>)[extension];
  if (!mediaType) fail(`unsupported media extension for ${binding.zipPath}`);
  if (binding.kind === "IMAGE" && !mediaType.startsWith("image/")) {
    fail(`image binding has a non-image extension: ${binding.zipPath}`);
  }
  if (binding.kind === "AUDIO" && !mediaType.startsWith("audio/")) {
    fail(`audio binding has a non-audio extension: ${binding.zipPath}`);
  }
  if (!/^[a-f0-9]{64}$/.test(binding.sha256)) fail(`invalid SHA-256 for ${binding.zipPath}`);
  if (binding.zipPath.includes("..") || binding.zipPath.startsWith("/")) {
    fail(`unsafe source archive entry: ${binding.zipPath}`);
  }
  return {
    ...binding,
    originalName: path.posix.basename(binding.zipPath),
    objectKey: `question-bank/level-${level}/${binding.kind.toLowerCase()}/${binding.sha256}.${extension}`,
    mediaType,
  };
}

function collectRuntimeMedia(questions: readonly CanonicalQuestion[]): RuntimeMedia[] {
  const entries = new Map<string, RuntimeMedia>();
  for (const question of questions) {
    for (const image of question.mediaBindings.images) {
      if (image.kind !== "IMAGE") fail(`${question.stableKey} has an invalid image binding`);
      const candidate = mediaInfo(image, question.level);
      const key = mediaKey(candidate.kind, candidate.sha256);
      const existing = entries.get(key);
      entries.set(key, existing ?? candidate);
    }
    if (question.mediaBindings.audio) {
      const audio = question.mediaBindings.audio;
      if (audio.kind !== "AUDIO") fail(`${question.stableKey} has an invalid audio binding`);
      const candidate = mediaInfo(audio, question.level);
      const key = mediaKey(candidate.kind, candidate.sha256);
      const existing = entries.get(key);
      entries.set(key, existing ?? candidate);
    }
  }
  return [...entries.values()].sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}

function exactChoiceOptionKeys(deliverySpec: JsonRecord): string[] | null {
  const response = deliverySpec.response;
  if (!isRecord(response) || response.type !== "CHOICE" || !Array.isArray(response.options) || response.options.length === 0) {
    return null;
  }
  const keys = response.options.map((option) => (
    isRecord(option) && typeof option.key === "string" ? option.key.trim().toUpperCase() : ""
  ));
  if (keys.some((key) => !key) || new Set(keys).size !== keys.length) return null;
  return keys;
}

function assertExactChoiceConfiguration(question: CanonicalQuestion): void {
  const keys = exactChoiceOptionKeys(question.deliverySpec);
  const referenceAnswer = typeof question.scoringSpec.referenceAnswer === "string"
    ? question.scoringSpec.referenceAnswer.trim().toUpperCase()
    : "";
  if (!keys || !referenceAnswer || !keys.includes(referenceAnswer)) {
    fail(`${question.stableKey} has an invalid EXACT_CHOICE answer configuration`);
  }
}

export function assertCanonicalManifest(manifest: CanonicalManifest): CanonicalQuestion[] {
  if (manifest.issues.some((issue) => issue.severity === "ERROR")) {
    fail("canonical source validation reported errors");
  }
  if (manifest.levels.length === 0 || (manifest.levels.length !== 1 && manifest.levels.length !== LEVELS.length)) {
    fail("apply accepts one validated level or the complete Level 1–6 manifest");
  }
  const requestedLevels = manifest.levels.map((entry) => entry.level).sort((left, right) => left - right);
  if (requestedLevels.some((level) => !LEVELS.includes(level as (typeof LEVELS)[number]))) {
    fail("manifest contains an unsupported level");
  }
  if (new Set(requestedLevels).size !== requestedLevels.length) fail("manifest contains duplicate levels");
  if (manifest.levels.length === LEVELS.length && requestedLevels.join(",") !== LEVELS.join(",")) {
    fail("complete rollout manifest must contain Levels 1–6");
  }
  const questions = manifest.levels.flatMap((entry) => {
    if (entry.questions.length !== 20) fail(`expected 20 Level ${entry.level} questions, received ${entry.questions.length}`);
    const points = entry.questions.reduce((total, question) => total + question.maxScore, 0);
    if (points !== 100) fail(`expected 100 Level ${entry.level} points, received ${points}`);
    const levelImages = new Set(entry.questions.flatMap((question) => question.mediaBindings.images.map((image) => image.sha256)));
    const levelAudio = new Set(entry.questions.flatMap((question) => question.mediaBindings.audio ? [question.mediaBindings.audio.sha256] : []));
    if (levelImages.size !== 15 || levelAudio.size !== 6) {
      fail(`expected 15 images and 6 audio bindings for Level ${entry.level}, received ${levelImages.size} images and ${levelAudio.size} audio`);
    }
    return entry.questions;
  });
  if (new Set(questions.map((question) => question.stableKey)).size !== questions.length) {
    fail("canonical manifest contains duplicate stable keys");
  }
  for (const question of questions) {
    if (!LEVELS.includes(question.level as (typeof LEVELS)[number])) fail(`${question.stableKey} has an unsupported level`);
    if (question.scoringBinding?.status !== "BOUND") {
      fail(`${question.stableKey} does not have a bound scoring specification`);
    }
    if (!isRecord(question.scoringSpec) || typeof question.scoringSpec.strategy !== "string") {
      fail(`${question.stableKey} has no scoring strategy`);
    }
    if (question.scoringSpec.strategy === "EXACT_CHOICE") assertExactChoiceConfiguration(question);
  }
  return questions;
}

function resourceIdFor(
  resources: ReadonlyMap<string, string>,
  binding: CanonicalMediaBinding,
): string {
  return resources.get(mediaKey(binding.kind, binding.sha256))
    ?? fail(`missing resolved Resource for ${binding.zipPath}`);
}

function assertRuntimeDeliverySpec(value: JsonRecord): void {
  const prohibitedKeys = new Set(["zippath", "sourceoccurrence", "sourcewordimage", "objectkey"]);
  const inspect = (entry: unknown): void => {
    if (typeof entry === "string") {
      if (entry.includes("local_sources/") || entry.includes("/home/")) {
        fail("runtime deliverySpec leaked a local source path");
      }
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(inspect);
      return;
    }
    if (!isRecord(entry)) return;
    for (const [key, nested] of Object.entries(entry)) {
      if (prohibitedKeys.has(key.replace(/[^a-zA-Z]/g, "").toLowerCase())) {
        fail(`runtime deliverySpec contains source-only key ${key}`);
      }
      inspect(nested);
    }
  };
  inspect(value);
}

export function resolveQuestion(
  question: CanonicalQuestion,
  resources: ReadonlyMap<string, string>,
  sourceDocuments: QuestionBankRuntimeApplyInput["sourceDocuments"],
): ResolvedQuestion {
  const deliverySpec = jsonClone(question.deliverySpec);
  const stimulus = deliverySpec.stimulus;
  const response = deliverySpec.response;
  if (!isRecord(stimulus) || !isRecord(response)) {
    fail(`${question.stableKey} does not have a valid deliverySpec`);
  }

  if (stimulus.type === "AUDIO") {
    const audio = question.mediaBindings.audio ?? fail(`${question.stableKey} is missing its audio binding`);
    stimulus.resourceId = resourceIdFor(resources, audio);
  }
  if (stimulus.type === "IMAGE") {
    if (question.mediaBindings.images.length !== 1) {
      fail(`${question.stableKey} must have exactly one image stimulus binding`);
    }
    stimulus.resourceId = resourceIdFor(resources, question.mediaBindings.images[0]!);
  }
  if (response.type === "CHOICE" && question.family === "LISTEN_IMAGE_CHOICE") {
    const options = response.options;
    if (!Array.isArray(options) || options.length !== question.mediaBindings.images.length) {
      fail(`${question.stableKey} does not have image bindings for every authored choice option`);
    }
    response.options = options.map((option, index) => {
      if (!isRecord(option) || typeof option.key !== "string") {
        fail(`${question.stableKey} contains an invalid choice option`);
      }
      return {
        ...option,
        imageResourceId: resourceIdFor(resources, question.mediaBindings.images[index]!),
      };
    });
  }

  assertRuntimeDeliverySpec(deliverySpec);
  const scoringSourceTrace = isRecord(question.scoringSpec.sourceTrace)
    ? question.scoringSpec.sourceTrace
    : {};
  const imageTrace = question.mediaBindings.images.map((image) => ({
    archiveEntry: image.zipPath,
    sha256: image.sha256,
    ...(image.sourceOccurrence === undefined ? {} : { sourceOccurrence: image.sourceOccurrence }),
    ...(image.match === undefined ? {} : { match: image.match }),
  }));
  const sourceTrace: JsonRecord = {
    schemaVersion: 1,
    sourceDocuments,
    questionDocx: question.sourceTrace.questionDocx ?? null,
    answerDocx: scoringSourceTrace.answerDocx ?? null,
    media: {
      images: imageTrace,
      audio: question.mediaBindings.audio
        ? {
          archiveEntry: question.mediaBindings.audio.zipPath,
          sha256: question.mediaBindings.audio.sha256,
        }
        : null,
    },
    ...(question.sourceTrace.provenance ? { provenance: jsonClone(question.sourceTrace.provenance as JsonRecord) } : {}),
  };
  return { question, deliverySpec, scoringSpec: jsonClone(question.scoringSpec), sourceTrace };
}

function mediaChecksumFromHead(head: HeadObjectResult): string | undefined {
  for (const [key, value] of Object.entries(head.metadata ?? {})) {
    const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (normalized === "checksumsha256" || normalized === "sha256") return value;
  }
  return undefined;
}

function contentTypeMatches(actual: string | undefined, expected: string): boolean {
  return actual?.split(";", 1)[0]?.trim().toLowerCase() === expected.toLowerCase();
}

@Injectable()
export class QuestionBankRuntimeImportService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async apply(input: QuestionBankRuntimeApplyInput): Promise<QuestionBankRuntimeApplyResult> {
    const questions = assertCanonicalManifest(input.manifest);
    const media = collectRuntimeMedia(questions);
    const resourceIds = new Map<string, string>();
    let resourcesCreated = 0;
    let resourcesReused = 0;

    for (const entry of media) {
      const result = await this.ensureResource(entry, input.readMedia);
      resourceIds.set(mediaKey(entry.kind, entry.sha256), result.id);
      if (result.created) resourcesCreated += 1;
      else resourcesReused += 1;
    }

    const resolved = questions.map((question) => resolveQuestion(question, resourceIds, input.sourceDocuments));
    return this.prisma.$transaction(async (tx) => {
      const applied = await this.ensureQuestionBankVersions(tx, resolved);
      const legacyAudioVerificationDeliveriesClosed = await this.retireLegacyAudioVerification(tx, input.schoolId);
      const practiceResults: PracticeApplyResult[] = [];
      for (const level of [...new Set(questions.map((question) => question.level))].sort((left, right) => left - right)) {
        practiceResults.push(await this.ensurePractice(
          tx,
          input.schoolId,
          input.classId,
          level,
          { ...applied, versions: applied.versions.filter((entry) => entry.question.level === level) },
        ));
      }
      return {
        resources: {
          created: resourcesCreated,
          reused: resourcesReused,
          total: media.length,
          images: media.filter((entry) => entry.kind === "IMAGE").length,
          audio: media.filter((entry) => entry.kind === "AUDIO").length,
        },
        legacyAudioVerificationDeliveriesClosed,
        questionBankItems: applied.questionBankItems,
        questionBankItemVersions: applied.questionBankItemVersions,
        practiceDefinitions: {
          created: practiceResults.reduce((total, result) => total + result.practiceDefinition.created, 0),
          reused: practiceResults.reduce((total, result) => total + result.practiceDefinition.reused, 0),
          total: practiceResults.length,
          ids: practiceResults.map((result) => result.practiceDefinition.id),
        },
        practiceVersions: {
          created: practiceResults.reduce((total, result) => total + result.practiceVersion.created, 0),
          reused: practiceResults.reduce((total, result) => total + result.practiceVersion.reused, 0),
          total: practiceResults.length,
          ids: practiceResults.map((result) => result.practiceVersion.id),
        },
        practiceSections: {
          created: practiceResults.reduce((total, result) => total + result.practiceSections.created, 0),
          reused: practiceResults.reduce((total, result) => total + result.practiceSections.reused, 0),
        },
        practiceItemRefs: {
          created: practiceResults.reduce((total, result) => total + result.practiceItemRefs.created, 0),
          reused: practiceResults.reduce((total, result) => total + result.practiceItemRefs.reused, 0),
        },
        practiceDeliveries: {
          created: practiceResults.reduce((total, result) => total + result.practiceDelivery.created, 0),
          reused: practiceResults.reduce((total, result) => total + result.practiceDelivery.reused, 0),
          total: practiceResults.length,
          ids: practiceResults.map((result) => result.practiceDelivery.id),
        },
      };
    });
  }

  private async retireLegacyAudioVerification(
    tx: Prisma.TransactionClient,
    schoolId: string,
  ): Promise<number> {
    // QB-001 seeded this temporary audio-only verification practice before the
    // canonical importer existed. Preserve its historical records, but keep it
    // out of the student catalog now that Level 1 has a real system practice.
    const result = await tx.practiceDelivery.updateMany({
      where: {
        schoolId,
        status: "OPEN",
        practiceVersion: {
          definition: {
            schoolId,
            visibility: "SCHOOL",
            title: LEGACY_AUDIO_VERIFICATION_TITLE,
          },
        },
      },
      data: { status: "CLOSED" },
    });
    return result.count;
  }

  private async ensureResource(
    media: RuntimeMedia,
    readMedia: QuestionBankRuntimeApplyInput["readMedia"],
  ): Promise<ResourceResult> {
    const body = await readMedia(media.zipPath);
    if (sha256(body) !== media.sha256) {
      fail(`archive content checksum changed for ${media.zipPath}`);
    }
    const expectedByteSize = body.byteLength;
    const existing = await this.prisma.resource.findUnique({ where: { objectKey: media.objectKey } });
    if (existing) {
      if (existing.deletedAt) fail(`deterministic Resource is deleted: ${media.objectKey}`);
      this.assertResourceRecord(existing, media, expectedByteSize);
      await this.ensureStoredObject(media, body);
      return { id: existing.id, created: false };
    }

    const sameContent = await this.prisma.resource.findFirst({
      where: { kind: media.kind, checksumSha256: media.sha256, deletedAt: null },
    });
    if (sameContent) {
      if (
        sameContent.mediaType !== media.mediaType
        || Number(sameContent.byteSize) !== body.byteLength
        || sameContent.rightsStatus !== "UNKNOWN"
      ) {
        fail(`checksum ${media.sha256} conflicts with canonical Resource metadata`);
      }
      await this.ensureStoredObject({
        ...media,
        objectKey: sameContent.objectKey,
        originalName: sameContent.originalName,
        mediaType: sameContent.mediaType,
      }, body);
      return { id: sameContent.id, created: false };
    }

    await this.ensureStoredObject(media, body);
    try {
      const created = await this.prisma.resource.create({
        data: {
          schoolId: null,
          kind: media.kind,
          objectKey: media.objectKey,
          originalName: media.originalName,
          mediaType: media.mediaType,
          byteSize: BigInt(expectedByteSize),
          checksumSha256: media.sha256,
          rightsStatus: "UNKNOWN",
          offlineAllowed: false,
        },
      });
      return { id: created.id, created: true };
    } catch (error) {
      const concurrent = await this.prisma.resource.findUnique({ where: { objectKey: media.objectKey } });
      if (!concurrent || concurrent.deletedAt) throw error;
      this.assertResourceRecord(concurrent, media, expectedByteSize);
      return { id: concurrent.id, created: false };
    }
  }

  private async ensureStoredObject(media: RuntimeMedia, body: Uint8Array): Promise<void> {
    const current = await this.storage.headObject(media.objectKey);
    if (!current.exists) {
      await this.storage.putObject(media.objectKey, body, media.mediaType, {
        "checksum-sha256": media.sha256,
      });
    }
    const verified = await this.storage.headObject(media.objectKey);
    this.assertStoredObject(verified, media, body.byteLength);
  }

  private assertStoredObject(head: HeadObjectResult, media: RuntimeMedia, expectedByteSize: number): void {
    if (!head.exists) fail(`storage object was not created: ${media.objectKey}`);
    if (head.contentLength !== expectedByteSize) {
      fail(`storage byte size mismatch for ${media.objectKey}`);
    }
    if (!contentTypeMatches(head.contentType, media.mediaType)) {
      fail(`storage content type mismatch for ${media.objectKey}`);
    }
    if (mediaChecksumFromHead(head) !== media.sha256) {
      fail(`storage checksum metadata mismatch for ${media.objectKey}`);
    }
  }

  private assertResourceRecord(
    resource: {
      schoolId: string | null;
      kind: string;
      objectKey: string;
      originalName: string;
      mediaType: string;
      byteSize: bigint;
      checksumSha256: string;
      rightsStatus: string;
    },
    media: RuntimeMedia,
    expectedByteSize: number,
  ): void {
    if (
      resource.schoolId !== null
      || resource.kind !== media.kind
      || resource.objectKey !== media.objectKey
      || resource.originalName !== media.originalName
      || resource.mediaType !== media.mediaType
      || Number(resource.byteSize) !== expectedByteSize
      || resource.checksumSha256 !== media.sha256
      || resource.rightsStatus !== "UNKNOWN"
    ) {
      fail(`existing Resource conflicts with canonical metadata: ${media.objectKey}`);
    }
  }

  private async ensureQuestionBankVersions(
    tx: Prisma.TransactionClient,
    resolved: readonly ResolvedQuestion[],
  ): Promise<{
    versions: AppliedQuestionVersion[];
    questionBankItems: { created: number; reused: number };
    questionBankItemVersions: { created: number; reused: number };
  }> {
    let itemsCreated = 0;
    let itemsReused = 0;
    let versionsCreated = 0;
    let versionsReused = 0;
    const versions: AppliedQuestionVersion[] = [];

    for (const entry of resolved) {
      const metadata = ITEM_METADATA[entry.question.family] ?? fail(`unsupported family ${entry.question.family}`);
      const existing = await tx.questionBankItem.findUnique({
        where: { stableKey: entry.question.stableKey },
        include: {
          versions: {
            orderBy: { version: "desc" },
            select: {
              id: true,
              version: true,
              status: true,
              deliverySpec: true,
              scoringSpec: true,
              sourceTrace: true,
            },
          },
        },
      });
      const item = existing
        ? await this.reuseQuestionBankItem(tx, existing, entry.question, metadata)
        : await tx.questionBankItem.create({
          data: {
            schoolId: null,
            stableKey: entry.question.stableKey,
            domain: entry.question.domain,
            questionType: entry.question.family,
            level: levelLabel(entry.question.level),
            abilityCategory: metadata.abilityCategory,
            gradeBand: levelLabel(entry.question.level),
            difficulty: levelLabel(entry.question.level),
            itemType: metadata.itemType,
          },
          include: { versions: true },
        });
      if (existing) itemsReused += 1;
      else itemsCreated += 1;

      const knownVersions = existing?.versions ?? [];
      const currentPublished = knownVersions.find((version) => version.status === "PUBLISHED");
      const matching = currentPublished
        && canonicalJson(currentPublished.deliverySpec) === canonicalJson(entry.deliverySpec)
        && canonicalJson(currentPublished.scoringSpec) === canonicalJson(entry.scoringSpec)
        && canonicalJson(currentPublished.sourceTrace) === canonicalJson(entry.sourceTrace)
        ? currentPublished
        : null;
      if (matching) {
        versionsReused += 1;
        versions.push({ ...entry, id: matching.id, version: matching.version, itemType: metadata.itemType });
        continue;
      }

      const nextVersion = (knownVersions[0]?.version ?? 0) + 1;
      const created = await tx.questionBankItemVersion.create({
        data: {
          itemId: item.id,
          version: nextVersion,
          deliverySpec: entry.deliverySpec as Prisma.InputJsonValue,
          scoringSpec: entry.scoringSpec as Prisma.InputJsonValue,
          sourceTrace: entry.sourceTrace as Prisma.InputJsonValue,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
      versionsCreated += 1;
      versions.push({ ...entry, id: created.id, version: created.version, itemType: metadata.itemType });
    }
    return {
      versions,
      questionBankItems: { created: itemsCreated, reused: itemsReused },
      questionBankItemVersions: { created: versionsCreated, reused: versionsReused },
    };
  }

  private async reuseQuestionBankItem(
    tx: Prisma.TransactionClient,
    item: {
      id: string;
      schoolId: string | null;
      domain: string | null;
      questionType: string | null;
      level: string | null;
      abilityCategory: string | null;
      gradeBand: string | null;
      difficulty: string | null;
      itemType: string;
      versions: Array<unknown>;
    },
    question: CanonicalQuestion,
    metadata: { itemType: string; abilityCategory: string },
  ) {
    if (item.schoolId !== null) fail(`${question.stableKey} belongs to a school-scoped item`);
    const desired = {
      domain: question.domain,
      questionType: question.family,
      level: levelLabel(question.level),
      abilityCategory: metadata.abilityCategory,
      gradeBand: levelLabel(question.level),
      difficulty: levelLabel(question.level),
      itemType: metadata.itemType,
    };
    const unchanged = Object.entries(desired).every(([key, value]) => item[key as keyof typeof desired] === value);
    if (unchanged) return item;
    return tx.questionBankItem.update({ where: { id: item.id }, data: desired, include: { versions: true } });
  }

  private async ensurePractice(
    tx: Prisma.TransactionClient,
    schoolId: string,
    classId: string,
    level: number,
    questionVersions: {
      versions: readonly AppliedQuestionVersion[];
      questionBankItems: { created: number; reused: number };
      questionBankItemVersions: { created: number; reused: number };
    },
  ): Promise<PracticeApplyResult> {
    const metadata = practiceMetadata(level);
    const definitions = await tx.practiceDefinition.findMany({
      where: { title: metadata.title, schoolId: null, visibility: "SYSTEM" },
    });
    if (definitions.length > 1) fail(`multiple global ${metadata.title} practice definitions exist`);
    let definition = definitions[0];
    let definitionCreated = 0;
    let definitionReused = 0;
    const definitionData = {
      schoolId: null,
      visibility: "SYSTEM" as const,
      title: metadata.title,
      summary: metadata.summary,
      coverAsset: metadata.coverAsset,
      difficulty: metadata.difficulty,
      estimatedMinutes: 30,
      gradeBand: metadata.gradeBand,
      abilityCategories: metadata.abilityCategories,
      cultureTags: metadata.cultureTags,
      catalogType: "COMPREHENSIVE",
      requiresRecording: true,
      instantFeedback: false,
      status: "PUBLISHED" as const,
    };
    if (!definition) {
      definition = await tx.practiceDefinition.create({ data: definitionData });
      definitionCreated = 1;
    } else {
      definitionReused = 1;
      if (definition.schoolId !== null || definition.visibility !== "SYSTEM") {
        fail(`${metadata.title} practice definition has an invalid scope`);
      }
      const changed = definition.summary !== definitionData.summary
        || definition.coverAsset !== definitionData.coverAsset
        || definition.difficulty !== definitionData.difficulty
        || definition.estimatedMinutes !== definitionData.estimatedMinutes
        || definition.gradeBand !== definitionData.gradeBand
        || canonicalJson(definition.abilityCategories) !== canonicalJson(definitionData.abilityCategories)
        || canonicalJson(definition.cultureTags) !== canonicalJson(definitionData.cultureTags)
        || definition.catalogType !== definitionData.catalogType
        || definition.requiresRecording !== definitionData.requiresRecording
        || definition.instantFeedback !== definitionData.instantFeedback
        || definition.status !== definitionData.status;
      if (changed) definition = await tx.practiceDefinition.update({ where: { id: definition.id }, data: definitionData });
    }

    const orderedSections = SECTION_DEFINITIONS.map((section) => ({
      ...section,
      questions: questionVersions.versions.filter((entry) => entry.question.domain === section.domain),
    }));
    if (orderedSections.some((section) => section.questions.length === 0)) {
      fail(`canonical ${metadata.title} practice has an empty required section`);
    }
    const contentHash = sha256(canonicalJson(orderedSections.map((section, sectionIndex) => ({
      sortOrder: sectionIndex + 1,
      title: section.title,
      items: section.questions.map((question, itemIndex) => ({
        sortOrder: itemIndex + 1,
        stableKey: question.question.stableKey,
        version: question.version,
        deliverySpec: question.deliverySpec,
        scoringSpec: question.scoringSpec,
        sourceTrace: question.sourceTrace,
      })),
    }))));
    const matchingVersions = await tx.practiceVersion.findMany({
      where: { definitionId: definition.id, contentHash, status: "PUBLISHED" },
    });
    if (matchingVersions.length > 1) fail(`multiple published ${metadata.title} practice versions share a content hash`);
    let practiceVersion = matchingVersions[0];
    let practiceVersionCreated = 0;
    let practiceVersionReused = 0;
    let sectionsCreated = 0;
    let sectionsReused = 0;
    let refsCreated = 0;
    let refsReused = 0;
    if (!practiceVersion) {
      const latest = await tx.practiceVersion.aggregate({
        where: { definitionId: definition.id },
        _max: { version: true },
      });
      practiceVersion = await tx.practiceVersion.create({
        data: {
          definitionId: definition.id,
          version: (latest._max.version ?? 0) + 1,
          status: "PUBLISHED",
          contentHash,
          publishedAt: new Date(),
          sections: {
            create: orderedSections.map((section, sectionIndex) => ({
              title: section.title,
              description: section.description,
              sortOrder: sectionIndex + 1,
              estimatedMinutes: section.estimatedMinutes,
              items: {
                create: section.questions.map((question, itemIndex) => ({
                  questionVersionId: question.id,
                  itemType: question.itemType,
                  sortOrder: itemIndex + 1,
                  config: {},
                })),
              },
            })),
          },
        },
      });
      practiceVersionCreated = 1;
      sectionsCreated = orderedSections.length;
      refsCreated = orderedSections.reduce((total, section) => total + section.questions.length, 0);
    } else {
      practiceVersionReused = 1;
      sectionsReused = orderedSections.length;
      refsReused = orderedSections.reduce((total, section) => total + section.questions.length, 0);
    }

    const matchingDeliveries = await tx.practiceDelivery.findMany({
      where: {
        schoolId,
        classId,
        studentId: null,
        mode: "SELF_PRACTICE",
        practiceVersion: { definitionId: definition.id },
      },
    });
    if (matchingDeliveries.length > 1) fail(`multiple ${metadata.title} self-practice deliveries exist for the target class`);
    let delivery = matchingDeliveries[0];
    let deliveryCreated = 0;
    let deliveryReused = 0;
    const deliveryData = {
      practiceVersionId: practiceVersion.id,
      schoolId,
      classId,
      studentId: null,
      mode: "SELF_PRACTICE" as const,
      reRecordPolicy: { maxAttempts: 2, allowAfterUpload: true },
      mobilePolicy: { allowed: true, minNetwork: "3g" },
      status: "OPEN" as const,
    };
    if (!delivery) {
      delivery = await tx.practiceDelivery.create({ data: deliveryData });
      deliveryCreated = 1;
    } else {
      deliveryReused = 1;
      const changed = delivery.practiceVersionId !== deliveryData.practiceVersionId
        || delivery.status !== deliveryData.status
        || canonicalJson(delivery.reRecordPolicy) !== canonicalJson(deliveryData.reRecordPolicy)
        || canonicalJson(delivery.mobilePolicy) !== canonicalJson(deliveryData.mobilePolicy);
      if (changed) delivery = await tx.practiceDelivery.update({ where: { id: delivery.id }, data: deliveryData });
    }

    return {
      practiceDefinition: { created: definitionCreated, reused: definitionReused, id: definition.id },
      practiceVersion: { created: practiceVersionCreated, reused: practiceVersionReused, id: practiceVersion.id, contentHash },
      practiceSections: { created: sectionsCreated, reused: sectionsReused },
      practiceItemRefs: { created: refsCreated, reused: refsReused },
      practiceDelivery: { created: deliveryCreated, reused: deliveryReused, id: delivery.id },
    };
  }
}
