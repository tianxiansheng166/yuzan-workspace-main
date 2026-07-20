/**
 * Shared fake PrismaService for unit tests.
 *
 * Why this exists:
 *   Several services (Classes, Assignments, Submissions, Learning, Reporting,
 *   Assessment) recently gained a direct `PrismaService` dependency for
 *   read-side joins and notification fan-out. In unit tests we do not want
 *   to spin up a real Postgres pool, so we inject a Proxy that returns
 *   sensible defaults for any `prisma.<model>.<method>(args)` call.
 *
 * Tests that need specific return values can override individual models via
 * `createFakePrismaService({ enrollment: { findMany: async () => [...] } })`.
 *
 * Note: This is *not* a fake of the Prisma client itself — it only stands in
 * for the PrismaService injection token inside the Nest testing module.
 *
 * Why we need createFakeDatabaseModule():
 *   NestJS DI is module-scoped. `.overrideProvider(PrismaService)` at the
 *   TestingModule root does NOT propagate into imported feature modules
 *   (e.g. AssignmentsModule) because PrismaService is normally provided by
 *   the @Global DatabaseModule. To make the fake available everywhere without
 *   importing the real DatabaseModule (which requires a live Postgres pool),
 *   tests should import `createFakeDatabaseModule(fake)` alongside their
 *   feature module. This returns a fresh @Global @Module class that provides
 *   the fake PrismaService to every module in the test tree.
 */

import { Global, Module } from "@nestjs/common";
import { PrismaService } from "../../src/shared/database/prisma.service.js";

export interface FakePrismaModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [method: string]: (...args: any[]) => Promise<unknown> | unknown;
}

export interface FakePrismaServiceOverrides {
  [modelName: string]: FakePrismaModel;
}

/**
 * Default return values per Prisma method name. Chosen to keep service code
 * happy without doing any I/O: lists return empty arrays, lookups return
 * null, counters return 0, writes return a `{ count: 0 }` shape.
 */
function defaultReturnFor(method: string): unknown {
  switch (method) {
    case "findMany":
    case "list":
      return [];
    case "findFirst":
    case "findUnique":
      return null;
    case "count":
      return 0;
    case "aggregate":
      return { _count: 0, _sum: null, _avg: null, _min: null, _max: null };
    case "create":
    case "createMany":
    case "update":
    case "updateMany":
    case "upsert":
    case "delete":
    case "deleteMany":
      return { count: 0 };
    default:
      return undefined;
  }
}

/**
 * Build a fake PrismaService value. Any `prisma.<model>.<method>(...)` call
 * resolves to the default for that method name unless explicitly overridden.
 */
export function createFakePrismaService(
  overrides: FakePrismaServiceOverrides = {},
): Record<string, FakePrismaModel> {
  const fakeModel = (modelOverrides?: FakePrismaModel): FakePrismaModel =>
    new Proxy(
      {},
      {
        get(_target, method: string) {
          if (modelOverrides && method in modelOverrides) {
            return modelOverrides[method];
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return async (..._args: any[]) => defaultReturnFor(method);
        },
      },
    ) as FakePrismaModel;

  const root: Record<string, FakePrismaModel> = {};
  for (const modelName of Object.keys(overrides)) {
    root[modelName] = fakeModel(overrides[modelName]);
  }

  // Proxy the root so any model access not explicitly listed returns a
  // default-valued model — services can introduce new prisma.<model> reads
  // without forcing every test to re-list them.
  return new Proxy(root, {
    get(target, prop: string) {
      if (prop in target) {
        return target[prop];
      }
      if (typeof prop === "string") {
        const model = fakeModel();
        target[prop] = model;
        return model;
      }
      return undefined;
    },
  }) as Record<string, FakePrismaModel>;
}

/**
 * Build a fresh @Global @Module class that provides the given fake PrismaService
 * value to every module in the test tree.
 *
 * Usage in tests:
 *   const moduleRef = await Test.createTestingModule({
 *     imports: [createFakeDatabaseModule(createFakePrismaService()), FeatureModule],
 *   })
 *     .overrideProvider(SOME_REPO)
 *     .useValue(fakeRepo)
 *     .compile();
 *
 * Each call returns a NEW class so NestJS does not cache module metadata
 * across tests. The fake value is captured in the closure.
 */
export function createFakeDatabaseModule(
  fake: Record<string, FakePrismaModel>,
): new () => unknown {
  @Global()
  @Module({
    providers: [{ provide: PrismaService, useValue: fake }],
    exports: [PrismaService],
  })
  class FakeDatabaseModule {}

  return FakeDatabaseModule as unknown as new () => unknown;
}
