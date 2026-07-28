import { describe, expect, it } from 'vitest';
import {
  detectDailyInputMode,
  isAiSummaryOnlyItem,
  mapAiSummaryToBriefItem,
  resolveRawDescription,
  isDescriptionDuplicateOfAiSummary
} from '../src/utils/dailyInputMode.js';

const aiSummaryText =
  'OpenAI于2024年7月18日正式发布GPT-4o-mini，这是其新的旗舰小型模型，旨在取代GPT-3.5 Turbo。';

const aiOnlyItem = {
  index: 1,
  title: 'GPT-4o mini 发布',
  url: 'https://example.com/gpt4o-mini',
  source: 'OpenAI Blog',
  description: '',
  metadata: { ai_summary: aiSummaryText, ai_score: 85 }
};

const duplicateDescItem = {
  index: 2,
  title: 'Another item',
  description: aiSummaryText,
  metadata: { ai_summary: aiSummaryText }
};

const originalItem = {
  index: 3,
  title: 'Long article',
  description: '这是一段很长的原文正文内容。'.repeat(30),
  metadata: {}
};

describe('dailyInputMode', () => {
  describe('isAiSummaryOnlyItem', () => {
    it('returns true for items with only ai_summary', () => {
      expect(isAiSummaryOnlyItem(aiOnlyItem)).toBe(true);
    });

    it('returns false for items with original description', () => {
      expect(isAiSummaryOnlyItem(originalItem)).toBe(false);
    });
  });

  describe('detectDailyInputMode', () => {
    it('detects ai_summary mode', () => {
      expect(detectDailyInputMode([aiOnlyItem])).toBe('ai_summary');
    });

    it('detects original mode', () => {
      expect(detectDailyInputMode([originalItem])).toBe('original');
    });

    it('detects mixed mode', () => {
      expect(detectDailyInputMode([aiOnlyItem, originalItem])).toBe('mixed');
    });
  });

  describe('mapAiSummaryToBriefItem', () => {
    it('reuses ai_summary as source_summary', () => {
      const brief = mapAiSummaryToBriefItem(aiOnlyItem, 0);
      expect(brief.source_summary).toBe(aiSummaryText);
      expect(brief.index).toBe(1);
    });
  });

  describe('isDescriptionDuplicateOfAiSummary', () => {
    it('returns true when description matches ai_summary', () => {
      expect(isDescriptionDuplicateOfAiSummary(aiSummaryText, aiSummaryText)).toBe(true);
    });
  });

  describe('resolveRawDescription', () => {
    it('hides duplicate description in preview', () => {
      expect(resolveRawDescription(duplicateDescItem)).toBeFalsy();
    });

    it('keeps original description', () => {
      expect(resolveRawDescription(originalItem).length).toBeGreaterThan(0);
    });
  });
});
