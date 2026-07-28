import { Flexbox, Icon, SliderWithInput, TextArea } from '@lobehub/ui';
import { cx } from 'antd-style';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

import { InfoTooltip } from '../../../components/InfoTooltip';
import { NeuralNetworkLoading } from '../../../components/NeuralNetworkLoading';
import { useAgentModelMeta } from '../../../hooks/useAgentModelMeta';
import { usePermission } from '../../../hooks/usePermission';
import { useUpdateAgentConfig } from '../../../hooks/useUpdateAgentConfig';
import type { AgentModelParams } from '../../../domain/types';
import { useAgentStore } from '../../../stores';
import { debounce } from '../../../utils/debounce';
import { ParamSwitch } from './ParamSwitch';
import { ExtendParamFields } from './extendParamFields';
import {
  ADVANCED_OPEN_STORAGE_KEY,
  MODEL_CONFIG_OPEN_STORAGE_KEY,
  PARAM_DEFAULTS,
  PARAM_ORDER,
  PARAM_SLIDER_CONFIG,
  type ParamKey,
  getStoredSectionOpen,
  setStoredSectionOpen,
} from './paramsConstants';
import { paramsStrings } from './paramsStrings';
import { paramsStyles } from './paramsStyles';

interface ControlsProps {
  variant?: 'popover' | 'sidebar';
}

const ControlRow = memo(function ControlRow({
  action,
  children,
  description,
  muted,
  tag,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  description?: string;
  muted?: boolean;
  tag?: string;
  title: string;
}) {
  return (
    <Flexbox className={cx('control-row', paramsStyles.rowRoot, muted && paramsStyles.muted)} gap={8}>
      <Flexbox horizontal align="center" gap={12} justify="space-between">
        <Flexbox align="flex-start" className={cx(paramsStyles.label, 'control-label')} gap={6}>
          <Flexbox horizontal align="center" gap={6}>
            <span>{title}</span>
            {description ? <InfoTooltip title={description} /> : null}
          </Flexbox>
          {tag ? <span className={paramsStyles.tag}>{tag}</span> : null}
        </Flexbox>
        {action}
      </Flexbox>
      {children ? <div className={paramsStyles.rowControl}>{children}</div> : null}
    </Flexbox>
  );
});

const SectionHeader = memo(function SectionHeader({
  onToggle,
  open,
  title,
}: {
  onToggle: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <button
      aria-expanded={open}
      className={paramsStyles.sectionHeader}
      type="button"
      onClick={onToggle}
    >
      <Flexbox horizontal align="center" gap={12} justify="space-between" width="100%">
        <span>{title}</span>
        <Flexbox horizontal align="center" className={paramsStyles.sectionHeaderMeta} gap={6}>
          <span>{open ? '收起' : '展开'}</span>
          <Icon icon={open ? ChevronUp : ChevronDown} size={16} />
        </Flexbox>
      </Flexbox>
    </button>
  );
});

