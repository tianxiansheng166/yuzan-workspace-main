(() => {
  'use strict';

  const listEl = document.querySelector('#queueList');
  const statusEl = document.querySelector('#queueStatus');
  const refreshButton = document.querySelector('#refreshQueue');
  let schoolId = '';

  function readItems(payload) {
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  function formatTime(value) {
    if (!value) return '提交时间未记录';
    const time = new Date(value);
    return Number.isNaN(time.getTime()) ? '提交时间格式不可识别' : time.toLocaleString('zh-CN');
  }

  function statusLabel(status) {
    if (status === 'NEEDS_REVIEW') return '待教师复核';
    if (status === 'SUBMITTED') return '已提交';
    return status || '状态未知';
  }

  function setStatus(message, tone) {
    statusEl.textContent = message;
    if (tone) statusEl.dataset.tone = tone;
    else delete statusEl.dataset.tone;
  }

  function openSubmission(submissionId, button) {
    if (!submissionId) return;
    button.disabled = true;
    location.href = `/teacher/submissions/${encodeURIComponent(submissionId)}`;
  }

  function renderSubmissions(submissions) {
    listEl.replaceChildren();
    submissions.forEach((submission) => {
      const card = document.createElement('article');
      card.className = 'submission-card';

      const copy = document.createElement('div');
      const title = document.createElement('h2');
      title.textContent = submission.assignmentTitle || '未命名教学任务';
      const pill = document.createElement('span');
      pill.className = 'status-pill';
      pill.textContent = statusLabel(submission.status);
      title.appendChild(pill);

      const student = document.createElement('p');
      student.textContent = `学生：${submission.enrollmentId || '未返回学生标识'} · ${formatTime(submission.submittedAt)}`;
      const identifier = document.createElement('p');
      identifier.append('提交 ID：');
      const code = document.createElement('code');
      code.textContent = submission.id;
      identifier.appendChild(code);
      copy.append(title, student, identifier);

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '查看真实证据';
      button.addEventListener('click', () => openSubmission(submission.id, button));
      card.append(copy, button);
      listEl.appendChild(card);
    });
  }

  async function loadQueue() {
    refreshButton.disabled = true;
    listEl.setAttribute('aria-busy', 'true');
    listEl.replaceChildren();
    setStatus('正在读取任务与提交…');
    try {
      const assignmentPayload = await YuzanApi.request(`/schools/${schoolId}/assignments?limit=100`, { method: 'GET' });
      const assignments = readItems(assignmentPayload).filter((item) => item?.id);
      if (assignments.length === 0) {
        setStatus('当前学校没有真实教学任务，因此没有可复核提交。', 'empty');
        return;
      }

      const results = await Promise.allSettled(assignments.map(async (assignment) => {
        const payload = await YuzanApi.request(
          `/schools/${schoolId}/assignments/${encodeURIComponent(assignment.id)}/submissions?limit=100`,
          { method: 'GET' },
        );
        return readItems(payload).map((submission) => ({
          ...submission,
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
        }));
      }));

      const failures = results.filter((result) => result.status === 'rejected');
      const submissions = results
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value)
        .filter((submission) => submission.id && ['NEEDS_REVIEW', 'SUBMITTED'].includes(submission.status))
        .sort((left, right) => {
          const leftRank = left.status === 'NEEDS_REVIEW' ? 0 : 1;
          const rightRank = right.status === 'NEEDS_REVIEW' ? 0 : 1;
          if (leftRank !== rightRank) return leftRank - rightRank;
          return String(right.submittedAt || '').localeCompare(String(left.submittedAt || ''));
        });

      if (submissions.length === 0) {
        if (failures.length === assignments.length) {
          throw failures[0].reason;
        }
        setStatus(
          failures.length
            ? `已读取 ${assignments.length - failures.length} 个任务，另有 ${failures.length} 个任务加载失败；当前没有可确认的待复核提交。`
            : '当前没有待复核的真实学生提交。',
          failures.length ? 'partial' : 'empty',
        );
        return;
      }

      setStatus(
        failures.length
          ? `已加载 ${submissions.length} 份真实提交；${failures.length} 个任务加载失败，队列可能不完整。`
          : `已加载 ${submissions.length} 份真实提交。`,
        failures.length ? 'partial' : '',
      );
      renderSubmissions(submissions);
    } catch (err) {
      setStatus(`复核队列加载失败：${err?.message || '未知错误'}。页面不会展示演示提交。`, 'error');
    } finally {
      refreshButton.disabled = false;
      listEl.setAttribute('aria-busy', 'false');
    }
  }

  function init() {
    if (typeof YuzanApi === 'undefined' || !YuzanApi.getToken()) {
      location.href = '/login';
      return;
    }
    schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) {
      location.href = '/select-school';
      return;
    }
    refreshButton.addEventListener('click', loadQueue);
    loadQueue();
  }

  init();
})();
