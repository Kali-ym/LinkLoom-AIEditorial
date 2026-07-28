import { describe, expect, it } from 'vitest';
import {
  categoryToLegacyTopic,
  mapLegacyTopicToCategory,
  FEED_CATEGORIES
} from '../src/config/feedCategories.js';

describe('feedCategories', () => {
  it('exposes six categories', () => {
    expect(FEED_CATEGORIES).toHaveLength(6);
    expect(FEED_CATEGORIES.map((c) => c.id)).toEqual([
      'model_weights',
      'agent_tools',
      'train_infra',
      'product_biz',
      'safety_gov',
      'research_eval'
    ]);
  });

  it('maps legacy aihot topics', () => {
    expect(mapLegacyTopicToCategory('model')).toBe('model_weights');
    expect(mapLegacyTopicToCategory('product')).toBe('product_biz');
    expect(mapLegacyTopicToCategory('industry')).toBe('product_biz');
    expect(mapLegacyTopicToCategory('paper')).toBe('research_eval');
    expect(mapLegacyTopicToCategory('practice')).toBe('agent_tools');
  });

  it('maps category back to legacy topic', () => {
    expect(categoryToLegacyTopic('model_weights')).toBe('model');
    expect(categoryToLegacyTopic('agent_tools')).toBe('practice');
    expect(categoryToLegacyTopic('train_infra')).toBe('industry');
    expect(categoryToLegacyTopic('product_biz')).toBe('product');
    expect(categoryToLegacyTopic('safety_gov')).toBe('industry');
    expect(categoryToLegacyTopic('research_eval')).toBe('paper');
  });
});
