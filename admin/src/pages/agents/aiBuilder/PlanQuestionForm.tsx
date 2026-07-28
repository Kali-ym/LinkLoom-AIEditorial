import React, { useEffect, useMemo, useState } from 'react';
import type { PlanQuestion, PlanningQuestion } from '../../../services/agentService';
import {
  normalizeAnswer,
  questionId,
  questionOptions,
  questionPrompt,
  type StructuredAnswer
} from './planQuestionUtils';

interface PlanQuestionFormProps {
  questions: Array<string | PlanQuestion | PlanningQuestion>;
  answers?: Record<string, unknown>;
  onSubmit?: (answers: Record<string, unknown>) => void;
}

export const PlanQuestionForm: React.FC<PlanQuestionFormProps> = ({ questions, answers = {}, onSubmit }) => {
  const defaults = useMemo(() => {
    const next: Record<string, unknown> = { ...answers };
    questions.forEach((question, index) => {
      if (typeof question === 'string') return;
      const id = questionId(question, index);
      if (next[id] !== undefined) return;
      if (question.type === 'confirm') next[id] = { selectedOptionIds: question.defaultOptionId ? [question.defaultOptionId] : [], customText: '' };
      if ((question.type === 'single' || question.type === 'multi') && question.defaultOptionId) {
        next[id] = { selectedOptionIds: [question.defaultOptionId], customText: '' };
      }
    });
    return next;
  }, [answers, questions]);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, unknown>>(defaults);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => setDraftAnswers(defaults), [defaults]);
  if (!questions.length) return null;

  const updateAnswer = (id: string, value: StructuredAnswer) => {
    setDraftAnswers(prev => ({ ...prev, [id]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleMulti = (id: string, optionId: string) => {
    const current = normalizeAnswer(draftAnswers[id]);
    updateAnswer(id, {
      ...current,
      selectedOptionIds: current.selectedOptionIds.includes(optionId)
        ? current.selectedOptionIds.filter(item => item !== optionId)
        : [...current.selectedOptionIds, optionId]
    });
  };

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    questions.forEach((question, index) => {
      if (typeof question === 'string') return;
      if (!question.required) return;
      const id = questionId(question, index);
      const value = normalizeAnswer(draftAnswers[id]);
      if (value.selectedOptionIds.length === 0 && !value.customText.trim()) {
        nextErrors[id] = '这个问题必须回答';
      }
      if (value.selectedOptionIds.includes('custom') && !value.customText.trim()) {
        nextErrors[id] = '选择自定义输入后，请补充具体内容';
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit?.(draftAnswers);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-blue-200 bg-surface-lavender p-3 dark:border-blue-500/20 dark:bg-ink/10">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-deep dark:text-blue-200">待确认问题</p>
      {questions.map((question, index) => {
        const id = questionId(question, index);
        const structured = typeof question === 'string' ? null : question;
        const value = normalizeAnswer(draftAnswers[id]);
        const showCustomInput = value.selectedOptionIds.includes('custom') || structured?.type === 'text';
        const options = questionOptions(question);
        return (
          <div key={id} className="space-y-2">
            <p className="text-xs font-semibold text-blue-950 dark:text-blue-100">{questionPrompt(question)}</p>
            {structured?.type === 'single' && options.length ? (
              <div className="flex flex-wrap gap-2">
                {options.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => updateAnswer(id, { ...value, selectedOptionIds: [option.id] })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      value.selectedOptionIds.includes(option.id)
                        ? 'border-blue-700 bg-blue-700 text-white'
                        : 'border-blue-200 bg-canvas text-blue-800 dark:border-ink/30/30 dark:bg-canvas/10 dark:text-blue-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : structured?.type === 'multi' && options.length ? (
              <div className="flex flex-wrap gap-2">
                {options.map(option => {
                  const selected = value.selectedOptionIds.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleMulti(id, option.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        selected
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : 'border-blue-200 bg-canvas text-blue-800 dark:border-ink/30/30 dark:bg-canvas/10 dark:text-blue-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : structured?.type === 'confirm' ? (
              <div className="flex gap-2">
                {options.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => updateAnswer(id, { ...value, selectedOptionIds: [option.id] })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      value.selectedOptionIds.includes(option.id)
                        ? 'border-blue-700 bg-blue-700 text-white'
                        : 'border-blue-200 bg-canvas text-blue-800 dark:border-ink/30/30 dark:bg-canvas/10 dark:text-blue-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            {showCustomInput || !structured ? (
              <textarea
                value={value.customText}
                onChange={event => updateAnswer(id, { ...value, customText: event.target.value })}
                rows={2}
                className="w-full rounded-2xl border border-blue-200 bg-canvas px-3 py-2 text-xs text-text-ink outline-none focus:border-blue-500 dark:border-ink/30/30 dark:bg-black/20 dark:text-white"
                placeholder="输入你的回答..."
              />
            ) : null}
            {errors[id] && <p className="text-[11px] font-medium text-coral-dark dark:text-red-300">{errors[id]}</p>}
          </div>
        );
      })}
      {onSubmit && (
        <button
          type="button"
          onClick={submit}
          className="rounded-2xl bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
        >
          保存回答
        </button>
      )}
    </div>
  );
};
