import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TARGET_DIRS = ['backend/src', 'admin/src', 'web/src', 'README.md'];
const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.yaml',
  '.yml',
  '.css',
  '.html'
]);
const MOJIBAKE_PATTERNS = [/锛|锝|涓|绠|鐭|鏃|閫|鎼|龚|�/, /[\u00c0-\u00ff]{3,}/];

function collectFiles(target) {
  const fullPath = path.join(ROOT, target);
  if (!fs.existsSync(fullPath)) return [];
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) return [fullPath];

  const files = [];
  for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'public') continue;
    const child = path.join(target, entry.name);
    files.push(...collectFiles(child));
  }
  return files;
}

const findings = [];
for (const file of TARGET_DIRS.flatMap(collectFiles)) {
  const ext = path.extname(file);
  if (!TEXT_EXTENSIONS.has(ext)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (MOJIBAKE_PATTERNS.some((pattern) => pattern.test(line))) {
      findings.push(`${path.relative(ROOT, file)}:${idx + 1}: ${line.trim().slice(0, 160)}`);
    }
  });
}

if (findings.length > 0) {
  console.error('Possible encoding/mojibake issues found:');
  for (const finding of findings.slice(0, 200)) {
    console.error(`  ${finding}`);
  }
  if (findings.length > 200) {
    console.error(`  ... and ${findings.length - 200} more`);
  }
  process.exit(1);
}

console.log('Encoding check passed.');
