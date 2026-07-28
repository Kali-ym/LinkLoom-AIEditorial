import type { AgentDefinition } from '../../types/agent.js';
import { ADMIN_TOOL_IDS } from '../../plugins/builtin/tools/admin/index.js';
import type { StructuredPrompt } from '../agents/prompt/types.js';
import type { LocalStore } from '../LocalStore.js';
import { EDITORIAL_PROMPTS } from './editorialPrompts.js';
import { SUPER_ADMIN_PROMPT } from './superAdminPrompts.js';
import {
  mergeAgentConsoleUiMetadata,
  type AgentConsoleUiMetadata,
} from './agentConsoleUi.js';
import { APPLICATION_CONSOLE_AGENT_IDS } from './applicationConsoleAgents.js';

/** Retired builtins — delete on ensure so admin / console no longer list them. */
const RETIRED_BUILTIN_AGENT_IDS = ['fact_reviewer_a', 'fact_reviewer_b'] as const;

const TOPIC_COPILOT_ID = APPLICATION_CONSOLE_AGENT_IDS[0];
const SUPER_ADMIN_ID = APPLICATION_CONSOLE_AGENT_IDS[1];

function baseAgent(
  id: string,
  name: string,
  description: string,
  systemPrompt: StructuredPrompt,
  providerId: string,
  toolIds: string[],
  runtime?: AgentDefinition['runtime'],
  consoleUi?: AgentConsoleUiMetadata,
): AgentDefinition {
  return {
    id,
    name,
    description,
    systemPrompt,
    providerId,
    model: '',
    temperature: 0.35,
    toolIds,
    skillIds: [],
    mcpServerIds: [],
    category: 'editorial',
    runtime,
    metadata: mergeAgentConsoleUiMetadata(undefined, consoleUi),
  };
}

export class EditorialAgentsService {
  constructor(private readonly store: LocalStore) {}

  async ensureBuiltinAgents(): Promise<string[]> {
    const settings = (await this.store.get('system_settings')) || {};
    const providerId = settings.ACTIVE_AI_PROVIDER_ID || 'default-gemini';
    const created: string[] = [];

    for (const id of RETIRED_BUILTIN_AGENT_IDS) {
      const existing = await this.store.getAgent(id);
      if (!existing) continue;
      await this.store.deleteAgent(id);
      created.push(id);
    }

    const agents: AgentDefinition[] = [
      baseAgent(
        TOPIC_COPILOT_ID,
        '选题 Copilot',
        'Generation 侧边栏：结合素材与知识库给出可执行选题建议',
        EDITORIAL_PROMPTS.topic_copilot,
        providerId,
        [
          'query_data',
          'query_knowledge',
          'query_memory',
          'save_memory',
          'read_upload',
          'read_skill',
          'list_skill',
          'create_todos',
          'update_todos',
          'clear_todos',
          'create_plan',
          'update_plan',
          'web_search',
          'crawl_single_page',
          'crawl_multi_pages',
        ],
        { mode: 'react', maxRounds: 6, maxToolCalls: 8 },
        {
          gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
          isPrimary: true,
          consoleVisible: true,
          welcome:
            '你好，我是 **选题 Copilot**。描述你想完成的事，或点选下方问题即可开始；也可用 `@` 把子任务交给其他智能体。',
          openingQuestions: [
            '根据今日素材推荐 3 个可执行选题',
            '评估这个选题角度是否值得跟进',
            '结合知识库总结某话题的最新进展',
            '帮我起草选题说明与关键信息点',
          ],
        }
      ),
      baseAgent(
        SUPER_ADMIN_ID,
        '超级管理员',
        'LinkLoom 超级管理员：引导用户完成 admin 运维任务并实际执行（cron/评分/日报/工作流）',
        SUPER_ADMIN_PROMPT,
        providerId,
        [
          ...ADMIN_TOOL_IDS,
          'query_knowledge',
          'query_memory',
          'create_todos',
          'update_todos',
          'create_plan',
          'update_plan',
        ],
        { mode: 'react', maxRounds: 12, maxToolCalls: 25 },
        {
          gradient: 'linear-gradient(135deg, #1e293b, #7c3aed, #f59e0b)',
          isPrimary: false,
          consoleVisible: true,
          welcome:
            '我是 **LinkLoom 超级管理员**,可以帮你创建定时任务、触发新闻评分、生成并发布日报、运行和审批工作流。告诉我你想做什么。',
          openingQuestions: [
            '帮我创建一个定时任务',
            '给未评分新闻评分',
            '生成今天的日报',
            '运行某个工作流',
          ],
        }
      ),
    ];

    for (const agent of agents) {
      const existing = await this.store.getAgent(agent.id);
      if (!existing) {
        await this.store.saveAgent(agent);
        created.push(agent.id);
        continue;
      }

      const mergedToolIds = [
        ...new Set([...(existing.toolIds ?? []), ...(agent.toolIds ?? [])]),
      ];
      const missingTools = (agent.toolIds ?? []).filter((id) => !existing.toolIds?.includes(id));
      // 结构化 prompt 用 JSON.stringify 做深比较,避免对象引用不等导致误刷新
      const shouldRefreshPrompt =
        existing.metadata?.customized !== true &&
        JSON.stringify(existing.systemPrompt) !== JSON.stringify(agent.systemPrompt);

      const consoleUiDefaults = agent.metadata?.ui as AgentConsoleUiMetadata | undefined;
      const mergedMetadata = mergeAgentConsoleUiMetadata(existing.metadata, consoleUiDefaults);
      const existingUi =
        existing.metadata?.ui && typeof existing.metadata.ui === 'object'
          ? (existing.metadata.ui as AgentConsoleUiMetadata)
          : undefined;
      const isApplicationAgent = (APPLICATION_CONSOLE_AGENT_IDS as readonly string[]).includes(
        agent.id,
      );
      const needsApplicationConsoleUiPatch =
        isApplicationAgent &&
        (existingUi?.consoleVisible === undefined ||
          (agent.id === TOPIC_COPILOT_ID && existingUi?.isPrimary === undefined));
      const shouldRefreshUi =
        needsApplicationConsoleUiPatch ||
        JSON.stringify(existing.metadata?.ui ?? {}) !== JSON.stringify(mergedMetadata?.ui ?? {});

      if (missingTools.length === 0 && !shouldRefreshPrompt && !shouldRefreshUi) continue;

      await this.store.saveAgent({
        ...existing,
        ...(missingTools.length > 0 ? { toolIds: mergedToolIds } : {}),
        ...(shouldRefreshPrompt ? { systemPrompt: agent.systemPrompt } : {}),
        ...(shouldRefreshUi ? { metadata: mergedMetadata } : {}),
      });
      created.push(agent.id);
    }

    return created;
  }
}
