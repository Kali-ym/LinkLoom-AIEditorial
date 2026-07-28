import { describe, expect, it } from 'vitest';
import { DocumentProcessor } from '../src/services/knowledge/DocumentProcessor.js';

describe('DocumentProcessor.chunk', () => {
  const processor = new DocumentProcessor();

  it('splits by fixed length with overlap', () => {
    const text = 'a'.repeat(5000);
    const chunks = processor.chunk(text, {
      chunkStrategy: 'fixed',
      chunkSize: 3000,
      chunkOverlap: 400,
      semanticMaxChunkSize: 3000,
      semanticMinChunkSize: 200
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(3000);
    expect(chunks[1]).toHaveLength(2400);
  });

  it('splits markdown by headings in structure mode', () => {
    const filler = 'x'.repeat(120);
    const text = [
      '# Daily Report',
      filler,
      '',
      '## Topic A',
      filler,
      '',
      '## Topic B',
      filler
    ].join('\n');

    const chunks = processor.chunk(text, {
      chunkStrategy: 'structure',
      chunkSize: 3000,
      chunkOverlap: 400,
      semanticMaxChunkSize: 200,
      semanticMinChunkSize: 0
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.join('\n---\n')).toContain('## Topic A');
    expect(chunks.join('\n---\n')).toContain('## Topic B');
  });

  it('falls back to paragraphs when no markdown headings exist', () => {
    const text = [
      'Paragraph one '.repeat(12).trim(),
      '',
      'Paragraph two '.repeat(12).trim(),
      '',
      'Paragraph three '.repeat(12).trim()
    ].join('\n');

    const chunks = processor.chunk(text, {
      chunkStrategy: 'structure',
      chunkSize: 3000,
      chunkOverlap: 400,
      semanticMaxChunkSize: 200,
      semanticMinChunkSize: 0
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('Paragraph one');
  });

  it('returns traceable metadata for structure chunks', () => {
    const chunks = processor.chunkDetailed('# Guide\n\n## Install\n\nRun setup.', {
      chunkStrategy: 'structure',
      chunkSize: 3000,
      chunkOverlap: 400,
      semanticMaxChunkSize: 3000,
      semanticMinChunkSize: 0
    });

    expect(chunks[0].metadata.headingPath).toContain('Guide');
    expect(chunks[0].metadata.chunkStrategy).toBe('structure');
    expect(chunks[0].metadata.tokenCount).toBeGreaterThan(0);
    expect(chunks[0].metadata.checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});
