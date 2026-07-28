import { describe, expect, it } from 'vitest';

import {
  ASK_USER_CUSTOM_VALUE,
  buildAskUserSubmitPayload,
  buildSelectionPayload,
  canSubmitAllQuestions,
  canSubmitSelection,
  createInitialSelectionState,
  normalizeAskUserQuestions,
  normalizeQuestionSelection,
  resolveRecommendedValue,
} from './askUserQuestionTypes';

describe('askUserQuestionTypes', () => {
  it('normalizes question.selection with options', () => {
    expect(
      normalizeQuestionSelection({
        selection: {
          mode: 'multiple',
          options: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        },
      }),
    ).toMatchObject({
      mode: 'multiple',
      allowCustomInput: true,
    });
  });

  it('resolves recommendedValue from option.recommended', () => {
    expect(
      resolveRecommendedValue({
        mode: 'single',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b', recommended: true },
        ],
      }),
    ).toBe('b');
  });

  it('prefers explicit recommendedValue over option flag', () => {
    expect(
      resolveRecommendedValue({
        mode: 'single',
        recommendedValue: 'a',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b', recommended: true },
        ],
      }),
    ).toBe('a');
  });

  it('preselects recommended option for single mode', () => {
    expect(
      createInitialSelectionState({
        mode: 'single',
        recommendedValue: 'staging',
        options: [
          { label: 'Staging', value: 'staging' },
          { label: 'Production', value: 'production' },
        ],
      }),
    ).toEqual({
      selectedValues: ['staging'],
      customSelected: false,
      customInput: '',
    });
  });

  it('normalizes questions array with ids', () => {
    expect(
      normalizeAskUserQuestions({
        title: '部署确认',
        questions: [
          {
            id: 'env',
            prompt: '部署到哪个环境？',
            selection: {
              mode: 'single',
              recommendedValue: 'staging',
              options: [
                { label: 'Staging', value: 'staging' },
                { label: 'Production', value: 'production' },
              ],
            },
          },
          {
            prompt: '是否立即发布？',
            selection: {
              mode: 'single',
              recommendedValue: 'no',
              options: [
                { label: '是', value: 'yes' },
                { label: '否', value: 'no' },
              ],
            },
          },
        ],
      }),
    ).toMatchObject({
      title: '部署确认',
      questions: [
        { id: 'env', prompt: '部署到哪个环境？' },
        { id: 'q2', prompt: '是否立即发布？' },
      ],
    });
  });

  it('falls back to legacy single question', () => {
    expect(
      normalizeAskUserQuestions({
        question: {
          prompt: 'Which env?',
          fields: [{ key: 'env', label: 'Env' }],
        },
      }).questions,
    ).toHaveLength(1);
  });

  it('normalizes legacy fields with multi_select kind', () => {
    expect(
      normalizeQuestionSelection({
        fields: [
          {
            key: 'env',
            label: '环境',
            kind: 'multi_select',
            options: [
              { label: 'Staging', value: 'staging' },
              { label: 'Production', value: 'production' },
            ],
          },
        ],
      }),
    ).toMatchObject({ mode: 'multiple' });
  });

  it('builds single-select payload with custom input', () => {
    expect(
      buildSelectionPayload({
        mode: 'single',
        selectedValues: [],
        customInput: '自建环境',
        customSelected: true,
      }),
    ).toEqual({
      mode: 'single',
      selected: [ASK_USER_CUSTOM_VALUE],
      customInput: '自建环境',
    });
  });

  it('builds batch payload for multiple questions', () => {
    const questions = normalizeAskUserQuestions({
      questions: [
        {
          id: 'env',
          prompt: '环境？',
          selection: {
            mode: 'single',
            recommendedValue: 'staging',
            options: [
              { label: 'Staging', value: 'staging' },
              { label: 'Production', value: 'production' },
            ],
          },
        },
        {
          id: 'release',
          prompt: '发布？',
          selection: {
            mode: 'single',
            recommendedValue: 'no',
            options: [
              { label: '是', value: 'yes' },
              { label: '否', value: 'no' },
            ],
          },
        },
      ],
    }).questions;

    expect(
      buildAskUserSubmitPayload({
        questions,
        selectionStates: {
          env: { selectedValues: ['staging'], customSelected: false, customInput: '' },
          release: { selectedValues: ['no'], customSelected: false, customInput: '' },
        },
        formDataByQuestion: {},
      }),
    ).toEqual({
      mode: 'batch',
      answers: {
        env: { mode: 'single', selected: ['staging'] },
        release: { mode: 'single', selected: ['no'] },
      },
    });
  });

  it('keeps legacy single-question payload shape', () => {
    const questions = normalizeAskUserQuestions({
      question: {
        prompt: '环境？',
        selection: {
          mode: 'single',
          recommendedValue: 'staging',
          options: [
            { label: 'Staging', value: 'staging' },
            { label: 'Production', value: 'production' },
          ],
        },
      },
    }).questions;

    expect(
      buildAskUserSubmitPayload({
        questions,
        selectionStates: {
          q1: { selectedValues: ['staging'], customSelected: false, customInput: '' },
        },
        formDataByQuestion: {},
      }),
    ).toEqual({ mode: 'single', selected: ['staging'] });
  });

  it('requires all questions answered before submit', () => {
    const questions = normalizeAskUserQuestions({
      questions: [
        {
          id: 'a',
          prompt: 'A?',
          selection: {
            mode: 'single',
            recommendedValue: 'x',
            options: [
              { label: 'X', value: 'x' },
              { label: 'Y', value: 'y' },
            ],
          },
        },
        {
          id: 'b',
          prompt: 'B?',
          selection: {
            mode: 'single',
            recommendedValue: 'p',
            options: [
              { label: 'P', value: 'p' },
              { label: 'Q', value: 'q' },
            ],
          },
        },
      ],
    }).questions;

    expect(
      canSubmitAllQuestions({
        questions,
        selectionStates: {
          a: { selectedValues: ['x'], customSelected: false, customInput: '' },
          b: { selectedValues: [], customSelected: false, customInput: '' },
        },
        formDataByQuestion: {},
      }),
    ).toBe(false);
  });

  it('builds multi-select payload with presets and custom', () => {
    expect(
      buildSelectionPayload({
        mode: 'multiple',
        selectedValues: ['staging', 'production'],
        customInput: '灰度',
        customSelected: true,
      }),
    ).toEqual({
      mode: 'multiple',
      selected: ['staging', 'production', ASK_USER_CUSTOM_VALUE],
      customInput: '灰度',
    });
  });

  it('requires at least one choice before submit', () => {
    expect(
      canSubmitSelection({
        mode: 'single',
        selectedValues: [],
        customInput: '',
        customSelected: false,
      }),
    ).toBe(false);
    expect(
      canSubmitSelection({
        mode: 'multiple',
        selectedValues: ['a', 'b'],
        customInput: '',
        customSelected: false,
      }),
    ).toBe(true);
  });
});
