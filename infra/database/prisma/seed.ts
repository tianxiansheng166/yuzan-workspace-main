import { promisify } from "node:util";
import { scrypt as scryptCallback } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../dist/generated/client/client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for seed");

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const scrypt = promisify(scryptCallback);

const ids = {
  school: "11111111-1111-4111-8111-111111111111",
  student: "22222222-2222-4222-8222-222222222222",
  teacher: "33333333-3333-4333-8333-333333333333",
  volunteer: "44444444-4444-4444-8444-444444444444",
  admin: "55555555-5555-4555-8555-555555555555",
  researcher: "66666666-6666-4666-8666-666666666666",
  training: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  moduleSafety: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  moduleBoundary: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  enrollment: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  volunteerProfile: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  term: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  class: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  studentEnrollment: "f1111111-1111-4111-8111-111111111111",
  teacherEnrollment: "f2222222-2222-4222-8222-222222222222",
  course: "f3333333-3333-4333-8333-333333333333",
  courseVersion: "f4444444-4444-4444-8444-444444444444",
  unit: "f5555555-5555-4555-8555-555555555555",
  lesson: "f6666666-6666-4666-8666-666666666666",
  activity: "f7777777-7777-4777-8777-777777777777",
  assignment: "f8888888-8888-4888-8888-888888888888",
  assignmentTarget: "f9999999-9999-4999-8999-999999999999",
  activityProgress: "fa111111-1111-4111-8111-111111111111",
  submission: "fa222222-2222-4222-8222-222222222222",
  report: "fa333333-3333-4333-8333-333333333333",
  practiceClassical: "70000000-0000-4000-8000-000000000001",
  practiceModern: "70000000-0000-4000-8000-000000000002",
  practiceRhythm: "70000000-0000-4000-8000-000000000003",
  practiceInitials: "70000000-0000-4000-8000-000000000004",
  practiceTones: "70000000-0000-4000-8000-000000000005",
  practiceRetell: "70000000-0000-4000-8000-000000000006",
  versionClassical: "71000000-0000-4000-8000-000000000001",
  versionModern: "71000000-0000-4000-8000-000000000002",
  versionRhythm: "71000000-0000-4000-8000-000000000003",
  versionInitials: "71000000-0000-4000-8000-000000000004",
  versionTones: "71000000-0000-4000-8000-000000000005",
  versionRetell: "71000000-0000-4000-8000-000000000006",
  deliveryClassical: "72000000-0000-4000-8000-000000000001",
  deliveryModern: "72000000-0000-4000-8000-000000000002",
  deliveryRhythm: "72000000-0000-4000-8000-000000000003",
  deliveryInitials: "72000000-0000-4000-8000-000000000004",
  deliveryTones: "72000000-0000-4000-8000-000000000005",
  deliveryRetell: "72000000-0000-4000-8000-000000000006",
} as const;

