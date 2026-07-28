import { vi } from 'vitest';

vi.mock('@lobehub/fluent-emoji', async () => import('./stubs/fluentEmoji.tsx'));
