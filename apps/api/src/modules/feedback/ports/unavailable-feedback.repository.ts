import { Injectable } from "@nestjs/common";
import type { Feedback, CreateFeedbackInput } from "../domain/feedback.types.js";
import { FeedbackUnavailableException } from "../domain/feedback.errors.js";
import type {
  FeedbackRepositoryPort,
  ListPendingFeedbackOptions,
  PaginatedResult,
} from "./feedback-repository.port.js";

@Injectable()
export class UnavailableFeedbackRepository implements FeedbackRepositoryPort {
  async findById(
    _schoolId: string,
    _feedbackId: string,
  ): Promise<Feedback | null> {
    throw new FeedbackUnavailableException();
  }

  async findBySubmissionId(
    _schoolId: string,
    _submissionId: string,
  ): Promise<readonly Feedback[]> {
    throw new FeedbackUnavailableException();
  }

  async findPendingBySchool(
    _schoolId: string,
    _options: ListPendingFeedbackOptions,
  ): Promise<PaginatedResult<Feedback>> {
    throw new FeedbackUnavailableException();
  }

  async save(_input: CreateFeedbackInput): Promise<Feedback> {
    throw new FeedbackUnavailableException();
  }

  async findByStudentEnrollments(
    _schoolId: string,
    _enrollmentIds: readonly string[],
    _options?: { limit?: number; cursor?: string },
  ): Promise<PaginatedResult<Feedback>> {
    throw new FeedbackUnavailableException();
  }
}
