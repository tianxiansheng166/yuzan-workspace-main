export const QUESTION_BANK_DIAGNOSIS_VERSION = "qb-diagnosis-v1";

export const QUESTION_BANK_DOMAIN_ORDER = [
  "LISTEN",
  "SPEAK",
  "READ",
  "WRITE",
] as const;
export type QuestionBankDomain = (typeof QUESTION_BANK_DOMAIN_ORDER)[number];

export const QUESTION_BANK_FAMILY_ORDER = [
  "LISTEN_IMAGE_CHOICE",
  "DICTATION",
  "READ_ALOUD",
  "PICTURE_SPEAKING",
  "WORD_RECOGNITION",
  "SENTENCE_COMPREHENSION",
  "PICTURE_WORD",
  "SENTENCE_COMPLETION",
] as const;
export type QuestionBankFamily = (typeof QUESTION_BANK_FAMILY_ORDER)[number];

export type DiagnosisProficiency = "STRONG" | "DEVELOPING" | "PRIORITY";

type DomainDefinition = { displayName: string };
type FamilyDefinition = {
  domain: QuestionBankDomain;
  displayName: string;
  guidance: string;
};

const DOMAIN_DEFINITIONS: Record<QuestionBankDomain, DomainDefinition> = {
  LISTEN: { displayName: "听" },
  SPEAK: { displayName: "说" },
  READ: { displayName: "读" },
  WRITE: { displayName: "写" },
};

const FAMILY_DEFINITIONS: Record<QuestionBankFamily, FamilyDefinition> = {
  LISTEN_IMAGE_CHOICE: {
    domain: "LISTEN",
    displayName: "听音选图",
    guidance: "先认真听清关键词，再对照图片中的人物、物品和动作作出选择。",
  },
  DICTATION: {
    domain: "LISTEN",
    displayName: "听写句子",
    guidance: "重点练习听清句子中的关键字词，再完整写出句子。",
  },
  READ_ALOUD: {
    domain: "SPEAK",
    displayName: "朗读句子",
    guidance: "朗读时关注字音准确、停顿和表达流畅度。",
  },
  PICTURE_SPEAKING: {
    domain: "SPEAK",
    displayName: "看图说话",
    guidance: "先观察人物、地点和动作，再用完整句子组织表达。",
  },
  WORD_RECOGNITION: {
    domain: "READ",
    displayName: "单词认读",
    guidance: "练习看清词语的字形和意思，读完后再确认自己的选择。",
  },
  SENTENCE_COMPREHENSION: {
    domain: "READ",
    displayName: "句子理解",
    guidance: "先读完整句子，找出关键信息，再判断句子的意思。",
  },
  PICTURE_WORD: {
    domain: "WRITE",
    displayName: "看图写词",
    guidance: "观察图片中的重点内容，练习写出准确、完整的词语。",
  },
  SENTENCE_COMPLETION: {
    domain: "WRITE",
    displayName: "句子补全",
    guidance: "先读懂句子的前后意思，再选择或写出最合适的内容。",
  },
};

export type QuestionBankDiagnosisItem = {
  assessmentItemId: string;
  questionVersionId: string;
  sortOrder: number;
  domain: string | null;
  family: string | null;
  level: string | null;
  earned: number | null;
  max: number | null;
};

type DiagnosisScore = {
  earnedPoints: number;
  maxPoints: number;
  percentage: number;
  proficiency: DiagnosisProficiency;
};

export type QuestionBankDomainDiagnosis = DiagnosisScore & {
  domain: QuestionBankDomain;
  displayName: string;
  itemCount: number;
  lostPoints: number;
};

export type QuestionBankFamilyDiagnosis = DiagnosisScore & {
  family: QuestionBankFamily;
  displayName: string;
  domain: QuestionBankDomain;
  domainDisplayName: string;
  levels: string[];
  itemCount: number;
  lostPoints: number;
};

export type QuestionBankRetryCandidate = {
  assessmentItemId: string;
  questionVersionId: string;
  family: QuestionBankFamily;
  displayName: string;
  domain: QuestionBankDomain;
  domainDisplayName: string;
  earned: number;
  max: number;
};

export type QuestionBankNextStep = {
  family: QuestionBankFamily;
  displayName: string;
  domain: QuestionBankDomain;
  domainDisplayName: string;
  levels: string[];
  guidance: string;
};

