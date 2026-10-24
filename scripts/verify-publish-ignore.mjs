import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function git(args, input) {
  const result = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: root, input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.ok(result.status === 0 || result.status === 1, result.stderr);
  return result.stdout.split('\0').filter(Boolean);
}
const ignored = [
  '.local/runtime.json', '.env', '.env.production', 'examples/demo/.env.local',
  'credentials.patch.yml', 'examples/demo/credentials.local.yml', 'auth.json',
  'private.pem', 'private.key', '.validation/acceptance.json', '.delivery/copy.txt',
  '.claude/settings.json', 'experiments/notes.md', 'design-demos/capture.png',
  'packages/extensions/man-roleplayer/h3/credentials.yml', 'man-roleplayer/notes.md',
  'examples/demo/.sessions/live.jsonl', 'examples/demo/.storages/state.json',
  'node_modules/pkg/index.js', 'packages/core/demo/node_modules/pkg/index.js',
  'packages/core/demo/lib/index.js', 'apps/web/dist/index.html', '.cache/state.json',
  'coverage/report.json', 'python/pkg/__pycache__/module.pyc',
];
const publishable = [
  '.env.example', '.env.template', 'examples/demo/.env.example',
  'examples/demo/.env.template', 'package.json', 'pnpm-lock.yaml',
  'pnpm-workspace.yaml', 'packages/extensions/man-roleplayer/src/index.ts',
  'packages/client/ui-man-roleplayer/src/index.test.ts',
  'examples/demo/fixture.jsonl', 'apps/web/tests/snapshots/flow/session.jsonl',
  'scripts/snapshots/python-sdk-single-exe/advanced/session.jsonl',
  'docs/assets/screenshot.png', 'packages/demo/tests/fixture.json',
];
const actualIgnored = new Set(git(['check-ignore', '--no-index', '--stdin', '-z'],
  [...ignored, ...publishable].join('\0') + '\0'));
for (const path of ignored) assert.ok(actualIgnored.has(path), `Should ignore: ${path}`);
for (const path of publishable) assert.ok(!actualIgnored.has(path), `Should publish: ${path}`);
// --no-index防止已暂存文件绕过忽略规则，及时发现源码或fixture被误排除。
const tracked = git(['ls-files', '-z']);
const hiddenTracked = git(['check-ignore', '--no-index', '--stdin', '-z'], tracked.join('\0') + '\0');
assert.deepEqual(hiddenTracked, [], `Tracked files ignored:\n${hiddenTracked.join('\n')}`);
console.log(`PASS: ${ignored.length} ignored paths, ${publishable.length} publishable paths, ${tracked.length} tracked files without ignore conflicts.`);
