function inputTemplateFromInputMap(inputMap?: Record<string, string>): unknown {
  const entries = Object.entries(inputMap || {}).filter(([key, value]) => key.trim() && value.trim());
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries.map(([key, value]) => [key.trim(), value.trim()]));
}

export function normalizeWorkflowStepInputTemplate<T extends {
  inputMap?: Record<string, string>;
  inputTemplate?: unknown;
  outputMap?: Record<string, string>;
}>(step: T): Omit<T, 'inputMap' | 'outputMap'> {
  const { inputMap, outputMap: _outputMap, ...rest } = step;
  if (rest.inputTemplate !== undefined) return rest;
  const migrated = inputTemplateFromInputMap(inputMap);
  return migrated === undefined ? rest : { ...rest, inputTemplate: migrated };
}
