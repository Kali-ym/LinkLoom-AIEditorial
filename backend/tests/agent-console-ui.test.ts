import { describe, expect, it } from 'vitest';

import { mergeAgentConsoleUiMetadata } from '../src/services/editorial/agentConsoleUi.js';

describe('mergeAgentConsoleUiMetadata', () => {
  it('fills missing ui fields from defaults', () => {
    const merged = mergeAgentConsoleUiMetadata({}, {
      welcome: 'Hello',
      openingQuestions: ['Q1'],
      gradient: 'linear-gradient(red, blue)',
    });

    expect(merged?.ui).toEqual({
      welcome: 'Hello',
      openingQuestions: ['Q1'],
      gradient: 'linear-gradient(red, blue)',
    });
  });

  it('preserves existing ui values over defaults', () => {
    const merged = mergeAgentConsoleUiMetadata(
      {
        ui: {
          welcome: 'Custom welcome',
          openingQuestions: ['Custom Q'],
        },
      },
      {
        welcome: 'Default welcome',
        openingQuestions: ['Default Q'],
        gradient: 'linear-gradient(red, blue)',
      },
    );

    expect(merged?.ui).toEqual({
      welcome: 'Custom welcome',
      openingQuestions: ['Custom Q'],
      gradient: 'linear-gradient(red, blue)',
    });
  });

  it('still fills missing ui when agent metadata is customized', () => {
    const merged = mergeAgentConsoleUiMetadata(
      {
        customized: true,
        ui: {},
      },
      {
        welcome: 'Default welcome',
        openingQuestions: ['Q1'],
      },
    );

    expect(merged?.ui).toEqual({
      welcome: 'Default welcome',
      openingQuestions: ['Q1'],
    });
  });

  it('preserves customized ui values over defaults', () => {
    const existing = {
      customized: true,
      ui: { welcome: 'Kept' },
    };

    const merged = mergeAgentConsoleUiMetadata(existing, {
      welcome: 'Default',
      openingQuestions: ['Q1'],
    });

    expect(merged?.ui).toEqual({
      welcome: 'Kept',
      openingQuestions: ['Q1'],
    });
  });
});
