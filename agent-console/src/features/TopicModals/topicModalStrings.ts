import { t } from '../../i18n';

/** §C.52 — topic modal strings via i18n keys */
export const topicModalStrings = {
  renameTitle: t('topicModal.renameTitle'),
  renameDescription: t('topicModal.renameDescription'),
  cancel: t('topicModal.cancel'),
  save: t('topicModal.save'),
  moveTitle: t('topicModal.moveTitle'),
  moveSearchPlaceholder: t('topicModal.moveSearchPlaceholder'),
  moveEmpty: t('topicModal.moveEmpty'),
  moveConfirm: (count: number, title: string) =>
    t('topicModal.moveConfirm', { count, title }),
  moveBack: t('topicModal.moveBack'),
  moveConfirmOk: t('topicModal.moveConfirmOk'),
  moveMoving: t('topicModal.moveMoving'),
  moveDone: (count: number) => t('topicModal.moveDone', { count }),
  moveDoneOk: t('topicModal.moveDoneOk'),
  moveGoToTarget: (title: string) => t('topicModal.moveGoToTarget', { title }),
  moveError: t('topicModal.moveError'),
  knowledgeTitle: t('topicModal.knowledgeTitle'),
  knowledgeAdd: t('topicModal.knowledgeAdd'),
  knowledgeDetail: t('topicModal.knowledgeDetail'),
  knowledgeRemove: t('topicModal.knowledgeRemove'),
  knowledgeEmpty: t('topicModal.knowledgeEmpty'),
} as const;
