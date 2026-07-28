import { describe, expect, it } from 'vitest';
import { parseJsonLenient, sliceJsonPayload } from '../src/shared/json.js';
import { renderTemplate, runTransform } from '../src/services/agents/workflowExpressions.js';

describe('sliceJsonPayload', () => {
  it('ignores fenced non-JSON and finds object later in text', () => {
    const text = '```json\n(?:json)?|\n```\n{"items":[{"title":"A"}]}';
    expect(sliceJsonPayload(text)).toBe('{"items":[{"title":"A"}]}');
    expect(parseJsonLenient(text)).toEqual({ items: [{ title: 'A' }] });
  });

  it('still extracts valid fenced JSON', () => {
    const text = '```json\n{"items":[]}\n```';
    expect(parseJsonLenient(text)).toEqual({ items: [] });
  });
});

describe('workflow template rendering', () => {
  it('renders variables from generic scope without stringifying whole-value placeholders', () => {
    expect(
      renderTemplate(
        {
          key: 'daily_report_json:${start.date}',
          indexValue: '${start.date}',
          direct: '$.start.date',
          lookbackDays: '{{lookbackDays}}',
          embeddedLookbackDays: 'x-{{lookbackDays}}',
          dollarLookbackDays: '${input.lookbackDays}'
        },
        { start: { date: '2026-03-14' }, lookbackDays: 7, input: { lookbackDays: 14 } }
      )
    ).toEqual({
      key: 'daily_report_json:2026-03-14',
      indexValue: '2026-03-14',
      direct: '2026-03-14',
      lookbackDays: 7,
      embeddedLookbackDays: 'x-7',
      dollarLookbackDays: 14
    });
  });
});

describe('runTransform parseJson', () => {
  it('parses workflow items after bad markdown fence', () => {
    const input = '```json\n(?:json)?|\n```\n{"items":[{"title":"A"}]}';
    const out = runTransform(input, [{ op: 'parseJson' }], { input, current: input });
    expect(out).toEqual({ items: [{ title: 'A' }] });
  });

  it('throws a readable error for pure garbage', () => {
    expect(() => runTransform('(?:json)?|', [{ op: 'parseJson' }], {})).toThrow(
      /工作流输入不是合法 JSON/
    );
  });
});
