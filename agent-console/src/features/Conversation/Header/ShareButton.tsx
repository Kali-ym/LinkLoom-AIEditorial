import { ActionIcon } from '@lobehub/ui';
import { Share2 } from 'lucide-react';
import { memo } from 'react';

import {
  DESKTOP_HEADER_ICON_SMALL_SIZE,
  MOBILE_HEADER_ICON_SIZE,
} from '../../../constants/layoutTokens';
import { usePermission } from '../../../hooks/usePermission';
import { useConfigStore, useLayoutStore, useRouteStore, useTopicStore } from '../../../stores';
import { openShareModal } from '../../ShareModal';
import { SharePopoverLazy } from '../../SharePopover/SharePopoverLazy';
import { shareStrings } from '../../SharePopover/shareStrings';

/** §C.39 ShareButton*/
export const ShareButton = memo(function ShareButton() {
  const view = useRouteStore((s) => s.view);
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const topic = useTopicStore((s) => s.topics.find((t) => t.id === activeTopicId));
  const enableBusinessFeatures = useConfigStore((s) => s.enableBusinessFeatures);
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);
  const { allowed: canShare, reason } = usePermission('edit_own_content');

  if (view === 'home' || !activeTopicId || topic?.status === 'temp') return null;

  const handleOpenShareModal = () => openShareModal(activeTopicId);

  const iconButton = (
    <ActionIcon
      disabled={!canShare}
      icon={Share2}
      size={isMobileViewport ? MOBILE_HEADER_ICON_SIZE : DESKTOP_HEADER_ICON_SMALL_SIZE}
      title={canShare ? shareStrings.share : reason}
      tooltipProps={{ placement: 'bottom' }}
      onClick={enableBusinessFeatures || !canShare ? undefined : handleOpenShareModal}
    />
  );

  if (!canShare) return iconButton;

  return enableBusinessFeatures ? (
    <SharePopoverLazy onOpenModal={handleOpenShareModal}>{iconButton}</SharePopoverLazy>
  ) : (
    iconButton
  );
});
