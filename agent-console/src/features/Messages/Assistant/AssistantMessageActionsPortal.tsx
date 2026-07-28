import { MESSAGE_ACTION_BAR_PORTAL_ATTRIBUTES } from '../../../constants/messageActionPortal';

export function AssistantMessageActionsPortal() {
  return (
    <div
      {...{ [MESSAGE_ACTION_BAR_PORTAL_ATTRIBUTES.assistant]: '' }}
      style={{ height: '28px' }}
    />
  );
}
