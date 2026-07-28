import type { RagKnowledgeScope, RagSourceFilter } from '../../types/rag.js';

export function knowledgeScopeToRagSourceFilter(scope?: RagKnowledgeScope): RagSourceFilter | undefined {
  if (!scope) return undefined;
  const categoryIds = unique(scope.allowedCategoryIds);
  const documentIds = unique(scope.allowedDocumentIds);
  if (scope.emptyScopePolicy === 'deny_all' && categoryIds.length === 0 && documentIds.length === 0) {
    return {
      sourceType: 'knowledge',
      sourceIds: ['knowledge'],
      parentIds: ['__deny_all__'],
      metadata: {
        categoryIds: [],
        documentIds: [],
        scopeSource: scope.scopeSource || 'explicit',
        emptyScopePolicy: 'deny_all'
      }
    };
  }
  if (categoryIds.length === 0 && documentIds.length === 0 && scope.emptyScopePolicy !== 'allow_all') {
    return undefined;
  }
  return {
    sourceType: 'knowledge',
    sourceIds: ['knowledge'],
    parentIds: documentIds.length ? documentIds : undefined,
    metadata: {
      categoryIds,
      documentIds,
      scopeSource: scope.scopeSource || 'explicit',
      emptyScopePolicy: scope.emptyScopePolicy || 'allow_all'
    }
  };
}

export function explicitKnowledgeFilter(input: {
  categoryIds?: string[];
  documentIds?: string[];
}): RagSourceFilter {
  return {
    sourceType: 'knowledge',
    sourceIds: ['knowledge'],
    parentIds: unique(input.documentIds),
    metadata: {
      categoryIds: unique(input.categoryIds),
      documentIds: unique(input.documentIds),
      ...(unique(input.categoryIds).length > 0 || unique(input.documentIds).length > 0
        ? { scopeSource: 'explicit' }
        : {})
    }
  };
}

export function legacyKnowledgeCategoryScope(categoryIds?: string[]): RagKnowledgeScope | undefined {
  const allowedCategoryIds = unique(categoryIds);
  if (allowedCategoryIds.length === 0) return undefined;
  return {
    allowedCategoryIds,
    scopeSource: 'agent',
    emptyScopePolicy: 'allow_all'
  };
}

export function mergeKnowledgeScopes(
  base: RagKnowledgeScope | undefined,
  override: RagKnowledgeScope | undefined
): RagKnowledgeScope | undefined {
  if (!base) return cloneScope(override);
  if (!override) return cloneScope(base);
  const categoryMerge = mergeConstraint(base.allowedCategoryIds, override.allowedCategoryIds);
  const documentMerge = mergeConstraint(base.allowedDocumentIds, override.allowedDocumentIds);
  if ((categoryMerge.conflict || documentMerge.conflict)) {
    return {
      allowedCategoryIds: [],
      allowedDocumentIds: [],
      scopeSource: override.scopeSource || base.scopeSource,
      emptyScopePolicy: 'deny_all'
    };
  }
  return {
    allowedCategoryIds: categoryMerge.values,
    allowedDocumentIds: documentMerge.values,
    scopeSource: override.scopeSource || base.scopeSource,
    emptyScopePolicy: mostRestrictiveEmptyPolicy(base.emptyScopePolicy, override.emptyScopePolicy)
  };
}

export function mergeRagSourceFilters(
  base: RagSourceFilter | undefined,
  override: RagSourceFilter | undefined
): RagSourceFilter | undefined {
  if (!base) return cloneFilter(override);
  if (!override) return cloneFilter(base);
  const baseMetadata = base.metadata || {};
  const overrideMetadata = override.metadata || {};
  const categoryMerge = mergeConstraint(
    arrayFromMetadata(baseMetadata.categoryIds),
    arrayFromMetadata(overrideMetadata.categoryIds)
  );
  const documentMerge = mergeConstraint(
    mergeStringArrays([
      ...(base.parentIds || []),
      ...arrayFromMetadata(baseMetadata.documentIds)
    ]),
    mergeStringArrays([
      ...(override.parentIds || []),
      ...arrayFromMetadata(overrideMetadata.documentIds)
    ])
  );
  if (categoryMerge.conflict || documentMerge.conflict || isDenyAllFilter(base) || isDenyAllFilter(override)) {
    return knowledgeScopeToRagSourceFilter({
      scopeSource: String(overrideMetadata.scopeSource || baseMetadata.scopeSource || 'explicit') as RagKnowledgeScope['scopeSource'],
      emptyScopePolicy: 'deny_all'
    });
  }
  const categoryIds = categoryMerge.values;
  const documentIds = documentMerge.values;
  return {
    sourceType: 'knowledge',
    sourceIds: mergeStringArrays([...(base.sourceIds || []), ...(override.sourceIds || [])]) || ['knowledge'],
    parentIds: documentIds,
    unitIds: intersectIfBoth(base.unitIds, override.unitIds),
    metadata: {
      ...baseMetadata,
      ...overrideMetadata,
      categoryIds: categoryIds || [],
      documentIds: documentIds || [],
      scopeSource: overrideMetadata.scopeSource || baseMetadata.scopeSource || 'explicit',
      mergedScope: true
    }
  };
}

