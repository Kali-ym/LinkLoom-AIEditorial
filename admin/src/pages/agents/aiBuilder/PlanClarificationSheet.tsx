import React, { useEffect, useMemo, useState } from 'react';
import type { PlanQuestion, PlanningQuestion } from '../../../services/agentService';
import {
  isQuestionAnswered,
  normalizeAnswer,
  questionId,
  questionOptions,
  questionPrompt,
  validateQuestionAnswer,
  type StructuredAnswer
} from './planQuestionUtils';

interface PlanClarificationSheetProps {
  questions: Array<string | PlanQuestion | PlanningQuestion>;
  step: number;
  answers?: Record<string, unknown>;
  busy?: boolean;
  onStepChange: (step: number) => void;
  onAnswersChange: (answers: Record<string, unknown>) => void;
  onComplete: (answers: Record<string, unknown>) => void;
}

export const PlanClarificationSheet: React.FC<PlanClarificationSheetProps> = ({
  questions,
  step,
  answers = {},
  busy = false,
  onStepChange,
  onAnswersChange,
  onComplete
}) => {
  const [draftAnswers, setDraftAnswers] = useState<Record<string, unknown>>(answers);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftAnswers(answers);
  }, [answers]);

  const safeStep = Math.min(Math.max(step, 0), Math.max(questions.length - 1, 0));
  const currentQuestion = questions[safeStep];
  const currentId = questionId(currentQuestion, safeStep);
  const structured = typeof currentQuestion === 'string' ? null : currentQuestion;
  const value = normalizeAnswer(draftAnswers[currentId]);
  const options = questionOptions(currentQuestion);
  const showCustomInput = value.selectedOptionIds.includes('custom') || structured?.type === 'text' || !structured;
  const isLastStep = safeStep >= questions.length - 1;

  const canContinue = useMemo(
    () => isQuestionAnswered(currentQuestion, safeStep, draftAnswers),
    [currentQuestion, draftAnswers, safeStep]
  );

  if (!questions.length || !currentQuestion) return null;

  const updateAnswer = (nextValue: StructuredAnswer) => {
    const nextAnswers = { ...draftAnswers, [currentId]: nextValue };
    setDraftAnswers(nextAnswers);
    onAnswersChange(nextAnswers);
    setError(null);
  };

  const toggleMulti = (optionId: string) => {
    const current = normalizeAnswer(draftAnswers[currentId]);
    updateAnswer({
      ...current,
      selectedOptionIds: current.selectedOptionIds.includes(optionId)
        ? current.selectedOptionIds.filter(item => item !== optionId)
        : [...current.selectedOptionIds, optionId]
    });
  };

  const handleContinue = () => {
    const validationError = validateQuestionAnswer(currentQuestion, safeStep, draftAnswers);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (isLastStep) {
      onComplete(draftAnswers);
      return;
    }
    onStepChange(safeStep + 1);
    setError(null);
  };

  const optionButtonClass = (selected: boolean) =>
    `w-full rounded-2xl border px-3 py-2.5 text-left text-xs font-medium transition ${
      selected
        ? 'border-blue-700 bg-blue-700 text-white shadow-subtle'
        : 'border-hairline-soft bg-surface-soft text-text-ink hover:border-blue-300 dark:border-white/10 dark:bg-canvas/[0.04] dark:text-slate-100'
    }`;

  return (
    <div className="mx-auto mb-2 flex max-h-[min(48vh,380px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-blue-200 bg-canvas shadow-card dark:border-blue-500/25 dark:bg-[#111827]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-4 py-3 dark:border-blue-500/20">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-deep dark:text-blue-300">计划澄清</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-lavender px-2.5 py-1 text-[11px] font-semibold text-ink-deep dark:bg-ink/10 dark:text-blue-200">
          {safeStep + 1} / {questions.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        <p className="text-sm font-semibold leading-6 text-slate-950 dark:text-white">
          {questionPrompt(currentQuestion)}
        </p>

        {options.length ? (
          <div className="flex flex-col gap-2">
            {options.map(option => {
              const selected = value.selectedOptionIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (structured?.type === 'multi') toggleMulti(option.id);
                    else updateAnswer({ ...value, selectedOptionIds: [option.id] });
                  }}
                  className={optionButtonClass(selected)}
                >
                  <span className="block">{option.label}</span>
                  {option.description ? (
                    <span className={`mt-0.5 block text-[11px] ${selected ? 'text-blue-100' : 'text-text-slate dark:text-text-stone'}`}>
                      {option.description}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {showCustomInput ? (
          <textarea
            value={value.customText}
            disabled={busy}
            onChange={event => updateAnswer({ ...value, customText: event.target.value })}
            rows={3}
            className="w-full rounded-2xl border border-hairline-soft bg-canvas px-3 py-2 text-xs text-text-ink outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="输入你的回答..."
          />
        ) : null}

        {error ? <p className="text-[11px] font-medium text-coral-dark dark:text-red-300">{error}</p> : null}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-hairline px-4 py-3 dark:border-blue-500/20">
        <button
          type="button"
          disabled={busy || safeStep === 0}
          onClick={() => onStepChange(Math.max(0, safeStep - 1))}
          className="inline-flex h-9 items-center rounded-2xl border border-hairline-soft bg-canvas px-3 text-xs font-semibold text-text-charcoal enabled:hover:bg-surface-soft disabled:opacity-40 dark:border-white/10 dark:bg-canvas/[0.04] dark:text-text-secondary"
        >
          上一题
        </button>
        <button
          type="button"
          disabled={busy || !canContinue}
          onClick={handleContinue}
          className="inline-flex h-9 items-center rounded-2xl bg-blue-700 px-4 text-xs font-semibold text-white enabled:hover:bg-blue-800 disabled:opacity-40"
        >
          {busy ? '分析中...' : isLastStep ? '完成并分析' : '继续'}
        </button>
      </div>
    </div>
  );
};
