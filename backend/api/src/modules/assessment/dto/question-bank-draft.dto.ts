import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class QuestionBankChoiceDto {
  @IsIn(["A", "B", "C", "D"])
  key!: "A" | "B" | "C" | "D";

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  text!: string;
}

export class QuestionBankDraftInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  prompt!: string;

  @IsIn(["CHOICE", "TEXT"])
  itemType!: "CHOICE" | "TEXT";

  @IsIn(["LISTEN", "SPEAK", "READ", "WRITE"])
  domain!: "LISTEN" | "SPEAK" | "READ" | "WRITE";

  @IsIn(["EASY", "MEDIUM", "HARD"])
  difficulty!: "EASY" | "MEDIUM" | "HARD";

  @IsOptional()
  @IsString()
  @MaxLength(80)
  gradeBand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  abilityCategory?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  maxScore!: number;

  @ValidateIf((draft: QuestionBankDraftInputDto) => draft.itemType === "CHOICE")
  @IsDefined()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuestionBankChoiceDto)
  options?: QuestionBankChoiceDto[];

  @ValidateIf((draft: QuestionBankDraftInputDto) => draft.itemType === "CHOICE")
  @IsDefined()
  @IsIn(["A", "B", "C", "D"])
  correctOption?: "A" | "B" | "C" | "D";

  @ValidateIf((draft: QuestionBankDraftInputDto) => draft.itemType === "TEXT")
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  acceptedAnswers?: string[];
}

export class UpdateQuestionBankDraftDto extends QuestionBankDraftInputDto {
  @IsInt()
  @Min(1)
  expectedRevision!: number;
}
