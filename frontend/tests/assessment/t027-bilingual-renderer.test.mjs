import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../../student/learn/spring-2/bilingual-renderer.js';

const renderer = globalThis.YuzanBilingualRenderer;

function reviewedTranslation(overrides = {}) {
  return {
    originalText: '山谷里的春风带来新芽。',
    translation: 'ལུང་པའི་ནང་གི་དཔྱིད་ཀའི་རླུང་གིས་མྱུ་གུ་གསར་པ་ཁྱེར་ཡོང་།',
    locale: 'zh-CN',
    translationLocale: 'bo-CN',
    translationSource: 'EXPERT',
    reviewStatus: 'EXPERT_CONFIRMED',
    ...overrides,
  };
}

test('plain strings normalize to originalText and never acquire translation metadata', () => {
  assert.deepEqual(renderer.normalize('春风越过山脊。'), {
    originalText: '春风越过山脊。',
    locale: '',
    translation: '',
    translationLocale: '',
    translationSource: '',
    reviewStatus: '',
  });
  assert.equal(renderer.hasApprovedTranslation('春风越过山脊。'), false);
});

test('nested body and text values resolve their original independently of translation', () => {
  assert.equal(renderer.originalText({ body: reviewedTranslation() }), '山谷里的春风带来新芽。');
  assert.equal(renderer.originalText({ instruction: { text: reviewedTranslation() } }), '山谷里的春风带来新芽。');
  assert.equal(renderer.originalText({ originalText: '', translation: 'མ་བསྒྱུར།' }), '');
  assert.equal(renderer.originalText({ translation: 'མ་བསྒྱུར།' }), '');
  assert.equal(renderer.originalText({ body: { translation: 'མ་བསྒྱུར།' } }), '');
  assert.equal(renderer.originalText({ body: { originalText: '<b>正文</b>' } }), '<b>正文</b>');
});

test('only expert-confirmed zh to bo expert or community translations are eligible', () => {
  for (const locale of ['zh', 'zh-CN']) {
    for (const translationLocale of ['bo', 'bo-CN']) {
      for (const translationSource of ['EXPERT', 'COMMUNITY']) {
        assert.equal(
          renderer.hasApprovedTranslation(reviewedTranslation({ locale, translationLocale, translationSource })),
          true,
          `${locale} -> ${translationLocale} from ${translationSource}`,
        );
      }
    }
  }
});

test('unreviewed, machine, wrong-language, or incomplete values keep Chinese only', () => {
  const rejected = [
    reviewedTranslation({ translationSource: 'AUTO' }),
    reviewedTranslation({ translationSource: 'NONE' }),
    reviewedTranslation({ translationSource: 'SCHOOL' }),
    reviewedTranslation({ reviewStatus: 'REVIEWED' }),
    reviewedTranslation({ reviewStatus: 'APPROVED' }),
    reviewedTranslation({ locale: 'bo-CN' }),
    reviewedTranslation({ locale: 'en-US' }),
    reviewedTranslation({ translationLocale: 'zh-CN' }),
    reviewedTranslation({ translationLocale: 'zh-CN' }),
    reviewedTranslation({ translation: '' }),
    reviewedTranslation({ originalText: '' }),
    reviewedTranslation({ translationLocale: undefined }),
    reviewedTranslation({ translationSource: undefined }),
    reviewedTranslation({ reviewStatus: undefined }),
    { originalText: '春风', translation: 'དཔྱིད་ཀའི་རླུང་།', locale: 'zh-CN', translationSource: 'EXPERT', reviewStatus: 'EXPERT_CONFIRMED' },
    null,
    undefined,
  ];
  for (const value of rejected) assert.equal(renderer.hasApprovedTranslation(value), false);
  assert.equal(renderer.originalText(reviewedTranslation({ reviewStatus: 'REVIEWED' })), '山谷里的春风带来新芽。');
});

test('subtitle tracks require an approved licensed WebVTT resource and exact Tibetan review metadata', () => {
  const source = {
    id: 'zh-subtitle', kind: 'SUBTITLE', mediaType: 'text/vtt', language: 'zh-CN', rightsStatus: 'APPROVED',
  };
  const reviewedBo = {
    id: 'bo-subtitle', kind: 'SUBTITLE', mediaType: 'text/vtt', language: 'bo-CN', rightsStatus: 'APPROVED',
    locale: 'zh-CN', translationLocale: 'bo-CN', translationSource: 'COMMUNITY', reviewStatus: 'EXPERT_CONFIRMED',
  };
  const notLicensed = { ...source, id: 'unknown-rights', rightsStatus: 'UNKNOWN' };
  const machineBo = { ...reviewedBo, id: 'machine-bo', translationSource: 'AUTO' };
  const wrongMedia = { ...reviewedBo, id: 'not-vtt', mediaType: 'video/mp4' };
  const selected = renderer.subtitleResources([source, reviewedBo, notLicensed, machineBo, wrongMedia]);
  assert.deepEqual(selected.map(({ resource, translation }) => [resource.id, translation]), [
    ['zh-subtitle', false],
    ['bo-subtitle', true],
  ]);
  assert.deepEqual(renderer.subtitleResources([{ ...reviewedBo, translationLocale: undefined }]), []);
  assert.deepEqual(renderer.subtitleResources([{ ...source, rightsStatus: 'RESTRICTED' }]), []);
  assert.deepEqual(renderer.subtitleResources([{ ...source, mediaType: 'text/plain' }]), []);
  assert.deepEqual(renderer.subtitleResources([]), []);
});
