import { NestFactory } from "@nestjs/core";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Prisma } from "@yuzan/database";
import { PrismaService } from "../shared/database/prisma.service.js";
import {
  STORAGE_PORT,
  type StoragePort,
} from "../shared/storage/storage.port.js";
import { PrismaCourseVersionRepository } from "../modules/curriculum/ports/prisma-course-version.repository.js";
import { PrismaResourceLookupAdapter } from "../modules/resources/ports/prisma-resource-lookup.adapter.js";
import { executePublish } from "../modules/curriculum/publishing/publishing.workflow.js";
import type {
  BilingualContent,
  CourseVersion,
  ResourceRef,
} from "../modules/curriculum/domain/course-version.types.js";
import { MembershipRole, MembershipStatus } from "../common/security/index.js";
import { CourseImportModule } from "./course-import.module.js";

const RIGHTS_NOTE = "团队自有课程素材";
const IMPORT_NAME = "COMP-DEMO-03";
const SOFFICE = process.env.SOFFICE || "/usr/bin/soffice";

type Args = {
  sourceDir: string;
  schoolId?: string;
  classId?: string;
  enrollmentId?: string;
  practiceDefinitionId?: string;
};

type SourceFile = {
  path: string;
  name: string;
  checksumSha256: string;
  byteSize: number;
  mediaType: string;
  kind: "VIDEO" | "DOCUMENT";
  stableKey?: string;
};

type ParsedQuestion = { prompt: string; options: string[] };

function fail(message: string): never {
  throw new Error(`COMP-DEMO-03 import failed: ${message}`);
}

function parseArgs(values: readonly string[]): Args {
  const result: Partial<Args> = {};
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === "--source-dir")
      result.sourceDir = path.resolve(
        values[++i] ?? fail("--source-dir requires a directory"),
      );
    else if (value === "--school-id")
      result.schoolId = values[++i] ?? fail("--school-id requires a UUID");
    else if (value === "--class-id")
      result.classId = values[++i] ?? fail("--class-id requires a UUID");
    else if (value === "--enrollment-id")
      result.enrollmentId =
        values[++i] ?? fail("--enrollment-id requires a UUID");
    else if (value === "--practice-definition-id")
      result.practiceDefinitionId =
        values[++i] ?? fail("--practice-definition-id requires a UUID");
    else if (value === "--") continue;
    else fail(`unknown argument ${value}`);
  }
  if (!result.sourceDir) fail("pass --source-dir");
  if (result.classId && result.enrollmentId)
    fail("pass only one of --class-id or --enrollment-id");
  return result as Args;
}

