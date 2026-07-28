export const ASK_USER_CUSTOM_VALUE = '__custom__';

export interface QuestionOption {
  label: string;
  value: string;
  description?: string;
  recommended?: boolean;
}

export interface QuestionSelection {
  mode?: 'single' | 'multiple';
  options?: QuestionOption[];
  recommendedValue?: string;
  allowCustomInput?: boolean;
  customInputLabel?: string;
  customInputPlaceholder?: string;
  minSelections?: number;
  maxSelections?: number;
}

export interface QuestionField {
  key: string;
  label: string;
  required?: boolean;
  kind?: string;
  placeholder?: string;
  allowCustomInput?: boolean;
  customInputLabel?: string;
  options?: QuestionOption[];
}

export interface NormalizedQuestion {
  id: string;
  prompt: string;
  description?: string;
  selection: QuestionSelection | null;
  fields: QuestionField[];
}

export interface AskUserQuestionPayload {
  mode: 'single' | 'multiple' | 'freeform' | 'fields' | 'batch';
  selected?: string[];
  customInput?: string;
  values?: Record<string, string>;
  __freeform__?: string;
  answers?: Record<string, Omit<AskUserQuestionPayload, 'mode' | 'answers'> & { mode: 'single' | 'multiple' | 'freeform' | 'fields' }>;
}

export interface QuestionSelectionState {
  selectedValues: string[];
  customSelected: boolean;
  customInput: string;
}

export function resolveRecommendedValue(selection: QuestionSelection): string | undefined {
  if (selection.mode === 'multiple') return undefined;
  if (selection.recommendedValue?.trim()) {
    return selection.recommendedValue.trim();
  }
  const flagged = selection.options?.find((option) => option.recommended);
  return flagged?.value;
}

export function normalizeQuestionSelection(question: {
  selection?: QuestionSelection;
  fields?: QuestionField[];
}): QuestionSelection | null {
  if (question.selection?.options && question.selection.options.length >= 2) {
    const mode = question.selection.mode ?? 'single';
    return {
      mode,
      recommendedValue: resolveRecommendedValue({
        ...question.selection,
        mode,
      }),
      allowCustomInput: question.selection.allowCustomInput !== false,
      customInputLabel: question.selection.customInputLabel ?? '其他（请说明）',
      customInputPlaceholder: question.selection.customInputPlaceholder,
      minSelections: question.selection.minSelections,
      maxSelections: question.selection.maxSelections,
      options: question.selection.options,
    };
  }

  const field = question.fields?.find((item) => item.options && item.options.length >= 2);
  if (!field?.options) return null;

  const kind = field.kind?.toLowerCase();
  const mode =
    kind === 'multi_select' || kind === 'multiple' || kind === 'multiselect' ? 'multiple' : 'single';

  return {
    mode,
    options: field.options,
    recommendedValue: mode === 'single' ? resolveRecommendedValue({ mode, options: field.options }) : undefined,
    allowCustomInput: field.allowCustomInput !== false,
    customInputLabel: field.customInputLabel ?? '其他（请说明）',
    customInputPlaceholder: field.placeholder,
  };
}

export function normalizeAskUserQuestions(args: {
  title?: string;
  question?: {
    id?: string;
    prompt?: string;
    description?: string;
    selection?: QuestionSelection;
    fields?: QuestionField[];
  };
  questions?: Array<{
    id?: string;
    prompt?: string;
    description?: string;
    selection?: QuestionSelection;
    fields?: QuestionField[];
  }>;
}): { title?: string; questions: NormalizedQuestion[] } {
  const rawQuestions =
    args.questions && args.questions.length > 0
      ? args.questions
      : args.question?.prompt
        ? [args.question]
        : [];

  const questions = rawQuestions
    .map((item, index) => {
      const prompt = item.prompt?.trim();
      if (!prompt) return null;
      return {
        id: item.id?.trim() || `q${index + 1}`,
        prompt,
        description: item.description?.trim() || undefined,
        selection: normalizeQuestionSelection(item),
        fields: item.fields ?? [],
      };
    })
    .filter((item) => item != null) as NormalizedQuestion[];

  return {
    title: args.title?.trim() || undefined,
    questions,
  };
}

export function createInitialSelectionState(selection: QuestionSelection | null): QuestionSelectionState {
  const recommended = selection ? resolveRecommendedValue(selection) : undefined;
  if (recommended && selection?.mode !== 'multiple') {
    return {
      selectedValues: [recommended],
      customSelected: false,
      customInput: '',
    };
  }
  return {
    selectedValues: [],
    customSelected: false,
    customInput: '',
  };
}

