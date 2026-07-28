import { EmojiPicker, Flexbox, Text } from '@lobehub/ui';
import { memo, useEffect, useMemo, useState } from 'react';

import { InterventionPanel, InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import type { BuiltinInterventionProps } from '../types';

const AgentIdentitySection = memo(function AgentIdentitySection({
  args,
  onArgsChange,
  registerBeforeApprove,
}: {
  args: BuiltinInterventionProps['args'];
  onArgsChange?: BuiltinInterventionProps['onArgsChange'];
  registerBeforeApprove?: BuiltinInterventionProps['registerBeforeApprove'];
}) {
  const [name, setName] = useState(typeof args.agentName === 'string' ? args.agentName : '');
  const [emoji, setEmoji] = useState(typeof args.agentEmoji === 'string' ? args.agentEmoji : '');

  useEffect(() => {
    if (!registerBeforeApprove || !onArgsChange) return;
    return registerBeforeApprove('agentIdentity', async () => {
      await onArgsChange({
        ...args,
        agentEmoji: emoji.trim() || undefined,
        agentName: name.trim() || undefined,
      });
    });
  }, [args, emoji, name, onArgsChange, registerBeforeApprove]);

  const title =
    name && emoji
      ? '确认助理身份'
      : name
        ? '确认助理名称'
        : '确认助理头像';

  return (
    <InterventionSection description="可在批准前修改名称与头像。" title={title}>
      <InterventionPanel>
        <Flexbox horizontal align="center" gap={12}>
          <EmojiPicker
            defaultAvatar="🤖"
            shape="square"
            size={48}
            style={{
              background: 'var(--console-vars-color-fill-quaternary)',
              borderRadius: 16,
              cursor: 'pointer',
              flex: 'none',
            }}
            value={emoji}
            onChange={setEmoji}
          />
          <input
            aria-label="助理名称"
            placeholder="输入助理名称"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--console-vars-color-text)',
              flex: 1,
              fontFamily: 'inherit',
              fontSize: 16,
              fontWeight: 600,
              minWidth: 0,
              outline: 'none',
              padding: 0,
            }}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Flexbox>
      </InterventionPanel>
    </InterventionSection>
  );
});

const UserProfileSection = memo(function UserProfileSection({ fullName }: { fullName?: string }) {
  const fields = useMemo(
    () => (fullName ? [{ label: '姓名', value: fullName }] : []),
    [fullName],
  );

  if (fields.length === 0) return null;

  return (
    <InterventionSection description="以下信息将写入 onboarding 配置。" title="确认个人信息">
      <InterventionPanel>
        <Flexbox gap={16}>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              width: '100%',
            }}
          >
            {fields.map((field) => (
              <Flexbox gap={6} key={field.label}>
                <span className={interventionStyles.sectionTitle}>{field.label}</span>
                <div className={interventionStyles.leadTitle} style={{ fontSize: 14 }}>
                  {field.value}
                </div>
              </Flexbox>
            ))}
          </div>
          <Text style={{ fontSize: 12 }} type="secondary">
            批准后应用至工作区
          </Text>
        </Flexbox>
      </InterventionPanel>
    </InterventionSection>
  );
});

/** §C.36*/
export const SaveUserQuestionIntervention = memo(function SaveUserQuestionIntervention({
  args,
  onArgsChange,
  registerBeforeApprove,
}: BuiltinInterventionProps) {
  const fullName = typeof args.fullName === 'string' ? args.fullName.trim() || undefined : undefined;
  const hasAgentIdentity = Boolean(args.agentName || args.agentEmoji);
  const hasUserProfile = Boolean(fullName);

  return (
    <Flexbox gap={16}>
      {hasAgentIdentity ? (
        <AgentIdentitySection
          args={args}
          registerBeforeApprove={registerBeforeApprove}
          onArgsChange={onArgsChange}
        />
      ) : null}
      {hasUserProfile ? <UserProfileSection fullName={fullName} /> : null}
    </Flexbox>
  );
});
