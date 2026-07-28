import { Button, Flexbox, Icon, Text } from '@lobehub/ui';
import { useModalContext } from '@lobehub/ui/base-ui';
import { cssVar } from 'antd-style';
import { CircleCheck } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

import { NeuralNetworkLoading } from '../../../components/NeuralNetworkLoading';
import { SkeletonList } from '../../NavPanel/SkeletonList';
import { showToast } from '../../../services/ui/toast';
import { useSwitchAgent } from '../../../hooks/useSwitchAgent';
import { useAgentStore, useTopicStore } from '../../../stores';
import { topicModalStrings } from '../topicModalStrings';
import { AgentPickerItem } from './AgentPickerItem';
import { moveTopicsModalStyles } from './moveTopicsModalStyles';

type Step = 'pick' | 'confirm' | 'moving' | 'done';

export interface MoveTopicsContentProps {
  onMoved?: () => void;
  sourceAgentId?: string | null;
  topicIds: string[];
}

import { usePrimaryAgentId } from '../../../hooks/usePrimaryAgentId';

/** §C.52*/
export const MoveTopicsContent = memo<MoveTopicsContentProps>(function MoveTopicsContent({
  onMoved,
  sourceAgentId,
  topicIds,
}) {
  const { close, setCanDismissByClickOutside } = useModalContext();
  const agents = useAgentStore((s) => s.agents);
  const isConfigLoading = useAgentStore((s) => s.isConfigLoading);
  const batchMoveTopicsToAgent = useTopicStore((s) => s.batchMoveTopicsToAgent);
  const primaryAgentId = usePrimaryAgentId();
  const switchAgent = useSwitchAgent();

  const [step, setStep] = useState<Step>('pick');
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null);

  const count = topicIds.length;

  const targetAgents = useMemo(() => {
    const available = agents.filter((a) => a.id !== sourceAgentId);
    const hasPrimary = primaryAgentId && available.some((a) => a.id === primaryAgentId);
    const primaryAgent = primaryAgentId
      ? agents.find((a) => a.id === primaryAgentId)
      : undefined;
    const withPrimary =
      primaryAgent && !hasPrimary && sourceAgentId !== primaryAgentId
        ? [primaryAgent, ...available]
        : available;
    return withPrimary;
  }, [agents, primaryAgentId, sourceAgentId]);

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return targetAgents;
    return targetAgents.filter((a) => a.name.toLowerCase().includes(q));
  }, [search, targetAgents]);

  const handleConfirm = async () => {
    if (!target) return;
    setStep('moving');
    setCanDismissByClickOutside?.(false);
    try {
      await batchMoveTopicsToAgent(topicIds, target.id);
      onMoved?.();
      setStep('done');
    } catch (error) {
      console.error('[MoveTopics] move failed:', error);
      showToast(topicModalStrings.moveError);
      setStep('confirm');
    } finally {
      setCanDismissByClickOutside?.(true);
    }
  };

  if (step === 'pick') {
    return (
      <Flexbox>
        <input
          autoFocus
          className={moveTopicsModalStyles.searchInput}
          placeholder={topicModalStrings.moveSearchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isConfigLoading ? (
          <SkeletonList rows={6} />
        ) : filteredAgents.length === 0 ? (
          <Flexbox align="center" justify="center" padding={24}>
            <Text fontSize={12} type="secondary">
              {topicModalStrings.moveEmpty}
            </Text>
          </Flexbox>
        ) : (
          <Flexbox
            gap={4}
            padding={8}
            style={{ maxHeight: '50vh', overflowY: 'auto', width: '100%' }}
          >
            {filteredAgents.map((agent) => (
              <AgentPickerItem
                key={agent.id}
                agent={agent}
                onSelect={() => {
                  setTarget({ id: agent.id, title: agent.name });
                  setStep('confirm');
                }}
              />
            ))}
          </Flexbox>
        )}
      </Flexbox>
    );
  }

  if (step === 'confirm') {
    return (
      <Flexbox gap={20} padding={24}>
        <Text>{topicModalStrings.moveConfirm(count, target?.title ?? '')}</Text>
        <Flexbox horizontal gap={8} justify="flex-end">
          <Button onClick={() => setStep('pick')}>{topicModalStrings.moveBack}</Button>
          <Button type="primary" onClick={handleConfirm}>
            {topicModalStrings.moveConfirmOk}
          </Button>
        </Flexbox>
      </Flexbox>
    );
  }

  if (step === 'moving') {
    return (
      <Flexbox align="center" gap={16} justify="center" padding={48}>
        <NeuralNetworkLoading size={48} />
        <Text type="secondary">{topicModalStrings.moveMoving}</Text>
      </Flexbox>
    );
  }

  return (
    <Flexbox align="center" gap={20} justify="center" padding={48}>
      <Flexbox align="center" gap={12}>
        <Icon color={cssVar.colorSuccess} icon={CircleCheck} size={32} />
        <Text weight={500}>{topicModalStrings.moveDone(count)}</Text>
      </Flexbox>
      <Flexbox horizontal gap={8}>
        <Button onClick={close}>{topicModalStrings.moveDoneOk}</Button>
        {target ? (
          <Button
            type="primary"
            onClick={() => {
              switchAgent(target.id);
              close();
            }}
          >
            {topicModalStrings.moveGoToTarget(target.title)}
          </Button>
        ) : null}
      </Flexbox>
    </Flexbox>
  );
});