/** §C.23 Params*/
export const Controls = memo(function Controls({ variant = 'sidebar' }: ControlsProps) {
  const { allowed: canCreate } = usePermission('create_content');
  const { updateAgentConfig } = useUpdateAgentConfig();
  const plusState = useAgentStore((s) => s.getActivePlusState());
  const isAgentMode = useAgentStore((s) => s.isAgentModeEnabled());
  const { disabledParams, extendParams, hasExtendParams } = useAgentModelMeta();
  const chatConfig = plusState.chatConfig;
  const params = plusState.params;

  const [updating, setUpdating] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    getStoredSectionOpen(ADVANCED_OPEN_STORAGE_KEY),
  );
  const [modelConfigOpen, setModelConfigOpen] = useState(() =>
    getStoredSectionOpen(MODEL_CONFIG_OPEN_STORAGE_KEY, true),
  );

  const lastValuesRef = useRef<Record<ParamKey, number>>({
    frequency_penalty: PARAM_DEFAULTS.frequency_penalty,
    presence_penalty: PARAM_DEFAULTS.presence_penalty,
    temperature: PARAM_DEFAULTS.temperature,
    top_p: PARAM_DEFAULTS.top_p,
  });

  const debouncedSave = useMemo(
    () =>
      debounce((patch: Parameters<typeof updateAgentConfig>[0]) => {
        setUpdating(true);
        updateAgentConfig(patch);
        window.setTimeout(() => setUpdating(false), 280);
      }, 500),
    [updateAgentConfig],
  );

  const patchChat = useCallback(
    (patch: Partial<typeof chatConfig>) => {
      if (!canCreate) return;
      updateAgentConfig({ chatConfig: patch });
    },
    [canCreate, updateAgentConfig],
  );

  const patchChatDebounced = useCallback(
    (patch: Partial<typeof chatConfig>) => {
      if (!canCreate) return;
      debouncedSave({ chatConfig: patch });
    },
    [canCreate, debouncedSave],
  );

  const patchParams = useCallback(
    (patch: Partial<AgentModelParams>) => {
      if (!canCreate) return;
      debouncedSave({ params: patch });
    },
    [canCreate, debouncedSave],
  );

  const handleParamToggle = useCallback(
    (key: ParamKey, enabled: boolean) => {
      if (!canCreate) return;
      setUpdating(true);
      if (!enabled) {
        const current =
          key === 'temperature'
            ? params.temperature
            : key === 'top_p'
              ? params.top_p
              : key === 'presence_penalty'
                ? params.presence_penalty
                : params.frequency_penalty;
        if (typeof current === 'number') lastValuesRef.current[key] = current;
        updateAgentConfig({ params: { [key]: null } as Partial<AgentModelParams> });
      } else {
        const next = lastValuesRef.current[key] ?? PARAM_DEFAULTS[key];
        updateAgentConfig({ params: { [key]: next } as Partial<AgentModelParams> });
      }
      window.setTimeout(() => setUpdating(false), 280);
    },
    [canCreate, params, updateAgentConfig],
  );

  const enabledMap: Record<ParamKey, boolean> = {
    frequency_penalty: typeof params.frequency_penalty === 'number',
    presence_penalty: typeof params.presence_penalty === 'number',
    temperature: typeof params.temperature === 'number',
    top_p: typeof params.top_p === 'number',
  };

  const panelTitle = isAgentMode ? paramsStrings.agentTitle : paramsStrings.title;

  return (
    <div className={paramsStyles.form}>
      <div className={cx(paramsStyles.panel, variant === 'sidebar' && paramsStyles.panel)}>
        <div className={paramsStyles.header}>
          <span className={paramsStyles.headerIcon}>
            <Icon icon={SlidersHorizontal} size={15} />
          </span>
          <span className={paramsStyles.headerTitle}>{panelTitle}</span>
          {updating ? <NeuralNetworkLoading size={18} /> : null}
        </div>
        <div className={paramsStyles.body}>
          <div className={paramsStyles.settingsCard}>
            <div className={paramsStyles.commonSection}>
            <ControlRow
              description={paramsStrings.contextCompressionDesc}
              tag="compression"
              title={paramsStrings.contextCompression}
              action={
                <ParamSwitch
                  checked={chatConfig.enableContextCompression !== false}
                  disabled={!canCreate}
                  onChange={(checked) => patchChat({ enableContextCompression: checked })}
                />
              }
            />
            <ControlRow
              tag="history"
              title={paramsStrings.historyLimit}
              action={
                <ParamSwitch
                  checked={Boolean(chatConfig.enableHistoryCount)}
                  disabled={!canCreate}
                  onChange={(checked) => patchChat({ enableHistoryCount: checked })}
                />
              }
            >
              {chatConfig.enableHistoryCount ? (
                <SliderWithInput
                  changeOnWheel
                  className={paramsStyles.slider}
                  controls={false}
                  disabled={!canCreate}
                  gap={10}
                  max={20}
                  min={0}
                  size="small"
                  step={1}
                  style={{ height: 28 }}
                  unlimitedInput
                  value={chatConfig.historyCount ?? 20}
                    onChange={(value) => patchChatDebounced({ historyCount: value })}
                />
              ) : null}
            </ControlRow>
            <ControlRow
              tag="autoScroll"
              title={paramsStrings.autoScroll}
              action={
                <ParamSwitch
                  checked={chatConfig.enableAutoScrollOnStreaming !== false}
                  disabled={!canCreate}
                  onChange={(checked) => patchChat({ enableAutoScrollOnStreaming: checked })}
                />
              }
            />
            <ControlRow
              tag="streaming"
              title={paramsStrings.streaming}
              action={
                <ParamSwitch
                  checked={chatConfig.enableStreaming !== false}
                  disabled={!canCreate}
                  onChange={(checked) => patchChat({ enableStreaming: checked })}
                />
              }
            />
            <ControlRow
              tag="followUpChips"
              title={paramsStrings.followUpChips}
              action={
                <ParamSwitch
                  checked={Boolean(chatConfig.enableFollowUpChips)}
                  disabled={!canCreate}
                  onChange={(checked) => patchChat({ enableFollowUpChips: checked })}
                />
              }
            >
              {chatConfig.enableFollowUpChips ? (
                <div className={paramsStyles.hint}>{paramsStrings.followUpHint}</div>
              ) : null}
            </ControlRow>
            <ControlRow tag="inputTemplate" title={paramsStrings.inputTemplate}>
              <TextArea
                className={paramsStyles.textarea}
                disabled={!canCreate}
                placeholder={paramsStrings.inputTemplatePlaceholder}
                value={chatConfig.inputTemplate ?? ''}
                onChange={(e) => patchChatDebounced({ inputTemplate: e.target.value })}
              />
            </ControlRow>
            </div>
          </div>

          <div className={paramsStyles.sectionBlock}>
          <SectionHeader
            open={modelConfigOpen}
            title={paramsStrings.modelConfig}
            onToggle={() => {
              setModelConfigOpen((open) => {
                const next = !open;
                setStoredSectionOpen(MODEL_CONFIG_OPEN_STORAGE_KEY, next);
                return next;
              });
            }}
          />
          {modelConfigOpen ? (
            <div className={cx(paramsStyles.modelConfigSection, paramsStyles.sectionBody)}>
              <ControlRow
                tag="max_context_window"
                title={paramsStrings.maxContextWindow}
                action={
                  <ParamSwitch
                    checked={Boolean(chatConfig.enableMaxContextWindow)}
                    disabled={!canCreate}
                    onChange={(checked) => {
                      if (checked && chatConfig.maxContextWindow == null) {
                        patchChat({ maxContextWindow: 200_000 });
                      }
                      patchChat({ enableMaxContextWindow: checked });
                    }}
                  />
                }
              >
                {chatConfig.enableMaxContextWindow ? (
                  <SliderWithInput
                    changeOnWheel
                    className={paramsStyles.slider}
                    controls={false}
                    disabled={!canCreate}
                    gap={10}
                    max={2_000_000}
                    min={4_096}
                    size="small"
                    step={1024}
                    style={{ height: 28 }}
                    unlimitedInput
                    value={chatConfig.maxContextWindow ?? 200_000}
                    onChange={(value) => patchChatDebounced({ maxContextWindow: value })}
                  />
                ) : null}
              </ControlRow>
              {hasExtendParams ? (
                <ExtendParamFields
                  canCreate={canCreate}
                  chatConfig={chatConfig}
                  extendParams={extendParams}
                  params={params}
                  onPatch={patchChat}
                  onPatchParams={patchParams}
                />
              ) : null}
            </div>
          ) : null}
          </div>

          {!isAgentMode ? (
            <>
              <div className={paramsStyles.sectionBlock}>
              <SectionHeader
                open={advancedOpen}
                title={paramsStrings.advanced}
                onToggle={() => {
                  setAdvancedOpen((open) => {
                    const next = !open;
                    setStoredSectionOpen(ADVANCED_OPEN_STORAGE_KEY, next);
                    return next;
                  });
                }}
              />
              {advancedOpen ? (
                <div className={cx(paramsStyles.advancedContent, paramsStyles.sectionBody)}>
                  {PARAM_ORDER.filter((key) => !disabledParams.includes(key)).map((key) => {
                    const meta = PARAM_SLIDER_CONFIG[key];
                    const enabled = enabledMap[key];
                    const titles: Record<ParamKey, string> = {
                      frequency_penalty: paramsStrings.vocabularyRichness,
                      presence_penalty: paramsStrings.topicDivergence,
                      temperature: paramsStrings.creativity,
                      top_p: paramsStrings.openness,
                    };
                    return (
                      <ControlRow
                        key={key}
                        muted={!enabled}
                        tag={meta.tag}
                        title={titles[key]}
                        action={
                          <ParamSwitch
                            checked={enabled}
                            disabled={!canCreate}
                            onChange={(checked) => handleParamToggle(key, checked)}
                          />
                        }
                      >
                        {enabled ? (
                          <SliderWithInput
                            changeOnWheel
                            className={paramsStyles.slider}
                            controls={false}
                            disabled={!canCreate}
                            gap={10}
                            max={meta.max}
                            min={meta.min}
                            size="small"
                            step={meta.step}
                            style={{ height: 28 }}
                            value={
                              (key === 'temperature'
                                ? params.temperature
                                : key === 'top_p'
                                  ? params.top_p
                                  : key === 'presence_penalty'
                                    ? params.presence_penalty
                                    : params.frequency_penalty) ?? PARAM_DEFAULTS[key]
                            }
                            onChange={(value) => {
                              lastValuesRef.current[key] = value;
                              patchParams({ [key]: value } as Partial<AgentModelParams>);
                            }}
                          />
                        ) : null}
                      </ControlRow>
                    );
                  })}
                  <ControlRow
                    tag="max_tokens"
                    title={paramsStrings.responseLength}
                    action={
                      <ParamSwitch
                        checked={Boolean(chatConfig.enableMaxTokens)}
                        disabled={!canCreate}
                        onChange={(checked) => {
                          if (checked && params.max_tokens == null) {
                            patchParams({ max_tokens: 4096 });
                          }
                          patchChat({ enableMaxTokens: checked });
                        }}
                      />
                    }
                  >
                    {chatConfig.enableMaxTokens ? (
                      <SliderWithInput
                        changeOnWheel
                        className={paramsStyles.slider}
                        controls={false}
                        disabled={!canCreate}
                        gap={10}
                        max={32_000}
                        min={0}
                        size="small"
                        step={100}
                        style={{ height: 28 }}
                        unlimitedInput
                        value={params.max_tokens ?? 4096}
                        onChange={(value) => patchParams({ max_tokens: value })}
                      />
                    ) : null}
                  </ControlRow>
                </div>
              ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
});

export default Controls;
