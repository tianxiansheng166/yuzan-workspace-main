-- 直接通过 SQL 创建 AssessmentItems（朗读题 + 书面题）
-- 用法: docker exec -i yuzan-four-port-postgres-55432 psql -U yuzan_dev -d yuzan_dev < create-items.sql

-- 1) 检查 session 状态
SELECT 'session' AS tag, id, status, type, title, "createdAt"
FROM "AssessmentSession"
WHERE id = 'c9b5b37b-728d-4631-a695-c56238a114d9';

-- 2) 检查现有 items
SELECT 'existing-items' AS tag, id, "itemType", status, "sortOrder"
FROM "AssessmentItem"
WHERE "sessionId" = 'c9b5b37b-728d-4631-a695-c56238a114d9'
ORDER BY "sortOrder";

-- 3) 如果没有 items，则插入 1 个朗读题 + 1 个书面题
INSERT INTO "AssessmentItem" ("id", "sessionId", "prompt", "itemType", "status", "sortOrder", "revision", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'c9b5b37b-728d-4631-a695-c56238a114d9',
  '{"text": "春天来了，万物复苏。小鸟在枝头歌唱，花儿在阳光下绽放，孩子们在草地上奔跑。让我们一起去感受春天的气息，享受大自然的美好。"}'::jsonb,
  'READING',
  'PENDING'::"AssessmentItemStatus",
  1,
  1,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "AssessmentItem"
  WHERE "sessionId" = 'c9b5b37b-728d-4631-a695-c56238a114d9' AND "sortOrder" = 1
);

INSERT INTO "AssessmentItem" ("id", "sessionId", "prompt", "itemType", "status", "sortOrder", "revision", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'c9b5b37b-728d-4631-a695-c56238a114d9',
  '{"text": "请用 100 字左右描述你最喜欢的季节，并说明原因。"}'::jsonb,
  'WRITTEN',
  'PENDING'::"AssessmentItemStatus",
  2,
  1,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "AssessmentItem"
  WHERE "sessionId" = 'c9b5b37b-728d-4631-a695-c56238a114d9' AND "sortOrder" = 2
);

-- 4) 列出最终 items
SELECT 'final-items' AS tag, id, "itemType", status, "sortOrder", prompt->>'text' AS prompt_text
FROM "AssessmentItem"
WHERE "sessionId" = 'c9b5b37b-728d-4631-a695-c56238a114d9'
ORDER BY "sortOrder";
