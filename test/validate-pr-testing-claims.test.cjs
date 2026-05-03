const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, '..', 'scripts', 'validate-pr-testing-claims.cjs');

function run(body) {
  const file = path.join(os.tmpdir(), `pr-body-${Date.now()}-${Math.random()}.md`);
  fs.writeFileSync(file, body);
  const result = spawnSync('node', [script, file], { encoding: 'utf8' });
  fs.unlinkSync(file);
  return result;
}

{
  const res = run('');
  assert.notStrictEqual(res.status, 0);
}

{
  const res = run('## Summary\n- x\n\n## Testing\n- `npm run lint`');
  assert.strictEqual(res.status, 0);
}

{
  const res = run('## Summary\n- x\n\n### Testing\n```bash\nnpm test\n```');
  assert.strictEqual(res.status, 0);
}

{
  const res = run('## Summary\n- x\n\n## Testing\n- all tests passed');
  assert.notStrictEqual(res.status, 0);
}

{
  const res = run('## Summary\n- x\n\n## Testing\n- not run locally');
  assert.strictEqual(res.status, 0);
}

console.log('validate-pr-testing-claims tests passed');
