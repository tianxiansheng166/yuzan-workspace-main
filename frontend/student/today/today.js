(() => {
  'use strict';

  const dateEl = document.querySelector('#todayDate');
  if (dateEl) {
    const now = new Date();
    const weekdays = '日一二三四五六';
    dateEl.textContent = `${now.getMonth()+1}月${now.getDate()}日　星期${weekdays[now.getDay()]}　▣`;
  }

  const wave = document.querySelector('#todayWave');
  if (wave) {
    wave.innerHTML = Array.from({length:54},(_,i)=>`<i style="--i:${i};--h:${12 + Math.round(Math.abs(Math.sin(i*.41))*37 + Math.abs(Math.sin(i*.13))*14)}px"></i>`).join('');
  }

  const preview = document.querySelector('#previewAudio');
  let previewPlaying = false;
  preview?.addEventListener('click', () => {
    previewPlaying = !previewPlaying;
    preview.textContent = previewPlaying ? 'Ⅱ' : '▶';
    preview.setAttribute('aria-label', previewPlaying ? '暂停范读' : '播放范读');
    document.querySelector('.course-card')?.classList.toggle('playing', previewPlaying);
    YuzanDemo.toast(previewPlaying ? '正在播放范读示例' : '范读已暂停');
  });

  document.querySelectorAll('.resource-item').forEach(button => {
    button.addEventListener('click', () => {
      const cached = button.classList.toggle('cached');
      const size = button.querySelector('span').textContent.replace(/[　✓↓]/g,'').trim();
      button.querySelector('span').textContent = cached ? `${size}　✓` : `${size}　↓`;
      YuzanDemo.toast(`${button.dataset.resource}${cached ? '已缓存到本机' : '已移出离线缓存'}`, cached ? 'success' : 'default');
      const all = [...document.querySelectorAll('.resource-item')].every(x=>x.classList.contains('cached'));
      document.querySelector('#cacheState').textContent = all ? '已缓存' : '部分缓存';
    });
    button.classList.add('cached');
  });

  document.querySelector('#networkStatus')?.addEventListener('click', () => {
    const text = navigator.onLine ? '当前在线，学习记录会自动同步。' : '当前离线，所有学习记录会先保存在本机。';
    YuzanDemo.toast(text, navigator.onLine ? 'success' : 'warning');
  });

  async function init() {
    if (!YuzanApi.getToken()) {
      YuzanDemo.toast('请先登录', 'warning');
      location.href = '/login';
      return;
    }

    const schoolId = YuzanApi.getActiveSchoolId();
    if (!schoolId) {
      YuzanDemo.toast('请先选择学校', 'warning');
      location.href = '/select-school';
      return;
    }

    try {
      // 优先使用新的 student/today API，回退到 learning/tasks
      let taskList = [];
      try {
        const todayData = await YuzanApi.getStudentToday();
        taskList = todayData?.tasks || [];
      } catch {
        const tasks = await YuzanApi.request(`/schools/${schoolId}/learning/tasks`);
        taskList = Array.isArray(tasks) ? tasks : (tasks?.items || []);
      }
      renderTasks(taskList);
    } catch (err) {
      YuzanDemo.toast(err.message || '加载学习任务失败', 'error');
    }
  }

  function renderTasks(tasks) {
    const courseTitleEl = document.querySelector('.course-card b');
    const taskTitleEl = document.querySelector('.task-content h2');
    const enterBtn = document.querySelector('.task-card .enter');

    if (tasks.length === 0) {
      if (taskTitleEl) taskTitleEl.textContent = '今日暂无学习任务';
      if (enterBtn) {
        enterBtn.textContent = '◉　暂无任务';
        enterBtn.disabled = true;
      }
      return;
    }

    const task = tasks[0];
    if (courseTitleEl) courseTitleEl.textContent = task.courseTitle || '高原上的春天';
    if (taskTitleEl) taskTitleEl.textContent = task.title || '朗读课文，注意语音语调和停顿';
    if (enterBtn) {
      enterBtn.disabled = false;
      enterBtn.textContent = '◉　进入朗读任务　→';
      enterBtn.setAttribute('data-nav', `/student/learn/spring-2?assignmentId=${encodeURIComponent(task.assignmentId)}`);
      enterBtn.onclick = () => {
        location.href = `/student/learn/spring-2?assignmentId=${encodeURIComponent(task.assignmentId)}`;
      };
    }
  }

  const progress = Number(YuzanApi.getStoredUser()?.progress || YuzanDemo.get('student.courseProgress') || 42);
  document.documentElement.style.setProperty('--course-progress', `${progress}%`);

  init();
})();