async function passwordHash(password: string) {
  const salt = Buffer.from("yuzan-test-seed-2026", "utf8");
  const derived = (await scrypt(password, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  return `$scrypt$16384$8$1$${salt.toString("base64")}$${derived.toString("base64")}`;
}

type SeedPractice = {
  id: string; versionId: string; deliveryId: string; title: string; summary: string;
  difficulty: string; estimatedMinutes: number; mode: "ASSIGNMENT" | "SELF_PRACTICE";
  gradeBand: string; abilityCategories: string[]; cultureTags: string[]; catalogType: "SPECIALIZED" | "COMPREHENSIVE" | "MOCK";
  requiresRecording: boolean; instantFeedback: boolean; coverAsset: string;
  sections: Array<{ title: string; description: string; minutes: number; items: Array<{ type: string; config: Record<string, unknown> }> }>;
};

async function seedReusablePractices() {
  const environment = process.env.NODE_ENV ?? "development";
  if (environment !== "development" && environment !== "test") {
    throw new Error("Reusable practice bootstrap is restricted to development/test");
  }

  const practices: SeedPractice[] = [
    {
      id: ids.practiceClassical, versionId: ids.versionClassical, deliveryId: ids.deliveryClassical,
      title: "古诗文朗读与理解训练", summary: "在听读、跟读和理解表达中感受古诗文的节奏与意境。", difficulty: "进阶", estimatedMinutes: 22, mode: "ASSIGNMENT", gradeBand: "七年级", abilityCategories: ["古诗文", "跟读模仿", "独立朗读", "阅读理解", "书面表达"], cultureTags: ["古诗文", "传统文化"], catalogType: "COMPREHENSIVE", requiresRecording: true, instantFeedback: false, coverAsset: "/assessment/assets/practice-catalog/spring-highland.png",
      sections: [
        { title: "听读感知", description: "先听范读，留意停顿和语气。", minutes: 4, items: [{ type: "LISTEN_ONLY", config: { instruction: "聆听《木兰诗》节选范读，记录两个停顿位置。", stimulus: "唧唧复唧唧，木兰当户织。", demoAudioUrl: "/student/growth/assets/practice-sample.wav" } }] },
        { title: "跟读练习", description: "跟随范读完成一句一句的练习。", minutes: 5, items: [{ type: "LISTEN_REPEAT", config: { instruction: "听完示范后，跟读下面的句子。", targetText: "万里赴戎机，关山度若飞。", demoAudioUrl: "/student/growth/assets/practice-sample.wav", maxScore: 20 } }] },
        { title: "独立朗读", description: "用清晰的语速朗读选段。", minutes: 5, items: [{ type: "READ_ALOUD", config: { instruction: "请独立朗读下面的句子，注意节奏。", targetText: "朔气传金柝，寒光照铁衣。", maxScore: 20 } }] },
        { title: "文意选择", description: "根据材料完成理解判断。", minutes: 4, items: [{ type: "SINGLE_CHOICE", config: { prompt: "“关山度若飞”主要表现了什么？", options: ["行军路途遥远而迅疾", "关山飞翔", "军营生活安逸", "木兰正在织布"], required: true, maxScore: 20 } }] },
        { title: "意境表达", description: "用自己的话说明诗句传递的感受。", minutes: 4, items: [{ type: "SHORT_ANSWER", config: { prompt: "用两三句话说说这段诗给你的画面感。", required: true, maxScore: 20 } }] },
      ],
    },
    {
      id: ids.practiceModern, versionId: ids.versionModern, deliveryId: ids.deliveryModern,
      title: "现代文朗读与信息提取", summary: "在真实短文中练习倾听、朗读和抓取关键信息。", difficulty: "基础", estimatedMinutes: 15, mode: "SELF_PRACTICE", gradeBand: "七年级", abilityCategories: ["听辨训练", "独立朗读", "阅读理解", "书面表达"], cultureTags: ["现代文", "自然观察"], catalogType: "COMPREHENSIVE", requiresRecording: true, instantFeedback: true, coverAsset: "/assessment/assets/practice-catalog/morning-valley.png",
      sections: [
        { title: "听材料", description: "先整体理解材料内容。", minutes: 3, items: [{ type: "LISTEN_ONLY", config: { instruction: "聆听关于高原春天的短文。", stimulus: "冰雪消融后，山坡上的草芽最先醒来。", demoAudioUrl: "/student/growth/assets/practice-sample.wav" } }] },
        { title: "朗读短文", description: "读出叙述的节奏。", minutes: 4, items: [{ type: "READ_ALOUD", config: { instruction: "请朗读材料句子。", targetText: "清晨的风穿过山谷，带来泥土和松针的清香。", maxScore: 25 } }] },
        { title: "信息提取", description: "选择材料中的明确信息。", minutes: 4, items: [{ type: "MULTIPLE_CHOICE", config: { prompt: "材料中提到了哪些景物？", options: ["山谷", "松针", "海浪", "泥土"], required: true, maxScore: 25 } }] },
        { title: "简要回答", description: "准确而完整地表达。", minutes: 4, items: [{ type: "SHORT_ANSWER", config: { prompt: "作者从哪些感觉写出了清晨的特点？", required: true, maxScore: 25 } }] },
      ],
    },
    {
      id: ids.practiceRhythm, versionId: ids.versionRhythm, deliveryId: ids.deliveryRhythm,
      title: "停顿与节奏专项训练", summary: "通过听辨、跟读、朗读和回听，找到更自然的表达节奏。", difficulty: "基础", estimatedMinutes: 10, mode: "SELF_PRACTICE", gradeBand: "七年级", abilityCategories: ["听辨训练", "跟读模仿", "独立朗读"], cultureTags: ["古诗文", "朗读节奏"], catalogType: "SPECIALIZED", requiresRecording: true, instantFeedback: true, coverAsset: "/assessment/assets/practice-catalog/barley-year.png",
      sections: [
        { title: "听辨停顿", description: "辨认更自然的朗读停顿。", minutes: 2, items: [{ type: "SINGLE_CHOICE", config: { prompt: "哪一种停顿更自然？", options: ["春风 / 又绿江南岸", "春 / 风又绿江南岸"], required: true, maxScore: 25 } }] },
        { title: "跟读节奏", description: "模仿示范的轻重与停连。", minutes: 3, items: [{ type: "LISTEN_REPEAT", config: { instruction: "听完示范后跟读。", targetText: "春风又绿江南岸，明月何时照我还。", demoAudioUrl: "/student/growth/assets/practice-sample.wav", maxScore: 25 } }] },
        { title: "自主朗读", description: "将节奏用于完整句子。", minutes: 3, items: [{ type: "READ_ALOUD", config: { instruction: "请独立朗读。", targetText: "海日生残夜，江春入旧年。", maxScore: 25 } }] },
        { title: "回听反思", description: "回听后写下一个可改进点。", minutes: 2, items: [{ type: "LISTEN_RETELL", config: { prompt: "回听自己的朗读后，写下一个准备调整的停顿或语速问题。", required: true, maxScore: 25 } }] },
      ],
    },
    {
      id: ids.practiceInitials, versionId: ids.versionInitials, deliveryId: ids.deliveryInitials,
      title: "声母发音专项训练", summary: "围绕双唇音、舌尖音和送气差异，建立清晰稳定的发音基础。", difficulty: "入门", estimatedMinutes: 12, mode: "SELF_PRACTICE", gradeBand: "七年级", abilityCategories: ["发音基础", "听辨训练", "跟读模仿"], cultureTags: ["普通话", "发音方法"], catalogType: "SPECIALIZED", requiresRecording: true, instantFeedback: true, coverAsset: "/assessment/assets/practice-catalog/morning-valley.png",
      sections: [
        { title: "口型观察", description: "先听辨，再观察送气和不送气的差别。", minutes: 3, items: [{ type: "LISTEN_ONLY", config: { instruction: "聆听 p 和 b 的发音示范。", stimulus: "八百标兵奔北坡。", demoAudioUrl: "/student/growth/assets/practice-sample.wav" } }] },
        { title: "声母听辨", description: "分辨相近声母。", minutes: 3, items: [{ type: "SINGLE_CHOICE", config: { prompt: "下面哪组读音的送气更明显？", options: ["p 与 b", "m 与 n", "l 与 r"], required: true, maxScore: 30 } }] },
        { title: "跟读练习", description: "用稳定气流完成跟读。", minutes: 3, items: [{ type: "LISTEN_REPEAT", config: { instruction: "听完示范后跟读。", targetText: "白白的蒲公英飘过平静的湖面。", demoAudioUrl: "/student/growth/assets/practice-sample.wav", maxScore: 35 } }] },
        { title: "独立发音", description: "把准确口型用于完整句子。", minutes: 3, items: [{ type: "READ_ALOUD", config: { instruction: "请独立朗读，注意双唇音。", targetText: "爸爸把盆里的白布平平地铺开。", maxScore: 35 } }] },
      ],
    },
    {
      id: ids.practiceTones, versionId: ids.versionTones, deliveryId: ids.deliveryTones,
      title: "声调听辨与跟读", summary: "在四声、轻声和词语节奏中训练准确听辨与自然跟读。", difficulty: "基础", estimatedMinutes: 14, mode: "SELF_PRACTICE", gradeBand: "七年级", abilityCategories: ["听辨训练", "跟读模仿", "发音基础"], cultureTags: ["普通话", "声调"], catalogType: "SPECIALIZED", requiresRecording: true, instantFeedback: true, coverAsset: "/assessment/assets/practice-catalog/barley-year.png",
      sections: [
        { title: "四声听辨", description: "先辨认词语中的声调变化。", minutes: 3, items: [{ type: "SINGLE_CHOICE", config: { prompt: "“妈妈骑马”中第二个“马”应读第几声？", options: ["第一声", "第二声", "第三声", "第四声"], required: true, maxScore: 25 } }] },
        { title: "轻声聆听", description: "感受轻声的短促与自然。", minutes: 3, items: [{ type: "LISTEN_ONLY", config: { instruction: "聆听带轻声的词语。", stimulus: "桌子、孩子、月亮。", demoAudioUrl: "/student/growth/assets/practice-sample.wav" } }] },
        { title: "声调跟读", description: "跟随示范保持音高走向。", minutes: 4, items: [{ type: "LISTEN_REPEAT", config: { instruction: "听完示范后跟读。", targetText: "妈妈骑马，马慢，妈妈骂马。", demoAudioUrl: "/student/growth/assets/practice-sample.wav", maxScore: 35 } }] },
        { title: "词语朗读", description: "在完整句中保持自然节奏。", minutes: 4, items: [{ type: "READ_ALOUD", config: { instruction: "请独立朗读。", targetText: "清晨的鸟儿唱着明亮的歌。", maxScore: 40 } }] },
      ],
    },
    {
      id: ids.practiceRetell, versionId: ids.versionRetell, deliveryId: ids.deliveryRetell,
      title: "听后复述入门", summary: "用关键词梳理材料，再以完整句子完成简短复述。", difficulty: "入门", estimatedMinutes: 16, mode: "SELF_PRACTICE", gradeBand: "七年级", abilityCategories: ["听后复述", "口语交际", "书面表达"], cultureTags: ["现代文", "自然观察"], catalogType: "COMPREHENSIVE", requiresRecording: true, instantFeedback: false, coverAsset: "/assessment/assets/practice-catalog/spring-highland.png",
      sections: [
        { title: "整体听读", description: "先完整理解材料。", minutes: 4, items: [{ type: "LISTEN_ONLY", config: { instruction: "聆听山谷护林员的故事。", stimulus: "清晨，护林员沿着山谷巡查，在溪边发现了新长出的云杉幼苗。", demoAudioUrl: "/student/growth/assets/practice-sample.wav" } }] },
        { title: "信息提取", description: "抓住人物、地点和事件。", minutes: 4, items: [{ type: "MULTIPLE_CHOICE", config: { prompt: "材料中护林员在哪里发现了幼苗？", options: ["溪边", "教室", "车站", "操场"], required: true, maxScore: 25 } }] },
        { title: "口头复述", description: "依据关键词完成复述。", minutes: 5, items: [{ type: "READ_ALOUD", config: { instruction: "请用自己的话复述材料要点。", targetText: "清晨，护林员在山谷溪边发现了新长出的云杉幼苗。", maxScore: 45 } }] },
        { title: "复述反思", description: "用一句话记录下次要改进的表达。", minutes: 3, items: [{ type: "SHORT_ANSWER", config: { prompt: "写下你下次复述时准备做到的一点。", required: true, maxScore: 30 } }] },
      ],
    },
  ];

  for (const practice of practices) {
    await prisma.practiceDefinition.upsert({
      where: { id: practice.id },
      // Bootstrap never edits an already-published version or its item/rubric
      // content. Catalog metadata belongs to the definition and may be safely
      // completed for development/test discovery after a schema upgrade.
      update: { gradeBand: practice.gradeBand, abilityCategories: practice.abilityCategories, cultureTags: practice.cultureTags, catalogType: practice.catalogType, requiresRecording: practice.requiresRecording, instantFeedback: practice.instantFeedback, coverAsset: practice.coverAsset },
      create: { id: practice.id, schoolId: ids.school, visibility: "SCHOOL", title: practice.title, summary: practice.summary, coverAsset: practice.coverAsset, difficulty: practice.difficulty, estimatedMinutes: practice.estimatedMinutes, gradeBand: practice.gradeBand, abilityCategories: practice.abilityCategories, cultureTags: practice.cultureTags, catalogType: practice.catalogType, requiresRecording: practice.requiresRecording, instantFeedback: practice.instantFeedback, status: "PUBLISHED" },
    });
    const existingVersion = await prisma.practiceVersion.findUnique({ where: { id: practice.versionId }, select: { id: true } });
    if (!existingVersion) {
      await prisma.practiceVersion.create({ data: { id: practice.versionId, definitionId: practice.id, version: 1, status: "PUBLISHED", contentHash: `seed-${practice.id}-v1`, publishedAt: new Date("2026-07-21T00:00:00.000Z") } });
      for (const [sectionIndex, section] of practice.sections.entries()) {
        const created = await prisma.practiceSection.create({ data: { versionId: practice.versionId, title: section.title, description: section.description, sortOrder: sectionIndex + 1, estimatedMinutes: section.minutes } });
        await prisma.practiceItemRef.createMany({ data: section.items.map((item, itemIndex) => ({ sectionId: created.id, questionId: `73000000-0000-4000-8000-${String(sectionIndex * 10 + itemIndex + 1).padStart(12, "0")}`, itemType: item.type, sortOrder: itemIndex + 1, config: item.config })) });
      }
    }
    await prisma.practiceDelivery.upsert({
      where: { id: practice.deliveryId },
      update: { status: "OPEN", mode: practice.mode, practiceVersionId: practice.versionId, classId: ids.class, studentId: null },
      create: { id: practice.deliveryId, practiceVersionId: practice.versionId, schoolId: ids.school, classId: ids.class, mode: practice.mode, reRecordPolicy: { maxAttempts: 2, allowAfterUpload: true }, mobilePolicy: { allowed: true, minNetwork: "3g" }, status: "OPEN" },
    });
  }
}

type SeedCourse = {
  ordinal: number;
  title: string;
  description: string;
  capabilityTheme: string;
  difficulty: string;
  estimatedMinutes: number;
  coverAsset: string;
  source: "TEACHER_ASSIGNED" | "RECOMMENDED" | "SELF_STUDY";
  practiceDefinitionId: string;
  activities: Array<{
    type: "TEXT" | "VIDEO" | "AUDIO" | "CHOICE" | "FILL_BLANK" | "SPEECH";
    title: string;
    instruction: string;
    content: Record<string, unknown>;
    studentNotes: string[];
    practice?: boolean;
  }>;
};

async function seedStudentCourses() {
  const environment = process.env.NODE_ENV ?? "development";
  if (environment !== "development" && environment !== "test") {
    throw new Error("Student course bootstrap is restricted to development/test");
  }

  const courses: SeedCourse[] = [
    {
      ordinal: 1,
      title: "声母发音与口型基础",
      description: "从发音部位、送气差异和口型观察开始，建立清晰稳定的普通话声母基础。",
      capabilityTheme: "发音基础",
      difficulty: "入门",
      estimatedMinutes: 24,
      coverAsset: "/assets/student-course-1.jpg",
      source: "TEACHER_ASSIGNED",
      practiceDefinitionId: ids.practiceRhythm,
      activities: [
        { type: "TEXT", title: "认识发音部位", instruction: "阅读说明并观察发音位置。", content: { paragraphs: ["双唇音发音时，两片嘴唇先形成阻碍，再让气流有控制地冲出。", "练习时关注下颌放松，不要用力抿嘴。"] }, studentNotes: ["先找准阻碍位置，再练习送气。", "镜面观察比用力模仿更有效。"] },
        { type: "AUDIO", title: "听辨送气差异", instruction: "完整听一遍示范，留意气流强弱。", content: { audioUrl: "/student/growth/assets/practice-sample.wav", transcript: "玻璃杯旁边放着一盆薄荷。" }, studentNotes: ["p、t、k 的气流更明显。"] },
        { type: "SPEECH", title: "独立朗读声母句", instruction: "请清晰朗读目标句，录音完成后上传。", content: { targetText: "白白的蒲公英飘过平静的湖面。" }, studentNotes: ["保持音节完整，不要为了速度吞音。"] },
        { type: "CHOICE", title: "声母听辨选择", instruction: "选择送气更明显的声母组。", content: { prompt: "下面哪组读音的送气更明显？", options: ["p 与 b", "m 与 n", "l 与 r"] }, studentNotes: ["送气音气流强，不送气音气流弱。"] },
        { type: "FILL_BLANK", title: "填写声母发音要点", instruction: "在空格中填写声母的发音部位。", content: { prompt: "双唇音b、p的阻碍位置在____，舌尖音d、t的阻碍位置在____。", placeholder: "填写发音部位" }, studentNotes: ["先找准阻碍位置，再练习送气。"] }
      ]
    },
    {
      ordinal: 2,
      title: "韵母、声调与普通话节奏",
      description: "在韵母口型和四声变化中建立自然节奏，避免逐字顿读。",
      capabilityTheme: "发音基础",
      difficulty: "基础",
      estimatedMinutes: 28,
      coverAsset: "/assets/student-course-2.jpg",
      source: "RECOMMENDED",
      practiceDefinitionId: ids.practiceRhythm,
      activities: [
        { type: "TEXT", title: "韵母口型变化", instruction: "阅读并跟随提示完成无声口型练习。", content: { paragraphs: ["复韵母不是两个单韵母的简单拼接，口型需要连续滑动。", "声音要连贯，主元音保持清楚。"] }, studentNotes: ["口型移动要连续。"] },
        { type: "AUDIO", title: "听四声与轻声", instruction: "播放示范并标记你听到的声调变化。", content: { audioUrl: "/student/growth/assets/practice-sample.wav", transcript: "妈妈骑马，马慢，妈妈骂马。" }, studentNotes: ["轻声短而轻，但前一音节仍要完整。"] },
        { type: "FILL_BLANK", title: "节奏停连标注", instruction: "在空格中填写适合停顿的位置。", content: { prompt: "清晨的风____穿过山谷____带来松针的清香。", placeholder: "填写停顿符号 /" }, studentNotes: ["按语义群停顿，而不是每个词都停。"] },
        { type: "CHOICE", title: "声调与节奏课程练习", instruction: "进入统一练习执行器完成专项训练。", content: { practiceLabel: "停顿与节奏专项训练" }, studentNotes: ["完成练习后会回到课程原位置。"], practice: true }
      ]
    },
    {
      ordinal: 3,
      title: "古诗文朗读：停顿与情感",
      description: "依据句意安排停顿，用语气、轻重和速度呈现古诗文的画面与情感。",
      capabilityTheme: "古诗文",
      difficulty: "进阶",
      estimatedMinutes: 32,
      coverAsset: "/assets/student-course-3.jpg",
      source: "TEACHER_ASSIGNED",
      practiceDefinitionId: ids.practiceClassical,
      activities: [
        { type: "TEXT", title: "从句意寻找停顿", instruction: "阅读诗句和停顿说明。", content: { paragraphs: ["朗读古诗文时，停顿首先服从句意和语法关系。", "标点是线索，但不是唯一依据。"] }, studentNotes: ["先理解谁在做什么，再安排停顿。"] },
        { type: "AUDIO", title: "聆听节奏示范", instruction: "先完整听，再对照文本回听一次。", content: { audioUrl: "/student/growth/assets/practice-sample.wav", transcript: "万里赴戎机，关山度若飞。" }, studentNotes: ["长句中的小停顿不能切断词义。"] },
        { type: "SPEECH", title: "朗读并表达情感", instruction: "朗读目标诗句，注意速度和语气变化。", content: { targetText: "朔气传金柝，寒光照铁衣。" }, studentNotes: ["画面庄重，语速可以稳一些。"] },
        { type: "CHOICE", title: "古诗文综合课程练习", instruction: "进入通用练习执行器完成古诗文听读、跟读与表达。", content: { practiceLabel: "古诗文朗读与理解训练" }, studentNotes: ["练习结果与课程完成度分别保存。"], practice: true }
      ]
    },
    {
      ordinal: 4,
      title: "现代文听说：信息提取与复述",
      description: "从真实短文中抓取人物、事件和因果信息，并用自己的语言完成有条理的复述。",
      capabilityTheme: "听说理解",
      difficulty: "进阶",
      estimatedMinutes: 30,
      coverAsset: "/assets/student-course-4.jpg",
      source: "SELF_STUDY",
      practiceDefinitionId: ids.practiceModern,
      activities: [
        { type: "AUDIO", title: "带着问题听材料", instruction: "播放材料，记录时间、地点和主要事件。", content: { audioUrl: "/student/growth/assets/practice-sample.wav", transcript: "清晨，护林员沿着山谷巡查，在溪边发现了新长出的云杉幼苗。" }, studentNotes: ["第一次听整体，第二次听细节。"] },
        { type: "CHOICE", title: "提取关键信息", instruction: "选择材料中出现的地点。", content: { prompt: "护林员在哪里发现幼苗？", options: ["溪边", "教室", "车站", "操场"] }, studentNotes: ["答案应直接来自材料。"] },
        { type: "FILL_BLANK", title: "整理复述提纲", instruction: "补全复述提纲。", content: { prompt: "时间：清晨；人物：____；地点：溪边；事件：发现云杉幼苗。", placeholder: "填写人物" }, studentNotes: ["提纲只保留关键词。"] },
        { type: "SPEECH", title: "完成口头复述", instruction: "根据提纲用完整句子复述材料。", content: { targetText: "清晨，护林员巡查山谷时，在溪边发现了新长出的云杉幼苗。" }, studentNotes: ["使用先、接着、最后等连接词。"] },
        { type: "CHOICE", title: "现代文听说课程练习", instruction: "进入通用练习执行器完成信息提取和简答。", content: { practiceLabel: "现代文朗读与信息提取" }, studentNotes: ["提交练习后返回本活动。"], practice: true }
      ]
    }
  ];

  for (const course of courses) {
    const suffix = String(course.ordinal).padStart(12, "0");
    const courseId = `80000000-0000-4000-8000-${suffix}`;
    const versionId = `81000000-0000-4000-8000-${suffix}`;
    const unitId = `82000000-0000-4000-8000-${suffix}`;
    const lessonId = `83000000-0000-4000-8000-${suffix}`;
    const assignmentId = `85000000-0000-4000-8000-${suffix}`;
    const targetId = `86000000-0000-4000-8000-${suffix}`;

    await prisma.course.upsert({
      where: { id: courseId },
      update: {},
      create: { id: courseId, schoolId: ids.school, authorUserId: ids.teacher, stableKey: `p0-course-${course.ordinal}`, title: course.title }
    });
    await prisma.courseVersion.upsert({
      where: { id: versionId },
      update: {},
      create: {
        id: versionId, schoolId: ids.school, courseId, version: 1, status: "PUBLISHED",
        title: course.title, description: course.description, gradeBand: "七年级",
        objectives: ["理解课程关键概念", "完成必修活动与课程练习", "留下可复核的学习证据"],
        capabilityTheme: course.capabilityTheme, difficulty: course.difficulty,
        estimatedMinutes: course.estimatedMinutes, coverAsset: course.coverAsset,
        deviceRequirements: { audioPlayback: true, microphone: course.activities.some((activity) => activity.type === "SPEECH") },
        publishedAt: new Date("2026-07-21T00:00:00.000Z")
      }
    });
    await prisma.unit.upsert({ where: { id: unitId }, update: {}, create: { id: unitId, courseVersionId: versionId, title: "核心学习路径", sortOrder: 1 } });
    await prisma.lesson.upsert({ where: { id: lessonId }, update: {}, create: { id: lessonId, unitId, title: "观察、理解与表达", sortOrder: 1 } });

    for (const [index, activity] of course.activities.entries()) {
      const activitySuffix = String(course.ordinal * 100 + index + 1).padStart(12, "0");
      const activityId = `84000000-0000-4000-8000-${activitySuffix}`;
      await prisma.learningActivity.upsert({
        where: { id: activityId },
        update: {},
        create: {
          id: activityId, lessonId, type: activity.type, title: activity.title,
          instruction: { text: activity.instruction }, content: activity.content,
          sortOrder: index + 1, required: true,
          completionRule: activity.practice ? { type: "COURSE_PRACTICE_SUBMITTED" } : { type: activity.type === "SPEECH" ? "RECORDING_UPLOADED" : "ACKNOWLEDGED" },
          studentNotes: { title: "课程要点", items: activity.studentNotes, source: "TEACHER_AUTHORED", published: true }
        }
      });
      if (activity.practice) {
        await prisma.courseActivityPractice.upsert({
          where: { activityId }, update: {},
          create: { id: `87000000-0000-4000-8000-${suffix}`, schoolId: ids.school, activityId, practiceDefinitionId: course.practiceDefinitionId, required: true }
        });
      }
    }

    await prisma.assignment.upsert({
      where: { id: assignmentId },
      update: { status: "OPEN" },
      create: {
        id: assignmentId, schoolId: ids.school, courseVersionId: versionId, createdByUserId: ids.teacher,
        title: course.title, status: "OPEN", startsAt: new Date("2026-07-21T00:00:00.000Z"),
        dueAt: new Date("2027-07-21T23:59:59.000Z"), openedAt: new Date("2026-07-21T00:00:00.000Z"),
        source: course.source, completionRule: { requiredActivities: "ALL", requiredPractices: "ALL", attainmentIndependent: true }
      }
    });
    await prisma.assignmentTarget.upsert({
      where: { id: targetId }, update: {},
      create: { id: targetId, schoolId: ids.school, assignmentId, targetType: "CLASS", classId: ids.class }
    });
  }
}

async function main() {
  if (!["development", "test"].includes(process.env.NODE_ENV ?? "development")) {
    throw new Error("Seed is restricted to development/test");
  }
  const hash = await passwordHash("YuzanTest!2026");
  await prisma.school.upsert({
    where: { id: ids.school },
    update: { name: "语赞测试学校", isActive: true },
    create: {
      id: ids.school,
      code: "YZ-TEST-001",
      name: "语赞测试学校",
      regionCode: "TEST",
    },
  });

  const accounts = [
    [ids.student, "student.test", "测试学生", "STUDENT"],
    [ids.teacher, "teacher.test", "测试教师", "TEACHER"],
    [ids.volunteer, "volunteer.test", "测试志愿者", "VOLUNTEER"],
    [ids.admin, "admin.test", "测试管理员", "SCHOOL_ADMIN"],
    [ids.researcher, "researcher.test", "测试教研员", "RESEARCHER"],
  ] as const;

  for (const [id, loginIdentifier, displayName, role] of accounts) {
    await prisma.user.upsert({
      where: { id },
      update: {
        loginIdentifier,
        displayName,
        passwordHash: hash,
        status: "ACTIVE",
      },
      create: {
        id,
        loginIdentifier,
        displayName,
        passwordHash: hash,
        status: "ACTIVE",
      },
    });
    await prisma.membership.upsert({
      where: {
        schoolId_userId_role: { schoolId: ids.school, userId: id, role },
      },
      update: { status: "ACTIVE" },
      create: { schoolId: ids.school, userId: id, role, status: "ACTIVE" },
    });
  }

  await prisma.term.upsert({
    where: { id: ids.term },
    update: { isActive: true },
    create: {
      id: ids.term,
      schoolId: ids.school,
      name: "2026 测试学期",
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T23:59:59.000Z"),
      isActive: true,
    },
  });

  await prisma.class.upsert({
    where: { id: ids.class },
    update: { name: "七年级真实流程班", grade: "七年级" },
    create: {
      id: ids.class,
      schoolId: ids.school,
      termId: ids.term,
      name: "七年级真实流程班",
      grade: "七年级",
    },
  });

  for (const enrollment of [
    {
      id: ids.studentEnrollment,
      userId: ids.student,
      role: "STUDENT" as const,
    },
    {
      id: ids.teacherEnrollment,
      userId: ids.teacher,
      role: "TEACHER" as const,
    },
  ]) {
    await prisma.enrollment.upsert({
      where: { id: enrollment.id },
      update: { status: "ACTIVE" },
      create: {
        ...enrollment,
        schoolId: ids.school,
        classId: ids.class,
        status: "ACTIVE",
      },
    });
  }

  // Keep the reusable-practice bootstrap independent from unrelated demo
  // modules. This mode creates only active fictional identities, enrolments,
  // definitions, published versions, sections, item references and deliveries;
  // it never creates completed recordings, scores, or reports.
  if (process.env.P0_BOOTSTRAP_ONLY === "true") {
    await seedReusablePractices();
    console.log("Seeded six fictional reusable practices and active student deliveries.");
    return;
  }

  await prisma.course.upsert({
    where: { id: ids.course },
    update: { title: "真实学习流程课程" },
    create: {
      id: ids.course,
      schoolId: ids.school,
      authorUserId: ids.teacher,
      stableKey: "seed-real-learning-flow",
      title: "真实学习流程课程",
    },
  });

  await prisma.courseVersion.upsert({
    where: { id: ids.courseVersion },
    update: { status: "PUBLISHED", title: "真实学习流程课程" },
    create: {
      id: ids.courseVersion,
      schoolId: ids.school,
      courseId: ids.course,
      version: 1,
      status: "PUBLISHED",
      title: "真实学习流程课程",
      description: "用于四端真实点击旅程的虚构课程数据。",
      gradeBand: "七年级",
      publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
  });

  await prisma.unit.upsert({
    where: { id: ids.unit },
    update: { title: "第一单元" },
    create: {
      id: ids.unit,
      courseVersionId: ids.courseVersion,
      title: "第一单元",
      sortOrder: 1,
    },
  });

  await prisma.lesson.upsert({
    where: { id: ids.lesson },
    update: { title: "连续学习旅程" },
    create: {
      id: ids.lesson,
      unitId: ids.unit,
      title: "连续学习旅程",
      sortOrder: 1,
    },
  });

  await prisma.learningActivity.upsert({
    where: { id: ids.activity },
    update: { title: "完成一次真实学习进度" },
    create: {
      id: ids.activity,
      lessonId: ids.lesson,
      type: "TEXT",
      title: "完成一次真实学习进度",
      instruction: { originalText: "阅读说明后，将完成状态保存到服务器。" },
      sortOrder: 1,
      required: true,
    },
  });

  await prisma.assignment.upsert({
    where: { id: ids.assignment },
    update: { status: "OPEN", revision: 1 },
    create: {
      id: ids.assignment,
      schoolId: ids.school,
      courseVersionId: ids.courseVersion,
      createdByUserId: ids.teacher,
      title: "真实学习与反馈任务",
      status: "OPEN",
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      dueAt: new Date("2026-12-31T23:59:59.000Z"),
      openedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
  });

  await prisma.assignmentTarget.upsert({
    where: { id: ids.assignmentTarget },
    update: { enrollmentId: ids.studentEnrollment },
    create: {
      id: ids.assignmentTarget,
      schoolId: ids.school,
      assignmentId: ids.assignment,
      targetType: "STUDENT",
      enrollmentId: ids.studentEnrollment,
    },
  });

  await prisma.activityProgress.upsert({
    where: {
      activityId_enrollmentId: {
        activityId: ids.activity,
        enrollmentId: ids.studentEnrollment,
      },
    },
    update: {},
    create: {
      id: ids.activityProgress,
      schoolId: ids.school,
      activityId: ids.activity,
      enrollmentId: ids.studentEnrollment,
      position: 0,
      completed: false,
    },
  });

  await prisma.feedback.deleteMany({
    where: { submissionId: ids.submission },
  });
  await prisma.submission.upsert({
    where: { id: ids.submission },
    update: { status: "NEEDS_REVIEW" },
    create: {
      id: ids.submission,
      schoolId: ids.school,
      assignmentId: ids.assignment,
      enrollmentId: ids.studentEnrollment,
      attemptNo: 1,
      status: "NEEDS_REVIEW",
      idempotencyKey: "seed-review-submission",
      submittedAt: new Date("2026-07-10T00:00:00.000Z"),
    },
  });

  await prisma.report.upsert({
    where: { id: ids.report },
    update: { status: "READY", enrollmentId: ids.studentEnrollment },
    create: {
      id: ids.report,
      schoolId: ids.school,
      type: "STUDENT_GROWTH",
      status: "READY",
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.000Z"),
      dataCompleteness: 0.8,
      providerDisclosure: "由本地测试数据库中的真实流程记录汇总。",
      generatedAt: new Date("2026-07-14T00:00:00.000Z"),
      generatedByUserId: ids.teacher,
      enrollmentId: ids.studentEnrollment,
      classId: ids.class,
      data: {
        completedActivities: 0,
        submissionCount: 1,
        note: "虚构测试身份，不包含真实学生数据。",
      },
    },
  });

  await prisma.volunteerProfile.upsert({
    where: { schoolId_userId: { schoolId: ids.school, userId: ids.volunteer } },
    update: { status: "ACTIVE", displayName: "测试志愿者" },
    create: {
      id: ids.volunteerProfile,
      schoolId: ids.school,
      userId: ids.volunteer,
      status: "ACTIVE",
      displayName: "测试志愿者",
      phone: "000-0000-0000",
      qualifications: ["TEST_TRAINING_ELIGIBLE"],
      qualifiedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
  });

  await prisma.trainingProgram.upsert({
    where: { id: ids.training },
    update: { status: "PUBLISHED", title: "志愿服务安全与边界" },
    create: {
      id: ids.training,
      schoolId: ids.school,
      title: "志愿服务安全与边界",
      description: "用于验证真实培训进度持久化的虚构测试培训。",
      objectives: ["识别服务边界", "遵循最小披露"],
      status: "PUBLISHED",
    },
  });

  for (const module of [
    {
      id: ids.moduleSafety,
      title: "服务安全基础",
      sortOrder: 1,
      durationMinutes: 10,
    },
    {
      id: ids.moduleBoundary,
      title: "信息披露边界",
      sortOrder: 2,
      durationMinutes: 12,
    },
  ]) {
    await prisma.trainingModule.upsert({
      where: { id: module.id },
      update: {
        title: module.title,
        sortOrder: module.sortOrder,
        durationMinutes: module.durationMinutes,
      },
      create: {
        ...module,
        schoolId: ids.school,
        programId: ids.training,
        required: true,
      },
    });
  }

  await prisma.trainingEnrollment.upsert({
    where: {
      schoolId_programId_volunteerUserId: {
        schoolId: ids.school,
        programId: ids.training,
        volunteerUserId: ids.volunteer,
      },
    },
    update: { status: "ENROLLED" },
    create: {
      id: ids.enrollment,
      schoolId: ids.school,
      programId: ids.training,
      volunteerUserId: ids.volunteer,
      status: "ENROLLED",
    },
  });

  await seedReusablePractices();
  await seedStudentCourses();
}

try {
  await main();
  console.log(
    "Seeded fictional identities, teaching loop, four student courses, reusable practices, reports, and volunteer training data.",
  );
} finally {
  await prisma.$disconnect();
  await pool.end();
}
