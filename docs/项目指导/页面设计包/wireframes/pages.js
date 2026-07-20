(() => {
  const pageMeta = [
    ['S01', '练习与测评中心', '/student/practices', 'PARTIAL'],
    ['S02', '练习详情', '/student/practices/{practiceDefinitionId}', 'PROPOSED'],
    ['S03', '准备与设备检查', '/student/practices/{practiceDefinitionId}/start', 'PARTIAL'],
    ['S04', '通用练习执行器', '/student/practices/run/{attemptId}', 'PARTIAL'],
    ['S05', '提交前检查', '/student/practices/run/{attemptId}/review', 'PARTIAL'],
    ['S06', '评分处理中', '/student/practices/run/{attemptId}/processing', 'PARTIAL'],
    ['S07', '正式报告', '/student/reports/{attemptId}', 'BLOCKED'],
    ['S08', '我的录音', '/student/recordings?attemptId={attemptId}', 'BLOCKED'],
    ['S09', '历史记录', '/student/history', 'PARTIAL']
  ].map(([id, name, route, status], index) => ({ id, name, route, status, index }));

  const types = [
    'LISTEN_ONLY', 'LISTEN_REPEAT', 'READ_ALOUD', 'LISTEN_RETELL',
    'LISTEN_ANSWER', 'SINGLE_CHOICE', 'FILL_BLANK', 'SHORT_ANSWER',
    'MULTIPLE_CHOICE'
  ];

  const typeLabels = {
    LISTEN_ONLY: '示范听辨',
    LISTEN_REPEAT: '听后跟读',
    READ_ALOUD: '看文朗读',
    LISTEN_RETELL: '听后复述',
    LISTEN_ANSWER: '听后作答',
    SINGLE_CHOICE: '单项选择',
    FILL_BLANK: '填空',
    SHORT_ANSWER: '简答',
    MULTIPLE_CHOICE: '多项选择'
  };

  const apiNotes = {
    S01: ['身份 CURRENT', '练习列表 PARTIAL', '继续入口 PARTIAL'],
    S02: ['PracticeDefinition PROPOSED', 'PracticeVersion PARTIAL', 'Delivery PARTIAL'],
    S03: ['Attempt 创建 PARTIAL', '设备检查 PARTIAL', '状态迁移 PARTIAL'],
    S04: ['书面保存 CURRENT', 'Recording 原子动作 CURRENT', '统一执行聚合 PARTIAL'],
    S05: ['提交 PARTIAL', '完整性聚合 PARTIAL'],
    S06: ['SpeechJob 查询 CURRENT', '处理进度聚合 PARTIAL'],
    S07: ['正式报告 BLOCKED', 'Review PARTIAL', '复测/巩固 PARTIAL'],
    S08: ['单条状态 CURRENT', '本人列表/播放 BLOCKED'],
    S09: ['历史事件 PARTIAL', '8维趋势 PARTIAL']
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));

  const fmtDate = (value) => value ? new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value)) : '无截止';
  const statusText = (value) => ({
    PASS: '通过',
    LOCAL_ONLY: '仅保存在本机',
    FAIL: '未通过',
    UPLOADED: '已上传',
    FINALIZED: '处理完成'
  }[value] || value);

  const pageHeader = (meta, fx, subtitle) => `
    <div class="breadcrumb">练习与测评 / ${esc(fx.practiceDefinition.title)} / ${meta.name}</div>
    <div class="page-heading">
      <div><p class="eyebrow">${esc(subtitle)}</p><h1>${meta.name}</h1></div>
    </div>`;

  const steps = (active) => `
    <ol class="flow-steps" aria-label="黄金闭环页面进度">
      ${pageMeta.map((p) => `<li class="${p.id === active ? 'active' : ''}"><a href="#/${p.id}?state=normal"><span>${p.id}</span>${p.name}</a></li>`).join('')}
    </ol>`;

  const designPanel = (meta, refs) => `
    <details class="design-panel">
      <summary>设计检查面板（接口与页面关系）</summary>
      <dl>
        <div><dt>目标路由</dt><dd>${esc(meta.route)}</dd></div>
        <div><dt>前后页面</dt><dd>${meta.index > 0 ? pageMeta[meta.index - 1].id : '学生首页'} → ${meta.id} → ${meta.index < pageMeta.length - 1 ? pageMeta[meta.index + 1].id : '练习中心/报告'}</dd></div>
        <div><dt>Fixture 引用</dt><dd>${esc(refs.join('、'))}</dd></div>
        <div><dt>接口事实</dt><dd>${apiNotes[meta.id].map((x) => `<span class="api-note">${esc(x)}</span>`).join(' ')}</dd></div>
        <div><dt>正式实现</dt><dd>${meta.status === 'CURRENT' ? '可按现有原子语义接入' : '需先补齐 02 绑定表中的契约/安全/评分缺口'}</dd></div>
      </dl>
    </details>`;

  const shell = (meta, fx, body, refs, subtitle) => `
    <article class="page-shell page-${meta.id.toLowerCase()}">
      ${pageHeader(meta, fx, subtitle)}
      ${body}
      ${designPanel(meta, refs)}
    </article>`;

  function renderS01(meta, fx) {
    const assignment = fx.practiceDeliveries.find((d) => d.mode === 'ASSIGNMENT');
    const self = fx.practiceDeliveries.find((d) => d.mode === 'SELF_PRACTICE');
    const latest = fx.historyEvents[0];
    return shell(meta, fx, `
      <section class="hero-path">
        <div>
          <p class="eyebrow">现在最值得完成</p>
          <h2>${esc(fx.practiceDefinition.title)}</h2>
          <p>${esc(fx.practiceDefinition.summary)}</p>
          <div class="action-row">
            <a class="button primary" href="#/S02?state=normal">开始作业</a>
            <a class="button secondary" href="#/S04?type=READ_ALOUD&state=normal">继续上次</a>
          </div>
        </div>
        <div class="path-summary" aria-label="作业摘要">
          <strong>约 ${fx.practiceDefinition.estimatedDurationMinutes} 分钟</strong>
          <span>截止 ${fmtDate(assignment.dueAt)}</span>
          <span>${fx.practiceVersion.sections.length} 个环节</span>
        </div>
      </section>
      <div class="two-column">
        <section class="plain-section"><p class="eyebrow">自主练习</p><h2>同一训练，可按自己的节奏巩固</h2><p>无截止；完成记录仍进入历史。</p><a class="text-link" href="#/S02?state=normal">自主练习</a></section>
        <section class="plain-section"><p class="eyebrow">最近完成</p><h2>${latest.totalScore} 分</h2><p>${esc(latest.practiceTitle)} · ${fmtDate(latest.occurredAt)}</p><a class="text-link" href="#/S09?state=normal">查看历史</a></section>
      </div>`, ['student', 'practiceDeliveries', 'attempt', 'historyEvents'], `${fx.student.name} · ${fx.class.name}`);
  }

  function renderS02(meta, fx) {
    const delivery = fx.practiceDeliveries.find((d) => d.mode === 'ASSIGNMENT');
    return shell(meta, fx, `
      <div class="editorial-layout">
        <section class="reading-column">
          <p class="lead">${esc(fx.practiceDefinition.summary)}</p>
          <h2>你将完成五个连续环节</h2>
          <ol class="section-index">${fx.practiceVersion.sections.map((s) => `<li><span>${s.order}</span><div><strong>${esc(s.title)}</strong><p>${esc(s.instruction)}</p></div></li>`).join('')}</ol>
        </section>
        <aside class="summary-column">
          <dl class="summary-list">
            <div><dt>预计时间</dt><dd>${fx.practiceDefinition.estimatedDurationMinutes} 分钟</dd></div>
            <div><dt>难度</dt><dd>中等</dd></div>
            <div><dt>模式</dt><dd>教师布置</dd></div>
            <div><dt>截止</dt><dd>${fmtDate(delivery.dueAt)}</dd></div>
          </dl>
          <details><summary>结果将如何使用</summary><p>录音和作答形成证据，机器建议需可复核；教师反馈与报告共同指向下一步练习。</p></details>
          <details><summary>设备要求</summary><p>需要电脑或平板、可用麦克风与扬声器；弱网可本地保存。</p></details>
          <a class="button primary full" href="#/S03?state=normal">开始练习</a>
          <a class="text-link center" href="#/S01?state=normal">返回</a>
        </aside>
      </div>`, ['practiceDefinition', 'practiceVersion', 'practiceDeliveries[0]'], '训练目标与完成方式');
  }

  function renderS03(meta, fx) {
    const checks = Object.entries(fx.attempt.deviceCheck);
    return shell(meta, fx, `
      <div class="device-warning"><strong>手机结构预览</strong><span>正式练习请使用电脑或平板完成。</span></div>
      <section class="device-loop">
        <div><p class="eyebrow">起点检查</p><h2>确认声音可以听见，也可以被清楚记录</h2><p>网络失败进入本地模式，不阻止练习；其余三项失败会阻止开始。</p></div>
        <ol class="check-list">${checks.map(([key, item], index) => `<li><span class="check-index">${index + 1}</span><div><strong>${({browser:'浏览器',microphone:'麦克风',speaker:'扬声器',network:'网络'})[key]}</strong><p>${esc(item.detail)}</p></div><span class="check-status">${statusText(item.status)}</span><button type="button">重新检查</button></li>`).join('')}</ol>
        <div class="action-row"><button class="button secondary" type="button">开始设备检查</button><a class="button primary" href="#/S04?type=LISTEN_ONLY&state=normal">进入练习</a></div>
      </section>`, ['attempt', 'attempt.deviceCheck', 'practiceVersion'], '声音回路与开始条件');
  }

  function findItem(fx, type) {
    for (const section of fx.practiceVersion.sections) {
      const item = section.itemRefs.find((entry) => entry.itemType === type);
      if (item) return { item, section };
    }
    return null;
  }

  function taskArea(fx, type) {
    const found = findItem(fx, type);
    if (!found) {
      return `<section class="task-empty"><p class="eyebrow">${typeLabels[type]}</p><h2>当前设计 Fixture 无此题型实例</h2><p>统一外壳支持该类型切换，但不会编造题干、答案、时长或成绩。</p></section>`;
    }
    const { item, section } = found;
    if (type === 'LISTEN_ONLY') {
      return `<section class="task-focus"><p class="eyebrow">${esc(section.title)}</p><h2>${esc(item.title)}</h2><div class="wave-placeholder" aria-label="示范音频结构占位"></div><p>可播放 ${item.playCount} 次 · 不自动播放</p><button class="record-control" type="button">播放示范</button></section>`;
    }
    if (['LISTEN_REPEAT','READ_ALOUD','LISTEN_RETELL'].includes(type)) {
      return `<section class="task-focus"><p class="eyebrow">${esc(section.title)}</p><h2>${esc(item.title)}</h2>${item.showText ? `<blockquote>${esc(item.targetText)}</blockquote>` : '<p class="hidden-text-note">本题不显示目标文本，请按听到的内容完成。</p>'}<div class="wave-placeholder" aria-label="录音声波结构占位"></div><p>准备 ${item.prepareSeconds || 0} 秒 · 最长 ${item.recordSeconds} 秒 · 重录 ${item.reRecordLimit} 次</p><button class="record-control" type="button">开始录音</button></section>`;
    }
    if (['SINGLE_CHOICE','MULTIPLE_CHOICE'].includes(type)) {
      const inputType = type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox';
      return `<section class="task-focus"><p class="eyebrow">${esc(section.title)}</p><h2>${esc(item.stem)}</h2><fieldset><legend class="sr-only">${esc(item.title)}</legend>${item.options.map((opt) => `<label class="option"><input type="${inputType}" name="answer" value="${esc(opt.key)}"><span>${esc(opt.key)}. ${esc(opt.text)}</span></label>`).join('')}</fieldset><button class="button primary" type="button">保存答案</button></section>`;
    }
    return `<section class="task-focus"><p class="eyebrow">${esc(section.title)}</p><h2>${esc(item.title)}</h2><label class="answer-field"><span>${esc(item.stem)}</span><textarea maxlength="50" rows="4">${esc(fx.attempt.itemAttempts.find((a) => a.itemRefId === item.itemRefId)?.writtenAnswer?.text || '')}</textarea></label><button class="button primary" type="button">保存答案</button></section>`;
  }

  function renderS04(meta, fx, type, state) {
    const found = findItem(fx, type);
    const section = found?.section || fx.practiceVersion.sections[0];
    const allItems = fx.practiceVersion.sections.flatMap((s) => s.itemRefs);
    const itemIndex = found ? allItems.findIndex((i) => i.itemRefId === found.item.itemRefId) + 1 : '—';
    return shell(meta, fx, `
      <div class="device-warning"><strong>手机结构预览</strong><span>正式练习请使用电脑或平板完成；手机不启用录音控件。</span></div>
      <section class="executor-shell">
        <header class="executor-header"><div><strong>${esc(fx.practiceDefinition.title)}</strong><span>${esc(section.title)} · 题 ${itemIndex}/${allItems.length}</span></div><div><span class="sync-chip">${window.WF_STATES.labels[state] || '已同步'}</span><span>网络：在线</span><a href="#/S01?state=normal">临时退出</a></div></header>
        <div class="section-progress" aria-label="Section 进度">${fx.practiceVersion.sections.map((s) => `<span class="${s.sectionId === section.sectionId ? 'active' : ''}">${s.order}. ${esc(s.title)}</span>`).join('')}</div>
        ${taskArea(fx, type)}
        <footer class="executor-footer"><button class="button secondary" type="button">上一题</button><button type="button">必要帮助</button><a class="button primary" href="#/S05?state=normal">下一题</a></footer>
      </section>`, ['practiceVersion.sections', 'attempt.itemAttempts', 'recordings'], `${typeLabels[type]} · ${window.WF_STATES.labels[state] || state}`);
  }

  function renderS05(meta, fx) {
    const allItems = fx.practiceVersion.sections.flatMap((s) => s.itemRefs);
    return shell(meta, fx, `
      <div class="device-warning"><strong>手机结构预览</strong><span>正式提交请使用电脑或平板完成。</span></div>
      <div class="review-layout">
        <section><p class="eyebrow">完成证据</p><h2>${allItems.length} 项内容已完成，${fx.recordings.length} 段录音已同步</h2><ol class="evidence-list">${allItems.map((item) => { const attempt = fx.attempt.itemAttempts.find((a) => a.itemRefId === item.itemRefId); return `<li><span>${esc(item.title)}</span><strong>${attempt.recordingId ? '录音已同步' : '答案已保存'}</strong><a href="#/S04?type=${item.itemType}&state=normal">查看</a></li>`; }).join('')}</ol></section>
        <aside class="submit-gate"><p class="eyebrow">提交门槛</p><h2>可以提交</h2><ul><li>所有必要内容已完成</li><li>本地证据均已服务端确认</li><li>提交后不可普通修改</li></ul><a class="button primary full" href="#/S06?state=processing">确认提交</a><a class="text-link center" href="#/S04?type=READ_ALOUD&state=normal">返回修改</a></aside>
      </div>`, ['attempt.itemAttempts', 'recordings', 'practiceVersion.sections'], '完成与同步核对');
  }

  function renderS06(meta, fx) {
    return shell(meta, fx, `
      <section class="processing-path">
        <p class="eyebrow">证据已安全提交</p><h2>系统正在整理本次练习的证据</h2>
        <ol><li class="done"><strong>录音与答案已接收</strong><span>可以安全离开</span></li><li class="active"><strong>机器处理与质量检查</strong><span>${fx.speechJobs.length} 个语音任务</span></li><li><strong>必要的教师复核</strong><span>只处理低置信度和主观证据</span></li><li><strong>生成正式报告</strong><span>完成后站内通知</span></li></ol>
        <p>通常需要 1—3 分钟；不显示误导性的秒级倒计时。</p>
        <div class="action-row"><a class="button primary" href="#/S01?state=normal">先去别处看看</a><button class="button secondary" type="button">刷新状态</button></div>
      </section>`, ['speechJobs', 'attempt.itemAttempts', 'reviews'], '处理路径与可离开说明');
  }

  function renderS07(meta, fx) {
    const report = fx.report;
    return shell(meta, fx, `
      <section class="report-summary"><div><p class="eyebrow">本次结果</p><strong class="score">${report.totalScore}</strong><span>通过 · 数据完整</span></div><div><h2>完整度表现稳定，下一步聚焦停顿与节奏</h2><p>${esc(report.teacherFeedback.summary)}</p></div></section>
      <div class="report-layout">
        <section><h2>证据如何支持结论</h2><div class="dimension-table" role="table">${report.dimensionScores.map((d) => `<div role="row"><span role="cell">${esc(d.name)}</span><progress max="100" value="${d.score}">${d.score}</progress><strong role="cell">${d.score}</strong></div>`).join('')}</div><h2>优势与改进</h2><div class="evidence-pair"><div><p class="eyebrow">优势</p>${report.strengths.map((s) => `<p>${esc(s.summary)}</p>`).join('')}</div><div><p class="eyebrow">待改进</p>${report.improvements.map((s) => `<p>${esc(s.summary)}</p>`).join('')}</div></div></section>
        <aside class="next-step"><p class="eyebrow">唯一下一步</p><h2>${esc(report.consolidationSuggestion.title)}</h2><p>${esc(report.consolidationSuggestion.reason.replace('humanReviewThreshold', '人工关注线'))}</p><a class="button primary full" href="#/S01?state=normal">开始巩固练习</a><button class="button secondary full" type="button">加入学习计划</button><a class="text-link center" href="#/S08?state=normal">听录音</a><a class="text-link center" href="#/S09?state=normal">查看历史</a><button class="text-link center" type="button">申请复测</button></aside>
      </div>`, ['report', 'reviews', 'attempt'], `${fx.student.name} · ${fx.class.name}`);
  }

  function renderS08(meta, fx) {
    const itemMap = new Map(fx.practiceVersion.sections.flatMap((s) => s.itemRefs).map((i) => [i.itemRefId, i]));
    return shell(meta, fx, `
      <div class="recording-layout">
        <section><p class="eyebrow">声音档案</p><h2>${fx.recordings.length} 段本人录音</h2><ol class="recording-list">${fx.recordings.map((r, index) => { const ia = fx.attempt.itemAttempts.find((x) => x.itemAttemptId === r.itemAttemptId); const item = itemMap.get(ia.itemRefId); return `<li class="${index === 0 ? 'selected' : ''}"><button type="button"><span>${esc(item.title)}</span><small>${Math.round(r.durationMs / 1000)} 秒 · ${statusText(r.status)}</small></button></li>`; }).join('')}</ol></section>
        <section class="player-structure"><p class="eyebrow">当前证据</p><h2>${esc(itemMap.get(fx.attempt.itemAttempts.find((x) => x.itemAttemptId === fx.recordings[0].itemAttemptId).itemRefId).title)}</h2><div class="wave-placeholder" aria-label="录音波形结构占位"></div><button class="record-control" type="button" aria-label="播放当前录音">播放</button><dl class="summary-list"><div><dt>保存状态</dt><dd>已上传</dd></div><div><dt>评分状态</dt><dd>已完成</dd></div><div><dt>访问范围</dt><dd>仅本人和授权教师</dd></div></dl><a class="text-link" href="#/S07?state=normal">返回报告</a></section>
      </div>`, ['recordings', 'attempt.itemAttempts'], '本人声音证据与状态');
  }

  function renderS09(meta, fx) {
    return shell(meta, fx, `
      <div class="history-layout">
        <section><p class="eyebrow">练习时间路径</p><h2>最近 ${fx.historyEvents.length} 次完成记录</h2><ol class="timeline">${fx.historyEvents.map((event) => `<li><time>${fmtDate(event.occurredAt)}</time><div><strong>${esc(event.practiceTitle)}</strong><span>${event.mode === 'ASSIGNMENT' ? '教师布置' : '自主练习'}</span></div><b>${event.totalScore}</b><a href="#/S07?state=normal">查看报告</a></li>`).join('')}</ol></section>
        <section><p class="eyebrow">变化不是排名</p><h2>${fx.dimensionTrend.length} 个能力维度的历次结果</h2><div class="trend-list">${fx.dimensionTrend.map((trend) => `<div><strong>${esc(trend.name)}</strong><div class="trend-points">${trend.points.map((p) => `<span><small>${p.date.slice(5)}</small><b>${p.score}</b></span>`).join('')}</div></div>`).join('')}</div><p>这些数据只能说明近期变化，不代表长期因果。</p><a class="text-link" href="#/S01?state=normal">返回练习中心</a></section>
      </div>`, ['historyEvents', 'dimensionTrend'], `${fx.student.name} · ${fx.class.name}`);
  }

  function render(meta, fx, state, type) {
    const abnormal = state !== 'normal' && meta.id !== 'S04' && !(meta.id === 'S06' && state === 'processing');
    if (abnormal) {
      return shell(meta, fx, window.WF_STATES.statePanel(state, meta.id), window.WF_PAGES.refs[meta.id], window.WF_STATES.labels[state] || state);
    }
    const renderers = { S01: renderS01, S02: renderS02, S03: renderS03, S05: renderS05, S06: renderS06, S07: renderS07, S08: renderS08, S09: renderS09 };
    if (meta.id === 'S04') {
      if (state !== 'normal' && ['loading','empty','error','offline','permission','processing','provider-unavailable'].includes(state)) {
        return shell(meta, fx, window.WF_STATES.statePanel(state, meta.id), window.WF_PAGES.refs.S04, window.WF_STATES.labels[state]);
      }
      return renderS04(meta, fx, type, state);
    }
    return renderers[meta.id](meta, fx);
  }

  window.WF_PAGES = {
    pageMeta, types, typeLabels, render,
    refs: {
      S01:['student','practiceDeliveries','attempt','historyEvents'],
      S02:['practiceDefinition','practiceVersion','practiceDeliveries[0]'],
      S03:['attempt','attempt.deviceCheck','practiceVersion'],
      S04:['practiceVersion.sections','attempt.itemAttempts','recordings'],
      S05:['attempt.itemAttempts','recordings'],
      S06:['speechJobs','attempt.itemAttempts','reviews'],
      S07:['report','reviews','attempt'],
      S08:['recordings','attempt.itemAttempts'],
      S09:['historyEvents','dimensionTrend']
    }
  };
})();
