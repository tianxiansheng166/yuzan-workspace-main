(() => {
  'use strict';

  const design = document.querySelector('#player');
  design.classList.add('desktop-mode');

  const recorderEl = document.querySelector('#studentRecorderDesktop');
  const recorder = recorderEl?.__voiceRecorder;
  const desktopComplete = document.querySelector('#desktopComplete');
  const syncCopy = document.querySelector('.sync-state');

  // 录音上传状态
  let uploadState = 'idle'; // idle | uploading | uploaded | error
  let currentRecordingId = null;

  function update(rec) {
    if (!rec) return;
    const finished = rec.state === 'recorded' || rec.state === 'playing';
    const canComplete = rec.state === 'recording' || rec.state === 'paused';
    if (uploadState === 'uploading') {
      desktopComplete.textContent = '正在上传…';
      desktopComplete.disabled = true;
    } else if (finished) {
      desktopComplete.textContent = '完成并继续　›';
      desktopComplete.disabled = false;
    } else if (canComplete) {
      desktopComplete.textContent = '完成当前录音';
      desktopComplete.disabled = false;
    } else {
      desktopComplete.textContent = '请先开始录音';
      desktopComplete.disabled = true;
    }
  }

  /**
   * 将录音上传到后端
   * 流程：initRecording → getRecordingPartUploadUrl → PUT 音频数据 → completeRecording
   */
  async function uploadRecordingToBackend() {
    if (!recorder || !recorder.blob) {
      console.warn('[player] 无录音数据可上传');
      return;
    }

    const schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) return;

    uploadState = 'uploading';
    update(recorder);

    try {
      // 从 URL 获取 assignmentId / enrollmentId
      const params = new URLSearchParams(location.search);
      const assignmentId = params.get('assignmentId') || '';
      const enrollmentId = params.get('enrollmentId') || YuzanDemo.get('student.enrollmentId') || '';

      // 1. 初始化录音
      const initResult = await YuzanApi.initRecording(enrollmentId, 1, {
        submissionId: assignmentId || undefined,
        mimeType: recorder.blob.type || 'audio/webm',
        idempotencyKey: `spring2-${Date.now()}`
      });

      currentRecordingId = initResult.id || initResult.recordingId;

      if (initResult.uploadUrls && initResult.uploadUrls.length > 0) {
        // 2. 获取上传 URL 并上传音频数据
        const uploadInfo = initResult.uploadUrls[0];

        // 直接使用 init 返回的 upload URL
        if (uploadInfo.url) {
          const uploadRes = await fetch(uploadInfo.url, {
            method: 'PUT',
            body: recorder.blob,
            headers: { 'Content-Type': recorder.blob.type || 'audio/webm' }
          });
          if (!uploadRes.ok) {
            throw new Error(`上传失败 (${uploadRes.status})`);
          }
        }
      } else if (currentRecordingId) {
        // 如果 init 没有返回 upload URL，使用单独的 upload-url 接口
        const partResult = await YuzanApi.getRecordingPartUploadUrl(currentRecordingId, 1);
        const uploadUrl = partResult.url || partResult.uploadUrl;
        if (uploadUrl) {
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: recorder.blob,
            headers: { 'Content-Type': recorder.blob.type || 'audio/webm' }
          });
          if (!uploadRes.ok) {
            throw new Error(`上传失败 (${uploadRes.status})`);
          }
        }
      }

      // 3. 完成录音
      if (currentRecordingId) {
        await YuzanApi.completeRecording(currentRecordingId, {
          durationMs: Math.round(recorder.elapsedMs)
        });
      }

      uploadState = 'uploaded';

      // 调用真实学习进度API
      const activityId = params.get('activityId') || '';
      if (activityId && enrollmentId) {
        try {
          await YuzanApi.updateLearningProgress(activityId, {
            enrollmentId,
            position: 100,
            completed: true,
          });
        } catch (progressErr) {
          console.warn('[player] 学习进度更新失败:', progressErr);
          // 不阻塞上传流程
        }
      }

      // 更新本地同步状态
      if (recorder.setSync) recorder.setSync('synced');

      // 触发自定义同步事件
      document.dispatchEvent(new CustomEvent('recorder:sync', { detail: { state: 'synced' } }));
      YuzanDemo.toast('录音已安全同步到服务器', 'success');

    } catch (err) {
      console.error('[player] 录音上传失败:', err);
      uploadState = 'error';

      // 回退到本地标记
      if (recorder.setSync) recorder.setSync('local');
      document.dispatchEvent(new CustomEvent('recorder:sync', { detail: { state: 'local' } }));
      YuzanDemo.toast(err.message || '录音上传失败，已保存在本机', 'warning');
    }

    update(recorder);
  }

  async function completeOrContinue() {
    if (!recorder) return;
    if (recorder.state === 'recorded' || recorder.state === 'playing') {
      // 如果还没上传，先尝试上传
      if (uploadState !== 'uploaded') {
        await uploadRecordingToBackend();
      }
      location.href = '/student/growth';
      return;
    }
    const ok = await recorder.complete();
    if (ok) {
      update(recorder);
      YuzanDemo.toast('录音已安全保存，可进入下一步', 'success');
      // 录音完成后自动上传
      uploadRecordingToBackend();
    }
  }

  desktopComplete.addEventListener('click', completeOrContinue);

  if (syncCopy) {
    document.addEventListener('recorder:sync', e => {
      const state = e.detail.state;
      const text = state === 'synced' ? '已安全同步' : state === 'syncing' ? '正在同步…' : '已保存在本机，等待同步';
      const span = syncCopy.querySelector('span'); if (span) span.textContent = text;
      const b = syncCopy.querySelector('b'); if (b) b.textContent = state === 'synced' ? '已安全同步' : '已保存在本机';
    });
  }
  document.addEventListener('recorder:state', e => update(e.detail.recorder));
  document.addEventListener('recorder:complete', e => {
    update(e.detail.recorder);
    // 录音完成后自动触发上传
    uploadRecordingToBackend();
  });
  document.addEventListener('recorder:reset', e => {
    uploadState = 'idle';
    currentRecordingId = null;
    update(e.detail.recorder);
  });
  document.addEventListener('recorder:pause', e => update(e.detail.recorder));
  document.addEventListener('recorder:resume', e => update(e.detail.recorder));

  setTimeout(() => {
    update(recorder);
  }, 100);
})();