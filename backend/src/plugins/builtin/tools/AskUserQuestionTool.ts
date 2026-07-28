import { BaseTool } from '../../base/BaseTool.js';

const questionOptionSchema = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    value: { type: 'string' },
    description: { type: 'string' },
    recommended: {
      type: 'boolean',
      description: 'When true, marks this option as the model recommendation (single mode only).',
    },
  },
  required: ['label', 'value'],
};

const questionItemSchema = {
  type: 'object',
  description: 'One question shown in the Console intervention UI.',
  properties: {
    id: {
      type: 'string',
      description: 'Stable id for batch answers. Auto-generated from index when omitted.',
    },
    prompt: { type: 'string', description: 'Primary question text.' },
    description: { type: 'string', description: 'Optional helper text.' },
    selection: {
      type: 'object',
      description:
        'Preferred shape: preset options (min 2) plus optional custom input. Supports single or multiple selection.',
      properties: {
        mode: {
          type: 'string',
          enum: ['single', 'multiple'],
          description: 'single = pick one option; multiple = pick one or more.',
        },
        options: {
          type: 'array',
          minItems: 2,
          items: questionOptionSchema,
          description: 'At least two preset choices.',
        },
        recommendedValue: {
          type: 'string',
          description:
            'Optional (single mode): value of the option you recommend. Must match one of options[].value when set.',
        },
        allowCustomInput: {
          type: 'boolean',
          description: 'When true (default), user can type a custom answer in addition to presets.',
        },
        customInputLabel: {
          type: 'string',
          description: 'Label for the custom input row, e.g. "其他（请说明）".',
        },
        customInputPlaceholder: { type: 'string' },
        minSelections: {
          type: 'number',
          description: 'Minimum selections required (multiple mode). Default 1.',
        },
        maxSelections: {
          type: 'number',
          description: 'Maximum selections allowed (multiple mode).',
        },
      },
      required: ['options'],
    },
    fields: {
      type: 'array',
      description: 'Legacy/advanced: additional text fields or field-based option lists.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          required: { type: 'boolean' },
          kind: {
            type: 'string',
            description: 'single_select | multi_select | text',
          },
          placeholder: { type: 'string' },
          allowCustomInput: { type: 'boolean' },
          customInputLabel: { type: 'string' },
          options: {
            type: 'array',
            minItems: 2,
            items: questionOptionSchema,
          },
        },
        required: ['key', 'label'],
      },
    },
  },
  required: ['prompt'],
};

export class AskUserQuestionTool extends BaseTool {
  readonly id = 'ask_user_question';
  readonly name = 'ask_user_question';
  readonly displayName = '向用户提问';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '暂停当前 Agent 运行，在 Console 干预界面向用户展示选择题和/或自定义输入，阻塞直至用户回复。' +
    '需要用户决策、确认偏好或澄清歧义时调用；勿用于可从上下文直接推断的信息。' +
    '每次调用可传 questions 数组同时问多个问题（推荐）；也兼容单个 question。' +
    '选择题须 selection.options（至少 2 项），mode 为 single 或 multiple；' +
    '单选时可选标注推荐项：selection.recommendedValue 或某一 option 的 recommended: true，由你自行判断是否需要；' +
    'allowCustomInput 默认为 true，允许用户输入自定义答案。';
  readonly parameters = {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Optional heading when asking multiple questions in one call.',
      },
      questions: {
        type: 'array',
        minItems: 1,
        items: questionItemSchema,
        description: 'Preferred: one or more questions to ask in a single intervention.',
      },
      question: {
        ...questionItemSchema,
        description: 'Legacy: single question. Prefer questions[] for new calls.',
      },
    },
  };

  async handler(): Promise<never> {
    throw new Error('ask_user_question is resumed with user input; direct execution is not supported.');
  }
}