export type QuestionBankDiagnosis = {
  version: typeof QUESTION_BANK_DIAGNOSIS_VERSION;
  overall: Omit<DiagnosisScore, "proficiency"> & {
    proficiency: DiagnosisProficiency;
  };
  domains: QuestionBankDomainDiagnosis[];
  families: QuestionBankFamilyDiagnosis[];
  strengths: QuestionBankFamilyDiagnosis[];
  priorities: QuestionBankFamilyDiagnosis[];
  retryCandidates: QuestionBankRetryCandidate[];
  nextSteps: QuestionBankNextStep[];
};

export class QuestionBankDiagnosisError extends Error {}

type Bucket = {
  earnedPoints: number;
  maxPoints: number;
  itemCount: number;
  levels: Set<string>;
};

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function score(earnedPoints: number, maxPoints: number): DiagnosisScore {
  if (
    !Number.isFinite(earnedPoints) ||
    !Number.isFinite(maxPoints) ||
    maxPoints <= 0
  ) {
    throw new QuestionBankDiagnosisError("题库诊断分值无效");
  }
  const percentage = round((earnedPoints / maxPoints) * 100);
  return {
    earnedPoints: round(earnedPoints),
    maxPoints: round(maxPoints),
    percentage,
    proficiency:
      percentage >= 85
        ? "STRONG"
        : percentage >= 70
          ? "DEVELOPING"
          : "PRIORITY",
  };
}

function knownDomain(value: string | null): QuestionBankDomain {
  const normalized = value?.trim().toUpperCase();
  if (
    !normalized ||
    !QUESTION_BANK_DOMAIN_ORDER.includes(normalized as QuestionBankDomain)
  ) {
    throw new QuestionBankDiagnosisError("题库诊断缺少有效的能力领域元数据");
  }
  return normalized as QuestionBankDomain;
}

function knownFamily(value: string | null): QuestionBankFamily {
  const normalized = value?.trim().toUpperCase();
  if (
    !normalized ||
    !QUESTION_BANK_FAMILY_ORDER.includes(normalized as QuestionBankFamily)
  ) {
    throw new QuestionBankDiagnosisError("题库诊断缺少有效的题型元数据");
  }
  return normalized as QuestionBankFamily;
}

function requiredLevel(value: string | null) {
  const level = value?.trim();
  if (!level)
    throw new QuestionBankDiagnosisError("题库诊断缺少有效的等级元数据");
  return level;
}

function addBucket(
  map: Map<string, Bucket>,
  key: string,
  item: { earned: number; max: number; level: string },
) {
  const bucket = map.get(key) ?? {
    earnedPoints: 0,
    maxPoints: 0,
    itemCount: 0,
    levels: new Set<string>(),
  };
  bucket.earnedPoints += item.earned;
  bucket.maxPoints += item.max;
  bucket.itemCount += 1;
  bucket.levels.add(item.level);
  map.set(key, bucket);
}

function familyOrder(family: QuestionBankFamily) {
  return QUESTION_BANK_FAMILY_ORDER.indexOf(family);
}

/**
 * Build the immutable v1 diagnosis from formal item scores only. The input
 * deliberately has no provider evidence or scoring specification fields, so
 * diagnostic candidate values cannot become an authority by accident.
 */
