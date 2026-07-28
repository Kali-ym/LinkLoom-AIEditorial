import { ActionIcon, DropdownMenu, Icon } from '@lobehub/ui';
import { Languages, Lightbulb, Sparkles } from 'lucide-react';
import { memo, useMemo } from 'react';

import { usePromptTransform } from './usePromptTransform';

interface PromptTransformActionProps {
  mode: 'image' | 'video' | 'text';
  onPromptChange: (prompt: string) => void;
  prompt?: string | null;
}

/** Upstream `PromptTransform/PromptTransformAction.tsx` — ActionIcon 32px */
export const PromptTransformAction = memo(function PromptTransformAction({
  mode,
  onPromptChange,
  prompt,
}: PromptTransformActionProps) {
  const {
    isRewriteEnabled,
    isTransformDisabled,
    isTransforming,
    rewritePrompt,
    transformAction,
    translatePrompt,
  } = usePromptTransform({ mode, onPromptChange, prompt });

  const menuItems = useMemo(
    () => [
      {
        icon: <Icon icon={Sparkles} />,
        key: 'rewrite',
        label: '丰富细节',
        onClick: rewritePrompt,
      },
      {
        icon: <Icon icon={Languages} />,
        key: 'translate',
        label: '翻译',
        onClick: translatePrompt,
      },
    ],
    [rewritePrompt, translatePrompt],
  );

  const primaryIcon = isRewriteEnabled ? Lightbulb : Languages;
  const handlePrimary = isRewriteEnabled ? rewritePrompt : translatePrompt;
  const title = isTransforming
    ? transformAction === 'translate'
      ? '正在翻译…'
      : '正在丰富细节…'
    : isRewriteEnabled
      ? '优化创意'
      : '翻译';

  const iconButton = (
    <ActionIcon
      disabled={isTransformDisabled || isTransforming}
      icon={primaryIcon}
      loading={isTransforming}
      size={{ blockSize: 32, size: 18 }}
      title={title}
      onClick={handlePrimary}
    />
  );

  if (!isRewriteEnabled) return iconButton;

  return (
    <DropdownMenu items={menuItems} placement="topRight" trigger={['hover']}>
      {iconButton}
    </DropdownMenu>
  );
});
