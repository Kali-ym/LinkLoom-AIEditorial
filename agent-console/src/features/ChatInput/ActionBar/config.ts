import type { ComponentType } from 'react';

import { Model } from './Model';
import { ModelLabel } from './ModelLabel';
import { Plus } from './Plus';
import { PromptTransform } from './PromptTransform';
import { Typo } from './Typo';

export const actionMap = {
  model: Model,
  modelLabel: ModelLabel,
  plus: Plus,
  promptTransform: PromptTransform,
  typo: Typo,
} as const;

export type ChatInputActionKey = keyof typeof actionMap | 'contextWindow';

export type ActionBarComponent = ComponentType<Record<string, never>>;
