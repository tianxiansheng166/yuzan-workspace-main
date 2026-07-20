const groups = [
  {
    key: 'today',
    label: '今天',
    icon: 'i-star-outline',
    tasks: [
      {
        cover: 'assets/task-read.png',
        chipText: '阅读',
        chipClass: 'read',
        title: '高原上的春天',
        subject: '语文 · 六年级下册',
        durationLabel: '预计用时',
        duration: '20 分钟',
        standardLabel: '完成标准',
        standard: '朗读流利，理解内容，完成思考题',
        deadlineLabel: '截止时间',
        deadline: '今天 20:00',
        deadlineClass: 'hot',
        stateType: 'radio',
        stateText: '未开始',
        cta: '去完成'
      }
    ]
  },
  {
    key: 'week',
    label: '本周',
    icon: 'i-star-outline',
    tasks: [
      {
        cover: 'assets/task-write.png', chipText: '写作', chipClass: 'write', title: '把句子读出画面感', subject: '朗读技巧',
        durationLabel: '预计用时', duration: '15 分钟', standardLabel: '完成标准', standard: '仿写 1 段话，读出画面感', deadlineLabel: '截止时间', deadline: '5月25日（周日）', deadlineClass: 'warn', stateType: 'file', stateText: '草稿本地保存'
      },
      {
        cover: 'assets/task-study.png', chipText: '学习', chipClass: 'study', title: '声母的母基础练习', subject: '发音基础',
        durationLabel: '预计用时', duration: '10 分钟', standardLabel: '完成标准', standard: '正确认读并录音通过', deadlineLabel: '截止时间', deadline: '5月25日（周日）', deadlineClass: 'warn', stateType: 'cloud', stateText: '待同步'
      },
      {
        cover: 'assets/task-test.png', chipText: '测评', chipClass: 'test', title: '课文朗读测评', subject: '第3单元',
        durationLabel: '预计用时', duration: '10 分钟', standardLabel: '完成标准', standard: '达到 80 分及以上', deadlineLabel: '截止时间', deadline: '5月26日（周一）', deadlineClass: 'warn', stateType: 'radio', stateText: '未开始'
      },
      {
        cover: 'assets/task-study.png', chipText: '学习', chipClass: 'study', title: '字词巩固小练', subject: '基础巩固',
        durationLabel: '预计用时', duration: '8 分钟', standardLabel: '完成标准', standard: '完成 10 道题并订正', deadlineLabel: '截止时间', deadline: '5月27日（周二）', deadlineClass: 'warn', stateType: 'done', stateText: '已完成', hidden: true
      }
    ]
  },
  {
    key: 'later',
    label: '之后',
    icon: 'i-star-outline',
    tasks: [
      {
        cover: 'assets/task-later.png', chipText: '写作', chipClass: 'write', title: '情感的声音：喜与忧', subject: '表达提升',
        durationLabel: '预计用时', duration: '20 分钟', standardLabel: '完成标准', standard: '写一段话，表达情感体会', deadlineLabel: '截止时间', deadline: '5月29日（周四）', deadlineClass: '', stateType: 'radio', stateText: '未开始'
      }
    ]
  }
];

const taskGroupsEl = document.getElementById('taskGroups');
const expandBtn = document.getElementById('expandBtn');
const toast = document.getElementById('toast');
const refreshBtn = document.getElementById('refreshBtn');
const timelinePanel = document.querySelector('.timeline-panel');

function stateIcon(type) {
  if (type === 'file') return 'i-file';
  if (type === 'cloud') return 'i-cloud';
  if (type === 'done') return 'i-check-circle';
  return 'i-radio';
}

function stateClass(type) {
  if (type === 'done') return 'done';
  if (type === 'cloud') return 'waiting';
  return '';
}

function renderGroups() {
  taskGroupsEl.innerHTML = groups.map(group => {
    const isToday = group.key === 'today';
    return `
      <section class="task-group ${group.key}">
        <div class="task-group-label">
          <span class="label-icon"><svg><use href="#${group.icon}"/></svg></span>
          <span>${group.label}</span>
        </div>
        <div class="task-stack panel">
          ${group.tasks.map(task => `
            <article class="task-row ${isToday ? 'large' : ''} ${task.hidden ? 'hidden-task' : ''}" data-title="${task.title}">
              <div class="task-cover">
                <img src="${task.cover}" alt="${task.title} 插图" />
                <span class="cover-chip ${task.chipClass}">${task.chipText}</span>
              </div>
              <div class="task-brief">
                <h4>${task.title}</h4>
                <p>${task.subject}</p>
              </div>
              <div class="task-meta">
                <strong>${task.durationLabel}</strong>
                <div class="value">${task.duration}</div>
              </div>
              <div class="task-detail">
                <strong>${task.standardLabel}</strong>
                <div class="value">${task.standard}</div>
              </div>
              <div class="task-deadline">
                <strong>${task.deadlineLabel}</strong>
                <div class="date ${task.deadlineClass || ''}">${task.deadline}</div>
              </div>
              <div class="task-status ${stateClass(task.stateType)}">
                <svg><use href="#${stateIcon(task.stateType)}"/></svg>
                <span class="state-text">${task.stateText}</span>
              </div>
              ${task.cta ? `<button class="outline-pill" data-toast="进入任务：${task.title}">${task.cta}</button>` : ''}
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function bindToasts() {
  document.querySelectorAll('[data-toast]').forEach(el => {
    el.addEventListener('click', () => showToast(el.dataset.toast));
  });
}

let toastTimer;
function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1700);
}

function bindExpand() {
  expandBtn.addEventListener('click', () => {
    timelinePanel.classList.toggle('expanded');
    showToast(timelinePanel.classList.contains('expanded') ? '已展开更多任务' : '已收起扩展任务');
  });
}

function bindRefresh() {
  refreshBtn.addEventListener('click', () => {
    const syncNode = document.querySelector('[data-count="sync"]');
    const doneNode = document.querySelector('[data-count="done"]');
    const draftNode = document.querySelector('[data-count="draft"]');
    syncNode.textContent = '0 个';
    doneNode.textContent = '4 个';
    draftNode.textContent = '1 个';
    showToast('本地状态已刷新');
  });
}

function bindRowHover() {
  document.querySelectorAll('.task-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      showToast(`已查看：${row.dataset.title}`);
    });
  });
}

renderGroups();
bindToasts();
bindExpand();
bindRefresh();
bindRowHover();
