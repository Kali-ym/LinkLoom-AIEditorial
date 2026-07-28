import { LocalStore } from '../dist/services/LocalStore.js';

const store = new LocalStore();
await store.init();

const stats = await store.getSourceDataStats();
console.log(
  JSON.stringify(
    {
      databaseUrl: store.getDbPath().replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      ...stats
    },
    null,
    2
  )
);

await store.close();
