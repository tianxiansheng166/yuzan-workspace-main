import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

/**
 * 创建班级测评 DTO (P0-CONTRACT-CONVERGENCE-001).
 *
 * 契约收敛要点：
 * 1. `enrollmentIds` 改为可选 —— 与 ClassesService 默认全班的行为一致。
 *    显式传入时只校验格式；service 层负责校验归属当前班级。
 * 2. `questionIds` 保持可选，但 service 层强制要求解析后非空，
 *    未传入或解析后为空时抛 ASSESSMENT_HAS_NO_ITEMS / PRACTICE_CONTENT_EMPTY。
 *    前端不再被允许"传空数组创建空测评"。
 * 3. `type` 接受 READING/WRITTEN/MIXED；COMPREHENSIVE 由 service 映射为 MIXED（向后兼容）。
 */
export class ClassAssessmentDto {
  @IsEnum(["READING", "WRITTEN", "MIXED", "COMPREHENSIVE"])
  readonly type!: "READING" | "WRITTEN" | "MIXED" | "COMPREHENSIVE";

  /**
   * 目标学生 enrollmentId 列表。
   * 省略时 service 取当前班级全部 ACTIVE 学生。
   * 传入空数组等价于省略（service 会回退到全班），避免"0 学生"空测评。
   */
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  readonly enrollmentIds?: string[];

  /**
   * 测评题目 ID 列表。
   * 省略时 service 尝试从班级当前课程解析默认题目（若无可解析内容则失败）。
   * 传入空数组等价于省略。
   */
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  readonly questionIds?: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  readonly title?: string;
}