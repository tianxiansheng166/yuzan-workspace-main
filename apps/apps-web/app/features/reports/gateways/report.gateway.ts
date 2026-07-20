import type {
  ReportsListResult,
  StudentGrowthReport,
  StudentReportResult,
} from "../types";

/**
 * Report gateway
 *
 * 当前为本地 demo/placeholder 实现，尚未接入 RPT-001 或真实 AI 服务。
 * 所有 demo 数据均显式标记，未连接服务时返回 pending / unavailable，
 * 不伪造随机分数或正式诊断结论。
 */
export function createReportGateway() {
  async function listStudents(_schoolId: string): Promise<ReportsListResult> {
    // TODO: 接入 RPT-001 后替换为真实请求
    return {
      status: "ready",
      students: [
        {
          studentId: "demo-student-001",
          displayName: "卓玛（演示）",
          schoolId: _schoolId,
          className: "一年级（1）班",
          lastAssessedAt: "2026-06-15T10:30:00Z",
          overallStatus: "available",
        },
        {
          studentId: "demo-student-002",
          displayName: "扎西（演示）",
          schoolId: _schoolId,
          className: "一年级（1）班",
          lastAssessedAt: null,
          overallStatus: "pending",
        },
      ],
      message: "当前为演示数据，接入 RPT-001 后替换为真实学生列表。",
    };
  }

  async function fetchStudentReport(
    _schoolId: string,
    studentId: string,
  ): Promise<StudentReportResult> {
    // TODO: 接入真实评估与 AI 分析服务后移除 demo 分支
    if (studentId === "unavailable") {
      return {
        status: "unavailable",
        report: null,
        message: "AI 分析报告服务未接入，暂时无法生成学习成长报告。",
      };
    }

    if (studentId === "empty") {
      return {
        status: "empty",
        report: null,
        message: "该学生暂无任何评估或学习记录。",
      };
    }

    if (studentId === "error") {
      return {
        status: "error",
        report: null,
        message: "读取报告时发生网络错误，请检查连接后重试。",
      };
    }

    if (studentId === "permission") {
      return {
        status: "permission",
        report: null,
        message: "你没有权限查看该学生的成长报告。",
      };
    }

    const report: StudentGrowthReport = {
      summary: {
        studentId,
        displayName:
          studentId === "demo-student-001" ? "卓玛（演示）" : "学生（演示）",
        schoolId: _schoolId,
        className: "一年级（1）班",
        lastAssessedAt: "2026-06-15T10:30:00Z",
        overallStatus: "available",
      },
      timeline: [
        {
          id: "ev-1",
          occurredAt: "2026-03-10T09:00:00Z",
          kind: "initial_assessment",
          label: "首次测评",
          note: "国通语基础发音测评（演示数据）",
          scoreDelta: null,
        },
        {
          id: "ev-2",
          occurredAt: "2026-04-12T09:00:00Z",
          kind: "course_completed",
          label: "完成课程单元",
          note: "完成《语音入门》第一单元（演示数据）",
          scoreDelta: null,
        },
        {
          id: "ev-3",
          occurredAt: "2026-06-15T10:30:00Z",
          kind: "reassessment",
          label: "复测",
          note: "发音与朗读复测（演示数据）",
          scoreDelta: 12,
        },
        {
          id: "ev-4",
          occurredAt: "2026-06-20T11:00:00Z",
          kind: "intervention_started",
          label: "启动教师干预",
          note: "建议增加朗读练习频次（演示数据）",
          scoreDelta: null,
        },
      ],
      comparisons: [
        {
          domain: "声母正确率",
          firstScore: 72,
          retestScore: 84,
          firstAt: "2026-03-10T09:00:00Z",
          retestAt: "2026-06-15T10:30:00Z",
          changeText: "提高 12 个百分点（演示）",
        },
        {
          domain: "朗读流畅度",
          firstScore: 65,
          retestScore: 78,
          firstAt: "2026-03-10T09:00:00Z",
          retestAt: "2026-06-15T10:30:00Z",
          changeText: "提高 13 个百分点（演示）",
        },
        {
          domain: "AI 语音综合评分",
          firstScore: null,
          retestScore: null,
          firstAt: null,
          retestAt: null,
          changeText: "AI 评分服务未接入（pending）",
        },
      ],
      evidenceSections: [
        {
          kind: "reading",
          label: "朗读证据",
          items: [
            {
              id: "rd-1",
              title: "《春天的颜色》朗读片段",
              recordedAt: "2026-06-14T08:30:00Z",
              kind: "朗读录音",
              availability: "available",
              summary:
                "演示摘要：语速适中，个别声母需加强；完整度 85%（demo）。",
              assetUrl: null,
            },
          ],
        },
        {
          kind: "writing",
          label: "书面练习证据",
          items: [
            {
              id: "wr-1",
              title: "声母 b/p 书写练习",
              recordedAt: "2026-06-13T10:00:00Z",
              kind: "书面练习",
              availability: "available",
              summary: "演示摘要：书写规范，混淆次数 2 次（demo）。",
              assetUrl: null,
            },
          ],
        },
        {
          kind: "course",
          label: "课程进度证据",
          items: [
            {
              id: "cr-1",
              title: "《语音入门》第一单元",
              recordedAt: "2026-04-12T09:00:00Z",
              kind: "课程进度",
              availability: "available",
              summary: "演示摘要：完成全部 6 个活动，平均停留 8 分钟（demo）。",
              assetUrl: null,
            },
          ],
        },
      ],
      intervention: {
        level: "practice",
        title: "教学观察建议：加强朗读练习",
        description:
          "根据现有练习记录，该生在部分声母区分上仍有波动。建议在日常教学中增加针对性朗读练习，并持续观察。",
        disclaimer:
          "本建议基于学习数据生成的教学观察，供教师参考，不构成医疗诊断或正式评估结论。",
        actions: [
          "每日安排 5 分钟目标声母朗读",
          "一周后使用同一段落进行复测",
          "记录课堂口头回答中的常见错误",
        ],
      },
      demoNotice: "当前报告使用演示数据，接入 RPT-001 后将显示真实评估结果。",
    };

    return {
      status: "ready",
      report,
      message: "",
    };
  }

  return {
    listStudents,
    fetchStudentReport,
  };
}

export const reportGateway = createReportGateway();
