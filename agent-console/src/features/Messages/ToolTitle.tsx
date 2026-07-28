import { createStaticStyles, cx } from 'antd-style';

import type { ToolPayload } from '../../domain/types/tool';
import { shinyTextStyles } from '../../styles/shinyTextStyles';

export const toolTitleStyles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    color: ${cssVar.colorTextDescription};
  `,
  aborted: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  pluginName: css``,
  chevron: css`
    margin-inline: 4px;
  `,
  apiName: css`
    font-family: ${cssVar.fontFamilyCode};
    color: ${cssVar.colorTextSecondary};
  `,
  paramKey: css`
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
  paramVal: css`
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
}));

function truncateValue(value: string, max = 50): string {
  return value.length <= max ? value : `${value.slice(0, max)}...`;
}

/** §C.3 ToolTitle — plugin › api (key: value) */
export function renderToolTitle(tool: ToolPayload, executing: boolean, aborted: boolean) {
  if (tool.customTitle) {
    return (
      <span className={cx(toolTitleStyles.root, aborted && toolTitleStyles.aborted, executing && shinyTextStyles.shinyText)}>
        {tool.customTitle}
      </span>
    );
  }

  const plugin = tool.plugin || tool.identifier || 'plugin';
  const api = tool.api || tool.apiName || 'api';
  const params = tool.params || tool.arguments || tool.args || {};
  const keys = Object.keys(params);

  return (
    <span
      className={cx(
        toolTitleStyles.root,
        aborted && toolTitleStyles.aborted,
        executing && shinyTextStyles.shinyText,
      )}
    >
      <span>{plugin}</span>
      <span className={toolTitleStyles.chevron}>›</span>
      <span className={toolTitleStyles.apiName}>{api}</span>
      {keys.length > 0 && (() => {
        const k = keys[0];
        const val = truncateValue(String(params[k]));
        return (
          <>
            <span className={toolTitleStyles.paramKey}> ({k}: </span>
            <span className={toolTitleStyles.paramVal}>{val}</span>
            <span className={toolTitleStyles.paramKey}>)</span>
          </>
        );
      })()}
    </span>
  );
}
