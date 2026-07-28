import { LocalStore } from '../dist/services/LocalStore.js';

const days = Number(process.env.SOURCE_DATA_RETENTION_DAYS || 365);
if (!Number.isFinite(days) || days < 30) {
  console.error('SOURCE_DATA_RETENTION_DAYS must be a number >= 30.');
  process.exit(1);
}

const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const beforeDate = before.toISOString().slice(0, 10);

const store = new LocalStore();
await store.init();

const archived = await store.archiveSourceDataBefore(beforeDate);
await store.optimizeSourceData();

console.log(
  JSON.stringify(
    {
      status: 'ok',
      retentionDays: days,
      beforeDate,
      archived
    },
    null,
    2
  )
);

await store.close();
