export interface PlanAction {
  label: string;
  href: string;
}

export interface PlanPricing {
  amount: number;
  unit: string;
  originalAmount?: number;
}

export interface PricingTier {
  id: string;
  name: string;
  tagline: string;
  targetAudience: string;
  price: PlanPricing;
  discountNote: string;
  fundingSources: string[];
  services: string[];
  highlighted?: boolean;
  actions: {
    trial: PlanAction;
    consult: PlanAction;
    schoolPlan: PlanAction;
  };
}

export interface ComparisonFeature {
  id: string;
  label: string;
  values: Record<string, string | boolean>;
}

/**
 * 产品方案集中配置。
 * 所有定价、客群、折扣、服务内容与资金来源均在这里维护，页面只负责渲染。
 */
export const pricingTiers: PricingTier[] = [
  {
    id: "basic",
    name: "普惠版",
    tagline: "零门槛起步，先把课开起来",
    targetAudience: "师资紧张、预算有限或首次引入数字化教学的县域/乡村学校",
    price: {
      amount: 0,
      unit: "元/学期/校",
    },
    discountNote: "公益资助期内基础功能免费；升级专业版可享首年 50% 补贴。",
    fundingSources: ["公益基金会", "地方政府教育信息化专项"],
    services: [
      "国家通用语言基础课程包",
      "离线内容同步",
      "学生进度看板",
      "邮件支持",
    ],
    actions: {
      trial: {
        label: "申请试用",
        href: "/contact?trial=basic",
      },
      consult: {
        label: "咨询方案",
        href: "/contact?consult=basic",
      },
      schoolPlan: {
        label: "获取学校方案",
        href: "/contact?school-plan=basic",
      },
    },
  },
  {
    id: "pro",
    name: "专业版",
    tagline: "校本研修与教学反馈一体化",
    targetAudience: "已有基础教学能力、希望提升教师研修与数据反馈的学校",
    price: {
      amount: 3600,
      unit: "元/学期/校",
      originalAmount: 6000,
    },
    discountNote:
      "县域学校及乡村小规模学校享受 40% 补贴，折合 3600 元/学期/校。",
    fundingSources: ["教育公益基金", "区域教育信息化补贴"],
    highlighted: true,
    services: [
      "普惠版全部服务",
      "教师能力测评与研修路径",
      "班级学情分析报告",
      "语音作业自动评测",
      "在线工单支持",
    ],
    actions: {
      trial: {
        label: "申请试用",
        href: "/contact?trial=pro",
      },
      consult: {
        label: "咨询方案",
        href: "/contact?consult=pro",
      },
      schoolPlan: {
        label: "获取学校方案",
        href: "/contact?school-plan=pro",
      },
    },
  },
  {
    id: "premium",
    name: "旗舰版",
    tagline: "区域级部署与深度定制",
    targetAudience: "需要区域统筹、数据看板、定制内容与驻场支持的教育局/集团校",
    price: {
      amount: 9800,
      unit: "元/学期/校",
      originalAmount: 14000,
    },
    discountNote: "区域集中采购可享阶梯报价；旗舰版客户优先获得定制开发名额。",
    fundingSources: ["区域教育信息化预算", "东西部协作资金", "公益配捐"],
    services: [
      "专业版全部服务",
      "区域数据驾驶舱",
      "校本内容定制",
      "驻校培训与种子教师培养",
      "7×12 小时专属支持",
    ],
    actions: {
      trial: {
        label: "申请试用",
        href: "/contact?trial=premium",
      },
      consult: {
        label: "咨询方案",
        href: "/contact?consult=premium",
      },
      schoolPlan: {
        label: "获取学校方案",
        href: "/contact?school-plan=premium",
      },
    },
  },
];

export const comparisonFeatures: ComparisonFeature[] = [
  {
    id: "offline-sync",
    label: "离线内容同步",
    values: {
      basic: true,
      pro: true,
      premium: true,
    },
  },
  {
    id: "basic-courses",
    label: "基础课程包",
    values: {
      basic: true,
      pro: true,
      premium: true,
    },
  },
  {
    id: "teacher-training",
    label: "教师研修路径",
    values: {
      basic: false,
      pro: true,
      premium: true,
    },
  },
  {
    id: "voice-assessment",
    label: "语音作业评测",
    values: {
      basic: false,
      pro: true,
      premium: true,
    },
  },
  {
    id: "class-analytics",
    label: "班级学情分析",
    values: {
      basic: false,
      pro: true,
      premium: true,
    },
  },
  {
    id: "regional-dashboard",
    label: "区域数据驾驶舱",
    values: {
      basic: false,
      pro: false,
      premium: true,
    },
  },
  {
    id: "custom-content",
    label: "校本内容定制",
    values: {
      basic: false,
      pro: false,
      premium: true,
    },
  },
  {
    id: "on-site-support",
    label: "驻校培训支持",
    values: {
      basic: false,
      pro: false,
      premium: true,
    },
  },
  {
    id: "support-channel",
    label: "支持渠道",
    values: {
      basic: "邮件",
      pro: "在线工单",
      premium: "7×12 专属支持",
    },
  },
];

export function formatPrice(amount: number): string {
  return amount === 0 ? "免费" : `¥${amount.toLocaleString("zh-CN")}`;
}
