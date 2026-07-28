import { describe, expect, it, vi } from 'vitest';
import { DatabaseKnowledgeService } from '../src/services/knowledge/DatabaseKnowledgeService.js';

const rawJsonSnippet = `{
  "topic_id": "t9",
  "headline": "Hermes Agent 为 MCP 引入 Tool Search，报告显著准确率提升",
  "urls": ["https://example.com/hermes-agent"],
  "suggested_section": "产品与商业"
}`;

function createKnowledgeService(content: string) {
  const store = {
    searchKBChunks: vi.fn().mockResolvedValue([
      {
        id: 'chunk-1',
        docName: '2026-05-31.md',
        docSummary: '',
        content,
        snippet: content
      }
    ])
  };
  const agentService = {
    runAgent: vi.fn().mockResolvedValue({
      content: 'No response generated (AI returned empty content)'
    })
  };

  return new DatabaseKnowledgeService(store as any, agentService as any);
}

describe('DatabaseKnowledgeService readable fallback', () => {
  it('does not expose raw structured snippets to direct knowledge Q&A when AI synthesis is empty', async () => {
    const service = createKnowledgeService(rawJsonSnippet);

    const answer = await service.queryKnowledge('step');

    expect(answer).toContain('知识库已找到相关内容');
    expect(answer).toContain('2026-05-31.md');
    expect(answer).toContain('原始片段不适合直接展示');
    expect(answer).not.toContain('"topic_id"');
    expect(answer).not.toContain('suggested_section');
  });

  it('keeps raw context fallback available for workflow/tool usage', async () => {
    const service = createKnowledgeService(rawJsonSnippet);

    const answer = await service.queryKnowledge('step', { fallbackFormat: 'context' });

    expect(answer).toContain('知识库检索已命中');
    expect(answer).toContain('以下为相关文档片段');
    expect(answer).toContain('"topic_id"');
    expect(answer).toContain('suggested_section');
  });
});