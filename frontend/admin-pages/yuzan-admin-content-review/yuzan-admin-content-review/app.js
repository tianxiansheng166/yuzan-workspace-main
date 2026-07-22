let queueCards = [...document.querySelectorAll('.queue-card')];
let currentReviewId = null;
const titleEl = document.getElementById('articleTitle');
const riskEl = document.getElementById('articleRisk');
const submitterEl = document.getElementById('articleSubmitter');
const versionEl = document.getElementById('articleVersion');
const targetEl = document.getElementById('articleTarget');
const queueFilterBtn = document.getElementById('queueFilterBtn');
const queuePopover = document.getElementById('queuePopover');
const tabs = [...document.querySelectorAll('.evidence-tab')];
const panes = [...document.querySelectorAll('.evidence-pane')];
const tocSubs = [...document.querySelectorAll('.toc-subnode')];
const feedbackItems = [...document.querySelectorAll('.feedback-item')];
const collapseBtn = document.getElementById('collapseFeedbackBtn');
const feedbackPanel = document.getElementById('feedbackPanel');
const modal = document.getElementById('actionModal');
const modalTitle = document.getElementById('modalTitle');
const modalText = document.getElementById('modalText');
const modalClose = document.querySelector('.modal-close');

function bindQueueCards() {
  queueCards.forEach(card => card.addEventListener('click', () => {
    queueCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    currentReviewId = card.dataset.id || null;
    titleEl.textContent = card.dataset.title;
    riskEl.textContent = card.dataset.risk || '待评估';
    submitterEl.textContent = card.dataset.submitter || '—';
    versionEl.textContent = card.dataset.version || '—';
    targetEl.textContent = card.dataset.target || '—';
    riskEl.classList.toggle('danger', (card.dataset.risk || '').includes('高'));
  }));
}
bindQueueCards();

queueFilterBtn.addEventListener('click', () => {
  queuePopover.hidden = !queuePopover.hidden;
});
document.addEventListener('click', e => {
  if (!queueFilterBtn.contains(e.target) && !queuePopover.contains(e.target)) queuePopover.hidden = true;
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const pane = document.getElementById(`pane-${tab.dataset.tab}`);
    if (pane) pane.classList.add('active');
  });
});

function highlightFeedback(key) {
  feedbackItems.forEach(item => item.classList.toggle('highlight', item.dataset.feedback === key));
  const target = document.querySelector(`.feedback-item[data-feedback="${key}"]`);
  if (target) target.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

function setActiveToc(el) {
  tocSubs.forEach(btn => btn.classList.remove('active'));
  el.classList.add('active');
}

tocSubs.forEach(btn => {
  btn.addEventListener('click', () => {
    setActiveToc(btn);
    const key = btn.dataset.highlight;
    if (key) highlightFeedback(key);
  });
});

feedbackItems.forEach(item => {
  item.querySelectorAll('.option').forEach(option => {
    option.addEventListener('click', () => {
      item.querySelectorAll('.option').forEach(o => o.classList.remove('active'));
      option.classList.add('active');
    });
  });
});

collapseBtn.addEventListener('click', () => {
  const collapsed = feedbackPanel.classList.toggle('compact');
  feedbackPanel.querySelector('.feedback-list').hidden = collapsed;
  feedbackPanel.querySelector('.overall-risk').hidden = collapsed;
  collapseBtn.textContent = collapsed ? '展开' : '收起';
});

let selectedAction = null;
document.querySelectorAll('[data-action]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    selectedAction = action;
    const dict = {
      approve: ['批准课程版本', '批准后会更新课程版本状态，并写入审核人与审计记录。'],
      return: ['退回课程版本', '退回必须填写原因，提交后版本将回到草稿修订状态。'],
      supplement: ['要求补充证据', '请填写需要补充的版权、来源或合规证明。']
    };
    modalTitle.textContent = dict[action][0];
    modalText.textContent = dict[action][1];
    modal.hidden = false;
  });
});

modalClose.addEventListener('click', () => modal.hidden = true);
modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

async function loadReviewQueue() {
  try {
    const result = await window.YuzanApi.listAdminContentReviewQueue({ status: 'IN_REVIEW', limit: 100 });
    const items = result.items || [];
    const list = document.querySelector('.queue-list');
    list.innerHTML = items.length ? items.map((item) => `<button class="queue-card" data-id="${item.id}" data-title="${String(item.title || '').replace(/"/g, '&quot;')}" data-risk="待评估" data-submitter="${item.schoolId || '—'}" data-target="${item.gradeBand || '—'}" data-version="v${item.version || '—'}"><div class="queue-top"><span class="risk mid">待评估</span><span class="deadline">${item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('zh-CN') : '—'}</span><span class="state-pill wait">待审核</span></div><strong>${String(item.title || '未命名课程').replace(/[&<>]/g, '')}</strong><small>${String(item.description || '等待审核').replace(/[&<>]/g, '')}</small></button>`).join('') : '<div class="queue-empty">暂无待审核内容</div>';
    queueCards = [...document.querySelectorAll('.queue-card')];
    bindQueueCards();
    const count = document.querySelector('.status-tab');
    if (count) count.innerHTML = `待审核 <span>${items.length}</span>`;
    if (queueCards[0]) queueCards[0].click();
  } catch (error) {
    const list = document.querySelector('.queue-list');
    list.innerHTML = `<div class="queue-empty">${String(error?.message || '审核队列加载失败').replace(/[&<>]/g, '')}</div>`;
  }
}

modal.querySelector('.modal-close')?.addEventListener('click', async () => {
  if (!currentReviewId || !selectedAction) { modal.hidden = true; return; }
  const decision = selectedAction === 'approve' ? 'APPROVE' : selectedAction === 'return' ? 'RETURN' : 'SUPPLEMENT';
  try {
    await window.YuzanApi.decideAdminContentReview(currentReviewId, { decision, comment: selectedAction === 'approve' ? undefined : '请补充可核验的来源或版权证据' });
    modal.hidden = true;
    await loadReviewQueue();
  } catch (error) {
    modalText.textContent = error?.message || '审核提交失败';
  }
});
loadReviewQueue();
