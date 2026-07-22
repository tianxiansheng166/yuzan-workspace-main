import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import {
  MembershipRole,
  MembershipStatus,
} from "../../common/security/index.js";
import {
  OrganizationForbiddenException,
  OrganizationNotFoundException,
} from "./domain/organization.errors.js";
import type { Membership, School } from "./domain/organization.types.js";
import {
  toMemberResponse,
  toMembershipResponse,
} from "./dto/member.response.js";
import {
  toSchoolResponse,
  toSchoolSummaryResponse,
} from "./dto/school.response.js";
import type {
  ListMembersOptions,
  MembershipRepositoryPort,
} from "./ports/membership-repository.port.js";
import { MEMBERSHIP_REPOSITORY } from "./ports/membership-repository.port.js";
import type { SchoolRepositoryPort } from "./ports/school-repository.port.js";
import { SCHOOL_REPOSITORY } from "./ports/school-repository.port.js";
import { OrganizationsPolicy } from "./organizations.policy.js";

@Injectable()
export class OrganizationsService {
  private readonly policy = new OrganizationsPolicy();

  constructor(
    @Inject(SCHOOL_REPOSITORY)
    private readonly schoolRepo: SchoolRepositoryPort,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: MembershipRepositoryPort,
  ) {}

  async getSchool(auth: AuthContext, schoolId: string) {
    if (!this.policy.canReadSchool(auth, schoolId)) {
      throw new OrganizationForbiddenException();
    }

    const school = await this.schoolRepo.findById(schoolId);
    if (!school) {
      throw new OrganizationNotFoundException();
    }

    return toSchoolResponse(school);
  }

  async listSchools(auth: AuthContext) {
    if (!auth.principal.roles.includes(MembershipRole.PLATFORM_ADMIN)) {
      throw new OrganizationForbiddenException();
    }
    const schools = await this.schoolRepo.listActive();
    return schools.map(toSchoolSummaryResponse);
  }

  async listMembers(
    auth: AuthContext,
    schoolId: string,
    options: ListMembersOptions,
  ) {
    if (!this.policy.canListMembers(auth, schoolId)) {
      throw new OrganizationForbiddenException();
    }

    const result = await this.membershipRepo.listMembers(schoolId, options);
    return {
      items: result.items.map(toMemberResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getMyMembership(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId) {
      throw new OrganizationForbiddenException();
    }

    const membership = await this.membershipRepo.findMembership(
      schoolId,
      auth.principal.userId,
    );
    if (!membership) {
      throw new OrganizationNotFoundException();
    }

    const school = await this.schoolRepo.findById(schoolId);
    const schoolName = school?.name ?? "";

    return toMembershipResponse(schoolName, membership);
  }

  async requireActiveMembership(
    auth: AuthContext,
    schoolId: string,
    allowedRoles?: readonly MembershipRole[],
  ): Promise<Membership> {
    if (auth.tenant.schoolId !== schoolId) {
      throw new OrganizationForbiddenException();
    }

    const membership = await this.membershipRepo.findMembership(
      schoolId,
      auth.principal.userId,
    );
    if (!membership) {
      throw new OrganizationNotFoundException();
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new OrganizationForbiddenException("成员状态未激活");
    }

    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw new OrganizationForbiddenException();
    }

    return membership;
  }
}
