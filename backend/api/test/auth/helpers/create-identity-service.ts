import { IdentityService } from "../../../src/modules/identity/identity.service.js";
import {
  CLOCK,
  MEMBERSHIP_REPOSITORY,
  PASSWORD_VERIFIER,
  SESSION_REPOSITORY,
  SESSION_TOKEN_SERVICE,
  USER_IDENTITY_REPOSITORY,
} from "../../../src/modules/identity/ports/index.js";
import {
  FakeClock,
  FakeMembershipRepository,
  FakePasswordVerifier,
  FakeSessionRepository,
  FakeSessionTokenService,
  FakeUserIdentityRepository,
} from "./fake-adapters.js";

export interface IdentityServiceFixture {
  service: IdentityService;
  users: FakeUserIdentityRepository;
  memberships: FakeMembershipRepository;
  sessions: FakeSessionRepository;
  passwords: FakePasswordVerifier;
  tokens: FakeSessionTokenService;
  clock: FakeClock;
}

export function createIdentityServiceFixture(
  initialClock?: Date,
): IdentityServiceFixture {
  const users = new FakeUserIdentityRepository();
  const memberships = new FakeMembershipRepository();
  const sessions = new FakeSessionRepository();
  const passwords = new FakePasswordVerifier();
  const tokens = new FakeSessionTokenService();
  const clock = new FakeClock(initialClock ?? new Date());

  const service = new IdentityService(
    users,
    memberships,
    sessions,
    passwords,
    tokens,
    clock,
  );

  return { service, users, memberships, sessions, passwords, tokens, clock };
}

export function withProviders() {
  const fixture = createIdentityServiceFixture();
  return {
    module: {
      providers: [
        IdentityService,
        { provide: USER_IDENTITY_REPOSITORY, useValue: fixture.users },
        { provide: MEMBERSHIP_REPOSITORY, useValue: fixture.memberships },
        { provide: SESSION_REPOSITORY, useValue: fixture.sessions },
        { provide: PASSWORD_VERIFIER, useValue: fixture.passwords },
        { provide: SESSION_TOKEN_SERVICE, useValue: fixture.tokens },
        { provide: CLOCK, useValue: fixture.clock },
      ],
    },
    fixture,
  };
}
