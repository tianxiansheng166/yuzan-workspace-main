import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { PrismaClient } = requireApi("@yuzan/database");
const { PrismaPg } = requireApi("@prisma/adapter-pg");
const { Pool } = requireApi("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const prefix = (value) => typeof value === "string" ? value.slice(0, 8) : null;
try {
  const resource = await prisma.resource.findUnique({
    where: { objectKey: "t109-native-acceptance/flower.webm" },
    select: { id: true, schoolId: true, kind: true, originalName: true, mediaType: true, byteSize: true, checksumSha256: true, rightsStatus: true },
  });
  const links = resource ? await prisma.activityResource.findMany({
    where: { resourceId: resource.id },
    include: {
      activity: {
        include: {
          lesson: {
            include: {
              unit: {
                include: {
                  courseVersion: { include: { course: true } },
                },
              },
            },
          },
        },
      },
    },
  }) : [];
  const result = {
    taskId: "YZ-RD-T109",
    status: resource && links.length === 1 && links[0].activity.type === "VIDEO" ? "PASS" : "FAIL",
    resource: resource && {
      idPrefix: prefix(resource.id), schoolIdPrefix: prefix(resource.schoolId), kind: resource.kind,
      originalName: resource.originalName, mediaType: resource.mediaType, byteSize: Number(resource.byteSize),
      checksumSha256: resource.checksumSha256, rightsStatus: resource.rightsStatus,
    },
    activityLinks: links.map((link) => ({
      purpose: link.purpose,
      activityIdPrefix: prefix(link.activity.id),
      activityType: link.activity.type,
      activityTitle: link.activity.title,
      courseStableKey: link.activity.lesson.unit.courseVersion.course.stableKey,
      courseVersionStatus: link.activity.lesson.unit.courseVersion.status,
    })),
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
