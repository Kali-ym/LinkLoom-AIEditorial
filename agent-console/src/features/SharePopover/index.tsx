import {
  Button,
  Checkbox,
  copyToClipboard,
  Flexbox,
  Popover,
  Skeleton,
  Text,
  usePopoverContext,
} from '@lobehub/ui';
import { confirmModal, Select } from '@lobehub/ui/base-ui';
import { FileOutput, Image, KeyRound, Link, Lock, Paperclip, Wrench } from 'lucide-react';
import { memo, useCallback, useEffect, useState, type ReactNode } from 'react';

import { useAppOrigin } from '../../hooks/useAppOrigin';
import { usePermission } from '../../hooks/usePermission';
import { isAgentConsoleApiMode } from '../../adapters/registry';
import type { ShareVisibility } from '../../domain/types';
import { showToast } from '../../services/ui/toast';
import { useConfigStore, useLayoutStore, useShareStore, useTopicStore } from '../../stores';
import { shareStrings } from './shareStrings';
import { sharePopoverStyles } from './styles';

const PRIVACY_WARNING_ITEMS = [
  { icon: Wrench, label: shareStrings.privacyWarning.items.toolCalls },
  { icon: KeyRound, label: shareStrings.privacyWarning.items.credentials },
  { icon: Image, label: shareStrings.privacyWarning.items.images },
  { icon: Paperclip, label: shareStrings.privacyWarning.items.files },
] as const;

function buildShareUrl(origin: string, shareId: string): string {
  return `${origin}/share/t/${shareId}`;
}

interface SharePopoverContentProps {
  topicId?: string;
  onOpenModal?: () => void;
}

