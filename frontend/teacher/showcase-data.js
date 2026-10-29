(() => {
  'use strict';
  const records = [
    {id:'course-spring',title:'《春》生字认读与易错音纠正',description:'在春日散文的朗读中，读准易错字音，理解词语在语境中的表达。',theme:'发音与朗读',cover:'course-spring-reading.png',minutes:35,objectives:['读准重点字词与多音字','运用停顿和重音朗读句子','在表达中感受春天的画面'],activities:[['AUDIO','听读：感受春天','聆听示范，圈出难读的词语'],['CHOICE','字音辨析','辨别多音字在不同语境中的读音'],['SPEECH','分句朗读','练习语句的停顿、换气与重音'],['QUIZ','春天里的声音','完成听辨与字音巩固练习']]},
    {id:'course-poetry',title:'古诗词诵读：听见诗的节奏',description:'从字音、节奏到情感表达，在诵读中体会古诗词的韵律与意境。',theme:'古诗文',cover:'course-poetry-rhythm.png',minutes:30,objectives:['读准诗词字音','把握停顿与朗读节奏','结合画面表达诗词情感'],activities:[['AUDIO','聆听诗词示范','感受诗句节奏与语气'],['TEXT','走进诗词画面','理解关键词语与写作背景'],['SPEECH','跟读与诵读','用自己的节奏完成朗读'],['QUIZ','诗词理解练习','在选择与表达中巩固学习']]},
    {id:'course-listening',title:'现代文听说：信息提取与复述',description:'从短文中抓住人物、事件和因果信息，再用自己的语言有条理地复述。',theme:'听说理解',cover:'course-listening-retell.png',minutes:30,objectives:['提取材料中的关键信息','使用关键词整理复述提纲','用完整语句有条理地表达'],activities:[['AUDIO','带着问题听材料','记录时间、地点与主要事件'],['CHOICE','提取关键信息','根据材料选择正确的信息'],['FILL_BLANK','整理复述提纲','补全人物、地点与事件'],['SPEECH','完成口头复述','根据提纲组织完整表达']]},
    {id:'course-vowels',title:'韵母、声调与普通话节奏',description:'通过听辨、跟读和录音练习，建立清晰自然的普通话语音节奏。',theme:'发音基础',cover:'course-vowel-rhythm.png',minutes:25,objectives:['区分常见韵母','听辨并读准四声','在短句中保持自然节奏'],activities:[['AUDIO','听辨韵母','听一听不同韵母的发音'],['CHOICE','声调辨别','选择听到的词语声调'],['SPEECH','短句跟读','模仿并录下自然的语音节奏'],['QUIZ','发音巩固练习','完成听辨与跟读训练']]},
    {id:'course-initials',title:'声母发音与口型基础',description:'观察口型，听辨形近音，逐步掌握常用声母的发音方法。',theme:'发音基础',cover:'course-initials-mouth.png',minutes:25,objectives:['观察常用声母的口型','区分易混淆声母','在词语和短句中运用'],activities:[['VIDEO','看口型学发音','观察发音位置与气流'],['AUDIO','听辨易混音','分辨容易混淆的声母'],['SPEECH','词语跟读','练习词语中的清晰发音'],['QUIZ','声母专项练习','完成听辨和发音巩固']]},
    {id:'course-winter',title:'藏汉冬日民俗对对碰',description:'从熟悉的冬日生活出发，认识藏汉民俗并练习描述与分享。',theme:'文化理解',cover:'course-listening-retell.png',minutes:40,objectives:['了解不同地区的冬日习俗','积累描述民俗的词语','清晰分享熟悉的生活经验'],activities:[['VIDEO','走进冬日生活','观察节日与日常的画面'],['TEXT','民俗词语积累','学习描述习俗的关键词'],['CHOICE','文化对对碰','理解不同习俗的异同'],['SPEECH','说说我的家乡','分享一种熟悉的冬日习俗']]}
  ];
  const courses=records.map(c=>({...c,courseId:c.id,version:1,status:'PUBLISHED',gradeBand:'七年级',detail:{...c,capabilityTheme:c.theme,estimatedMinutes:c.minutes,coverAsset:'/assets/generated-covers/'+c.cover,units:[{title:'核心学习路径',lessons:[{title:'观察、理解与表达',activities:c.activities.map((a,i)=>({id:c.id+'-'+i,type:a[0],title:a[1],instruction:{text:a[2]},required:true,practiceReference:a[0]==='QUIZ'?{title:a[1]}:null}))}]}]}}));
  const classes=[{id:'class-7-2',name:'七年级二班',grade:'七年级',studentCount:32},{id:'class-7-1',name:'七年级一班',grade:'七年级',studentCount:30}];
  const dateOffset = days => {const d=new Date();d.setHours(18,0,0,0);d.setDate(d.getDate()+days);return d.toISOString();};
  const starter=[
    {id:'task-spring',courseVersionId:'course-spring',title:'《春》生字与朗读练习',classId:'class-7-2',status:'OPEN',startsAt:dateOffset(-7),dueAt:dateOffset(2),total:32,submitted:28,reviewed:22},
    {id:'task-listen',courseVersionId:'course-listening',title:'听一听，讲述一段故事',classId:'class-7-2',status:'OPEN',startsAt:dateOffset(-5),dueAt:dateOffset(5),total:32,submitted:24,reviewed:18},
    {id:'task-poetry',courseVersionId:'course-poetry',title:'古诗词朗读与节奏练习',classId:'class-7-1',status:'OPEN',startsAt:dateOffset(-4),dueAt:dateOffset(7),total:30,submitted:20,reviewed:15},
    {id:'task-vowels',courseVersionId:'course-vowels',title:'韵母与声调专项巩固',classId:'class-7-2',status:'DRAFT',startsAt:dateOffset(0),dueAt:dateOffset(10),total:32,submitted:0,reviewed:0},
    {id:'task-winter',courseVersionId:'course-winter',title:'说说家乡的冬日习俗',classId:'class-7-1',status:'CLOSED',startsAt:dateOffset(-20),dueAt:dateOffset(-4),total:30,submitted:29,reviewed:29}
  ];
  const key='yuzan-teacher-showcase-tasks-v1';
  function tasks(){try{const data=JSON.parse(localStorage.getItem(key));if(Array.isArray(data))return data;}catch{}return starter.map(x=>({...x}));}
  function save(items){localStorage.setItem(key,JSON.stringify(items));}
  window.YuzanShowcase={courses,classes,tasks,save};
})();
