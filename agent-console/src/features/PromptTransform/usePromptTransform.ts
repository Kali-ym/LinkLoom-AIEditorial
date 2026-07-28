import { useCallback, useState } from 'react';

type PromptTransformAction = 'rewrite' | 'translate';

interface UsePromptTransformParams {
  mode: 'image' | 'video' | 'text';
  onPromptChange: (prompt: string) => void;
  prompt?: string | null;
}

/** Mock preset task — 待 chatService / adapter 接入后替换流式 API。 */
export function usePromptTransform({ mode, prompt, onPromptChange }: UsePromptTransformParams) {
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformAction, setTransformAction] = useState<PromptTransformAction>('rewrite');
  const isRewriteEnabled = mode === 'image' || mode === 'video';

  const runTransform = useCallback(
    async (action: PromptTransformAction) => {
      const trimmed = prompt?.trim();
      if (isTransforming || !trimmed) return;
      if (action === 'rewrite' && !isRewriteEnabled) return;

      setTransformAction(action);
      setIsTransforming(true);
      try {
        await new Promise((r) => window.setTimeout(r, 600));
        const next =
          action === 'rewrite'
            ? `${trimmed}，高细节，专业光影，8K 分辨率。`
            : `[EN] ${trimmed}`;
        onPromptChange(next);
      } finally {
        setIsTransforming(false);
        setTransformAction('rewrite');
      }
    },
    [isRewriteEnabled, isTransforming, onPromptChange, prompt],
  );

  const rewritePrompt = useCallback(() => runTransform('rewrite'), [runTransform]);
  const translatePrompt = useCallback(() => runTransform('translate'), [runTransform]);

  return {
    isRewriteEnabled,
    isTransformDisabled: !prompt?.trim(),
    isTransforming,
    rewritePrompt,
    transformAction,
    translatePrompt,
  };
}
