import { randomUUID } from "node:crypto";
import type { Resource } from "../../../src/modules/resources/domain/resource.types.js";

export function approvedImageResource(
  overrides: Partial<Resource> = {},
): Resource {
  return {
    id: randomUUID(),
    schoolId: null,
    kind: "IMAGE",
    objectKey: "curriculum/images/sample.png",
    originalName: "sample.png",
    mediaType: "image/png",
    byteSize: 1024,
    checksumSha256: "abc123",
    rightsStatus: "APPROVED",
    rightsNote: "Licensed for educational use",
    offlineAllowed: true,
    ...overrides,
  };
}

export function approvedAudioResource(
  overrides: Partial<Resource> = {},
): Resource {
  return {
    id: randomUUID(),
    schoolId: null,
    kind: "AUDIO",
    objectKey: "curriculum/audio/sample.mp3",
    originalName: "sample.mp3",
    mediaType: "audio/mpeg",
    byteSize: 2048,
    checksumSha256: "def456",
    rightsStatus: "APPROVED",
    rightsNote: "Licensed for educational use",
    offlineAllowed: true,
    ...overrides,
  };
}

export function unknownCopyrightResource(
  overrides: Partial<Resource> = {},
): Resource {
  return {
    id: randomUUID(),
    schoolId: null,
    kind: "IMAGE",
    objectKey: "curriculum/images/unknown.png",
    originalName: "unknown.png",
    mediaType: "image/png",
    byteSize: 1024,
    checksumSha256: "ghi789",
    rightsStatus: "UNKNOWN",
    offlineAllowed: false,
    ...overrides,
  };
}
