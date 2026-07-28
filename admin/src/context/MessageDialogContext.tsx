import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import MessageDialog from '../components/UI/MessageDialog';
import type { MessageDialogVariant } from '../components/UI/MessageDialog';

export interface MessageDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 图标与标题语气 */
  variant?: MessageDialogVariant;
  /** confirm 主按钮：default 主色 / danger 柔和红（删除等） */
  confirmTone?: 'default' | 'danger';
}

interface PendingDialog {
  mode: 'alert' | 'confirm';
  options: MessageDialogOptions;
  resolve: (value: boolean) => void;
}

interface MessageDialogContextType {
  alert: (options: MessageDialogOptions | string) => Promise<void>;
  confirm: (options: MessageDialogOptions | string) => Promise<boolean>;
}

const MessageDialogContext = createContext<MessageDialogContextType | undefined>(undefined);

function normalizeOptions(input: MessageDialogOptions | string): MessageDialogOptions {
  return typeof input === 'string' ? { message: input } : input;
}

function defaultTitle(mode: 'alert' | 'confirm', variant?: MessageDialogVariant): string {
  if (mode === 'confirm') return '请确认';
  if (variant === 'warning') return '提示';
  if (variant === 'danger') return '注意';
  return '提示';
}

export const MessageDialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const queueRef = useRef<PendingDialog[]>([]);
  const showingRef = useRef(false);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      showingRef.current = true;
      setPending(next);
    } else {
      showingRef.current = false;
      setPending(null);
    }
  }, []);

  const enqueue = useCallback(
    (mode: 'alert' | 'confirm', options: MessageDialogOptions) =>
      new Promise<boolean>((resolve) => {
        const item: PendingDialog = { mode, options, resolve };
        if (!showingRef.current) {
          showingRef.current = true;
          setPending(item);
        } else {
          queueRef.current.push(item);
        }
      }),
    []
  );

  const finish = useCallback(
    (confirmed: boolean) => {
      if (!pending) return;
      pending.resolve(confirmed);
      showNext();
    },
    [pending, showNext]
  );

  const alert = useCallback(
    async (input: MessageDialogOptions | string) => {
      const options = normalizeOptions(input);
      await enqueue('alert', { variant: 'default', ...options });
    },
    [enqueue]
  );

  const confirm = useCallback(
    async (input: MessageDialogOptions | string) => {
      const options = normalizeOptions(input);
      return enqueue('confirm', { variant: 'default', confirmTone: 'default', ...options });
    },
    [enqueue]
  );

  const dialogOptions = pending?.options;
  const mode = pending?.mode ?? 'alert';
  const variant = dialogOptions?.variant ?? 'default';
  const confirmTone = dialogOptions?.confirmTone ?? 'default';

  return (
    <MessageDialogContext.Provider value={{ alert, confirm }}>
      {children}
      <MessageDialog
        isOpen={!!pending}
        mode={mode}
        title={dialogOptions?.title ?? defaultTitle(mode, variant)}
        message={dialogOptions?.message ?? ''}
        confirmLabel={dialogOptions?.confirmLabel}
        cancelLabel={dialogOptions?.cancelLabel}
        variant={variant}
        confirmTone={mode === 'confirm' ? confirmTone : 'default'}
        onConfirm={() => finish(true)}
        onCancel={() => finish(false)}
      />
    </MessageDialogContext.Provider>
  );
};

export const useMessageDialog = () => {
  const context = useContext(MessageDialogContext);
  if (!context) {
    throw new Error('useMessageDialog must be used within a MessageDialogProvider');
  }
  return context;
};
