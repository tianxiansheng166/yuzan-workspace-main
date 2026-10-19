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
  findMembership(
    _schoolId: string,
    _userId: string,
  ): Promise<Membership | null> {
    void _schoolId;
    void _userId;
    return Promise.reject(new OrganizationUnavailableException());
  }

  listMembers(
    _schoolId: string,
    _options: ListMembersOptions,
  ): Promise<PaginatedResult<SchoolMember>> {
    void _schoolId;
    void _options;
    return Promise.reject(new OrganizationUnavailableException());
  }

  listMembershipsByUser(_userId: string): Promise<readonly Membership[]> {
    void _userId;
    return Promise.reject(new OrganizationUnavailableException());
  }
}
