﻿import { ref, type Ref } from 'vue';

export interface SpeechScoreResult {
  scorerVersion: string;
  transcript: string;
  confidence: number;
  scores: {
    accuracy: number;
    completeness: number;
    fluency: number;
    tone: number;
    overall: number;
  };
  errors: Array<{
    text: string;
    pinyin: string;
    startMs: number;
    endMs: number;
    type: string;
    score: number;
  }>;
  requiresReview: boolean;
}

export interface SpeechJobStatus {
  jobId: string;
  status: 'CREATED' | 'PROCESSING' | 'AUTO_RESULT' | 'NEEDS_REVIEW' | 'FINALIZED' | 'FAILED' | 'REJECTED_AUDIO';
  result: SpeechScoreResult | null;
  confidence: number | null;
  processingMs: number | null;
  errorCode: string | null;
}

export function useSpeechResult() {
  const jobStatus: Ref<SpeechJobStatus | null> = ref(null);
  const pollInterval: Ref<ReturnType<typeof setInterval> | null> = ref(null);
  const isLoading = ref(false);
  const error: Ref<string | null> = ref(null);

  /**
   * 轮询 SpeechJob 状态
   */
  function startPolling(jobId: string, schoolId: string, accessToken: string, intervalMs = 3000): void {
    stopPolling();
    isLoading.value = true;
    error.value = null;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/v1/schools/${schoolId}/speech-jobs/${jobId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        if (!response.ok) {
          error.value = `Failed to fetch job status: ${response.status}`;
          return;
        }

        const data = await response.json() as SpeechJobStatus;
        jobStatus.value = data;

        // 如果任务已完成（成功或失败），停止轮询
        if (
          data.status === 'AUTO_RESULT' ||
          data.status === 'NEEDS_REVIEW' ||
          data.status === 'FINALIZED' ||
          data.status === 'FAILED' ||
          data.status === 'REJECTED_AUDIO'
        ) {
          isLoading.value = false;
          stopPolling();
        }
      } catch (e: unknown) {
        error.value = e instanceof Error ? e.message : 'Polling error';
      }
    };

    // 立即执行一次
    void poll();
    pollInterval.value = setInterval(poll, intervalMs);
  }

  function stopPolling(): void {
    if (pollInterval.value !== null) {
      clearInterval(pollInterval.value);
      pollInterval.value = null;
    }
  }

  function reset(): void {
    stopPolling();
    jobStatus.value = null;
    isLoading.value = false;
    error.value = null;
  }

  return {
    jobStatus,
    isLoading,
    error,
    startPolling,
    stopPolling,
    reset,
  };
}