import { Block, Flexbox, Highlighter, Icon } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { Braces } from 'lucide-react';
import { memo, useMemo, type ReactNode } from 'react';

import { shinyTextStyles } from '../../../../../styles/shinyTextStyles';
import { commandBlock } from '../../../../../styles/scrollMixins';
import { safeParsePartialJSON } from '../../../../../utils/safeParsePartialJSON';
import { toolRenderStyles } from './toolRenderStyles';

type ChipTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning';

const argsStyles = createStaticStyles(({ css, cssVar }) => ({
  list: css`
    padding-block: 2px;
  `,
  row: css`
    display: grid;
    grid-template-columns: minmax(96px, 30%) minmax(0, 1fr);
    gap: 12px 16px;
    align-items: start;
    padding-block: 12px;
    padding-inline: 14px;
    border-block-end: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 68%, transparent);
    transition: background-color 0.15s ${cssVar.motionEaseOut};

    &:last-child {
      border-block-end: none;
    }

    &:hover {
      background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 42%, transparent);
    }
  `,
  keyPill: css`
    display: inline-flex;
    align-self: flex-start;
    max-width: 100%;
    padding-block: 3px;
    padding-inline: 8px;
    border-radius: 6px;
    font-family: ${cssVar.fontFamilyCode};
    font-size: 11px;
    font-weight: 600;
    line-height: 1.35;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillTertiary};
    word-break: break-word;
  `,
  value: css`
    min-width: 0;
    font-size: 13px;
    line-height: 1.5;
    color: ${cssVar.colorText};
    word-break: break-word;
  `,
  chipRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `,
  chip: css`
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding-block: 4px;
    padding-inline: 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.35;
    word-break: break-word;
  `,
  chipNeutral: css`
    color: ${cssVar.colorText};
    background: ${cssVar.colorFillQuaternary};
  `,
  chipSuccess: css`
    color: ${cssVar.colorSuccessText};
    border-color: color-mix(in srgb, ${cssVar.colorSuccess} 28%, ${cssVar.colorBorderSecondary});
    background: ${cssVar.colorSuccessBg};
  `,
  chipWarning: css`
    color: ${cssVar.colorWarningText};
    border-color: color-mix(in srgb, ${cssVar.colorWarning} 28%, ${cssVar.colorBorderSecondary});
    background: ${cssVar.colorWarningBg};
  `,
  chipInfo: css`
    color: ${cssVar.colorInfoText};
    border-color: color-mix(in srgb, ${cssVar.colorInfo} 28%, ${cssVar.colorBorderSecondary});
    background: ${cssVar.colorInfoBg};
  `,
  chipDanger: css`
    color: ${cssVar.colorErrorText};
    border-color: color-mix(in srgb, ${cssVar.colorError} 28%, ${cssVar.colorBorderSecondary});
    background: ${cssVar.colorErrorBg};
  `,
  codeBlock: css`
    ${commandBlock}
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorFillQuaternary};
    padding: 8px 10px;
  `,
  empty: css`
    padding: 16px;
    font-size: 13px;
    color: ${cssVar.colorTextTertiary};
    text-align: center;
  `,
}));

const chipToneClass: Record<ChipTone, string> = {
  danger: argsStyles.chipDanger,
  info: argsStyles.chipInfo,
  neutral: argsStyles.chipNeutral,
  success: argsStyles.chipSuccess,
  warning: argsStyles.chipWarning,
};

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) {
    return true;
  }
  return false;
}

function formatScalar(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null) return 'null';
  return String(value);
}

function resolveChipTone(label: string): ChipTone {
  const token = label.trim().toLowerCase();
  if (['production', 'prod', 'true', 'yes', 'success', 'completed', 'done', 'enabled', 'active'].includes(token)) {
    return 'success';
  }
  if (['staging', 'stage', 'pending', 'warning', 'beta', 'preview'].includes(token)) {
    return 'warning';
  }
  if (['dev', 'development', 'debug', 'info', 'multiple', 'single'].includes(token)) {
    return 'info';
  }
  if (['false', 'no', 'error', 'failed', 'rejected', 'disabled', 'inactive'].includes(token)) {
    return 'danger';
  }
  return 'neutral';
}

function shouldRenderScalarAsChip(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= 28 && !trimmed.includes('\n') && !trimmed.includes('{');
  }
  return false;
}

const ValueChip = memo(function ValueChip({
  label,
  loading,
}: {
  label: string;
  loading?: boolean;
}) {
  const tone = resolveChipTone(label);
  return (
    <span className={cx(argsStyles.chip, chipToneClass[tone], loading && shinyTextStyles.shinyText)}>
      {label}
    </span>
  );
});

const ArgValue = memo(function ArgValue({
  loading,
  value,
}: {
  loading?: boolean;
  value: unknown;
}) {
  const shiny = loading ? shinyTextStyles.shinyText : undefined;

  if (shouldRenderScalarAsChip(value)) {
    return <ValueChip label={formatScalar(value)} loading={loading} />;
  }

  if (typeof value === 'number') {
    return <span className={cx(argsStyles.value, shiny)}>{formatScalar(value)}</span>;
  }

  if (Array.isArray(value)) {
    const primitives = value.every(
      (item) => item === null || ['string', 'number', 'boolean'].includes(typeof item),
    );
    if (primitives) {
      return (
        <div className={argsStyles.chipRow}>
          {value.map((item, index) => (
            <ValueChip key={index} label={formatScalar(item)} loading={loading} />
          ))}
        </div>
      );
    }
  }

  let json = '';
  try {
    json = JSON.stringify(value, null, 2);
  } catch {
    json = String(value);
  }

  return (
    <div className={argsStyles.codeBlock}>
      <Highlighter language="json" showLanguage={false} variant="borderless" wrap>
        {json}
      </Highlighter>
    </div>
  );
});

const ArgRow = memo(function ArgRow({
  loading,
  name,
  value,
}: {
  loading?: boolean;
  name: string;
  value: unknown;
}) {
  return (
    <div className={argsStyles.row}>
      <span className={argsStyles.keyPill}>{name}</span>
      <div className={argsStyles.value}>
        <ArgValue loading={loading} value={value} />
      </div>
    </div>
  );
});

function filterArgEntries(obj: Record<string, unknown>) {
  return Object.entries(obj).filter(([, value]) => !isEmptyValue(value));
}

/** Polished argument / result preview for tools without a dedicated builtin render. */
export const ToolArgsPreview = memo(function ToolArgsPreview({
  arguments: requestArgs = '',
  content,
  emptyLabel = '暂无调用参数',
  loading = false,
  resultTitle = '执行结果',
  title = '调用参数',
  toolCallId,
}: {
  arguments?: string;
  content?: string | null;
  emptyLabel?: string;
  loading?: boolean;
  resultTitle?: string;
  title?: string;
  toolCallId?: string;
}) {
  const entries = useMemo(() => {
    const obj = safeParsePartialJSON(requestArgs);
    if (!obj || Object.keys(obj).length === 0) return [];
    return filterArgEntries(obj);
  }, [requestArgs]);

  const hasResult = Boolean(content?.trim());
  if (entries.length === 0 && !hasResult) {
    return (
      <Block className={toolRenderStyles.panel} id={toolCallId} variant="borderless" width="100%">
        <div className={argsStyles.empty}>{emptyLabel}</div>
      </Block>
    );
  }

  const panels: ReactNode[] = [];

  if (entries.length > 0) {
    panels.push(
      <Block className={toolRenderStyles.panel} key="args" variant="borderless" width="100%">
        <div className={toolRenderStyles.panelHeader}>
          <span className={toolRenderStyles.panelHeaderIcon}>
            <Icon icon={Braces} size={15} />
          </span>
          <span className={toolRenderStyles.panelHeaderTitle}>{title}</span>
          <span className={toolRenderStyles.panelBadge}>{entries.length} 项</span>
        </div>
        <div className={argsStyles.list}>
          {entries.map(([key, value]) => (
            <ArgRow key={key} loading={loading} name={key} value={value} />
          ))}
        </div>
      </Block>,
    );
  }

  if (hasResult) {
    panels.push(
      <Block className={toolRenderStyles.panel} key="result" variant="borderless" width="100%">
        <div className={toolRenderStyles.panelHeader}>
          <span className={toolRenderStyles.panelHeaderTitle}>{resultTitle}</span>
        </div>
        <div className={toolRenderStyles.bodyPad}>
          <Highlighter language="text" showLanguage={false} variant="borderless" wrap>
            {content!.trim()}
          </Highlighter>
        </div>
      </Block>,
    );
  }

  return (
    <Flexbox className={toolRenderStyles.shell} gap={10} id={toolCallId} width="100%">
      {panels}
    </Flexbox>
  );
});