function stableUuid(seed: string): string {
  const bytes = createHash("sha256").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

function docxParagraphs(file: string): string[] {
  const xml = execFileSync("unzip", ["-p", file, "word/document.xml"], {
    encoding: "utf8",
  });
  const paragraphs: string[] = [];
  for (const match of xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const text = [...match[1]!.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((part) => decodeXml(part[1]!))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

function cleanText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[（(]\s*[)）]/g, "")
    .trim();
}

function extractTeachingDesign(file: string, fallbackName: string) {
  const paragraphs = docxParagraphs(file);
  const title =
    paragraphs
      .find((line) => line.includes("教学设计"))
      ?.replace(/教学设计/g, "")
      .trim() || fallbackName.replace(/教学设计.*$/, "").trim();
  const start = paragraphs.findIndex((line) => line.includes("教学目标"));
  const end = paragraphs.findIndex(
    (line, index) => index > start && line.includes("教学内容"),
  );
  const goalText = paragraphs
    .slice(
      start >= 0 ? start : 0,
      end > start
        ? end
        : Math.min(paragraphs.length, (start >= 0 ? start : 0) + 8),
    )
    .join(" ")
    .replace(/^.*?教学目标\s*/, "");
  const goals = [...goalText.matchAll(/[^。！？!?]+[。！？!?]/g)]
    .map((match) => cleanText(match[0]!))
    .filter((line) => line.length > 8)
    .slice(0, 3);
  if (goals.length === 0)
    fail(`could not extract teaching objectives from ${file}`);
  const focus =
    paragraphs
      .find((line) => line.includes("教学重点"))
      ?.replace(/^.*?教学重点[:：]?/, "")
      .trim() ?? goals[0]!;
  return {
    title,
    goals,
    description: cleanText(
      focus || goals[0] || `围绕${title}开展课堂学习。`,
    ).slice(0, 140),
  };
}

function extractQuestions(file: string): ParsedQuestion[] {
  const text = docxParagraphs(file).join(" ");
  const choiceSection = text.split(/二、/)[0] ?? text;
  const questions: ParsedQuestion[] = [];
  for (const match of choiceSection.matchAll(
    /第\d+题[:：]([\s\S]*?)(?=第\d+题[:：]|$)/g,
  )) {
    const block = match[1]!.trim();
    const answerIndex = block.search(/正确答案[:：]/);
    const beforeAnswer = answerIndex >= 0 ? block.slice(0, answerIndex) : block;
    const firstOption = beforeAnswer.search(/\s*A\s*[.．]/);
    if (firstOption < 0) continue;
    const prompt = cleanText(beforeAnswer.slice(0, firstOption));
    const optionText = beforeAnswer.slice(firstOption);
    const options = [
      ...optionText.matchAll(
        /([A-D])\s*[.．]\s*([\s\S]*?)(?=\s+[A-D]\s*[.．]|$)/g,
      ),
    ]
      .map((option) => cleanText(option[2]!))
      .filter(Boolean);
    if (prompt && options.length >= 3) questions.push({ prompt, options });
    if (questions.length === 2) break;
  }
  if (questions.length === 0)
    fail(`could not extract a short choice question from ${file}`);
  return questions;
}

async function findSourceFiles(
  sourceDir: string,
): Promise<{
  video: SourceFile;
  pptx: string;
  teaching: string;
  exercise: string;
}> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(sourceDir, entry.name));
  const video = files.find((file) => file.toLowerCase().endsWith(".mp4"));
  const pptx = files.find((file) => file.toLowerCase().endsWith(".pptx"));
  const teaching = files.find(
    (file) => file.toLowerCase().endsWith(".docx") && file.includes("教学设计"),
  );
  const exercise = files.find(
    (file) =>
      file.toLowerCase().endsWith(".docx") &&
      (file.includes("课后练习") || file.includes("练习题")),
  );
  if (!video || !pptx || !teaching || !exercise)
    fail(
      "selected source directory must contain one MP4, PPTX, teaching-design DOCX, and exercise DOCX",
    );
  const body = await readFile(video);
  return {
    video: {
      path: video,
      name: path.basename(video),
      checksumSha256: createHash("sha256").update(body).digest("hex"),
      byteSize: body.byteLength,
      mediaType: "video/mp4",
      kind: "VIDEO",
    },
    pptx,
    teaching,
    exercise,
  };
}

function toBilingual(originalText: string): BilingualContent {
  return {
    originalText,
    locale: "zh-CN",
    translationSource: "NONE",
    reviewStatus: "REVIEWED",
  };
}

function safeKeyPart(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "resource"
  );
}

