import { NestFactory } from "@nestjs/core";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaService } from "../shared/database/prisma.service.js";
import {
  QuestionBankRuntimeImportService,
  type CanonicalManifest,
} from "../modules/assessment/question-bank-runtime-import.service.js";
import { QuestionBankApplyModule } from "./question-bank-apply.module.js";

type CommandArguments = {
  apply: boolean;
  level?: number;
  all: boolean;
  schoolId?: string;
  classId?: string;
  sourceDir?: string;
};

type SourceImporterModule = {
  defaultOptions: { questions: string; answers: string; media: string };
  readZipEntry(file: string, entry: string): Promise<Uint8Array>;
  run(values?: readonly string[] | Record<string, unknown>): Promise<{
    report: { selectedLevel: number | null; summary: { items: number; points: number; bound: number; missing: number; ambiguous: number }; validation: { errors: number } };
    manifest: CanonicalManifest;
  }>;
};

function fail(message: string): never {
  throw new Error(`Question Bank apply failed: ${message}`);
}

function parseArguments(values: readonly string[]): CommandArguments {
  const result: CommandArguments = { apply: false, all: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--") continue;
    if (value === "--apply") {
      result.apply = true;
      continue;
    }
    if (value === "--all") {
      result.all = true;
      continue;
    }
    if (value === "--level") {
      result.level = Number(values[++index]);
      continue;
    }
    if (value === "--school-id") {
      const schoolId = values[++index];
      if (!schoolId) fail("--school-id requires a UUID value");
      result.schoolId = schoolId;
      continue;
    }
    if (value === "--class-id") {
      const classId = values[++index];
      if (!classId) fail("--class-id requires a UUID value");
      result.classId = classId;
      continue;
    }
    if (value === "--source-dir") {
      const sourceDir = values[++index];
      if (!sourceDir) fail("--source-dir requires a directory path");
      result.sourceDir = path.resolve(sourceDir);
      continue;
    }
    fail(`unknown command argument ${value}`);
  }
  if (result.all && result.level !== undefined) fail("use either --all or --level, not both");
  if (!result.all && result.level === undefined) fail("pass --level 1–6 or --all");
  if (result.level !== undefined && (!Number.isInteger(result.level) || result.level < 1 || result.level > 6)) {
    fail("--level must be an integer from 1 through 6");
  }
  return result;
}

async function sourceIdentity(file: string) {
  const body = await readFile(file);
  return {
    fileName: path.basename(file),
    sha256: createHash("sha256").update(body).digest("hex"),
  };
}

async function resolveTarget(
  prisma: PrismaService,
  requested: CommandArguments,
): Promise<{ schoolId: string; classId: string }> {
  let schoolId = requested.schoolId;
  if (!schoolId) {
    const schools = await prisma.school.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        enrollments: { some: { role: "STUDENT", status: "ACTIVE" } },
      },
      select: { id: true },
    });
    if (schools.length !== 1) {
      fail("could not determine one development school; pass --school-id explicitly");
    }
    schoolId = schools[0]!.id;
  } else {
    const school = await prisma.school.findFirst({ where: { id: schoolId, isActive: true, deletedAt: null }, select: { id: true } });
    if (!school) fail("requested school is not an active school");
  }

  let classId = requested.classId;
  if (!classId) {
    const classes = await prisma.enrollment.findMany({
      where: { schoolId, role: "STUDENT", status: "ACTIVE" },
      distinct: ["classId"],
      select: { classId: true },
    });
    if (classes.length !== 1) {
      fail("could not determine one active development class; pass --class-id explicitly");
    }
    classId = classes[0]!.classId;
  } else {
    const enrollment = await prisma.enrollment.findFirst({
      where: { schoolId, classId, role: "STUDENT", status: "ACTIVE" },
      select: { id: true },
    });
    if (!enrollment) fail("requested class has no active student enrollment in the target school");
  }
  return { schoolId, classId };
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));

  const importerPath = pathToFileURL(path.join(process.cwd(), "tools/question-bank-importer/index.mjs")).href;
  const sourceImporter = await import(importerPath) as SourceImporterModule;
  const sourceDir = arguments_.sourceDir
    ?? (process.env.QUESTION_BANK_SOURCE_DIR ? path.resolve(process.env.QUESTION_BANK_SOURCE_DIR) : undefined)
    ?? path.dirname(sourceImporter.defaultOptions.questions);
  const sourceOptions = {
    questions: path.join(sourceDir, "题库【三改】.docx"),
    answers: path.join(sourceDir, "答案及评分细则.docx"),
    media: path.join(sourceDir, "题库音频及图片.zip"),
    contentRepairs: path.join(process.cwd(), "tools/question-bank-importer/content-repairs.json"),
    output: path.join(process.env.TMPDIR ?? "/tmp", "yuzan-question-bank-generated"),
  };
  // This re-runs the canonical parser + validator before any Nest context,
  // database connection, MinIO call, or source-to-runtime conversion exists.
  const preflight = await sourceImporter.run({
    ...sourceOptions,
    ...(arguments_.all ? { all: true } : { level: arguments_.level }),
  });
  const expectedLevels = arguments_.all ? 6 : 1;
  const expectedItems = expectedLevels * 20;
  const expectedPoints = expectedLevels * 100;
  if (
    (arguments_.all ? preflight.report.selectedLevel !== null : preflight.report.selectedLevel !== arguments_.level)
    || preflight.report.summary.items !== expectedItems
    || preflight.report.summary.points !== expectedPoints
    || preflight.report.summary.bound !== expectedItems
    || preflight.report.summary.missing !== 0
    || preflight.report.summary.ambiguous !== 0
    || preflight.report.validation.errors !== 0
  ) {
    fail(`canonical preflight did not satisfy the required ${expectedItems}-item, ${expectedPoints}-point, zero-error gate`);
  }
  if (!arguments_.apply) {
    console.log(JSON.stringify({
      mode: "DRY RUN — NO DATABASE WRITE — NO MINIO WRITE",
      level: arguments_.all ? "all" : arguments_.level,
      preflight: preflight.report.summary,
    }, null, 2));
    return;
  }

  const sourceDocuments = {
    questionDocx: await sourceIdentity(sourceOptions.questions),
    answerDocx: await sourceIdentity(sourceOptions.answers),
    mediaArchive: await sourceIdentity(sourceOptions.media),
  };
  const app = await NestFactory.createApplicationContext(QuestionBankApplyModule, { logger: ["error", "warn"] });
  try {
    const prisma = app.get(PrismaService);
    const service = app.get(QuestionBankRuntimeImportService);
    const target = await resolveTarget(prisma, arguments_);
    const result = await service.apply({
      ...target,
      manifest: preflight.manifest,
      sourceDocuments,
      readMedia: (zipPath) => sourceImporter.readZipEntry(sourceOptions.media, zipPath),
    });
    console.log(JSON.stringify({
      mode: "APPLY",
      level: arguments_.all ? "all" : arguments_.level,
      target,
      preflight: preflight.report.summary,
      result,
    }, null, 2));
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
