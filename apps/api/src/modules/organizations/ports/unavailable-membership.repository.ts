import { Injectable } from "@nestjs/common";
import type { Membership, SchoolMember } from "../domain/organization.types.js";
import { OrganizationUnavailableException } from "../domain/organization.errors.js";
import type {
  ListMembersOptions,
  MembershipRepositoryPort,
  PaginatedResult,
} from "./membership-repository.port.js";

@Injectable()
export class UnavailableMembershipRepository implements MembershipRepositoryPort {
  async findMembership(
    _schoolId: string,
    _userId: string,
  ): Promise<Membership | null> {
    throw new OrganizationUnavailableException();
  }

  async listMembers(
    _schoolId: string,
    _options: ListMembersOptions,
  ): Promise<PaginatedResult<SchoolMember>> {
    throw new OrganizationUnavailableException();
  }

  async listMembershipsByUser(_userId: string): Promise<readonly Membership[]> {
    throw new OrganizationUnavailableException();
  }
}
