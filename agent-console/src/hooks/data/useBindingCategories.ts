import { useQuery } from '@tanstack/react-query';

import type { BindingCategory } from '../../domain/types';
import { getAgentConsolePorts } from './ports';

export function useBindingCategories(categoryType: 'knowledge' | 'memory' | null) {
  return useQuery<BindingCategory[]>({
    enabled: categoryType !== null,
    queryKey: ['agentConsole', 'bindingCategories', categoryType],
    queryFn: async () => {
      const ports = getAgentConsolePorts();
      if (categoryType === 'knowledge') {
        return ports.workspace.listKnowledgeCategories();
      }
      if (categoryType === 'memory') {
        return ports.workspace.listMemoryCategories();
      }
      return [];
    },
    staleTime: 30_000,
  });
}
