import { t } from '../i18n';

export interface TopicImportPayload {
  title?: string;
  messages?: unknown[];
}

/** §C.52*/
export function parseTopicImportJson(raw: string): TopicImportPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(t('topicModal.importErrorInvalidJson'));
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(t('topicModal.importErrorInvalidJson'));
  }
  const payload = parsed as TopicImportPayload;
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new Error(t('topicModal.importErrorEmpty'));
  }
  return payload;
}

export { showTopicImportError } from '../features/TopicModals/ImportErrorModal';