async function ensureResource(
  prisma: PrismaService,
  storage: StoragePort,
  schoolId: string,
  file: SourceFile,
): Promise<ResourceRef> {
  const body = await readFile(file.path);
  const objectKey = `schools/${schoolId}/course-imports/comp-demo-03/${file.kind.toLowerCase()}/${file.stableKey ?? file.checksumSha256}-${safeKeyPart(file.name)}`;
  let resource = await prisma.resource.findFirst({
    where: { objectKey, deletedAt: null },
  });
  if (!resource)
    resource = await prisma.resource.findFirst({
      where: {
        schoolId,
        kind: file.kind,
        checksumSha256: file.checksumSha256,
        deletedAt: null,
      },
    });
  const key = resource?.objectKey ?? objectKey;
  const head = await storage.headObject(key);
  const uploaded = !head.exists;
  if (uploaded)
    await storage.putObject(key, body, file.mediaType, {
      import: IMPORT_NAME,
      checksum: file.checksumSha256,
    });
  resource = resource
    ? await prisma.resource.update({
        where: { id: resource.id },
        data: {
          rightsStatus: "APPROVED",
          rightsNote: RIGHTS_NOTE,
          byteSize: file.byteSize,
          mediaType: file.mediaType,
          originalName: file.name,
          ...(uploaded ? { checksumSha256: file.checksumSha256 } : {}),
        },
      })
    : await prisma.resource.create({
        data: {
          schoolId,
          kind: file.kind,
          objectKey: key,
          originalName: file.name,
          mediaType: file.mediaType,
          byteSize: file.byteSize,
          checksumSha256: file.checksumSha256,
          rightsStatus: "APPROVED",
          rightsNote: RIGHTS_NOTE,
        },
      });
  return {
    id: resource.id,
    kind: resource.kind as ResourceRef["kind"],
    objectKey: resource.objectKey,
    mediaType: resource.mediaType,
    byteSize: Number(resource.byteSize),
    source: IMPORT_NAME,
    rightsStatus: "APPROVED",
    rightsNote: RIGHTS_NOTE,
  };
}

async function resolveSchool(
  prisma: PrismaService,
  requested?: string,
): Promise<string> {
  if (requested) {
    const school = await prisma.school.findFirst({
      where: { id: requested, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!school) fail("requested school is not active");
    return school.id;
  }
  const schools = await prisma.school.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      enrollments: { some: { role: "STUDENT", status: "ACTIVE" } },
    },
    select: { id: true },
  });
  if (schools.length !== 1)
    fail("pass --school-id when more than one active student school exists");
  return schools[0]!.id;
}

async function resolveTarget(
  prisma: PrismaService,
  schoolId: string,
  args: Args,
): Promise<{ classId: string; enrollmentId?: string }> {
  if (args.enrollmentId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: args.enrollmentId,
        schoolId,
        role: "STUDENT",
        status: "ACTIVE",
      },
      select: { id: true, classId: true },
    });
    if (!enrollment)
      fail(
        "requested enrollment is not an active student enrollment in the school",
      );
    return enrollment;
  }
  if (args.classId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        schoolId,
        classId: args.classId,
        role: "STUDENT",
        status: "ACTIVE",
      },
      select: { classId: true },
    });
    if (!enrollment)
      fail("requested class has no active student enrollment in the school");
    return { classId: enrollment.classId };
  }
  const classes = await prisma.enrollment.findMany({
    where: { schoolId, role: "STUDENT", status: "ACTIVE" },
    distinct: ["classId"],
    select: { classId: true },
  });
  if (classes.length !== 1)
    fail("pass --class-id or --enrollment-id when the target is ambiguous");
  return { classId: classes[0]!.classId };
}

async function resolveAuthor(
  prisma: PrismaService,
  schoolId: string,
): Promise<string> {
  const membership = await prisma.membership.findFirst({
    where: {
      schoolId,
      status: "ACTIVE",
      role: { in: ["TEACHER", "SCHOOL_ADMIN"] },
      user: { status: "ACTIVE" },
    },
    orderBy: { id: "asc" },
    select: { userId: true },
  });
  if (!membership)
    fail("no active teacher or school admin is available as course author");
  return membership.userId;
}

