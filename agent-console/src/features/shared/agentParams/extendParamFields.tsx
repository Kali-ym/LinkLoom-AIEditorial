import { Flexbox, Select } from '@lobehub/ui';
import { memo } from 'react';

import type { AgentChatConfig, AgentModelParams, ReasoningEffort } from '../../../domain/types';
import { ParamSwitch } from './ParamSwitch';
import { CONSOLE_REASONING_EFFORT_OPTIONS } from './paramsConstants';
import { paramsStrings } from './paramsStrings';
import { paramsStyles } from './paramsStyles';

export type ExtendParamKey =
  | 'disableContextCaching'
  | 'enableReasoning'
  | 'preserveThinking'
  | 'textVerbosity'
  | 'thinking';

interface ExtendParamFieldsProps {
  canCreate: boolean;
  chatConfig: AgentChatConfig;
  extendParams: readonly ExtendParamKey[];
  params: AgentModelParams;
  onPatch: (patch: Partial<AgentChatConfig>) => void;
  onPatchParams: (patch: Partial<AgentModelParams>) => void;
}

const ControlRow = memo(function ControlRow({
  action,
  children,
  tag,
  title,
}: {
  action?: React.ReactNode;
  children?: React.ReactNode;
  tag?: string;
  title: string;
}) {
  return (
    <div className={paramsStyles.rowRoot}>
      <div style={{ alignItems: 'center', display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        <Flexbox align="flex-start" gap={5} style={{ minWidth: 0 }}>
          <span className={paramsStyles.label}>{title}</span>
          {tag ? <span className={paramsStyles.tag}>{tag}</span> : null}
        </Flexbox>
        {action}
      </div>
      {children ? <div className={paramsStyles.rowControl}>{children}</div> : null}
    </div>
  );
});

/** mock ControlsForm — 按 extendParams 顺序渲染模型扩展字段 */
export const ExtendParamFields = memo(function ExtendParamFields({
  canCreate,
  chatConfig,
  extendParams,
  params,
  onPatch,
  onPatchParams,
}: ExtendParamFieldsProps) {
  const reasoningOn =
    Boolean(chatConfig.enableReasoning) || Boolean(chatConfig.enableReasoningEffort);

  return (
    <>
      {extendParams.map((key) => {
        if (key === 'enableReasoning') {
          return (
            <ControlRow
              key={key}
              title={paramsStrings.enableReasoning}
              action={
                <ParamSwitch
                  checked={reasoningOn}
                  disabled={!canCreate}
                  onChange={(checked) => {
                    onPatch({
                      enableReasoning: checked,
                      enableReasoningEffort: false,
                    });
                    if (checked && (params.reasoning_effort == null || params.reasoning_effort === null)) {
                      onPatchParams({ reasoning_effort: 'medium' });
                    }
                  }}
                />
              }
            >
              {reasoningOn ? (
                <Select
                  disabled={!canCreate}
                  options={CONSOLE_REASONING_EFFORT_OPTIONS}
                  size="small"
                  style={{ width: '100%' }}
                  value={params.reasoning_effort ?? 'medium'}
                  onChange={(value) =>
                    onPatchParams({ reasoning_effort: value as ReasoningEffort })
                  }
                />
              ) : null}
            </ControlRow>
          );
        }

        if (key === 'preserveThinking') {
          return (
            <ControlRow
              key={key}
              title={paramsStrings.preserveThinking}
              action={
                <ParamSwitch
                  checked={Boolean(chatConfig.preserveThinking)}
                  disabled={!canCreate}
                  onChange={(checked) => onPatch({ preserveThinking: checked })}
                />
              }
            />
          );
        }

        if (key === 'disableContextCaching') {
          return (
            <ControlRow
              key={key}
              title={paramsStrings.disableContextCaching}
              action={
                <ParamSwitch
                  checked={Boolean(chatConfig.disableContextCaching)}
                  disabled={!canCreate}
                  onChange={(checked) => onPatch({ disableContextCaching: checked })}
                />
              }
            />
          );
        }

        if (key === 'textVerbosity') {
          return (
            <ControlRow key={key} title={paramsStrings.textVerbosity}>
              <Select
                disabled={!canCreate}
                options={[
                  { label: paramsStrings.reasoningLow, value: 'low' },
                  { label: paramsStrings.reasoningMedium, value: 'medium' },
                  { label: paramsStrings.reasoningHigh, value: 'high' },
                ]}
                size="small"
                style={{ width: '100%' }}
                value={chatConfig.textVerbosity ?? 'medium'}
                onChange={(value) =>
                  onPatch({ textVerbosity: value as AgentChatConfig['textVerbosity'] })
                }
              />
            </ControlRow>
          );
        }

        if (key === 'thinking') {
          return (
            <ControlRow key={key} title={paramsStrings.thinking}>
              <Select
                disabled={!canCreate}
                options={[
                  { label: paramsStrings.thinkingAuto, value: 'auto' },
                  { label: paramsStrings.thinkingEnabled, value: 'enabled' },
                  { label: paramsStrings.thinkingDisabled, value: 'disabled' },
                ]}
                size="small"
                style={{ width: '100%' }}
                value={chatConfig.thinking ?? 'auto'}
                onChange={(value) =>
                  onPatch({ thinking: value as AgentChatConfig['thinking'] })
                }
              />
            </ControlRow>
          );
        }

        return null;
      })}
    </>
  );
});
