import { describe, expect, it } from "vitest";
import {
  ConsentRequiredException,
  SupportPairingForbiddenException,
  SupportPairingNotFoundException,
  SupportPairingUnavailableException,
  SupportSessionNotFoundException,
} from "../../../src/modules/support-pairings/domain/support-pairing.errors.js";
import {
  ConsentStatus,
  PairingStatus,
  RiskLevel,
  TeacherReviewStatus,
} from "../../../src/modules/support-pairings/domain/support-pairing.types.js";
import { UnavailableSupportPairingRepository } from "../../../src/modules/support-pairings/ports/unavailable-support-pairing.repository.js";
import { SupportPairingsService } from "../../../src/modules/support-pairings/support-pairings.service.js";
import { FakeSupportPairingRepository } from "./fakes/fake-support-pairing.repository.js";
import { supportPairing, supportSession } from "./fixtures/support-pairings.js";
import {
  schoolAdminAuth,
  studentAuth,
  teacherAuth,
  volunteerAuth,
} from "./fixtures/users.js";

function createService(repo?: FakeSupportPairingRepository) {
  const r = repo ?? new FakeSupportPairingRepository();
  return { service: new SupportPairingsService(r), repo: r };
}

const schoolId = "school-1";

describe("SupportPairingsService", () => {
  // ------------------------------------------------------------------ //
  // createPairing
  // ------------------------------------------------------------------ //
  describe("createPairing", () => {
    it("creates a pairing with PENDING_CONSENT status", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth(schoolId);

      const result = await service.createPairing(auth, schoolId, {
        studentUserId: "student-1",
        volunteerUserId: "volunteer-1",
        supervisorTeacherId: "teacher-1",
        goal: "学业辅导",
      });

      expect(result.status).toBe("PENDING_CONSENT");
      expect(result.consentStatus).toBe("PENDING");
      expect(result.goal).toBe("学业辅导");
    });

    it("allows SCHOOL_ADMIN to create a pairing", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth(schoolId);

      const result = await service.createPairing(auth, schoolId, {
        studentUserId: "student-1",
        volunteerUserId: "volunteer-1",
        supervisorTeacherId: "teacher-1",
        goal: "心理支持",
      });

      expect(result).toBeDefined();
    });

    it("allows TEACHER to create a pairing", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      const result = await service.createPairing(auth, schoolId, {
        studentUserId: "student-1",
        volunteerUserId: "volunteer-1",
        supervisorTeacherId: "teacher-1",
        goal: "心理支持",
      });

      expect(result).toBeDefined();
    });

    it("denies STUDENT from creating a pairing", async () => {
      const { service } = createService();
      const auth = studentAuth(schoolId);

      await expect(
        service.createPairing(auth, schoolId, {
          studentUserId: "student-1",
          volunteerUserId: "volunteer-1",
          supervisorTeacherId: "teacher-1",
          goal: "学业辅导",
        }),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });
  });

  // ------------------------------------------------------------------ //
  // updateConsent
  // ------------------------------------------------------------------ //
  describe("updateConsent", () => {
    it("grants consent on a pending pairing", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, consentStatus: ConsentStatus.PENDING, status: PairingStatus.PENDING_CONSENT });
      repo.addPairing(p);
      const auth = schoolAdminAuth(schoolId);

      const result = await service.updateConsent(auth, schoolId, p.id, ConsentStatus.GRANTED);

      expect(result.consentStatus).toBe("GRANTED");
    });

    it("allows the student to update consent for their own pairing", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, studentUserId: "student-1", consentStatus: ConsentStatus.PENDING, status: PairingStatus.PENDING_CONSENT });
      repo.addPairing(p);
      const auth = studentAuth(schoolId, { userId: "student-1" });

      const result = await service.updateConsent(auth, schoolId, p.id, ConsentStatus.GRANTED);

      expect(result.consentStatus).toBe("GRANTED");
    });

    it("denies consent update by unrelated student", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, studentUserId: "student-1", consentStatus: ConsentStatus.PENDING });
      repo.addPairing(p);
      const auth = studentAuth(schoolId, { userId: "other-student" });

      await expect(
        service.updateConsent(auth, schoolId, p.id, ConsentStatus.GRANTED),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });

    it("denies consent update on a non-existent pairing", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.updateConsent(auth, schoolId, "missing-id", ConsentStatus.GRANTED),
      ).rejects.toThrow(SupportPairingNotFoundException);
    });

    it("can deny consent", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, consentStatus: ConsentStatus.PENDING });
      repo.addPairing(p);
      const auth = schoolAdminAuth(schoolId);

      const result = await service.updateConsent(auth, schoolId, p.id, ConsentStatus.DENIED);

      expect(result.consentStatus).toBe("DENIED");
    });
  });

  // ------------------------------------------------------------------ //
  // updatePairingStatus — consent flow
  // ------------------------------------------------------------------ //
  describe("updatePairingStatus", () => {
    it("requires consent before activating a pairing", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, consentStatus: ConsentStatus.PENDING, status: PairingStatus.PENDING_CONSENT });
      repo.addPairing(p);
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.updatePairingStatus(auth, schoolId, p.id, PairingStatus.ACTIVE),
      ).rejects.toThrow(ConsentRequiredException);
    });

    it("activates a pairing after consent is granted", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, consentStatus: ConsentStatus.GRANTED, status: PairingStatus.PENDING_CONSENT });
      repo.addPairing(p);
      const auth = schoolAdminAuth(schoolId);

      const result = await service.updatePairingStatus(auth, schoolId, p.id, PairingStatus.ACTIVE);

      expect(result.status).toBe("ACTIVE");
    });

    it("denies STUDENT from updating pairing status", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, consentStatus: ConsentStatus.GRANTED, status: PairingStatus.PENDING_CONSENT });
      repo.addPairing(p);
      const auth = studentAuth(schoolId);

      await expect(
        service.updatePairingStatus(auth, schoolId, p.id, PairingStatus.ACTIVE),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });
  });

  // ------------------------------------------------------------------ //
  // createSession
  // ------------------------------------------------------------------ //
  describe("createSession", () => {
    it("creates a session on an active pairing", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE, consentStatus: ConsentStatus.GRANTED });
      repo.addPairing(p);
      const auth = teacherAuth(schoolId);

      const result = await service.createSession(auth, schoolId, p.id, new Date());

      expect(result.pairingId).toBe(p.id);
      expect(result.riskLevel).toBe("LOW");
      expect(result.teacherReviewStatus).toBe("PENDING");
    });

    it("denies creating a session on a non-active pairing", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.PENDING_CONSENT });
      repo.addPairing(p);
      const auth = teacherAuth(schoolId);

      await expect(
        service.createSession(auth, schoolId, p.id, new Date()),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });

    it("denies STUDENT from creating a session", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE });
      repo.addPairing(p);
      const auth = studentAuth(schoolId);

      await expect(
        service.createSession(auth, schoolId, p.id, new Date()),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });

    it("allows the paired volunteer to create a session", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE, volunteerUserId: "volunteer-1" });
      repo.addPairing(p);
      const auth = volunteerAuth(schoolId, { userId: "volunteer-1" });

      const result = await service.createSession(auth, schoolId, p.id, new Date());

      expect(result.pairingId).toBe(p.id);
    });

    it("throws not found for a missing pairing", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      await expect(
        service.createSession(auth, schoolId, "missing-id", new Date()),
      ).rejects.toThrow(SupportPairingNotFoundException);
    });
  });

  // ------------------------------------------------------------------ //
  // reviewSession — high-risk handling
  // ------------------------------------------------------------------ //
  describe("reviewSession", () => {
    it("allows teacher to review a session", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE });
      repo.addPairing(p);
      const s = supportSession({ pairingId: p.id });
      repo.addSession(s);
      const auth = teacherAuth(schoolId);

      const result = await service.reviewSession(auth, schoolId, p.id, s.id, TeacherReviewStatus.REVIEWED);

      expect(result.teacherReviewStatus).toBe("REVIEWED");
    });

    it("allows teacher to review a high-risk session", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE });
      repo.addPairing(p);
      const s = supportSession({ pairingId: p.id, riskLevel: RiskLevel.HIGH });
      repo.addSession(s);
      const auth = teacherAuth(schoolId);

      const result = await service.reviewSession(auth, schoolId, p.id, s.id, TeacherReviewStatus.REVIEWED);

      expect(result.teacherReviewStatus).toBe("REVIEWED");
    });

    it("allows teacher to flag a critical-risk session", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE });
      repo.addPairing(p);
      const s = supportSession({ pairingId: p.id, riskLevel: RiskLevel.CRITICAL });
      repo.addSession(s);
      const auth = teacherAuth(schoolId);

      const result = await service.reviewSession(auth, schoolId, p.id, s.id, TeacherReviewStatus.FLAGGED);

      expect(result.teacherReviewStatus).toBe("FLAGGED");
    });

    it("denies STUDENT from reviewing a session", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE });
      repo.addPairing(p);
      const s = supportSession({ pairingId: p.id });
      repo.addSession(s);
      const auth = studentAuth(schoolId);

      await expect(
        service.reviewSession(auth, schoolId, p.id, s.id, TeacherReviewStatus.REVIEWED),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });

    it("throws not found when session does not belong to the pairing", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE });
      repo.addPairing(p);
      const otherP = supportPairing({ schoolId, status: PairingStatus.ACTIVE });
      repo.addPairing(otherP);
      const s = supportSession({ pairingId: otherP.id });
      repo.addSession(s);
      const auth = teacherAuth(schoolId);

      await expect(
        service.reviewSession(auth, schoolId, p.id, s.id, TeacherReviewStatus.REVIEWED),
      ).rejects.toThrow(SupportSessionNotFoundException);
    });

    it("throws not found when pairing does not exist", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      await expect(
        service.reviewSession(auth, schoolId, "missing-pairing", "session-1", TeacherReviewStatus.REVIEWED),
      ).rejects.toThrow(SupportPairingNotFoundException);
    });

    it("throws not found when session does not exist", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE });
      repo.addPairing(p);
      const auth = teacherAuth(schoolId);

      await expect(
        service.reviewSession(auth, schoolId, p.id, "missing-session", TeacherReviewStatus.REVIEWED),
      ).rejects.toThrow(SupportSessionNotFoundException);
    });

    it("allows SCHOOL_ADMIN to review a session", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE });
      repo.addPairing(p);
      const s = supportSession({ pairingId: p.id });
      repo.addSession(s);
      const auth = schoolAdminAuth(schoolId);

      const result = await service.reviewSession(auth, schoolId, p.id, s.id, TeacherReviewStatus.REVIEWED);

      expect(result.teacherReviewStatus).toBe("REVIEWED");
    });
  });

  // ------------------------------------------------------------------ //
  // getPairing
  // ------------------------------------------------------------------ //
  describe("getPairing", () => {
    it("allows teacher to view a pairing", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId });
      repo.addPairing(p);
      const auth = teacherAuth(schoolId);

      const result = await service.getPairing(auth, schoolId, p.id);

      expect(result.id).toBe(p.id);
      expect(result.schoolId).toBe(p.schoolId);
    });

    it("returns volunteer-limited view for the paired volunteer", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, volunteerUserId: "volunteer-1" });
      repo.addPairing(p);
      const auth = volunteerAuth(schoolId, { userId: "volunteer-1" });

      const result = await service.getPairing(auth, schoolId, p.id);

      expect(result.id).toBe(p.id);
      // VolunteerPairingResponse has no schoolId field
      expect("schoolId" in result).toBe(false);
    });

    it("throws not found for missing pairing", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      await expect(
        service.getPairing(auth, schoolId, "missing-id"),
      ).rejects.toThrow(SupportPairingNotFoundException);
    });

    it("denies unrelated student from viewing a pairing", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, volunteerUserId: "volunteer-1" });
      repo.addPairing(p);
      const auth = studentAuth(schoolId, { userId: "unrelated-student" });

      await expect(
        service.getPairing(auth, schoolId, p.id),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });
  });

  // ------------------------------------------------------------------ //
  // listPairings
  // ------------------------------------------------------------------ //
  describe("listPairings", () => {
    it("allows teacher to list pairings", async () => {
      const { service, repo } = createService();
      repo.addPairing(supportPairing({ schoolId }));
      const auth = teacherAuth(schoolId);

      const result = await service.listPairings(auth, schoolId, { limit: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("denies student from listing pairings", async () => {
      const { service } = createService();
      const auth = studentAuth(schoolId);

      await expect(
        service.listPairings(auth, schoolId, { limit: 20 }),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });
  });

  // ------------------------------------------------------------------ //
  // listSessions
  // ------------------------------------------------------------------ //
  describe("listSessions", () => {
    it("allows teacher to list sessions for a pairing", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE });
      repo.addPairing(p);
      repo.addSession(supportSession({ pairingId: p.id }));
      const auth = teacherAuth(schoolId);

      const result = await service.listSessions(auth, schoolId, p.id);

      expect(result).toHaveLength(1);
    });

    it("returns volunteer-limited session view for the paired volunteer", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE, volunteerUserId: "volunteer-1" });
      repo.addPairing(p);
      repo.addSession(supportSession({ pairingId: p.id }));
      const auth = volunteerAuth(schoolId, { userId: "volunteer-1" });

      const result = await service.listSessions(auth, schoolId, p.id);

      expect(result).toHaveLength(1);
      // VolunteerSessionResponse does not have summary
      expect("summary" in result[0]).toBe(false);
    });

    it("denies unrelated student from listing sessions", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId, status: PairingStatus.ACTIVE, volunteerUserId: "volunteer-1" });
      repo.addPairing(p);
      const auth = studentAuth(schoolId, { userId: "unrelated-student" });

      await expect(
        service.listSessions(auth, schoolId, p.id),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });
  });

  // ------------------------------------------------------------------ //
  // listMyPairings
  // ------------------------------------------------------------------ //
  describe("listMyPairings", () => {
    it("returns pairings for the logged-in volunteer", async () => {
      const { service, repo } = createService();
      repo.addPairing(supportPairing({ schoolId, volunteerUserId: "volunteer-1" }));
      repo.addPairing(supportPairing({ schoolId, volunteerUserId: "other-volunteer" }));
      const auth = volunteerAuth(schoolId, { userId: "volunteer-1" });

      const result = await service.listMyPairings(auth, schoolId);

      expect(result).toHaveLength(1);
    });

    it("denies cross-tenant access", async () => {
      const { service } = createService();
      const auth = volunteerAuth(schoolId, { userId: "volunteer-1" });

      await expect(
        service.listMyPairings(auth, "other-school"),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });
  });

  // ------------------------------------------------------------------ //
  // Cross-tenant access denial
  // ------------------------------------------------------------------ //
  describe("cross-tenant access", () => {
    it("denies SCHOOL_ADMIN from accessing a different school", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth("school-1");

      await expect(
        service.createPairing(auth, "school-2", {
          studentUserId: "student-1",
          volunteerUserId: "volunteer-1",
          supervisorTeacherId: "teacher-1",
          goal: "学业辅导",
        }),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });

    it("denies teacher from listing pairings of a different school", async () => {
      const { service } = createService();
      const auth = teacherAuth("school-1");

      await expect(
        service.listPairings(auth, "school-2", { limit: 20 }),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });

    it("denies volunteer from viewing pairing of a different school", async () => {
      const { service, repo } = createService();
      const p = supportPairing({ schoolId: "school-2", volunteerUserId: "volunteer-1" });
      repo.addPairing(p);
      const auth = volunteerAuth("school-1", { userId: "volunteer-1" });

      await expect(
        service.getPairing(auth, "school-2", p.id),
      ).rejects.toThrow(SupportPairingForbiddenException);
    });
  });

  // ------------------------------------------------------------------ //
  // Fail-closes when repository is unavailable
  // ------------------------------------------------------------------ //
  describe("fail-closes when repository is unavailable", () => {
    it("throws unavailable for createPairing", async () => {
      const service = new SupportPairingsService(new UnavailableSupportPairingRepository());
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.createPairing(auth, schoolId, {
          studentUserId: "student-1",
          volunteerUserId: "volunteer-1",
          supervisorTeacherId: "teacher-1",
          goal: "学业辅导",
        }),
      ).rejects.toThrow(SupportPairingUnavailableException);
    });

    it("throws unavailable for findById", async () => {
      const service = new SupportPairingsService(new UnavailableSupportPairingRepository());
      const auth = teacherAuth(schoolId);

      await expect(
        service.getPairing(auth, schoolId, "any-id"),
      ).rejects.toThrow(SupportPairingUnavailableException);
    });

    it("throws unavailable for listPairings", async () => {
      const service = new SupportPairingsService(new UnavailableSupportPairingRepository());
      const auth = teacherAuth(schoolId);

      await expect(
        service.listPairings(auth, schoolId, { limit: 20 }),
      ).rejects.toThrow(SupportPairingUnavailableException);
    });
  });
});
