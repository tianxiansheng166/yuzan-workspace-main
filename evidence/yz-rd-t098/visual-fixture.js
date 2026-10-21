/* VISUAL_FIXTURE_ONLY. Synthetic responses for visual QA; never loaded by product HTML. */
(() => {
  const q = new URLSearchParams(location.search);
  const state = q.get('state') || 'populated';
  const empty = state === 'empty';
  const error = state === 'error';
  const userId = 't098-visual-student', enrollmentId = 't098-visual-enrollment', schoolId = 't098-visual-school';
  localStorage.setItem('yuzan-access-token','VISUAL_FIXTURE_ONLY');
  localStorage.setItem('yuzan-current-user', JSON.stringify({id:userId}));
  localStorage.setItem('yuzan-active-school-id',schoolId);
  const titles = ['《春》生字认读与易错音纠正','古诗文里的停顿与情感','现代文听说：信息提取与复述','韵母、声调与自然节奏','声母与口型：发音基础','阅读中的思考与表达','听后复述：从理解到表达','古诗中的意象与节奏','发音基础：清晰的声音','现代文阅读与交流','语音节奏练习','诗文朗读：读出情感','《春》课程回顾'];
  const courses = titles.map((title,i)=>({assignmentId:'t098-visual-course-'+i,title,description:'循着文字与声音，理解内容、练习表达，在课程中留下自己的学习记录。',gradeBand:'JUNIOR',capabilityTheme:['READING','CLASSICS','LISTENING'][i%3],difficulty:'基础',source:i===0?'TEACHER_ASSIGNED':'SELF_STUDY',status:i===0?'IN_PROGRESS':'NOT_STARTED',progressPercent:i===0?25:0,estimatedMinutes:20,isFavorite:false,nextActivity:{id:'t098-visual-video-'+i,title:i===0?'视频学习：走进课文':'课程导读'},taskGroups:['语言积累与表达'],culturalElements:[]}));
  const practice = {id:'t098-visual-practice',title:'朗读中的自然停顿',summary:'把长句读清楚，让表达更自然。',mode:'ASSIGNMENT',catalogType:'SPECIALIZED',studentState:{completionStatus:'IN_PROGRESS'}};
  const attempts = empty?[]:[{id:'t098-visual-active',status:'IN_PROGRESS',purpose:'STANDARD',practiceTitle:'朗读中的自然停顿',practiceDefinitionId:practice.id,updatedAt:'2026-10-20T10:00:00Z',schoolId,enrollmentId},{id:'t098-visual-waiting',status:'PROCESSING',purpose:'REMEDIATION',practiceTitle:'句子理解 · 等待老师复核',updatedAt:'2026-10-20T09:00:00Z',schoolId,enrollmentId}];
  const points=[{sessionId:'t098-formal-1',overallScore:60,completedAt:'2026-09-21T09:00:00Z'},{sessionId:'t098-formal-2',overallScore:68,completedAt:'2026-10-01T09:00:00Z'},{sessionId:'t098-formal-3',overallScore:74,completedAt:'2026-10-18T09:00:00Z'}];
  const history = empty?[]:[...points.map(p=>({...p,purpose:'STANDARD',type:'READING',metrics:{overall:p.overallScore}})),{sessionId:'t098-formal-zero',purpose:'STANDARD',type:'READING',completedAt:'2026-09-01T09:00:00Z',metrics:{overall:0}},{sessionId:'t098-formal-null',purpose:'STANDARD',type:'READING',completedAt:'2026-08-30T09:00:00Z',metrics:null}];
  const feedback = {id:'t098-visual-feedback',type:'FEEDBACK',title:'老师的朗读建议',description:'长句读得清楚了。\n下一次留意句尾语气，让表达更自然。',timestamp:'2026-10-18T10:00:00Z'};
  const profile = {userId,enrollmentId,displayName:'小禾',schoolName:'视觉测试学校',gradeBand:'七年级',className:'视觉测试班'};
  const result = async value=>{if(error) throw Object.assign(new Error('VISUAL_FIXTURE_ONLY 读取失败'),{status:503}); return value;};
  window.__visualCalls=[];
  window.YuzanApi={
    getToken:()=> 'VISUAL_FIXTURE_ONLY',getStoredUser:()=>({id:userId}),getActiveSchoolId:()=>schoolId,
    getStudentProfile:()=>result({profile}),
    getStudentToday:()=>result({version:'student-today-v1',primaryAction:empty?null:{kind:'RESUME_STANDARD',title:'继续练习，让朗读更自然',reason:'上次的练习还没有完成，从已保存的进度接着学。',cta:'继续练习',target:{href:'/student/practices/attempts/t098-visual-active/runner/'}},waiting:empty?[]:[{kind:'TEACHER_REVIEW',title:'句子理解',reason:'这项练习正在等待老师复核。'}],legacyTasks:empty?[]:[{assignmentId:courses[0].assignmentId,title:courses[0].title,courseTitle:'语文朗读',progressPercent:25,dueAt:'2026-11-01T09:00:00Z'}],summary:{latestFormalAssessment:empty?null:{level:'水平一',score:74,completedAt:points[2].completedAt}}}),
    listStudentCourses:async (filters={})=>{
      window.__visualCalls.push({method:'listStudentCourses',filters});
      let list=empty?[]:courses.filter(c=>(!filters.search||c.title.includes(filters.search))&&(!filters.gradeBand||c.gradeBand===filters.gradeBand)&&(!filters.capabilityTheme||c.capabilityTheme===filters.capabilityTheme));
      if(filters.sortBy==='popularity') list=[...list].reverse();
      const start=filters.cursor?12:0;
      return result({courses:list.slice(start,start+(filters.limit||12)),total:list.length,categories:['READING','CLASSICS','LISTENING'],gradeBands:['JUNIOR'],difficulties:['基础'],nextCursor:list.length>12&&!start?'page2':null,hasMore:list.length>12&&!start});
    },
    addCourseFavorite:async id=>{courses.find(c=>c.assignmentId===id).isFavorite=true;window.__visualCalls.push({method:'addCourseFavorite',id});return {isFavorite:true};},
    removeCourseFavorite:async id=>{courses.find(c=>c.assignmentId===id).isFavorite=false;window.__visualCalls.push({method:'removeCourseFavorite',id});return {isFavorite:false};},
    listPractices:()=>result({items:empty?[]:[practice]}),listAssessmentSessions:()=>result({items:attempts,nextCursor:null,hasMore:false}),
    getPracticeAttempt:async id=>({...attempts.find(a=>a.id===id),id,practiceDefinitionId:practice.id,courseSubmissionId:null,courseActivityId:null}),
    getPracticeAttemptItems:async ()=>({items:[{status:'ANSWERED'},{status:'CREATED'},{status:'CREATED'}]}),
    getAssessmentHistory:()=>result({enrollmentId,sessions:history}),
    getAssessmentHistoryEvents:()=>result({enrollmentId,events:empty?[]:[feedback,{id:'t098-visual-completed',type:'ASSESSMENT_COMPLETED',title:'完成水平一正式测评',description:'正式结果已生成，可查看对应报告。',timestamp:points[2].completedAt}]}),
    getQuestionBankProgress:()=>result({version:'qb-progress-v1',state:empty?'EMPTY_STATE':'READY',formalLevels:empty?[]:[{level:'水平一',attempts:points,latestCompletedAt:points[2].completedAt}],remediation:[],milestones:[],latest:empty?null:{level:'水平一',formal:{completedAt:points[2].completedAt,latestVsPrevious:6}}}),
    getAssessmentSession:async id=>({id,schoolId,enrollmentId,purpose:'STANDARD',status:'COMPLETED',completedAt:history.find(s=>s.sessionId===id)?.completedAt}),
    getAssessmentReport:async id=>({id:'report-'+id,sessionId:id,schoolId,overallScore:history.find(s=>s.sessionId===id)?.metrics?.overall??null,dataCompleteness:100,generatedAt:'2026-10-18T09:05:00Z',summary:{},diagnosis:{retryCandidates:id==='t098-formal-3'?[{questionVersionId:'t098-visual-question',family:'句子理解',displayName:'句子理解'}]:[]},teacherFeedback:[{comment:feedback.description,reviewedAt:feedback.timestamp}]})
  };
})();
