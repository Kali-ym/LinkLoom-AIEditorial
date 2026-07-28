import type { PlanQuestion, PlanningQuestion } from '../../../services/agentService';

function answerText(raw: unknown) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const value = raw as { selectedOptionIds?: string[]; customText?: string };
    return [value.selectedOptionIds?.join(', '), value.customText].filter(Boolean).join(' / ');
  }
  return Array.isArray(raw)
    ? raw.join(', ')
    : raw === true
      ? '是'
      : raw === false
        ? '否'
        : String(raw ?? '').trim();
}

export function summarizeAnswers(
  questions: Array<string | PlanQuestion | PlanningQuestion>,
  answers: Record<string, unknown>
) {
  return questions
    .map((question, index) => {
      const id = typeof question === 'string' ? `q_${index}` : question.id || `q_${index}`;
      const prompt = typeof question === 'string' ? question : question.prompt;
      const value = answerText(answers[id]);
      return value ? `${prompt}：${value}` : '';
    })
    .filter(Boolean)
    .join('\n');
}
