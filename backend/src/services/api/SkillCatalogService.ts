import { syncSkillsFromFilesystem } from '../agents/SkillSyncService.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';

export class SkillCatalogService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  listSkills() {
    return this.store.listSkills();
  }

  async scanSkills() {
    const result = await syncSkillsFromFilesystem(this.store, this.context.skillService);
    return { status: 'success', ...result };
  }
}
