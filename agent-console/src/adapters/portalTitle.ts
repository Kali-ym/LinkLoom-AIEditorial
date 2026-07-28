import type { PortalViewPayload, PortalViewType } from '../domain/types/portalView';

/** Resolve portal header title — port of index.html `portalTitle`. */
export function portalTitle(type: PortalViewType, payload: PortalViewPayload = {}): string {
  switch (type) {
    case 'Home':
      return 'Portal';
    case 'ToolUI':
      return payload.title || `${payload.plugin} › ${payload.api}`;
    case 'Artifact':
      return payload.title || 'Artifact';
    case 'Document':
      return payload.title || '文档';
    case 'Notebook':
      return payload.title || '笔记本';
    case 'FilePreview':
      return payload.name || payload.path || '文件预览';
    case 'LocalFile':
      return '本地文件';
    case 'MessageDetail':
      return payload.title || '消息详情';
    case 'Thread':
      return payload.title || '分支对话';
    case 'GroupThread':
      return payload.title || '分组分支';
    case 'VerifyResult':
      return `验证结果 #${payload.id ?? ''}`;
    default:
      return 'Portal';
  }
}
