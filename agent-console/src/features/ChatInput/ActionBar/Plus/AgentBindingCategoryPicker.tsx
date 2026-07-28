import { memo } from 'react';

import CategoryPickerModal from '../../../../components/UI/CategoryPickerModal';
import { useBindingCategories } from '../../../../hooks/data/useBindingCategories';
import {
  AGENT_TOOL_CATEGORY_CONFIG,
  getCategoryBindingIds,
} from '../../../../utils/agentConsoleToolBindings';
import { useAgentStore } from '../../../../stores';
import type { AgentBindingPickerState } from './useAgentBindingControls';

export const AgentBindingCategoryPicker = memo(function AgentBindingCategoryPicker({
  request,
  onClose,
  onConfirm,
}: {
  request: AgentBindingPickerState | null;
  onClose: () => void;
  onConfirm: (toolId: string, categoryIds: string[]) => void;
}) {
  const plus = useAgentStore((s) => s.getActivePlusState());
  const cfg = request ? AGENT_TOOL_CATEGORY_CONFIG[request.toolId] : undefined;
  const { data: categories = [] } = useBindingCategories(cfg?.categoryType ?? null);

  if (!request) return null;

  return (
    <CategoryPickerModal
      isOpen
      categories={categories}
      description={cfg?.description}
      emptyHint="请先在「知识与记忆」中创建分类"
      selectedIds={getCategoryBindingIds(plus, request.toolId)}
      title={cfg?.title ?? '选择分类'}
      onClose={onClose}
      onConfirm={(ids) => {
        onConfirm(request.toolId, ids);
        onClose();
      }}
    />
  );
});
