(() => {
  const common = [
    'loading', 'normal', 'empty', 'error', 'offline', 'permission',
    'processing', 'provider-unavailable'
  ];
  const executor = [
    'playing', 'preparing', 'recording', 'reviewing', 'saved-local',
    'uploading', 'upload-failed', 'synced', 'audio-rejected', 'completed'
  ];

  const labels = {
    loading: '加载中',
    normal: '正常',
    empty: '空状态',
    error: '错误',
    offline: '离线',
    permission: '权限不足',
    processing: '处理中',
    'provider-unavailable': '服务不可用',
    playing: '播放中',
    preparing: '准备倒计时',
    recording: '录音中',
    reviewing: '回听检查',
    'saved-local': '已保存在本机',
    uploading: '上传中',
    'upload-failed': '上传失败',
    synced: '已同步',
    'audio-rejected': '音质不合格',
    completed: '当前题已完成'
  };

  const stateCopy = {
    loading: ['正在准备页面内容', '只展示结构骨架，不显示尚未确认的业务数据。'],
    empty: ['当前没有可显示的内容', '这是合法空集合，不会自动填入示例成功数据。'],
    error: ['暂时无法完成这一步', '请按页面提示修复或重试；既有事实保持不变。'],
    offline: ['当前离线', '仅显示已明确保存在本机或最近确认的数据。'],
    permission: ['你无权查看此内容', '请返回练习中心，或重新登录并选择正确学校。'],
    processing: ['证据已提交，正在处理', '可以安全离开，稍后再回来查看。'],
    'provider-unavailable': ['录音已保存，评分服务暂不可用', '不会展示分数；服务恢复后再处理。'],
    playing: ['正在播放示范音频', '播放由学生主动触发，不自动播放。'],
    preparing: ['准备开始', '倒计时结束只表示可以录音，不表示已经录音。'],
    recording: ['正在录音', '录音期间不能切换题目。'],
    reviewing: ['请回听并检查', '当前录音仍可能只在本机。'],
    'saved-local': ['已保存在本机', '尚未同步到服务端；恢复网络后需要上传。'],
    uploading: ['正在上传录音', '上传完成前不能声称已同步。'],
    'upload-failed': ['录音上传失败', '本机副本仍保留，可以重试上传。'],
    synced: ['录音已同步', '服务端已确认接收，可继续下一题。'],
    'audio-rejected': ['这段录音不够清晰', '请调整环境后重录；本次不占重录次数。'],
    completed: ['当前题已完成', '这不等于整次练习已经评分。']
  };

  function statePanel(state, pageId) {
    let copy = stateCopy[state] || stateCopy.error;
    if (pageId === 'S03' && state === 'error') {
      copy = ['麦克风检查未通过', '请允许浏览器使用麦克风，确认系统输入设备后重新检查。网络失败不会阻止开始。'];
    }
    if (pageId === 'S07' && state === 'empty') {
      copy = ['数据不足，暂不生成结论', '证据仍在处理中或缺少必要维度；不会显示 Fixture 中的成功分数。'];
    }
    if (pageId === 'S08' && state === 'empty') {
      copy = ['还没有录音', '完成包含口语题的练习后，属于你的录音会出现在这里。'];
    }
    if (pageId === 'S09' && state === 'empty') {
      copy = ['还没有练习记录', '完成第一次练习后，这里会形成时间路径。'];
    }
    const action = state === 'permission' ? '#/S01?state=normal' : `#/${pageId}?state=normal`;
    return `
      <section class="state-panel state-${state}" role="${state === 'error' ? 'alert' : 'status'}">
        <div class="state-symbol" aria-hidden="true"></div>
        <p class="eyebrow">${labels[state] || state}</p>
        <h2>${copy[0]}</h2>
        <p>${copy[1]}</p>
        <a class="button primary" href="${action}">${state === 'permission' ? '返回练习中心' : '查看正常结构'}</a>
      </section>`;
  }

  window.WF_STATES = { common, executor, labels, statePanel };
})();