export function createKnowledgeScopeMetadata(filter?: RagSourceFilter): Record<string, unknown> | undefined {
  if (!filter) return undefined;
  const metadata = filter.metadata || {};
  return {
    sourceType: filter.sourceType || 'knowledge',
    sourceIds: filter.sourceIds || ['knowledge'],
    categoryIds: arrayFromMetadata(metadata.categoryIds),
    documentIds: mergeStringArrays([
      ...(filter.parentIds || []),
      ...arrayFromMetadata(metadata.documentIds)
    ]) || [],
    unitIds: filter.unitIds || [],
    scopeSource: metadata.scopeSource,
    emptyScopePolicy: metadata.emptyScopePolicy,
    mergedScope: metadata.mergedScope === true
  };
}

export function unitMatchesKnowledgeFilter(unit: { parentId?: string; metadata?: Record<string, unknown> }, filter?: RagSourceFilter): boolean {
  if (!filter) return true;
  const metadata = filter.metadata || {};
  const categoryIds = arrayFromMetadata(metadata.categoryIds);
  const documentIds = mergeStringArrays([
    ...(filter.parentIds || []),
    ...arrayFromMetadata(metadata.documentIds)
  ]) || [];
  const knowledge = unit.metadata?.knowledge;
  const unitCategoryId = knowledge && typeof knowledge === 'object'
    ? String((knowledge as Record<string, unknown>).categoryId || '').trim()
    : '';
  const unitDocumentId = String(unit.parentId || '').trim();
  if (isDenyAllFilter(filter)) return false;
  if (categoryIds.length > 0 && (!unitCategoryId || !categoryIds.includes(unitCategoryId))) return false;
  if (documentIds.length > 0 && (!unitDocumentId || !documentIds.includes(unitDocumentId))) return false;
  return true;
}

export function isDenyAllFilter(filter?: RagSourceFilter): boolean {
  if (!filter) return false;
  return filter.metadata?.emptyScopePolicy === 'deny_all'
    && filter.parentIds?.length === 1
    && filter.parentIds[0] === '__deny_all__';
}

function cloneScope(scope?: RagKnowledgeScope): RagKnowledgeScope | undefined {
  if (!scope) return undefined;
  return {
    allowedCategoryIds: unique(scope.allowedCategoryIds),
    allowedDocumentIds: unique(scope.allowedDocumentIds),
    scopeSource: scope.scopeSource,
    emptyScopePolicy: scope.emptyScopePolicy
  };
}

function cloneFilter(filter?: RagSourceFilter): RagSourceFilter | undefined {
  if (!filter) return undefined;
  return {
    sourceType: filter.sourceType,
    sourceIds: filter.sourceIds ? [...filter.sourceIds] : undefined,
    parentIds: filter.parentIds ? [...filter.parentIds] : undefined,
    unitIds: filter.unitIds ? [...filter.unitIds] : undefined,
    metadata: filter.metadata ? { ...filter.metadata } : undefined
  };
}

function mostRestrictiveEmptyPolicy(
  left?: RagKnowledgeScope['emptyScopePolicy'],
  right?: RagKnowledgeScope['emptyScopePolicy']
): RagKnowledgeScope['emptyScopePolicy'] {
  return left === 'deny_all' || right === 'deny_all' ? 'deny_all' : (right || left || 'allow_all');
}

function mergeConstraint(left?: string[], right?: string[]): { values?: string[]; conflict: boolean } {
  const normalizedLeft = unique(left);
  const normalizedRight = unique(right);
  if (normalizedLeft.length === 0 && normalizedRight.length === 0) {
    return { values: undefined, conflict: false };
  }
  if (normalizedLeft.length === 0) return { values: normalizedRight, conflict: false };
  if (normalizedRight.length === 0) return { values: normalizedLeft, conflict: false };
  const rightSet = new Set(normalizedRight);
  const values = normalizedLeft.filter((item) => rightSet.has(item));
  return { values, conflict: values.length === 0 };
}

function intersectIfBoth(left?: string[], right?: string[]): string[] | undefined {
  const normalizedLeft = unique(left);
  const normalizedRight = unique(right);
  if (normalizedLeft.length === 0 && normalizedRight.length === 0) return undefined;
  if (normalizedLeft.length === 0) return normalizedRight;
  if (normalizedRight.length === 0) return normalizedLeft;
  const rightSet = new Set(normalizedRight);
  return normalizedLeft.filter((item) => rightSet.has(item));
}

function mergeStringArrays(values: string[]): string[] | undefined {
  const merged = unique(values);
  return merged.length ? merged : undefined;
}

function arrayFromMetadata(value: unknown): string[] {
  return Array.isArray(value) ? unique(value.map((item) => String(item || ''))) : [];
}

function unique(values?: string[]): string[] {
  return [...new Set((values || []).map((item) => String(item || '').trim()).filter(Boolean))];
}
