import { LocalStore } from '../dist/services/LocalStore.js';

const store = new LocalStore();
await store.init();

const checks = {
  dbConnected: false,
  statsReadable: false,
  dataDirExists: false
};

try {
  const stats = await store.getSourceDataStats();
  checks.dbConnected = true;
  checks.statsReadable = typeof stats.total === 'number';
} catch {
  checks.dbConnected = false;
  checks.statsReadable = false;
}

const { existsSync } = await import('fs');
checks.dataDirExists = existsSync(store.getDataDir());

const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({ status: ok ? 'ok' : 'failed', checks }, null, 2));
await store.close();
if (!ok) process.exit(1);
