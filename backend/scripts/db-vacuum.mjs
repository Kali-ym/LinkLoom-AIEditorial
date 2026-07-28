import { LocalStore } from '../dist/services/LocalStore.js';

const store = new LocalStore();
await store.init();

await store.vacuum();

console.log(
  JSON.stringify(
    {
      status: 'ok',
      databaseUrl: store.getDbPath().replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      message: 'PostgreSQL VACUUM ANALYZE completed.'
    },
    null,
    2
  )
);

await store.close();