async function resolvePractice(
  prisma: PrismaService,
  schoolId: string,
  classId: string,
  requested?: string,
) {
  const where: Prisma.PracticeDefinitionWhereInput = requested
    ? {
        id: requested,
        status: "PUBLISHED",
        OR: [{ schoolId }, { schoolId: null }],
      }
    : {
        status: "PUBLISHED",
        OR: [{ schoolId }, { schoolId: null }],
        versions: {
          some: {
            status: "PUBLISHED",
            sections: {
              some: {
                items: { some: { itemType: { in: ["READ_ALOUD", "SPEECH"] } } },
              },
            },
          },
        },
      };
  const definitions = await prisma.practiceDefinition.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });
  for (const definition of definitions) {
    const delivery = await prisma.practiceDelivery.findFirst({
      where: {
        schoolId,
        classId,
        studentId: null,
        status: "OPEN",
        practiceVersion: {
          status: "PUBLISHED",
          definitionId: definition.id,
          definition: { status: "PUBLISHED" },
        },
      },
      select: { id: true },
    });
    if (delivery) return { ...definition, deliveryId: delivery.id };
  }
  fail(
    requested
      ? "requested practice has no OPEN class delivery for the target"
      : "no published READ_ALOUD practice with an OPEN target-class delivery was found",
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sources = await findSourceFiles(args.sourceDir);
  const teaching = extractTeachingDesign(
    sources.teaching,
    path.basename(args.sourceDir),
  );
  const questions = extractQuestions(sources.exercise);
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), "comp-demo-03-"));
  execFileSync(
    SOFFICE,
    [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      artifactDir,
      sources.pptx,
    ],
    { stdio: "ignore" },
  );
  const convertedPdf = path.join(
    artifactDir,
    `${path.basename(sources.pptx, ".pptx")}.pdf`,
  );
  const pdfBody = await readFile(convertedPdf);
  const pptxBody = await readFile(sources.pptx);
  const pptxChecksum = createHash("sha256").update(pptxBody).digest("hex");
  const pdf: SourceFile = {
    path: convertedPdf,
    name: path.basename(convertedPdf),
    checksumSha256: createHash("sha256").update(pdfBody).digest("hex"),
    stableKey: pptxChecksum,
    byteSize: pdfBody.byteLength,
    mediaType: "application/pdf",
    kind: "DOCUMENT",
  };

  const app = await NestFactory.createApplicationContext(CourseImportModule, {
    logger: ["error", "warn"],
  });
  try {
    const prisma = app.get(PrismaService);
    const storage = app.get<StoragePort>(STORAGE_PORT);
    await storage.ensureBucket?.();
    const schoolId = await resolveSchool(prisma, args.schoolId);
    const target = await resolveTarget(prisma, schoolId, args);
    const authorUserId = await resolveAuthor(prisma, schoolId);
    const practice = await resolvePractice(
      prisma,
      schoolId,
      target.classId,
      args.practiceDefinitionId,
    );
    const videoResource = await ensureResource(
      prisma,
      storage,
      schoolId,
      sources.video,
    );
    const pdfResource = await ensureResource(prisma, storage, schoolId, pdf);
    const resourceMap = new Map([
      [videoResource.id, videoResource],
      [pdfResource.id, pdfResource],
    ]);
    const importKey = `${IMPORT_NAME}:${sources.video.checksumSha256}:${pptxChecksum}`;
    const courseId = stableUuid(`${importKey}:course`);
    const versionId = stableUuid(`${importKey}:version`);
    const unitId = stableUuid(`${importKey}:unit`);
    const lessonId = stableUuid(`${importKey}:lesson`);
    const activityIds = [1, 2, 3, 4, 5].map((index) =>
      stableUuid(`${importKey}:activity:${index}`),
    );
    const now = new Date();
    const note = (text: string) => toBilingual(text);
    const version: CourseVersion = {
      id: versionId,
      schoolId,
      courseId,
      authorUserId,
      version: 1,
      status: "DRAFT",
      title: teaching.title,
      description: teaching.description,
      gradeBand: "七年级",
      capabilityTheme: "发音与朗读",
      difficulty: "基础",
      locale: "zh-CN",
      objectives: teaching.goals.map(toBilingual),
      coverAsset: "/assets/course-bg/spring-highland.png",
      taskGroups: ["阅读与表达"],
      culturalElements: ["藏汉文化", "春日写景"],
      estimatedMinutes: 10,
      deviceRequirements: { audioPlayback: true, microphone: false },
      units: [
        {
          id: unitId,
          title: "核心学习路径",
          sortOrder: 0,
          lessons: [
            {
              id: lessonId,
              title: teaching.title,
              sortOrder: 0,
              activities: [
                {
                  id: activityIds[0]!,
                  type: "VIDEO",
                  title: teaching.title,
                  instruction: note(
                    "观看真实课堂录像，留意核心词语的发音示范。",
                  ),
                  sortOrder: 0,
                  required: true,
                  completionRule: { type: "ACKNOWLEDGED" },
                  content: { description: "真实示范课录像" },
                  resources: [videoResource],
                  teacherNotes: note("课堂录像来自团队自有示范课素材。"),
                  studentNotes: note("观看视频并注意朗读示范。"),
                },
                {
                  id: activityIds[1]!,
                  type: "TEXT",
                  title: "本节课件",
                  instruction: note("打开课件，配合视频回顾本节课重点。"),
                  sortOrder: 1,
                  required: true,
                  completionRule: { type: "ACKNOWLEDGED" },
                  content: {
                    text: "本课件对应《春》生字认读与易错音纠正课堂。",
                  },
                  resources: [pdfResource],
                  teacherNotes: note("课件为本节真实教学课件的 PDF 转换产物。"),
                  studentNotes: note("打开课件后确认已阅读。"),
                },
                {
                  id: activityIds[2]!,
                  type: "CHOICE",
                  title: "本节练习：词语读音",
                  instruction: note("根据真实课后练习选择正确答案。"),
                  sortOrder: 2,
                  required: true,
                  completionRule: { type: "ACKNOWLEDGED" },
                  content: questions[0],
                  resources: [],
                  teacherNotes: note(
                    "题目摘自本节课后练习 DOCX，保留原题选项。",
                  ),
                  studentNotes: note("选择你认为正确的选项并提交。"),
                },
                {
                  id: activityIds[3]!,
                  type: "TEXT",
                  title: "学习要点",
                  instruction: note("回顾本课的易错音和练习方法。"),
                  sortOrder: 3,
                  required: true,
                  completionRule: { type: "ACKNOWLEDGED" },
                  content: { text: teaching.goals.slice(0, 2).join(" ") },
                  resources: [],
                  teacherNotes: note("学习要点来自教学设计中的真实教学目标。"),
                  studentNotes: note("读完学习要点后确认。"),
                },
                {
                  id: activityIds[4]!,
                  type: "CHOICE",
                  title: "朗读训练 / 本课能力练习",
                  instruction: note(
                    "进入现有统一练习执行器，完成真实朗读与测评链。",
                  ),
                  sortOrder: 4,
                  required: true,
                  completionRule: { type: "COURSE_PRACTICE_SUBMITTED" },
                  content: { practiceLabel: practice.title },
                  resources: [],
                  teacherNotes: note(
                    "本活动通过 CourseActivityPractice 复用现有 PracticeDefinition。",
                  ),
                  studentNotes: note("点击朗读训练进入统一练习执行器。"),
                },
              ],
            },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    const versionRepo = new PrismaCourseVersionRepository(prisma);
    const existing = await prisma.courseVersion.findUnique({
      where: { id: versionId },
      select: { status: true, updatedAt: true },
    });
    let saved: CourseVersion;
    if (existing?.status === "PUBLISHED") {
      await prisma.courseVersion.update({
        where: { id: versionId },
        data: {
          description: teaching.description,
          capabilityTheme: version.capabilityTheme ?? null,
          difficulty: version.difficulty ?? null,
          estimatedMinutes: version.estimatedMinutes ?? null,
          coverAsset: version.coverAsset ?? null,
          deviceRequirements:
            version.deviceRequirements == null
              ? Prisma.DbNull
              : (version.deviceRequirements as Prisma.InputJsonValue),
          taskGroups:
            version.taskGroups == null
              ? Prisma.DbNull
              : (version.taskGroups as Prisma.InputJsonValue),
          culturalElements:
            version.culturalElements == null
              ? Prisma.DbNull
              : (version.culturalElements as Prisma.InputJsonValue),
        },
      });
      saved = (await versionRepo.findById(schoolId, versionId))!;
    } else
      saved = await versionRepo.save(version, {
        generateVersion: false,
        ...(existing ? { expectedUpdatedAt: existing.updatedAt } : {}),
      });
    const published = await executePublish(
      versionRepo,
      new PrismaResourceLookupAdapter(prisma),
      {
        requestId: IMPORT_NAME,
        principal: {
          userId: authorUserId,
          roles: [MembershipRole.SCHOOL_ADMIN],
          membershipStatus: MembershipStatus.ACTIVE,
          source: "local-import",
        },
        tenant: { schoolId },
      },
      schoolId,
      saved.id,
      now,
    );
    await prisma.courseActivityPractice.upsert({
      where: { activityId: activityIds[4]! },
      update: { schoolId, practiceDefinitionId: practice.id, required: true },
      create: {
        id: stableUuid(`${importKey}:practice-bridge`),
        schoolId,
        activityId: activityIds[4]!,
        practiceDefinitionId: practice.id,
        required: true,
      },
    });

    const assignmentId = stableUuid(`${importKey}:assignment`);
    const targetId = stableUuid(`${importKey}:assignment-target`);
    const existingAssignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { courseVersionId: true },
    });
    if (
      existingAssignment &&
      existingAssignment.courseVersionId !== published.id
    )
      fail("stable assignment id belongs to a different course version");
    const startsAt = new Date();
    const dueAt = new Date(startsAt.getTime() + 365 * 24 * 60 * 60 * 1000);
    await prisma.assignment.upsert({
      where: { id: assignmentId },
      update: {
        status: "OPEN",
        courseVersionId: published.id,
        title: teaching.title,
        openedAt: new Date(),
      },
      create: {
        id: assignmentId,
        schoolId,
        courseVersionId: published.id,
        createdByUserId: authorUserId,
        title: teaching.title,
        status: "OPEN",
        startsAt,
        dueAt,
        openedAt: startsAt,
        source: "TEACHER_ASSIGNED",
        completionRule: { requiredActivities: "ALL", requiredPractices: "ALL" },
      },
    });
    await prisma.assignmentTarget.upsert({
      where: { id: targetId },
      update: {
        targetType: args.enrollmentId ? "STUDENT" : "CLASS",
        classId: args.enrollmentId ? null : target.classId,
        enrollmentId: args.enrollmentId ?? null,
      },
      create: {
        id: targetId,
        schoolId,
        assignmentId,
        targetType: args.enrollmentId ? "STUDENT" : "CLASS",
        classId: args.enrollmentId ? null : target.classId,
        enrollmentId: args.enrollmentId ?? null,
      },
    });
    console.log(
      JSON.stringify(
        {
          mode: "APPLY",
          importKey,
          selectedLesson: teaching.title,
          courseVersionId: published.id,
          assignmentId,
          practiceDefinitionId: practice.id,
          resourceCount: resourceMap.size,
          resources: [...resourceMap.values()].map((resource) => ({
            id: resource.id,
            kind: resource.kind,
            mediaType: resource.mediaType,
          })),
          target,
          sourceFiles: {
            video: sources.video,
            pptx: path.basename(sources.pptx),
            pdf,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
