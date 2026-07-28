import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { KnowledgeRouteService } from '../../../../services/api/KnowledgeRouteService.js';
import { MemoryRouteService } from '../../../../services/api/MemoryRouteService.js';
import { SettingsRouteService } from '../../../../services/api/SettingsRouteService.js';
import { RagRouteService } from '../../../../services/rag/RagRouteService.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };
const HIGH: ToolExecutionPolicy = { readonly: false, riskLevel: 'high' };

class ListKbCategoriesTool extends BaseTool {
  readonly id = 'list_kb_categories';
  readonly name = 'list_kb_categories';
  readonly displayName = '列知识库分类';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出知识库分类。用户要浏览知识库目录或选择分类时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new KnowledgeRouteService(services);
      const categories = await service.getCategories();
      return { ok: true, count: categories.length, categories };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_KB_CATEGORIES_FAILED',
        message,
        hint: '可在 /knowledge 页面查看知识库分类',
      };
    }
  }
}

class ListKbDocumentsTool extends BaseTool {
  readonly id = 'list_kb_documents';
  readonly name = 'list_kb_documents';
  readonly displayName = '列知识库文档';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出指定分类下的知识库文档。必填 categoryId。用户要浏览某分类文档时调用。';
  readonly parameters = {
    type: 'object',
    properties: { categoryId: { type: 'string', description: '知识库分类 id' } },
    required: ['categoryId'],
  };

  async handler(args: { categoryId: string }, toolCtx?: ToolExecutionContext) {
    const { services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new KnowledgeRouteService(services);
      const documents = await service.getDocuments(args.categoryId);
      return { ok: true, categoryId: args.categoryId, count: documents.length, documents };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_KB_DOCUMENTS_FAILED',
        message,
        hint: '调 list_kb_categories 查看可用分类',
      };
    }
  }
}

class GetKbContentTool extends BaseTool {
  readonly id = 'get_kb_content';
  readonly name = 'get_kb_content';
  readonly displayName = '读知识库文档';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '读取知识库文档全文内容。必填 documentId。用户要预览某篇文档时调用。';
  readonly parameters = {
    type: 'object',
    properties: { documentId: { type: 'string', description: '知识库文档 id' } },
    required: ['documentId'],
  };

  async handler(args: { documentId: string }, toolCtx?: ToolExecutionContext) {
    const { services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new KnowledgeRouteService(services);
      const result = await service.getDocumentContent(args.documentId);
      return { ok: true, documentId: args.documentId, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_KB_CONTENT_FAILED',
        message,
        hint: '调 list_kb_documents 确认 documentId',
      };
    }
  }
}

class ListMemoryCategoriesTool extends BaseTool {
  readonly id = 'list_memory_categories';
  readonly name = 'list_memory_categories';
  readonly displayName = '列记忆分类';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出记忆库分类。用户要浏览记忆目录时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new MemoryRouteService(services);
      const categories = await service.getCategories();
      return { ok: true, count: categories.length, categories };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_MEMORY_CATEGORIES_FAILED',
        message,
        hint: '可在 /knowledge 页面查看记忆分类',
      };
    }
  }
}

class GetRagStatusTool extends BaseTool {
  readonly id = 'get_rag_status';
  readonly name = 'get_rag_status';
  readonly displayName = '查 RAG 状态';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '查询 RAG 检索管线状态(向量索引/混合搜索/覆盖率等)。用户要了解知识检索健康状况时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new RagRouteService(store, services);
      const status = await service.getStatus();
      return { ok: true, status };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_RAG_STATUS_FAILED',
        message,
        hint: '可在 /settings 页面查看 RAG 配置',
      };
    }
  }
}

class ListPluginMetadataTool extends BaseTool {
  readonly id = 'list_plugin_metadata';
  readonly name = 'list_plugin_metadata';
  readonly displayName = '列插件元数据';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出已注册插件元数据。用户要了解平台插件能力时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new SettingsRouteService(store, services);
      const plugins = service.getPluginMetadata();
      const count = Object.values(plugins).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
      return { ok: true, count, plugins };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_PLUGIN_METADATA_FAILED',
        message,
        hint: '可在 /settings 页面查看插件',
      };
    }
  }
}

class CreateKbCategoryTool extends BaseTool {
  readonly id = 'create_kb_category';
  readonly name = 'create_kb_category';
  readonly displayName = '创建知识库分类';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '创建知识库分类。必填 name;可选 description。调用前可先调 list_kb_categories 避免重名。';
  readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: '分类名称' },
      description: { type: 'string', description: '分类描述(可选)' },
    },
    required: ['name'],
  };

  async handler(args: { name: string; description?: string }, toolCtx?: ToolExecutionContext) {
    const { services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new KnowledgeRouteService(services);
      const result = await service.addCategory(args.name, args.description);
      return { ok: true, name: args.name, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'CREATE_KB_CATEGORY_FAILED',
        message,
        hint: '可在 /knowledge 页面创建分类',
      };
    }
  }
}

class DeleteKbDocumentTool extends BaseTool {
  readonly id = 'delete_kb_document';
  readonly name = 'delete_kb_document';
  readonly displayName = '删除知识库文档';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = HIGH;
  readonly description =
    '删除知识库文档。必填 documentId。删除前应先调 list_kb_documents/get_kb_content 确认目标。';
  readonly parameters = {
    type: 'object',
    properties: { documentId: { type: 'string', description: '知识库文档 id' } },
    required: ['documentId'],
  };

  async handler(args: { documentId: string }, toolCtx?: ToolExecutionContext) {
    const { services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new KnowledgeRouteService(services);
      const result = await service.deleteDocument(args.documentId);
      return { ok: true, documentId: args.documentId, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'DELETE_KB_DOCUMENT_FAILED',
        message,
        hint: '调 list_kb_documents 确认 documentId',
      };
    }
  }
}

export const knowledgeTools: BaseTool[] = [
  new ListKbCategoriesTool(),
  new ListKbDocumentsTool(),
  new GetKbContentTool(),
  new ListMemoryCategoriesTool(),
  new GetRagStatusTool(),
  new ListPluginMetadataTool(),
  new CreateKbCategoryTool(),
  new DeleteKbDocumentTool(),
];
