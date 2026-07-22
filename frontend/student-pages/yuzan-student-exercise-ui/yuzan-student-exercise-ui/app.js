const memoryStore = {};
const safeStorage = (() => {
  try {
    const testKey = '__yuzan_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (_) {
    return {
      getItem: key => Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null,
      setItem: (key, value) => { memoryStore[key] = String(value); },
      removeItem: key => { delete memoryStore[key]; },
      clear: () => Object.keys(memoryStore).forEach(key => delete memoryStore[key])
    };
  }
})();
window.__exerciseStorage = safeStorage;

const questions = [
  {
    step: 0,
    label: '问题 1',
    score: '5 分',
    required: true,
    text: '短文是按照怎样的顺序描写高原春天的？请简要概括。'
  },
  {
    step: 1,
    label: '问题 2',
    score: '4 分',
    required: true,
    text: '“溪流开始欢唱”运用了什么修辞手法？这样写有什么表达效果？'
  },
  {
    step: 2,
    label: '问题 3',
    score: '5 分',
    required: true,
    text: '结合短文内容，说说你对“生命的力量，永远不会被严寒击败”的理解。'
  },
  {
    step: 3,
    label: '问题 4',
    score: '6 分',
    required: false,
    text: '请用一段话描写你熟悉的一处春日景色，注意写出景物变化。'
  }
];

const state = {
  current: 0,
  answers: JSON.parse(safeStorage.getItem('yuzan-student-exercise-answers') || '{}'),
  online: navigator.onLine,
  saveTimer: null,
  submitted: false
};

const els = {
  answer: document.getElementById('answerInput'),
  counter: document.getElementById('counter'),
  label: document.getElementById('questionLabel'),
  score: document.getElementById('questionScore'),
  text: document.getElementById('questionText'),
  saveState: document.getElementById('saveState'),
  autosaveTop: document.getElementById('autosaveTop'),
  onlineState: document.getElementById('onlineState'),
  next: document.getElementById('nextBtn'),
  prev: document.getElementById('prevBtn'),
  stepper: document.getElementById('stepper'),
  modal: document.getElementById('submitModal'),
  incompleteList: document.getElementById('incompleteList'),
  submitSummary: document.getElementById('submitSummary'),
  toast: document.getElementById('toast'),
  sidebar: document.getElementById('sidebar'),
  backdrop: document.getElementById('drawerBackdrop'),
  offlinePopover: document.getElementById('offlinePopover'),
  mobileStatusText: document.getElementById('mobileStatusText')
};

