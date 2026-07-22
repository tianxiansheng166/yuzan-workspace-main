(() => {
  const toast=document.getElementById('toast');let timer;
  const say=(text)=>{toast.textContent=text;toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),1800)};
  const drawer=document.getElementById('drawerBackdrop');
  const title=document.getElementById('drawerTitle');
  const text=document.getElementById('drawerText');
  const time=document.getElementById('drawerTime');
  const stageNames={schools:'覆盖学校',courses:'课程完成',assessment:'测评前后变化',teachers:'教师培训',volunteer:'志愿服务'};
  document.querySelectorAll('.chain-stage').forEach(stage=>{
    const open=()=>{document.querySelectorAll('.chain-stage').forEach(s=>s.classList.remove('selected'));stage.classList.add('selected');title.textContent=stageNames[stage.dataset.key]+'｜证据详情';text.textContent='查看该指标的统计口径、证据文件、案例故事和公开授权状态。';time.textContent=document.getElementById('timeFilter').value;drawer.hidden=false};
    stage.addEventListener('click',open);stage.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})
  });
  document.getElementById('drawerClose').addEventListener('click',()=>drawer.hidden=true);
  drawer.addEventListener('click',e=>{if(e.target===drawer)drawer.hidden=true});
  document.getElementById('downloadBtn').addEventListener('click',()=>say('已生成节选报告下载任务'));
  document.querySelectorAll('.journey-node').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.journey-node').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');say('已切换到：'+btn.dataset.stage)}));
  document.querySelectorAll('select').forEach(sel=>sel.addEventListener('change',()=>say('筛选条件已更新')));
  document.getElementById('resetBtn').addEventListener('click',()=>{document.querySelectorAll('select').forEach(s=>s.selectedIndex=0);say('筛选条件已重置')});
  document.getElementById('searchBtn').addEventListener('click',()=>say('站内搜索已打开'));
  document.querySelectorAll('.report-open,.story-btn,.tool-row,.data-footer button').forEach(btn=>btn.addEventListener('click',()=>say((btn.textContent||'').replace(/\s+/g,' ').trim())));
})();