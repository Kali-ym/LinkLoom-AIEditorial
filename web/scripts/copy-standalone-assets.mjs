import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..');

const standaloneRoot = path.join(webRoot, '.next', 'standalone');
if (!fs.existsSync(standaloneRoot)) {
  console.error('[copy-standalone-assets] standalone output not found, did you run `next build`?');
  process.exit(1);
}

/** pnpm standalone 里大量 symlink；必须 dereference 才能复制成可运行的实体目录。 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, dereference: true });
}

/** monorepo + outputFileTracingRoot 时 server 可能在 standalone/web/server.js */
function resolveStandaloneAppDir() {
  const nested = path.join(standaloneRoot, 'web', 'server.js');
  const flat = path.join(standaloneRoot, 'server.js');
  if (fs.existsSync(nested)) return path.join(standaloneRoot, 'web');
  if (fs.existsSync(flat)) return standaloneRoot;
  throw new Error('[copy-standalone-assets] standalone server.js not found');
}

function isPnpmVirtualNodeModules(dir) {
  const normalized = dir.split(path.sep).join('/');
  return normalized.includes('/.pnpm/') && normalized.endsWith('/node_modules');
}

/**
 * pnpm standalone 里 app/node_modules/next 常是指向 .pnpm/.../node_modules/next 的 symlink。
 * 不能只复制 next 目录，否则 @swc/helpers 等同级依赖会丢失。
 * 改为把该 pnpm 虚拟 node_modules 下的全部包复制到 app node_modules。
 */
function materializePnpmSymlinkGroup(modulesDir, name) {
  const linkPath = path.join(modulesDir, name);
  if (!fs.existsSync(linkPath) || !fs.lstatSync(linkPath).isSymbolicLink()) {
    return false;
  }

  const resolved = fs.realpathSync(linkPath);
  const pnpmModulesDir = path.dirname(resolved);
  if (!isPnpmVirtualNodeModules(pnpmModulesDir)) {
    return false;
  }

  fs.rmSync(linkPath, { recursive: true, force: true });

  for (const pkgName of fs.readdirSync(pnpmModulesDir)) {
    const src = path.join(pnpmModulesDir, pkgName);
    const dest = path.join(modulesDir, pkgName);
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    copyDir(src, dest);
  }

  console.log(
    `[copy-standalone-assets] materialized pnpm group for ${name} -> ${path.relative(standaloneRoot, modulesDir)}/*`
  );
  return true;
}

function patchIncompleteNext(modulesDir) {
  const nextDir = path.join(modulesDir, 'next');
  if (!fs.existsSync(nextDir)) return;

  const cpuProfile = path.join(nextDir, 'dist/server/lib/cpu-profile.js');
  if (fs.existsSync(cpuProfile)) return;

  for (const base of [webRoot, repoRoot]) {
    const candidate = path.join(base, 'node_modules', 'next');
    if (!fs.existsSync(candidate)) continue;
    const real = fs.realpathSync(candidate);
    if (!fs.existsSync(path.join(real, 'dist/server/lib/cpu-profile.js'))) continue;
    fs.rmSync(nextDir, { recursive: true, force: true });
    copyDir(real, nextDir);
    console.log(`[copy-standalone-assets] patched incomplete next from workspace`);
    return;
  }

  console.warn('[copy-standalone-assets] next package in standalone is incomplete and no workspace fallback found');
}

function materializeAppNodeModules(modulesDir) {
  if (!fs.existsSync(modulesDir)) return;

  const symlinks = fs.readdirSync(modulesDir).filter((name) =>
    fs.lstatSync(path.join(modulesDir, name)).isSymbolicLink()
  );

  if (symlinks.length === 0) {
    patchIncompleteNext(modulesDir);
    return;
  }

  // 通常只有 next 一个 symlink；复制整个 pnpm 依赖组即可。
  for (const name of symlinks) {
    if (!materializePnpmSymlinkGroup(modulesDir, name)) {
      const dest = path.join(modulesDir, name);
      const src = fs.realpathSync(dest);
      fs.rmSync(dest, { recursive: true, force: true });
      copyDir(src, dest);
      console.log(`[copy-standalone-assets] materialized ${path.relative(standaloneRoot, dest)}`);
    }
  }

  patchIncompleteNext(modulesDir);
}

const appDir = resolveStandaloneAppDir();
materializeAppNodeModules(path.join(appDir, 'node_modules'));

const staticSrc = path.join(webRoot, '.next', 'static');
const staticDest = path.join(appDir, '.next', 'static');
copyDir(staticSrc, staticDest);
console.log(`[copy-standalone-assets] .next/static -> ${path.relative(webRoot, staticDest)}`);

const publicSrc = path.join(webRoot, 'public');
const publicDest = path.join(appDir, 'public');
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, publicDest);
  console.log(`[copy-standalone-assets] public -> ${path.relative(webRoot, publicDest)}`);
}
