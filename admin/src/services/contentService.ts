import { request } from './api';

export const publishContent = (id: string, data: { content: string, [key: string]: any }) =>
  request(`/api/publish/${id}`, { method: 'POST', body: JSON.stringify(data) });

export const generateCoverImage = (prompt: string, agentId: string, date: string, content?: string) =>
  request(`/api/content/${date}/regenerate`, { method: 'POST', body: JSON.stringify({ prompt, agentId, type: 'cover', content }) });

export const uploadWechatMaterial = (url: string) =>
  request('/api/wechat/upload-material', { method: 'POST', body: JSON.stringify({ url }) });

export const deleteContent = (id: string) =>
  request(`/api/content/${id}`, { method: 'DELETE' });
