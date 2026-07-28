import React, { useEffect, useState } from 'react';
import { agentService, type Agent } from '../../services/agentService';

type TopicCopilotPanelProps = {
  date: string;
  onPickTopic?: (topic: string) => void;
  embedded?: boolean;
};

const TopicCopilotPanel: React.FC<TopicCopilotPanelProps> = ({
  date,
  onPickTopic,
  embedded = false
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(true);
  const [streamingEnabled, setStreamingEnabled] = useState(false);

  useEffect(() => {
    void Promise.all([agentService.getBusinessPipelinesStatus(), agentService.getAgents()]).then(
      ([status, agents]) => {
        setReady(status.editorialAgentsReady);
        const copilot = (agents as Agent[]).find((agent) => agent.id === 'topic_copilot');
        setStreamingEnabled(copilot?.streaming === true);
      }
    );
  }, []);

  const ensureAgents = async () => {
    await agentService.setupBusinessPipelines({ enableSchedules: false });
    setReady(true);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!ready) {
      try {
        await ensureAgents();
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: err?.message || 'Copilot 初始化失败' }
        ]);
        return;
      }
    }
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);
    if (streamingEnabled) {
      setMessages((prev) => [...prev, { role: 'assistant', text: '' }]);
    }
    try {
      let assistant = '';
      if (streamingEnabled) {
        await agentService.runAgentStream('topic_copilot', text, date, (chunk: any) => {
          const delta = chunk?.content || chunk?.delta || chunk?.text || '';
          if (!delta) return;
          assistant += delta;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', text: assistant };
            return next;
          });
        });
      } else {
        const result = await agentService.runAgent('topic_copilot', text, date);
        assistant = result.content || '';
        setMessages((prev) => [...prev, { role: 'assistant', text: assistant }]);
      }
      const firstLine = assistant
        .split('\n')
        .find((line) => line.trim())
        ?.replace(/^[-*\d.]+\s*/, '');
      if (firstLine && onPickTopic) onPickTopic(firstLine.trim());
    } catch (err: any) {
      const message = err?.message || 'Copilot 执行失败';
      setMessages((prev) => {
        if (streamingEnabled && prev[prev.length - 1]?.role === 'assistant') {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', text: message };
          return next;
        }
        return [...prev, { role: 'assistant', text: message }];
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={
        embedded
          ? ''
          : 'mb-4 rounded-2xl border border-hairline-soft bg-canvas p-4 dark:border-white/10 dark:bg-surface-dark/40'
      }
    >
      {!embedded && (
        <h3 className="mb-2 text-sm font-semibold text-text-ink dark:text-white">选题 Copilot</h3>
      )}
      {!ready && (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
          Copilot 未部署，发送消息时将自动初始化 agent。
        </p>
      )}
      <div className="mb-2 max-h-40 space-y-2 overflow-y-auto text-xs">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'text-text-slate dark:text-text-secondary'
                : 'text-text-ink dark:text-white'
            }
          >
            <span className="font-semibold">{m.role === 'user' ? '你' : 'Copilot'}：</span>
            {m.text || (loading && i === messages.length - 1 ? '…' : '')}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-full border border-hairline-soft bg-surface-soft px-3 py-2 text-xs dark:border-white/10 dark:bg-white/5"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="今天开源领域有什么值得写？"
          onKeyDown={(e) => e.key === 'Enter' && void send()}
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void send()}
          className="rounded-full bg-ink px-3 py-2 text-xs font-medium text-white dark:bg-white dark:text-ink"
        >
          发送
        </button>
      </div>
    </div>
  );
};

export default TopicCopilotPanel;
