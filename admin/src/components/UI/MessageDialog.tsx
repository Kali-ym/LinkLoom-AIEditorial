import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type MessageDialogVariant = 'default' | 'warning' | 'danger';

export interface MessageDialogProps {
  isOpen: boolean;
  mode: 'alert' | 'confirm';
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: MessageDialogVariant;
  confirmTone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

const accentStyles: Record<
  MessageDialogVariant,
  { icon: string; headerBg: string; iconWrap: string; iconColor: string; detailBorder: string }
> = {
  default: {
    icon: 'info',
    headerBg: 'bg-surface-soft/90 dark:bg-white/[0.03]',
    iconWrap: 'bg-surface dark:bg-white/5',
    iconColor: 'text-text-steel dark:text-text-secondary',
    detailBorder: 'border-hairline dark:border-white/10'
  },
  warning: {
    icon: 'error_outline',
    headerBg: 'bg-surface-yellow dark:bg-amber-500/[0.06]',
    iconWrap: 'bg-brand-yellow/40 dark:bg-amber-500/10',
    iconColor: 'text-yellow-dark dark:text-amber-300',
    detailBorder: 'border-brand-yellow/50 dark:border-amber-500/20'
  },
  danger: {
    icon: 'warning',
    headerBg: 'bg-rose-light dark:bg-red-500/[0.05]',
    iconWrap: 'bg-coral-light dark:bg-red-500/10',
    iconColor: 'text-coral-dark dark:text-red-400/90',
    detailBorder: 'border-coral-light dark:border-red-500/15'
  }
};

function parseMessageBody(message: string): { lead: string; bullets: string[] } {
  const parts = message.split(/\n\n+/);
  if (parts.length < 2) return { lead: message.trim(), bullets: [] };

  const lead = parts[0].trim();
  const tail = parts.slice(1).join('\n').trim();
  const lines = tail
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const bulletLines = lines.filter((l) => /^[·•\-*]\s/.test(l));

  if (bulletLines.length === 0) {
    return { lead: message.trim(), bullets: [] };
  }

  return {
    lead,
    bullets: bulletLines.map((l) => l.replace(/^[·•\-*]\s*/, ''))
  };
}

function MessageBody({ message, variant }: { message: string; variant: MessageDialogVariant }) {
  const { lead, bullets } = useMemo(() => parseMessageBody(message), [message]);
  const accent = accentStyles[variant];

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-text-charcoal dark:text-text-secondary leading-relaxed">
        {lead}
      </p>
      {bullets.length > 0 && (
        <ul
          className={`rounded-2xl border ${accent.detailBorder} bg-surface-soft/80 dark:bg-white/[0.02] px-3.5 py-2.5 space-y-1.5`}
        >
          {bullets.map((item, i) => (
            <li
              key={i}
              className="text-[12px] text-text-charcoal dark:text-text-secondary leading-snug pl-0 flex gap-2"
            >
              <span className="text-text-stone dark:text-text-secondary shrink-0">·</span>
              <span className="font-mono text-[11px] sm:text-[12px] break-all">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const MessageDialog: React.FC<MessageDialogProps> = ({
  isOpen,
  mode,
  title,
  message,
  confirmLabel,
  cancelLabel = '取消',
  variant = 'default',
  confirmTone,
  onConfirm,
  onCancel
}) => {
  const accent = accentStyles[variant];
  const isAlert = mode === 'alert';
  const tone = isAlert ? 'dismiss' : (confirmTone ?? 'default');
  const primaryLabel = confirmLabel ?? (isAlert ? '知道了' : '确定');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && isAlert) onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel, onConfirm, isAlert]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-ink/40 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="message-dialog-title"
          aria-describedby="message-dialog-desc"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative bg-canvas dark:bg-surface-dark w-full max-w-[440px] rounded-3xl shadow-modal border border-hairline-soft dark:border-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶栏：图标 + 标题 + 关闭，不与正文抢位 */}
            <div
              className={`flex items-center gap-3 px-5 py-4 sm:px-6 border-b border-hairline-soft dark:border-white/5 ${accent.headerBg}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${accent.iconWrap}`}
              >
                <span className={`material-symbols-outlined text-[20px] ${accent.iconColor}`}>
                  {accent.icon}
                </span>
              </div>
              <h3
                id="message-dialog-title"
                className="flex-1 min-w-0 text-[15px] font-medium text-text-ink dark:text-white leading-snug pr-1"
              >
                {title}
              </h3>
              <button
                type="button"
                onClick={onCancel}
                className="shrink-0 w-8 h-8 inline-flex items-center justify-center text-text-stone hover:text-text-ink dark:hover:text-white hover:bg-surface dark:hover:bg-white/5 rounded-full transition-colors"
                aria-label="关闭"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div id="message-dialog-desc" className="px-5 py-4 sm:px-6 sm:py-5">
              <MessageBody message={message} variant={variant} />
            </div>

            <div className="border-t border-hairline-soft bg-surface-soft/70 px-4 py-3.5 dark:border-white/5 dark:bg-white/[0.02] sm:px-6 sm:py-4">
              <div className="flex w-full justify-end gap-2">
                {!isAlert && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex flex-1 sm:flex-initial items-center justify-center whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] font-medium text-text-charcoal transition-colors hover:bg-surface dark:text-text-secondary dark:hover:bg-white/5"
                  >
                    {cancelLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onConfirm}
                  className={`inline-flex flex-1 sm:flex-initial items-center justify-center whitespace-nowrap rounded-full px-5 py-2.5 text-[13px] font-medium transition-all active:scale-[0.98] ${
                    tone === 'danger'
                      ? 'border border-coral-light bg-coral-light text-coral-dark hover:bg-rose-light'
                      : tone === 'dismiss'
                        ? 'border border-hairline-strong bg-canvas text-text-ink hover:border-ink dark:border-white/10 dark:bg-white/5 dark:text-white'
                        : 'bg-ink text-white hover:bg-charcoal dark:bg-white dark:text-ink dark:hover:bg-slate-100'
                  }`}
                >
                  {primaryLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MessageDialog;
