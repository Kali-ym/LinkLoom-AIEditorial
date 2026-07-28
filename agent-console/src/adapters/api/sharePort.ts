import type { ISharePort } from '../ports/ISharePort';
import { ShareNotAvailableError } from '../shareDeferAdapter';

/** api 模式：无 Share API，读路径返回空；写路径显式 Defer。 */
export const apiSharePort: ISharePort = {
  async getShareByTopicId() {
    return {};
  },

  async getShare() {
    return null;
  },

  async updateVisibility() {
    throw new ShareNotAvailableError();
  },
};
