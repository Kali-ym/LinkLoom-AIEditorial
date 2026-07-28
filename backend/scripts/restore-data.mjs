import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs-extra';

const backupDir = process.argv[2];
if (!backupDir) {
  console.error('Usage: pnpm run restore:data -- /path/to/backup-dir');
  process.exit(1);
}

const dumpFile = path.join(backupDir, 'database.sql');
if (!(await fs.pathExists(dumpFile))) {
  console.error(`Missing backup dump: ${dumpFile}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Cannot restore.');
  process.exit(1);
}

console.log(`Restoring database from ${dumpFile} ...`);
execSync(`psql "${databaseUrl}" < "${dumpFile}"`, { stdio: 'inherit' });

// Restore file-based data (memory, knowledge, skills)
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
await fs.ensureDir(dataDir);
for (const name of ['memory', 'knowledge', 'skills']) {
  const src = path.join(backupDir, name);
  if (await fs.pathExists(src)) {
    await fs.copy(src, path.join(dataDir, name), { overwrite: true });
  }
}

console.log(
  JSON.stringify(
    {
      status: 'ok',
      restoredTo: databaseUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      warning: 'Restart LinkLoom before serving traffic from the restored database.'
    },
    null,
    2
  )
);
