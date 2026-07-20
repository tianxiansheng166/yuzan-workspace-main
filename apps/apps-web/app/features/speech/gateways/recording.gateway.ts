// API 基础配置
const API_BASE = '/api/v1';

export interface InitSimpleRecordingResponse {
  recordingId: string;
  status: string;
  uploadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
}

export interface RecordingStatusResponse {
  recordingId: string;
  status: string;
  durationMs: number | null;
  mimeType: string | null;
  objectKey: string | null;
}

export interface RecordingEvidenceResponse {
  recordingId: string;
  downloadUrl: string;
  expiresInSeconds: number;
}

export class RecordingGateway {
  private schoolId: string | null = null;
  private accessToken: string | null = null;

  setAuth(schoolId: string, accessToken: string): void {
    this.schoolId = schoolId;
    this.accessToken = accessToken;
  }

  /**
   * 初始化简化录音（单文件上传）
   */
  async initSimpleRecording(params: {
    enrollmentId: string;
    submissionId?: string;
    mimeType?: string;
    idempotencyKey?: string;
  }): Promise<InitSimpleRecordingResponse> {
    const response = await this.fetch(`${API_BASE}/schools/${this.schoolId}/recordings/simple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to init recording' }));
      throw new Error(error.message || `Failed to init recording: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 上传录音文件到预签名 URL
   */
  async uploadBlob(uploadUrl: string, blob: Blob, contentType?: string): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        ...(contentType ? { 'Content-Type': contentType } : {}),
      },
      body: blob,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload recording: ${response.status}`);
    }
  }

  /**
   * 完成录音
   */
  async completeRecording(recordingId: string, params: {
    durationMs?: number;
    objectKey?: string;
  }): Promise<RecordingStatusResponse> {
    const response = await this.fetch(
      `${API_BASE}/schools/${this.schoolId}/recordings/${recordingId}/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to complete recording' }));
      throw new Error(error.message || `Failed to complete recording: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 获取录音状态
   */
  async getRecordingStatus(recordingId: string): Promise<RecordingStatusResponse> {
    const response = await this.fetch(
      `${API_BASE}/schools/${this.schoolId}/recordings/${recordingId}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to get recording status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 获取录音下载 URL（试听）
   */
  async getRecordingEvidence(recordingId: string): Promise<RecordingEvidenceResponse> {
    const response = await this.fetch(
      `${API_BASE}/schools/${this.schoolId}/recordings/${recordingId}/evidence`,
    );

    if (!response.ok) {
      throw new Error(`Failed to get recording evidence: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 将录音绑定到 AssessmentItem
   */
  async attachRecordingToItem(sessionId: string, itemId: string, recordingId: string): Promise<void> {
    const response = await this.fetch(
      `${API_BASE}/schools/${this.schoolId}/assessments/sessions/${sessionId}/reading/${itemId}/recording`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to attach recording: ${response.status}`);
    }
  }

  private async fetch(url: string, init?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> ?? {}),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return fetch(url, { ...init, headers });
  }
}

// Singleton
export const recordingGateway = new RecordingGateway();