export class ShareNotAvailableError extends Error {
  constructor(message = '当前后端暂不支持话题链接分享') {
    super(message);
    this.name = 'ShareNotAvailableError';
  }
}
