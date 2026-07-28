import { useAgentStore } from '../stores';
import { useModelSupportsImageOutput as useCatalogImageOutput } from './data/useCatalog';

/** Upstream `useModelSupportImageOutput` — via catalog data hook. */
export function useModelSupportImageOutput(model?: string, provider?: string): boolean {
  const activeModel = useAgentStore((s) => s.getActivePlusState().model);
  const activeProvider = useAgentStore((s) => s.getActivePlusState().provider);
  const id = model ?? activeModel ?? '';
  const prov = provider ?? activeProvider ?? '';
  const supports = useCatalogImageOutput(id, prov);
  if (!id || !prov) return false;
  return supports;
}
