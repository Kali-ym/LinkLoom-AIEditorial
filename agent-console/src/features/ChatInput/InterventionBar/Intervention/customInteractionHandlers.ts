/** §C.36*/
export function isCustomInteractionIdentifier(identifier: string, apiName: string): boolean {
  if (identifier === 'linkloom-user-interaction') return true;
  if (identifier === 'claude-code' && apiName === 'askUserQuestion') return true;
  if (identifier === 'linkloom-web-onboarding' && apiName === 'showAgentMarketplace') return true;
  return false;
}
