import { AppError } from '../../domain/errors.js';
import { MEMORY_WRITE_AGENT_ID } from '../agents/defaultAgentIds.js';
import { LogService } from '../LogService.js';
import { PromptService } from '../PromptService.js';
import type { ServiceContext } from '../ServiceContext.js';

export class KnowledgeRouteService {
  constructor(private readonly context: ServiceContext) {}

  getCategories() {
    return this.context.knowledgeBaseService.getCategories();
  }

  async addCategory(name: string, description?: string) {
    const id = await this.context.knowledgeBaseService.addCategory(name, description);
    return { id };
  }

  async deleteCategory(id: string) {
    await this.context.knowledgeBaseService.deleteCategory(id);
    return { status: 'success' };
  }

  async updateCategory(id: string, name: string, description?: string) {
    await this.context.knowledgeBaseService.updateCategory(id, name, description);
    return { status: 'success' };
  }

  async mergeCategories(
    ids: string[] | undefined,
    targetName: string | undefined,
    targetDescription?: string
  ) {
    if (!ids || ids.length < 2 || !targetName) {
      throw new AppError(400, '合并至少需要两个 ID (ids) 和目标名称 (targetName)');
    }
    const newId = await this.context.knowledgeBaseService.mergeCategories(
      ids,
      targetName,
      targetDescription
    );
    return { status: 'success', id: newId };
  }

  getDocuments(categoryId?: string) {
    if (!categoryId) return [];
    return this.context.knowledgeBaseService.getDocuments(categoryId);
  }

  async addDocument(data: any | undefined) {
    if (!data) {
      throw new AppError(400, 'No file uploaded');
    }

    const categoryId = data.fields.categoryId?.value;
    if (!categoryId) {
      throw new AppError(400, 'Missing categoryId');
    }

    const buffer = await data.toBuffer();
    const kb = this.context.knowledgeBaseService;
    const result = kb.addDocumentDetailed
      ? await kb.addDocumentDetailed(categoryId, {
          name: data.filename,
          path: data.filename,
          buffer
        })
      : { id: await kb.addDocument(categoryId, {
          name: data.filename,
          path: data.filename,
          buffer
        }) };
    return { status: 'success', ...result };
  }

  async deleteDocument(id: string) {
    await this.context.knowledgeBaseService.deleteDocument(id);
    return { status: 'success' };
  }

  async getDocumentContent(id: string) {
    const content = await this.context.knowledgeBaseService.getDocumentFullText(id);
    return { content };
  }

  async updateDocumentContent(id: string, content: string) {
    const kb = this.context.knowledgeBaseService;
    const result = kb.updateDocumentContentDetailed
      ? await kb.updateDocumentContentDetailed(id, content)
      : (await kb.updateDocumentContent(id, content), { id });
    return { status: 'success', ...result };
  }

  async moveDocumentToMemory(id: string) {
    const content = await this.context.knowledgeBaseService.getDocumentFullText(id);
    if (content === '文档内容未找到') {
      throw new AppError(404, '文档不存在');
    }

    const organizePrompt = PromptService.getInstance().getPrompt('knowledge_organize_for_memory', {
      content
    });
    const organizeResult = await this.context.agentService?.runAgent(
      MEMORY_WRITE_AGENT_ID,
      organizePrompt,
      undefined,
      {
        silent: false,
        noTools: true
      }
    );
    const organizedContent = organizeResult?.content || content;

    if (
      !organizeResult?.content ||
      organizeResult.content === 'No response generated (AI returned empty content)'
    ) {
      LogService.warn(`AI organization failed for document ${id}, falling back to raw content.`);
    }

    const memoryId = await this.context.memoryService.saveMemory(organizedContent, {
      importance: 4,
      tags: ['organized_from_kb']
    });

    await this.context.knowledgeBaseService.deleteDocument(id);
    return { status: 'success', memoryId };
  }

  async queryKnowledge(query: string, categoryIds?: string[], limit?: number, documentIds?: string[]) {
    const detailed = await this.context.knowledgeBaseService.queryKnowledgeDetailed(query, {
      categoryIds,
      documentIds,
      limit
    });
    return detailed;
  }
}
