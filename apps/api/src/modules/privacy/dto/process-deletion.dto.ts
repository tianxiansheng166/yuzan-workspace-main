import { IsIn, IsOptional, IsString } from "class-validator";

const PROCESSABLE_STATUSES = ["APPROVED", "REJECTED", "PROCESSING", "COMPLETED"] as const;

export class ProcessDeletionDto {
  @IsIn(PROCESSABLE_STATUSES)
  status: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
