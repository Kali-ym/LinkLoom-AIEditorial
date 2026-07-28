import { Accordion, AccordionItem, Button, Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  extractHost,
  getEndpointPath,
  getProviderDisplayName,
  getProviderTypeLabel,
  maskApiKeyDisplay,
  REASONING_EFFORT_OPTIONS,
} from '../../../../settings/fields/ai/aiProviderUtils';
import {
  formatProviderModelsList,
  isModelMultimodalEnabled,
} from '../../../../adapters/aiProviderSettings';
import { getSettingsRoutePath, useFindEnabledModel } from '../../../../hooks/data/useCatalog';
import { useAiProviderSettings } from '../../../../hooks/data/useAiProviderSettings';
import { modelStrings } from '../modelStrings';

const detailStyles = createStaticStyles(({ css }) => ({
  row: css`
    padding-block: 4px;
    padding-inline: 8px;
    font-size: 12px;
  `,
  rowLabel: css`
    flex-shrink: 0;
    color: ${cssVar.colorTextSecondary};
  `,
  rowValue: css`
    text-align: end;
    word-break: break-all;
    color: ${cssVar.colorText};
  `,
  rowValueMono: css`
    font-family: ${cssVar.fontFamilyCode};
  `,
  footer: css`
    padding-block: 4px 8px;
    padding-inline: 8px;
  `,
}));

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <Flexbox horizontal align="flex-start" className={detailStyles.row} gap={12} justify="space-between">
      <span className={detailStyles.rowLabel}>{label}</span>
      <span className={`${detailStyles.rowValue}${mono ? ` ${detailStyles.rowValueMono}` : ''}`}>
        {value}
      </span>
    </Flexbox>
  );
}

function getReasoningEffortLabel(value?: string): string {
  const option = REASONING_EFFORT_OPTIONS.find((entry) => entry.value === value);
  return option?.label ?? REASONING_EFFORT_OPTIONS[0].label;
}

interface ModelDetailPanelProps {
  model: string;
  provider: string;
}

/** §C.42 — surfaces system settings AI provider config for the selected model. */
export const ModelDetailPanel = memo(function ModelDetailPanel({
  model,
  provider,
}: ModelDetailPanelProps) {
  const navigate = useNavigate();
  const catalogModel = useFindEnabledModel(model, provider);
  const { provider: providerConfig, isActive, isLoading } = useAiProviderSettings(provider);

  if (isLoading) {
    return (
      <Flexbox padding={12}>
        <Text type="secondary">—</Text>
      </Flexbox>
    );
  }

  if (!providerConfig) {
    return (
      <Flexbox gap={8} padding={12}>
        <Text type="secondary">{modelStrings.detail.providerNotFound}</Text>
        {catalogModel ? (
          <Text style={{ fontSize: 12 }}>{catalogModel.displayName || model}</Text>
        ) : (
          <Text style={{ fontSize: 12 }}>{model}</Text>
        )}
        <Button
          size="small"
          type="link"
          onClick={() => navigate(getSettingsRoutePath())}
        >
          {modelStrings.goToSettings}
        </Button>
      </Flexbox>
    );
  }

  const multimodalEnabled = isModelMultimodalEnabled(providerConfig, model);

  return (
    <Flexbox gap={4} paddingBlock={8}>
      <Accordion defaultExpandedKeys={['provider', 'connection', 'models']}>
        <AccordionItem itemKey="provider" title={modelStrings.detail.provider}>
          <DetailRow
            label={modelStrings.detail.name}
            value={getProviderDisplayName(providerConfig)}
          />
          <DetailRow
            label={modelStrings.detail.type}
            value={getProviderTypeLabel(providerConfig.type)}
          />
          {isActive ? (
            <DetailRow label={modelStrings.detail.status} value={modelStrings.detail.defaultProvider} />
          ) : null}
        </AccordionItem>
        <AccordionItem itemKey="connection" title={modelStrings.detail.connection}>
          <DetailRow label={modelStrings.detail.host} mono value={extractHost(providerConfig.apiUrl)} />
          <DetailRow
            label={modelStrings.detail.apiKey}
            mono
            value={maskApiKeyDisplay(providerConfig)}
          />
          <DetailRow
            label={modelStrings.detail.endpoint}
            mono
            value={getEndpointPath(providerConfig.apiEndpoint)}
          />
          <DetailRow
            label={modelStrings.detail.proxy}
            value={providerConfig.useProxy ? modelStrings.detail.proxyOn : modelStrings.detail.proxyOff}
          />
        </AccordionItem>
        <AccordionItem itemKey="models" title={modelStrings.detail.models}>
          <DetailRow label={modelStrings.detail.configuredModels} value={formatProviderModelsList(providerConfig, model)} />
        </AccordionItem>
        <AccordionItem itemKey="advanced" title={modelStrings.detail.advanced}>
          <DetailRow
            label={modelStrings.detail.multimodal}
            value={multimodalEnabled ? modelStrings.detail.multimodalOn : modelStrings.detail.multimodalOff}
          />
          <DetailRow
            label={modelStrings.detail.reasoningEffort}
            value={getReasoningEffortLabel(providerConfig.reasoningEffort)}
          />
        </AccordionItem>
      </Accordion>
      <div className={detailStyles.footer}>
        <Button size="small" type="link" onClick={() => navigate(getSettingsRoutePath())}>
          {modelStrings.goToSettings}
        </Button>
      </div>
    </Flexbox>
  );
});
