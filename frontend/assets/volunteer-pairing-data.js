(() => {
  const people = {
    A:{name:'小满',goal:'提升阅读理解能力和学习兴趣，培养良好学习习惯。',needs:['阅读时抓住文章主要内容','尝试用自己的话讲述故事','逐步建立稳定的阅读习惯','在交流中增强表达自信'],phases:[['阶段一：阅读兴趣建立（第1–4周）','认识喜欢的故事，建立每周阅读习惯','已完成'],['阶段二：阅读能力提升（第5–12周）','学习梳理文章内容，尝试制作阅读笔记','进行中'],['阶段三：学习方法优化（第13–20周）','回顾阅读收获，形成适合自己的学习方法','待开始']],history:[['第8次沟通','2026-10-21 16:30','一起梳理课文中的人物关系，小满尝试用思维导图讲述故事。'],['第7次沟通','2026-10-14 16:30','共读一篇短文，练习寻找关键词，并约定记录喜欢的句子。'],['第6次沟通','2026-10-07 16:30','聊了近期的阅读兴趣，共同选定下一阶段想读的故事。']],count:'8',hours:'6.5',days:'56',appointment:'2026-11-04（周三）16:30',appointmentLabel:'下次沟通时间',teacherDate:'2026-09-01 10:30',state:'active'},
    B:{name:'小云',goal:'适应初中学习节奏，逐步建立阅读整理与每周计划的习惯。',needs:['梳理初中课程的学习安排','练习从较长文章中提取重点','将大目标拆成可以完成的小步骤','在交流中找到适合自己的方法'],phases:[['阶段一：了解与准备（第1–2周）','了解学习兴趣和时间安排，商定陪伴目标','进行中'],['阶段二：阅读与计划（第3–8周）','练习提取重点，尝试使用每周学习清单','待开始'],['阶段三：回顾与调整（第9–12周）','回顾学习方法，根据实际情况调整计划','待开始']],history:[['第2次沟通','2026-10-24 15:30','和小云一起整理了新学期课程，记录希望优先改善的学习习惯。'],['第1次沟通','2026-10-17 15:30','初次认识，聊了喜欢的科目与课后时间，并约定下次交流主题。']],count:'2',hours:'1.5',days:'12',appointment:'2026-10-31（周六）15:30',appointmentLabel:'下次沟通时间',teacherDate:'2026-10-15 10:00',state:'preparing'},
    C:{name:'小宁',goal:'通过绘本共读和故事交流，培养阅读兴趣与口头表达习惯。',needs:['愿意尝试完整讲述一件小事','在绘本中发现人物与情节','练习倾听并回应简单问题','保持轻松愉快的阅读节奏'],phases:[['阶段一：认识绘本（第1–2周）','选择喜欢的绘本，建立轻松交流的习惯','已完成'],['阶段二：故事共读（第3–6周）','通过提问和复述，练习理解故事内容','已完成'],['阶段三：回顾与分享（第7–8周）','分享喜欢的故事，回顾阅读中的收获','已完成']],history:[['第6次沟通','2026-09-26 10:00','小宁分享了最喜欢的绘本，尝试独立讲述故事的开头和结尾。'],['第5次沟通','2026-09-19 10:00','一起读了关于小动物的故事，讨论人物遇到困难时的选择。'],['第4次沟通','2026-09-12 10:00','通过看图说话练习描述场景，小宁主动补充了自己的想象。']],count:'6',hours:'4.5',days:'49',appointment:'本阶段已结束',appointmentLabel:'陪伴安排',teacherDate:'2026-08-08 14:00',state:'done'}
  };
  function render(id,kind){const p=people[id];if(!p)return;const $=(s)=>document.querySelector(s), all=(s)=>[...document.querySelectorAll(s)];const old=kind==='legacy';
    $(old?'#goalText':'.goal p').textContent=p.goal;
    all(old?'.difficulty-card li':'.difficulty li').forEach((el,i)=>el.textContent=p.needs[i]);
    all(old?'.phase':'.plan-item').forEach((el,i)=>{const phase=p.phases[i];el.classList.toggle(old?'current':'active',phase[2]==='进行中');el.querySelector(old?'div strong':'h3').textContent=phase[0];el.querySelector('p').textContent=phase[1];el.querySelector(old?'b':':scope > strong').textContent=phase[2]});
    all(old?'.history-list article':'.history-item').forEach((el,i)=>{const row=p.history[i];el.hidden=!row;if(!row)return;el.querySelector('strong').textContent=row[0];el.querySelector(old?'small':'em').textContent=row[1];el.querySelector('p').textContent=row[2]});
    const historyAll=$(old?'.all-history':'.history-all');historyAll.firstChild.textContent=`查看全部沟通记录（${p.count}） `;
    const stats=all(old?'.service-card .stats b':'.service-record .stats strong');[p.count,p.hours,p.days].forEach((value,i)=>{stats[i].firstChild.textContent=value});
    $(old?'.appointment-card > p':'.appointment > p').textContent=p.appointmentLabel;$(old?'.appointment-card > strong':'.appointment > strong').textContent=p.appointment;
    $(old?'.teacher-card > p':'.teacher-card > p').textContent=`确认时间：${p.teacherDate}`;
    const buttons=all(old?'#adjustTimeBtn,#startCallBtn,#endPairingBtn':'.appointment .button-pair button,[data-action=end]');buttons.forEach(b=>{b.disabled=p.state==='done';b.style.opacity=p.state==='done'?'.45':''});
    const end=old?$('#endPairingBtn'):$('[data-action=end]');if(end)end.textContent=p.state==='done'?'帮扶已结束':'结束帮扶关系';
  }
  window.VolunteerPairingData={render};
})();
