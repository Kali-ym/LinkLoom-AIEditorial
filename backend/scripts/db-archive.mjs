import { LocalStore } from '../dist/services/LocalStore.js';

const beforeArgIndex = process.argv.findIndex((arg) => arg === '--before');
const limitArgIndex = process.argv.findIndex((arg) => arg === '--limit');
const beforeDate = beforeArgIndex >= 0 ? process.argv[beforeArgIndex + 1] : undefined;
const limit = limitArgIndex >= 0 ? Number(process.argv[limitArgIndex + 1]) : undefined;

if (!beforeDate || !/^\d{4}-\d{2}-\d{2}$/.test(beforeDate)) {
  console.error('Usage: pnpm run db:archive -- --before YYYY-MM-DD [--limit 5000]');
  process.exit(1);
}

const store = new LocalStore();
await store.init();

const archived = await store.archiveSourceDataBefore(
  beforeDate,
  Number.isFinite(limit) ? limit : undefined
);
await store.optimizeSourceData();

console.log(
  JSON.stringify(
    {
      status: 'ok',
      beforeDate,
      archived
    },
    null,
    2
  )
);

await store.close();
