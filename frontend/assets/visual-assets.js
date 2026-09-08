(() => {
  'use strict';

  const root = '/assets/generated-covers/';
  const courseRules = [
    { terms: ['《春》', '生字', '易错音', '发音与朗读'], asset: 'course-spring-reading.png' },
    { terms: ['现代文', '听说', '信息提取', '复述'], asset: 'course-listening-retell.png' },
    { terms: ['古诗', '诗文', '停顿', '情感'], asset: 'course-poetry-rhythm.png' },
    { terms: ['韵母', '声调', '节奏'], asset: 'course-vowel-rhythm.png' },
    { terms: ['声母', '口型', '发音基础'], asset: 'course-initials-mouth.png' },
  ];
  const practiceRules = [
    { terms: ['听辨', '听音', '听后', '听写'], asset: 'practice-listening.png' },
    { terms: ['跟读', '模仿'], asset: 'practice-shadowing.png' },
    { terms: ['停顿', '节奏', '古诗', '诗文', '独立朗读'], asset: 'course-poetry-rhythm.png' },
    { terms: ['阅读', '朗读'], asset: 'practice-reading.png' },
    { terms: ['口语', '交际', '复述', '说话'], asset: 'practice-speaking.png' },
    { terms: ['书面', '写作', '写', '句子补全'], asset: 'practice-writing.png' },
  ];

  function textOf(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    return [value.title, value.name, value.capabilityTheme, value.summary, value.description, ...(value.abilityCategories || [])]
      .filter(Boolean)
      .join(' ');
  }

  function pick(value, rules, fallback) {
    const text = textOf(value);
    const match = rules.find((rule) => rule.terms.some((term) => text.includes(term)));
    return root + (match?.asset || fallback);
  }

  window.YuzanVisualAssets = {
    courseCover(value, fallback = 'course-spring-reading.png') {
      return pick(value, courseRules, fallback);
    },
    practiceCover(value, fallback = 'practice-reading.png', index) {
      const orderedAssets = ['practice-listening.png', 'practice-shadowing.png', 'practice-reading.png', 'practice-speaking.png', 'practice-writing.png'];
      if (Number.isInteger(index) && index >= 0 && index < orderedAssets.length) return root + orderedAssets[index];
      return pick(value, practiceRules, fallback);
    },
  };
})();
