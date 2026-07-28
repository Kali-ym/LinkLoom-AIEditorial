export type ApprovalMode = 'allow-list' | 'auto-run' | 'manual';

export const INTERVENTION_SETTINGS_STORAGE_KEY = 'linkloom-agent-console-intervention';

export interface InterventionSettings {
  approvalMode: ApprovalMode;
  toolAllowList: string[];
}

const DEFAULT_INTERVENTION_SETTINGS: InterventionSettings = {
  approvalMode: 'manual',
  toolAllowList: [],
};

const APPROVAL_MODES = new Set<ApprovalMode>(['manual', 'allow-list', 'auto-run']);

function isApprovalMode(value: unknown): value is ApprovalMode {
  return typeof value === 'string' && APPROVAL_MODES.has(value as ApprovalMode);
}

export function loadInterventionSettings(): InterventionSettings {
  try {
    const raw = localStorage.getItem(INTERVENTION_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_INTERVENTION_SETTINGS };

    const parsed = JSON.parse(raw) as Partial<InterventionSettings>;
    const approvalMode = isApprovalMode(parsed.approvalMode)
      ? parsed.approvalMode
      : DEFAULT_INTERVENTION_SETTINGS.approvalMode;
    const toolAllowList = Array.isArray(parsed.toolAllowList)
      ? parsed.toolAllowList.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : DEFAULT_INTERVENTION_SETTINGS.toolAllowList;

    return { approvalMode, toolAllowList };
  } catch {
    return { ...DEFAULT_INTERVENTION_SETTINGS };
  }
}

export function persistInterventionSettings(settings: InterventionSettings): void {
  try {
    localStorage.setItem(
      INTERVENTION_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        approvalMode: settings.approvalMode,
        toolAllowList: settings.toolAllowList,
      }),
    );
  } catch {
    /* ignore quota errors */
  }
}
