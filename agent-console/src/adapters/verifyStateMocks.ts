import type { VerifyOperationState } from '../domain/types/messageBlocks';

/** §C.37 — mock verify operations keyed by verifyOperationId */
export const VERIFY_STATE_BY_OPERATION_ID: Record<string, VerifyOperationState> = {
  'verify-demo-2': {
    verifyRound: 2,
    verifyStatus: 'passed',
    verifyPlan: [
      { id: 'c1', label: "page.title includes 'Changelog'", status: 'passed' },
      { id: 'c2', label: 'response status is 200', status: 'passed' },
      { id: 'c3', label: 'body contains release notes', status: 'passed' },
    ],
  },
  'verify-demo-1': {
    verifyRound: 1,
    verifyStatus: 'running',
    verifyPlan: [
      { id: 'c1', label: 'login form visible', status: 'passed' },
      { id: 'c2', label: 'submit redirects to dashboard', status: 'pending' },
    ],
  },
};

export function getVerifyState(operationId?: string): VerifyOperationState | undefined {
  if (!operationId) return undefined;
  return VERIFY_STATE_BY_OPERATION_ID[operationId];
}
