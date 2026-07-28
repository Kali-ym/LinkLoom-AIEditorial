export class TopicMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TopicMoveError';
  }
}

/** §C.52*/
export async function batchMoveTopicsToAgentApi(
  topicIds: string[],
  targetAgentId: string,
): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 640));
  if (topicIds.length === 0) {
    throw new TopicMoveError('未选择任何话题');
  }
  if (!targetAgentId) {
    throw new TopicMoveError('目标助手无效');
  }
}
