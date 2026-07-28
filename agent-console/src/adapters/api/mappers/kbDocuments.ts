import type { BindingCategory, DocumentNode } from '../../../domain/types';

export interface KbCategoryDto {
  id: string;
  name: string;
  description?: string;
  documentCount?: number;
}

export interface KbDocumentDto {
  id: string;
  categoryId: string;
  name: string;
  fileName?: string;
  type?: string;
}

export interface CategoryDocumentsGroup {
  category: KbCategoryDto;
  documents: KbDocumentDto[];
}

export function mapKbCategoryDtoToBindingCategory(dto: KbCategoryDto): BindingCategory {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
  };
}

export function mapCategoriesAndDocumentsToTree(
  groups: CategoryDocumentsGroup[],
): DocumentNode[] {
  const nodes: DocumentNode[] = [];

  for (const { category, documents } of groups) {
    if (documents.length === 0) continue;

    const children: DocumentNode[] = documents.map((doc) => ({
      id: doc.id,
      name: doc.fileName?.trim() || doc.name,
      path: `${category.name}/${doc.fileName?.trim() || doc.name}`,
    }));

    nodes.push({
      id: category.id,
      name: category.name,
      badge: String(documents.length),
      children,
    });
  }

  return nodes;
}
