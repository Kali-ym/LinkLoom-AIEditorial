const TOPIC_ID_PREFIX = 'tpc_';
const TOPIC_ID_BODY_LENGTH = 10;

/** 统一话题 / session ID：tpc_XXXXXXXXXX */
export function generateTopicId(): string {
  let body = '';
  while (body.length < TOPIC_ID_BODY_LENGTH) {
    body += Math.random().toString(36).slice(2);
  }
  return `${TOPIC_ID_PREFIX}${body.slice(0, TOPIC_ID_BODY_LENGTH)}`;
}

export function isTopicId(value: string): boolean {
  return value.startsWith(TOPIC_ID_PREFIX);
}
