(function () {
  'use strict';

  var nextId = 0;

  function normalize(value) {
    if (typeof value === 'string') {
      return {
        originalText: value,
        translation: '',
        locale: '',
        translationLocale: '',
        translationSource: '',
        reviewStatus: ''
      };
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        originalText: '',
        translation: '',
        locale: '',
        translationLocale: '',
        translationSource: '',
        reviewStatus: ''
      };
    }
    return {
      originalText: typeof value.originalText === 'string' ? value.originalText : '',
      translation: typeof value.translation === 'string' ? value.translation : '',
      locale: typeof value.locale === 'string' ? value.locale : '',
      translationLocale: typeof value.translationLocale === 'string' ? value.translationLocale : '',
      translationSource: typeof value.translationSource === 'string' ? value.translationSource : '',
      reviewStatus: typeof value.reviewStatus === 'string' ? value.reviewStatus : ''
    };
  }

  function hasReviewedTibetanTranslation(value) {
    var content = normalize(value);
    return Boolean(
      content.originalText.trim() &&
      content.translation.trim() &&
      /^zh(?:-|$)/i.test(content.locale.trim()) &&
      /^bo(?:-|$)/i.test(content.translationLocale.trim()) &&
      content.reviewStatus === 'EXPERT_CONFIRMED' &&
      (content.translationSource === 'EXPERT' || content.translationSource === 'COMMUNITY')
    );
  }

  function render(container, value, className) {
    if (!container) return;
    var content = normalize(value);
    container.textContent = '';
    if (!content.originalText) return;

    var original = document.createElement('span');
    original.className = 'cp-bilingual-original';
    original.textContent = content.originalText;
    container.appendChild(original);

    if (!hasReviewedTibetanTranslation(value)) return;

    var id = 'cpTibetanSupport-' + (++nextId);
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'cp-bilingual-toggle';
    button.textContent = '查看藏语辅助说明';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', id);

    var translation = document.createElement('div');
    translation.className = 'cp-bilingual-translation';
    if (className) translation.classList.add(className);
    translation.id = id;
    translation.hidden = true;
    translation.lang = content.translationLocale;
    translation.dir = 'auto';
    translation.textContent = content.translation;

    button.addEventListener('click', function () {
      var expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      translation.hidden = expanded;
      button.textContent = expanded ? '查看藏语辅助说明' : '收起藏语辅助说明';
    });

    container.appendChild(button);
    container.appendChild(translation);
  }

  window.CourseBilingualContent = {
    normalize: normalize,
    normalizeList: function (value) {
      return Array.isArray(value) ? value.map(normalize) : [];
    },
    originalText: function (value) {
      return normalize(value).originalText;
    },
    hasReviewedTibetanTranslation: hasReviewedTibetanTranslation,
    render: render
  };
})();
