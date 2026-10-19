(function installYuzanBilingualRenderer(root, factory) {
  const renderer = factory();
  if (root) root.YuzanBilingualRenderer = renderer;
  if (typeof module === 'object' && module.exports) module.exports = renderer;
})(typeof window !== 'undefined' ? window : globalThis, function createYuzanBilingualRenderer() {
  'use strict';

  const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const textValue = (value) => typeof value === 'string' ? value : '';
  const languageMatches = (locale, language) => new RegExp(`^${language}(?:-|$)`, 'i').test(textValue(locale).trim());
  let nextPanelId = 0;

  function normalize(value, seen = new Set()) {
    if (typeof value === 'string') {
      return { originalText: value, locale: '', translation: '', translationLocale: '', translationSource: '', reviewStatus: '' };
    }
    if (!isRecord(value) || seen.has(value)) {
      return { originalText: '', locale: '', translation: '', translationLocale: '', translationSource: '', reviewStatus: '' };
    }

    seen.add(value);
    let originalOwner = value;
    let originalText = textValue(value.originalText);
    if (!owns(value, 'originalText')) {
      originalOwner = null;
      for (const key of ['text', 'body', 'instruction', 'value', 'content']) {
        const nested = value[key];
        if (typeof nested === 'string' && nested.trim()) {
          originalOwner = value;
          originalText = nested;
          break;
        }
        if (isRecord(nested)) {
          const candidate = normalize(nested, seen);
          if (candidate.originalText.trim()) {
            originalOwner = nested;
            originalText = candidate.originalText;
            break;
          }
        }
      }
    }

    const field = (key) => owns(value, key) ? value[key] : originalOwner && owns(originalOwner, key) ? originalOwner[key] : undefined;
    return {
      originalText,
      locale: textValue(field('locale')),
      translation: textValue(field('translation')),
      translationLocale: textValue(field('translationLocale')),
      translationSource: textValue(field('translationSource')),
      reviewStatus: textValue(field('reviewStatus')),
    };
  }

  function originalText(value) {
    return normalize(value).originalText;
  }

  function hasApprovedTranslation(value) {
    const normalized = normalize(value);
    return Boolean(
      normalized.originalText.trim() &&
      normalized.translation.trim() &&
      languageMatches(normalized.locale, 'zh') &&
      languageMatches(normalized.translationLocale, 'bo') &&
      normalized.reviewStatus === 'EXPERT_CONFIRMED' &&
      (normalized.translationSource === 'EXPERT' || normalized.translationSource === 'COMMUNITY'),
    );
  }

  function createAssist(parent, value, options = {}) {
    if (!hasApprovedTranslation(value)) return null;
    const normalized = normalize(value);
    const document = parent.ownerDocument;
    const controls = document.createElement('div');
    controls.className = ['bilingual-controls', options.controlsClassName].filter(Boolean).join(' ');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bilingual-toggle';
    button.textContent = '查看藏语辅助说明';
    button.setAttribute('aria-expanded', 'false');
    const panel = document.createElement('div');
    panel.className = 'bilingual-help-panel';
    panel.id = `bilingual-help-${++nextPanelId}`;
    panel.hidden = true;
    panel.lang = 'bo';
    panel.dir = 'auto';
    panel.setAttribute('aria-label', '已审核藏语辅助说明');
    const translatedText = document.createElement('span');
    translatedText.className = 'bilingual-help-text';
    translatedText.textContent = normalized.translation;
    panel.appendChild(translatedText);
    button.setAttribute('aria-controls', panel.id);

    const badge = document.createElement('span');
    badge.className = 'bilingual-badge';
    badge.textContent = '已审核藏语辅助';
    controls.append(button, badge);
    parent.append(controls, panel);

    const setExpanded = (expanded) => {
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      panel.hidden = !expanded;
    };
    button.addEventListener('click', () => setExpanded(button.getAttribute('aria-expanded') !== 'true'));
    controls.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || button.getAttribute('aria-expanded') !== 'true') return;
      event.preventDefault();
      setExpanded(false);
      button.focus();
    });
    return { button, panel, badge };
  }

  function appendBilingualText(parent, value, options = {}) {
    if (!parent) return null;
    const normalized = normalize(value);
    if (!normalized.originalText.trim()) return null;
    const document = parent.ownerDocument;
    const wrapper = document.createElement(options.wrapperTagName || 'div');
    wrapper.className = ['bilingual-field', options.className].filter(Boolean).join(' ');
    const original = document.createElement(options.tagName || 'span');
    original.className = ['bilingual-original', options.originalClassName].filter(Boolean).join(' ');
    original.textContent = normalized.originalText;
    if (languageMatches(normalized.locale, 'zh')) original.lang = normalized.locale.trim();
    wrapper.appendChild(original);
    const assist = createAssist(wrapper, value, options);
    parent.appendChild(wrapper);
    return { wrapper, original, assist };
  }

  function appendTranslationAssist(parent, value, options = {}) {
    return parent ? createAssist(parent, value, options) : null;
  }

  function subtitleResources(resources) {
    if (!Array.isArray(resources)) return [];
    return resources.flatMap((resource) => {
      if (!isRecord(resource) || typeof resource.id !== 'string' || !resource.id.trim()) return [];
      if (String(resource.kind || '').toUpperCase() !== 'SUBTITLE' || resource.rightsStatus !== 'APPROVED') return [];
      if (!/^text\/vtt(?:\s*;|$)/i.test(textValue(resource.mediaType).trim())) return [];
      const language = textValue(resource.language).trim();
      if (languageMatches(language, 'zh')) return [{ resource, language, translation: false }];
      if (
        languageMatches(language, 'bo') &&
        languageMatches(resource.locale, 'zh') &&
        languageMatches(resource.translationLocale, 'bo') &&
        resource.reviewStatus === 'EXPERT_CONFIRMED' &&
        (resource.translationSource === 'EXPERT' || resource.translationSource === 'COMMUNITY')
      ) {
        return [{ resource, language, translation: true }];
      }
      return [];
    });
  }

  return {
    appendBilingualText,
    appendTranslationAssist,
    hasApprovedTranslation,
    normalize,
    originalText,
    subtitleResources,
  };
});
