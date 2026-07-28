import { MESSAGE_ACTION_BAR_PORTAL_ATTRIBUTES } from '../../constants/messageActionPortal';

/** Portal placeholder — actions render via MessageActionProvider singleton. */
export function UserMessageActionsPortal() {
  return (
    <div
      {...{ [MESSAGE_ACTION_BAR_PORTAL_ATTRIBUTES.user]: '' }}
      style={{ height: '28px' }}
    />
  );
}
