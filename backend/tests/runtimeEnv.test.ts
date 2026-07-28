import fs from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDatabaseUrl } from '../src/config/runtimeEnv.js';

describe('resolveDatabaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds URL from POSTGRES_* when DATABASE_URL is unset', () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('POSTGRES_USER', 'u');
    vi.stubEnv('POSTGRES_PASSWORD', 'p');
    vi.stubEnv('POSTGRES_HOST', 'db');
    vi.stubEnv('POSTGRES_PORT', '5433');
    vi.stubEnv('POSTGRES_DB', 'app');
    expect(resolveDatabaseUrl()).toBe('postgres://u:p@db:5433/app');
  });

  it('prefers DATABASE_URL when set', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://custom:5432/x');
    expect(resolveDatabaseUrl()).toBe('postgres://custom:5432/x');
  });

  it('ignores loopback DATABASE_URL inside Docker', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === '/.dockerenv');
    vi.stubEnv('DATABASE_URL', 'postgres://linkloom:linkloom@localhost:5432/linkloom');
    vi.stubEnv('POSTGRES_HOST', 'localhost');
    vi.stubEnv('POSTGRES_USER', 'linkloom');
    vi.stubEnv('POSTGRES_PASSWORD', 'linkloom');
    vi.stubEnv('POSTGRES_DB', 'linkloom');
    expect(resolveDatabaseUrl()).toBe('postgres://linkloom:linkloom@postgres:5432/linkloom');
    vi.mocked(fs.existsSync).mockRestore();
  });

  it('maps postgres host to localhost outside Docker', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('POSTGRES_HOST', 'postgres');
    vi.stubEnv('POSTGRES_USER', 'linkloom');
    vi.stubEnv('POSTGRES_PASSWORD', 'linkloom');
    vi.stubEnv('POSTGRES_DB', 'linkloom');
    expect(resolveDatabaseUrl()).toBe('postgres://linkloom:linkloom@localhost:5432/linkloom');
    vi.mocked(fs.existsSync).mockRestore();
  });
});
