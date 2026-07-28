import { Block, Flexbox, Highlighter, Icon, Markdown, Tag, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { ExternalLink } from 'lucide-react';
import { memo, useMemo } from 'react';

import type { BuiltinRenderProps } from '../../toolComponentTypes';
import { safeParsePartialJSON } from '../../../../../../utils/safeParsePartialJSON';
import { LINEAR_MCP_PREFIX } from '../linearApiNames';

interface LinearField {
  label?: string;
  value?: string;
}

interface LinearLink {
  label?: string;
  url?: string;
}

interface LinearEntity {
  description?: string;
  fields?: LinearField[];
  identifier?: string;
  links?: LinearLink[];
  status?: string;
  title?: string;
  type?: string;
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  description: css`
    overflow: auto;
    max-height: 180px;
    padding: 8px 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 6px;
    background: ${cssVar.colorFillQuaternary};
  `,
  fieldGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 6px;
  `,
  fieldItem: css`
    overflow: hidden;
    min-width: 0;
    padding: 6px 8px;
    border-radius: 6px;
    background: ${cssVar.colorFillQuaternary};
  `,
  fieldLabel: css`
    display: block;
    margin-block-end: 2px;
    font-size: 11px;
    color: ${cssVar.colorTextTertiary};
  `,
  fieldValue: css`
    overflow: hidden;
    display: block;
    min-width: 0;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  linkRow: css`
    overflow: hidden;
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
    padding: 6px 8px;
    border-radius: 6px;
    background: ${cssVar.colorFillQuaternary};
  `,
}));

function buildLinearEntity(content?: string | null, pluginState?: unknown): LinearEntity | undefined {
  if (pluginState && typeof pluginState === 'object') return pluginState as LinearEntity;
  if (!content?.trim()) return undefined;
  try {
    return JSON.parse(content) as LinearEntity;
  } catch {
    const partial = safeParsePartialJSON(content);
    return partial && typeof partial === 'object' ? (partial as LinearEntity) : undefined;
  }
}

/** §C.45*/
export const LinearRender = memo(function LinearRender({
  apiName,
  content,
  pluginState,
}: BuiltinRenderProps) {
  const entity = useMemo(() => buildLinearEntity(content, pluginState), [content, pluginState]);
  const toolLabel = apiName.startsWith(LINEAR_MCP_PREFIX)
    ? apiName.slice(LINEAR_MCP_PREFIX.length)
    : apiName;

  if (!entity) {
    if (!content?.trim()) return null;
    return (
      <Block padding={12} variant="outlined" width="100%">
        <Flexbox gap={8}>
          <Text type="secondary">Linear · {toolLabel}</Text>
          <Highlighter language="json" showLanguage={false} variant="borderless" wrap>
            {content}
          </Highlighter>
        </Flexbox>
      </Block>
    );
  }

  return (
    <Block padding={12} variant="outlined" width="100%">
      <Flexbox gap={10}>
        <Flexbox horizontal align="flex-start" justify="space-between" gap={8}>
          <Flexbox gap={4} style={{ minWidth: 0 }}>
            <Text ellipsis strong>
              {entity.title || entity.identifier || toolLabel}
            </Text>
            {entity.identifier ? (
              <Text style={{ fontSize: 12 }} type="secondary">
                {entity.identifier}
              </Text>
            ) : null}
          </Flexbox>
          <Flexbox horizontal gap={6}>
            {entity.type ? <Tag>{entity.type}</Tag> : null}
            {entity.status ? <Tag color="blue">{entity.status}</Tag> : null}
          </Flexbox>
        </Flexbox>
        {entity.fields?.length ? (
          <div className={styles.fieldGrid}>
            {entity.fields.map((field, index) => (
              <div className={styles.fieldItem} key={`${field.label}-${index}`}>
                <span className={styles.fieldLabel}>{field.label}</span>
                <span className={styles.fieldValue}>{field.value}</span>
              </div>
            ))}
          </div>
        ) : null}
        {entity.links?.length ? (
          <Flexbox gap={6}>
            {entity.links.map((link, index) => (
              <div className={styles.linkRow} key={`${link.url}-${index}`}>
                <Icon icon={ExternalLink} size={14} />
                <Text ellipsis>{link.label || link.url}</Text>
              </div>
            ))}
          </Flexbox>
        ) : null}
        {entity.description ? (
          <div className={styles.description}>
            <Markdown variant="chat">{entity.description}</Markdown>
          </div>
        ) : null}
      </Flexbox>
    </Block>
  );
});
