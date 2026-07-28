import type { AuthorInfo, ConsoleConfig } from '../../../domain/types';

export function getMockConsoleConfig(): ConsoleConfig {
  return {
    enableBusinessFeatures: true,
    documentCompareDocId: 'studio-readme',
    showInputFootnote: true,
    isDevMode: true,
    enableKnowledgeBase: true,
    enableGatewayMode: true,
    enableFC: true,
    showProviderSearch: true,
  };
}

export function getMockAuthorsByUserId(): Record<string, AuthorInfo> {
  return {
    'user-demo': { userId: 'user-demo', fullName: 'OpenClaw' },
  };
}
