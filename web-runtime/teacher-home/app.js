const stages = {
  prepare: {
    index: '01 / 晨间备课', title: '把今天的教学目标，变成一条可执行路径',
    description: '围绕《高原上的春天》完成课程目标、示范朗读和练习编排，发布前只保留真正需要学生完成的动作。',
    stats: [['2','项待完善'],['18','分钟预计用时'],['1','条智能建议']], action: '进入备课工作区',
    items: [
      ['course','课程目标尚未收敛','将“理解春天”改为可评价的朗读与表达目标','待完善','#b81f19'],
      ['mic','示范朗读已生成','语速 198 字/分，建议保留一次慢速示范','可使用','#1d704c'],
      ['task','分句练习未加入','班级长句换气低于年级平均，建议补充','建议加入','#d79722']
    ],
    assistantTitle:'备课路径建议',focus:['最值得补的一步','加入 8 分钟“长句分句 + 换气标记”练习，可直接回应本周班级薄弱点。'],
    suggestions:[['01','收敛课程目标','把“理解文章”改为“能在长句中完成自然换气并保持语义连贯”。'],['02','保留双速示范','第一遍正常语速，第二遍降低 15%，避免学生只模仿速度。'],['03','关联复测证据','在任务中记录长句停顿位置，为两周后的复测建立可比较证据。']]
  },
  publish: {
    index:'02 / 发布任务',title:'先解决唯一临近截止的任务',description:'五年级二班《春天的足迹》将在 2 小时后截止。当前重点不是再次发布，而是让 8 名未提交学生顺利完成。',
    stats:[['1','项紧急任务'],['8','名学生未提交'],['32','名学生受影响']],action:'查看截止任务',
    items:[['task','《春天的足迹》朗读任务','截止 16:30，当前完成率 75%','2 小时后截止','#b81f19'],['people','未提交学生分组','4 人未开始，3 人仅本地保存，1 人上传失败','需要跟进','#d79722'],['message','提醒文案已准备','按不同未提交原因发送差异化提醒','可发送','#1d704c']],
    assistantTitle:'发布与催办建议',focus:['先处理上传阻塞','3 名学生已经完成录音但尚未上传，不应与“未开始”学生发送相同提醒。'],
    suggestions:[['01','按状态分组提醒','未开始、仅本地保存、上传失败使用三套不同操作指引。'],['02','避免重复任务','不要新建相同任务；保留原任务会话，保证结果可追踪。'],['03','给出离线方案','网络不稳定的学生可先保存在本机，恢复网络后继续上传。']]
  },
  observe: {
    index:'03 / 学习观察',title:'把进度数字转成可解释的课堂证据',description:'96 名学生正在学习。关注参与深度、练习完成节奏和异常停滞，而不是只看完成率。',
    stats:[['96','名学生参与'],['3','项进行中任务'],['12','条异常信号']],action:'进入学习观察',
    items:[['eye','五年级二班进度稳定','学习完成率 78%，较上周提升 5%','正常','#1d704c'],['chart','长句练习停留偏长','12 名学生在第 3 题停留超过 6 分钟','需查看','#d79722'],['people','4 名学生连续两天下降','可能需要教师示范或一对一提醒','需关注','#b81f19']],
    assistantTitle:'学习观察建议',focus:['优先查看“停留异常”','完成率正常，但第 3 题长时间停留可能暴露换气与断句困难。'],
    suggestions:[['01','查看行为证据','先看第 3 题的重播次数、录音重试次数与停留时间。'],['02','区分难题与设备问题','排除网络、麦克风授权与上传失败，再判断学习困难。'],['03','创建微干预','对 4 名持续下降学生安排 10 分钟示范跟读，不扩散到全班。']]
  },
  review: {
    index:'04 / 反馈复核',title:'让教师把时间花在最需要判断的录音上',description:'系统已完成基础评分，6 份朗读需要教师复核。优先处理低置信度、长停顿和声调争议片段。',
    stats:[['6','份待复核'],['3','份长停顿'],['2','份声调争议']],action:'进入朗读复核',
    items:[['mic','扎西旺姆 · 第 2 题','长句中出现 3 次异常停顿，自动评分置信度 62%','优先复核','#b81f19'],['mic','索朗多吉 · 第 1 题','“春风”声调结果与识别文本不一致','待确认','#d79722'],['message','教师反馈模板','已根据共性问题生成 2 条可编辑反馈','可使用','#1d704c']],
    assistantTitle:'智能复核建议',focus:['6 份录音不必逐条重听','先听系统标记的 11 个关键片段，可将复核时间从约 24 分钟降至 8 分钟。'],
    suggestions:[['01','先听低置信度片段','只打开自动评分置信度低于 70% 的音节与停顿区间。'],['02','保留教师判断边界','AI 只定位证据，不替代教师确认方言、情绪与表达完整度。'],['03','合并共性反馈','对同类长句停顿问题使用班级练习建议，个别问题再单独补充。']]
  },
  intervene: {
    index:'05 / 教学干预',title:'把关注学生变成有期限、有证据的支持计划',description:'4 名学生近期表现持续下降。选择最小可行干预，并约定复查时间，避免泛化为长期标签。',
    stats:[['4','名学生需关注'],['2','类共性问题'],['7','天建议周期']],action:'创建学生干预',
    items:[['people','扎西旺姆','长句停顿连续 3 次测评偏高，最近下降 12%','高优先级','#b81f19'],['people','索朗多吉','前鼻音混淆，错误集中于特定词组','专项练习','#d79722'],['chart','班级共性干预','建议下周加入 2 次分句与换气示范','可安排','#1d704c']],
    assistantTitle:'教学干预建议',focus:['先做 7 天短周期支持','用“2 次示范 + 3 次练习 + 1 次复查”替代长期、模糊的关注标签。'],
    suggestions:[['01','设定可观察目标','目标写为“长句停顿次数从 6 次降至 3 次以内”。'],['02','匹配最小支持动作','优先示范跟读和换气标记，不立即增加大量额外作业。'],['03','约定退出条件','连续两次达标后结束干预，结果回到常规学习路径。']]
  }
};

