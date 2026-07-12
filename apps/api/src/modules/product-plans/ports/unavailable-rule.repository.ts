import { Injectable } from "@nestjs/common";
import type {
  RecommendationRule,
  ListRulesOptions,
  PaginatedResult,
} from "../domain/rule.types.js";
import { RuleNotFoundException } from "../domain/rule.errors.js";
import type { RuleRepositoryPort } from "./rule-repository.port.js";

@Injectable()
export class UnavailableRuleRepository implements RuleRepositoryPort {
  private fail(): never {
    throw new RuleNotFoundException("推荐规则服务暂不可用");
  }

  async list(
    _options: ListRulesOptions,
  ): Promise<PaginatedResult<RecommendationRule>> {
    this.fail();
  }

  async findById(_id: string): Promise<RecommendationRule | null> {
    this.fail();
  }

  async save(_rule: RecommendationRule): Promise<RecommendationRule> {
    this.fail();
  }

  async findConflictingRules(
    _issueCode: string,
    _dimensionCode: string,
    _severityMin: number,
    _severityMax: number,
    _priority: number,
    _excludeId?: string,
  ): Promise<readonly RecommendationRule[]> {
    this.fail();
  }
}