export function buildSelectionPayload(input: {
  mode: 'single' | 'multiple';
  selectedValues: string[];
  customInput: string;
  customSelected: boolean;
}): AskUserQuestionPayload {
  const selected = [...input.selectedValues];
  const customInput = input.customInput.trim();
  if (input.customSelected && customInput) {
    if (input.mode === 'single') {
      return { mode: 'single', selected: [ASK_USER_CUSTOM_VALUE], customInput };
    }
    if (!selected.includes(ASK_USER_CUSTOM_VALUE)) {
      selected.push(ASK_USER_CUSTOM_VALUE);
    }
    return { mode: 'multiple', selected, customInput };
  }
  if (input.mode === 'single') {
    return { mode: 'single', selected: selected.slice(0, 1) };
  }
  return { mode: 'multiple', selected };
}

export function buildQuestionAnswerPayload(input: {
  question: NormalizedQuestion;
  selectionState?: QuestionSelectionState;
  formData?: Record<string, string>;
}): AskUserQuestionPayload {
  const { question, selectionState, formData = {} } = input;
  if (question.selection && selectionState) {
    return buildSelectionPayload({
      mode: question.selection.mode ?? 'single',
      selectedValues: selectionState.selectedValues,
      customInput: selectionState.customInput,
      customSelected: selectionState.customSelected,
    });
  }
  if (question.fields.length === 0) {
    return { mode: 'freeform', __freeform__: formData.__freeform__ ?? '' };
  }
  return { mode: 'fields', values: formData };
}

export function buildAskUserSubmitPayload(input: {
  questions: NormalizedQuestion[];
  selectionStates: Record<string, QuestionSelectionState>;
  formDataByQuestion: Record<string, Record<string, string>>;
}): AskUserQuestionPayload {
  if (input.questions.length === 1) {
    const question = input.questions[0];
    return buildQuestionAnswerPayload({
      question,
      selectionState: input.selectionStates[question.id],
      formData: input.formDataByQuestion[question.id],
    });
  }

  const answers: NonNullable<AskUserQuestionPayload['answers']> = {};
  for (const question of input.questions) {
    const answer = buildQuestionAnswerPayload({
      question,
      selectionState: input.selectionStates[question.id],
      formData: input.formDataByQuestion[question.id],
    });
    const { mode, ...rest } = answer;
    answers[question.id] = { mode, ...rest } as (typeof answers)[string];
  }
  return { mode: 'batch', answers };
}

export function canSubmitSelection(input: {
  mode: 'single' | 'multiple';
  selectedValues: string[];
  customInput: string;
  customSelected: boolean;
  minSelections?: number;
  maxSelections?: number;
}): boolean {
  const min = input.minSelections ?? 1;
  const customInput = input.customInput.trim();
  let count = input.selectedValues.length;
  if (input.customSelected && customInput) {
    count += 1;
  }
  if (count < min) return false;
  if (input.maxSelections != null && count > input.maxSelections) return false;
  if (input.mode === 'single') {
    return count === 1;
  }
  return count >= min;
}

export function canSubmitQuestion(input: {
  question: NormalizedQuestion;
  selectionState?: QuestionSelectionState;
  formData?: Record<string, string>;
}): boolean {
  const { question, selectionState, formData = {} } = input;
  if (question.selection && selectionState) {
    return canSubmitSelection({
      mode: question.selection.mode ?? 'single',
      selectedValues: selectionState.selectedValues,
      customInput: selectionState.customInput,
      customSelected: selectionState.customSelected,
      minSelections: question.selection.minSelections,
      maxSelections: question.selection.maxSelections,
    });
  }
  if (question.fields.length === 0) {
    return Boolean(formData.__freeform__?.trim());
  }
  return question.fields.every((field) => !field.required || Boolean(formData[field.key]?.trim()));
}

export function canSubmitAllQuestions(input: {
  questions: NormalizedQuestion[];
  selectionStates: Record<string, QuestionSelectionState>;
  formDataByQuestion: Record<string, Record<string, string>>;
}): boolean {
  if (input.questions.length === 0) return false;
  return input.questions.every((question) =>
    canSubmitQuestion({
      question,
      selectionState: input.selectionStates[question.id],
      formData: input.formDataByQuestion[question.id],
    }),
  );
}
