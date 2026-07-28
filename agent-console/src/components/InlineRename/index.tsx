import { Flexbox } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, useCallback, useEffect, useState } from 'react';

export interface InlineRenameProps {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string) => void | Promise<void>;
}

/** Minimal inline rename*/
export const InlineRename = memo(function InlineRename({
  open,
  title,
  onOpenChange,
  onSave,
}: InlineRenameProps) {
  const [value, setValue] = useState(title);

  useEffect(() => {
    if (open) setValue(title);
  }, [open, title]);

  const commit = useCallback(async () => {
    const next = value.trim();
    if (next && next !== title) await onSave(next);
    onOpenChange(false);
  }, [onOpenChange, onSave, title, value]);

  if (!open) return null;

  return (
    <Flexbox paddingBlock={4} paddingInline={4}>
      <input
        autoFocus
        value={value}
        style={{
          width: '100%',
          padding: '4px 8px',
          border: `1px solid ${cssVar.colorBorder}`,
          borderRadius: cssVar.borderRadius,
          background: cssVar.colorBgContainer,
          color: cssVar.colorText,
          fontSize: 13,
        }}
        onBlur={() => void commit()}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit();
          if (e.key === 'Escape') onOpenChange(false);
        }}
      />
    </Flexbox>
  );
});
