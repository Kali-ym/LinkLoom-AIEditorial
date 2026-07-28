import path from 'path';
import { execSync } from 'child_process';

const backupRoot = process.env.BACKUP_DIR || path.resolve(process.cwd(), 'backups');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const targetDir = path.join(backupRoot, `linkloom-${stamp}`);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Cannot run pg_dump.');
  process.exit(1);
}

const { mkdirSync } = await import('fs');
mkdirSync(targetDir, { recursive: true });

const dumpFile = path.join(targetDir, 'database.sql');
console.log(`Dumping database to ${dumpFile} ...`);
execSync(`pg_dump --no-owner --no-privileges --format=plain "${databaseUrl}" > "${dumpFile}"`, {
  stdio: 'inherit'
});

// Backup file-based data (memory, knowledge, skills) if DATA_DIR exists
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const { existsSync, copySync } = await import('fs-extra');
for (const name of ['memory', 'knowledge', 'skills']) {
  const src = path.join(dataDir, name);
  if (existsSync(src)) {
    copySync(src, path.join(targetDir, name));
  }
}

const { writeJsonSync } = await import('fs-extra');
writeJsonSync(
  path.join(targetDir, 'manifest.json'),
  {
    createdAt: new Date().toISOString(),
    databaseUrl: databaseUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
    includes: ['database.sql', 'memory', 'knowledge', 'skills']
  },
  { spaces: 2 }
);

console.log(JSON.stringify({ status: 'ok', backupDir: targetDir }, null, 2));