const SharePopoverContent = memo(function SharePopoverContent({
  topicId,
  onOpenModal,
}: SharePopoverContentProps) {
  const appOrigin = useAppOrigin();
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const resolvedTopicId = topicId ?? activeTopicId;
  const { allowed: canShare, reason } = usePermission('edit_own_content');
  const getShareInfo = useShareStore((s) => s.getShareInfo);
  const ensureShareRecord = useShareStore((s) => s.ensureShareRecord);
  const updateVisibility = useShareStore((s) => s.updateVisibility);
  const hidePrivacyWarning = useConfigStore((s) => s.hideTopicSharePrivacyWarning);
  const setHidePrivacyWarning = useConfigStore((s) => s.setHideTopicSharePrivacyWarning);
  const { close } = usePopoverContext();
  const isApiMode = isAgentConsoleApiMode();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!resolvedTopicId || !canShare) {
      setLoading(false);
      return;
    }
    if (isApiMode) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      ensureShareRecord(resolvedTopicId);
      setLoading(false);
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canShare, ensureShareRecord, isApiMode, resolvedTopicId]);

  const shareInfo = resolvedTopicId ? getShareInfo(resolvedTopicId) : undefined;
  const currentVisibility: ShareVisibility = shareInfo?.visibility ?? 'private';
  const shareUrl = shareInfo?.shareId ? buildShareUrl(appOrigin, shareInfo.shareId) : '';

  const applyVisibility = useCallback(
    async (visibility: ShareVisibility) => {
      if (!resolvedTopicId) return;
      setUpdating(true);
      try {
        const updated = await updateVisibility(resolvedTopicId, visibility);
        const url = buildShareUrl(appOrigin, updated.shareId);
        if (visibility === 'link') {
          await copyToClipboard(url);
          showToast(shareStrings.copyLinkSuccess);
        } else {
          showToast(shareStrings.visibilityUpdated);
        }
      } catch {
        showToast(shareStrings.updateError);
      } finally {
        setUpdating(false);
      }
    },
    [appOrigin, resolvedTopicId, updateVisibility],
  );

  const handleVisibilityChange = useCallback(
    (visibility: ShareVisibility) => {
      if (
        currentVisibility === 'private' &&
        visibility === 'link' &&
        !hidePrivacyWarning
      ) {
        let doNotShowAgain = false;
        confirmModal({
          cancelText: shareStrings.cancel,
          okText: shareStrings.privacyWarning.confirm,
          title: shareStrings.privacyWarning.title,
          content: (
            <Flexbox gap={16}>
              <Text>{shareStrings.privacyWarning.content}</Text>
              <Flexbox gap={12} paddingBlock={8}>
                {PRIVACY_WARNING_ITEMS.map(({ icon: ItemIcon, label }) => (
                  <Flexbox horizontal align="center" gap={8} key={label}>
                    <ItemIcon size={16} />
                    <Text>{label}</Text>
                  </Flexbox>
                ))}
              </Flexbox>
              <Text type="secondary">{shareStrings.privacyWarning.note}</Text>
              <Checkbox
                onChange={(v) => {
                  doNotShowAgain = v;
                }}
              >
                {shareStrings.privacyWarning.doNotShowAgain}
              </Checkbox>
            </Flexbox>
          ),
          onOk: () => {
            if (doNotShowAgain) setHidePrivacyWarning(true);
            void applyVisibility(visibility);
          },
        });
        return;
      }
      void applyVisibility(visibility);
    },
    [applyVisibility, currentVisibility, hidePrivacyWarning, setHidePrivacyWarning],
  );

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await copyToClipboard(shareUrl);
      showToast(shareStrings.copyLinkSuccess);
    } catch {
      showToast(shareStrings.updateError);
    }
  }, [shareUrl]);

  const handleOpenModal = useCallback(() => {
    close();
    onOpenModal?.();
  }, [close, onOpenModal]);

  if (!canShare) {
    return (
      <Flexbox className={sharePopoverStyles.container} gap={8}>
        <Text strong>{shareStrings.share}</Text>
        <Text type="secondary">{reason}</Text>
      </Flexbox>
    );
  }

  if (isApiMode) {
    return (
      <Flexbox className={sharePopoverStyles.container} gap={12}>
        <Text strong>{shareStrings.title}</Text>
        <Text className={sharePopoverStyles.hint} type="secondary">
          {shareStrings.apiDeferHint}
        </Text>
        <div className={sharePopoverStyles.divider} />
        <Flexbox horizontal align="center" justify="space-between">
          <Button
            icon={FileOutput}
            size="small"
            type="text"
            variant="text"
            onClick={handleOpenModal}
          >
            {shareStrings.export}
          </Button>
        </Flexbox>
      </Flexbox>
    );
  }

  if (loading || !shareInfo) {
    return (
      <Flexbox className={sharePopoverStyles.container} gap={16}>
        <Text strong>{shareStrings.share}</Text>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Flexbox>
    );
  }

  const visibilityOptions = [
    {
      icon: <Lock size={14} />,
      label: shareStrings.permissionPrivate,
      value: 'private' as const,
    },
    {
      icon: <Link size={14} />,
      label: shareStrings.permissionLink,
      value: 'link' as const,
    },
  ];

  const hint =
    currentVisibility === 'private' ? shareStrings.privateHint : shareStrings.linkHint;

  return (
    <Flexbox className={sharePopoverStyles.container} gap={12}>
      <Text strong>{shareStrings.title}</Text>

      <Flexbox gap={4}>
        <Text type="secondary">{shareStrings.visibility}</Text>
        <Select
          disabled={updating}
          options={visibilityOptions}
          style={{ width: '100%' }}
          value={currentVisibility}
          labelRender={({ value }) => {
            const option = visibilityOptions.find((o) => o.value === value);
            return (
              <Flexbox horizontal align="center" gap={8}>
                {option?.icon}
                {option?.label}
              </Flexbox>
            );
          }}
          optionRender={(option) => (
            <Flexbox horizontal align="center" gap={8}>
              {visibilityOptions.find((o) => o.value === option.value)?.icon}
              {option.label}
            </Flexbox>
          )}
          onChange={handleVisibilityChange}
        />
      </Flexbox>

      <Text className={sharePopoverStyles.hint} type="secondary">
        {hint}
      </Text>

      <div className={sharePopoverStyles.divider} />

      <Flexbox horizontal align="center" justify="space-between">
        <Button
          icon={FileOutput}
          size="small"
          type="text"
          variant="text"
          onClick={handleOpenModal}
        >
          {shareStrings.export}
        </Button>
        {currentVisibility !== 'private' && (
          <Button icon={Link} size="small" type="primary" onClick={handleCopyLink}>
            {shareStrings.copyLink}
          </Button>
        )}
      </Flexbox>
    </Flexbox>
  );
});

interface SharePopoverProps {
  children?: ReactNode;
  topicId?: string;
  onOpenModal?: () => void;
}

/** §C.39 SharePopover*/
export const SharePopover = memo(function SharePopover({
  children,
  topicId,
  onOpenModal,
}: SharePopoverProps) {
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);

  return (
    <Popover
      arrow={false}
      content={<SharePopoverContent topicId={topicId} onOpenModal={onOpenModal} />}
      placement={isMobileViewport ? 'top' : 'bottomRight'}
      trigger={['click']}
      styles={{
        content: {
          padding: 0,
          width: isMobileViewport ? '100vw' : 366,
        },
      }}
    >
      {children}
    </Popover>
  );
});
