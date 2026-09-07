#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const SOFFICE = process.env.SOFFICE || "/usr/bin/soffice";

function fail(message) {
  throw new Error(`COMP-DEMO-03 preflight failed: ${message}`);
}

function arg(values, name) {
  const index = values.indexOf(name);
  return index < 0 ? undefined : values[index + 1];
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function paragraphs(file) {
  const xml = execFileSync("unzip", ["-p", file, "word/document.xml"], {
    encoding: "utf8",
  });
  return [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)]
    .map((match) =>
      [...match[1].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((part) => decodeXml(part[1]))
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function extractManifest(sourceDir, files) {
  const teachingLines = paragraphs(files.teaching);
  const title =
    teachingLines
      .find((line) => line.includes("教学设计"))
      ?.replace(/教学设计/g, "")
      .trim() || path.basename(sourceDir);
  const start = teachingLines.findIndex((line) => line.includes("教学目标"));
  const end = teachingLines.findIndex(
    (line, index) => index > start && line.includes("教学内容"),
  );
  const goalText = teachingLines
    .slice(
      start >= 0 ? start : 0,
      end > start ? end : start >= 0 ? start + 8 : 8,
    )
    .join(" ")
    .replace(/^.*?教学目标\s*/, "");
  const goals = [...goalText.matchAll(/[^。！？!?]+[。！？!?]/g)]
    .map((match) => match[0].trim())
    .filter((line) => line.length > 8)
    .slice(0, 3);
  const exerciseText = paragraphs(files.exercise).join(" ");
  const shortQuestions = [
    ...exerciseText
      .split(/二、/)[0]
      .matchAll(/第\d+题[:：]([\s\S]*?)(?=第\d+题[:：]|$)/g),
  ]
    .slice(0, 2)
    .map((match) => match[1].trim().slice(0, 220));
  return {
    selectedLesson: title,
    objectives: goals,
    shortQuestions,
    conversion: "soffice-headless-pdf",
  };
}

async function main() {
  const values = process.argv.slice(2);
  const sourceDir = path.resolve(
    arg(values, "--source-dir") ||
      "习题课程资源/示范课/1-1+《春》生字认读与易错音纠正+王雨晴",
  );
  const entries = (await readdir(sourceDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(sourceDir, entry.name));
  const video = entries.find((file) => file.toLowerCase().endsWith(".mp4"));
  const pptx = entries.find((file) => file.toLowerCase().endsWith(".pptx"));
  const teaching = entries.find((file) => file.endsWith("教学设计.docx"));
  const exercise = entries.find(
    (file) => file.endsWith("练习题.docx") || file.endsWith("课后练习.docx"),
  );
  if (!video || !pptx || !teaching || !exercise)
    fail(
      "source directory must contain one MP4, PPTX, teaching-design DOCX, and exercise DOCX",
    );
  const videoBody = await readFile(video);
  let durationSeconds = null;
  try {
    durationSeconds = Number(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=nw=1:nk=1",
          video,
        ],
        { encoding: "utf8" },
      ).trim(),
    );
  } catch {
    fail("ffprobe could not inspect the selected MP4");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
    fail("selected MP4 has no usable duration");
  if (
    typeof execFileSync(SOFFICE, ["--version"], { encoding: "utf8" }) !==
    "string"
  )
    fail("soffice is not available");
  const manifest = {
    mode: "DRY RUN — NO DATABASE WRITE — NO MINIO WRITE",
    sourceDir,
    selectedLesson: extractManifest(sourceDir, { teaching, exercise })
      .selectedLesson,
    sourceFiles: {
      video: {
        name: path.basename(video),
        bytes: videoBody.byteLength,
        sha256: createHash("sha256").update(videoBody).digest("hex"),
        durationSeconds,
      },
      pptx: {
        name: path.basename(pptx),
        bytes: (await readFile(pptx)).byteLength,
      },
      teachingDesign: path.basename(teaching),
      exercise: path.basename(exercise),
    },
    ...extractManifest(sourceDir, { teaching, exercise }),
    scope:
      "exactly one selected lesson; original MP4/PPTX/DOCX remains outside Git",
  };
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
