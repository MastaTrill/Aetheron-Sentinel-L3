import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEPRECATED_PREFIX = 'sentinel-l3-v1.0/';
const RELEASE_CORE = new Set(['SentinelInterceptor', 'CircuitBreaker', 'RateLimiter']);
const errors = [];

const activeRoots = ['.github/workflows', 'scripts', 'script', 'config', 'site', 'docs'];
const allowedExtensions = new Set(['.yml', '.yaml', '.json', '.js', '.cjs', '.mjs', '.ts', '.md', '.sol']);
const allowDeprecatedReferences = new Set([
  'sentinel-l3-v1.0/README_DEPRECATED.md',
  'PROJECT_STATUS.md',
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (allowedExtensions.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

for (const root of activeRoots) {
  for (const file of walk(path.join(ROOT, root))) {
    const relative = path.relative(ROOT, file).replaceAll('\\', '/');
    if (relative.startsWith(DEPRECATED_PREFIX) || allowDeprecatedReferences.has(relative)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes(DEPRECATED_PREFIX)) {
      errors.push(`active file references deprecated tree: ${relative}`);
    }
  }
}

const scopePath = path.join(ROOT, 'PROJECT_STATUS.md');
if (!fs.existsSync(scopePath)) {
  errors.push('PROJECT_STATUS.md is required');
} else {
  const scope = fs.readFileSync(scopePath, 'utf8');
  for (const contract of RELEASE_CORE) {
    if (!scope.includes(contract)) errors.push(`release scope omits ${contract}`);
  }
  if (!/Base Mainnet[^\n]*(Pending|not deployed)/i.test(scope)) {
    errors.push('PROJECT_STATUS.md must state that Base mainnet Sentinel deployment is pending/not deployed');
  }
}

for (const fileName of ['DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md', 'RELEASE_NOTES_MAINNET_2026-04-27.md']) {
  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath)) continue;
  const text = fs.readFileSync(filePath, 'utf8');
  if (!/(historical|not executed|unexecuted|no mainnet deployment)/i.test(text)) {
    errors.push(`${fileName} must be explicitly marked historical and unexecuted`);
  }
}

if (errors.length) {
  console.error('Canonical Sentinel release validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Canonical Sentinel release scope validation passed.');
