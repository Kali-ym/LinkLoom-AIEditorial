export const ASK_USER_QUESTION_TOOL_ID = 'ask_user_question';

export interface UserInputPauseRequest {
  requestId: string;
  runId: string;
  sessionId: string;
  toolCallId?: string;
  toolName: string;
  exposedName?: string;
  arguments: unknown;
  prompt: string;
  requestedAt: string;
  metadata?: Record<string, unknown>;
}

export class UserInputPauseError extends Error {
  constructor(public readonly request: UserInputPauseRequest) {
    super(`User input required for tool "${request.toolName}"`);
    this.name = 'UserInputPauseError';
  }
}

export function isUserInputPauseError(error: unknown): error is UserInputPauseError {
  return error instanceof UserInputPauseError;
}

export function isAskUserQuestionToolName(toolName: string | undefined): boolean {
  const normalized = String(toolName || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  return normalized === ASK_USER_QUESTION_TOOL_ID || normalized === 'askuserquestion';
}

function extractQuestionPrompt(question: unknown): string | null {
  if (!question || typeof question !== 'object') return null;
  const prompt = (question as Record<string, unknown>).prompt;
  if (typeof prompt === 'string' && prompt.trim()) return prompt.trim();
  return null;
}

export function extractAskUserQuestionPrompt(args: unknown): string {
  if (!args || typeof args !== 'object') return '请提供你的回答。';
  const record = args as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const questions = Array.isArray(record.questions) ? record.questions : [];
  const prompts = questions
    .map((item) => extractQuestionPrompt(item))
    .filter((item): item is string => Boolean(item));

  if (prompts.length > 1) {
    return title || `请回答 ${prompts.length} 个问题`;
  }
  if (prompts.length === 1) {
    return title ? `${title}：${prompts[0]}` : prompts[0];
  }

  const singlePrompt = extractQuestionPrompt(record.question);
  if (singlePrompt) return title ? `${title}：${singlePrompt}` : singlePrompt;
  if (typeof record.prompt === 'string' && record.prompt.trim()) return record.prompt.trim();
  return '请提供你的回答。';
}

export function createUserInputRequestId(runId: string, toolName: string): string {
  return `hitl_${runId}_${toolName}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
