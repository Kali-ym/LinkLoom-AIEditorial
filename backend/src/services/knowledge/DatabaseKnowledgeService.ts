import crypto from 'crypto';
import { typeid } from 'typeid-js';
import type { SystemSettings } from '../../types/config.js';
import type {
  IKnowledgeBaseService,
  KBCategory,
  KBDocument,
  KnowledgeDocumentWriteResult,
  KnowledgeQueryDetailedResult,
  KnowledgeQueryFallbackFormat,
  KnowledgeQuerySource
} from '../../types/knowledge.js';
import type {
  RagCitationCheckResult,
  RagCitationDecision,
  RagEvidence,
  RagPlannerStage,
  RagRetrievalStage,
  RagRetrievalTrace,
  RagSourceFilter
} from '../../types/rag.js';
import { getISODate } from '../../utils/helpers.js';
import { AgentService } from '../agents/AgentService.js';
import { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import { PromptService } from '../PromptService.js';
import { RagContextBuilder } from '../rag/RagContextBuilder.js';
import { RagEmbeddingIngestService, hashChunkContent } from '../rag/RagEmbeddingIngestService.js';
import { RagEmbeddingJobRunner } from '../rag/RagEmbeddingJobRunner.js';
import { KnowledgeRetrievalService } from '../rag/KnowledgeRetrievalService.js';
import { RagCitationChecker } from '../rag/RagCitationChecker.js';
import {
  createKnowledgeScopeMetadata,
  explicitKnowledgeFilter,
  mergeRagSourceFilters
} from '../rag/RagScope.js';
import { RagQueryPlanner } from '../rag/RagQueryPlanner.js';
import { chunkTextWithEmbeddingFallback } from '../rag/SemanticEmbeddingChunker.js';
import { createEmbeddingClient } from '../rag/SmallModelClient.js';
import {
  resolveChunkOptions,
  resolveEmbeddingService,
  resolveRagConfig,
  resolveRagSynthesisAgentId
} from '../rag/RagSettings.js';
import type { ProcessedChunk } from './DocumentProcessor.js';
import { DocumentProcessor } from './DocumentProcessor.js';

export class DatabaseKnowledgeService implements IKnowledgeBaseService {
  private store: LocalStore;
  private agentService: AgentService | null;
  private processor: DocumentProcessor;

  constructor(
    store: LocalStore,
    agentService: AgentService | null,
    private readonly getSettings: () => SystemSettings | null | undefined = () => null
  ) {
    this.store = store;
    this.agentService = agentService;
    this.processor = new DocumentProcessor();
  }

  async getCategories(): Promise<KBCategory[]> {
    return await this.store.listKBCategories();
  }

  async addCategory(name: string, description: string = ''): Promise<string> {
    const categories = await this.store.listKBCategories();
    const existing = categories.find((c) => c.name === name);
    if (existing) return existing.id;

    const id = typeid('kbcat').toString();
    await this.store.saveKBCategory({
      id,
      name,
      description,
      documentCount: 0,
      updatedAt: Date.now()
    });
    return id;
  }

  async deleteCategory(id: string): Promise<void> {
    const documents = await this.store.listKBDocuments(id);
    for (const document of documents) {
      await this.deleteDocument(document.id);
    }
    await this.store.deleteKBCategory(id);
  }

  async updateCategory(id: string, name: string, description?: string): Promise<void> {
    const category = await this.store.getKBCategory(id);
    if (!category) throw new Error(`Category ${id} not found`);

    category.name = name;
    if (description !== undefined) category.description = description;
    category.updatedAt = Date.now();

    await this.store.saveKBCategory(category);
  }

  async mergeCategories(
    ids: string[],
    targetName: string,
    targetDescription?: string
  ): Promise<string> {
    if (ids.length < 2) throw new Error('At least two categories are required for merge');

    const categories = await this.store.listKBCategories();
    const existing = categories.find((c) => c.name === targetName);
    const targetId = typeid('kbcat').toString();
    const allSourceIds = [...new Set([...ids, ...(existing ? [existing.id] : [])])];

    const targetCategory = {
      id: targetId,
      name: targetName,
      description: targetDescription || `${ids.length} 个知识库分类合并后的记录`,
      documentCount: 0,
      updatedAt: Date.now()
    };
    await this.store.saveKBCategory(targetCategory);

    for (const id of allSourceIds) {
      if (id === targetId) continue;
      const documents = await this.store.listKBDocuments(id);
      for (const doc of documents) {
        doc.categoryId = targetId;
        doc.updatedAt = Date.now();
        await this.store.saveKBDocument(doc);
      }
      await this.store.deleteKBCategory(id);
    }

    targetCategory.documentCount = (await this.store.listKBDocuments(targetId)).length;
    targetCategory.updatedAt = Date.now();
    await this.store.saveKBCategory(targetCategory);

    return targetId;
  }

  async getDocuments(categoryId: string): Promise<KBDocument[]> {
    return await this.store.listKBDocuments(categoryId);
  }

  async addDocument(
    categoryId: string,
    file: { name: string; path: string; buffer: Buffer }
  ): Promise<string> {
    const result = await this.addDocumentDetailed(categoryId, file);
    return result.id;
  }

  async addDocumentDetailed(
    categoryId: string,
    file: { name: string; path: string; buffer: Buffer }
  ): Promise<KnowledgeDocumentWriteResult> {
    const processed = await this.processor.parse(file.name, file.buffer);
    const chunks = await this.chunkTextDetailed(processed.text);

    let summary = processed.text.slice(0, 500) + '...';
    const synthesisAgentId = resolveRagSynthesisAgentId(resolveRagConfig(this.getSettings()));
    if (this.agentService && synthesisAgentId) {
      try {
        const summaryPrompt = PromptService.getInstance().getPrompt('knowledge_summary', {
          fileName: file.name,
          text: processed.text
        });
        const result = await this.agentService.runAgent(
          synthesisAgentId,
          summaryPrompt,
          undefined,
          { silent: true, noTools: true }
        );
        summary = result.content.trim();
      } catch (err) {
        LogService.warn(`Document summarization failed for ${file.name}: ${err}`);
      }
    }

    const docId = typeid('kb').toString();
    const doc: KBDocument = {
      id: docId,
      categoryId,
      name: file.name,
      fileName: file.name,
      type: processed.type,
      summary,
      chunkCount: chunks.length,
      metadata: {
        ...processed.metadata,
        hash: crypto.createHash('sha256').update(processed.text).digest('hex'),
        checksum: processed.metadata?.textChecksum || crypto.createHash('sha256').update(processed.text).digest('hex'),
        rawContentRef: processed.metadata?.rawContentRef || `knowledge://${docId}`,
        parserVersion: 'document-processor:v2',
        chunkerVersion: resolveChunkerVersion(resolveChunkOptions(resolveRagConfig(this.getSettings())))
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.store.saveKBDocument(doc);

    const savedChunks: Array<{ id: string; documentId: string; content: string; contentHash: string }> = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = typeid('chunk').toString();
      const contentHash = hashChunkContent(chunk.content);
      await this.store.saveKBChunk({
        id: chunkId,
        documentId: docId,
        content: chunk.content,
        index: i,
        metadata: {
          ...chunk.metadata,
          contentHash,
          documentChecksum: doc.metadata.checksum,
          sourceType: processed.metadata?.sourceType,
          sourceUri: processed.metadata?.sourceUri,
          rawContentRef: processed.metadata?.rawContentRef,
          version: doc.metadata.chunkerVersion
        },
        contentHash,
        chunkerVersion: doc.metadata.chunkerVersion,
        embeddingConfigHash: resolveEmbeddingConfigHash(this.getSettings()),
        indexVersion: doc.metadata.chunkerVersion
      });
      savedChunks.push({ id: chunkId, documentId: docId, content: chunk.content, contentHash });
    }

    const category = await this.store.getKBCategory(categoryId);
    if (category) {
      category.documentCount = (await this.store.listKBDocuments(categoryId)).length;
      category.updatedAt = Date.now();
      await this.store.saveKBCategory(category);
    }

    const ingest = await this.enqueueEmbeddingsIfEnabled(savedChunks);
    return {
      id: docId,
      embeddingQueuedCount: ingest.queued,
      embeddingSkippedCount: ingest.skipped
    };
  }

  async deleteDocument(id: string): Promise<void> {
    const doc = await this.store.getKBDocument(id);
    if (!doc) return;

    await this.store.deleteKBDocument(id);

    const category = await this.store.getKBCategory(doc.categoryId);
    if (category) {
      category.documentCount = (await this.store.listKBDocuments(doc.categoryId)).length;
      category.updatedAt = Date.now();
      await this.store.saveKBCategory(category);
    }
  }

  async updateDocumentContent(id: string, content: string): Promise<void> {
    await this.updateDocumentContentDetailed(id, content);
  }

  async updateDocumentContentDetailed(id: string, content: string): Promise<KnowledgeDocumentWriteResult> {
    const doc = await this.store.getKBDocument(id);
    if (!doc) throw new Error('Document not found');

    const chunks = await this.chunkTextDetailed(content);
    await this.store.deleteKBChunksByDocument(id);

    const savedChunks: Array<{ id: string; documentId: string; content: string; contentHash: string }> = [];
    const chunkerVersion = resolveChunkerVersion(resolveChunkOptions(resolveRagConfig(this.getSettings())));
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = typeid('chunk').toString();
      const contentHash = hashChunkContent(chunk.content);
      await this.store.saveKBChunk({
        id: chunkId,
        documentId: id,
        content: chunk.content,
        index: i,
        metadata: {
          ...chunk.metadata,
          contentHash,
          documentChecksum: crypto.createHash('sha256').update(content).digest('hex'),
          rawContentRef: doc.metadata?.rawContentRef || `knowledge://${id}`,
          version: chunkerVersion
        },
        contentHash,
        chunkerVersion,
        embeddingConfigHash: resolveEmbeddingConfigHash(this.getSettings()),
        indexVersion: chunkerVersion
      });
      savedChunks.push({ id: chunkId, documentId: id, content: chunk.content, contentHash });
    }

    doc.chunkCount = chunks.length;
    doc.updatedAt = Date.now();
    doc.metadata.hash = crypto.createHash('sha256').update(content).digest('hex');
    doc.metadata.checksum = doc.metadata.hash;
    doc.metadata.chunkerVersion = chunkerVersion;
    doc.metadata.parserVersion = doc.metadata.parserVersion || 'document-processor:v2';
    await this.store.saveKBDocument(doc);

    const ingest = await this.enqueueEmbeddingsIfEnabled(savedChunks);
    return {
      id,
      embeddingQueuedCount: ingest.queued,
      embeddingSkippedCount: ingest.skipped
    };
  }

  async getDocumentFullText(id: string): Promise<string> {
    const chunks = await this.store.listKBChunks(id);
    if (chunks.length === 0) return '文档内容未找到';
    return chunks.map((c) => c.content).join('\n');
  }

  async queryKnowledge(
    query: string,
    options: {
      categoryIds?: string[];
      documentIds?: string[];
      limit?: number;
      fallbackFormat?: KnowledgeQueryFallbackFormat;
      sourceFilter?: RagSourceFilter;
    } = {}
  ): Promise<string> {
    const detailed = await this.queryKnowledgeDetailed(query, options);
    return detailed.answer;
  }

  async queryKnowledgeDetailed(
    query: string,
    options: {
      categoryIds?: string[];
      documentIds?: string[];
      limit?: number;
      fallbackFormat?: KnowledgeQueryFallbackFormat;
      sourceFilter?: RagSourceFilter;
    } = {}
  ): Promise<KnowledgeQueryDetailedResult> {
    const started = Date.now();
    const today = getISODate();
    const fallbackFormat = options.fallbackFormat || 'readable';
    const planner = new RagQueryPlanner(this.store, this.agentService, this.getSettings);
    const plan = await planner.plan(query, {
      categoryIds: options.categoryIds,
      documentIds: options.documentIds
    });
    const expansion = await planner.expand(plan.retrievalQuery);
    const retrieval = new KnowledgeRetrievalService(this.store, this.getSettings);
    const scopedFilter = mergeRagSourceFilters(
      options.sourceFilter,
      explicitKnowledgeFilter({
        categoryIds: plan.categoryIds,
        documentIds: plan.documentIds
      })
    );
    const scopeMetadata = createKnowledgeScopeMetadata(scopedFilter);
    const plannerStages = [...plan.stages, ...expansion.stages];
    const retrieved = await retrieval.search(plan.retrievalQuery, {
      categoryIds: plan.categoryIds,
      documentIds: plan.documentIds,
      sourceFilter: scopedFilter,
      limit: options.limit || 5,
      queries: expansion.queries
    });
    retrieved.trace.metadata = {
      ...(retrieved.trace.metadata || {}),
      queryExpansion: {
        queries: expansion.queries,
        hydeQuery: expansion.hydeQuery,
        multiQueryVariants: expansion.multiQueryVariants,
        fallbackReason: expansion.fallbackReason
      },
      plannerStages,
      scope: scopeMetadata,
      sourceFilter: scopedFilter,
      retrievalStages: retrieved.stages,
      traceStages: combineTraceStages(plannerStages, retrieved.stages)
    };
    await this.safeSaveTrace(retrieved.trace);
    const searchResults = retrieved.rows;

    if (searchResults.length === 0) {
      const answer = '抱歉，知识库中暂时没有找到与您查询相关的内容。';
      const citationCheck = new RagCitationChecker().check('', []);
      const citationDecision = buildCitationDecision(
        'refuse',
        citationCheck,
        0,
        [],
        '知识库中没有可引用证据。'
      );
      const trace = buildCitationTrace(
        retrieved.trace,
        undefined,
        answer,
        citationDecision,
        [createTraceStage('citation_check', 'failed', 0, {
          reason: citationCheck.reason,
          citationIds: citationCheck.citationIds,
          missingCitationIds: citationCheck.missingCitationIds,
          decisionAction: citationDecision.action
        })]
      );
      await this.safeSaveTrace(trace);
      return {
        answer,
        meta: {
          retrievalMode: retrieved.retrievalMode,
          fallbackReason: plan.fallbackReason || expansion.fallbackReason || retrieved.fallbackReason,
          plannerStages,
          retrievalStages: retrieved.stages,
          traceStages: trace.metadata?.traceStages as RagRetrievalStage[] | undefined,
          durationMs: Date.now() - started,
          sourceCount: 0,
          traceId: retrieved.trace.traceId,
          evidenceCount: 0,
          scope: scopeMetadata,
          sourceFilter: scopedFilter,
          citationCheck,
          citationDecision
        },
        sources: [],
        evidence: [],
        traceId: retrieved.trace.traceId,
        trace
      };
    }

    const contextStarted = Date.now();
    const contextBuild = new RagContextBuilder().build(retrieved.evidence, { maxTokens: 3200 });
    const contextStage = createTraceStage('context_build', 'success', Date.now() - contextStarted, {
      evidenceCount: retrieved.evidence.length,
      usedEvidenceCount: contextBuild.usedEvidenceIds.length,
      droppedEvidenceCount: contextBuild.droppedEvidenceIds.length,
      tokenEstimate: contextBuild.tokenEstimate,
      usedEvidenceIds: contextBuild.usedEvidenceIds,
      droppedEvidenceIds: contextBuild.droppedEvidenceIds
    });
    const baseTraceStages = combineTraceStages(plannerStages, retrieved.stages, [contextStage]);
    retrieved.trace.metadata = mergeTraceMetadata(retrieved.trace.metadata, {
      contextBuild,
      traceStages: baseTraceStages
    });
    const fullContents = searchResults.map((res, i) => {
      return `[结果 ${i + 1}] 来自文档: ${res.docName}\n${res.content}`;
    });
    const fallbackAnswer = (reason: string) =>
      fallbackFormat === 'context'
        ? buildKnowledgeContextFallback(reason, fullContents)
        : buildReadableKnowledgeFallback(reason, searchResults);

    const sources = toKnowledgeSources(searchResults, retrieved.evidence);
    const meta = {
      retrievalMode: retrieved.retrievalMode,
      fallbackReason: plan.fallbackReason || expansion.fallbackReason || retrieved.fallbackReason,
      plannerStages,
      retrievalStages: retrieved.stages,
      traceStages: baseTraceStages,
      durationMs: Date.now() - started,
      sourceCount: sources.length,
      traceId: retrieved.trace.traceId,
      evidenceCount: retrieved.evidence.length,
      scope: scopeMetadata,
      sourceFilter: scopedFilter
    };

    const synthesisAgentId = resolveRagSynthesisAgentId(resolveRagConfig(this.getSettings()));
    if (!this.agentService) {
      const answer = fallbackAnswer('AgentService 不可用');
      const trace = appendTraceStages({
        ...retrieved.trace,
        finalContext: contextBuild.context,
        answer
      }, [createTraceStage('generation', 'skipped', 0, {}, 'agent_service_unavailable')]);
      await this.safeSaveTrace(trace);
      return {
        answer,
        meta: { ...meta, traceStages: trace.metadata?.traceStages as RagRetrievalStage[] | undefined },
        sources,
        evidence: retrieved.evidence,
        traceId: retrieved.trace.traceId,
        trace
      };
    }
    if (!synthesisAgentId) {
      const answer = fallbackAnswer('未配置汇总智能体');
      const trace = appendTraceStages({
        ...retrieved.trace,
        finalContext: contextBuild.context,
        answer
      }, [createTraceStage('generation', 'skipped', 0, {}, 'synthesis_agent_unconfigured')]);
      await this.safeSaveTrace(trace);
      return {
        answer,
        meta: {
          ...meta,
          fallbackReason: meta.fallbackReason || 'synthesis_agent_unconfigured',
          traceStages: trace.metadata?.traceStages as RagRetrievalStage[] | undefined
        },
        sources,
        evidence: retrieved.evidence,
        traceId: retrieved.trace.traceId,
        trace
      };
    }

    const finalPrompt = PromptService.getInstance().getPrompt('knowledge_final', {
      today,
      context: contextBuild.context || fullContents.join('\n\n---\n\n'),
      query
    });

    try {
      const generationStarted = Date.now();
      const finalResult = await this.agentService.runAgent(
        synthesisAgentId,
        finalPrompt,
        undefined,
        { silent: true, noTools: true }
      );
      const generationStage = createTraceStage('generation', 'success', Date.now() - generationStarted, {
        retry: false,
        answerLength: String(finalResult.content || '').length
      });
      const content = finalResult.content;
      if (!content?.trim() || content === 'No response generated (AI returned empty content)') {
        const answer = fallbackAnswer('AI 汇总为空');
        const trace = appendTraceStages({
          ...retrieved.trace,
          finalContext: contextBuild.context,
          answer
        }, [{ ...generationStage, status: 'failed', reason: 'empty_generation' }]);
        await this.safeSaveTrace(trace);
        return {
          answer,
          meta: { ...meta, traceStages: trace.metadata?.traceStages as RagRetrievalStage[] | undefined },
          sources,
          evidence: retrieved.evidence,
          traceId: retrieved.trace.traceId,
          trace
        };
      }
      const citationChecker = new RagCitationChecker();
      const citationStarted = Date.now();
      const citationCheck = citationChecker.check(content, retrieved.evidence);
      const citationStage = createTraceStage('citation_check', citationCheck.ok ? 'success' : 'failed', Date.now() - citationStarted, {
        retry: false,
        reason: citationCheck.reason,
        citationIds: citationCheck.citationIds,
        missingCitationIds: citationCheck.missingCitationIds,
        coverage: citationCheck.coverage
      });
      if (citationCheck.ok) {
        const citationDecision = buildCitationDecision('accept', citationCheck, 0);
        const trace = buildCitationTrace(retrieved.trace, contextBuild.context, content, citationDecision, [
          generationStage,
          citationStage
        ]);
        await this.safeSaveTrace(trace);
        return {
          answer: content,
          meta: {
            ...meta,
            citationCheck,
            citationDecision,
            traceStages: trace.metadata?.traceStages as RagRetrievalStage[] | undefined
          },
          sources,
          evidence: retrieved.evidence,
          traceId: retrieved.trace.traceId,
          trace
        };
      }

      const retryPrompt = buildCitationRetryPrompt(finalPrompt, content, citationCheck, retrieved.evidence);
      const retryGenerationStarted = Date.now();
      const retryResult = await this.agentService.runAgent(
        synthesisAgentId,
        retryPrompt,
        undefined,
        { silent: true, noTools: true }
      );
      const retryGenerationStage = createTraceStage('generation_retry', 'success', Date.now() - retryGenerationStarted, {
        retry: true,
        answerLength: String(retryResult.content || '').length
      });
      const retryContent = retryResult.content;
      if (retryContent?.trim() && retryContent !== 'No response generated (AI returned empty content)') {
        const retryCitationStarted = Date.now();
        const retryCitationCheck = citationChecker.check(retryContent, retrieved.evidence);
        const retryCitationStage = createTraceStage('citation_check_retry', retryCitationCheck.ok ? 'success' : 'failed', Date.now() - retryCitationStarted, {
          retry: true,
          reason: retryCitationCheck.reason,
          citationIds: retryCitationCheck.citationIds,
          missingCitationIds: retryCitationCheck.missingCitationIds,
          coverage: retryCitationCheck.coverage
        });
        if (retryCitationCheck.ok) {
          const citationDecision = buildCitationDecision(
            'accept',
            retryCitationCheck,
            1,
            [citationCheck],
            '引用重试后通过校验。'
          );
          const trace = buildCitationTrace(retrieved.trace, contextBuild.context, retryContent, citationDecision, [
            generationStage,
            citationStage,
            retryGenerationStage,
            retryCitationStage
          ]);
          await this.safeSaveTrace(trace);
          return {
            answer: retryContent,
            meta: {
              ...meta,
              citationCheck: retryCitationCheck,
              citationDecision,
              traceStages: trace.metadata?.traceStages as RagRetrievalStage[] | undefined
            },
            sources,
            evidence: retrieved.evidence,
            traceId: retrieved.trace.traceId,
            trace
          };
        }
        const answer = buildCitationRefusalAnswer(retryCitationCheck);
        const citationDecision = buildCitationDecision(
          'refuse',
          retryCitationCheck,
          1,
          [citationCheck],
          '引用重试后仍未通过校验。'
        );
        const trace = buildCitationTrace(retrieved.trace, contextBuild.context, answer, citationDecision, [
          generationStage,
          citationStage,
          retryGenerationStage,
          retryCitationStage
        ]);
        await this.safeSaveTrace(trace);
        return {
          answer,
          meta: {
            ...meta,
            citationCheck: retryCitationCheck,
            citationDecision,
            traceStages: trace.metadata?.traceStages as RagRetrievalStage[] | undefined
          },
          sources,
          evidence: retrieved.evidence,
          traceId: retrieved.trace.traceId,
          trace
        };
      }

      const answer = buildCitationRefusalAnswer(citationCheck);
      const citationDecision = buildCitationDecision(
        'refuse',
        citationCheck,
        1,
        [citationCheck],
        '引用重试没有生成有效回答。'
      );
      const trace = buildCitationTrace(retrieved.trace, contextBuild.context, answer, citationDecision, [
        generationStage,
        citationStage,
        { ...retryGenerationStage, status: 'failed', reason: 'empty_generation' }
      ]);
      await this.safeSaveTrace(trace);
      return {
        answer,
        meta: {
          ...meta,
          citationCheck,
          citationDecision,
          traceStages: trace.metadata?.traceStages as RagRetrievalStage[] | undefined
        },
        sources,
        evidence: retrieved.evidence,
        traceId: retrieved.trace.traceId,
        trace
      };
    } catch (error: any) {
      LogService.error(`Knowledge query AI synthesis failed: ${error.message}`);
      const answer = fallbackAnswer('AI 汇总失败');
      const trace = appendTraceStages({
        ...retrieved.trace,
        finalContext: contextBuild.context,
        answer
      }, [createTraceStage('generation', 'failed', 0, { error: error.message }, 'generation_failed')]);
      await this.safeSaveTrace(trace);
      return {
        answer,
        meta: { ...meta, traceStages: trace.metadata?.traceStages as RagRetrievalStage[] | undefined },
        sources,
        evidence: retrieved.evidence,
        traceId: retrieved.trace.traceId,
        trace
      };
    }
  }

  private async chunkText(text: string): Promise<string[]> {
    return (await this.chunkTextDetailed(text)).map((chunk) => chunk.content);
  }

  private async chunkTextDetailed(text: string): Promise<ProcessedChunk[]> {
    const rag = resolveRagConfig(this.getSettings());
    const options = resolveChunkOptions(rag);

    if (options.chunkStrategy === 'embedding') {
      const embedSvc = resolveEmbeddingService(this.getSettings());
      const embedFn = embedSvc
        ? async (sentences: string[]) => {
            const client = createEmbeddingClient(embedSvc);
            return client.embed(sentences);
          }
        : null;
      const result = await chunkTextWithEmbeddingFallback(
        text,
        embedFn,
        options,
        (input) => this.processor.chunkStructure(input, options)
      );
      return result.chunks.map((content, index) => ({
        content,
        metadata: {
          headingPath: extractHeadingPath(content),
          tokenCount: estimateTokens(content),
          section: extractHeadingPath(content).at(-1),
          chunkStrategy: options.chunkStrategy,
          chunkSize: options.chunkSize,
          chunkOverlap: options.chunkOverlap,
          chunkIndex: index,
          checksum: hashChunkContent(content)
        }
      }));
    }

    return this.processor.chunkDetailed(text, options);
  }

  private async enqueueEmbeddingsIfEnabled(chunks: Array<{ id: string; documentId: string; content: string; contentHash: string }>) {
    const rag = resolveRagConfig(this.getSettings());
    if (!rag.embedOnIngest || chunks.length === 0) {
      return { queued: 0, skipped: chunks.length };
    }
    try {
      const result = await new RagEmbeddingIngestService(this.store).enqueueChunks(chunks, 'dual');
      if (result.queued > 0) {
        this.triggerEmbeddingJobsAsync(result.queued);
      }
      return result;
    } catch (err) {
      LogService.warn(`RAG embedding ingest enqueue failed: ${err}`);
      return { queued: 0, skipped: chunks.length };
    }
  }

  private triggerEmbeddingJobsAsync(queued: number): void {
    if (queued <= 0 || !resolveEmbeddingService(this.getSettings())) return;

    void (async () => {
      try {
        const rag = resolveRagConfig(this.getSettings());
        const batchSize = Math.max(1, rag.embeddingBatchSize || 16);
        const runner = new RagEmbeddingJobRunner(this.store, this.getSettings);
        const maxRounds = Math.max(1, Math.ceil(queued / batchSize) + 1);

        for (let round = 0; round < maxRounds; round++) {
          const result = await runner.runOnce({ limit: Math.min(queued, 100) });
          if (result.status === 'disabled' || result.claimed === 0) break;
        }
      } catch (err) {
        LogService.warn(`RAG embedding job auto-run failed: ${err}`);
      }
    })();
  }

  private async safeSaveTrace(trace: import('../../types/rag.js').RagRetrievalTrace): Promise<void> {
    try {
      if (typeof this.store.saveRagQueryTrace === 'function') {
        await this.store.saveRagQueryTrace(trace);
      }
    } catch (err) {
      LogService.warn(`RAG trace save failed: ${err}`);
    }
  }
}

function buildCitationDecision(
  action: RagCitationDecision['action'],
  citationCheck: RagCitationCheckResult,
  retryCount: number,
  previousChecks: RagCitationCheckResult[] = [],
  message?: string
): RagCitationDecision {
  return {
    action,
    retryCount,
    citationCheck,
    reason: citationCheck.reason || (retryCount > 0 && action === 'accept' ? 'citation_retry_succeeded' : undefined),
    previousChecks: previousChecks.length ? previousChecks : undefined,
    message
  };
}

function buildCitationTrace(
  base: RagRetrievalTrace,
  finalContext: string | undefined,
  answer: string,
  citationDecision: RagCitationDecision,
  stages: RagRetrievalStage[] = []
): RagRetrievalTrace {
  return appendTraceStages({
    ...base,
    finalContext,
    answer,
    citationIds: citationDecision.citationCheck.citationIds,
    metadata: mergeTraceMetadata(base.metadata, {
      citationCheck: citationDecision.citationCheck,
      citationDecision
    })
  }, stages);
}

function createTraceStage(
  name: string,
  status: RagRetrievalStage['status'],
  durationMs: number,
  metadata: Record<string, unknown> = {},
  reason?: string
): RagRetrievalStage {
  return {
    name,
    status,
    durationMs,
    reason,
    metadata
  };
}

function combineTraceStages(
  plannerStages: RagPlannerStage[] = [],
  retrievalStages: RagRetrievalStage[] = [],
  extraStages: RagRetrievalStage[] = []
): RagRetrievalStage[] {
  return [
    ...plannerStages.map((stage) => ({
      name: stage.name,
      status: stage.status,
      durationMs: stage.durationMs,
      reason: stage.reason,
      error: stage.error,
      resultCount: stage.outputCount,
      metadata: stage.metadata
    })),
    ...retrievalStages,
    ...extraStages
  ];
}

function mergeTraceMetadata(
  base: Record<string, unknown> | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return { ...(base || {}), ...patch };
}

function appendTraceStages(base: RagRetrievalTrace, stages: RagRetrievalStage[]): RagRetrievalTrace {
  if (stages.length === 0) return base;
  const existing = Array.isArray(base.metadata?.traceStages)
    ? base.metadata.traceStages as RagRetrievalStage[]
    : [];
  return {
    ...base,
    metadata: mergeTraceMetadata(base.metadata, {
      traceStages: [...existing, ...stages]
    })
  };
}

function buildCitationRetryPrompt(
  originalPrompt: string,
  previousAnswer: string,
  citationCheck: RagCitationCheckResult,
  evidence: RagEvidence[]
): string {
  const availableLabels = evidence.map((item) => item.citationLabel).join(', ');
  return [
    originalPrompt,
    '',
    '上一版回答没有通过引用校验，请只修复引用问题后重新回答。',
    `失败原因：${citationCheck.reason || 'unknown'}`,
    `可用证据标号：${availableLabels || '无'}`,
    '要求：',
    '1. 每个事实性结论必须引用可用证据标号。',
    '2. 只能使用上面列出的证据标号，不要编造新标号。',
    '3. 如果证据不足，请明确拒答，并引用最接近的证据说明不足。',
    '',
    '上一版回答：',
    previousAnswer
  ].join('\n');
}

function buildCitationRefusalAnswer(citationCheck: RagCitationCheckResult): string {
  if (citationCheck.reason === 'citation_not_found') {
    return '抱歉，当前回答引用了知识库中不存在的证据，无法作为可靠答案返回。';
  }
  if (citationCheck.reason === 'missing_citation') {
    return '抱歉，当前回答没有提供可验证的知识库引用，无法作为可靠答案返回。';
  }
  return '抱歉，知识库中没有可用于回答该问题的可靠证据。';
}

function toKnowledgeSources(searchResults: any[], evidence: RagEvidence[] = []): KnowledgeQuerySource[] {
  return searchResults.map((res, index) => {
    const item = evidence[index];
    return {
      chunkId: String(res.id || item?.unitId || ''),
      documentId: String(res.documentId || item?.parentId || ''),
      docName: String(res.docName || item?.metadata?.docName || '未命名文档'),
      categoryId: res.categoryId ? String(res.categoryId) : item?.metadata?.categoryId ? String(item.metadata.categoryId) : undefined,
      snippet: cleanKnowledgeDisplayText(res.snippet || res.content || item?.content || '', 220),
      score: typeof res.score === 'number' ? res.score : item?.score,
      evidenceId: item?.evidenceId,
      sourceType: item?.sourceType,
      unitId: item?.unitId,
      parentId: item?.parentId,
      citationLabel: item?.citationLabel
    };
  });
}

function resolveChunkerVersion(options: ReturnType<typeof resolveChunkOptions>): string {
  return [
    options.chunkStrategy,
    options.chunkSize,
    options.chunkOverlap,
    options.semanticMaxChunkSize,
    options.semanticMinChunkSize,
    options.semanticBreakpointPercentile
  ].join(':');
}

function resolveEmbeddingConfigHash(settings: SystemSettings | null | undefined): string {
  const svc = resolveEmbeddingService(settings);
  return crypto.createHash('sha256').update(JSON.stringify({
    providerId: settings?.ACTIVE_EMBEDDING_SERVICE_ID || '',
    model: svc?.model || '',
    dimensions: svc?.dimensions || 0
  })).digest('hex');
}

function extractHeadingPath(text: string): string[] {
  const headings = String(text || '')
    .split('\n')
    .map((line) => line.match(/^(#{1,6})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match));
  if (headings.length === 0) return [];
  const path: string[] = [];
  for (const match of headings) {
    const level = match[1].length;
    path.length = Math.max(0, level - 1);
    path[level - 1] = match[2].trim();
  }
  return path.filter(Boolean);
}

function estimateTokens(text: string): number {
  return Math.ceil(String(text || '').length / 4);
}

function buildKnowledgeContextFallback(reason: string, fullContents: string[]): string {
  return `知识库检索已命中，但由于${reason}，以下为相关文档片段：\n\n${fullContents.join('\n\n---\n\n')}`;
}

function buildReadableKnowledgeFallback(reason: string, searchResults: any[]): string {
  const sources = summarizeKnowledgeSources(searchResults);
  const sourceLines = sources
    .map((source, index) => {
      const summaryLine = source.summary ? `\n   摘要：${source.summary}` : '';
      const snippetLine = source.snippet ? `\n   相关片段：${source.snippet}` : '';
      const noteLine = !source.summary && !source.snippet ? '\n   说明：已命中该文档，但原始片段不适合直接展示。' : '';
      return `${index + 1}. ${source.docName}${summaryLine}${snippetLine}${noteLine}`;
    })
    .join('\n');

  return `知识库已找到相关内容，但由于${reason}，暂时无法生成完整回答。\n\n你可以先参考这些来源：\n${sourceLines}`;
}

function summarizeKnowledgeSources(searchResults: any[]) {
  const sourceMap = new Map<string, { docName: string; summary: string; snippet: string }>();
  for (const result of searchResults) {
    const docName = cleanKnowledgeText(result.docName || '未命名文档', 120);
    if (sourceMap.has(docName)) continue;

    sourceMap.set(docName, {
      docName,
      summary: cleanKnowledgeDisplayText(result.docSummary || '', 180),
      snippet: cleanKnowledgeDisplayText(result.snippet || result.content || '', 220)
    });
  }
  return Array.from(sourceMap.values()).slice(0, 5);
}

function cleanKnowledgeDisplayText(value: unknown, maxLength: number): string {
  const text = cleanKnowledgeText(value, maxLength);
  if (!text || looksLikeRawDataDump(text)) return '';
  return text;
}

function cleanKnowledgeText(value: unknown, maxLength: number): string {
  const text = String(value || '')
    .replace(/[{}[\]"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function looksLikeRawDataDump(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/^[{[]/.test(text) && /[{}\]":,[]/.test(text)) return true;
  if (/\b[a-zA-Z0-9_.-]+\s*:\s*/.test(text) && /[,;]/.test(text)) return true;

  const structuralChars = text.match(/[{}\]":,[]/g)?.length || 0;
  return structuralChars >= 6 && structuralChars / Math.max(text.length, 1) > 0.08;
}
