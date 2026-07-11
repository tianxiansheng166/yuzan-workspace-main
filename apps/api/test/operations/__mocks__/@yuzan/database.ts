export class PrismaClient {
  school = { count: vi.fn() };
  $connect = vi.fn();
  $disconnect = vi.fn();
}
