import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const outDir = '/tmp/linkloom-workflow-utils-test';
const adminRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(outDir, { recursive: true, force: true });
execFileSync('npx', [
  'tsc',
  'src/vite-env.d.ts',
  'src/utils/workflowFieldRefs.ts',
  'src/utils/workflowGraph.ts',
  '--target',
  'ES2022',
  '--module',
  'ES2022',
  '--moduleResolution',
  'node',
  '--outDir',
  outDir,
  '--skipLibCheck'
], { cwd: adminRoot, stdio: 'inherit' });

const refs = await import(pathToFileURL(`${outDir}/utils/workflowFieldRefs.js`));
const graph = await import(pathToFileURL(`${outDir}/utils/workflowGraph.js`));

assert.deepEqual(
  refs.normalizeWorkflowStepInputTemplate({ id: 'qa', inputMap: { fragments: '$.digest' }, outputMap: { legacy: '$.output' } }),
  { id: 'qa', inputTemplate: { fragments: '$.digest' } }
);
assert.deepEqual(
  refs.normalizeWorkflowStepInputTemplate({ id: 'qa', inputTemplate: { ready: true }, inputMap: { ignored: '$.x' } }),
  { id: 'qa', inputTemplate: { ready: true } }
);

const workflow = {
  id: 'wf',
  steps: [
    { id: 'a', nextStepIds: ['b'] },
    { id: 'b', nextStepIds: [] }
  ]
};

assert.deepEqual(graph.getNextStepIds(workflow.steps[0]), ['b']);
assert.deepEqual(graph.getNextStepIds(workflow.steps[1]), []);

console.log('Workflow UI utility tests passed.');
