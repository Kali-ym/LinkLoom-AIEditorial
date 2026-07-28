import {
  requireToolContext,
  type ToolExecutionContext
} from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';

export type SaveKnowledgeMode = 'upsert' | 'create';

export class SaveKnowledgeTool extends BaseTool {
  readonly id = 'save_knowledge';
  readonly name = 'save_knowledge';
  readonly displayName = '保存知识';
  readonly scope = 'agent' as const;
  readonly description =
    '将 Markdown 文本保存到知识库指定分类，支持同名文档 upsert 覆盖。需要将产出沉淀为可检索知识时调用。' +
    '必填：content、documentName；以及 categoryId 或 categoryName 二选一；可选 mode（upsert 同名覆盖 | create 始终新建）。';
  readonly parameters = {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Markdown 全文'
      },
      categoryId: {
        type: 'string',
        description: '知识库分类 ID（与 categoryName 二选一）'
      },
      categoryName: {
        type: 'string',
        description: '知识库分类名称；不存在时自动创建'
      },
      documentName: {
        type: 'string',
        description: '文档文件名，如 2026-05-19.md'
      },
      mode: {
        type: 'string',
        enum: ['upsert', 'create'],
        description: 'upsert=同名覆盖；create=始终新建',
        default: 'upsert'
      }
    },
    required: ['content', 'documentName']
  };

  async handler(
    args: {
      content: string;
      categoryId?: string;
      categoryName?: string;
      documentName: string;
      mode?: SaveKnowledgeMode;
    },
    _toolCtx?: ToolExecutionContext
  ) {
    if (!args.content?.trim()) {
      throw new Error('content 不能为空');
    }
    if (!args.documentName?.trim()) {
      throw new Error('documentName 不能为空');
    }
    if (!args.categoryId && !args.categoryName?.trim()) {
      throw new Error('categoryId 或 categoryName 至少提供一个');
    }

    const context = requireToolContext(_toolCtx, this.id).services;
    const kb = context.knowledgeBaseService;

    let categoryId = args.categoryId;
    if (!categoryId) {
      const categories = await kb.getCategories();
      const name = args.categoryName!.trim();
      const found = categories.find((c) => c.name === name);
      if (found) {
        categoryId = found.id;
      } else {
        categoryId = await kb.addCategory(name, '系统自动维护的日报知识分类');
      }
    }

    const docName = args.documentName.trim();
    const mode = args.mode === 'create' ? 'create' : 'upsert';
    let documentId: string | undefined;

    if (mode === 'upsert') {
      const docs = await kb.getDocuments(categoryId);
      const existing = docs.find((d) => d.name === docName || d.fileName === docName);
      if (existing) {
        const updateResult = kb.updateDocumentContentDetailed
          ? await kb.updateDocumentContentDetailed(existing.id, args.content)
          : (await kb.updateDocumentContent(existing.id, args.content), undefined);
        documentId = existing.id;
        return {
          success: true,
          documentId,
          categoryId,
          embeddingQueuedCount: updateResult?.embeddingQueuedCount,
          message: updateResult?.embeddingQueuedCount
            ? `已更新知识库文档：${docName}，并入队 ${updateResult.embeddingQueuedCount} 个向量索引任务`
            : `已更新知识库文档：${docName}`
        };
      }
    }

    const buffer = Buffer.from(args.content, 'utf-8');
    const createResult = kb.addDocumentDetailed
      ? await kb.addDocumentDetailed(categoryId, {
          name: docName,
          path: docName,
          buffer
        })
      : { id: await kb.addDocument(categoryId, {
          name: docName,
          path: docName,
          buffer
        }) };
    documentId = createResult.id;

    return {
      success: true,
      documentId,
      categoryId,
      embeddingQueuedCount: createResult.embeddingQueuedCount,
      message: createResult.embeddingQueuedCount
        ? `已保存知识库文档：${docName}，并入队 ${createResult.embeddingQueuedCount} 个向量索引任务`
        : `已保存知识库文档：${docName}`
    };
  }
}
