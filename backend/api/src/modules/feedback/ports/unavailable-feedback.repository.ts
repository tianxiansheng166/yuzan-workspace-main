import { Injectable } from "@nestjs/common";
import type {
  Feedback,
  CreateFeedbackInput,
} from "../domain/feedback.types.js";
import { FeedbackUnavailableException } from "../domain/feedback.errors.js";
import type {
  FeedbackRepositoryPort,
  ListPendingFeedbackOptions,
  PaginatedResult,
} from "./feedback-repository.port.js";

@Injectable()
export class UnavailableFeedbackRepository implements FeedbackRepositoryPort {
  findById(_schoolId: string, _feedbackId: string): Promise<Feedback | null> {
    void _schoolId;
    void _feedbackId;
    return Promise.reject(new FeedbackUnavailableException());
  }

  findBySubmissionId(
    _schoolId: string,
    _submissionId: string,
  ): Promise<readonly Feedback[]> {
    void _schoolId;
    void _submissionId;
    return Promise.reject(new FeedbackUnavailableException());
  }

  findPendingBySchool(
    _schoolId: string,
    _options: ListPendingFeedbackOptions,
  ): Promise<PaginatedResult<Feedback>> {
    void _schoolId;
    void _options;
    return Promise.reject(new FeedbackUnavailableException());
  }

  save(_input: CreateFeedbackInput): Promise<Feedback> {
    void _input;
    return Promise.reject(new FeedbackUnavailableException());
  }

  findByStudentEnrollments(
    _schoolId: string,
    _enrollmentIds: readonly string[],
    _options?: { limit?: number; cursor?: string },
  ): Promise<PaginatedResult<Feedback>> {
    void _schoolId;
    void _enrollmentIds;
    void _options;
    return Promise.reject(new FeedbackUnavailableException());
  }
}