export function buildQuestionBankDiagnosis(
  items: readonly QuestionBankDiagnosisItem[],
): QuestionBankDiagnosis {
  if (!items.length)
    throw new QuestionBankDiagnosisError("题库诊断没有可聚合的正式评分题目");

  const domains = new Map<string, Bucket>();
  const families = new Map<string, Bucket>();
  const retryCandidates: Array<
    QuestionBankRetryCandidate & { sortOrder: number }
  > = [];

  for (const item of items) {
    const domain = knownDomain(item.domain);
    const family = knownFamily(item.family);
    const definition = FAMILY_DEFINITIONS[family];
    if (definition.domain !== domain) {
      throw new QuestionBankDiagnosisError("题库题型与能力领域元数据不一致");
    }
    const level = requiredLevel(item.level);
    if (!Number.isFinite(item.max) || item.max === null || item.max <= 0) {
      throw new QuestionBankDiagnosisError("题库诊断题目满分必须为正数");
    }
    if (
      !Number.isFinite(item.earned) ||
      item.earned === null ||
      item.earned < 0 ||
      item.earned > item.max
    ) {
      throw new QuestionBankDiagnosisError("题库诊断缺少有效的正式分数");
    }
    if (
      !item.assessmentItemId ||
      !item.questionVersionId ||
      !Number.isFinite(item.sortOrder)
    ) {
      throw new QuestionBankDiagnosisError("题库诊断题目引用无效");
    }

    addBucket(domains, domain, { earned: item.earned, max: item.max, level });
    addBucket(families, family, { earned: item.earned, max: item.max, level });
    if (item.earned < item.max) {
      retryCandidates.push({
        assessmentItemId: item.assessmentItemId,
        questionVersionId: item.questionVersionId,
        family,
        displayName: definition.displayName,
        domain,
        domainDisplayName: DOMAIN_DEFINITIONS[domain].displayName,
        earned: round(item.earned),
        max: round(item.max),
        sortOrder: item.sortOrder,
      });
    }
  }

  const domainSummaries = QUESTION_BANK_DOMAIN_ORDER.flatMap((domain) => {
    const bucket = domains.get(domain);
    if (!bucket) return [];
    const scored = score(bucket.earnedPoints, bucket.maxPoints);
    return [
      {
        domain,
        displayName: DOMAIN_DEFINITIONS[domain].displayName,
        ...scored,
        itemCount: bucket.itemCount,
        lostPoints: round(bucket.maxPoints - bucket.earnedPoints),
      },
    ];
  });

  const familySummaries = QUESTION_BANK_FAMILY_ORDER.flatMap((family) => {
    const bucket = families.get(family);
    if (!bucket) return [];
    const definition = FAMILY_DEFINITIONS[family];
    const scored = score(bucket.earnedPoints, bucket.maxPoints);
    return [
      {
        family,
        displayName: definition.displayName,
        domain: definition.domain,
        domainDisplayName: DOMAIN_DEFINITIONS[definition.domain].displayName,
        levels: [...bucket.levels].sort((a, b) =>
          a.localeCompare(b, "zh-Hans-CN"),
        ),
        ...scored,
        itemCount: bucket.itemCount,
        lostPoints: round(bucket.maxPoints - bucket.earnedPoints),
      },
    ];
  });

  const overallEarned = familySummaries.reduce(
    (total, family) => total + family.earnedPoints,
    0,
  );
  const overallMax = familySummaries.reduce(
    (total, family) => total + family.maxPoints,
    0,
  );
  const overall = score(overallEarned, overallMax);
  const priorities = familySummaries
    .filter((family) => family.proficiency === "PRIORITY")
    .sort(
      (left, right) =>
        left.percentage - right.percentage ||
        right.lostPoints - left.lostPoints ||
        familyOrder(left.family) - familyOrder(right.family),
    )
    .slice(0, 3);
  const strengths = familySummaries
    .filter((family) => family.proficiency === "STRONG")
    .sort(
      (left, right) =>
        right.percentage - left.percentage ||
        right.earnedPoints - left.earnedPoints ||
        familyOrder(left.family) - familyOrder(right.family),
    )
    .slice(0, 2);

  return {
    version: QUESTION_BANK_DIAGNOSIS_VERSION,
    overall,
    domains: domainSummaries,
    families: familySummaries,
    strengths,
    priorities,
    retryCandidates: retryCandidates
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.assessmentItemId.localeCompare(right.assessmentItemId),
      )
      .map(({ sortOrder: _sortOrder, ...candidate }) => candidate),
    nextSteps: priorities.map((family) => ({
      family: family.family,
      displayName: family.displayName,
      domain: family.domain,
      domainDisplayName: family.domainDisplayName,
      levels: family.levels,
      guidance: FAMILY_DEFINITIONS[family.family].guidance,
    })),
  };
}

export function isQuestionBankDiagnosis(
  value: unknown,
): value is QuestionBankDiagnosis {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const diagnosis = value as Partial<QuestionBankDiagnosis>;
  return (
    diagnosis.version === QUESTION_BANK_DIAGNOSIS_VERSION &&
    !!diagnosis.overall &&
    Array.isArray(diagnosis.domains) &&
    Array.isArray(diagnosis.families) &&
    Array.isArray(diagnosis.strengths) &&
    Array.isArray(diagnosis.priorities) &&
    Array.isArray(diagnosis.retryCandidates) &&
    Array.isArray(diagnosis.nextSteps)
  );
}