const stageIcons = {course:'i-course',task:'i-task',mic:'i-mic',people:'i-people',message:'i-message',eye:'i-eye',chart:'i-chart'};
const nodePositions = {prepare:['7%','58%'],publish:['29%','49%'],observe:['50%','43%'],review:['70%','58%'],intervene:['91%','36%']};

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

function renderStage(key){
  const data=stages[key];
  $('#stageIndex').textContent=data.index;
  $('#stageTitle').textContent=data.title;
  $('#stageDescription').textContent=data.description;
  $('#stageStats').innerHTML=data.stats.map(([n,t])=>`<span><b>${n}</b> ${t}</span>`).join('');
  $('#stageAction').innerHTML=`${data.action} <svg><use href="#i-arrow"/></svg>`;
  $('#stageItems').innerHTML=data.items.map(([icon,title,desc,state,color],i)=>`<div class="stage-item" style="--item-color:${color};animation-delay:${i*55}ms"><span class="item-symbol"><svg><use href="#${stageIcons[icon]}"/></svg></span><div><strong>${title}</strong><p>${desc}</p></div><span class="item-state"><span></span>${state}</span></div>`).join('');
  $('#assistantTitle').textContent=data.assistantTitle;
  $('#assistantFocus').innerHTML=`<strong>${data.focus[0]}</strong><p>${data.focus[1]}</p>`;
  $('#assistantSuggestions').innerHTML=data.suggestions.map(([n,t,d],i)=>`<div class="suggestion" style="animation-delay:${i*60}ms"><span class="suggestion-index">${n}</span><div><strong>${t}</strong><p>${d}</p></div></div>`).join('');
  const [left,top]=nodePositions[key];
  $('#travellingLight').style.left=left; $('#travellingLight').style.top=top;
  $$('.journey-node').forEach(btn=>{const active=btn.dataset.stage===key;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',String(active));});
}

$$('.journey-node').forEach(btn=>btn.addEventListener('click',()=>renderStage(btn.dataset.stage)));
$$('[data-stage]').filter(el=>!el.classList.contains('journey-node')).forEach(el=>el.addEventListener('click',()=>renderStage(el.dataset.stage)));

const evidence = {
  pronunciation:[['zh / z / j','错误率 28% · 涉及 48 人','28%'],['n / l','错误率 22% · 涉及 36 人','22%'],['ang / eng','错误率 18% · 涉及 29 人','18%'],['前鼻音','错误率 15% · 涉及 24 人','15%']],
  students:[['扎西旺姆','五年级二班 · 长句停顿偏高','↓ 12%'],['索朗多吉','五年级一班 · 前鼻音混淆','↓ 9%'],['次仁央宗','五年级三班 · 声调不准','↓ 8%'],['旦增曲珍','五年级二班 · n / l 混淆','↓ 7%']]
};
function renderEvidence(type){
  $('#evidenceContent').innerHTML=evidence[type].map((row,i)=>`<div class="evidence-row" style="animation-delay:${i*55}ms"><span class="evidence-rank">${String(i+1).padStart(2,'0')}</span><div><strong>${row[0]}</strong><p>${row[1]}</p></div><span class="evidence-value">${row[2]}</span></div>`).join('');
  $$('.evidence-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.evidence===type));
}
$$('.evidence-tabs button').forEach(btn=>btn.addEventListener('click',()=>renderEvidence(btn.dataset.evidence)));

const shell=$('.app-shell');
const assistantEl=$('#aiAssistant');
$('#assistantToggle').addEventListener('click',()=>{
  // 同时在 .app-shell 和 .ai-assistant 上切换 class，
  // 确保 teacher-shell 移除 .app-shell 后折叠仍然生效
  const collapsed = assistantEl.classList.toggle('assistant-collapsed');
  if(shell) shell.classList.toggle('assistant-collapsed', collapsed);
  $('#assistantToggle').setAttribute('aria-expanded',String(!collapsed));
});

const actionSheet=$('#actionSheet');
function openSheet(){actionSheet.classList.add('open');actionSheet.setAttribute('aria-hidden','false')}
function closeSheet(){actionSheet.classList.remove('open');actionSheet.setAttribute('aria-hidden','true')}
$('#actionCreator').addEventListener('click',openSheet);
$('.sheet-close').addEventListener('click',closeSheet);
$('.sheet-backdrop').addEventListener('click',closeSheet);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});

const hero=$('#hero');
hero.addEventListener('pointermove',e=>{
  const r=hero.getBoundingClientRect();
  const x=((e.clientX-r.left)/r.width-.5)*-10;
  const y=((e.clientY-r.top)/r.height-.5)*-6;
  hero.style.setProperty('--hero-x',`${x}px`);hero.style.setProperty('--hero-y',`${y}px`);
});
hero.addEventListener('pointerleave',()=>{hero.style.setProperty('--hero-x','0px');hero.style.setProperty('--hero-y','0px')});

renderStage('prepare');
renderEvidence('pronunciation');