function nowText() {
  return new Intl.DateTimeFormat('zh-CN', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
}

function renderQuestion() {
  const q = questions[state.current];
  els.label.textContent = q.label;
  els.score.textContent = q.score;
  els.text.textContent = q.text;
  els.answer.value = state.answers[state.current] || '';
  updateCounter();
  [...els.stepper.querySelectorAll('.step')].forEach((step, index) => {
    step.classList.toggle('active', index === state.current);
    step.classList.toggle('done', Boolean((state.answers[index] || '').trim()));
  });
  els.prev.disabled = state.current === 0;
  els.prev.style.opacity = state.current === 0 ? '.55' : '1';
  els.next.textContent = state.current === questions.length - 1 ? '提交练习' : '下一题';
}

function updateCounter() {
  els.counter.textContent = `${els.answer.value.length} / 300`;
}

function saveLocal() {
  state.answers[state.current] = els.answer.value;
  safeStorage.setItem('yuzan-student-exercise-answers', JSON.stringify(state.answers));
  els.saveState.innerHTML = '<svg><use href="#i-check-circle"/></svg>已保存到本地草稿';
  els.autosaveTop.innerHTML = `<svg><use href="#i-check-circle"/></svg><span>已自动保存草稿 ${nowText()}</span>`;
  els.mobileStatusText.textContent = state.online ? '草稿已保存到本地，等待同步' : '草稿已保存到本地（离线）';
}

function scheduleSave() {
  clearTimeout(state.saveTimer);
  els.saveState.innerHTML = '<svg><use href="#i-clock"/></svg>正在保存到本地...';
  state.saveTimer = setTimeout(saveLocal, 500);
}

function setQuestion(index) {
  saveLocal();
  state.current = Math.max(0, Math.min(questions.length - 1, index));
  renderQuestion();
}

function incompleteQuestions() {
  return questions.map((q,i)=>({q,i})).filter(({q,i}) => q.required && !(state.answers[i] || '').trim());
}

function openSubmit() {
  saveLocal();
  const missing = incompleteQuestions();
  els.submitSummary.textContent = missing.length
    ? `你还有 ${missing.length} 道必答题未完成。可以继续作答，也可以先保存草稿。`
    : '所有必答题都已完成。提交后将进入待同步状态，结果返回前不会显示分数。';
  els.incompleteList.innerHTML = missing.length
    ? missing.map(({q}) => `<span>• ${q.label}：${q.text}</span>`).join('')
    : '<span>✓ 必答题已全部完成</span>';
  els.modal.classList.add('show');
  els.modal.setAttribute('aria-hidden','false');
}

function closeSubmit() {
  els.modal.classList.remove('show');
  els.modal.setAttribute('aria-hidden','true');
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(()=>els.toast.classList.remove('show'),1800);
}

function setOnline(online) {
  state.online = online;
  els.onlineState.innerHTML = online ? '<i></i>离线可用' : '<i style="background:#d58a2e"></i>当前离线';
  els.autosaveTop.innerHTML = online
    ? `<svg><use href="#i-check-circle"/></svg><span>草稿已保存，等待同步 ${nowText()}</span>`
    : `<svg><use href="#i-offline"/></svg><span>离线答题中，草稿已保存在本地</span>`;
  els.mobileStatusText.textContent = online ? '草稿已保存到本地，等待同步' : '草稿已保存到本地（离线）';
}

els.answer.addEventListener('input',()=>{ updateCounter(); scheduleSave(); });
els.next.addEventListener('click',()=>{
  if (state.current === questions.length - 1) openSubmit(); else setQuestion(state.current + 1);
});
els.prev.addEventListener('click',()=>setQuestion(state.current - 1));
document.getElementById('skipBtn').addEventListener('click',()=>{
  if (state.current === questions.length - 1) openSubmit(); else { setQuestion(state.current + 1); showToast('已跳过本题，可稍后返回'); }
});
[...els.stepper.querySelectorAll('.step')].forEach((btn,index)=>btn.addEventListener('click',()=>setQuestion(index)));
document.getElementById('insertSymbol').addEventListener('click',()=>{
  const start=els.answer.selectionStart; const end=els.answer.selectionEnd;
  els.answer.value=els.answer.value.slice(0,start)+'——'+els.answer.value.slice(end);
  els.answer.focus(); els.answer.selectionStart=els.answer.selectionEnd=start+2; updateCounter(); scheduleSave();
});
document.getElementById('readQuestion').addEventListener('click',()=>{
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel(); const utter=new SpeechSynthesisUtterance(questions[state.current].text); utter.lang='zh-CN'; speechSynthesis.speak(utter); showToast('正在朗读题目');
  } else showToast('当前浏览器不支持朗读');
});
document.querySelectorAll('[data-close-modal]').forEach(el=>el.addEventListener('click',closeSubmit));
document.getElementById('confirmSubmit').addEventListener('click',()=>{
  state.submitted=true; closeSubmit();
  if (state.online) showToast('已进入提交队列，等待服务端确认');
  else showToast('已保存为待同步提交，请联网后确认');
  els.saveState.innerHTML='<svg><use href="#i-cloud"/></svg>提交状态：待同步确认';
});
document.getElementById('mobileSubmit').addEventListener('click',openSubmit);
document.getElementById('offlineManage').addEventListener('click',(e)=>{e.stopPropagation();els.offlinePopover.classList.toggle('show')});
document.getElementById('toggleOffline').addEventListener('click',()=>{setOnline(!state.online);els.offlinePopover.classList.remove('show');showToast(state.online?'已恢复在线状态':'已切换为离线模式')});
document.addEventListener('click',e=>{if(!els.offlinePopover.contains(e.target)&&!document.getElementById('offlineManage').contains(e.target))els.offlinePopover.classList.remove('show')});
window.addEventListener('online',()=>setOnline(true));window.addEventListener('offline',()=>setOnline(false));
document.getElementById('mobileMenuBtn').addEventListener('click',()=>{els.sidebar.classList.toggle('open');els.backdrop.classList.toggle('show')});
els.backdrop.addEventListener('click',()=>{els.sidebar.classList.remove('open');els.backdrop.classList.remove('show')});
document.getElementById('studentMenu').addEventListener('click',()=>showToast('学生账号菜单'));

renderQuestion();
setOnline(navigator.onLine);
