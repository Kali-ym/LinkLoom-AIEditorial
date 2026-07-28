import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import type { MultipartFile } from '@fastify/multipart';
import { AppError } from '../../domain/errors.js';
import type { LocalStore } from '../LocalStore.js';
import { AgentUploadStore } from './AgentUploadStore.js';
import {
  assertUploadSize,
  isAllowedUploadMime,
  type AgentUploadDto,
  type AgentUploadRecord,
} from './agentUploadTypes.js';

export class AgentUploadService {
  private readonly store: AgentUploadStore;
  private readonly uploadsDir: string;

  constructor(private readonly localStore: LocalStore) {
    const conn = localStore.getConnection();
    if (!conn) {
      throw new Error('PgConnection not available for AgentUploadService');
    }
    this.store = new AgentUploadStore(conn);
    this.uploadsDir = path.join(localStore.getDataDir(), 'agent-uploads');
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  async upload(agentId: string | undefined, file: MultipartFile | undefined): Promise<AgentUploadDto> {
    const trimmedAgentId = agentId?.trim();
    if (!trimmedAgentId) {
      throw new AppError(400, 'agentId is required');
    }
    if (!file) {
      throw new AppError(400, 'file is required');
    }

    await this.assertAgentExists(trimmedAgentId);

    const mime = (file.mimetype || 'application/octet-stream').trim().toLowerCase();
    if (!isAllowedUploadMime(mime)) {
      throw new AppError(415, `unsupported mime type: ${mime}`);
    }

    const buffer = await file.toBuffer();
    assertUploadSize(buffer.byteLength);

    const name = path.basename(file.filename || 'upload').trim() || 'upload';
    const record = await this.store.insert({
      agentId: trimmedAgentId,
      name,
      mime,
      size: buffer.byteLength,
    });

    const absolutePath = path.join(this.uploadsDir, record.id);
    fs.writeFileSync(absolutePath, buffer);

    return this.toDto(record);
  }

  async getUploadFile(id: string): Promise<{ record: AgentUploadDto; absolutePath: string }> {
    const record = await this.store.get(id);
    if (!record) {
      throw new AppError(404, `upload ${id} not found`);
    }
    const absolutePath = path.isAbsolute(record.storagePath)
      ? record.storagePath
      : path.join(this.localStore.getDataDir(), record.storagePath);
    if (!fs.existsSync(absolutePath)) {
      throw new AppError(404, `upload file missing for ${id}`);
    }
    return { record: this.toDto(record), absolutePath };
  }

  async getRecord(id: string): Promise<AgentUploadRecord | null> {
    return this.store.get(id);
  }

  async assertUploadOwnedByAgent(agentId: string, fileId: string): Promise<AgentUploadRecord> {
    const trimmedId = fileId.trim();
    if (!trimmedId) {
      throw new AppError(400, 'fileId is required', 'FILE_NOT_FOUND');
    }
    const record = await this.store.get(trimmedId);
    if (!record || record.agentId !== agentId) {
      throw new AppError(400, `upload ${trimmedId} not found`, 'FILE_NOT_FOUND');
    }
    return record;
  }

  async readContent(
    agentId: string,
    fileId: string,
    maxBytes: number,
  ): Promise<{
    content: string;
    encoding: 'utf-8' | 'base64';
    mime: string;
    name: string;
    size: number;
    truncated: boolean;
  }> {
    const record = await this.assertUploadOwnedByAgent(agentId, fileId);
    const { absolutePath } = await this.getUploadFile(record.id);
    const buffer = await fsPromises.readFile(absolutePath);
    const truncated = buffer.byteLength > maxBytes;
    const slice = truncated ? buffer.subarray(0, maxBytes) : buffer;
    const mime = record.mime;
    const encoding = isTextUploadMime(mime) ? 'utf-8' : 'base64';

    return {
      content: encoding === 'utf-8' ? slice.toString('utf8') : slice.toString('base64'),
      encoding,
      mime,
      name: record.name,
      size: record.size,
      truncated,
    };
  }

  private toDto(record: {
    id: string;
    name: string;
    mime: string;
    size: number;
  }): AgentUploadDto {
    return {
      uploadId: record.id,
      fileId: record.id,
      name: record.name,
      mime: record.mime,
      mimeType: record.mime,
      size: record.size,
      url: `/api/agent-uploads/${encodeURIComponent(record.id)}`,
    };
  }

  private async assertAgentExists(agentId: string): Promise<void> {
    const agents = await this.localStore.listAgents();
    if (!agents.some((agent: { id: string }) => agent.id === agentId)) {
      throw new AppError(404, `agent ${agentId} not found`);
    }
  }
}

function isTextUploadMime(mime: string): boolean {
  const normalized = mime.trim().toLowerCase();
  return normalized.startsWith('text/') || normalized === 'application/json';
}
