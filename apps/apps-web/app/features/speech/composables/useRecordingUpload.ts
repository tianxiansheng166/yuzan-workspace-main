import { ref, type Ref } from 'vue';
import { recordingGateway, type InitSimpleRecordingResponse } from '../gateways/recording.gateway.js';

export interface RecordingUploadState {
  phase: 'idle' | 'initializing' | 'uploading' | 'completing' | 'done' | 'error';
  recordingId: string | null;
  uploadUrl: string | null;
  objectKey: string | null;
  progress: number; // 0-100
  error: string | null;
}

export function useRecordingUpload() {
  const state: Ref<RecordingUploadState> = ref({
    phase: 'idle',
    recordingId: null,
    uploadUrl: null,
    objectKey: null,
    progress: 0,
    error: null,
  });

  /**
   * 初始化录音上传
   */
  async function init(params: {
    enrollmentId: string;
    submissionId?: string;
    mimeType?: string;
  }): Promise<{ recordingId: string; uploadUrl: string } | null> {
    state.value = { ...state.value, phase: 'initializing', error: null };

    try {
      const response = await recordingGateway.initSimpleRecording({
        ...params,
        idempotencyKey: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });

      state.value = {
        ...state.value,
        phase: 'uploading',
        recordingId: response.recordingId,
        uploadUrl: response.uploadUrl,
        objectKey: response.objectKey,
        progress: 0,
      };

      return { recordingId: response.recordingId, uploadUrl: response.uploadUrl };
    } catch (error: unknown) {
      state.value = {
        ...state.value,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Failed to initialize recording',
      };
      return null;
    }
  }

  /**
   * 上传录音 Blob 到预签名 URL
   */
  async function uploadBlob(blob: Blob, contentType?: string): Promise<boolean> {
    if (!state.value.uploadUrl) {
      state.value = { ...state.value, phase: 'error', error: 'No upload URL available' };
      return false;
    }

    try {
      // 使用 XMLHttpRequest 以支持进度回调
      await uploadWithProgress(state.value.uploadUrl, blob, contentType, (progress) => {
        state.value = { ...state.value, progress };
      });

      state.value = { ...state.value, progress: 100 };
      return true;
    } catch (error: unknown) {
      state.value = {
        ...state.value,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Upload failed',
      };
      return false;
    }
  }

  /**
   * 完成录音（确认上传，服务端验证文件存在）
   */
  async function complete(durationMs: number): Promise<string | null> {
    if (!state.value.recordingId) {
      state.value = { ...state.value, phase: 'error', error: 'No recording ID' };
      return null;
    }

    state.value = { ...state.value, phase: 'completing' };

    try {
      const result = await recordingGateway.completeRecording(state.value.recordingId, {
        durationMs,
        objectKey: state.value.objectKey ?? undefined,
      });

      state.value = { ...state.value, phase: 'done' };
      return result.recordingId;
    } catch (error: unknown) {
      state.value = {
        ...state.value,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Failed to complete recording',
      };
      return null;
    }
  }

  /**
   * 将录音绑定到 AssessmentItem
   */
  async function attachToItem(sessionId: string, itemId: string): Promise<boolean> {
    if (!state.value.recordingId) return false;

    try {
      await recordingGateway.attachRecordingToItem(sessionId, itemId, state.value.recordingId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 重试上传
   */
  function reset(): void {
    state.value = {
      phase: 'idle',
      recordingId: null,
      uploadUrl: null,
      objectKey: null,
      progress: 0,
      error: null,
    };
  }

  return {
    state,
    init,
    uploadBlob,
    complete,
    attachToItem,
    reset,
  };
}

function uploadWithProgress(
  url: string,
  blob: Blob,
  contentType?: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);

    if (contentType) {
      xhr.setRequestHeader('Content-Type', contentType);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    xhr.send(blob);
  });
}