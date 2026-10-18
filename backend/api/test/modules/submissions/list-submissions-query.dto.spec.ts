import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListSubmissionsQueryDto } from "../../../src/modules/submissions/dto/list-submissions-query.dto.js";

describe("ListSubmissionsQueryDto", () => {
  it("accepts a real Submission status and rejects unknown filters", async () => {
    const valid = plainToInstance(ListSubmissionsQueryDto, { status: "NEEDS_REVIEW" });
    const invalid = plainToInstance(ListSubmissionsQueryDto, { status: "NOT_A_STATUS" });

    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(invalid)).toHaveLength(1);
  });
});
