// 直接通过 Prisma 创建 AssessmentItems（朗读题 + 书面题）用于夜间测试
// 用法：node docs/night-run/create-items.mjs <sessionId>

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://yuzan_dev:1e389bf6a02f02c827dbb8e973b7d0a8ec5aeb0ce239ce5fe55607a9efb35eb7@127.0.0.1:55432/yuzan_dev?schema=public' } },
});

const sessionId = process.argv[2];
const schoolId = '11111111-1111-4111-8111-111111111111';

if (!sessionId) {
  console.error('用法: node create-items.mjs <sessionId>');
  process.exit(1);
}

async function main() {
  // 先查看 session
  const session = await prisma.assessmentSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error(`Session ${sessionId} 不存在`);
  console.log('[ok] session found:', session.id, 'status=', session.status, 'type=', session.type);

  // 检查现有 items
  const existing = await prisma.assessmentItem.findMany({ where: { sessionId } });
  console.log('[dbg] existing items:', existing.length);

  if (existing.length === 0) {
    // 创建 1 个朗读题 + 1 个书面题
    const items = await prisma.assessmentItem.createMany({
      data: [
        {
          sessionId,
          schoolId,
          prompt: { text: '春天来了，万物复苏。小鸟在枝头歌唱，花儿在阳光下绽放，孩子们在草地上奔跑。让我们一起去感受春天的气息，享受大自然的美好。' },
          itemType: 'READING',
          sortOrder: 1,
          status: 'PENDING',
        },
        {
          sessionId,
          schoolId,
          prompt: {
            text: '请用 100 字左右描述你最喜欢的季节，并说明原因。',
            options: [],
          },
          itemType: 'WRITTEN',
          sortOrder: 2,
          status: 'PENDING',
        },
      ],
    });
    console.log('[ok] created items:', items.count);
  }

  // 列出最终 items
  const finalItems = await prisma.assessmentItem.findMany({ where: { sessionId }, orderBy: { sortOrder: 'asc' } });
  for (const it of finalItems) {
    console.log(`  - id=${it.id} itemType=${it.itemType} status=${it.status} prompt=${JSON.stringify(it.prompt).slice(0, 80)}`);
  }

  console.log('\n=== ITEMS FOR BROWSER TEST ===');
  console.log(JSON.stringify(finalItems.map((i) => ({ id: i.id, itemType: i.itemType })), null, 2));
}

main().catch((err) => { console.error('[fatal]', err); process.exit(1); }).finally(() => prisma.$disconnect());
