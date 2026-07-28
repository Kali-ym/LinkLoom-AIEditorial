import { parse as csvParse } from 'csv-parse/sync';
import crypto from 'crypto';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import { LogService } from '../LogService.js';
import type { ChunkOptions } from '../rag/RagSettings.js';
import { resolveChunkOptions } from '../rag/RagSettings.js';

export interface ProcessedDocument {
  text: string;
  type: string;
  metadata: any;
}

export interface ProcessedChunk {
  content: string;
  metadata: {
    headingPath: string[];
    tokenCount: number;
    section?: string;
    chunkStrategy: string;
    chunkSize: number;
    chunkOverlap: number;
    chunkIndex: number;
    checksum: string;
  };
}

export class DocumentProcessor {
  /**
   * 将文档文件解析为文本
   */
  async parse(fileName: string, buffer: Buffer): Promise<ProcessedDocument> {
    const ext = fileName.split('.').pop()?.toLowerCase();
    let text = '';
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const metadata: any = {
      fileName,
      sourceType: ext || 'unknown',
      sourceUri: fileName,
      title: stripExtension(fileName),
      version: checksum.slice(0, 12),
      checksum,
      rawContentRef: `knowledge://${fileName}`
    };

    try {
      if (ext === 'pdf') {
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        text = result.text;
        // 尝试获取基本信息
        try {
          const info = await parser.getInfo();
          metadata.info = info.info;
        } catch (e) {
          LogService.warn(`Failed to get PDF info: ${e}`);
        }
        await parser.destroy();
      } else if (ext === 'docx' || ext === 'doc') {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
        metadata.messages = result.messages;
      } else if (ext === 'csv') {
        const records: string[][] = csvParse(buffer, {
          skip_empty_lines: true,
          trim: true
        });
        text = records.map((row) => row.join(' ')).join('\n');
      } else if (ext === 'xlsx' || ext === 'xls') {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetTexts: string[] = [];
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv) {
            sheetTexts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
          }
        });
        text = sheetTexts.join('\n\n');
      } else if (ext === 'md' || ext === 'txt' || ext === 'markdown') {
        text = buffer.toString('utf8');
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      return {
        text: text.trim(),
        type: ext || 'unknown',
        metadata: {
          ...metadata,
          textChecksum: crypto.createHash('sha256').update(text.trim()).digest('hex'),
          headingPath: extractHeadingPath(text)
        }
      };
    } catch (error: any) {
      LogService.error(`Failed to parse document ${fileName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 将长文本切分为块
   */
  chunk(text: string, options?: Partial<ChunkOptions>): string[] {
    return this.chunkDetailed(text, options).map((chunk) => chunk.content);
  }

  chunkDetailed(text: string, options?: Partial<ChunkOptions>): ProcessedChunk[] {
    const resolved = resolveChunkOptions(options);
    if (!text) return [];

    const cleanText = text.replace(/\n\s*\n/g, '\n\n').trim();
    if (!cleanText) return [];

    const contents = resolved.chunkStrategy === 'structure'
      ? this.chunkStructure(cleanText, resolved)
      : this.chunkFixed(cleanText, resolved.chunkSize, resolved.chunkOverlap);
    return contents.map((content, index) => {
      const headingPath = extractHeadingPath(content);
      return {
        content,
        metadata: {
          headingPath,
          tokenCount: estimateTokens(content),
          section: headingPath.at(-1),
          chunkStrategy: resolved.chunkStrategy,
          chunkSize: resolved.chunkSize,
          chunkOverlap: resolved.chunkOverlap,
          chunkIndex: index,
          checksum: crypto.createHash('sha256').update(content).digest('hex')
        }
      };
    });
  }

  private chunkFixed(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
      if (start >= text.length) break;
    }
    return chunks;
  }

  chunkStructure(text: string, options?: Partial<ChunkOptions>): string[] {
    const resolved = resolveChunkOptions(options);
    const cleanText = text.replace(/\n\s*\n/g, '\n\n').trim();
    if (!cleanText) return [];
    return this.chunkStructureInternal(cleanText, resolved);
  }

  private chunkStructureInternal(text: string, options: ChunkOptions): string[] {
    const headerSections = this.splitByMarkdownHeaders(text);
    const sections =
      headerSections.length > 1 ? headerSections : this.splitByParagraphs(text);
    return this.mergeSections(sections, options);
  }

  private splitByMarkdownHeaders(text: string): string[] {
    const lines = text.split('\n');
    const sections: string[] = [];
    let current: string[] = [];

    for (const line of lines) {
      if (/^#{1,6}\s+/.test(line) && current.length > 0) {
        const section = current.join('\n').trim();
        if (section) sections.push(section);
        current = [line];
      } else {
        current.push(line);
      }
    }

    const tail = current.join('\n').trim();
    if (tail) sections.push(tail);
    return sections;
  }

  private splitByParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private mergeSections(sections: string[], options: ChunkOptions): string[] {
    const chunks: string[] = [];
    let buffer = '';

    const flushBuffer = () => {
      if (buffer) {
        chunks.push(buffer);
        buffer = '';
      }
    };

    for (const section of sections) {
      if (section.length > options.semanticMaxChunkSize) {
        flushBuffer();
        chunks.push(...this.splitOversizedSection(section, options));
        continue;
      }

      const candidate = buffer ? `${buffer}\n\n${section}` : section;
      if (candidate.length <= options.semanticMaxChunkSize) {
        buffer = candidate;
        continue;
      }

      flushBuffer();
      buffer = section;
    }

    flushBuffer();

    if (chunks.length === 0) {
      return sections.length > 0 ? [sections.join('\n\n')] : [];
    }

    return this.mergeSmallChunks(chunks, options.semanticMinChunkSize, options.semanticMaxChunkSize);
  }

  private splitOversizedSection(section: string, options: ChunkOptions): string[] {
    const paragraphs = this.splitByParagraphs(section);
    if (paragraphs.length <= 1) {
      return this.chunkFixed(section, options.semanticMaxChunkSize, options.chunkOverlap);
    }
    return this.mergeSections(paragraphs, options);
  }

  private mergeSmallChunks(chunks: string[], minSize: number, maxSize: number): string[] {
    if (minSize <= 0 || chunks.length <= 1) return chunks;

    const merged: string[] = [];
    let buffer = '';

    const flush = () => {
      if (buffer) {
        merged.push(buffer);
        buffer = '';
      }
    };

    for (const chunk of chunks) {
      if (!buffer) {
        buffer = chunk;
        continue;
      }

      const candidate = `${buffer}\n\n${chunk}`;
      if (buffer.length < minSize && candidate.length <= maxSize) {
        buffer = candidate;
      } else {
        flush();
        buffer = chunk;
      }
    }

    flush();
    return merged;
  }
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function extractHeadingPath(text: string): string[] {
  const headings = String(text || '')
    .split('\n')
    .map((line) => line.match(/^(#{1,6})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match));
  if (headings.length === 0) return [];
  const path: string[] = [];
  for (const match of headings) {
    const level = match[1].length;
    path.length = Math.max(0, level - 1);
    path[level - 1] = match[2].trim();
  }
  return path.filter(Boolean);
}

function estimateTokens(text: string): number {
  return Math.ceil(String(text || '').length / 4);
}
