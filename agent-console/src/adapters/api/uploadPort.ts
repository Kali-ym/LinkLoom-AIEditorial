import { agentConsoleFetch } from './http';
import type { IUploadPort } from '../ports/IUploadPort';
import {
  mapBackendUploadToRef,
  type BackendUploadDto,
} from './mappers/upload';

export const apiUploadPort: IUploadPort = {
  async uploadFiles(agentId, files) {
    const results = [];
    const query = new URLSearchParams({ agentId });

    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      const response = await agentConsoleFetch(`/api/agent-uploads?${query.toString()}`, {
        method: 'POST',
        body: form,
      });
      const dto = (await response.json()) as BackendUploadDto;
      results.push(mapBackendUploadToRef(dto));
    }

    return results;
  },
};
