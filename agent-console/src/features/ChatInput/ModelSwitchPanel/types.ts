import type { DropdownMenuPlacement } from '@lobehub/ui';
import type { ComponentType, ReactNode } from 'react';

import type { EnabledProviderWithModels } from '../../../domain/types/aiModel';

export type GroupMode = 'byModel' | 'byProvider';

export interface ModelWithProviders {
  displayName: string;
  model: import('../../../domain/types/aiModel').AiModelForSelect;
  providers: Array<{
    id: string;
    logo?: string;
    name: string;
    source?: EnabledProviderWithModels['source'];
  }>;
}

export type ListItem =
  | { data: ModelWithProviders; type: 'model-item-single' }
  | { data: ModelWithProviders; type: 'model-item-multiple' }
  | { provider: EnabledProviderWithModels; type: 'group-header' }
  | {
      model: import('../../../domain/types/aiModel').AiModelForSelect;
      provider: EnabledProviderWithModels;
      type: 'provider-model-item';
    }
  | { provider: EnabledProviderWithModels; type: 'empty-model' }
  | { type: 'no-provider' };

export type DropdownPlacement = DropdownMenuPlacement;

export interface ModelSwitchPanelProps {
  children?: ReactNode;
  enabledList?: EnabledProviderWithModels[];
  model?: string;
  ModelItemComponent?: ComponentType<Record<string, unknown>>;
  onModelChange?: (params: { model: string; provider: string }) => void | Promise<void>;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  openOnHover?: boolean;
  placement?: DropdownPlacement;
  provider?: string;
}
