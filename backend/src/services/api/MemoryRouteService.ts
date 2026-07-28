import { AppError } from '../../domain/errors.js';
import type { ServiceContext } from '../ServiceContext.js';

export class MemoryRouteService {
  constructor(private readonly context: ServiceContext) {}

  getCategories() {
    return this.context.memoryService.getCategories();
  }

  async addCategory(name: string | undefined, description?: string) {
    if (!name) {
      throw new AppError(400, '分类名称不能为空');
    }
    const id = await this.context.memoryService.addCategory(name, description);
    return { id };
  }

  getCategoryDetails(id: string) {
    return this.context.memoryService.getCategoryDetails(id);
  }

  async deleteCategory(id: string) {
    await this.context.memoryService.deleteCategory(id);
    return { status: 'success' };
  }

  async updateCategory(id: string, name: string, description?: string) {
    await this.context.memoryService.updateCategory(id, name, description);
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
    const newId = await this.context.memoryService.mergeCategories(
      ids,
      targetName,
      targetDescription
    );
    return { status: 'success', id: newId };
  }

  async queryMemory(query: string, categoryIds?: string[], limit?: number) {
    const answer = await this.context.memoryService.queryMemory(query, { categoryIds, limit });
    return { answer };
  }

  async deleteMemory(id: string) {
    await this.context.memoryService.deleteMemory(id);
    return { status: 'success' };
  }

  async mergeMemories(ids: string[] | undefined, targetCategoryId?: string) {
    if (!ids || !Array.isArray(ids) || ids.length < 2) {
      throw new AppError(400, '合并至少需要两条记忆 ID (ids)');
    }
    const newId = await this.context.memoryService.mergeMemories(ids, { targetCategoryId });
    return { status: 'success', id: newId };
  }

  async moveMemory(id: string, targetCategoryId?: string) {
    if (!targetCategoryId) {
      throw new AppError(400, '目标分类 ID 不能为空');
    }
    await this.context.memoryService.moveMemoryToCategory(id, targetCategoryId);
    return { status: 'success' };
  }

  async getMemoryContent(id: string) {
    const content = await this.context.memoryService.getMemoryFullText(id);
    return { content };
  }

  async updateMemoryContent(id: string, content: string) {
    await this.context.memoryService.updateMemoryContent(id, content);
    return { status: 'success' };
  }
}
