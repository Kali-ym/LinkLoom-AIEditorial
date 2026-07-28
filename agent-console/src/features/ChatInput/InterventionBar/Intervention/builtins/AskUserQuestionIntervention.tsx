import { Flexbox, Input, TextArea } from '@lobehub/ui';
import { memo, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { InteractionActionDock } from '../../InteractionActionDock';
import { InterventionPanel } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import type { BuiltinInterventionProps } from '../types';
import {
  buildAskUserSubmitPayload,
  canSubmitAllQuestions,
  createInitialSelectionState,
  normalizeAskUserQuestions,
  resolveRecommendedValue,
  type NormalizedQuestion,
  type QuestionSelectionState,
} from './askUserQuestionTypes';

function useQuestionFormState(questions: NormalizedQuestion[]) {
  const [selectionStates, setSelectionStates] = useState<Record<string, QuestionSelectionState>>(() => {
    const initial: Record<string, QuestionSelectionState> = {};
    for (const question of questions) {
      initial[question.id] = createInitialSelectionState(question.selection);
    }
    return initial;
  });

  const [formDataByQuestion, setFormDataByQuestion] = useState<Record<string, Record<string, string>>>(() => {
    const initial: Record<string, Record<string, string>> = {};
    for (const question of questions) {
      const formData: Record<string, string> = {};
      for (const field of question.fields) {
        formData[field.key] = '';
      }
      if (!question.selection && question.fields.length === 0) {
        formData.__freeform__ = '';
      }
      initial[question.id] = formData;
    }
    return initial;
  });

  return { selectionStates, setSelectionStates, formDataByQuestion, setFormDataByQuestion };
}

const QuestionSelectionBlock = memo(function QuestionSelectionBlock({
  questionId,
  selection,
  state,
  onChange,
}: {
  questionId: string;
  selection: NonNullable<NormalizedQuestion['selection']>;
  state: QuestionSelectionState;
  onChange: (questionId: string, next: QuestionSelectionState) => void;
}) {
  const selectionMode = selection.mode ?? 'single';
  const allowCustomInput = selection.allowCustomInput !== false;
  const recommendedValue = resolveRecommendedValue(selection);

  const toggleOption = useCallback(
    (value: string) => {
      if (selectionMode === 'single') {
        onChange(questionId, { selectedValues: [value], customSelected: false, customInput: state.customInput });
        return;
      }
      const selectedValues = state.selectedValues.includes(value)
        ? state.selectedValues.filter((item) => item !== value)
        : [...state.selectedValues, value];
      onChange(questionId, { ...state, selectedValues });
    },
    [onChange, questionId, selectionMode, state],
  );

  const selectCustom = useCallback(() => {
    if (selectionMode === 'single') {
      onChange(questionId, { selectedValues: [], customSelected: true, customInput: state.customInput });
      return;
    }
    onChange(questionId, { ...state, customSelected: !state.customSelected });
  }, [onChange, questionId, selectionMode, state]);

  const handleCustomInputChange = useCallback(
    (value: string) => {
      if (value.trim()) {
        if (selectionMode === 'single') {
          onChange(questionId, { selectedValues: [], customSelected: true, customInput: value });
          return;
        }
        onChange(questionId, { ...state, customSelected: true, customInput: value });
        return;
      }
      onChange(questionId, { ...state, customInput: value, customSelected: false });
    },
    [onChange, questionId, selectionMode, state],
  );

  const selectionHint =
    selectionMode === 'multiple'
      ? `可多选${selection.maxSelections != null ? ` · 最多 ${selection.maxSelections} 项` : ''}`
      : '单选';

  return (
    <Flexbox gap={8}>
      <div className={interventionStyles.metaRow}>
        <span className={interventionStyles.metaChip}>{selectionHint}</span>
        {selectionMode === 'single' && recommendedValue ? (
          <span className={interventionStyles.metaChip}>已预选模型推荐项，可改选</span>
        ) : null}
      </div>

      <InterventionPanel padded={false}>
        <Flexbox gap={6} style={{ padding: 8 }}>
          {selection.options?.map((option) => {
            const selected = state.selectedValues.includes(option.value);
            const isRecommended = recommendedValue === option.value;
            return (
              <div
                className={interventionStyles.selectableOption}
                data-selected={selected}
                key={option.value}
                role={selectionMode === 'multiple' ? 'checkbox' : 'radio'}
                aria-checked={selected}
                onClick={() => toggleOption(option.value)}
              >
                <div className={interventionStyles.selectableOptionRow}>
                  {selectionMode === 'multiple' ? (
                    <span className={interventionStyles.choiceMark} data-selected={selected}>
                      {selected ? '✓' : ''}
                    </span>
                  ) : (
                    <span className={interventionStyles.radioMark} data-selected={selected} />
                  )}
                  <Flexbox gap={2} style={{ minWidth: 0 }}>
                    <Flexbox horizontal align="center" gap={6} style={{ minWidth: 0, flexWrap: 'wrap' }}>
                      <span className={interventionStyles.optionLabel}>{option.label}</span>
                      {isRecommended ? (
                        <span className={interventionStyles.metaChip} style={{ fontSize: 10 }}>
                          推荐
                        </span>
                      ) : null}
                    </Flexbox>
                    {option.description ? (
                      <span className={interventionStyles.optionDesc}>{option.description}</span>
                    ) : null}
                  </Flexbox>
                </div>
              </div>
            );
          })}

          {allowCustomInput ? (
            <div
              className={interventionStyles.customInputRow}
              data-selected={state.customSelected || Boolean(state.customInput.trim())}
              onClick={selectCustom}
            >
              <Flexbox gap={8}>
                <div className={interventionStyles.selectableOptionRow}>
                  {selectionMode === 'multiple' ? (
                    <span
                      className={interventionStyles.choiceMark}
                      data-selected={state.customSelected || Boolean(state.customInput.trim())}
                    >
                      {state.customSelected || state.customInput.trim() ? '✓' : ''}
                    </span>
                  ) : (
                    <span
                      className={interventionStyles.radioMark}
                      data-selected={state.customSelected || Boolean(state.customInput.trim())}
                    />
                  )}
                  <span className={interventionStyles.optionLabel}>
                    {selection.customInputLabel ?? '其他（请说明）'}
                  </span>
                </div>
                <Input
                  placeholder={selection.customInputPlaceholder ?? '请输入你的回答'}
                  value={state.customInput}
                  variant="filled"
                  onClick={(event) => event.stopPropagation()}
                  onChange={(e) => handleCustomInputChange(e.target.value)}
                />
              </Flexbox>
            </div>
          ) : null}
        </Flexbox>
      </InterventionPanel>
    </Flexbox>
  );
});

const QuestionBlock = memo(function QuestionBlock({
  question,
  index,
  total,
  selectionState,
  formData,
  onSelectionChange,
  onFormDataChange,
}: {
  question: NormalizedQuestion;
  index: number;
  total: number;
  selectionState: QuestionSelectionState;
  formData: Record<string, string>;
  onSelectionChange: (questionId: string, next: QuestionSelectionState) => void;
  onFormDataChange: (questionId: string, next: Record<string, string>) => void;
}) {
  const textFields = question.fields.filter((field) => !field.options?.length);

  return (
    <Flexbox gap={10}>
      {total > 1 ? (
        <span className={interventionStyles.metaChip}>
          问题 {index + 1}/{total}
        </span>
      ) : null}
      <p className={interventionStyles.leadTitle}>{question.prompt}</p>
      {question.description ? <p className={interventionStyles.leadDesc}>{question.description}</p> : null}

      {question.selection ? (
        <QuestionSelectionBlock
          questionId={question.id}
          selection={question.selection}
          state={selectionState}
          onChange={onSelectionChange}
        />
      ) : null}

      {!question.selection && question.fields.length === 0 ? (
        <InterventionPanel>
          <TextArea
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder={question.description || '输入你的回答'}
            value={formData.__freeform__ ?? ''}
            variant="filled"
            onChange={(e) =>
              onFormDataChange(question.id, { ...formData, __freeform__: e.target.value })
            }
          />
        </InterventionPanel>
      ) : null}

      {!question.selection
        ? textFields.map((field) => (
            <Flexbox gap={6} key={field.key}>
              <span className={interventionStyles.optionLabel}>
                {field.label}
                {field.required ? <span style={{ color: 'var(--console-vars-color-error)' }}> *</span> : null}
              </span>
              <Input
                placeholder={field.placeholder}
                value={formData[field.key] ?? ''}
                variant="filled"
                onChange={(e) =>
                  onFormDataChange(question.id, { ...formData, [field.key]: e.target.value })
                }
              />
            </Flexbox>
          ))
        : null}
    </Flexbox>
  );
});

/** §C.36*/
export const AskUserQuestionIntervention = memo(function AskUserQuestionIntervention({
  args,
  interactionMode,
  actionsPortalTarget,
  onInteractionAction,
}: BuiltinInterventionProps) {
  const normalized = useMemo(
    () =>
      normalizeAskUserQuestions(
        (args ?? {}) as Parameters<typeof normalizeAskUserQuestions>[0],
      ),
    [args],
  );
  const { title, questions } = normalized;
  const isCustom = interactionMode === 'custom';
  const { selectionStates, setSelectionStates, formDataByQuestion, setFormDataByQuestion } =
    useQuestionFormState(questions);
  const [submitting, setSubmitting] = useState(false);

  const submitEnabled = useMemo(
    () =>
      canSubmitAllQuestions({
        questions,
        selectionStates,
        formDataByQuestion,
      }),
    [formDataByQuestion, questions, selectionStates],
  );

  const handleSelectionChange = useCallback((questionId: string, next: QuestionSelectionState) => {
    setSelectionStates((prev) => ({ ...prev, [questionId]: next }));
  }, []);

  const handleFormDataChange = useCallback((questionId: string, next: Record<string, string>) => {
    setFormDataByQuestion((prev) => ({ ...prev, [questionId]: next }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!onInteractionAction || !submitEnabled) return;
    setSubmitting(true);
    try {
      const payload = buildAskUserSubmitPayload({
        questions,
        selectionStates,
        formDataByQuestion,
      });
      await onInteractionAction({ type: 'submit', payload: payload as unknown as Record<string, unknown> });
    } finally {
      setSubmitting(false);
    }
  }, [formDataByQuestion, onInteractionAction, questions, selectionStates, submitEnabled]);

  const handleSkip = useCallback(async () => {
    await onInteractionAction?.({ type: 'skip' });
  }, [onInteractionAction]);

  if (!isCustom) {
    return (
      <Flexbox gap={8}>
        {title ? <p className={interventionStyles.leadDesc}>{title}</p> : null}
        {questions.map((question) => (
          <Flexbox gap={6} key={question.id}>
            <p className={interventionStyles.leadTitle}>{question.prompt}</p>
            {question.selection?.options?.length ? (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {question.selection.options.map((option) => (
                  <li key={option.value}>
                    {option.label}
                    {resolveRecommendedValue(question.selection!) === option.value ? '（推荐）' : ''}
                  </li>
                ))}
                {question.selection.allowCustomInput !== false ? (
                  <li>{question.selection.customInputLabel ?? '其他（请说明）'}</li>
                ) : null}
              </ul>
            ) : question.fields.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {question.fields.map((field) => (
                  <li key={field.key}>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </Flexbox>
        ))}
      </Flexbox>
    );
  }

  const actions = (
    <InteractionActionDock
      primaryDisabled={!submitEnabled}
      primaryLabel="提交回答"
      primaryLoading={submitting}
      secondaryLabel="跳过"
      onPrimary={() => void handleSubmit()}
      onSecondary={() => void handleSkip()}
    />
  );

  return (
    <Flexbox gap={16}>
      {title ? <p className={interventionStyles.leadDesc}>{title}</p> : null}
      {questions.map((question, index) => (
        <QuestionBlock
          formData={formDataByQuestion[question.id] ?? {}}
          index={index}
          key={question.id}
          question={question}
          selectionState={selectionStates[question.id] ?? createInitialSelectionState(question.selection)}
          total={questions.length}
          onFormDataChange={handleFormDataChange}
          onSelectionChange={handleSelectionChange}
        />
      ))}
      {actionsPortalTarget ? createPortal(actions, actionsPortalTarget) : actions}
    </Flexbox>
  );
});
