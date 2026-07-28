import type { PlanQuestion, PlanningQuestion } from '../../../services/agentService';

export type StructuredAnswer = { selectedOptionIds: string[]; customText: string };

export function questionId(question: string | PlanQuestion | PlanningQuestion, index: number) {
  return typeof question === 'string' ? `q_${index}` : question.id || `q_${index}`;
}

export function questionPrompt(question: string | PlanQuestion | PlanningQuestion) {
  return typeof question === 'string' ? question : question.prompt;
}

export function normalizeAnswer(value: unknown): StructuredAnswer {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as Partial<StructuredAnswer>;
    return {
      selectedOptionIds: Array.isArray(objectValue.selectedOptionIds) ? objectValue.selectedOptionIds : [],
      customText: typeof objectValue.customText === 'string' ? objectValue.customText : ''
    };
  }
  if (Array.isArray(value)) return { selectedOptionIds: value.map(String), customText: '' };
  if (typeof value === 'string' && value) return { selectedOptionIds: [value], customText: '' };
  if (typeof value === 'boolean') return { selectedOptionIds: [value ? 'yes' : 'no'], customText: '' };
  return { selectedOptionIds: [], customText: '' };
}

export function isQuestionAnswered(
  question: string | PlanQuestion | PlanningQuestion,
  index: number,
  answers: Record<string, unknown>
) {
  if (typeof question === 'string') {
    return Boolean(String(answers[questionId(question, index)] ?? '').trim());
  }
  const id = questionId(question, index);
  const value = normalizeAnswer(answers[id]);
  return value.selectedOptionIds.length > 0 || value.customText.trim().length > 0;
}

export function validateQuestionAnswer(
  question: string | PlanQuestion | PlanningQuestion,
  index: number,
  answers: Record<string, unknown>
) {
  if (typeof question === 'string') {
    const value = String(answers[questionId(question, index)] ?? '').trim();
    return value ? null : '这个问题必须回答';
  }
  if (!question.required) return null;
  const id = questionId(question, index);
  const value = normalizeAnswer(answers[id]);
  if (value.selectedOptionIds.length === 0 && !value.customText.trim()) {
    return '这个问题必须回答';
  }
  if (value.selectedOptionIds.includes('custom') && !value.customText.trim()) {
    return '选择自定义输入后，请补充具体内容';
  }
  return null;
}

export function questionOptions(question: string | PlanQuestion | PlanningQuestion) {
  if (typeof question === 'string') return [];
  if (question.options?.length) return question.options;
  if (question.type === 'confirm') {
    return [
      { id: 'yes', label: '是' },
      { id: 'no', label: '否' },
      { id: 'custom', label: '其他 / 自定义输入' }
    ];
  }
  return [];
}
