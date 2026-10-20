import { describe, expect, it, vi } from "vitest";
import {
  MembershipRole,
  MembershipStatus,
  createAuthContext,
} from "../../../src/common/security/index.js";
import type {
  Principal,
  TenantContext,
} from "../../../src/common/security/auth.types.js";
import { RecordingsService } from "../../../src/modules/recordings/recordings.service.js";
import { SubmissionsController } from "../../../src/modules/submissions/submissions.controller.js";
import { SubmissionsService } from "../../../src/modules/submissions/submissions.service.js";

const SCHOOL_ID = "school-0000-0000-0000-000000000001";
const SUBMISSION_ID = "submission-0000-0000-0000-000000000001";
const ENROLLMENT_ID = "enrollment-0000-0000-0000-000000000001";

function makePrincipal(
  role: MembershipRole,
  userId = "actor-1",
): Principal {
  return {
    userId,
    roles: [role],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  };
}

function makeController(
  getSubmission: ReturnType<typeof vi.fn>,
  getSubmissionRecordingPlayback: ReturnType<typeof vi.fn>,
) {
  const submissions = { getSubmission } as unknown as SubmissionsService;
  const recordings = {
    getSubmissionRecordingPlayback,
  } as unknown as RecordingsService;
  return new SubmissionsController(submissions, recordings);
}

describe("SubmissionsController submission recording playback", () => {
  const tenant: TenantContext = { schoolId: SCHOOL_ID };

  it("authorizes the exact submission before asking for its recording URL", async () => {
    const order: string[] = [];
    const getSubmission = vi.fn(() => {
      order.push("submission");
      return Promise.resolve({
        id: SUBMISSION_ID,
        schoolId: SCHOOL_ID,
        enrollmentId: ENROLLMENT_ID,
      });
    });
    const getPlayback = vi.fn(() => {
      order.push("playback");
      return Promise.resolve({
        id: "recording-1",
        durationMs: 3200,
        mimeType: "audio/webm",
        downloadUrl: "https://storage.example.test/signed/audio",
        createdAt: new Date("2026-10-20T00:00:00.000Z"),
        updatedAt: new Date("2026-10-20T00:00:00.000Z"),
      });
    });
    const controller = makeController(getSubmission, getPlayback);
    const principal = makePrincipal(MembershipRole.TEACHER);

    await controller.getSubmissionRecordingPlayback(
      SCHOOL_ID,
      SUBMISSION_ID,
      tenant,
      principal,
    );

    const auth = createAuthContext("request-id", principal, tenant);
    expect(order).toEqual(["submission", "playback"]);
    expect(getSubmission).toHaveBeenCalledWith(auth, SCHOOL_ID, SUBMISSION_ID);
    expect(getPlayback).toHaveBeenCalledWith(
      auth,
      SCHOOL_ID,
      SUBMISSION_ID,
      ENROLLMENT_ID,
    );
    expect(getPlayback).toHaveBeenCalledTimes(1);
  });

  it("preserves the school-admin authorization path", async () => {
    const getSubmission = vi.fn().mockResolvedValue({
      id: SUBMISSION_ID,
      schoolId: SCHOOL_ID,
      enrollmentId: ENROLLMENT_ID,
    });
    const getPlayback = vi.fn().mockResolvedValue({ id: "recording-1" });
    const controller = makeController(getSubmission, getPlayback);
    const principal = makePrincipal(MembershipRole.SCHOOL_ADMIN, "admin-1");

    await controller.getSubmissionRecordingPlayback(
      SCHOOL_ID,
      SUBMISSION_ID,
      tenant,
      principal,
    );

    expect(getSubmission).toHaveBeenCalledWith(
      createAuthContext("request-id", principal, tenant),
      SCHOOL_ID,
      SUBMISSION_ID,
    );
    expect(getPlayback).toHaveBeenCalledOnce();
  });

  it.each([
    { reason: "class authorization", status: 403 },
    { reason: "missing or deleted submission", status: 404 },
    { reason: "cross-school authorization", status: 403 },
  ])("never requests a URL when $reason fails", async ({ reason, status }) => {
    const getSubmission = vi.fn().mockRejectedValue(
      new Error(`${reason} denied with status ${status}`),
    );
    const getPlayback = vi.fn();
    const controller = makeController(getSubmission, getPlayback);

    await expect(
      controller.getSubmissionRecordingPlayback(
        SCHOOL_ID,
        SUBMISSION_ID,
        tenant,
        makePrincipal(MembershipRole.TEACHER),
      ),
    ).rejects.toThrow(`${reason} denied with status ${status}`);
    expect(getPlayback).not.toHaveBeenCalled();
  });
});
