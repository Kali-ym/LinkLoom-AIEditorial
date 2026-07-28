import { Flexbox, Icon, Popover, Text, Tooltip } from '@lobehub/ui';
import { cssVar, cx } from 'antd-style';
import { Check, ChevronDown, Info, Laptop, Monitor, Server } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';

import { DEFAULT_AGENCY_CONFIG } from '../../../../domain/defaults/workspaceControls';
import type { AgentSandboxStatus } from '../../../../domain/types/sandbox';
import type { DeviceExecutionTarget } from '../../../../domain/types/workspaceControls';
import { useUpdateAgentConfig } from '../../../../hooks/useUpdateAgentConfig';
import { useWorkspaceControlsStore } from '../../../../stores/workspaceControlsStore';
import { controlBarStyles } from '../controlBarStyles';
import { resolveExecutionTarget } from '../helpers/executionTarget';
import { popoverContentStyles, workspaceStyles } from './workspaceControlStyles';

const TARGET_LABEL: Record<DeviceExecutionTarget, string> = {
  none: '无设备',
  local: '本机',
  sandbox: '云端沙箱',
  device: '远程设备',
};

const BASE_DEVICE_OPTIONS = [
  { key: 'none', target: 'none' as const, label: '无设备', icon: Monitor },
  { key: 'local', target: 'local' as const, label: '本机', icon: Laptop },
  { key: 'sandbox', target: 'sandbox' as const, label: '云端沙箱', icon: Server },
] as const;

function sandboxDotClass(status: AgentSandboxStatus | undefined): string | undefined {
  switch (status) {
    case 'running':
      return workspaceStyles.dotOnline;
    case 'starting':
      return workspaceStyles.dotStarting;
    case 'error':
      return workspaceStyles.dotError;
    case 'stopped':
    case 'not_provisioned':
      return workspaceStyles.dotOffline;
    default:
      return undefined;
  }
}

function sandboxStatusLabel(status: AgentSandboxStatus | undefined): string {
  switch (status) {
    case 'running':
      return '运行中';
    case 'starting':
      return '启动中';
    case 'stopped':
      return '已停止';
    case 'error':
      return '异常';
    case 'not_provisioned':
      return '未创建';
    default:
      return '未知';
  }
}

/** §C.46 — execution target picker (local / sandbox / none / remote device). */
export const DeviceSwitcher = memo(function DeviceSwitcher({ agentId }: { agentId: string }) {
  const [open, setOpen] = useState(false);
  const devices = useWorkspaceControlsStore((s) => s.devices);
  const agency = useWorkspaceControlsStore(
    (s) => s.agencyByAgentId[agentId] ?? DEFAULT_AGENCY_CONFIG,
  );
  const setExecutionTarget = useWorkspaceControlsStore((s) => s.setExecutionTarget);
  const sandboxStatus = useWorkspaceControlsStore((s) => s.sandboxStatusByAgentId[agentId]);
  const sandboxLoading = useWorkspaceControlsStore((s) => s.sandboxLoadingByAgentId[agentId]);
  const startSandboxStatusPolling = useWorkspaceControlsStore((s) => s.startSandboxStatusPolling);
  const stopSandboxStatusPolling = useWorkspaceControlsStore((s) => s.stopSandboxStatusPolling);
  const startSandbox = useWorkspaceControlsStore((s) => s.startSandbox);
  const stopSandbox = useWorkspaceControlsStore((s) => s.stopSandbox);
  const { updateAgentConfig } = useUpdateAgentConfig();

  const effectiveTarget = resolveExecutionTarget(agency);
  const showSandboxControls = effectiveTarget === 'sandbox';

  useEffect(() => {
    if (!showSandboxControls) {
      stopSandboxStatusPolling(agentId);
      return;
    }
    startSandboxStatusPolling(agentId);
    return () => stopSandboxStatusPolling(agentId);
  }, [agentId, showSandboxControls, startSandboxStatusPolling, stopSandboxStatusPolling]);

  const options = BASE_DEVICE_OPTIONS;

  const label = useMemo(() => {
    if (effectiveTarget === 'device' && agency.boundDeviceId) {
      const device = devices.find((d) => d.deviceId === agency.boundDeviceId);
      return device?.friendlyName ?? '未知设备';
    }
    return TARGET_LABEL[effectiveTarget];
  }, [agency.boundDeviceId, devices, effectiveTarget]);

  const triggerIcon = useMemo(() => {
    const match = BASE_DEVICE_OPTIONS.find((o) => o.target === effectiveTarget);
    return match?.icon ?? Monitor;
  }, [effectiveTarget]);

  return (
    <Popover
      content={
        <div className={workspaceStyles.popoverContent}>
          <Flexbox horizontal align="center" gap={6} style={{ padding: '6px 8px 4px' }}>
            <span className={workspaceStyles.sectionTitle} style={{ padding: 0, flex: 1 }}>
              执行设备
            </span>
            <Tooltip title="选择 Agent 代码执行的设备或沙箱环境">
              <Icon icon={Info} size={12} style={{ color: cssVar.colorTextQuaternary }} />
            </Tooltip>
          </Flexbox>
          {options.map((opt) => {
            const active = opt.target === effectiveTarget;
            return (
              <div
                className={workspaceStyles.optionRow}
                data-active={active}
                key={opt.key}
                onClick={() => {
                  setExecutionTarget(agentId, opt.target);
                  void updateAgentConfig({ executionTarget: opt.target });
                  setOpen(false);
                }}
              >
                <div className={workspaceStyles.optionIconBox}>
                  <Icon icon={opt.icon} size={16} />
                </div>
                <Text style={{ flex: 1, fontSize: 13 }}>
                  {opt.label}
                </Text>
                {active ? <Check color={cssVar.colorPrimary} size={14} /> : null}
              </div>
            );
          })}
          {showSandboxControls ? (
            <div className={workspaceStyles.sandboxFooter}>
              <Flexbox flex={1} gap={4} style={{ minWidth: 0, justifyContent: 'center' }}>
                <Flexbox horizontal align="center" gap={6} justify="center">
                  <span className={sandboxDotClass(sandboxStatus?.status)} />
                  <Text style={{ fontSize: 12 }} type="secondary">
                    {sandboxStatusLabel(sandboxStatus?.status)}
                  </Text>
                </Flexbox>
              </Flexbox>
              <button
                className={workspaceStyles.sandboxActionButton}
                disabled={sandboxLoading}
                type="button"
                onClick={() => void startSandbox(agentId)}
              >
                启动沙箱
              </button>
              <button
                className={workspaceStyles.sandboxActionButton}
                disabled={sandboxLoading || sandboxStatus?.status === 'not_provisioned'}
                type="button"
                onClick={() => void stopSandbox(agentId)}
              >
                停止沙箱
              </button>
            </div>
          ) : null}
        </div>
      }
      open={open}
      placement="topLeft"
      styles={popoverContentStyles}
      trigger="click"
      onOpenChange={setOpen}
    >
      <button className={cx(controlBarStyles.chip)} type="button">
        <Icon className={controlBarStyles.chipIcon} icon={triggerIcon} size={14} />
        <span className={controlBarStyles.chipLabel}>{label}</span>
        {showSandboxControls && sandboxDotClass(sandboxStatus?.status) ? (
          <span className={sandboxDotClass(sandboxStatus?.status)} />
        ) : null}
        <Icon className={controlBarStyles.chipChevron} icon={ChevronDown} size={12} />
      </button>
    </Popover>
  );
});
