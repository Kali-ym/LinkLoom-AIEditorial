import type { PortalViewPayload, PortalViewType } from '../../domain/types/portalView';

export interface IPortalPort {
  resolveView(type: PortalViewType, payload: PortalViewPayload): Promise<PortalViewPayload>;
  getTitle(type: PortalViewType, payload: PortalViewPayload): Promise<string>;
}
