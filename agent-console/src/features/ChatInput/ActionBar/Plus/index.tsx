import { ActionIcon, DropdownMenu, Tooltip } from '@lobehub/ui';
import { PlusIcon } from 'lucide-react';
import { memo, useCallback, useState } from 'react';

import { usePermission } from '../../../../hooks/usePermission';
import { openAttachKnowledgeModal } from '../../../TopicModals/AttachKnowledge';
import { usePlusModalStore } from '../../../../stores/plusModalStore';
import { SkillStoreModal } from '../../modals/SkillStoreModal';
import { plusStrings } from '../../plusStrings';
import { useActionBarContext } from '../context';
import { usePlusMenuItems } from './usePlusMenuItems';

/** §C.22 Plus 菜单*/
export const Plus = memo(function Plus({
  onUploadClick: onUploadClickProp,
}: {
  onUploadClick?: () => void;
} = {}) {
  const { onUploadClick: ctxUpload } = useActionBarContext();
  const onUploadClick = onUploadClickProp ?? ctxUpload ?? (() => {});
  const { allowed: canCreate, reason } = usePermission('create_content');
  const [open, setOpen] = useState(false);
  const closeDropdown = useCallback(() => setOpen(false), []);
  const skillStoreOpen = usePlusModalStore((s) => s.skillStoreOpen);
  const setSkillStoreOpen = usePlusModalStore((s) => s.setSkillStoreOpen);

  const { items, categoryPicker } = usePlusMenuItems({ closeDropdown, onUploadClick });

  const icon = (
    <ActionIcon
      disabled={!canCreate}
      icon={PlusIcon}
      size={{ blockSize: 32, borderRadius: 16, size: 18 }}
      onClick={(e) => e.stopPropagation()}
    />
  );

  const modals = <SkillStoreModal open={skillStoreOpen} onClose={() => setSkillStoreOpen(false)} />;

  if (!canCreate) {
    return (
      <>
        <Tooltip title={reason}>
          <span style={{ display: 'inline-flex' }}>{icon}</span>
        </Tooltip>
        {categoryPicker}
        {modals}
      </>
    );
  }

  return (
    <>
      <DropdownMenu items={items} nativeButton={false} open={open} placement="topLeft" onOpenChange={setOpen}>
        <span style={{ display: 'inline-flex' }} title={plusStrings.tooltip}>
          {icon}
        </span>
      </DropdownMenu>
      {categoryPicker}
      {modals}
    </>
  );
});

export { openAttachKnowledgeModal };

export default Plus;
