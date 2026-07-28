import { useMemo } from 'react';

import { useAgentStore } from '../stores';

import type { ExtendParamKey } from '../features/shared/agentParams/extendParamFields';
import type { ParamKey } from '../features/shared/agentParams/paramsConstants';
import { type ProviderFamily, useProviderFamily } from './useProviderFamily';

export type ModelParamKey = ParamKey;

const EXTEND_PARAMS_BY_FAMILY: Record<ProviderFamily, readonly ExtendParamKey[]> = {
  anthropic: ['enableReasoning', 'preserveThinking'],
  google: ['thinking', 'disableContextCaching'],
  openai: ['enableReasoning', 'textVerbosity'],
  ollama: [],
  unknown: ['enableReasoning'],
};

/** Derive Plus/Params capabilities from active agent model + settings provider type. */
export function useAgentModelMeta() {
  const model = useAgentStore((s) => s.getActivePlusState().model);
  const provider = useAgentStore((s) => s.getActivePlusState().provider);
  const family = useProviderFamily(provider);

  return useMemo(() => {
    const showProviderSearch = !model.includes('builtin') && family === 'google';

    const hasExtendParams = !model.includes('hetero') && family !== 'ollama' && family !== 'unknown';
    const extendParams = hasExtendParams ? EXTEND_PARAMS_BY_FAMILY[family] : ([] as const);

    const disabledParams: ModelParamKey[] = family === 'ollama' ? ['temperature', 'top_p'] : [];

    const canUploadImage = family !== 'ollama';
    const canUploadVideo = family === 'openai' || family === 'google';

    return {
      canUploadImage,
      canUploadVideo,
      disabledParams,
      extendParams,
      family,
      hasExtendParams,
      model,
      provider,
      showProviderSearch,
    };
  }, [family, model, provider]);
}
