export type RunHitlResolveAction =
  | 'allow'
  | 'deny'
  | 'edit_arguments'
  | 'provide_input'
  | 'external_result'
  | 'cancel';

export interface RunHitlResolveBody {
  action: RunHitlResolveAction;
  kind?: string;
  reason?: string;
  editedArguments?: unknown;
  input?: unknown;
  externalResult?: unknown;
  metadata?: Record<string, unknown>;
}
